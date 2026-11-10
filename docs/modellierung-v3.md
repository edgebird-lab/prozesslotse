# Vollständige Modellierung (Dateiformat 3)

Stand 2026-11-11. Ziel: Kunden und andere Externe, ODER-Verzweigungen, „für jede Position“, Teilprozesse, Unterbrechungen laufender Arbeit, Abbruch, „weiter beim ersten von n“ und beliebige Reihenfolge abbildbar machen. Jede Form bekommt eine Frage im Assistenten, eine Rechnung in Kennzahlen und Simulation, ein BPMN-Element, Prüfregeln und Tests mit dem Tokenspiel. Das Modell bleibt blockstrukturiert; dadurch bleiben die Kennzahlen exakt.

## Überblick

| Form | Datenmodell | BPMN | Kennzahlen |
| --- | --- | --- | --- |
| Externe Teilnehmer (Kunde, Lieferant) | `Prozess.teilnehmer`, Verweise `nachrichtAn` / `nachrichtVon` | eigener Pool ohne Inhalt, Nachrichtenfluss | keine; Wartezeiten über Ereignisse |
| ODER-Verzweigung | Baustein `oder` | inklusives Gateway, Standardfluss | Häufigkeit je Weg = Anteil; Dauer = Erwartungswert des Maximums der gewählten Wege |
| Für jede Position | Baustein `mehrfach` | Teilprozess mit Mehrfachinstanz | Häufigkeit × Anzahl; Dauer Summe oder Maximum |
| Teilprozess | Baustein `teilprozess` | aufgeklappter Teilprozess | wie der Inhalt |
| Unterbrechung | `unterbrechungen` an Aufgabe und Teilprozess | Randereignis (Nachricht, Zeit), unterbrechend oder nicht | Anteil × Ausnahmeweg |
| Abbruch | Ausgang mit `beendetAlles` | Terminierungs-Endereignis | Ende zählt sofort |
| Weiter beim ersten | `Parallel.zusammenfuehrung = 'erster'` | komplexes Gateway | Erwartungswert des Minimums |
| Beliebige Reihenfolge | `Parallel.ausfuehrung = 'nacheinander'` | Ad-hoc-Teilprozess, sequenziell | Summe der Zweige |

## Grundsätze

- **Ein Baustein, eine Bahn für Rahmen.** Teilprozess, Mehrfachinstanz und Ad-hoc-Teilprozess werden als Rahmen gezeichnet. Ein Rahmen liegt immer ganz in einer Bahn, sonst würde er Schritte fremder Zweige einschließen. Schritte anderer Rollen im Rahmen tragen die Rolle in Klammern im Namen. Das entspricht BPMN: Die Knoten eines Teilprozesses gehören nicht zu den Bahnen des umgebenden Prozesses.
- **Nachrichtenflüsse laufen in Spaltenlücken.** Vom Element kurz nach oben, waagerecht in die Lücke rechts davon, dann senkrecht zum Pool. So kreuzen sie keine Knoten, auch wenn darüber in derselben Spalte Schritte anderer Bahnen stehen.
- **Ende und Rücksprung verlassen keine Rahmen und keine parallelen Zweige**, mit zwei Ausnahmen: Ein Ende im Teilprozess wird zu Fehler-Endereignis plus Fehler-Randereignis am Teilprozess (BPMN-üblich), und ein Ausgang mit „beendet alles“ ist überall erlaubt.
- **Alte Dateien** (Format 2) werden beim Öffnen umgestellt: neue Felder bekommen ihre neutralen Werte.

## Datenmodell

```ts
interface Teilnehmer { id: Id; name: string }              // extern, eigener Pool
Prozess.teilnehmer: Teilnehmer[]
Prozess.ausloeser.von?: Id | null                          // Startnachricht von …
Aufgabe.nachrichtAn?: Id | null; Aufgabe.nachrichtVon?: Id | null
Warten.von?: Id | null                                    // Nachricht von …
ZweigEreignis.von?: Id | null
EntscheidungsZweig.beendetAlles?: boolean                 // Terminierung
Aufgabe.unterbrechungen?: Unterbrechung[]

interface OderZweig extends Sequenz { bezeichnung: string; anteil: number /* eigene Wahrscheinlichkeit */ }
interface Oder { typ: 'oder'; id: Id; frage: string; zweige: OderZweig[]; standard: Id | null /* Zweig, wenn keiner zutrifft */ }

interface Mehrfach { typ: 'mehrfach'; id: Id; name: string; anzahl: number /* im Schnitt */; ausfuehrung: 'nacheinander' | 'gleichzeitig'; koerper: Sequenz }

interface Teilprozess { typ: 'teilprozess'; id: Id; name: string; koerper: Sequenz; unterbrechungen?: Unterbrechung[] }

interface Unterbrechung {
  id: Id; art: 'nachricht' | 'zeit'; bezeichnung: string; von?: Id | null
  anteil: number              // in wie viel Prozent der Ausführungen
  nachMin: number             // nach wie vielen Minuten ab Beginn (Liegezeit eingeschlossen)
  unterbrechend: boolean
  schritte: Block[]           // Ausnahmeweg
  ende: string | null         // Ergebnis, wenn der Ausnahmeweg den Vorgang beendet; null = danach weiter
}

Parallel.zusammenfuehrung?: 'alle' | 'erster'
Parallel.ausfuehrung?: 'gleichzeitig' | 'nacheinander'
```

## Rechnung

- **ODER:** Zweig i läuft mit Wahrscheinlichkeit pᵢ, unabhängig. Der Standardzweig läuft genau dann, wenn kein anderer läuft: q = Π(1 − pᵢ). Ohne Standardzweig muss q = 0 sein (sonst Prüfungsfehler). Dauer: Verteilung je Zweig als Mischung pᵢ·Dᵢ + (1 − pᵢ)·δ₀, Maximum über die Zweige (Produkt der Verteilungsfunktionen); die Masse q bei 0 wird durch q·D_Standard ersetzt.
- **Mehrfach:** Anzahl N mit Mittelwert n; ganzzahlig N ∈ {⌊n⌋, ⌈n⌉} mit Mittelwert n (kleinste Streuung). Nacheinander: Dauer n·E[D]. Gleichzeitig: E[max von N Durchläufen] über F^N. Häufigkeit des Körpers × n.
- **Teilprozess:** wie eine Folge.
- **Unterbrechung, unterbrechend:** mit Anteil q bricht der Schritt nach t = nachMin ab (t höchstens die Dauer des Schritts), dann Ausnahmeweg; mit 1 − q normal. Bearbeitung bis zum Abbruch anteilig: max(0, min(1, (t − Liegezeit) / Bearbeitung)). Nicht unterbrechend: Ausnahmeweg läuft nebenher mit Häufigkeit q, kostet Arbeit, verlängert die Durchlaufzeit nicht (Annahme, in den Grenzen genannt).
- **Abbruch:** Der Vorgang endet, sobald der Zweig das Ende erreicht; andere parallele Zweige werden abgebrochen. Ihre Arbeit zählt voll (obere Schranke, in den Grenzen genannt).
- **Erster von n:** Dauer = Minimum der Zweige (1 − Π(1 − Fᵢ)); die übrigen Zweige laufen zu Ende, ihre Arbeit zählt, ihre Zeit nicht.
- **Nacheinander:** Dauer = Summe der Zweige.

## Tokenspiel

- Inklusive Zusammenführung: feuert, wenn mindestens ein Eingang belegt ist und im Bereich zwischen Verzweigung und Zusammenführung sonst keine Marke mehr unterwegs ist (für blockstrukturierte Modelle gleichwertig zur BPMN-Regel).
- Komplexes Gateway „erster“: feuert bei der ersten Marke, verbraucht die übrigen ohne zu feuern; Zähler je Gateway im Zustand.
- Teilprozesse sind durchlässig (Eintritt → Start innen, Ende innen → Austritt); Randereignisse sind eine Alternative zum normalen Abschluss; Mehrfachinstanz läuft für die Soundness einmal, für Häufigkeiten n-mal.
- Terminierung leert alle Marken.

## Reihenfolge der Umsetzung

1. Format 3, Migration, Prüfgerüst
2. ODER-Verzweigung
3. Externe Teilnehmer und Nachrichtenflüsse
4. Unterbrechung an Aufgaben
5. Teilprozess mit Unterbrechung und Ende innen
6. Für jede Position
7. Erster von n, beliebige Reihenfolge
8. Abbruch mit Terminierung

Jeder Schritt: Typen, Bausteine, Operationen, Prüfung, Kennzahlen (Fluss, Dauer, Verteilung), Simulation, Layout, Export, Tokenspiel, Zufallsprozesse, Assistent, Lerninhalt, Tests; danach eine kritische Durchsicht.
