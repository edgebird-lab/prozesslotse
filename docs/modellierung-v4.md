# Vollständige Modellierung, Format 4

Stand 2026-11-11. Verbindliches Design für Teilprozess, „für jede Position“, Unterbrechungen (Randereignisse), die Arten von „Gleichzeitig“ und den Abbruch. Für diese Formen ersetzt es den Entwurf [modellierung-v3.md](modellierung-v3.md); Externe und ODER sind nach Format 3 umgesetzt und bleiben, wie sie sind. Alle 36 Befunde der kritischen Design-Prüfung sind eingearbeitet (Liste am Ende). Fortschritt und nächste Schritte: [modellierung-stand.md](modellierung-stand.md).

Leitsatz: Das Modell bleibt ein Baum aus Bausteinen und damit blockstrukturiert. Jede Rechnung ist im Modell des Prozesslotsen exakt (feste Zeiten je Schritt, gewürfelte Wege). Wo eine Annahme nötig ist, steht sie unter „Grenzen“. Datenobjekte gehören nicht zu diesem Auftrag.

## Auf einen Blick

| Form | Baustein | BPMN | Rechnung (Kern) |
| --- | --- | --- | --- |
| Teilprozess | `teilprozess` („Abschnitt mit Namen“) | aufgeklappter `subProcess` mit Start und Ende innen, als Rahmen in einer Bahn | wie seine Schritte |
| Für jede Position | `mehrfach` | Mehrfach-Markierung an der Aufgabe, sonst an einem Teilprozess | Anzahl N mit Mittel n; nacheinander Summe, gleichzeitig Maximum; Liegezeit einmal |
| Unterbrechung | `unterbrechungen` an Aufgabe, Teilprozess, Mehrfach | Randereignis (Zeit, Nachricht), unterbrechend oder nicht, mit Ausnahmeweg | feste, sich ausschließende Anteile; Nebenweg ohne Einfluss auf die Dauer |
| Weiter beim ersten | `parallel`, `art: 'erster'` | Teilprozess, in dem jeder Zweig mit einer Terminierung endet | Minimum der Zweige, die übrigen werden abgebrochen |
| In beliebiger Reihenfolge | `parallel`, `art: 'nacheinander'` | Ad-hoc-Teilprozess, `ordering="Sequential"`, je Zweig eine Aktivität | Summe der Zweige, Reihenfolge der Liste |
| Abbruch | kein neues Feld: „Prozess endet mit …“ | Ende, Terminierung oder Fehler-Ende mit Fehler-Randereignis, je nach Ort | erster Abbruch gewinnt; abgebrochene Arbeit zählt voll |

## Gemeinsame Regeln

### Dateiformat 4

- `FORMAT_VERSION = 4`, einmal erhöht im ersten Schritt (Teilprozess). Migration 3 → 4 in `speicher.ts`: `formatVersion` auf 4, jedes `Parallel` bekommt `art: 'alle'`. Sonst ändert sich nichts. Test: Eine Format-3-Datei lädt und ergibt dieselben Kennzahlen und dasselbe BPMN wie vorher.
- Format 4 wächst danach nur um Dinge, die ältere Format-4-Dateien nicht enthalten: Schritt 1 bringt `teilprozess` und `Parallel.art` (zunächst nur `'alle'`), Schritt 2 `mehrfach`, Schritt 3 die optionalen `unterbrechungen` (fehlt = keine), Schritt 4 die Werte `'erster'` und `'nacheinander'`. Schritt 5 ändert das Format nicht.
- Wiederholungen mit Zweck „menge“ bleiben unverändert; die Prüfung bietet die Umwandlung als Hinweis an (Abschnitt 2).
- `pruefeBlock` kennt die neuen Bausteine und Felder. `entferneFremdeAbsender` leert auch `Unterbrechung.von`, wenn die Art nicht „nachricht“ ist.

### Rahmen

Rahmen sind Teilprozess, Mehrfach (außer wenn er als einzelne Aufgabe mit Markierung gezeichnet wird, siehe 2), „weiter beim ersten“, „in beliebiger Reihenfolge“ und deren eingebettete Zweig-Teilprozesse.

- **Eine Bahn.** Ein Rahmen und alles darin liegen in einer Bahn: der Rolle mit den meisten Aufgaben im Rahmen, bei Gleichstand der Rolle der ersten Aufgabe, ohne Aufgabe die Bahn, in der der Ablauf gerade ist. Aufgaben anderer Rollen heißen im Diagramm „Name (Rolle)“ (nur im BPMN). Das Formular sagt das; arbeiten im Rahmen zwei oder mehr Rollen, gibt die Prüfung einen Hinweis.
- **Grenze.** Kein Sequenzfluss quert sie. Der eingehende Fluss endet an der linken Kante, der ausgehende beginnt an der rechten (Ein- und Austritt sind der Rahmen selbst). Innen beginnt der Ablauf an einem Start- und endet an einem Endereignis, außer im Ad-hoc-Rahmen.
- **Fertig, wenn innen keine Marke mehr liegt** (BPMN). Keine Rechnung darf in einem Rahmen Nachzügler übergehen.

### Kindsequenzen und Umgebungen

- `kinderSequenzen`: Teilprozess und Mehrfach liefern `[koerper]`; Aufgabe, Teilprozess und Mehrfach zusätzlich ihre Unterbrechungen. Eine `Unterbrechung` ist selbst eine `Sequenz` (ihr Ausnahmeweg), wie `EntscheidungsZweig`. Daraus folgen `durchlaufe`, `abbildeBlock`, `findeSequenz`, `normalisiere`, `entferneTeilnehmer`, `nachrichtenVerweise`, `verlaesstBlock`, `ausgaengeBlock` und die Regeln in `regeln.ts`.
- Jeder `switch` über `Block['typ']` und über `Parallel.art` ist erschöpfend (`satisfies never`), damit keine Stelle eine neue Form still wie eine alte rechnet.
- Weil eine Aufgabe jetzt Kindsequenzen hat, entscheiden nicht mehr Blöcke, sondern Ketten aus (Block, Kindsequenz). Neu in `operationen.ts`, als Ersatz für `liegtInParallele` und `istNebenlaeufig`:
  - `nebenlaeufig(kette)`: Irgendwo auf der Kette liegt ein Zweig von Gleichzeitig mit Art „alle“ oder „erster“, ein ODER-Weg, der Körper von Mehrfach gleichzeitig oder ein Nebenweg (nicht unterbrechender Ausnahmeweg). „In beliebiger Reihenfolge“ ist nicht nebenläufig: Dort läuft immer nur ein Zweig.
  - `rahmenUeber(kette)`: alle Rahmen über der Stelle, von außen nach innen.

### Ende je nach Ort

Für Nutzer gibt es eine Option: „Prozess endet mit …“ (Feld `ende` wie bisher, kein `beendetAlles`). Sie beendet immer den ganzen Vorgang. Die BPMN-Form folgt aus dem Ort:

| Ort | BPMN | erlaubt ab |
| --- | --- | --- |
| Prozessebene, nicht nebenläufig | Endereignis mit Ergebnis (wie heute) | heute |
| Prozessebene, nebenläufig | Terminierungs-Endereignis mit Ergebnis | Schritt 5 |
| in einem Rahmen | Fehler-Endereignis. Je Ergebnis ein `bpmn:error` (errorCode aus dem Ergebnis); am **äußersten** Rahmen ein unterbrechendes Fehler-Randereignis mit derselben `errorRef`, von dort ein Fluss zum Endereignis mit dem Ergebnis (Terminierung, wenn der äußerste Rahmen nebenläufig liegt) | mit dem jeweiligen Rahmen (Schritt 1 bis 4); an nebenläufiger Stelle ab 5 |
| Nebenweg | nicht erlaubt: wird nicht angeboten, die Prüfung meldet einen Fehler | – |

- Fehler steigen durch geschachtelte Rahmen und Mehrfach-Instanzen zum fangenden Randereignis auf; am Mehrfach-Block bricht es alle Instanzen ab.
- Bis Schritt 5 bleibt ein Ende in nebenläufiger Umgebung ein Prüffehler wie heute („Verklemmung“).
- Ab Schritt 5 lautet die Option in nebenläufiger Umgebung „Prozess endet sofort; was gleichzeitig läuft, wird abgebrochen“. Der Lernhinweis erklärt den Blitz des Fehler-Endes als „Ausstieg aus dem Rahmen“, nicht als technischen Fehler.

### Rücksprung

Ein Rücksprung quert weder eine nebenläufige Umgebung noch eine Rahmengrenze. `ruecksprungZiele` hört an beiden auf; `setzeRuecksprung` und die Prüfung ebenso (neuer Fehler „Rücksprung aus einem Rahmen“). Innerhalb eines Rahmens, eines Zweigs oder eines Ausnahmewegs bleiben Rücksprünge erlaubt. Quelle eines Rücksprungs kann auch eine unterbrechende Unterbrechung sein (`zurueckZu`); `setzeRuecksprung` und `entferneRuecksprung` nehmen dafür (Block, Ausgang) statt (Entscheidung, Zweig), `normalisiere` sammelt beide Arten von Verweisen.

### Abgebrochene Arbeit zählt voll

Eine Regel für alle Formen: Arbeit, die ein Abbruch, eine Unterbrechung oder „weiter beim ersten“ abschneidet, zählt, als wäre sie zu Ende geführt (obere Schranke, in den Grenzen genannt). Was nacheinander gar nicht mehr anfängt (spätere Stücke bei Mehrfach nacheinander, spätere Zweige bei beliebiger Reihenfolge), zählt nicht. So bleiben Häufigkeit, Arbeit, Kosten und Auslastung unabhängig von Zeiten, und Formeln und Tokenspiel lassen sich exakt vergleichen. Die Durchlaufzeit bleibt exakt: Sie endet mit dem Abbruch.

**TCT** (theoretische Durchlaufzeit) nimmt dieselben Wege mit denselben Wahrscheinlichkeiten wie die Durchlaufzeit und zählt nur Bearbeitung, und zwar bis zum Abbruch: eine bei t unterbrochene Aufgabe mit min(B, max(0, t − L)), ein bei t unterbrochener Rahmen mit min(t, TCT des Rahmens), bei einer Nachricht mit der halben TCT des Rahmens. Wo Zeiten über den Gewinner entscheiden („erster“, Abbruch in Zweigen), rechnet die TCT dieselbe Kombination mit Bearbeitungszeiten. In jedem Fall bleibt TCT ≤ Durchlaufzeit.

### Rechnung mit Teilverteilungen

Jeder Block liefert je Zeitart (gesamt, arbeit) Teilverteilungen mit zusammen Masse 1: W (weiter hinter dem Block), R_b (Rücksprung zu Bereich b), E_r (Vorgang endet mit Ergebnis r). `verteilung.ts` bekommt dafür `ende: Map<string, Verteilung>`; die Entscheidung legt ihre Enden dort ab, statt sie zu verwerfen, und die Folge faltet sie mit der Zeit davor.

**Abbruchkombination** für Teile, die zugleich laufen (Gleichzeitig „alle“, gewählte ODER-Wege, Instanzen von Mehrfach gleichzeitig; „erster“ siehe 4). Zweig i hat Abbruch G_i = Σ_r E_{i,r} und Weiter H_i = W_i. Die Zeit ist der früheste Abbruch, sonst das späteste normale Ende:

- Abbruch-Teil: A(t) = 1 − Π_i (1 − G_i(t))
- Weiter-Teil: W(t) = Π_i H_i(t), ohne Normierung (Masse Π H_i(∞))
- Ergebnis r von Zweig i: Σ_t e_{i,r}(t) · Π_{j<i} (1 − G_j(t)) · Π_{j>i} (1 − G_j(t⁻)); bei Gleichstand gewinnt der frühere Zweig der Liste.

`maximum()` ist der Sonderfall ohne Abbruch; die bisherige Normierung jedes Zweigs auf Masse 1 entfällt. Für diese Blöcke nimmt `kennzahlen.dauerBlock` gesamt = Erwartung über alle Teile und weiter = Masse von W. Rücksprünge kommen in solchen Teilen nicht vor.

### Tokenspiel

- **Bereiche.** Jeder Knoten kennt seinen Rahmen (`rahmen: string | null`). Neue Knotentypen: `rahmen` (mit `mehrfach?: { nacheinander: boolean }` und `adhoc?: true`) und `rand` (Randereignis mit `wirt`, `unterbrechend`, `art: 'zeit' | 'nachricht' | 'fehler'`, `fehler?`). Endereignisse bekommen `art: 'normal' | 'terminierung' | 'fehler'` und `fehler?`.
- **Marken** liegen auf Flüssen, qualifiziert mit der Instanz ihres Rahmens (`fluss@instanz`), damit gleichzeitige Instanzen sich nicht mischen; die Prüfung „mehr als eine Marke auf einem Fluss“ gilt je Instanz.
- **Rahmen.** Eine Marke am Eingang startet eine Instanz (Marke hinter dem inneren Start; Mehrfach und Ad-hoc siehe dort). Die Instanz ist fertig, wenn in ihr keine Marke mehr liegt; dann geht eine Marke auf den Ausgang, oder ein unterbrechendes Randereignis wird gewählt (Abschnitt 3).
- **Terminierung** leert ihren Bereich (Rahmen-Instanz oder Prozess). **Fehler-Ende** leert alles bis einschließlich des Rahmens mit dem passenden Fehler-Randereignis und legt eine Marke auf dessen Ausgang.
- **Abbruch zuletzt.** Eine Marke vor einer Terminierung oder einem Fehler-Ende schaltet erst, wenn in dem Bereich, den sie beendet, sonst nichts mehr schalten kann. BPMN erlaubt diese Reihenfolge, und für die Soundness geht nichts verloren, weil der Bereich danach leer ist. Für die Häufigkeiten ergibt sie genau „abgebrochene Arbeit zählt voll“. Die verkürzte Suche bleibt gültig: Bis zum Abbruch nimmt keine Marke einer anderen etwas weg, und Abbrüche bilden die letzte Stufe.
- **Inklusive Zusammenführung nach der Norm** statt der Bereichsregel: bereit, wenn mindestens ein Eingang belegt ist und jede Marke, die einen leeren Eingang erreichen kann, ohne die Zusammenführung zu passieren, auch einen belegten erreicht. Eine Marke in einer laufenden Rahmen-Instanz zählt als Marke am Rahmen, Randereignisse gehören zur Erreichbarkeit ihres Wirts. Die Erreichbarkeit wird einmal je Graph vorab berechnet. `bereich` und `ergaenzeOderBereiche` entfallen.
- **Zeitabhängige Wahrscheinlichkeiten** (wer bei „erster“ zuerst fertig ist) stehen wie Anteile am Layout-Element, und das Tokenspiel würfelt damit. Geprüft wird, dass sie richtig durch den Graphen weitergegeben werden, wie bei Entscheidungen.
- **`graphAusXml` liest rekursiv:** `subProcess` und `adHocSubProcess` als `rahmen`, `boundaryEvent` als `rand` (attachedToRef, cancelActivity, Ereignisdefinition), Endereignisse mit `terminateEventDefinition` oder `errorEventDefinition`, `multiInstanceLoopCharacteristics` (isSequential). Die Stichprobe „XML = Layout“ vergleicht auch Bereiche und Randereignisse.

### Zeichenregeln für die neuen Formen

Die Regeln aus [datenmodell.md](datenmodell.md) gelten weiter. Neu, gelegt in `layout.ts` und `linien.ts` und geprüft in `geometrieFehler`:

1. **Rahmen überlappen nur verschachtelt.** Zwei Rahmen liegen ineinander oder getrennt. Ein Knoten liegt ganz in seinem innersten Rahmen, mit mindestens 6 px Abstand zur Kante, und berührt keinen fremden Rahmen.
2. **Kein Sequenzfluss quert eine Rahmengrenze.** Flüsse zwischen Knoten desselben Rahmens bleiben innen, Flüsse zwischen Knoten außerhalb berühren das Innere nicht. Ausgenommen sind nur Ein- und Austritt eines Rahmens an seinen Kanten.
3. **Keine Linie läuft auf einer Rahmenkante** (gemeinsame Strecke gemessen wie in `gemeinsameStrecke`). Nachrichtenflüsse dürfen Rahmenkanten senkrecht queren, denn zu Elementen in einem Rahmen geht es nicht anders.
4. **Ein Randereignis sitzt auf dem Rand seines Wirts:** Mittelpunkt auf der Unterkante, ganz innerhalb der Breite des Wirts. Randereignisse eines Wirts überlappen sich nicht und lassen die Mitte der Unterkante eines Mehrfach-Rahmens für die Markierung frei. Ihr Fluss beginnt auf dem eigenen Kreis und läuft nicht durch den Wirt.
5. **Beschriftungen von Rahmen** (oben in der Mitte der Kopfspur; so zeichnet bpmn-js den Namen eines aufgeklappten Teilprozesses) liegen auf keinem Knoten und keiner anderen Beschriftung; fremde Linien darauf zählen in `beschriftungenAufLinien`.
6. Die Überlappungsprüfung nimmt Randereignis und Wirt sowie Knoten und eigenen Rahmen aus. „Liegt in seiner Bahn“ gilt auch für Rahmen. Die Tests mit 300 Zufallsprozessen bleiben ohne Befund.

## 1 Teilprozess („Abschnitt mit Namen“)

**Datenmodell**

```ts
export interface Teilprozess {
  typ: 'teilprozess'
  id: Id
  /** Name des Abschnitts, z. B. „Ware versenden“ */
  name: string
  koerper: Sequenz
  /** ab Schritt 3 */
  unterbrechungen?: Unterbrechung[]
}
```

`neuerTeilprozess()`; `blockTitel` und `bereichTitel` liefern den Namen.

**BPMN.** `<bpmn:subProcess id name>` mit innerem `startEvent` (ohne Definition), dem Inhalt und einem `endEvent` als `flowElements`; im DI `isExpanded="true"`, die inneren Formen auf derselben Ebene. Im `laneSet` steht nur der Teilprozess selbst als `flowNodeRef`. Enden im Körper: siehe „Ende je nach Ort“.

**Layout.**

- Ein Teilprozess ist ein Block mit Rahmen: inneres Start, Körper, inneres Ende (zwei Spalten mehr als der Körper).
- `Teil.anker` ist die Spur der Hauptlinie im Band (bisher immer 0). Ein Rahmen hat Anker 1: darüber liegt eine dünne Kopfspur für den Namen, unter dem Inhalt eine dünne Fußspur; geschachtelte Rahmen entsprechend mehr. Folgen und Verzweigungen richten ihre Teile auf den größten Anker aus, damit Ein- und Austritt auf einer Höhe liegen und die Linie gerade bleibt.
- Alle Knoten im Rahmen bekommen dessen Bahn (Kontext `bahnZwang`).
- Der Rahmen ist kein Knoten im Spaltenraster, sondern ein `LayoutRahmen` in der neuen Liste `Layout.rahmen` (Rechteck, `blockId`, `bahn`, `art`, Eltern-Rahmen, `anschlussY`). Der äußere Fluss schließt auf seiner Kante in Höhe der Hauptlinie an.
- Seitenkanten liegen in der Lücke vor dem ersten bzw. hinter dem letzten inneren Knoten, außerhalb aller Kanalspuren, die die Höhe des Rahmens kreuzen, mit mindestens 6 px Abstand zu ihnen und zum inneren Knoten; geschachtelte Rahmen je 8 px weiter innen. Reicht die Lücke nicht, wird sie breiter, wie volle Kanäle in `linien.ts`.
- **Bahnwechsel neben Rahmen.** Läge das senkrechte Stück eines fremden Sequenzflusses (Bahnwechsel zwischen Zweigen, senkrechter Anschluss an ein Gateway, Rücksprung) in der x-Spanne eines Rahmens und kreuzte dessen Höhe, rückt der Layouter im betroffenen Zweig den obersten Block, der Quelle oder Ziel dieses Stücks enthält, samt allem dahinter hinter den Rahmen. Das wiederholt sich, bis nichts mehr kreuzt; es gilt in jedem Block mit gestapelten Bändern (Verzweigungen, Unterbrechungen). `spalteFrei` behandelt Rahmen als belegt.

**Rechnung.** Häufigkeit, Arbeit, Dauer, Verteilung, Simulation und Übergaben wie die Folge seiner Schritte. Enden im Körper beenden den Vorgang wie bisher.

**Prüfregeln.** Fehler: leerer Abschnitt; Rücksprung aus dem Abschnitt hinaus (auch in von Hand gebauten Dateien); bis Schritt 5 ein Ende im Abschnitt an nebenläufiger Stelle (dazu zählt ein Abschnitt, der selbst in einem Zweig von Gleichzeitig liegt). Warnung: kein Name. Hinweis: zwei oder mehr Rollen im Abschnitt („Im Diagramm stehen alle Schritte in der Bahn „Lager“; Schritte anderer Rollen tragen die Rolle in Klammern.“).

**Assistent.**

- Bausteinwahl „Ein Abschnitt mit Namen“ – „fasst Schritte zusammen, z. B. für eine Frist über mehrere Schritte“. Frage: „Wie heißt der Abschnitt?“ (Pflicht, Beispiel „Ware versenden“). Danach steht die Einfügeposition im Abschnitt, „Abschnitt fertig“ führt dahinter.
- Vorhandene Schritte zusammenfassen: In der Gliederung an jedem Schritt „Ab hier zu einem Abschnitt zusammenfassen …“ mit Auswahl des letzten Schritts derselben Folge (`fasseZusammen(p, sequenzId, von, bis, name)`). Dieselbe Funktion nutzt die Frage „Gilt das nur für diesen Schritt oder für mehrere?“ bei Unterbrechungen.
- „Abschnitt auflösen“ im Formular stellt die Schritte zurück in die Folge; Unterbrechungen des Abschnitts gehen nach Rückfrage verloren. Aufgelöst wird nie automatisch.
- Ort: „im Abschnitt „Ware versenden““. Gliederung: Rahmensymbol, Name, Meta „Abschnitt“ (mit Unterbrechungen „· 2 Unterbrechungen“), darunter die Schritte. Das Formular nennt die Bahn. Lernhinweis „Abschnitt“: aufgeklappter Teilprozess, Rahmen mit eigenem Start und Ende.

**Tokenspiel.** Rahmen und Fehler-Ende wie in den gemeinsamen Regeln.

**Tests (von Hand nachgerechnet).**

- Abschnitt [A 20 Min.; Entscheidung „Lieferbar?“: 90 % weiter, 10 % endet „nicht lieferbar“], danach B 30 Min.: Dauer 20 + 0,9 · 30 = 47 Min.; Enden 90 % regulär, 10 % „nicht lieferbar“; Häufigkeit A 1, B 0,9. Export: Fehler-Ende innen, `bpmn:error`, Fehler-Randereignis am Abschnitt, außen ein Ende „nicht lieferbar“; bpmn-moddle ohne Warnung; Tokenspiel sound auf Layout und XML.
- Zwei verschachtelte Abschnitte mit Ende im inneren: ein Fehler-Randereignis, nur am äußeren.
- Geometrie: Gleichzeitig mit Zweig 1 = Abschnitt in Bahn B und Zweig 2 = Aufgabe in A, dann Aufgabe in C in denselben Spalten: Der Bahnwechsel von Zweig 2 liegt hinter dem Rahmen.

**Umsetzung (Schritt 1, Stand 2026-11-11).** Gebaut wie oben, mit diesen Präzisierungen:

- *Name des Rahmens:* bpmn-js schreibt ihn oben in die Mitte, nicht links; das Feld für die Prüfung liegt entsprechend. Die Kopfspur wächst, wenn der Name mehr als zwei Zeilen braucht.
- *Anker je Bahn:* `Teil.anker` ist eine Spur je Bahn, in der die Hauptlinie hinein- oder hinausläuft. Eine Folge senkt ihre Teile je Bahn auf den größten Anker; Bahnen ohne Rahmen behalten Spur 0. Ohne Abschnitte bleibt jedes Diagramm Byte für Byte wie in Format 3 (Test mit Prüfsummen beider Beispiele).
- *Seitenkanten:* 12 px neben der belegten Breite der ersten bzw. letzten inneren Spalte; alle Kanalspuren der Lücke (nicht nur die, die die Höhe des Rahmens kreuzen) bleiben mindestens 8 px außerhalb. Geschachtelte Rahmen teilen sich nie eine Lücke, weil jeder einen eigenen inneren Start und ein eigenes Ende hat; der Versatz von 8 px je Ebene wird erst für den Ad-hoc-Rahmen (Schritt 4) nötig.
- *Bahnwechsel neben Rahmen:* Für jedes Stück, das einen Rahmen eines anderen Zweigs quert, rückt der oberste Baustein des **weiter unten liegenden** der beiden Zweige hinter den betroffenen obersten Baustein des anderen (nicht immer der Baustein mit dem Stück). Nur so endet das Rücken sicher: Rückt immer der Baustein mit dem Stück hinter den Rahmen, können sich zwei Zweige gegenseitig weiterschieben. Der Layouter wiederholt Layout und Prüfung, bis nichts mehr quert (höchstens zwölf Runden). Beginnt ein Zweig dadurch später, wechselt der Fluss aus der Verzweigung die Höhe gleich hinter der Raute und läuft im eigenen Band weiter.
- *Fehler-Randereignis:* Spalte 0 des Blocks ist der ganze Rahmen; die Enden mit Ergebnis stehen in der Spalte dahinter, je eines in einem eigenen Band unter dem Rahmen.
- *Körper ohne normales Ende:* Endet jeder Weg im Abschnitt vorher, hat er kein inneres Ende und keinen Ausgang (sonst stünde ein totes Ende im Diagramm); was dahinter folgt, meldet die Prüfung als unerreichbar.
- *Rücksprung über die Grenze* (nur in von Hand gebauten Dateien): Die Prüfung meldet einen Fehler, im BPMN entfällt der Rückfluss.
- *Tokenspiel:* Die Instanz eines Rahmens steht als eigene Marke `Pfad|*` in der Markierung, bis sie fertig ist; eine ODER-Zusammenführung, eine Terminierung oder ein Fehler-Ende sehen nur Marken derselben Instanz.

## 2 Für jede Position (Mehrfach)

**Datenmodell**

```ts
export type MehrfachStreuung = 'fest' | 'schwankt'
export type MehrfachAusfuehrung = 'nacheinander' | 'gleichzeitig'

export interface Mehrfach {
  typ: 'mehrfach'
  id: Id
  /** z. B. „Für jede Position“ */
  name: string
  /** Stücke je Ausführung im Schnitt, ≥ 0 */
  anzahl: number
  /** fest: immer etwa gleich viele; schwankt: geometrisch ab 1 (n ≥ 1) */
  streuung: MehrfachStreuung
  ausfuehrung: MehrfachAusfuehrung
  /** Liegezeit einmal vor dem ersten Stück */
  liegezeitMin: number
  koerper: Sequenz
  /** ab Schritt 3; gelten für die ganze Liste */
  unterbrechungen?: Unterbrechung[]
}
```

**Anzahl N.** fest: N = ⌊n⌋ + X mit P(X = 1) = n − ⌊n⌋ (kleinste Streuung). schwankt: P(N = k) = (1 − p) · p^(k−1) für k ≥ 1 mit p = 1 − 1/n, genau die Verteilung einer Wiederholung mit Anteil p. Kennzahlen, Verteilung, Simulation und Tokenspiel ziehen N aus derselben Verteilung.

**BPMN.** Ist der Körper genau eine Aufgabe ohne Unterbrechungen und hat der Baustein selbst keine, trägt die Aufgabe `multiInstanceLoopCharacteristics` (`isSequential` = nacheinander). Sonst wird der Baustein ein aufgeklappter Teilprozess (Rahmen, Name = `name`) mit dieser Markierung. `loopCardinality` steht nur bei ganzzahligem n und Streuung „fest“ im XML; Anzahl, Streuung und Liegezeit stehen in der Dokumentation („Im Schnitt 2,5 Stück, schwankt; Liegezeit vor dem ersten 2 Std.“).

**Layout.** Aufgabe: ein Knoten wie jede Aufgabe, bpmn-js zeichnet die Markierung. Rahmen: wie ein Teilprozess; die Mitte seiner Unterkante bleibt für die Markierung frei.

**Rechnung.** c = Wahrscheinlichkeit, dass ein Durchlauf des Körpers normal endet; L = `liegezeitMin`, zählt nur bei N ≥ 1.

- Häufigkeit jedes Körperschritts: Häufigkeit in einem Durchlauf × K mit K = E[(1 − c^N)/(1 − c)] bei nacheinander (= E[N] bei c = 1; bei schwankt 1/(1 − p·c) wie die Wiederholung) und K = E[N] bei gleichzeitig (abgebrochene Instanzen zählen voll).
- Weiter: E[c^N]. Enden: nacheinander e_r · K; gleichzeitig nach der Abbruchkombination (ab Schritt 5).
- Dauer nacheinander: P(N ≥ 1) · L plus die Summe der Durchläufe; als Verteilung die Mischung über N der N-fachen Faltung, mit Enden wie eine Wiederholung mit höchstens N Durchläufen.
- Dauer gleichzeitig: P(N ≥ 1) · L plus das Maximum der N Durchläufe, F(t) = E[F_K(t)^N]; mit Abbruch Abbruch-Teil E[1 − (1 − G(t))^N] und Weiter-Teil E[H(t)^N] (Schritt 5).
- TCT: dieselbe Rechnung mit Bearbeitungszeiten; L zählt nicht.
- Übergaben: ein Strang hinein (Vorgänger → erste Aufgabe des Körpers, einmal) und einer heraus; bei nacheinander zusätzlich zwischen den Stücken vom letzten zum ersten Körperschritt, so oft wie Übergänge von einem Stück zum nächsten (K − P(N ≥ 1)), wie bei einer Wiederholung.
- Simulation: N ziehen, nacheinander Durchläufe addieren (Abbruch beendet), gleichzeitig das Maximum (ab Schritt 5: frühester Abbruch).

**Prüfregeln.** Fehler: leerer Körper; Anzahl < 0; „schwankt“ mit Anzahl < 1; Liegezeit < 0; Rücksprung aus dem Körper; bis Schritt 5 ein Ende im Körper bei „gleichzeitig“. Warnung: kein Name. Hinweis: „fest“ mit n < 1 („läuft in x % der Vorgänge gar nicht“).

**Schwachstellen-Hinweise.** „Gleichzeitig, aber zu wenig Leute“, wenn bei „gleichzeitig“ eine Rolle im Körper weniger Personen hat als n (wie `parallelrolle`). Lange Liegezeit des Bausteins wie bei Aufgaben (der Baustein bekommt einen Eintrag in `Kennzahlen.schritte`).

**Umwandlungshinweise** (Befunde „Für jede Position doppelt“ und „Zwei Wege für dieselbe Sache“). Nichts wird still umgebaut; die Prüfung zeigt Hinweise mit Knopf „Umwandeln“:

- Wiederholung mit Modus „anteil“, Zweck „menge“, ohne Ende oder Rücksprung, der den Körper verlässt → Mehrfach { name: Frage der Wiederholung, anzahl: 1/(1 − p), streuung: 'schwankt', ausfuehrung: 'nacheinander', liegezeitMin: 0, koerper }. Weil die Körperschritte ihre Liegezeit behalten, bleiben alle Kennzahlen und die Verteilung exakt gleich (Test).
- Entscheidungs-Ausgang „beides“ oder „beide“ → „Als ODER abbilden?“; Rolle namens Kunde, Lieferant, Bank oder Behörde → „Als externen Beteiligten führen?“ (verschiebt Aufgaben dieser Rolle nicht, sondern öffnet Schritt 2).

**Assistent.**

- Bausteinwahl „Etwas für jedes Stück einer Liste“ – „jede Position, jeden Lieferanten, jeden Beleg“. Die Wiederholung bietet „Mehrere Durchgänge“ für neue Bausteine nicht mehr an (`ZweckWahl` zeigt „menge“ nur, wenn es schon gesetzt ist) und verweist auf den neuen Knopf.
- Fragen: „Wofür?“ (Pflicht, Beispiel „Für jede Position“) · „Wie viele hat ein einzelner Vorgang im Schnitt?“ (Zahl, Vorgabe 3; live „bei 20 Vorgängen am Tag sind das 60 am Tag“) · „Sind es immer etwa gleich viele?“ – ja (Vorgabe) / nein, das schwankt stark · „Wie werden sie erledigt?“ – eine Person arbeitet sie der Reihe nach ab (Vorgabe) / zur selben Zeit (mehrere Leute teilen sich die Liste, oder man wartet auf mehrere Antworten zugleich) · „Wie lange liegt der Vorgang, bevor jemand mit dem ersten Stück anfängt?“ (Vorgabe 0).
- Danach steht die Einfügeposition im Körper: „je Stück in „Für jede Position““. Neue Aufgaben dort fragen „Wartezeit zwischen zwei Stücken“ (nacheinander) bzw. „Wartezeit je Stück“ (gleichzeitig), Vorgabe 0; live „Liegezeit zählt einmal, Bearbeitung je Stück: 2,5 × 10 Min.“.
- Gliederung: Symbol mit drei Strichen, Name, Meta „Ø 2,5 · nacheinander · liegt 2 Std.“. Lernhinweis: Mehrfachinstanz, drei senkrechte Striche = gleichzeitig, drei waagerechte = nacheinander.

**Tokenspiel.** Eine Aufgabe mit Markierung ist eine Aktivität, die je Aktivierung N-mal zählt; ein Mehrfach-Rahmen startet N Instanzen. Suche: null und eine Instanz (wie jede Wahl unabhängig von der Wahrscheinlichkeit). Häufigkeiten: N aus der Verteilung (Anzahl und Streuung stehen am Layout-Element); nacheinander eine Instanz nach der anderen, gleichzeitig alle zugleich. Ein Fehler-Ende in einer Instanz schaltet nach „Abbruch zuletzt“ und leert dann alle Instanzen.

**Tests (von Hand nachgerechnet).**

- Körper Aufgabe 10 Min., L = 60, n = 2,5, fest, nacheinander: N ∈ {2, 3} je 50 %; Häufigkeit 2,5; Dauer 60 + 25 = 85 Min.; Arbeit 25 Min. Gleichzeitig: 60 + 10 = 70 Min.
- Körper Entscheidung 50 % A 10 Min. / 50 % B 30 Min., n = 2, fest, gleichzeitig, L = 0: P(max = 10) = 0,25, Dauer 0,25 · 10 + 0,75 · 30 = 25 Min.
- n = 0,4, fest: Dauer 0,4 · (L + D); Hinweis „läuft in 60 % der Vorgänge gar nicht“.
- Nacheinander mit Ende im Körper (Aufgabe 10 Min., dann 5 % endet), n = 2, fest: K = 1,95, weiter 0,9025, Dauer 19,5 Min.
- Umwandlung einer Mengenschleife mit p = 0,6: Mehrfach n = 2,5, schwankt; Kennzahlen gleich, P90 der Simulation gleich innerhalb der statistischen Toleranz.

**Umsetzung (Schritt 2, Stand 2026-11-11).** Gebaut wie oben, mit diesen Präzisierungen:

- *Eine Stelle für N:* [`anzahl.ts`](../src/modell/anzahl.ts) liefert P(N = k), P(N ≥ k), E[c^N], K = E[(1 − c^N)/(1 − c)], E[F^N] ohne den Teil N = 0 und die Ziehung. Ungültige Werte (die Prüfung meldet sie) werden in den gültigen Bereich gezogen; n ist auf 10 000 begrenzt (`MAX_ANZAHL`, Warnung „Sehr viele Stücke“, das Formular nimmt bis 1 000), damit Rechnung und Simulation bei einem Tippfehler nicht hängen.
- *0 Stücke sind ein Fehler,* nicht nur ein Hinweis: Mit `loopCardinality` 0 liefen die Schritte darin nie, das exportierte Diagramm hätte tote Elemente. Der Hinweis „läuft in x % der Vorgänge gar nicht“ gilt für 0 < n < 1.
- *Ende im Körper bei „gleichzeitig“:* eigener Prüffehler „Ende neben gleichzeitig laufenden Schritten“ (`abbruch`) statt „Verklemmung“. Das BPMN wäre sound (das Fehler-Randereignis am Rahmen bricht alle Stücke ab); es fehlt nur die Rechnung bis Schritt 5. Allgemein heißt es jetzt nur dann „Verklemmung“, wenn außerhalb des äußersten Rahmens eine nebenläufige Umgebung liegt; ein Ende in „Gleichzeitig“ innerhalb eines Abschnitts bekommt ebenfalls den neuen Fehler. Bis Schritt 5 rechnen Kennzahlen und Verteilung diesen Fall anteilig (Ende mit E[1 − c^N], aufgeteilt nach den Enden eines Stücks).
- *Rücksprung über die Grenze* prüft zuerst den Rahmen (`rahmenrueck`), dann die nebenläufige Umgebung: Im BPMN entfällt ein solcher Rückfluss, es verklemmt also nichts.
- *Kein normales Ende im Körper:* Ein Mehrfach-Rahmen, in dem jeder Weg endet, bekommt trotzdem einen Ausgang, wenn N = 0 vorkommen kann; dann geht es ohne Stück vorbei. `ausgaengeBlock` zählt das ebenso.
- *Layout:* Die Markierung bekommt die Mitte der Unterkante ± 18 px (`RAHMEN.markeHalb`); Fehler-Randereignisse am äußersten Mehrfach-Rahmen liegen rechts davon, und `spaltenFuerRand` gibt dem Rahmen so viele innere Spalten, dass sie Platz haben. `geometrieFehler` prüft das.
- *Tokenspiel:* `TokenKnoten.mehrfach = { nacheinander, anzahl?, streuung? }`, aus dem XML nur `isSequential` und eine feste `loopCardinality`. Die Suche nimmt „ohne Stück“ nur, wenn N = 0 vorkommen kann (aus dem XML ohne Anzahl immer), und „ein Stück“, wenn N ≥ 1 vorkommen kann; „ohne Stück“ zählt nicht als Ausführung, so findet die Suche tote Schritte bei 0 Stücken. Nacheinander zählt die Instanz-Marke `Pfad|*` die offenen Stücke, das nächste beginnt in derselben Instanz; gleichzeitig bekommt jedes Stück eine Instanz, und weiter geht es nach der letzten. Ein Abbruch am Mehrfach-Rahmen leert alle Stücke derselben Aktivierung (`bereichVon`), „Abbruch zuletzt“ wartet auf alle.
- *Übergaben:* Für „fest“ werden die Stücke einzeln durchgerechnet (höchstens ⌊n⌋ + 1), für „schwankt“ geschlossen wie bei der Wiederholung; die Verteilung nimmt für „fest“ die Faltung durch Verdoppeln (O(log n) Faltungen).
- *Kennzahlen.schritte* hat einen Eintrag für den Baustein (Häufigkeit = erreicht, Beitrag = Liegezeit vor dem ersten Stück); „Wo die Zeit hingeht“ zeigt ihn als „Vor dem ersten Stück von „…““.
- *Umwandlungen:* Die Mengenschleife wird „für jedes Stück“ mit derselben Kennung; Name ist die Frage der Wiederholung ohne Fragezeichen. „beides“ → ODER bietet den Knopf nur bei genau drei Ausgängen „A“, „B“, „beides“ ohne Ende und Rücksprung; die Wege bekommen p_A + p_beides bzw. p_B + p_beides, „mindestens einer“, so dass beide genau mit p_beides laufen. Die Schritte im Ausgang „beides“ entfallen nach Rückfrage. Bei anderen Formen bleibt es beim Hinweis. Der Hinweis zur Rolle erscheint nur, wenn sie Aufgaben hat; sein Knopf öffnet die Beteiligten.
- *Oberfläche:* `ZweckWahl` zeigt „Mehrere Durchgänge“ nur, wenn es gesetzt ist (auch im Rücksprungbereich), sonst den Verweis auf den neuen Baustein. Ein Klick auf eine Aufgabe mit Markierung im Diagramm wählt die Aufgabe; der Baustein ist über die Gliederung erreichbar, Befunde des Bausteins markieren die Aufgabe.
- *Zufallsgenerator:* „für jedes Stück“ nimmt einen Teil des Anteils von „Warten“ (die übrigen Anteile bleiben); die Hälfte der Rahmen der Reihe nach bekommt am Ende eine Entscheidung mit Ende. In 300 Prozessen: 130 Bausteine in 95 Prozessen, 75 als Aufgabe mit Markierung, 57 gleichzeitig, 47 schwankend, 19 mit n < 1, 14 Fehler-Randereignisse an Mehrfach-Rahmen.

## 3 Unterbrechung (Randereignis)

**Datenmodell**

```ts
export type NachrichtZeitpunkt = 'vorher' | 'waehrend' | 'unbekannt'

/** Die Sequenz ist der Ausnahmeweg (wie bei EntscheidungsZweig). */
export interface Unterbrechung extends Sequenz {
  /** z. B. „Kunde storniert“, „Frist abgelaufen“ */
  bezeichnung: string
  art: WarteArt // 'nachricht' | 'zeit'
  /** nur bei Nachricht: externer Absender, sonst null */
  von: Id | null
  /** true: Die Arbeit am Schritt wird abgebrochen. false: Nebenweg, der Schritt läuft weiter. */
  unterbrechend: boolean
  /** unterbrechend: Anteil der Ausführungen des Schritts (0–1). Nebenweg: wie oft je Ausführung (≥ 0, auch > 1). */
  anteil: number
  /** nur Zeit: Frist in Minuten ab Eingang beim Schritt (Beginn der Liegezeit bzw. des Rahmens) */
  fristMin: number
  /** nur Nachricht an einer Aufgabe: wann sie meist kommt */
  zeitpunkt: NachrichtZeitpunkt
  /** nur unterbrechend: Ergebnis, wenn der Vorgang danach endet */
  ende: string | null
  /** nur unterbrechend: Rücksprungbereich; ende und zurueckZu null = weiter hinter dem Schritt */
  zurueckZu: Id | null
}

// Aufgabe.unterbrechungen?, Teilprozess.unterbrechungen?, Mehrfach.unterbrechungen?: Unterbrechung[]
```

**Bedeutung.**

- **Unterbrechend:** Die Ereignisse eines Schritts schließen sich aus. Jedes hat einen festen Anteil q_j der Ausführungen, zusammen höchstens 100 %; der Rest endet normal („normal: 85 %“). Die Anteile hängen nicht vom Weg im Schritt ab, deshalb bleiben die Häufigkeiten unabhängig von Zeiten. Das löst den Wettlauf mehrerer Ereignisse und die Frage, was eine Frist an einem Abschnitt mit schwankender Dauer bedeutet.
- **Zeitpunkt t_j ab Eingang beim Schritt:** Frist: t = `fristMin`; überschrittene Fälle dauern genau die Frist, es wird nichts gekürzt. Nachricht an einer Aufgabe mit Liegezeit L und Bearbeitung B: vorher L/2, während der Arbeit L + B/2, unbekannt (L + B)/2. Nachricht an einem Rahmen: nach der Hälfte der Dauer D dieses Durchlaufs, t = D/2.
- **Danach** (nur unterbrechend): weiter hinter dem Schritt (er bleibt unerledigt), noch einmal von vorn oder zurück zu einem früheren Schritt (Rücksprung), oder Prozess endet mit … (Ende je nach Ort).
- **Nebenweg** (nicht unterbrechend): Der Schritt läuft normal weiter, der Ausnahmeweg läuft nebenher und endet in einem eigenen Endereignis ohne Ergebnis. Er hat kein „Danach“; Ende und Rücksprung sind darin verboten. Annahme: Nebenwege verlängern weder den Vorgang noch einen Rahmen, in dem ihr Schritt liegt (in BPMN wartet ein Rahmen auf sie).

**BPMN.** `boundaryEvent` mit `attachedToRef` = Schritt, `cancelActivity` = unterbrechend, Definition `messageEventDefinition` oder `timerEventDefinition`; Frist und Anteil stehen in der Dokumentation („Frist 3 Arbeitstage ab Eingang, überschritten in 20 %“). Nachrichtenfluss vom Pool des Absenders zum Randereignis. Der Ausnahmeweg beginnt am Randereignis. „weiter“: eine exklusive Zusammenführung direkt hinter dem Schritt, in die der normale Ausgang und jeder „weiter“-Weg münden. Rücksprung über den Rücksprungbereich wie bei Entscheidungen. Nebenweg: eigenes Endereignis ohne Namen. Kein Nebenweg mündet in den Ablauf zurück, sonst liefe alles Folgende doppelt.

**Layout** (Block „Schritt mit Unterbrechungen“, gelegt wie eine Verzweigung):

- Spalte 0 ist der Schritt (Aufgabe oder Rahmen). Jeder Ausnahmeweg bekommt ab Spalte 1 ein eigenes Band unter dem Band des Schritts, gestapelt wie Zweige, auch in anderen Bahnen. Die Zusammenführung steht, falls nötig, in der Bahn des Schritts hinter dem breitesten Weg. Der normale Ausgang läuft gerade weiter.
- Randereignisse sitzen auf der Unterkante, von rechts nach links in der Reihenfolge ihrer Bänder (das oberste Band ganz rechts), Mittelpunkte 38 px auseinander; so schachteln sich die Abgänge ohne Kreuzung. An einer Aufgabe höchstens drei; an einem Rahmen so viele, wie neben der Mitte Platz haben, sonst bekommt der Rahmen am Ende leere Spalten. Die Fehler-Randereignisse für Enden im Rahmen (siehe „Ende je nach Ort“) werden genauso gelegt, als Ausnahmeweg ohne Schritte mit Ende.
- Abgang: Liegt das erste Element des Ausnahmewegs in der Bahn des Schritts, läuft der Fluss vom Kreis senkrecht nach unten in Spalte 0 bis zu dessen Höhe und dann waagerecht. Spalte 0 ist in den Bändern des Blocks frei; das ist die ausdrücklich erlaubte Ausnahme von „senkrecht nur in Lücken“. Sonst endet das senkrechte Stück in einer dünnen Abgangsspur unter dem Schritt, und der Höhenwechsel geschieht im Kanal der Lücke hinter dem Schritt.
- Nachricht zu einem Randereignis: vom Kreis unten links (45°) ein senkrechter Stummel nach unten (8 px plus 8 px je Randereignis links davon), waagerecht in die Lücke vor dem Schritt und dort im Kanal zum Pool. Alle waagerechten Stücke unter einem Schritt (Abgänge in der Abgangsspur, Nachrichten) bekommen getrennte Höhen im Abstand von 8 px (seit der abschließenden Prüfung 20 px, weil sie unter einem Rahmen über seine ganze Breite nebeneinander laufen). Eigene Nachrichten einer Aufgabe mit Randereignissen laufen über die Oberkante.
- Ein leerer „weiter“-Weg bekommt eine Spur wie ein leerer Zweig und mündet von unten in die Zusammenführung.

**Rechnung** für einen Schritt mit Häufigkeit f, unterbrechenden Ereignissen j (q_j, t_j, Ausnahmeweg A_j) und Nebenwegen k (c_k):

- Häufigkeit: Schritt f, auch wenn unterbrochen (zählt voll); Ausnahmeweg j f · q_j; Nebenweg k f · c_k (linear, auch über 1).
- Weiter hinter dem Block: f · [(1 − Σq_j) · c_S + Σ_{j mit weiter} q_j · weiter(A_j)], c_S = normales Ende des Schritts (bei einer Aufgabe 1). Rücksprung und Enden entsprechend aus den A_j; Enden im Körper eines Rahmens zählen nur mit (1 − Σq_j).
- Dauer einer Aufgabe: (1 − Σq_j) · δ(L + B) + Σ_j q_j · (δ(t_j) ∗ A_j), Erwartung (1 − Σq)(L + B) + Σ q_j (t_j + E[A_j]).
- Dauer eines Rahmens mit Körper K (Teilverteilungen W, E_r): normal (1 − Σq_j) · (W + ΣE_r); Frist q_j · (δ(t_j) ∗ A_j); Nachricht q_j · (½K ∗ A_j), wobei ½K jeden Wert der Verteilung von K halbiert.
- Nebenwege ändern die Dauer nicht (Annahme oben).
- Arbeit: Bearbeitung des Schritts bzw. des Körpers voll, dazu Σ_j q_j · Arbeit(A_j) und Σ_k c_k · Arbeit(Nebenweg k).
- TCT: dieselben Anteile; normal B bzw. TCT des Körpers, unterbrochen wie in den gemeinsamen Regeln, plus TCT(A_j).
- Übergaben: Schritt → erste Aufgabe des Ausnahmewegs mit f · q_j (beim Rahmen von dessen letzten Aufgaben aus), letzte Aufgabe eines „weiter“-Wegs → Nachfolger; Nebenweg: Schritt → erste Aufgabe mit f · c_k.
- Simulation: Ausgang würfeln (normal oder j nach q_j); beim Rahmen den Körper laufen lassen, um D zu kennen; Zeit nach den Regeln oben; Nebenwege ohne Zeit.

**Prüfregeln.**

- Fehler: Summe der unterbrechenden Anteile über 100 %; Anteil unter 0 oder (unterbrechend) über 100 %; Frist ≤ 0; mehr als drei Unterbrechungen an einer Aufgabe; Ende oder Rücksprung in einem Nebenweg, auch tiefer darin; `ende` und `zurueckZu` zugleich; Rücksprung ins Leere; bis Schritt 5 ein Ende im Ausnahmeweg eines Schritts in nebenläufiger Umgebung.
- Warnung: keine Bezeichnung; Frist an einer Aufgabe kürzer als L + B („würde in jedem Fall überschritten“); Frist an einem Rahmen, wenn laut den Zeiten im Rahmen P(D > Frist) größer ist als der angegebene Anteil („Laut den Zeiten im Abschnitt dauern 30 % der Fälle länger als die Frist, angegeben sind 10 %.“); Nebenweg ohne Schritte.
- Hinweis: Der Schritt läuft öfter als einmal je Vorgang (der Anteil gilt je Ausführung); unterbrechender Anteil 0 % („kommt nie vor“); Anteile zusammen 100 % („der Schritt endet nie normal“).

**Schwachstellen-Hinweise.** Häufig abgebrochen (zusammen ≥ 20 % der Ausführungen): „Viel abgebrochene Arbeit …“. Frist in ≥ 20 % überschritten: „Frist wird oft überschritten …“. Nebenweg dauert im Schnitt länger als sein Schritt: Die Annahme „verlängert nichts“ ist dann fraglich.

**Assistent.**

- Einstieg im Formular von Aufgabe, Abschnitt und Mehrfach: „Kann während dieses Schritts etwas dazwischenkommen? (z. B. Kunde storniert, Frist läuft ab)“ mit Knopf „+ Unterbrechung“; im Formular eines Schritts in „für jede Position“ zusätzlich „Gilt das für die ganze Liste?“ (dann am Mehrfach-Baustein).
- Fragen: „Was kommt dazwischen?“ (Pflicht) · „Eine Nachricht oder eine Frist?“ · bei Nachricht „Von wem?“ (Externe mit „+ Neu …“, oder von innerhalb); bei Frist „Nach welcher Frist, gerechnet ab Eingang bei <Rolle>?“ · „Wird die Arbeit daran dann abgebrochen?“ – ja / nein, sie läuft weiter und zusätzlich passiert etwas.
- Unterbrechend: „Wie oft kommt das vor? (in % der Ausführungen)“, bei Frist „Wie oft wird sie überschritten?“, darunter live „normal: 85 %“ und, wenn der Schritt öfter läuft, „bei Ø 2 Ausführungen etwa 19 % der Vorgänge“. Nachricht an einer Aufgabe: „Wann kommt sie meist?“ – bevor jemand anfängt / während der Arbeit / weiß nicht. Danach: „weiter mit dem nächsten Schritt („X“ bleibt unerledigt)“ / „„X“ noch einmal von vorn“ / „zurück zu …“ / „Prozess endet mit …“.
- Nebenweg: „Wie oft im Schnitt je Ausführung?“ (Zahl, auch über 1).
- „Gilt das nur für diesen Schritt oder für mehrere?“ – nur diesen / bis „…“ (fasst zu einem Abschnitt zusammen und fragt dessen Namen).
- Pflicht vor „Hinzufügen“ (`fehltNoch`): Bezeichnung; bei einer Frist eine Frist über 0; die unterbrechenden Anteile zusammen höchstens 100 %.
- Nach „Hinzufügen“ steht die Einfügeposition im Ausnahmeweg: „im Ausnahmeweg „Kunde storniert“ von „Ware kommissionieren““. „Abschnitt fertig“ führt hinter den Schritt.
- Gliederung: unter dem Schritt je Unterbrechung eine Zeile „⚡ Kunde storniert · 10 % · bricht ab · danach endet „storniert““ (Nebenweg: „· nebenher · 0,5-mal“), darunter der Ausnahmeweg. Lernhinweis „Unterbrechung“: Randereignis; durchgezogener Doppelkreis bricht ab, gestrichelter läuft nebenher.

**Tokenspiel.** Aufgabe mit unterbrechenden Randereignissen: Beim Schalten wird zwischen normalem Ausgang und Randereignis j gewählt (Suche: alle; Zählung: mit q_j). Rahmen: Die Wahl fällt, wenn die Instanz fertig ist oder nur noch Abbrüche anstehen; eine Unterbrechung geht einem Fehler-Ende im Körper vor. Nebenweg: beim Schalten der Aufgabe bzw. beim Start des Rahmens zusätzliche Marken auf dem Ausgang des Randereignisses (Suche: 0 oder 1; Zählung: N ∈ {⌊c⌋, ⌈c⌉} mit Mittel c).

**Tests (von Hand nachgerechnet).**

- Aufgabe „Ware kommissionieren“ L = 60, B = 30; „Kunde storniert“ 10 %, während der Arbeit (t = 75), danach endet „storniert“; Ausnahmeweg „Storno buchen“ 10 Min.: Dauer 0,9 · 90 + 0,1 · 85 = 89,5 Min.; weiter 0,9; Enden 90 % / 10 %; Arbeit 30 + 1 = 31 Min.; TCT 0,9 · 30 + 0,1 · (15 + 10) = 29,5 Min.
- Aufgabe L = 480, B = 60, Frist 1440 Min., überschritten in 20 %, danach weiter; Ausnahmeweg „Leitung informieren“ 15 Min.: Dauer 0,8 · 540 + 0,2 · 1455 = 723 Min.; weiter 1; Arbeit 63 Min.
- Nebenweg „Kunde fragt nach“ 0,5-mal je Ausführung, „Auskunft geben“ 5 Min.: Dauer unverändert, Häufigkeit 0,5, Arbeit + 2,5 Min.
- Abschnitt [A 30, B 30] mit Nachricht 10 % (t = D/2 = 30), danach endet: Dauer 0,9 · 60 + 0,1 · 30 = 57 Min.; Häufigkeit A und B je 1.
- Zwei unterbrechende Ereignisse 60 % und 50 %: Prüffehler; Tokenspiel und Prüfung stimmen auch für ungültige Zufallsprozesse überein.

**Umsetzung (Schritt 3, Stand 2026-11-11).** Gebaut wie oben, mit diesen Präzisierungen:

- *Ketten je Glied:* Ob eine Stelle in einem Rahmen oder nebenläufig liegt, entscheidet jetzt das Glied (Block und Kindsequenz), nicht der Block: `gliedRahmen` gilt nur für den Körper von Abschnitt und „für jedes Stück“, der Ausnahmeweg eines Rahmens liegt außerhalb; `gliedNebenlaeufig` ist für einen Ausnahmeweg genau dann wahr, wenn er ein Nebenweg ist (der Ausnahmeweg von „für jedes Stück, gleichzeitig“ ist nicht nebenläufig). `rahmenUeber`, `ruecksprungZiele`, `setzeRuecksprung` und die Prüfung nutzen das.
- *Anteile:* Ergeben die unterbrechenden Anteile mehr als 100 % (Prüffehler), rechnen Kennzahlen, Verteilung, Simulation und Tokenspiel sie anteilig gekürzt. Sie gelten je Ausführung, bei „für jedes Stück“ auch für Vorgänge ohne Stück (dann ist der Baustein sofort fertig, die Wahl fällt trotzdem). `unterbrechungsAnteile` und `unterbrechungsZeit` in `operationen.ts` sind die eine Stelle dafür.
- *TCT einer Frist am Rahmen:* E[min(t, TCT)] aus der Verteilung der Bearbeitungszeit des Durchlaufs; die Zeit bis zur Unterbrechung verteilt sich in „Wo die Zeit hingeht“ anteilig auf die Schritte des Rahmens (an einer Aufgabe: Bearbeitung min(B, max(0, t − L)), der Rest Liegezeit), so dass die Beiträge die Durchlaufzeit genau ergeben.
- *Übergaben:* Vor einem Ausnahmeweg oder Nebenweg eines Rahmens arbeitet dessen letzte Aufgabe (wie bei unterbrechenden Ereignissen), nicht der Vorgänger. Kontakte mit externen Beteiligten zählen eine Nachricht je eingetretener Unterbrechung. `Kennzahlen.haeufigkeiten` nennt, wie oft jede Stelle je Vorgang erreicht wird (auch Abschnitte und Unterbrechungen); das Formular zeigt damit „bei Ø 2 Ausführungen je Vorgang etwa 19 % der Vorgänge“ (1 − (1 − q)^h).
- *Prüfung:* Neue Schlüssel `usumme`, `uanteil`, `ufrist`, `uviele`, `nebenende` (Ende oder Rücksprung im Nebenweg, auch tiefer darin oder aus ihm heraus), `ubezeichnung`, `uleer`, `ufristkurz`, `ufristrahmen` (laut der Verteilung des Rahmens mehr als 0,5 Prozentpunkte öfter überschritten als angegeben), `unie`, `unormal`, `umehrmals` (strukturell: der Schritt liegt in einer Wiederholung oder in „für jedes Stück“). Abweichung von Schritt 1 und 2: **„Verklemmung“ nur noch bei „Gleichzeitig“** außerhalb des äußersten Rahmens. Ein Ende in einem ODER-Weg ist der Fehler `abbruch`, denn die inklusive Zusammenführung wartet nach der Regel der Norm nicht auf einen beendeten Weg; der Vorgang liefe im BPMN weiter. Aufgefallen ist das, weil der Zufallsgenerator mit `auchUngueltig` jetzt Enden in Ausnahmewegen innerhalb von ODER-Wegen erzeugt und das Tokenspiel sie als sound bestätigte.
- *Layout:* Der Block „Schritt mit Unterbrechungen“ (`layoutRandwege`) legt auch die Fehler-Randereignisse der Rahmen aus Schritt 1; ihre Diagramme bleiben gleich. Die Abgänge laufen über die allgemeine Linienführung: Ein Ersatzknoten in der letzten Spalte des Schritts steht auf der Höhe, auf der der Abgang waagerecht weiterläuft, davor kommt das senkrechte Stück vom Kreis. Die Abgangsspur entsteht nur, wenn ein Weg in einer anderen Bahn beginnt, ohne Schritte zurückspringt oder eine Nachricht zu einem Randereignis führt; sie trägt alle waagerechten Stücke unter dem Schritt (zuerst die Nachrichten, dann die Abgänge) im Abstand von 8 px (seit der abschließenden Prüfung 20 px) und wächst mit ihnen. Abweichung: Über die Abgangsspur steht das Ereignis mit dem höchsten Ziel ganz rechts (nicht die Reihenfolge der Bänder); nur so kreuzen sich Abgänge nach oben und nach unten nicht. An einer Aufgabe sitzt das rechte Ereignis 22 px vor der rechten Kante, damit drei auf 120 px passen. Der Name eines Randereignisses steht an seinem Abgang, gewählt wie die Beschriftung eines Flusses.
- *Tokenspiel:* Ein Nebenweg startet in einer eigenen Instanz `Pfad/Randereignis:n`, damit sich mehrere Nebenwege nicht mischen (sonst führte eine ODER-Zusammenführung darin zwei Läufe zusammen) und in Schleifen nie zwei Marken auf einem Fluss liegen. Die vollständige Suche schaltet Marken in Nebenwegen vorrangig: Sie teilen keinen Fluss mit dem übrigen Ablauf, ein Abbruch wartet ohnehin auf sie, also übersieht diese Reihenfolge keine Verklemmung; ohne sie wüchse der Zustandsraum mit jeder Schleife. Die Wahl am Rahmen bei einem anstehenden Abbruch nennt alle Rahmen mit Unterbrechungen zwischen dem Fehler-Ende und dem fangenden Rahmen, von innen nach außen, mit den Gewichten q · Π(1 − Σq der inneren Rahmen).
- *Oberfläche:* Die Gliederung zeigt statt „⚡“ das Symbol des Randereignisses (durchgezogen bzw. gestrichelt), passend zu den übrigen Symbolen. Die Fragen stehen im Formular aller drei Schritte, für neue wie bestehende; eine neue Aufgabe mit Unterbrechung führt nach „Hinzufügen“ in den ersten Ausnahmeweg, Abschnitt und „für jedes Stück“ wie bisher in den Körper. „Gilt für die ganze Liste“ und „Gilt für mehrere Schritte …“ sind Knöpfe im Formular bestehender Schritte (`verschiebeUnterbrechung`, `unterbrechungFuerAbschnitt`); ein Rücksprung der Unterbrechung entfällt beim Umhängen. „Abschnitt auflösen“ fragt nach, wenn der Abschnitt Unterbrechungen hat. Der Absender einer Nachricht lässt sich direkt im Formular als neuer externer Beteiligter anlegen.
- *Verbesserungsregeln:* „Zusammenlegen“ und die Knock-out-Reihenfolge lassen Aufgaben mit Unterbrechungen aus, „Gleichzeitig ausführen“ verlangt auch vom zweiten Schritt, dass er den Prozess nicht verlässt.
- *Zufallsgenerator:* Unterbrechungen kommen aus einem eigenen Zufallsstrom (Startwert · 7919 + 17), so dass der übrige Prozess für jeden Startwert gleich bleibt; in 300 Prozessen 432 Unterbrechungen in 138 Prozessen (151 an Aufgaben, 79 an Rahmen; 140 Nebenwege, 184 Fristen, 82 Nachrichten vom Kunden, 42 mit Ende, 33 mit Rücksprung).

## 4 Gleichzeitig: alle, erster, nacheinander

**Datenmodell**

```ts
export type ParallelArt = 'alle' | 'erster' | 'nacheinander'

export interface Parallel {
  typ: 'parallel'
  id: Id
  /** alle: weiter, wenn alle fertig sind; erster: weiter beim ersten, die übrigen werden abgebrochen; nacheinander: eine Person, Reihenfolge egal */
  art: ParallelArt
  zweige: Sequenz[]
}
```

Ein Feld statt zweier: „erster“ zusammen mit „nacheinander“ gibt es nicht. Jede Funktion über Gleichzeitig unterscheidet `art` erschöpfend, damit `dauerBlock` „erster“ nie still als Maximum rechnet.

**alle:** unverändert (paralleles Gateway auf und zu).

**erster** („sobald eins fertig ist; die anderen werden abgebrochen“):

- BPMN: Rahmen (`subProcess`, Name „Weiter beim ersten“), innen Start → paralleles Gateway → Zweige → jeder Zweig endet in einem Terminierungs-Endereignis. Nach BPMN 2.0 beendet der erste den Teilprozess und bricht die übrigen ab (Muster „Cancelling Discriminator“); außen geht es normal weiter. Kein komplexes Gateway.
- Bedeutung „die übrigen laufen trotzdem zu Ende“ wird nicht angeboten (Befund: Nachzügler halten Rahmen, ODER-Bereiche und Schleifen offen).
- Layout: Rahmen in einer Bahn, die Zweige darin gestapelt.
- Rechnung: Dauer = Minimum, F(t) = 1 − Π_i (1 − F_i(t)). Gewinner i mit P(i zuerst), Gleichstand: der frühere Zweig der Liste. Häufigkeit: alle Zweige voll. Übergaben: hinein zu jedem Zweig, heraus nur vom Gewinner (Gewicht P(i zuerst)). TCT: Minimum der Bearbeitungszeiten. Simulation: Minimum der Zweigläufe.
- Ab Schritt 5 mit Ende in einem Zweig: Es gewinnt, wer zuerst fertig ist oder abbricht (F_i ist dann die ganze Verteilung des Zweigs); die Gewinn-Wahrscheinlichkeiten stehen am Rahmen für das Tokenspiel.
- Hinweis bei gleich langen Zweigen: „Die Rechnung kennt nur Durchschnittszeiten und zeigt hier keinen Zeitgewinn. Der Gewinn liegt in den Fällen, in denen ein Zweig länger dauert als sonst.“
- Tokenspiel: Die Terminierung leert die Rahmen-Instanz; mit „Abbruch zuletzt“ laufen die übrigen Zweige vorher zu Ende (Häufigkeiten voll). In der Suche kann jede Terminierung die erste sein.

**nacheinander** („eine Person nacheinander, Reihenfolge egal“):

- BPMN: `adHocSubProcess` mit `ordering="Sequential"` und `completionCondition` „alle Zweige erledigt“ (seit der abschließenden Prüfung als einfacher Ausdruck in natürlicher Sprache, `tExpression`; ein `tFormalExpression` ohne Sprache wäre XPath), dazu eine Dokumentation. Je Zweig genau eine Aktivität ohne Sequenzfluss: Ein Zweig aus genau einer Aufgabe, einem Abschnitt oder einem Mehrfach-Baustein ohne Unterbrechungen bleibt, wie er ist; alles andere wird ein eingebetteter Teilprozess „Zweig n“ mit eigenem Start und Ende. Direkt im Ad-hoc-Rahmen stehen keine Start- und Endereignisse.
- Layout: Rahmen in einer Bahn; die Aktivitäten untereinander in der ersten Spalte des Rahmens (eingebettete Zweige sind selbst Rahmen); Ein- und Austritt auf Höhe der ersten Aktivität.
- Rechnung: wie eine Folge der Zweige in der Reihenfolge der Liste: Dauer = Summe, Häufigkeiten, Enden und Übergaben (vom letzten Schritt eines Zweigs zum ersten des nächsten) wie in einer Folge. Grenze: Die Reihenfolge der Liste ist eine Annahme.
- Enden in einem Zweig sind erlaubt (Fehler-Ende im eingebetteten Teilprozess, es steigt zum äußersten Rahmen auf); spätere Zweige laufen dann nicht. Rücksprünge nur innerhalb eines Zweigs.
- Tokenspiel: Rahmen-Knoten mit `adhoc` startet die Zweige einzeln, jeden genau einmal, und ist nach dem letzten fertig; Suche: jede Reihenfolge, Zählung: Reihenfolge der Liste.

**Prüfregeln** (alle Arten): mindestens zwei Zweige, kein leerer Zweig (Fehler); Rücksprung aus einem Zweig (Fehler); bis Schritt 5 Ende in einem Zweig von „alle“ oder „erster“ (Fehler). Hinweis „Gleichzeitig, aber dieselben Leute“ nur bei „alle“ und „erster“.

**Assistent.**

- Bausteinwahl: Der Knopf heißt „Mehrere Dinge unabhängig voneinander“ – „gleichzeitig, in beliebiger Reihenfolge oder bis eins fertig ist“ (Befund: „beliebige Reihenfolge“ widerspricht „Zweige laufen parallel“).
- Formular: „Wann geht es weiter?“ – wenn alle fertig sind (Vorgabe) / sobald eins fertig ist, die anderen werden abgebrochen. Nur bei „alle“: „Wer erledigt die Zweige?“ – zur selben Zeit (Vorgabe) / eine Person nacheinander, Reihenfolge egal. Bei „erster“ und „nacheinander“ der Satz zur Bahn des Rahmens. Die Abgrenzung zur Ereignis-Entscheidung steht als Hilfe darunter: „Hängt es davon ab, was von außen zuerst passiert (Antwort, Frist)? Dann ist es eine Entscheidung „was zuerst passiert“.“
- Titel nach Art: „Gleichzeitig (n Zweige)“, „Weiter beim ersten (n Zweige)“, „In beliebiger Reihenfolge (n Zweige)“; Ort „in Zweig 2 von „Weiter beim ersten““. Lernhinweise „erster“ (Teilprozess mit Terminierung je Zweig) und „nacheinander“ (Ad-hoc-Teilprozess mit Tilde).

**Tests (von Hand nachgerechnet).**

- erster: A 30 Min.; B Entscheidung 50 % 10 Min. / 50 % 50 Min.: Dauer 0,5 · 10 + 0,5 · 30 = 20 Min.; P(A zuerst) = 0,5; Arbeit 30 + 30 = 60 Min.; Gleichstand A 30, B 30: Dauer 30, Gewinner A.
- nacheinander: Zweige 20, 30, 40 Min.: Dauer 90 Min.; mit Ende im ersten Zweig in 20 %: Häufigkeit des zweiten und dritten 0,8.
- Export: `subProcess` mit drei `terminateEventDefinition`; `adHocSubProcess` mit `ordering` und `completionCondition`; bpmn-moddle ohne Warnung.

**Umsetzung (Schritt 4, Stand 2026-11-11).** Gebaut wie oben, mit diesen Präzisierungen:

- *Rahmen:* `istRahmen` gilt für Gleichzeitig mit Art „erster“ und „nacheinander“ (Typ `ParallelRahmen`), `rahmenInhalt` liefert dann die Zweige; `gliedRahmen`, `rahmenUeber`, `rahmenRolle`, die Rahmenbahn und die Prüfung „Rücksprung aus „…““ nutzen das. `gliedNebenlaeufig` ist für „erster“ wahr, für „nacheinander“ falsch. `ausgaengeBlock`: „erster“ geht weiter, wenn ein Zweig weiterkommt, „nacheinander“ nur, wenn jeder Zweig weiterkommt (im BPMN kann jeder Zweig der letzte sein).
- *Rechnung „erster“:* [`ersterAusgang`](../src/analyse/verteilung.ts) rechnet die Kombination schon allgemein, also auch mit Enden in den Zweigen: Zweig i gewinnt mit Ausgang o bei t mit d_{i,o}(t) · Π_{j<i} P(D_j > t) · Π_{j>i} P(D_j ≥ t), D_j die ganze Dauer von Zweig j. Bis Schritt 5 bleibt ein Ende darin trotzdem der Prüffehler `abbruch`; Schritt 5 muss für „erster“ nur den Fehler aufheben und das Tokenspiel beim Würfeln auch Fehler-Enden gewichten (siehe unten). `Kennzahlen.zuerstFertig` nennt je Zweig, wie oft er je Vorgang zuerst fertig ist; das Formular zeigt es je Zweig. Die Beiträge zur Durchlaufzeit sind die der Zweige, gewichtet mit P(i zuerst) und auf den exakten Erwartungswert umgerechnet. Übergaben heraus nimmt die letzten Aufgaben des Gewinners mit P(i zuerst); welcher Weg *im* Zweig dabei lief, kennt die Flussrechnung nicht (Näherung für die Paare, die Zahl der Übergaben ist exakt, solange ein Zweig in einer Rolle endet).
- *Hinweise:* „Kein Zeitgewinn in der Rechnung“ (`erstergleich`) erscheint, wenn die Dauer des Blocks nicht unter der mittleren Dauer des schnellsten Zweigs liegt, also bei gleich langen Zweigen und immer, wenn ein Zweig sicher gewinnt. Neu für „nacheinander“, weil die Reihenfolge der Liste eine Annahme ist: Hinweis `adhocreihe`, wenn ein Zweig vor dem letzten den Vorgang beenden kann, und Warnung `adhocende`, wenn er ihn immer beendet (die Zweige dahinter liefen laut Rechnung nie). „Gleichzeitig, aber dieselben Leute“ gilt nur für „alle“ und „erster“.
- *Layout „erster“:* `layoutRahmen` legt innen die Verzweigung (`layoutVerzweigung` ohne Zusammenführung); jede Terminierung steht in der Spalte hinter dem breitesten Zweig, auf der Hauptlinie ihres Zweigs, mit `terminierung` und `zuerst` (P(i zuerst), normal fertig) am Knoten. Der Rahmen hat kein inneres Ende; einen Ausgang hat er, sobald ein Zweig seine Terminierung erreicht.
- *Layout „nacheinander“:* `layoutAdhoc` stapelt je Zweig eine Aktivität ab Spalte 0 ([`einzelneAktivitaet`](../src/modell/operationen.ts) entscheidet, ob ein Zweig so bleibt); jeder andere Zweig wird ein gedachter Abschnitt mit der Kennung der Zweigfolge und dem Namen „Zweig n“, dessen Elemente auf den Gleichzeitig-Baustein zeigen (Klick im Diagramm). Der Rahmen hat weder Start noch Ende; einen Ausgang hat er, wenn jede Aktivität normal enden kann. `LayoutRahmen.aktivitaeten` nennt die Aktivitäten in Listenreihenfolge. Die Tilde in der Mitte der Unterkante bleibt wie die Mehrfach-Markierung frei (`hatMarke`).
- *Kanten in derselben Lücke:* Beginnt oder endet ein Rahmen in derselben Spalte wie ein Rahmen darin, liegt seine Kante je Ebene `RAHMEN_RAND.ebene` = 8 px weiter außen; Ersatzknoten, Randereignisse und die Kanalspuren in `linien.ts` rechnen den Versatz mit.
- *Zweigpfad:* Die Wege an den Randereignissen eines Schritts heißen im Zweigpfad jetzt `rand:<Schritt>`, damit sie sich bei „erster“ nicht mit den Zweigen innen mischen; `hinterRahmen` findet ihren Anfang am Schritt, den der Verzweigungen an der Raute bzw. am Ad-hoc-Rahmen.
- *Export:* Terminierung mit `terminateEventDefinition` und Dokumentation („Zweig 1 ist in 50 % der Fälle zuerst fertig; dann werden die übrigen Zweige abgebrochen“), Rahmenname „Weiter beim ersten“ bzw. „In beliebiger Reihenfolge“, beide mit Dokumentation; `adHocSubProcess` mit `ordering="Sequential"` und `completionCondition` nach den Flusselementen.
- *Tokenspiel:* Das Gewicht für „wer zuerst fertig ist“ steht am Endereignis (`TokenKnoten.gewicht`), nicht als Anteil am Fluss davor, denn der kann schon den Anteil einer Entscheidung oder eines Randereignisses tragen. Ein Ad-hoc-Rahmen (`TokenKnoten.adhoc`, die Aktivitäten) legt beim Start je Aktivität eine offene Marke `Pfad|?Aktivität` an; ist in der Instanz nichts mehr in Arbeit, beginnt eine davon über den gedachten Fluss `~Aktivität`. Behoben: Stehen mehrere Abbrüche einer Instanz zugleich an, bot „Abbruch zuletzt“ nur den ersten an (die Liste wuchs beim Prüfen mit); jetzt kann jeder der erste sein, auch in der verkürzten Suche. Die Zählung würfelt unter den Abbrüchen derselben Instanz nach dem Gewicht und zählt Endereignisse mit, so dass ein Test „wie oft zuerst fertig“ gegen `zuerstFertig` vergleicht. `graphAusXml` liest `adHocSubProcess` (nur `Sequential`) mit seinen Aktivitäten (alles darin ohne eingehenden Fluss außer Randereignissen).
- *Prüfung:* Ein Ende in einem Zweig von „erster“ ist bis Schritt 5 der Fehler `abbruch`, in einem Zweig von „nacheinander“ erlaubt (außer der Rahmen liegt in „Gleichzeitig“: dann `verklemmung`). Der Text zum Fehler `abbruch` in „Gleichzeitig“ schlägt „in beliebiger Reihenfolge“ vor.
- *Oberfläche:* Knopf „Mehrere Dinge unabhängig voneinander“; Formular mit „Wann geht es weiter?“ und nur bei „alle“ „Wer erledigt die Zweige?“, darunter die Abgrenzung zur Ereignis-Entscheidung und bei Rahmen der Satz zur Bahn (bei „nacheinander“ mit „Gerechnet wird in der Reihenfolge der Liste.“); Titel, Lernhinweis und Symbol (Rahmen mit Terminierungen bzw. mit Tilde) wechseln mit der Art. Gliederung: „die übrigen werden abgebrochen“ bzw. „eine Person, Reihenfolge egal“. Abzeichen im Diagramm sitzen am Rahmen des Bausteins, nicht an der Raute darin.
- *Zufallsgenerator:* Die Art kommt aus einem eigenen Zufallsstrom (Startwert · 104 729 + 31): 60 % alle, 20 % erster, 20 % nacheinander; Zweige von „nacheinander“ sind nicht nebenläufig, bekommen also auch Enden und Rücksprünge. Ungültig: ein leerer Zweig, ein Ende in einem Zweig von „erster“. In 300 Prozessen: 52-mal „erster“, 67-mal „nacheinander“ in 80 Prozessen, 107 eingebettete Zweige, 20 Entscheidungen mit Ende in Zweigen von „nacheinander“; mit `auchUngueltig` in 400 Prozessen 17 Enden in Zweigen von „erster“.

## 5 Abbruch in nebenläufiger Umgebung

- „Prozess endet mit …“ wird an jeder nebenläufigen Stelle erlaubt: in Zweigen von Gleichzeitig „alle“ und „erster“, in ODER-Wegen, im Körper von Mehrfach gleichzeitig, in Rahmen, die nebenläufig liegen, und in Ausnahmewegen solcher Schritte; nie in Nebenwegen. Formulartext: „Prozess endet sofort; was gleichzeitig läuft, wird abgebrochen.“ Der Prüffehler „Verklemmung“ für solche Enden entfällt, der für Rücksprünge bleibt.
- BPMN nach „Ende je nach Ort“: auf Prozessebene Terminierungs-Endereignis mit Ergebnis, im Rahmen Fehler-Ende mit Fehler-Randereignis am äußersten Rahmen und dahinter Terminierung.
- Rechnung mit der Abbruchkombination aus den gemeinsamen Regeln:
  - Gleichzeitig alle: Zweige unabhängig.
  - ODER, Wurf r_i je Weg, Z wie in Format 3: ohne Standardweg A(t) = [1 − Π(1 − r_i G_i(t))] / Z und W(t) = [Π(1 − r_i + r_i H_i(t)) − (1 − Z)] / Z; mit Standardweg s und q = Π(1 − r_i): A(t) = 1 − Π(1 − r_i G_i(t)) + q · G_s(t) und W(t) = Π(1 − r_i + r_i H_i(t)) − q + q · H_s(t); schließen sich die Wege aus, die Mischung Σ r_i · (Teile von i).
  - Mehrfach gleichzeitig: N gleiche Instanzen, Abbruch-Teil E[1 − (1 − G(t))^N], Weiter-Teil E[H(t)^N]; Ergebnis r mit Σ_t P(frühester Abbruch bei t) · g_r(t)/g(t).
  - erster: Es gewinnt, wer zuerst fertig ist oder abbricht.
  - Weiter ist das Produkt der Weiter-Massen (ODER: deren Mischung). Schritte hinter dem Block laufen mit dieser Masse; abgebrochene Zweige zählen voll.
- Simulation: Zeit = früheste Abbruchzeit (Gleichstand: früherer Zweig), sonst das Maximum; Ergebnis des Gewinners. TCT: dieselbe Kombination mit Bearbeitungszeiten (die Massen sind dieselben).
- Tokenspiel: „Abbruch zuletzt“; die Terminierung leert den Prozess.
- Nebenbei (Befund „Übergaben“): Bei ODER läuft der Vorgänger als letzte Aufgabe mit der Wahrscheinlichkeit durch, dass mindestens ein gewählter Weg ohne Aufgabe bleibt, nicht mit dem Maximum wie bei Gleichzeitig.
- Tests (von Hand): Zweig 1 A 10 Min., dann 30 % endet „abgelehnt“; Zweig 2 B 60 Min.: Dauer 0,3 · 10 + 0,7 · 60 = 45 Min.; weiter 0,7; Arbeit 70 Min. (B voll). Zwei Zweige je 10 Min., die mit 30 % bzw. 20 % enden: „abgelehnt A“ 0,3, „abgelehnt B“ 0,2 · 0,7 = 0,14, weiter 0,56, Dauer 10 Min. ODER ohne Standardweg mit A (70 %, 10 Min., danach endet in 50 %) und B (60 %, 40 Min.): Kombinationen nur A 0,4, nur B 0,3, beide 0,3 (Format 3); Dauer 0,4 · 10 + 0,3 · 40 + 0,3 · (0,5 · 10 + 0,5 · 40) = 23,5 Min.; Abbruch 0,4 · 0,5 + 0,3 · 0,5 = 0,35, weiter 0,65; die Formel A(10) = [1 − (1 − 0,5 · 0,5)] / Z mit r_A = 0,5 und Z = 0,3/0,42 ergibt ebenfalls 0,35.

**Umsetzung (Schritt 5, Stand 2026-11-11).** Gebaut wie oben, mit diesen Präzisierungen:

- *Prüfung:* Die Fehler `abbruch` und „Verklemmung“ für Enden entfallen; „Verklemmung“ heißt nur noch ein Rücksprung aus einer nebenläufigen Umgebung heraus. Ein Ende im Nebenweg (auch tiefer darin) bleibt der Fehler `nebenende`. [`ausgaengeBlock`](../src/modell/operationen.ts) sagt für ODER jetzt „weiter“, wenn eine mögliche Auswahl nur aus Wegen besteht, die weiterkommen (jeder Weg kann der einzige gewählte sein, außer ein Weg läuft immer); bisher verlangte es wie bei Gleichzeitig, dass jeder Weg weiterkommt, was nach „unerreichbaren Schritten“ hinter einer ODER-Verzweigung mit einem immer endenden Weg aussah.
- *Rechnung:* [`gleichlauf(teile, mischung)`](../src/analyse/verteilung.ts) rechnet die Abbruchkombination für Gleichzeitig „alle“ und ODER. Die `Mischung` ([`operationen.ts`](../src/modell/operationen.ts)) verknüpft die Wahrscheinlichkeiten je Teil: Gleichzeitig Π aᵢ, ODER Π(1 − rᵢ + rᵢaᵢ) − q + q·a_s mit Standardweg bzw. [Π(1 − rᵢ + rᵢaᵢ) − (1 − Z)] / Z ohne, Σ rᵢaᵢ, wenn sich die Wege ausschließen. Sie ist in jedem aᵢ linear; deshalb ist der Faktor ∂/∂aᵢ in der Ergebnisformel einfach mischung(a mit aᵢ = 1) − mischung(a mit aᵢ = 0), und Weg-Ziehung, Gleichstandsregel und „mindestens einer“ stecken in einer Funktion. Rücksprünge aus solchen Teilen (nur in ungültigen Modellen) zählen wie Abbrüche. „Für jedes Stück“ zur selben Zeit rechnet `stueckeGleichzeitig` mit φ(a) = E[a^N; N ≥ 1]: Weiter-Teil φ(H(t)), Abbruch bei t mit φ(1 − G(t⁻)) − φ(1 − G(t)), auf die Ergebnisse nach ihrem Anteil bei t verteilt (die Stücke sind gleichartig, welches gewinnt, ist gleich). „Weiter beim ersten“ blieb, wie es war (`ersterAusgang` rechnete Enden schon).
- *Fluss und Übergaben:* `flussGleichlauf` in [`kennzahlen.ts`](../src/analyse/kennzahlen.ts): Jeder Teil läuft mit seinem Zufluss ganz (abgebrochene Arbeit zählt voll), weiter geht es mit mischung(c), die Enden kommen aus der Kombination (also aus den Zeiten). Letzte Aufgaben: Aufgabe x, mit der Teil i in εᵢ seiner Läufe normal endet, zählt mit mischung(c, aᵢ = εᵢ) − mischung(c, aᵢ = 0); ein Vorgänger läuft durch mit mischung(c) − mischung(c − q), wobei qᵢ (Teil i ohne Aufgabe und normal fertig) über einen eigenen Schlüssel in der Flussrechnung gemessen wird. Das ist die Korrektur der ODER-Übergaben (vorher das Maximum über die Wege) und gilt ebenso für Gleichzeitig; dort ändert sich nur etwas, wenn mehr als ein Zweig ohne Aufgabe bleiben kann. „Für jedes Stück“ zur selben Zeit nimmt die Ergebnisanteile aus `verteilungMehrfach` statt anteilig.
- *Dauer und TCT:* gesamt = Erwartung über alle Teile der Kombination, weiter = Masse des Weiter-Teils, TCT dieselbe Kombination mit Bearbeitungszeiten. Simulation: `gemeinsam()` nimmt den frühesten Abbruch (Gleichstand: der frühere Teil), sonst das Maximum.
- *Numerik:* `ordne` verwirft nur noch Rundungsrauschen (Massen unter 10⁻¹⁴, vorher 10⁻⁹), und `geometrisch` nimmt den Rest der Reihe als Punkt mit exakter Masse q^{k+1}/(1 − q) und exaktem Mittel auf. Vorher fehlten bei tief verschachtelten Schleifen bis zu 1,5 · 10⁻⁵ der Masse (Zufallsprozess 199); jetzt bleibt die Masse der Teilverteilungen 1.
- *Layout und Export:* Der Layout-Kontext kennt `nebenlaeufig` (Zweige von Gleichzeitig und ODER, Nebenwege); `endeArt` legt das Ende je nach Ort: im Rahmen ein Fehler-Ende, auf Prozessebene neben gleichzeitig laufenden Schritten eine Terminierung mit dem Ergebnis als Namen und der Dokumentation „Beendet den ganzen Vorgang mit diesem Ergebnis; was gleichzeitig läuft, wird abgebrochen“, sonst ein gewöhnliches Ende. Hinter dem Fehler-Randereignis des äußersten Rahmens steht eine Terminierung, wenn der Rahmen nebenläufig liegt. Gleichzeitig mit einem Zweig, der den Vorgang immer beendet, bekommt keine Zusammenführung (sie ließe den Ablauf sonst zu früh weiterlaufen); die übrigen Zweige enden mit einem Ende ohne Ergebnis („Dieser Zweig ist fertig; der Vorgang endet in einem anderen Zweig“). ODER, aus dem kein Weg weiterkommt, hat keine Zusammenführung; kommt nur ein Weg weiter, hat sie einen Eingang.
- *Tokenspiel:* Gateways tragen ihre Richtung (`richtung`, aus dem Layout und aus `gatewayDirection` im XML), damit eine ODER-Zusammenführung mit einem Eingang eine Zusammenführung bleibt. Die Zählung bekommt vier Regeln, die BPMN alle als Reihenfolge erlaubt: (1) **Uhren** ([`Zeitangaben`](../src/bpmn/tokenspiel.ts), aus dem Modell über [`tokenZeiten`](../src/testhilfen/tokenzeiten.ts)): Jede Marke trägt die Zeit, zu der sie ihren Fluss erreicht; eine Terminierung in einem Rahmen setzt dessen Ende auf ihre Zeit. (2) **Welcher Abbruch schaltet** (`waehleAbbruch`): In seinem Bereich gewinnt der zeitlich erste aller Abbrüche, deren Marke darin liegt; ein Gewinner, dessen Marke nicht im Bereich eines anderen liegt, wohl aber dieser in seinem, schaltet vorher (abgebrochene Arbeit zählt voll, z. B. „weiter beim ersten“ in einem anderen Zweig von Gleichzeitig). Bei Gleichstand entscheidet in verschiedenen Stücken derselben Mehrfachinstanz die Nummer des Stücks, sonst die Stelle des Endes in Lesereihenfolge (der frühere Zweig). Damit ersetzt die Uhr das Gewicht `zuerst` am Endereignis; es steht nur noch in der Dokumentation. (3) **Unterbrechungen auf dem Weg eines Abbruchs** würfelt `RahmenWahl` einmal je Ausführung des Rahmens, wenn es zum ersten Mal darauf ankommt (Ende der Instanz oder ein Abbruch darin), und eine Unterbrechung schaltet dann sofort. (4) **ODER-Zusammenführung:** Sie schaltet nicht, solange in ihren Wegen eine Marke auf einen Abbruch zuläuft (`oderAufgeschoben`, in Suche und Zählung; die Verzweigung kennt sie aus dem Layout bzw. über die Kennungen `…_auf`/`…_zu` im XML). BPMN erlaubt diese Reihenfolge; ohne sie liefe nach „Abbruch zuletzt“ eine Schleife um die Verzweigung weiter, während der Abbruch wartet, und fünf der 300 Zufallsprozesse sprengten den Zustandsraum. Endereignisse werden mitgezählt, die Tests vergleichen auch die Ergebnisanteile.
- *Schwachstellen:* `abbruchzweig` ab 20 % vorzeitigen Abbrüchen in Gleichzeitig, ODER oder bei Stücken zur selben Zeit: „Arbeit in gleichzeitig laufenden Zweigen wird oft umsonst getan“, mit dem Vorschlag, die Prüfung vorzuziehen (Knock-out zuerst); im Diagramm „Arbeit umsonst“.
- *Oberfläche:* An nebenläufigen Stellen heißt die Option „Prozess endet sofort; was gleichzeitig läuft, wird abgebrochen“ (Entscheidung und Unterbrechung), im Nebenweg fehlt sie (`Ort.imNebenweg`, `FormularKontext.imNebenweg`). Neuer Lernhinweis „Prozess endet sofort“ (Terminierungs-Endereignis; der Blitz im Rahmen als Ausstieg, kein technischer Fehler) mit Symbol „dicker Kreis mit gefülltem Punkt“; der Lernhinweis „Gleichzeitig“ sagt das jetzt auch. Die Gliederung schreibt „endet sofort“. Rücksprünge innerhalb eines Zweigs bietet das Formular weiterhin nicht an, obwohl Modell und Prüfung sie erlauben.
- *Zufallsgenerator:* Enden neben gleichzeitig laufenden Schritten aus einem eigenen Zufallsstrom (Startwert · 7 368 787 + 13): Ausgänge nebenläufiger Entscheidungen (außer dem ersten) enden in 25 %, der Körper von Stücken zur selben Zeit bekommt in 40 % eine Abbruch-Entscheidung, Zweige von „erster“ in 35 % und „alle“ in 30 %; Unterbrechungen enden auch neben Gleichzeitigem (eigener Strom · 6 700 417 + 5). In 300 Prozessen haben 103 ein solches Ende (99 in Gleichzeitig, 80 in ODER-Wegen, 34 in „erster“, 20 bei Stücken zur selben Zeit, 33 nach Unterbrechungen), mit 200 Terminierungen auf der Prozessebene. Prozesse ohne Nebenläufigkeit bleiben, wie sie waren.
- *Tests:* [`src/analyse/abbruch.test.ts`](../src/analyse/abbruch.test.ts) mit den Beispielen oben (48,5 Min. mit Schritt danach, Gleichstand 0,3/0,14/0,56, TCT 20 statt 60, Übergaben 3,4, ODER 23,5 und 25 Min., Übergaben 0,575 statt 0,35, Stücke 23 Min. und 0,19, „erster“ mit Ende 0,2 und 24 Min.), dazu Simulation, Tokenspiel mit Ergebnisanteilen, Export und 40 Zufallsprozesse mit Abbruch; eine einmalige Probe mit allen 226 Abbruch-Prozessen unter den Startwerten 1 bis 600 lief ohne Befund.

## Reihenfolge der Umsetzung

Jeder Schritt ist erst fertig, wenn alles aus Regel 9 des Auftrags gebaut ist (Typen und Bausteine, Operationen, Speichern und Migration, Prüfregeln, Kennzahlen, Verteilung und Simulation, Layout und Linien, Export mit DI, Tokenspiel auf Layout und XML, Schwachstellen-Hinweise, Oberfläche mit Bausteinwahl, Formular, Symbol, Lernhinweis, Gliederung und Führung, Zufallsgenerator, Browsertest, Doku), die Prüfungen grün sind und mindestens ein Beispiel mit `render.mjs` angesehen wurde. Danach Commit und Push auf `modellierung` und ein Eintrag in [modellierung-stand.md](modellierung-stand.md).

1. **Teilprozess** mit den gemeinsamen Grundlagen: Format 4 und Migration, Kindsequenzen und Ketten-Prädikate, Rahmen im Layout (Anker, Bahnzwang, Seitenkanten, Bahnwechsel neben Rahmen), `subProcess` mit DI, Ende im Rahmen (nicht nebenläufig), Tokenspiel mit Bereichen, Fehler-Ende, „Abbruch zuletzt“ und der ODER-Regel der Norm, `graphAusXml` rekursiv, Teilverteilungen mit Ende-Teil, neue Zeichenregeln in `geometrieFehler`.
2. **Für jede Position**, mit den Umwandlungshinweisen; die Wiederholung bietet „Mehrere Durchgänge“ nicht mehr an.
3. **Unterbrechung** an Aufgabe, Abschnitt und Mehrfach, mit Ausnahmeweg, Nebenweg und „gilt für mehrere Schritte“.
4. **Gleichzeitig-Arten**: „erster“ (Terminierung im Rahmen), „nacheinander“ (Ad-hoc-Teilprozess).
5. **Abbruch** in nebenläufiger Umgebung mit der Abbruchkombination; dazu die Korrektur der ODER-Übergaben.

Die Abbruchregeln wachsen mit: Ab Schritt 1 gilt ein Ende im Rahmen, ab Schritt 2 im Körper von Mehrfach nacheinander, ab Schritt 3 im Ausnahmeweg, ab Schritt 4 in Zweigen von „nacheinander“, ab Schritt 5 überall außer in Nebenwegen. Bis dahin meldet die Prüfung die übrigen Fälle als Fehler, wie heute bei Gleichzeitig.

Zufallsgenerator: Jeder Schritt fügt seine Form in `zufallsprozess.ts` ein, auch die ungültigen Varianten für `auchUngueltig` (z. B. Ende im Nebenweg, Anteile über 100 %). Damit das Tokenspiel klein bleibt, wie bei ODER nur in den oberen Ebenen und mit begrenzter Tiefe von Rahmen.

## Befunde der Design-Prüfung

| Befund | Lösung |
| --- | --- |
| Terminierung beendet nur die eigene Ebene (bpmn, hoch) | Ende je nach Ort |
| Regel für Ende und Rücksprung: ODER-Wege und Nebenwege fehlen (bpmn, hoch) | `nebenlaeufig(kette)`, Ende je nach Ort, Rücksprung |
| Nicht unterbrechendes Randereignis verdoppelt Marken oder verklemmt (bpmn, hoch) | Nebenweg mit eigenem Ende, ohne „weiter“ (3) |
| Weiter beim ersten: Nachzügler (bpmn, hoch) | abbrechende Variante als Rahmen mit Terminierung (4) |
| ODER ohne Standardzweig nicht eingebbar (bpmn, mittel) | in Format 3 gelöst („mindestens einer“) |
| Rahmen: Grenze, Geometrie, XML-Aufbau (bpmn, mittel) | Rahmen, Zeichenregeln, Abschnitt 1 |
| Nachrichtenflüsse in Spaltenlücken (bpmn, mittel) | in Format 3 gelöst (Kanäle); Rahmen dürfen senkrecht gequert werden |
| Ad-hoc nimmt Zweige nicht unverändert auf (bpmn, mittel) | je Zweig eine Aktivität, `ordering`, `completionCondition` (4) |
| Tokenspiel: inklusive Zusammenführung, Verzweigung (bpmn, mittel) | Regel der Norm; Verzweigung in Format 3 gelöst |
| Randereignisse ohne Platz im Layout (bpmn, mittel) | Layout in Abschnitt 3 |
| `von` nur bei Nachrichten (bpmn, niedrig) | in Format 3 gelöst; gilt auch für `Unterbrechung.von` |
| „Für jede Position“ doppelt neben der Mengenschleife (bpmn, niedrig) | Bausteinwahl und Umwandlungshinweis (2) |
| ODER „mindestens einer“ (Rechnung, hoch) | in Format 3 gelöst |
| Abbruch in gleichzeitigen Zweigen: Formeln (Rechnung, hoch) | Abbruchkombination (gemeinsame Regeln, 5) |
| „Beendet alles“ im Rahmen (Rechnung, hoch) | Ende je nach Ort |
| Unterbrechung: Anteil und Zeitpunkt (Rechnung, hoch) | feste Anteile, t je Art, Frist ohne Kürzung (3). Abweichung vom Vorschlag: Auch am Rahmen gilt der angegebene Anteil statt P(D > t), weil sonst die Häufigkeiten von Zeiten abhingen und ein Rahmen ohne Verzweigung nie oder immer überschritte; eine Warnung zeigt, wenn die Zeiten im Rahmen etwas anderes sagen |
| Nicht unterbrechender Ausnahmeweg (Rechnung, hoch) | Nebenweg, Annahme in den Grenzen (3) |
| Weiter beim ersten hält Rahmen und Schleifen offen (Rechnung, hoch) | abbrechende Variante (4) |
| Mehrfach: Liegezeit je Stück, kleinste Streuung (Rechnung, mittel) | `liegezeitMin` einmal, `streuung` fest oder schwankt (2) |
| Mehrfach: Formeln nur bei normalem Ende (Rechnung, mittel) | K und E[c^N] (2), gleichzeitig ab 5 |
| Mehrere Unterbrechungen: Wettlauf (Rechnung, mittel) | sich ausschließende feste Anteile (3) |
| Häufigkeiten hängen von Zeiten ab (Rechnung, mittel) | „abgebrochene Arbeit zählt voll“, feste Anteile; Gewinner bei „erster“ als Anteil am Element |
| Übergaben je Form (Rechnung, mittel) | je Abschnitt unter „Rechnung“; ODER-Korrektur in 5 |
| Tokenspiel: Austritt aus Rahmen, Ad-hoc (Rechnung, niedrig) | Instanz fertig, wenn leer; Ad-hoc-Knoten (4) |
| ODER als Kombinationen abfragen (Bedienung, hoch) | nicht übernommen: Format 3 fragt Häufigkeiten je Weg mit Summenzeile und „mindestens einer“ |
| Externe: wo anlegen, Notlösung „Rolle Kunde“ (Bedienung, hoch) | in Format 3 gelöst; Hinweis „Als externen Beteiligten führen?“ (2) |
| Fragen, Einstiege, Führung fehlen (Bedienung, hoch) | „Assistent“ je Form; `fragenkatalog.md` wird je Schritt ergänzt |
| Mehrfach: Liegezeit, „gleichzeitig“ missverstanden (Bedienung, hoch) | Fragen und Live-Anzeigen (2) |
| Unterbrechung: Zeitpunkt in Minuten (Bedienung, hoch) | Frist ab Eingang, Nachricht „wann meist“ (3) |
| Ausnahmeweg nicht erreichbar, „danach weiter“ mehrdeutig (Bedienung, hoch) | `Unterbrechung extends Sequenz`, Danach-Auswahl (3) |
| Ende und Abbruch in parallelen Umgebungen (Bedienung, hoch) | eine Option, der Ort entscheidet (Ende je nach Ort, 5) |
| Unterbrechung: Bezug, mehrere, Häufigkeit (Bedienung, mittel) | je Ausführung mit Live-Anzeige je Vorgang, auch an Mehrfach, Nebenweg auch über 1 (3) |
| Zwei Wege für dieselbe Sache (Bedienung, mittel) | Umwandlungshinweise (2) |
| „Erster“ und „beliebige Reihenfolge“ als Varianten (Bedienung, mittel) | Fragen im Formular, neuer Knopftext (4) |
| Teilprozess als Baustein, Rahmen in einer Bahn (Bedienung, mittel) | eigener Baustein nach Vorgabe, Bahnregel, Hinweis, Auflösen nur ausdrücklich (1) |
| Reihenfolge der Umsetzung (Bedienung, mittel) | vorgegebene Reihenfolge, Abbruchregeln wachsen je Schritt mit; die Bedienprobe mit einer Person ohne BPMN-Kenntnis bleibt für Robin offen |

## Grenzen (für die README)

- Arbeit, die ein Abbruch, eine Unterbrechung oder „weiter beim ersten“ abschneidet, zählt voll (obere Schranke).
- Unterbrechungen haben feste Anteile je Ausführung des Schritts, unabhängig vom Weg darin. Nachrichten an Abschnitten unterbrechen nach der halben Dauer.
- Nebenwege (nicht unterbrechende Ereignisse) verlängern die Durchlaufzeit nicht, auch nicht die eines Abschnitts.
- „Weiter beim ersten“ bricht die übrigen Zweige ab; dass sie trotzdem zu Ende laufen, lässt sich nicht abbilden.
- „In beliebiger Reihenfolge“ rechnet in der Reihenfolge der Liste.
- Rahmen (Abschnitte, Listen, „erster“, „beliebige Reihenfolge“) liegen in einer Bahn; Schritte anderer Rollen tragen die Rolle in Klammern.
- Teilprozesse sind immer aufgeklappt; zugeklappte mit eigener Ansicht gibt es nicht.
