# Datenmodell

Ein Prozess ist ein **Baum aus Bausteinen**. Der Hauptablauf ist eine Folge von Schritten (`Sequenz`); jeder Baustein, der verzweigt, enthält selbst wieder Folgen. Jede Verzweigung wird automatisch zusammengeführt. Dadurch ist jedes Modell **blockstrukturiert**: Verklemmungen, unerreichbare Schritte und ungepaarte Gateways können nicht entstehen, solange zwei Regeln gelten, die der Assistent erzwingt und die Prüfung zusätzlich meldet:

1. Innerhalb von „Gleichzeitig“ darf kein Zweig den Prozess beenden (sonst wartet die Zusammenführung ewig).
2. Eine Wiederholung muss mit weniger als 100 % wiederholt werden (sonst Endlosschleife).

Quelltext: [`src/modell/typen.ts`](../src/modell/typen.ts)

## Bausteine

| Baustein | Bedeutung | BPMN-Element | Wichtige Angaben |
| --- | --- | --- | --- |
| Aufgabe | Ein Arbeitsschritt einer Rolle | Benutzeraufgabe (digitales System) oder manuelle Aufgabe (Papier, Telefon) | Name, Rolle, System, Bearbeitungszeit, Liegezeit davor, Art (normal, Prüfung, Freigabe), Medienbruch, Abhängigkeit vom Vorgänger |
| Entscheidung | Entweder-oder, genau ein Ausgang | Exklusives Gateway (Raute mit X), Verzweigung und Zusammenführung | Frage, Ausgänge mit Bezeichnung und Anteil (Summe 100 %), optional Prozessende je Ausgang |
| Gleichzeitig | Alle Zweige laufen, weiter erst, wenn alle fertig sind | Paralleles Gateway (Raute mit +) | mindestens zwei Zweige |
| Wiederholung | Schritte laufen mindestens einmal, danach mit Wahrscheinlichkeit p erneut | Exklusives Gateway vorn (Zusammenführung) und hinten (Frage) mit Rückfluss | Frage, Wiederholungsanteil p < 100 % |
| Warten | Der Vorgang wartet auf einen Zeitpunkt oder eine Nachricht | Zwischenereignis mit Uhr oder Brief | Name, Art, Dauer |

## Prozess

| Feld | Bedeutung |
| --- | --- |
| `name`, `beschreibung` | Beschriftung |
| `ausloeser` | Startereignis: Nachricht, Zeitpunkt, Bedingung oder manuell, mit Text |
| `ergebnis` | Name des regulären Endereignisses |
| `vorgaengeProTag` | neue Fälle pro Arbeitstag, Grundlage für Auslastung und Tageskosten |
| `arbeitsstundenProTag` | Länge eines Arbeitstags, Standard 8 |
| `rollen` | Name, Stundensatz (€), Personen, verfügbarer Anteil (%) |
| `medien` | Systeme und Arbeitsmittel: Papier, Telefon, E-Mail, Tabelle, Fachanwendung, ERP, Sonstiges |
| `ablauf` | die Hauptsequenz |

## Einheiten

- Alle Zeiten sind **Minuten Arbeitszeit**. „1 Arbeitstag“ entspricht `arbeitsstundenProTag × 60` Minuten.
- Anteile und Wahrscheinlichkeiten sind Zahlen von 0 bis 1, die Oberfläche zeigt Prozent.
- Kosten sind Euro auf Basis der Vollkosten-Stundensätze.

## Projekt

Gespeichert wird ein `Projekt` mit Ist-Prozess, optionalem Soll-Prozess, den übernommenen Maßnahmen und den verworfenen Vorschlägen. Die Datei trägt `formatVersion`; beim Laden prüft [`speicher.ts`](../src/modell/speicher.ts) die Struktur und lehnt fremde oder beschädigte Dateien mit einer verständlichen Meldung ab.

## Prüfregeln

[`pruefung.ts`](../src/modell/pruefung.ts) meldet Befunde in drei Stufen:

- **Fehler** machen Berechnungen unzuverlässig: Anteile ungleich 100 %, Endlosschleife, Verklemmung, unerreichbare Schritte, leere Zweige.
- **Warnungen** sind fehlende Pflichtangaben: Aufgabe ohne Rolle, Name oder Zeit.
- **Hinweise** betreffen Qualität und Vollständigkeit, z. B. Benennung als Objekt + Verb (7PMG G6), mehr als drei Ausgänge (G2), Modelle über 50 Elemente (G7), ungenutzte Rollen und Systeme.

Zwei der sieben 7PMG-Richtlinien erfüllt das Modell durch seine Bauweise: G4 (so strukturiert wie möglich) und G5 (keine ODER-Verzweigungen).
