/**
 * ODER-Verzweigung (inklusives Gateway): Häufigkeiten, Dauer, Simulation,
 * Prüfregeln, BPMN-Export und Tokenspiel, mit von Hand nachgerechneten Werten.
 */
import { describe, expect, it } from 'vitest'
import { BpmnModdle } from 'bpmn-moddle'
import { erzeugeBpmn } from '../bpmn/export'
import { graphAusLayout, pruefeSoundness, zaehleAusfuehrungen } from '../bpmn/tokenspiel'
import { neueAufgabe, neueOder, neuerOderZweig, neuerProzess, neueRolle } from '../modell/bausteine'
import { durchlaufe, oderZiehung } from '../modell/operationen'
import { pruefeProzess } from '../modell/pruefung'
import type { Aufgabe, Block, Oder, Prozess } from '../modell/typen'
import { graphAusXml } from '../testhilfen/bpmn-graph'
import { zufallsProzess } from '../testhilfen/zufallsprozess'
import { berechneKennzahlen } from './kennzahlen'
import { standardfehler } from '../testhilfen/statistik'
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
    // ohne Standardweg heißt es „mindestens einer“: zusammen unter 100 % ist ein Fehler, genau 100 % wie Entweder-oder
    const zuWenig = neueOder({ frage: 'Welche?', zweige: zwei(0.4, 0.5), standard: null })
    expect(arten(zuWenig)).toContain('keiner')
    const genau = neueOder({ frage: 'Welche?', zweige: zwei(0.5, 0.5), standard: null })
    expect(arten(genau)).not.toContain('keiner')
    expect(arten(genau)).toContain('wie-entweder')
    expect(arten(neueOder({ frage: 'Welche?', zweige: zwei(0.7, 0.6), standard: null }))).not.toContain('keiner')
    const immer = neueOder({ frage: 'Welche?', zweige: zwei(1, 1), standard: null })
    expect(arten(immer)).toContain('immer-alle')
    expect(arten(immer)).not.toContain('keiner')
    expect(pruefeProzess(prozess([unterlagen().o])).filter((x) => x.schwere === 'fehler')).toEqual([])
  })

  it('rechnet „mindestens einer“ ohne Standardweg mit den eingegebenen Häufigkeiten', () => {
    // A 70 %, B 60 %, nie keiner: beide zugleich in 0,7 + 0,6 − 1 = 30 %, nur A 40 %, nur B 30 %
    const a = aufgabe('Gehaltsnachweis anfordern', 30)
    const b = aufgabe('Ausweis anfordern', 60)
    const o = neueOder({ frage: 'Welche Unterlagen fehlen?', zweige: [neuerOderZweig('Gehalt', 0.7, { schritte: [a] }), neuerOderZweig('Ausweis', 0.6, { schritte: [b] })], standard: null })
    const zug = oderZiehung(o)
    expect(zug.ausschliessend).toBe(false)
    expect(zug.z).toBeCloseTo(0.3 / 0.42, 9)
    expect(zug.r[0]).toBeCloseTo(0.5, 9)
    const p = prozess([o])
    const k = berechneKennzahlen(p)
    expect(k.schritte.get(a.id)?.haeufigkeit).toBeCloseTo(0.7, 9)
    expect(k.schritte.get(b.id)?.haeufigkeit).toBeCloseTo(0.6, 9)
    expect(k.durchlaufzeitMin).toBeCloseTo(0.4 * 30 + 0.3 * 60 + 0.3 * 60, 6)
    const sim = simuliere(p, 40_000, 3)
    expect(Math.abs(sim.mittelMin - 48)).toBeLessThan(4 * standardfehler(sim.zeiten) + 0.1)
    // Tokenspiel würfelt genauso: leere Auswahl wird neu gewürfelt
    const { layout } = erzeugeBpmn(p)
    const anteil = new Map(layout.kanten.filter((e) => e.anteil !== undefined).map((e) => [e.id, e.anteil!]))
    const n = zaehleAusfuehrungen(graphAusLayout(layout), anteil, 20_000, zufallMitStartwert(4))
    expect(n.get(a.id)).toBeCloseTo(0.7, 1)
    expect(n.get(b.id)).toBeCloseTo(0.6, 1)
  })

  it('behandelt zusammen höchstens 100 % ohne Standardweg als „genau einer“', () => {
    const a = aufgabe('A', 30)
    const b = aufgabe('B', 60)
    const o = neueOder({ frage: 'Welche?', zweige: [neuerOderZweig('A', 0.5, { schritte: [a] }), neuerOderZweig('B', 0.5, { schritte: [b] })], standard: null })
    expect(oderZiehung(o).ausschliessend).toBe(true)
    const p = prozess([o])
    expect(berechneKennzahlen(p).durchlaufzeitMin).toBeCloseTo(45, 6)
    expect(simuliere(p, 20_000, 8).mittelMin).toBeCloseTo(45, 0)
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
      const sim = simuliere(p, 20_000, s)
      // Toleranz aus der Streuung der Simulation: vier Standardfehler plus 0,5 %
      if (Math.abs(formel - sim.mittelMin) > 4 * standardfehler(sim.zeiten) + 0.005 * Math.max(formel, 1)) {
        abweichungen.push(`Startwert ${s}: Formel ${formel.toFixed(2)}, Simulation ${sim.mittelMin.toFixed(2)}`)
      }
    }
    expect(gezaehlt).toBeGreaterThanOrEqual(20)
    expect(abweichungen).toEqual([])
  }, 60_000)
})
