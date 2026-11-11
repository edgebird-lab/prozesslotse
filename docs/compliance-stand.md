# Compliance-Doku: Stand der Umsetzung

Zweig `compliance` (Arbeitskopie `prozesslotse-compliance`). Grundlage: [`compliance-spezifikation.md`](compliance-spezifikation.md), Annahmen in [`compliance-entscheidungen.md`](compliance-entscheidungen.md). Die Nummern folgen Abschnitt 11 der Spezifikation.

Vor jedem Commit: `npm run lint`, `npm test`, `npm run build`, `PL_PORT=4175 npx playwright test` (Port 4173 gehört `main`).

## Phase 0 – Klären und vorbereiten

- [x] 0.1 Offene Fragen: Vorschläge der Spezifikation als Annahmen übernommen (`compliance-entscheidungen.md`); Robins Antworten stehen aus
- [x] 0.2 Abgleich mit Format 3 (Stand `0139e53`): ODER und externe Teilnehmer im Code, übrige Bausteine noch nicht
- [ ] 0.3 `docx` im Windows-Programm erproben (CSP, `crypto.subtle`), gehört zu Phase 8

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

- [ ] 3.1 `dokument.ts`: Kapitelschlüssel und Vergleich
- [ ] 3.2 Verfahrensdokumentation: Deckblatt, Kapitel 1 bis 3
- [ ] 3.3 `ablauftext.ts`: Aufgabe, Entscheidung, Gleichzeitig, Wiederholung, Warten
- [ ] 3.4 Satzbausteine für Format 3 (soweit umgesetzt), 300 Zufallsprozesse
- [ ] 3.5 Kapitel 5 bis 9 und Textbausteine
- [ ] 3.6 Verzeichnis A bis D
- [ ] 3.7 `versionen.ts`: Freigabe, gültig bis, aufbewahren bis, Prüfsumme, geänderte Kapitel

## Phase 4 – Assistent, Teil 1

- [ ] 4.1 Schritt „Dokumentieren“, Teilschritt-Leiste mit Status, Lernhinweise
- [ ] 4.2 Teilschritt „Unternehmen“ mit Übernahme aus anderer Projektdatei
- [ ] 4.3 „Belege und Daten“: Einordnung, Form, Ablage, Anlegen
- [ ] 4.4 „Belege und Daten“: Personenbezug, Kategorien, Rechtsgrundlage, Empfänger, Zwecke
- [ ] 4.5 „Systeme und Dienstleister“

## Phase 5 – Assistent, Teil 2

- [ ] 5.1 „Aufbewahrung und Löschung“
- [ ] 5.2 „Kontrollen“
- [ ] 5.3 „Schutzmaßnahmen“
- [ ] 5.4 „Lücken“ mit „Beheben“ und Markierungen; Browsertests 1 und 2

## Phase 6 – Ausgabe, Freigabe, Verzahnung

- [ ] 6.1 `DokumentAnsicht` für beide Dokumente
- [ ] 6.2 Druck und PDF
- [ ] 6.3 DOCX-Export
- [ ] 6.4 Freigabe-Dialog, Versionsliste, „Geprüft, keine Änderung“; Browsertest 3
- [ ] 6.5 Hinweis in „Verbessern“ bei gestrichener Kontrolle; Browsertest 8
- [ ] 6.6 BPMN-Export wahlweise ohne Compliance-Angaben

## Phase 7 – Browsertests, Doku, Abnahme

- [ ] 7.1 Browsertests 4 bis 7
- [ ] 7.2 README, `datenmodell.md`, `fragenkatalog.md`, Bild „Dokumente“
- [ ] 7.3 Ausgabe an Steuerberatung und Datenschutz (Robin)
- [ ] 7.4 Rückmeldungen einarbeiten (Robin)

## Phase 8 – Windows-Programm (später)

- [ ] 8.1 `Plattform.speichereBytes`, Rust-Befehl `speichern_unter_bytes`
- [ ] 8.2 PDF der Compliance-Dokumente über `alsPdf`
- [ ] 8.3 Programmtest erweitern

## Zusammenführen mit `main`

Geänderte gemeinsame Dateien und was dabei zu beachten ist, steht am Ende dieser Datei, sobald es sie gibt.
