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
- [x] 8.2 Teilschritt „Dokumente“ im Programm: „Drucken“ und „Als PDF speichern“ über `alsPdf` (WebView2 `PrintToPdf`, A4, Rand 15 mm, Druck-CSS der Seite) mit dem Dateinamen des angezeigten Dokuments, z. B. `…-verfahrensdokumentation-v1-0.pdf`; die Word-Datei meldet „„…“ gespeichert.“. Im Browser bleibt „Drucken oder als PDF speichern“. PDF der Verfahrensdokumentation aus dem Programm angesehen: 16 Seiten A4, Fußzeile „Vorlage – vor Verwendung prüfen lassen · Verfahrensdokumentation · Version 1.0 · Seite X von 16“ auf jeder Seite, jedes Kapitel der Ebene 1 auf neuer Seite, Diagramm in 9.1, Tabellenzeilen ungeteilt, Tabellenköpfe wiederholt (Stand Phase 8; seit der Nachbesserung Druck trägt eine freigegebene Version eine andere Fußzeile, und nur große Kapitel beginnen auf einer neuen Seite, siehe „Nachprüfung vom 11.11.2026“). Dabei gefunden und behoben: Tabelle 2.4 „Relevante Dokumente“ (sieben Spalten, mindestens 747 px breit) passte nicht in die Satzbreite (680 px bei 15 mm Rand, 718 px bei 10 mm) und war rechts abgeschnitten, mit gedrucktem Scrollbalken, im Programm wie beim Drucken im Browser. Neue Druckregeln: Tabellenschrift 8,5 pt, engere Zellen, kein Scrollbalken; die breiteste Tabelle braucht jetzt 640 px. Ein neuer Browsertest prüft alle Tabellen beider Dokumente bei 680 px.
- [x] 8.3 `scripts/desktop-test.mjs`: 46 Prüfungen in drei Programmstarts (vorher 16 in einem). Start 1 wie bisher, von Speichern unter bis zur Rückfrage beim Schließen. Start 2: sicherer Kontext, `crypto.subtle`, Gegenprobe zur CSP, Beispiel mit Compliance-Angaben, „Dokumentieren“ > „Dokumente“, fünf falsche Aufrufe von `speichern_unter_bytes` werden abgelehnt und schreiben nichts, Freigabe 1.0, Word-Datei (`PROZESSLOTSE_TEST_SPEICHERN_DOCX`, Name ohne Endung und mit Umlaut) als ZIP mit `word/document.xml` samt Prozessname und Version, PDF der Verfahrensdokumentation (`PROZESSLOTSE_TEST_PDF`: `%PDF`, 16 Seiten, alle A4), Projekt speichern. Start 3: leeres Projekt, Datei öffnen, Version 1.0 und Unternehmensangaben sind da. Über alle Starts keine CSP-Meldung. Der Test beginnt jetzt auch dann mit dem Willkommen, wenn ein früherer Lauf ein Projekt im Speicher der WebView2 hinterlassen hat, und hinterlässt selbst ein leeres; `PROZESSLOTSE_EXE` wählt eine andere exe. `npm run desktop:test` grün ohne Admin-Rechte. Offen: der CI-Lauf, denn `windows.yml` (mit Installer-Test) läuft erst beim Push auf `main`.

## Durchsicht vom 11.11.2026

Fünf Prüfer (Abnahme, Recht, Daten, Logik, Bedienung) haben den Stand `96f7243` durchgesehen, jeder Fund wurde von ein bis zwei Gegenprüfern bestätigt oder verworfen: 82 bestätigte Funde, 3 strittige, 10 verworfene. Robin hat die Behebung freigegeben („Arbeite autonom und entscheide so, wie du es mir empfehlen würdest“). Die Funde wurden in sechs Paketen auf eigenen Zweigen behoben, jeder Fehler mit einem Test, der ohne die Behebung scheitert, und danach in dieser Reihenfolge in `compliance` zusammengeführt: `fix/daten` (`9d0fb66`), `fix/angaben` (`416eeb7`), `fix/texte` (`44c5c7a`), `fix/regeln` (`133f314`), `fix/druck` (`3d92f4e`), `fix/bedienung` (`8e65461`). Die Annahmen dazu stehen in [`compliance-entscheidungen.md`](compliance-entscheidungen.md), Abschnitt „Durchsicht vom 11.11.2026“.

Was sich für die Nutzung ändert:

- **Neue Angaben** (alle optional, ältere Dateien laden unverändert): Rollen im Ablauf mit „extern“ und Organisation, Ausnahme nach Art. 9 Abs. 2 DSGVO, Zugriffsschutz in Kapitel 3.4 und Verzeichnis C.3, je System „Wie findet man eine Unterlage wieder?“ und Datenzugriff bei Außenprüfung (neues Kapitel 3.5), Bewilligung des Finanzamts bei Aufbewahrung im Drittland, eigene Verfahrensdokumentation zum ersetzenden Scannen, mitgeltende Unterlagen mit Ablageort.
- **Lückenprüfung mit 42 Regeln** (vorher 38): neu B10 „Keine Unterlagen angelegt“, B11 „Lieferschein: Frist nach HGB klären“, S7 „Aufbewahrung im Drittland ohne Bewilligung“, S8 „Wiederfinden und Datenzugriff offen“; viele Regeltexte genauer. Das Beispiel liefert weiter genau 7 Befunde (Spezifikation 9.5).
- **Versionen:** Die Prüfsumme deckt jetzt auch den eingefrorenen Prozess (Diagramm der Anlage) und wird nach dem Laden nachgerechnet; „Gültig ab“ hat Grenzen und eine zulässige Vorgabe; eine Freigabe, die noch nicht gilt, lässt sich mit Begründung zurückziehen; „Inhalt der Änderung“ ist ab Version 2 Pflicht.
- **Speichern:** Voller oder beschädigter Browser-Speicher, zwei Tabs und alte Programmfassungen verlieren keine Daten mehr still; beschädigte Compliance-Angaben in einer Datei sperren den Prozess nicht mehr.
- **Druck und Word:** Anlage 9.1 als Übersicht und lesbare Ausschnitte, DOCX auf Deutsch mit Spaltenbreiten nach Inhalt, 9-pt-Tabellen und festen Leerzeichen; Fristentabelle und schmale Fenster ohne Abschneiden.
- **Bedienung:** „Weiter“ und „Beheben“ springen an die richtige Stelle, Fokus geht nicht mehr verloren, Meldungen am Feld, Kapitelkürzel ausgeschrieben, leere Teilschritte neutral statt mit Häkchen; „Dokumentieren“ lädt erst im Schritt nach (Hauptteil 463 statt 582 kB).

Beim Zusammenführen erledigt (`d437756`): Regelzahl 42 in Code, Spezifikation und README; `hatAngaben` kennt die neuen Angaben; „Beheben“ springt bei B10, B11, S7, S8 und D5 ohne Ausnahme nach Art. 9 auf die passende Frage (`feldZiel`, mit Test); der Freigabe-Dialog nutzt `kapitelText` aus `dokument.ts`; die Kopfzeilen-Meldung zu falschen Prüfsummen lädt `versionen.ts` erst bei Bedarf, sonst läge der Hauptteil wieder über 500 kB; Speichergrenzen neu gemessen (Version 1 rund 35 000 Zeichen, je Version rund 215 mehr; Browser-Speicher voll bei rund 105 Versionen, Projektdatei 20 MiB bei rund 185).

Tests nach dem Zusammenführen: `npm run lint` ohne Befund, 496 Unit-Tests in 53 Dateien, `npm run build` ohne Chunk-Warnung (Hauptteil 463 kB, gzip 141 kB), 83 Browsertests mit `--workers=2` grün (der erste Lauf hatte 5 Fehlschläge aus widersprüchlichen Testerwartungen der Pakete, z. B. umbenannte Knöpfe und die nachgeladene Leiste; angepasst, zweiter Lauf 83 von 83 ohne Zeitüberschreitung), 6 Rust-Tests.

Windows-Programm: `npx tauri build --debug --no-bundle` und `npm run desktop:test` grün, jetzt 48 Prüfungen in drei Programmstarts; neu geprüft wird, dass „Dokumentieren“ im Programm erst im Schritt nachlädt. Das PDF der Verfahrensdokumentation aus dem Programm hat 22 Seiten A4: Anlage 9.1 als Übersicht mit fünf nummerierten Rahmen und danach fünf Ausschnitte („Ausschnitt n von m“, Beschriftungen 5,75 bis 6,3 pt, lesbar); die Tabellen 3.4 (sechs Spalten mit Zugriffsschutz) und 3.5 passen in die Satzbreite. Die Word-Datei aus dem Programm öffnet in Word 16 ohne Reparaturhinweis (15 Seiten, Sprache Deutsch, als PDF exportiert): Tabellen in 9 pt mit Spaltenbreiten nach Inhalt, keine Daten oder Wörter mitten im Zeichen getrennt, die Fristentabelle mit dem Zusatz nach § 257 HGB beim Lieferschein und der Satz zu Instituten stehen vollständig.

| Fund | Kurztitel | Stand |
| --- | --- | --- |
| abnahme-0 | PDF/Druck: Tabelle 2.4 rechts abgeschnitten, Spalte „Beispiel 2026“ fehlt | erledigt vor der Durchsicht in `9cc0f57` |
| abnahme-1 | Kapitel 9.1: Ablaufdiagramm im Druck unlesbar klein | erledigt: druck, `91fcf78` (zusammengeführt in `3d92f4e`) |
| abnahme-2 | Teilschritt „Aufbewahrung und Löschung“: Fristentabelle abgeschnitten | erledigt: druck, `91fcf78` (zusammengeführt in `3d92f4e`) |
| abnahme-3 | Kapitel 4: Wiederholungssatz steht unter 4.5 „Bestellung stornieren“ | erledigt: texte, `0665cc5` (zusammengeführt in `44c5c7a`) |
| abnahme-4 (strittig) | Diagramm: zwei Nachrichtenflüsse 10 px nebeneinander wirken wie eine Linie | offen: wird in `main` bei der Linienführung behandelt |
| abnahme-5 | Bühne in „Dokumentieren“: die Markierung ist anfangs nicht zu sehen | erledigt: bedienung, `d8a2e27` (zusammengeführt in `8e65461`) |
| abnahme-7 | Teilschritt-Leiste: Knöpfe einer Zeile ungleich hoch | erledigt: druck, `91fcf78` (zusammengeführt in `3d92f4e`) |
| abnahme-8 | „Belege und Daten“: Hinweis wiederholt die Beschreibung von „Weiß nicht“ | erledigt: bedienung, `c38c40c` (zusammengeführt in `8e65461`) |
| abnahme-9 | Ablage-Auswahl zeigt „Warenwirtschaft (Warenwirtschaft)“ | erledigt: bedienung, `c38c40c` (zusammengeführt in `8e65461`) |
| abnahme-10 | Feld „Benennung“: Platzhalter abgeschnitten | erledigt: druck, `91fcf78` (zusammengeführt in `3d92f4e`) |
| abnahme-11 | Build-Warnung: Hauptteil 571 kB (bekannt) | erledigt: bedienung, `fc29788` (zusammengeführt in `8e65461`) |
| recht-0 | Lieferscheine: Frist nur nach AO, für Kaufleute fehlt § 257 HGB | erledigt: angaben, `ba28266`, `69066dd` (zusammengeführt in `416eeb7`) |
| recht-1 | Drittland-Cloud mit aufbewahrungspflichtigen Unterlagen: § 146 Abs. 2b AO fehlt | erledigt: regeln, `cdc795a` (zusammengeführt in `133f314`) |
| recht-2 | Kapitel 5 sagt „Entfällt“, obwohl die Vernichtung nach dem Scannen offen ist | erledigt: texte, `dff698b` (zusammengeführt in `44c5c7a`) |
| recht-3 | Zugriffsschutz wird abgefragt, steht aber in keinem Dokument | erledigt: angaben, `ba28266`, `69066dd` (zusammengeführt in `416eeb7`) |
| recht-4 | GoBD Rz. 152: Wiederfinden, Lesbarmachung und Datenzugriff fehlen | erledigt: angaben, `ba28266`, `69066dd` (zusammengeführt in `416eeb7`) |
| recht-5 (strittig) | Freigegebene Fassung trägt weiter „Vorlage – vor Verwendung prüfen lassen“ | erledigt nach der Entscheidung vom 11.11.2026: Nachbesserung Druck, `b516d72` (zusammengeführt in `c1e706a`), siehe „Nachprüfung vom 11.11.2026“ |
| recht-6 | Verzeichnis B.5 sagt „findet nicht statt“, obwohl der Standort unbekannt ist | erledigt: angaben, `ba28266` (zusammengeführt in `416eeb7`) |
| recht-7 | Art.-9-Daten: Ausnahme nach Art. 9 Abs. 2 DSGVO fehlt | erledigt: angaben, `ba28266`, `69066dd` (zusammengeführt in `416eeb7`) |
| recht-8 | Breite Tabellen trennen Daten, Wörter und Prüfsummen mitten im Zeichen | erledigt: druck, `02850d1` (zusammengeführt in `3d92f4e`) |
| recht-9 | Ersetzendes Scannen: Dokument behauptet eine vorhandene eigene Verfahrensdokumentation | erledigt: texte, `dff698b` (zusammengeführt in `44c5c7a`) |
| recht-10 | Jahresabschluss und Eröffnungsbilanz: kein Hinweis auf Aufbewahrung im Original | erledigt: regeln, `cdc795a` (zusammengeführt in `133f314`) |
| recht-11 | Feste Sätze sichern zu, was die Angaben nicht tragen | erledigt: texte, `e5545f7`, `d378657` (zusammengeführt in `44c5c7a`) |
| recht-12 | Kapitel 4: Ablaufsatz steht unter der falschen Überschrift | erledigt: texte, `0665cc5` (zusammengeführt in `44c5c7a`) |
| recht-14 | „nicht aufbewahrungspflichtig“ gilt nur steuerlich | erledigt: texte, `d378657` (zusammengeführt in `44c5c7a`) |
| recht-15 | Verzeichnis B.3: besondere Kategorien fehlen in der Zeile der Unterlage | erledigt: angaben, `ba28266` (zusammengeführt in `416eeb7`) |
| recht-16 | „Identifikationsdaten (Name, Kundennummer)“ auch bei Beschäftigten und Lieferanten | erledigt: angaben, `ba28266` (zusammengeführt in `416eeb7`) |
| recht-17 | DOCX ohne Sprachangabe | erledigt: druck, `02850d1` (zusammengeführt in `3d92f4e`) |
| recht-18 | Satzbild: Absätze ohne Abstand, „§“ allein am Zeilenende, „Un-named“ | erledigt: druck, `02850d1`, `91fcf78` (zusammengeführt in `3d92f4e`) |
| recht-19 | Beispiel: Microsoft 365 als lokaler Betrieb ohne Dienstleister | erledigt: angaben, `ba28266` (zusammengeführt in `416eeb7`) |
| recht-20 | Sonderfall: 10 Jahre für Buchungsbelege bei Kredit-, Versicherungs- und Wertpapierinstituten | erledigt: angaben, `ba28266` (zusammengeführt in `416eeb7`) |
| recht-21 | Oberfläche: Länderartikel im D8-Text, falscher Bezug im Lernhinweis zum Löschrecht | erledigt: regeln, `a355715`, `28e2916` (zusammengeführt in `133f314`) |
| recht-23 | Sprache: Artikel, Großschreibung, „0 Tage“, „Herkunft“, Person in Spalte „Rolle“ | erledigt: texte, `d378657` (zusammengeführt in `44c5c7a`) |
| daten-0 | Voller Browser-Speicher: Neustart zeigt einen alten Stand als unveränderte Datei, Speichern überschreibt die Datei | erledigt: daten, `d921b23` (zusammengeführt in `9d0fb66`) |
| daten-1 | Zwei Tabs: freigegebene Versionen gehen verloren oder fremde Versionen landen im Projekt | erledigt: daten, `d921b23` (zusammengeführt in `9d0fb66`) |
| daten-2 | Ungültiges Feld im Browser-Speicher: Projekt und Versionen werden ohne Meldung verworfen und überschrieben | erledigt: daten, `d921b23` (zusammengeführt in `9d0fb66`) |
| daten-3 (strittig) | Strenge Prüfung sperrt die ganze Datei wegen einer Kleinigkeit im Compliance-Teil | erledigt: daten, `d0546c4` (zusammengeführt in `9d0fb66`) |
| daten-4 | Prüfsumme wird nie nachgerechnet; die Oberfläche behauptet, sie erkenne Beschädigungen | erledigt: daten, `93614de` (zusammengeführt in `9d0fb66`) |
| daten-5 | Vertipptes „Gültig ab“ einer Freigabe lässt sich nicht berichtigen | erledigt: daten, `16d6e88` (zusammengeführt in `9d0fb66`) |
| daten-7 | Alter Versionsschlüssel überschreibt die Versionen, die eine andere Programmfassung im selben Browser geschrieben hat | erledigt: daten, `d921b23` (zusammengeführt in `9d0fb66`) |
| daten-8 | Eingefrorene Dokumente teilen sich die Konstante FRISTEN_TABELLE | erledigt: texte, `d378657` (zusammengeführt in `44c5c7a`) |
| daten-9 | Versionen wachsen mit der Historie; Speichergrenzen sind nicht dokumentiert | erledigt: daten, `32fcc05` (zusammengeführt in `9d0fb66`) |
| logik-0 | Kapitel 4: „weiter mit“ und „zurück zu“ nennen Schritte, die nur bedingt laufen | erledigt: texte, `0665cc5` (zusammengeführt in `44c5c7a`) |
| logik-1 | Externe Rollen lassen sich nirgends eintragen; Kanzlei erscheint als interner Empfänger | erledigt: angaben, `69066dd` (zusammengeführt in `416eeb7`) |
| logik-2 | Tippfehler im „Gültig ab“ sperrt dauerhaft alle weiteren Freigaben | erledigt: daten, `16d6e88` (zusammengeführt in `9d0fb66`) |
| logik-3 | Ausgeblendete Altangaben stehen weiter in Kapitel 3.4 und 6 | erledigt: texte, `ed6b64f` (zusammengeführt in `44c5c7a`) |
| logik-4 | Lückenprüfung übersieht halb ausgefüllte Pflichtangaben | erledigt: regeln, `a355715` (zusammengeführt in `133f314`) |
| logik-5 | Verzeichnis B.5 behauptet „findet nicht statt“, obwohl der Betrieb eines Systems offen ist | erledigt: angaben, `ba28266` (zusammengeführt in `416eeb7`) |
| logik-6 | „Verbessern“: Hinweis auf gestrichene Kontrolle bei allen Vorschlägen, sobald das Soll sie nicht mehr hat | erledigt: regeln, `28e2916` (zusammengeführt in `133f314`) |
| logik-7 | Laden lässt Datumsangaben zu, an denen Prüfung und Generatoren abstürzen | erledigt: daten, `d0546c4` (zusammengeführt in `9d0fb66`) |
| logik-8 | Kapitel 2.5 widerspricht sich bei Einweisung „Keine“ mit Protokoll | erledigt: texte, `e5545f7` (zusammengeführt in `44c5c7a`) |
| logik-9 | Ein Testdatum in der Zukunft unterdrückt S6 | erledigt: regeln, `a355715` (zusammengeführt in `133f314`) |
| logik-10 | Spalte „Frühestens löschen“: Aufbewahrung und Löschfrist um einen Tag verschieden | erledigt: regeln, `28e2916` (zusammengeführt in `133f314`) |
| logik-12 | B9 zählt eine Prüfung vor dem Abtippen als Erfassungskontrolle | erledigt: regeln, `a355715` (zusammengeführt in `133f314`) |
| logik-13 | B6-Ausnahme „auf Papier versandt“ gilt auch für Bücher und sonstige Unterlagen | erledigt: regeln, `a355715` (zusammengeführt in `133f314`) |
| logik-14 | B6-Hinweis sagt „nur auf Papier“, obwohl digital abgelegt (widerspricht B5 und B3) | erledigt: regeln, `a355715` (zusammengeführt in `133f314`) |
| logik-16 | Kapitel 3.3 nennt Kontrollen in einem Zweig „bei jedem Vorgang“ | erledigt: texte, `0665cc5` (zusammengeführt in `44c5c7a`) |
| logik-17 | Wiederholung behauptet, alle Schritte liefen mindestens einmal | erledigt: texte, `0665cc5` (zusammengeführt in `44c5c7a`) |
| logik-18 | Zugriffsschutz wird abgefragt, aber nie ausgegeben; mitgeltende Unterlagen sind nicht eintragbar | erledigt: angaben, `ba28266`, `69066dd` (zusammengeführt in `416eeb7`) |
| logik-19 | Prüfsumme wird nie nachgerechnet und deckt das Diagramm (eingefrorener Prozess) nicht ab | erledigt: daten, `93614de` (zusammengeführt in `9d0fb66`) |
| logik-21 | T1 und Verzeichnis C uneinig bei Maßnahmen aus Leerzeichen (nur über Datei) | erledigt: regeln, `a355715` (zusammengeführt in `133f314`) |
| bedienung-0 | „Weiter“ führt ans Ende des nächsten Teilschritts | erledigt: bedienung, `d8a2e27` (zusammengeführt in `8e65461`) |
| bedienung-1 | Häkchen „vollständig“ bei Teilschritten ohne jede Angabe | erledigt: regeln, `7ceb295` (zusammengeführt in `133f314`) |
| bedienung-2 | „Beheben“ landet mitten in der Karte, die zu beantwortende Frage liegt außerhalb des Bilds | erledigt: bedienung, `d8a2e27` (zusammengeführt in `8e65461`) |
| bedienung-3 | Fokus geht verloren, wenn Knöpfe verschwinden oder gesperrt werden | erledigt: bedienung, `d8a2e27` (zusammengeführt in `8e65461`) |
| bedienung-4 | Zweite Freigabe am selben Tag: Die Vorgabe für „Gültig ab“ ist ungültig | erledigt: daten, `16d6e88` (zusammengeführt in `9d0fb66`) |
| bedienung-5 | Meldung bei Unterlage ohne Namen erscheint außerhalb des Bilds | erledigt: bedienung, `d8a2e27` (zusammengeführt in `8e65461`) |
| bedienung-6 | Fristen-Tabelle ist breiter als das Panel, das Löschdatum ist abgeschnitten | erledigt: druck, `91fcf78` (zusammengeführt in `3d92f4e`) |
| bedienung-7 | Kapitelkürzel „VD 3.2“ und „VVT B.3“ werden nirgends erklärt | erledigt: bedienung, `c38c40c` (zusammengeführt in `8e65461`) |
| bedienung-8 | Lernhinweis „Aufbewahren und Löschen“: „Bis dahin“ verweist auf den falschen Zeitpunkt | erledigt: bedienung, `c38c40c` (zusammengeführt in `8e65461`) |
| bedienung-9 | Vorschlag „+ Kunde“ als Empfänger direkt über dem Hinweis, der Kunde sei kein Empfänger | erledigt: bedienung, `c38c40c` (zusammengeführt in `8e65461`) |
| bedienung-10 | DOCX-Knopf in der Versionsliste: Der sichtbare Text fehlt im zugänglichen Namen (axe serious) | erledigt: bedienung, `f02a45e` (zusammengeführt in `8e65461`) |
| bedienung-11 | Fokusring der Reiter „Verfahrensdokumentation“ und „Verarbeitungsverzeichnis“ ist abgeschnitten | erledigt: druck, `91fcf78` (zusammengeführt in `3d92f4e`) |
| bedienung-12 | Ungültige Zahlen werden still verworfen oder gekappt | erledigt: bedienung, `d8a2e27` (zusammengeführt in `8e65461`) |
| bedienung-16 | Fachbegriffe und Abkürzungen ohne Erklärung | erledigt: bedienung, `c38c40c` (zusammengeführt in `8e65461`) |
| bedienung-17 | Verschiedene Wörter für dasselbe | erledigt: regeln, `a355715`, `28e2916` (zusammengeführt in `133f314`) |
| bedienung-18 | Einweisung „Keine“: Befund sagt „nicht festgelegt“, das Dokument widerspricht sich | erledigt: texte, `e5545f7` (zusammengeführt in `44c5c7a`) |
| bedienung-19 | „Inhalt der Änderung“ ist mit der Kapitelliste vorbelegt | erledigt: daten, `16d6e88` (zusammengeführt in `9d0fb66`) |
| bedienung-20 | Grammatikfehler: „In „Ordner Lieferscheine“ liegen 1 Unterlagen.“ | erledigt: bedienung, `c38c40c` (zusammengeführt in `8e65461`) |
| bedienung-21 | „kann einer nötig sein“ ohne Bezugswort | erledigt: bedienung, `c38c40c` (zusammengeführt in `8e65461`) |
| bedienung-22 | Dokumenttexte: doppelter Punkt, „bei offen“, Rollen ohne Artikel | erledigt: texte, `d378657` (zusammengeführt in `44c5c7a`) |
| bedienung-23 | Überschriftenfolge springt in „Schutzmaßnahmen“ von h2 auf h4 (axe heading-order) | erledigt: bedienung, `c38c40c` (zusammengeführt in `8e65461`) |
| bedienung-24 | Kontaktfelder des Datenschutzbeauftragten ohne Gruppe: doppelte Feldnamen | erledigt: bedienung, `f02a45e` (zusammengeführt in `8e65461`) |
| bedienung-25 | Gleichlautende Knöpfe ohne Bezug | erledigt: bedienung, `f02a45e` (zusammengeführt in `8e65461`) |
| bedienung-26 | Bei schmalem Fenster scrollt nur dieser Schritt waagerecht | erledigt: druck, `91fcf78` (zusammengeführt in `3d92f4e`) |

Verworfen (kein Handlungsbedarf): abnahme-6, recht-13, recht-22, daten-6, logik-11, logik-15, logik-20, bedienung-13, bedienung-14, bedienung-15.

## Nachprüfung vom 11.11.2026

Drei Nachprüfer haben den zusammengeführten Stand `6911c8e` noch einmal geprüft: „regression“ (Rückschritte, auch im Probe-Merge mit `main`), „sicht“ (Oberfläche, Druck und PDF mit dem Auge) und „erledigt“ (sind die 82 Funde wirklich erledigt?). Die Berichte nannten 2 + 7 Mängel und 4 nur teilweise erledigte Funde. Nachgebessert wurde in zwei Teilen: Daten und Oberfläche direkt auf `compliance` (`145978a`, `02c55bb`, `70ab98a`, `11cf47c`, `d4f89bd`, `2815507`, `cb2e6f7`, `9cb4579`, Doku `47296d2`), Druck und Dialoge (sicht 1, 2, 3, 7) mit recht-5 auf dem Zweig `fix/druck-nach` (`b516d72`, `2e50dd0`, `c58fde3`, `5e112ca`, Doku `f4b9843`), zusammengeführt in `c1e706a`; dazu die Tests zum Zusammenführen in `7053249`. Jeder Mangel hat einen Test, der ohne die Behebung scheitert; die Annahmen dazu stehen in [`compliance-entscheidungen.md`](compliance-entscheidungen.md), Abschnitt „Nachprüfung vom 11.11.2026“.

| Mangel | Kurztitel | Stand |
| --- | --- | --- |
| regression 1 (hoch) | Prüfsumme kippt, wenn das Laden den eingefrorenen Prozess anpasst (Format 2; mit `main` jede Version mit „Warten auf Termin“; mit der Modellierung jede Version) | erledigt, `145978a`: Der eingefrorene Prozess bleibt als Rohstand in der Version, die Prüfsumme wird über ihn gerechnet, Speichern schreibt ihn unverändert zurück; Anzeige und Vergleich nutzen eine migrierte Kopie (`eingefrorenerProzess`). Test `pruefsumme-rohstand.test.ts` (Warten, Format 2, simulierter Sprung auf Format 4, Speichern und Laden zweimal) |
| regression 2 | Lädt „Dokumentieren“ nicht nach, ist die ganze App weiß | erledigt, `02c55bb`: Fehlergrenze `Nachladegrenze` mit Meldung und „Neu laden“; Browsertest bricht das Nachladen von „Dokumentieren“, Lückenprüfung und Versionen mit `page.route` ab |
| sicht 1 | Anlage 9.1: Aufgaben an Ausschnittgrenzen in keinem Ausschnitt ganz | erledigt, `5e112ca` (fix/druck-nach, zusammengeführt in `c1e706a`): Schnittkanten in Lücken zwischen den Formen, mindestens 40 px Überlappung, jede Form samt Beschriftung in einem Ausschnitt ganz; ab Ausschnitt 2 ein grau hinterlegter Kopf mit Pool- und Bahnnamen. Unit-Tests (Beispiel, ohne Lücken, Zufallsdiagramme) und Browsertest mit den Formen aus bpmn-js |
| sicht 2 | Fehlermeldungen in „Version freigeben“ und „Freigabe zurückziehen“ grau statt rot | erledigt, `2e50dd0` (fix/druck-nach, zusammengeführt in `c1e706a`): Meldung rot direkt unter dem Feld, Feld mit `aria-invalid`, `aria-describedby` und rotem Rahmen; Browsertest hell und dunkel |
| sicht 3 | „9.2 Nachweis der Einweisung“ über zwei Seiten zerrissen | erledigt, `c58fde3` (fix/druck-nach, zusammengeführt in `c1e706a`): Formulare aus leeren Zeilen bleiben auf einer Seite (Druck `break-inside: avoid`, Word Zeilen zusammenhalten); Unit- und Browsertest |
| sicht 4 | Versionsliste: Zelle „Version“ senkrecht mittig | erledigt, `70ab98a`; Browsertest misst die Oberkanten |
| sicht 5 | „Rollen im Ablauf“: kleine Rollennamen, springende Spalten, schmales Feld „Organisation“, „extern“ doppelt | erledigt, `70ab98a`: feste Aufteilung, normale Zellschrift, Spalte Organisation reserviert, „extern“ sichtbar nur im Spaltenkopf; Browsertest |
| sicht 6 | Falsche Prüfsumme: trotzdem „Gültige Version“, Häkchen, „Lücken“ meldet nichts | erledigt, `11cf47c`: Zustandszeile „– Prüfsumme stimmt nicht“, neue Regel V4 (Warnung) in „Lücken“, Zahl statt Häkchen am Teilschritt „Dokumente“; Unit- und Browsertest |
| sicht 7 | Satz: „z. B.“ und „E-Mail“ brechen um, Hurenkind, fast leere Seiten | erledigt, `c58fde3` (fix/druck-nach, zusammengeführt in `c1e706a`): neue Seite nur vor Verfahrensdokumentation 2, 3, 4, 9 und Verzeichnis B, C; Absätze und Listenpunkte ungeteilt (Word: Absatzkontrolle); geschütztes Leerzeichen in „z. B.“, geschützter Bindestrich in „E-Mail“, nur in der Ausgabe; Unit- und Browsertest |
| bedienung-6 (Rest) | Auswahl „Nachweis“ bei „Weitere Kontrolle“ abgeschnitten | erledigt, `d4f89bd`: „Nachweis“ und „Sichert ab“ in voller Breite; Browsertest misst Text und Feld |
| bedienung-17 (Rest) | Verschiedene Wörter für dasselbe | erledigt, `2815507`: Ersatztexte aus dem Fund; der Reiter heißt weiter „Verarbeitungsverzeichnis“, die Einleitung führt die Kurzform ein; Browsertest |
| abnahme-5 (Rest) | Befunde zu Unterlagen erscheinen nicht im Diagramm | erledigt, `cb2e6f7`: Hinweis-Abzeichen „Unterlage“ an der Aufgabe, in der die Unterlage entsteht; der Knopf im Bühnenkopf zählt mit („3 markiert – zeigen“ im Beispiel); Browsertest |
| recht-5 (Entscheidung) | Freigegebene Fassung trägt weiter den Vorlagenhinweis | erledigt, `b516d72` (fix/druck-nach, zusammengeführt in `c1e706a`): Vorlagenhinweis nur im Entwurf; Fußzeile „{Dokument} · Version {n} · freigegeben am {Datum} · Seite X von Y“, Deckblatt mit Verantwortung und empfohlener Prüfung, optional „Fachlich geprüft von … am …“ (Deckblatt, Kapitel 7, Abschnitt D, Historien späterer Versionen); Unit- und Browsertest |
| logik-9 (Rest) | Datumsangaben in der Zukunft bleiben unbemerkt | erledigt, `9cb4579`: neue Regel S9 „Datum in der Zukunft“ (Hinweis) für „Im Einsatz seit“, „Vertrag vom“, „Bewilligung des Finanzamts vom“ und „Eingeführt am“; das Beispiel liefert weiter 7 Befunde; Unit- und Browsertest |

Damit hat die Lückenprüfung **44 Regeln** (V4 und S9 neu; V4 liefert die eigene Funktion `pruefsummenBefunde`, weil die Prüfsummen erst nach dem Laden asynchron nachgerechnet werden).

Tests nach der Nachbesserung: `npm run lint` ohne Befund, 506 Unit-Tests in 56 Dateien (vorher 496 in 53), `npm run build` ohne Chunk-Warnung (Hauptteil 464 kB, gzip 141 kB), 93 Browsertests mit `--workers=2` im ersten Lauf grün (vorher 83; neu `e2e/dokumentieren-nachpruefung.spec.ts` mit 10 Tests), ohne Zeitüberschreitung. Das Windows-Programm wurde nach dem Zusammenführen geprüft (unten).

Zusammenführen von `fix/druck-nach` (`c1e706a`): Konflikte nur in `speicher.ts` (`eingefrorenerProzess` und `pruefeFachlichePruefung` ergänzen sich), `typen.ts` (`fachlichGeprueft` neben dem Rohstand-Kommentar) und der Spezifikation (4.4; 6.8 mit „Was eingefroren wird“ zwischen „Freigabe“ und „Rohstand“); `DokumenteTeil.tsx`, `styles.css` und die Entscheidungen liefen ohne Konflikt zusammen. Abgesichert in `7053249`: `eingefroren-anzeige.test.ts` liest die Quelltexte und lässt Zugriffe auf `.prozess` nur in der Prüfsumme, der Ladeprüfung und `eingefrorenerProzess` zu (Vorschau und Druck einer Version bekommen `eingefrorenerProzess(version)`, `DiagrammDruck` und `docx.ts` lesen keinen Prozess); `e2e/dokumentieren-zusammenfuehrung.spec.ts` speichert und lädt eine Freigabe mit „Fachlich geprüft von/am“ („Prüfsumme stimmt“) und eine Version mit eingefrorenem Prozess in Format 2 (Prüfsumme stimmt, Anlage 9.1 mit Namenskopf, der Rohstand bleibt beim Speichern).

Tests nach dem Zusammenführen: `npm run lint` ohne Befund, 538 Unit-Tests in 59 Dateien, `npm run build` ohne Chunk-Warnung (Hauptteil 464 kB, gzip 141 kB), 100 Browsertests mit `--workers=2` im ersten Lauf grün, ohne Zeitüberschreitung (neu `dokumentieren-druck-nach.spec.ts` mit 5 und `dokumentieren-zusammenfuehrung.spec.ts` mit 2 Tests), 6 Rust-Tests. Regelzahl 44 in Code (44 Kennungen in `regeln.ts`), Spezifikation und README; das Beispiel liefert genau 7 Befunde.

Windows-Programm: `npx tauri build --debug --no-bundle`, `cargo test` und `npm run desktop:test` grün (48 Prüfungen in drei Programmstarts). Das PDF der Verfahrensdokumentation aus dem Programm hat 19 Seiten A4 (vorher 22): Fußzeile „Verfahrensdokumentation · Version 1.0 · freigegeben am 11.11.2026 · Seite X von 19“ ohne Vorlagenhinweis, Deckblatt mit Verantwortung und empfohlener Prüfung; neue Seiten nur vor Kapitel 2, 3, 4 und 9, Kapitel 5 bis 8 laufen weiter; 9.2 steht ganz auf einer Seite. Anlage 9.1: Übersicht mit fünf Rahmen, die durch Lücken laufen; jede Aufgabe liegt in einem Ausschnitt ganz (angeschnitten nur im Überlappungsrand, z. B. „Ware kommissionieren“ links in Ausschnitt 3, ganz in Ausschnitt 2); ab Ausschnitt 2 links der grau hinterlegte Kopf mit „Kunde“, Pool und allen Bahnen. Kein Fluss teilt sich eine Strecke oder einen Anschlusspunkt; die beiden Nachrichtenflüsse in Ausschnitt 4 laufen weiter rund 12 px nebeneinander (abnahme-4, `main`). Die Word-Datei aus dem Programm öffnet unsichtbar in Word (11 Seiten, als PDF exportiert): gleiche Fußzeile und gleiches Deckblatt, Kapitel 1 direkt nach der Gliederung, neue Seiten vor 2, 3, 4 und 9, 9.2 auf einer Seite.

Für das Zusammenführen mit `main` und der Modellierung: Wer eingefrorene Prozesse anzeigt, druckt oder vergleicht, nimmt `eingefrorenerProzess(v)`, nie `v.prozess` (Rohstand, kann ein älteres Format haben); `eingefroren-anzeige.test.ts` meldet jeden neuen Zugriff auf `.prozess`. Neue Migrationen oder Normalisierungen in `leseProjekt` brauchen für Versionen nichts Eigenes.

Gemeinsame Dateien, die die Nachbesserung berührt: `src/App.tsx` (Fehlergrenze um den nachgeladenen Schritt), `src/styles.css` (Regeln neben `.banner-fehler`, `.versionsliste` und `.eingabe-tabelle`; mit `fix/druck-nach` Meldungen in Dialogen und Druckregeln für Umbrüche, Absätze und Formulare), `src/ui/Diagramm.tsx` (`druckInhalt` bekommt die Formen aus bpmn-js), `src/ui/DiagrammDruck.tsx` und `src/ui/druckausschnitte.ts` (Schnitte und Namenskopf), `README.md`, `docs/compliance-spezifikation.md`.

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
| `scripts/desktop-test.mjs` | Phase 8: drei Programmstarts, Compliance-Teil, CSP-Beobachtung, Start ohne Rücksicht auf alte Speicherstände, `PROZESSLOTSE_EXE`; mit der Durchsicht die Prüfung, dass „Dokumentieren“ nachlädt |
| `package.json`, `package-lock.json` | `docx` 9.15.3 (exakt), `fflate` 0.8.3 (dev) |
| `README.md`, `docs/datenmodell.md`, `docs/fragenkatalog.md` | neue Abschnitte |
| `src/App.tsx` (Durchsicht) | „Dokumentieren“ per `lazy` mit `Suspense`, Markierungen über `ui/compliance/nachladen.ts`; Startstand aus `ladeBrowserStand`, Leiste zum Browser-Speicher, Rückfrage beim Schließen ohne Sicherung, Meldung falscher Prüfsummen, Knopf „{n} markiert – zeigen“ |
| `src/modell/speicher.ts` (Durchsicht) | `leseProjekt` wirft `ComplianceFormatfehler`; Browser-Teil mit Merkmal der Versionen, `ladeBrowserStand`, `browserRohdaten`, `verwirfBrowserRohdaten`, `DokumentInfo.veraltet` |
| `src/ui/datei.ts`, `src/plattform/browser.ts` | Rückfrage „Nur den Prozess öffnen?“ bei beschädigten Compliance-Angaben |
| `src/zustand.ts` | Rückzug einer Freigabe leert den Verlauf wie eine Freigabe |
| `src/ui/Diagramm.tsx`, neu `src/ui/DiagrammDruck.tsx`, `src/ui/druckausschnitte.ts` | `DiagrammApi.zeige`/`zeigeErstes`; Druckinhalt der Anlage 9.1 mit Übersicht und Ausschnitten |
| `src/ui/Eingaben.tsx` | `Auswahl` mit Prop `id` |
| `src/ui/schritte/DokumentierenSchritt.tsx`, `VerbessernSchritt.tsx` | Sprünge für „Weiter“ und „Beheben“; Vergleich gestrichener Kontrollen mit dem Soll |
| `src/styles.css` (Durchsicht) | Regeln am Dateiende: Prüfsumme, zurückgezogene Version, Browser-Hinweis, Sprungziel, leerer Teilschritt, Fristentabelle, Reiter, Druckausschnitte |

Beim Zusammenführen beachten:

- **Neue Bausteine aus Format 3** (Teilprozess, für jede Position, Unterbrechung): `ablauftext.ts` prüft die Bausteinart erschöpfend, TypeScript meldet also den fehlenden Satzbaustein (6.6.1). Der Test „kennt alle Felder der Bausteine“ in `generatoren.test.ts` schlägt fehl, sobald die Zufallsprozesse neue Felder wie `unterbrechungen` erzeugen. `zusammenfuehrung`, `ausfuehrung` und `beendetAlles` werden schon gelesen, falls `main` sie so benennt. `nummern` folgt `durchlaufe`; Aufgaben in neuen Rahmen zählen mit, sobald `kinderSequenzen` sie kennt. Aufgaben eines Ausnahmewegs müssen laut 6.3 direkt auf ihre Aufgabe folgen.
- **Neue Felder an Aufgaben** gehören in die Liste `BEKANNT` dieses Tests, sobald Kapitel 4 sie beschreibt.
- **Formatmigrationen** in `leseProjekt` gelten automatisch auch für eingefrorene Prozesse in Versionen, aber nur für die Kopie, die Anzeige und Vergleich nutzen (`eingefrorenerProzess`). Der Rohstand in der Version bleibt unverändert, damit die Prüfsumme stimmt (Nachprüfung, Mangel 1). Wer eingefrorene Prozesse anzeigt, nimmt `eingefrorenerProzess(v)`, nie `v.prozess`.
- **README-Bilder:** nach dem Zusammenführen `node scripts/readme-bilder.mjs` laufen lassen; die alten Bilder zeigen sechs statt sieben Schritte.
- **Tests in gemeinsamen Dateien** gibt es nicht; neue Tests liegen in eigenen Dateien (`src/zustand.compliance.test.ts`, `src/compliance/*.test.ts`).

## Zusammenführung mit `main` und der Modellierung (11.11.2026)

`main` (Stand `2fac3a3`) wurde auf `modellierung` (`2174aad`, Format 4) vorgespult, dann `compliance` (`e7a9b35`) mit `--no-ff` zusammengeführt. Konflikte gab es nur in `README.md` (Aufbau, Qualität) und `docs/datenmodell.md` (7PMG-Satz und Zeichenregeln aus der Modellierung, Abschnitt „Compliance-Angaben“ aus `compliance`, dort „das Dateiformat bleibt 3“ und die Migration eingefrorener Prozesse richtiggestellt). `typen.ts` (`FORMAT_VERSION = 4` neben `Projekt.compliance`), `speicher.ts` (Migration 3 → 4 vor der Compliance-Ladeprüfung), `export.ts`, `RahmenSchritt.tsx`, `styles.css` und `fragenkatalog.md` liefen ohne Konflikt zusammen; `pruefung.ts` und `App.tsx` hatte nur ein Zweig geändert.

Was erst nach dem Zusammenführen möglich war, jeweils mit Test:

- **Kapitel 4 für Format 4** (`ablauftext.ts`, Satzbausteine in Spezifikation 6.6.1): Abschnitt („Abschnitt „Ware versenden“ mit den Schritten 4.2 bis 4.3.“), für jedes Stück („„Für jede Position“: 4.2 bis 4.3 laufen einmal je Stück der Liste, ein Stück nach dem anderen.“ bzw. „…, alle Stücke zur selben Zeit.“), Unterbrechungen an Aufgaben und Rahmen („Ausnahme: Tritt „Kunde storniert“ ein (Nachricht von Kunde), wird der Schritt abgebrochen; weiter mit 4.3, danach endet der Vorgang mit „Storniert“.“, „Nebenweg: Tritt „Rückfrage“ ein (Nachricht), läuft der Schritt weiter; daneben läuft 4.4.“, „Ausnahme im Abschnitt …“, „Ausnahme bei „Für jede Position“: …, endet die Arbeit an allen Stücken; …“), Gleichzeitig „erster“ („…; sobald der erste fertig ist, werden die übrigen abgebrochen, und es geht weiter:“) und „nacheinander“, „Prozess endet sofort“ („…, danach endet der gesamte Vorgang sofort mit …“) nach `nebenlaeufig` statt des geplanten Felds `beendetAlles`. Die Sätze der bisherigen Bausteine sind Wort für Wort gleich geblieben, sonst meldete jede ältere Freigabe „Geändert seit der letzten Freigabe“. Tests: `ablauf-format4.test.ts` (14), angepasst `generatoren.test.ts` (Arten von Gleichzeitig, „kennt alle Felder“ mit Unterbrechungen, Abschnitt und für jedes Stück) und `texte-ablauf.test.ts` (Zweig-Pfade über alle Kindsequenzen, „Ausnahme“/„Nebenweg“ als Zeilen ihres Schritts).
- **Nummern und vorige Aufgabe:** `nummern` folgt `durchlaufe` und zählt Aufgaben in Rahmen und Ausnahmewegen mit; die Aufgaben eines Ausnahmewegs folgen direkt auf ihre Aufgabe. `vorigeAufgabe` liefert am Anfang eines Ausnahmewegs die unterbrochene Aufgabe (K1 prüft dann, wer sie erstellt hat). Lückenprüfung (K1, K2), „Beheben“ und Kapitel 3.3 mit Aufgaben im Abschnitt und im Ausnahmeweg: Unit-Tests und der Browsertest `dokumentieren-format4.spec.ts` (Markierung an der Kontrolle im Abschnitt, „Beheben“ springt auf ihren Nachweis).
- **Prüfsumme über Format 3 hinweg:** `src/compliance/testdaten/format3-freigabe.prozesslotse` ist eine echte Datei aus `compliance` (Lieferdienst mit Gleichzeitig und Warten, Version 1.0). Sie lädt unter Format 4 mit „Prüfsumme stimmt“, der Rohstand bleibt Format 3 ohne `Parallel.art`, Anzeige und Vergleich bekommen Format 4, keine Regel V2 oder V4, Speichern und Laden ändern den Rohstand nicht, eine neue Freigabe friert Format 4 ein (`format3-freigabe.test.ts`).
- **Zufallsprozesse:** Die 300 Zufallsprozesse der Compliance-Tests enthalten jetzt alle Bausteine aus Format 4 und erzeugen beide Dokumente ohne Absturz; jeder Abschnitt, jedes „für jedes Stück“ und jede Unterbrechung erscheint genau einmal in Kapitel 4.
- **Anlage 9.1 mit Rahmen und Randereignissen:** Aufgeklappte Teilprozesse sind beim Schneiden Rahmen wie Bahnen; nur ihr Name (oben in der Mitte) und ihre Markierung (Mehrfachinstanz, Ad-hoc-Tilde) müssen ganz in einen Ausschnitt. Steht eine Beschriftung weit von ihrer Form (der Name eines Randereignisses an seinem Abgang), ist sie eine eigene Form; vorher wurde daraus ein 2 000 px hohes Rechteck. Unit-Tests mit 300 Zufallsprozessen, Browsertest mit dem Beispiel samt Abschnitt und Randereignis.
- **Hauptteil unter 500 kB:** Mit der Modellierung wuchs der Hauptteil auf 560 kB. Wie „Dokumentieren“ laden jetzt auch „Ablauf“, „Verbessern“ und „Bericht“ erst im Schritt (mit Fehlergrenze); Hauptteil 417 kB, samt der sofort mitgeladenen Teile 483 kB. Der Browsertest zählt die mitgeladenen Teile jetzt mit.
- **Zeitgrenze der Unit-Tests** 30 s statt 5 s (`vite.config.ts`): Beide Zweige zusammen haben mehrere Prüfungen über 300 Zufallsprozesse, die unter Last gleichzeitig laufen.

Tests nach dem Zusammenführen: `npm run lint` ohne Befund, `npx tsc -b` ohne Fehler, 692 Unit-Tests in 66 Dateien (434 davon zur Compliance-Doku), `npm run build` ohne Chunk-Warnung, 111 Browsertests (85 zur Compliance-Doku) mit `--workers=2`. Windows-Programm: `cargo test` (6 Rust-Tests), Debug-Build und `npm run desktop:test` grün (48 Prüfungen in drei Programmstarts, PDF der Verfahrensdokumentation 19 Seiten A4). CI: Windows-Programm #2 grün (Installer-Test), Prüfung #20 rot wegen der Schrift unter Linux (siehe „Offen“), nach `f4ed513` Prüfung #21 grün.

Installation auf Robins Rechner (am 11.11.2026 ausdrücklich gewünscht): Release-Installer `Prozesslotse_0.2.0_x64-setup.exe` (1,47 MiB) still installiert nach `%LOCALAPPDATA%\Prozesslotse`, pro Benutzer ohne Admin-Rechte. Startmenü-Eintrag und Desktop-Verknüpfung „Prozesslotse“ legt der Installer selbst an. `.prozesslotse` öffnet per Doppelklick im Programm (Probe mit einer Datei, Fenstertitel „Doppelklick-Probe.prozesslotse – Prozesslotse“), `.bpmn` steht nur unter „Öffnen mit“. Startprobe: Fenster „Prozesslotse“ mit der Willkommensseite, danach ohne Rückfrage geschlossen. Die Programmdaten (`%LOCALAPPDATA%\de.olbricht-digital.prozesslotse`) sind nach Desktop-Test und Doppelklick-Probe auf den Stand davor zurückgesetzt.

## Version 0.3.0 (13.11.2026)

- Neu seit 0.2.0: Export im offenen Format Beratungsakte v1 (Knopf „Für die Beratungsakte speichern“ im Bericht, siehe README) mit den Nacharbeiten vom 13.11.2026.
- Korrektur: `speichern_unter` setzte die zweiteilige Endung `beratungsakte.json` nicht zuverlässig. Ein Name mit Punkt („Akte 2.0“) blieb ohne Endung, `set_extension` hätte ihn zu „Akte 2.beratungsakte.json“ verstümmelt. Jetzt `mit_endung` in `src-tauri/src/lib.rs` wie im Auswahl-Lotsen (`bc22c03`): `.beratungsakte.json` nur ergänzen, wenn es fehlt, ein endendes `.json` ersetzen („x.json“ → „x.beratungsakte.json“); einteilige Endungen wie bisher. Rust-Test vorher rot, danach grün.
- Version 0.3.0 in `package.json`, `src-tauri/Cargo.toml`, `src/version.ts`, `src/bpmn/export.ts` und `.github/release-notizen.md`. In der README stand bei „Neue Version“ noch `src/App.tsx` statt `src/version.ts`; korrigiert.
- Geprüft: `npm run lint` ohne Befund, 710 Unit-Tests, `npm run build`, 115 Browsertests mit `--workers=2` (114 grün im Gesamtlauf; `abnahme-5` in `dokumentieren-nachpruefung.spec.ts` scheiterte unter Last und lief einzeln grün), `cargo test` (8), Debug-Build und `npm run desktop:test` grün.
- Release https://github.com/edgebird-lab/prozesslotse/releases/tag/v0.3.0 (latest), `Prozesslotse-Setup.exe` 1.559.943 Bytes, gleiche SHA-256 wie `Prozesslotse_0.3.0_x64-setup.exe`; `…/releases/latest/download/Prozesslotse-Setup.exe` liefert sie. Auf Robins Rechner still über 0.2.0 installiert (Uninstall-Eintrag 0.3.0, Verknüpfungen und Zuordnung `.prozesslotse` geprüft, Probestart ohne Rückfrage geschlossen).
- Achtung: `npm run desktop:test` sichert die Programmdaten nicht, wenn sie schon da sind (nur neu angelegte werden entfernt); er hat `zuletzt.json` und den Browser-Speicher des installierten Programms überschrieben. Sicherung wie in den anderen Apps fehlt noch.

## Offen und bekannte Mängel

- ~~8.3: Der CI-Lauf steht aus~~: Windows-Programm #2 (Rust-Tests, Release-Build, Installer-Test) nach dem Zusammenführen grün.
- Die echten Dialoge (Speichern unter für Word, Als PDF speichern) beantwortet im Desktop-Test die Testantwort; einmal von Hand durchklicken steht aus (Robin).
- ~~Word bricht in den schmalen Spalten von Tabelle 2.4 Wörter ohne Trennstrich um~~: behoben mit recht-8 (Tabellen in 9 pt, Spaltenbreiten nach Inhalt, `02850d1`).
- Im Druck braucht die breiteste Tabelle des Beispiels 640 von 680 px. Sehr lange Wörter in eigenen Angaben können darüber hinausragen; Silbentrennung (`hyphens: auto`) beherrscht Edge hier nicht zuverlässig.
- Der Menüpunkt „Datei > Als PDF speichern …“ des Programms druckt weiter den Bericht, auch aus dem Teilschritt „Dokumente“; dort gibt es dafür den eigenen Knopf.
- 7.3 und 7.4: fachliche Durchsicht durch Steuerberatung und Datenschutz steht aus (Robin).
- Abnahme der Word-Dateien in Word (Navigationsbereich) durch Robin steht aus; geprüft sind der Inhalt des Pakets und, mit 8.1, das Öffnen in Word 16 ohne Reparaturhinweis samt Formatvorlagen und PDF-Export.
- ~~Der Hauptteil der App wuchs auf 570 KB~~: Mit abnahme-11 lädt „Dokumentieren“ samt Lückenprüfung und Generatoren erst im Schritt; seit der Zusammenführung mit der Modellierung auch „Ablauf“, „Verbessern“ und „Bericht“. Der Hauptteil wiegt 417 kB, samt sofort mitgeladener Teile 483 kB; ein Browsertest hält beides zusammen unter 500 kB. `docx` liegt weiter in einem eigenen Teil (224 KB) und wird erst beim Export geladen.
- Der Vergleich mit dem Mustertext deckt die Sätze ab, die im Lieferdienst vorkommen; seltene Varianten (z. B. Kapitel 5 mit Scannen) sind nicht abgeglichen.
- ~~recht-5: entschieden, umgesetzt noch nicht~~: umgesetzt mit der Nachbesserung Druck (`b516d72`, zusammengeführt in `c1e706a`). Robins Bestätigung der Entscheidung vom 11.11.2026 steht aus.
- ~~abnahme-4 (zwei Nachrichtenflüsse 10 px nebeneinander)~~: behoben mit der Modellierung (`122dbed`): Flüsse, die länger als 100 px nebeneinander laufen, liegen mindestens 20 px auseinander.
- ~~Anlage 9.1 im Druck: In den Ausschnitten 2 bis n fehlen die Bahnnamen~~: Kopf mit Pool- und Bahnnamen ab Ausschnitt 2 (`5e112ca`, zusammengeführt in `c1e706a`).
- Die Browsertests mit axe liegen unter Last knapp am Zeitlimit; einzeln laufen sie grün. Die Zufallstests (300 Prozesse) haben seit der Zusammenführung 30 s.
- Breite Schriften: Der erste CI-Lauf nach der Zusammenführung (Prüfung #20) scheiterte an 9 Browsertests der Compliance-Doku, die Textbreiten messen (Fristentabelle im Panel, Fokusring der Reiter, schmale Fenster 390 und 360 px, „Rollen im Ablauf“, Tabellen im Druck). Ursache: Chrome unter Linux nimmt für `system-ui` DejaVu Sans, rund 10 % breiter als Segoe UI. Unter Windows mit Verdana (gleiche Maße wie DejaVu) scheitern dieselben 9 Tests, mit Arial bestehen alle. Die CI stellt deshalb Liberation Sans (Maße wie Arial) als Systemschrift ein. Wer die App unter Linux mit DejaVu Sans nutzt, sieht an diesen Stellen etwas Überstand; das Layout dafür robuster zu machen, ist offen (Robin entscheidet).
