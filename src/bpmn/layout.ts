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
 * - **Rahmen** (Abschnitte, im BPMN aufgeklappte Teilprozesse) liegen mit
 *   allem darin in einer Bahn. Über dem Inhalt liegt eine dünne Kopfspur für
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
import { durchlaufe, oderWahrscheinlichkeiten, oderZiehung, rahmenRolle } from '../modell/operationen'
import { fuehreLinien, RAHMEN_RAND, type NachrichtAuftrag } from './linien'
import { unerwartet, type Aufgabe, type Block, type EntscheidungsZweig, type Id, type OderZweig, type Prozess, type Rolle, type Sequenz, type Teilprozess, type Wiederholung } from '../modell/typen'
import { formatiereProzent } from '../modell/zeit'

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
  /** Randereignis: Rahmen, an dessen Unterkante es sitzt */
  wirt?: string
  /** Zweige, in denen der Knoten liegt, von außen nach innen (`Verzweigung|Zweig|Baustein`); für das Rücken hinter Rahmen */
  zweigPfad?: string[]
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

export type RahmenArt = 'teilprozess'

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
}

/** Noch offener Rücksprung aus einem Ausgang; der Bereich mit `ziel` zeichnet die Kante. */
interface Sprung {
  von: string
  ziel: Id
  name: string
  doku: string
  anteil?: number
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
  return kante(ctx, a.knoten, nach, { name: a.name, doku: a.doku, ueber: a.ueber, anteil: a.anteil, standard: a.standard })
}

function verschiebeSpur(s: Spur | undefined, dSpur: Map<string, number>): void {
  if (s) s.spur += dSpur.get(s.bahn) ?? 0
}

function verschiebe(t: Teil, dSpalte: number, dSpur: Map<string, number>): void {
  for (const k of t.knoten) {
    k.spalte += dSpalte
    k.spur += dSpur.get(k.bahn) ?? 0
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

/** Bahn eines Abschnitts: die Rolle mit den meisten Aufgaben darin, sonst die Bahn, in der der Ablauf gerade ist. */
function rahmenBahn(b: Teilprozess, bahn: string, ctx: Kontext): string {
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

function layoutBlock(b: Block, bahn: string, ctx: Kontext): Teil {
  switch (b.typ) {
    case 'aufgabe': {
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
      if (art !== 'alle') return unerwartet(art)
      return layoutVerzweigung(b, bahn, ctx)
    }
    case 'entscheidung':
    case 'oder':
      return layoutVerzweigung(b, bahn, ctx)
    case 'wiederholung':
      return layoutWiederholung(b, bahn, ctx)
    case 'teilprozess':
      return layoutTeilprozess(b, bahn, ctx)
    default:
      return unerwartet(b)
  }
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
    let teil = layoutSequenz(z.schritte, bahn, ctx)
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
      // Im Rahmen wird das Ende zum Fehler-Ende; das Fehler-Randereignis am äußersten Rahmen fängt es.
      const endeId = xmlId(`${z.id}_ende`)
      const endBahn = teil.austrittsBahn
      const spur = teil.anker.get(endBahn) ?? 0
      teil.knoten.push(knoten(ctx, { id: endeId, art: 'ende', name: ez.ende, blockId: b.id, bahn: endBahn, spalte: teil.breite, spur, ...(ctx.rahmen !== null ? { fehler: fehlerId(ctx, ez.ende) } : {}) }))
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
  if (!xor || fortsetzend.length >= 2) {
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
      t.kanten.push(kante(ctx, s.von, einId, { name: s.name, doku: s.doku, anteil: s.anteil, sprung: { bahn, spur } }))
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
 * Abschnitt (aufgeklappter Teilprozess): ein Rahmen in einer Bahn mit innerem
 * Start, dem Körper und innerem Ende. Kopfspur oben, Fußspur unten. Der
 * äußerste Rahmen fängt die Fehler-Enden darin mit je einem Randereignis auf
 * seiner Unterkante; der Fluss läuft von dort zu einem Ende mit dem Ergebnis
 * in einem eigenen Band darunter, in der Spalte hinter dem Rahmen.
 */
function layoutTeilprozess(b: Teilprozess, bahn: string, ctx: Kontext): Teil {
  const eigeneBahn = ctx.bahnZwang ?? rahmenBahn(b, bahn, ctx)
  const id = xmlId(b.id)
  const aussen = { bahnZwang: ctx.bahnZwang, rahmen: ctx.rahmen }
  ctx.bahnZwang = eigeneBahn
  ctx.rahmen = id
  const koerper = layoutSequenz(b.koerper.schritte, eigeneBahn, ctx)
  const startId = xmlId(`${b.id}_start`)
  const endeId = xmlId(`${b.id}_ende`)
  // Kopfspur über dem Inhalt, eine Spalte für den inneren Start
  verschiebe(koerper, 1, new Map([[eigeneBahn, 1]]))
  const ankerSpur = koerper.anker.get(eigeneBahn) ?? 1
  const t = neuerTeil(eigeneBahn)
  t.knoten.push(knoten(ctx, { id: startId, art: 'start', name: '', blockId: b.id, bahn: eigeneBahn, spalte: 0, spur: ankerSpur }))
  uebernimm(t, koerper)
  // Läuft der Körper nie normal zu Ende (jeder Weg endet vorher), gibt es kein inneres Ende und keinen Ausgang.
  const normalesEnde = !koerper.eintritt || koerper.austritt !== null
  const endSpalte = normalesEnde ? 1 + koerper.breite : koerper.breite
  if (normalesEnde) {
    t.knoten.push(knoten(ctx, { id: endeId, art: 'ende', name: '', blockId: b.id, bahn: eigeneBahn, spalte: endSpalte, spur: ankerSpur }))
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
  t.rahmen.push({ id, blockId: b.id, art: 'teilprozess', name: b.name, bahn: eigeneBahn, eltern: aussen.rahmen, spalteVon: 0, spalteBis: endSpalte, spurVon: 0, spurBis: fussSpur, ankerSpur, zweigPfad: [] })
  t.breite = endSpalte + 1
  t.eintritt = id
  t.austritt = normalesEnde ? { knoten: id, name: '', doku: '' } : null
  t.austrittsBahn = eigeneBahn
  t.anker.set(eigeneBahn, ankerSpur)

  if (aussen.rahmen === null) {
    // Fehler steigen durch geschachtelte Rahmen auf; nur der äußerste fängt sie, je Ergebnis ein Randereignis.
    const fehler = [...new Set(t.knoten.filter((k) => k.art === 'ende' && k.fehler).map((k) => k.fehler!))]
    const ergebnis = new Map([...ctx.fehler].map(([e, f]) => [f, e]))
    fehler.forEach((f, j) => {
      const randId = xmlId(`${b.id}_fehler_${j + 1}`)
      const zielId = xmlId(`${b.id}_fehler_${j + 1}_ende`)
      t.knoten.push(knoten(ctx, { id: randId, art: 'rand', name: '', blockId: b.id, bahn: eigeneBahn, spalte: endSpalte, spur: fussSpur, wirt: id, fehler: f }))
      t.knoten.push(knoten(ctx, { id: zielId, art: 'ende', name: ergebnis.get(f) ?? '', blockId: b.id, bahn: eigeneBahn, spalte: endSpalte + 1, spur: fussSpur + 1 + j }))
      t.kanten.push(kante(ctx, randId, zielId, { abgang: true }))
    })
    if (fehler.length > 0) {
      belege(t, eigeneBahn, fussSpur + 1 + fehler.length)
      t.breite = endSpalte + 2
    }
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
    if (block.typ === 'teilprozess') {
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
    if (e.abgang) continue
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
          const auf = knotenNach.get(xmlId(`${v1}_auf`))
          if (!auf || !b1 || !b2) break
          // Der Baustein im unteren Zweig rückt hinter den im oberen.
          if (Number(z1) > Number(z2)) ergebnis.push([b1, letzte.get(r.zweigPfad[j])! - auf.spalte + 1])
          else ergebnis.push([b2, letzte.get(pfad[j])! - auf.spalte + 1])
          break
        }
        if (pfad[j] !== r.zweigPfad[j]) break
      }
    }
  }
  return ergebnis
}

function layoutRunde(p: Prozess, schub: Map<Id, number>): Layout {
  const ctx: Kontext = { rollenIds: new Set(p.rollen.map((r) => r.id)), rollen: p.rollen, kantenNr: 0, bahnZwang: null, rahmen: null, fehler: new Map(), schub }
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
    return { id: r.id, blockId: r.blockId, art: r.art, name: r.name, bahn: r.bahn, eltern: r.eltern, anschlussY: spurMitte({ bahn: r.bahn, spur: r.ankerSpur }), spalteVon: r.spalteVon, spalteBis: r.spalteBis, zweigPfad: r.zweigPfad, x: 0, y: oben, breite: 0, hoehe: unten - oben }
  })
  const eltern = new Map(rahmen.map((r) => [r.id, r.eltern]))
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
  const ersatz = (r: LayoutRahmen, spalte: number): LayoutKnoten => ({
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
    breite: 2 * ((belegt.get(spalte) ?? 0) + RAHMEN_RAND.innen),
    hoehe: 0,
  })
  const rahmenEin = new Map(rahmen.map((r) => [r.id, ersatz(r, r.spalteVon)]))
  const rahmenAus = new Map(rahmen.map((r) => [r.id, ersatz(r, r.spalteBis)]))
  const pools = externePools(p, { x: 0, y: 0, breite: 0, hoehe: y }, t.knoten)
  const auftraege = nachrichtAuftraege(t.knoten, pools)
  const linien = fuehreLinien({
    knoten: gitter,
    kanten: t.kanten.filter((e) => !e.abgang),
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
    const links = linien.spalteMitte(r.spalteVon) - (belegt.get(r.spalteVon) ?? 0) - RAHMEN_RAND.innen
    const rechts = linien.spalteMitte(r.spalteBis) + (belegt.get(r.spalteBis) ?? 0) + RAHMEN_RAND.innen
    r.x = links
    r.breite = rechts - links
    if (r.name) {
      const breite = Math.min(textBreite(r.name), r.breite - 2 * RAHMEN.text)
      const hoehe = rahmenZeilen(r.name, r.breite) * RAHMEN.zeile
      r.beschriftung = { x: r.x + (r.breite - breite) / 2, y: r.y + RAHMEN.text, breite, hoehe }
    }
  }
  // Randereignisse auf der Unterkante ihres Rahmens, von rechts nach links in der Reihenfolge ihrer Bänder
  const rahmenNach = new Map(rahmen.map((r) => [r.id, r]))
  const randZahl = new Map<string, number>()
  for (const k of t.knoten) {
    if (k.art !== 'rand') continue
    const r = rahmenNach.get(k.wirt!)!
    const j = randZahl.get(r.id) ?? 0
    randZahl.set(r.id, j + 1)
    k.x = r.x + r.breite - RAHMEN.randRechts - j * RAHMEN.randAbstand - k.breite / 2
    k.y = r.y + r.hoehe - k.hoehe / 2
  }

  for (const e of t.kanten) {
    if (e.abgang) {
      // vom Kreis senkrecht hinunter bis zur Höhe des Ziels, dann waagerecht hinein
      const a = knotenNach.get(e.von)!
      const z = knotenNach.get(e.nach)!
      const cx = a.x + a.breite / 2
      const zy = z.y + z.hoehe / 2
      e.punkte = [
        { x: cx, y: a.y + a.hoehe },
        { x: cx, y: zy },
        { x: z.x, y: zy },
      ]
    } else e.punkte = linien.kanten.get(e.id) ?? []
  }

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

/** Nachrichtenflüsse je Knoten und Richtung; die Linien legt `fuehreLinien` fest. */
function nachrichtAuftraege(knotenListe: LayoutKnoten[], pools: LayoutPool[]): NachrichtAuftrag[] {
  const liste: NachrichtAuftrag[] = []
  for (const k of knotenListe) {
    const beide = !!k.an && !!k.von
    for (const richtung of ['von', 'an'] as const) {
      const tn = richtung === 'an' ? k.an : k.von
      const pl = tn ? pools.find((x) => x.teilnehmerId === tn) : undefined
      if (!pl) continue
      const oben = pl.lage === 'oben'
      liste.push({
        id: `Nachricht_${liste.length + 1}`,
        knoten: k,
        poolRand: oben ? pl.y + pl.hoehe : pl.y,
        oben,
        richtung,
        dx: beide ? (richtung === 'an' ? 15 : -15) : 0,
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
  for (const k of knoten) if (k.beschriftung) k.beschriftung = waehle(plaetzeUm(k, k.beschriftung), k)
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
