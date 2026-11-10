//! Windows-Programm des Prozesslotsen.
//!
//! Die Oberfläche bekommt keine allgemeinen Dateirechte. Sie ruft nur diese
//! Befehle auf, und geschrieben wird nur auf Pfade, die der Benutzer selbst
//! gewählt hat: im Dialog, per Doppelklick oder „Öffnen mit“, ins Fenster
//! gezogen oder aus der Liste „Zuletzt geöffnet“.

use std::{
    collections::HashSet,
    path::{Path, PathBuf},
    sync::Mutex,
};

use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    AppHandle, DragDropEvent, Emitter, Manager, State, WindowEvent, Wry,
};
use tauri_plugin_dialog::DialogExt;

/// Größte Datei, die geöffnet wird (Projekte haben wenige Kilobyte).
const MAX_GROESSE: u64 = 20 * 1024 * 1024;
const MAX_ZULETZT: usize = 10;

/// Pfade, die der Benutzer in dieser Sitzung gewählt hat.
#[derive(Default)]
struct Freigaben(Mutex<HashSet<PathBuf>>);

#[derive(Serialize, Clone)]
struct Datei {
    pfad: String,
    name: String,
    inhalt: String,
}

#[derive(Serialize, Deserialize, Clone, PartialEq)]
struct Zuletzt {
    pfad: String,
    name: String,
}

#[derive(Serialize)]
struct Gespeichert {
    pfad: String,
    name: String,
}

fn dateiname(p: &Path) -> String {
    p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default()
}

fn lies(pfad: &Path) -> Result<Datei, String> {
    let groesse = std::fs::metadata(pfad).map_err(|e| format!("Datei nicht lesbar: {e}"))?.len();
    if groesse > MAX_GROESSE {
        return Err("Die Datei ist zu groß für ein Prozesslotse-Projekt.".into());
    }
    let bytes = std::fs::read(pfad).map_err(|e| format!("Datei nicht lesbar: {e}"))?;
    let inhalt = String::from_utf8(bytes).map_err(|_| "Die Datei ist keine Textdatei (UTF-8).".to_string())?;
    Ok(Datei { pfad: pfad.to_string_lossy().into_owned(), name: dateiname(pfad), inhalt })
}

/// Speichert über eine Hilfsdatei und Umbenennen, damit ein Absturz keine halbe Datei hinterlässt.
fn schreibe(p: &Path, inhalt: &str) -> Result<(), String> {
    let mut tmp = p.as_os_str().to_owned();
    tmp.push(".speichern.tmp");
    let tmp = PathBuf::from(tmp);
    std::fs::write(&tmp, inhalt).map_err(|e| format!("Speichern fehlgeschlagen: {e}"))?;
    std::fs::rename(&tmp, p).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        format!("Speichern fehlgeschlagen: {e}")
    })
}

fn freigeben(app: &AppHandle, p: &Path) {
    app.state::<Freigaben>().0.lock().unwrap().insert(p.to_path_buf());
}

fn zuletzt_datei(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("zuletzt.json"))
}

fn lade_zuletzt(app: &AppHandle) -> Vec<Zuletzt> {
    zuletzt_datei(app)
        .and_then(|d| std::fs::read_to_string(d).ok())
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

fn speichere_zuletzt(app: &AppHandle, liste: &[Zuletzt]) {
    if let Some(d) = zuletzt_datei(app) {
        if let Some(ordner) = d.parent() {
            let _ = std::fs::create_dir_all(ordner);
        }
        if let Ok(t) = serde_json::to_string_pretty(liste) {
            let _ = schreibe(&d, &t);
        }
    }
}

fn merke_zuletzt(app: &AppHandle, p: &Path) {
    let eintrag = Zuletzt { pfad: p.to_string_lossy().into_owned(), name: dateiname(p) };
    let mut liste = lade_zuletzt(app);
    liste.retain(|z| z.pfad != eintrag.pfad);
    liste.insert(0, eintrag);
    liste.truncate(MAX_ZULETZT);
    speichere_zuletzt(app, &liste);
}

/// Öffnet eine vom Benutzer gewählte Datei: lesen, freigeben, in „Zuletzt geöffnet“ eintragen.
fn oeffne_gewaehlt(app: &AppHandle, p: &Path) -> Result<Datei, String> {
    let d = lies(p)?;
    freigeben(app, p);
    merke_zuletzt(app, p);
    Ok(d)
}

/// Nur im Debug-Build: beantwortet Dateidialoge aus einer Umgebungsvariable, damit
/// automatische Tests die echten Abläufe ohne Klicks prüfen können. Im Release fehlt das.
#[cfg(debug_assertions)]
fn testantwort(variable: &str) -> Option<Option<PathBuf>> {
    std::env::var_os(variable).map(|v| if v.is_empty() { None } else { Some(PathBuf::from(v)) })
}
#[cfg(not(debug_assertions))]
fn testantwort(_variable: &str) -> Option<Option<PathBuf>> {
    None
}

/// Erste Datei aus der Befehlszeile (Doppelklick im Explorer, „Öffnen mit“).
fn datei_aus_argumenten(args: &[String], cwd: &Path) -> Option<PathBuf> {
    args.iter().skip(1).find(|a| !a.starts_with('-')).map(|a| cwd.join(a)).filter(|p| p.is_file())
}

#[tauri::command]
fn start_datei(app: AppHandle) -> Result<Option<Datei>, String> {
    let args: Vec<String> = std::env::args().collect();
    let cwd = std::env::current_dir().unwrap_or_default();
    match datei_aus_argumenten(&args, &cwd) {
        Some(p) => oeffne_gewaehlt(&app, &p).map(Some),
        None => Ok(None),
    }
}

#[tauri::command]
async fn oeffnen(app: AppHandle) -> Result<Option<Datei>, String> {
    let wahl = testantwort("PROZESSLOTSE_TEST_OEFFNEN").unwrap_or_else(|| {
        app.dialog()
            .file()
            .set_title("Öffnen")
            .add_filter("Prozesslotse-Projekt oder BPMN-Diagramm", &["prozesslotse", "json", "bpmn"])
            .add_filter("Prozesslotse-Projekt", &["prozesslotse", "json"])
            .add_filter("BPMN-Diagramm", &["bpmn"])
            .blocking_pick_file()
            .and_then(|w| w.into_path().ok())
    });
    match wahl {
        Some(p) => oeffne_gewaehlt(&app, &p).map(Some),
        None => Ok(None),
    }
}

#[tauri::command]
fn speichern(pfad: String, inhalt: String, freigaben: State<Freigaben>) -> Result<(), String> {
    let p = PathBuf::from(&pfad);
    if !freigaben.0.lock().unwrap().contains(&p) {
        return Err("Dieser Pfad wurde nicht vom Benutzer gewählt.".into());
    }
    schreibe(&p, &inhalt)
}

#[tauri::command]
async fn speichern_unter(app: AppHandle, vorschlag: String, inhalt: String, art: String) -> Result<Option<Gespeichert>, String> {
    let (filter, endung, titel) = match art.as_str() {
        "projekt" => ("Prozesslotse-Projekt", "prozesslotse", "Speichern unter"),
        "bpmn" => ("BPMN-Diagramm", "bpmn", "Als BPMN exportieren"),
        "svg" => ("SVG-Bild", "svg", "Als Bild exportieren"),
        _ => return Err(format!("Unbekannte Dateiart: {art}")),
    };
    let wahl = testantwort(&format!("PROZESSLOTSE_TEST_SPEICHERN_{}", art.to_uppercase()))
        .unwrap_or_else(|| app.dialog().file().set_title(titel).set_file_name(&vorschlag).add_filter(filter, &[endung]).blocking_save_file().and_then(|w| w.into_path().ok()));
    let Some(mut p) = wahl else { return Ok(None) };
    // Ohne Endung getippt: passende Endung ergänzen, damit Doppelklick und Filter funktionieren
    if p.extension().is_none() {
        p.set_extension(endung);
    }
    schreibe(&p, &inhalt)?;
    freigeben(&app, &p);
    if art == "projekt" {
        merke_zuletzt(&app, &p);
    }
    Ok(Some(Gespeichert { pfad: p.to_string_lossy().into_owned(), name: dateiname(&p) }))
}

#[tauri::command]
fn zuletzt(app: AppHandle) -> Vec<Zuletzt> {
    let liste = lade_zuletzt(&app);
    let vorhanden: Vec<Zuletzt> = liste.iter().filter(|z| Path::new(&z.pfad).is_file()).cloned().collect();
    if vorhanden != liste {
        speichere_zuletzt(&app, &vorhanden);
    }
    vorhanden
}

#[tauri::command]
fn oeffne_zuletzt(app: AppHandle, pfad: String) -> Result<Datei, String> {
    // Nur Pfade aus der eigenen Liste: Die stammen aus früheren Benutzerentscheidungen.
    if !lade_zuletzt(&app).iter().any(|z| z.pfad == pfad) {
        return Err("Diese Datei steht nicht in „Zuletzt geöffnet“.".into());
    }
    oeffne_gewaehlt(&app, Path::new(&pfad))
}

/// PDF direkt aus der WebView2 (ohne Druckdialog), A4 mit 15 mm Rand. Nutzt die Druck-CSS der Seite.
#[cfg(windows)]
fn drucke_pdf(fenster: &tauri::WebviewWindow, ziel: String) -> Result<(), String> {
    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
    fenster
        .with_webview(move |wv| unsafe {
            use webview2_com::{
                Microsoft::Web::WebView2::Win32::{ICoreWebView2_7, ICoreWebView2Environment6},
                PrintToPdfCompletedHandler,
            };
            use windows::core::{Interface, HSTRING};
            let tx2 = tx.clone();
            let start = (|| -> windows::core::Result<()> {
                let core7: ICoreWebView2_7 = wv.controller().CoreWebView2()?.cast()?;
                let umgebung: ICoreWebView2Environment6 = wv.environment().cast()?;
                let einstellungen = umgebung.CreatePrintSettings()?;
                // Maße in Zoll: A4 = 210 × 297 mm, Rand 15 mm
                einstellungen.SetPageWidth(8.27)?;
                einstellungen.SetPageHeight(11.69)?;
                for rand in [
                    einstellungen.SetMarginTop(0.59),
                    einstellungen.SetMarginBottom(0.59),
                    einstellungen.SetMarginLeft(0.59),
                    einstellungen.SetMarginRight(0.59),
                ] {
                    rand?;
                }
                einstellungen.SetShouldPrintBackgrounds(true)?;
                let fertig = PrintToPdfCompletedHandler::create(Box::new(move |hr, ok| {
                    let _ = tx2.send(if hr.is_ok() && ok { Ok(()) } else { Err(format!("PDF fehlgeschlagen: {hr:?}")) });
                    Ok(())
                }));
                core7.PrintToPdf(&HSTRING::from(ziel.as_str()), &einstellungen, &fertig)
            })();
            if let Err(e) = start {
                let _ = tx.send(Err(e.to_string()));
            }
        })
        .map_err(|e| e.to_string())?;
    rx.recv_timeout(std::time::Duration::from_secs(60)).map_err(|e| e.to_string())?
}

#[tauri::command]
async fn als_pdf(app: AppHandle, fenster: tauri::WebviewWindow, vorschlag: String) -> Result<Option<String>, String> {
    #[cfg(windows)]
    {
        let wahl = testantwort("PROZESSLOTSE_TEST_PDF")
            .unwrap_or_else(|| app.dialog().file().set_title("Als PDF speichern").set_file_name(&vorschlag).add_filter("PDF", &["pdf"]).blocking_save_file().and_then(|w| w.into_path().ok()));
        let Some(mut p) = wahl else { return Ok(None) };
        if p.extension().is_none() {
            p.set_extension("pdf");
        }
        let ziel = p.to_string_lossy().into_owned();
        let z = ziel.clone();
        tauri::async_runtime::spawn_blocking(move || drucke_pdf(&fenster, z)).await.map_err(|e| e.to_string())??;
        Ok(Some(ziel))
    }
    #[cfg(not(windows))]
    {
        let _ = (app, fenster, vorschlag);
        Err("PDF ohne Druckdialog gibt es nur unter Windows.".into())
    }
}

fn baue_menue(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let punkt = |id: &str, text: &str| MenuItemBuilder::with_id(id, text).build(app);
    let datei = SubmenuBuilder::new(app, "&Datei")
        .item(&punkt("neu", "&Neu")?)
        .item(&punkt("oeffnen", "Ö&ffnen …")?)
        .separator()
        .item(&punkt("speichern", "&Speichern")?)
        .item(&punkt("speichernUnter", "Speichern &unter …")?)
        .item(&punkt("bpmn", "Als &BPMN exportieren …")?)
        .separator()
        .item(&punkt("drucken", "&Drucken …")?)
        .item(&punkt("pdf", "Als &PDF speichern …")?)
        .separator()
        .item(&punkt("beenden", "&Beenden")?)
        .build()?;
    let bearbeiten = SubmenuBuilder::new(app, "&Bearbeiten")
        .item(&punkt("rueckgaengig", "&Rückgängig")?)
        .item(&punkt("wiederholen", "&Wiederholen")?)
        .build()?;
    let ansicht = SubmenuBuilder::new(app, "&Ansicht").item(&punkt("lernmodus", "&Lernmodus ein oder aus")?).build()?;
    let beispiele = SubmenuBuilder::new(app, "B&eispiele")
        .item(&punkt("beispielLieferdienst", "&Lieferdienst")?)
        .item(&punkt("beispielOnline", "&Onlinebestellung")?)
        .build()?;
    let hilfe = SubmenuBuilder::new(app, "&Hilfe").item(&punkt("ueber", "Ü&ber Prozesslotse")?).build()?;
    MenuBuilder::new(app).items(&[&datei, &bearbeiten, &ansicht, &beispiele, &hilfe]).build()
}

/// Bringt das Hauptfenster nach vorn, z. B. wenn ein zweiter Start eine Datei übergibt.
fn zeige_hauptfenster(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Zuerst: Ein zweiter Start (Doppelklick auf eine weitere Datei) landet im laufenden Programm.
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            if let Some(p) = datei_aus_argumenten(&args, Path::new(&cwd)) {
                match oeffne_gewaehlt(app, &p) {
                    Ok(d) => {
                        let _ = app.emit("datei-oeffnen", d);
                    }
                    Err(e) => eprintln!("{e}"),
                }
            }
            zeige_hauptfenster(app);
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(Freigaben::default())
        .setup(|app| {
            let menue = baue_menue(app.handle())?;
            app.set_menu(menue)?;
            app.on_menu_event(|app, ereignis| {
                let id = ereignis.id().as_ref();
                if id == "beenden" {
                    // Über das normale Schließen, damit die Oberfläche nach ungespeicherten Änderungen fragt
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.close();
                    }
                } else {
                    let _ = app.emit("menue", id);
                }
            });
            Ok(())
        })
        .on_window_event(|fenster, ereignis| {
            // Datei ins Fenster gezogen: Das ist eine Auswahl des Benutzers, also freigeben.
            if let WindowEvent::DragDrop(DragDropEvent::Drop { paths, .. }) = ereignis {
                if let Some(p) = paths.iter().find(|p| p.is_file()) {
                    let app = fenster.app_handle();
                    if let Ok(d) = oeffne_gewaehlt(app, p) {
                        let _ = app.emit("datei-oeffnen", d);
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![start_datei, oeffnen, speichern, speichern_unter, zuletzt, oeffne_zuletzt, als_pdf])
        .run(tauri::generate_context!())
        .expect("Prozesslotse konnte nicht starten");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn findet_die_datei_in_den_argumenten() {
        let ordner = std::env::temp_dir().join("prozesslotse-test-argumente");
        std::fs::create_dir_all(&ordner).unwrap();
        let datei = ordner.join("beispiel.prozesslotse");
        std::fs::write(&datei, "{}").unwrap();
        let args = vec!["prozesslotse.exe".to_string(), "--flag".to_string(), "beispiel.prozesslotse".to_string()];
        assert_eq!(datei_aus_argumenten(&args, &ordner), Some(datei.clone()));
        let ohne = vec!["prozesslotse.exe".to_string()];
        assert_eq!(datei_aus_argumenten(&ohne, &ordner), None);
        let fehlt = vec!["prozesslotse.exe".to_string(), "gibt-es-nicht.prozesslotse".to_string()];
        assert_eq!(datei_aus_argumenten(&fehlt, &ordner), None);
    }

    #[test]
    fn speichert_atomar_und_liest_wieder() {
        let ordner = std::env::temp_dir().join("prozesslotse-test-schreiben");
        std::fs::create_dir_all(&ordner).unwrap();
        let datei = ordner.join("projekt.prozesslotse");
        schreibe(&datei, "{\"a\":1}").unwrap();
        schreibe(&datei, "{\"a\":2}").unwrap();
        let gelesen = lies(&datei).unwrap();
        assert_eq!(gelesen.inhalt, "{\"a\":2}");
        assert_eq!(gelesen.name, "projekt.prozesslotse");
        assert!(!ordner.join("projekt.prozesslotse.speichern.tmp").exists());
    }

    #[test]
    fn lehnt_binaerdateien_ab() {
        let ordner = std::env::temp_dir().join("prozesslotse-test-binaer");
        std::fs::create_dir_all(&ordner).unwrap();
        let datei = ordner.join("bild.bpmn");
        std::fs::write(&datei, [0xff, 0xfe, 0x00, 0xd8]).unwrap();
        assert!(lies(&datei).is_err());
    }
}
