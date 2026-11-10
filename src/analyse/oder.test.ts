/**
 * ODER-Verzweigung (inklusives Gateway): Häufigkeiten, Dauer, Simulation,
 * Prüfregeln, BPMN-Export und Tokenspiel, mit von Hand nachgerechneten Werten.
 */
import { describe, expect, it } from 'vitest'
import { BpmnModdle } from 'bpmn-moddle'
import { erzeugeBpmn } from '../bpmn/export'
import { graphAusLayout, pruefeSoundness, zaehleAusfuehrungen } from '../bpmn/tokenspiel'
import { neueAufgabe, neueOder, neuerOderZweig, neuerProzess, neueRolle } from '../modell/bausteine'
import { durchlaufe } from '../modell/operationen'
import { pruefeProzess } from '../modell/pruefung'
import type { Aufgabe, Block, Oder, Prozess } from '../modell/typen'
import { graphAusXml } from '../testhilfen/bpmn-graph'
import { zufallsProzess } from '../testhilfen/zufallsprozess'
import { berechneKennzahlen } from './kennzahlen'
import { simuliere, zufallMitStartwert } from './simulation'

const R = neueRolle('Team', { personen: 3 })

function aufgabe(name: string, minuten: number): Aufgabe {
  return neueAufgabe({ name, bearbeitungMin: minuten, liegezeitMin: 0, rolleId: R.id })
}

function prozess(schritte: Block[]): Prozess {
  return neuerProzess({ name: 'Test', ergebnis: 'Fertig', rollen: [R], ablauf: { id: 'haupt', schritte } })
}

/** „Welche Unterlagen fehlen?“: Gehaltsnachweis (50 %, 30 Min.), Ausweis (40 %, 60 Min.), sonst ein Standardweg. */
function unterlagen(standardSchritte: Block[] = []): { o: Oder; a: Aufgabe; b: Aufgabe } {
  const a = aufgabe('Gehaltsnachweis anfordern', 30)
  const b = aufgabe('Ausweis anfordern', 60)
  const keiner = neuerOderZweig('Nichts fehlt', 0, { schritte: standardSchritte })
  const o = neueOder({
    frage: 'Welche Unterlagen fehlen?',
    zweige: [neuerOderZweig('Gehaltsnachweis', 0.5, { schritte: [a] }), neuerOderZweig('Ausweis', 0.4, { schritte: [b] }), keiner],
    standard: keiner.id,
  })
  return { o, a, b }
}

describe('ODER-Verzweigung', () => {
  it('rechnet Häufigkeiten und Dauer wie von Hand', () => {
    const { o, a, b } = unterlagen()
    const k = berechneKennzahlen(prozess([o]))
    expect(k.schritte.get(a.id)?.haeufigkeit).toBeCloseTo(0.5, 10)
    expect(k.schritte.get(b.id)?.haeufigkeit).toBeCloseTo(0.4, 10)
    // keiner 0,3 → 0; nur A 0,3 → 30; nur B 0,2 → 60; beide 0,2 → 60: 9 + 12 + 12 = 33 Minuten
    expect(k.durchlaufzeitMin).toBeCloseTo(33, 6)
    expect(k.arbeitszeitMin).toBeCloseTo(0.5 * 30 + 0.4 * 60, 10)
    expect(k.enden).toEqual([{ ergebnis: 'Fertig', anteil: expect.closeTo(1, 10), regulaer: true }])
  })

  it('setzt den Standardweg nur ein, wenn keiner der anderen läuft', () => {
    const s = aufgabe('Antrag freigeben', 10)
    const { o } = unterlagen([s])
    const k = berechneKennzahlen(prozess([o]))
    expect(k.schritte.get(s.id)?.haeufigkeit).toBeCloseTo(0.5 * 0.6, 10)
    expect(k.durchlaufzeitMin).toBeCloseTo(33 + 0.3 * 10, 6)
  })

  it('stimmt mit der Simulation überein', () => {
    const s = aufgabe('Antrag freigeben', 10)
    const { o } = unterlagen([s])
    const p = prozess([aufgabe('Antrag erfassen', 5), o, aufgabe('Antrag bescheiden', 15)])
    expect(simuliere(p, 40_000, 5).mittelMin).toBeCloseTo(berechneKennzahlen(p).durchlaufzeitMin, 0)
  })

  it('meldet fehlende Standardwege und typische Bedienfehler', () => {
    const arten = (o: Oder) => pruefeProzess(prozess([o])).map((x) => x.schluessel.split(':')[0])
    const zwei = (a: number, b: number) => [neuerOderZweig('A', a, { schritte: [aufgabe('A prüfen', 1)] }), neuerOderZweig('B', b, { schritte: [aufgabe('B prüfen', 1)] })]
    const ohneStandard = neueOder({ frage: 'Welche?', zweige: zwei(0.5, 0.5), standard: null })
    expect(arten(ohneStandard)).toContain('keiner')
    expect(arten(ohneStandard)).toContain('wie-entweder')
    const immer = neueOder({ frage: 'Welche?', zweige: zwei(1, 1), standard: null })
    expect(arten(immer)).toContain('immer-alle')
    expect(arten(immer)).not.toContain('keiner')
    expect(pruefeProzess(prozess([unterlagen().o])).filter((x) => x.schwere === 'fehler')).toEqual([])
  })

  it('exportiert ein inklusives Gateway mit Standardfluss, das bpmn-moddle liest', async () => {
    const { o } = unterlagen()
    const { xml, layout } = erzeugeBpmn(prozess([o]))
    const standardFluss = layout.kanten.find((k) => k.standard)
    expect(standardFluss).toBeDefined()
    expect(xml).toContain(`<bpmn:inclusiveGateway id="${o.id}_auf" name="Welche Unterlagen fehlen?" gatewayDirection="Diverging" default="${standardFluss!.id}">`)
    expect(xml).toContain(`<bpmn:inclusiveGateway id="${o.id}_zu" gatewayDirection="Converging">`)
    const { warnings } = await BpmnModdle().fromXML(xml)
    expect(warnings).toEqual([])
  })

  it('ist im Tokenspiel sound, und die Häufigkeiten stimmen mit den Formeln', async () => {
    const s = aufgabe('Antrag freigeben', 10)
    const { o, a, b } = unterlagen([s])
    const p = prozess([aufgabe('Antrag erfassen', 5), o, aufgabe('Antrag bescheiden', 15)])
    const { layout, xml } = erzeugeBpmn(p)
    const g = graphAusLayout(layout)
    expect(pruefeSoundness(g).fehler).toEqual([])
    expect(pruefeSoundness(await graphAusXml(xml)).fehler).toEqual([])
    const anteil = new Map(layout.kanten.filter((k) => k.anteil !== undefined).map((k) => [k.id, k.anteil!]))
    const n = zaehleAusfuehrungen(g, anteil, 20_000, zufallMitStartwert(9))
    expect(n.get(a.id)).toBeCloseTo(0.5, 1)
    expect(n.get(b.id)).toBeCloseTo(0.4, 1)
    expect(n.get(s.id)).toBeCloseTo(0.3, 1)
  })

  it('wartet im Tokenspiel auf alle gewählten Wege', () => {
    // Die Zusammenführung kennt den Bereich davor; ohne diese Regel würde sie beim ersten Weg schalten.
    const { o } = unterlagen()
    const g = graphAusLayout(erzeugeBpmn(prozess([o, aufgabe('Antrag bescheiden', 15)])).layout)
    const zu = g.knoten.find((k) => k.id === `${o.id}_zu`)!
    expect(zu.bereich?.length).toBeGreaterThan(0)
    const e = pruefeSoundness(g)
    expect(e.fehler).toEqual([])
    // mehr als eine Marke auf einem Fluss würde die Prüfung melden; also wird nie doppelt durchlaufen
    expect(e.vollstaendig).toBe(true)
  })

  it('kommt im Zufallsgenerator vor und bleibt dort fehlerfrei', () => {
    let anzahl = 0
    const fehler: string[] = []
    for (let s = 1; s <= 200; s++) {
      const p = zufallsProzess(s)
      for (const { block } of durchlaufe(p.ablauf)) if (block.typ === 'oder') anzahl++
      for (const x of pruefeProzess(p)) if (x.schwere === 'fehler') fehler.push(`${s}: ${x.titel}`)
    }
    expect(fehler).toEqual([])
    expect(anzahl).toBeGreaterThan(30)
  })

  it('stimmt auch in zufälligen Prozessen mit der Simulation überein', () => {
    const abweichungen: string[] = []
    let gezaehlt = 0
    for (let s = 1; s <= 150 && gezaehlt < 25; s++) {
      const p = zufallsProzess(s)
      if (![...durchlaufe(p.ablauf)].some((f) => f.block.typ === 'oder')) continue
      gezaehlt++
      const formel = berechneKennzahlen(p).durchlaufzeitMin
      const sim = simuliere(p, 20_000, s).mittelMin
      if (Math.abs(formel - sim) > 0.025 * Math.max(formel, 1)) abweichungen.push(`Startwert ${s}: Formel ${formel.toFixed(1)}, Simulation ${sim.toFixed(1)}`)
    }
    expect(gezaehlt).toBeGreaterThanOrEqual(20)
    expect(abweichungen).toEqual([])
  }, 60_000)
})
