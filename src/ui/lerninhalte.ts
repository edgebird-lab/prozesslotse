import type { SymbolArt } from './Symbol'

export interface Lerninhalt {
  titel: string
  /** Name des BPMN-Elements. */
  bpmn: string
  symbol: SymbolArt
  text: string
}

export type LernThema =
  | 'rahmen'
  | 'beteiligte'
  | 'aufgabe'
  | 'entscheidung'
  | 'parallel'
  | 'wiederholung'
  | 'warten'
  | 'pruefen'
  | 'verbessern'

export const LERNINHALTE: Record<LernThema, Lerninhalt> = {
  rahmen: {
    titel: 'Start und Ende',
    bpmn: 'Startereignis und Endereignis',
    symbol: 'start-nachricht',
    text: 'Jeder Prozess beginnt mit einem Auslöser, im Diagramm ein dünner Kreis. Das Symbol darin zeigt die Art: Brief für eine Nachricht, Uhr für einen Zeitpunkt, Blatt für eine Bedingung. Das Ergebnis am Ende ist ein dicker Kreis.',
  },
  beteiligte: {
    titel: 'Bahnen und Aufgabentypen',
    bpmn: 'Pool, Lanes, Benutzeraufgabe, manuelle Aufgabe',
    symbol: 'bahn',
    text: 'Der ganze Prozess ist ein Pool. Jede Rolle bekommt darin eine eigene Bahn (Lane); so sieht man, wer was tut und wo der Vorgang den Schreibtisch wechselt. Aufgaben mit IT-System werden als Benutzeraufgabe gezeichnet (Personensymbol), Aufgaben auf Papier oder am Telefon als manuelle Aufgabe (Handsymbol).',
  },
  aufgabe: {
    titel: 'Aufgabe',
    bpmn: 'Task',
    symbol: 'aufgabe',
    text: 'Ein Arbeitsschritt einer Rolle, gezeichnet als abgerundetes Rechteck. Benenne ihn mit Objekt und Verb, z. B. „Rechnung prüfen“. Die Liegezeit davor ist die Zeit, in der der Vorgang wartet, bis jemand anfängt; sie ist meist viel länger als die Bearbeitung.',
  },
  entscheidung: {
    titel: 'Entscheidung',
    bpmn: 'Exklusives Gateway (XOR)',
    symbol: 'xor',
    text: 'Eine Raute mit X: Genau ein Ausgang wird genommen. Die Anteile sagen, wie oft welcher Fall vorkommt, und ergeben zusammen 100 %. Hinter den Ausgängen führt eine zweite Raute die Wege wieder zusammen, außer ein Ausgang beendet den Prozess.',
  },
  parallel: {
    titel: 'Gleichzeitig',
    bpmn: 'Paralleles Gateway (AND)',
    symbol: 'und',
    text: 'Eine Raute mit Plus: Alle Zweige laufen gleichzeitig los. Weiter geht es erst, wenn alle fertig sind; die Dauer bestimmt der längste Zweig. Deshalb darf ein Zweig hier den Prozess nicht beenden, sonst würde die Zusammenführung ewig warten.',
  },
  wiederholung: {
    titel: 'Wiederholung',
    bpmn: 'Schleife aus zwei exklusiven Gateways',
    symbol: 'wiederholung',
    text: 'Die Schritte laufen mindestens einmal. Danach entscheidet eine Frage, ob sie wiederholt werden. Bei 20 % Wiederholung laufen sie im Schnitt 1 / (1 − 0,2) = 1,25-mal. Typisch für Nacharbeit nach einer Prüfung.',
  },
  warten: {
    titel: 'Warten',
    bpmn: 'Zwischenereignis',
    symbol: 'warten-zeit',
    text: 'Ein doppelter Kreis: Der Vorgang wartet auf einen Zeitpunkt (Uhr) oder auf eine Nachricht von außen (Brief), z. B. auf eine Lieferung. Niemand arbeitet in dieser Zeit, aber sie zählt zur Durchlaufzeit.',
  },
  pruefen: {
    titel: 'Was die Zahlen bedeuten',
    bpmn: 'Prozesskennzahlen',
    symbol: 'aufgabe',
    text: 'Die Durchlaufzeit ist der Erwartungswert über alle Wege. Die Flusseffizienz zeigt, welcher Anteil davon echte Arbeit ist. Offene Vorgänge folgen aus dem Gesetz von Little: Vorgänge pro Tag mal Durchlaufzeit in Tagen. Ab etwa 85 % Auslastung staut sich Arbeit, weil jede Schwankung sofort Wartezeit erzeugt.',
  },
  verbessern: {
    titel: 'Woher die Vorschläge kommen',
    bpmn: 'Redesign-Heuristiken',
    symbol: 'und',
    text: 'Die Vorschläge folgen bekannten Regeln der Prozessverbesserung: unabhängige Schritte gleichzeitig ausführen, Schritte einer Rolle zusammenlegen, Kontrollen mit wenig Nutzen streichen, Fehler an der Quelle vermeiden, Daten nicht abtippen. Die Wirkung ist nicht geschätzt, sondern mit denselben Formeln neu berechnet.',
  },
}
