/**
 * Tokenspiel nach den Ausführungsregeln von BPMN 2.0 für die Elemente, die der
 * Prozesslotse erzeugt. Dient zur Prüfung, unabhängig von der Baumlogik:
 *
 * - Soundness: Jeder erreichbare Zustand kann vollständig enden (keine
 *   Verklemmung, keine Endlosschleife ohne Ausweg), am Ende bleiben keine
 *   Marken zurück, jede Aktivität kann ausgeführt werden.
 * - Häufigkeiten: Monte-Carlo-Durchläufe mit Wahrscheinlichkeiten an den
 *   Verzweigungen liefern die mittlere Zahl der Ausführungen je Aktivität.
 *
 * Bereiche: Ein Rahmen (aufgeklappter Teilprozess) startet bei einer Marke am
 * Eingang eine Instanz; Marken darin tragen den Pfad ihrer Instanz
 * (`Rahmen:1/Innen:1|Fluss`), damit sich Instanzen nicht mischen. Eine Instanz
 * ist fertig, wenn in ihr keine Marke mehr liegt; dann geht eine Marke auf den
 * Ausgang. Eine Terminierung leert ihre Ebene, ein Fehler-Ende alles bis
 * einschließlich des Rahmens mit dem passenden Fehler-Randereignis und legt eine
 * Marke auf dessen Ausgang. Abbrüche schalten zuletzt: erst, wenn in dem
 * Bereich, den sie beenden, sonst nichts mehr schalten kann.
 *
 * Mehrfachinstanzen („für jedes Stück“): Eine Aktivität mit Markierung schaltet
 * einmal und zählt N-mal. Ein Mehrfach-Rahmen startet nacheinander eine
 * Instanz, deren Marke `Pfad|*` die noch offenen Stücke zählt; ist ein Stück
 * fertig, beginnt in derselben Instanz das nächste. Gleichzeitig startet er N
 * Instanzen und gibt die Marke weiter, wenn die letzte fertig ist. Die Suche
 * prüft null und ein Stück (soweit die Anzahl sie zulässt); die Zählung zieht N
 * wie die Rechnung (anzahl.ts). Ein Fehler, den der Mehrfach-Rahmen fängt,
 * leert alle seine Instanzen.
 */

import { anzahlVerteilung, kannNull, kannStueck, zieheAnzahl } from '../modell/anzahl'
import type { MehrfachStreuung } from '../modell/typen'
import type { KnotenArt, Layout } from './layout'

export type KnotenTyp = 'start' | 'ende' | 'aktivitaet' | 'xor' | 'und' | 'oder' | 'ereignisgateway' | 'rahmen' | 'rand'

export interface TokenKnoten {
  id: string
  typ: KnotenTyp
  rein: string[]
  raus: string[]
  /** Nur ODER-Verzweigung: Fluss, der genommen wird, wenn kein anderer gewählt ist. */
  standard?: string
  /** Nur ODER-Verzweigung ohne Standardfluss: mindestens ein Weg (leere Auswahl wird neu gewürfelt). */
  mindestensEiner?: boolean
  /** Rahmen, in dem der Knoten liegt; fehlt oder null auf Prozessebene */
  rahmen?: string | null
  /** Nur Endereignisse: normal, Terminierung oder Fehler */
  endeArt?: 'normal' | 'terminierung' | 'fehler'
  /** Fehler-Ende und Fehler-Randereignis: Kennung des Fehlers */
  fehler?: string
  /** Nur Randereignisse: Rahmen oder Aktivität, an der es sitzt */
  wirt?: string
  randArt?: 'fehler' | 'zeit' | 'nachricht'
  unterbrechend?: boolean
  /** Mehrfachinstanz an einer Aktivität oder einem Rahmen; Anzahl und Streuung, soweit bekannt (aus dem XML nur eine feste ganze Anzahl) */
  mehrfach?: { nacheinander: boolean; anzahl?: number; streuung?: MehrfachStreuung }
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
  rand: 'rand',
}

/** Graph direkt aus dem Layout, aus dem auch das BPMN-XML entsteht. */
export function graphAusLayout(l: Layout): TokenGraph {
  const knoten = new Map<string, TokenKnoten>()
  for (const r of l.rahmen) knoten.set(r.id, { id: r.id, typ: 'rahmen', rein: [], raus: [], rahmen: r.eltern, ...(r.mehrfach ? { mehrfach: { ...r.mehrfach } } : {}) })
  for (const k of l.knoten) {
    const t: TokenKnoten = { id: k.id, typ: TYP_AUS_LAYOUT[k.art], rein: [], raus: [], rahmen: k.rahmen ?? null }
    if (k.mindestensEiner) t.mindestensEiner = true
    if (k.mehrfach) t.mehrfach = { ...k.mehrfach }
    if (k.art === 'ende') {
      t.endeArt = k.fehler ? 'fehler' : 'normal'
      if (k.fehler) t.fehler = k.fehler
    }
    if (k.art === 'rand') Object.assign(t, { wirt: k.wirt, randArt: 'fehler', unterbrechend: true, fehler: k.fehler })
    knoten.set(k.id, t)
  }
  const ziel = new Map<string, string>()
  for (const e of l.kanten) {
    knoten.get(e.von)?.raus.push(e.id)
    knoten.get(e.nach)?.rein.push(e.id)
    ziel.set(e.id, e.nach)
    if (e.standard) knoten.get(e.von)!.standard = e.id
  }
  return { knoten: [...knoten.values()], ziel }
}

// ---------------------------------------------------------------------------
// Vorberechnung je Graph

interface Reichweite {
  fluesse: Set<string>
  rahmen: Set<string>
}

interface Netz {
  g: TokenGraph
  nach: Map<string, TokenKnoten>
  /** Fluss → Quellknoten */
  quelle: Map<string, TokenKnoten>
  /** Rahmen → innerer Start */
  innerStart: Map<string, TokenKnoten>
  /** Wirt → Randereignisse */
  rand: Map<string, TokenKnoten[]>
  /** ODER-Zusammenführung → je Eingang: Flüsse und Rahmen, von denen aus er erreichbar ist, ohne die Zusammenführung zu passieren */
  oderReichweite: Map<string, Map<string, Reichweite>>
}

function istOderZu(k: TokenKnoten): boolean {
  return k.typ === 'oder' && k.rein.length > 1
}

function baueNetz(g: TokenGraph): Netz {
  const nach = new Map(g.knoten.map((k) => [k.id, k]))
  const quelle = new Map<string, TokenKnoten>()
  for (const k of g.knoten) for (const f of k.raus) quelle.set(f, k)
  const innerStart = new Map<string, TokenKnoten>()
  const rand = new Map<string, TokenKnoten[]>()
  for (const k of g.knoten) {
    if (k.typ === 'start' && k.rahmen) innerStart.set(k.rahmen, k)
    if (k.typ === 'rand' && k.wirt) rand.set(k.wirt, [...(rand.get(k.wirt) ?? []), k])
  }
  // Erreichbarkeit rückwärts von jedem Eingang einer ODER-Zusammenführung; eine Marke in einem Rahmen zählt als Marke am Rahmen
  const oderReichweite = new Map<string, Map<string, Reichweite>>()
  for (const j of g.knoten) {
    if (!istOderZu(j)) continue
    const karte = new Map<string, Reichweite>()
    for (const r of j.rein) {
      const fluesse = new Set([r])
      const rahmen = new Set<string>()
      const stapel = [r]
      while (stapel.length > 0) {
        const s = quelle.get(stapel.pop()!)
        if (!s || s.id === j.id) continue
        let vorher: string[] = []
        if (s.typ === 'rand') {
          const w = s.wirt ? nach.get(s.wirt) : undefined
          if (w) {
            vorher = w.rein
            if (w.typ === 'rahmen') rahmen.add(w.id)
          }
        } else if (s.typ === 'rahmen') {
          vorher = s.rein
          rahmen.add(s.id)
        } else if (s.typ !== 'start') vorher = s.rein
        for (const y of vorher) {
          if (fluesse.has(y)) continue
          fluesse.add(y)
          stapel.push(y)
        }
      }
      karte.set(r, { fluesse, rahmen })
    }
    oderReichweite.set(j.id, karte)
  }
  return { g, nach, quelle, innerStart, rand, oderReichweite }
}

// ---------------------------------------------------------------------------
// Markierungen: Schlüssel `Pfad|Fluss` für Marken, `Pfad|*` für eine laufende Rahmen-Instanz

type Markierung = Map<string, number>

const schl = (pfad: string, fluss: string) => `${pfad}|${fluss}`
const kindPfad = (pfad: string, rahmen: string, nr: number) => (pfad ? `${pfad}/${rahmen}:${nr}` : `${rahmen}:${nr}`)
const elternPfad = (pfad: string) => (pfad.includes('/') ? pfad.slice(0, pfad.lastIndexOf('/')) : '')

function rahmenVonPfad(pfad: string): string {
  const seg = pfad.slice(pfad.lastIndexOf('/') + 1)
  return seg.slice(0, seg.lastIndexOf(':'))
}

function zerlege(schluesselText: string): [string, string] {
  const i = schluesselText.indexOf('|')
  return [schluesselText.slice(0, i), schluesselText.slice(i + 1)]
}

/** Gehört der Schlüssel zur Instanz `pfad` (oder liegt er tiefer darin)? Der leere Pfad umfasst alles. */
function imBereich(s: string, pfad: string): boolean {
  return pfad === '' || s.startsWith(`${pfad}|`) || s.startsWith(`${pfad}/`)
}

/** Ein Abbruch am Rahmen der Instanz `pfad` beendet sie; bei einer Mehrfachinstanz alle Stücke derselben Aktivierung. */
function bereichVon(n: Netz, pfad: string): (s: string) => boolean {
  if (pfad === '') return () => true
  const r = n.nach.get(rahmenVonPfad(pfad))
  if (!r?.mehrfach) return (s) => imBereich(s, pfad)
  const aussen = elternPfad(pfad)
  const praefix = `${aussen ? `${aussen}/` : ''}${r.id}:`
  return (s) => s.startsWith(praefix)
}

/** Läuft neben der Instanz `pfad` noch ein Stück desselben Mehrfach-Rahmens? */
function weitereStuecke(m: Markierung, pfad: string): boolean {
  const aussen = elternPfad(pfad)
  const rahmen = rahmenVonPfad(pfad)
  for (const x of m.keys()) {
    if (!x.endsWith('|*')) continue
    const p = x.slice(0, -2)
    if (p !== pfad && elternPfad(p) === aussen && rahmenVonPfad(p) === rahmen) return true
  }
  return false
}

/** Was die Anzahl einer Mehrfachinstanz zulässt; ohne bekannte Anzahl beides. */
function stueckMoeglich(k: TokenKnoten): { ohne: boolean; mit: boolean } {
  const m = k.mehrfach
  if (!m || m.anzahl === undefined) return { ohne: !!m, mit: true }
  const v = anzahlVerteilung(m.anzahl, m.streuung ?? 'fest')
  return { ohne: kannNull(v), mit: kannStueck(v) }
}

/** N für eine Aktivierung, wie in der Rechnung gezogen; ohne bekannte Anzahl eins. */
function zieheStuecke(k: TokenKnoten, zufall: () => number): number {
  const m = k.mehrfach
  if (!m || m.anzahl === undefined) return 1
  return zieheAnzahl(anzahlVerteilung(m.anzahl, m.streuung ?? 'fest'), zufall)
}

/**
 * Startet einen Mehrfach-Rahmen mit `stuecke` Stücken: nacheinander eine
 * Instanz, deren Marke die offenen Stücke zählt; gleichzeitig eine Instanz je Stück.
 */
function starteStuecke(n: Netz, m: Markierung, ausloeser: string, k: TokenKnoten, pfad: string, stuecke: number): Markierung {
  const neu = mit(m, [ausloeser], [])
  const start = n.innerStart.get(k.id)
  const nacheinander = k.mehrfach?.nacheinander ?? true
  let nr = 1
  for (let i = 0; i < (nacheinander ? 1 : stuecke); i++) {
    while (neu.has(`${kindPfad(pfad, k.id, nr)}|*`)) nr++
    const c = kindPfad(pfad, k.id, nr)
    neu.set(`${c}|*`, nacheinander ? stuecke : 1)
    for (const o of start?.raus ?? []) neu.set(schl(c, o), (neu.get(schl(c, o)) ?? 0) + 1)
  }
  return neu
}

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

/**
 * Inklusive Zusammenführung nach BPMN 2.0: bereit, wenn ein Eingang belegt ist
 * und jede Marke, die einen leeren Eingang erreichen kann, ohne die
 * Zusammenführung zu passieren, auch einen belegten erreicht.
 */
function oderBereit(n: Netz, k: TokenKnoten, pfad: string, m: Markierung): boolean {
  const belegt = k.rein.filter((r) => (m.get(schl(pfad, r)) ?? 0) > 0)
  if (belegt.length === 0) return false
  const leer = k.rein.filter((r) => !belegt.includes(r))
  if (leer.length === 0) return true
  const weite = n.oderReichweite.get(k.id)!
  for (const s of m.keys()) {
    const [kp, f] = zerlege(s)
    let trifft: (r: string) => boolean
    if (kp === pfad) {
      if (f === '*') continue
      trifft = (r) => weite.get(r)!.fluesse.has(f)
    } else if (pfad === '' ? kp !== '' : kp.startsWith(`${pfad}/`)) {
      // Marke in einer laufenden Rahmen-Instanz dieser Ebene: zählt als Marke am Rahmen
      const rest = pfad === '' ? kp : kp.slice(pfad.length + 1)
      const seg = rest.split('/')[0]
      const rahmen = seg.slice(0, seg.lastIndexOf(':'))
      trifft = (r) => weite.get(r)!.rahmen.has(rahmen)
    } else continue
    if (leer.some(trifft) && !belegt.some(trifft)) return false
  }
  return true
}

/** Alle nichtleeren Auswahlen ausgehender Flüsse einer ODER-Verzweigung; der Standardfluss nur allein. */
function oderAuswahlen(k: TokenKnoten): string[][] {
  const andere = k.raus.filter((f) => f !== k.standard)
  const auswahlen: string[][] = []
  for (let maske = 1; maske < 1 << andere.length; maske++) auswahlen.push(andere.filter((_, i) => maske & (1 << i)))
  if (k.standard) auswahlen.push([k.standard])
  return auswahlen
}

/** Was in einer Markierung schalten kann; Wahlstellen (Entweder-oder, ODER, Zahl der Stücke) mit allen Möglichkeiten erst beim Ausführen. */
type Moeglichkeit =
  | { art: 'fest'; ausloeser: string; knoten: string; weg: string[]; hin: string[] }
  | { art: 'wahl'; ausloeser: string; knoten: TokenKnoten; pfad: string }
  | { art: 'mehrfach'; ausloeser: string; knoten: TokenKnoten; pfad: string }
  | { art: 'abbruch'; ausloeser: string; knoten: string; bereich: (s: string) => boolean; danach: Markierung; auch?: string }

/** Wirkung eines Abbruchs: Terminierung leert ihre Ebene; Fehler steigt zum Rahmen mit passendem Randereignis auf. */
function abbruch(n: Netz, k: TokenKnoten, s: string, pfad: string, m: Markierung): { bereich: (s: string) => boolean; danach: Markierung; auch?: string } | null {
  if (k.endeArt === 'terminierung') {
    const danach = new Map([...m].filter(([x]) => !imBereich(x, pfad) || x === `${pfad}|*`))
    danach.delete(s)
    return { bereich: (x) => imBereich(x, pfad), danach }
  }
  for (let p = pfad; p !== ''; p = elternPfad(p)) {
    const fang = (n.rand.get(rahmenVonPfad(p)) ?? []).find((r) => r.randArt === 'fehler' && (!r.fehler || r.fehler === k.fehler))
    if (!fang) continue
    const bereich = bereichVon(n, p)
    const danach = new Map([...m].filter(([x]) => !bereich(x)))
    const aussen = elternPfad(p)
    for (const o of fang.raus) danach.set(schl(aussen, o), (danach.get(schl(aussen, o)) ?? 0) + 1)
    return { bereich, danach, auch: fang.id }
  }
  return null
}

function moeglichkeiten(n: Netz, m: Markierung): Moeglichkeit[] {
  const liste: Moeglichkeit[] = []
  const abbrueche: Moeglichkeit[] = []
  for (const [s, anzahl] of m) {
    if (anzahl <= 0) continue
    const [pfad, f] = zerlege(s)
    if (f === '*') {
      // Instanz fertig, wenn in ihr keine Marke mehr liegt
      if ([...m.keys()].some((x) => x !== s && imBereich(x, pfad))) continue
      const r = n.nach.get(rahmenVonPfad(pfad))!
      const aussen = elternPfad(pfad)
      if (r.mehrfach?.nacheinander && anzahl > 1) {
        // nächstes Stück in derselben Instanz
        liste.push({ art: 'fest', ausloeser: s, knoten: r.id, weg: [s], hin: (n.innerStart.get(r.id)?.raus ?? []).map((o) => schl(pfad, o)) })
      } else if (r.mehrfach && !r.mehrfach.nacheinander && weitereStuecke(m, pfad)) {
        // andere Stücke laufen noch: nur diese Instanz endet
        liste.push({ art: 'fest', ausloeser: s, knoten: r.id, weg: [s], hin: [] })
      } else liste.push({ art: 'fest', ausloeser: s, knoten: r.id, weg: [s], hin: r.raus.map((o) => schl(aussen, o)) })
      continue
    }
    const k = n.nach.get(n.g.ziel.get(f)!)
    if (!k) continue
    switch (k.typ) {
      case 'start':
      case 'rand':
        break
      case 'aktivitaet':
        if (k.mehrfach) liste.push({ art: 'mehrfach', ausloeser: s, knoten: k, pfad })
        else liste.push({ art: 'fest', ausloeser: s, knoten: k.id, weg: [s], hin: k.raus.map((o) => schl(pfad, o)) })
        break
      case 'ende':
        if (k.endeArt === 'fehler' || k.endeArt === 'terminierung') {
          const a = abbruch(n, k, s, pfad, m)
          if (a) abbrueche.push({ art: 'abbruch', ausloeser: s, knoten: k.id, ...a })
        } else liste.push({ art: 'fest', ausloeser: s, knoten: k.id, weg: [s], hin: [] })
        break
      case 'rahmen': {
        if (k.mehrfach) {
          liste.push({ art: 'mehrfach', ausloeser: s, knoten: k, pfad })
          break
        }
        let nr = 1
        while (m.has(`${kindPfad(pfad, k.id, nr)}|*`)) nr++
        const c = kindPfad(pfad, k.id, nr)
        const start = n.innerStart.get(k.id)
        liste.push({ art: 'fest', ausloeser: s, knoten: k.id, weg: [s], hin: [`${c}|*`, ...(start?.raus ?? []).map((o) => schl(c, o))] })
        break
      }
      case 'und':
        if (f === k.rein[0] && k.rein.every((r) => (m.get(schl(pfad, r)) ?? 0) > 0)) {
          liste.push({ art: 'fest', ausloeser: s, knoten: k.id, weg: k.rein.map((r) => schl(pfad, r)), hin: k.raus.map((o) => schl(pfad, o)) })
        }
        break
      case 'oder':
        if (istOderZu(k)) {
          const belegt = k.rein.filter((r) => (m.get(schl(pfad, r)) ?? 0) > 0)
          if (f === belegt[0] && oderBereit(n, k, pfad, m)) liste.push({ art: 'fest', ausloeser: s, knoten: k.id, weg: belegt.map((r) => schl(pfad, r)), hin: k.raus.map((o) => schl(pfad, o)) })
        } else liste.push({ art: 'wahl', ausloeser: s, knoten: k, pfad })
        break
      case 'xor':
      case 'ereignisgateway':
        if (k.raus.length === 0) liste.push({ art: 'fest', ausloeser: s, knoten: k.id, weg: [s], hin: [] })
        else liste.push({ art: 'wahl', ausloeser: s, knoten: k, pfad })
        break
    }
  }
  // Abbruch zuletzt: nur, wenn in dem Bereich, den er beendet, sonst nichts mehr schalten kann
  for (const a of abbrueche) if (a.art === 'abbruch' && !liste.some((x) => a.bereich(x.ausloeser))) liste.push(a)
  return liste
}

interface Schritt {
  knoten: string
  /** weiterer Knoten, der dabei schaltet (das fangende Randereignis) */
  auch?: string
  /** gewählter ausgehender Fluss bei Verzweigungen */
  wahl?: string
  /** Mehrfachinstanz ohne Stück: Die Marke läuft vorbei, ausgeführt wird nichts. */
  vorbei?: boolean
  danach: Markierung
}

function ausfuehrungen(n: Netz, mo: Moeglichkeit, m: Markierung): Schritt[] {
  if (mo.art === 'fest') return [{ knoten: mo.knoten, danach: mit(m, mo.weg, mo.hin) }]
  if (mo.art === 'abbruch') return [{ knoten: mo.knoten, auch: mo.auch, danach: mo.danach }]
  if (mo.art === 'mehrfach') {
    // Suche: ohne Stück und mit einem Stück, soweit die Anzahl das zulässt; weitere Stücke wiederholen nur dasselbe
    const k = mo.knoten
    const moeglich = stueckMoeglich(k)
    const vorbei = mit(m, [mo.ausloeser], k.raus.map((o) => schl(mo.pfad, o)))
    if (k.typ === 'aktivitaet') return [moeglich.mit ? { knoten: k.id, danach: vorbei } : { knoten: k.id, vorbei: true, danach: vorbei }]
    const liste: Schritt[] = []
    if (moeglich.ohne) liste.push({ knoten: k.id, vorbei: true, wahl: 'ohne', danach: vorbei })
    if (moeglich.mit) liste.push({ knoten: k.id, wahl: 'eins', danach: starteStuecke(n, m, mo.ausloeser, k, mo.pfad, 1) })
    return liste
  }
  const k = mo.knoten
  if (k.typ === 'oder') return oderAuswahlen(k).map((wahl) => ({ knoten: k.id, wahl: wahl.join('+'), danach: mit(m, [mo.ausloeser], wahl.map((o) => schl(mo.pfad, o))) }))
  return k.raus.map((o) => ({ knoten: k.id, wahl: o, danach: mit(m, [mo.ausloeser], [schl(mo.pfad, o)]) }))
}

/**
 * Schaltmöglichkeiten in einer Markierung. `reduziert`: nur die Stelle mit dem
 * kleinsten Schlüssel, Abbrüche zuletzt. Zulässig, weil jeder Fluss genau ein
 * Ziel hat: Bis zu einem Abbruch nimmt keine Marke einer anderen etwas weg, also
 * ändert die Reihenfolge unabhängiger Schritte nichts an Verklemmung und
 * Abschluss. Verzweigt wird nur an echten Wahlstellen (Entweder-oder, ODER).
 */
function schritte(n: Netz, m: Markierung, reduziert = false): Schritt[] {
  let liste = moeglichkeiten(n, m)
  if (reduziert && liste.length > 0) {
    const normal = liste.filter((x) => x.art !== 'abbruch')
    const auswahl = normal.length > 0 ? normal : liste
    const erster = auswahl.map((x) => x.ausloeser).sort()[0]
    liste = auswahl.filter((x) => x.ausloeser === erster)
  }
  return liste.flatMap((mo) => ausfuehrungen(n, mo, m))
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
  const n = baueNetz(g)
  const voll = durchsuche(n, maxZustaende, false)
  return voll.vollstaendig ? voll : durchsuche(n, maxZustaende * 10, true)
}

function anfang(n: Netz): Markierung {
  const starts = n.g.knoten.filter((k) => k.typ === 'start' && !k.rahmen)
  return new Map(starts.flatMap((s) => s.raus.map((f) => [schl('', f), 1] as [string, number])))
}

function durchsuche(n: Netz, maxZustaende: number, reduziert: boolean): SoundnessErgebnis {
  const fehler: string[] = []
  const starts = n.g.knoten.filter((k) => k.typ === 'start' && !k.rahmen)
  if (starts.length !== 1) fehler.push(`erwartet genau ein Startereignis, gefunden ${starts.length}`)
  for (const k of n.g.knoten) if (k.typ === 'rahmen' && !n.innerStart.has(k.id)) fehler.push(`Rahmen ${k.id} hat kein inneres Startereignis`)

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
  merke(anfang(n))
  const gefeuert = new Set<string>()
  let unsicher = false
  for (let i = 0; i < warteschlange.length; i++) {
    if (index.size > maxZustaende) {
      // Nur Gleichzeitig-Zweige vervielfachen den Zustandsraum; ohne vollständige Suche ist nichts bewiesen.
      return { sound: false, vollstaendig: false, fehler: [`Zustandsraum größer als ${maxZustaende}, nicht vollständig geprüft`], zustaende: index.size, reduziert }
    }
    const m = warteschlange[i]
    // Die Marke einer Instanz zählt offene Stücke; mehr als eine Marke auf einem Fluss ist ein Fehler.
    if (!unsicher && [...m].some(([x, k]) => k > 1 && !x.endsWith('|*'))) {
      unsicher = true
      fehler.push(`mehr als eine Marke auf einem Fluss: ${schluessel(m)}`)
    }
    const moeglich = schritte(n, m, reduziert)
    if (moeglich.length === 0 && m.size > 0) fehler.push(`Verklemmung in Zustand ${schluessel(m)}`)
    for (const s of moeglich) {
      if (!s.vorbei) gefeuert.add(s.knoten)
      if (s.auch) gefeuert.add(s.auch)
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

  // Keine toten Elemente: Jede Aktivität, jedes Gateway, jeder Rahmen, jedes Randereignis und jedes Ende muss in einem Ablauf vorkommen.
  for (const k of n.g.knoten) {
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

/** Ein Schritt mit zufälliger Wahl an Verzweigungen; `zaehle` erfährt, wie oft eine Aktivität dabei ausgeführt wird. */
function wuerfle(n: Netz, mo: Moeglichkeit, m: Markierung, anteil: Map<string, number>, zufall: () => number, zaehle: (id: string, mal: number) => void): Markierung {
  if (mo.art === 'fest') {
    if (n.nach.get(mo.knoten)?.typ === 'aktivitaet') zaehle(mo.knoten, 1)
    return mit(m, mo.weg, mo.hin)
  }
  if (mo.art === 'abbruch') return mo.danach
  if (mo.art === 'mehrfach') {
    // N wie in der Rechnung; eine Aktivität zählt N-mal, ein Rahmen startet N Stücke
    const k = mo.knoten
    const stuecke = zieheStuecke(k, zufall)
    if (k.typ === 'aktivitaet' && stuecke > 0) zaehle(k.id, stuecke)
    if (k.typ === 'aktivitaet' || stuecke === 0) return mit(m, [mo.ausloeser], k.raus.map((o) => schl(mo.pfad, o)))
    return starteStuecke(n, m, mo.ausloeser, k, mo.pfad, stuecke)
  }
  const k = mo.knoten
  if (k.typ === 'oder') {
    // jeder Weg unabhängig nach seinem Wurf; ohne Standard wird eine leere Auswahl neu gewürfelt
    let wahl: string[] = []
    for (let versuch = 0; versuch < 10_000; versuch++) {
      wahl = k.raus.filter((o) => o !== k.standard && zufall() < (anteil.get(o) ?? 0.5))
      if (wahl.length > 0 || !k.mindestensEiner) break
    }
    if (wahl.length === 0 && k.standard) wahl.push(k.standard)
    return mit(m, [mo.ausloeser], wahl.map((o) => schl(mo.pfad, o)))
  }
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
  return mit(m, [mo.ausloeser], [schl(mo.pfad, wahl)])
}

/** Wie `zaehleAusfuehrungen`, dazu der Standardfehler je Aktivität (für Tests mit statistischer Toleranz). */
export function zaehleMitFehler(g: TokenGraph, anteil: Map<string, number>, laeufe: number, zufall: () => number): Map<string, Zaehlung> {
  const n = baueNetz(g)
  const summe = new Map<string, number>()
  const quadrate = new Map<string, number>()
  const ergebnis = new Map<string, Zaehlung>()
  if (!g.knoten.some((k) => k.typ === 'start' && !k.rahmen)) return ergebnis
  for (let l = 0; l < laeufe; l++) {
    const lauf = new Map<string, number>()
    let m = anfang(n)
    for (let schritt = 0; m.size > 0 && schritt < 100_000; schritt++) {
      // die erste bereite Stelle schalten, Abbrüche zuletzt (dafür sorgt `moeglichkeiten`)
      const moeglich = moeglichkeiten(n, m)
      const mo = moeglich.find((x) => x.art !== 'abbruch') ?? moeglich[0]
      if (!mo) break // Verklemmung; zeigt die Soundness-Prüfung
      m = wuerfle(n, mo, m, anteil, zufall, (id, mal) => lauf.set(id, (lauf.get(id) ?? 0) + mal))
    }
    for (const [id, x] of lauf) {
      summe.set(id, (summe.get(id) ?? 0) + x)
      quadrate.set(id, (quadrate.get(id) ?? 0) + x * x)
    }
  }
  for (const [id, s] of summe) {
    const mittel = s / laeufe
    const varianz = Math.max(0, (quadrate.get(id)! / laeufe - mittel * mittel) * (laeufe / Math.max(1, laeufe - 1)))
    ergebnis.set(id, { mittel, fehler: Math.sqrt(varianz / laeufe) })
  }
  return ergebnis
}
