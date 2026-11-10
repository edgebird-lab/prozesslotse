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
 * nur in den Lücken zwischen Spalten. Weil Bänder reserviert sind und Lücken
 * frei bleiben, kreuzt eine Kante keinen fremden Knoten. Rückflüsse von
 * Wiederholungen laufen über eine schmale Extraspur unter dem Körper.
 */
import { durchlaufe } from '../modell/operationen'
import { type Aufgabe, type Block, type EntscheidungsZweig, type Id, type Prozess, type Sequenz, type Wiederholung } from '../modell/typen'
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

export type KnotenArt = 'start' | 'ende' | 'aufgabe' | 'xor' | 'und' | 'warten'

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
  aufgabe?: Aufgabe
  ereignis?: 'nachricht' | 'zeit' | 'bedingung' | null
  beschriftung?: Rechteck
}

interface Spur {
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
  /** Rückfluss einer Wiederholung über die Extraspur. */
  rueck?: Spur
  punkte: Punkt[]
  beschriftung?: Rechteck
}

export interface LayoutBahn extends Rechteck {
  schluessel: string
  name: string
  rolleId: Id | null
}

export interface Layout {
  knoten: LayoutKnoten[]
  kanten: LayoutKante[]
  bahnen: LayoutBahn[]
  pool: Rechteck
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
}

interface Teil {
  knoten: LayoutKnoten[]
  kanten: LayoutKante[]
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
  return { knoten: [], kanten: [], breite: 0, hoehe: new Map(), eintritt: null, austritt: null, austrittsBahn: bahn }
}

function belege(t: Teil, bahn: string, spuren: number): void {
  t.hoehe.set(bahn, Math.max(t.hoehe.get(bahn) ?? 0, spuren))
}

function knoten(werte: Omit<LayoutKnoten, 'x' | 'y' | 'breite' | 'hoehe'>): LayoutKnoten {
  return { x: 0, y: 0, breite: 0, hoehe: 0, ...werte }
}

function kante(ctx: Kontext, von: string, nach: string, name = '', doku = '', ueber?: Spur, rueck?: Spur): LayoutKante {
  ctx.kantenNr += 1
  return { id: `Fluss_${ctx.kantenNr}`, von, nach, name, doku, ueber: ueber && { ...ueber }, rueck: rueck && { ...rueck }, punkte: [] }
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
  }
  verschiebeSpur(t.austritt?.ueber, dSpur)
}

function uebernimm(ziel: Teil, quelle: Teil): void {
  ziel.knoten.push(...quelle.knoten)
  ziel.kanten.push(...quelle.kanten)
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
    else if (austritt && bt.eintritt) t.kanten.push(kante(ctx, austritt.knoten, bt.eintritt, austritt.name, austritt.doku, austritt.ueber))
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
      t.knoten.push(knoten({ id, art: 'aufgabe', name: b.name, blockId: b.id, bahn: eigeneBahn, spalte: 0, spur: 0, aufgabe: b }))
      belege(t, eigeneBahn, 1)
      t.breite = 1
      t.eintritt = id
      t.austritt = { knoten: id, name: '', doku: '' }
      return t
    }
    case 'warten': {
      const t = neuerTeil(bahn)
      const id = xmlId(b.id)
      t.knoten.push(knoten({ id, art: 'warten', name: b.name, blockId: b.id, bahn, spalte: 0, spur: 0, ereignis: b.art }))
      belege(t, bahn, 1)
      t.breite = 1
      t.eintritt = id
      t.austritt = { knoten: id, name: '', doku: '' }
      return t
    }
    case 'entscheidung':
    case 'parallel':
      return layoutVerzweigung(b, bahn, ctx)
    case 'wiederholung':
      return layoutWiederholung(b, bahn, ctx)
  }
}

interface ZweigLayout {
  teil: Teil
  name: string
  doku: string
  leer: boolean
  endet: boolean
  linie?: Spur
}

function layoutVerzweigung(b: Extract<Block, { typ: 'entscheidung' | 'parallel' }>, bahn: string, ctx: Kontext): Teil {
  const xor = b.typ === 'entscheidung'
  const art = xor ? 'xor' : 'und'
  const t = neuerTeil(bahn)
  const aufId = xmlId(`${b.id}_auf`)
  t.knoten.push(knoten({ id: aufId, art, name: xor ? b.frage : '', blockId: b.id, bahn, spalte: 0, spur: 0, richtung: 'auf' }))
  t.eintritt = aufId

  const zweige: ZweigLayout[] = (b.zweige as (Sequenz | EntscheidungsZweig)[]).map((z) => {
    const ez = xor ? (z as EntscheidungsZweig) : null
    const teil = layoutSequenz(z.schritte, bahn, ctx)
    const leer = teil.eintritt === null
    const zl: ZweigLayout = {
      teil,
      name: ez?.bezeichnung ?? '',
      doku: ez ? `Anteil: ${formatiereProzent(ez.anteil, 1)}` : '',
      leer,
      endet: ez?.ende != null,
    }
    if (leer) belege(teil, bahn, 1) // Spur für die Linie des leeren Zweigs
    if (ez?.ende != null) {
      const endeId = xmlId(`${z.id}_ende`)
      const endBahn = teil.austrittsBahn
      teil.knoten.push(knoten({ id: endeId, art: 'ende', name: ez.ende, blockId: b.id, bahn: endBahn, spalte: teil.breite, spur: 0 }))
      belege(teil, endBahn, 1)
      if (teil.austritt) teil.kanten.push(kante(ctx, teil.austritt.knoten, endeId, teil.austritt.name, teil.austritt.doku, teil.austritt.ueber))
      if (leer) teil.eintritt = endeId
      teil.breite += 1
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
    if (z.leer && !z.endet) z.linie = { bahn, spur: d.get(bahn) ?? 0 }
    for (const [bahnZ, h] of z.teil.hoehe) versatz.set(bahnZ, (versatz.get(bahnZ) ?? 0) + h)
  }
  const maxBreite = Math.max(1, ...zweige.map((z) => z.teil.breite))

  for (const z of zweige) {
    if (z.teil.eintritt) t.kanten.push(kante(ctx, aufId, z.teil.eintritt, z.name, z.doku))
    t.knoten.push(...z.teil.knoten)
    t.kanten.push(...z.teil.kanten)
  }
  for (const [bahnZ, h] of versatz) belege(t, bahnZ, h)
  belege(t, bahn, 1)

  const fortsetzend = zweige.filter((z) => !z.endet && (z.leer || z.teil.austritt !== null))
  if (!xor || fortsetzend.length >= 2) {
    const zuId = xmlId(`${b.id}_zu`)
    t.knoten.push(knoten({ id: zuId, art, name: '', blockId: b.id, bahn, spalte: 1 + maxBreite, spur: 0, richtung: 'zu' }))
    for (const z of fortsetzend) {
      if (z.leer) t.kanten.push(kante(ctx, aufId, zuId, z.name, z.doku, z.linie))
      else if (z.teil.austritt) {
        const a = z.teil.austritt
        t.kanten.push(kante(ctx, a.knoten, zuId, a.name, a.doku, a.ueber))
      }
    }
    t.austritt = { knoten: zuId, name: '', doku: '' }
    t.austrittsBahn = bahn
    t.breite = maxBreite + 2
  } else if (fortsetzend.length === 1) {
    const z = fortsetzend[0]
    t.austritt = z.leer ? { knoten: aufId, name: z.name, doku: z.doku, ueber: z.linie } : z.teil.austritt
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
  const frageId = xmlId(`${b.id}_frage`)
  const koerper = layoutSequenz(b.koerper.schritte, bahn, ctx)
  verschiebe(koerper, 1, new Map())
  const breite = Math.max(1, koerper.breite)
  t.knoten.push(knoten({ id: einId, art: 'xor', name: '', blockId: b.id, bahn, spalte: 0, spur: 0, richtung: 'zu' }))
  t.knoten.push(knoten({ id: frageId, art: 'xor', name: b.frage, blockId: b.id, bahn, spalte: 1 + breite, spur: 0, richtung: 'auf' }))
  uebernimm(t, koerper)
  t.kanten.push(kante(ctx, einId, koerper.eintritt ?? frageId))
  if (koerper.austritt) {
    const a = koerper.austritt
    t.kanten.push(kante(ctx, a.knoten, frageId, a.name, a.doku, a.ueber))
  }
  const rueckSpur = Math.max(1, koerper.hoehe.get(bahn) ?? 0)
  t.kanten.push(kante(ctx, frageId, einId, 'Ja', `Wiederholung in ${formatiereProzent(b.anteilWiederholung, 1)} der Durchläufe`, undefined, { bahn, spur: rueckSpur }))
  belege(t, bahn, rueckSpur + 1)
  t.eintritt = einId
  t.austritt = { knoten: frageId, name: 'Nein', doku: '' }
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

function groesse(art: KnotenArt): { breite: number; hoehe: number } {
  if (art === 'aufgabe') return MASSE.aufgabe
  if (art === 'xor' || art === 'und') return MASSE.gateway
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
  t.knoten.push(knoten({ id: 'Start', art: 'start', name: p.ausloeser.text, blockId: null, bahn: ersteBahn, spalte: 0, spur: 0, ereignis: startEreignis }))
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
      t.kanten.push(kante(ctx, a.knoten, 'Ende', a.name, a.doku, a.ueber))
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
      for (const s of [e.ueber, e.rueck]) if (s && s.bahn === bahn) anzahl = Math.max(anzahl, s.spur + 1)
    }
    spurHoehen.set(bahn, Array.from({ length: anzahl }, (_, i) => (mitKnoten.has(i) ? MASSE.spur : MASSE.spurDuenn)))
  }

  const maxSpalte = Math.max(0, ...t.knoten.map((k) => k.spalte))
  const inhaltX = 2 * MASSE.kopf + MASSE.rand
  const poolBreite = inhaltX + (maxSpalte + 1) * MASSE.spalte + MASSE.rand
  const bahnen: LayoutBahn[] = []
  const bahnOben = new Map<string, number>()
  let y = 0
  for (const bahn of reihenfolge) {
    const hoehe = 2 * MASSE.bahnPolster + (spurHoehen.get(bahn) ?? []).reduce((s, h) => s + h, 0)
    const rolle = p.rollen.find((r) => r.id === bahn)
    bahnen.push({ schluessel: bahn, name: rolle ? rolle.name || 'Unbenannte Rolle' : 'Ohne Rolle', rolleId: rolle?.id ?? null, x: MASSE.kopf, y, breite: poolBreite - MASSE.kopf, hoehe })
    bahnOben.set(bahn, y)
    y += hoehe
  }
  const pool: Rechteck = { x: 0, y: 0, breite: poolBreite, hoehe: y }

  const spurMitte = (s: Spur): number => {
    const hoehen = spurHoehen.get(s.bahn) ?? []
    let oben = (bahnOben.get(s.bahn) ?? 0) + MASSE.bahnPolster
    for (let i = 0; i < s.spur; i++) oben += hoehen[i] ?? MASSE.spurDuenn
    return oben + (hoehen[s.spur] ?? MASSE.spurDuenn) / 2
  }
  const spalteMitte = (spalte: number): number => inhaltX + spalte * MASSE.spalte + MASSE.spalte / 2

  const nachId = new Map<string, LayoutKnoten>()
  for (const k of t.knoten) {
    const g = groesse(k.art)
    const cx = spalteMitte(k.spalte)
    const cy = spurMitte({ bahn: k.bahn, spur: k.spur })
    Object.assign(k, { x: cx - g.breite / 2, y: cy - g.hoehe / 2, breite: g.breite, hoehe: g.hoehe })
    if (k.name && k.art !== 'aufgabe') {
      const oben = k.art === 'xor' || k.art === 'und'
      const h = zeilen(k.name) * MASSE.zeile
      k.beschriftung = feldUm(cx, oben ? k.y - 6 - h / 2 : k.y + k.hoehe + 6 + h / 2, k.name)
    }
    nachId.set(k.id, k)
  }

  for (const e of t.kanten) {
    const a = nachId.get(e.von)!
    const z = nachId.get(e.nach)!
    e.punkte = wegpunkte(e, a, z, spurMitte)
    if (e.name) e.beschriftung = beschriftungFuer(e, a, e.ueber ? spurMitte(e.ueber) : null)
  }

  return { knoten: t.knoten, kanten: t.kanten, bahnen, pool }
}

function mitte(r: Rechteck): Punkt {
  return { x: r.x + r.breite / 2, y: r.y + r.hoehe / 2 }
}

function gleich(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.5
}

function wegpunkte(e: LayoutKante, a: LayoutKnoten, z: LayoutKnoten, spurMitte: (s: Spur) => number): Punkt[] {
  const ma = mitte(a)
  const mz = mitte(z)
  if (e.rueck) {
    const y = spurMitte(e.rueck)
    return [
      { x: ma.x, y: a.y + a.hoehe },
      { x: ma.x, y },
      { x: mz.x, y },
      { x: mz.x, y: z.y + z.hoehe },
    ]
  }
  const ax = a.x + a.breite
  const zx = z.x
  if (e.ueber) {
    const y = spurMitte(e.ueber)
    const punkte: Punkt[] = [{ x: ax, y: ma.y }]
    if (!gleich(y, ma.y)) {
      const g = ma.x + MASSE.spalte / 2
      punkte.push({ x: g, y: ma.y }, { x: g, y })
    }
    if (!gleich(y, mz.y)) {
      const g = mz.x - MASSE.spalte / 2
      punkte.push({ x: g, y }, { x: g, y: mz.y })
    }
    punkte.push({ x: zx, y: mz.y })
    return punkte
  }
  if (gleich(ma.y, mz.y)) return [{ x: ax, y: ma.y }, { x: zx, y: mz.y }]
  const g = mz.x - MASSE.spalte / 2
  return [
    { x: ax, y: ma.y },
    { x: g, y: ma.y },
    { x: g, y: mz.y },
    { x: zx, y: mz.y },
  ]
}

function beschriftungFuer(e: LayoutKante, a: LayoutKnoten, ueberY: number | null): Rechteck {
  const pts = e.punkte
  const breite = Math.min(MASSE.beschriftungBreite, textBreite(e.name))
  const hoehe = zeilen(e.name) * MASSE.zeile
  const ueber = (p: Punkt) => feldUm(p.x + 4 + breite / 2, p.y - 3 - hoehe / 2, e.name)
  if (e.rueck) return feldUm(pts[0].x + 6 + breite / 2, a.y + a.hoehe + 4 + hoehe / 2, e.name)
  // leerer Zweig: über dem waagerechten Stück auf der reservierten Spur
  if (ueberY !== null && pts.length > 2 && !gleich(pts[0].y, ueberY)) return ueber(pts[2])
  if (pts.length === 2 || ueberY !== null) return ueber(pts[0])
  // sonst links der senkrechten Linie, knapp über der Höhe des Ziels
  const ende = pts[pts.length - 1]
  const knick = pts[pts.length - 2]
  return feldUm(knick.x - 4 - breite / 2, ende.y - 3 - hoehe / 2, e.name)
}
