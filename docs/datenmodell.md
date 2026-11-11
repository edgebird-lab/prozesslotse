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
| Mehrere Wege möglich (ODER) | Je nach Fall laufen einer, mehrere oder alle Wege; weiter, wenn alle gewählten fertig sind | Inklusives Gateway (Raute mit Kreis), Standardfluss für „keiner davon“ | Frage, Wege mit eigenem Anteil (wie oft der Weg vorkommt), dazu entweder ein Weg „wenn keiner zutrifft“ oder „mindestens einer trifft immer zu“ (dann zusammen mindestens 100 %) |
| Gleichzeitig | Alle Zweige laufen, weiter erst, wenn alle fertig sind | Paralleles Gateway (Raute mit +) | mindestens zwei Zweige |
| Wiederholung | Schritte laufen mindestens einmal, danach mit Wahrscheinlichkeit p erneut | Exklusives Gateway vorn (Zusammenführung) und hinten (Frage) mit Rückfluss | Frage, Wiederholungsanteil p < 100 % |
| Warten | Der Vorgang wartet auf einen Zeitpunkt oder eine Nachricht | Zwischenereignis mit Uhr oder Brief | Name, Art, Dauer, bei Nachricht optional der Absender (externer Beteiligter) |

**Rechnung der ODER-Verzweigung.** Mit Weg „wenn keiner zutrifft“ sind die Wege unabhängig: Weg i läuft mit seinem Anteil pᵢ, der Standardweg genau dann, wenn keiner der anderen läuft (q = Π(1 − pᵢ)). Ohne diesen Weg trifft immer mindestens einer zu. Dann sind die Anteile die tatsächlichen Häufigkeiten und müssen zusammen mindestens 100 % ergeben. Gerechnet wird mit unabhängigen Würfen rᵢ = pᵢ · Z unter der Bedingung „mindestens einer“, wobei Z die Gleichung Z = 1 − Π(1 − pᵢ · Z) löst. Diese Verteilung hat unter den angegebenen Häufigkeiten die größte Entropie; bei zwei Wegen laufen beide in p₁ + p₂ − 1 der Fälle. Ergeben die Anteile genau 100 %, schließen sich die Wege aus, und ein Hinweis empfiehlt die Entscheidung (Entweder-oder). Kennzahlen, Verteilung, Simulation und Tokenspiel nutzen dieselbe Ziehung.

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
| `teilnehmer` | externe Beteiligte (Kunde, Lieferant, Bank) mit Namen; jeder wird ein eigener Pool ohne Inhalt |
| `ablauf` | die Hauptsequenz |

**Nachrichten mit externen Beteiligten.** Eine Aufgabe kann etwas an einen Teilnehmer schicken (`nachrichtAn`) oder etwas von ihm bekommen (`nachrichtVon`). Bei Nachrichtenereignissen (Auslöser, Warten, Ausgang einer Ereignis-Entscheidung) nennt `von` den Absender. Einen Absender gibt es nur bei der Art „Nachricht“: Ein Nachrichtenfluss darf nicht an einem Zeit- oder Bedingungsereignis enden. Wechselt die Art, verwirft das Formular den Absender, und beim Laden werden solche Reste entfernt. Im BPMN entsteht eine Kollaboration: der eigene Prozess als Pool mit Bahnen, jeder Teilnehmer als leerer Pool (Black Box) und je Austausch ein Nachrichtenfluss. Der Teilnehmer mit den meisten Nachrichten steht über dem Prozess, der zweite darunter, weitere abwechselnd.

## Einheiten

- Alle Zeiten sind **Minuten Arbeitszeit**. „1 Arbeitstag“ entspricht `arbeitsstundenProTag × 60` Minuten.
- Anteile und Wahrscheinlichkeiten sind Zahlen von 0 bis 1, die Oberfläche zeigt Prozent.
- Kosten sind Euro auf Basis der Vollkosten-Stundensätze.

## Projekt

Gespeichert wird ein `Projekt` mit Ist-Prozess, optionalem Soll-Prozess, den übernommenen Maßnahmen und den verworfenen Vorschlägen. Die Datei trägt `formatVersion` (aktuell 3; Format 3 bringt die ODER-Verzweigung, siehe [Modellierung, Format 3](modellierung-v3.md)). Beim Laden prüft [`speicher.ts`](../src/modell/speicher.ts) die Struktur, stellt Dateien in den Formaten 1 und 2 automatisch um und lehnt fremde oder beschädigte Dateien mit einer verständlichen Meldung ab.

## Prüfregeln

[`pruefung.ts`](../src/modell/pruefung.ts) meldet Befunde in drei Stufen:

- **Fehler** machen Berechnungen unzuverlässig: Anteile ungleich 100 %, Endlosschleife, Verklemmung, unerreichbare Schritte, leere Zweige, Rücksprung ins Leere, fehlendes Ereignis.
- **Warnungen** sind fehlende Pflichtangaben: Aufgabe ohne Rolle, Name oder Zeit.
- **Hinweise** betreffen Qualität und Vollständigkeit, z. B. Benennung als Objekt + Verb (7PMG G6), mehr als drei Ausgänge (G2), Modelle über 50 Elemente (G7), ungenutzte Rollen, Systeme und externe Beteiligte, ODER-Wege, die sich wie ein Entweder-oder verhalten (G5), und mehr als zwei externe Beteiligte.

G4 (so strukturiert wie möglich) erfüllt das Modell durch seine Bauweise. G5 (ODER-Verzweigungen vermeiden) ist eine Empfehlung: Die ODER-Verzweigung gibt es, weil manche Abläufe sie brauchen, und die Prüfung meldet Fälle, in denen ein Entweder-oder oder ein Gleichzeitig genügt.

## Zeichenregeln

Das Layout ([`layout.ts`](../src/bpmn/layout.ts), Linien in [`linien.ts`](../src/bpmn/linien.ts)) hält diese Regeln ein; [`geometrie.ts`](../src/testhilfen/geometrie.ts) prüft sie an beiden Beispielen und an 300 Zufallsprozessen:

- **Jeder Fluss ist eine eigene Linie.** Zwei Flüsse teilen sich nie eine Strecke und nie einen Anschlusspunkt, sonst sähe ein Fluss aus wie einer mit zwei Enden. Das gilt für Sequenz- und Nachrichtenflüsse.
- **Anschlüsse an Gateways:** Die gerade Linie nimmt die seitliche Ecke. Die übrigen Wege laufen senkrecht aus der oberen oder unteren Kante, der weiteste an der Ecke, die übrigen daneben; so schachteln sich die Winkel ohne Kreuzung. Steht in der Spalte der Raute ein fremder Knoten oder eine fremde Linie im Weg, verlässt der Weg die Raute waagerecht in eigener Höhe und wechselt die Höhe in der Spaltenlücke. Zusammenführungen spiegeln das.
- **Spaltenlücken sind Kanäle:** Jedes senkrechte Stück bekommt dort eine eigene Spur. Die Reihenfolge wird so gewählt, dass sich möglichst wenige Linien kreuzen; reicht die Lücke nicht, wird sie breiter.
- **Rücksprünge** laufen über je eine eigene Extraspur unter dem Bereich, der weiteste am tiefsten.
- Jeder Fluss beginnt auf dem Rand seiner Quelle und endet auf dem Rand seines Ziels; keine Linie läuft durch einen fremden Knoten.
- **Beschriftungen** stehen am gewohnten Platz (über dem ersten waagerechten Stück, die Frage über dem Gateway). Liegt dort eine Linie, ein Knoten oder eine andere Beschriftung, nehmen sie den ersten freien Platz entlang ihrer Linie; tritt oben eine Linie aus, rückt die Frage nach links oben.
