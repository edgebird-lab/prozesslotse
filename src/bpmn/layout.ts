/**
 * Layout für blockstrukturierte Prozesse mit Bahnen (Swimlanes).
 *
 * - **Spalten** folgen der Baumstruktur: Schritte hintereinander belegen
 *   aufeinanderfolgende Spalten, Zweige beginnen in der Spalte nach der
 *   Verzweigung, die Zusammenführung steht hinter dem längsten Zweig.
 * - **Bahnen**: Jede Rolle hat eine Bahn. Aufgaben stehen in der Bahn ihrer
 *   Rolle, Gateways und Ereignisse in der Bahn, in der der Ablauf gerade ist.
 * - **Spuren**: Innerhalb einer Bahn werden Zweige übereinander gestapelt.
 *   Jeder Zweig bekommt in jeder Bahn ein eigenes Band, das über die ganze
 *   Breite seines Blocks reserviert ist.
 * - **Rahmen** (Abschnitte, „für jedes Stück“, „weiter beim ersten“ und „in
 *   beliebiger Reihenfolge“, im BPMN aufgeklappte bzw. Ad-hoc-Teilprozesse)
 *   liegen mit allem darin in einer Bahn. Ist der Körper von
 *   „für jedes Stück“ eine einzelne Aufgabe, trägt sie die Markierung der
 *   Mehrfachinstanz, und es gibt keinen Rahmen. Über dem Inhalt liegt eine dünne Kopfspur für
 *   den Namen, darunter eine dünne Fußspur. Die Hauptlinie eines Teils liegt in
 *   jeder Bahn auf seiner Ankerspur; Folgen richten ihre Teile darauf aus, damit
 *   Ein- und Austritt eines Rahmens auf einer Höhe mit den Nachbarn liegen.
 *
 * Kanten verlaufen waagerecht in der Spur ihres Startknotens und senkrecht
 * nur in den Lücken zwischen Spalten oder unter der eigenen Raute. Weil
 * Bänder reserviert sind und Lücken frei bleiben, kreuzt eine Kante keinen
 * fremden Knoten. Rückflüsse von Wiederholungen laufen über schmale
 * Extraspuren unter dem Körper. Wie die Linien genau laufen, damit sich keine
 * zwei eine Strecke teilen, legt `linien.ts` fest. Läge ein senkrechtes Stück
 * eines fremden Flusses in einem Rahmen, rückt der betroffene Baustein hinter
 * den Rahmen (Bahnwechsel neben Rahmen).
 */
import { ersterAusgang } from '../analyse/verteilung'
import { anzahlVerteilung, kannNull } from '../modell/anzahl'
import {
  alsMarkierteAufgabe,
  durchlaufe,
  einzelneAktivitaet,
  istRahmen,
  nebenwegAnzahl,
  oderWahrscheinlichkeiten,
  oderZiehung,
  parallelName,
  rahmenRolle,
  unterbrechungsAnteile,
  type Rahmenbaustein,
} from '../modell/operationen'
import { fuehreLinien, RAHMEN_RAND, type NachrichtAuftrag, type RandAbgang } from './linien'
import {
  unerwartet,
  unterbrechungenVon,
  type Aufgabe,
  type Block,
  type EntscheidungsZweig,
  type Id,
  type Mehrfach,
  type MehrfachStreuung,
  type OderZweig,
  type Parallel,
  type Prozess,
  type Rolle,
  type Sequenz,
  type Teilprozess,
  type Unterbrechbar,
  type Unterbrechung,
  type Wiederholung,
} from '../modell/typen'
import { formatiereDauer, formatiereProzent, formatiereZahl } from '../modell/zeit'

export const MASSE = {
  spalte: 170,
  spur: 110,
  spurDuenn: 40,
  bahnPolster: 10,
  kopf: 30,
  rand: 20,
  aufgabe: { breite: 120, hoehe: 80 },
  gateway: { breite: 50, hoehe: 50 },
  ereignis: { breite: 36, hoehe: 36 },
  beschriftungBreite: 90,
  zeile: 14,
}

/** Maße der Rahmen (aufgeklappte Teilprozesse) */
export const RAHMEN = {
  /** Oberkante unter dem oberen Rand der Kopfspur */
  oben: 4,
  /** Innenabstand des Namens; bpmn-js schreibt ihn oben in die Mitte */
  text: 7,
  /** Zeilenhöhe des Namens (12 px Schrift, Zeilenabstand 1,2) */
  zeile: 14.4,
  /** Mittelpunkt des rechten Randereignisses links der rechten Kante */
  randRechts: 30,
  /** Mittelpunktsabstand der Randereignisse */
  randAbstand: 38,
  /** Halbe Breite der Mehrfach-Markierung in der Mitte der Unterkante, mit Rand; dort sitzt kein Randereignis */
  markeHalb: 18,
}

/** Randereignisse an Aufgaben und waagerechte Stücke unter einem Schritt */
export const RAND = {
  /** Mittelpunkt des rechten Randereignisses links der rechten Kante einer Aufgabe (drei passen auf 120 px) */
  aufgabeRechts: 22,
  /** Erstes waagerechtes Stück unter der Unterkante des Schritts (unter den Kreisen, die 18 px hinunterreichen) */
  ersteStufe: 26,
  /** Abstand der waagerechten Stücke unter einem Schritt */
  stufe: 8,
  /** Höchstens so viele Randereignisse an einer Aufgabe */
  maxAufgabe: 3,
}

/** Mehrfachinstanz („für jedes Stück“) an einer Aufgabe oder einem Rahmen; Anzahl und Streuung braucht das Tokenspiel. */
export interface MehrfachMarke {
  nacheinander: boolean
  anzahl: number
  streuung: MehrfachStreuung
}

export const OHNE_ROLLE = '__ohne_rolle__'

export type KnotenArt = 'start' | 'ende' | 'aufgabe' | 'xor' | 'und' | 'oder' | 'ereignisgateway' | 'warten' | 'rand'

export interface Rechteck {
  x: number
  y: number
  breite: number
  hoehe: number
}

export interface LayoutKnoten extends Rechteck {
  id: string
  art: KnotenArt
  name: string
  /** Baustein im Modell, zu dem der Knoten gehört. */
  blockId: Id | null
  bahn: string
  spalte: number
  spur: number
  richtung?: 'auf' | 'zu'
  /** ODER-Verzweigung ohne Standardweg: Eine leere Auswahl kommt nicht vor (für das Tokenspiel). */
  mindestensEiner?: boolean
  aufgabe?: Aufgabe
  ereignis?: 'nachricht' | 'zeit' | 'bedingung' | null
  beschriftung?: Rechteck
  /** Nachricht an diesen externen Teilnehmer */
  an?: Id | null
  /** Nachricht von diesem externen Teilnehmer */
  von?: Id | null
  /** Innerster Rahmen, in dem der Knoten liegt (Kennung des Teilprozesses); null auf Prozessebene */
  rahmen?: string | null
  /** Fehler-Ende und Fehler-Randereignis: Kennung des bpmn:error */
  fehler?: string
  /** Randereignis: Aufgabe oder Rahmen, an dessen Unterkante es sitzt */
  wirt?: string
  /** Randereignis: false = nicht unterbrechend (Nebenweg); fehlt = unterbrechend */
  unterbrechend?: boolean
  /**
   * Randereignis: Platz auf der Unterkante (0 = ganz rechts), Höhe seines ersten
   * waagerechten Stücks (`stufe`, nur über die Abgangsspur) und seiner Nachricht
   * (`nachrichtStufe`), jeweils gezählt ab dem ersten Stück unter dem Schritt;
   * `abgangsspur` ist die Spur dafür unter dem Schritt.
   */
  randLage?: { nr: number; stufe?: number; nachrichtStufe?: number; abgangsspur?: number }
  /** Dokumentation im BPMN (Randereignisse: Anteil, Frist, Danach) */
  doku?: string
  /** Zweige, in denen der Knoten liegt, von außen nach innen (`Verzweigung|Zweig|Baustein`); für das Rücken hinter Rahmen */
  zweigPfad?: string[]
  /** Aufgabe mit Markierung der Mehrfachinstanz („für jedes Stück“ mit einer einzelnen Aufgabe) */
  mehrfach?: MehrfachMarke
  /** dazu der Baustein „für jedes Stück“ im Modell */
  mehrfachBlock?: Id
  /**
   * Endereignis: Terminierung. In „weiter beim ersten“ ist ein Zweig fertig, und
   * die übrigen werden abgebrochen; auf Prozessebene neben gleichzeitig
   * laufenden Schritten endet der ganze Vorgang (mit Ergebnis als Name).
   */
  terminierung?: boolean
  /** Terminierung eines Zweigs von „weiter beim ersten“: Wahrscheinlichkeit, dass er zuerst fertig ist (für das Tokenspiel) */
  zuerst?: number
}

export interface Spur {
  bahn: string
  spur: number
}

export interface Punkt {
  x: number
  y: number
}

export interface LayoutKante {
  id: string
  von: string
  nach: string
  name: string
  doku: string
  /** Weg über eine reservierte Spur (leerer Zweig). */
  ueber?: Spur
  /** Rückfluss einer Wiederholung über die Extraspur (von der Frage am Ende). */
  rueck?: Spur
  /** Rücksprung aus einem Ausgang zum Anfang eines Rücksprungbereichs, über dessen Extraspur. */
  sprung?: Spur
  /** Abgang von einem Randereignis: senkrecht hinunter bis zur Höhe des Ziels, dann waagerecht. */
  abgang?: boolean
  /** Wahrscheinlichkeit, mit der dieser Fluss an seiner Verzweigung gewählt wird. */
  anteil?: number
  /** Standardfluss einer ODER-Verzweigung: wird genommen, wenn kein anderer Weg zutrifft. */
  standard?: boolean
  punkte: Punkt[]
  beschriftung?: Rechteck
}

export interface LayoutBahn extends Rechteck {
  schluessel: string
  name: string
  rolleId: Id | null
}

/** Pool eines externen Teilnehmers (ohne Inhalt): abwechselnd über und unter dem Hauptpool. */
export interface LayoutPool extends Rechteck {
  id: string
  teilnehmerId: Id
  name: string
  lage: 'oben' | 'unten'
}

/** Nachrichtenfluss zwischen einem Element des Prozesses und einem externen Pool. */
export interface LayoutNachricht {
  id: string
  von: string
  nach: string
  punkte: Punkt[]
}

/**
 * Art eines Rahmens: Abschnitt, „für jedes Stück“, „weiter beim ersten“
 * (Teilprozess mit Terminierung je Zweig) oder „in beliebiger Reihenfolge“
 * (Ad-hoc-Teilprozess). Die eingebetteten Zweige „Zweig n“ eines
 * Ad-hoc-Rahmens sind Abschnitte.
 */
export type RahmenArt = 'teilprozess' | 'mehrfach' | 'erster' | 'adhoc'

/** Rahmen eines aufgeklappten Teilprozesses; kein Knoten im Spaltenraster. */
export interface LayoutRahmen extends Rechteck {
  /** Kennung des Teilprozesses im BPMN */
  id: string
  blockId: Id
  art: RahmenArt
  name: string
  bahn: string
  /** umgebender Rahmen, sonst null */
  eltern: string | null
  /** Höhe der Hauptlinie: Hier enden der eingehende und beginnt der ausgehende Fluss. */
  anschlussY: number
  /** erste und letzte innere Spalte */
  spalteVon: number
  spalteBis: number
  /** Feld des Namens (bpmn-js zeichnet ihn oben in der Mitte) */
  beschriftung?: Rechteck
  zweigPfad: string[]
  /** Markierung der Mehrfachinstanz, in der Mitte der Unterkante */
  mehrfach?: MehrfachMarke
  /** Nur Ad-hoc-Rahmen: die Aktivitäten darin (je Zweig eine), in der Reihenfolge der Liste */
  aktivitaeten?: string[]
  /** Dokumentation im BPMN */
  doku?: string
}

/** Trägt der Rahmen eine Markierung in der Mitte der Unterkante (Mehrfachinstanz, Ad-hoc-Tilde)? Dort sitzt kein Randereignis. */
export function hatMarke(r: Pick<LayoutRahmen, 'mehrfach' | 'art'>): boolean {
  return !!r.mehrfach || r.art === 'adhoc'
}

export interface Layout {
  knoten: LayoutKnoten[]
  kanten: LayoutKante[]
  bahnen: LayoutBahn[]
  pool: Rechteck
  pools: LayoutPool[]
  nachrichten: LayoutNachricht[]
  rahmen: LayoutRahmen[]
  /** bpmn:error je Ergebnis, mit dem der Vorgang in einem Rahmen endet */
  fehler: { id: string; name: string }[]
}

/** Macht aus einer Kennung einen gültigen XML-Namen. */
export function xmlId(s: string): string {
  const sauber = s.replace(/[^A-Za-z0-9_.-]/g, '_')
  return /^[A-Za-z_]/.test(sauber) ? sauber : `n_${sauber}`
}

// ---------------------------------------------------------------------------
// Teil-Layouts in relativen Spalten und Spuren

interface Austritt {
  knoten: string
  name: string
  doku: string
  ueber?: Spur
  anteil?: number
  standard?: boolean
  /** Der Fluss beginnt an einem Randereignis (leerer Ausnahmeweg) */
  abgang?: boolean
}

/** Noch offener Rücksprung aus einem Ausgang; der Bereich mit `ziel` zeichnet die Kante. */
interface Sprung {
  von: string
  ziel: Id
  name: string
  doku: string
  anteil?: number
  /** Der Rücksprung beginnt an einem Randereignis (leerer Ausnahmeweg) */
  abgang?: boolean
}

/** Rahmen in relativen Spalten und Spuren */
interface TeilRahmen {
  id: string
  blockId: Id
  art: RahmenArt
  name: string
  bahn: string
  eltern: string | null
  spalteVon: number
  spalteBis: number
  /** Kopfspur */
  spurVon: number
  /** Fußspur */
  spurBis: number
  /** Spur der Hauptlinie (innerer Start und inneres Ende) */
  ankerSpur: number
  zweigPfad: string[]
  mehrfach?: MehrfachMarke
  aktivitaeten?: string[]
  doku?: string
}

interface Teil {
  knoten: LayoutKnoten[]
  kanten: LayoutKante[]
  spruenge: Sprung[]
  rahmen: TeilRahmen[]
  breite: number
  /** Belegte Spuren je Bahn, relativ zum Band dieses Teils. */
  hoehe: Map<string, number>
  /** Spur der Hauptlinie je Bahn, in der der Ablauf hinein- oder hinausläuft. */
  anker: Map<string, number>
  eintritt: string | null
  austritt: Austritt | null
  austrittsBahn: string
  /** Nur Folgen: Startspalte jedes Bausteins (zum Rücken hinter Rahmen) */
  bloecke: { id: Id; start: number }[]
}

interface Kontext {
  rollenIds: Set<Id>
  rollen: Rolle[]
  kantenNr: number
  /** Innerhalb eines Rahmens liegen alle Knoten in dieser Bahn. */
  bahnZwang: string | null
  /** Innerster Rahmen, in dem gerade gelegt wird */
  rahmen: string | null
  /** bpmn:error je Ergebnis */
  fehler: Map<string, string>
  /** Bahnwechsel neben Rahmen: kleinste Startspalte eines Bausteins in seinem Zweig, relativ zur Verzweigung */
  schub: Map<Id, number>
  /** Stunden je Arbeitstag (für Zeiten in der Dokumentation) */
  stunden: number
  /** Liegt die Stelle neben gleichzeitig laufenden Schritten (Zweig von Gleichzeitig, ODER-Weg, Nebenweg)? Dann bricht ein Ende alles ab. */
  nebenlaeufig: boolean
}

/**
 * Ende je nach Ort: in einem Rahmen ein Fehler-Ende (der äußerste Rahmen fängt
 * es), auf Prozessebene neben gleichzeitig laufenden Schritten eine
 * Terminierung, sonst ein gewöhnliches Ende.
 */
function endeArt(ctx: Kontext, ergebnis: string): Pick<LayoutKnoten, 'fehler' | 'terminierung' | 'doku'> {
  if (ctx.rahmen !== null) return { fehler: fehlerId(ctx, ergebnis) }
  return ctx.nebenlaeufig ? { terminierung: true, doku: ABBRUCH_DOKU } : {}
}

const ABBRUCH_DOKU = 'Beendet den ganzen Vorgang mit diesem Ergebnis; was gleichzeitig läuft, wird abgebrochen'

/** Legt `f` mit der angegebenen Nebenläufigkeit aus und stellt sie danach wieder her. */
function nebenher<T>(ctx: Kontext, nebenlaeufig: boolean, f: () => T): T {
  const vorher = ctx.nebenlaeufig
  ctx.nebenlaeufig = vorher || nebenlaeufig
  try {
    return f()
  } finally {
    ctx.nebenlaeufig = vorher
  }
}

function neuerTeil(bahn: string): Teil {
  return { knoten: [], kanten: [], spruenge: [], rahmen: [], breite: 0, hoehe: new Map(), anker: new Map(), eintritt: null, austritt: null, austrittsBahn: bahn, bloecke: [] }
}

function belege(t: Teil, bahn: string, spuren: number): void {
  t.hoehe.set(bahn, Math.max(t.hoehe.get(bahn) ?? 0, spuren))
}

function knoten(ctx: Kontext, werte: Omit<LayoutKnoten, 'x' | 'y' | 'breite' | 'hoehe'>): LayoutKnoten {
  return { x: 0, y: 0, breite: 0, hoehe: 0, rahmen: ctx.rahmen, ...werte }
}

interface KantenOptionen {
  name?: string
  doku?: string
  ueber?: Spur
  rueck?: Spur
  sprung?: Spur
  abgang?: boolean
  anteil?: number
  standard?: boolean
}

function kante(ctx: Kontext, von: string, nach: string, o: KantenOptionen = {}): LayoutKante {
  ctx.kantenNr += 1
  return {
    id: `Fluss_${ctx.kantenNr}`,
    von,
    nach,
    name: o.name ?? '',
    doku: o.doku ?? '',
    ueber: o.ueber && { ...o.ueber },
    rueck: o.rueck && { ...o.rueck },
    sprung: o.sprung && { ...o.sprung },
    abgang: o.abgang,
    anteil: o.anteil,
    standard: o.standard,
    punkte: [],
  }
}

/** Kante, die einen offenen Austritt (ggf. mit Beschriftung eines leeren Zweigs) fortsetzt. */
function kanteAus(ctx: Kontext, a: Austritt, nach: string): LayoutKante {
  return kante(ctx, a.knoten, nach, { name: a.name, doku: a.doku, ueber: a.ueber, anteil: a.anteil, standard: a.standard, abgang: a.abgang })
}

function verschiebeSpur(s: Spur | undefined, dSpur: Map<string, number>): void {
  if (s) s.spur += dSpur.get(s.bahn) ?? 0
}

function verschiebe(t: Teil, dSpalte: number, dSpur: Map<string, number>): void {
  for (const k of t.knoten) {
    k.spalte += dSpalte
    k.spur += dSpur.get(k.bahn) ?? 0
    if (k.randLage?.abgangsspur !== undefined) k.randLage.abgangsspur += dSpur.get(k.bahn) ?? 0
  }
  for (const e of t.kanten) {
    verschiebeSpur(e.ueber, dSpur)
    verschiebeSpur(e.rueck, dSpur)
    verschiebeSpur(e.sprung, dSpur)
  }
  verschiebeSpur(t.austritt?.ueber, dSpur)
  for (const r of t.rahmen) {
    const d = dSpur.get(r.bahn) ?? 0
    r.spalteVon += dSpalte
    r.spalteBis += dSpalte
    r.spurVon += d
    r.spurBis += d
    r.ankerSpur += d
  }
  for (const [bahn, a] of t.anker) t.anker.set(bahn, a + (dSpur.get(bahn) ?? 0))
  for (const b of t.bloecke) b.start += dSpalte
}

/** Senkt einen Teil in den genannten Bahnen um so viele Spuren; seine Höhe wächst entsprechend. */
function senke(t: Teil, dSpur: Map<string, number>): void {
  verschiebe(t, 0, dSpur)
  for (const [bahn, d] of dSpur) if (t.hoehe.has(bahn)) t.hoehe.set(bahn, t.hoehe.get(bahn)! + d)
}

function uebernimm(ziel: Teil, quelle: Teil): void {
  ziel.knoten.push(...quelle.knoten)
  ziel.kanten.push(...quelle.kanten)
  ziel.spruenge.push(...quelle.spruenge)
  ziel.rahmen.push(...quelle.rahmen)
  for (const [bahn, h] of quelle.hoehe) belege(ziel, bahn, h)
}

function bahnVon(ctx: Kontext, rolleId: Id | null): string {
  return rolleId !== null && ctx.rollenIds.has(rolleId) ? rolleId : OHNE_ROLLE
}

/** Bahn eines Rahmens: die Rolle mit den meisten Aufgaben darin, sonst die Bahn, in der der Ablauf gerade ist. */
function rahmenBahn(b: Rahmenbaustein, bahn: string, ctx: Kontext): string {
  const rolle = rahmenRolle(b, (r) => (r !== null && ctx.rollenIds.has(r) ? r : null))
  return rolle === undefined ? bahn : rolle === null ? OHNE_ROLLE : rolle
}

function fehlerId(ctx: Kontext, ergebnis: string): string {
  let id = ctx.fehler.get(ergebnis)
  if (!id) {
    id = `Fehler_${ctx.fehler.size + 1}`
    ctx.fehler.set(ergebnis, id)
  }
  return id
}

function layoutSequenz(schritte: Block[], bahn: string, ctx: Kontext): Teil {
  const t = neuerTeil(bahn)
  const teile: Teil[] = []
  // Verbindung zum Vorgänger je Teil; angelegt in Leserichtung, damit die Flüsse ihre Nummern behalten
  const verbindung: (LayoutKante | null)[] = []
  let bahnJetzt = bahn
  for (const b of schritte) {
    const bt = layoutBlock(b, bahnJetzt, ctx)
    const vorher = teile[teile.length - 1]
    verbindung.push(vorher?.austritt && bt.eintritt ? kanteAus(ctx, vorher.austritt, bt.eintritt) : null)
    teile.push(bt)
    bahnJetzt = bt.austrittsBahn
  }
  // Die Hauptlinie liegt je Bahn auf einer Höhe: Teile mit kleinerem Anker rücken nach unten.
  const anker = new Map<string, number>()
  for (const bt of teile) for (const [b, a] of bt.anker) anker.set(b, Math.max(anker.get(b) ?? 0, a))
  let austritt: Austritt | null = null
  teile.forEach((bt, i) => {
    const d = new Map<string, number>()
    for (const [b, a] of bt.anker) if (anker.get(b)! > a) d.set(b, anker.get(b)! - a)
    if (d.size > 0) senke(bt, d)
    verschiebe(bt, t.breite, new Map())
    uebernimm(t, bt)
    t.bloecke.push({ id: schritte[i].id, start: t.breite })
    const k = verbindung[i]
    if (i === 0) t.eintritt = bt.eintritt
    else if (k && austritt) {
      // Die Spur eines leeren Zweigs kann sich beim Ausrichten verschoben haben
      k.ueber = austritt.ueber && { ...austritt.ueber }
      t.kanten.push(k)
    }
    austritt = bt.austritt
    t.breite += bt.breite
  })
  t.austritt = schritte.length > 0 ? austritt : null
  t.austrittsBahn = bahnJetzt
  t.anker = anker
  return t
}

function layoutAufgabe(b: Aufgabe, ctx: Kontext): Teil {
  const rolleBahn = bahnVon(ctx, b.rolleId)
  const eigeneBahn = ctx.bahnZwang ?? rolleBahn
  // Im Rahmen stehen alle Schritte in einer Bahn; Schritte anderer Rollen tragen die Rolle im Namen.
  const name = eigeneBahn !== rolleBahn ? `${b.name} (${ctx.rollen.find((r) => r.id === b.rolleId)?.name || 'ohne Rolle'})` : b.name
  const t = neuerTeil(eigeneBahn)
  const id = xmlId(b.id)
  t.knoten.push(knoten(ctx, { id, art: 'aufgabe', name, blockId: b.id, bahn: eigeneBahn, spalte: 0, spur: 0, aufgabe: b, an: b.nachrichtAn ?? null, von: b.nachrichtVon ?? null }))
  belege(t, eigeneBahn, 1)
  t.breite = 1
  t.eintritt = id
  t.austritt = { knoten: id, name: '', doku: '' }
  t.anker.set(eigeneBahn, 0)
  return t
}

function layoutBlock(b: Block, bahn: string, ctx: Kontext): Teil {
  switch (b.typ) {
    case 'aufgabe': {
      const t = layoutAufgabe(b, ctx)
      return b.unterbrechungen?.length ? layoutRandwege(b, t, [], ctx) : t
    }
    case 'warten': {
      const t = neuerTeil(bahn)
      const id = xmlId(b.id)
      t.knoten.push(knoten(ctx, { id, art: 'warten', name: b.name, blockId: b.id, bahn, spalte: 0, spur: 0, ereignis: b.art, von: b.art === 'nachricht' ? (b.von ?? null) : null }))
      belege(t, bahn, 1)
      t.breite = 1
      t.eintritt = id
      t.austritt = { knoten: id, name: '', doku: '' }
      t.anker.set(bahn, 0)
      return t
    }
    case 'parallel': {
      const art = b.art
      switch (art) {
        case 'alle':
          return layoutVerzweigung(b, bahn, ctx)
        case 'erster':
        case 'nacheinander':
          // Rahmen: „weiter beim ersten“ mit Terminierung je Zweig, „in beliebiger Reihenfolge“ als Ad-hoc-Teilprozess
          return layoutRahmenMitRand({ ...b, art }, bahn, ctx)
        default:
          return unerwartet(art)
      }
    }
    case 'entscheidung':
    case 'oder':
      return layoutVerzweigung(b, bahn, ctx)
    case 'wiederholung':
      return layoutWiederholung(b, bahn, ctx)
    case 'teilprozess':
      return layoutRahmenMitRand(b, bahn, ctx)
    case 'mehrfach':
      return layoutMehrfach(b, bahn, ctx)
    default:
      return unerwartet(b)
  }
}

/** „Für jedes Stück“: eine einzelne Aufgabe trägt die Markierung, sonst ein Rahmen mit Markierung. */
function layoutMehrfach(b: Mehrfach, bahn: string, ctx: Kontext): Teil {
  const marke: MehrfachMarke = { nacheinander: b.ausfuehrung === 'nacheinander', anzahl: b.anzahl, streuung: b.streuung }
  const einzeln = alsMarkierteAufgabe(b)
  if (!einzeln) return layoutRahmenMitRand(b, bahn, ctx, marke)
  const t = layoutBlock(einzeln, bahn, ctx)
  Object.assign(t.knoten[0], { mehrfach: marke, mehrfachBlock: b.id })
  return t
}

/** Rahmen samt Randereignissen: Ausstiege für Enden darin (nur am äußersten Rahmen) und Unterbrechungen. */
function layoutRahmenMitRand(b: Rahmenbaustein, bahn: string, ctx: Kontext, marke?: MehrfachMarke): Teil {
  const { teil, fehler } = layoutRahmen(b, bahn, ctx, marke)
  return fehler.length > 0 || unterbrechungenVon(b).length > 0 ? layoutRandwege(b, teil, fehler, ctx) : teil
}

/**
 * Inhalt eines Ad-hoc-Rahmens („in beliebiger Reihenfolge“): je Zweig genau eine
 * Aktivität ohne Sequenzfluss, untereinander ab der ersten Spalte. Ein Zweig aus
 * einer Aufgabe, einem Abschnitt oder „für jedes Stück“ ohne Unterbrechungen
 * bleibt, wie er ist; sonst wird er ein eingebetteter Teilprozess „Zweig n“ mit
 * eigenem Start und Ende. `fertig`: Jede Aktivität kann normal zu Ende laufen.
 */
function layoutAdhoc(b: Parallel, bahn: string, ctx: Kontext): { teil: Teil; aktivitaeten: string[]; fertig: boolean } {
  const t = neuerTeil(bahn)
  const aktivitaeten: string[] = []
  let fertig = true
  let versatz = 0
  b.zweige.forEach((z, i) => {
    const einzeln = einzelneAktivitaet(z)
    const zweig: Teilprozess = { typ: 'teilprozess', id: z.id, name: `Zweig ${i + 1}`, koerper: z }
    const teil = einzeln ? layoutBlock(einzeln, bahn, ctx) : layoutRahmen(zweig, bahn, ctx, undefined, b.id).teil
    fertig &&= teil.austritt !== null
    if (teil.eintritt) aktivitaeten.push(teil.eintritt)
    // gestapelt wie Zweige, alle ab der ersten Spalte
    verschiebe(teil, 0, new Map([[bahn, versatz]]))
    merkeZweig(teil, b.id, i)
    if (i === 0) t.anker.set(bahn, teil.anker.get(bahn) ?? 0)
    versatz += teil.hoehe.get(bahn) ?? 1
    uebernimm(t, teil)
    t.breite = Math.max(t.breite, teil.breite)
  })
  belege(t, bahn, Math.max(1, versatz))
  t.breite = Math.max(1, t.breite)
  return { teil: t, aktivitaeten, fertig }
}

interface ZweigLayout {
  id: Id
  teil: Teil
  name: string
  doku: string
  anteil?: number
  standard?: boolean
  leer: boolean
  endet: boolean
  springt: boolean
  linie?: Spur
}

/** Kennung der Wege an den Randereignissen eines Schritts im Zweigpfad; sie beginnen am Schritt selbst (nicht an einer Raute darin). */
const RAND_ZWEIG = 'rand:'
function randZweig(id: Id): string {
  return `${RAND_ZWEIG}${id}`
}

/** Knoten und Rahmen eines Zweigs merken sich, in welchem Zweig (Nummer von oben) und welchem Baustein darin sie liegen. */
function merkeZweig(t: Teil, verzweigung: Id, zweig: number): void {
  const baustein = (spalte: number) => {
    let id = ''
    for (const b of t.bloecke) if (b.start <= spalte) id = b.id
    return id
  }
  for (const k of t.knoten) k.zweigPfad = [`${verzweigung}|${zweig}|${baustein(k.spalte)}`, ...(k.zweigPfad ?? [])]
  for (const r of t.rahmen) r.zweigPfad = [`${verzweigung}|${zweig}|${baustein(r.spalteVon)}`, ...r.zweigPfad]
}

/** Rückt alles ab Spalte `ab` um `d` Spalten nach rechts. */
function rueckeAb(t: Teil, ab: number, d: number): void {
  for (const k of t.knoten) if (k.spalte >= ab) k.spalte += d
  for (const r of t.rahmen) {
    if (r.spalteVon < ab) continue
    r.spalteVon += d
    r.spalteBis += d
  }
  for (const b of t.bloecke) if (b.start >= ab) b.start += d
  t.breite += d
}

function layoutVerzweigung(b: Extract<Block, { typ: 'entscheidung' | 'parallel' | 'oder' }>, bahn: string, ctx: Kontext): Teil {
  const xor = b.typ === 'entscheidung'
  const oder = b.typ === 'oder'
  const ereignisse = b.typ === 'entscheidung' && b.art === 'ereignis'
  const artAuf: KnotenArt = ereignisse ? 'ereignisgateway' : xor ? 'xor' : oder ? 'oder' : 'und'
  const artZu: KnotenArt = xor ? 'xor' : oder ? 'oder' : 'und'
  const t = neuerTeil(bahn)
  const aufId = xmlId(`${b.id}_auf`)
  const auf = knoten(ctx, { id: aufId, art: artAuf, name: b.typ === 'parallel' ? '' : b.frage, blockId: b.id, bahn, spalte: 0, spur: 0, richtung: 'auf' })
  t.knoten.push(auf)
  t.eintritt = aufId
  const oderAnteile = b.typ === 'oder' ? oderWahrscheinlichkeiten(b) : []
  // Am Fluss steht die Wahrscheinlichkeit des unabhängigen Wurfs; das Tokenspiel würfelt damit wie die Simulation.
  const oderWurf = b.typ === 'oder' ? oderZiehung(b).r : []
  if (b.typ === 'oder' && b.standard === null) auf.mindestensEiner = true

  // Der Standardweg einer ODER-Verzweigung steht oben auf der geraden Linie; so gehört sein Querstrich eindeutig zu ihm.
  const reihenfolge = (b.zweige as (Sequenz | EntscheidungsZweig | OderZweig)[]).map((z, zi) => ({ z, zi }))
  if (b.typ === 'oder' && b.standard) reihenfolge.sort((x, y) => Number(y.z.id === b.standard) - Number(x.z.id === b.standard))
  const zweige: ZweigLayout[] = reihenfolge.map(({ z, zi }, stapel) => {
    const ez = xor ? (z as EntscheidungsZweig) : null
    const oz = b.typ === 'oder' ? (z as OderZweig) : null
    const standard = b.typ === 'oder' && z.id === b.standard
    // Zweige von Gleichzeitig und ODER-Wege laufen neben anderen: Ein Ende darin bricht alles ab.
    let teil = nebenher(ctx, !xor, () => layoutSequenz(z.schritte, bahn, ctx))
    if (ereignisse && ez) {
      // Jeder Ausgang einer Ereignis-Entscheidung beginnt mit seinem Ereignis, auf der Höhe der Hauptlinie.
      const ereignisId = xmlId(`${z.id}_ereignis`)
      const mitEreignis = neuerTeil(bahn)
      const art = ez.ereignis?.art ?? 'nachricht'
      const spur = teil.anker.get(bahn) ?? 0
      mitEreignis.knoten.push(knoten(ctx, { id: ereignisId, art: 'warten', name: ez.bezeichnung, blockId: b.id, bahn, spalte: 0, spur, ereignis: art, von: art === 'nachricht' ? (ez.ereignis?.von ?? null) : null }))
      belege(mitEreignis, bahn, spur + 1)
      verschiebe(teil, 1, new Map())
      uebernimm(mitEreignis, teil)
      if (teil.eintritt) mitEreignis.kanten.push(kante(ctx, ereignisId, teil.eintritt))
      mitEreignis.eintritt = ereignisId
      mitEreignis.austritt = teil.eintritt ? teil.austritt : { knoten: ereignisId, name: '', doku: '' }
      mitEreignis.austrittsBahn = teil.eintritt ? teil.austrittsBahn : bahn
      mitEreignis.breite = teil.breite + 1
      mitEreignis.anker = new Map(teil.anker)
      mitEreignis.anker.set(bahn, spur)
      mitEreignis.bloecke = teil.bloecke
      teil = mitEreignis
    }
    const leer = teil.eintritt === null
    const zl: ZweigLayout = {
      id: z.id,
      teil,
      name: ereignisse ? '' : (ez?.bezeichnung ?? oz?.bezeichnung ?? ''),
      doku: ez
        ? `Anteil: ${formatiereProzent(ez.anteil, 1)}`
        : oz
          ? standard
            ? `Wenn keiner der anderen Wege zutrifft (${formatiereProzent(oderAnteile[zi], 1)} der Fälle)`
            : `Kommt in ${formatiereProzent(oz.anteil, 1)} der Fälle vor`
          : '',
      anteil: ez?.anteil ?? (oz && !standard ? oderWurf[zi] : undefined),
      standard: standard || undefined,
      leer,
      endet: ez?.ende != null,
      springt: ez?.ende == null && ez?.zurueckZu != null,
    }
    if (leer && !zl.springt) belege(teil, bahn, 1) // Spur für die Linie des leeren Zweigs
    if (ez?.ende != null) {
      // Im Rahmen wird das Ende zum Fehler-Ende (das Fehler-Randereignis am äußersten Rahmen fängt es), neben
      // gleichzeitig laufenden Schritten zur Terminierung.
      const endeId = xmlId(`${z.id}_ende`)
      const endBahn = teil.austrittsBahn
      const spur = teil.anker.get(endBahn) ?? 0
      teil.knoten.push(knoten(ctx, { id: endeId, art: 'ende', name: ez.ende, blockId: b.id, bahn: endBahn, spalte: teil.breite, spur, ...endeArt(ctx, ez.ende) }))
      belege(teil, endBahn, spur + 1)
      if (teil.austritt) teil.kanten.push(kanteAus(ctx, teil.austritt, endeId))
      if (leer) teil.eintritt = endeId
      teil.breite += 1
      teil.austritt = null
    } else if (zl.springt && ez?.zurueckZu) {
      // Die Kante zeichnet der Rücksprungbereich; bei leerem Zweig beginnt sie an der Verzweigung.
      if (leer) t.spruenge.push({ von: aufId, ziel: ez.zurueckZu, name: zl.name, doku: zl.doku, anteil: zl.anteil })
      else if (teil.austritt) teil.spruenge.push({ von: teil.austritt.knoten, ziel: ez.zurueckZu, name: teil.austritt.name, doku: teil.austritt.doku, anteil: teil.austritt.anteil })
      teil.austritt = null
    }
    merkeZweig(teil, b.id, stapel)
    return zl
  })

  // Die Verzweigung steht auf der Hauptlinie des obersten Zweigs ihrer Bahn, damit dessen Linie gerade bleibt.
  const oberster = zweige.find((z) => z.teil.hoehe.has(bahn) || z.leer)
  const eintrittsBahn = (z: ZweigLayout) => z.teil.knoten.find((k) => k.id === z.teil.eintritt)?.bahn ?? z.teil.rahmen.find((r) => r.id === z.teil.eintritt)?.bahn
  const anker = oberster && !oberster.leer && eintrittsBahn(oberster) === bahn ? (oberster.teil.anker.get(bahn) ?? 0) : 0
  auf.spur = anker

  // Zweige je Bahn übereinander stapeln
  const versatz = new Map<string, number>()
  for (const z of zweige) {
    const d = new Map<string, number>()
    for (const bahnZ of z.teil.hoehe.keys()) d.set(bahnZ, versatz.get(bahnZ) ?? 0)
    verschiebe(z.teil, 1, d)
    if (z.leer && !z.endet && !z.springt) z.linie = { bahn, spur: d.get(bahn) ?? 0 }
    for (const [bahnZ, h] of z.teil.hoehe) versatz.set(bahnZ, (versatz.get(bahnZ) ?? 0) + h)
  }

  // Bahnwechsel neben Rahmen: Bausteine, deren senkrechte Stücke einen Rahmen eines anderen Zweigs querten, rücken dahinter.
  for (const z of zweige) {
    for (const blk of z.teil.bloecke) {
      const ab = ctx.schub.get(blk.id)
      if (ab !== undefined && ab > blk.start) rueckeAb(z.teil, blk.start, ab - blk.start)
    }
  }
  const maxBreite = Math.max(1, ...zweige.map((z) => z.teil.breite))

  for (const z of zweige) {
    if (z.teil.eintritt) t.kanten.push(kante(ctx, aufId, z.teil.eintritt, { name: z.name, doku: z.doku, anteil: z.anteil, standard: z.standard }))
    t.knoten.push(...z.teil.knoten)
    t.kanten.push(...z.teil.kanten)
    t.spruenge.push(...z.teil.spruenge)
    t.rahmen.push(...z.teil.rahmen)
  }
  for (const [bahnZ, h] of versatz) belege(t, bahnZ, h)
  belege(t, bahn, anker + 1)
  t.anker.set(bahn, anker)

  const fortsetzend = zweige.filter((z) => !z.endet && !z.springt && (z.leer || z.teil.austritt !== null))
  // Gleichzeitig mit einem Zweig, der den Vorgang immer beendet: Es geht nie weiter. Eine Zusammenführung bekäme nur die
  // übrigen Zweige und ließe den Ablauf zu früh weiterlaufen; die übrigen Zweige enden deshalb für sich (Ende ohne Ergebnis).
  const nieWeiter = (b.typ === 'parallel' && b.art === 'alle' && fortsetzend.length < zweige.length) || (b.typ === 'oder' && fortsetzend.length === 0)
  if (nieWeiter) {
    for (const z of fortsetzend) {
      const endBahn = z.leer ? bahn : z.teil.austrittsBahn
      const spur = z.leer ? (z.linie?.spur ?? 0) : (z.teil.anker.get(endBahn) ?? 0)
      const endeId = xmlId(`${z.id}_ende`)
      t.knoten.push(knoten(ctx, { id: endeId, art: 'ende', name: '', blockId: b.id, bahn: endBahn, spalte: 1 + maxBreite, spur, doku: 'Dieser Zweig ist fertig; der Vorgang endet in einem anderen Zweig' }))
      if (z.leer) t.kanten.push(kante(ctx, aufId, endeId, { ueber: z.linie }))
      else if (z.teil.austritt) t.kanten.push(kanteAus(ctx, z.teil.austritt, endeId))
    }
    t.austritt = null
    t.austrittsBahn = bahn
    t.breite = maxBreite + (fortsetzend.length > 0 ? 2 : 1)
  } else if (b.typ === 'parallel' && b.art === 'erster') {
    // Weiter beim ersten: Jeder Zweig endet in einer Terminierung, alle in der Spalte hinter dem breitesten Zweig.
    // Am Ende steht, wie oft der Zweig zuerst fertig ist; damit würfelt das Tokenspiel.
    const gewinn = ersterAusgang(b, 'gesamt').je
    for (const z of fortsetzend) {
      const i = b.zweige.findIndex((x) => x.id === z.id)
      const endBahn = z.leer ? bahn : z.teil.austrittsBahn
      const spur = z.leer ? (z.linie?.spur ?? 0) : (z.teil.anker.get(endBahn) ?? 0)
      const endeId = xmlId(`${z.id}_ende`)
      const anteil = gewinn[i]?.weiter ?? 0
      t.knoten.push(knoten(ctx, { id: endeId, art: 'ende', name: '', blockId: b.id, bahn: endBahn, spalte: 1 + maxBreite, spur, terminierung: true, zuerst: anteil, doku: `Zweig ${i + 1} ist in ${formatiereProzent(anteil, 1)} der Fälle zuerst fertig; dann werden die übrigen Zweige abgebrochen` }))
      if (z.leer) t.kanten.push(kante(ctx, aufId, endeId, { ueber: z.linie }))
      else if (z.teil.austritt) t.kanten.push(kanteAus(ctx, z.teil.austritt, endeId))
    }
    t.austritt = null
    t.austrittsBahn = bahn
    t.breite = maxBreite + 2
  } else if (!xor || fortsetzend.length >= 2) {
    const zuId = xmlId(`${b.id}_zu`)
    t.knoten.push(knoten(ctx, { id: zuId, art: artZu, name: '', blockId: b.id, bahn, spalte: 1 + maxBreite, spur: anker, richtung: 'zu' }))
    for (const z of fortsetzend) {
      if (z.leer) t.kanten.push(kante(ctx, aufId, zuId, { name: z.name, doku: z.doku, ueber: z.linie, anteil: z.anteil, standard: z.standard }))
      else if (z.teil.austritt) t.kanten.push(kanteAus(ctx, z.teil.austritt, zuId))
    }
    t.austritt = { knoten: zuId, name: '', doku: '' }
    t.austrittsBahn = bahn
    t.breite = maxBreite + 2
  } else if (fortsetzend.length === 1) {
    const z = fortsetzend[0]
    t.austritt = z.leer ? { knoten: aufId, name: z.name, doku: z.doku, ueber: z.linie, anteil: z.anteil, standard: z.standard } : z.teil.austritt
    t.austrittsBahn = z.leer ? bahn : z.teil.austrittsBahn
    t.breite = maxBreite + 1
  } else {
    t.austritt = null
    t.breite = maxBreite + 1
  }
  return t
}

function layoutWiederholung(b: Wiederholung, bahn: string, ctx: Kontext): Teil {
  const t = neuerTeil(bahn)
  const einId = xmlId(`${b.id}_ein`)
  const koerper = layoutSequenz(b.koerper.schritte, bahn, ctx)
  verschiebe(koerper, 1, new Map())
  const breite = Math.max(1, koerper.breite)
  // Eingang und Frage stehen auf der Hauptlinie des Körpers
  const anker = koerper.anker.get(bahn) ?? 0
  t.knoten.push(knoten(ctx, { id: einId, art: 'xor', name: '', blockId: b.id, bahn, spalte: 0, spur: anker, richtung: 'zu' }))
  uebernimm(t, koerper)
  t.anker = new Map(koerper.anker)
  t.anker.set(bahn, anker)
  // Extraspur unter dem Körper für Rückkanten
  const rueckSpur = Math.max(anker + 1, koerper.hoehe.get(bahn) ?? 0)
  belege(t, bahn, rueckSpur + 1)
  t.eintritt = einId

  if (b.modus === 'ruecksprung') {
    if (koerper.eintritt) t.kanten.push(kante(ctx, einId, koerper.eintritt))
    const eigene = t.spruenge.filter((s) => s.ziel === b.id)
    t.spruenge = t.spruenge.filter((s) => s.ziel !== b.id)
    // Jeder Rücksprung bekommt eine eigene Extraspur, damit sich keine zwei eine Strecke teilen.
    // Der weiteste liegt am tiefsten; so schachteln sich die Linien, ohne sich zu kreuzen.
    const lage = (id: string) => t.knoten.find((k) => k.id === id) ?? t.rahmen.find((r) => r.id === id) ?? { spalte: 0, spur: 0 }
    const spalteVon = (id: string) => {
      const x = lage(id)
      return 'spalteBis' in x ? x.spalteBis : x.spalte
    }
    const spurVon = (id: string) => {
      const x = lage(id)
      return 'ankerSpur' in x ? x.ankerSpur : x.spur
    }
    const sortiert = [...eigene].sort((x, y) => spalteVon(x.von) - spalteVon(y.von) || spurVon(y.von) - spurVon(x.von))
    for (const s of eigene) {
      const spur = rueckSpur + sortiert.indexOf(s)
      t.kanten.push(kante(ctx, s.von, einId, { name: s.name, doku: s.doku, anteil: s.anteil, sprung: { bahn, spur }, abgang: s.abgang }))
    }
    belege(t, bahn, rueckSpur + Math.max(1, eigene.length))
    t.austritt = koerper.eintritt ? koerper.austritt : { knoten: einId, name: '', doku: '' }
    t.austrittsBahn = koerper.eintritt ? koerper.austrittsBahn : bahn
    t.breite = breite + 1
    return t
  }

  const frageId = xmlId(`${b.id}_frage`)
  t.knoten.push(knoten(ctx, { id: frageId, art: 'xor', name: b.frage, blockId: b.id, bahn, spalte: 1 + breite, spur: anker, richtung: 'auf' }))
  t.kanten.push(kante(ctx, einId, koerper.eintritt ?? frageId))
  if (koerper.austritt) t.kanten.push(kanteAus(ctx, koerper.austritt, frageId))
  const p = b.anteilWiederholung
  t.kanten.push(kante(ctx, frageId, einId, { name: 'Ja', doku: `Wiederholung in ${formatiereProzent(p, 1)} der Durchläufe`, rueck: { bahn, spur: rueckSpur }, anteil: p }))
  t.austritt = { knoten: frageId, name: 'Nein', doku: '', anteil: 1 - p }
  t.breite = breite + 2
  return t
}

/**
 * Mindestzahl innerer Spalten, damit `anzahl` Randereignisse auf der Unterkante
 * Platz haben, bei einer Mehrfachinstanz rechts der Markierung (Rahmen sind
 * mindestens 42 px breiter als ihre Spalten).
 */
function spaltenFuerRand(anzahl: number, mehrfach: boolean): number {
  if (anzahl <= 0) return 0
  const rechts = MASSE.ereignis.breite / 2 + RAHMEN.randRechts + (anzahl - 1) * RAHMEN.randAbstand
  const noetig = mehrfach ? 2 * (RAHMEN.markeHalb + rechts) : rechts + MASSE.ereignis.breite / 2 + 6
  return Math.ceil((noetig - 42) / MASSE.spalte)
}

/** Art eines Rahmens im Layout */
function rahmenArt(b: Rahmenbaustein): RahmenArt {
  if (b.typ !== 'parallel') return b.typ
  return b.art === 'erster' ? 'erster' : 'adhoc'
}

/** Dokumentation der Gleichzeitig-Rahmen im BPMN */
function rahmenDoku(b: Rahmenbaustein): string | undefined {
  if (b.typ !== 'parallel') return undefined
  return b.art === 'erster'
    ? 'Weiter beim ersten: Die Zweige laufen gleichzeitig. Sobald einer fertig ist, beendet seine Terminierung den Teilprozess, und die übrigen Zweige werden abgebrochen.'
    : 'In beliebiger Reihenfolge: Eine Person erledigt jeden Zweig genau einmal, einen nach dem anderen; die Reihenfolge ist egal. Die Rechnung nimmt die Reihenfolge der Liste an.'
}

/**
 * Rahmen (im BPMN ein aufgeklappter Teilprozess) in einer Bahn. Abschnitt und
 * „für jedes Stück“: innerer Start, der Körper, inneres Ende. „Weiter beim
 * ersten“: innerer Start, paralleles Gateway, die Zweige gestapelt, jeder mit
 * einer Terminierung in der Spalte hinter dem breitesten Zweig; der Rahmen hat
 * einen Ausgang, wenn ein Zweig sie erreicht. „In beliebiger Reihenfolge“
 * (Ad-hoc): je Zweig eine Aktivität ohne Sequenzfluss, ohne Start und Ende;
 * Ein- und Austritt auf der Höhe der ersten.
 *
 * Kopfspur oben, Fußspur unten. Der äußerste Rahmen fängt die Fehler-Enden
 * darin; `fehler` nennt sie, die Randereignisse dafür legt `layoutRandwege`
 * wie Unterbrechungen. Trägt der Rahmen eine Markierung (Mehrfachinstanz,
 * Ad-hoc), bleibt die Mitte der Unterkante frei; reicht der Platz für die
 * Randereignisse nicht, bekommt der Rahmen am Ende leere Spalten.
 * `blockId`: Baustein im Modell, falls nicht `b` selbst (eingebettete Zweige).
 */
function layoutRahmen(b: Rahmenbaustein, bahn: string, ctx: Kontext, marke?: MehrfachMarke, blockId: Id = b.id): { teil: Teil; fehler: string[] } {
  const eigeneBahn = ctx.bahnZwang ?? rahmenBahn(b, bahn, ctx)
  const id = xmlId(b.id)
  const art = rahmenArt(b)
  const aussen = { bahnZwang: ctx.bahnZwang, rahmen: ctx.rahmen }
  ctx.bahnZwang = eigeneBahn
  ctx.rahmen = id
  let aktivitaeten: string[] | undefined
  let adhocFertig = false
  let koerper: Teil
  if (b.typ !== 'parallel') koerper = layoutSequenz(b.koerper.schritte, eigeneBahn, ctx)
  else if (b.art === 'erster') koerper = layoutVerzweigung(b, eigeneBahn, ctx)
  else {
    const adhoc = layoutAdhoc(b, eigeneBahn, ctx)
    koerper = adhoc.teil
    aktivitaeten = adhoc.aktivitaeten
    adhocFertig = adhoc.fertig
  }
  const mitStart = art !== 'adhoc'
  const startId = xmlId(`${b.id}_start`)
  const endeId = xmlId(`${b.id}_ende`)
  // Kopfspur über dem Inhalt, eine Spalte für den inneren Start
  verschiebe(koerper, mitStart ? 1 : 0, new Map([[eigeneBahn, 1]]))
  const ankerSpur = koerper.anker.get(eigeneBahn) ?? 1
  const t = neuerTeil(eigeneBahn)
  if (mitStart) t.knoten.push(knoten(ctx, { id: startId, art: 'start', name: '', blockId, bahn: eigeneBahn, spalte: 0, spur: ankerSpur }))
  uebernimm(t, koerper)
  // Läuft der Körper nie normal zu Ende (jeder Weg endet vorher), gibt es kein inneres Ende und, außer ohne Stück, keinen Ausgang.
  // „Weiter beim ersten“ endet in den Terminierungen seiner Zweige, ohne eigenes Ende.
  const normalesEnde = art === 'erster' ? false : art === 'adhoc' ? adhocFertig : !koerper.eintritt || koerper.austritt !== null
  // Fehler steigen durch geschachtelte Rahmen auf; nur der äußerste fängt sie, je Ergebnis ein Randereignis.
  const fehler = aussen.rahmen === null ? [...new Set(koerper.knoten.filter((k) => k.art === 'ende' && k.fehler).map((k) => k.fehler!))] : []
  const randAnzahl = fehler.length + unterbrechungenVon(b).length
  const inhaltBis = art === 'adhoc' ? koerper.breite - 1 : normalesEnde ? 1 + koerper.breite : koerper.breite
  const endSpalte = Math.max(inhaltBis, spaltenFuerRand(randAnzahl, !!marke || art === 'adhoc'))
  if (art === 'adhoc') {
    // keine Sequenzflüsse im Ad-hoc-Rahmen
  } else if (normalesEnde) {
    t.knoten.push(knoten(ctx, { id: endeId, art: 'ende', name: '', blockId, bahn: eigeneBahn, spalte: endSpalte, spur: ankerSpur }))
    t.kanten.push(kante(ctx, startId, koerper.eintritt ?? endeId))
    if (koerper.eintritt && koerper.austritt) t.kanten.push(kanteAus(ctx, koerper.austritt, endeId))
  } else if (koerper.eintritt) t.kanten.push(kante(ctx, startId, koerper.eintritt))
  // Rücksprünge über die Grenze meldet die Prüfung als Fehler; im BPMN wären sie ungültig und entfallen.
  t.spruenge = []
  ctx.bahnZwang = aussen.bahnZwang
  ctx.rahmen = aussen.rahmen

  const inhalt = Math.max(ankerSpur + 1, (koerper.hoehe.get(eigeneBahn) ?? 0) + 1)
  const fussSpur = inhalt
  belege(t, eigeneBahn, fussSpur + 1)
  const name = b.typ === 'parallel' ? parallelName(b) : b.name
  const doku = rahmenDoku(b)
  t.rahmen.push({ id, blockId, art, name, bahn: eigeneBahn, eltern: aussen.rahmen, spalteVon: 0, spalteBis: endSpalte, spurVon: 0, spurBis: fussSpur, ankerSpur, zweigPfad: [], ...(marke ? { mehrfach: marke } : {}), ...(aktivitaeten ? { aktivitaeten } : {}), ...(doku ? { doku } : {}) })
  t.breite = endSpalte + 1
  t.eintritt = id
  // Ein Mehrfach-Rahmen ohne Stück ist sofort fertig: Dann geht es auch ohne inneres Ende hinaus.
  const ohneStueck = !!marke && kannNull(anzahlVerteilung(marke.anzahl, marke.streuung))
  // „Weiter beim ersten“ geht hinaus, sobald ein Zweig seine Terminierung erreicht.
  const terminiert = art === 'erster' && koerper.knoten.some((k) => k.terminierung && k.rahmen === id)
  t.austritt = normalesEnde || ohneStueck || terminiert ? { knoten: id, name: '', doku: '' } : null
  t.austrittsBahn = eigeneBahn
  t.anker.set(eigeneBahn, ankerSpur)
  return { teil: t, fehler }
}

/** Ein Weg, der an einem Randereignis beginnt: Ausnahmeweg einer Unterbrechung oder Ausstieg aus einem Rahmen für ein Ergebnis. */
interface Randweg {
  randId: string
  name: string
  doku: string
  ereignis: 'nachricht' | 'zeit' | null
  /** Fehler-Randereignis: Kennung des bpmn:error */
  fehler?: string
  unterbrechend: boolean
  /** Absender einer Nachricht (externer Beteiligter) */
  von: Id | null
  /** Anteil (unterbrechend) bzw. Anzahl je Ausführung (Nebenweg), für das Tokenspiel */
  anteil?: number
  teil: Teil
  /** Geht danach hinter dem Schritt weiter */
  weiter: boolean
  /** Rücksprungziel eines Wegs ohne Schritte */
  sprung?: Id
  leer: boolean
  /** Spur der Linie eines leeren Wegs, der weiterführt */
  linie?: Spur
  /** Beginnt in der Bahn des Schritts; sonst wechselt der Fluss die Höhe über die Abgangsspur */
  inBahn: boolean
}

const ZEITPUNKT_TEXT: Record<Unterbrechung['zeitpunkt'], string> = { vorher: 'bevor jemand anfängt', waehrend: 'während der Arbeit', unbekannt: 'zu einem unbekannten Zeitpunkt' }

/** Dokumentation eines Randereignisses: wie oft, wann, was danach passiert. */
function unterbrechungDoku(b: Unterbrechbar, u: Unterbrechung, anteil: number, std: number): string {
  if (!u.unterbrechend) {
    return `Läuft nebenher, im Schnitt ${formatiereZahl(anteil, 2)}-mal je Ausführung${u.art === 'zeit' ? ` nach ${formatiereDauer(u.fristMin, std)}` : ''}; der Schritt läuft weiter, der Nebenweg endet für sich`
  }
  const wann =
    u.art === 'zeit'
      ? `Frist ${formatiereDauer(u.fristMin, std)} ab Eingang, überschritten in ${formatiereProzent(anteil, 1)} der Ausführungen`
      : `Kommt in ${formatiereProzent(anteil, 1)} der Ausführungen, ${b.typ === 'aufgabe' ? `meist ${ZEITPUNKT_TEXT[u.zeitpunkt]}` : 'im Schnitt nach der Hälfte'}`
  const danach = u.ende !== null ? `danach endet der Vorgang („${u.ende}“)` : u.zurueckZu !== null ? 'danach zurück zu einem früheren Schritt' : 'danach weiter hinter dem Schritt'
  return `${wann}; bricht die Arbeit ab; ${danach}`
}

/**
 * Schritt mit Randereignissen (Block „Schritt mit Unterbrechungen“), gelegt wie
 * eine Verzweigung: Der Schritt steht vorn (Aufgabe oder Rahmen), jeder
 * Ausnahmeweg bekommt dahinter ein eigenes Band unter dem Band des Schritts,
 * gestapelt wie Zweige, auch in anderen Bahnen. Der normale Ausgang läuft gerade
 * weiter; führen Ausnahmewege danach weiter, steht hinter dem breitesten Weg eine
 * Zusammenführung. Die Randereignisse sitzen auf der Unterkante, von rechts nach
 * links: zuerst die Wege, die über die Abgangsspur in eine andere Höhe wechseln,
 * dann die übrigen in der Reihenfolge ihrer Bänder. So schachteln sich die
 * Abgänge ohne Kreuzung. Die Abgangsspur liegt dünn direkt unter dem Schritt und
 * trägt auch die Nachrichtenflüsse zu den Randereignissen.
 */
function layoutRandwege(b: Block, schritt: Teil, fehler: string[], ctx: Kontext): Teil {
  const bahn = schritt.austrittsBahn
  const wirt = schritt.eintritt!
  const ws = schritt.breite
  const anteile = unterbrechungsAnteile(b)
  const wege: Randweg[] = []
  // Unterbrechungen gibt es nur an Aufgabe, Abschnitt und „für jedes Stück“; Fehler-Randereignisse an jedem äußersten Rahmen
  for (const u of unterbrechungenVon(b)) {
    // Ein Nebenweg läuft neben dem Schritt her
    const teil = nebenher(ctx, !u.unterbrechend, () => layoutSequenz(u.schritte, bahn, ctx))
    const leer = teil.eintritt === null
    const anteil = u.unterbrechend ? (anteile.je.get(u.id) ?? 0) : nebenwegAnzahl(u)
    const weg: Randweg = { randId: xmlId(`${u.id}_rand`), name: u.bezeichnung, doku: unterbrechungDoku(b as Unterbrechbar, u, anteil, ctx.stunden), ereignis: u.art, unterbrechend: u.unterbrechend, von: u.art === 'nachricht' ? u.von : null, anteil, teil, weiter: false, leer, inBahn: true }
    const mitEnde = (name: string, art: Pick<LayoutKnoten, 'fehler' | 'terminierung' | 'doku'> = {}) => {
      const endeId = xmlId(`${u.id}_ende`)
      const endBahn = teil.austrittsBahn
      const spur = teil.anker.get(endBahn) ?? 0
      teil.knoten.push(knoten(ctx, { id: endeId, art: 'ende', name, blockId: b.id, bahn: endBahn, spalte: teil.breite, spur, ...art }))
      belege(teil, endBahn, spur + 1)
      if (teil.austritt) teil.kanten.push(kanteAus(ctx, teil.austritt, endeId))
      if (leer) teil.eintritt = endeId
      teil.breite += 1
      teil.austritt = null
    }
    if (!u.unterbrechend) {
      // Nebenweg: eigenes Ende ohne Ergebnis, auch in einem Rahmen kein Fehler-Ende (der Rahmen wartet auf ihn)
      mitEnde('')
    } else if (u.ende !== null) {
      // Ende je nach Ort: in einem Rahmen ein Fehler-Ende, das der äußerste Rahmen fängt; neben gleichzeitig laufenden Schritten eine Terminierung
      mitEnde(u.ende, endeArt(ctx, u.ende))
    } else if (u.zurueckZu !== null) {
      // Die Kante zeichnet der Rücksprungbereich; ohne Schritte beginnt sie am Randereignis.
      if (leer) weg.sprung = u.zurueckZu
      else if (teil.austritt) teil.spruenge.push({ von: teil.austritt.knoten, ziel: u.zurueckZu, name: teil.austritt.name, doku: teil.austritt.doku, anteil: teil.austritt.anteil, abgang: teil.austritt.abgang })
      teil.austritt = null
    } else weg.weiter = true
    if (leer && weg.weiter) belege(teil, bahn, 1)
    merkeZweig(teil, randZweig(b.id), wege.length)
    wege.push(weg)
  }
  // Ausstieg aus dem Rahmen für ein Ergebnis: Fehler-Randereignis, dahinter ein Ende mit dem Ergebnis
  const ergebnis = new Map([...ctx.fehler].map(([e, f]) => [f, e]))
  fehler.forEach((f, j) => {
    const teil = neuerTeil(bahn)
    const zielId = xmlId(`${b.id}_fehler_${j + 1}_ende`)
    // Liegt der äußerste Rahmen neben gleichzeitig laufenden Schritten, beendet eine Terminierung den ganzen Vorgang.
    teil.knoten.push(knoten(ctx, { id: zielId, art: 'ende', name: ergebnis.get(f) ?? '', blockId: b.id, bahn, spalte: 0, spur: 0, ...(ctx.nebenlaeufig ? { terminierung: true, doku: ABBRUCH_DOKU } : {}) }))
    belege(teil, bahn, 1)
    teil.breite = 1
    teil.eintritt = zielId
    merkeZweig(teil, randZweig(b.id), wege.length)
    wege.push({ randId: xmlId(`${b.id}_fehler_${j + 1}`), name: '', doku: '', ereignis: null, fehler: f, unterbrechend: true, von: null, teil, weiter: false, leer: false, inBahn: true })
  })

  // Beginnt der Weg in der Bahn des Schritts, läuft der Abgang senkrecht bis auf seine Höhe; sonst über die Abgangsspur.
  for (const w of wege) {
    if (w.sprung !== undefined) w.inBahn = false
    else if (!w.leer || !w.weiter) w.inBahn = (w.teil.knoten.find((k) => k.id === w.teil.eintritt)?.bahn ?? w.teil.rahmen.find((r) => r.id === w.teil.eintritt)?.bahn) === bahn
  }
  const mitAbgangsspur = wege.some((w) => !w.inBahn || w.von)
  const hs = schritt.hoehe.get(bahn) ?? 1
  const abgangsspur = mitAbgangsspur ? hs : undefined
  // Bänder stapeln: in der Bahn des Schritts unter ihm (und der Abgangsspur), in anderen Bahnen von oben
  const versatz = new Map<string, number>([[bahn, hs + (mitAbgangsspur ? 1 : 0)]])
  for (const w of wege) {
    const d = new Map<string, number>()
    for (const bz of w.teil.hoehe.keys()) d.set(bz, versatz.get(bz) ?? 0)
    verschiebe(w.teil, ws, d)
    if (w.leer && w.weiter) w.linie = { bahn, spur: d.get(bahn) ?? 0 }
    for (const [bz, h] of w.teil.hoehe) versatz.set(bz, (versatz.get(bz) ?? 0) + h)
  }
  // Bahnwechsel neben Rahmen: Bausteine, deren senkrechte Stücke einen Rahmen eines anderen Wegs querten, rücken dahinter.
  for (const w of wege) {
    for (const blk of w.teil.bloecke) {
      const ab = ctx.schub.get(blk.id)
      if (ab !== undefined && ab > blk.start) rueckeAb(w.teil, blk.start, ab - blk.start)
    }
  }
  const maxBreite = Math.max(1, ...wege.map((w) => w.teil.breite))

  const t = neuerTeil(bahn)
  uebernimm(t, schritt)
  t.eintritt = schritt.eintritt
  t.anker = new Map(schritt.anker)
  for (const w of wege) {
    t.knoten.push(...w.teil.knoten)
    t.kanten.push(...w.teil.kanten)
    t.spruenge.push(...w.teil.spruenge)
    t.rahmen.push(...w.teil.rahmen)
  }
  for (const [bz, h] of versatz) belege(t, bz, h)

  // Plätze auf der Unterkante von rechts, Höhen der waagerechten Stücke darunter. Über die Abgangsspur zuerst der Weg
  // mit dem höchsten Ziel (Bahn weiter oben, dann Band weiter oben), Rücksprünge zuletzt: So kreuzen sich die Abgänge nicht.
  const bahnNr = (b: string) => (b === OHNE_ROLLE ? ctx.rollen.length : ctx.rollen.findIndex((r) => r.id === b))
  const zielHoehe = (w: Randweg): [number, number] => {
    if (w.sprung !== undefined) return [bahnNr(bahn), Infinity]
    const k = w.teil.knoten.find((x) => x.id === w.teil.eintritt)
    const r = w.teil.rahmen.find((x) => x.id === w.teil.eintritt)
    return [bahnNr(k?.bahn ?? r?.bahn ?? bahn), k?.spur ?? r?.ankerSpur ?? 0]
  }
  const ueberAbgangsspur = wege.filter((w) => !w.inBahn).sort((a, b) => {
    const [ba, sa] = zielHoehe(a)
    const [bb, sb] = zielHoehe(b)
    return ba - bb || sa - sb
  })
  const reihe = [...ueberAbgangsspur, ...wege.filter((w) => w.inBahn)]
  const nachrichten = [...reihe].reverse().filter((w) => w.von)
  const ueberSpur = reihe.filter((w) => !w.inBahn)
  reihe.forEach((w, nr) => {
    const ziel = w.linie?.spur ?? w.teil.knoten.find((k) => k.id === w.teil.eintritt)?.spur ?? w.teil.rahmen.find((r) => r.id === w.teil.eintritt)?.ankerSpur ?? 0
    const nachrichtStufe = w.von ? nachrichten.indexOf(w) : undefined
    const stufe = w.inBahn ? undefined : nachrichten.length + ueberSpur.indexOf(w)
    t.knoten.push(
      knoten(ctx, {
        id: w.randId,
        art: 'rand',
        name: w.name,
        blockId: b.id,
        bahn,
        spalte: ws - 1,
        spur: w.inBahn ? ziel : abgangsspur!,
        wirt,
        ereignis: w.ereignis,
        unterbrechend: w.unterbrechend,
        von: w.von,
        randLage: { nr, stufe, nachrichtStufe, abgangsspur },
        ...(w.fehler ? { fehler: w.fehler } : {}),
        ...(w.doku ? { doku: w.doku } : {}),
      }),
    )
  })
  for (const w of wege) {
    if (w.sprung !== undefined) t.spruenge.push({ von: w.randId, ziel: w.sprung, name: '', doku: w.doku, anteil: w.anteil, abgang: true })
    else if (!w.leer || !w.weiter) t.kanten.push(kante(ctx, w.randId, w.teil.eintritt!, { abgang: true, anteil: w.anteil, doku: w.doku }))
  }

  // Normaler Ausgang und Ausnahmewege, die weiterführen; ab zweien eine Zusammenführung hinter dem breitesten Weg
  const weiterWege = wege.filter((w) => w.weiter && (w.leer || w.teil.austritt !== null))
  const anzahl = (schritt.austritt ? 1 : 0) + weiterWege.length
  if (anzahl >= 2) {
    const zuId = xmlId(`${b.id}_weiter`)
    t.knoten.push(knoten(ctx, { id: zuId, art: 'xor', name: '', blockId: b.id, bahn, spalte: ws + maxBreite, spur: schritt.anker.get(bahn) ?? 0, richtung: 'zu' }))
    if (schritt.austritt) t.kanten.push(kanteAus(ctx, schritt.austritt, zuId))
    for (const w of weiterWege) {
      if (w.leer) t.kanten.push(kante(ctx, w.randId, zuId, { abgang: true, anteil: w.anteil, doku: w.doku, ueber: w.linie }))
      else t.kanten.push(kanteAus(ctx, w.teil.austritt!, zuId))
    }
    t.austritt = { knoten: zuId, name: '', doku: '' }
    t.austrittsBahn = bahn
    t.breite = ws + maxBreite + 1
  } else if (anzahl === 1 && schritt.austritt) {
    t.austritt = schritt.austritt
    t.austrittsBahn = bahn
    t.breite = ws + maxBreite
  } else if (anzahl === 1) {
    const w = weiterWege[0]
    t.austritt = w.leer ? { knoten: w.randId, name: '', doku: w.doku, ueber: w.linie, anteil: w.anteil, abgang: true } : w.teil.austritt
    t.austrittsBahn = w.leer ? bahn : w.teil.austrittsBahn
    t.breite = ws + maxBreite
  } else {
    t.austritt = null
    t.breite = ws + maxBreite
  }
  return t
}

// ---------------------------------------------------------------------------
// Geometrie

function textBreite(text: string): number {
  return text.length * 6.2 + 6
}

function zeilen(text: string): number {
  return Math.max(1, Math.ceil(textBreite(text) / MASSE.beschriftungBreite))
}

/** Beschriftungsfeld, dessen Mitte bei (cx, cy) liegt; bpmn-js zentriert den Text darin. */
function feldUm(cx: number, cy: number, text: string): Rechteck {
  const breite = Math.min(MASSE.beschriftungBreite, textBreite(text))
  const hoehe = zeilen(text) * MASSE.zeile
  return { x: cx - breite / 2, y: cy - hoehe / 2, breite, hoehe }
}

function istGateway(art: KnotenArt): boolean {
  return art === 'xor' || art === 'und' || art === 'oder' || art === 'ereignisgateway'
}

function groesse(art: KnotenArt): { breite: number; hoehe: number } {
  if (art === 'aufgabe') return MASSE.aufgabe
  if (istGateway(art)) return MASSE.gateway
  return MASSE.ereignis
}

/** Zeilen des Rahmennamens bei gegebener Innenbreite */
function rahmenZeilen(name: string, breite: number): number {
  return name ? Math.max(1, Math.ceil(textBreite(name) / Math.max(40, breite - 2 * RAHMEN.text))) : 0
}

/** Bahn des ersten Schritts: die erste Aufgabe in Lesereihenfolge, oder ein Abschnitt davor mit seiner Bahn. */
function ersteBahnVon(p: Prozess, ctx: Kontext): string {
  for (const { block } of durchlaufe(p.ablauf)) {
    if (block.typ === 'aufgabe') return bahnVon(ctx, block.rolleId)
    if (istRahmen(block)) {
      const r = rahmenRolle(block, (x) => (x !== null && ctx.rollenIds.has(x) ? x : null))
      if (r !== undefined) return r === null ? OHNE_ROLLE : r
    }
  }
  return OHNE_ROLLE
}

/** Legt den Prozess; rückt Bausteine hinter Rahmen, solange ein senkrechtes Stück eines fremden Flusses einen Rahmen quert. */
export function berechneLayout(p: Prozess): Layout {
  const schub = new Map<Id, number>()
  let layout = layoutRunde(p, schub)
  for (let runde = 0; runde < 12; runde++) {
    let neu = false
    for (const [block, ab] of hinterRahmen(layout)) {
      if ((schub.get(block) ?? -1) >= ab) continue
      schub.set(block, ab)
      neu = true
    }
    if (!neu) break
    layout = layoutRunde(p, schub)
  }
  return layout
}

/** Liegt die Ebene `ebene` (ein Rahmen oder null) im Rahmen `id` oder ist sie er selbst? */
function liegtIn(ebene: string | null, id: string, eltern: Map<string, string | null>): boolean {
  for (let x = ebene; x !== null; x = eltern.get(x) ?? null) if (x === id) return true
  return false
}

function schneidet(p: Punkt, q: Punkt, r: Rechteck): boolean {
  return Math.min(p.x, q.x) < r.x + r.breite - 1 && Math.max(p.x, q.x) > r.x + 1 && Math.min(p.y, q.y) < r.y + r.hoehe - 1 && Math.max(p.y, q.y) > r.y + 1
}

/**
 * Bahnwechsel neben Rahmen: Für jedes Stück eines Sequenzflusses, das durch
 * einen fremden Rahmen läuft, ein Baustein mit seiner kleinsten Startspalte
 * relativ zur Verzweigung. Betrachtet wird die Verzweigung, in der das Stück
 * und der Rahmen in verschiedenen Zweigen liegen, und dort je Zweig der oberste
 * Baustein: auf der einen Seite der, der den Eigentümer des Stücks enthält (das
 * Ziel, denn die Höhe wechselt in der Lücke davor; bei Rücksprüngen und
 * senkrechten Abgängen aus einer Raute die Quelle), auf der anderen der mit dem
 * Rahmen. Der Baustein im weiter unten liegenden Zweig rückt samt allem
 * dahinter hinter den anderen. Weil immer der untere Zweig weicht, schaukelt
 * sich nichts auf.
 */
function hinterRahmen(l: Layout): [Id, number][] {
  const knotenNach = new Map(l.knoten.map((k) => [k.id, k]))
  const rahmenNach = new Map(l.rahmen.map((r) => [r.id, r]))
  const eltern = new Map(l.rahmen.map((r) => [r.id, r.eltern]))
  // letzte Spalte je Baustein eines Zweigs (Eintrag `Verzweigung|Zweig|Baustein`)
  const letzte = new Map<string, number>()
  const merke = (eintrag: string, spalte: number) => letzte.set(eintrag, Math.max(letzte.get(eintrag) ?? -Infinity, spalte))
  for (const k of l.knoten) for (const e of k.zweigPfad ?? []) merke(e, k.spalte)
  for (const r of l.rahmen) for (const e of r.zweigPfad) merke(e, r.spalteBis)
  const ergebnis: [Id, number][] = []
  for (const e of l.kanten) {
    const quelle = knotenNach.get(e.von)
    const quellRahmen = rahmenNach.get(e.von)
    const ebene = quellRahmen ? quellRahmen.eltern : (quelle?.rahmen ?? null)
    for (const r of l.rahmen) {
      if (e.von === r.id || e.nach === r.id || liegtIn(ebene, r.id, eltern)) continue
      const i = e.punkte.findIndex((p, j) => j > 0 && schneidet(e.punkte[j - 1], p, r))
      if (i < 0) continue
      const x = e.punkte[i].x
      const ersteSenkrechte = e.punkte.findIndex((p, j) => j > 0 && Math.abs(p.x - e.punkte[j - 1].x) < 0.5 && Math.abs(p.y - e.punkte[j - 1].y) > 0.5)
      const ausQuelle = !!e.sprung || (quelle !== undefined && Math.abs(x - (quelle.x + quelle.breite / 2)) < 0.5) || (!!e.ueber && i === ersteSenkrechte)
      const eigner = ausQuelle ? e.von : e.nach
      const pfad = knotenNach.get(eigner)?.zweigPfad ?? rahmenNach.get(eigner)?.zweigPfad ?? []
      for (let j = 0; j < Math.min(pfad.length, r.zweigPfad.length); j++) {
        const [v1, z1, b1] = pfad[j].split('|')
        const [v2, z2, b2] = r.zweigPfad[j].split('|')
        if (v1 !== v2) break
        if (z1 !== z2) {
          // Anfang des Blocks: die Raute der Verzweigung, der Ad-hoc-Rahmen bzw. der Schritt mit Randereignissen (Aufgabe oder Rahmen)
          const schritt = v1.startsWith(RAND_ZWEIG) ? v1.slice(RAND_ZWEIG.length) : null
          const anker = schritt !== null ? (knotenNach.get(xmlId(schritt)) ?? rahmenNach.get(xmlId(schritt))) : (knotenNach.get(xmlId(`${v1}_auf`)) ?? rahmenNach.get(xmlId(v1)))
          if (!anker || !b1 || !b2) break
          const anfang = 'spalteVon' in anker ? anker.spalteVon : anker.spalte
          // Der Baustein im unteren Zweig rückt hinter den im oberen.
          if (Number(z1) > Number(z2)) ergebnis.push([b1, letzte.get(r.zweigPfad[j])! - anfang + 1])
          else ergebnis.push([b2, letzte.get(pfad[j])! - anfang + 1])
          break
        }
        if (pfad[j] !== r.zweigPfad[j]) break
      }
    }
  }
  return ergebnis
}

function layoutRunde(p: Prozess, schub: Map<Id, number>): Layout {
  const ctx: Kontext = { rollenIds: new Set(p.rollen.map((r) => r.id)), rollen: p.rollen, kantenNr: 0, bahnZwang: null, rahmen: null, fehler: new Map(), schub, stunden: p.arbeitsstundenProTag, nebenlaeufig: false }
  const ersteBahn = ersteBahnVon(p, ctx)

  const haupt = layoutSequenz(p.ablauf.schritte, ersteBahn, ctx)
  verschiebe(haupt, 1, new Map())
  const t = neuerTeil(ersteBahn)
  const eintrittsBahn = haupt.knoten.find((k) => k.id === haupt.eintritt)?.bahn ?? haupt.rahmen.find((r) => r.id === haupt.eintritt)?.bahn
  const startSpur = eintrittsBahn === ersteBahn ? (haupt.anker.get(ersteBahn) ?? 0) : 0
  const startEreignis = p.ausloeser.art === 'manuell' ? null : p.ausloeser.art
  t.knoten.push(knoten(ctx, { id: 'Start', art: 'start', name: p.ausloeser.text, blockId: null, bahn: ersteBahn, spalte: 0, spur: startSpur, ereignis: startEreignis, von: p.ausloeser.art === 'nachricht' ? (p.ausloeser.von ?? null) : null }))
  belege(t, ersteBahn, startSpur + 1)
  uebernimm(t, haupt)
  if (haupt.eintritt === null) {
    t.knoten.push(knoten(ctx, { id: 'Ende', art: 'ende', name: p.ergebnis, blockId: null, bahn: ersteBahn, spalte: 1, spur: startSpur }))
    t.kanten.push(kante(ctx, 'Start', 'Ende'))
  } else {
    t.kanten.push(kante(ctx, 'Start', haupt.eintritt))
    if (haupt.austritt) {
      // Das Ende steht auf der Hauptlinie der Bahn, in der der Ablauf zuletzt ist.
      const spur = haupt.anker.get(haupt.austrittsBahn) ?? 0
      t.knoten.push(knoten(ctx, { id: 'Ende', art: 'ende', name: p.ergebnis, blockId: null, bahn: haupt.austrittsBahn, spalte: 1 + haupt.breite, spur }))
      belege(t, haupt.austrittsBahn, spur + 1)
      t.kanten.push(kanteAus(ctx, haupt.austritt, 'Ende'))
    }
  }

  // Bahnen in der Reihenfolge der Rollen, „ohne Rolle“ zuletzt
  const benutzt = new Set([...t.knoten.map((k) => k.bahn), ...t.rahmen.map((r) => r.bahn)])
  const reihenfolge = [...p.rollen.map((r) => r.id).filter((id) => benutzt.has(id)), ...(benutzt.has(OHNE_ROLLE) ? [OHNE_ROLLE] : [])]
  const gitter = t.knoten.filter((k) => k.art !== 'rand')

  const spurHoehen = new Map<string, number[]>()
  for (const bahn of reihenfolge) {
    let anzahl = t.hoehe.get(bahn) ?? 1
    const mitKnoten = new Set<number>()
    for (const k of gitter) {
      if (k.bahn !== bahn) continue
      mitKnoten.add(k.spur)
      anzahl = Math.max(anzahl, k.spur + 1)
    }
    for (const e of t.kanten) {
      for (const s of [e.ueber, e.rueck, e.sprung]) if (s && s.bahn === bahn) anzahl = Math.max(anzahl, s.spur + 1)
    }
    for (const r of t.rahmen) if (r.bahn === bahn) anzahl = Math.max(anzahl, r.spurBis + 1)
    const hoehen = Array.from({ length: anzahl }, (_, i) => (mitKnoten.has(i) ? MASSE.spur : MASSE.spurDuenn))
    // Die Kopfspur fasst den Namen des Rahmens
    for (const r of t.rahmen) {
      if (r.bahn !== bahn) continue
      const breite = (r.spalteBis - r.spalteVon) * MASSE.spalte + 2 * (MASSE.ereignis.breite / 2 + RAHMEN_RAND.innen)
      const noetig = RAHMEN.oben + RAHMEN.text + rahmenZeilen(r.name, breite) * RAHMEN.zeile + 6
      hoehen[r.spurVon] = Math.max(hoehen[r.spurVon], noetig)
    }
    // Die Abgangsspur unter einem Schritt fasst alle waagerechten Stücke darunter (Abgänge und Nachrichten), 8 px auseinander
    for (const k of t.knoten) {
      const lage = k.randLage
      if (k.art !== 'rand' || k.bahn !== bahn || lage?.abgangsspur === undefined) continue
      const stufen = Math.max(lage.stufe ?? 0, lage.nachrichtStufe ?? 0)
      // Abstand der Unterkante des Schritts zur Oberkante der Abgangsspur: eine Aufgabe sitzt mittig in ihrer Spur, ein Rahmen endet in der Mitte seiner Fußspur
      const rahmenWirt = t.rahmen.find((r) => r.id === k.wirt)
      const darueber = hoehen[lage.abgangsspur - 1] ?? MASSE.spur
      const abstand = rahmenWirt ? darueber / 2 : (darueber - MASSE.aufgabe.hoehe) / 2
      const noetig = RAND.ersteStufe + stufen * RAND.stufe + 12 - abstand
      hoehen[lage.abgangsspur] = Math.max(hoehen[lage.abgangsspur] ?? MASSE.spurDuenn, noetig)
    }
    spurHoehen.set(bahn, hoehen)
  }

  const maxSpalte = Math.max(0, ...gitter.map((k) => k.spalte))
  const inhaltX = 2 * MASSE.kopf + MASSE.rand
  const bahnen: LayoutBahn[] = []
  const bahnOben = new Map<string, number>()
  let y = 0
  for (const bahn of reihenfolge) {
    const hoehe = 2 * MASSE.bahnPolster + (spurHoehen.get(bahn) ?? []).reduce((s, h) => s + h, 0)
    const rolle = p.rollen.find((r) => r.id === bahn)
    bahnen.push({ schluessel: bahn, name: rolle ? rolle.name || 'Unbenannte Rolle' : 'Ohne Rolle', rolleId: rolle?.id ?? null, x: MASSE.kopf, y, breite: 0, hoehe })
    bahnOben.set(bahn, y)
    y += hoehe
  }

  const spurOben = (s: Spur): number => {
    const hoehen = spurHoehen.get(s.bahn) ?? []
    let oben = (bahnOben.get(s.bahn) ?? 0) + MASSE.bahnPolster
    for (let i = 0; i < s.spur; i++) oben += hoehen[i] ?? MASSE.spurDuenn
    return oben
  }
  const spurMitte = (s: Spur): number => spurOben(s) + ((spurHoehen.get(s.bahn) ?? [])[s.spur] ?? MASSE.spurDuenn) / 2
  const spalteBasis = (spalte: number): number => inhaltX + spalte * MASSE.spalte + MASSE.spalte / 2

  // Höhe und Größe der Knoten; die x-Lage folgt aus der Linienführung (volle Lücken werden breiter)
  const belegt = new Map<number, number>()
  for (const k of t.knoten) {
    const g = groesse(k.art)
    Object.assign(k, { breite: g.breite, hoehe: g.hoehe })
    if (k.art === 'rand') continue
    const cy = spurMitte({ bahn: k.bahn, spur: k.spur })
    k.y = cy - g.hoehe / 2
    const beschriftungHalb = k.name && k.art !== 'aufgabe' ? Math.min(MASSE.beschriftungBreite, textBreite(k.name)) / 2 : 0
    belegt.set(k.spalte, Math.max(belegt.get(k.spalte) ?? 0, g.breite / 2, beschriftungHalb))
  }
  // Rahmen: Höhe aus Kopf- und Fußspur, Anschluss auf der Hauptlinie
  const rahmen: LayoutRahmen[] = t.rahmen.map((r) => {
    const oben = spurOben({ bahn: r.bahn, spur: r.spurVon }) + RAHMEN.oben
    const unten = spurMitte({ bahn: r.bahn, spur: r.spurBis })
    return {
      id: r.id,
      blockId: r.blockId,
      art: r.art,
      name: r.name,
      bahn: r.bahn,
      eltern: r.eltern,
      anschlussY: spurMitte({ bahn: r.bahn, spur: r.ankerSpur }),
      spalteVon: r.spalteVon,
      spalteBis: r.spalteBis,
      zweigPfad: r.zweigPfad,
      ...(r.mehrfach ? { mehrfach: r.mehrfach } : {}),
      ...(r.aktivitaeten ? { aktivitaeten: r.aktivitaeten } : {}),
      ...(r.doku ? { doku: r.doku } : {}),
      x: 0,
      y: oben,
      breite: 0,
      hoehe: unten - oben,
    }
  })
  const eltern = new Map(rahmen.map((r) => [r.id, r.eltern]))
  // Beginnt oder endet ein Rahmen in derselben Spalte wie ein Rahmen darin (Ad-hoc-Rahmen mit eingebettetem Zweig),
  // liegt seine Kante je Ebene 8 px weiter außen; sonst lägen beide Kanten aufeinander.
  const kinderVon = new Map<string, LayoutRahmen[]>()
  for (const r of rahmen) if (r.eltern) kinderVon.set(r.eltern, [...(kinderVon.get(r.eltern) ?? []), r])
  const tiefe = (r: LayoutRahmen, seite: 'links' | 'rechts'): number =>
    Math.max(0, ...(kinderVon.get(r.id) ?? []).filter((c) => (seite === 'links' ? c.spalteVon === r.spalteVon : c.spalteBis === r.spalteBis)).map((c) => tiefe(c, seite) + 1))
  const versatzLinks = new Map(rahmen.map((r) => [r.id, RAHMEN_RAND.ebene * tiefe(r, 'links')]))
  const versatzRechts = new Map(rahmen.map((r) => [r.id, RAHMEN_RAND.ebene * tiefe(r, 'rechts')]))
  // senkrechte Ausdehnung je Knoten samt Beschriftung (Gateways oben, Ereignisse unten)
  const ausdehnung = new Map(
    gitter.map((k) => {
      const h = k.name && k.art !== 'aufgabe' ? zeilen(k.name) * MASSE.zeile + 6 : 0
      return [k.id, istGateway(k.art) ? [k.y - h, k.y + k.hoehe] : [k.y, k.y + k.hoehe + h]] as const
    }),
  )
  const knotenNach = new Map(t.knoten.map((k) => [k.id, k]))
  // Rahmen gelten als belegt, außer für Knoten darin
  const spalteFrei = (spalte: number, y1: number, y2: number, ausser: string[]): boolean =>
    gitter.every((k) => {
      if (k.spalte !== spalte || ausser.includes(k.id)) return true
      const [oben, unten] = ausdehnung.get(k.id)!
      return unten + 4 <= y1 || oben - 4 >= y2
    }) &&
    rahmen.every((r) => {
      if (spalte < r.spalteVon || spalte > r.spalteBis) return true
      if (ausser.some((id) => liegtIn(knotenNach.get(id)?.rahmen ?? null, r.id, eltern))) return true
      return r.y + r.hoehe + 4 <= y1 || r.y - 4 >= y2
    })
  // Ein- und Austritt der Rahmen als Ersatzknoten für die Linienführung: Die Kante endet bzw. beginnt auf der Seitenkante.
  const ersatz = (r: LayoutRahmen, spalte: number, versatz: number): LayoutKnoten => ({
    id: r.id,
    art: 'aufgabe',
    name: '',
    blockId: r.blockId,
    bahn: r.bahn,
    spalte,
    spur: 0,
    rahmen: r.eltern,
    x: 0,
    y: r.anschlussY,
    breite: 2 * ((belegt.get(spalte) ?? 0) + RAHMEN_RAND.innen + versatz),
    hoehe: 0,
  })
  const rahmenEin = new Map(rahmen.map((r) => [r.id, ersatz(r, r.spalteVon, versatzLinks.get(r.id)!)]))
  const rahmenAus = new Map(rahmen.map((r) => [r.id, ersatz(r, r.spalteBis, versatzRechts.get(r.id)!)]))
  const rahmenNach = new Map(rahmen.map((r) => [r.id, r]))

  // Randereignisse auf der Unterkante ihres Wirts, von rechts nach links: Spalte, Abstand des Mittelpunkts von der Spaltenmitte, Unterkante
  const randGeo = new Map<string, { spalte: number; ersteSpalte: number; dx: number; unten: number }>()
  for (const k of t.knoten) {
    if (k.art !== 'rand') continue
    const nr = k.randLage?.nr ?? 0
    const aufgabe = knotenNach.get(k.wirt!)
    const r = rahmenNach.get(k.wirt!)
    if (aufgabe && aufgabe.art !== 'rand') {
      randGeo.set(k.id, { spalte: aufgabe.spalte, ersteSpalte: aufgabe.spalte, dx: MASSE.aufgabe.breite / 2 - RAND.aufgabeRechts - nr * RAHMEN.randAbstand, unten: aufgabe.y + MASSE.aufgabe.hoehe })
    } else if (r) {
      randGeo.set(k.id, { spalte: r.spalteBis, ersteSpalte: r.spalteVon, dx: (belegt.get(r.spalteBis) ?? 0) + RAHMEN_RAND.innen + versatzRechts.get(r.id)! - RAHMEN.randRechts - nr * RAHMEN.randAbstand, unten: r.y + r.hoehe })
    }
  }
  // Der Fluss eines Randereignisses beginnt unten am Kreis und läuft senkrecht bis zur Höhe seines ersten Ziels bzw. seiner Stufe in der Abgangsspur
  const randAus = new Map<string, RandAbgang>()
  for (const e of t.kanten) {
    const k = knotenNach.get(e.von)
    const g = randGeo.get(e.von)
    if (!k || !g) continue
    const stufe = k.randLage?.stufe
    const ziel = rahmenEin.get(e.nach) ?? knotenNach.get(e.nach)
    const hoehe =
      e.ueber && !e.sprung
        ? spurMitte(e.ueber)
        : stufe !== undefined
          ? g.unten + RAND.ersteStufe + stufe * RAND.stufe
          : ziel
            ? ziel.y + ziel.hoehe / 2
            : g.unten + RAND.ersteStufe
    randAus.set(e.von, { knoten: { ...k, spalte: g.spalte, x: 0, y: hoehe, breite: 0, hoehe: 0 }, dx: g.dx, vonY: g.unten + MASSE.ereignis.hoehe / 2 })
  }
  const pools = externePools(p, { x: 0, y: 0, breite: 0, hoehe: y }, t.knoten)
  const auftraege = nachrichtAuftraege(t.knoten, pools, randGeo)
  const linien = fuehreLinien({
    knoten: gitter,
    kanten: t.kanten,
    nachrichten: auftraege,
    spurMitte,
    belegt,
    maxSpalte,
    spalteMitte: spalteBasis,
    linkerRand: 2 * MASSE.kopf,
    rechterRand: MASSE.spalte / 2 + MASSE.rand,
    spalteFrei,
    rahmenEin,
    rahmenAus,
    randAus,
  })

  const poolBreite = linien.spalteMitte(maxSpalte) + MASSE.spalte / 2 + MASSE.rand + linien.zusatzRechts
  for (const b of bahnen) b.breite = poolBreite - MASSE.kopf
  for (const pl of pools) pl.breite = poolBreite
  const pool: Rechteck = { x: 0, y: 0, breite: poolBreite, hoehe: y }

  for (const k of gitter) {
    const cx = linien.spalteMitte(k.spalte)
    k.x = cx - k.breite / 2
    if (k.name && k.art !== 'aufgabe') {
      const oben = istGateway(k.art)
      const h = zeilen(k.name) * MASSE.zeile
      k.beschriftung = feldUm(cx, oben ? k.y - 6 - h / 2 : k.y + k.hoehe + 6 + h / 2, k.name)
    }
  }
  // Seitenkanten der Rahmen neben dem belegten Bereich der ersten und letzten inneren Spalte
  for (const r of rahmen) {
    const links = linien.spalteMitte(r.spalteVon) - (belegt.get(r.spalteVon) ?? 0) - RAHMEN_RAND.innen - versatzLinks.get(r.id)!
    const rechts = linien.spalteMitte(r.spalteBis) + (belegt.get(r.spalteBis) ?? 0) + RAHMEN_RAND.innen + versatzRechts.get(r.id)!
    r.x = links
    r.breite = rechts - links
    if (r.name) {
      const breite = Math.min(textBreite(r.name), r.breite - 2 * RAHMEN.text)
      const hoehe = rahmenZeilen(r.name, r.breite) * RAHMEN.zeile
      r.beschriftung = { x: r.x + (r.breite - breite) / 2, y: r.y + RAHMEN.text, breite, hoehe }
    }
  }
  // Randereignisse: Mittelpunkt auf der Unterkante des Wirts
  for (const k of t.knoten) {
    const g = randGeo.get(k.id)
    if (!g) continue
    k.x = linien.spalteMitte(g.spalte) + g.dx - k.breite / 2
    k.y = g.unten - k.hoehe / 2
  }

  for (const e of t.kanten) e.punkte = linien.kanten.get(e.id) ?? []

  const nachrichten: LayoutNachricht[] = auftraege.map((n) => {
    const pl = pools.find((x) => x.teilnehmerId === (n.richtung === 'an' ? n.knoten.an : n.knoten.von))!
    return { id: n.id, von: n.richtung === 'an' ? n.knoten.id : pl.id, nach: n.richtung === 'an' ? pl.id : n.knoten.id, punkte: linien.nachrichten.get(n.id) ?? [] }
  })
  platziereBeschriftungen(t.knoten, t.kanten, nachrichten, pools, rahmen, spurMitte)
  const fehler = [...ctx.fehler].map(([name, id]) => ({ id, name }))
  return { knoten: t.knoten, kanten: t.kanten, bahnen, pool, pools, nachrichten, rahmen, fehler }
}

const POOL_HOEHE = 60
const POOL_ABSTAND = 40

/**
 * Externe Teilnehmer abwechselnd über und unter dem Hauptpool: der mit den meisten
 * Nachrichten (meist der Kunde) oben, der zweite unten. So kreuzen sich Nachrichtenflüsse selten.
 */
function externePools(p: Prozess, haupt: Rechteck, knoten: LayoutKnoten[]): LayoutPool[] {
  const pools: LayoutPool[] = []
  let oben = haupt.y
  let unten = haupt.y + haupt.hoehe
  const anzahl = (id: Id) => knoten.filter((k) => k.an === id).length + knoten.filter((k) => k.von === id).length
  const reihenfolge = [...(p.teilnehmer ?? [])].map((tn, i) => ({ tn, i, n: anzahl(tn.id) })).sort((a, b) => b.n - a.n || a.i - b.i)
  reihenfolge.forEach(({ tn }, i) => {
    const lage = i % 2 === 0 ? 'oben' : 'unten'
    const y = lage === 'oben' ? (oben -= POOL_ABSTAND + POOL_HOEHE) : unten + POOL_ABSTAND
    if (lage === 'unten') unten += POOL_ABSTAND + POOL_HOEHE
    pools.push({ id: xmlId(`Pool_${tn.id}`), teilnehmerId: tn.id, name: tn.name || 'Extern', lage, x: haupt.x, y, breite: haupt.breite, hoehe: POOL_HOEHE })
  })
  return pools
}

/**
 * Nachrichtenflüsse je Knoten und Richtung; die Linien legt `fuehreLinien`
 * fest. Eine Nachricht zu einem Randereignis kommt von unten links an den
 * Kreis (45°): ein Stummel hinunter bis zu ihrer Stufe unter dem Schritt,
 * waagerecht in die Lücke vor dem Schritt und dort zum Pool. Eigene
 * Nachrichten einer Aufgabe mit Randereignissen laufen über die Oberkante.
 */
function nachrichtAuftraege(knotenListe: LayoutKnoten[], pools: LayoutPool[], randGeo: Map<string, { spalte: number; ersteSpalte: number; dx: number; unten: number }>): NachrichtAuftrag[] {
  const liste: NachrichtAuftrag[] = []
  const mitRand = new Set(knotenListe.filter((k) => k.art === 'rand').map((k) => k.wirt))
  const diagonal = (MASSE.ereignis.breite / 2) * Math.SQRT1_2
  for (const k of knotenListe) {
    const beide = !!k.an && !!k.von
    for (const richtung of ['von', 'an'] as const) {
      const tn = richtung === 'an' ? k.an : k.von
      const pl = tn ? pools.find((x) => x.teilnehmerId === tn) : undefined
      if (!pl) continue
      const oben = pl.lage === 'oben'
      const g = k.art === 'rand' ? randGeo.get(k.id) : undefined
      liste.push({
        id: `Nachricht_${liste.length + 1}`,
        knoten: k,
        poolRand: oben ? pl.y + pl.hoehe : pl.y,
        oben,
        richtung,
        dx: beide ? (richtung === 'an' ? 15 : -15) : 0,
        ...(mitRand.has(k.id) ? { ueberOben: true } : {}),
        ...(g
          ? {
              rand: {
                spalte: g.spalte,
                dx: g.dx - diagonal,
                y: g.unten + diagonal,
                ebene: g.unten + RAND.ersteStufe + (k.randLage?.nachrichtStufe ?? 0) * RAND.stufe,
                luecke: g.ersteSpalte - 1,
              },
            }
          : {}),
      })
    }
  }
  return liste
}

function gleich(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.5
}

function ueberlappt(a: Rechteck, b: Rechteck): boolean {
  return a.x < b.x + b.breite - 1 && b.x < a.x + a.breite - 1 && a.y < b.y + b.hoehe - 1 && b.y < a.y + a.hoehe - 1
}

function stueckSchneidet(p: Punkt, q: Punkt, r: Rechteck): boolean {
  return Math.min(p.x, q.x) < r.x + r.breite - 1 && Math.max(p.x, q.x) > r.x + 1 && Math.min(p.y, q.y) < r.y + r.hoehe - 1 && Math.max(p.y, q.y) > r.y + 1
}

/** Die vier Kanten eines Rahmens als Linienstücke */
export function rahmenKanten(r: Rechteck): Punkt[][] {
  const a = { x: r.x, y: r.y }
  const b = { x: r.x + r.breite, y: r.y }
  const c = { x: r.x + r.breite, y: r.y + r.hoehe }
  const d = { x: r.x, y: r.y + r.hoehe }
  return [
    [a, b],
    [b, c],
    [c, d],
    [d, a],
  ]
}

/** Mögliche Plätze für die Beschriftung einer Kante, entlang ihrer eigenen Linie vom Start an. */
function plaetzeEntlang(e: LayoutKante): Rechteck[] {
  const breite = Math.min(MASSE.beschriftungBreite, textBreite(e.name))
  const hoehe = zeilen(e.name) * MASSE.zeile
  const feld = (x: number, y: number): Rechteck => ({ x, y, breite, hoehe })
  const plaetze: Rechteck[] = []
  for (let i = 0; i + 1 < e.punkte.length; i++) {
    const p = e.punkte[i]
    const q = e.punkte[i + 1]
    if (gleich(p.y, q.y)) {
      const rechts = q.x > p.x
      const amStart = rechts ? p.x + 4 : p.x - 4 - breite
      const amEnde = rechts ? q.x - 4 - breite : q.x + 4
      plaetze.push(feld(amStart, p.y - 3 - hoehe), feld(amStart, p.y + 3), feld(amEnde, p.y - 3 - hoehe), feld(amEnde, p.y + 3))
      // weiter entlang des Stücks
      for (const t of [0.25, 0.5, 0.75]) {
        const x = amStart + (amEnde - amStart) * t
        plaetze.push(feld(x, p.y - 3 - hoehe), feld(x, p.y + 3))
      }
    } else {
      const oben = Math.min(p.y, q.y)
      const unten = Math.max(p.y, q.y)
      plaetze.push(feld(p.x + 4, oben + 3), feld(p.x - 4 - breite, oben + 3), feld(p.x + 4, unten - 3 - hoehe), feld(p.x - 4 - breite, unten - 3 - hoehe))
      for (const t of [0.25, 0.5, 0.75]) {
        const y = oben + 3 + (unten - oben - 6 - hoehe) * t
        plaetze.push(feld(p.x + 4, y), feld(p.x - 4 - breite, y))
      }
    }
  }
  return plaetze
}

/**
 * Beschriftungen der Flüsse: Bevorzugt steht sie am gewohnten Platz (über dem
 * ersten waagerechten Stück, rechts der Ecke). Liegt dort eine Linie, ein Knoten
 * oder eine andere Beschriftung, nimmt sie den ersten freien Platz entlang ihrer
 * eigenen Linie. Namen von Rahmen stehen fest; Rahmenkanten zählen wie Linien.
 */
function platziereBeschriftungen(knoten: LayoutKnoten[], kanten: LayoutKante[], nachrichten: LayoutNachricht[], pools: LayoutPool[], rahmen: LayoutRahmen[], spurMitte: (s: Spur) => number): void {
  const nachId = new Map(knoten.map((k) => [k.id, k]))
  const feste: Rechteck[] = [...knoten, ...pools, ...rahmen.flatMap((r) => (r.beschriftung ? [r.beschriftung] : []))]
  const linien = [...kanten.map((e) => e.punkte), ...nachrichten.map((n) => n.punkte), ...rahmen.flatMap(rahmenKanten)]
  const platziert: Rechteck[] = []
  const waehle = (plaetze: Rechteck[], eigen: Rechteck | null): Rechteck => {
    let bester = plaetze[0]
    let besteKosten = Infinity
    plaetze.forEach((r, i) => {
      let kosten = i * 0.001
      if (r.x < 2 * MASSE.kopf) kosten += 1000
      for (const h of feste) if (h !== eigen && ueberlappt(r, h)) kosten += 1000
      for (const h of platziert) if (ueberlappt(r, h)) kosten += 100
      for (const punkte of linien) {
        for (let j = 1; j < punkte.length; j++) {
          if (stueckSchneidet(punkte[j - 1], punkte[j], r)) {
            kosten += 10
            break
          }
        }
      }
      if (kosten < besteKosten) {
        besteKosten = kosten
        bester = r
      }
    })
    platziert.push(bester)
    return bester
  }
  // zuerst die Knoten (Frage über dem Gateway, Name unter dem Ereignis), dann die Flüsse
  for (const k of knoten) {
    if (k.art === 'rand' && k.name) {
      // Name eines Randereignisses: entlang seines Abgangs, so nah am Kreis wie möglich
      const e = kanten.find((x) => x.von === k.id)
      if (e) k.beschriftung = waehle(plaetzeEntlang({ ...e, name: k.name }), k)
    } else if (k.beschriftung) k.beschriftung = waehle(plaetzeUm(k, k.beschriftung), k)
  }
  for (const e of kanten) {
    if (!e.name) continue
    const a = nachId.get(e.von)
    e.beschriftung = waehle([...(a ? [beschriftungFuer(e, a, e.ueber ? spurMitte(e.ueber) : null)] : []), ...plaetzeEntlang(e)], null)
  }
}

/** Plätze für die Beschriftung eines Knotens: zuerst der gewohnte, dann links und rechts davon oder auf der anderen Seite. */
function plaetzeUm(k: LayoutKnoten, gewohnt: Rechteck): Rechteck[] {
  const { breite, hoehe } = gewohnt
  const cx = k.x + k.breite / 2
  const cy = k.y + k.hoehe / 2
  const feld = (x: number, y: number): Rechteck => ({ x, y, breite, hoehe })
  if (istGateway(k.art)) {
    // über der Raute mittig, links oben, rechts oben, darunter
    return [gewohnt, feld(cx - 8 - breite, k.y + 2 - hoehe), feld(cx + 8, k.y + 2 - hoehe), feld(cx - breite / 2, k.y + k.hoehe + 6), feld(cx - 8 - breite, k.y + k.hoehe - 2), feld(cx + 8, k.y + k.hoehe - 2)]
  }
  // Ereignis: darunter, darüber, rechts oder links unterhalb bzw. oberhalb der durchgehenden Linie
  return [gewohnt, feld(cx - breite / 2, k.y - 6 - hoehe), feld(k.x + k.breite + 2, cy + 4), feld(k.x - 2 - breite, cy + 4), feld(k.x + k.breite + 2, cy - 4 - hoehe), feld(k.x - 2 - breite, cy - 4 - hoehe)]
}

function beschriftungFuer(e: LayoutKante, a: LayoutKnoten, ueberY: number | null): Rechteck {
  const pts = e.punkte
  const breite = Math.min(MASSE.beschriftungBreite, textBreite(e.name))
  const hoehe = zeilen(e.name) * MASSE.zeile
  const ueber = (p: Punkt) => feldUm(p.x + 4 + breite / 2, p.y - 3 - hoehe / 2, e.name)
  if (e.rueck) return feldUm(pts[0].x + 6 + breite / 2, a.y + a.hoehe + 4 + hoehe / 2, e.name)
  if (e.sprung) {
    // aus einer Raute: über der Extraspur links der senkrechten Linie, sonst über dem ersten Stück
    if (istGateway(a.art) && pts.length >= 4) return feldUm(pts[1].x - 4 - breite / 2, pts[2].y - 3 - hoehe / 2, e.name)
    return ueber(pts[0])
  }
  // senkrecht unten aus der Raute: rechts der Ecke über dem waagerechten Stück
  if (pts.length > 2 && istGateway(a.art) && gleich(pts[0].x, pts[1].x) && pts[1].y > pts[0].y) return ueber(pts[1])
  // leerer Zweig: über dem waagerechten Stück auf der reservierten Spur
  if (ueberY !== null && pts.length > 2 && !gleich(pts[0].y, ueberY)) return ueber(pts[2])
  if (pts.length === 2 || ueberY !== null) return ueber(pts[0])
  // sonst links der senkrechten Linie, knapp über der Höhe des Ziels
  const ende = pts[pts.length - 1]
  const knick = pts[pts.length - 2]
  return feldUm(knick.x - 4 - breite / 2, ende.y - 3 - hoehe / 2, e.name)
}
