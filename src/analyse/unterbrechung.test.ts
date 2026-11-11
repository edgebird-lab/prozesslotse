/**
 * Unterbrechungen (Randereignisse): Rechnung, Prüfregeln, Operationen,
 * Führung, Layout, BPMN-Export und Tokenspiel, mit von Hand nachgerechneten
 * Werten (Design: docs/modellierung-v4.md, Abschnitt 3).
 */
import { BpmnModdle, type ModdleElement } from 'bpmn-moddle'
import { describe, expect, it } from 'vitest'
import { erzeugeBpmn } from '../bpmn/export'
import { graphAusLayout, pruefeSoundness, zaehleMitFehler, type TokenGraph } from '../bpmn/tokenspiel'
import { neueAufgabe, neueEntscheidung, neuerMehrfach, neueOder, neuerOderZweig, neueParallel, neuerProzess, neueRolle, neuerTeilnehmer, neuerTeilprozess, neueSequenz, neueUnterbrechung, neuerZweig } from '../modell/bausteine'
import { abschnittFertig, beschreibeCursor, cursorNachEinfuegen } from '../modell/fuehrung'
import {
  alsMarkierteAufgabe,
  ausgaengeBlock,
  durchlaufe,
  entferneRuecksprung,
  entferneTeilnehmer,
  entferneUnterbrechung,
  findeBlock,
  kinderSequenzen,
  nachrichtenVerweise,
  nebenlaeufig,
  rahmenUeber,
  setzeRuecksprung,
  unterbrechungFuerAbschnitt,
  verlaesstBlock,
  verschiebeUnterbrechung,
} from '../modell/operationen'
import { alsJson, leseProjekt } from '../modell/speicher'
import { pruefeProzess } from '../modell/pruefung'
import { unterbrechungenVon, type Aufgabe, type Block, type Prozess, type Rolle, type Unterbrechung } from '../modell/typen'
import { graphAusXml } from '../testhilfen/bpmn-graph'
import { geometrieFehler } from '../testhilfen/geometrie'
import { standardfehler } from '../testhilfen/statistik'
import { zufallsProzess } from '../testhilfen/zufallsprozess'
import { findeSchwachstellen } from './hinweise'
import { berechneKennzahlen } from './kennzahlen'
import { findeVorschlaege } from './regeln'
import { simuliere, zufallMitStartwert } from './simulation'
import { erwartung, masse, verteilungSequenz } from './verteilung'

const LAGER = neueRolle('Lager', { personen: 2 })
const BUERO = neueRolle('Büro')

function aufgabe(name: string, minuten: number, rolle: Rolle = LAGER, liegezeitMin = 0, unterbrechungen?: Unterbrechung[]): Aufgabe {
  return neueAufgabe({ name, bearbeitungMin: minuten, liegezeitMin, rolleId: rolle.id, ...(unterbrechungen ? { unterbrechungen } : {}) })
}

function prozess(schritte: Block[]): Prozess {
  return neuerProzess({ name: 'Test', ergebnis: 'Fertig', rollen: [LAGER, BUERO], ablauf: { id: 'haupt', schritte } })
}

/** „Ware kommissionieren“ L = 60, B = 30; „Kunde storniert“ 10 % während der Arbeit, danach endet „storniert“; Ausnahmeweg „Storno buchen“ 10 Min. */
function storno() {
  const buchen = aufgabe('Storno buchen', 10, BUERO)
  const u = neueUnterbrechung({ bezeichnung: 'Kunde storniert', art: 'nachricht', anteil: 0.1, zeitpunkt: 'waehrend', ende: 'storniert', schritte: [buchen] })
  const a = aufgabe('Ware kommissionieren', 30, LAGER, 60, [u])
  return { p: prozess([a]), a, u, buchen }
}

/** L = 480, B = 60, Frist 1440 Min. in 20 % überschritten, danach weiter; Ausnahmeweg „Leitung informieren“ 15 Min. */
function frist() {
  const info = aufgabe('Leitung informieren', 15, BUERO)
  const u = neueUnterbrechung({ bezeichnung: 'Frist abgelaufen', art: 'zeit', fristMin: 1440, anteil: 0.2, schritte: [info] })
  const a = aufgabe('Antrag prüfen', 60, LAGER, 480, [u])
  return { p: prozess([a]), a, u, info }
}

/** Nebenweg „Kunde fragt nach“ 0,5-mal je Ausführung, „Auskunft geben“ 5 Min. */
function nachfrage() {
  const auskunft = aufgabe('Auskunft geben', 5, BUERO)
  const u = neueUnterbrechung({ bezeichnung: 'Kunde fragt nach', unterbrechend: false, anteil: 0.5, schritte: [auskunft] })
  const a = aufgabe('Ware kommissionieren', 30, LAGER, 60, [u])
  return { p: prozess([a]), a, u, auskunft }
}

/** Abschnitt [A 30, B 30] mit Nachricht 10 % (nach der halben Dauer), danach endet „abgebrochen“ */
function abschnitt() {
  const a = aufgabe('Ware entnehmen', 30)
  const b = aufgabe('Ware verpacken', 30)
  const u = neueUnterbrechung({ bezeichnung: 'Kunde storniert', art: 'nachricht', anteil: 0.1, ende: 'abgebrochen' })
  const tp = neuerTeilprozess({ name: 'Ware bereitstellen', koerper: neueSequenz([a, b]), unterbrechungen: [u] })
  return { p: prozess([tp]), tp, a, b, u }
}

describe('Unterbrechung: Rechnung', () => {
  it('rechnet eine Nachricht während der Arbeit mit Ende (Design: 89,5 Min., TCT 29,5 Min.)', () => {
    const { p, a, buchen } = storno()
    const k = berechneKennzahlen(p)
    // 0,9 · (60 + 30) + 0,1 · (60 + 15 + 10) = 81 + 8,5
    expect(k.durchlaufzeitMin).toBeCloseTo(89.5, 9)
    // TCT: 0,9 · 30 + 0,1 · (min(30, 75 − 60) + 10) = 27 + 2,5
    expect(k.kritischeArbeitMin).toBeCloseTo(29.5, 9)
    // abgebrochene Arbeit zählt voll: 30 + 0,1 · 10
    expect(k.arbeitszeitMin).toBeCloseTo(31, 9)
    expect(k.schritte.get(a.id)?.haeufigkeit).toBeCloseTo(1, 12)
    expect(k.schritte.get(buchen.id)?.haeufigkeit).toBeCloseTo(0.1, 12)
    expect(k.enden).toEqual([
      { ergebnis: 'Fertig', anteil: expect.closeTo(0.9, 12), regulaer: true },
      { ergebnis: 'storniert', anteil: expect.closeTo(0.1, 12), regulaer: false },
    ])
    // Wo die Zeit hingeht: Liegezeit 0,9 · 60 + 0,1 · 60, Bearbeitung 0,9 · 30 + 0,1 · 15
    expect(k.schritte.get(a.id)?.beitragWartenMin).toBeCloseTo(60, 9)
    expect(k.schritte.get(a.id)?.beitragArbeitMin).toBeCloseTo(28.5, 9)
    // Übergabe Lager → Büro im Ausnahmeweg
    expect(k.uebergaben).toBeCloseTo(0.1, 12)
  })

  it('rechnet eine Frist ohne Kürzung (Design: 723 Min., Arbeit 63 Min.)', () => {
    const { p, info } = frist()
    const k = berechneKennzahlen(p)
    // 0,8 · 540 + 0,2 · (1440 + 15) = 432 + 291
    expect(k.durchlaufzeitMin).toBeCloseTo(723, 9)
    expect(k.arbeitszeitMin).toBeCloseTo(63, 9)
    // TCT: 0,8 · 60 + 0,2 · (60 + 15)
    expect(k.kritischeArbeitMin).toBeCloseTo(63, 9)
    expect(k.enden).toEqual([{ ergebnis: 'Fertig', anteil: expect.closeTo(1, 12), regulaer: true }])
    expect(k.schritte.get(info.id)?.haeufigkeit).toBeCloseTo(0.2, 12)
  })

  it('lässt einen Nebenweg die Dauer nicht verlängern (Design: Häufigkeit 0,5, Arbeit + 2,5 Min.)', () => {
    const { p, auskunft } = nachfrage()
    const k = berechneKennzahlen(p)
    expect(k.durchlaufzeitMin).toBeCloseTo(90, 9)
    expect(k.kritischeArbeitMin).toBeCloseTo(30, 9)
    expect(k.schritte.get(auskunft.id)?.haeufigkeit).toBeCloseTo(0.5, 12)
    expect(k.arbeitszeitMin).toBeCloseTo(32.5, 9)
    expect(k.enden).toEqual([{ ergebnis: 'Fertig', anteil: expect.closeTo(1, 12), regulaer: true }])
    // Lager → Büro im Nebenweg, 0,5-mal
    expect(k.uebergaben).toBeCloseTo(0.5, 12)
  })

  it('unterbricht einen Abschnitt nach der halben Dauer (Design: 57 Min.)', () => {
    const { p, a, b } = abschnitt()
    const k = berechneKennzahlen(p)
    // 0,9 · 60 + 0,1 · 30
    expect(k.durchlaufzeitMin).toBeCloseTo(57, 9)
    expect(k.kritischeArbeitMin).toBeCloseTo(57, 9)
    expect(k.schritte.get(a.id)?.haeufigkeit).toBeCloseTo(1, 12)
    expect(k.schritte.get(b.id)?.haeufigkeit).toBeCloseTo(1, 12)
    expect(k.enden.find((e) => e.ergebnis === 'abgebrochen')?.anteil).toBeCloseTo(0.1, 12)
  })

  it('liefert Teilverteilungen mit Masse 1, deren Erwartung der Formel gleicht', () => {
    for (const { p } of [storno(), frist(), nachfrage(), abschnitt()]) {
      const k = berechneKennzahlen(p)
      const v = verteilungSequenz(p.ablauf.schritte, 'gesamt')
      const teile = [v.weiter, ...v.ende.values(), ...v.rueck.values()]
      expect(teile.reduce((s, t) => s + masse(t), 0)).toBeCloseTo(1, 9)
      expect(teile.reduce((s, t) => s + erwartung(t) * masse(t), 0)).toBeCloseTo(k.durchlaufzeitMin, 6)
    }
    // Frist: 540 mit 0,8, 1455 mit 0,2
    const v = verteilungSequenz(frist().p.ablauf.schritte, 'gesamt')
    expect(v.weiter.wert).toEqual([540, 1455])
    expect(v.weiter.masse[0]).toBeCloseTo(0.8, 12)
  })

  it('rechnet „noch einmal von vorn“ als Rücksprung zum eigenen Schritt', () => {
    // A 10 Min.; Frist 30 Min. in 20 % überschritten, danach noch einmal von vorn
    const u = neueUnterbrechung({ bezeichnung: 'Frist abgelaufen', art: 'zeit', fristMin: 30, anteil: 0.2 })
    const a = aufgabe('Teil prüfen', 10, LAGER, 0, [u])
    const p = setzeRuecksprung(prozess([a]), a.id, u.id, a.id)
    expect(findeBlock(p, a.id)?.vorfahren[0]?.typ).toBe('wiederholung')
    const k = berechneKennzahlen(p)
    // je Durchlauf 0,8 · 10 + 0,2 · 30 = 14 Min., im Schnitt 1 / 0,8 = 1,25 Durchläufe
    expect(k.durchlaufzeitMin).toBeCloseTo(17.5, 9)
    expect(k.schritte.get(a.id)?.haeufigkeit).toBeCloseTo(1.25, 12)
    expect(pruefeProzess(p).filter((b) => b.schwere === 'fehler')).toEqual([])
  })

  it('rechnet eine Unterbrechung an „für jedes Stück“ mit einem Ende im Körper', () => {
    // zwei Stücke der Reihe nach, je A 10 Min. und 5 % endet; Nachricht 10 % (halbe Dauer), danach C 5 Min. und weiter
    const a = aufgabe('Position prüfen', 10)
    const e = neueEntscheidung({ frage: 'Weiter?', zweige: [neuerZweig('Ja', 0.95), neuerZweig('Nein', 0.05, { ende: 'abgebrochen' })] })
    const c = aufgabe('Kunden informieren', 5, BUERO)
    const u = neueUnterbrechung({ bezeichnung: 'Auftrag geändert', anteil: 0.1, schritte: [c] })
    const m = neuerMehrfach({ name: 'Für jede Position', anzahl: 2, koerper: neueSequenz([a, e]), unterbrechungen: [u] })
    const k = berechneKennzahlen(prozess([m]))
    // A: K = 1 + 0,95 = 1,95 (der Baustein läuft ganz), C: 0,1
    expect(k.schritte.get(a.id)?.haeufigkeit).toBeCloseTo(1.95, 12)
    expect(k.schritte.get(c.id)?.haeufigkeit).toBeCloseTo(0.1, 12)
    // Ende nur, wenn nicht unterbrochen: 0,9 · (1 − 0,95²) = 0,9 · 0,0975
    expect(k.enden.find((x) => x.ergebnis === 'abgebrochen')?.anteil).toBeCloseTo(0.08775, 12)
    // Dauer: 0,9 · 19,5 + 0,1 · (19,5 / 2 + 5) = 17,55 + 1,475
    expect(k.durchlaufzeitMin).toBeCloseTo(19.025, 9)
  })

  it('stimmt mit der Simulation überein', () => {
    for (const [i, { p }] of [storno(), frist(), nachfrage(), abschnitt()].entries()) {
      const k = berechneKennzahlen(p)
      const sim = simuliere(p, 40_000, 11 + i)
      expect(Math.abs(sim.mittelMin - k.durchlaufzeitMin)).toBeLessThan(4 * standardfehler(sim.zeiten) + 0.005 * k.durchlaufzeitMin)
    }
    // Frist: genau zwei Werte, 540 und 1455
    const sim = simuliere(frist().p, 2_000, 5)
    expect(new Set(sim.zeiten)).toEqual(new Set([540, 1455]))
  })
})

function anteile(layout: ReturnType<typeof erzeugeBpmn>['layout']): Map<string, number> {
  return new Map(layout.kanten.filter((k) => k.anteil !== undefined).map((k) => [k.id, k.anteil!]))
}

/** Vergleichbare Form eines Graphen, mit Art und Wirkung der Randereignisse */
function form(g: TokenGraph): string[] {
  const quelle = new Map<string, string>()
  for (const k of g.knoten) for (const f of k.raus) quelle.set(f, k.id)
  const knoten = g.knoten.map((k) => [k.id, k.typ, k.rahmen ?? '', k.endeArt ?? '', k.fehler ?? '', k.wirt ?? '', k.randArt ?? '', k.unterbrechend ?? '', k.mehrfach ? (k.mehrfach.nacheinander ? 'nacheinander' : 'gleichzeitig') : ''].join(':'))
  return [...knoten, ...[...g.ziel].map(([f, z]) => `${quelle.get(f)}->${z}`)].sort()
}

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

function kinder(e: ModdleElement): ModdleElement[] {
  return (e.flowElements ?? []) as ModdleElement[]
}

type Randereignis = ModdleElement & { attachedToRef: { id: string }; cancelActivity: boolean; eventDefinitions: { $type: string }[]; name?: string }

/** Alle Beispiele dieser Datei, mit einem Kunden als externem Beteiligten für Nachrichten */
function beispiele(): Prozess[] {
  const kunde = neuerTeilnehmer('Kunde')
  const mitKunde = (p: Prozess): Prozess => ({ ...p, teilnehmer: [kunde] })
  const s = storno()
  const sp = mitKunde(s.p)
  sp.ablauf = { id: 'haupt', schritte: [{ ...s.a, unterbrechungen: [{ ...s.u, von: kunde.id }] }] }
  const u = neueUnterbrechung({ bezeichnung: 'Frist abgelaufen', art: 'zeit', fristMin: 30, anteil: 0.2 })
  const a = aufgabe('Teil prüfen', 10, LAGER, 0, [u])
  return [sp, frist().p, nachfrage().p, abschnitt().p, setzeRuecksprung(prozess([aufgabe('Teil annehmen', 5, BUERO), a]), a.id, u.id, a.id)]
}

describe('Unterbrechung: BPMN', () => {
  it('exportiert Randereignisse mit Zeit oder Nachricht, unterbrechend oder nebenher', async () => {
    const { p, a, u } = storno()
    const kunde = neuerTeilnehmer('Kunde')
    const mitKunde = { ...p, teilnehmer: [kunde], ablauf: { id: 'haupt', schritte: [{ ...a, unterbrechungen: [{ ...u, von: kunde.id }] }] } }
    const { xml, layout } = erzeugeBpmn(mitKunde)
    const { rootElement, warnings } = await BpmnModdle().fromXML(xml)
    expect(warnings).toEqual([])
    const prozessElement = (rootElement.rootElements ?? []).find((e) => e.$type === 'bpmn:Process')!
    const rand = kinder(prozessElement).find((e) => e.$type === 'bpmn:BoundaryEvent') as Randereignis
    expect(rand.attachedToRef.id).toBe(a.id)
    expect(rand.cancelActivity).toBe(true)
    expect(rand.name).toBe('Kunde storniert')
    expect(rand.eventDefinitions[0].$type).toBe('bpmn:MessageEventDefinition')
    expect(xml).toContain('Kommt in 10 % der Ausführungen, meist während der Arbeit; bricht die Arbeit ab; danach endet der Vorgang („storniert“)')
    // Nachrichtenfluss vom Pool des Kunden zum Randereignis
    expect(layout.nachrichten.some((n) => n.nach === rand.id)).toBe(true)
    // Ende mit Ergebnis im Ausnahmeweg auf Prozessebene: ein normales Ende
    const ende = kinder(prozessElement).find((e) => e.$type === 'bpmn:EndEvent' && (e as Randereignis).name === 'storniert') as Randereignis
    expect(ende.eventDefinitions ?? []).toEqual([])
    // Nebenweg: nicht unterbrechend, eigenes Ende ohne Namen; Frist als Zeit-Randereignis
    const neben = erzeugeBpmn(nachfrage().p)
    const nebenRand = neben.layout.knoten.find((k) => k.art === 'rand')!
    expect(neben.xml).toContain(`attachedToRef="${nebenRand.wirt}" cancelActivity="false"`)
    expect(neben.layout.knoten.filter((k) => k.art === 'ende' && k.name === '')).toHaveLength(1)
    const fristXml = erzeugeBpmn(frist().p).xml
    expect(fristXml).toContain('<bpmn:timerEventDefinition')
    expect(fristXml).toContain('Frist 3 Arbeitstage ab Eingang, überschritten in 20 % der Ausführungen')
  })

  it('setzt das Randereignis eines Abschnitts an den Teilprozess; der Ausnahmeweg liegt außerhalb', async () => {
    const { p, tp } = abschnitt()
    const { xml, layout } = erzeugeBpmn(p)
    expect(geometrieFehler(layout)).toEqual([])
    const { rootElement, warnings } = await BpmnModdle().fromXML(xml)
    expect(warnings).toEqual([])
    const prozessElement = (rootElement.rootElements ?? []).find((e) => e.$type === 'bpmn:Process')!
    const rand = kinder(prozessElement).find((e) => e.$type === 'bpmn:BoundaryEvent') as Randereignis
    expect(rand.attachedToRef.id).toBe(tp.id)
    // Ende „abgebrochen“ hinter dem Randereignis auf Prozessebene, kein Fehler-Ende
    const ende = kinder(prozessElement).find((e) => (e as Randereignis).name === 'abgebrochen') as Randereignis
    expect(ende.$type).toBe('bpmn:EndEvent')
    expect(ende.eventDefinitions ?? []).toEqual([])
  })

  it('legt die Beispiele nach den Zeichenregeln', () => {
    for (const p of beispiele()) expect(geometrieFehler(erzeugeBpmn(p).layout)).toEqual([])
  })

  it('ist im Tokenspiel sound, auf dem Layout und auf dem gelesenen XML, und zählt dieselben Häufigkeiten', async () => {
    for (const [i, p] of beispiele().entries()) {
      const { layout, xml } = erzeugeBpmn(p)
      const g = graphAusLayout(layout)
      const x = await graphAusXml(xml)
      expect(form(x)).toEqual(form(g))
      expect(pruefeSoundness(g).fehler).toEqual([])
      expect(pruefeSoundness(x).fehler).toEqual([])
      expect(tokenAbweichungen(p, 20_000, 3 + i)).toEqual([])
    }
  })
})

describe('Unterbrechung in Zufallsprozessen', () => {
  const mitUnterbrechung = (p: Prozess) => [...durchlaufe(p.ablauf)].some((f) => unterbrechungenVon(f.block).length > 0)

  it('stimmt mit Simulation, Verteilung und Tokenspiel überein', () => {
    const abweichungen: string[] = []
    let gezaehlt = 0
    for (let s = 1; s <= 300 && gezaehlt < 40; s++) {
      const p = zufallsProzess(s)
      if (!mitUnterbrechung(p)) continue
      gezaehlt++
      const k = berechneKennzahlen(p)
      const sim = simuliere(p, 20_000, s)
      if (Math.abs(k.durchlaufzeitMin - sim.mittelMin) > 4 * standardfehler(sim.zeiten) + 0.005 * Math.max(k.durchlaufzeitMin, 1)) {
        abweichungen.push(`Startwert ${s}: Formel ${k.durchlaufzeitMin.toFixed(2)}, Simulation ${sim.mittelMin.toFixed(2)}`)
      }
      // Ergebnisanteile der Simulation gleich den Formeln
      for (const e of k.enden) {
        const x = sim.ergebnisse.find((r) => r.ergebnis === e.ergebnis && r.regulaer === e.regulaer)?.anteil ?? 0
        if (Math.abs(x - e.anteil) > 4 * Math.sqrt((e.anteil * (1 - e.anteil)) / 20_000) + 0.002) abweichungen.push(`Startwert ${s}: Ende „${e.ergebnis}“ Formel ${e.anteil.toFixed(4)}, Simulation ${x.toFixed(4)}`)
      }
      const v = verteilungSequenz(p.ablauf.schritte, 'gesamt')
      const teile = [v.weiter, ...v.ende.values()]
      const gesamt = teile.reduce((x, t) => x + masse(t), 0)
      const mittel = teile.reduce((x, t) => x + erwartung(t) * masse(t), 0)
      if (Math.abs(gesamt - 1) > 1e-5 || Math.abs(mittel - k.durchlaufzeitMin) > 1e-4 * Math.max(1, k.durchlaufzeitMin)) abweichungen.push(`Startwert ${s}: Teilverteilungen Masse ${gesamt}, Mittel ${mittel} statt ${k.durchlaufzeitMin}`)
      // TCT höchstens die Durchlaufzeit
      if (k.kritischeArbeitMin > k.durchlaufzeitMin + 1e-6) abweichungen.push(`Startwert ${s}: TCT ${k.kritischeArbeitMin} über der Durchlaufzeit ${k.durchlaufzeitMin}`)
      for (const a of tokenAbweichungen(p, 3_000, s)) abweichungen.push(`Startwert ${s}: ${a}`)
    }
    expect(gezaehlt).toBe(40)
    expect(abweichungen).toEqual([])
  }, 120_000)

  it('ist sound auf dem Layout und auf dem gelesenen XML, beide beschreiben denselben Graphen', async () => {
    const fehler: string[] = []
    let gezaehlt = 0
    for (let s = 1; s <= 300; s++) {
      const p = zufallsProzess(s)
      if (!mitUnterbrechung(p)) continue
      gezaehlt++
      const { layout, xml } = erzeugeBpmn(p)
      const g = graphAusLayout(layout)
      const x = await graphAusXml(xml)
      if (JSON.stringify(form(x)) !== JSON.stringify(form(g))) fehler.push(`Startwert ${s}: XML und Layout verschieden`)
      for (const [name, graph] of [['Layout', g], ['XML', x]] as const) {
        const e = pruefeSoundness(graph, 2_000)
        if (!e.reduziert) for (const f of e.fehler) fehler.push(`Startwert ${s} (${name}): ${f}`)
      }
    }
    expect(gezaehlt).toBeGreaterThan(100)
    expect(fehler.slice(0, 10)).toEqual([])
  }, 120_000)

  it('legt Randereignisse an Aufgaben und Rahmen in 300 Zufallsprozessen nach den Zeichenregeln', () => {
    const fehler: string[] = []
    let anAufgaben = 0
    let anRahmen = 0
    let neben = 0
    let ueberAbgangsspur = 0
    let nachrichten = 0
    for (let s = 1; s <= 300; s++) {
      const { layout } = erzeugeBpmn(zufallsProzess(s))
      const rahmen = new Set(layout.rahmen.map((r) => r.id))
      for (const k of layout.knoten) {
        if (k.art !== 'rand' || k.fehler) continue
        if (rahmen.has(k.wirt!)) anRahmen++
        else anAufgaben++
        if (k.unterbrechend === false) neben++
        if (k.randLage?.stufe !== undefined) ueberAbgangsspur++
      }
      nachrichten += layout.nachrichten.filter((n) => layout.knoten.some((k) => k.art === 'rand' && k.id === n.nach)).length
      for (const f of geometrieFehler(layout)) fehler.push(`Startwert ${s}: ${f}`)
    }
    expect(fehler.slice(0, 5)).toEqual([])
    expect(anAufgaben).toBeGreaterThan(150)
    expect(anRahmen).toBeGreaterThan(80)
    expect(neben).toBeGreaterThan(80)
    expect(ueberAbgangsspur).toBeGreaterThan(80)
    expect(nachrichten).toBeGreaterThan(40)
  }, 60_000)
})

describe('Unterbrechung: Prüfregeln und Schwachstellen', () => {
  const schluessel = (p: Prozess) => pruefeProzess(p).map((b) => `${b.schwere}:${b.schluessel.split(':')[0]}`)

  it('meldet Anteile über 100 %, ungültige Anteile, fehlende Frist und mehr als drei an einer Aufgabe', () => {
    // 60 % und 50 %: Die Ereignisse schließen sich aus, zusammen höchstens 100 %
    const zwei = [neueUnterbrechung({ bezeichnung: 'A', anteil: 0.6 }), neueUnterbrechung({ bezeichnung: 'B', anteil: 0.5 })]
    const p = prozess([aufgabe('Ware prüfen', 10, LAGER, 0, zwei)])
    const f = pruefeProzess(p).find((b) => b.schluessel.startsWith('usumme:'))
    expect(f?.schwere).toBe('fehler')
    expect(f?.text).toContain('110 %')
    expect(schluessel(prozess([aufgabe('X prüfen', 10, LAGER, 0, [neueUnterbrechung({ bezeichnung: 'A', anteil: 1.2 })])]))).toContain('fehler:uanteil')
    expect(schluessel(prozess([aufgabe('X prüfen', 10, LAGER, 0, [neueUnterbrechung({ bezeichnung: 'A', art: 'zeit', fristMin: 0 })])]))).toContain('fehler:ufrist')
    const vier = Array.from({ length: 4 }, (_, i) => neueUnterbrechung({ bezeichnung: `E${i}`, anteil: 0.05 }))
    expect(schluessel(prozess([aufgabe('X prüfen', 10, LAGER, 0, vier)]))).toContain('fehler:uviele')
    // an einem Abschnitt dürfen es mehr sein
    expect(schluessel(prozess([neuerTeilprozess({ name: 'Ware bereitstellen', koerper: neueSequenz([aufgabe('X prüfen', 10)]), unterbrechungen: vier })]))).not.toContain('fehler:uviele')
  })

  it('verlangt eine Bezeichnung und weist auf 0 %, 100 % und Schritte hin, die mehrmals laufen', () => {
    const ohne = prozess([aufgabe('X prüfen', 10, LAGER, 0, [neueUnterbrechung({ anteil: 0 })])])
    expect(schluessel(ohne)).toEqual(expect.arrayContaining(['warnung:ubezeichnung', 'hinweis:unie']))
    expect(schluessel(prozess([aufgabe('X prüfen', 10, LAGER, 0, [neueUnterbrechung({ bezeichnung: 'A', anteil: 1 })])]))).toContain('hinweis:unormal')
    const mf = neuerMehrfach({ name: 'Für jede Position', koerper: neueSequenz([aufgabe('Position prüfen', 5, LAGER, 0, [neueUnterbrechung({ bezeichnung: 'Teil fehlt' })])]) })
    expect(schluessel(prozess([mf]))).toContain('hinweis:umehrmals')
  })

  it('warnt vor einer Frist, die kürzer ist als der Schritt oder laut den Zeiten öfter überschritten wird', () => {
    // Aufgabe L 60 + B 30 = 90 Min., Frist 60 Min.
    const kurz = prozess([aufgabe('X prüfen', 30, LAGER, 60, [neueUnterbrechung({ bezeichnung: 'Frist', art: 'zeit', fristMin: 60 })])])
    expect(schluessel(kurz)).toContain('warnung:ufristkurz')
    // Abschnitt: 30 % dauern 100 Min., 70 % 20 Min.; Frist 50 Min., angegeben 10 %
    const lang = aufgabe('Nacharbeit leisten', 80)
    const e = neueEntscheidung({ frage: 'Nacharbeit?', zweige: [neuerZweig('Ja', 0.3, { schritte: [lang] }), neuerZweig('Nein', 0.7)] })
    const tp = neuerTeilprozess({ name: 'Ware prüfen', koerper: neueSequenz([aufgabe('Ware sichten', 20), e]), unterbrechungen: [neueUnterbrechung({ bezeichnung: 'Frist', art: 'zeit', fristMin: 50, anteil: 0.1 })] })
    const w = pruefeProzess(prozess([tp])).find((b) => b.schluessel.startsWith('ufristrahmen:'))
    expect(w?.schwere).toBe('warnung')
    expect(w?.text).toContain('30 % der Fälle länger als die Frist von 50 Min., angegeben sind 10 %')
    // mit 30 % angegeben passt es
    expect(schluessel(prozess([{ ...tp, unterbrechungen: [{ ...tp.unterbrechungen![0], anteil: 0.3 }] }]))).not.toContain('warnung:ufristrahmen')
  })

  it('meldet ein Ende oder einen Rücksprung im Nebenweg und einen Nebenweg ohne Schritte', () => {
    const ende = prozess([aufgabe('X prüfen', 10, LAGER, 0, [neueUnterbrechung({ bezeichnung: 'Nachfrage', unterbrechend: false, anteil: 0.5, ende: 'Ende' })])])
    expect(schluessel(ende)).toEqual(expect.arrayContaining(['fehler:nebenende', 'warnung:uleer']))
    // auch tiefer darin: eine Entscheidung im Nebenweg mit Ende
    const e = neueEntscheidung({ frage: 'Geklärt?', zweige: [neuerZweig('Ja', 0.9), neuerZweig('Nein', 0.1, { ende: 'offen' })] })
    const tief = prozess([aufgabe('X prüfen', 10, LAGER, 0, [neueUnterbrechung({ bezeichnung: 'Nachfrage', unterbrechend: false, anteil: 0.5, schritte: [aufgabe('Antwort geben', 5), e] })])])
    expect(schluessel(tief)).toContain('fehler:nebenende')
    // Im BPMN endet der Nebenweg für sich: Das Diagramm bleibt sound, die Prüfung meldet den Fehler.
    expect(pruefeSoundness(graphAusLayout(erzeugeBpmn(tief).layout)).fehler).toEqual([])
  })

  it('meldet ein Ende nach einer Unterbrechung in „Gleichzeitig“ als Verklemmung, in einem ODER-Weg als Abbruch', () => {
    const u = neueUnterbrechung({ bezeichnung: 'Storno', anteil: 0.1, ende: 'storniert' })
    const par = neueParallel(2)
    par.zweige[0].schritte = [aufgabe('Ware packen', 10, LAGER, 0, [u])]
    par.zweige[1].schritte = [aufgabe('Rechnung schreiben', 10, BUERO)]
    const p = prozess([par])
    expect(schluessel(p)).toContain('fehler:verklemmung')
    expect(pruefeSoundness(graphAusLayout(erzeugeBpmn(p).layout)).sound).toBe(false)
    const oder = neueOder({ frage: 'Was fehlt?', standard: null, zweige: [neuerOderZweig('A', 0.7, { schritte: [aufgabe('Ware packen', 10, LAGER, 0, [u])] }), neuerOderZweig('B', 0.6, { schritte: [aufgabe('Rechnung schreiben', 10, BUERO)] })] })
    const o = prozess([oder])
    expect(schluessel(o)).toContain('fehler:abbruch')
    expect(schluessel(o)).not.toContain('fehler:verklemmung')
    // die inklusive Zusammenführung wartet nicht auf den beendeten Weg
    expect(pruefeSoundness(graphAusLayout(erzeugeBpmn(o).layout)).fehler).toEqual([])
  })

  it('erlaubt ein Ende nach der Unterbrechung eines Schritts in einem Abschnitt (Fehler-Ende, gefangen am Abschnitt)', () => {
    const u = neueUnterbrechung({ bezeichnung: 'Storno', anteil: 0.1, ende: 'storniert' })
    const tp = neuerTeilprozess({ name: 'Ware bereitstellen', koerper: neueSequenz([aufgabe('Ware packen', 10, LAGER, 0, [u])]) })
    const p = prozess([tp, aufgabe('Rechnung schreiben', 10, BUERO)])
    expect(pruefeProzess(p).filter((b) => b.schwere === 'fehler')).toEqual([])
    const { layout } = erzeugeBpmn(p)
    expect(layout.knoten.find((k) => k.id === `${u.id}_ende`)?.fehler).toBeDefined()
    expect(layout.knoten.filter((k) => k.art === 'rand' && k.fehler)).toHaveLength(1)
    expect(geometrieFehler(layout)).toEqual([])
    expect(pruefeSoundness(graphAusLayout(layout)).fehler).toEqual([])
    expect(tokenAbweichungen(p, 20_000, 8)).toEqual([])
    expect(berechneKennzahlen(p).enden.find((e) => e.ergebnis === 'storniert')?.anteil).toBeCloseTo(0.1, 12)
  })

  it('weist auf viel abgebrochene Arbeit, oft überschrittene Fristen und lange Nebenwege hin', () => {
    // Frist: 20 % überschritten, also auch 20 % abgebrochen
    const f = frist()
    const befunde = findeSchwachstellen(f.p, berechneKennzahlen(f.p))
    expect(befunde.find((b) => b.schluessel === `abgebrochen:${f.a.id}`)?.text).toContain('20 %')
    expect(befunde.find((b) => b.schluessel === `frist:${f.u.id}`)?.text).toContain('3 Arbeitstage')
    // Nebenweg 5 Min. ist kürzer als der Schritt (90 Min.): kein Hinweis; 2 Std. sind länger
    const n = nachfrage()
    expect(findeSchwachstellen(n.p, berechneKennzahlen(n.p)).some((b) => b.schluessel.startsWith('nebenweglang'))).toBe(false)
    const lang = { ...n.u, schritte: [aufgabe('Auskunft geben', 120, BUERO)] }
    const p = prozess([{ ...n.a, unterbrechungen: [lang] }])
    expect(findeSchwachstellen(p, berechneKennzahlen(p)).find((b) => b.schluessel === `nebenweglang:${lang.id}`)?.text).toContain('2 Std.')
  })

  it('schlägt keine Zusammenlegung und keine Parallelisierung vor, die eine Unterbrechung verschieben würde', () => {
    const u = neueUnterbrechung({ bezeichnung: 'Storno', anteil: 0.1, ende: 'storniert' })
    const a = aufgabe('Ware packen', 10, LAGER, 30)
    const b = aufgabe('Ware prüfen', 10, LAGER, 30, [u])
    expect(findeVorschlaege(prozess([a, b])).some((v) => v.regel === 'zusammenlegen')).toBe(false)
    expect(findeVorschlaege(prozess([a, { ...b, unterbrechungen: undefined }])).some((v) => v.regel === 'zusammenlegen')).toBe(true)
    const c = neueAufgabe({ name: 'Rechnung schreiben', bearbeitungMin: 10, rolleId: BUERO.id, brauchtVorgaenger: false, unterbrechungen: [u] })
    expect(findeVorschlaege(prozess([a, c])).some((v) => v.regel === 'parallelisieren')).toBe(false)
    expect(findeVorschlaege(prozess([a, { ...c, unterbrechungen: undefined }])).some((v) => v.regel === 'parallelisieren')).toBe(true)
  })
})

describe('Unterbrechung: Modell, Speichern und Führung', () => {
  it('kennt Ausnahmewege als Kindsequenzen; sie liegen neben dem Schritt, Nebenwege sind nebenläufig', () => {
    const storniert = aufgabe('Storno buchen', 5, BUERO)
    const c = aufgabe('Kunden informieren', 5, BUERO)
    const { tp, u } = abschnitt()
    const neben = neueUnterbrechung({ bezeichnung: 'Nachfrage', unterbrechend: false, anteil: 0.5, schritte: [c] })
    const mitWegen = { ...tp, unterbrechungen: [{ ...u, schritte: [storniert] }, neben] }
    const q = prozess([mitWegen])
    expect(kinderSequenzen(mitWegen).map((s) => s.id)).toEqual([tp.koerper.id, u.id, neben.id])
    // Ausnahmeweg eines Rahmens: außerhalb des Rahmens und nicht nebenläufig
    expect(rahmenUeber(findeBlock(q, storniert.id)!.kette)).toEqual([])
    expect(nebenlaeufig(findeBlock(q, storniert.id)!.kette)).toBe(false)
    expect(nebenlaeufig(findeBlock(q, c.id)!.kette)).toBe(true)
    // Schritte im Körper liegen im Rahmen
    expect(rahmenUeber(findeBlock(q, tp.koerper.schritte[0].id)!.kette).map((b) => b.id)).toEqual([tp.id])
  })

  it('zeichnet „für jedes Stück“ mit Unterbrechung als Rahmen statt als Aufgabe mit Markierung', () => {
    const a = aufgabe('Position prüfen', 5)
    const m = neuerMehrfach({ name: 'Für jede Position', koerper: neueSequenz([a]) })
    expect(alsMarkierteAufgabe(m)).toBe(a)
    expect(alsMarkierteAufgabe({ ...m, unterbrechungen: [neueUnterbrechung({ bezeichnung: 'Stopp' })] })).toBeNull()
    expect(alsMarkierteAufgabe({ ...m, koerper: neueSequenz([{ ...a, unterbrechungen: [neueUnterbrechung({ bezeichnung: 'Stopp' })] }]) })).toBeNull()
  })

  it('kennt die Wege aus einem Schritt mit Unterbrechungen, setzt und entfernt Rücksprünge', () => {
    const { a, u } = storno()
    expect([...ausgaengeBlock(a)].sort()).toEqual(['ende', 'weiter'])
    expect(verlaesstBlock(a)).toBe(true)
    // Ein Nebenweg ändert nichts am Ablauf
    expect([...ausgaengeBlock(nachfrage().a)]).toEqual(['weiter'])
    expect(verlaesstBlock(nachfrage().a)).toBe(false)
    // Rücksprung „noch einmal von vorn“ und wieder entfernen: Der Bereich löst sich auf
    const p = setzeRuecksprung(prozess([{ ...a, unterbrechungen: [{ ...u, ende: null }] }]), a.id, u.id, a.id)
    const bereich = findeBlock(p, a.id)!.vorfahren[0]
    expect(bereich.typ).toBe('wiederholung')
    expect((findeBlock(p, a.id)!.block as Aufgabe).unterbrechungen![0].zurueckZu).toBe(bereich.id)
    expect(entferneRuecksprung(p, a.id, u.id).ablauf.schritte.map((b) => b.id)).toEqual([a.id])
    // Ein Nebenweg springt nie zurück
    const n = nachfrage()
    expect(setzeRuecksprung(n.p, n.a.id, n.u.id, n.a.id)).toBe(n.p)
    // Unterbrechung entfernen löst den Bereich auf, auf den sie zeigte; ohne Unterbrechungen fällt das Feld weg
    const ohne = entferneUnterbrechung(p, a.id, u.id)
    expect(ohne.ablauf.schritte.map((b) => b.id)).toEqual([a.id])
    expect((ohne.ablauf.schritte[0] as Aufgabe).unterbrechungen).toBeUndefined()
  })

  it('hängt eine Unterbrechung an die ganze Liste oder an einen neuen Abschnitt über mehrere Schritte', () => {
    const u = neueUnterbrechung({ bezeichnung: 'Lager gesperrt', anteil: 0.05 })
    const a = aufgabe('Position kommissionieren', 5, LAGER, 0, [u])
    const m = neuerMehrfach({ name: 'Für jede Position', koerper: neueSequenz([a, aufgabe('Position buchen', 5)]) })
    const liste = verschiebeUnterbrechung(prozess([m]), a.id, u.id, m.id)
    expect((findeBlock(liste, m.id)!.block as typeof m).unterbrechungen?.map((x) => x.id)).toEqual([u.id])
    expect((findeBlock(liste, a.id)!.block as Aufgabe).unterbrechungen).toBeUndefined()
    // „gilt für mehrere“: A bis C werden ein Abschnitt mit der Unterbrechung
    const b = aufgabe('Ware verpacken', 5)
    const c = aufgabe('Ware verladen', 5)
    const p = unterbrechungFuerAbschnitt(prozess([a, b, c]), 'haupt', 0, 2, 'Ware bereitstellen', a.id, u.id, 'tp_neu')
    expect(p.ablauf.schritte.map((x) => x.id)).toEqual(['tp_neu'])
    const tp = p.ablauf.schritte[0]
    expect(tp.typ === 'teilprozess' && tp.unterbrechungen?.map((x) => x.id)).toEqual([u.id])
    expect(tp.typ === 'teilprozess' && tp.koerper.schritte.map((x) => x.id)).toEqual([a.id, b.id, c.id])
  })

  it('führt Nachrichten von externen Beteiligten zu Randereignissen und entfernt den Absender mit dem Beteiligten', () => {
    const kunde = neuerTeilnehmer('Kunde')
    const { a, u } = storno()
    const p = { ...prozess([{ ...a, unterbrechungen: [{ ...u, von: kunde.id }] }]), teilnehmer: [kunde] }
    expect(nachrichtenVerweise(p)).toEqual([{ ort: u.id, richtung: 'von', teilnehmerId: kunde.id }])
    // 10 % der Ausführungen: 0,1 Nachrichten je Vorgang
    expect(berechneKennzahlen(p).kontakte[0].anzahl).toBeCloseTo(0.1, 12)
    expect((entferneTeilnehmer(p, kunde.id).ablauf.schritte[0] as Aufgabe).unterbrechungen![0].von).toBeNull()
  })

  it('speichert Unterbrechungen und lädt sie unverändert; Fremdes wird abgelehnt, ein Absender bei Fristen entfernt', () => {
    const { p } = storno()
    const projekt = { formatVersion: 4 as const, ist: p, soll: null, massnahmen: [], verworfen: [] }
    expect(leseProjekt(JSON.parse(alsJson(projekt)))).toEqual(projekt)
    const kaputt = JSON.parse(alsJson(projekt))
    kaputt.ist.ablauf.schritte[0].unterbrechungen[0].zeitpunkt = 'irgendwann'
    expect(() => leseProjekt(kaputt)).toThrow('unbekannter Zeitpunkt')
    const ohneAnteil = JSON.parse(alsJson(projekt))
    delete ohneAnteil.ist.ablauf.schritte[0].unterbrechungen[0].anteil
    expect(() => leseProjekt(ohneAnteil)).toThrow('Unterbrechung 1: Angaben fehlen')
    const frist = JSON.parse(alsJson(projekt))
    Object.assign(frist.ist.ablauf.schritte[0].unterbrechungen[0], { art: 'zeit', von: 'tln_x' })
    expect(leseProjekt(frist).ist.ablauf.schritte[0]).toMatchObject({ unterbrechungen: [{ von: null }] })
  })

  it('führt in den Ausnahmeweg und danach hinter den Schritt', () => {
    const { p, a, u } = storno()
    expect(cursorNachEinfuegen(a, { sequenzId: 'haupt', index: 0 })).toEqual({ sequenzId: u.id, index: 1 })
    const ort = beschreibeCursor(p, { sequenzId: u.id, index: 1 })
    expect(ort.bereich).toBe('im Ausnahmeweg „Kunde storniert“ von „Ware kommissionieren“')
    expect(ort.weiterText).toBe('Weiter nach „Ware kommissionieren“')
    expect(ort.inParallele).toBe(false)
    expect(abschnittFertig(p, { sequenzId: u.id, index: 1 })).toEqual({ sequenzId: 'haupt', index: 1 })
    const n = nachfrage()
    const imNebenweg = beschreibeCursor(n.p, { sequenzId: n.u.id, index: 0 })
    expect(imNebenweg.bereich).toBe('im Nebenweg „Kunde fragt nach“ von „Ware kommissionieren“')
    // Im Nebenweg kann der Prozess nicht enden
    expect(imNebenweg.inParallele).toBe(true)
  })
})
