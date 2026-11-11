/**
 * Diskrete Verteilungen der Dauer, gebraucht für „Gleichzeitig“: Der
 * Erwartungswert des Maximums mehrerer Zweige ist größer als das Maximum der
 * Erwartungswerte, sobald die Zweige streuen (Entscheidungen, Wiederholungen).
 *
 * Eine Verteilung ist eine Liste von Werten mit Masse. Die Masse darf unter 1
 * liegen (Teilverteilung, z. B. „Rücksprung mit 20 %“). Damit die Listen klein
 * bleiben, werden sie zusammengefasst; das geschieht mittelwerttreu, so dass
 * Erwartungswerte von Summen exakt bleiben.
 */
import { oderZiehung } from '../modell/operationen'
import type { Block, Id, Oder } from '../modell/typen'

export interface Verteilung {
  wert: number[]
  masse: number[]
}

const MAX_PUNKTE = 160
const MIN_MASSE = 1e-9

export function punkt(t: number, m = 1): Verteilung {
  return { wert: [t], masse: [m] }
}

export function leer(): Verteilung {
  return { wert: [], masse: [] }
}

export function masse(v: Verteilung): number {
  return v.masse.reduce((s, m) => s + m, 0)
}

export function erwartung(v: Verteilung): number {
  const m = masse(v)
  if (m <= 0) return 0
  return v.wert.reduce((s, w, i) => s + w * v.masse[i], 0) / m
}

export function skaliere(v: Verteilung, f: number): Verteilung {
  return { wert: [...v.wert], masse: v.masse.map((m) => m * f) }
}

export function verschiebe(v: Verteilung, t: number): Verteilung {
  return { wert: v.wert.map((w) => w + t), masse: [...v.masse] }
}

/** Sortiert, fasst gleiche Werte zusammen und begrenzt die Zahl der Punkte. */
function ordne(paare: [number, number][]): Verteilung {
  const sortiert = paare.filter(([, m]) => m > MIN_MASSE).sort((a, b) => a[0] - b[0])
  const wert: number[] = []
  const masseListe: number[] = []
  for (const [w, m] of sortiert) {
    const i = wert.length - 1
    if (i >= 0 && Math.abs(wert[i] - w) < 1e-9) masseListe[i] += m
    else {
      wert.push(w)
      masseListe.push(m)
    }
  }
  const v = { wert, masse: masseListe }
  return v.wert.length > MAX_PUNKTE ? kompakt(v) : v
}

/** Mittelwerttreu auf höchstens MAX_PUNKTE Punkte zusammenfassen (gleich breite Abschnitte). */
function kompakt(v: Verteilung): Verteilung {
  const min = v.wert[0]
  const max = v.wert[v.wert.length - 1]
  const breite = (max - min) / MAX_PUNKTE || 1
  const summeW = new Array<number>(MAX_PUNKTE).fill(0)
  const summeM = new Array<number>(MAX_PUNKTE).fill(0)
  v.wert.forEach((w, i) => {
    const k = Math.min(MAX_PUNKTE - 1, Math.floor((w - min) / breite))
    summeW[k] += w * v.masse[i]
    summeM[k] += v.masse[i]
  })
  const wert: number[] = []
  const masseListe: number[] = []
  for (let k = 0; k < MAX_PUNKTE; k++) {
    if (summeM[k] <= MIN_MASSE) continue
    wert.push(summeW[k] / summeM[k])
    masseListe.push(summeM[k])
  }
  return { wert, masse: masseListe }
}

export function addiere(a: Verteilung, b: Verteilung): Verteilung {
  return ordne([...a.wert.map((w, i) => [w, a.masse[i]] as [number, number]), ...b.wert.map((w, i) => [w, b.masse[i]] as [number, number])])
}

/** Summe zweier unabhängiger Dauern (Faltung). */
export function falte(a: Verteilung, b: Verteilung): Verteilung {
  const paare: [number, number][] = []
  a.wert.forEach((wa, i) => b.wert.forEach((wb, j) => paare.push([wa + wb, a.masse[i] * b.masse[j]])))
  return ordne(paare)
}

/** Verteilung des Maximums unabhängiger, vollständiger Dauern (Produkt der Verteilungsfunktionen). */
export function maximum(vs: Verteilung[]): Verteilung {
  const normiert = vs.filter((v) => masse(v) > 0).map((v) => skaliere(v, 1 / masse(v)))
  if (normiert.length === 0) return punkt(0)
  const werte = [...new Set(normiert.flatMap((v) => v.wert))].sort((a, b) => a - b)
  const zeiger = normiert.map(() => 0)
  const kumuliert = normiert.map(() => 0)
  let vorher = 0
  const paare: [number, number][] = []
  for (const t of werte) {
    normiert.forEach((v, k) => {
      while (zeiger[k] < v.wert.length && v.wert[zeiger[k]] <= t + 1e-9) kumuliert[k] += v.masse[zeiger[k]++]
    })
    const f = kumuliert.reduce((p, c) => p * Math.min(1, c), 1)
    if (f - vorher > MIN_MASSE) paare.push([t, f - vorher])
    vorher = f
  }
  return ordne(paare)
}

/** Summe Σ_{k≥0} wieder^{*k}: wie oft ein Abschnitt wiederholt wird, als Verteilung der Zusatzdauer. */
function geometrisch(wieder: Verteilung): Verteilung {
  let summe = punkt(0)
  let term = punkt(0)
  for (let k = 0; k < 200; k++) {
    term = falte(term, wieder)
    if (masse(term) < 1e-7) break
    summe = addiere(summe, term)
  }
  return summe
}

interface Ergebnis {
  /** Dauer bei normalem Weiterlaufen */
  weiter: Verteilung
  /** Dauer bis zu einem Rücksprung, je Rücksprungbereich */
  rueck: Map<Id, Verteilung>
}

export type Zeitart = 'gesamt' | 'arbeit'

function plus(ziel: Map<Id, Verteilung>, id: Id, v: Verteilung): void {
  ziel.set(id, ziel.has(id) ? addiere(ziel.get(id)!, v) : v)
}

/** Verteilung der Dauer einer Folge von Schritten (Gesamtzeit oder nur Bearbeitung). */
export function verteilungSequenz(schritte: Block[], art: Zeitart): Ergebnis {
  let weiter = punkt(0)
  const rueck = new Map<Id, Verteilung>()
  for (const b of schritte) {
    const x = verteilungBlock(b, art)
    for (const [id, r] of x.rueck) plus(rueck, id, falte(weiter, r))
    weiter = falte(weiter, x.weiter)
  }
  return { weiter, rueck }
}

function verteilungBlock(b: Block, art: Zeitart): Ergebnis {
  switch (b.typ) {
    case 'aufgabe':
      return { weiter: punkt(art === 'gesamt' ? b.liegezeitMin + b.bearbeitungMin : b.bearbeitungMin), rueck: new Map() }
    case 'warten':
      return { weiter: punkt(art === 'gesamt' ? b.dauerMin : 0), rueck: new Map() }
    case 'entscheidung': {
      let weiter = leer()
      const rueck = new Map<Id, Verteilung>()
      for (const z of b.zweige) {
        const x = verteilungSequenz(z.schritte, art)
        const warten = art === 'gesamt' && b.art === 'ereignis' && z.ereignis ? z.ereignis.dauerMin : 0
        const aus = skaliere(verschiebe(x.weiter, warten), z.anteil)
        for (const [id, r] of x.rueck) plus(rueck, id, skaliere(verschiebe(r, warten), z.anteil))
        if (z.ende !== null) continue // innerhalb von „Gleichzeitig“ nicht erlaubt; die Prüfung meldet es
        if (z.zurueckZu !== null) plus(rueck, z.zurueckZu, aus)
        else weiter = addiere(weiter, aus)
      }
      return { weiter, rueck }
    }
    case 'parallel':
      return { weiter: maximum(b.zweige.map((z) => verteilungSequenz(z.schritte, art).weiter)), rueck: new Map() }
    case 'oder':
      return { weiter: verteilungOder(b, art), rueck: new Map() }
    case 'wiederholung': {
      const x = verteilungSequenz(b.koerper.schritte, art)
      const p = Math.min(Math.max(b.anteilWiederholung, 0), 0.999)
      const wieder = b.modus === 'anteil' ? skaliere(x.weiter, p) : (x.rueck.get(b.id) ?? leer())
      const aus = b.modus === 'anteil' ? skaliere(x.weiter, 1 - p) : x.weiter
      const vorher = geometrisch(wieder)
      const rueck = new Map<Id, Verteilung>()
      for (const [id, r] of x.rueck) if (id !== b.id) rueck.set(id, falte(vorher, r))
      return { weiter: falte(vorher, aus), rueck }
    }
  }
}

/**
 * Dauer einer ODER-Verzweigung: Jeder Weg läuft unabhängig mit seiner
 * Wahrscheinlichkeit (sonst Dauer 0), weiter geht es nach dem längsten
 * gewählten. Läuft keiner, nimmt der Standardweg die Masse bei 0 ein.
 */
export function verteilungOder(b: Oder, art: Zeitart): Verteilung {
  const zug = oderZiehung(b)
  const iStandard = b.zweige.findIndex((z) => z.id === b.standard)
  const vollstaendig = (i: number): Verteilung => {
    const d = verteilungSequenz(b.zweige[i].schritte, art).weiter
    const m = masse(d)
    return m > 0 ? skaliere(d, 1 / m) : punkt(0)
  }
  if (zug.ausschliessend) {
    // Grenzfall: genau ein Weg läuft
    let ergebnis = leer()
    b.zweige.forEach((_, i) => {
      if (zug.r[i] > 0) ergebnis = addiere(ergebnis, skaliere(vollstaendig(i), zug.r[i]))
    })
    return ergebnis
  }
  const mischungen: Verteilung[] = []
  b.zweige.forEach((_, i) => {
    if (i === iStandard) return
    // jeder Weg unabhängig: mit rᵢ seine Dauer, sonst 0
    mischungen.push(addiere(skaliere(vollstaendig(i), zug.r[i]), punkt(0, 1 - zug.r[i])))
  })
  const roh = mischungen.length > 0 ? maximum(mischungen) : punkt(0)
  // „Keiner läuft“ liegt bei 0 mit Masse 1 − Z
  const ohneLeer = entferneNullmasse(roh, 1 - zug.z)
  if (iStandard >= 0) return addiere(ohneLeer, skaliere(vollstaendig(iStandard), 1 - zug.z))
  // ohne Standardweg: auf „mindestens einer“ bedingen
  return zug.z > 0 ? skaliere(ohneLeer, 1 / zug.z) : ohneLeer
}

/**
 * Nimmt Masse q beim Wert 0 heraus. Hat das Zusammenfassen den Wert 0 mit
 * kleinen Werten verschmolzen, wird der Wert so verschoben, dass der
 * Erwartungswert exakt bleibt.
 */
function entferneNullmasse(v: Verteilung, q: number): Verteilung {
  if (q <= 0 || v.wert.length === 0) return v
  const wert = [...v.wert]
  const masseListe = [...v.masse]
  const m0 = masseListe[0]
  const rest = m0 - q
  if (rest <= 1e-12) {
    wert.shift()
    masseListe.shift()
  } else {
    wert[0] = (wert[0] * m0) / rest
    masseListe[0] = rest
  }
  return { wert, masse: masseListe }
}

export function erwartungOder(b: Oder, art: Zeitart): number {
  return erwartung(verteilungOder(b, art))
}

/** Erwartungswert des Maximums der Zweige von „Gleichzeitig“. */
export function erwartungMaximum(zweige: Block[][], art: Zeitart): number {
  return erwartung(maximum(zweige.map((s) => verteilungSequenz(s, art).weiter)))
}
