/**
 * Kennzahlen eines Prozesses, berechnet als Erwartungswerte pro Vorgang.
 *
 * Zwei Durchläufe über den Baum:
 *
 * 1. **Fluss** (linear): Wie oft wird jede Stelle im Schnitt erreicht? Daraus
 *    folgen Ausführungshäufigkeit, Arbeitszeit, Kosten, Medienbrüche sowie
 *    Übergaben und Systemwechsel zwischen aufeinanderfolgenden Aufgaben.
 *    Eine Wiederholung mit Anteil p wird geschlossen gelöst (geometrische
 *    Reihe), nicht durch Ausrollen: Der Körper läuft im Schnitt
 *    1 / (1 − p · c)-mal, wobei c die Wahrscheinlichkeit ist, dass der Körper
 *    ohne Prozessende durchlaufen wird.
 *
 * 2. **Dauer**: erwartete Durchlaufzeit. Hintereinander wird addiert,
 *    Entweder-oder gewichtet gemittelt, bei Gleichzeitig zählt der Zweig mit
 *    der längsten erwarteten Dauer (Näherung; die Simulation rechnet genau).
 */
import { durchlaufe } from '../modell/operationen'
import type { Aufgabe, Block, Id, Prozess, Rolle } from '../modell/typen'

// ---------------------------------------------------------------------------
// Ergebnis

export interface SchrittKennzahl {
  id: Id
  /** Erwartete Ausführungen pro Vorgang. */
  haeufigkeit: number
  /** Erwartete Arbeitsminuten pro Vorgang (Häufigkeit × Bearbeitungszeit). */
  arbeitMin: number
  kosten: number
  /** Beitrag der Liegezeit (bzw. Wartezeit) zur erwarteten Durchlaufzeit. */
  beitragWartenMin: number
  /** Beitrag der Bearbeitung zur erwarteten Durchlaufzeit. */
  beitragArbeitMin: number
}

export interface RollenKennzahl {
  rolle: Rolle
  arbeitMinProVorgang: number
  stundenProTag: number
  kapazitaetStundenProTag: number
  /** Benötigte durch verfügbare Zeit; über 1 heißt überlastet. */
  auslastung: number
  kostenProVorgang: number
}

export interface Ende {
  ergebnis: string
  anteil: number
  regulaer: boolean
}

export interface Kennzahlen {
  /** Erwartete Durchlaufzeit vom Auslöser bis zum Ende. */
  durchlaufzeitMin: number
  /** Bearbeitungszeit auf dem zeitbestimmenden Pfad. */
  kritischeArbeitMin: number
  /** Anteil der Durchlaufzeit, in dem tatsächlich gearbeitet wird. */
  flusseffizienz: number
  /** Gesamte Arbeitszeit aller Rollen pro Vorgang. */
  arbeitszeitMin: number
  kostenProVorgang: number
  kostenProTag: number
  /** Gleichzeitig offene Vorgänge nach dem Gesetz von Little. */
  offeneVorgaenge: number
  /** Erwartete manuelle Datenübertragungen pro Vorgang. */
  medienbrueche: number
  uebertragungMin: number
  /** Erwartete Wechsel der Rolle zwischen aufeinanderfolgenden Aufgaben. */
  uebergaben: number
  /** Erwartete Wechsel des Systems zwischen aufeinanderfolgenden Aufgaben. */
  systemwechsel: number
  enden: Ende[]
  schritte: Map<Id, SchrittKennzahl>
  rollen: RollenKennzahl[]
  /** Rolle mit der höchsten Auslastung. */
  engpass: RollenKennzahl | null
  /** Erwartete Übergänge `von>nach` zwischen Aufgaben. */
  paare: Map<string, number>
  /** Arbeitsminuten pro Vorgang in Aufgaben ohne gültige Rolle. */
  arbeitOhneRolleMin: number
}

// ---------------------------------------------------------------------------
// Fluss

const SONDE = '\u0000sonde'

interface Fluss {
  /** Erwartete Anzahl, mit der diese Stelle je Vorgang erreicht wird. */
  anteil: number
  /** Letzte ausgeführte Aufgabe je Strang mit Gewicht. */
  letzte: Map<string, number>
}

interface Zaehler {
  haeufigkeit: Map<Id, number>
  uebergaben: number
  systemwechsel: number
  medienbrueche: number
  uebertragungMin: number
  paare: Map<string, number>
  enden: Map<string, number>
}

function neueZaehler(): Zaehler {
  return { haeufigkeit: new Map(), uebergaben: 0, systemwechsel: 0, medienbrueche: 0, uebertragungMin: 0, paare: new Map(), enden: new Map() }
}

function plus<K>(m: Map<K, number>, k: K, w: number): void {
  m.set(k, (m.get(k) ?? 0) + w)
}

function skaliere(f: Fluss, faktor: number): Fluss {
  const letzte = new Map<string, number>()
  for (const [k, w] of f.letzte) letzte.set(k, w * faktor)
  return { anteil: f.anteil * faktor, letzte }
}

interface Kontext {
  aufgaben: Map<Id, Aufgabe>
}

function flussSequenz(schritte: Block[], f: Fluss, z: Zaehler, ctx: Kontext): Fluss {
  let aktuell = f
  for (const b of schritte) aktuell = flussBlock(b, aktuell, z, ctx)
  return aktuell
}

function flussBlock(b: Block, f: Fluss, z: Zaehler, ctx: Kontext): Fluss {
  switch (b.typ) {
    case 'aufgabe': {
      plus(z.haeufigkeit, b.id, f.anteil)
      for (const [von, w] of f.letzte) {
        const vorher = ctx.aufgaben.get(von)
        if (!vorher || w === 0) continue
        plus(z.paare, `${von}>${b.id}`, w)
        if (vorher.rolleId !== b.rolleId) z.uebergaben += w
        if (vorher.mediumId !== b.mediumId) z.systemwechsel += w
      }
      if (b.uebertragung) {
        z.medienbrueche += f.anteil
        z.uebertragungMin += f.anteil * b.uebertragung.minuten
      }
      return { anteil: f.anteil, letzte: new Map([[b.id, f.anteil]]) }
    }
    case 'warten':
      return f
    case 'entscheidung': {
      const aus: Fluss = { anteil: 0, letzte: new Map() }
      for (const zweig of b.zweige) {
        const o = flussSequenz(zweig.schritte, skaliere(f, zweig.anteil), z, ctx)
        if (zweig.ende !== null) {
          plus(z.enden, zweig.ende, o.anteil)
          continue
        }
        aus.anteil += o.anteil
        for (const [k, w] of o.letzte) plus(aus.letzte, k, w)
      }
      return aus
    }
    case 'parallel': {
      if (b.zweige.length === 0) return f
      let anteil = Infinity
      const letzte = new Map<string, number>()
      for (const zweig of b.zweige) {
        const o = flussSequenz(zweig.schritte, f, z, ctx)
        anteil = Math.min(anteil, o.anteil)
        for (const [k, w] of o.letzte) {
          // Läuft derselbe Vorgänger durch mehrere Zweige ohne Aufgabe, zählt er einmal.
          if (f.letzte.has(k)) letzte.set(k, Math.max(letzte.get(k) ?? 0, w))
          else plus(letzte, k, w)
        }
      }
      return { anteil, letzte }
    }
    case 'wiederholung': {
      const p = Math.min(Math.max(b.anteilWiederholung, 0), 0.999)
      // Antwort des Körpers auf einen Einheitsfluss, ohne zu zählen.
      const sonde = flussSequenz(b.koerper.schritte, { anteil: 1, letzte: new Map([[SONDE, 1]]) }, neueZaehler(), ctx)
      const c = sonde.anteil
      const q = sonde.letzte.get(SONDE) ?? 0
      // Gesamter Zufluss in den Körper über alle Durchläufe: E = F + p · Körper(E)
      const eingangAnteil = f.anteil / (1 - p * c)
      const letzte = new Map<string, number>()
      for (const [k, w] of f.letzte) plus(letzte, k, w / (1 - p * q))
      for (const [k, w] of sonde.letzte) if (k !== SONDE) plus(letzte, k, (p * eingangAnteil * w) / (1 - p * q))
      const o = flussSequenz(b.koerper.schritte, { anteil: eingangAnteil, letzte }, z, ctx)
      return skaliere(o, 1 - p)
    }
  }
}

// ---------------------------------------------------------------------------
// Dauer

interface Beitrag {
  warten: number
  arbeit: number
}

interface Dauer {
  gesamt: number
  arbeit: number
  /** Wahrscheinlichkeit, dass der Ablauf hinter dem Block weitergeht. */
  weiter: number
  beitraege: Map<Id, Beitrag>
}

function addiereBeitraege(ziel: Map<Id, Beitrag>, quelle: Map<Id, Beitrag>, faktor: number): void {
  for (const [id, b] of quelle) {
    const alt = ziel.get(id) ?? { warten: 0, arbeit: 0 }
    ziel.set(id, { warten: alt.warten + b.warten * faktor, arbeit: alt.arbeit + b.arbeit * faktor })
  }
}

function dauerSequenz(schritte: Block[]): Dauer {
  const d: Dauer = { gesamt: 0, arbeit: 0, weiter: 1, beitraege: new Map() }
  for (const b of schritte) {
    const x = dauerBlock(b)
    d.gesamt += d.weiter * x.gesamt
    d.arbeit += d.weiter * x.arbeit
    addiereBeitraege(d.beitraege, x.beitraege, d.weiter)
    d.weiter *= x.weiter
  }
  return d
}

function dauerBlock(b: Block): Dauer {
  switch (b.typ) {
    case 'aufgabe':
      return {
        gesamt: b.liegezeitMin + b.bearbeitungMin,
        arbeit: b.bearbeitungMin,
        weiter: 1,
        beitraege: new Map([[b.id, { warten: b.liegezeitMin, arbeit: b.bearbeitungMin }]]),
      }
    case 'warten':
      return { gesamt: b.dauerMin, arbeit: 0, weiter: 1, beitraege: new Map([[b.id, { warten: b.dauerMin, arbeit: 0 }]]) }
    case 'entscheidung': {
      const d: Dauer = { gesamt: 0, arbeit: 0, weiter: 0, beitraege: new Map() }
      for (const z of b.zweige) {
        const x = dauerSequenz(z.schritte)
        d.gesamt += z.anteil * x.gesamt
        d.arbeit += z.anteil * x.arbeit
        d.weiter += z.ende !== null ? 0 : z.anteil * x.weiter
        addiereBeitraege(d.beitraege, x.beitraege, z.anteil)
      }
      return d
    }
    case 'parallel': {
      const zweige = b.zweige.map((z) => dauerSequenz(z.schritte))
      if (zweige.length === 0) return { gesamt: 0, arbeit: 0, weiter: 1, beitraege: new Map() }
      const laengster = zweige.reduce((a, x) => (x.gesamt > a.gesamt ? x : a))
      return { ...laengster, weiter: Math.min(...zweige.map((x) => x.weiter)) }
    }
    case 'wiederholung': {
      const p = Math.min(Math.max(b.anteilWiederholung, 0), 0.999)
      const x = dauerSequenz(b.koerper.schritte)
      const n = 1 / (1 - p * x.weiter)
      const beitraege = new Map<Id, Beitrag>()
      addiereBeitraege(beitraege, x.beitraege, n)
      return { gesamt: x.gesamt * n, arbeit: x.arbeit * n, weiter: x.weiter * (1 - p) * n, beitraege }
    }
  }
}

// ---------------------------------------------------------------------------
// Zusammenführen

export function kapazitaetStundenProTag(r: Rolle, arbeitsstundenProTag: number): number {
  return Math.max(0, r.personen) * arbeitsstundenProTag * (Math.max(0, r.verfuegbarProzent) / 100)
}

export function berechneKennzahlen(p: Prozess): Kennzahlen {
  const aufgaben = new Map<Id, Aufgabe>()
  for (const { block } of durchlaufe(p.ablauf)) if (block.typ === 'aufgabe') aufgaben.set(block.id, block)

  const z = neueZaehler()
  const ende = flussSequenz(p.ablauf.schritte, { anteil: 1, letzte: new Map() }, z, { aufgaben })
  const dauer = dauerSequenz(p.ablauf.schritte)

  const rollenNachId = new Map(p.rollen.map((r) => [r.id, r]))
  const schritte = new Map<Id, SchrittKennzahl>()
  const arbeitJeRolle = new Map<Id, number>()
  let arbeitszeitMin = 0
  let kostenProVorgang = 0
  let arbeitOhneRolleMin = 0

  for (const a of aufgaben.values()) {
    const haeufigkeit = z.haeufigkeit.get(a.id) ?? 0
    const arbeitMin = haeufigkeit * a.bearbeitungMin
    const rolle = a.rolleId ? rollenNachId.get(a.rolleId) : undefined
    const kosten = rolle ? (arbeitMin / 60) * rolle.stundensatz : 0
    if (rolle) plus(arbeitJeRolle, rolle.id, arbeitMin)
    else arbeitOhneRolleMin += arbeitMin
    arbeitszeitMin += arbeitMin
    kostenProVorgang += kosten
    const beitrag = dauer.beitraege.get(a.id) ?? { warten: 0, arbeit: 0 }
    schritte.set(a.id, { id: a.id, haeufigkeit, arbeitMin, kosten, beitragWartenMin: beitrag.warten, beitragArbeitMin: beitrag.arbeit })
  }
  for (const { block } of durchlaufe(p.ablauf)) {
    if (block.typ !== 'warten') continue
    const beitrag = dauer.beitraege.get(block.id) ?? { warten: 0, arbeit: 0 }
    schritte.set(block.id, { id: block.id, haeufigkeit: 0, arbeitMin: 0, kosten: 0, beitragWartenMin: beitrag.warten, beitragArbeitMin: 0 })
  }

  const rollen: RollenKennzahl[] = p.rollen.map((rolle) => {
    const arbeitMinProVorgang = arbeitJeRolle.get(rolle.id) ?? 0
    const stundenProTag = (p.vorgaengeProTag * arbeitMinProVorgang) / 60
    const kapazitaet = kapazitaetStundenProTag(rolle, p.arbeitsstundenProTag)
    const auslastung = kapazitaet > 0 ? stundenProTag / kapazitaet : stundenProTag > 0 ? Infinity : 0
    return {
      rolle,
      arbeitMinProVorgang,
      stundenProTag,
      kapazitaetStundenProTag: kapazitaet,
      auslastung,
      kostenProVorgang: (arbeitMinProVorgang / 60) * rolle.stundensatz,
    }
  })
  const engpass = rollen
    .filter((r) => r.stundenProTag > 0)
    .reduce<RollenKennzahl | null>((a, r) => (a === null || r.auslastung > a.auslastung ? r : a), null)

  const enden: Ende[] = [{ ergebnis: p.ergebnis || 'Ende', anteil: ende.anteil, regulaer: true }]
  for (const [ergebnis, anteil] of z.enden) enden.push({ ergebnis, anteil, regulaer: false })

  const minutenProTag = p.arbeitsstundenProTag * 60
  return {
    durchlaufzeitMin: dauer.gesamt,
    kritischeArbeitMin: dauer.arbeit,
    flusseffizienz: dauer.gesamt > 0 ? dauer.arbeit / dauer.gesamt : 0,
    arbeitszeitMin,
    kostenProVorgang,
    kostenProTag: kostenProVorgang * p.vorgaengeProTag,
    offeneVorgaenge: minutenProTag > 0 ? (p.vorgaengeProTag * dauer.gesamt) / minutenProTag : 0,
    medienbrueche: z.medienbrueche,
    uebertragungMin: z.uebertragungMin,
    uebergaben: z.uebergaben,
    systemwechsel: z.systemwechsel,
    enden,
    schritte,
    rollen,
    engpass,
    paare: z.paare,
    arbeitOhneRolleMin,
  }
}
