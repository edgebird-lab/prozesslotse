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
  | 'extern'
  | 'aufgabe'
  | 'entscheidung'
  | 'ereignis'
  | 'ruecksprung'
  | 'parallel'
  | 'erster'
  | 'nacheinander'
  | 'oder'
  | 'wiederholung'
  | 'warten'
  | 'teilprozess'
  | 'mehrfach'
  | 'unterbrechung'
  | 'abbruch'
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
  extern: {
    titel: 'Externe Beteiligte',
    bpmn: 'Pool (Black Box) und Nachrichtenfluss',
    symbol: 'bahn',
    text: 'Wer nicht zu eurer Organisation gehört, etwa der Kunde, bekommt einen eigenen Pool. Zwischen Pools gibt es keine Sequenzflüsse, sondern gestrichelte Nachrichtenflüsse: Eine Aufgabe schickt etwas hinüber, ein Ereignis wartet auf die Antwort. Was im Pool des Kunden passiert, bleibt bewusst offen.',
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
    text: 'Eine Raute mit Plus: Alle Zweige laufen gleichzeitig los. Weiter geht es erst, wenn alle fertig sind; die Dauer bestimmt der längste Zweig. Beendet ein Zweig den Prozess, wird abgebrochen, was in den anderen Zweigen noch läuft (im Diagramm ein dicker Kreis mit gefülltem Punkt).',
  },
  erster: {
    titel: 'Weiter beim ersten',
    bpmn: 'Teilprozess mit Terminierungs-Endereignissen',
    symbol: 'erster',
    text: 'Mehrere Dinge laufen gleichzeitig los, z. B. Anfragen bei zwei Lieferanten. Sobald eins fertig ist, geht es weiter, und die übrigen werden abgebrochen. Im Diagramm ist das ein Rahmen: Hinter der Raute mit Plus endet jeder Zweig in einem dicken Kreis mit gefülltem Punkt (Terminierung). Die erste Terminierung beendet den Rahmen und alles, was darin noch läuft. Die Dauer ist die des schnellsten Zweigs; was abgebrochen wird, zählt trotzdem als Arbeit.',
  },
  nacheinander: {
    titel: 'In beliebiger Reihenfolge',
    bpmn: 'Ad-hoc-Teilprozess',
    symbol: 'adhoc',
    text: 'Eine Person erledigt mehrere Dinge, die Reihenfolge ist ihr überlassen, z. B. Unterlagen prüfen, Termin vereinbaren, Akte anlegen. Im Diagramm ist das ein Rahmen mit einer Tilde (~) unten in der Mitte; darin stehen die Zweige ohne Pfeile, jeder wird genau einmal erledigt. Hat ein Zweig mehrere Schritte, steht er in einem eigenen kleinen Rahmen „Zweig n“. Gerechnet wird in der Reihenfolge der Liste; anders als bei „Gleichzeitig“ addieren sich die Zeiten.',
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
  teilprozess: {
    titel: 'Abschnitt',
    bpmn: 'Aufgeklappter Teilprozess',
    symbol: 'teilprozess',
    text: 'Ein Rahmen mit Namen fasst zusammengehörige Schritte zusammen, z. B. „Ware versenden“. Er hat einen eigenen Start und ein eigenes Ende; der Ablauf läuft am linken Rand hinein und am rechten heraus. Endet der Vorgang im Abschnitt, zeigt ein Blitz den Ausstieg aus dem Rahmen: innen ein Ende mit Blitz, am Rand des Rahmens ein Blitz im Doppelkreis, von dem es zum Ende mit dem Ergebnis geht. Gemeint ist kein technischer Fehler. Alle Schritte des Abschnitts stehen in einer Bahn; Schritte anderer Rollen tragen die Rolle in Klammern.',
  },
  mehrfach: {
    titel: 'Für jedes Stück einer Liste',
    bpmn: 'Mehrfachinstanz (Multi-Instance)',
    symbol: 'mehrfach',
    text: 'Die Schritte laufen einmal je Stück, z. B. für jede Position einer Bestellung oder für jeden Lieferanten. Im Diagramm zeigt eine Markierung unten in der Mitte, wie: drei waagerechte Striche heißen der Reihe nach, drei senkrechte zur selben Zeit. Ist es nur eine Aufgabe, trägt sie die Markierung selbst; mehrere Schritte stehen in einem Rahmen. Die Liegezeit, bis jemand mit dem ersten Stück anfängt, zählt einmal, die Bearbeitung je Stück. Zur selben Zeit heißt: so viele Leute wie Stücke, oder man wartet auf mehrere Antworten zugleich.',
  },
  unterbrechung: {
    titel: 'Unterbrechung',
    bpmn: 'Randereignis (Boundary Event)',
    symbol: 'unterbrechung',
    text: 'Ein Ereignis am Rand eines Schritts, z. B. eine Nachricht des Kunden oder eine abgelaufene Frist. Tritt es ein, solange der Schritt läuft, geht es auf dem Weg weiter, der am Ereignis beginnt. Ein durchgezogener Doppelkreis bricht die Arbeit am Schritt ab; danach geht es hinter dem Schritt weiter, zurück, oder der Vorgang endet. Ein gestrichelter Doppelkreis läuft nebenher: Der Schritt geht weiter, und der Nebenweg endet für sich. Wie oft das vorkommt, steht als fester Anteil der Ausführungen am Ereignis.',
  },
  abbruch: {
    titel: 'Prozess endet sofort',
    bpmn: 'Terminierungs-Endereignis',
    symbol: 'ende-terminierung',
    text: 'Endet der Prozess an einer Stelle, neben der noch etwas anderes läuft (ein anderer Zweig, ein anderer Weg, ein anderes Stück), wird alles abgebrochen, was noch läuft. Im Diagramm ist das ein dicker Kreis mit gefülltem Punkt (Terminierung). In einem Rahmen steht stattdessen ein Ende mit Blitz: der Ausstieg aus dem Rahmen, kein technischer Fehler; hinter dem Blitz am Rand folgt die Terminierung. Gerechnet wird mit dem ersten Abbruch; was die anderen Zweige bis dahin getan haben, zählt voll.',
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
