/**
 * Anzahl N der Stücke bei „für jede Position“ (Mehrfach). Eine Stelle für alle
 * Nutzer: Kennzahlen, Verteilung, Simulation und Tokenspiel ziehen N aus
 * derselben Verteilung.
 *
 * - **fest** („immer etwa gleich viele“): N = ⌊n⌋ + X mit P(X = 1) = n − ⌊n⌋,
 *   die kleinste Streuung um das Mittel n; bei ganzzahligem n immer genau n.
 * - **schwankt**: P(N = k) = (1 − p) · p^(k−1) für k ≥ 1 mit p = 1 − 1/n,
 *   geometrisch ab 1. Das ist genau die Zahl der Durchläufe einer Wiederholung
 *   mit Anteil p; darauf beruht die Umwandlung einer Mengenschleife.
 */
import type { MehrfachStreuung } from './typen'

/** Mehr Stücke je Vorgang rechnet der Prozesslotse nicht; sonst liefen Rechnung und Simulation ohne Ende. */
export const MAX_ANZAHL = 10_000

export interface AnzahlVerteilung {
  streuung: MehrfachStreuung
  /** Mittel n (fest ≥ 0, schwankt ≥ 1) */
  n: number
  /** fest: ⌊n⌋ */
  k0: number
  /** fest: P(N = ⌊n⌋ + 1) */
  rest: number
  /** schwankt: Anteil p = 1 − 1/n, mit dem nach einem Stück ein weiteres folgt */
  p: number
}

/**
 * Die Verteilung zu Mittel und Streuung; ungültige Werte (die Prüfung meldet
 * sie) werden in den gültigen Bereich gezogen, sehr große auf MAX_ANZAHL.
 */
export function anzahlVerteilung(anzahl: number, streuung: MehrfachStreuung): AnzahlVerteilung {
  const roh = Math.min(Number.isFinite(anzahl) ? anzahl : 0, MAX_ANZAHL)
  if (streuung === 'schwankt') {
    const n = Math.max(1, roh)
    return { streuung, n, k0: 0, rest: 0, p: 1 - 1 / n }
  }
  const n = Math.max(0, roh)
  let k0 = Math.floor(n)
  let rest = n - k0
  if (rest < 1e-9) rest = 0
  if (rest > 1 - 1e-9) {
    k0 += 1
    rest = 0
  }
  return { streuung, n, k0, rest, p: 0 }
}

/** P(N = k) */
export function wahrscheinlichkeit(v: AnzahlVerteilung, k: number): number {
  if (v.streuung === 'schwankt') return k >= 1 ? (1 - v.p) * v.p ** (k - 1) : 0
  if (k === v.k0) return 1 - v.rest
  if (k === v.k0 + 1) return v.rest
  return 0
}

/** P(N ≥ k) */
export function mindestens(v: AnzahlVerteilung, k: number): number {
  if (k <= 0) return 1
  if (v.streuung === 'schwankt') return v.p ** (k - 1)
  if (k <= v.k0) return 1
  if (k === v.k0 + 1) return v.rest
  return 0
}

/** Größtes mögliches N (bei „schwankt“ unbegrenzt) */
export function hoechstens(v: AnzahlVerteilung): number {
  return v.streuung === 'schwankt' ? Infinity : v.k0 + (v.rest > 0 ? 1 : 0)
}

/** Kommt N = 0 vor (der Baustein läuft dann gar nicht)? */
export function kannNull(v: AnzahlVerteilung): boolean {
  return wahrscheinlichkeit(v, 0) > 0
}

/** Kommt N ≥ 1 vor? */
export function kannStueck(v: AnzahlVerteilung): boolean {
  return mindestens(v, 1) > 0
}

/** E[c^N]: Wahrscheinlichkeit, dass alle Stücke normal enden, wenn jedes mit c normal endet */
export function erwartungPotenz(v: AnzahlVerteilung, c: number): number {
  if (v.streuung === 'schwankt') return ((1 - v.p) * c) / (1 - v.p * c)
  return (1 - v.rest) * c ** v.k0 + v.rest * c ** (v.k0 + 1)
}

/**
 * Erwartete Zahl der Durchläufe, wenn nacheinander gearbeitet wird und jeder
 * Durchlauf mit c normal endet (sonst beginnt keiner mehr): E[(1 − c^N)/(1 − c)]
 * = Σ_{j≥1} P(N ≥ j) · c^(j−1); bei c = 1 ist das E[N].
 */
export function erwartungLaeufe(v: AnzahlVerteilung, c: number): number {
  if (v.streuung === 'schwankt') return 1 / (1 - v.p * c)
  const summe = (k: number) => (Math.abs(1 - c) < 1e-12 ? k : (1 - c ** k) / (1 - c))
  return (1 - v.rest) * summe(v.k0) + v.rest * summe(v.k0 + 1)
}

/**
 * E[F^N] für einen Wert F zwischen 0 und 1, ohne den Teil N = 0: So entsteht
 * aus der Verteilungsfunktion F eines Stücks die des spätesten von N Stücken
 * (gleichzeitig), getrennt von den Vorgängen ohne Stück.
 */
export function erwartungMaximumOhneNull(v: AnzahlVerteilung, f: number): number {
  if (v.streuung === 'schwankt') return ((1 - v.p) * f) / (1 - v.p * f)
  const teil = (k: number, w: number) => (k >= 1 ? w * f ** k : 0)
  return teil(v.k0, 1 - v.rest) + teil(v.k0 + 1, v.rest)
}

const MAX_STUECKE = 100_000

/** Zieht N mit der Zufallsquelle (Simulation und Tokenspiel). */
export function zieheAnzahl(v: AnzahlVerteilung, zufall: () => number): number {
  if (v.streuung === 'fest') return v.k0 + (v.rest > 0 && zufall() < v.rest ? 1 : 0)
  let n = 1
  while (n < MAX_STUECKE && zufall() < v.p) n++
  return n
}
