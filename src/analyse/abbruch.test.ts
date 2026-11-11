/**
 * Abbruch in nebenläufiger Umgebung („Prozess endet“ in Zweigen von
 * Gleichzeitig, in ODER-Wegen, bei Stücken zur selben Zeit, in „weiter beim
 * ersten“): Abbruchkombination, Übergaben, Prüfung, BPMN-Export und Tokenspiel,
 * mit von Hand nachgerechneten Werten (Design: docs/modellierung-v4.md,
 * Abschnitt 5).
 */
import { BpmnModdle, type ModdleElement } from 'bpmn-moddle'
import { describe, expect, it } from 'vitest'
import { erzeugeBpmn } from '../bpmn/export'
import type { Layout } from '../bpmn/layout'
import { graphAusLayout, pruefeSoundness, zaehleMitFehler, type Zaehlung } from '../bpmn/tokenspiel'
import { neueAufgabe, neueEntscheidung, neuerMehrfach, neueOder, neuerOderZweig, neueParallel, neuerProzess, neueRolle, neuerTeilprozess, neueSequenz, neueUnterbrechung, neuerZweig } from '../modell/bausteine'
import { beschreibeCursor } from '../modell/fuehrung'
import { ausgaengeBlock, durchlaufe, findeBlock, nebenlaeufig, unterbrechungVon } from '../modell/operationen'
import { pruefeProzess } from '../modell/pruefung'
import type { Aufgabe, Block, Parallel, ParallelArt, Prozess, Rolle } from '../modell/typen'
import { graphAusXml } from '../testhilfen/bpmn-graph'
import { geometrieFehler } from '../testhilfen/geometrie'
import { standardfehler } from '../testhilfen/statistik'
import { tokenZeiten } from '../testhilfen/tokenzeiten'
import { zufallsProzess } from '../testhilfen/zufallsprozess'
import { findeSchwachstellen } from './hinweise'
import { berechneKennzahlen, type Kennzahlen } from './kennzahlen'
import { simuliere, zufallMitStartwert } from './simulation'
import { erwartung, masse, verteilungSequenz } from './verteilung'

const LAGER = neueRolle('Lager', { personen: 2 })
const BUERO = neueRolle('Büro', { personen: 2 })
const BUCHHALTUNG = neueRolle('Buchhaltung', { personen: 2 })

function aufgabe(name: string, minuten: number, rolle: Rolle = LAGER, liegezeitMin = 0): Aufgabe {
  return neueAufgabe({ name, bearbeitungMin: minuten, liegezeitMin, rolleId: rolle.id })
}

function prozess(schritte: Block[]): Prozess {
  return neuerProzess({ name: 'Test', ergebnis: 'Fertig', rollen: [LAGER, BUERO, BUCHHALTUNG], ablauf: { id: 'haupt', schritte } })
}

/** Entscheidung: in `anteil` der Fälle endet der Vorgang mit `ergebnis`, sonst geht es weiter. */
function endetMit(ergebnis: string, anteil: number) {
  return neueEntscheidung({ frage: `${ergebnis}?`, zweige: [neuerZweig('Nein', 1 - anteil), neuerZweig('Ja', anteil, { ende: ergebnis })] })
}

function gleichzeitig(art: ParallelArt, ...zweige: Block[][]): Parallel {
  const b = neueParallel(zweige.length, art)
  return { ...b, zweige: zweige.map((schritte) => neueSequenz(schritte)) }
}

function ende(k: Kennzahlen, ergebnis: string): number {
  return k.enden.find((e) => e.ergebnis === ergebnis)?.anteil ?? 0
}

function anteile(layout: Layout): Map<string, number> {
  return new Map(layout.kanten.filter((k) => k.anteil !== undefined).map((k) => [k.id, k.anteil!]))
}

/**
 * Tokenspiel gegen die Formeln: Häufigkeit jeder Aufgabe (Toleranz aus dem
 * Standardfehler) und Anteil jedes Ergebnisses, gezählt an den Endereignissen
 * der Prozessebene (Toleranz aus der Binomialverteilung).
 */
function tokenAbweichungen(p: Prozess, laeufe: number, startwert: number): string[] {
  const { layout } = erzeugeBpmn(p)
  const k = berechneKennzahlen(p)
  const gezaehlt = zaehleMitFehler(graphAusLayout(layout), anteile(layout), laeufe, zufallMitStartwert(startwert), tokenZeiten(p, layout))
  const abweichungen: string[] = []
  for (const { block } of durchlaufe(p.ablauf)) {
    if (block.typ !== 'aufgabe') continue
    const formel = k.schritte.get(block.id)?.haeufigkeit ?? 0
    const x: Zaehlung = gezaehlt.get(block.id) ?? { mittel: 0, fehler: 0 }
    if (Math.abs(formel - x.mittel) > 4 * x.fehler + 0.01) abweichungen.push(`${block.name}: Formel ${formel.toFixed(3)}, Tokenspiel ${x.mittel.toFixed(3)} ± ${x.fehler.toFixed(3)}`)
  }
  const imTokenspiel = ergebnisseImTokenspiel(p, layout, gezaehlt)
  for (const [ergebnis, x] of imTokenspiel) {
    const formel = k.enden.filter((e) => e.ergebnis === ergebnis).reduce((s, e) => s + e.anteil, 0)
    if (Math.abs(formel - x) > 4 * Math.sqrt((formel * (1 - formel)) / laeufe) + 0.01) abweichungen.push(`Ergebnis „${ergebnis}“: Formel ${formel.toFixed(4)}, Tokenspiel ${x.toFixed(4)}`)
  }
  for (const e of k.enden) if (e.anteil > 0.01 && !imTokenspiel.has(e.ergebnis)) abweichungen.push(`Ergebnis „${e.ergebnis}“ (${e.anteil.toFixed(3)}) kommt im Tokenspiel nicht vor`)
  return abweichungen
}

/** Wie oft der Vorgang je Ergebnis endet: Endereignisse mit Namen auf der Prozessebene (das reguläre heißt wie in den Kennzahlen). */
function ergebnisseImTokenspiel(p: Prozess, layout: Layout, gezaehlt: Map<string, Zaehlung>): Map<string, number> {
  const je = new Map<string, number>()
  for (const k of layout.knoten) {
    const name = k.id === 'Ende' ? p.ergebnis || 'Ende' : k.name
    if (k.art !== 'ende' || (k.rahmen ?? null) !== null || !name) continue
    je.set(name, (je.get(name) ?? 0) + (gezaehlt.get(k.id)?.mittel ?? 0))
  }
  return je
}

/** Durchlaufzeit und Ergebnisse der Simulation gegen die Formeln */
function simulationAbweichungen(p: Prozess, laeufe: number, startwert: number): string[] {
  const k = berechneKennzahlen(p)
  const sim = simuliere(p, laeufe, startwert)
  const abweichungen: string[] = []
  if (Math.abs(sim.mittelMin - k.durchlaufzeitMin) > 4 * standardfehler(sim.zeiten) + 0.005 * Math.max(1, k.durchlaufzeitMin)) abweichungen.push(`Durchlaufzeit: Formel ${k.durchlaufzeitMin.toFixed(2)}, Simulation ${sim.mittelMin.toFixed(2)}`)
  for (const e of k.enden) {
    const x = sim.ergebnisse.find((r) => r.ergebnis === e.ergebnis && r.regulaer === e.regulaer)?.anteil ?? 0
    if (Math.abs(x - e.anteil) > 4 * Math.sqrt((e.anteil * (1 - e.anteil)) / laeufe) + 0.002) abweichungen.push(`Ende „${e.ergebnis}“: Formel ${e.anteil.toFixed(4)}, Simulation ${x.toFixed(4)}`)
  }
  return abweichungen
}

/** Design: Zweig 1 A 10 Min., dann endet 30 % „abgelehnt“; Zweig 2 B 60 Min.; danach C 5 Min. */
function zweigBricht() {
  const a = aufgabe('Antrag prüfen', 10, LAGER)
  const b = aufgabe('Gutachten erstellen', 60, BUCHHALTUNG)
  const c = aufgabe('Bescheid schreiben', 5, BUERO)
  const par = gleichzeitig('alle', [a, endetMit('abgelehnt', 0.3)], [b])
  return { p: prozess([par, c]), par, a, b, c }
}

/** Design: zwei Zweige je 10 Min., die mit 30 % bzw. 20 % enden */
function gleichstand() {
  const par = gleichzeitig('alle', [aufgabe('A prüfen', 10), endetMit('abgelehnt A', 0.3)], [aufgabe('B prüfen', 10, BUERO), endetMit('abgelehnt B', 0.2)])
  return { p: prozess([par]), par }
}

/** Design: ODER ohne Standardweg, A (70 %, 10 Min., danach endet 50 %) und B (60 %, 40 Min.) */
function oderOhneStandard() {
  const a = aufgabe('Ausweis anfordern', 10, LAGER)
  const b = aufgabe('Nachweis anfordern', 40, BUERO)
  const oder = neueOder({ frage: 'Was fehlt?', standard: null, zweige: [neuerOderZweig('Ausweis', 0.7, { schritte: [a, endetMit('kein Ausweis', 0.5)] }), neuerOderZweig('Nachweis', 0.6, { schritte: [b] })] })
  return { p: prozess([oder]), oder, a, b }
}

/** ODER mit Standardweg: A (60 %, 20 Min., danach endet 50 %), B (50 %, 40 Min.), sonst S (10 Min.) */
function oderMitStandard() {
  const a = aufgabe('A erledigen', 20)
  const b = aufgabe('B erledigen', 40, BUERO)
  const s = aufgabe('S erledigen', 10, BUCHHALTUNG)
  const sonst = neuerOderZweig('Keiner', 0, { schritte: [s] })
  const oder = neueOder({ frage: 'Welche?', standard: sonst.id, zweige: [neuerOderZweig('A', 0.6, { schritte: [a, endetMit('a', 0.5)] }), neuerOderZweig('B', 0.5, { schritte: [b] }), sonst] })
  return { p: prozess([oder]), oder, a, b, s }
}

/** Zwei Stücke zur selben Zeit; je Stück 50 %: T10 (10 Min.), danach endet 20 % „defekt“; sonst T30 (30 Min.) */
function stuecke(liegezeitMin = 0) {
  const t10 = aufgabe('Teil schnell prüfen', 10)
  const t30 = aufgabe('Teil gründlich prüfen', 30)
  const e = neueEntscheidung({ frage: 'Wie prüfen?', zweige: [neuerZweig('schnell', 0.5, { schritte: [t10, endetMit('defekt', 0.2)] }), neuerZweig('gründlich', 0.5, { schritte: [t30] })] })
  const m = neuerMehrfach({ name: 'Für jedes Teil', anzahl: 2, streuung: 'fest', ausfuehrung: 'gleichzeitig', liegezeitMin, koerper: neueSequenz([e]) })
  return { p: prozess([m]), m, t10, t30 }
}

/** Weiter beim ersten: A 30 Min.; B 50 %: B10 (10 Min.), danach endet 40 % „abgelehnt“, sonst B50 (50 Min.); danach C 5 Min. */
function ersterMitEnde() {
  const a = aufgabe('Angebot A einholen', 30)
  const b10 = aufgabe('Angebot B schnell einholen', 10)
  const b50 = aufgabe('Angebot B langsam einholen', 50)
  const e = neueEntscheidung({ frage: 'Antwortet B schnell?', zweige: [neuerZweig('Ja', 0.5, { schritte: [b10, endetMit('abgelehnt', 0.4)] }), neuerZweig('Nein', 0.5, { schritte: [b50] })] })
  const par = gleichzeitig('erster', [a], [e])
  const c = aufgabe('Bestellen', 5, BUERO)
  return { p: prozess([par, c]), par, a, b10, b50, c }
}

describe('Abbruch in Gleichzeitig: Rechnung', () => {
  it('rechnet den frühesten Abbruch (Design: 45 Min. für den Block, weiter 0,7, B zählt voll)', () => {
    const { p, a, b, c } = zweigBricht()
    const k = berechneKennzahlen(p)
    // 0,3 · 10 (abgebrochen nach A) + 0,7 · (60 + 5)
    expect(k.durchlaufzeitMin).toBeCloseTo(48.5, 9)
    expect(k.kritischeArbeitMin).toBeCloseTo(48.5, 9)
    expect(ende(k, 'Fertig')).toBeCloseTo(0.7, 12)
    expect(ende(k, 'abgelehnt')).toBeCloseTo(0.3, 12)
    // abgebrochene Arbeit zählt voll: A 10 + B 60, dazu C in 70 %
    expect(k.schritte.get(a.id)?.haeufigkeit).toBeCloseTo(1, 12)
    expect(k.schritte.get(b.id)?.haeufigkeit).toBeCloseTo(1, 12)
    expect(k.schritte.get(c.id)?.haeufigkeit).toBeCloseTo(0.7, 12)
    expect(k.arbeitszeitMin).toBeCloseTo(73.5, 9)
    // Teilverteilungen des Blocks: abgelehnt bei 10 mit 0,3, weiter bei 60 mit 0,7; zusammen 45 Min.
    const v = verteilungSequenz([p.ablauf.schritte[0]], 'gesamt')
    expect(v.weiter.wert).toEqual([60])
    expect(masse(v.weiter)).toBeCloseTo(0.7, 12)
    expect(v.ende.get('abgelehnt')?.wert).toEqual([10])
    expect(masse(v.ende.get('abgelehnt')!)).toBeCloseTo(0.3, 12)
    expect(0.7 * erwartung(v.weiter) + 0.3 * erwartung(v.ende.get('abgelehnt')!)).toBeCloseTo(45, 9)
    // Beiträge zur Durchlaufzeit ergeben die Durchlaufzeit
    const summe = [...k.schritte.values()].reduce((s, x) => s + x.beitragWartenMin + x.beitragArbeitMin, 0)
    expect(summe).toBeCloseTo(48.5, 9)
  })

  it('gibt bei Gleichstand dem früheren Zweig den Vorzug (Design: A 0,3, B 0,2 · 0,7 = 0,14, weiter 0,56)', () => {
    const { p } = gleichstand()
    const k = berechneKennzahlen(p)
    expect(ende(k, 'abgelehnt A')).toBeCloseTo(0.3, 12)
    expect(ende(k, 'abgelehnt B')).toBeCloseTo(0.14, 12)
    expect(ende(k, 'Fertig')).toBeCloseTo(0.56, 12)
    expect(k.durchlaufzeitMin).toBeCloseTo(10, 9)
  })

  it('nimmt für die TCT dieselbe Kombination mit Bearbeitungszeiten (A liegt 50, 10 Min., endet 50 %; B 30 Min.)', () => {
    const a = aufgabe('A erledigen', 10, LAGER, 50)
    const p = prozess([gleichzeitig('alle', [a, endetMit('x', 0.5)], [aufgabe('B erledigen', 30)])])
    const k = berechneKennzahlen(p)
    // Durchlaufzeit: A ist nach 60 fertig, ob mit Abbruch oder ohne; B nach 30: immer 60
    expect(k.durchlaufzeitMin).toBeCloseTo(60, 9)
    // TCT: Abbruch nach 10 Min. Bearbeitung (0,5), sonst max(10, 30): 0,5 · 10 + 0,5 · 30
    expect(k.kritischeArbeitMin).toBeCloseTo(20, 9)
  })

  it('zählt Übergaben heraus nur, wenn alle Zweige weiterlaufen', () => {
    const x = aufgabe('Antrag erfassen', 5, BUERO)
    const { par, a, b } = zweigBricht()
    const y = aufgabe('Bescheid schreiben', 5, BUERO)
    const k = berechneKennzahlen(prozess([x, par, y]))
    // hinein: Büro → Lager, Büro → Buchhaltung (je 1); heraus: Lager → Büro und Buchhaltung → Büro, je mit 0,7
    expect(k.paare.get(`${x.id}>${a.id}`)).toBeCloseTo(1, 12)
    expect(k.paare.get(`${a.id}>${y.id}`)).toBeCloseTo(0.7, 12)
    expect(k.paare.get(`${b.id}>${y.id}`)).toBeCloseTo(0.7, 12)
    expect(k.uebergaben).toBeCloseTo(3.4, 12)
  })

  it('stimmt mit der Simulation überein (Zeit und Ergebnisse)', () => {
    for (const [i, p] of [zweigBricht().p, gleichstand().p].entries()) expect(simulationAbweichungen(p, 20_000, 11 + i)).toEqual([])
  })
})

describe('Abbruch in ODER-Wegen: Rechnung', () => {
  it('rechnet ohne Standardweg mit der Ziehung „mindestens einer“ (Design: 23,5 Min., Abbruch 0,35)', () => {
    const { p, a, b } = oderOhneStandard()
    const k = berechneKennzahlen(p)
    // nur A 0,4: 10; nur B 0,3: 40; beide 0,3: A bricht in der Hälfte nach 10 ab, sonst 40
    expect(k.durchlaufzeitMin).toBeCloseTo(0.4 * 10 + 0.3 * 40 + 0.3 * (0.5 * 10 + 0.5 * 40), 9)
    expect(k.durchlaufzeitMin).toBeCloseTo(23.5, 9)
    expect(ende(k, 'kein Ausweis')).toBeCloseTo(0.35, 9)
    expect(ende(k, 'Fertig')).toBeCloseTo(0.65, 9)
    // jeder Weg läuft so oft, wie er vorkommt, auch wenn der andere abbricht
    expect(k.schritte.get(a.id)?.haeufigkeit).toBeCloseTo(0.7, 12)
    expect(k.schritte.get(b.id)?.haeufigkeit).toBeCloseTo(0.6, 12)
    expect(k.arbeitszeitMin).toBeCloseTo(31, 9)
  })

  it('rechnet mit Standardweg: Er läuft, wenn keiner der anderen zutrifft (25 Min., Abbruch 0,3)', () => {
    const { p, s } = oderMitStandard()
    const k = berechneKennzahlen(p)
    // A und B 0,3: 0,5 · 20 + 0,5 · 40; nur A 0,3: 20; nur B 0,2: 40; keiner 0,2: S 10
    expect(k.durchlaufzeitMin).toBeCloseTo(0.3 * 30 + 0.3 * 20 + 0.2 * 40 + 0.2 * 10, 9)
    expect(k.durchlaufzeitMin).toBeCloseTo(25, 9)
    expect(ende(k, 'a')).toBeCloseTo(0.3, 9)
    expect(ende(k, 'Fertig')).toBeCloseTo(0.7, 9)
    expect(k.schritte.get(s.id)?.haeufigkeit).toBeCloseTo(0.2, 12)
    // 0,6 · 20 + 0,5 · 40 + 0,2 · 10
    expect(k.arbeitszeitMin).toBeCloseTo(34, 9)
  })

  it('lässt den Vorgänger nur über gewählte Wege ohne Aufgabe durchlaufen (Korrektur der Übergaben)', () => {
    const x = aufgabe('Antrag erfassen', 5, BUERO)
    const la = aufgabe('Ausweis prüfen', 5, LAGER)
    const lb = aufgabe('Nachweis prüfen', 5, LAGER)
    const vielleicht = (t: Aufgabe) => neueEntscheidung({ frage: 'Nötig?', zweige: [neuerZweig('Ja', 0.5, { schritte: [t] }), neuerZweig('Nein', 0.5)] })
    const oder = neueOder({ frage: 'Was fehlt?', standard: null, zweige: [neuerOderZweig('Ausweis', 0.7, { schritte: [vielleicht(la)] }), neuerOderZweig('Nachweis', 0.6, { schritte: [vielleicht(lb)] })] })
    const y = aufgabe('Bescheid schreiben', 5, BUERO)
    const k = berechneKennzahlen(prozess([x, oder, y]))
    // nur A 0,4 · 0,5 + nur B 0,3 · 0,5 + beide 0,3 · (1 − 0,5 · 0,5) = 0,575 (das Maximum über die Wege gäbe 0,35)
    expect(k.paare.get(`${x.id}>${y.id}`)).toBeCloseTo(0.575, 9)
    expect(k.paare.get(`${la.id}>${y.id}`)).toBeCloseTo(0.35, 9)
    expect(k.paare.get(`${lb.id}>${y.id}`)).toBeCloseTo(0.3, 9)
    // Büro → Lager hinein (0,35 + 0,3) und Lager → Büro heraus (0,35 + 0,3)
    expect(k.uebergaben).toBeCloseTo(1.3, 9)
  })

  it('stimmt mit der Simulation überein (Zeit und Ergebnisse)', () => {
    for (const [i, p] of [oderOhneStandard().p, oderMitStandard().p].entries()) expect(simulationAbweichungen(p, 20_000, 21 + i)).toEqual([])
  })
})

describe('Abbruch bei Stücken zur selben Zeit und bei „weiter beim ersten“: Rechnung', () => {
  it('bricht alle Stücke beim ersten Abbruch ab (zwei Stücke: 23 Min., weiter 0,81)', () => {
    const { p, t10, t30 } = stuecke()
    const k = berechneKennzahlen(p)
    // Abbruch nach 10 mit 1 − 0,9² = 0,19; beide schnell und normal 0,16 (10 Min.); sonst 0,65 (30 Min.)
    expect(k.durchlaufzeitMin).toBeCloseTo(0.19 * 10 + 0.16 * 10 + 0.65 * 30, 9)
    expect(k.durchlaufzeitMin).toBeCloseTo(23, 9)
    expect(ende(k, 'defekt')).toBeCloseTo(0.19, 12)
    expect(ende(k, 'Fertig')).toBeCloseTo(0.81, 12)
    // beide Stücke zählen voll: je 0,5 · 10 + 0,5 · 30
    expect(k.schritte.get(t10.id)?.haeufigkeit).toBeCloseTo(1, 12)
    expect(k.schritte.get(t30.id)?.haeufigkeit).toBeCloseTo(1, 12)
    expect(k.arbeitszeitMin).toBeCloseTo(40, 9)
    // die Liegezeit vor dem ersten Stück verschiebt alles um 5 Min.
    expect(berechneKennzahlen(stuecke(5).p).durchlaufzeitMin).toBeCloseTo(28, 9)
  })

  it('lässt bei „weiter beim ersten“ gewinnen, wer zuerst fertig ist oder abbricht', () => {
    const { p, par, c } = ersterMitEnde()
    const k = berechneKennzahlen(p)
    // B schnell (0,5): nach 10 abgelehnt (0,2) oder fertig (0,3); B langsam (0,5): A gewinnt nach 30
    expect(k.zuerstFertig.get(par.zweige[0].id)).toBeCloseTo(0.5, 12)
    expect(k.zuerstFertig.get(par.zweige[1].id)).toBeCloseTo(0.5, 12)
    expect(ende(k, 'abgelehnt')).toBeCloseTo(0.2, 12)
    expect(k.schritte.get(c.id)?.haeufigkeit).toBeCloseTo(0.8, 12)
    expect(k.durchlaufzeitMin).toBeCloseTo(0.5 * 10 + 0.5 * 30 + 0.8 * 5, 9)
    // A 30 + B 0,5 · 10 + 0,5 · 50 + C 0,8 · 5
    expect(k.arbeitszeitMin).toBeCloseTo(64, 9)
    expect(pruefeProzess(p).filter((b) => b.schwere === 'fehler')).toEqual([])
  })

  it('stimmt mit der Simulation überein (Zeit und Ergebnisse)', () => {
    for (const [i, p] of [stuecke().p, stuecke(5).p, ersterMitEnde().p].entries()) expect(simulationAbweichungen(p, 20_000, 31 + i)).toEqual([])
  })
})

describe('Abbruch: Prüfung, Führung und Hinweise', () => {
  const fehler = (p: Prozess) => pruefeProzess(p).filter((b) => b.schwere === 'fehler').map((b) => b.schluessel.split(':')[0])

  it('erlaubt „Prozess endet“ an jeder nebenläufigen Stelle außer im Nebenweg', () => {
    for (const p of [zweigBricht().p, gleichstand().p, oderOhneStandard().p, oderMitStandard().p, stuecke().p, ersterMitEnde().p]) expect(fehler(p)).toEqual([])
    // nach einer Unterbrechung in einem Zweig
    const u = neueUnterbrechung({ bezeichnung: 'Storno', anteil: 0.1, ende: 'storniert' })
    const ware = aufgabe('Ware packen', 10, LAGER)
    expect(fehler(prozess([gleichzeitig('alle', [{ ...ware, unterbrechungen: [u] }], [aufgabe('Rechnung schreiben', 10, BUERO)])]))).toEqual([])
    // im Nebenweg nicht
    const neben = neueUnterbrechung({ bezeichnung: 'Rückfrage', unterbrechend: false, anteil: 0.5, schritte: [aufgabe('Rückfrage klären', 5, BUERO), endetMit('offen', 0.2)] })
    expect(fehler(prozess([gleichzeitig('alle', [{ ...ware, unterbrechungen: [neben] }], [aufgabe('Rechnung schreiben', 10, BUERO)])]))).toEqual(['nebenende'])
  })

  it('kennt im Assistenten nebenläufige Stellen und Nebenwege', () => {
    const neben = neueUnterbrechung({ bezeichnung: 'Rückfrage', unterbrechend: false, anteil: 0.5, schritte: [aufgabe('Rückfrage klären', 5, BUERO)] })
    const ware = { ...aufgabe('Ware packen', 10, LAGER), unterbrechungen: [neben] }
    const { p, par } = zweigBricht()
    const q = { ...p, ablauf: { ...p.ablauf, schritte: [{ ...par, zweige: [par.zweige[0], { ...par.zweige[1], schritte: [ware] }] }, ...p.ablauf.schritte.slice(1)] } }
    const imZweig = beschreibeCursor(q, { sequenzId: par.zweige[0].id, index: 1 })
    expect(imZweig.inParallele).toBe(true)
    expect(imZweig.imNebenweg).toBe(false)
    const imNebenweg = beschreibeCursor(q, { sequenzId: neben.id, index: 1 })
    expect(imNebenweg.imNebenweg).toBe(true)
    expect(beschreibeCursor(q, { sequenzId: 'haupt', index: 1 }).inParallele).toBe(false)
    expect(nebenlaeufig(findeBlock(q, ware.id)!.kette)).toBe(true)
    expect(unterbrechungVon(ware, neben.id)?.unterbrechend).toBe(false)
  })

  it('kennt ODER-Verzweigungen, die nur ohne einen Weg weitergehen', () => {
    const immer = neueEntscheidung({ frage: 'Wie?', zweige: [neuerZweig('a', 0.5, { ende: 'x' }), neuerZweig('b', 0.5, { ende: 'y' })] })
    const oder = (pa: number) => neueOder({ frage: 'Was?', standard: null, zweige: [neuerOderZweig('A', pa, { schritte: [aufgabe('A', 5), immer] }), neuerOderZweig('B', 0.6, { schritte: [aufgabe('B', 5)] })] })
    // A läuft nicht immer: Es geht weiter, wenn nur B gewählt ist
    expect(ausgaengeBlock(oder(0.7)).has('weiter')).toBe(true)
    // A läuft immer und endet immer: Es geht nie weiter
    expect(ausgaengeBlock(oder(1)).has('weiter')).toBe(false)
    expect(fehler(prozess([oder(1), aufgabe('Danach', 5)]))).toEqual(['unerreichbar'])
    // Gleichzeitig mit einem Zweig, der immer endet: Es geht nie weiter
    expect(ausgaengeBlock(gleichzeitig('alle', [aufgabe('A', 5), immer], [aufgabe('B', 5)])).has('weiter')).toBe(false)
  })

  it('weist auf abgebrochene Arbeit in gleichzeitig laufenden Zweigen hin', () => {
    const { p, par } = zweigBricht()
    const befund = findeSchwachstellen(p, berechneKennzahlen(p)).find((b) => b.schluessel === `abbruchzweig:${par.id}`)
    expect(befund?.titel).toBe('Arbeit in gleichzeitig laufenden Zweigen wird oft umsonst getan')
    expect(befund?.text).toContain('30 %')
    // selten: kein Hinweis
    const selten = prozess([gleichzeitig('alle', [aufgabe('A', 10), endetMit('x', 0.05)], [aufgabe('B', 60)])])
    expect(findeSchwachstellen(selten, berechneKennzahlen(selten)).some((b) => b.schluessel.startsWith('abbruchzweig:'))).toBe(false)
  })
})

describe('Abbruch: BPMN und Tokenspiel', () => {
  function kinder(e: ModdleElement): ModdleElement[] {
    return (e.flowElements ?? []) as ModdleElement[]
  }
  type MitDefinition = ModdleElement & { eventDefinitions?: { $type: string }[]; name?: string; attachedToRef?: { id: string } }

  it('exportiert auf der Prozessebene eine Terminierung mit dem Ergebnis, im Rahmen ein Fehler-Ende mit Terminierung hinter dem Randereignis', async () => {
    const { p } = zweigBricht()
    const tp = neuerTeilprozess({ name: 'Unterlagen prüfen', koerper: neueSequenz([aufgabe('Unterlagen sichten', 10), endetMit('unvollständig', 0.1)]) })
    const q = prozess([gleichzeitig('alle', [...(p.ablauf.schritte[0] as Parallel).zweige[0].schritte], [tp]), ...p.ablauf.schritte.slice(1)])
    const { xml, layout } = erzeugeBpmn(q)
    expect(geometrieFehler(layout)).toEqual([])
    const { rootElement, warnings } = await BpmnModdle().fromXML(xml)
    expect(warnings).toEqual([])
    const prozessElement = (rootElement.rootElements ?? []).find((e) => e.$type === 'bpmn:Process')!
    const enden = kinder(prozessElement).filter((e) => e.$type === 'bpmn:EndEvent') as MitDefinition[]
    const art = (name: string) => enden.filter((e) => e.name === name).map((e) => e.eventDefinitions?.[0]?.$type ?? 'normal')
    expect(art('abgelehnt')).toEqual(['bpmn:TerminateEventDefinition'])
    expect(art('unvollständig')).toEqual(['bpmn:TerminateEventDefinition'])
    expect(art('Fertig')).toEqual(['normal'])
    // im Abschnitt das Fehler-Ende, am Abschnitt das Fehler-Randereignis
    const rahmen = kinder(prozessElement).find((e) => e.id === tp.id)!
    expect(kinder(rahmen).filter((e) => e.$type === 'bpmn:EndEvent').map((e) => (e as MitDefinition).eventDefinitions?.[0]?.$type ?? 'normal').sort()).toEqual(['bpmn:ErrorEventDefinition', 'normal'])
    expect((kinder(prozessElement).find((e) => e.$type === 'bpmn:BoundaryEvent') as MitDefinition).attachedToRef?.id).toBe(tp.id)
    expect(xml).toContain('Beendet den ganzen Vorgang mit diesem Ergebnis; was gleichzeitig läuft, wird abgebrochen')
  })

  it('lässt Gleichzeitig ohne Zusammenführung, wenn ein Zweig immer endet', async () => {
    const immer = neueEntscheidung({ frage: 'Wie?', zweige: [neuerZweig('a', 0.5, { ende: 'x' }), neuerZweig('b', 0.5, { ende: 'y' })] })
    const b = aufgabe('B erledigen', 60, BUERO)
    const p = prozess([gleichzeitig('alle', [aufgabe('A erledigen', 10), immer], [b])])
    expect(pruefeProzess(p).filter((x) => x.schwere === 'fehler')).toEqual([])
    const { layout, xml } = erzeugeBpmn(p)
    expect(geometrieFehler(layout)).toEqual([])
    // keine Zusammenführung, kein Ende „Fertig“; B endet für sich
    expect(layout.knoten.some((k) => k.art === 'und' && k.richtung === 'zu')).toBe(false)
    expect(layout.knoten.some((k) => k.name === 'Fertig')).toBe(false)
    expect(layout.knoten.filter((k) => k.art === 'ende' && k.name === '' && !k.terminierung)).toHaveLength(1)
    const k = berechneKennzahlen(p)
    expect(ende(k, 'Fertig')).toBe(0)
    expect(ende(k, 'x')).toBeCloseTo(0.5, 12)
    // Abbruch nach 10, B zählt voll
    expect(k.durchlaufzeitMin).toBeCloseTo(10, 9)
    expect(k.schritte.get(b.id)?.haeufigkeit).toBeCloseTo(1, 12)
    expect(pruefeSoundness(graphAusLayout(layout)).fehler).toEqual([])
    expect(pruefeSoundness(await graphAusXml(xml)).fehler).toEqual([])
    expect(tokenAbweichungen(p, 5_000, 3)).toEqual([])
  })

  it('wartet in der Zählung an der ODER-Zusammenführung nicht auf einen Weg, der den Vorgang beendet', async () => {
    // Weg A endet immer: Die Zusammenführung hat nur einen Eingang, weiter geht es nur ohne A
    const immer = neueEntscheidung({ frage: 'Wie?', zweige: [neuerZweig('a', 0.5, { schritte: [aufgabe('Absage schreiben', 20)], ende: 'x' }), neuerZweig('b', 0.5, { ende: 'y' })] })
    const danach = aufgabe('Danach erledigen', 5, BUERO)
    const oder = neueOder({ frage: 'Was?', standard: null, zweige: [neuerOderZweig('A', 0.7, { schritte: [aufgabe('A erledigen', 5), immer] }), neuerOderZweig('B', 0.6, { schritte: [aufgabe('B erledigen', 5, BUERO)] })] })
    const p = prozess([oder, danach])
    expect(pruefeProzess(p).filter((x) => x.schwere === 'fehler')).toEqual([])
    const k = berechneKennzahlen(p)
    // nur B: 0,3
    expect(k.schritte.get(danach.id)?.haeufigkeit).toBeCloseTo(0.3, 9)
    const { layout, xml } = erzeugeBpmn(p)
    const zu = layout.knoten.find((x) => x.art === 'oder' && x.richtung === 'zu')!
    expect(layout.kanten.filter((x) => x.nach === zu.id)).toHaveLength(1)
    expect(pruefeSoundness(graphAusLayout(layout)).fehler).toEqual([])
    expect(pruefeSoundness(await graphAusXml(xml)).fehler).toEqual([])
    expect(tokenAbweichungen(p, 10_000, 4)).toEqual([])
  })

  it('ist im Tokenspiel sound, auf dem Layout und auf dem gelesenen XML, und zählt dieselben Häufigkeiten und Ergebnisse', async () => {
    const beispiele = [zweigBricht().p, gleichstand().p, oderOhneStandard().p, oderMitStandard().p, stuecke(5).p, ersterMitEnde().p]
    for (const [i, p] of beispiele.entries()) {
      const { layout, xml } = erzeugeBpmn(p)
      expect(geometrieFehler(layout)).toEqual([])
      expect(pruefeSoundness(graphAusLayout(layout)).fehler).toEqual([])
      expect(pruefeSoundness(await graphAusXml(xml)).fehler).toEqual([])
      expect(tokenAbweichungen(p, 20_000, 41 + i)).toEqual([])
    }
  }, 60_000)
})

describe('Abbruch in Zufallsprozessen', () => {
  /** Enden neben gleichzeitig laufenden Schritten: in Entscheidungen und nach Unterbrechungen */
  function abbrueche(p: Prozess): number {
    let n = 0
    for (const { block, kette } of durchlaufe(p.ablauf)) {
      if (block.typ === 'entscheidung' && nebenlaeufig(kette)) n += block.zweige.filter((z) => z.ende !== null).length
      for (const u of block.typ === 'aufgabe' || block.typ === 'teilprozess' || block.typ === 'mehrfach' ? (block.unterbrechungen ?? []) : []) if (u.unterbrechend && u.ende !== null && nebenlaeufig(kette)) n++
      // Enden im Körper von Stücken zur selben Zeit
      if (block.typ === 'mehrfach' && block.ausfuehrung === 'gleichzeitig') for (const { block: x } of durchlaufe(block.koerper)) if (x.typ === 'entscheidung' && x.zweige.some((z) => z.ende !== null)) n++
    }
    return n
  }

  it('erzeugt Abbrüche in nebenläufiger Umgebung und legt sie nach den Zeichenregeln, ohne Prüffehler', () => {
    let mitAbbruch = 0
    let terminierungen = 0
    const fehler: string[] = []
    for (let s = 1; s <= 300; s++) {
      const p = zufallsProzess(s)
      if (abbrueche(p) > 0) mitAbbruch++
      const { layout } = erzeugeBpmn(p)
      terminierungen += layout.knoten.filter((k) => k.terminierung && (k.rahmen ?? null) === null).length
      for (const f of geometrieFehler(layout)) fehler.push(`Startwert ${s}: ${f}`)
      for (const b of pruefeProzess(p)) if (b.schwere === 'fehler') fehler.push(`Startwert ${s}: ${b.titel}: ${b.text}`)
    }
    expect(fehler.slice(0, 5)).toEqual([])
    expect(mitAbbruch).toBeGreaterThan(40)
    expect(terminierungen).toBeGreaterThan(40)
  }, 60_000)

  it('stimmt mit Simulation, Verteilung und Tokenspiel überein; sound auf Layout und XML', async () => {
    const abweichungen: string[] = []
    let gezaehlt = 0
    for (let s = 1; s <= 300 && gezaehlt < 40; s++) {
      const p = zufallsProzess(s)
      if (abbrueche(p) === 0) continue
      gezaehlt++
      const k = berechneKennzahlen(p)
      for (const a of simulationAbweichungen(p, 20_000, s)) abweichungen.push(`Startwert ${s}: ${a}`)
      const v = verteilungSequenz(p.ablauf.schritte, 'gesamt')
      const teile = [v.weiter, ...v.ende.values()]
      const gesamt = teile.reduce((x, t) => x + masse(t), 0)
      const mittel = teile.reduce((x, t) => x + erwartung(t) * masse(t), 0)
      if (Math.abs(gesamt - 1) > 1e-5 || Math.abs(mittel - k.durchlaufzeitMin) > 1e-4 * Math.max(1, k.durchlaufzeitMin)) abweichungen.push(`Startwert ${s}: Teilverteilungen Masse ${gesamt}, Mittel ${mittel} statt ${k.durchlaufzeitMin}`)
      if (k.kritischeArbeitMin > k.durchlaufzeitMin + 1e-6) abweichungen.push(`Startwert ${s}: TCT ${k.kritischeArbeitMin} über der Durchlaufzeit ${k.durchlaufzeitMin}`)
      const summeEnden = k.enden.reduce((x, e) => x + e.anteil, 0)
      if (Math.abs(summeEnden - 1) > 1e-6) abweichungen.push(`Startwert ${s}: Enden ergeben ${summeEnden}`)
      for (const a of tokenAbweichungen(p, 3_000, s)) abweichungen.push(`Startwert ${s}: ${a}`)
      const { layout, xml } = erzeugeBpmn(p)
      for (const [name, graph] of [['Layout', graphAusLayout(layout)], ['XML', await graphAusXml(xml)]] as const) {
        const e = pruefeSoundness(graph, 2_000)
        if (!e.reduziert) for (const f of e.fehler) abweichungen.push(`Startwert ${s} (${name}): ${f}`)
      }
    }
    expect(gezaehlt).toBe(40)
    expect(abweichungen.slice(0, 10)).toEqual([])
  }, 240_000)
})
