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

## Erledigt

- [x] Externe Beteiligte als Pools mit Nachrichtenflüssen, ODER-Verzweigung (Format 3, schon auf main)
- [x] Design Format 4 festgelegt: [modellierung-v4.md](modellierung-v4.md), alle 36 Befunde der Design-Prüfung eingearbeitet (Commit „Doku: Design für Format 4 …“ auf `modellierung`)

## Schritt 1 – Teilprozess, mit den gemeinsamen Grundlagen

- [ ] `FORMAT_VERSION = 4`, Migration 3 → 4 (`Parallel.art = 'alle'`), Test mit einer Format-3-Datei
- [ ] Typen `Teilprozess`, `ParallelArt = 'alle'`; `neuerTeilprozess`; `pruefeBlock`
- [ ] `kinderSequenzen`, `durchlaufe`, `abbildeBlock`, `findeSequenz` und alle Nutzer; erschöpfende `switch`
- [ ] Ketten-Prädikate `nebenlaeufig(kette)` und `rahmenUeber(kette)` statt `liegtInParallele`; `ruecksprungZiele`, `setzeRuecksprung`, Prüfung „Rücksprung aus einem Rahmen“
- [ ] `fasseZusammen` und „Abschnitt auflösen“
- [ ] Prüfregeln (leer, Name, Rollen-Hinweis, Ende an nebenläufiger Stelle bis Schritt 5)
- [ ] Kennzahlen wie eine Folge; `verteilung.ts` mit Ende-Teil (Teilverteilungen W, R, E); Simulation
- [ ] Layout: `Teil.anker`, `bahnZwang`, `LayoutRahmen`, Kopf- und Fußspur, Seitenkanten, Bahnwechsel neben Rahmen, `spalteFrei` mit Rahmen, Namen „(Rolle)“
- [ ] Export: `subProcess` mit `isExpanded`, Start und Ende innen, `flowNodeRef` nur für den Rahmen; Ende im Rahmen als Fehler-Ende mit `bpmn:error` und Fehler-Randereignis am äußersten Rahmen
- [ ] Tokenspiel: Bereiche, Instanz-Marken, Fehler-Ende, „Abbruch zuletzt“, inklusive Zusammenführung nach der Norm (ersetzt `bereich`); `graphAusXml` rekursiv; Vergleich XML = Layout mit Bereichen
- [ ] `geometrieFehler`: Rahmen nur verschachtelt, kein Sequenzfluss über Rahmengrenzen, keine Linie auf Rahmenkanten, Rahmenbeschriftungen
- [ ] Zufallsgenerator: Abschnitte (auch verschachtelt, mit Ende innen an nicht nebenläufiger Stelle)
- [ ] Oberfläche: Bausteinwahl „Ein Abschnitt mit Namen“, Formular mit Bahnsatz, Symbol, Lernhinweis, Gliederung, Ort, „Ab hier zusammenfassen …“, Führung
- [ ] Tests von Hand (Design, Abschnitt 1), Browsertest, Diagramm angesehen
- [ ] Doku: `datenmodell.md` (Baustein, Zeichenregeln), `fragenkatalog.md`, README
- [ ] Commit und Push

## Schritt 2 – Für jede Position

- [ ] Typ `Mehrfach`, `neuerMehrfach`, `pruefeBlock`; Ziehung von N (fest, schwankt) an einer Stelle für alle Nutzer
- [ ] Operationen, Rücksprungziele (nicht aus dem Körper heraus), Führung („je Stück in …“)
- [ ] Prüfregeln (leer, n < 0, schwankt mit n < 1, Liegezeit < 0, Ende bei gleichzeitig bis Schritt 5, Hinweis n < 1)
- [ ] Kennzahlen: K, E[c^N], Liegezeit einmal, Übergaben; Verteilung (Faltung bzw. E[F^N]); Simulation; TCT
- [ ] Layout: Aufgabe mit Markierung oder Rahmen mit freier Mitte der Unterkante
- [ ] Export: `multiInstanceLoopCharacteristics`, `loopCardinality` nur ganzzahlig und fest, Dokumentation
- [ ] Tokenspiel: Mehrfach-Rahmen (Suche 0 oder 1 Instanz, Zählung N nach Verteilung)
- [ ] Schwachstellen: „Gleichzeitig, aber zu wenig Leute“, Liegezeit des Bausteins
- [ ] Umwandlungshinweise: Mengenschleife → Mehrfach (exakt gleiche Zahlen), „beides“ → ODER, Rolle „Kunde“ → Externer; „Mehrere Durchgänge“ nicht mehr für neue Wiederholungen
- [ ] Zufallsgenerator, Oberfläche (Bausteinwahl, Formular mit Live-Anzeigen, Symbol, Lernhinweis, Gliederung), Tests von Hand, Browsertest, Diagramm angesehen, Doku
- [ ] Commit und Push

## Schritt 3 – Unterbrechung

- [ ] Typ `Unterbrechung extends Sequenz`, optionale `unterbrechungen` an Aufgabe, Teilprozess, Mehrfach; `pruefeBlock`, `entferneFremdeAbsender`
- [ ] Operationen: Kindsequenzen, Rücksprung aus dem Ausnahmeweg (`zurueckZu`), `normalisiere`, `ausgaengeBlock`, `verlaesstBlock`, Führung („im Ausnahmeweg … von …“)
- [ ] Prüfregeln (Summe > 100 %, Frist, Nebenweg ohne Ende und Rücksprung, höchstens drei an einer Aufgabe, Hinweise)
- [ ] Kennzahlen, Verteilung (Aufgabe und Rahmen, ½K), Simulation, TCT, Übergaben
- [ ] Layout: Block „Schritt mit Unterbrechungen“, Randereignisse auf der Unterkante, Abgang, Abgangsspur, Nachrichten zu Randereignissen, Zusammenführung für „weiter“; Fehler-Randereignisse aus Schritt 1 nach demselben Muster
- [ ] Export: `boundaryEvent` (message, timer), Nachrichtenfluss zum Randereignis, Nebenweg mit eigenem Ende
- [ ] Tokenspiel: Wahl an Aufgabe und Rahmen, Nebenweg-Marken
- [ ] Schwachstellen: viel abgebrochene Arbeit, Frist oft überschritten, Nebenweg länger als sein Schritt
- [ ] Zufallsgenerator (auch ungültige Varianten), Oberfläche (Einstieg im Formular, Fragen, „gilt für mehrere“, Danach, Gliederungszeile, Lernhinweis), Tests von Hand, Browsertest, Diagramm angesehen, Doku
- [ ] Commit und Push

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
- Annahmen, die in die README-Grenzen kommen: abgebrochene Arbeit zählt voll; Nebenwege verlängern nichts; Unterbrechungen mit festen Anteilen; „in beliebiger Reihenfolge“ in Listenreihenfolge.

## Testzahlen

| Stand | Unit-Tests | Browsertests |
| --- | --- | --- |
| Ausgang (Commit 2fac3a3) und Design-Commit | 127 in 17 Dateien | 17 |
