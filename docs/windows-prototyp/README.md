# Windows-Prototyp (Tauri 2)

Prototyp aus der Planung des Windows-Programms vom 10.11.2026, aufbewahrt als Vorlage. Er wird weder gebaut noch getestet; die Web-App bleibt davon unberührt.

Gemessen auf Robins Laptop (Beispiel „Lieferdienst“, Median aus 5 warmen Starts): Installer 2,1 MB, installiert 9,7 MB, Fenster nach 0,06 s, bedienbar nach 0,65 s.

| Datei | Inhalt |
| --- | --- |
| `src-tauri/src/lib.rs` | Dateibefehle nur für Pfade, die der Benutzer gewählt hat; atomares Speichern; Single-Instance; PDF über WebView2 `PrintToPdf` |
| `src-tauri/tauri.conf.json` | getestete CSP für bpmn-js, NSIS-Installer pro Benutzer, Dateizuordnung |
| `src-tauri/capabilities/default.json` | minimale Rechte des Hauptfensters |
| `src/plattform/desktop.ts` | Brücke der Oberfläche zu den Rust-Befehlen (nur per dynamischem Import laden) |

Bekannte Abweichungen vom Plan:

- `.bpmn` ist hier noch über `fileAssociations` eingetragen. Tauris Installer macht daraus eine Standardzuordnung und verdrängt z. B. den Camunda Modeler. Laut Plan gehört `.bpmn` nur unter „Öffnen mit“ (NSIS-Hook).
- Die Befehle `bereit` und die Umgebungsvariablen `PL_MESSUNG` und `PL_PDF` dienten nur der Messung und fliegen raus.
- `freezePrototype` muss aus bleiben, sonst zeigt die App eine weiße Seite.
