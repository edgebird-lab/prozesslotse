/**
 * Führung durch den Ablauf: Wo steht die Einfügeposition, wohin springt sie
 * nach dem Einfügen und was passiert bei „Abschnitt fertig“.
 */
import { bereichTitel, blockTitel, findeBlock, findeSequenz, kannWeiterlaufen, nebenlaeufig } from './operationen'
import { unerwartet, type Block, type Cursor, type Prozess } from './typen'

export interface Ort {
  /** z. B. „im Ausgang ‚Nein‘ von ‚Ware vorrätig?‘“ */
  bereich: string
  /** z. B. „nach ‚Kunden anrufen‘“ */
  position: string
  /** Schritte an dieser Stelle würden nie erreicht. */
  unerreichbar: boolean
  /** In nebenläufiger Umgebung (Gleichzeitig, ODER, Stücke zur selben Zeit) darf der Prozess noch nicht enden. */
  inParallele: boolean
  vorgaenger: Block | null
  /** Was „Abschnitt fertig“ bewirkt, als kurzer Text. */
  weiterText: string
}

function bereichText(p: Prozess, sequenzId: string): string {
  const f = findeSequenz(p, sequenzId)
  const b = f?.besitzer
  if (!b) return 'im Hauptablauf'
  if (b.typ === 'entscheidung') {
    const z = b.zweige.find((x) => x.id === sequenzId)
    return `im Ausgang „${z?.bezeichnung || '?'}“ von „${b.frage || 'Entscheidung'}“`
  }
  if (b.typ === 'parallel') return `in Zweig ${b.zweige.findIndex((x) => x.id === sequenzId) + 1} von „Gleichzeitig“`
  if (b.typ === 'oder') {
    const z = b.zweige.find((x) => x.id === sequenzId)
    return `im Weg „${z?.bezeichnung || '?'}“ von „${b.frage || 'Mehrere Wege'}“`
  }
  if (b.typ === 'wiederholung' && b.modus === 'ruecksprung') return `im Bereich mit Rücksprung ab „${b.koerper.schritte[0] ? bereichTitel(b.koerper.schritte[0]) : '…'}“`
  if (b.typ === 'wiederholung') return `in der Wiederholung „${b.frage || 'Wiederholung'}“`
  if (b.typ === 'teilprozess') return `im Abschnitt „${b.name || 'ohne Namen'}“`
  if (b.typ === 'mehrfach') return `je Stück in „${b.name || 'Für jedes Stück'}“`
  return 'im Ablauf'
}

export function beschreibeCursor(p: Prozess, c: Cursor): Ort {
  const f = findeSequenz(p, c.sequenzId)
  const schritte = f?.sequenz.schritte ?? []
  const vorgaenger = c.index > 0 ? (schritte[c.index - 1] ?? null) : null
  const unerreichbar = !stelleErreichbar(p, c)
  const ziel = abschnittFertig(p, c)
  let weiterText = 'Ablauf fertig, weiter zum Prüfen'
  if (ziel !== 'fertig') {
    const zf = findeSequenz(p, ziel.sequenzId)
    const neuerZweig = zf?.besitzer && zf.besitzer.id === f?.besitzer?.id
    weiterText = neuerZweig ? `Weiter ${bereichText(p, ziel.sequenzId)}` : `Weiter nach „${blockTitel(f!.besitzer!)}“`
  }
  return {
    bereich: bereichText(p, c.sequenzId),
    position: vorgaenger ? `nach „${blockTitel(vorgaenger)}“` : 'am Anfang',
    unerreichbar,
    inParallele: f ? nebenlaeufig(f.kette) : false,
    vorgaenger,
    weiterText,
  }
}

/** Erreicht der Ablauf diese Stelle? Prüft die eigene Sequenz und alle umgebenden. */
export function stelleErreichbar(p: Prozess, c: Cursor): boolean {
  let seq = findeSequenz(p, c.sequenzId)
  let bis = c.index
  while (seq) {
    if (seq.sequenz.schritte.slice(0, bis).some((b) => !kannWeiterlaufen(b))) return false
    if (!seq.besitzer) return true
    const ort = findeBlock(p, seq.besitzer.id)
    if (!ort) return true
    seq = findeSequenz(p, ort.sequenz.id)
    bis = ort.index
  }
  return true
}

export function cursorNachEinfuegen(block: Block, c: Cursor): Cursor {
  switch (block.typ) {
    case 'entscheidung':
    case 'parallel':
    case 'oder':
      return block.zweige.length > 0 ? { sequenzId: block.zweige[0].id, index: block.zweige[0].schritte.length } : { ...c, index: c.index + 1 }
    case 'wiederholung':
    case 'teilprozess':
    case 'mehrfach':
      return { sequenzId: block.koerper.id, index: block.koerper.schritte.length }
    case 'aufgabe':
    case 'warten':
      return { sequenzId: c.sequenzId, index: c.index + 1 }
    default:
      return unerwartet(block)
  }
}

/** Nächste Stelle nach „Abschnitt fertig“: nächster Zweig, sonst hinter den Block; im Hauptablauf „fertig“. */
export function abschnittFertig(p: Prozess, c: Cursor): Cursor | 'fertig' {
  const f = findeSequenz(p, c.sequenzId)
  if (!f?.besitzer) return 'fertig'
  const b = f.besitzer
  if (b.typ === 'entscheidung' || b.typ === 'parallel' || b.typ === 'oder') {
    const j = b.zweige.findIndex((z) => z.id === c.sequenzId)
    const naechster = b.zweige[j + 1]
    if (naechster) return { sequenzId: naechster.id, index: naechster.schritte.length }
  }
  const ort = findeBlock(p, b.id)
  return ort ? { sequenzId: ort.sequenz.id, index: ort.index + 1 } : 'fertig'
}
