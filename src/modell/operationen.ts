/**
 * Lesen und Verändern des Prozessbaums. Alle Änderungen erzeugen einen neuen
 * Prozess und lassen den alten unverändert; darauf bauen Rückgängig und der
 * Ist-Soll-Vergleich auf.
 */
import type { Aufgabe, Block, Id, Prozess, Sequenz } from './typen'

export interface Fundstelle {
  block: Block
  sequenz: Sequenz
  index: number
  /** Blöcke, in deren Zweigen oder Körper der Block liegt, von außen nach innen. */
  vorfahren: Block[]
}

/** Zweige einer Entscheidung oder Parallele, Körper einer Wiederholung. */
export function kinderSequenzen(b: Block): Sequenz[] {
  switch (b.typ) {
    case 'entscheidung':
      return b.zweige
    case 'parallel':
      return b.zweige
    case 'wiederholung':
      return [b.koerper]
    default:
      return []
  }
}

/** Alle Blöcke in Lesereihenfolge (Tiefensuche). */
export function* durchlaufe(seq: Sequenz, vorfahren: Block[] = []): Generator<Fundstelle> {
  for (let index = 0; index < seq.schritte.length; index++) {
    const block = seq.schritte[index]
    yield { block, sequenz: seq, index, vorfahren }
    for (const kind of kinderSequenzen(block)) yield* durchlaufe(kind, [...vorfahren, block])
  }
}

export function findeBlock(p: Prozess, id: Id): Fundstelle | null {
  for (const f of durchlaufe(p.ablauf)) if (f.block.id === id) return f
  return null
}

export interface SequenzFundstelle {
  sequenz: Sequenz
  /** Block, zu dem die Sequenz gehört; `null` beim Hauptablauf. */
  besitzer: Block | null
  /** Besitzer und alle seine Vorfahren, von außen nach innen. */
  vorfahren: Block[]
}

export function findeSequenz(p: Prozess, id: Id): SequenzFundstelle | null {
  if (p.ablauf.id === id) return { sequenz: p.ablauf, besitzer: null, vorfahren: [] }
  for (const f of durchlaufe(p.ablauf)) {
    for (const kind of kinderSequenzen(f.block)) {
      if (kind.id === id) return { sequenz: kind, besitzer: f.block, vorfahren: [...f.vorfahren, f.block] }
    }
  }
  return null
}

export function alleAufgaben(p: Prozess): Aufgabe[] {
  const liste: Aufgabe[] = []
  for (const { block } of durchlaufe(p.ablauf)) if (block.typ === 'aufgabe') liste.push(block)
  return liste
}

export function anzahlBloecke(p: Prozess): number {
  let n = 0
  for (const _ of durchlaufe(p.ablauf)) n++
  return n
}

/** Liegt die Stelle innerhalb eines Gleichzeitig-Blocks? Dort darf der Prozess nicht enden. */
export function liegtInParallele(vorfahren: Block[]): boolean {
  return vorfahren.some((b) => b.typ === 'parallel')
}

// ---------------------------------------------------------------------------
// Unveränderliche Änderungen

type SchrittAbbildung = (schritte: Block[], sequenzId: Id) => Block[]

function abbildeSequenz<S extends Sequenz>(seq: S, f: SchrittAbbildung): S {
  const innen = seq.schritte.map((b) => abbildeBlock(b, f))
  return { ...seq, schritte: f(innen, seq.id) }
}

function abbildeBlock(b: Block, f: SchrittAbbildung): Block {
  switch (b.typ) {
    case 'entscheidung':
      return { ...b, zweige: b.zweige.map((z) => abbildeSequenz(z, f)) }
    case 'parallel':
      return { ...b, zweige: b.zweige.map((z) => abbildeSequenz(z, f)) }
    case 'wiederholung':
      return { ...b, koerper: abbildeSequenz(b.koerper, f) }
    default:
      return b
  }
}

/** Wendet `f` auf die Schrittliste jeder Sequenz an, innen zuerst. */
export function abbildeAblauf(p: Prozess, f: SchrittAbbildung): Prozess {
  return { ...p, ablauf: abbildeSequenz(p.ablauf, f) }
}

export function fuegeEin(p: Prozess, sequenzId: Id, index: number, ...bloecke: Block[]): Prozess {
  return abbildeAblauf(p, (schritte, id) => {
    if (id !== sequenzId) return schritte
    const i = Math.max(0, Math.min(index, schritte.length))
    return [...schritte.slice(0, i), ...bloecke, ...schritte.slice(i)]
  })
}

export function aendereBlock(p: Prozess, blockId: Id, aenderung: (b: Block) => Block): Prozess {
  return abbildeAblauf(p, (schritte) => schritte.map((b) => (b.id === blockId ? aenderung(b) : b)))
}

export function ersetzeBlock(p: Prozess, neu: Block): Prozess {
  return aendereBlock(p, neu.id, () => neu)
}

export function entferneBlock(p: Prozess, blockId: Id): Prozess {
  return abbildeAblauf(p, (schritte) => schritte.filter((b) => b.id !== blockId))
}

/** Ersetzt `anzahl` Schritte ab `start` in einer Sequenz durch neue Blöcke. */
export function ersetzeBereich(p: Prozess, sequenzId: Id, start: number, anzahl: number, neu: Block[]): Prozess {
  return abbildeAblauf(p, (schritte, id) =>
    id === sequenzId ? [...schritte.slice(0, start), ...neu, ...schritte.slice(start + anzahl)] : schritte,
  )
}

/** Verschiebt einen Block innerhalb seiner Sequenz um eine Position. */
export function verschiebeBlock(p: Prozess, blockId: Id, richtung: -1 | 1): Prozess {
  return abbildeAblauf(p, (schritte) => {
    const i = schritte.findIndex((b) => b.id === blockId)
    const j = i + richtung
    if (i < 0 || j < 0 || j >= schritte.length) return schritte
    const neu = [...schritte]
    ;[neu[i], neu[j]] = [neu[j], neu[i]]
    return neu
  })
}

/** Entfernt eine Rolle; Aufgaben dieser Rolle haben danach keine Rolle mehr. */
export function entferneRolle(p: Prozess, rolleId: Id): Prozess {
  const ohne = abbildeAblauf(p, (schritte) =>
    schritte.map((b) => (b.typ === 'aufgabe' && b.rolleId === rolleId ? { ...b, rolleId: null } : b)),
  )
  return { ...ohne, rollen: p.rollen.filter((r) => r.id !== rolleId) }
}

/** Entfernt ein Medium; Verweise darauf werden geleert. */
export function entferneMedium(p: Prozess, mediumId: Id): Prozess {
  const ohne = abbildeAblauf(p, (schritte) =>
    schritte.map((b) => {
      if (b.typ !== 'aufgabe') return b
      let neu = b
      if (neu.mediumId === mediumId) neu = { ...neu, mediumId: null }
      if (neu.uebertragung?.quelleMediumId === mediumId) {
        neu = { ...neu, uebertragung: { ...neu.uebertragung, quelleMediumId: null } }
      }
      return neu
    }),
  )
  return { ...ohne, medien: p.medien.filter((m) => m.id !== mediumId) }
}

export function rolleName(p: Prozess, id: Id | null): string {
  return p.rollen.find((r) => r.id === id)?.name || 'ohne Rolle'
}

export function mediumName(p: Prozess, id: Id | null): string {
  return p.medien.find((m) => m.id === id)?.name || 'ohne Angabe'
}

/** Name für Sätze wie „gleichzeitig mit …“: Wiederholungen heißen nach ihrem ersten Schritt. */
export function bereichTitel(b: Block): string {
  if (b.typ === 'wiederholung') {
    const erste = b.koerper.schritte[0]
    if (erste) return `${bereichTitel(erste)}${b.koerper.schritte.length > 1 ? ' …' : ''}`
  }
  return blockTitel(b)
}

/** Kurzer Anzeigename eines Blocks für Listen und Hinweise. */
export function blockTitel(b: Block): string {
  switch (b.typ) {
    case 'aufgabe':
      return b.name || 'Aufgabe ohne Namen'
    case 'entscheidung':
      return b.frage || 'Entscheidung ohne Frage'
    case 'parallel':
      return `Gleichzeitig (${b.zweige.length} Zweige)`
    case 'wiederholung':
      return b.frage ? `Wiederholung: ${b.frage}` : 'Wiederholung'
    case 'warten':
      return b.name || 'Warten'
  }
}
