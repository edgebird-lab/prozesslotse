import {
  FORMAT_VERSION,
  type Aufgabe,
  type Entscheidung,
  type EntscheidungsZweig,
  type Id,
  type Medium,
  type MediumArt,
  type Mehrfach,
  type Oder,
  type OderZweig,
  type Parallel,
  type Projekt,
  type Prozess,
  type Rolle,
  type Sequenz,
  type Teilnehmer,
  type Teilprozess,
  type Warten,
  type Wiederholung,
} from './typen'

const ZEICHEN = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** Erzeugt eine zufällige, XML-taugliche Kennung, z. B. `auf_k3j9x2ma`. */
export function neueId(praefix: string): Id {
  const zufall = new Uint8Array(8)
  globalThis.crypto.getRandomValues(zufall)
  let s = ''
  for (const z of zufall) s += ZEICHEN[z % ZEICHEN.length]
  return `${praefix}_${s}`
}

export function neueSequenz(schritte: Sequenz['schritte'] = []): Sequenz {
  return { id: neueId('seq'), schritte }
}

export function neueAufgabe(werte: Partial<Aufgabe> = {}): Aufgabe {
  return {
    typ: 'aufgabe',
    id: neueId('auf'),
    name: '',
    rolleId: null,
    mediumId: null,
    bearbeitungMin: 5,
    liegezeitMin: 0,
    art: 'normal',
    freigabeQuote: 0.9,
    brauchtVorgaenger: null,
    uebertragung: null,
    ...werte,
  }
}

export function neuerZweig(bezeichnung: string, anteil: number, werte: Partial<EntscheidungsZweig> = {}): EntscheidungsZweig {
  return { id: neueId('zw'), schritte: [], bezeichnung, anteil, ende: null, zurueckZu: null, ereignis: null, ...werte }
}

export function neueEntscheidung(werte: Partial<Entscheidung> = {}): Entscheidung {
  return {
    typ: 'entscheidung',
    id: neueId('ent'),
    art: 'daten',
    frage: '',
    zweige: [neuerZweig('Ja', 0.5), neuerZweig('Nein', 0.5)],
    ...werte,
  }
}

export function neuerOderZweig(bezeichnung: string, anteil: number, werte: Partial<OderZweig> = {}): OderZweig {
  return { id: neueId('ow'), schritte: [], bezeichnung, anteil, ...werte }
}

/** Neue ODER-Verzweigung: zwei Wege und ein Weg „Keiner davon“ für die übrigen Fälle. */
export function neueOder(werte: Partial<Oder> = {}): Oder {
  const keiner = neuerOderZweig('Keiner davon', 0)
  return { typ: 'oder', id: neueId('oder'), frage: '', zweige: [neuerOderZweig('', 0.5), neuerOderZweig('', 0.5), keiner], standard: keiner.id, ...werte }
}

export function neueParallel(anzahlZweige = 2): Parallel {
  return {
    typ: 'parallel',
    id: neueId('par'),
    art: 'alle',
    zweige: Array.from({ length: Math.max(2, anzahlZweige) }, () => neueSequenz()),
  }
}

/** Neuer Abschnitt mit Namen (aufgeklappter Teilprozess), zunächst ohne Schritte. */
export function neuerTeilprozess(werte: Partial<Teilprozess> = {}): Teilprozess {
  return { typ: 'teilprozess', id: neueId('tp'), name: '', koerper: neueSequenz(), ...werte }
}

/** Neuer Baustein „für jedes Stück einer Liste“: im Schnitt drei Stücke, immer etwa gleich viele, eine Person arbeitet sie der Reihe nach ab. */
export function neuerMehrfach(werte: Partial<Mehrfach> = {}): Mehrfach {
  return { typ: 'mehrfach', id: neueId('mf'), name: '', anzahl: 3, streuung: 'fest', ausfuehrung: 'nacheinander', liegezeitMin: 0, koerper: neueSequenz(), ...werte }
}

export function neueWiederholung(werte: Partial<Wiederholung> = {}): Wiederholung {
  return {
    typ: 'wiederholung',
    id: neueId('wdh'),
    modus: 'anteil',
    frage: 'Nacharbeit nötig?',
    anteilWiederholung: 0.1,
    koerper: neueSequenz(),
    ...werte,
  }
}

/** Rücksprungbereich um die gegebenen Schritte; legt der Assistent bei „zurück zu …“ an. */
export function neuerRuecksprungBereich(schritte: Sequenz['schritte']): Wiederholung {
  return { typ: 'wiederholung', id: neueId('rsp'), modus: 'ruecksprung', frage: '', anteilWiederholung: 0, koerper: neueSequenz(schritte) }
}

export function neuesWarten(werte: Partial<Warten> = {}): Warten {
  return { typ: 'warten', id: neueId('wrt'), name: '', art: 'zeit', dauerMin: 60, ...werte }
}

export function neueRolle(name = '', werte: Partial<Rolle> = {}): Rolle {
  return { id: neueId('rol'), name, stundensatz: 45, personen: 1, verfuegbarProzent: 100, ...werte }
}

export function neuerTeilnehmer(name = ''): Teilnehmer {
  return { id: neueId('tln'), name }
}

export function neuesMedium(name = '', art: MediumArt = 'fachanwendung'): Medium {
  return { id: neueId('med'), name, art }
}

export function neuerProzess(werte: Partial<Prozess> = {}): Prozess {
  return {
    formatVersion: FORMAT_VERSION,
    id: neueId('pro'),
    name: '',
    beschreibung: '',
    ausloeser: { art: 'nachricht', text: '' },
    ergebnis: '',
    vorgaengeProTag: 20,
    arbeitsstundenProTag: 8,
    rollen: [],
    medien: [],
    teilnehmer: [],
    ablauf: { id: 'haupt', schritte: [] },
    ...werte,
  }
}

export function neuesProjekt(ist: Prozess = neuerProzess()): Projekt {
  return { formatVersion: FORMAT_VERSION, ist, soll: null, massnahmen: [], verworfen: [] }
}
