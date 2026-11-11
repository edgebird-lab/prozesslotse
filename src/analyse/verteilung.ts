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
 *
 * Teile, die zugleich laufen (Zweige von Gleichzeitig, gewählte ODER-Wege,
 * Stücke von „für jedes Stück“ zur selben Zeit), verknüpft die
 * Abbruchkombination: Der früheste Abbruch beendet den Vorgang, sonst geht es
 * weiter, wenn alle normal fertig sind.
 */
import { anzahlVerteilung, erwartungMaximumOhneNull, wahrscheinlichkeit, type AnzahlVerteilung } from '../modell/anzahl'
import { alleMischung, oderMischung, unterbrechungsAnteile, unterbrechungsZeit, type Mischung } from '../modell/operationen'
import { unerwartet, unterbrechungenVon, type Block, type Id, type Mehrfach, type Oder, type Parallel, type Unterbrechbar } from '../modell/typen'

export interface Verteilung {
  wert: number[]
  masse: number[]
}

const MAX_PUNKTE = 160
const MIN_MASSE = 1e-9
/** Kleinere Massen sind Rundungsrauschen; alles darüber bleibt erhalten, damit Masse und Mittel exakt bleiben. */
const RAUSCHEN = 1e-14

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
  const sortiert = paare.filter(([, m]) => m > RAUSCHEN).sort((a, b) => a[0] - b[0])
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
    if (summeM[k] <= RAUSCHEN) continue
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

/**
 * Summe Σ_{k≥0} wieder^{*k}: wie oft ein Abschnitt wiederholt wird, als
 * Verteilung der Zusatzdauer. Den Rest der Reihe nach dem letzten gefalteten
 * Glied k nimmt ein Punkt mit genau seiner Masse q^{k+1} / (1 − q) und seinem
 * Mittel μ · (k + 1 + q / (1 − q)) auf (q Masse, μ Mittel von `wieder`); so
 * bleiben Masse und Erwartungswert exakt, auch wenn die Reihe langsam abklingt.
 */
function geometrisch(wieder: Verteilung): Verteilung {
  const q = masse(wieder)
  let summe = punkt(0)
  let term = punkt(0)
  let k = 0
  for (; k < 200; k++) {
    const naechster = falte(term, wieder)
    if (masse(naechster) < 1e-7) break
    term = naechster
    summe = addiere(summe, term)
  }
  if (q > 0 && q < 1) {
    const rest = q ** (k + 1) / (1 - q)
    if (rest > MIN_MASSE) summe = addiere(summe, punkt(erwartung(wieder) * (k + 1 + q / (1 - q)), rest))
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
          // alle Zweige zugleich: der früheste Abbruch, sonst das späteste normale Ende
          return gleichlauf(b.zweige.map((z) => verteilungSequenz(z.schritte, art)), alleMischung)
        case 'erster':
          return ersterAusgang(b, art).teile
        case 'nacheinander':
          // eine Person, Reihenfolge egal: gerechnet in der Reihenfolge der Liste, wie eine Folge
          return verteilungSequenz(b.zweige.flatMap((z) => z.schritte), art)
        default:
          return unerwartet(parallelArt)
      }
    }
    case 'oder':
      return verteilungOder(b, art)
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

// ---------------------------------------------------------------------------
// Abbruchkombination

/** Gemeinsames Raster aller Werte (gleiche Werte bis 1e-9 zusammengefasst). */
function raster(vs: Verteilung[]): number[] {
  const alle = vs.flatMap((v) => v.wert).sort((a, b) => a - b)
  const r: number[] = []
  for (const w of alle) if (r.length === 0 || w - r[r.length - 1] > 1e-9) r.push(w)
  return r
}

/** Masse einer Verteilung je Punkt des Rasters. */
function aufRaster(v: Verteilung, r: number[]): number[] {
  const m = new Array<number>(r.length).fill(0)
  v.wert.forEach((w, i) => {
    let unten = 0
    let oben = r.length - 1
    while (unten < oben) {
      const mitte = (unten + oben) >> 1
      if (r[mitte] < w - 1e-9) unten = mitte + 1
      else oben = mitte
    }
    m[unten] += v.masse[i]
  })
  return m
}

function kumuliere(m: number[]): number[] {
  let s = 0
  return m.map((x) => (s += x))
}

/** Die Abbruch-Ausgänge eines Teils: Enden und (nur in ungültigen Modellen) Rücksprünge. */
function abbrueche(t: Teilverteilungen): { ende?: string; rueck?: Id; v: Verteilung }[] {
  return [...[...t.ende].map(([ende, v]) => ({ ende, v })), ...[...t.rueck].map(([rueck, v]) => ({ rueck, v }))]
}

/**
 * Abbruchkombination für Teile, die zugleich laufen. Teil i hat den Abbruch
 * Gᵢ (alle Enden und Rücksprünge) und das normale Ende Hᵢ; `mischung` verknüpft
 * sie (Gleichzeitig: Produkt, ODER: über die Ziehung der Wege). Die Zeit ist der
 * früheste Abbruch, sonst das späteste normale Ende:
 *
 * - Weiter-Teil W(t) = mischung(H(t)), ohne Normierung
 * - Ergebnis r von Teil i bei t: e_{i,r}(t) · ∂mischung/∂aᵢ an der Stelle
 *   aⱼ = 1 − Gⱼ(t) für j < i und aⱼ = 1 − Gⱼ(t⁻) für j > i: Bei Gleichstand
 *   gewinnt der frühere Teil der Liste.
 *
 * Zusammen ergibt das den Abbruch-Teil 1 − mischung(1 − G(t)). Was die übrigen
 * Teile bis dahin getan haben, zählt die Flussrechnung voll.
 */
export function gleichlauf(teile: Teilverteilungen[], mischung: Mischung): Teilverteilungen {
  const rueck = new Map<Id, Verteilung>()
  const ende = new Map<string, Verteilung>()
  if (teile.length === 0) return { weiter: punkt(0), rueck, ende }
  const aus = teile.map(abbrueche)
  const r = raster(teile.flatMap((t, i) => [t.weiter, ...aus[i].map((a) => a.v)]))
  const h = teile.map((t) => kumuliere(aufRaster(t.weiter, r)))
  const e = aus.map((liste) => liste.map((a) => aufRaster(a.v, r)))
  const g = e.map((liste) => kumuliere(r.map((_, k) => liste.reduce((s, m) => s + m[k], 0))))
  const weiter: [number, number][] = []
  const rueckPaare = new Map<Id, [number, number][]>()
  const endePaare = new Map<string, [number, number][]>()
  let vorher = 0
  r.forEach((t, k) => {
    const w = mischung(h.map((x) => Math.min(1, x[k])))
    if (w - vorher > RAUSCHEN) {
      weiter.push([t, w - vorher])
      vorher = w
    }
    aus.forEach((liste, i) => {
      if (liste.every((_, o) => e[i][o][k] <= 0)) return
      const a = teile.map((_, j) => (j < i ? 1 - g[j][k] : j > i ? 1 - (k > 0 ? g[j][k - 1] : 0) : 0))
      const ohne = mischung(a)
      a[i] = 1
      const anteil = mischung(a) - ohne
      liste.forEach((x, o) => {
        const m = e[i][o][k] * anteil
        if (m <= RAUSCHEN) return
        if (x.ende !== undefined) endePaare.set(x.ende, [...(endePaare.get(x.ende) ?? []), [t, m]])
        else rueckPaare.set(x.rueck!, [...(rueckPaare.get(x.rueck!) ?? []), [t, m]])
      })
    })
  })
  for (const [id, paare] of rueckPaare) rueck.set(id, ordne(paare))
  for (const [x, paare] of endePaare) ende.set(x, ordne(paare))
  return { weiter: ordne(weiter), rueck, ende }
}

/**
 * „Für jedes Stück“ gleichzeitig: N gleiche, unabhängige Stücke mit Abbruch G
 * und normalem Ende H. Mit φ(a) = E[a^N; N ≥ 1]: Weiter-Teil φ(H(t)), Abbruch
 * bei t mit φ(1 − G(t⁻)) − φ(1 − G(t)), aufgeteilt auf die Ergebnisse nach
 * ihrem Anteil bei t; ohne Stück geht es sofort weiter (bei 0, ohne Liegezeit).
 */
function stueckeGleichzeitig(v: AnzahlVerteilung, x: Teilverteilungen, liegen: number): Teilverteilungen {
  const ohne = wahrscheinlichkeit(v, 0)
  const phi = (a: number) => erwartungMaximumOhneNull(v, Math.min(1, Math.max(0, a)))
  const aus = abbrueche(x)
  const r = raster([x.weiter, ...aus.map((a) => a.v)])
  const h = kumuliere(aufRaster(x.weiter, r))
  const e = aus.map((a) => aufRaster(a.v, r))
  const gMasse = r.map((_, k) => e.reduce((s, m) => s + m[k], 0))
  const g = kumuliere(gMasse)
  const weiter: [number, number][] = ohne > 0 ? [[0, ohne]] : []
  const rueckPaare = new Map<Id, [number, number][]>()
  const endePaare = new Map<string, [number, number][]>()
  let vorher = 0
  r.forEach((t, k) => {
    const w = phi(h[k])
    if (w - vorher > RAUSCHEN) {
      weiter.push([t + liegen, w - vorher])
      vorher = w
    }
    if (gMasse[k] <= 0) return
    const abbruch = phi(1 - (k > 0 ? g[k - 1] : 0)) - phi(1 - g[k])
    aus.forEach((a, o) => {
      const m = (abbruch * e[o][k]) / gMasse[k]
      if (m <= RAUSCHEN) return
      if (a.ende !== undefined) endePaare.set(a.ende, [...(endePaare.get(a.ende) ?? []), [t + liegen, m]])
      else rueckPaare.set(a.rueck!, [...(rueckPaare.get(a.rueck!) ?? []), [t + liegen, m]])
    })
  })
  const rueck = new Map<Id, Verteilung>()
  const ende = new Map<string, Verteilung>()
  for (const [id, paare] of rueckPaare) rueck.set(id, ordne(paare))
  for (const [z, paare] of endePaare) ende.set(z, ordne(paare))
  return { weiter: ordne(weiter), rueck, ende }
}

/**
 * „Für jedes Stück“: N Durchläufe des Körpers (N aus anzahl.ts), dazu einmal
 * die Liegezeit, wenn N ≥ 1. Nacheinander ist es die Mischung über N der
 * N-fachen Faltung; ein Ende in einem Durchlauf beendet die Reihe (wie eine
 * Wiederholung mit höchstens N Durchläufen). Gleichzeitig zählt das späteste
 * Stück, F(t) = E[F_K(t)^N], oder der früheste Abbruch (`stueckeGleichzeitig`).
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
    case 'gleichzeitig':
      // spätestes Stück, oder der früheste Abbruch eines Stücks beendet alle
      return stueckeGleichzeitig(v, x, liegen)
    default:
      return unerwartet(ausfuehrung)
  }
}

/**
 * Dauer einer ODER-Verzweigung: Die Wege werden gezogen wie in `oderZiehung`
 * (unabhängig, ohne Standardweg bedingt auf „mindestens einer“; der Standardweg
 * läuft, wenn kein anderer gewählt ist). Weiter geht es nach dem längsten
 * gewählten Weg; endet ein gewählter Weg den Vorgang, gilt der früheste Abbruch
 * (Abbruchkombination mit `oderMischung`).
 */
export function verteilungOder(b: Oder, art: Zeitart): Teilverteilungen {
  return gleichlauf(
    b.zweige.map((z) => verteilungSequenz(z.schritte, art)),
    oderMischung(b),
  )
}

/** Wie oft ein Zweig von „weiter beim ersten“ gewinnt, aufgeteilt nach dem, womit er fertig wird. */
export interface Gewinn {
  /** normal fertig: weiter hinter dem Block */
  weiter: number
  /** der Vorgang endet mit diesem Ergebnis (ab Schritt 5 erlaubt) */
  ende: Map<string, number>
  /** Rücksprung aus dem Zweig hinaus (nur in ungültigen Modellen) */
  rueck: Map<Id, number>
}

export interface ErsterAusgang {
  /** Teilverteilungen des Blocks: die Zeit des ersten Zweigs, der fertig wird, und womit er fertig wird */
  teile: Teilverteilungen
  /** je Zweig: Wahrscheinlichkeit, dass er zuerst fertig ist, nach Ausgang */
  je: Gewinn[]
}

/**
 * „Weiter beim ersten“: Es gewinnt der Zweig, der zuerst fertig ist (normal oder,
 * ab Schritt 5, mit einem Ende); die übrigen werden abgebrochen. Bei Gleichstand
 * gewinnt der frühere Zweig der Liste. Zweig i gewinnt mit Ausgang o bei t mit
 * d_{i,o}(t) · Π_{j<i} P(D_j > t) · Π_{j>i} P(D_j ≥ t), wobei D_j die ganze
 * Dauer von Zweig j ist (wie auch immer er endet). Ohne Enden ist das das
 * Minimum: F(t) = 1 − Π (1 − F_i(t)).
 */
export function ersterAusgang(b: Parallel, art: Zeitart): ErsterAusgang {
  const zweige = b.zweige.map((z) => verteilungSequenz(z.schritte, art))
  const ganz = zweige.map((x) => {
    const v = alleTeile(x)
    return { v, m: masse(v) }
  })
  /** P(D_j < t) bzw. P(D_j ≤ t) relativ zur Masse des Zweigs */
  const bis = (j: number, t: number, mitGleich: boolean): number => {
    const { v, m } = ganz[j]
    if (m <= 0) return 1
    let s = 0
    for (let k = 0; k < v.wert.length; k++) {
      const w = v.wert[k]
      if (w < t - 1e-9 || (mitGleich && w <= t + 1e-9)) s += v.masse[k]
      else break
    }
    return Math.min(1, s / m)
  }
  const ueberlebt = (i: number, t: number): number => {
    let p = 1
    for (let j = 0; j < zweige.length; j++) {
      if (j === i) continue
      // Gleichstand: Ein früherer Zweig gewinnt, also muss er echt später fertig werden; ein späterer darf gleichzeitig fertig werden.
      p *= 1 - bis(j, t, j < i)
      if (p <= 0) return 0
    }
    return p
  }
  const gewichte = (i: number, v: Verteilung): Verteilung => ordne(v.wert.map((t, k) => [t, v.masse[k] * ueberlebt(i, t)] as [number, number]))
  let weiter = leer()
  const rueck = new Map<Id, Verteilung>()
  const ende = new Map<string, Verteilung>()
  const je: Gewinn[] = zweige.map((x, i) => {
    const g: Gewinn = { weiter: 0, ende: new Map(), rueck: new Map() }
    const w = gewichte(i, x.weiter)
    g.weiter = masse(w)
    weiter = addiere(weiter, w)
    for (const [e, v] of x.ende) {
      const ge = gewichte(i, v)
      g.ende.set(e, masse(ge))
      plus(ende, e, ge)
    }
    for (const [id, v] of x.rueck) {
      const gr = gewichte(i, v)
      g.rueck.set(id, masse(gr))
      plus(rueck, id, gr)
    }
    return g
  })
  if (zweige.length === 0) weiter = punkt(0)
  return { teile: { weiter, rueck, ende }, je }
}

/** Wahrscheinlichkeit je Zweig von „weiter beim ersten“, dass er zuerst fertig ist (wie auch immer). */
export function zuerstFertig(b: Parallel): number[] {
  return ersterAusgang(b, 'gesamt').je.map((g) => g.weiter + [...g.ende.values(), ...g.rueck.values()].reduce((s, x) => s + x, 0))
}
