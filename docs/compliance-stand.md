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
- [x] 6.2 Druck und PDF: Fußzeile als CSS-Randfeld (`@page @bottom-center`) statt `position: fixed`; mit Edge als PDF geprüft: A4, Fußzeile mit „Seite X von Y“ auf jeder Seite, Kapitel der Ebene 1 auf neuer Seite, Diagramm in 9.1
- [x] 6.3 DOCX-Export (`docx` 9.15.3 exakt gepinnt, eigener Teil von 224 KB, gzip 66 KB); Abnahme in Word durch Robin offen
- [x] 6.4 Freigabe-Dialog, Versionsliste, „Geprüft, keine Änderung“; Browsertest 3
- [x] 6.5 Hinweis in „Verbessern“ bei gestrichener Kontrolle; Browsertest 8
- [x] 6.6 BPMN-Export wahlweise ohne Compliance-Angaben

## Phase 7 – Browsertests, Doku, Abnahme

- [x] 7.1 Browsertests 1 bis 8 aus 9.10 und weitere in `e2e/dokumentieren.spec.ts` (14 Tests, axe hell und dunkel)
- [x] 7.2 README, `datenmodell.md`, `fragenkatalog.md`, Bild `docs/bilder/dokumente.png` (die übrigen README-Bilder zeigen noch sechs Schritte, siehe unten)
- [ ] 7.3 Ausgabe an Steuerberatung und Datenschutz (Robin)
- [ ] 7.4 Rückmeldungen einarbeiten (Robin)

## Phase 8 – Windows-Programm (später)

- [ ] 8.1 `Plattform.speichereBytes`, Rust-Befehl `speichern_unter_bytes`
- [ ] 8.2 PDF der Compliance-Dokumente über `alsPdf`
- [ ] 8.3 Programmtest erweitern

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
| `src/styles.css` | neue Regeln am Dateiende |
| `scripts/readme-bilder.mjs` | Bild `dokumente.png` |
| `package.json`, `package-lock.json` | `docx` 9.15.3 (exakt), `fflate` 0.8.3 (dev) |
| `README.md`, `docs/datenmodell.md`, `docs/fragenkatalog.md` | neue Abschnitte |

Beim Zusammenführen beachten:

- **Neue Bausteine aus Format 3** (Teilprozess, für jede Position, Unterbrechung): `ablauftext.ts` prüft die Bausteinart erschöpfend, TypeScript meldet also den fehlenden Satzbaustein (6.6.1). Der Test „kennt alle Felder der Bausteine“ in `generatoren.test.ts` schlägt fehl, sobald die Zufallsprozesse neue Felder wie `unterbrechungen` erzeugen. `zusammenfuehrung`, `ausfuehrung` und `beendetAlles` werden schon gelesen, falls `main` sie so benennt. `nummern` folgt `durchlaufe`; Aufgaben in neuen Rahmen zählen mit, sobald `kinderSequenzen` sie kennt. Aufgaben eines Ausnahmewegs müssen laut 6.3 direkt auf ihre Aufgabe folgen.
- **Neue Felder an Aufgaben** gehören in die Liste `BEKANNT` dieses Tests, sobald Kapitel 4 sie beschreibt.
- **Formatmigrationen** in `leseProjekt` gelten automatisch auch für eingefrorene Prozesse in Versionen.
- **README-Bilder:** nach dem Zusammenführen `node scripts/readme-bilder.mjs` laufen lassen; die alten Bilder zeigen sechs statt sieben Schritte.
- **Tests in gemeinsamen Dateien** gibt es nicht; neue Tests liegen in eigenen Dateien (`src/zustand.compliance.test.ts`, `src/compliance/*.test.ts`).

## Offen und bekannte Mängel

- 0.3 und Phase 8: DOCX im Windows-Programm lädt derzeit wie im Browser über einen Download-Link; ob WebView2 den annimmt, ist ungeprüft. `Plattform.speichereBytes` und `speichern_unter_bytes` fehlen noch, ebenso PDF über `alsPdf`.
- 7.3 und 7.4: fachliche Durchsicht durch Steuerberatung und Datenschutz steht aus (Robin).
- Abnahme der Word-Dateien in Word (Navigationsbereich) durch Robin steht aus; geprüft ist der Inhalt des Pakets.
- Der Hauptteil der App wuchs von 446 KB auf 570 KB (gzip 170 KB), weil Lückenprüfung und Generatoren schon für die Bühne geladen werden. `docx` liegt in einem eigenen Teil (224 KB, gzip 66 KB) und wird erst beim Export geladen.
- Der Vergleich mit dem Mustertext deckt die Sätze ab, die im Lieferdienst vorkommen; seltene Varianten (z. B. Kapitel 5 mit Scannen) sind nicht abgeglichen.
