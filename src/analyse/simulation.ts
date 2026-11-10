/**
 * Monte-Carlo-Simulation der Durchlaufzeit. Jeder Lauf wählt an
 * Entscheidungen einen Ausgang nach den Anteilen, würfelt Wiederholungen aus
 * und nimmt bei „Gleichzeitig“ den längsten Zweig. Die Zeiten je Schritt sind
 * die geschätzten Durchschnittswerte; die Streuung entsteht also nur aus dem
 * Ablauf selbst. Mit festem Startwert ist das Ergebnis reproduzierbar.
 */
import type { Block, Prozess } from '../modell/typen'

export interface Simulationsergebnis {
  anzahl: number
  mittelMin: number
  medianMin: number
  p90Min: number
  maxMin: number
  /** Alle Durchlaufzeiten, aufsteigend sortiert. */
  zeiten: Float64Array
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
  beendet: boolean
}

function laufeSequenz(schritte: Block[], zufall: () => number): Lauf {
  let zeit = 0
  for (const b of schritte) {
    const r = laufeBlock(b, zufall)
    zeit += r.zeit
    if (r.beendet) return { zeit, beendet: true }
  }
  return { zeit, beendet: false }
}

function laufeBlock(b: Block, zufall: () => number): Lauf {
  switch (b.typ) {
    case 'aufgabe':
      return { zeit: b.liegezeitMin + b.bearbeitungMin, beendet: false }
    case 'warten':
      return { zeit: b.dauerMin, beendet: false }
    case 'entscheidung': {
      if (b.zweige.length === 0) return { zeit: 0, beendet: false }
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
      const r = laufeSequenz(gewaehlt.schritte, zufall)
      return { zeit: r.zeit, beendet: r.beendet || gewaehlt.ende !== null }
    }
    case 'parallel': {
      let zeit = 0
      let beendet = false
      for (const z of b.zweige) {
        const r = laufeSequenz(z.schritte, zufall)
        zeit = Math.max(zeit, r.zeit)
        beendet ||= r.beendet
      }
      return { zeit, beendet }
    }
    case 'wiederholung': {
      let zeit = 0
      for (let i = 0; i < MAX_WIEDERHOLUNGEN; i++) {
        const r = laufeSequenz(b.koerper.schritte, zufall)
        zeit += r.zeit
        if (r.beendet) return { zeit, beendet: true }
        if (zufall() >= b.anteilWiederholung) break
      }
      return { zeit, beendet: false }
    }
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
  for (let i = 0; i < anzahl; i++) {
    const t = laufeSequenz(p.ablauf.schritte, zufall).zeit
    zeiten[i] = t
    summe += t
  }
  zeiten.sort()
  return {
    anzahl,
    mittelMin: anzahl > 0 ? summe / anzahl : 0,
    medianMin: quantil(zeiten, 0.5),
    p90Min: quantil(zeiten, 0.9),
    maxMin: anzahl > 0 ? zeiten[anzahl - 1] : 0,
    zeiten,
  }
}
