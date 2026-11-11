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
 *
 * Kanten verlaufen waagerecht in der Spur ihres Startknotens und senkrecht
 * nur in den Lücken zwischen Spalten oder unter der eigenen Raute. Weil
 * Bänder reserviert sind und Lücken frei bleiben, kreuzt eine Kante keinen
 * fremden Knoten. Rückflüsse von Wiederholungen laufen über schmale
 * Extraspuren unter dem Körper. Wie die Linien genau laufen, damit sich keine
 * zwei eine Strecke teilen, legt `linien.ts` fest.
 */
import { durchlaufe, oderWahrscheinlichkeiten, oderZiehung } from '../modell/operationen'
import { fuehreLinien, type NachrichtAuftrag } from './linien'
import { type Aufgabe, type Block, type EntscheidungsZweig, type Id, type OderZweig, type Prozess, type Sequenz, type Wiederholung } from '../modell/typen'
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

export const OHNE_ROLLE = '__ohne_rolle__'

export type KnotenArt = 'start' | 'ende' | 'aufgabe' | 'xor' | 'und' | 'oder' | 'ereignisgateway' | 'warten'

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

export interface Layout {
  knoten: LayoutKnoten[]
  kanten: LayoutKante[]
  bahnen: LayoutBahn[]
  pool: Rechteck
  pools: LayoutPool[]
  nachrichten: LayoutNachricht[]
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

interface Teil {
  knoten: LayoutKnoten[]
  kanten: LayoutKante[]
  spruenge: Sprung[]
  breite: number
  /** Belegte Spuren je Bahn, relativ zum Band dieses Teils. */
  hoehe: Map<string, number>
  eintritt: string | null
  austritt: Austritt | null
  austrittsBahn: string
}

interface Kontext {
  rollenIds: Set<Id>
  kantenNr: number
}

function neuerTeil(bahn: string): Teil {
  return { knoten: [], kanten: [], spruenge: [], breite: 0, hoehe: new Map(), eintritt: null, austritt: null, austrittsBahn: bahn }
}

function belege(t: Teil, bahn: string, spuren: number): void {
  t.hoehe.set(bahn, Math.max(t.hoehe.get(bahn) ?? 0, spuren))
}

function knoten(werte: Omit<LayoutKnoten, 'x' | 'y' | 'breite' | 'hoehe'>): LayoutKnoten {
  return { x: 0, y: 0, breite: 0, hoehe: 0, ...werte }
}

interface KantenOptionen {
  name?: string
  doku?: string
  ueber?: Spur
  rueck?: Spur
  sprung?: Spur
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
}

function uebernimm(ziel: Teil, quelle: Teil): void {
  ziel.knoten.push(...quelle.knoten)
  ziel.kanten.push(...quelle.kanten)
  ziel.spruenge.push(...quelle.spruenge)
  for (const [bahn, h] of quelle.hoehe) belege(ziel, bahn, h)
}

function bahnVon(ctx: Kontext, rolleId: Id | null): string {
  return rolleId !== null && ctx.rollenIds.has(rolleId) ? rolleId : OHNE_ROLLE
}

function layoutSequenz(schritte: Block[], bahn: string, ctx: Kontext): Teil {
  const t = neuerTeil(bahn)
  let bahnJetzt = bahn
  let austritt: Austritt | null = null
  for (const [i, b] of schritte.entries()) {
    const bt = layoutBlock(b, bahnJetzt, ctx)
    verschiebe(bt, t.breite, new Map())
    uebernimm(t, bt)
    if (i === 0) t.eintritt = bt.eintritt
    else if (austritt && bt.eintritt) t.kanten.push(kanteAus(ctx, austritt, bt.eintritt))
    austritt = bt.austritt
    bahnJetzt = bt.austrittsBahn
    t.breite += bt.breite
  }
  t.austritt = schritte.length > 0 ? austritt : null
  t.austrittsBahn = bahnJetzt
  return t
}

function layoutBlock(b: Block, bahn: string, ctx: Kontext): Teil {
  switch (b.typ) {
    case 'aufgabe': {
      const eigeneBahn = bahnVon(ctx, b.rolleId)
      const t = neuerTeil(eigeneBahn)
      const id = xmlId(b.id)
      t.knoten.push(knoten({ id, art: 'aufgabe', name: b.name, blockId: b.id, bahn: eigeneBahn, spalte: 0, spur: 0, aufgabe: b, an: b.nachrichtAn ?? null, von: b.nachrichtVon ?? null }))
      belege(t, eigeneBahn, 1)
      t.breite = 1
      t.eintritt = id
      t.austritt = { knoten: id, name: '', doku: '' }
      return t
    }
    case 'warten': {
      const t = neuerTeil(bahn)
      const id = xmlId(b.id)
      t.knoten.push(knoten({ id, art: 'warten', name: b.name, blockId: b.id, bahn, spalte: 0, spur: 0, ereignis: b.art, von: b.art === 'nachricht' ? (b.von ?? null) : null }))
      belege(t, bahn, 1)
      t.breite = 1
      t.eintritt = id
      t.austritt = { knoten: id, name: '', doku: '' }
      return t
    }
    case 'entscheidung':
    case 'parallel':
    case 'oder':
      return layoutVerzweigung(b, bahn, ctx)
    case 'wiederholung':
      return layoutWiederholung(b, bahn, ctx)
  }
}

interface ZweigLayout {
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

function layoutVerzweigung(b: Extract<Block, { typ: 'entscheidung' | 'parallel' | 'oder' }>, bahn: string, ctx: Kontext): Teil {
  const xor = b.typ === 'entscheidung'
  const oder = b.typ === 'oder'
  const ereignisse = b.typ === 'entscheidung' && b.art === 'ereignis'
  const artAuf: KnotenArt = ereignisse ? 'ereignisgateway' : xor ? 'xor' : oder ? 'oder' : 'und'
  const artZu: KnotenArt = xor ? 'xor' : oder ? 'oder' : 'und'
  const t = neuerTeil(bahn)
  const aufId = xmlId(`${b.id}_auf`)
  t.knoten.push(knoten({ id: aufId, art: artAuf, name: b.typ === 'parallel' ? '' : b.frage, blockId: b.id, bahn, spalte: 0, spur: 0, richtung: 'auf' }))
  t.eintritt = aufId
  const oderAnteile = b.typ === 'oder' ? oderWahrscheinlichkeiten(b) : []
  // Am Fluss steht die Wahrscheinlichkeit des unabhängigen Wurfs; das Tokenspiel würfelt damit wie die Simulation.
  const oderWurf = b.typ === 'oder' ? oderZiehung(b).r : []
  if (b.typ === 'oder' && b.standard === null) t.knoten[0].mindestensEiner = true

  // Der Standardweg einer ODER-Verzweigung steht oben auf der geraden Linie; so gehört sein Querstrich eindeutig zu ihm.
  const reihenfolge = (b.zweige as (Sequenz | EntscheidungsZweig | OderZweig)[]).map((z, zi) => ({ z, zi }))
  if (b.typ === 'oder' && b.standard) reihenfolge.sort((x, y) => Number(y.z.id === b.standard) - Number(x.z.id === b.standard))
  const zweige: ZweigLayout[] = reihenfolge.map(({ z, zi }) => {
    const ez = xor ? (z as EntscheidungsZweig) : null
    const oz = b.typ === 'oder' ? (z as OderZweig) : null
    const standard = b.typ === 'oder' && z.id === b.standard
    let teil = layoutSequenz(z.schritte, bahn, ctx)
    if (ereignisse && ez) {
      // Jeder Ausgang einer Ereignis-Entscheidung beginnt mit seinem Ereignis.
      const ereignisId = xmlId(`${z.id}_ereignis`)
      const mitEreignis = neuerTeil(bahn)
      const art = ez.ereignis?.art ?? 'nachricht'
      mitEreignis.knoten.push(knoten({ id: ereignisId, art: 'warten', name: ez.bezeichnung, blockId: b.id, bahn, spalte: 0, spur: 0, ereignis: art, von: art === 'nachricht' ? (ez.ereignis?.von ?? null) : null }))
      belege(mitEreignis, bahn, 1)
      verschiebe(teil, 1, new Map())
      uebernimm(mitEreignis, teil)
      if (teil.eintritt) mitEreignis.kanten.push(kante(ctx, ereignisId, teil.eintritt))
      mitEreignis.eintritt = ereignisId
      mitEreignis.austritt = teil.eintritt ? teil.austritt : { knoten: ereignisId, name: '', doku: '' }
      mitEreignis.austrittsBahn = teil.eintritt ? teil.austrittsBahn : bahn
      mitEreignis.breite = teil.breite + 1
      teil = mitEreignis
    }
    const leer = teil.eintritt === null
    const zl: ZweigLayout = {
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
      const endeId = xmlId(`${z.id}_ende`)
      const endBahn = teil.austrittsBahn
      teil.knoten.push(knoten({ id: endeId, art: 'ende', name: ez.ende, blockId: b.id, bahn: endBahn, spalte: teil.breite, spur: 0 }))
      belege(teil, endBahn, 1)
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
    return zl
  })

  // Zweige je Bahn übereinander stapeln
  const versatz = new Map<string, number>()
  for (const z of zweige) {
    const d = new Map<string, number>()
    for (const bahnZ of z.teil.hoehe.keys()) d.set(bahnZ, versatz.get(bahnZ) ?? 0)
    verschiebe(z.teil, 1, d)
    if (z.leer && !z.endet && !z.springt) z.linie = { bahn, spur: d.get(bahn) ?? 0 }
    for (const [bahnZ, h] of z.teil.hoehe) versatz.set(bahnZ, (versatz.get(bahnZ) ?? 0) + h)
  }
  const maxBreite = Math.max(1, ...zweige.map((z) => z.teil.breite))

  for (const z of zweige) {
    if (z.teil.eintritt) t.kanten.push(kante(ctx, aufId, z.teil.eintritt, { name: z.name, doku: z.doku, anteil: z.anteil, standard: z.standard }))
    t.knoten.push(...z.teil.knoten)
    t.kanten.push(...z.teil.kanten)
    t.spruenge.push(...z.teil.spruenge)
  }
  for (const [bahnZ, h] of versatz) belege(t, bahnZ, h)
  belege(t, bahn, 1)

  const fortsetzend = zweige.filter((z) => !z.endet && !z.springt && (z.leer || z.teil.austritt !== null))
  if (!xor || fortsetzend.length >= 2) {
    const zuId = xmlId(`${b.id}_zu`)
    t.knoten.push(knoten({ id: zuId, art: artZu, name: '', blockId: b.id, bahn, spalte: 1 + maxBreite, spur: 0, richtung: 'zu' }))
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
  t.knoten.push(knoten({ id: einId, art: 'xor', name: '', blockId: b.id, bahn, spalte: 0, spur: 0, richtung: 'zu' }))
  uebernimm(t, koerper)
  // Extraspur unter dem Körper für Rückkanten
  const rueckSpur = Math.max(1, koerper.hoehe.get(bahn) ?? 0)
  belege(t, bahn, rueckSpur + 1)
  t.eintritt = einId

  if (b.modus === 'ruecksprung') {
    if (koerper.eintritt) t.kanten.push(kante(ctx, einId, koerper.eintritt))
    const eigene = t.spruenge.filter((s) => s.ziel === b.id)
    t.spruenge = t.spruenge.filter((s) => s.ziel !== b.id)
    // Jeder Rücksprung bekommt eine eigene Extraspur, damit sich keine zwei eine Strecke teilen.
    // Der weiteste liegt am tiefsten; so schachteln sich die Linien, ohne sich zu kreuzen.
    const lage = (id: string) => t.knoten.find((k) => k.id === id) ?? { spalte: 0, spur: 0 }
    const sortiert = [...eigene].sort((x, y) => lage(x.von).spalte - lage(y.von).spalte || lage(y.von).spur - lage(x.von).spur)
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
  t.knoten.push(knoten({ id: frageId, art: 'xor', name: b.frage, blockId: b.id, bahn, spalte: 1 + breite, spur: 0, richtung: 'auf' }))
  t.kanten.push(kante(ctx, einId, koerper.eintritt ?? frageId))
  if (koerper.austritt) t.kanten.push(kanteAus(ctx, koerper.austritt, frageId))
  const p = b.anteilWiederholung
  t.kanten.push(kante(ctx, frageId, einId, { name: 'Ja', doku: `Wiederholung in ${formatiereProzent(p, 1)} der Durchläufe`, rueck: { bahn, spur: rueckSpur }, anteil: p }))
  t.austritt = { knoten: frageId, name: 'Nein', doku: '', anteil: 1 - p }
  t.breite = breite + 2
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

export function berechneLayout(p: Prozess): Layout {
  const ctx: Kontext = { rollenIds: new Set(p.rollen.map((r) => r.id)), kantenNr: 0 }

  let ersteBahn = OHNE_ROLLE
  for (const { block } of durchlaufe(p.ablauf)) {
    if (block.typ === 'aufgabe') {
      ersteBahn = bahnVon(ctx, block.rolleId)
      break
    }
  }

  const haupt = layoutSequenz(p.ablauf.schritte, ersteBahn, ctx)
  verschiebe(haupt, 1, new Map())
  const t = neuerTeil(ersteBahn)
  const startEreignis = p.ausloeser.art === 'manuell' ? null : p.ausloeser.art
  t.knoten.push(knoten({ id: 'Start', art: 'start', name: p.ausloeser.text, blockId: null, bahn: ersteBahn, spalte: 0, spur: 0, ereignis: startEreignis, von: p.ausloeser.art === 'nachricht' ? (p.ausloeser.von ?? null) : null }))
  belege(t, ersteBahn, 1)
  uebernimm(t, haupt)
  if (haupt.eintritt === null) {
    t.knoten.push(knoten({ id: 'Ende', art: 'ende', name: p.ergebnis, blockId: null, bahn: ersteBahn, spalte: 1, spur: 0 }))
    t.kanten.push(kante(ctx, 'Start', 'Ende'))
  } else {
    t.kanten.push(kante(ctx, 'Start', haupt.eintritt))
    if (haupt.austritt) {
      const a = haupt.austritt
      t.knoten.push(knoten({ id: 'Ende', art: 'ende', name: p.ergebnis, blockId: null, bahn: haupt.austrittsBahn, spalte: 1 + haupt.breite, spur: 0 }))
      belege(t, haupt.austrittsBahn, 1)
      t.kanten.push(kanteAus(ctx, a, 'Ende'))
    }
  }

  // Bahnen in der Reihenfolge der Rollen, „ohne Rolle“ zuletzt
  const benutzt = new Set(t.knoten.map((k) => k.bahn))
  const reihenfolge = [...p.rollen.map((r) => r.id).filter((id) => benutzt.has(id)), ...(benutzt.has(OHNE_ROLLE) ? [OHNE_ROLLE] : [])]

  const spurHoehen = new Map<string, number[]>()
  for (const bahn of reihenfolge) {
    let anzahl = t.hoehe.get(bahn) ?? 1
    const mitKnoten = new Set<number>()
    for (const k of t.knoten) {
      if (k.bahn !== bahn) continue
      mitKnoten.add(k.spur)
      anzahl = Math.max(anzahl, k.spur + 1)
    }
    for (const e of t.kanten) {
      for (const s of [e.ueber, e.rueck, e.sprung]) if (s && s.bahn === bahn) anzahl = Math.max(anzahl, s.spur + 1)
    }
    spurHoehen.set(bahn, Array.from({ length: anzahl }, (_, i) => (mitKnoten.has(i) ? MASSE.spur : MASSE.spurDuenn)))
  }

  const maxSpalte = Math.max(0, ...t.knoten.map((k) => k.spalte))
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

  const spurMitte = (s: Spur): number => {
    const hoehen = spurHoehen.get(s.bahn) ?? []
    let oben = (bahnOben.get(s.bahn) ?? 0) + MASSE.bahnPolster
    for (let i = 0; i < s.spur; i++) oben += hoehen[i] ?? MASSE.spurDuenn
    return oben + (hoehen[s.spur] ?? MASSE.spurDuenn) / 2
  }
  const spalteBasis = (spalte: number): number => inhaltX + spalte * MASSE.spalte + MASSE.spalte / 2

  // Höhe und Größe der Knoten; die x-Lage folgt aus der Linienführung (volle Lücken werden breiter)
  const belegt = new Map<number, number>()
  for (const k of t.knoten) {
    const g = groesse(k.art)
    const cy = spurMitte({ bahn: k.bahn, spur: k.spur })
    Object.assign(k, { y: cy - g.hoehe / 2, breite: g.breite, hoehe: g.hoehe })
    const beschriftungHalb = k.name && k.art !== 'aufgabe' ? Math.min(MASSE.beschriftungBreite, textBreite(k.name)) / 2 : 0
    belegt.set(k.spalte, Math.max(belegt.get(k.spalte) ?? 0, g.breite / 2, beschriftungHalb))
  }
  // senkrechte Ausdehnung je Knoten samt Beschriftung (Gateways oben, Ereignisse unten)
  const ausdehnung = new Map(
    t.knoten.map((k) => {
      const h = k.name && k.art !== 'aufgabe' ? zeilen(k.name) * MASSE.zeile + 6 : 0
      return [k.id, istGateway(k.art) ? [k.y - h, k.y + k.hoehe] : [k.y, k.y + k.hoehe + h]] as const
    }),
  )
  const spalteFrei = (spalte: number, y1: number, y2: number, ausser: string[]): boolean =>
    t.knoten.every((k) => {
      if (k.spalte !== spalte || ausser.includes(k.id)) return true
      const [oben, unten] = ausdehnung.get(k.id)!
      return unten + 4 <= y1 || oben - 4 >= y2
    })
  const pools = externePools(p, { x: 0, y: 0, breite: 0, hoehe: y })
  const auftraege = nachrichtAuftraege(t.knoten, pools)
  const linien = fuehreLinien({
    knoten: t.knoten,
    kanten: t.kanten,
    nachrichten: auftraege,
    spurMitte,
    belegt,
    maxSpalte,
    spalteMitte: spalteBasis,
    linkerRand: 2 * MASSE.kopf,
    rechterRand: MASSE.spalte / 2 + MASSE.rand,
    spalteFrei,
  })

  const poolBreite = linien.spalteMitte(maxSpalte) + MASSE.spalte / 2 + MASSE.rand + linien.zusatzRechts
  for (const b of bahnen) b.breite = poolBreite - MASSE.kopf
  for (const pl of pools) pl.breite = poolBreite
  const pool: Rechteck = { x: 0, y: 0, breite: poolBreite, hoehe: y }

  const nachId = new Map<string, LayoutKnoten>()
  for (const k of t.knoten) {
    const cx = linien.spalteMitte(k.spalte)
    k.x = cx - k.breite / 2
    if (k.name && k.art !== 'aufgabe') {
      const oben = istGateway(k.art)
      const h = zeilen(k.name) * MASSE.zeile
      k.beschriftung = feldUm(cx, oben ? k.y - 6 - h / 2 : k.y + k.hoehe + 6 + h / 2, k.name)
    }
    nachId.set(k.id, k)
  }

  for (const e of t.kanten) e.punkte = linien.kanten.get(e.id) ?? []

  const nachrichten: LayoutNachricht[] = auftraege.map((n) => {
    const pl = pools.find((x) => x.teilnehmerId === (n.richtung === 'an' ? n.knoten.an : n.knoten.von))!
    return { id: n.id, von: n.richtung === 'an' ? n.knoten.id : pl.id, nach: n.richtung === 'an' ? pl.id : n.knoten.id, punkte: linien.nachrichten.get(n.id) ?? [] }
  })
  platziereBeschriftungen(t.knoten, t.kanten, nachrichten, pools, spurMitte)
  return { knoten: t.knoten, kanten: t.kanten, bahnen, pool, pools, nachrichten }
}

const POOL_HOEHE = 60
const POOL_ABSTAND = 40

/** Externe Teilnehmer abwechselnd über und unter dem Hauptpool, damit sich Nachrichtenflüsse selten kreuzen. */
function externePools(p: Prozess, haupt: Rechteck): LayoutPool[] {
  const pools: LayoutPool[] = []
  let oben = haupt.y
  let unten = haupt.y + haupt.hoehe
  ;(p.teilnehmer ?? []).forEach((tn, i) => {
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
 * eigenen Linie.
 */
function platziereBeschriftungen(knoten: LayoutKnoten[], kanten: LayoutKante[], nachrichten: LayoutNachricht[], pools: LayoutPool[], spurMitte: (s: Spur) => number): void {
  const nachId = new Map(knoten.map((k) => [k.id, k]))
  const feste: Rechteck[] = [...knoten, ...pools]
  const linien = [...kanten.map((e) => e.punkte), ...nachrichten.map((n) => n.punkte)]
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
    const a = nachId.get(e.von)!
    e.beschriftung = waehle([beschriftungFuer(e, a, e.ueber ? spurMitte(e.ueber) : null), ...plaetzeEntlang(e)], null)
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
