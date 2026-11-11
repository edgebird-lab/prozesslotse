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
 *
 * Randereignisse (Unterbrechungen): An einer Aktivität mit unterbrechenden
 * Randereignissen fällt beim Schalten die Wahl zwischen normalem Ausgang und
 * Randereignis j, an einem Rahmen, wenn die Instanz fertig ist oder nur noch
 * Abbrüche anstehen; die Unterbrechung geht einem Fehler-Ende im Körper vor und
 * leert den Rahmen (bei Mehrfach alle Stücke). Ein nicht unterbrechendes
 * Randereignis (Nebenweg) legt beim Schalten der Aktivität bzw. beim Start des
 * Rahmens zusätzliche Marken auf seinen Ausgang, jede in einer eigenen Instanz
 * `Pfad/Randereignis:n`, damit sich Nebenwege nicht mischen. Suche: jede
 * Möglichkeit, Nebenweg null- oder einmal; Zählung: Anteile am Fluss, Nebenweg
 * ⌊c⌋- oder ⌈c⌉-mal mit Mittel c. Nebenwege berühren den übrigen Ablauf nicht;
 * die vollständige Suche schaltet sie deshalb vorrangig (eine zulässige
 * Verkürzung, die keine Verklemmung übersieht).
 *
 * „Weiter beim ersten“ ist ein Rahmen, in dem jeder Zweig mit einer
 * Terminierung endet; sie leert die Instanz. Nach „Abbruch zuletzt“ laufen die
 * übrigen Zweige vorher zu Ende (abgebrochene Arbeit zählt voll). Die Suche
 * probiert jede Terminierung als erste. Ein Ad-hoc-Rahmen („in
 * beliebiger Reihenfolge“) legt beim Start je Aktivität eine offene Marke
 * `Pfad|?Aktivität` an; ist in der Instanz nichts mehr in Arbeit, wird eine
 * offene Aktivität begonnen (Marke auf dem gedachten Fluss `~Aktivität`). Die
 * Suche nimmt jede Reihenfolge, die Zählung die Reihenfolge der Liste. Die
 * Instanz ist fertig, wenn alle erledigt sind.
 *
 * Abbruch neben gleichzeitig laufenden Schritten: Auf der Prozessebene leert
 * eine Terminierung alles, in einem Rahmen steigt ein Fehler-Ende zum äußersten
 * Rahmen auf. Die Zählung trägt Uhren (`Zeitangaben` aus dem Modell): Stehen
 * mehrere Abbrüche an, schaltet der zeitlich erste (`waehleAbbruch`), wobei
 * Arbeit, die ein Abbruch nur abschneidet, vorher zu Ende läuft. Über
 * Unterbrechungen der Rahmen auf dem Weg eines Abbruchs wird einmal je
 * Ausführung gewürfelt (`RahmenWahl`). Eine ODER-Zusammenführung wartet in der
 * Zählung, solange in ihren Wegen eine Marke auf einen Abbruch zuläuft
 * (`oderAufgeschoben`, auch in der Suche): So geht es hinter der Verzweigung nur
 * weiter, wenn kein gewählter Weg den Vorgang beendet, wie in der Rechnung.
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
  /** Ad-hoc-Rahmen (eine Aktivität nach der anderen, Reihenfolge egal): seine Aktivitäten, für die Zählung in der Reihenfolge der Liste */
  adhoc?: string[]
  /** Gateways: Verzweigung oder Zusammenführung (gatewayDirection); fehlt, entscheidet die Zahl der Eingänge */
  richtung?: 'auf' | 'zu'
  /** Nur ODER-Zusammenführung: die zugehörige Verzweigung (aus dem Layout bzw. aus den Kennungen `…_auf`/`…_zu` im XML) */
  verzweigung?: string
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
  for (const r of l.rahmen) knoten.set(r.id, { id: r.id, typ: 'rahmen', rein: [], raus: [], rahmen: r.eltern, ...(r.mehrfach ? { mehrfach: { ...r.mehrfach } } : {}), ...(r.art === 'adhoc' ? { adhoc: [...(r.aktivitaeten ?? [])] } : {}) })
  for (const k of l.knoten) {
    const t: TokenKnoten = { id: k.id, typ: TYP_AUS_LAYOUT[k.art], rein: [], raus: [], rahmen: k.rahmen ?? null }
    if (k.mindestensEiner) t.mindestensEiner = true
    if (k.mehrfach) t.mehrfach = { ...k.mehrfach }
    if (k.richtung) t.richtung = k.richtung
    if (k.art === 'oder' && k.richtung === 'zu') {
      const auf = l.knoten.find((x) => x.art === 'oder' && x.richtung === 'auf' && x.blockId === k.blockId)
      if (auf) t.verzweigung = auf.id
    }
    if (k.art === 'ende') {
      t.endeArt = k.fehler ? 'fehler' : k.terminierung ? 'terminierung' : 'normal'
      if (k.fehler) t.fehler = k.fehler
    }
    if (k.art === 'rand') {
      Object.assign(t, { wirt: k.wirt, randArt: k.fehler ? 'fehler' : k.ereignis === 'zeit' ? 'zeit' : 'nachricht', unterbrechend: k.unterbrechend !== false })
      if (k.fehler) t.fehler = k.fehler
    }
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
  /** Fluss → Zielknoten, dazu die gedachten Flüsse `~Aktivität` in Ad-hoc-Rahmen */
  ziel: Map<string, string>
  nach: Map<string, TokenKnoten>
  /** Fluss → Quellknoten */
  quelle: Map<string, TokenKnoten>
  /** Rahmen → innerer Start */
  innerStart: Map<string, TokenKnoten>
  /** Wirt → Randereignisse */
  rand: Map<string, TokenKnoten[]>
  /** Wirt → unterbrechende Randereignisse mit Zeit oder Nachricht (Wahl beim Schalten bzw. am Ende des Rahmens) */
  unterbrechend: Map<string, TokenKnoten[]>
  /** Wirt → nicht unterbrechende Randereignisse (Nebenwege) */
  neben: Map<string, TokenKnoten[]>
  /** Kennungen der nicht unterbrechenden Randereignisse: Ihre Instanzen sind Nebenwege */
  nebenIds: Set<string>
  /** ODER-Zusammenführung → je Eingang: Flüsse und Rahmen, von denen aus er erreichbar ist, ohne die Zusammenführung zu passieren */
  oderReichweite: Map<string, Map<string, Reichweite>>
  /** ODER-Zusammenführung → ihre Wege: Flüsse und Rahmen, die die Verzweigung erreicht, ohne die Zusammenführung zu passieren */
  oderWege: Map<string, Reichweite>
}

function istOderZu(k: TokenKnoten): boolean {
  return k.typ === 'oder' && (k.richtung ? k.richtung === 'zu' : k.rein.length > 1)
}

function baueNetz(g: TokenGraph): Netz {
  const nach = new Map(g.knoten.map((k) => [k.id, k]))
  const quelle = new Map<string, TokenKnoten>()
  for (const k of g.knoten) for (const f of k.raus) quelle.set(f, k)
  const innerStart = new Map<string, TokenKnoten>()
  const rand = new Map<string, TokenKnoten[]>()
  const unterbrechend = new Map<string, TokenKnoten[]>()
  const neben = new Map<string, TokenKnoten[]>()
  const nebenIds = new Set<string>()
  for (const k of g.knoten) {
    if (k.typ === 'start' && k.rahmen) innerStart.set(k.rahmen, k)
    if (k.typ !== 'rand' || !k.wirt) continue
    rand.set(k.wirt, [...(rand.get(k.wirt) ?? []), k])
    if (k.unterbrechend === false) {
      neben.set(k.wirt, [...(neben.get(k.wirt) ?? []), k])
      nebenIds.add(k.id)
    } else if (k.randArt !== 'fehler') unterbrechend.set(k.wirt, [...(unterbrechend.get(k.wirt) ?? []), k])
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
  // Wege einer ODER-Verzweigung bis zu ihrer Zusammenführung, vorwärts; Randereignisse gehören zu ihrem Wirt
  const oderWege = new Map<string, Reichweite>()
  for (const j of g.knoten) {
    const s = j.verzweigung ? nach.get(j.verzweigung) : undefined
    if (!istOderZu(j) || !s) continue
    const fluesse = new Set<string>()
    const rahmen = new Set<string>()
    const stapel = [...s.raus]
    while (stapel.length > 0) {
      const f = stapel.pop()!
      if (fluesse.has(f)) continue
      fluesse.add(f)
      const k = nach.get(g.ziel.get(f) ?? '')
      if (!k || k.id === j.id) continue
      if (k.typ === 'rahmen') rahmen.add(k.id)
      stapel.push(...k.raus, ...(rand.get(k.id) ?? []).flatMap((r) => r.raus))
    }
    oderWege.set(j.id, { fluesse, rahmen })
  }
  // Ad-hoc-Rahmen: Eine Aktivität beginnt über einen gedachten Fluss, den es im Diagramm nicht gibt.
  const ziel = new Map(g.ziel)
  for (const k of g.knoten) for (const a of k.adhoc ?? []) ziel.set(`~${a}`, a)
  return { g, ziel, nach, quelle, innerStart, rand, unterbrechend, neben, nebenIds, oderReichweite, oderWege }
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

/**
 * Läuft in den Wegen der ODER-Zusammenführung eine Marke, die sie nicht mehr
 * erreicht (sie läuft auf einen Abbruch zu), schaltet die Zusammenführung erst
 * danach, also nie. BPMN erlaubt diese Reihenfolge (der Abbruch darf vorher
 * schalten), und sie entspricht der Rechnung: Endet ein gewählter Weg den
 * Vorgang, geht es hinter der Verzweigung nicht weiter. Ohne diese Regel liefe
 * nach „Abbruch zuletzt“ eine Schleife um die Verzweigung weiter, während der
 * Abbruch wartet, und Marken stauten sich vor ihm.
 */
function oderAufgeschoben(n: Netz, k: TokenKnoten, pfad: string, m: Markierung): boolean {
  const wege = n.oderWege.get(k.id)
  const karte = n.oderReichweite.get(k.id)
  if (!wege || !karte) return false
  const erreicht = (f: string) => [...karte.values()].some((r) => r.fluesse.has(f))
  const erreichtRahmen = (x: string) => [...karte.values()].some((r) => r.rahmen.has(x))
  for (const s of m.keys()) {
    const [kp, f] = zerlege(s)
    if (kp === pfad) {
      if (wege.fluesse.has(f) && !erreicht(f)) return true
    } else if (pfad === '' ? kp !== '' : kp.startsWith(`${pfad}/`)) {
      const rest = pfad === '' ? kp : kp.slice(pfad.length + 1)
      const seg = rest.split('/')[0]
      const rahmen = seg.slice(0, seg.lastIndexOf(':'))
      if (wege.rahmen.has(rahmen) && !erreichtRahmen(rahmen)) return true
    }
  }
  return false
}

/** Alle nichtleeren Auswahlen ausgehender Flüsse einer ODER-Verzweigung; der Standardfluss nur allein. */
function oderAuswahlen(k: TokenKnoten): string[][] {
  const andere = k.raus.filter((f) => f !== k.standard)
  const auswahlen: string[][] = []
  for (let maske = 1; maske < 1 << andere.length; maske++) auswahlen.push(andere.filter((_, i) => maske & (1 << i)))
  if (k.standard) auswahlen.push([k.standard])
  return auswahlen
}

/** Ausgang eines Schritts mit Randereignissen: normal (ohne `rand`) oder über ein unterbrechendes Randereignis. */
interface SchrittAusgang {
  hin: string[]
  rand?: TokenKnoten
}

/** Ein Nebenweg, der beim Schalten startet: Randereignis und Ebene, auf der er läuft. */
interface NebenStart {
  rand: TokenKnoten
  pfad: string
}

/** Möglicher Ausgang eines Abbruchs: Er läuft durch, oder ein Rahmen auf dem Weg wird vorher unterbrochen. */
interface AbbruchFolge {
  knoten: string
  auch?: string
  danach: Markierung
  /** Unterbrechung: das Randereignis; fehlt beim Abbruch selbst */
  rand?: TokenKnoten
  /** Rahmen auf dem Weg nach innen, die vorher nicht unterbrochen wurden (für das Gewicht beim Zählen) */
  davor: string[]
  /** Unterbrechung: Instanz des Rahmens, der unterbrochen wird */
  instanz?: string
}

/** Was in einer Markierung schalten kann; Wahlstellen (Entweder-oder, ODER, Zahl der Stücke, Randereignisse) mit allen Möglichkeiten erst beim Ausführen. */
type Moeglichkeit =
  | { art: 'fest'; ausloeser: string; knoten: string; weg: string[]; hin: string[] }
  | { art: 'wahl'; ausloeser: string; knoten: TokenKnoten; pfad: string }
  | { art: 'mehrfach'; ausloeser: string; knoten: TokenKnoten; pfad: string }
  /** Aktivität oder Rahmen mit Randereignissen: `basis` kommt immer dazu, dann einer der Ausgänge (falls angegeben) und Nebenwege */
  | { art: 'schritt'; ausloeser: string; knoten: TokenKnoten; weg: string[]; basis: string[]; ausgaenge: SchrittAusgang[] | null; neben: NebenStart[]; zaehlt: boolean }
  | { art: 'abbruch'; ausloeser: string; knoten: string; bereich: (s: string) => boolean; folgen: AbbruchFolge[] }

/** Normaler Ausgang eines Schritts und seine unterbrechenden Randereignisse; Marken auf der Ebene `pfad`. */
function schrittAusgaenge(n: Netz, k: TokenKnoten, pfad: string): SchrittAusgang[] {
  return [{ hin: k.raus.map((o) => schl(pfad, o)) }, ...(n.unterbrechend.get(k.id) ?? []).map((r) => ({ hin: r.raus.map((o) => schl(pfad, o)), rand: r }))]
}

function nebenStarts(n: Netz, k: TokenKnoten, pfad: string): NebenStart[] {
  return (n.neben.get(k.id) ?? []).map((rand) => ({ rand, pfad }))
}

/** Liegt in der Instanz `c` (oder tiefer) eine Marke? */
function instanzBelegt(m: Markierung, c: string): boolean {
  for (const x of m.keys()) if (x.startsWith(`${c}|`) || x.startsWith(`${c}/`)) return true
  return false
}

/** Startet einen Nebenweg `anzahl`-mal, jeden in einer eigenen Instanz; ändert `m`. */
function starteNebenweg(m: Markierung, nb: NebenStart, anzahl: number): void {
  let nr = 1
  for (let i = 0; i < anzahl; i++) {
    while (instanzBelegt(m, kindPfad(nb.pfad, nb.rand.id, nr))) nr++
    const c = kindPfad(nb.pfad, nb.rand.id, nr)
    for (const o of nb.rand.raus) m.set(schl(c, o), (m.get(schl(c, o)) ?? 0) + 1)
  }
}

/** Liegt die Marke in einem Nebenweg (eine Instanz eines nicht unterbrechenden Randereignisses)? */
function inNebenweg(n: Netz, s: string): boolean {
  const pfad = zerlege(s)[0]
  return pfad !== '' && pfad.split('/').some((seg) => n.nebenIds.has(seg.slice(0, seg.lastIndexOf(':'))))
}

/** Rahmen-Instanzen von `pfad` nach außen bis einschließlich `bis` */
function instanzenBis(pfad: string, bis: string): string[] {
  const liste: string[] = []
  for (let p = pfad; p !== ''; p = elternPfad(p)) {
    liste.push(p)
    if (p === bis) break
  }
  return liste
}

/**
 * Wirkung eines Abbruchs: Terminierung leert ihre Ebene; Fehler steigt zum
 * Rahmen mit passendem Randereignis auf. Liegen auf dem Weg dorthin Rahmen mit
 * unterbrechenden Randereignissen, kann vorher einer davon unterbrochen werden
 * (die Unterbrechung geht dem Ende im Körper vor): dann leert sich nur dieser
 * Rahmen, und die Marke geht auf den Ausgang seines Randereignisses.
 */
function abbruch(n: Netz, k: TokenKnoten, s: string, pfad: string, m: Markierung): { bereich: (s: string) => boolean; folgen: AbbruchFolge[] } | null {
  let bereich: (x: string) => boolean
  let durch: AbbruchFolge
  let bis: string
  if (k.endeArt === 'terminierung') {
    const danach = new Map([...m].filter(([x]) => !imBereich(x, pfad) || x === `${pfad}|*`))
    danach.delete(s)
    bereich = (x) => imBereich(x, pfad)
    durch = { knoten: k.id, danach, davor: [] }
    bis = pfad
  } else {
    let gefunden: { bereich: (x: string) => boolean; folge: AbbruchFolge; p: string } | null = null
    for (let p = pfad; p !== ''; p = elternPfad(p)) {
      const fang = (n.rand.get(rahmenVonPfad(p)) ?? []).find((r) => r.randArt === 'fehler' && (!r.fehler || r.fehler === k.fehler))
      if (!fang) continue
      const b = bereichVon(n, p)
      const danach = new Map([...m].filter(([x]) => !b(x)))
      const aussen = elternPfad(p)
      for (const o of fang.raus) danach.set(schl(aussen, o), (danach.get(schl(aussen, o)) ?? 0) + 1)
      gefunden = { bereich: b, folge: { knoten: k.id, auch: fang.id, danach, davor: [] }, p }
      break
    }
    if (!gefunden) return null
    bereich = gefunden.bereich
    durch = gefunden.folge
    bis = gefunden.p
  }
  // Unterbrechungen der Rahmen auf dem Weg, von innen nach außen
  const folgen: AbbruchFolge[] = []
  const davor: string[] = []
  for (const q of instanzenBis(pfad, bis)) {
    const r = n.nach.get(rahmenVonPfad(q))
    const raender = r ? (n.unterbrechend.get(r.id) ?? []) : []
    if (!r || raender.length === 0) continue
    const b = bereichVon(n, q)
    for (const rand of raender) {
      const danach = new Map([...m].filter(([x]) => !b(x)))
      for (const o of rand.raus) danach.set(schl(elternPfad(q), o), (danach.get(schl(elternPfad(q), o)) ?? 0) + 1)
      folgen.push({ knoten: rand.id, danach, rand, davor: [...davor], instanz: q })
    }
    davor.push(r.id)
  }
  folgen.push({ ...durch, davor })
  return { bereich, folgen }
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
      } else if (n.unterbrechend.has(r.id)) {
        // fertig: normal weiter oder über ein unterbrechendes Randereignis
        liste.push({ art: 'schritt', ausloeser: s, knoten: r, weg: [s], basis: [], ausgaenge: schrittAusgaenge(n, r, aussen), neben: [], zaehlt: false })
      } else liste.push({ art: 'fest', ausloeser: s, knoten: r.id, weg: [s], hin: r.raus.map((o) => schl(aussen, o)) })
      continue
    }
    if (f.startsWith('?')) {
      // Ad-hoc: Die nächste offene Aktivität beginnt, wenn in der Instanz nichts mehr in Arbeit ist.
      const inArbeit = [...m.keys()].some((x) => imBereich(x, pfad) && x !== `${pfad}|*` && !(zerlege(x)[0] === pfad && zerlege(x)[1].startsWith('?')))
      if (!inArbeit) liste.push({ art: 'fest', ausloeser: s, knoten: rahmenVonPfad(pfad), weg: [s], hin: [schl(pfad, `~${f.slice(1)}`)] })
      continue
    }
    const k = n.nach.get(n.ziel.get(f)!)
    if (!k) continue
    switch (k.typ) {
      case 'start':
      case 'rand':
        break
      case 'aktivitaet':
        if (k.mehrfach) liste.push({ art: 'mehrfach', ausloeser: s, knoten: k, pfad })
        else if (n.rand.has(k.id)) liste.push({ art: 'schritt', ausloeser: s, knoten: k, weg: [s], basis: [], ausgaenge: schrittAusgaenge(n, k, pfad), neben: nebenStarts(n, k, pfad), zaehlt: true })
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
        // Ad-hoc: alle Aktivitäten offen, in der Reihenfolge der Liste; sonst eine Marke hinter dem inneren Start
        const hin = [`${c}|*`, ...(k.adhoc ? k.adhoc.map((a) => schl(c, `?${a}`)) : (start?.raus ?? []).map((o) => schl(c, o)))]
        // Nebenwege des Rahmens starten mit ihm, auf seiner Ebene
        if (n.neben.has(k.id)) liste.push({ art: 'schritt', ausloeser: s, knoten: k, weg: [s], basis: hin, ausgaenge: null, neben: nebenStarts(n, k, pfad), zaehlt: false })
        else liste.push({ art: 'fest', ausloeser: s, knoten: k.id, weg: [s], hin })
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
          if (f === belegt[0] && oderBereit(n, k, pfad, m) && !oderAufgeschoben(n, k, pfad, m)) liste.push({ art: 'fest', ausloeser: s, knoten: k.id, weg: belegt.map((r) => schl(pfad, r)), hin: k.raus.map((o) => schl(pfad, o)) })
        } else liste.push({ art: 'wahl', ausloeser: s, knoten: k, pfad })
        break
      case 'xor':
      case 'ereignisgateway':
        if (k.raus.length === 0) liste.push({ art: 'fest', ausloeser: s, knoten: k.id, weg: [s], hin: [] })
        else liste.push({ art: 'wahl', ausloeser: s, knoten: k, pfad })
        break
    }
  }
  // Abbruch zuletzt: nur, wenn in dem Bereich, den er beendet, sonst nichts mehr schalten kann. Stehen mehrere Abbrüche
  // zugleich an (die Terminierungen von „weiter beim ersten“), kann jeder der erste sein.
  const normal = [...liste]
  for (const a of abbrueche) if (a.art === 'abbruch' && !normal.some((x) => a.bereich(x.ausloeser))) liste.push(a)
  return liste
}

interface Schritt {
  knoten: string
  /** weitere Knoten, die dabei schalten (fangendes Randereignis, Randereignis einer Unterbrechung, gestartete Nebenwege) */
  auch?: string[]
  /** gewählter ausgehender Fluss bei Verzweigungen */
  wahl?: string
  /** Mehrfachinstanz ohne Stück: Die Marke läuft vorbei, ausgeführt wird nichts. */
  vorbei?: boolean
  danach: Markierung
}

/** Suche: jeder Nebenweg null- oder einmal; mehr Nebenwege wiederholen nur dasselbe. */
function mitNebenwegen(liste: Schritt[], neben: NebenStart[]): Schritt[] {
  let ergebnis = liste
  for (const nb of neben) {
    ergebnis = ergebnis.flatMap((s) => {
      const danach = new Map(s.danach)
      starteNebenweg(danach, nb, 1)
      return [s, { ...s, auch: [...(s.auch ?? []), nb.rand.id], wahl: `${s.wahl ?? ''}+${nb.rand.id}`, danach }]
    })
  }
  return ergebnis
}

function ausfuehrungen(n: Netz, mo: Moeglichkeit, m: Markierung): Schritt[] {
  if (mo.art === 'fest') return [{ knoten: mo.knoten, danach: mit(m, mo.weg, mo.hin) }]
  if (mo.art === 'abbruch') return mo.folgen.map((f) => ({ knoten: f.knoten, auch: f.auch ? [f.auch] : undefined, wahl: f.rand?.id, danach: f.danach }))
  if (mo.art === 'schritt') {
    const basis = mit(m, mo.weg, mo.basis)
    const varianten: Schritt[] = mo.ausgaenge
      ? mo.ausgaenge.map((a) => ({ knoten: mo.knoten.id, auch: a.rand ? [a.rand.id] : undefined, wahl: a.rand?.id ?? 'normal', danach: mit(basis, [], a.hin) }))
      : [{ knoten: mo.knoten.id, danach: basis }]
    return mitNebenwegen(varianten, mo.neben)
  }
  if (mo.art === 'mehrfach') {
    // Suche: ohne Stück und mit einem Stück, soweit die Anzahl das zulässt; weitere Stücke wiederholen nur dasselbe
    const k = mo.knoten
    const moeglich = stueckMoeglich(k)
    const vorbei = mit(m, [mo.ausloeser], k.raus.map((o) => schl(mo.pfad, o)))
    if (k.typ === 'aktivitaet') return [moeglich.mit ? { knoten: k.id, danach: vorbei } : { knoten: k.id, vorbei: true, danach: vorbei }]
    const liste: Schritt[] = []
    if (moeglich.ohne) {
      // ohne Stück sofort fertig; Unterbrechungen gelten je Ausführung, also auch hier
      for (const a of schrittAusgaenge(n, k, mo.pfad)) liste.push({ knoten: k.id, vorbei: true, wahl: a.rand ? `ohne+${a.rand.id}` : 'ohne', auch: a.rand ? [a.rand.id] : undefined, danach: mit(m, [mo.ausloeser], a.hin) })
    }
    if (moeglich.mit) liste.push({ knoten: k.id, wahl: 'eins', danach: starteStuecke(n, m, mo.ausloeser, k, mo.pfad, 1) })
    return mitNebenwegen(liste, nebenStarts(n, k, mo.pfad))
  }
  const k = mo.knoten
  if (k.typ === 'oder') return oderAuswahlen(k).map((wahl) => ({ knoten: k.id, wahl: wahl.join('+'), danach: mit(m, [mo.ausloeser], wahl.map((o) => schl(mo.pfad, o))) }))
  return k.raus.map((o) => ({ knoten: k.id, wahl: o, danach: mit(m, [mo.ausloeser], [schl(mo.pfad, o)]) }))
}

/**
 * Schaltmöglichkeiten in einer Markierung. `reduziert`: nur die Stelle mit dem
 * kleinsten Schlüssel, Abbrüche zuletzt (dann alle derselben Instanz: jeder kann
 * der erste sein). Zulässig, weil jeder Fluss genau ein
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
    // Abbrüche derselben Instanz (die Terminierungen von „weiter beim ersten“) sind eine echte Wahl: Jeder kann der erste sein.
    const pfad = zerlege(erster)[0]
    liste = normal.length > 0 ? auswahl.filter((x) => x.ausloeser === erster) : auswahl.filter((x) => zerlege(x.ausloeser)[0] === pfad)
  } else if (liste.length > 0) {
    // Nebenwege zuerst: Ihre Marken teilen keinen Fluss mit dem übrigen Ablauf, kein anderer Schritt nimmt ihnen etwas weg,
    // und ein Abbruch wartet ohnehin auf sie. Diese Reihenfolge übersieht also keine Verklemmung und keinen Abschluss.
    const neben = liste.filter((x) => x.art !== 'abbruch' && inNebenweg(n, x.ausloeser))
    if (neben.length > 0) {
      const erster = neben.map((x) => x.ausloeser).sort()[0]
      liste = neben.filter((x) => x.ausloeser === erster)
    }
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
  for (const k of n.g.knoten) if (k.typ === 'rahmen' && !k.adhoc && !n.innerStart.has(k.id)) fehler.push(`Rahmen ${k.id} hat kein inneres Startereignis`)

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
      for (const x of s.auch ?? []) gefeuert.add(x)
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
export function zaehleAusfuehrungen(g: TokenGraph, anteil: Map<string, number>, laeufe: number, zufall: () => number, zeiten?: Zeitangaben): Map<string, number> {
  return new Map([...zaehleMitFehler(g, anteil, laeufe, zufall, zeiten)].map(([id, x]) => [id, x.mittel]))
}

export interface Zaehlung {
  /** mittlere Zahl der Ausführungen je Vorgang */
  mittel: number
  /** Standardfehler dieses Mittelwerts */
  fehler: number
}

/** Ein Schritt mit zufälliger Wahl an Verzweigungen; `zaehle` erfährt, wie oft eine Aktivität oder ein Endereignis dabei schaltet. */
function wuerfle(n: Netz, mo: Moeglichkeit, m: Markierung, anteil: Map<string, number>, zufall: () => number, zaehle: (id: string, mal: number) => void): Markierung {
  if (mo.art === 'fest') {
    // Endereignisse zählen mit: Daraus ergibt sich, wie oft der Vorgang mit welchem Ergebnis endet.
    const typ = n.nach.get(mo.knoten)?.typ
    if (typ === 'aktivitaet' || typ === 'ende') zaehle(mo.knoten, 1)
    return mit(m, mo.weg, mo.hin)
  }
  if (mo.art === 'abbruch') {
    // Ein Rahmen auf dem Weg wird mit dem Anteil seines Randereignisses unterbrochen, sonst läuft der Abbruch durch.
    const rest = (id: string) => 1 - Math.min(1, (n.unterbrechend.get(id) ?? []).reduce((s, r) => s + randAnteil(r, anteil), 0))
    const gewichte = mo.folgen.map((f) => (f.rand ? randAnteil(f.rand, anteil) : 1) * f.davor.reduce((p, id) => p * rest(id), 1))
    const f = waehleNachGewicht(mo.folgen, gewichte, zufall)
    // Endereignisse zählen mit (für den Vergleich, wie oft ein Zweig von „weiter beim ersten“ zuerst fertig ist)
    if (n.nach.get(f.knoten)?.typ === 'ende') zaehle(f.knoten, 1)
    return f.danach
  }
  if (mo.art === 'schritt') {
    if (mo.zaehlt) zaehle(mo.knoten.id, 1)
    const danach = mit(m, mo.weg, mo.basis)
    if (mo.ausgaenge) {
      // normal mit 1 − Σq, Randereignis j mit q_j
      const q = mo.ausgaenge.map((a) => (a.rand ? randAnteil(a.rand, anteil) : 0))
      const normal = Math.max(0, 1 - q.reduce((s, x) => s + x, 0))
      const a = waehleNachGewicht(mo.ausgaenge, q.map((x, i) => (mo.ausgaenge![i].rand ? x : normal)), zufall)
      for (const x of a.hin) danach.set(x, (danach.get(x) ?? 0) + 1)
    }
    starteNebenwegeGezaehlt(danach, mo.neben, anteil, zufall)
    return danach
  }
  if (mo.art === 'mehrfach') {
    // N wie in der Rechnung; eine Aktivität zählt N-mal, ein Rahmen startet N Stücke
    const k = mo.knoten
    const stuecke = zieheStuecke(k, zufall)
    if (k.typ === 'aktivitaet' && stuecke > 0) zaehle(k.id, stuecke)
    let danach: Markierung
    if (k.typ === 'aktivitaet') danach = mit(m, [mo.ausloeser], k.raus.map((o) => schl(mo.pfad, o)))
    else if (stuecke > 0) danach = starteStuecke(n, m, mo.ausloeser, k, mo.pfad, stuecke)
    else if (n.unterbrechend.has(k.id)) {
      // ohne Stück sofort fertig; auch dann gilt der Anteil der Unterbrechungen
      const ausgaenge = schrittAusgaenge(n, k, mo.pfad)
      const q = ausgaenge.map((a) => (a.rand ? randAnteil(a.rand, anteil) : 0))
      const normal = Math.max(0, 1 - q.reduce((s, x) => s + x, 0))
      danach = mit(m, [mo.ausloeser], waehleNachGewicht(ausgaenge, q.map((x, i) => (ausgaenge[i].rand ? x : normal)), zufall).hin)
    } else danach = mit(m, [mo.ausloeser], k.raus.map((o) => schl(mo.pfad, o)))
    if (k.typ === 'rahmen' && n.neben.has(k.id)) starteNebenwegeGezaehlt(danach, nebenStarts(n, k, mo.pfad), anteil, zufall)
    return danach
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

// ---------------------------------------------------------------------------
// Uhren für die Zählung: Wer zuerst abbricht

/**
 * Zeiten aus dem Modell, damit die Zählung unter mehreren anstehenden Abbrüchen
 * den zeitlich ersten wählen kann (wie die Rechnung, ohne Streuung der Zeiten).
 * Fehlt eine Angabe, gilt 0.
 */
export interface Zeitangaben {
  /** Aktivität: Liegezeit und Bearbeitung (bei Mehrfach je Stück), Warten, Ereignis eines Ausgangs */
  dauer: Map<string, number>
  /** „Für jedes Stück“ (Aktivität oder Rahmen): Liegezeit vor dem ersten Stück */
  liegen: Map<string, number>
  /** Unterbrechendes Randereignis: Zeit ab Eingang beim Wirt; null bei einer Nachricht an einem Rahmen (nach der Hälfte seines Durchlaufs) */
  rand: Map<string, number | null>
  /** Endereignis: Stelle des Endes im Modell (Lesereihenfolge); bei gleicher Zeit gewinnt die frühere */
  rang: Map<string, number>
}

interface Instanzzeit {
  /** Eingang beim Rahmen (vor der Liegezeit) */
  ein: number
  /** spätestes Ende von allem, was darin geschaltet hat */
  bis: number
}

/**
 * Uhren der Marken: Jede Marke trägt die Zeit, zu der sie ihren Fluss
 * erreicht. Ein Knoten schaltet zur spätesten Zeit seiner Eingänge, eine
 * Aktivität braucht ihre Dauer. Eine Rahmen-Instanz ist fertig, wenn das
 * Späteste darin fertig ist; eine Terminierung setzt sie auf ihre Zeit (die
 * übrigen Zweige liefen nach „Abbruch zuletzt“ nur zum Zählen zu Ende).
 */
class Uhren {
  private uhr = new Map<string, number>()
  private instanz = new Map<string, Instanzzeit>()
  /** Stücke von „für jedes Stück“ zur selben Zeit: spätestes Ende der schon fertigen Stücke je Aktivierung */
  private gruppe = new Map<string, number>()

  private n: Netz
  private z: Zeitangaben

  constructor(n: Netz, z: Zeitangaben) {
    this.n = n
    this.z = z
  }

  beginne(m: Markierung): void {
    this.uhr = new Map([...m.keys()].map((s) => [s, 0]))
    this.instanz = new Map([['', { ein: 0, bis: 0 }]])
    this.gruppe = new Map()
  }

  zeit(s: string): number {
    return this.uhr.get(s) ?? 0
  }

  /**
   * Reihenfolge zweier Abbrüche zur selben Zeit (negativ: x zuerst). Liegen die
   * Marken in verschiedenen Stücken derselben Mehrfachinstanz, entscheidet die
   * Nummer des Stücks (die Stücke sind gleichartig, wie in der Rechnung); sonst
   * die Stelle des Endes im Modell (der frühere Zweig gewinnt).
   */
  vorrang(x: { ausloeser: string; knoten: string }, y: { ausloeser: string; knoten: string }): number {
    const px = zerlege(x.ausloeser)[0].split('/')
    const py = zerlege(y.ausloeser)[0].split('/')
    for (let i = 0; i < Math.min(px.length, py.length); i++) {
      if (px[i] === py[i]) continue
      const rx = px[i].slice(0, px[i].lastIndexOf(':'))
      const ry = py[i].slice(0, py[i].lastIndexOf(':'))
      if (rx === ry && this.n.nach.get(rx)?.mehrfach) return Number(px[i].slice(rx.length + 1)) - Number(py[i].slice(ry.length + 1))
      break
    }
    return (this.z.rang.get(x.knoten) ?? Infinity) - (this.z.rang.get(y.knoten) ?? Infinity)
  }

  private fertig(c: string): number {
    const r = this.n.nach.get(rahmenVonPfad(c))
    const eigene = this.instanz.get(c)?.bis ?? 0
    return r?.mehrfach && !r.mehrfach.nacheinander ? Math.max(eigene, this.gruppe.get(gruppenSchluessel(c, r.id)) ?? -Infinity) : eigene
  }

  private dauer(k: TokenKnoten, stuecke: number | undefined): number {
    const d = this.z.dauer.get(k.id) ?? 0
    if (!k.mehrfach) return d
    const anzahl = stuecke ?? 0
    return anzahl === 0 ? 0 : (this.z.liegen.get(k.id) ?? 0) + (k.mehrfach.nacheinander ? anzahl : 1) * d
  }

  private bis(pfad: string, t: number): void {
    const x = this.instanz.get(pfad)
    if (x) x.bis = Math.max(x.bis, t)
  }

  /** Stellt nach einem Schritt die Uhren der neuen Marken; `stuecke`: gezogene Anzahl einer Aktivität mit Markierung. */
  schalte(mo: Moeglichkeit, vorher: Markierung, danach: Markierung, stuecke: number | undefined): void {
    const weg = [...vorher.keys()].filter((s) => (danach.get(s) ?? 0) < vorher.get(s)!)
    // neue Instanzen zuerst, damit ihre Marken die Zeit der Instanz kennen
    const hin = [...danach.keys()].filter((s) => (danach.get(s) ?? 0) > (vorher.get(s) ?? 0)).sort((a, b) => Number(b.endsWith('|*')) - Number(a.endsWith('|*')))
    const [ebene, ausF] = zerlege(mo.ausloeser)
    const abbruchZeit = mo.art === 'abbruch' ? this.zeit(mo.ausloeser) : 0
    // Instanz, die mit diesem Schritt fertig wird (ihre Marke `Pfad|*`), sonst null
    const fertigeInstanz = ausF === '*' ? ebene : null
    let start: number
    if (fertigeInstanz !== null || ausF.startsWith('?')) start = this.fertig(ebene)
    else if (mo.art === 'abbruch') start = abbruchZeit
    else start = Math.max(0, ...weg.filter((s) => !s.endsWith('|*')).map((s) => this.zeit(s)))
    const knotenId = mo.art === 'wahl' || mo.art === 'mehrfach' || mo.art === 'schritt' ? mo.knoten.id : mo.knoten
    const k = this.n.nach.get(knotenId)
    const aussen = fertigeInstanz !== null ? elternPfad(fertigeInstanz) : ebene

    if (mo.art === 'abbruch') {
      const ende = this.n.nach.get(mo.knoten)
      // Eine Terminierung in einem Rahmen beendet ihn zu ihrer Zeit.
      if (ende?.endeArt === 'terminierung' && ebene !== '' && this.instanz.has(ebene)) this.instanz.get(ebene)!.bis = abbruchZeit
    }
    if (fertigeInstanz !== null && danach.has(mo.ausloeser) === false) {
      // Stück von „für jedes Stück“ zur selben Zeit fertig, andere laufen noch: ihr Ende merkt sich die Gruppe
      const r = this.n.nach.get(rahmenVonPfad(fertigeInstanz))
      if (r?.mehrfach && !r.mehrfach.nacheinander) {
        const g = gruppenSchluessel(fertigeInstanz, r.id)
        this.gruppe.set(g, Math.max(this.gruppe.get(g) ?? -Infinity, this.instanz.get(fertigeInstanz)?.bis ?? start))
      }
    }
    if (mo.art === 'mehrfach' && k?.typ === 'rahmen') this.gruppe.set(gruppenSchluessel(kindPfad(ebene, k.id, 1), k.id), start + (this.z.liegen.get(k.id) ?? 0))

    for (const h of hin) {
      const [hp, hf] = zerlege(h)
      if (hf === '*') {
        // neue Rahmen-Instanz; bei „für jedes Stück“ beginnen die Stücke nach der Liegezeit
        const r = this.n.nach.get(rahmenVonPfad(hp))
        this.instanz.set(hp, { ein: start, bis: start + (r?.mehrfach ? (this.z.liegen.get(r.id) ?? 0) : 0) })
        continue
      }
      if (hf.startsWith('?')) continue
      let t = start
      if (hf.startsWith('~')) t = this.instanz.get(hp)?.bis ?? start
      else {
        const s = this.n.quelle.get(hf)
        if (s?.typ === 'aktivitaet') t = start + this.dauer(s, stuecke)
        else if (s?.typ === 'start') t = fertigeInstanz === hp ? this.fertig(hp) : (this.instanz.get(hp)?.bis ?? start)
        else if (s?.typ === 'rahmen') t = fertigeInstanz !== null ? this.fertig(fertigeInstanz) : start
        else if (s?.typ === 'rand') t = this.randZeit(s, mo, weg, start, abbruchZeit, fertigeInstanz)
      }
      this.uhr.set(h, t)
      this.bis(hp, t)
    }
    for (const s of weg) if ((danach.get(s) ?? 0) === 0) this.uhr.delete(s)
    // Was ohne neue Marke fertig wird (Ende, Aktivität im Ad-hoc-Rahmen, Rahmen-Instanz darin), zählt für die Instanz.
    if (mo.art !== 'abbruch') this.bis(aussen, k?.typ === 'aktivitaet' && fertigeInstanz === null ? start + this.dauer(k, stuecke) : start)
    if (fertigeInstanz !== null) this.bis(aussen, this.fertig(fertigeInstanz))
  }

  /** Zeit, zu der ein Randereignis auslöst: Fehler zur Zeit des Abbruchs, Frist oder Nachricht ab Eingang beim Wirt. */
  private randZeit(r: TokenKnoten, mo: Moeglichkeit, weg: string[], start: number, abbruchZeit: number, fertigeInstanz: string | null): number {
    if (r.randArt === 'fehler') return abbruchZeit
    if (r.unterbrechend === false) return start
    const t = this.z.rand.get(r.id)
    const wirt = r.wirt ? this.n.nach.get(r.wirt) : undefined
    if (wirt?.typ !== 'rahmen') return start + (t ?? 0)
    // Rahmen: ab dem Eingang der Instanz; ohne Instanz (kein Stück) ab jetzt
    const c = fertigeInstanz ?? weg.map((s) => zerlege(s)[0]).find((p) => p !== '' && rahmenVonPfad(p) === wirt.id) ?? null
    const x = c !== null ? this.instanz.get(c) : undefined
    if (!x) return start + (t ?? 0)
    const ende = mo.art === 'abbruch' ? abbruchZeit : this.fertig(c!)
    return x.ein + (t ?? (ende - x.ein) / 2)
  }
}

const NORMAL = 'normal'

/**
 * Ob ein Rahmen mit unterbrechenden Randereignissen unterbrochen wird, entscheidet
 * ein fester Anteil je Ausführung (wie in der Rechnung). Für die Zählung wird
 * einmal je Ausführung gewürfelt, und zwar dann, wenn es zum ersten Mal darauf
 * ankommt: beim Ende der Instanz oder wenn darin ein Abbruch ansteht. Bei
 * „für jedes Stück“ zur selben Zeit gilt die Wahl für alle Stücke.
 */
class RahmenWahl {
  private wahl = new Map<string, string>()
  private n: Netz
  private anteil: Map<string, number>
  private zufall: () => number

  constructor(n: Netz, anteil: Map<string, number>, zufall: () => number) {
    this.n = n
    this.anteil = anteil
    this.zufall = zufall
  }

  private schluessel(instanz: string): string {
    const r = this.n.nach.get(rahmenVonPfad(instanz))
    return r?.mehrfach && !r.mehrfach.nacheinander ? gruppenSchluessel(instanz, r.id) : instanz
  }

  /** Randereignis, über das die Ausführung des Rahmens endet, oder NORMAL. */
  entscheide(instanz: string): string {
    const s = this.schluessel(instanz)
    let d = this.wahl.get(s)
    if (d === undefined) {
      const raender = this.n.unterbrechend.get(rahmenVonPfad(instanz)) ?? []
      const q = raender.map((r) => randAnteil(r, this.anteil))
      d = waehleNachGewicht([...raender.map((r) => r.id), NORMAL], [...q, Math.max(0, 1 - q.reduce((x, y) => x + y, 0))], this.zufall)
      this.wahl.set(s, d)
    }
    return d
  }

  /** Vergisst die Wahl für Ausführungen, die beendet sind. */
  raeume(m: Markierung): void {
    if (this.wahl.size === 0) return
    const laufend = new Set<string>()
    for (const x of m.keys()) if (x.endsWith('|*')) laufend.add(this.schluessel(x.slice(0, -2)))
    for (const s of [...this.wahl.keys()]) if (!laufend.has(s)) this.wahl.delete(s)
  }
}

/**
 * Steht ein Abbruch in einem Rahmen mit Unterbrechungen an, wird zuerst über die
 * Rahmen auf seinem Weg entschieden, von innen nach außen. Wird einer
 * unterbrochen, schaltet das sofort: Es betrifft nur diesen Rahmen und gehört zur
 * Arbeit, die ein äußerer Abbruch abschneiden würde.
 */
function abbruchMitUnterbrechung(moeglich: Moeglichkeit[], wahl: RahmenWahl): Moeglichkeit | undefined {
  for (const a of moeglich) {
    if (a.art !== 'abbruch') continue
    for (const f of a.folgen) {
      if (!f.rand || !f.instanz) break
      if (wahl.entscheide(f.instanz) === f.rand.id) return { ...a, folgen: [f] }
    }
  }
  return undefined
}

/** Die Abbrüche, nachdem kein Rahmen auf ihrem Weg unterbrochen wurde: Sie laufen durch. */
function ohneUnterbrechung(moeglich: Moeglichkeit[]): Moeglichkeit[] {
  return moeglich.map((a) => (a.art === 'abbruch' ? { ...a, folgen: a.folgen.filter((f) => !f.rand) } : a))
}

/** Schlüssel der Stücke einer Aktivierung von „für jedes Stück“ (gleichzeitig): Ebene und Rahmen. */
function gruppenSchluessel(stueckPfad: string, rahmen: string): string {
  return `${elternPfad(stueckPfad)}#${rahmen}`
}

/**
 * Welcher der anstehenden Abbrüche schaltet? Die Bereiche sind Rahmen-Instanzen
 * (oder der Prozess), also verschachtelt. Innerhalb des Bereichs eines Abbruchs
 * gewinnt der zeitlich erste aller Abbrüche, deren Marke darin liegt (bei
 * Gleichstand der frühere im Modell): Er beendet diesen Bereich oder steigt,
 * wenn sein eigener Bereich größer ist, weiter auf und konkurriert dort. Gewinnt
 * ein Abbruch b in seinem Bereich, und liegt die Marke eines anderen a nicht
 * darin, wohl aber b im Bereich von a, dann gehört b zur Arbeit, die a nur
 * abschneidet (z. B. „weiter beim ersten“ in einem anderen Zweig von
 * Gleichzeitig): b schaltet vorher, denn abgebrochene Arbeit zählt voll.
 */
function waehleAbbruch(moeglich: Moeglichkeit[], uhren: Uhren): Moeglichkeit | undefined {
  type Abbruch = Extract<Moeglichkeit, { art: 'abbruch' }>
  const ab = moeglich.filter((x): x is Abbruch => x.art === 'abbruch')
  const frueher = (x: Abbruch, y: Abbruch): boolean => {
    const d = uhren.zeit(x.ausloeser) - uhren.zeit(y.ausloeser)
    if (Math.abs(d) > 1e-9) return d < 0
    const r = uhren.vorrang(x, y)
    if (r !== 0 && !Number.isNaN(r)) return r < 0
    return x.ausloeser < y.ausloeser
  }
  // gewinnt in seinem Bereich
  const gewinner = ab.filter((a) => ab.every((b) => b === a || !a.bereich(b.ausloeser) || frueher(a, b)))
  // nicht abgeschnitten von einem anderen Gewinner, der zuerst zu Ende laufen muss
  const frei = gewinner.filter((a) => !gewinner.some((b) => b !== a && a.bereich(b.ausloeser) && !b.bereich(a.ausloeser)))
  return (frei.length > 0 ? frei : ab).reduce<Abbruch | undefined>((best, x) => (!best || frueher(x, best) ? x : best), undefined)
}

/** Anteil (unterbrechend) bzw. mittlere Anzahl je Ausführung (Nebenweg), wie er am Ausgang des Randereignisses steht. */
function randAnteil(r: TokenKnoten, anteil: Map<string, number>): number {
  const x = r.raus.length > 0 ? anteil.get(r.raus[0]) : undefined
  return x !== undefined && Number.isFinite(x) ? Math.max(0, x) : 0
}

/** Zieht einen Eintrag nach Gewichten; ohne Gewicht den ersten. */
function waehleNachGewicht<T>(liste: T[], gewichte: number[], zufall: () => number): T {
  const gesamt = gewichte.reduce((s, x) => s + x, 0)
  if (gesamt <= 0) return liste[0]
  let wurf = zufall() * gesamt
  for (let i = 0; i < liste.length; i++) {
    wurf -= gewichte[i]
    if (wurf < 0) return liste[i]
  }
  return liste[liste.length - 1]
}

/** Startet jeden Nebenweg ⌊c⌋- oder ⌈c⌉-mal, so dass er im Mittel c-mal läuft; ändert `m`. */
function starteNebenwegeGezaehlt(m: Markierung, neben: NebenStart[], anteil: Map<string, number>, zufall: () => number): void {
  for (const nb of neben) {
    const c = randAnteil(nb.rand, anteil)
    const ganz = Math.floor(c)
    starteNebenweg(m, nb, ganz + (zufall() < c - ganz ? 1 : 0))
  }
}

/**
 * Wie `zaehleAusfuehrungen`, dazu der Standardfehler je Aktivität (für Tests mit
 * statistischer Toleranz). Gezählt werden Aktivitäten und die Endereignisse von
 * Abbrüchen. Stehen mehrere Abbrüche an, schaltet nach `zeiten` der zeitlich
 * erste (`waehleAbbruch`); ohne Zeiten entscheidet die Stelle im Modell.
 */
export function zaehleMitFehler(g: TokenGraph, anteil: Map<string, number>, laeufe: number, zufall: () => number, zeiten?: Zeitangaben): Map<string, Zaehlung> {
  const n = baueNetz(g)
  const summe = new Map<string, number>()
  const quadrate = new Map<string, number>()
  const ergebnis = new Map<string, Zaehlung>()
  if (!g.knoten.some((k) => k.typ === 'start' && !k.rahmen)) return ergebnis
  const uhren = new Uhren(n, zeiten ?? { dauer: new Map(), liegen: new Map(), rand: new Map(), rang: new Map() })
  const wahl = new RahmenWahl(n, anteil, zufall)
  for (let l = 0; l < laeufe; l++) {
    const lauf = new Map<string, number>()
    let m = anfang(n)
    uhren.beginne(m)
    for (let schritt = 0; m.size > 0 && schritt < 100_000; schritt++) {
      // die erste bereite Stelle schalten, Abbrüche zuletzt (dafür sorgt `moeglichkeiten`), unter ihnen der zeitlich erste
      const moeglich = moeglichkeiten(n, m)
      let mo = moeglich.find((x) => x.art !== 'abbruch') ?? abbruchMitUnterbrechung(moeglich, wahl) ?? waehleAbbruch(ohneUnterbrechung(moeglich), uhren)
      if (!mo) break // Verklemmung; zeigt die Soundness-Prüfung
      if (mo.art === 'schritt' && mo.knoten.typ === 'rahmen' && mo.ausgaenge) {
        // Ende eines Rahmens mit Unterbrechungen: dieselbe Wahl wie für Abbrüche darin
        const d = wahl.entscheide(zerlege(mo.ausloeser)[0])
        mo = { ...mo, ausgaenge: mo.ausgaenge.filter((a) => (a.rand?.id ?? NORMAL) === d) }
      }
      let stuecke: number | undefined
      const danach = wuerfle(n, mo, m, anteil, zufall, (id, mal) => {
        lauf.set(id, (lauf.get(id) ?? 0) + mal)
        if (mo.art === 'mehrfach' && id === mo.knoten.id) stuecke = mal
      })
      uhren.schalte(mo, m, danach, stuecke)
      m = danach
      wahl.raeume(m)
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
