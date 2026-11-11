# Stand der Modellierung (Format 4)

Übergabe für jeden, der hier weitermacht: erst diese Datei lesen, dann das Design [modellierung-v4.md](modellierung-v4.md). Nach jedem fertigen Schritt die Häkchen setzen, den Commit eintragen und die Testzahlen nachführen.

- Arbeitskopie `C:\Users\Robin\Projekte\Apps\prozesslotse-modell`, Zweig `modellierung`, Push mit `git push -u origin modellierung`. Nicht nach `main` mergen, nichts veröffentlichen; das Repo bleibt privat.
- Nicht anfassen: `prozesslotse` (Zweig main, E2E-Port 4173) und `prozesslotse-compliance` (Zweig compliance, Port 4175).

## Regeln für jeden Schritt

1. **Zeichenregeln** aus `datenmodell.md` und dem Design: Jeder Fluss eine eigene Linie, keine geteilte Strecke, kein geteilter Anschluss, keine Linie durch fremde Knoten oder auf einer Rahmenkante, kein Sequenzfluss über eine Rahmengrenze, Beschriftungen frei. Neue Regeln kommen in `geometrieFehler`, jede neue Form in `zufallsprozess.ts`; die 300 Zufallsprozesse bleiben ohne Befund.
2. **BPMN-Korrektheit:** bpmn-moddle ohne Warnungen; Tokenspiel sound auf dem Layout-Graph und auf dem Graph aus dem XML; Häufigkeiten aus dem Tokenspiel = Formeln; Formel-Dauer = Simulation (Toleranz vier Standardfehler plus 0,5 %).
3. **Werte in Tests von Hand nachrechnen** (Beispiele stehen im Design bei jeder Form).
4. **Vor jedem Commit grün:** `npm run lint`, `npx tsc -b`, `npm test`, `npm run build`, `PL_PORT=4176 npx playwright test`.
5. **Dateiformat:** `FORMAT_VERSION` wird nur in Schritt 1 auf 4 gesetzt, mit Migration 3 → 4; alte Dateien laden unverändert.
6. Oberfläche, Doku, Bezeichner und Commits auf Deutsch; jede Commit-Nachricht endet mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
7. **Diagramme ansehen:** `node C:\Users\Robin\AppData\Local\Temp\claude\2827d1680c0a081d\20159d77-8dab-4ce3-8759-1692f787eb67\scratchpad\render.mjs <datei.bpmn>` (Umgebungsvariablen `SKALA`, `CLIP=x,y,b,h`, `NAME`), das PNG mit dem Read-Werkzeug ansehen; bei jeder neuen Form mindestens ein Beispiel. Fehlt das Skript, ein gleichwertiges mit bpmn-js und Playwright anlegen.
8. Recherche nur kurz und gezielt.
9. Laufen nachts andere Agenten gleichzeitig ihre Tests (dutzende node- und Edge-Prozesse), scheitern Browsertests an der 30-s-Grenze. Dann mit `PL_PORT=4176 npx playwright test --workers=3` wiederholen; das ist kein Fehler im Code.

## Erledigt

- [x] Externe Beteiligte als Pools mit Nachrichtenflüssen, ODER-Verzweigung (Format 3, schon auf main)
- [x] Design Format 4 festgelegt: [modellierung-v4.md](modellierung-v4.md), alle 36 Befunde der Design-Prüfung eingearbeitet (Commit „Doku: Design für Format 4 …“ auf `modellierung`)

## Schritt 1 – Teilprozess, mit den gemeinsamen Grundlagen

Fertig am 2026-11-11, Commit 37363b9 „Abschnitt mit Namen (aufgeklappter Teilprozess), Dateiformat 4“ auf `modellierung`. Präzisierungen gegenüber dem Entwurf stehen in [modellierung-v4.md](modellierung-v4.md) unter „Umsetzung (Schritt 1)“.

- [x] `FORMAT_VERSION = 4`, Migration 3 → 4 (`Parallel.art = 'alle'`), Test mit einer Format-3-Datei (gleiches Projekt, gleiche Kennzahlen, BPMN beider Beispiele per Prüfsumme gleich dem Stand von Format 3)
- [x] Typen `Teilprozess`, `ParallelArt = 'alle'`; `neuerTeilprozess`; `pruefeBlock`
- [x] `kinderSequenzen`, `durchlaufe`, `abbildeBlock`, `findeSequenz` und alle Nutzer; erschöpfende `switch` mit `unerwartet(x: never)` in `typen.ts`, auch über `Parallel.art` in Kennzahlen, Verteilung, Simulation, Layout und `gliedNebenlaeufig`
- [x] Ketten-Prädikate `nebenlaeufig(kette)` und `rahmenUeber(kette)` statt `liegtInParallele` (`Fundstelle.kette`, `SequenzFundstelle.kette`, `Glied`); `ruecksprungZiele`, `setzeRuecksprung`, Prüfung „Rücksprung aus einem Abschnitt“ (`rahmenrueck`)
- [x] `fasseZusammen` (mit `kannZusammenfassen`: kein Rücksprung aus dem neuen Rahmen hinaus) und `loeseAbschnittAuf`
- [x] Prüfregeln: leerer Abschnitt (Fehler), ohne Namen (Warnung), mehrere Rollen (Hinweis mit Bahn), Ende im Abschnitt an nebenläufiger Stelle (Fehler „Verklemmung“, bis Schritt 5)
- [x] Kennzahlen wie eine Folge; `verteilung.ts` mit `Teilverteilungen` (W, R, E), die Entscheidung legt ihre Enden ab; Simulation
- [x] Layout: `Teil.anker` je Bahn, `bahnZwang`, `LayoutRahmen` in `Layout.rahmen`, Kopf- und Fußspur, Seitenkanten, Bahnwechsel neben Rahmen (`hinterRahmen`, Runden in `berechneLayout`), `spalteFrei` mit Rahmen, Namen „(Rolle)“, Fehler-Randereignisse auf der Unterkante mit eigenem Band je Ergebnis
- [x] Export: `subProcess` mit `isExpanded`, Start und Ende innen, `flowNodeRef` nur für Elemente der Prozessebene; Ende im Rahmen als Fehler-Ende mit `bpmn:error` (`errorCode` = Ergebnis) und Fehler-Randereignis am äußersten Rahmen
- [x] Tokenspiel: Bereiche, Instanz-Marken (`Pfad|Fluss`, `Pfad|*`), Fehler-Ende, Terminierung, „Abbruch zuletzt“, inklusive Zusammenführung nach der Norm (`bereich` und `ergaenzeOderBereiche` entfallen); `graphAusXml` rekursiv; Vergleich XML = Layout mit Rahmen, Enden und Randereignissen
- [x] `geometrieFehler`: Rahmen nur verschachtelt, Knoten mit 6 px Abstand im eigenen Rahmen und an keinem fremden, kein Sequenzfluss über Rahmengrenzen, keine Linie auf Rahmenkanten, Randereignis auf der Unterkante, Rahmen in der Bahn, Rahmenbeschriftungen (auch in `beschriftungenAufLinien`)
- [x] Zufallsgenerator: Abschnitte (auch verschachtelt, mit Ende innen an nicht nebenläufiger Stelle; mit `auchUngueltig` auch leer)
- [x] Oberfläche: Bausteinwahl „Ein Abschnitt mit Namen“, Formular mit Bahnsatz und „Abschnitt auflösen“, Symbol, Lernhinweis, Gliederung, Ort, „Ab hier zusammenfassen …“, Führung
- [x] Tests von Hand (Design, Abschnitt 1: 47 Min., 36 Min., Bahnwechsel hinter dem Rahmen), Browsertests (`e2e/abschnitt.spec.ts`), Diagramme mit `render.mjs` angesehen (einfacher, verschachtelter Abschnitt, Bahnwechsel, zwei Zufallsprozesse)
- [x] Doku: `datenmodell.md` (Baustein, Format 4, Prüfregeln, Zeichenregeln für Rahmen), `fragenkatalog.md`, README (Bausteine, BPMN, Linien, Qualität, Grenzen)
- [x] Commit und Push

Hinweise für Schritt 2 und später:

- `berechneLayout` legt so lange neu, bis kein Sequenzfluss mehr einen fremden Rahmen quert; `hinterRahmen` liefert dafür Mindest-Startspalten (`Kontext.schub`). Neue Rahmenarten müssen ihre Knoten und Rahmen über `merkeZweig` mit dem Zweigpfad versehen, sonst greift das Rücken nicht.
- Randereignisse sind Knoten mit `art: 'rand'` und `wirt`; ihre Lage rechnet `layoutRunde` aus dem Rahmen (rechts beginnend, 38 px Abstand). Für Unterbrechungen an Aufgaben (Schritt 3) muss das auf Aufgaben als Wirt erweitert werden.
- Das Tokenspiel kennt Randereignisse bisher nur als Fänger von Fehlern; Wahl an Aufgabe und Rahmen (Schritt 3) und Mehrfach-Instanzen (Schritt 2, Instanznummer im Pfad) fehlen noch.
- Kein Rücksprung quert eine Rahmengrenze; `layoutTeilprozess` verwirft solche Sprünge (nur in ungültigen Dateien möglich).

## Schritt 2 – Für jede Position

Fertig am 2026-11-11, Commit 1d799c0 „Für jedes Stück einer Liste (Mehrfachinstanz) mit Umwandlungshinweisen“ auf `modellierung`, dazu daea105 (Anzahl auf 10.000 begrenzt). Präzisierungen gegenüber dem Entwurf stehen in [modellierung-v4.md](modellierung-v4.md) unter „Umsetzung (Schritt 2)“.

- [x] Typ `Mehrfach`, `neuerMehrfach`, `pruefeBlock`; Ziehung von N (fest, schwankt) an einer Stelle für alle Nutzer (`src/modell/anzahl.ts`)
- [x] Operationen, Rücksprungziele (nicht aus dem Körper heraus), Führung („je Stück in …“); `istRahmen` gilt für Mehrfach, `alsMarkierteAufgabe` entscheidet Aufgabe oder Rahmen
- [x] Prüfregeln (leer, n < 0, schwankt mit n < 1, n = 0 als Fehler, Liegezeit < 0, Ende bei gleichzeitig als `abbruch` bis Schritt 5, Hinweis n < 1, Rollen im Rahmen)
- [x] Kennzahlen: K, E[c^N], Liegezeit einmal, Übergaben; Verteilung (Faltung durch Verdoppeln bzw. E[F^N]); Simulation; TCT
- [x] Layout: Aufgabe mit Markierung oder Rahmen mit freier Mitte der Unterkante (leere Spalten, wenn die Randereignisse sonst nicht passen)
- [x] Export: `multiInstanceLoopCharacteristics`, `loopCardinality` nur ganzzahlig und fest, Dokumentation; `graphAusXml` liest die Markierung
- [x] Tokenspiel: Mehrfach an Aktivität und Rahmen (Suche 0 oder 1 Stück nach der Verteilung, Zählung N nach Verteilung, Abbruch leert alle Stücke)
- [x] Schwachstellen: „Gleichzeitig, aber zu wenig Leute“, Liegezeit des Bausteins
- [x] Umwandlungshinweise: Mengenschleife → Mehrfach (exakt gleiche Zahlen), „beides“ → ODER, Rolle „Kunde“ → Externer; „Mehrere Durchgänge“ nicht mehr für neue Wiederholungen
- [x] Zufallsgenerator, Oberfläche (Bausteinwahl, Formular mit Live-Anzeigen, Symbol, Lernhinweis, Gliederung, Knöpfe „Umwandeln“ und „Zu den Beteiligten“), Tests von Hand (`src/analyse/mehrfach.test.ts`), Browsertests (`e2e/mehrfach.spec.ts`), Diagramme mit `render.mjs` angesehen (Aufgabe mit Markierung, Rahmen mit Ende, gleichzeitig im Zweig, in einem Abschnitt, sechs Ergebnisse, zwei Zufallsprozesse), Doku
- [x] Commit und Push

Hinweise für Schritt 3 und später:

- `alsMarkierteAufgabe` muss mit den Unterbrechungen zusätzlich verlangen, dass weder die Aufgabe noch der Baustein welche hat (sonst Rahmen).
- Randereignisse an Mehrfach-Rahmen lassen die Mitte frei (`RAHMEN.markeHalb`, `spaltenFuerRand` in `layout.ts`); Unterbrechungen am Mehrfach-Rahmen können dieselbe Rechnung nutzen.
- Tokenspiel: Ein unterbrechendes Randereignis am Mehrfach-Rahmen muss wie das Fehler-Randereignis alle Stücke leeren; `bereichVon` liefert diesen Bereich.
- Schritt 5 ersetzt in `verteilungMehrfach` (Fall „gleichzeitig“) und in `flussMehrfach` die anteilige Rechnung für Enden durch die Abbruchkombination (Abbruch-Teil E[1 − (1 − G(t))^N], Weiter-Teil E[H(t)^N]) und hebt den Prüffehler `abbruch` auf; die Simulation nimmt dann den frühesten Abbruch.

## Schritt 3 – Unterbrechung

Fertig am 2026-11-11, Commits 5d73e28 „Unterbrechungen (Randereignisse): Modell, Rechnung, BPMN und Tokenspiel“ und „Unterbrechungen: Oberfläche, Browsertests und Doku“ auf `modellierung`. Präzisierungen gegenüber dem Entwurf stehen in [modellierung-v4.md](modellierung-v4.md) unter „Umsetzung (Schritt 3)“.

- [x] Typ `Unterbrechung extends Sequenz`, optionale `unterbrechungen` an Aufgabe, Teilprozess, Mehrfach; `pruefeBlock`, `entferneFremdeAbsender`
- [x] Operationen: Kindsequenzen, Ketten-Prädikate je Glied (`gliedRahmen`, `gliedNebenlaeufig`), Rücksprung aus dem Ausnahmeweg (`zurueckZu`, auch „noch einmal von vorn“), `normalisiere`, `ausgaengeBlock`, `verlaesstBlock`, `verschiebeUnterbrechung`, `unterbrechungFuerAbschnitt`, Führung („im Ausnahmeweg … von …“, „im Nebenweg …“)
- [x] Prüfregeln (Summe > 100 %, Anteil, Frist, Nebenweg ohne Ende und Rücksprung, höchstens drei an einer Aufgabe, Fristen gegen die Zeiten, Hinweise); „Verklemmung“ nur noch bei „Gleichzeitig“
- [x] Kennzahlen, Verteilung (Aufgabe und Rahmen, ½K), Simulation, TCT, Übergaben, Kontakte
- [x] Layout: Block „Schritt mit Unterbrechungen“, Randereignisse auf der Unterkante, Abgang, Abgangsspur, Nachrichten zu Randereignissen, Zusammenführung für „weiter“; Fehler-Randereignisse aus Schritt 1 nach demselben Muster
- [x] Export: `boundaryEvent` (message, timer), Nachrichtenfluss zum Randereignis, Nebenweg mit eigenem Ende
- [x] Tokenspiel: Wahl an Aufgabe und Rahmen (auch vor einem Fehler-Ende im Körper), Nebenwege als eigene Instanzen, vorrangig geschaltet
- [x] Schwachstellen: viel abgebrochene Arbeit, Frist oft überschritten, Nebenweg länger als sein Schritt
- [x] Zufallsgenerator (eigener Zufallsstrom, auch ungültige Varianten), Oberfläche (Einstieg im Formular, Fragen, „gilt für die ganze Liste“, „gilt für mehrere“, Danach, Gliederungszeile, Lernhinweis, Symbole), Tests von Hand (`src/analyse/unterbrechung.test.ts`), Browsertests (`e2e/unterbrechung.spec.ts`), Diagramme mit `render.mjs` angesehen (Aufgabe mit drei Randereignissen in drei Bahnen, Abschnitt mit Ende und zwei Unterbrechungen, „für jedes Stück“ mit Nebenweg, „von vorn“, Weg nach oben, drei Zufallsprozesse), Doku
- [x] Commit und Push

Hinweise für Schritt 4 und später:

- Ein Ausnahmeweg ist eine Kindsequenz wie ein Zweig. Neue Bausteine mit Kindsequenzen müssen in `gliedNebenlaeufig` und `gliedRahmen` sagen, ob ihre Kindsequenz nebenläufig bzw. im Rahmen liegt; Ketten-Prädikate nie über `istRahmen(block)` allein entscheiden.
- „Weiter beim ersten“ und „in beliebiger Reihenfolge“ sind Rahmen: `layoutRahmen` liefert die Fehler, `layoutRandwege` legt Randereignisse dafür und für Unterbrechungen; `spaltenFuerRand` sorgt für Platz. Der Ad-hoc-Rahmen braucht für seine Zweig-Teilprozesse ebenfalls `merkeZweig`.
- Tokenspiel: Die Wahl an einem Rahmen fällt in `moeglichkeiten` beim Abschluss der Instanz (`art: 'schritt'`); Abbrüche tragen eine Liste `folgen` (Unterbrechungen der Rahmen auf dem Weg, dann der Abbruch). Eine Terminierung im Rahmen (Schritt 4) läuft über dieselbe Stelle (`abbruch`).
- Schritt 5: Ein Ende im Ausnahmeweg eines Schritts in nebenläufiger Umgebung ist bis dahin `verklemmung` (Gleichzeitig) bzw. `abbruch` (ODER, Stücke zur selben Zeit); `flussMitUnterbrechungen` zählt Enden im Körper eines Rahmens nur mit dem normalen Anteil, das bleibt so.

## Schritt 4 – Gleichzeitig: erster und nacheinander

- [ ] `ParallelArt` um `'erster' | 'nacheinander'` erweitern; erschöpfende Unterscheidung überall
- [ ] erster: Rahmen mit Terminierung je Zweig, Minimum, P(i zuerst) am Element, Übergaben vom Gewinner, Hinweis bei gleich langen Zweigen
- [ ] nacheinander: Ad-hoc-Rahmen mit `ordering` und `completionCondition`, „Zweig n“-Teilprozesse, Rechnung als Folge in Listenreihenfolge, Ende im Zweig erlaubt
- [ ] Tokenspiel: Terminierung im Rahmen, Ad-hoc-Knoten
- [ ] Oberfläche: Knopf „Mehrere Dinge unabhängig voneinander“, zwei Fragen, Titel nach Art, Lernhinweise; Zufallsgenerator, Tests von Hand, Browsertest, Diagramm angesehen, Doku
- [ ] Commit und Push

## Schritt 5 – Abbruch in nebenläufiger Umgebung

- [ ] „Prozess endet“ an nebenläufigen Stellen erlauben (außer Nebenweg), Formulartext, Prüfregel „Verklemmung“ nur noch für Rücksprünge
- [ ] Export: Terminierung auf Prozessebene, Fehler-Ende mit Terminierung hinter dem Randereignis
- [ ] Abbruchkombination für Gleichzeitig, ODER (mit und ohne Standardweg), Mehrfach gleichzeitig, erster; Ergebnisanteile mit Gleichstandsregel; Simulation (frühester Abbruch)
- [ ] Korrektur ODER-Übergaben (Vorgänger läuft nur über leere gewählte Wege durch)
- [ ] Zufallsgenerator, Tests von Hand, Browsertest, Diagramm angesehen, README-Grenzen vollständig
- [ ] Commit und Push

## Offen für Robin

- Bedienprobe: Eine Person ohne BPMN-Kenntnis bildet drei Fälle ab (Kunde schickt Unterlagen; Ausweis und/oder Nachweis fehlt; je Position kommissionieren); danach die Texte anpassen.
- Bewusst nicht übernommen: ODER als Kombinationen abfragen (Format 3 fragt Häufigkeiten je Weg), „übrige Zweige laufen zu Ende“ bei „weiter beim ersten“, zugeklappte Teilprozesse.
- Annahmen, die in die README-Grenzen kommen: abgebrochene Arbeit zählt voll; „in beliebiger Reihenfolge“ in Listenreihenfolge. (Nebenwege verlängern nichts und Unterbrechungen mit festen Anteilen stehen seit Schritt 3 in den Grenzen.)
- Abweichungen aus Schritt 3 abnehmen (Details in modellierung-v4.md, „Umsetzung (Schritt 3)“): „Verklemmung“ nur noch bei „Gleichzeitig“, ein Ende in einem ODER-Weg ist der Fehler „Ende neben gleichzeitig laufenden Schritten“; Gliederung mit Symbol statt „⚡“; über die Abgangsspur steht das höchste Ziel ganz rechts; Nebenwege beginnen bei Übergaben an der letzten Aufgabe eines Rahmens; der Anteil einer Unterbrechung an „für jedes Stück“ gilt auch für Vorgänge ohne Stück.

## Testzahlen

| Stand | Unit-Tests | Browsertests |
| --- | --- | --- |
| Ausgang (Commit 2fac3a3) und Design-Commit | 127 in 17 Dateien | 17 |
| Schritt 1, Abschnitt (Commit 37363b9) | 151 in 18 Dateien | 19 |
| Schritt 2, für jedes Stück (Commit 1d799c0) | 178 in 19 Dateien | 21 |
| Schritt 3, Unterbrechung (Commits 5d73e28 und Oberfläche) | 210 in 20 Dateien | 23 |
