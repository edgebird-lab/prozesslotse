/**
 * Lesen und Verändern des Prozessbaums. Alle Änderungen erzeugen einen neuen
 * Prozess und lassen den alten unverändert; darauf bauen Rückgängig und der
 * Ist-Soll-Vergleich auf.
 */
import { neuerRuecksprungBereich } from './bausteine'
import type { Aufgabe, Block, Entscheidung, EntscheidungsZweig, Id, Oder, Prozess, Sequenz } from './typen'

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
    case 'oder':
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

/** Laufen die Zweige des Blocks womöglich gleichzeitig (Gleichzeitig, ODER)? Dann darf kein Zweig enden oder herausspringen. */
export function istNebenlaeufig(b: Block): boolean {
  return b.typ === 'parallel' || b.typ === 'oder'
}

/** Liegt die Stelle innerhalb von „Gleichzeitig“ oder einer ODER-Verzweigung? Dort darf der Prozess nicht enden. */
export function liegtInParallele(vorfahren: Block[]): boolean {
  return vorfahren.some(istNebenlaeufig)
}

/**
 * Wahrscheinlichkeit je Weg einer ODER-Verzweigung. Die Wege sind unabhängig;
 * der Standardweg läuft genau dann, wenn keiner der anderen zutrifft.
 */
export function oderWahrscheinlichkeiten(b: Oder): number[] {
  const klemme = (x: number) => Math.min(1, Math.max(0, x))
  const keiner = b.zweige.reduce((q, z) => (z.id === b.standard ? q : q * (1 - klemme(z.anteil))), 1)
  return b.zweige.map((z) => (z.id === b.standard ? keiner : klemme(z.anteil)))
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
    case 'oder':
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

/** Entfernt einen externen Teilnehmer; Nachrichten von und an ihn bleiben ohne Absender bzw. Empfänger. */
export function entferneTeilnehmer(p: Prozess, teilnehmerId: Id): Prozess {
  const ohne = (x: Id | null | undefined) => (x === teilnehmerId ? null : (x ?? null))
  const neu = abbildeAblauf(p, (schritte) =>
    schritte.map((b) => {
      if (b.typ === 'aufgabe' && (b.nachrichtAn === teilnehmerId || b.nachrichtVon === teilnehmerId)) return { ...b, nachrichtAn: ohne(b.nachrichtAn), nachrichtVon: ohne(b.nachrichtVon) }
      if (b.typ === 'warten' && b.von === teilnehmerId) return { ...b, von: null }
      if (b.typ === 'entscheidung' && b.zweige.some((z) => z.ereignis?.von === teilnehmerId)) {
        return { ...b, zweige: b.zweige.map((z) => (z.ereignis?.von === teilnehmerId ? { ...z, ereignis: { ...z.ereignis, von: null } } : z)) }
      }
      return b
    }),
  )
  return {
    ...neu,
    ausloeser: p.ausloeser.von === teilnehmerId ? { ...p.ausloeser, von: null } : p.ausloeser,
    teilnehmer: p.teilnehmer.filter((t) => t.id !== teilnehmerId),
  }
}

export function teilnehmerName(p: Prozess, id: Id | null | undefined): string {
  return p.teilnehmer.find((t) => t.id === id)?.name || 'extern'
}

/** Nachrichten mit externen Teilnehmern: Stelle im Modell, Richtung und Teilnehmer. */
export interface NachrichtVerweis {
  /** Baustein (Aufgabe, Warten), Ausgang (Ereignis) oder 'start' für den Auslöser */
  ort: Id
  richtung: 'an' | 'von'
  teilnehmerId: Id
}

export function nachrichtenVerweise(p: Prozess): NachrichtVerweis[] {
  const liste: NachrichtVerweis[] = []
  if (p.ausloeser.art === 'nachricht' && p.ausloeser.von) liste.push({ ort: 'start', richtung: 'von', teilnehmerId: p.ausloeser.von })
  for (const { block: b } of durchlaufe(p.ablauf)) {
    if (b.typ === 'aufgabe') {
      if (b.nachrichtVon) liste.push({ ort: b.id, richtung: 'von', teilnehmerId: b.nachrichtVon })
      if (b.nachrichtAn) liste.push({ ort: b.id, richtung: 'an', teilnehmerId: b.nachrichtAn })
    } else if (b.typ === 'warten' && b.art === 'nachricht' && b.von) {
      liste.push({ ort: b.id, richtung: 'von', teilnehmerId: b.von })
    } else if (b.typ === 'entscheidung' && b.art === 'ereignis') {
      for (const z of b.zweige) if (z.ereignis?.art === 'nachricht' && z.ereignis.von) liste.push({ ort: z.id, richtung: 'von', teilnehmerId: z.ereignis.von })
    }
  }
  return liste
}

export function rolleName(p: Prozess, id: Id | null): string {
  return p.rollen.find((r) => r.id === id)?.name || 'ohne Rolle'
}

export function mediumName(p: Prozess, id: Id | null): string {
  return p.medien.find((m) => m.id === id)?.name || 'ohne Angabe'
}

/** Name für Sätze wie „gleichzeitig mit …“ oder „zurück zu …“: Wiederholungen heißen nach ihrem ersten Schritt. */
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
    case 'oder':
      return b.frage || 'Mehrere Wege möglich'
    case 'wiederholung':
      if (b.modus === 'ruecksprung') return `Bereich mit Rücksprung ab „${b.koerper.schritte[0] ? bereichTitel(b.koerper.schritte[0]) : '…'}“`
      return b.frage ? `Wiederholung: ${b.frage}` : 'Wiederholung'
    case 'warten':
      return b.name || 'Warten'
  }
}

// ---------------------------------------------------------------------------
// Rücksprünge

export interface RuecksprungZiel {
  /** Block, zu dessen Anfang zurückgesprungen wird. */
  id: Id
  titel: string
}

/**
 * Mögliche Ziele für „zurück zu …“ aus einer Entscheidung an der Stelle
 * (sequenzId, index): alle Schritte davor in derselben Sequenz und in den
 * umgebenden Sequenzen, aber nicht über „Gleichzeitig“ hinweg (das gäbe eine
 * Verklemmung). `mitSelbst`: die Entscheidung an `index` selbst ist auch ein Ziel.
 */
export function ruecksprungZiele(p: Prozess, sequenzId: Id, index: number, mitSelbst: boolean): RuecksprungZiel[] {
  const ebenen: RuecksprungZiel[][] = []
  let seq = findeSequenz(p, sequenzId)
  let bis = mitSelbst ? index : index - 1
  while (seq) {
    // Der erste Schritt eines Rücksprungbereichs ist derselbe Punkt wie der Bereich selbst; angeboten wird der Bereich.
    const ab = seq.besitzer?.typ === 'wiederholung' && seq.besitzer.modus === 'ruecksprung' ? 1 : 0
    ebenen.push(seq.sequenz.schritte.slice(ab, bis + 1).map((b) => ({ id: b.id, titel: bereichTitel(b) })))
    const besitzer = seq.besitzer
    if (!besitzer || istNebenlaeufig(besitzer)) break
    const ort = findeBlock(p, besitzer.id)
    if (!ort) break
    seq = findeSequenz(p, ort.sequenz.id)
    bis = ort.index
  }
  // von außen nach innen, also in Leserichtung des Prozesses
  return ebenen.reverse().flat()
}

/**
 * Lässt einen Ausgang zum Anfang von `zielId` zurückspringen. Dafür wird der
 * Abschnitt vom Ziel bis zum Block, der die Entscheidung enthält, zu einem
 * Rücksprungbereich zusammengefasst. Ist das Ziel schon ein Rücksprungbereich,
 * wird dieser erweitert. So bleibt das Modell blockstrukturiert.
 */
export function setzeRuecksprung(p: Prozess, entscheidungId: Id, zweigId: Id, zielId: Id): Prozess {
  const ziel = findeBlock(p, zielId)
  const ent = findeBlock(p, entscheidungId)
  if (!ziel || !ent) return p
  const kette = [...ent.vorfahren, ent.block]
  const imZiel = kette.findIndex((b) => ziel.sequenz.schritte.includes(b))
  if (imZiel < 0) return p
  // Liegt auf dem Weg vom Zielabschnitt zur Entscheidung ein „Gleichzeitig“ (auch als Block im Zielabschnitt selbst), wäre der Rücksprung eine Verklemmung.
  if (kette.slice(imZiel).some(istNebenlaeufig)) return p
  const i = ziel.index
  const j = ziel.sequenz.schritte.indexOf(kette[imZiel])
  if (j < i) return p

  let bereichId: Id
  let q: Prozess
  const zielBlock = ziel.block
  const besitzer = findeSequenz(p, ziel.sequenz.id)?.besitzer
  if (i === 0 && j === ziel.sequenz.schritte.length - 1 && besitzer?.typ === 'wiederholung' && besitzer.modus === 'ruecksprung') {
    // Der Abschnitt ist schon genau ein Rücksprungbereich: denselben nutzen statt einen zweiten hineinzulegen
    bereichId = besitzer.id
    q = p
  } else if (zielBlock.typ === 'wiederholung' && zielBlock.modus === 'ruecksprung') {
    bereichId = zielBlock.id
    const erweitert = { ...zielBlock, koerper: { ...zielBlock.koerper, schritte: [...zielBlock.koerper.schritte, ...ziel.sequenz.schritte.slice(i + 1, j + 1)] } }
    q = ersetzeBereich(p, ziel.sequenz.id, i, j - i + 1, [erweitert])
  } else {
    const bereich = neuerRuecksprungBereich(ziel.sequenz.schritte.slice(i, j + 1))
    bereichId = bereich.id
    q = ersetzeBereich(p, ziel.sequenz.id, i, j - i + 1, [bereich])
  }
  q = aendereBlock(q, entscheidungId, (b) =>
    b.typ === 'entscheidung' ? { ...b, zweige: b.zweige.map((z) => (z.id === zweigId ? { ...z, ende: null, zurueckZu: bereichId } : z)) } : b,
  )
  return normalisiere(q)
}

/** Entfernt den Rücksprung eines Ausgangs; ein danach leerer Bereich wird aufgelöst. */
export function entferneRuecksprung(p: Prozess, entscheidungId: Id, zweigId: Id): Prozess {
  return normalisiere(
    aendereBlock(p, entscheidungId, (b) =>
      b.typ === 'entscheidung' ? { ...b, zweige: b.zweige.map((z) => (z.id === zweigId ? { ...z, zurueckZu: null } : z)) } : b,
    ),
  )
}

/** Alle Ziele, auf die Ausgänge zurückspringen. */
function ruecksprungZielIds(p: Prozess): Set<Id> {
  const ziele = new Set<Id>()
  for (const { block } of durchlaufe(p.ablauf)) {
    if (block.typ === 'entscheidung') for (const z of block.zweige) if (z.zurueckZu) ziele.add(z.zurueckZu)
  }
  return ziele
}

/**
 * Räumt nach Änderungen auf: Rücksprungbereiche, auf die kein Ausgang mehr
 * zeigt, werden aufgelöst; Rücksprünge auf nicht mehr vorhandene Bereiche
 * werden entfernt.
 */
export function normalisiere(p: Prozess): Prozess {
  const ziele = ruecksprungZielIds(p)
  let geaendert = false
  const aufgeloest = abbildeAblauf(p, (schritte) => {
    if (!schritte.some((b) => b.typ === 'wiederholung' && b.modus === 'ruecksprung' && !ziele.has(b.id))) return schritte
    geaendert = true
    return schritte.flatMap((b) => (b.typ === 'wiederholung' && b.modus === 'ruecksprung' && !ziele.has(b.id) ? b.koerper.schritte : [b]))
  })
  const bereiche = new Set<Id>()
  for (const { block } of durchlaufe(aufgeloest.ablauf)) if (block.typ === 'wiederholung' && block.modus === 'ruecksprung') bereiche.add(block.id)
  const verwaist = [...ziele].filter((id) => !bereiche.has(id))
  if (verwaist.length === 0) return geaendert ? aufgeloest : p
  return abbildeAblauf(aufgeloest, (schritte) =>
    schritte.map((b) =>
      b.typ === 'entscheidung' && b.zweige.some((z) => z.zurueckZu && verwaist.includes(z.zurueckZu))
        ? { ...b, zweige: b.zweige.map((z) => (z.zurueckZu && verwaist.includes(z.zurueckZu) ? { ...z, zurueckZu: null } : z)) }
        : b,
    ),
  )
}

/** Verlässt der Ablauf den Block vorzeitig (Prozessende oder Rücksprung nach außen)? */
export function verlaesstBlock(b: Block): boolean {
  const innen = new Set<Id>()
  const sammle = (x: Block) => {
    if (x.typ === 'wiederholung') innen.add(x.id)
    for (const s of kinderSequenzen(x)) s.schritte.forEach(sammle)
  }
  sammle(b)
  const pruefe = (x: Block): boolean => {
    if (x.typ === 'entscheidung' && x.zweige.some((z) => z.ende !== null || (z.zurueckZu !== null && !innen.has(z.zurueckZu)))) return true
    return kinderSequenzen(x).some((s) => s.schritte.some(pruefe))
  }
  return pruefe(b)
}

// ---------------------------------------------------------------------------
// Kontrollen und ihre Folge

/**
 * Greift eine Entscheidung das Ergebnis des Schritts auf? Das ist der Fall,
 * wenn direkt danach eine Entscheidung kommt (auch am Anfang eines
 * Rücksprungbereichs) oder der Schritt eine Wiederholung abschließt, deren
 * Frage dann entscheidet. Am Ende eines Zweigs zählt, was nach dem Block folgt.
 */
export function folgtEntscheidung(p: Prozess, f: Fundstelle): boolean {
  const naechster = f.sequenz.schritte[f.index + 1]
  if (naechster) {
    if (naechster.typ === 'wiederholung' && naechster.modus === 'ruecksprung') return naechster.koerper.schritte[0]?.typ === 'entscheidung'
    return naechster.typ === 'entscheidung'
  }
  const besitzer = f.vorfahren[f.vorfahren.length - 1]
  if (!besitzer) return false
  if (besitzer.typ === 'wiederholung' && besitzer.modus === 'anteil') return true
  const ort = findeBlock(p, besitzer.id)
  return ort ? folgtEntscheidung(p, ort) : false
}

/** Ausgang, der nach einer Freigabe als „freigegeben“ gilt: der häufigste, der normal weiterführt. */
export function freigabeAusgang(e: Entscheidung): EntscheidungsZweig | null {
  const weiter = e.zweige.filter((z) => z.ende === null && z.zurueckZu === null)
  return weiter.length === 0 ? null : weiter.reduce((a, z) => (z.anteil > a.anteil ? z : a))
}

export interface FreigabeQuote {
  /** Anteil der Fälle, in denen freigegeben wird */
  quote: number
  /** Ausgang der direkt folgenden Entscheidung, aus dem die Quote stammt, sonst null */
  ausgang: EntscheidungsZweig | null
  entscheidung: Entscheidung | null
}

/**
 * Quote einer Freigabe. Folgt direkt eine Entscheidung, gilt deren
 * „freigegeben“-Ausgang, damit Modell und Angabe nicht auseinanderlaufen;
 * sonst die Angabe am Schritt.
 */
export function freigabeQuote(f: Fundstelle): FreigabeQuote {
  const angabe = f.block.typ === 'aufgabe' ? f.block.freigabeQuote : 1
  const naechster = f.sequenz.schritte[f.index + 1]
  const entscheidung = naechster?.typ === 'entscheidung' ? naechster : null
  const ausgang = entscheidung ? freigabeAusgang(entscheidung) : null
  return { quote: ausgang ? ausgang.anteil : angabe, ausgang, entscheidung: ausgang ? entscheidung : null }
}

// ---------------------------------------------------------------------------
// Struktur: Welche Wege führen aus einem Block heraus?

/** „weiter“ = normal hinter dem Block, „ende“ = Prozessende, „rueck:<id>“ = Rücksprung zu Bereich <id>. */
export type Ausgang = string

function vereinige(ziel: Set<Ausgang>, quelle: Set<Ausgang>, ohne?: Ausgang): void {
  for (const a of quelle) if (a !== ohne) ziel.add(a)
}

/** Alle Wege, auf denen der Ablauf eine Folge von Schritten verlassen kann (strukturell, ohne Anteile). */
export function ausgaengeSequenz(schritte: Block[]): Set<Ausgang> {
  const aus = new Set<Ausgang>()
  for (const b of schritte) {
    const a = ausgaengeBlock(b)
    vereinige(aus, a, 'weiter')
    if (!a.has('weiter')) return aus // dahinter kommt der Ablauf nie an
  }
  aus.add('weiter')
  return aus
}

export function ausgaengeBlock(b: Block): Set<Ausgang> {
  switch (b.typ) {
    case 'aufgabe':
    case 'warten':
      return new Set(['weiter'])
    case 'entscheidung': {
      const aus = new Set<Ausgang>()
      for (const z of b.zweige) {
        const a = ausgaengeSequenz(z.schritte)
        vereinige(aus, a, 'weiter')
        if (a.has('weiter')) aus.add(z.ende !== null ? 'ende' : z.zurueckZu !== null ? `rueck:${z.zurueckZu}` : 'weiter')
      }
      return aus
    }
    case 'parallel':
    case 'oder': {
      // Weiter nur, wenn jeder Zweig weiterkommt: Bei ODER kann jeder Weg auch der einzige gewählte sein.
      const aus = new Set<Ausgang>()
      let alleWeiter = b.zweige.length > 0
      for (const z of b.zweige) {
        const a = ausgaengeSequenz(z.schritte)
        vereinige(aus, a, 'weiter')
        alleWeiter &&= a.has('weiter')
      }
      if (alleWeiter) aus.add('weiter')
      return aus
    }
    case 'wiederholung': {
      const a = ausgaengeSequenz(b.koerper.schritte)
      const aus = new Set<Ausgang>()
      // Rücksprünge auf den eigenen Bereich bleiben innen
      vereinige(aus, a, b.modus === 'ruecksprung' ? `rueck:${b.id}` : undefined)
      if (b.modus === 'anteil' && b.anteilWiederholung >= 1) aus.delete('weiter')
      return aus
    }
  }
}

/** Kann der Ablauf hinter diesem Block normal weiterlaufen? */
export function kannWeiterlaufen(b: Block): boolean {
  return ausgaengeBlock(b).has('weiter')
}
