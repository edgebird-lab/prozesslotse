/**
 * Lesen und Verändern des Prozessbaums. Alle Änderungen erzeugen einen neuen
 * Prozess und lassen den alten unverändert; darauf bauen Rückgängig und der
 * Ist-Soll-Vergleich auf.
 */
import { anzahlVerteilung, kannNull } from './anzahl'
import { neuerMehrfach, neuerOderZweig, neuerRuecksprungBereich, neuerTeilprozess, neueSequenz } from './bausteine'
import {
  istUnterbrechbar,
  unerwartet,
  unterbrechungenVon,
  type Aufgabe,
  type Block,
  type Entscheidung,
  type EntscheidungsZweig,
  type Id,
  type Mehrfach,
  type Oder,
  type Prozess,
  type Sequenz,
  type Teilprozess,
  type Unterbrechbar,
  type Unterbrechung,
  type Wiederholung,
} from './typen'

/** Ein Schritt auf dem Weg von außen nach innen: ein Baustein und die Kindsequenz, in der es weitergeht. */
export interface Glied {
  block: Block
  sequenz: Sequenz
}

export interface Fundstelle {
  block: Block
  sequenz: Sequenz
  index: number
  /** Blöcke, in deren Zweigen oder Körper der Block liegt, von außen nach innen. */
  vorfahren: Block[]
  /** Dieselben Blöcke mit der Kindsequenz, in der der Block liegt (für Prädikate wie `nebenlaeufig`). */
  kette: Glied[]
}

/**
 * Zweige einer Entscheidung oder Parallele, Körper einer Wiederholung, eines
 * Abschnitts oder von „für jedes Stück“; dazu die Ausnahmewege der
 * Unterbrechungen einer Aufgabe, eines Abschnitts oder von „für jedes Stück“
 * (nach dem Körper).
 */
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
    case 'teilprozess':
      return [b.koerper, ...(b.unterbrechungen ?? [])]
    case 'mehrfach':
      return [b.koerper, ...(b.unterbrechungen ?? [])]
    case 'aufgabe':
      return b.unterbrechungen ?? []
    case 'warten':
      return []
    default:
      return unerwartet(b)
  }
}

/** Die Unterbrechung des Blocks, deren Ausnahmeweg die Sequenz ist; sonst null. */
export function unterbrechungVon(b: Block, sequenzId: Id): Unterbrechung | null {
  return unterbrechungenVon(b).find((u) => u.id === sequenzId) ?? null
}

/** Alle Blöcke in Lesereihenfolge (Tiefensuche). */
export function* durchlaufe(seq: Sequenz, kette: Glied[] = []): Generator<Fundstelle> {
  const vorfahren = kette.map((g) => g.block)
  for (let index = 0; index < seq.schritte.length; index++) {
    const block = seq.schritte[index]
    yield { block, sequenz: seq, index, vorfahren, kette }
    for (const kind of kinderSequenzen(block)) yield* durchlaufe(kind, [...kette, { block, sequenz: kind }])
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
  /** Weg von außen bis in diese Sequenz; das letzte Glied ist (Besitzer, Sequenz). */
  kette: Glied[]
}

export function findeSequenz(p: Prozess, id: Id): SequenzFundstelle | null {
  if (p.ablauf.id === id) return { sequenz: p.ablauf, besitzer: null, vorfahren: [], kette: [] }
  for (const f of durchlaufe(p.ablauf)) {
    for (const kind of kinderSequenzen(f.block)) {
      if (kind.id === id) return { sequenz: kind, besitzer: f.block, vorfahren: [...f.vorfahren, f.block], kette: [...f.kette, { block: f.block, sequenz: kind }] }
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

/**
 * Läuft die Kindsequenz des Glieds womöglich neben anderen Teilen desselben
 * Vorgangs (ein Zweig von Gleichzeitig, ein ODER-Weg, der Körper von „für jedes
 * Stück“, wenn die Stücke gleichzeitig laufen, ein Nebenweg)? Dort darf der
 * Prozess (noch) nicht enden, und kein Rücksprung darf herausführen. Der
 * Ausnahmeweg einer unterbrechenden Unterbrechung ist nicht nebenläufig: Der
 * Schritt ist dann abgebrochen.
 */
export function gliedNebenlaeufig(g: Glied): boolean {
  const u = unterbrechungVon(g.block, g.sequenz.id)
  if (u) return !u.unterbrechend
  const b = g.block
  switch (b.typ) {
    case 'parallel': {
      const art = b.art
      switch (art) {
        case 'alle':
          return true
        default:
          return unerwartet(art)
      }
    }
    case 'oder':
      return true
    case 'mehrfach': {
      const ausfuehrung = b.ausfuehrung
      switch (ausfuehrung) {
        case 'gleichzeitig':
          return true
        case 'nacheinander':
          return false
        default:
          return unerwartet(ausfuehrung)
      }
    }
    case 'entscheidung':
    case 'wiederholung':
    case 'teilprozess':
    case 'aufgabe':
    case 'warten':
      return false
    default:
      return unerwartet(b)
  }
}

/** Liegt die Stelle am Ende dieser Kette in einer nebenläufigen Umgebung? */
export function nebenlaeufig(kette: Glied[]): boolean {
  return kette.some(gliedNebenlaeufig)
}

/**
 * Ist der Block ein Rahmen (Abschnitt oder „für jedes Stück“)? Kein Sequenzfluss
 * und kein Rücksprung quert seine Grenze. Besteht der Körper von „für jedes Stück“
 * aus einer einzelnen Aufgabe, zeichnet das Diagramm statt des Rahmens die
 * Markierung an der Aufgabe; die Grenze gilt trotzdem.
 */
export function istRahmen(b: Block): b is Teilprozess | Mehrfach {
  return b.typ === 'teilprozess' || b.typ === 'mehrfach'
}

/**
 * Wird „für jedes Stück“ als einzelne Aufgabe mit Markierung gezeichnet (statt
 * als Rahmen)? Nur, wenn weder der Baustein noch die Aufgabe Unterbrechungen
 * hat; dann die Aufgabe, sonst null.
 */
export function alsMarkierteAufgabe(b: Mehrfach): Aufgabe | null {
  const [erste, ...rest] = b.koerper.schritte
  if (erste?.typ !== 'aufgabe' || rest.length > 0) return null
  return unterbrechungenVon(b).length === 0 && unterbrechungenVon(erste).length === 0 ? erste : null
}

/**
 * Liegt die Kindsequenz des Glieds im Rahmen seines Blocks? Das gilt für den
 * Körper von Abschnitt und „für jedes Stück“; der Ausnahmeweg einer
 * Unterbrechung liegt außerhalb des Rahmens (er beginnt am Randereignis).
 */
export function gliedRahmen(g: Glied): boolean {
  return istRahmen(g.block) && g.sequenz.id === g.block.koerper.id
}

/** Alle Rahmen über der Stelle am Ende der Kette, von außen nach innen. */
export function rahmenUeber(kette: Glied[]): Block[] {
  return kette.filter(gliedRahmen).map((g) => g.block)
}

/**
 * Rolle, in deren Bahn ein Rahmen (Abschnitt, „für jedes Stück“) mit allen
 * Schritten steht: die mit den meisten Aufgaben darin, bei Gleichstand die der
 * ersten Aufgabe. `undefined`, wenn der Rahmen keine Aufgabe enthält (dann gilt
 * die Bahn, in der der Ablauf gerade ist); `null` steht für Aufgaben ohne Rolle.
 */
export function rahmenRolle(b: Teilprozess | Mehrfach, gueltig: (rolleId: Id | null) => Id | null = (r) => r): Id | null | undefined {
  const anzahl = new Map<Id | null, number>()
  let erste: Id | null | undefined
  for (const { block } of durchlaufe(b.koerper)) {
    if (block.typ !== 'aufgabe') continue
    const r = gueltig(block.rolleId)
    if (erste === undefined) erste = r
    anzahl.set(r, (anzahl.get(r) ?? 0) + 1)
  }
  if (erste === undefined) return undefined
  let beste: Id | null = erste
  for (const [r, n] of anzahl) if (n > anzahl.get(beste)!) beste = r
  return beste
}

const klemme01 = (x: number) => Math.min(1, Math.max(0, x))

/**
 * Wahrscheinlichkeit je Weg einer ODER-Verzweigung (wie oft er vorkommt).
 * Mit Standardweg sind die Wege unabhängig, und der Standardweg läuft genau
 * dann, wenn keiner der anderen zutrifft. Ohne Standardweg trifft immer
 * mindestens einer zu; die Anteile sind dann direkt die Häufigkeiten.
 */
export function oderWahrscheinlichkeiten(b: Oder): number[] {
  const keiner = b.zweige.reduce((q, z) => (z.id === b.standard ? q : q * (1 - klemme01(z.anteil))), 1)
  return b.zweige.map((z) => (z.id === b.standard ? keiner : klemme01(z.anteil)))
}

/**
 * Wie die Wege gezogen werden. Mit Standardweg: unabhängig mit ihrem Anteil.
 * Ohne Standardweg („mindestens einer“): unabhängig mit rᵢ = pᵢ · Z, eine
 * leere Auswahl wird verworfen. Z löst Z = 1 − Π(1 − pᵢ · Z); dann kommt Weg i
 * genau mit pᵢ vor. Das ist die Verteilung mit der größten Entropie unter
 * diesen Häufigkeiten; bei zwei Wegen laufen beide mit p₁ + p₂ − 1.
 * Ergeben die Anteile zusammen höchstens 100 %, schließen sich die Wege aus
 * (Grenzfall Z → 0): Dann läuft genau einer, mit Anteil pᵢ / Σp.
 */
export interface OderZiehung {
  /** Wahrscheinlichkeit des unabhängigen Wurfs je Weg (Standardweg: 0, er läuft nur, wenn keiner trifft) */
  r: number[]
  /** Wahrscheinlichkeit, dass der Wurf nicht leer ist; ohne Standardweg wird auf diese Fälle bedingt */
  z: number
  /** true: Die Wege schließen sich aus (Anteile zusammen höchstens 100 %, kein Standardweg) */
  ausschliessend: boolean
}

export function oderZiehung(b: Oder): OderZiehung {
  const p = b.zweige.map((z) => (z.id === b.standard ? 0 : klemme01(z.anteil)))
  if (b.standard !== null) return { r: p, z: 1 - p.reduce((q, x) => q * (1 - x), 1), ausschliessend: false }
  const summe = p.reduce((s, x) => s + x, 0)
  if (p.some((x) => x >= 1)) return { r: p, z: 1, ausschliessend: false }
  if (summe <= 1 + 1e-9) return { r: p.map((x) => (summe > 0 ? x / summe : 0)), z: 1, ausschliessend: true }
  // Bisektion: g(Z) = 1 − Π(1 − pᵢ Z) − Z ist positiv knapp über 0 und höchstens 0 bei Z = 1
  let unten = 1e-9
  let oben = 1
  for (let i = 0; i < 80; i++) {
    const mitte = (unten + oben) / 2
    const g = 1 - p.reduce((q, x) => q * (1 - x * mitte), 1) - mitte
    if (g > 0) unten = mitte
    else oben = mitte
  }
  const z = (unten + oben) / 2
  return { r: p.map((x) => x * z), z, ausschliessend: false }
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
    case 'teilprozess':
      return mitAbgebildetenUnterbrechungen({ ...b, koerper: abbildeSequenz(b.koerper, f) }, f)
    case 'mehrfach':
      return mitAbgebildetenUnterbrechungen({ ...b, koerper: abbildeSequenz(b.koerper, f) }, f)
    case 'aufgabe':
      return mitAbgebildetenUnterbrechungen(b, f)
    case 'warten':
      return b
    default:
      return unerwartet(b)
  }
}

/** Wendet die Abbildung auch auf die Ausnahmewege an; ohne Unterbrechungen bleibt der Block, wie er ist. */
function mitAbgebildetenUnterbrechungen<B extends Unterbrechbar>(b: B, f: SchrittAbbildung): B {
  if (!b.unterbrechungen) return b
  return { ...b, unterbrechungen: b.unterbrechungen.map((u) => abbildeSequenz(u, f)) }
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
    schritte.map((alt) => {
      // Unterbrechungen durch eine Nachricht dieses Teilnehmers verlieren ihren Absender
      const b = istUnterbrechbar(alt) && alt.unterbrechungen?.some((u) => u.von === teilnehmerId) ? { ...alt, unterbrechungen: alt.unterbrechungen.map((u) => (u.von === teilnehmerId ? { ...u, von: null } : u)) } : alt
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
  /** Baustein (Aufgabe, Warten), Ausgang (Ereignis), Unterbrechung oder 'start' für den Auslöser */
  ort: Id
  richtung: 'an' | 'von'
  teilnehmerId: Id
}

export function nachrichtenVerweise(p: Prozess): NachrichtVerweis[] {
  const liste: NachrichtVerweis[] = []
  if (p.ausloeser.art === 'nachricht' && p.ausloeser.von) liste.push({ ort: 'start', richtung: 'von', teilnehmerId: p.ausloeser.von })
  for (const { block: b } of durchlaufe(p.ablauf)) {
    // Eine Unterbrechung durch eine Nachricht von außen: Nachrichtenfluss zum Randereignis
    for (const u of unterbrechungenVon(b)) if (u.art === 'nachricht' && u.von) liste.push({ ort: u.id, richtung: 'von', teilnehmerId: u.von })
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
    case 'teilprozess':
      return b.name || 'Abschnitt ohne Namen'
    case 'mehrfach':
      return b.name || 'Für jedes Stück'
    default:
      return unerwartet(b)
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
 * umgebenden Sequenzen, aber nicht über eine nebenläufige Umgebung hinweg
 * (das gäbe eine Verklemmung) und nicht aus einem Rahmen hinaus (kein
 * Sequenzfluss quert seine Grenze). `mitSelbst`: die Entscheidung an `index`
 * selbst ist auch ein Ziel.
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
    const glied = seq.kette[seq.kette.length - 1]
    if (!besitzer || !glied || gliedNebenlaeufig(glied) || gliedRahmen(glied)) break
    const ort = findeBlock(p, besitzer.id)
    if (!ort) break
    seq = findeSequenz(p, ort.sequenz.id)
    bis = ort.index
  }
  // von außen nach innen, also in Leserichtung des Prozesses
  return ebenen.reverse().flat()
}

/**
 * Lässt einen Ausgang zum Anfang von `zielId` zurückspringen. Quelle ist ein
 * Ausgang einer Entscheidung oder eine unterbrechende Unterbrechung eines
 * Schritts (`quelleId` = Entscheidung bzw. Schritt, `ausgangId` = Ausgang bzw.
 * Unterbrechung). Dafür wird der Abschnitt vom Ziel bis zum Block, der die
 * Quelle enthält, zu einem Rücksprungbereich zusammengefasst. Ist das Ziel
 * schon ein Rücksprungbereich, wird dieser erweitert. So bleibt das Modell
 * blockstrukturiert. „Noch einmal von vorn“ ist der Rücksprung einer
 * Unterbrechung zu ihrem eigenen Schritt.
 */
export function setzeRuecksprung(p: Prozess, quelleId: Id, ausgangId: Id, zielId: Id): Prozess {
  const ziel = findeBlock(p, zielId)
  const ent = findeBlock(p, quelleId)
  if (!ziel || !ent) return p
  const unterbrechung = unterbrechungVon(ent.block, ausgangId)
  if (ent.block.typ !== 'entscheidung' && !unterbrechung?.unterbrechend) return p
  const kette = [...ent.vorfahren, ent.block]
  const imZiel = kette.findIndex((b) => ziel.sequenz.schritte.includes(b))
  if (imZiel < 0) return p
  // Liegt auf dem Weg vom Zielabschnitt zur Quelle eine nebenläufige Umgebung (auch als Block im Zielabschnitt selbst),
  // wäre der Rücksprung eine Verklemmung; liegt dort ein Rahmen, querte er dessen Grenze. Der Ausnahmeweg einer
  // Unterbrechung liegt neben dem Schritt, also außerhalb seines Rahmens.
  if (ent.kette.slice(imZiel).some((g) => gliedNebenlaeufig(g) || gliedRahmen(g))) return p
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
  q = setzeAusgang(q, quelleId, ausgangId, { ende: null, zurueckZu: bereichId })
  return normalisiere(q)
}

/** Setzt Ende und Rücksprung eines Ausgangs (Entscheidung) bzw. einer Unterbrechung (Schritt). */
function setzeAusgang(p: Prozess, quelleId: Id, ausgangId: Id, werte: { ende?: string | null; zurueckZu?: Id | null }): Prozess {
  return aendereBlock(p, quelleId, (b) => {
    if (b.typ === 'entscheidung') return { ...b, zweige: b.zweige.map((z) => (z.id === ausgangId ? { ...z, ...werte } : z)) }
    if (istUnterbrechbar(b) && b.unterbrechungen) return { ...b, unterbrechungen: b.unterbrechungen.map((u) => (u.id === ausgangId ? { ...u, ...werte } : u)) }
    return b
  })
}

/** Entfernt den Rücksprung eines Ausgangs oder einer Unterbrechung; ein danach leerer Bereich wird aufgelöst. */
export function entferneRuecksprung(p: Prozess, quelleId: Id, ausgangId: Id): Prozess {
  return normalisiere(setzeAusgang(p, quelleId, ausgangId, { zurueckZu: null }))
}

/** Alle Ziele, auf die Ausgänge und Unterbrechungen zurückspringen. */
function ruecksprungZielIds(p: Prozess): Set<Id> {
  const ziele = new Set<Id>()
  for (const { block } of durchlaufe(p.ablauf)) {
    if (block.typ === 'entscheidung') for (const z of block.zweige) if (z.zurueckZu) ziele.add(z.zurueckZu)
    for (const u of unterbrechungenVon(block)) if (u.zurueckZu) ziele.add(u.zurueckZu)
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
  const ohne = <T extends { zurueckZu: Id | null }>(x: T): T => (x.zurueckZu && verwaist.includes(x.zurueckZu) ? { ...x, zurueckZu: null } : x)
  return abbildeAblauf(aufgeloest, (schritte) =>
    schritte.map((b) => {
      if (b.typ === 'entscheidung' && b.zweige.some((z) => z.zurueckZu && verwaist.includes(z.zurueckZu))) return { ...b, zweige: b.zweige.map(ohne) }
      if (istUnterbrechbar(b) && b.unterbrechungen?.some((u) => u.zurueckZu && verwaist.includes(u.zurueckZu))) return { ...b, unterbrechungen: b.unterbrechungen.map(ohne) }
      return b
    }),
  )
}

/** Verlässt der Ablauf den Block vorzeitig (Prozessende oder Rücksprung nach außen), auch über eine Unterbrechung? */
export function verlaesstBlock(b: Block): boolean {
  const innen = new Set<Id>()
  const sammle = (x: Block) => {
    if (x.typ === 'wiederholung') innen.add(x.id)
    for (const s of kinderSequenzen(x)) s.schritte.forEach(sammle)
  }
  sammle(b)
  const verlaesst = (a: { ende: string | null; zurueckZu: Id | null }) => a.ende !== null || (a.zurueckZu !== null && !innen.has(a.zurueckZu))
  const pruefe = (x: Block): boolean => {
    if (x.typ === 'entscheidung' && x.zweige.some(verlaesst)) return true
    if (unterbrechungenVon(x).some(verlaesst)) return true
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
  // Am Ende eines Ausnahmewegs geht es nur bei „weiter“ hinter dem Schritt weiter; ein Nebenweg endet für sich.
  const u = unterbrechungVon(besitzer, f.sequenz.id)
  if (u && (!u.unterbrechend || u.ende !== null || u.zurueckZu !== null)) return false
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

/**
 * Alle Wege aus einem Block, auch über seine Unterbrechungen: Ein
 * unterbrechender Ausnahmeweg führt weiter, endet oder springt zurück;
 * Nebenwege enden für sich und ändern nichts am Ablauf. Der normale Ausgang des
 * Schritts zählt immer mit, auch wenn die Anteile zusammen 100 % ergeben
 * (strukturell, ohne Anteile).
 */
export function ausgaengeBlock(b: Block): Set<Ausgang> {
  const aus = ausgaengeOhneUnterbrechung(b)
  for (const u of unterbrechungenVon(b)) {
    if (!u.unterbrechend) continue
    const a = ausgaengeSequenz(u.schritte)
    vereinige(aus, a, 'weiter')
    if (a.has('weiter')) aus.add(u.ende !== null ? 'ende' : u.zurueckZu !== null ? `rueck:${u.zurueckZu}` : 'weiter')
  }
  return aus
}

function ausgaengeOhneUnterbrechung(b: Block): Set<Ausgang> {
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
    case 'teilprozess':
      return ausgaengeSequenz(b.koerper.schritte)
    case 'mehrfach': {
      // Kommen auch Vorgänge ohne Stück vor, läuft der Ablauf an ihnen vorbei weiter.
      const aus = ausgaengeSequenz(b.koerper.schritte)
      if (kannNull(anzahlVerteilung(b.anzahl, b.streuung))) aus.add('weiter')
      return aus
    }
    default:
      return unerwartet(b)
  }
}

// ---------------------------------------------------------------------------
// Abschnitte zusammenfassen und auflösen

/** Bereiche, auf die Ausgänge innerhalb der Schritte zurückspringen, und die Bereiche darin. */
function ruecksprungVerweise(schritte: Block[]): { ziele: Set<Id>; bereiche: Set<Id> } {
  const ziele = new Set<Id>()
  const bereiche = new Set<Id>()
  for (const { block } of durchlaufe({ id: '', schritte })) {
    if (block.typ === 'entscheidung') for (const z of block.zweige) if (z.zurueckZu) ziele.add(z.zurueckZu)
    for (const u of unterbrechungenVon(block)) if (u.zurueckZu) ziele.add(u.zurueckZu)
    if (block.typ === 'wiederholung' && block.modus === 'ruecksprung') bereiche.add(block.id)
  }
  return { ziele, bereiche }
}

/**
 * Lassen sich die Schritte `von` bis `bis` (beide eingeschlossen) der Sequenz zu
 * einem Abschnitt zusammenfassen? Nicht, wenn ein Rücksprung von innen die neue
 * Rahmengrenze queren würde, also auf einen Bereich außerhalb zeigt.
 */
export function kannZusammenfassen(p: Prozess, sequenzId: Id, von: number, bis: number): boolean {
  const seq = findeSequenz(p, sequenzId)
  if (!seq || von < 0 || bis < von || bis >= seq.sequenz.schritte.length) return false
  const { ziele, bereiche } = ruecksprungVerweise(seq.sequenz.schritte.slice(von, bis + 1))
  for (const z of ziele) if (!bereiche.has(z)) return false
  return true
}

/** Fasst die Schritte `von` bis `bis` einer Sequenz zu einem Abschnitt mit Namen zusammen (aufgeklappter Teilprozess). */
export function fasseZusammen(p: Prozess, sequenzId: Id, von: number, bis: number, name: string, id?: Id): Prozess {
  if (!kannZusammenfassen(p, sequenzId, von, bis)) return p
  const seq = findeSequenz(p, sequenzId)!
  const abschnitt = neuerTeilprozess({ name, koerper: neueSequenz(seq.sequenz.schritte.slice(von, bis + 1)), ...(id ? { id } : {}) })
  return ersetzeBereich(p, sequenzId, von, bis - von + 1, [abschnitt])
}

/**
 * Löst einen Abschnitt auf: Seine Schritte stehen danach wieder direkt in der
 * umgebenden Folge. Unterbrechungen des Abschnitts entfallen (die Oberfläche
 * fragt vorher nach); Rücksprungbereiche, auf die dann nichts mehr zeigt, werden aufgelöst.
 */
export function loeseAbschnittAuf(p: Prozess, abschnittId: Id): Prozess {
  const f = findeBlock(p, abschnittId)
  if (!f || f.block.typ !== 'teilprozess') return p
  const q = ersetzeBereich(p, f.sequenz.id, f.index, 1, f.block.koerper.schritte)
  return f.block.unterbrechungen?.length ? normalisiere(q) : q
}

// ---------------------------------------------------------------------------
// Unterbrechungen

/** Ändert die Liste der Unterbrechungen eines Schritts (Aufgabe, Abschnitt, für jedes Stück). */
export function aendereUnterbrechungen(p: Prozess, blockId: Id, f: (liste: Unterbrechung[]) => Unterbrechung[]): Prozess {
  return aendereBlock(p, blockId, (b) => {
    if (!istUnterbrechbar(b)) return b
    const neu = f(b.unterbrechungen ?? [])
    if (neu.length > 0) return { ...b, unterbrechungen: neu }
    // ohne Unterbrechungen fällt das Feld weg, damit ältere Dateien und neue gleich aussehen
    const { unterbrechungen: _weg, ...ohne } = b
    return ohne as typeof b
  })
}

/** Entfernt eine Unterbrechung mit ihrem Ausnahmeweg; ein danach leerer Rücksprungbereich wird aufgelöst. */
export function entferneUnterbrechung(p: Prozess, blockId: Id, unterbrechungId: Id): Prozess {
  return normalisiere(aendereUnterbrechungen(p, blockId, (liste) => liste.filter((u) => u.id !== unterbrechungId)))
}

/**
 * Hängt eine Unterbrechung an einen anderen Schritt um, z. B. von einer Aufgabe
 * in „für jedes Stück“ an den ganzen Baustein („gilt für die ganze Liste“).
 * Ein Rücksprung der Unterbrechung entfällt, denn sein Bereich gehört zum alten Schritt.
 */
export function verschiebeUnterbrechung(p: Prozess, vonId: Id, unterbrechungId: Id, nachId: Id): Prozess {
  const von = findeBlock(p, vonId)?.block
  const u = von ? unterbrechungVon(von, unterbrechungId) : null
  const nach = findeBlock(p, nachId)?.block
  if (!u || !nach || !istUnterbrechbar(nach)) return p
  const ohne = aendereUnterbrechungen(p, vonId, (liste) => liste.filter((x) => x.id !== unterbrechungId))
  return normalisiere(aendereUnterbrechungen(ohne, nachId, (liste) => [...liste, { ...u, zurueckZu: null }]))
}

/**
 * „Gilt für mehrere Schritte“: fasst die Schritte `von` bis `bis` der Sequenz zu
 * einem Abschnitt zusammen und hängt die Unterbrechung des Schritts an diesen
 * Abschnitt. Der Schritt muss im Bereich liegen.
 */
export function unterbrechungFuerAbschnitt(p: Prozess, sequenzId: Id, von: number, bis: number, name: string, blockId: Id, unterbrechungId: Id, abschnittId: Id): Prozess {
  const seq = findeSequenz(p, sequenzId)
  const i = seq?.sequenz.schritte.findIndex((b) => b.id === blockId) ?? -1
  if (i < von || i > bis) return p
  const zusammen = fasseZusammen(p, sequenzId, von, bis, name, abschnittId)
  if (zusammen === p) return p
  return verschiebeUnterbrechung(zusammen, blockId, unterbrechungId, abschnittId)
}

/**
 * Anteile der unterbrechenden Ereignisse eines Schritts, in den gültigen Bereich
 * gezogen; ergeben sie zusammen mehr als 100 %, werden sie anteilig gekürzt
 * (die Prüfung meldet das). `normal` ist der Rest: Der Schritt endet normal.
 */
export function unterbrechungsAnteile(b: Block): { normal: number; je: Map<Id, number> } {
  const je = new Map<Id, number>()
  let summe = 0
  for (const u of unterbrechungenVon(b)) {
    if (!u.unterbrechend) continue
    const q = Number.isFinite(u.anteil) ? Math.min(1, Math.max(0, u.anteil)) : 0
    je.set(u.id, q)
    summe += q
  }
  if (summe > 1) for (const [id, q] of je) je.set(id, q / summe)
  return { normal: Math.max(0, 1 - Math.min(1, summe)), je }
}

/** Wie oft ein Nebenweg je Ausführung läuft (≥ 0). */
export function nebenwegAnzahl(u: Unterbrechung): number {
  return Number.isFinite(u.anteil) ? Math.max(0, u.anteil) : 0
}

/**
 * Zeitpunkt einer Unterbrechung ab Eingang beim Schritt: die Frist; bei einer
 * Nachricht an einer Aufgabe mit Liegezeit L und Bearbeitung B nach dem
 * angegebenen Zeitpunkt (vorher L/2, während der Arbeit L + B/2, unbekannt
 * (L + B)/2). An einem Rahmen kommt eine Nachricht nach der Hälfte der Dauer
 * des Durchlaufs: dann null.
 */
export function unterbrechungsZeit(b: Unterbrechbar, u: Unterbrechung): number | null {
  if (u.art === 'zeit') return Math.max(0, Number.isFinite(u.fristMin) ? u.fristMin : 0)
  if (b.typ !== 'aufgabe') return null
  const l = Math.max(0, b.liegezeitMin)
  const bearbeitung = Math.max(0, b.bearbeitungMin)
  switch (u.zeitpunkt) {
    case 'vorher':
      return l / 2
    case 'waehrend':
      return l + bearbeitung / 2
    case 'unbekannt':
      return (l + bearbeitung) / 2
    default:
      return unerwartet(u.zeitpunkt)
  }
}

/** Kann der Ablauf hinter diesem Block normal weiterlaufen? */
export function kannWeiterlaufen(b: Block): boolean {
  return ausgaengeBlock(b).has('weiter')
}

// ---------------------------------------------------------------------------
// Umwandlungen alter Notlösungen (die Prüfung bietet sie als Hinweis an)

/**
 * Lässt sich die Wiederholung als „für jedes Stück“ abbilden? Nur eine
 * Mengenschleife (Modus „anteil“, Zweck „menge“), aus deren Körper kein Ende und
 * kein Rücksprung hinausführt.
 */
export function istMengenschleife(b: Block): b is Wiederholung {
  return b.typ === 'wiederholung' && b.modus === 'anteil' && b.zweck === 'menge' && b.anteilWiederholung >= 0 && b.anteilWiederholung < 1 && b.koerper.schritte.length > 0 && !verlaesstBlock(b)
}

/**
 * Wandelt eine Mengenschleife in „für jedes Stück“ um: nacheinander, Anzahl
 * schwankt mit Mittel 1 / (1 − p), keine eigene Liegezeit. Die Zahl der
 * Durchläufe hat dann genau dieselbe Verteilung, und weil die Schritte ihre
 * Liegezeit behalten, bleiben alle Kennzahlen gleich. Die Kennung bleibt.
 */
export function mengenschleifeAlsMehrfach(p: Prozess, wiederholungId: Id): Prozess {
  const f = findeBlock(p, wiederholungId)
  if (!f || !istMengenschleife(f.block)) return p
  const w = f.block
  const name = w.frage.trim().replace(/\s*\?$/, '') || 'Für jedes Stück'
  return ersetzeBlock(p, neuerMehrfach({ id: w.id, name, anzahl: 1 / (1 - w.anteilWiederholung), streuung: 'schwankt', ausfuehrung: 'nacheinander', liegezeitMin: 0, koerper: w.koerper }))
}

/** Bezeichnet ein Ausgang den Fall „beide zugleich“ (Notlösung für ODER)? */
export function heisstBeides(bezeichnung: string): boolean {
  return /(^|[^\p{L}])beide[sn]?($|[^\p{L}])/iu.test(bezeichnung)
}

/**
 * Entscheidung mit drei Ausgängen „A“, „B“ und „beides“, die alle normal
 * weiterführen: Sie lässt sich als ODER mit den Wegen A und B abbilden. Liefert
 * den Ausgang „beides“, sonst null.
 */
export function beidesAusgang(b: Block): EntscheidungsZweig | null {
  if (b.typ !== 'entscheidung' || b.art !== 'daten' || b.zweige.length !== 3) return null
  const beide = b.zweige.filter((z) => heisstBeides(z.bezeichnung))
  if (beide.length !== 1 || b.zweige.some((z) => z.ende !== null || z.zurueckZu !== null)) return null
  return beide[0]
}

/**
 * Wandelt „A / B / beides“ in eine ODER-Verzweigung mit den Wegen A und B um,
 * von denen immer mindestens einer zutrifft. Jeder Weg kommt so oft vor wie
 * sein Ausgang und „beides“ zusammen; bei zwei Wegen laufen dann beide genau in
 * den Fällen von „beides“. Die Schritte im Ausgang „beides“ entfallen, denn
 * dort laufen jetzt die Wege A und B gemeinsam.
 */
export function beidesAlsOder(p: Prozess, entscheidungId: Id): Prozess {
  const f = findeBlock(p, entscheidungId)
  if (!f || f.block.typ !== 'entscheidung') return p
  const beide = beidesAusgang(f.block)
  if (!beide) return p
  const e = f.block
  const zweige = e.zweige.filter((z) => z.id !== beide.id).map((z) => neuerOderZweig(z.bezeichnung, Math.min(1, z.anteil + beide.anteil), { id: z.id, schritte: z.schritte }))
  const oder: Oder = { typ: 'oder', id: e.id, frage: e.frage, zweige, standard: null }
  return normalisiere(ersetzeBlock(p, oder))
}

/** Deutet der Name einer Rolle auf einen externen Beteiligten (Kunde, Lieferant, Bank, Behörde)? */
export function wirktExtern(name: string): boolean {
  return /(^|[^\p{L}])(kund(e|in|en|innen)|lieferant(in|en|innen)?|bank(en)?|beh(ö|oe)rden?)($|[^\p{L}])/iu.test(name.trim())
}
