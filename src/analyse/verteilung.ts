/**
 * Diskrete Verteilungen der Dauer, gebraucht für „Gleichzeitig“: Der
 * Erwartungswert des Maximums mehrerer Zweige ist größer als das Maximum der
 * Erwartungswerte, sobald die Zweige streuen (Entscheidungen, Wiederholungen).
 *
 * Eine Verteilung ist eine Liste von Werten mit Masse. Die Masse darf unter 1
 * liegen (Teilverteilung, z. B. „Rücksprung mit 20 %“). Jeder Baustein liefert
 * Teilverteilungen mit zusammen Masse 1: W (weiter hinter dem Baustein), R_b
 * (Rücksprung zu Bereich b) und E_r (der Vorgang endet mit Ergebnis r). Damit
 * die Listen klein bleiben, werden sie zusammengefasst; das geschieht
 * mittelwerttreu, so dass Erwartungswerte von Summen exakt bleiben.
 */
import { anzahlVerteilung, erwartungMaximumOhneNull, mindestens, wahrscheinlichkeit, type AnzahlVerteilung } from '../modell/anzahl'
import { oderZiehung, unterbrechungsAnteile, unterbrechungsZeit } from '../modell/operationen'
import { unerwartet, unterbrechungenVon, type Block, type Id, type Mehrfach, type Oder, type Unterbrechbar } from '../modell/typen'

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

export interface Teilverteilungen {
  /** Dauer bei normalem Weiterlaufen (W) */
  weiter: Verteilung
  /** Dauer bis zu einem Rücksprung, je Rücksprungbereich (R) */
  rueck: Map<Id, Verteilung>
  /** Dauer bis zum Ende des Vorgangs, je Ergebnis (E) */
  ende: Map<string, Verteilung>
}

export type Zeitart = 'gesamt' | 'arbeit'

function plus(ziel: Map<string, Verteilung>, id: string, v: Verteilung): void {
  ziel.set(id, ziel.has(id) ? addiere(ziel.get(id)!, v) : v)
}

/** Verteilung der Dauer einer Folge von Schritten (Gesamtzeit oder nur Bearbeitung). */
export function verteilungSequenz(schritte: Block[], art: Zeitart): Teilverteilungen {
  let weiter = punkt(0)
  const rueck = new Map<Id, Verteilung>()
  const ende = new Map<string, Verteilung>()
  for (const b of schritte) {
    const x = verteilungBlock(b, art)
    // Rücksprünge und Enden eines Bausteins kommen nach der Zeit davor
    for (const [id, r] of x.rueck) plus(rueck, id, falte(weiter, r))
    for (const [e, v] of x.ende) plus(ende, e, falte(weiter, v))
    weiter = falte(weiter, x.weiter)
  }
  return { weiter, rueck, ende }
}

export function verteilungBlock(b: Block, art: Zeitart): Teilverteilungen {
  const basis = verteilungOhneUnterbrechung(b, art)
  return unterbrechungenVon(b).length > 0 ? verteilungMitUnterbrechungen(b as Unterbrechbar, basis, art) : basis
}

/** Alle Teile (weiter, Rücksprünge, Enden) zu einer Verteilung mit Masse 1 vereint: die Dauer eines Durchlaufs, wie auch immer er endet. */
function alleTeile(t: Teilverteilungen): Verteilung {
  return [t.weiter, ...t.rueck.values(), ...t.ende.values()].reduce((s, v) => addiere(s, v), leer())
}

/** Jeden Wert auf höchstens t kürzen (Arbeit bis zu einer Frist). */
function hoechstens(v: Verteilung, t: number): Verteilung {
  return addiere(leer(), { wert: v.wert.map((w) => Math.min(t, w)), masse: [...v.masse] })
}

/**
 * Erwartete Bearbeitungszeit eines Rahmens bis zur Frist t: E[min(t, TCT)],
 * aus der Verteilung der Bearbeitungszeit eines Durchlaufs ohne die
 * Unterbrechungen des Rahmens selbst.
 */
export function erwartungMinimum(b: Unterbrechbar, t: number): number {
  const v = alleTeile(verteilungOhneUnterbrechung(b, 'arbeit'))
  return v.wert.reduce((s, w, i) => s + Math.min(t, w) * v.masse[i], 0)
}

/**
 * Teilverteilungen eines Schritts mit Unterbrechungen. Normal (Anteil
 * 1 − Σq) die des Schritts; unterbrochen von j die Zeit bis zur Unterbrechung
 * gefaltet mit dem Ausnahmeweg, mit dessen „Danach“. Zeit bis zur
 * Unterbrechung: die Frist bzw. der Zeitpunkt der Nachricht (an einem Rahmen
 * jeder Wert des Durchlaufs halbiert); nur Bearbeitung: an einer Aufgabe
 * min(B, max(0, t − L)), an einem Rahmen min(t, TCT) bzw. die halbe TCT.
 */
function verteilungMitUnterbrechungen(b: Unterbrechbar, basis: Teilverteilungen, art: Zeitart): Teilverteilungen {
  const { normal, je } = unterbrechungsAnteile(b)
  let weiter = skaliere(basis.weiter, normal)
  const rueck = new Map<Id, Verteilung>()
  const ende = new Map<string, Verteilung>()
  for (const [id, r] of basis.rueck) rueck.set(id, skaliere(r, normal))
  for (const [e, v] of basis.ende) ende.set(e, skaliere(v, normal))
  let durchlauf: Verteilung | null = null
  const ganz = () => (durchlauf ??= alleTeile(basis))
  for (const u of b.unterbrechungen ?? []) {
    const q = je.get(u.id) ?? 0
    if (!u.unterbrechend || q <= 0) continue
    const t = unterbrechungsZeit(b, u)
    let bis: Verteilung
    if (t === null) bis = { wert: ganz().wert.map((w) => w / 2), masse: [...ganz().masse] }
    else if (art === 'gesamt') bis = punkt(t)
    else if (b.typ === 'aufgabe') bis = punkt(Math.min(Math.max(0, b.bearbeitungMin), Math.max(0, t - Math.max(0, b.liegezeitMin))))
    else bis = hoechstens(ganz(), t)
    const x = verteilungSequenz(u.schritte, art)
    const nach = (v: Verteilung) => skaliere(falte(bis, v), q)
    for (const [id, r] of x.rueck) plus(rueck, id, nach(r))
    for (const [e, v] of x.ende) plus(ende, e, nach(v))
    const aus = nach(x.weiter)
    if (u.ende !== null) plus(ende, u.ende, aus)
    else if (u.zurueckZu !== null) plus(rueck, u.zurueckZu, aus)
    else weiter = addiere(weiter, aus)
  }
  return { weiter, rueck, ende }
}

function verteilungOhneUnterbrechung(b: Block, art: Zeitart): Teilverteilungen {
  switch (b.typ) {
    case 'aufgabe':
      return { weiter: punkt(art === 'gesamt' ? b.liegezeitMin + b.bearbeitungMin : b.bearbeitungMin), rueck: new Map(), ende: new Map() }
    case 'warten':
      return { weiter: punkt(art === 'gesamt' ? b.dauerMin : 0), rueck: new Map(), ende: new Map() }
    case 'entscheidung': {
      let weiter = leer()
      const rueck = new Map<Id, Verteilung>()
      const ende = new Map<string, Verteilung>()
      for (const z of b.zweige) {
        const x = verteilungSequenz(z.schritte, art)
        const warten = art === 'gesamt' && b.art === 'ereignis' && z.ereignis ? z.ereignis.dauerMin : 0
        const aus = skaliere(verschiebe(x.weiter, warten), z.anteil)
        for (const [id, r] of x.rueck) plus(rueck, id, skaliere(verschiebe(r, warten), z.anteil))
        for (const [e, v] of x.ende) plus(ende, e, skaliere(verschiebe(v, warten), z.anteil))
        if (z.ende !== null) plus(ende, z.ende, aus)
        else if (z.zurueckZu !== null) plus(rueck, z.zurueckZu, aus)
        else weiter = addiere(weiter, aus)
      }
      return { weiter, rueck, ende }
    }
    case 'parallel': {
      const parallelArt = b.art
      switch (parallelArt) {
        case 'alle':
          // Enden in Zweigen meldet die Prüfung als Fehler (Verklemmung); die Abbruchkombination folgt mit Schritt 5 von Format 4.
          return { weiter: maximum(b.zweige.map((z) => verteilungSequenz(z.schritte, art).weiter)), rueck: new Map(), ende: new Map() }
        default:
          return unerwartet(parallelArt)
      }
    }
    case 'oder':
      return { weiter: verteilungOder(b, art), rueck: new Map(), ende: new Map() }
    case 'wiederholung': {
      const x = verteilungSequenz(b.koerper.schritte, art)
      const p = Math.min(Math.max(b.anteilWiederholung, 0), 0.999)
      const wieder = b.modus === 'anteil' ? skaliere(x.weiter, p) : (x.rueck.get(b.id) ?? leer())
      const aus = b.modus === 'anteil' ? skaliere(x.weiter, 1 - p) : x.weiter
      const vorher = geometrisch(wieder)
      const rueck = new Map<Id, Verteilung>()
      for (const [id, r] of x.rueck) if (id !== b.id) rueck.set(id, falte(vorher, r))
      const ende = new Map<string, Verteilung>()
      for (const [e, v] of x.ende) ende.set(e, falte(vorher, v))
      return { weiter: falte(vorher, aus), rueck, ende }
    }
    case 'teilprozess':
      return verteilungSequenz(b.koerper.schritte, art)
    case 'mehrfach':
      return verteilungMehrfach(b, art)
    default:
      return unerwartet(b)
  }
}

/** Erwartung über alle Teile (weiter, Rücksprünge, Enden): die Dauer des Bausteins im Schnitt. */
export function erwartungGesamt(t: Teilverteilungen): number {
  const teile = [t.weiter, ...t.rueck.values(), ...t.ende.values()]
  return teile.reduce((s, v) => s + erwartung(v) * masse(v), 0)
}

/**
 * W^{*k} und Σ_{j<k} W^{*j} durch Verdoppeln, mit O(log k) Faltungen:
 * P_2k = P_k ∗ P_k, S_2k = S_k + P_k ∗ S_k; ein Stück mehr: S_k+1 = S_k + P_k, P_k+1 = P_k ∗ W.
 */
function potenzUndSumme(w: Verteilung, k: number): { potenz: Verteilung; summe: Verteilung } {
  if (k <= 0) return { potenz: punkt(0), summe: leer() }
  const halb = potenzUndSumme(w, Math.floor(k / 2))
  let potenz = falte(halb.potenz, halb.potenz)
  let summe = addiere(halb.summe, falte(halb.potenz, halb.summe))
  if (k % 2 === 1) {
    summe = addiere(summe, potenz)
    potenz = falte(potenz, w)
  }
  return { potenz, summe }
}

/** Spätestes von N Stücken mit der Dauer d (Masse 1): Verteilungsfunktion E[F(t)^N] ohne den Teil N = 0. */
function spaetestes(v: AnzahlVerteilung, d: Verteilung): Verteilung {
  const m = masse(d)
  if (m <= 0) return leer()
  let kumuliert = 0
  let vorher = 0
  const paare: [number, number][] = []
  d.wert.forEach((w, i) => {
    kumuliert += d.masse[i] / m
    const g = erwartungMaximumOhneNull(v, Math.min(1, kumuliert))
    if (g - vorher > MIN_MASSE) paare.push([w, g - vorher])
    vorher = g
  })
  return ordne(paare)
}

/**
 * „Für jedes Stück“: N Durchläufe des Körpers (N aus anzahl.ts), dazu einmal
 * die Liegezeit, wenn N ≥ 1. Nacheinander ist es die Mischung über N der
 * N-fachen Faltung; ein Ende in einem Durchlauf beendet die Reihe (wie eine
 * Wiederholung mit höchstens N Durchläufen). Gleichzeitig zählt das späteste
 * Stück, F(t) = E[F_K(t)^N].
 */
export function verteilungMehrfach(b: Mehrfach, art: Zeitart): Teilverteilungen {
  const v = anzahlVerteilung(b.anzahl, b.streuung)
  const x = verteilungSequenz(b.koerper.schritte, art)
  const liegen = art === 'gesamt' ? b.liegezeitMin : 0
  const ohne = wahrscheinlichkeit(v, 0)
  const rueck = new Map<Id, Verteilung>()
  const ende = new Map<string, Verteilung>()
  let weiter = ohne > 0 ? punkt(0, ohne) : leer()
  const ausfuehrung = b.ausfuehrung
  switch (ausfuehrung) {
    case 'nacheinander': {
      // vorher: gewichtete Dauer der Stücke vor dem, in dem es endet oder zurückspringt
      const nach = (vorher: Verteilung) => {
        for (const [e, d] of x.ende) plus(ende, e, verschiebe(falte(vorher, d), liegen))
        for (const [id, d] of x.rueck) plus(rueck, id, verschiebe(falte(vorher, d), liegen))
      }
      if (v.streuung === 'schwankt') {
        // nach jedem Stück mit p ein weiteres
        const vorher = geometrisch(skaliere(x.weiter, v.p))
        weiter = addiere(weiter, verschiebe(falte(vorher, skaliere(x.weiter, 1 - v.p)), liegen))
        nach(vorher)
        return { weiter, rueck, ende }
      }
      // fest: N = ⌊n⌋ mit 1 − r, ⌊n⌋ + 1 mit r
      const { potenz, summe } = potenzUndSumme(x.weiter, v.k0)
      if (v.k0 >= 1 && 1 - v.rest > 0) weiter = addiere(weiter, skaliere(verschiebe(potenz, liegen), 1 - v.rest))
      if (v.rest > 0) weiter = addiere(weiter, skaliere(verschiebe(falte(potenz, x.weiter), liegen), v.rest))
      // Stück j + 1 beginnt mit P(N > j): sicher für j < ⌊n⌋, mit r für j = ⌊n⌋
      nach(v.rest > 0 ? addiere(summe, skaliere(potenz, v.rest)) : summe)
      return { weiter, rueck, ende }
    }
    case 'gleichzeitig': {
      // Dauer eines Stücks, wie auch immer es endet (Enden meldet die Prüfung hier als Fehler; sie zählen anteilig)
      const teile = [x.weiter, ...x.rueck.values(), ...x.ende.values()]
      const stueck = teile.reduce((s, t) => addiere(s, t), leer())
      const spaet = verschiebe(spaetestes(v, stueck), liegen)
      const mitStueck = mindestens(v, 1)
      if (mitStueck <= 0) return { weiter, rueck, ende }
      const c = masse(x.weiter)
      const normal = Math.max(0, erwartungMaximumOhneNull(v, c))
      weiter = addiere(weiter, skaliere(spaet, normal / mitStueck))
      const abbruch = Math.max(0, mitStueck - normal)
      const summeEnden = [...x.ende.values()].reduce((s, d) => s + masse(d), 0)
      if (abbruch > 1e-12 && summeEnden > 0) for (const [e, d] of x.ende) plus(ende, e, skaliere(spaet, (abbruch * masse(d)) / summeEnden / mitStueck))
      return { weiter, rueck, ende }
    }
    default:
      return unerwartet(ausfuehrung)
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
