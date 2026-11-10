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
  | 'ereignis'
  | 'ruecksprung'
  | 'parallel'
  | 'oder'
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
    text: 'Eine Raute mit X: Genau ein Ausgang wird genommen. Die Anteile sagen, wie oft welcher Fall vorkommt, und ergeben zusammen 100 %. Hinter den Ausgängen führt eine zweite Raute die Wege wieder zusammen. Ein Ausgang kann den Prozess auch beenden oder zu einem früheren Schritt zurückführen.',
  },
  ereignis: {
    titel: 'Was zuerst passiert',
    bpmn: 'Ereignisbasiertes Gateway',
    symbol: 'ereignisgateway',
    text: 'Eine Raute mit Fünfeck im Doppelkreis: Der Vorgang wartet, bis eines von mehreren Ereignissen eintritt, z. B. eine Antwort des Kunden oder das Ende einer Frist. Es geht in dem Ausgang weiter, dessen Ereignis zuerst kommt. Im Diagramm beginnt jeder Ausgang mit seinem Ereignis.',
  },
  ruecksprung: {
    titel: 'Zurück zu einem früheren Schritt',
    bpmn: 'Schleife über ein exklusives Gateway',
    symbol: 'ruecksprung',
    text: 'Führt ein Ausgang zurück, z. B. nach einer Korrektur zurück zur Erfassung, entsteht eine Schleife: Eine Raute vor dem Zielschritt führt den Rückweg mit dem normalen Weg zusammen. Der Bereich dazwischen läuft so oft, wie zurückgesprungen wird.',
  },
  parallel: {
    titel: 'Gleichzeitig',
    bpmn: 'Paralleles Gateway (AND)',
    symbol: 'und',
    text: 'Eine Raute mit Plus: Alle Zweige laufen gleichzeitig los. Weiter geht es erst, wenn alle fertig sind; die Dauer bestimmt der längste Zweig. Deshalb darf ein Zweig hier den Prozess nicht beenden, sonst würde die Zusammenführung ewig warten.',
  },
  oder: {
    titel: 'Mehrere Wege möglich',
    bpmn: 'Inklusives Gateway (ODER)',
    symbol: 'oder',
    text: 'Eine Raute mit Kreis: Je nach Fall laufen einer, mehrere oder alle Wege, z. B. welche Unterlagen nachgefordert werden. Jeder Weg hat einen eigenen Anteil: Wie oft kommt er vor, unabhängig von den anderen? Weiter geht es, wenn alle gewählten Wege fertig sind. Der Weg für „keiner davon“ läuft nur, wenn keiner der anderen zutrifft; im Diagramm trägt er einen Querstrich (Standardfluss).',
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
    symbol: 'kennzahl',
    text: 'Die Durchlaufzeit ist der Erwartungswert über alle Wege. Die Flusseffizienz zeigt, welcher Anteil davon echte Arbeit ist. Die Vorgänge in Arbeit folgen aus dem Gesetz von Little: Vorgänge pro Tag mal Durchlaufzeit in Tagen. Je voller eine Rolle ausgelastet ist, desto stärker staut sich Arbeit, weil jede Schwankung sofort Wartezeit erzeugt. Eine einzelne Person ist ab etwa 80 % am Limit, ein Team erst später (Warteschlangenmodell M/M/c).',
  },
  verbessern: {
    titel: 'Woher die Vorschläge kommen',
    bpmn: 'Redesign-Heuristiken',
    symbol: 'verbessern',
    text: 'Die Vorschläge folgen bekannten Regeln der Prozessverbesserung: unabhängige Schritte gleichzeitig ausführen, Schritte einer Rolle zusammenlegen, Kontrollen mit wenig Nutzen streichen, Fehler an der Quelle vermeiden, Daten nicht abtippen. Die Wirkung ist nicht geschätzt, sondern mit denselben Formeln neu berechnet.',
  },
}
