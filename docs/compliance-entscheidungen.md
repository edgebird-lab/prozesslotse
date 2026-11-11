# Compliance-Doku: Entscheidungen und Annahmen

Stand 11.11.2026 · gehört zu [`compliance-spezifikation.md`](compliance-spezifikation.md) (Abschnitt 10.2 und Phase 0)

Robin hat die offenen Fragen noch nicht beantwortet. Damit die Umsetzung weitergehen kann, gilt jeweils der Vorschlag der Spezifikation. Jede Zeile ist eine **Annahme, bis Robin entscheidet**; wo eine andere Antwort Arbeit nach sich zieht, steht das dabei.

## Offene Fragen aus 10.2

| Nr. | Frage | Annahme, bis Robin entscheidet | Folge einer anderen Antwort |
| --- | --- | --- | --- |
| 1 | Heißt der neue Schritt „Dokumentieren“ oder „Compliance“? | „Dokumentieren“ | Umbenennen in `SCHRITTE` (`src/zustand.ts`), Überschrift, Browsertests |
| 2 | Fristenpolitik: gesetzliche Mindestfristen oder einheitlich 10 Jahre? | gesetzliche Mindestfristen als Standard; der Knopf „Alle aufbewahrungspflichtigen Unterlagen einheitlich 10 Jahre“ setzt die längere Frist auf Wunsch | Standardwert in `standard.ts`; bei 10 Jahren als Standard wird bei personenbezogenen Daten sofort eine Begründung fällig (D7) |
| 3 | Eine Dokumentation je Prozess oder früh eine Firmenmappe? | je Prozess; Firmenmappe später (2.2) | eigene Spezifikation |
| 4 | Nur Gliederung und Kapitelnamen des Musters übernehmen? | ja, nur Gliederung und Kapitelnamen; alle Texte eigene Formulierungen | keine |
| 7 | Diagramm als Bild in die DOCX-Datei? | nein: DOCX verweist auf die BPMN-Datei, die Druckfassung (PDF) enthält das Diagramm | etwa 1 Arbeitstag |
| 8 | Dokumentation auch für den Soll-Prozess? | nein, immer der Ist-Prozess | Kontext und Generatoren um die Ansicht erweitern |
| 9 | Reicht „Überprüfung fällig“ beim Öffnen? | ja (Regel V3); Benachrichtigung im Windows-Programm später | Tauri-Benachrichtigung |
| 11 | Unterlagen und Ablageorte zunächst nur in den Compliance-Angaben? | ja, eigene Tabellen in `compliance` (4.1); `quelle.ts` ist der einzige Adapter | später Migration ins Prozessmodell |
| 12 | Compliance-Angaben im BPMN-Export standardmäßig mitschicken? | ja (verlustfrei); beim Export gibt es die Wahl „ohne Compliance-Angaben“ für die Weitergabe an Dritte | Standard der Wahl umdrehen |

Die Fragen 5, 6 und 10 (Gegenleser, StBerG/RDG, erster Praxistest) betreffen nicht den Code und bleiben offen.

## Abgleich mit Format 3 (Schritt 0.2)

Stand des Codes beim Start der Erweiterung: Commit `0139e53` auf `main`.

| Baustein aus `docs/modellierung-v3.md` | im Code | Satzbaustein in Kapitel 4 |
| --- | --- | --- |
| Externe Teilnehmer (`teilnehmer`, `nachrichtAn`, `nachrichtVon`, `von`) | ja | ja (Auslöser, Aufgabe, Warten, Ereignis-Entscheidung) |
| ODER-Verzweigung (`oder`, `standard`) | ja | ja |
| Für jede Position (`mehrfach`) | nein | fehlt, beim Zusammenführen ergänzen |
| Teilprozess (`teilprozess`) | nein | fehlt, beim Zusammenführen ergänzen |
| Unterbrechung (`unterbrechungen`) | nein | fehlt, beim Zusammenführen ergänzen |
| Abbruch (`beendetAlles`) | nein | vorbereitet: wird gelesen, falls vorhanden |
| Weiter beim ersten / beliebige Reihenfolge (`zusammenfuehrung`, `ausfuehrung`) | nein | vorbereitet: wird gelesen, falls vorhanden |

Feldnamen in 4.1 stimmen mit dem Code überein. Die Ablaufbeschreibung (`src/compliance/ablauftext.ts`) prüft die Bausteinart erschöpfend: Kommt beim Zusammenführen mit `main` ein neuer Baustein hinzu, meldet TypeScript einen Fehler, statt dass der Baustein im Dokument still fehlt. Die Nummerierung (`nummern`) folgt `durchlaufe` und zählt Aufgaben in neuen Rahmenbausteinen automatisch mit, sobald `kinderSequenzen` sie kennt.

## Technische Annahmen

- **Prüfung beim Laden:** `leseProjekt` ruft `validiereCompliance` auf, wenn `compliance` vorhanden ist. Dafür importiert `src/modell/speicher.ts` aus `src/compliance/speicher.ts` und umgekehrt (`Formatfehler`, `leseProjekt`). Beide nutzen die Importe nur in Funktionen, nicht beim Laden des Moduls; der Kreis ist deshalb unschädlich.
- **Eingefrorene Prozesse:** `validiereCompliance` schickt den Prozess einer Version durch `leseProjekt` (als Projekt mit nur einem Ist-Prozess). So gilt jede Formatmigration aus `main` automatisch auch für alte Versionen, ohne dass die Migration doppelt geschrieben wird.
- **Gliederung:** Sie wird beim Darstellen aus den Überschriften gebildet und nicht im Dokument gespeichert.
- **Kapitel 7:** Die Tabelle hat zusätzlich die Spalte „aufbewahren bis“, weil der Satz darüber auf sie verweist; „freigegeben am“ und „von“ stehen in einer Spalte.
- **Kapitel 4.{n+1}:** Neben den aufbewahrungspflichtigen Unterlagen nennt es auch personenbezogene Unterlagen ohne Aufbewahrungspflicht mit ihrer Löschfrist, weil das Kapitel „Löschung“ im Titel trägt.
- **Teilschritt:** gehört wie Schritt und Ansicht nicht zum Rückgängig-Verlauf.
- **Erprobung von `docx` (0.3):** im Browser und in Node (Tests); im Windows-Programm erst mit Phase 8.

## Auslegungen bei der Umsetzung

Wo die Spezifikation offen war oder ein Detail nicht passte, gilt Folgendes. Auch das sind Annahmen, bis Robin entscheidet.

| Stelle | Auslegung | Grund |
| --- | --- | --- |
| D4, D5, D8 | nur für Unterlagen mit Personenbezug „Ja“ (wie D2, D3, D6, D7) | Die Felder erscheinen nur dann; ausgeblendete Altangaben sollen keine Befunde auslösen. |
| B6 | „alle Ablage-Speicher nicht digital“ verlangt mindestens einen Ablageort mit bekanntem System | Ohne Ablage gilt B3; ein Ablageort ohne System ist nicht „auf Papier“. |
| B6, Ausnahme | ohne erzeugende Aufgabe zählt die Unterlage als nicht aus einem Fakturierungssystem | Nur dann kann die Ausnahme der Rz. 120 greifen; es bleibt ein Hinweis. |
| S1–S6 | nur für digitale Systeme im Einsatz | Für Papier und Telefon gibt es keine Systemfragen (5.3). |
| S3, K2 | eigener Text für „Drittland ohne Garantie“ bzw. Nachweis „Weiß nicht“ | Der Text aus 6.5 passt nur auf „Standort unbekannt“ bzw. „kein Nachweis“. |
| K5 | nur, wenn es interne Rollen mit Aufgaben gibt | Sonst meldete ein leerer Prozess einen Ein-Personen-Betrieb. |
| B9 | ein Befund je Aufgabe, die Unterlagen werden aufgezählt | eindeutiger Schlüssel `compliance:B9:{Aufgabe}` |
| Kapitel 2.6 | die Steuerberatung aus den Unternehmensangaben steht bei den externen Stellen | 5.3 nennt „VD 2.6“ als Verwendung. |
| Kapitel 6 | mit ersetzendem Scannen kommt „Verfahrensdokumentation zum ersetzenden Scannen“ dazu | Kapitel 5 verweist auf Kapitel 6. |
| Verzeichnis B.5 | Zusatz „Ort der Verarbeitung offen bei: …“, wenn ein Standort unbekannt ist | Sonst stünde dort ungeprüft „findet nicht statt“. |
| Deckblatt | Versionszeile als Absatz vor der ersten Überschrift (zählt zum Deckblatt) | Das Dokumentmodell kennt kein eigenes Feld dafür; der Vergleich übergeht das Deckblatt. |
| Druck | Fußzeile als Randfeld der Seite (`@page { @bottom-center }`) statt `position: fixed` | verdeckt keinen Text; mit Edge geprüft: auf jeder Seite, mit „Seite X von Y“ |
| Vorschau „Dokumente“ | ohne Änderung seit der letzten Freigabe zeigt sie die freigegebene Version, sonst den Entwurf | Ein inhaltsgleicher „Entwurf“ nach der Freigabe würde verwirren; Word-Datei und Druck tragen so die Versionsnummer. |
| Belege und Daten | Karten sind eingeklappt; offen sind anfangs die mit Fehlern oder Warnungen, „Beheben“ klappt auf | Mit allen Fragen offen war die Seite beim Beispiel über 10 000 Pixel lang. |
| Teilschritt-Leiste | ohne Nummern, nur Name und Status | Die Namen passen sonst nicht in drei Spalten. |
| Klick ins Diagramm | wählt die Aufgabe aus und filtert; beim Wechsel in „Dokumentieren“ wird eine alte Auswahl gelöscht | Sonst griffe ein Filter aus dem Schritt „Ablauf“ unerwartet. |
| „Verbessern“ | „Weiter“ führt jetzt zu „Dokumentieren“ statt zum Bericht | neue Reihenfolge der Schritte |
| BPMN-Export | Menüpunkt „Als BPMN ohne Compliance-Angaben exportieren“ und Knopf im Teilschritt „Dokumente“; nach dem normalen Export ein Hinweis in der Kopfzeile | keine zusätzliche Rückfrage bei jedem Export (Frage 12) |
| Speicher voll | Meldung in der Kopfzeile bei jeder Änderung, solange das Speichern scheitert | Die bestehende Meldezeile verschwindet nach 6 Sekunden. |
