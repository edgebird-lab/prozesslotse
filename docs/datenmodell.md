# Datenmodell

Ein Prozess ist ein **Baum aus Bausteinen**. Der Hauptablauf ist eine Folge von Schritten (`Sequenz`); jeder Baustein, der verzweigt, enthält selbst wieder Folgen. Jede Verzweigung wird automatisch zusammengeführt. Dadurch ist jedes Modell **blockstrukturiert**: Verklemmungen, unerreichbare Schritte und ungepaarte Gateways können nicht entstehen, solange drei Regeln gelten, die der Assistent erzwingt und die Prüfung zusätzlich meldet:

1. Innerhalb von „Gleichzeitig“ darf kein Ausgang den Prozess beenden oder zurückspringen (sonst wartet die Zusammenführung ewig).
2. Eine Wiederholung muss mit weniger als 100 % wiederholt werden, und ein Rücksprungbereich braucht einen Ausgang, der weiterführt (sonst Endlosschleife).
3. Ein Rücksprung führt nur zu einem Schritt davor auf dem Weg vom Start zur Entscheidung.

Zusätzlich prüft ein Tokenspiel nach den Ausführungsregeln von BPMN 2.0 ([`tokenspiel.ts`](../src/bpmn/tokenspiel.ts)) das exportierte Diagramm unabhängig vom Baum: keine Verklemmung, jeder Vorgang kann enden, kein toter Schritt. Die Tests lassen es über beide Beispiele und 300 zufällig erzeugte Prozesse laufen.

Quelltext: [`src/modell/typen.ts`](../src/modell/typen.ts)

## Bausteine

| Baustein | Bedeutung | BPMN-Element | Wichtige Angaben |
| --- | --- | --- | --- |
| Aufgabe | Ein Arbeitsschritt einer Rolle | Benutzeraufgabe (digitales System) oder manuelle Aufgabe (Papier, Telefon) | Name, Rolle, System, Bearbeitungszeit, Liegezeit davor, Art (normal, Prüfung, Freigabe), Medienbruch, Abhängigkeit vom Vorgänger |
| Entscheidung (Prüfung/Angabe) | Entweder-oder nach Daten, genau ein Ausgang | Exklusives Gateway (Raute mit X), Verzweigung und Zusammenführung | Frage, Ausgänge mit Bezeichnung und Anteil (Summe 100 %), „Danach“ je Ausgang |
| Entscheidung (was zuerst passiert) | Es geht dort weiter, wo zuerst ein Ereignis eintritt | Ereignisbasiertes Gateway; jeder Ausgang beginnt mit einem Zwischenereignis (Nachricht oder Zeit) | wie oben, dazu je Ausgang Art des Ereignisses und mittlere Wartezeit |
| Gleichzeitig | Alle Zweige laufen, weiter erst, wenn alle fertig sind | Paralleles Gateway (Raute mit +) | mindestens zwei Zweige |
| Wiederholung | Schritte laufen mindestens einmal, danach mit Wahrscheinlichkeit p erneut | Exklusives Gateway vorn (Zusammenführung) und hinten (Frage) mit Rückfluss | Frage, Wiederholungsanteil p < 100 % |
| Warten | Der Vorgang wartet auf einen Zeitpunkt oder eine Nachricht | Zwischenereignis mit Uhr oder Brief | Name, Art, Dauer |

### „Danach“ je Ausgang

| Wert | Bedeutung | Im Modell |
| --- | --- | --- |
| weiter im Ablauf | normaler Fall, der Ausgang mündet in die Zusammenführung | `ende = null`, `zurueckZu = null` |
| Prozess endet | eigenes Endereignis mit Ergebnis, z. B. „Bestellung storniert“ | `ende = "…"` |
| zurück zu einem früheren Schritt | der Ablauf läuft ab diesem Schritt erneut | `zurueckZu = Kennung des Rücksprungbereichs` |

Wählt man „zurück zu X“, fasst [`setzeRuecksprung`](../src/modell/operationen.ts) den Abschnitt von X bis zu dem Block, der die Entscheidung enthält, zu einem **Rücksprungbereich** zusammen (`Wiederholung` mit `modus = "ruecksprung"`). Er wird so oft durchlaufen, wie Ausgänge darin zurückspringen. Gibt es keinen Rücksprung mehr, löst [`normalisiere`](../src/modell/operationen.ts) den Bereich wieder auf. Jede Wiederholung, auch ein Rücksprungbereich, hat ein optionales Feld `zweck`: `"nacharbeit"` (Korrektur, Standard) oder `"menge"` (gewollte Durchgänge, z. B. je Position). Nur Nacharbeit löst Hinweise und die Regel „Nacharbeit senken“ aus. Im BPMN steht vor X eine Zusammenführung; die Rückkante läuft unter dem Bereich zurück.

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

Gespeichert wird ein `Projekt` mit Ist-Prozess, optionalem Soll-Prozess, den übernommenen Maßnahmen und den verworfenen Vorschlägen. Die Datei trägt `formatVersion` (aktuell 2). Beim Laden prüft [`speicher.ts`](../src/modell/speicher.ts) die Struktur, stellt Dateien im Format 1 automatisch um und lehnt fremde oder beschädigte Dateien mit einer verständlichen Meldung ab.

## Prüfregeln

[`pruefung.ts`](../src/modell/pruefung.ts) meldet Befunde in drei Stufen:

- **Fehler** machen Berechnungen unzuverlässig: Anteile ungleich 100 %, Endlosschleife, Verklemmung, unerreichbare Schritte, leere Zweige, Rücksprung ins Leere, fehlendes Ereignis.
- **Warnungen** sind fehlende Pflichtangaben: Aufgabe ohne Rolle, Name oder Zeit.
- **Hinweise** betreffen Qualität und Vollständigkeit, z. B. Benennung als Objekt + Verb (7PMG G6), mehr als drei Ausgänge (G2), Modelle über 50 Elemente (G7), ungenutzte Rollen und Systeme.

Zwei der sieben 7PMG-Richtlinien erfüllt das Modell durch seine Bauweise: G4 (so strukturiert wie möglich) und G5 (keine ODER-Verzweigungen).
