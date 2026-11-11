/**
 * Monte-Carlo-Simulation der Durchlaufzeit. Jeder Lauf wählt an
 * Entscheidungen einen Ausgang nach den Anteilen, würfelt Wiederholungen aus
 * und nimmt bei „Gleichzeitig“ den längsten Zweig. Die Zeiten je Schritt sind
 * die geschätzten Durchschnittswerte; die Streuung entsteht also nur aus dem
 * Ablauf selbst (Entscheidungen, Wiederholungen), nicht aus schwankenden
 * Bearbeitungszeiten. Das 90-%-Quantil ist deshalb eher zu niedrig. Mit
 * festem Startwert ist das Ergebnis reproduzierbar.
 */
import { anzahlVerteilung, zieheAnzahl } from '../modell/anzahl'
import { oderZiehung } from '../modell/operationen'
import { unerwartet, type Block, type Id, type Prozess } from '../modell/typen'

export interface ErgebnisDauer {
  ergebnis: string
  regulaer: boolean
  /** Anteil der Läufe mit diesem Ergebnis */
  anteil: number
  /** Mittlere Durchlaufzeit der Läufe mit diesem Ergebnis */
  mittelMin: number
}

export interface Simulationsergebnis {
  anzahl: number
  mittelMin: number
  medianMin: number
  p90Min: number
  maxMin: number
  /** Alle Durchlaufzeiten, aufsteigend sortiert. */
  zeiten: Float64Array
  /** Je Ergebnis (reguläres Ende zuerst): Anteil und mittlere Durchlaufzeit */
  ergebnisse: ErgebnisDauer[]
}

/** Kleiner, schneller Zufallsgenerator mit Startwert (mulberry32). */
export function zufallMitStartwert(startwert: number): () => number {
  let a = startwert >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MAX_WIEDERHOLUNGEN = 10_000

interface Lauf {
  zeit: number
  /** Ergebnis eines vorzeitigen Endes, sonst null */
  ende: string | null
  /** Rücksprung zum Anfang dieses Bereichs */
  rueck: Id | null
}

function laufeSequenz(schritte: Block[], zufall: () => number): Lauf {
  let zeit = 0
  for (const b of schritte) {
    const r = laufeBlock(b, zufall)
    zeit += r.zeit
    if (r.ende !== null || r.rueck) return { zeit, ende: r.ende, rueck: r.rueck }
  }
  return { zeit, ende: null, rueck: null }
}

function laufeBlock(b: Block, zufall: () => number): Lauf {
  switch (b.typ) {
    case 'aufgabe':
      return { zeit: b.liegezeitMin + b.bearbeitungMin, ende: null, rueck: null }
    case 'warten':
      return { zeit: b.dauerMin, ende: null, rueck: null }
    case 'entscheidung': {
      if (b.zweige.length === 0) return { zeit: 0, ende: null, rueck: null }
      const summe = b.zweige.reduce((s, z) => s + Math.max(0, z.anteil), 0)
      let wurf = zufall() * (summe > 0 ? summe : 1)
      let gewaehlt = b.zweige[b.zweige.length - 1]
      for (const z of b.zweige) {
        wurf -= summe > 0 ? Math.max(0, z.anteil) : 1 / b.zweige.length
        if (wurf < 0) {
          gewaehlt = z
          break
        }
      }
      const warten = b.art === 'ereignis' && gewaehlt.ereignis ? gewaehlt.ereignis.dauerMin : 0
      const r = laufeSequenz(gewaehlt.schritte, zufall)
      if (r.ende !== null || r.rueck) return { zeit: warten + r.zeit, ende: r.ende, rueck: r.rueck }
      return { zeit: warten + r.zeit, ende: gewaehlt.ende, rueck: gewaehlt.ende === null ? gewaehlt.zurueckZu : null }
    }
    case 'oder': {
      // Wie in der Rechnung: unabhängige Würfe; ohne Standardweg wird eine leere Auswahl verworfen
      const zug = oderZiehung(b)
      let gewaehlt: number[] = []
      if (zug.ausschliessend) {
        let wurf = zufall()
        const i = zug.r.findIndex((r) => (wurf -= r) < 0)
        gewaehlt = [i >= 0 ? i : zug.r.length - 1]
      } else {
        for (let versuch = 0; versuch < 10_000; versuch++) {
          gewaehlt = zug.r.map((r, i) => (zufall() < r ? i : -1)).filter((i) => i >= 0)
          if (gewaehlt.length > 0 || b.standard !== null) break
        }
        if (gewaehlt.length === 0 && b.standard !== null) gewaehlt = [b.zweige.findIndex((z) => z.id === b.standard)]
      }
      let zeit = 0
      let ende: string | null = null
      for (const i of gewaehlt) {
        const r = laufeSequenz(b.zweige[i].schritte, zufall)
        zeit = Math.max(zeit, r.zeit)
        ende ??= r.ende
      }
      return { zeit, ende, rueck: null }
    }
    case 'parallel': {
      const art = b.art
      if (art !== 'alle') return unerwartet(art)
      let zeit = 0
      let ende: string | null = null
      for (const z of b.zweige) {
        const r = laufeSequenz(z.schritte, zufall)
        zeit = Math.max(zeit, r.zeit)
        ende ??= r.ende
      }
      return { zeit, ende, rueck: null }
    }
    case 'wiederholung': {
      let zeit = 0
      for (let i = 0; i < MAX_WIEDERHOLUNGEN; i++) {
        const r = laufeSequenz(b.koerper.schritte, zufall)
        zeit += r.zeit
        if (r.ende !== null) return { zeit, ende: r.ende, rueck: null }
        if (r.rueck && r.rueck !== b.id) return { zeit, ende: null, rueck: r.rueck }
        if (b.modus === 'ruecksprung' ? r.rueck !== b.id : zufall() >= b.anteilWiederholung) break
      }
      return { zeit, ende: null, rueck: null }
    }
    case 'teilprozess':
      return laufeSequenz(b.koerper.schritte, zufall)
    case 'mehrfach': {
      // N wie in der Rechnung ziehen; die Liegezeit zählt einmal, wenn es Stücke gibt
      const n = zieheAnzahl(anzahlVerteilung(b.anzahl, b.streuung), zufall)
      if (n === 0) return { zeit: 0, ende: null, rueck: null }
      const ausfuehrung = b.ausfuehrung
      switch (ausfuehrung) {
        case 'nacheinander': {
          let zeit = b.liegezeitMin
          for (let i = 0; i < n; i++) {
            const r = laufeSequenz(b.koerper.schritte, zufall)
            zeit += r.zeit
            if (r.ende !== null || r.rueck) return { zeit, ende: r.ende, rueck: r.rueck }
          }
          return { zeit, ende: null, rueck: null }
        }
        case 'gleichzeitig': {
          // das späteste Stück zählt; Enden darin meldet die Prüfung als Fehler
          let spaetestes = 0
          let ende: string | null = null
          for (let i = 0; i < n; i++) {
            const r = laufeSequenz(b.koerper.schritte, zufall)
            spaetestes = Math.max(spaetestes, r.zeit)
            ende ??= r.ende
          }
          return { zeit: b.liegezeitMin + spaetestes, ende, rueck: null }
        }
        default:
          return unerwartet(ausfuehrung)
      }
    }
    default:
      return unerwartet(b)
  }
}

/** Wert, unter dem der Anteil `q` aller Läufe liegt (Nearest-Rank-Verfahren). */
export function quantil(sortiert: Float64Array, q: number): number {
  if (sortiert.length === 0) return 0
  const rang = Math.min(sortiert.length, Math.max(1, Math.ceil(q * sortiert.length)))
  return sortiert[rang - 1]
}

export function simuliere(p: Prozess, anzahl = 5000, startwert = 20261110): Simulationsergebnis {
  const zufall = zufallMitStartwert(startwert)
  const zeiten = new Float64Array(anzahl)
  let summe = 0
  const jeEnde = new Map<string | null, { anzahl: number; summe: number }>([[null, { anzahl: 0, summe: 0 }]])
  for (let i = 0; i < anzahl; i++) {
    const lauf = laufeSequenz(p.ablauf.schritte, zufall)
    const t = lauf.zeit
    zeiten[i] = t
    summe += t
    const e = jeEnde.get(lauf.ende) ?? { anzahl: 0, summe: 0 }
    e.anzahl++
    e.summe += t
    jeEnde.set(lauf.ende, e)
  }
  zeiten.sort()
  const ergebnisse: ErgebnisDauer[] = [...jeEnde]
    .filter(([, e]) => e.anzahl > 0)
    .map(([ende, e]) => ({ ergebnis: ende ?? (p.ergebnis || 'Ende'), regulaer: ende === null, anteil: e.anzahl / anzahl, mittelMin: e.summe / e.anzahl }))
  return {
    anzahl,
    mittelMin: anzahl > 0 ? summe / anzahl : 0,
    medianMin: quantil(zeiten, 0.5),
    p90Min: quantil(zeiten, 0.9),
    maxMin: anzahl > 0 ? zeiten[anzahl - 1] : 0,
    zeiten,
    ergebnisse,
  }
}
