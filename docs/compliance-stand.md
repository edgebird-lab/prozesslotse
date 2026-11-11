# Compliance-Doku: Stand der Umsetzung

Zweig `compliance` (Arbeitskopie `prozesslotse-compliance`); 0.3 und Phase 8 auf Zweig `compliance-programm` (Arbeitskopie `prozesslotse-programm`, abgezweigt bei `74573f5`). Grundlage: [`compliance-spezifikation.md`](compliance-spezifikation.md), Annahmen in [`compliance-entscheidungen.md`](compliance-entscheidungen.md). Die Nummern folgen Abschnitt 11 der Spezifikation.

Vor jedem Commit: `npm run lint`, `npm test`, `npm run build`, `PL_PORT=4175 npx playwright test` (Port 4173 gehört `main`, 4178 der Arbeitskopie `prozesslotse-programm`); bei Änderungen am Programm zusätzlich `cargo test --manifest-path src-tauri/Cargo.toml` und `npm run desktop:test` nach `npx tauri build --debug --no-bundle`.

## Phase 0 – Klären und vorbereiten

- [x] 0.1 Offene Fragen: Vorschläge der Spezifikation als Annahmen übernommen (`compliance-entscheidungen.md`); Robins Antworten stehen aus
- [x] 0.2 Abgleich mit Format 3 (Stand `0139e53`): ODER und externe Teilnehmer im Code, übrige Bausteine noch nicht
- [x] 0.3 `docx` im Windows-Programm erprobt (mit Phase 8, 11.11.2026): Das Programm läuft unter `http://tauri.localhost` im sicheren Kontext (`isSecureContext`), `crypto.subtle` steht bereit (die Freigabe rechnet damit die Prüfsumme). Keine Meldung zur Content Security Policy in der Konsole über drei Programmstarts mit DOCX-Export; die Gegenprobe (eingeschleustes Inline-Skript) blockiert die CSP und der Test meldet sie, die Beobachtung greift also. CSP unverändert. Die DOCX aus dem Programm öffnet in Word 16 (Build 16.0.20527) ohne Reparaturhinweis. `npm run build` ohne Typfehler; `docx` liegt in einem eigenen Teil von 224 KB (gzip 66 KB), der Hauptteil wiegt 572 KB (gzip 171 KB)

## Phase 1 – Datenmodell, Speichern, Testdaten

- [x] 1.1 `typen.ts` und `standard.ts`
- [x] 1.2 `unterlagen.ts` und `quelle.ts`
- [x] 1.3 `validiereCompliance` beim Laden, eingefrorene Prozesse migrieren
- [x] 1.4 Reducer-Aktionen `compliance` und `teilschritt`, Bereinigung
- [x] 1.5 Testdaten `beispiel.ts`
- [x] 1.6 Versionen unter eigenem Schlüssel, Meldung bei vollem Speicher, „Daten im Browser löschen“

## Phase 2 – Fristen und Lückenprüfung

- [x] 2.1 `datum.ts` und `fristen.ts`
- [x] 2.2 `ableitung.ts` mit `vorigeAufgabe` und `nummern`
- [x] 2.3 Regeln U1–U4 und B1–B9
- [x] 2.4 Regeln D1–D9
- [x] 2.5 Regeln S1–S6
- [x] 2.6 Regeln K1–K6 und T1
- [x] 2.7 Regeln V1–V3 und Gesamttest

## Phase 3 – Dokumente erzeugen

- [x] 3.1 `dokument.ts`: Kapitelschlüssel und Vergleich
- [x] 3.2 Verfahrensdokumentation: Deckblatt, Kapitel 1 bis 3
- [x] 3.3 `ablauftext.ts`: Aufgabe, Entscheidung, Gleichzeitig, Wiederholung, Warten
- [x] 3.4 Satzbausteine für Format 3 (soweit umgesetzt), 300 Zufallsprozesse
- [x] 3.5 Kapitel 5 bis 9 und Textbausteine; Abgleich mit dem Mustertext (BStBK/DStV 2.1, Kopie nur im Scratchpad) am 11.11.2026: längste gemeinsame Wortfolge 7 Wörter, der übernommene Kapitelname 3
- [x] 3.6 Verzeichnis A bis D
- [x] 3.7 `versionen.ts`: Freigabe, gültig bis, aufbewahren bis, Prüfsumme, geänderte Kapitel; eine Version des Lieferdienstes wiegt rund 33 KB

## Phase 4 – Assistent, Teil 1

- [x] 4.1 Schritt „Dokumentieren“, Teilschritt-Leiste mit Status, Lernhinweise
- [x] 4.2 Teilschritt „Unternehmen“ mit Übernahme aus anderer Projektdatei
- [x] 4.3 „Belege und Daten“: Einordnung, Form, Ablage, Anlegen
- [x] 4.4 „Belege und Daten“: Personenbezug, Kategorien, Rechtsgrundlage, Empfänger, Zwecke
- [x] 4.5 „Systeme und Dienstleister“

## Phase 5 – Assistent, Teil 2

- [x] 5.1 „Aufbewahrung und Löschung“
- [x] 5.2 „Kontrollen“
- [x] 5.3 „Schutzmaßnahmen“
- [x] 5.4 „Lücken“ mit „Beheben“ und Markierungen; Browsertests 1 und 2

## Phase 6 – Ausgabe, Freigabe, Verzahnung

- [x] 6.1 `DokumentAnsicht` für beide Dokumente
- [x] 6.2 Druck und PDF: Fußzeile als CSS-Randfeld (`@page @bottom-center`) statt `position: fixed`; mit Edge als PDF geprüft: A4, Fußzeile mit „Seite X von Y“ auf jeder Seite, Kapitel der Ebene 1 auf neuer Seite, Diagramm in 9.1 (Nachtrag aus 8.2: Tabelle 2.4 war im Druck rechts abgeschnitten, behoben)
- [x] 6.3 DOCX-Export (`docx` 9.15.3 exakt gepinnt, eigener Teil von 224 KB, gzip 66 KB); Abnahme in Word durch Robin offen
- [x] 6.4 Freigabe-Dialog, Versionsliste, „Geprüft, keine Änderung“; Browsertest 3
- [x] 6.5 Hinweis in „Verbessern“ bei gestrichener Kontrolle; Browsertest 8
- [x] 6.6 BPMN-Export wahlweise ohne Compliance-Angaben

## Phase 7 – Browsertests, Doku, Abnahme

- [x] 7.1 Browsertests 1 bis 8 aus 9.10 und weitere in `e2e/dokumentieren.spec.ts` (14 Tests, axe hell und dunkel; mit 8.2 kam ein 15. dazu: Tabellen passen im Druck auf A4)
- [x] 7.2 README, `datenmodell.md`, `fragenkatalog.md`, Bild `docs/bilder/dokumente.png` (die übrigen README-Bilder zeigen noch sechs Schritte, siehe unten)
- [ ] 7.3 Ausgabe an Steuerberatung und Datenschutz (Robin)
- [ ] 7.4 Rückmeldungen einarbeiten (Robin)

## Phase 8 – Windows-Programm

Zweig `compliance-programm`, geprüft am 11.11.2026 mit dem Debug-Build (`npx tauri build --debug --no-bundle`).

- [x] 8.1 `DateiArt` `docx` und `Plattform.speichereBytes(vorschlag, bytes, 'docx')`: im Browser ein Download über `ladeHerunter`, im Programm `invoke('speichern_unter_bytes', bytes, { headers: { vorschlag: encodeURIComponent(name), art: 'docx' } })`. Der Rust-Befehl liest die Rohdaten über `InvokeBody::Raw` (kein JSON, kein Base64) und lehnt vor dem Dialog ab: JSON statt Rohdaten, leere Datei, unbekannte Art, fehlende oder falsch kodierte Kopfwerte. Dialog „Word-Dokument“ (`*.docx`) mit demselben Ablauf wie `speichern_unter` (gemeinsam in `waehle_ziel`): fehlende Endung wird ergänzt, `schreibe` nimmt jetzt `&[u8]` und schreibt weiter atomar, der Pfad kommt in `Freigaben`. Testantwort `PROZESSLOTSE_TEST_SPEICHERN_DOCX` nur im Debug-Build. Rechte: Befehl in `build.rs` und `allow-speichern-unter-bytes` in `capabilities/default.json`, ohne diesen Eintrag lehnt Tauri den Aufruf ab; keine allgemeinen Dateirechte, CSP unverändert. 3 neue Rust-Tests (Rundreise mit Nullbytes unter einem Namen mit Umlauten, Dekodierung der Kopfwerte, Ablehnungen), zusammen 6. Die DOCX aus dem Programm öffnet in Word ohne Reparaturhinweis: 14 Seiten A4, Ränder 2 cm, Fußzeile mit Seitenfeldern, 9 Kapitel als „Überschrift 1“, Tabellenköpfe wiederholt, Export als PDF klappt.
- [x] 8.2 Teilschritt „Dokumente“ im Programm: „Drucken“ und „Als PDF speichern“ über `alsPdf` (WebView2 `PrintToPdf`, A4, Rand 15 mm, Druck-CSS der Seite) mit dem Dateinamen des angezeigten Dokuments, z. B. `…-verfahrensdokumentation-v1-0.pdf`; die Word-Datei meldet „„…“ gespeichert.“. Im Browser bleibt „Drucken oder als PDF speichern“. PDF der Verfahrensdokumentation aus dem Programm angesehen: 16 Seiten A4, Fußzeile „Vorlage – vor Verwendung prüfen lassen · Verfahrensdokumentation · Version 1.0 · Seite X von 16“ auf jeder Seite, jedes Kapitel der Ebene 1 auf neuer Seite, Diagramm in 9.1, Tabellenzeilen ungeteilt, Tabellenköpfe wiederholt. Dabei gefunden und behoben: Tabelle 2.4 „Relevante Dokumente“ (sieben Spalten, mindestens 747 px breit) passte nicht in die Satzbreite (680 px bei 15 mm Rand, 718 px bei 10 mm) und war rechts abgeschnitten, mit gedrucktem Scrollbalken, im Programm wie beim Drucken im Browser. Neue Druckregeln: Tabellenschrift 8,5 pt, engere Zellen, kein Scrollbalken; die breiteste Tabelle braucht jetzt 640 px. Ein neuer Browsertest prüft alle Tabellen beider Dokumente bei 680 px.
- [x] 8.3 `scripts/desktop-test.mjs`: 46 Prüfungen in drei Programmstarts (vorher 16 in einem). Start 1 wie bisher, von Speichern unter bis zur Rückfrage beim Schließen. Start 2: sicherer Kontext, `crypto.subtle`, Gegenprobe zur CSP, Beispiel mit Compliance-Angaben, „Dokumentieren“ > „Dokumente“, fünf falsche Aufrufe von `speichern_unter_bytes` werden abgelehnt und schreiben nichts, Freigabe 1.0, Word-Datei (`PROZESSLOTSE_TEST_SPEICHERN_DOCX`, Name ohne Endung und mit Umlaut) als ZIP mit `word/document.xml` samt Prozessname und Version, PDF der Verfahrensdokumentation (`PROZESSLOTSE_TEST_PDF`: `%PDF`, 16 Seiten, alle A4), Projekt speichern. Start 3: leeres Projekt, Datei öffnen, Version 1.0 und Unternehmensangaben sind da. Über alle Starts keine CSP-Meldung. Der Test beginnt jetzt auch dann mit dem Willkommen, wenn ein früherer Lauf ein Projekt im Speicher der WebView2 hinterlassen hat, und hinterlässt selbst ein leeres; `PROZESSLOTSE_EXE` wählt eine andere exe. `npm run desktop:test` grün ohne Admin-Rechte. Offen: der CI-Lauf, denn `windows.yml` (mit Installer-Test) läuft erst beim Push auf `main`.

## Zusammenführen mit `main`

`FORMAT_VERSION` ist unverändert 3; `compliance` ist ein optionales Feld am Projekt. Neue Dateien liegen in `src/compliance`, `src/ui/compliance`, `src/ui/schritte/DokumentierenSchritt.tsx` und `e2e/dokumentieren.spec.ts`.

Geänderte gemeinsame Dateien (alle Änderungen ergänzend):

| Datei | Änderung |
| --- | --- |
| `src/modell/typen.ts` | Typ-Import und optionales Feld `Projekt.compliance` |
| `src/modell/speicher.ts` | `leseProjekt` ruft `validiereCompliance`; Versionen unter eigenem Schlüssel `prozesslotse:versionen` (`ladeAusBrowser`, `speichereImBrowser`, `vergissImBrowser`); neu `loescheBrowserDaten` |
| `src/zustand.ts` | Schritt `dokumentieren`, Feld `teilschritt`, Aktionen `compliance` und `teilschritt`, Bereinigung nach Änderungen am Ist |
| `src/App.tsx` | Schritt im Panel, volle Breite im Teilschritt „Dokumente“, Markierungen und Klick in der Bühne, Menüpunkte „Daten im Browser löschen …“ und „Als BPMN ohne Compliance-Angaben exportieren“, Meldung bei vollem Speicher, Beispiel mit Compliance-Angaben |
| `src/ui/kontext.ts` | `aendereCompliance` |
| `src/ui/datei.ts` | `exportiereBpmn` mit Option `ohneCompliance` und Hinweis |
| `src/bpmn/export.ts` | `bpmnFuerExport` mit Option `ohneCompliance` |
| `src/ui/schritte/RahmenSchritt.tsx` | Willkommensknopf lädt `beispielMitCompliance()` |
| `src/ui/schritte/VerbessernSchritt.tsx` | Hinweis bei gestrichener Kontrolle, „Weiter: Dokumentieren“ |
| `src/styles.css` | neue Regeln am Dateiende (mit 8.2 auch Druckregeln für die Dokumenttabellen) |
| `scripts/readme-bilder.mjs` | Bild `dokumente.png` |
| `src/plattform/typen.ts`, `browser.ts`, `desktop.ts` | Phase 8: `DateiArt` `docx`, `speichereBytes`; `rufe` reicht Optionen (Kopfwerte) an `invoke` durch |
| `src-tauri/src/lib.rs`, `build.rs`, `capabilities/default.json`, `permissions/autogenerated/speichern_unter_bytes.toml` | Phase 8: Befehl `speichern_unter_bytes`, Dialogablauf `waehle_ziel` für beide Speichern-Befehle, `schreibe(&[u8])`, Recht `allow-speichern-unter-bytes` |
| `scripts/desktop-test.mjs` | Phase 8: drei Programmstarts, Compliance-Teil, CSP-Beobachtung, Start ohne Rücksicht auf alte Speicherstände, `PROZESSLOTSE_EXE` |
| `package.json`, `package-lock.json` | `docx` 9.15.3 (exakt), `fflate` 0.8.3 (dev) |
| `README.md`, `docs/datenmodell.md`, `docs/fragenkatalog.md` | neue Abschnitte |

Beim Zusammenführen beachten:

- **Neue Bausteine aus Format 3** (Teilprozess, für jede Position, Unterbrechung): `ablauftext.ts` prüft die Bausteinart erschöpfend, TypeScript meldet also den fehlenden Satzbaustein (6.6.1). Der Test „kennt alle Felder der Bausteine“ in `generatoren.test.ts` schlägt fehl, sobald die Zufallsprozesse neue Felder wie `unterbrechungen` erzeugen. `zusammenfuehrung`, `ausfuehrung` und `beendetAlles` werden schon gelesen, falls `main` sie so benennt. `nummern` folgt `durchlaufe`; Aufgaben in neuen Rahmen zählen mit, sobald `kinderSequenzen` sie kennt. Aufgaben eines Ausnahmewegs müssen laut 6.3 direkt auf ihre Aufgabe folgen.
- **Neue Felder an Aufgaben** gehören in die Liste `BEKANNT` dieses Tests, sobald Kapitel 4 sie beschreibt.
- **Formatmigrationen** in `leseProjekt` gelten automatisch auch für eingefrorene Prozesse in Versionen.
- **README-Bilder:** nach dem Zusammenführen `node scripts/readme-bilder.mjs` laufen lassen; die alten Bilder zeigen sechs statt sieben Schritte.
- **Tests in gemeinsamen Dateien** gibt es nicht; neue Tests liegen in eigenen Dateien (`src/zustand.compliance.test.ts`, `src/compliance/*.test.ts`).

## Offen und bekannte Mängel

- 8.3: Der CI-Lauf steht aus; `windows.yml` (Rust-Tests, Debug-Build, Installer-Test) startet erst beim Push auf `main`.
- Die echten Dialoge (Speichern unter für Word, Als PDF speichern) beantwortet im Desktop-Test die Testantwort; einmal von Hand durchklicken steht aus (Robin).
- Word bricht in den schmalen Spalten von Tabelle 2.4 Wörter ohne Trennstrich um („Aufbewahru|ng“, „Datensa|tz“, „31.12.20|32“); der Inhalt ist vollständig. Abhilfe wäre eine kleinere Tabellenschrift in `docx.ts` (wie im Druck), nicht Teil von Phase 8.
- Im Druck braucht die breiteste Tabelle des Beispiels 640 von 680 px. Sehr lange Wörter in eigenen Angaben können darüber hinausragen; Silbentrennung (`hyphens: auto`) beherrscht Edge hier nicht zuverlässig.
- Der Menüpunkt „Datei > Als PDF speichern …“ des Programms druckt weiter den Bericht, auch aus dem Teilschritt „Dokumente“; dort gibt es dafür den eigenen Knopf.
- 7.3 und 7.4: fachliche Durchsicht durch Steuerberatung und Datenschutz steht aus (Robin).
- Abnahme der Word-Dateien in Word (Navigationsbereich) durch Robin steht aus; geprüft sind der Inhalt des Pakets und, mit 8.1, das Öffnen in Word 16 ohne Reparaturhinweis samt Formatvorlagen und PDF-Export.
- Der Hauptteil der App wuchs von 446 KB auf 570 KB (gzip 170 KB), weil Lückenprüfung und Generatoren schon für die Bühne geladen werden. `docx` liegt in einem eigenen Teil (224 KB, gzip 66 KB) und wird erst beim Export geladen.
- Der Vergleich mit dem Mustertext deckt die Sätze ab, die im Lieferdienst vorkommen; seltene Varianten (z. B. Kapitel 5 mit Scannen) sind nicht abgeglichen.
