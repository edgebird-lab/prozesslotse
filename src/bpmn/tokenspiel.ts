/**
 * Tokenspiel nach den Ausführungsregeln von BPMN 2.0 für die Elemente, die der
 * Prozesslotse erzeugt. Dient zur Prüfung, unabhängig von der Baumlogik:
 *
 * - Soundness: Jeder erreichbare Zustand kann vollständig enden (keine
 *   Verklemmung, keine Endlosschleife ohne Ausweg), am Ende bleiben keine
 *   Marken zurück, jede Aktivität kann ausgeführt werden.
 * - Häufigkeiten: Monte-Carlo-Durchläufe mit Wahrscheinlichkeiten an den
 *   Verzweigungen liefern die mittlere Zahl der Ausführungen je Aktivität.
 */

import type { KnotenArt, Layout } from './layout'

export type KnotenTyp = 'start' | 'ende' | 'aktivitaet' | 'xor' | 'und' | 'oder' | 'ereignisgateway'

export interface TokenKnoten {
  id: string
  typ: KnotenTyp
  rein: string[]
  raus: string[]
  /** Nur ODER-Verzweigung: Fluss, der genommen wird, wenn kein anderer gewählt ist. */
  standard?: string
  /**
   * Nur ODER-Zusammenführung: Flüsse zwischen der zugehörigen Verzweigung und
   * ihr. Sie schaltet erst, wenn dort keine Marke mehr unterwegs ist (BPMN-Regel
   * für das inklusive Gateway, für blockstrukturierte Modelle gleichwertig).
   */
  bereich?: string[]
}

export interface TokenGraph {
  knoten: TokenKnoten[]
  /** Fluss → Zielknoten */
  ziel: Map<string, string>
}

const TYP_AUS_LAYOUT: Record<KnotenArt, KnotenTyp> = {
  start: 'start',
  ende: 'ende',
  aufgabe: 'aktivitaet',
  warten: 'aktivitaet',
  xor: 'xor',
  und: 'und',
  oder: 'oder',
  ereignisgateway: 'ereignisgateway',
}

/** Graph direkt aus dem Layout, aus dem auch das BPMN-XML entsteht. */
export function graphAusLayout(l: Layout): TokenGraph {
  const knoten = new Map<string, TokenKnoten>(l.knoten.map((k) => [k.id, { id: k.id, typ: TYP_AUS_LAYOUT[k.art], rein: [], raus: [] }]))
  const ziel = new Map<string, string>()
  for (const e of l.kanten) {
    knoten.get(e.von)?.raus.push(e.id)
    knoten.get(e.nach)?.rein.push(e.id)
    ziel.set(e.id, e.nach)
    if (e.standard) knoten.get(e.von)!.standard = e.id
  }
  const g = { knoten: [...knoten.values()], ziel }
  ergaenzeOderBereiche(g)
  return g
}

/** Zu jeder ODER-Zusammenführung die Flüsse zwischen ihr und ihrer Verzweigung (vorwärts von der Verzweigung bis zur Zusammenführung). */
export function ergaenzeOderBereiche(g: TokenGraph): void {
  const nachId = new Map(g.knoten.map((k) => [k.id, k]))
  for (const auf of g.knoten) {
    if (auf.typ !== 'oder' || auf.raus.length < 2) continue
    // Die passende Zusammenführung ist die erste ODER-Zusammenführung, die alle Wege erreichen.
    const erreichbar = auf.raus.map((f) => {
      const gesehen = new Set<string>()
      const stapel = [f]
      while (stapel.length > 0) {
        const x = stapel.pop()!
        if (gesehen.has(x)) continue
        gesehen.add(x)
        const k = nachId.get(g.ziel.get(x)!)
        if (k) stapel.push(...k.raus)
      }
      return gesehen
    })
    const kandidaten = g.knoten.filter((k) => k.typ === 'oder' && k.raus.length <= 1 && k.rein.length >= 2 && erreichbar.every((e) => k.rein.some((f) => e.has(f))))
    // die nächstgelegene: die mit dem kleinsten Bereich
    let beste: { k: TokenKnoten; bereich: string[] } | null = null
    for (const k of kandidaten) {
      const bereich = new Set<string>()
      for (const f of auf.raus) {
        const stapel = [f]
        while (stapel.length > 0) {
          const x = stapel.pop()!
          if (bereich.has(x)) continue
          bereich.add(x)
          const z = g.ziel.get(x)
          if (z === k.id) continue
          const nk = nachId.get(z!)
          if (nk) stapel.push(...nk.raus)
        }
      }
      if (!beste || bereich.size < beste.bereich.length) beste = { k, bereich: [...bereich] }
    }
    if (beste) beste.k.bereich = beste.bereich.filter((f) => !beste!.k.rein.includes(f))
  }
}

type Markierung = Map<string, number>

function schluessel(m: Markierung): string {
  return [...m.entries()]
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([f, n]) => (n === 1 ? f : `${f}*${n}`))
    .join('|')
}

function mit(m: Markierung, weg: string[], hin: string[]): Markierung {
  const neu = new Map(m)
  for (const f of weg) {
    const n = (neu.get(f) ?? 0) - 1
    if (n <= 0) neu.delete(f)
    else neu.set(f, n)
  }
  for (const f of hin) neu.set(f, (neu.get(f) ?? 0) + 1)
  return neu
}

interface Schritt {
  knoten: string
  /** gewählter ausgehender Fluss bei Verzweigungen */
  wahl?: string
  danach: Markierung
}

/** ODER-Zusammenführung: mindestens ein Eingang belegt und im Bereich davor keine Marke mehr unterwegs. */
function oderZuBereit(k: TokenKnoten, m: Markierung): boolean {
  return k.rein.some((f) => (m.get(f) ?? 0) > 0) && !(k.bereich ?? []).some((f) => (m.get(f) ?? 0) > 0)
}

function istOderZu(k: TokenKnoten): boolean {
  return k.typ === 'oder' && k.bereich !== undefined
}

function bereit(k: TokenKnoten, m: Markierung): boolean {
  if (k.typ === 'start') return false
  if (k.typ === 'und') return k.rein.length > 0 && k.rein.every((f) => (m.get(f) ?? 0) > 0)
  if (istOderZu(k)) return oderZuBereit(k, m)
  return k.rein.some((f) => (m.get(f) ?? 0) > 0)
}

/** Alle nichtleeren Auswahlen ausgehender Flüsse einer ODER-Verzweigung; der Standardfluss nur allein. */
function oderAuswahlen(k: TokenKnoten): string[][] {
  const andere = k.raus.filter((f) => f !== k.standard)
  const auswahlen: string[][] = []
  for (let maske = 1; maske < 1 << andere.length; maske++) auswahlen.push(andere.filter((_, i) => maske & (1 << i)))
  if (k.standard) auswahlen.push([k.standard])
  return auswahlen
}

/**
 * Schaltmöglichkeiten in einer Markierung. `reduziert`: nur das erste bereite
 * Element in fester Reihenfolge. Zulässig, weil jeder Fluss genau ein Ziel hat:
 * Eine Marke kann einer anderen nie etwas wegnehmen, also ändert die Reihenfolge
 * unabhängiger Schritte nichts an Verklemmung und Abschluss. Verzweigt wird nur
 * an echten Wahlstellen (Entweder-oder).
 */
function schritte(g: TokenGraph, m: Markierung, nachId: Map<string, TokenKnoten>, reduziert = false): Schritt[] {
  const liste: Schritt[] = []
  let kandidaten = g.knoten
  if (reduziert) {
    const fluss = [...m.keys()].sort().find((f) => bereit(nachId.get(g.ziel.get(f)!)!, m))
    kandidaten = fluss ? [nachId.get(g.ziel.get(fluss)!)!] : []
  }
  for (const k of kandidaten) {
    const belegt = k.rein.filter((f) => (m.get(f) ?? 0) > 0)
    switch (k.typ) {
      case 'start':
        break
      case 'und':
        if (k.rein.length > 0 && belegt.length === k.rein.length) liste.push({ knoten: k.id, danach: mit(m, k.rein, k.raus) })
        break
      case 'oder':
        if (istOderZu(k)) {
          if (oderZuBereit(k, m)) liste.push({ knoten: k.id, danach: mit(m, belegt, k.raus) })
        } else {
          // Verzweigung: jede mögliche Auswahl von Wegen ist ein eigener Schritt
          for (const f of belegt) for (const wahl of oderAuswahlen(k)) liste.push({ knoten: k.id, wahl: wahl.join('+'), danach: mit(m, [f], wahl) })
        }
        break
      case 'xor':
      case 'ereignisgateway':
        for (const f of belegt) {
          if (k.raus.length === 0) liste.push({ knoten: k.id, danach: mit(m, [f], []) })
          for (const o of k.raus) liste.push({ knoten: k.id, wahl: o, danach: mit(m, [f], [o]) })
        }
        break
      default:
        // Aktivitäten und Ereignisse: jede eingehende Marke startet sie (BPMN: ungesteuerter Fluss)
        for (const f of belegt) liste.push({ knoten: k.id, danach: mit(m, [f], k.typ === 'ende' ? [] : k.raus) })
    }
  }
  return liste
}

export interface SoundnessErgebnis {
  sound: boolean
  /** false, wenn der Zustandsraum die Grenze überschritten hat; dann ist nichts bewiesen. */
  vollstaendig: boolean
  fehler: string[]
  zustaende: number
  /** true, wenn nur die verkürzte Suche (eine feste Reihenfolge paralleler Schritte) möglich war */
  reduziert: boolean
}

/**
 * Prüft erst den vollständigen Zustandsraum (beweist auch, dass nie zwei Marken
 * auf einem Fluss liegen); wird er zu groß, die verkürzte Suche.
 */
export function pruefeSoundness(g: TokenGraph, maxZustaende = 20_000): SoundnessErgebnis {
  const voll = durchsuche(g, maxZustaende, false)
  return voll.vollstaendig ? voll : durchsuche(g, maxZustaende * 10, true)
}

function durchsuche(g: TokenGraph, maxZustaende: number, reduziert: boolean): SoundnessErgebnis {
  const fehler: string[] = []
  const nachId = new Map(g.knoten.map((k) => [k.id, k]))
  const starts = g.knoten.filter((k) => k.typ === 'start')
  if (starts.length !== 1) fehler.push(`erwartet genau ein Startereignis, gefunden ${starts.length}`)
  const anfang: Markierung = new Map(starts.flatMap((s) => s.raus.map((f) => [f, 1] as [string, number])))

  const index = new Map<string, number>()
  const nachfolger: number[][] = []
  const warteschlange: Markierung[] = []
  const merke = (m: Markierung): number => {
    const s = schluessel(m)
    let i = index.get(s)
    if (i === undefined) {
      i = index.size
      index.set(s, i)
      nachfolger.push([])
      warteschlange.push(m)
    }
    return i
  }
  merke(anfang)
  const gefeuert = new Set<string>()
  let unsicher = false
  for (let i = 0; i < warteschlange.length; i++) {
    if (index.size > maxZustaende) {
      // Nur Gleichzeitig-Zweige vervielfachen den Zustandsraum; ohne vollständige Suche ist nichts bewiesen.
      return { sound: false, vollstaendig: false, fehler: [`Zustandsraum größer als ${maxZustaende}, nicht vollständig geprüft`], zustaende: index.size, reduziert }
    }
    const m = warteschlange[i]
    if (!unsicher && [...m.values()].some((n) => n > 1)) {
      unsicher = true
      fehler.push(`mehr als eine Marke auf einem Fluss: ${schluessel(m)}`)
    }
    const moeglich = schritte(g, m, nachId, reduziert)
    if (moeglich.length === 0 && m.size > 0) fehler.push(`Verklemmung in Zustand ${schluessel(m)}`)
    for (const s of moeglich) {
      gefeuert.add(s.knoten)
      nachfolger[i].push(merke(s.danach))
    }
  }

  // Option zum Abschluss: vom leeren Zustand rückwärts erreichbar?
  const leer = index.get('')
  if (leer === undefined) fehler.push('der Prozess kann nie vollständig enden')
  else {
    const vorgaenger: number[][] = nachfolger.map(() => [])
    nachfolger.forEach((ns, i) => ns.forEach((j) => vorgaenger[j].push(i)))
    const kannEnden = new Set<number>([leer])
    const stapel = [leer]
    while (stapel.length > 0) {
      const j = stapel.pop()!
      for (const i of vorgaenger[j]) {
        if (!kannEnden.has(i)) {
          kannEnden.add(i)
          stapel.push(i)
        }
      }
    }
    const gefangen = [...index.entries()].filter(([, i]) => !kannEnden.has(i)).map(([s]) => s)
    if (gefangen.length > 0) fehler.push(`${gefangen.length} Zustände können nicht mehr enden, z. B. ${gefangen[0]}`)
  }

  // Keine toten Elemente: Jede Aktivität, jedes Gateway und jedes Ende muss in einem Ablauf vorkommen.
  for (const k of g.knoten) {
    if (k.typ !== 'start' && !gefeuert.has(k.id)) fehler.push(`${k.typ === 'aktivitaet' ? 'Aktivität' : 'Element'} ${k.id} wird nie ausgeführt`)
  }
  return { sound: fehler.length === 0, vollstaendig: true, fehler, zustaende: index.size, reduziert }
}

/** Zufällige Abläufe; an Verzweigungen nach `anteil` (Fluss → Wahrscheinlichkeit), sonst gleich verteilt. */
export function zaehleAusfuehrungen(g: TokenGraph, anteil: Map<string, number>, laeufe: number, zufall: () => number): Map<string, number> {
  return new Map([...zaehleMitFehler(g, anteil, laeufe, zufall)].map(([id, x]) => [id, x.mittel]))
}

export interface Zaehlung {
  /** mittlere Zahl der Ausführungen je Vorgang */
  mittel: number
  /** Standardfehler dieses Mittelwerts */
  fehler: number
}

/** Wie `zaehleAusfuehrungen`, dazu der Standardfehler je Aktivität (für Tests mit statistischer Toleranz). */
export function zaehleMitFehler(g: TokenGraph, anteil: Map<string, number>, laeufe: number, zufall: () => number): Map<string, Zaehlung> {
  const knotenNachId = new Map(g.knoten.map((k) => [k.id, k]))
  const summe = new Map<string, number>()
  const quadrate = new Map<string, number>()
  const ergebnis = new Map<string, Zaehlung>()
  const start = g.knoten.find((k) => k.typ === 'start')
  if (!start) return ergebnis
  for (let l = 0; l < laeufe; l++) {
    const lauf = new Map<string, number>()
    let m: Markierung = new Map(start.raus.map((f) => [f, 1]))
    for (let schritt = 0; m.size > 0 && schritt < 100_000; schritt++) {
      // eine bereite Stelle schalten; parallele Zusammenführungen erst, wenn alle Marken da sind
      let geschaltet = false
      for (const [f] of m) {
        const k = knotenNachId.get(g.ziel.get(f)!)!
        if (k.typ === 'und') {
          if (!k.rein.every((r) => (m.get(r) ?? 0) > 0)) continue
          m = mit(m, k.rein, k.raus)
        } else if (istOderZu(k)) {
          if (!oderZuBereit(k, m)) continue
          m = mit(
            m,
            k.rein.filter((r) => (m.get(r) ?? 0) > 0),
            k.raus,
          )
        } else if (k.typ === 'oder') {
          // jeder Weg unabhängig nach seinem Anteil, der Standardweg nur, wenn keiner gewählt wurde
          const wahl = k.raus.filter((o) => o !== k.standard && zufall() < (anteil.get(o) ?? 0.5))
          if (wahl.length === 0 && k.standard) wahl.push(k.standard)
          m = mit(m, [f], wahl)
        } else if (k.typ === 'xor' || k.typ === 'ereignisgateway') {
          let wurf = zufall()
          let wahl = k.raus[k.raus.length - 1]
          const gewichte = k.raus.map((o) => anteil.get(o) ?? 1 / k.raus.length)
          const gesamt = gewichte.reduce((s, x) => s + x, 0)
          for (const [i, o] of k.raus.entries()) {
            wurf -= gewichte[i] / gesamt
            if (wurf < 0) {
              wahl = o
              break
            }
          }
          m = mit(m, [f], k.raus.length > 0 ? [wahl] : [])
        } else {
          if (k.typ === 'aktivitaet') lauf.set(k.id, (lauf.get(k.id) ?? 0) + 1)
          m = mit(m, [f], k.typ === 'ende' ? [] : k.raus)
        }
        geschaltet = true
        break
      }
      if (!geschaltet) break // Verklemmung; zeigt die Soundness-Prüfung
    }
    for (const [id, n] of lauf) {
      summe.set(id, (summe.get(id) ?? 0) + n)
      quadrate.set(id, (quadrate.get(id) ?? 0) + n * n)
    }
  }
  for (const [id, s] of summe) {
    const mittel = s / laeufe
    const varianz = Math.max(0, (quadrate.get(id)! / laeufe - mittel * mittel) * (laeufe / Math.max(1, laeufe - 1)))
    ergebnis.set(id, { mittel, fehler: Math.sqrt(varianz / laeufe) })
  }
  return ergebnis
}
