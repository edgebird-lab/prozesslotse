//! Prototyp: Dateizugriff nur über Pfade, die der Benutzer selbst gewählt hat
//! (Dialog, Doppelklick/„Öffnen mit“). Das Frontend bekommt keine allgemeinen
//! Dateirechte, nur diese Befehle.
use std::{
    collections::HashSet,
    path::{Path, PathBuf},
    sync::Mutex,
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
struct Freigaben(Mutex<HashSet<PathBuf>>);

#[derive(Serialize, Clone)]
struct Geladen {
    pfad: String,
    name: String,
    inhalt: String,
}

fn lies(pfad: PathBuf, f: &Freigaben) -> Result<Geladen, String> {
    let inhalt = std::fs::read_to_string(&pfad).map_err(|e| e.to_string())?;
    let name = pfad.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    f.0.lock().unwrap().insert(pfad.clone());
    Ok(Geladen { pfad: pfad.to_string_lossy().into_owned(), name, inhalt })
}

/// Erste Datei aus der Befehlszeile (Doppelklick im Explorer, „Öffnen mit“).
fn datei_aus_argumenten(args: &[String], cwd: &Path) -> Option<PathBuf> {
    args.iter()
        .skip(1)
        .find(|a| !a.starts_with('-'))
        .map(|a| cwd.join(a))
        .filter(|p| p.is_file())
}

/// Speichert über eine Hilfsdatei, damit ein Absturz keine halbe Datei hinterlässt.
fn schreibe(p: &Path, inhalt: &str) -> Result<(), String> {
    let tmp = p.with_extension("speichern.tmp");
    std::fs::write(&tmp, inhalt).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, p).map_err(|e| e.to_string())
}

#[tauri::command]
fn start_datei(f: State<Freigaben>) -> Result<Option<Geladen>, String> {
    let args: Vec<String> = std::env::args().collect();
    let cwd = std::env::current_dir().unwrap_or_default();
    match datei_aus_argumenten(&args, &cwd) {
        Some(p) => lies(p, &f).map(Some),
        None => Ok(None),
    }
}

#[tauri::command]
async fn oeffnen(app: AppHandle, f: State<'_, Freigaben>) -> Result<Option<Geladen>, String> {
    let wahl = app
        .dialog()
        .file()
        .set_title("Projekt öffnen")
        .add_filter("Prozesslotse-Projekt", &["prozesslotse", "json"])
        .blocking_pick_file();
    match wahl.and_then(|w| w.into_path().ok()) {
        Some(p) => lies(p, &f).map(Some),
        None => Ok(None),
    }
}

#[tauri::command]
fn speichern(pfad: String, inhalt: String, f: State<Freigaben>) -> Result<(), String> {
    let p = PathBuf::from(&pfad);
    if !f.0.lock().unwrap().contains(&p) {
        return Err("Dieser Pfad wurde nicht vom Benutzer gewählt.".into());
    }
    schreibe(&p, &inhalt)
}

#[tauri::command]
async fn speichern_unter(
    app: AppHandle,
    vorschlag: String,
    inhalt: String,
    filter_name: String,
    endung: String,
    f: State<'_, Freigaben>,
) -> Result<Option<String>, String> {
    let wahl = app
        .dialog()
        .file()
        .set_title("Speichern unter")
        .set_file_name(&vorschlag)
        .add_filter(&filter_name, &[endung.as_str()])
        .blocking_save_file();
    let Some(p) = wahl.and_then(|w| w.into_path().ok()) else { return Ok(None) };
    schreibe(&p, &inhalt)?;
    f.0.lock().unwrap().insert(p.clone());
    Ok(Some(p.to_string_lossy().into_owned()))
}

/// PDF direkt aus der WebView2 (ohne Druckdialog). Nutzt die Druck-CSS der Seite.
#[cfg(windows)]
fn drucke_pdf(fenster: &tauri::WebviewWindow, ziel: String) -> Result<(), String> {
    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
    fenster
        .with_webview(move |wv| unsafe {
            use webview2_com::{Microsoft::Web::WebView2::Win32::ICoreWebView2_7, PrintToPdfCompletedHandler};
            use windows::core::{Interface, HSTRING};
            let tx2 = tx.clone();
            let start = (|| -> windows::core::Result<()> {
                let core7: ICoreWebView2_7 = wv.controller().CoreWebView2()?.cast()?;
                let fertig = PrintToPdfCompletedHandler::create(Box::new(move |hr, ok| {
                    let _ = tx2.send(if hr.is_ok() && ok { Ok(()) } else { Err(format!("PDF fehlgeschlagen: {hr:?}")) });
                    Ok(())
                }));
                core7.PrintToPdf(&HSTRING::from(ziel.as_str()), None, &fertig)
            })();
            if let Err(e) = start {
                let _ = tx.send(Err(e.to_string()));
            }
        })
        .map_err(|e| e.to_string())?;
    rx.recv_timeout(std::time::Duration::from_secs(30)).map_err(|e| e.to_string())?
}

#[cfg(windows)]
#[tauri::command]
async fn als_pdf(app: AppHandle, fenster: tauri::WebviewWindow, vorschlag: String) -> Result<Option<String>, String> {
    let wahl = app.dialog().file().set_file_name(&vorschlag).add_filter("PDF", &["pdf"]).blocking_save_file();
    let Some(p) = wahl.and_then(|w| w.into_path().ok()) else { return Ok(None) };
    let ziel = p.to_string_lossy().into_owned();
    let z = ziel.clone();
    tauri::async_runtime::spawn_blocking(move || drucke_pdf(&fenster, z)).await.map_err(|e| e.to_string())??;
    Ok(Some(ziel))
}

/// Nur für die Messung im Prototyp: meldet „Oberfläche gezeichnet“.
#[tauri::command]
fn bereit() {
    if let Ok(ziel) = std::env::var("PL_MESSUNG") {
        let _ = std::fs::write(ziel, "bereit");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Zweiter Start (z. B. Doppelklick auf eine weitere Datei) landet im laufenden Programm.
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            if let Some(p) = datei_aus_argumenten(&args, Path::new(&cwd)) {
                let f = app.state::<Freigaben>();
                if let Ok(g) = lies(p, &f) {
                    let _ = app.emit("datei-oeffnen", g);
                }
            }
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(Freigaben::default())
        .setup(|app| {
            // Prototyp-Test ohne Klicks: Bericht öffnen und als PDF ausgeben, wenn PL_PDF gesetzt ist.
            #[cfg(windows)]
            if let Ok(ziel) = std::env::var("PL_PDF") {
                let fenster = app.get_webview_window("main").expect("Hauptfenster fehlt");
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(4));
                    let _ = fenster.eval("document.querySelectorAll('.schrittleiste button')[5]?.click()");
                    std::thread::sleep(std::time::Duration::from_secs(4));
                    let meldung = match drucke_pdf(&fenster, ziel.clone()) {
                        Ok(()) => "ok".to_string(),
                        Err(e) => e,
                    };
                    let _ = std::fs::write(format!("{ziel}.status.txt"), meldung);
                });
            }
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![start_datei, oeffnen, speichern, speichern_unter, bereit, als_pdf])
        .run(tauri::generate_context!())
        .expect("Prozesslotse konnte nicht starten");
}
