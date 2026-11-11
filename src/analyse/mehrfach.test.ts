/**
 * Für jedes Stück einer Liste (Mehrfachinstanz): Anzahl, Rechnung, Prüfregeln,
 * Operationen, Führung, Layout, BPMN-Export und Tokenspiel, mit von Hand
 * nachgerechneten Werten (Design: docs/modellierung-v4.md, Abschnitt 2).
 */
import { BpmnModdle, type ModdleElement } from 'bpmn-moddle'
import { describe, expect, it } from 'vitest'
import { erzeugeBpmn } from '../bpmn/export'
import { RAHMEN } from '../bpmn/layout'
import { graphAusLayout, pruefeSoundness, zaehleMitFehler, type TokenGraph } from '../bpmn/tokenspiel'
import { anzahlVerteilung, erwartungLaeufe, erwartungPotenz, mindestens, wahrscheinlichkeit, zieheAnzahl } from '../modell/anzahl'
import { neueAufgabe, neueEntscheidung, neuerMehrfach, neuerProzess, neueRolle, neuerRuecksprungBereich, neuerZweig, neueSequenz, neueWiederholung, neueParallel } from '../modell/bausteine'
import { abschnittFertig, beschreibeCursor, cursorNachEinfuegen } from '../modell/fuehrung'
import { beidesAlsOder, durchlaufe, findeBlock, istMengenschleife, kinderSequenzen, mengenschleifeAlsMehrfach, nebenlaeufig, oderZiehung, rahmenUeber, ruecksprungZiele, setzeRuecksprung, wirktExtern } from '../modell/operationen'
import { pruefeProzess } from '../modell/pruefung'
import { alsJson, leseProjekt } from '../modell/speicher'
import type { Aufgabe, Block, Mehrfach, Prozess, Rolle } from '../modell/typen'
import { graphAusXml } from '../testhilfen/bpmn-graph'
import { geometrieFehler } from '../testhilfen/geometrie'
import { standardfehler } from '../testhilfen/statistik'
import { zufallsProzess } from '../testhilfen/zufallsprozess'
import { findeSchwachstellen } from './hinweise'
import { berechneKennzahlen } from './kennzahlen'
import { simuliere, zufallMitStartwert } from './simulation'
import { erwartung, erwartungGesamt, masse, verteilungSequenz, type Verteilung } from './verteilung'

const LAGER = neueRolle('Lager', { personen: 1 })
const BUERO = neueRolle('Büro')
const BUCHHALTUNG = neueRolle('Buchhaltung')

function aufgabe(name: string, minuten: number, rolle: Rolle = LAGER, liegezeitMin = 0): Aufgabe {
  return neueAufgabe({ name, bearbeitungMin: minuten, liegezeitMin, rolleId: rolle.id })
}

function prozess(schritte: Block[]): Prozess {
  return neuerProzess({ name: 'Test', ergebnis: 'Fertig', rollen: [LAGER, BUERO, BUCHHALTUNG], ablauf: { id: 'haupt', schritte } })
}

/** Körper: eine Aufgabe von 10 Min.; 2,5 Stücke im Schnitt (fest), Liegezeit 60 Min. vor dem ersten */
function positionen(ausfuehrung: Mehrfach['ausfuehrung'] = 'nacheinander') {
  const a = aufgabe('Position kommissionieren', 10)
  const m = neuerMehrfach({ name: 'Für jede Position', anzahl: 2.5, streuung: 'fest', ausfuehrung, liegezeitMin: 60, koerper: neueSequenz([a]) })
  return { p: prozess([m]), m, a }
}

/** Körper: Entscheidung 50 % A 10 Min. / 50 % B 30 Min.; zwei Stücke, gleichzeitig, ohne Liegezeit */
function zweiAntworten() {
  const a = aufgabe('Angebot A prüfen', 10)
  const b = aufgabe('Angebot B prüfen', 30)
  const e = neueEntscheidung({ frage: 'Welches Angebot?', zweige: [neuerZweig('A', 0.5, { schritte: [a] }), neuerZweig('B', 0.5, { schritte: [b] })] })
  const m = neuerMehrfach({ name: 'Für jeden Lieferanten', anzahl: 2, streuung: 'fest', ausfuehrung: 'gleichzeitig', koerper: neueSequenz([e]) })
  return { p: prozess([m]), m, a, b }
}

/** Körper: Aufgabe 10 Min., dann 5 % endet „abgebrochen“; zwei Stücke nacheinander; danach eine Aufgabe von 10 Min. */
function mitEnde() {
  const a = aufgabe('Position prüfen', 10)
  const e = neueEntscheidung({ frage: 'Weiter?', zweige: [neuerZweig('Ja', 0.95), neuerZweig('Nein', 0.05, { ende: 'abgebrochen' })] })
  const m = neuerMehrfach({ name: 'Für jede Position', anzahl: 2, streuung: 'fest', ausfuehrung: 'nacheinander', koerper: neueSequenz([a, e]) })
  const x = aufgabe('Auftrag abschließen', 10, BUERO)
  return { p: prozess([m, x]), m, a, x }
}

function anteile(layout: ReturnType<typeof erzeugeBpmn>['layout']): Map<string, number> {
  return new Map(layout.kanten.filter((k) => k.anteil !== undefined).map((k) => [k.id, k.anteil!]))
}

/** Vergleichbare Form eines Graphen, mit der Art der Mehrfachinstanz */
function form(g: TokenGraph): string[] {
  const quelle = new Map<string, string>()
  for (const k of g.knoten) for (const f of k.raus) quelle.set(f, k.id)
  const knoten = g.knoten.map((k) => [k.id, k.typ, k.rahmen ?? '', k.endeArt ?? '', k.fehler ?? '', k.wirt ?? '', k.randArt ?? '', k.unterbrechend ?? '', k.mehrfach ? (k.mehrfach.nacheinander ? 'nacheinander' : 'gleichzeitig') : ''].join(':'))
  return [...knoten, ...[...g.ziel].map(([f, z]) => `${quelle.get(f)}->${z}`)].sort()
}

function kinder(e: ModdleElement): ModdleElement[] {
  return (e.flowElements ?? []) as ModdleElement[]
}

type MitSchleife = ModdleElement & { loopCharacteristics?: { $type: string; isSequential: boolean; loopCardinality?: { body: string } } }

/** Häufigkeiten aus dem Tokenspiel gegen die Formeln, Toleranz aus dem Standardfehler */
function tokenAbweichungen(p: Prozess, laeufe: number, startwert: number): string[] {
  const { layout } = erzeugeBpmn(p)
  const k = berechneKennzahlen(p)
  const gezaehlt = zaehleMitFehler(graphAusLayout(layout), anteile(layout), laeufe, zufallMitStartwert(startwert))
  const abweichungen: string[] = []
  for (const { block } of durchlaufe(p.ablauf)) {
    if (block.typ !== 'aufgabe') continue
    const formel = k.schritte.get(block.id)?.haeufigkeit ?? 0
    const x = gezaehlt.get(block.id) ?? { mittel: 0, fehler: 0 }
    if (Math.abs(formel - x.mittel) > 4 * x.fehler + 0.01) abweichungen.push(`${block.name}: Formel ${formel.toFixed(3)}, Tokenspiel ${x.mittel.toFixed(3)} ± ${x.fehler.toFixed(3)}`)
  }
  return abweichungen
}

/** Quantil einer Verteilung mit Masse 1 */
function quantil(v: Verteilung, q: number): number {
  let summe = 0
  for (let i = 0; i < v.wert.length; i++) {
    summe += v.masse[i]
    if (summe >= q - 1e-12) return v.wert[i]
  }
  return v.wert[v.wert.length - 1]
}

describe('Anzahl der Stücke', () => {
  it('zieht „fest“ mit kleinster Streuung um das Mittel', () => {
    const v = anzahlVerteilung(2.5, 'fest')
    expect([wahrscheinlichkeit(v, 2), wahrscheinlichkeit(v, 3), wahrscheinlichkeit(v, 4)]).toEqual([0.5, 0.5, 0])
    expect(mindestens(v, 3)).toBe(0.5)
    // E[c^N] = 0,5 · 0,9² + 0,5 · 0,9³ = 0,405 + 0,3645
    expect(erwartungPotenz(v, 0.9)).toBeCloseTo(0.7695, 12)
    // E[(1 − c^N)/(1 − c)] = 0,5 · (1 + 0,9) + 0,5 · (1 + 0,9 + 0,81)
    expect(erwartungLaeufe(v, 0.9)).toBeCloseTo(2.305, 12)
    expect(erwartungLaeufe(v, 1)).toBeCloseTo(2.5, 12)
    const ganz = anzahlVerteilung(3, 'fest')
    expect(wahrscheinlichkeit(ganz, 3)).toBe(1)
    expect(wahrscheinlichkeit(anzahlVerteilung(0.4, 'fest'), 0)).toBeCloseTo(0.6, 12)
  })

  it('zieht „schwankt“ geometrisch ab 1 wie die Durchläufe einer Wiederholung', () => {
    const v = anzahlVerteilung(2.5, 'schwankt')
    // p = 1 − 1/2,5 = 0,6: P(N = 1) = 0,4, P(N = 2) = 0,24, P(N ≥ 3) = 0,36
    expect(v.p).toBeCloseTo(0.6, 12)
    expect(wahrscheinlichkeit(v, 1)).toBeCloseTo(0.4, 12)
    expect(wahrscheinlichkeit(v, 2)).toBeCloseTo(0.24, 12)
    expect(mindestens(v, 3)).toBeCloseTo(0.36, 12)
    // E[c^N] = 0,4 · c / (1 − 0,6 c), K = 1 / (1 − 0,6 c)
    expect(erwartungPotenz(v, 0.5)).toBeCloseTo(0.2 / 0.7, 12)
    expect(erwartungLaeufe(v, 0.5)).toBeCloseTo(1 / 0.7, 12)
    // gezogen im Mittel 2,5
    const zufall = zufallMitStartwert(4)
    const werte = Float64Array.from({ length: 40_000 }, () => zieheAnzahl(v, zufall))
    const mittel = werte.reduce((s, x) => s + x, 0) / werte.length
    expect(Math.abs(mittel - 2.5)).toBeLessThan(4 * standardfehler(werte))
  })
})

describe('Für jedes Stück: Rechnung', () => {
  it('rechnet nacheinander mit Liegezeit einmal: 60 + 2,5 · 10 = 85 Min.', () => {
    const { p, a, m } = positionen()
    const k = berechneKennzahlen(p)
    expect(k.schritte.get(a.id)?.haeufigkeit).toBeCloseTo(2.5, 12)
    expect(k.durchlaufzeitMin).toBeCloseTo(85, 9)
    expect(k.arbeitszeitMin).toBeCloseTo(25, 9)
    // TCT ohne die Liegezeit
    expect(k.kritischeArbeitMin).toBeCloseTo(25, 9)
    // der Baustein hat einen Eintrag mit seiner Liegezeit
    expect(k.schritte.get(m.id)?.beitragWartenMin).toBeCloseTo(60, 9)
    // Verteilung: N = 2 → 80 Min., N = 3 → 90 Min., je 50 %
    const v = verteilungSequenz(p.ablauf.schritte, 'gesamt')
    expect(v.weiter.wert).toEqual([80, 90])
    expect(v.weiter.masse.map((x) => Math.round(x * 1e9) / 1e9)).toEqual([0.5, 0.5])
  })

  it('rechnet gleichzeitig mit dem spätesten Stück: 60 + 10 = 70 Min.', () => {
    const { p, a } = positionen('gleichzeitig')
    const k = berechneKennzahlen(p)
    expect(k.schritte.get(a.id)?.haeufigkeit).toBeCloseTo(2.5, 12)
    expect(k.durchlaufzeitMin).toBeCloseTo(70, 9)
    expect(k.arbeitszeitMin).toBeCloseTo(25, 9)
    expect(k.kritischeArbeitMin).toBeCloseTo(10, 9)
  })

  it('nimmt gleichzeitig das Maximum der Stücke: 0,25 · 10 + 0,75 · 30 = 25 Min.', () => {
    const { p, a, b } = zweiAntworten()
    const k = berechneKennzahlen(p)
    expect(k.durchlaufzeitMin).toBeCloseTo(25, 9)
    // je Stück 50 %, zwei Stücke: jede Aufgabe einmal je Vorgang
    expect(k.schritte.get(a.id)?.haeufigkeit).toBeCloseTo(1, 12)
    expect(k.schritte.get(b.id)?.haeufigkeit).toBeCloseTo(1, 12)
    const v = verteilungSequenz(p.ablauf.schritte, 'gesamt')
    // P(max = 10) = 0,5² = 0,25
    expect(v.weiter.wert).toEqual([10, 30])
    expect(v.weiter.masse[0]).toBeCloseTo(0.25, 12)
    expect(v.weiter.masse[1]).toBeCloseTo(0.75, 12)
  })

  it('läuft bei weniger als einem Stück nur in einem Teil der Vorgänge: 0,4 · (30 + 10) = 16 Min.', () => {
    const a = aufgabe('Position kommissionieren', 10)
    const m = neuerMehrfach({ name: 'Für jede Position', anzahl: 0.4, liegezeitMin: 30, koerper: neueSequenz([a]) })
    const p = prozess([m])
    const k = berechneKennzahlen(p)
    expect(k.durchlaufzeitMin).toBeCloseTo(16, 9)
    expect(k.schritte.get(a.id)?.haeufigkeit).toBeCloseTo(0.4, 12)
    const hinweis = pruefeProzess(p).find((b) => b.schluessel === `selten:${m.id}`)
    expect(hinweis?.schwere).toBe('hinweis')
    expect(hinweis?.text).toContain('in 60 % der Vorgänge gar nicht')
  })

  it('beendet nacheinander die Reihe bei einem Ende: K = 1,95, weiter 0,9025, Dauer 19,5 Min.', () => {
    const { p, a, x, m } = mitEnde()
    const k = berechneKennzahlen(p)
    // K = (1 − 0,95²) / (1 − 0,95) = 1,95 Durchläufe
    expect(k.schritte.get(a.id)?.haeufigkeit).toBeCloseTo(1.95, 12)
    expect(k.schritte.get(x.id)?.haeufigkeit).toBeCloseTo(0.9025, 12)
    expect(k.enden.find((e) => e.ergebnis === 'abgebrochen')?.anteil).toBeCloseTo(0.0975, 12)
    // 1,95 · 10 = 19,5 für die Stücke, dazu 0,9025 · 10 danach
    expect(k.durchlaufzeitMin).toBeCloseTo(19.5 + 9.025, 9)
    // Teilverteilungen des Bausteins: weiter 0,9025 bei 20 Min.; Ende nach dem ersten Stück 0,05 bei 10, nach dem zweiten 0,0475 bei 20
    const v = verteilungSequenz([m], 'gesamt')
    expect(v.weiter.wert).toEqual([20])
    expect(masse(v.weiter)).toBeCloseTo(0.9025, 12)
    const ende = v.ende.get('abgebrochen')!
    expect(ende.wert).toEqual([10, 20])
    expect(ende.masse[0]).toBeCloseTo(0.05, 12)
    expect(ende.masse[1]).toBeCloseTo(0.0475, 12)
    expect(erwartungGesamt(v)).toBeCloseTo(19.5, 9)
  })

  it('zählt Übergaben: ein Strang hinein und heraus, nacheinander dazu vom letzten zum ersten Schritt', () => {
    const vor = aufgabe('Auftrag erfassen', 5, BUERO)
    const y = aufgabe('Position kommissionieren', 5, LAGER)
    const z = aufgabe('Position buchen', 5, BUCHHALTUNG)
    const nach = aufgabe('Auftrag abschließen', 5, BUERO)
    const m = neuerMehrfach({ name: 'Für jede Position', anzahl: 2, koerper: neueSequenz([y, z]) })
    // Büro → Lager 1, Lager → Buchhaltung 2, Buchhaltung → Lager 1 (zwischen den Stücken), Buchhaltung → Büro 1
    const k = berechneKennzahlen(prozess([vor, m, nach]))
    expect(k.uebergaben).toBeCloseTo(5, 12)
    expect(k.paare.get(`${z.id}>${y.id}`)).toBeCloseTo(1, 12)
    // gleichzeitig: kein Übergang zwischen den Stücken, ein Strang hinein und heraus
    const g = berechneKennzahlen(prozess([vor, { ...m, ausfuehrung: 'gleichzeitig' }, nach]))
    expect(g.uebergaben).toBeCloseTo(4, 12)
    // 0,5 Stücke: in der Hälfte der Vorgänge geht es direkt von Büro zu Büro
    const halb = berechneKennzahlen(prozess([vor, { ...m, anzahl: 0.5 }, nach]))
    expect(halb.uebergaben).toBeCloseTo(1.5, 12)
    expect(halb.paare.get(`${vor.id}>${nach.id}`)).toBeCloseTo(0.5, 12)
  })

  it('stimmt mit der Simulation überein', () => {
    for (const { p } of [positionen(), positionen('gleichzeitig'), zweiAntworten(), mitEnde()]) {
      const k = berechneKennzahlen(p)
      const sim = simuliere(p, 40_000, 5)
      expect(Math.abs(sim.mittelMin - k.durchlaufzeitMin)).toBeLessThan(4 * standardfehler(sim.zeiten) + 0.005 * k.durchlaufzeitMin)
    }
    // je Ergebnis: „abgebrochen“ mit 9,75 % nach im Schnitt (0,05 · 10 + 0,0475 · 20) / 0,0975 Min.
    const sim = simuliere(mitEnde().p, 40_000, 6)
    const ab = sim.ergebnisse.find((e) => e.ergebnis === 'abgebrochen')!
    expect(Math.abs(ab.anteil - 0.0975)).toBeLessThan(0.006)
    expect(Math.abs(ab.mittelMin - (0.05 * 10 + 0.0475 * 20) / 0.0975)).toBeLessThan(0.4)
  })
})

describe('Für jedes Stück: Umwandlungen', () => {
  it('wandelt eine Mengenschleife mit p = 0,6 in 2,5 schwankende Stücke um; alle Zahlen bleiben gleich', () => {
    const a = aufgabe('Position erfassen', 2, LAGER, 5)
    const b = aufgabe('Sonderfall klären', 10, BUERO)
    const sonder = neueEntscheidung({ frage: 'Sonderfall?', zweige: [neuerZweig('Ja', 0.2, { schritte: [b] }), neuerZweig('Nein', 0.8)] })
    const w = neueWiederholung({ frage: 'Weitere Position?', zweck: 'menge', anteilWiederholung: 0.6, koerper: neueSequenz([a, sonder]) })
    const p = prozess([aufgabe('Auftrag erfassen', 5, BUERO), w, aufgabe('Auftrag abschließen', 5, BUERO)])
    expect(istMengenschleife(w)).toBe(true)
    const hinweis = pruefeProzess(p).find((x) => x.schluessel === `alsmehrfach:${w.id}`)
    expect(hinweis?.schwere).toBe('hinweis')
    expect(hinweis?.umwandlung?.knopf).toBe('Umwandeln')

    const q = hinweis!.umwandlung!.anwenden(p)
    const m = q.ablauf.schritte[1]
    expect(m).toMatchObject({ typ: 'mehrfach', id: w.id, name: 'Weitere Position', streuung: 'schwankt', ausfuehrung: 'nacheinander', liegezeitMin: 0 })
    expect(m.typ === 'mehrfach' && m.anzahl).toBeCloseTo(2.5, 12)
    expect(pruefeProzess(q).some((x) => x.schluessel.startsWith('alsmehrfach'))).toBe(false)

    const vorher = berechneKennzahlen(p)
    const nachher = berechneKennzahlen(q)
    for (const feld of ['durchlaufzeitMin', 'kritischeArbeitMin', 'arbeitszeitMin', 'kostenProVorgang', 'uebergaben', 'systemwechsel'] as const) expect(nachher[feld]).toBeCloseTo(vorher[feld], 9)
    for (const [id, s] of vorher.schritte) if (s.haeufigkeit > 0 && id !== w.id) expect(nachher.schritte.get(id)?.haeufigkeit).toBeCloseTo(s.haeufigkeit, 12)
    for (const [paar, x] of vorher.paare) expect(nachher.paare.get(paar)).toBeCloseTo(x, 12)
    // dieselbe Verteilung der Durchlaufzeit, also auch derselbe exakte 90-%-Wert
    const vv = verteilungSequenz(p.ablauf.schritte, 'gesamt').weiter
    const vn = verteilungSequenz(q.ablauf.schritte, 'gesamt').weiter
    expect(vn.wert).toEqual(vv.wert)
    vn.masse.forEach((x, i) => expect(x).toBeCloseTo(vv.masse[i], 12))
    // 90-%-Wert der Simulation: bei beiden innerhalb der statistischen Toleranz um den exakten Wert
    const n = 40_000
    const d = 4 * Math.sqrt((0.9 * 0.1) / n)
    const unten = quantil(vv, 0.9 - d)
    const oben = quantil(vv, 0.9 + d)
    for (const x of [p, q]) {
      const sim = simuliere(x, n, 9)
      expect(sim.p90Min).toBeGreaterThanOrEqual(unten)
      expect(sim.p90Min).toBeLessThanOrEqual(oben)
    }
  })

  it('bietet die Umwandlung nur für Mengenschleifen ohne Ausstieg aus dem Körper an', () => {
    const korrektur = neueWiederholung({ frage: 'Nacharbeit nötig?', anteilWiederholung: 0.2, koerper: neueSequenz([aufgabe('Teil fertigen', 5)]) })
    const ende = neueEntscheidung({ frage: 'Storniert?', zweige: [neuerZweig('Nein', 0.9), neuerZweig('Ja', 0.1, { ende: 'storniert' })] })
    const mitAusstieg = neueWiederholung({ frage: 'Weitere Position?', zweck: 'menge', anteilWiederholung: 0.5, koerper: neueSequenz([aufgabe('Position erfassen', 2), ende]) })
    for (const w of [korrektur, mitAusstieg]) {
      expect(istMengenschleife(w)).toBe(false)
      const p = prozess([w])
      expect(pruefeProzess(p).some((x) => x.schluessel.startsWith('alsmehrfach'))).toBe(false)
      expect(mengenschleifeAlsMehrfach(p, w.id)).toBe(p)
    }
  })

  it('bildet „A / B / beides“ als ODER ab; die Kombinationen bleiben genau gleich', () => {
    const a = aufgabe('Ausweis anfordern', 5, BUERO)
    const b = aufgabe('Nachweis anfordern', 5, BUERO)
    const e = neueEntscheidung({
      frage: 'Was fehlt?',
      zweige: [neuerZweig('Ausweis', 0.5, { schritte: [a] }), neuerZweig('Nachweis', 0.3, { schritte: [b] }), neuerZweig('beides', 0.2, { schritte: [aufgabe('Beides anfordern', 5, BUERO)] })],
    })
    const p = prozess([e])
    const hinweis = pruefeProzess(p).find((x) => x.schluessel === `alsoder:${e.id}`)!
    expect(hinweis.schwere).toBe('hinweis')
    expect(hinweis.text).toContain('„Ausweis“ (dann 70 %) und „Nachweis“ (dann 50 %)')
    expect(hinweis.umwandlung?.rueckfrage).toContain('„beides“')
    const q = beidesAlsOder(p, e.id)
    const o = q.ablauf.schritte[0]
    expect(o.typ).toBe('oder')
    if (o.typ !== 'oder') return
    expect(o.standard).toBeNull()
    expect(o.zweige.map((z) => [z.bezeichnung, Math.round(z.anteil * 100)])).toEqual([
      ['Ausweis', 70],
      ['Nachweis', 50],
    ])
    // zwei Wege „mindestens einer“: beide laufen mit 0,7 + 0,5 − 1 = 0,2, nur Ausweis 0,5, nur Nachweis 0,3
    const z = oderZiehung(o)
    const beide = (z.r[0] * z.r[1]) / z.z
    expect(beide).toBeCloseTo(0.2, 6)
    expect(z.r[0] / z.z - beide).toBeCloseTo(0.5, 6)
    expect(berechneKennzahlen(q).schritte.get(a.id)?.haeufigkeit).toBeCloseTo(0.7, 6)
    expect(pruefeProzess(q).filter((x) => x.schwere === 'fehler')).toEqual([])
    // vier Ausgänge oder ein Ende: nur der Hinweis, keine Umwandlung
    const vier = neueEntscheidung({ frage: 'Was fehlt?', zweige: [...e.zweige, neuerZweig('nichts', 0)] })
    expect(pruefeProzess(prozess([vier])).find((x) => x.schluessel === `alsoder:${vier.id}`)?.umwandlung).toBeUndefined()
  })

  it('schlägt vor, Rollen wie „Kunde“ als externe Beteiligte zu führen', () => {
    expect(['Kunde', 'Kundin', 'Lieferant', 'Hausbank', 'Bank', 'Behörde', 'Kunden'].map(wirktExtern)).toEqual([true, true, true, false, true, true, true])
    expect(['Kundendienst', 'Lager', 'Bankett'].map(wirktExtern)).toEqual([false, false, false])
    const kunde = neueRolle('Kunde')
    const p = { ...prozess([neueAufgabe({ name: 'Unterlagen schicken', rolleId: kunde.id })]), rollen: [kunde] }
    const b = pruefeProzess(p).find((x) => x.schluessel === `alsextern:${kunde.id}`)
    expect(b).toMatchObject({ schwere: 'hinweis', oeffne: 'beteiligte', rolleId: kunde.id })
  })
})

describe('Für jedes Stück: BPMN', () => {
  it('setzt die Markierung an eine einzelne Aufgabe; die Anzahl nur, wenn sie fest und ganzzahlig ist', async () => {
    const { p, a, m } = positionen()
    const { xml, layout, blockZuElementen } = erzeugeBpmn(p)
    const { rootElement, warnings } = await BpmnModdle().fromXML(xml)
    expect(warnings).toEqual([])
    const prozessElement = (rootElement.rootElements ?? []).find((e) => e.$type === 'bpmn:Process')!
    const task = kinder(prozessElement).find((e) => e.id === a.id) as MitSchleife
    expect(task.loopCharacteristics?.$type).toBe('bpmn:MultiInstanceLoopCharacteristics')
    expect(task.loopCharacteristics?.isSequential).toBe(true)
    // 2,5 ist keine gültige Anzahl: Sie steht nur in der Dokumentation
    expect(task.loopCharacteristics?.loopCardinality).toBeUndefined()
    expect(xml).toContain('Für jede Position: im Schnitt 2,5 Stück je Vorgang, immer etwa gleich viele, der Reihe nach; Liegezeit vor dem ersten Stück 1 Std.')
    expect(layout.rahmen).toEqual([])
    expect(blockZuElementen.get(m.id)).toEqual([a.id])
    // drei Stücke, fest, gleichzeitig: loopCardinality 3
    const drei = erzeugeBpmn(prozess([{ ...m, anzahl: 3, ausfuehrung: 'gleichzeitig' }])).xml
    expect(drei).toContain('<bpmn:multiInstanceLoopCharacteristics isSequential="false">')
    expect(drei).toContain('<bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">3</bpmn:loopCardinality>')
    const schwankt = erzeugeBpmn(prozess([{ ...m, anzahl: 3, streuung: 'schwankt' }])).xml
    expect(schwankt).not.toContain('loopCardinality')
  })

  it('zeichnet sonst einen Rahmen mit Markierung; ein Ende darin fängt ein Fehler-Randereignis am Rahmen', async () => {
    const { p, m } = mitEnde()
    const { xml, layout } = erzeugeBpmn(p)
    expect(geometrieFehler(layout)).toEqual([])
    const r = layout.rahmen.find((x) => x.blockId === m.id)!
    expect(r).toMatchObject({ art: 'mehrfach', name: 'Für jede Position', mehrfach: { nacheinander: true, anzahl: 2, streuung: 'fest' } })
    const rand = layout.knoten.filter((k) => k.art === 'rand')
    expect(rand.map((k) => k.wirt)).toEqual([r.id])
    // die Mitte der Unterkante bleibt für die Markierung frei
    expect(rand[0].x).toBeGreaterThan(r.x + r.breite / 2 + RAHMEN.markeHalb)
    const { rootElement, warnings } = await BpmnModdle().fromXML(xml)
    expect(warnings).toEqual([])
    const prozessElement = (rootElement.rootElements ?? []).find((e) => e.$type === 'bpmn:Process')!
    const sub = kinder(prozessElement).find((e) => e.id === m.id) as MitSchleife
    expect(sub.$type).toBe('bpmn:SubProcess')
    expect(sub.loopCharacteristics?.isSequential).toBe(true)
    expect(sub.loopCharacteristics?.loopCardinality?.body).toBe('2')
    expect(xml).toContain(`<bpmndi:BPMNShape id="${m.id}_di" bpmnElement="${m.id}" isExpanded="true">`)
    expect(kinder(sub).filter((e) => e.$type === 'bpmn:EndEvent')).toHaveLength(2)
  })

  it('lässt bei vielen Ergebnissen leere Spalten im Rahmen, damit die Randereignisse neben der Markierung Platz haben', () => {
    const zweige = Array.from({ length: 6 }, (_, i) => neuerZweig(`Fall ${i + 1}`, 0.1, { ende: `Ergebnis ${i + 1}` }))
    const e = neueEntscheidung({ frage: 'Wie geht es aus?', zweige: [neuerZweig('Normal', 0.4), ...zweige] })
    const m = neuerMehrfach({ name: 'Für jede Position', anzahl: 2, koerper: neueSequenz([aufgabe('Position prüfen', 5), e]) })
    const { layout } = erzeugeBpmn(prozess([m]))
    expect(layout.knoten.filter((k) => k.art === 'rand')).toHaveLength(6)
    expect(geometrieFehler(layout)).toEqual([])
  })

  it('ist im Tokenspiel sound, auf dem Layout und auf dem gelesenen XML, und zählt dieselben Häufigkeiten', async () => {
    for (const { p } of [positionen(), positionen('gleichzeitig'), zweiAntworten(), mitEnde()]) {
      const { layout, xml } = erzeugeBpmn(p)
      const g = graphAusLayout(layout)
      const x = await graphAusXml(xml)
      expect(form(x)).toEqual(form(g))
      expect(pruefeSoundness(g).fehler).toEqual([])
      expect(pruefeSoundness(x).fehler).toEqual([])
      expect(tokenAbweichungen(p, 20_000, 3)).toEqual([])
    }
  })

  it('meldet im Tokenspiel einen Baustein, der nie läuft, und einen, der nie weiterkommt', () => {
    // 0 Stücke: Die Aufgabe läuft nie
    const nie = neuerMehrfach({ name: 'Für jede Position', anzahl: 0, koerper: neueSequenz([aufgabe('Position prüfen', 5)]) })
    const p0 = prozess([nie])
    expect(pruefeProzess(p0).map((b) => b.schluessel)).toContain(`nie:${nie.id}`)
    expect(pruefeSoundness(graphAusLayout(erzeugeBpmn(p0).layout)).sound).toBe(false)
    // Jeder Durchlauf endet, und es gibt immer Stücke: Was danach kommt, wird nie erreicht
    const ende = neueEntscheidung({ frage: 'Wie weiter?', zweige: [neuerZweig('A', 0.5, { ende: 'A' }), neuerZweig('B', 0.5, { ende: 'B' })] })
    const immer = neuerMehrfach({ name: 'Für jede Position', anzahl: 2, koerper: neueSequenz([aufgabe('Position prüfen', 5), ende]) })
    const danach = aufgabe('Auftrag abschließen', 5)
    const p1 = prozess([immer, danach])
    expect(pruefeProzess(p1).map((b) => b.schluessel)).toContain(`unerreichbar:${immer.id}`)
    expect(pruefeSoundness(graphAusLayout(erzeugeBpmn(p1).layout)).sound).toBe(false)
    // mit weniger als einem Stück im Schnitt läuft der Vorgang manchmal vorbei: gültig und sound
    const p2 = prozess([{ ...immer, anzahl: 0.5 }, danach])
    expect(pruefeProzess(p2).filter((b) => b.schwere === 'fehler')).toEqual([])
    expect(pruefeSoundness(graphAusLayout(erzeugeBpmn(p2).layout)).fehler).toEqual([])
    expect(tokenAbweichungen(p2, 20_000, 4)).toEqual([])
  })
})

describe('Für jedes Stück: Modell', () => {
  it('kennt den Körper als Kindsequenz; gleichzeitig ist er nebenläufig, nacheinander nicht', () => {
    const { p, m, a } = positionen()
    expect(kinderSequenzen(m)).toEqual([m.koerper])
    const f = findeBlock(p, a.id)!
    expect(rahmenUeber(f.kette).map((b) => b.id)).toEqual([m.id])
    expect(nebenlaeufig(f.kette)).toBe(false)
    const g = positionen('gleichzeitig')
    expect(nebenlaeufig(findeBlock(g.p, g.a.id)!.kette)).toBe(true)
  })

  it('springt nicht aus dem Körper zurück', () => {
    const x = aufgabe('Auftrag erfassen', 5)
    const y = aufgabe('Position prüfen', 5)
    const e = neueEntscheidung({ frage: 'Position korrekt?', zweige: [neuerZweig('Ja', 0.9), neuerZweig('Nein', 0.1)] })
    const m = neuerMehrfach({ name: 'Für jede Position', koerper: neueSequenz([y, e]) })
    const p = prozess([x, m])
    const ort = findeBlock(p, e.id)!
    expect(ruecksprungZiele(p, ort.sequenz.id, ort.index, true).map((z) => z.id)).toEqual([y.id, e.id])
    expect(setzeRuecksprung(p, e.id, e.zweige[1].id, x.id)).toBe(p)
    const innen = setzeRuecksprung(p, e.id, e.zweige[1].id, y.id)
    expect(pruefeProzess(innen).filter((b) => b.schwere === 'fehler')).toEqual([])
    // von Hand gebaut: Rücksprung über die Grenze
    const bereich = neuerRuecksprungBereich([x, { ...m, koerper: neueSequenz([y, { ...e, zweige: [e.zweige[0], { ...e.zweige[1], zurueckZu: 'rsp_x' }] }]) }])
    const kaputt = prozess([{ ...bereich, id: 'rsp_x' }])
    expect(pruefeProzess(kaputt).map((b) => b.schluessel)).toContain(`rahmenrueck:${e.zweige[1].id}`)
    expect(geometrieFehler(erzeugeBpmn(kaputt).layout)).toEqual([])
  })

  it('führt in den Körper hinein und danach dahinter weiter', () => {
    const { p, m, a } = positionen()
    expect(cursorNachEinfuegen(m, { sequenzId: 'haupt', index: 0 })).toEqual({ sequenzId: m.koerper.id, index: 1 })
    const ort = beschreibeCursor(p, { sequenzId: m.koerper.id, index: 1 })
    expect(ort.bereich).toBe('je Stück in „Für jede Position“')
    expect(ort.position).toBe(`nach „${a.name}“`)
    expect(ort.weiterText).toBe('Weiter nach „Für jede Position“')
    expect(ort.inParallele).toBe(false)
    const g = positionen('gleichzeitig')
    expect(beschreibeCursor(g.p, { sequenzId: g.m.koerper.id, index: 0 }).inParallele).toBe(true)
    expect(abschnittFertig(p, { sequenzId: m.koerper.id, index: 1 })).toEqual({ sequenzId: 'haupt', index: 1 })
  })

  it('speichert den Baustein und lädt ihn unverändert; Fremdes wird abgelehnt', () => {
    const { p } = mitEnde()
    const projekt = { formatVersion: 4 as const, ist: p, soll: null, massnahmen: [], verworfen: [] }
    expect(leseProjekt(JSON.parse(alsJson(projekt)))).toEqual(projekt)
    const kaputt = JSON.parse(alsJson(projekt))
    kaputt.ist.ablauf.schritte[0].streuung = 'zufaellig'
    expect(() => leseProjekt(kaputt)).toThrow('unbekannte Streuung')
    const ohneZahl = JSON.parse(alsJson(projekt))
    delete ohneZahl.ist.ablauf.schritte[0].anzahl
    expect(() => leseProjekt(ohneZahl)).toThrow('„Für jedes Stück“ unvollständig')
  })
})

describe('Für jedes Stück: Prüfregeln und Schwachstellen', () => {
  const schluessel = (p: Prozess) => pruefeProzess(p).map((b) => `${b.schwere}:${b.schluessel.split(':')[0]}`)

  it('meldet leere, ungültige und unbenannte Bausteine', () => {
    const a = () => neueSequenz([aufgabe('Position prüfen', 5)])
    expect(schluessel(prozess([neuerMehrfach({ name: 'Leer' })]))).toContain('fehler:leer')
    expect(schluessel(prozess([neuerMehrfach({ name: 'X', anzahl: -1, koerper: a() })]))).toContain('fehler:anzahl')
    expect(schluessel(prozess([neuerMehrfach({ name: 'X', anzahl: 0.5, streuung: 'schwankt', koerper: a() })]))).toContain('fehler:anzahl')
    expect(schluessel(prozess([neuerMehrfach({ name: 'X', liegezeitMin: -5, koerper: a() })]))).toContain('fehler:liegezeit')
    expect(schluessel(prozess([neuerMehrfach({ koerper: a() })]))).toContain('warnung:name')
    expect(pruefeProzess(positionen().p).filter((b) => b.schwere !== 'hinweis')).toEqual([])
  })

  it('meldet ein Ende im Körper, wenn die Stücke gleichzeitig laufen, und erlaubt es nacheinander', () => {
    const { p, m } = mitEnde()
    expect(pruefeProzess(p).filter((b) => b.schwere === 'fehler')).toEqual([])
    const gleichzeitig = prozess([{ ...m, ausfuehrung: 'gleichzeitig' }])
    const f = pruefeProzess(gleichzeitig).find((b) => b.schluessel.startsWith('abbruch:'))
    expect(f?.schwere).toBe('fehler')
    expect(f?.text).toContain('der Reihe nach')
    // keine Verklemmung: Das Fehler-Randereignis am Rahmen bricht alle Stücke ab
    expect(pruefeSoundness(graphAusLayout(erzeugeBpmn(gleichzeitig).layout)).fehler).toEqual([])
    // in einem Zweig von Gleichzeitig dagegen schon
    const par = neueParallel(2)
    par.zweige[0].schritte = [m]
    par.zweige[1].schritte = [aufgabe('Rechnung schreiben', 5, BUERO)]
    const verklemmt = prozess([par])
    expect(schluessel(verklemmt)).toContain('fehler:verklemmung')
    expect(pruefeSoundness(graphAusLayout(erzeugeBpmn(verklemmt).layout)).sound).toBe(false)
  })

  it('weist auf zu wenig Leute für gleichzeitige Stücke und auf eine lange Liegezeit hin', () => {
    const { p, m } = positionen('gleichzeitig')
    const befunde = findeSchwachstellen(p, berechneKennzahlen(p))
    const leute = befunde.find((b) => b.schluessel === `mehrfachrolle:${m.id}:${LAGER.id}`)
    expect(leute?.titel).toBe('Gleichzeitig, aber zu wenig Leute')
    expect(leute?.text).toContain('nur eine Person')
    // Liegezeit 60 von 70 Minuten
    expect(befunde.find((b) => b.schluessel === `liegezeit:${m.id}`)?.text).toContain('86 %')
    // drei Personen genügen für 2,5 Stücke
    const team = { ...p, rollen: p.rollen.map((r) => (r.id === LAGER.id ? { ...r, personen: 3 } : r)) }
    expect(findeSchwachstellen(team, berechneKennzahlen(team)).some((b) => b.schluessel.startsWith('mehrfachrolle'))).toBe(false)
  })
})

describe('Für jedes Stück in Zufallsprozessen', () => {
  it('stimmt mit Simulation, Verteilung und Tokenspiel überein', () => {
    const abweichungen: string[] = []
    let gezaehlt = 0
    for (let s = 1; s <= 400 && gezaehlt < 30; s++) {
      const p = zufallsProzess(s)
      if (![...durchlaufe(p.ablauf)].some((f) => f.block.typ === 'mehrfach')) continue
      gezaehlt++
      const k = berechneKennzahlen(p)
      const sim = simuliere(p, 20_000, s)
      if (Math.abs(k.durchlaufzeitMin - sim.mittelMin) > 4 * standardfehler(sim.zeiten) + 0.005 * Math.max(k.durchlaufzeitMin, 1)) {
        abweichungen.push(`Startwert ${s}: Formel ${k.durchlaufzeitMin.toFixed(2)}, Simulation ${sim.mittelMin.toFixed(2)}`)
      }
      const v = verteilungSequenz(p.ablauf.schritte, 'gesamt')
      const teile = [v.weiter, ...v.ende.values()]
      const gesamt = teile.reduce((x, t) => x + masse(t), 0)
      const mittel = teile.reduce((x, t) => x + erwartung(t) * masse(t), 0)
      if (Math.abs(gesamt - 1) > 1e-5 || Math.abs(mittel - k.durchlaufzeitMin) > 1e-4 * Math.max(1, k.durchlaufzeitMin)) abweichungen.push(`Startwert ${s}: Teilverteilungen Masse ${gesamt}, Mittel ${mittel} statt ${k.durchlaufzeitMin}`)
      for (const a of tokenAbweichungen(p, 3_000, s)) abweichungen.push(`Startwert ${s}: ${a}`)
    }
    expect(gezaehlt).toBe(30)
    expect(abweichungen).toEqual([])
  }, 120_000)

  it('legt Mehrfach-Rahmen und Aufgaben mit Markierung in 300 Zufallsprozessen nach den Zeichenregeln', () => {
    let rahmen = 0
    let aufgaben = 0
    let gleichzeitig = 0
    let raender = 0
    const fehler: string[] = []
    for (let s = 1; s <= 300; s++) {
      const { layout } = erzeugeBpmn(zufallsProzess(s))
      const mehrfachRahmen = layout.rahmen.filter((r) => r.mehrfach)
      rahmen += mehrfachRahmen.length
      aufgaben += layout.knoten.filter((k) => k.mehrfach).length
      gleichzeitig += [...layout.rahmen, ...layout.knoten].filter((x) => x.mehrfach && !x.mehrfach.nacheinander).length
      // Fehler-Randereignisse an Mehrfach-Rahmen: neben der Markierung, nie auf ihr
      raender += layout.knoten.filter((k) => k.art === 'rand' && mehrfachRahmen.some((r) => r.id === k.wirt)).length
      for (const f of geometrieFehler(layout)) fehler.push(`Startwert ${s}: ${f}`)
    }
    expect(fehler.slice(0, 5)).toEqual([])
    expect(rahmen).toBeGreaterThan(20)
    expect(aufgaben).toBeGreaterThan(10)
    expect(gleichzeitig).toBeGreaterThan(10)
    expect(raender).toBeGreaterThan(5)
  }, 60_000)
})
