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
