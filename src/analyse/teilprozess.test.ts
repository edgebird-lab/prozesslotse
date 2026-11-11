/**
 * Abschnitt mit Namen (aufgeklappter Teilprozess): Rechnung, Prüfregeln,
 * Operationen, Führung, Layout, BPMN-Export und Tokenspiel, mit von Hand
 * nachgerechneten Werten (Design: docs/modellierung-v4.md, Abschnitt 1).
 */
import { BpmnModdle, type ModdleElement } from 'bpmn-moddle'
import { describe, expect, it } from 'vitest'
import { erzeugeBpmn } from '../bpmn/export'
import { graphAusLayout, pruefeSoundness, zaehleAusfuehrungen, zaehleMitFehler, type TokenGraph } from '../bpmn/tokenspiel'
import { neueAufgabe, neueEntscheidung, neueParallel, neuerProzess, neueRolle, neuerRuecksprungBereich, neuerTeilprozess, neuerZweig, neueSequenz } from '../modell/bausteine'
import { beispielLieferdienst, beispielOnlinebestellung, beispielProjekt } from '../modell/beispiel'
import { abschnittFertig, beschreibeCursor, cursorNachEinfuegen } from '../modell/fuehrung'
import { durchlaufe, fasseZusammen, findeBlock, findeSequenz, kannZusammenfassen, kinderSequenzen, loeseAbschnittAuf, nebenlaeufig, rahmenUeber, ruecksprungZiele, setzeRuecksprung } from '../modell/operationen'
import { pruefeProzess } from '../modell/pruefung'
import { alsJson, leseProjekt } from '../modell/speicher'
import type { Aufgabe, Block, Prozess, Rolle } from '../modell/typen'
import { graphAusXml } from '../testhilfen/bpmn-graph'
import { geometrieFehler } from '../testhilfen/geometrie'
import { standardfehler } from '../testhilfen/statistik'
import { zufallsProzess } from '../testhilfen/zufallsprozess'
import { berechneKennzahlen } from './kennzahlen'
import { simuliere, zufallMitStartwert } from './simulation'
import { erwartung, masse, verteilungSequenz } from './verteilung'
import { tokenZeiten } from '../testhilfen/tokenzeiten'

const LAGER = neueRolle('Lager', { personen: 3 })
const VERSAND = neueRolle('Versand')

function aufgabe(name: string, minuten: number, rolle: Rolle = LAGER): Aufgabe {
  return neueAufgabe({ name, bearbeitungMin: minuten, liegezeitMin: 0, rolleId: rolle.id })
}

function prozess(schritte: Block[]): Prozess {
  return neuerProzess({ name: 'Test', ergebnis: 'Fertig', rollen: [LAGER, VERSAND], ablauf: { id: 'haupt', schritte } })
}

/** Abschnitt [A 20 Min.; „Lieferbar?“ 90 % weiter, 10 % endet „nicht lieferbar“], danach B 30 Min. */
function lieferbar() {
  const a = aufgabe('Ware kommissionieren', 20)
  const nein = neuerZweig('Nein', 0.1, { ende: 'nicht lieferbar' })
  const e = neueEntscheidung({ frage: 'Lieferbar?', zweige: [neuerZweig('Ja', 0.9), nein] })
  const tp = neuerTeilprozess({ name: 'Ware bereitstellen', koerper: neueSequenz([a, e]) })
  const b = aufgabe('Ware verpacken', 30, VERSAND)
  return { p: prozess([tp, b]), tp, a, b, e, nein }
}

/** Zwei verschachtelte Abschnitte, Ende im inneren: [X 10, [Y 10, „Vorrätig?“ 20 % endet „storniert“], Z 10], danach W 10. */
function verschachtelt() {
  const y = aufgabe('Bestand prüfen', 10)
  const innen = neuerTeilprozess({ name: 'Bestand klären', koerper: neueSequenz([y, neueEntscheidung({ frage: 'Vorrätig?', zweige: [neuerZweig('Ja', 0.8), neuerZweig('Nein', 0.2, { ende: 'storniert' })] })]) })
  const z = aufgabe('Ware packen', 10)
  const aussen = neuerTeilprozess({ name: 'Auftrag abwickeln', koerper: neueSequenz([aufgabe('Auftrag erfassen', 10, VERSAND), innen, z]) })
  const w = aufgabe('Rechnung schreiben', 10, VERSAND)
  return { p: prozess([aussen, w]), aussen, innen, y, z, w }
}

function anteile(layout: ReturnType<typeof erzeugeBpmn>['layout']): Map<string, number> {
  return new Map(layout.kanten.filter((k) => k.anteil !== undefined).map((k) => [k.id, k.anteil!]))
}

/** Vergleichbare Form eines Graphen: Knoten mit Typ, Rahmen und Art, Flüsse von → nach */
function form(g: TokenGraph): string[] {
  const quelle = new Map<string, string>()
  for (const k of g.knoten) for (const f of k.raus) quelle.set(f, k.id)
  const knoten = g.knoten.map((k) => [k.id, k.typ, k.rahmen ?? '', k.endeArt ?? '', k.fehler ?? '', k.wirt ?? '', k.randArt ?? '', k.unterbrechend ?? '', k.mehrfach ? (k.mehrfach.nacheinander ? 'nacheinander' : 'gleichzeitig') : ''].join(':'))
  return [...knoten, ...[...g.ziel].map(([f, z]) => `${quelle.get(f)}->${z}`)].sort()
}

function kinder(e: ModdleElement): ModdleElement[] {
  return (e.flowElements ?? []) as ModdleElement[]
}

describe('Abschnitt: Rechnung', () => {
  it('rechnet wie die Folge seiner Schritte; ein Ende darin beendet den Vorgang', () => {
    const { p, a, b } = lieferbar()
    const k = berechneKennzahlen(p)
    // 20 + 0,9 · 30 = 47 Minuten
    expect(k.durchlaufzeitMin).toBeCloseTo(47, 9)
    expect(k.kritischeArbeitMin).toBeCloseTo(47, 9)
    expect(k.schritte.get(a.id)?.haeufigkeit).toBeCloseTo(1, 12)
    expect(k.schritte.get(b.id)?.haeufigkeit).toBeCloseTo(0.9, 12)
    expect(k.enden).toEqual([
      { ergebnis: 'Fertig', anteil: expect.closeTo(0.9, 12), regulaer: true },
      { ergebnis: 'nicht lieferbar', anteil: expect.closeTo(0.1, 12), regulaer: false },
    ])
    // Übergabe Lager → Versand nur, wenn es weitergeht
    expect(k.uebergaben).toBeCloseTo(0.9, 12)
  })

  it('liefert Teilverteilungen für Weiter und Ende mit zusammen Masse 1', () => {
    const { p } = lieferbar()
    const v = verteilungSequenz(p.ablauf.schritte, 'gesamt')
    // weiter: 20 + 30 = 50 Minuten mit 90 %; Ende „nicht lieferbar“ nach 20 Minuten mit 10 %
    expect(v.weiter.wert).toEqual([50])
    expect(v.weiter.masse[0]).toBeCloseTo(0.9, 12)
    expect(v.ende.get('nicht lieferbar')?.wert).toEqual([20])
    expect(masse(v.ende.get('nicht lieferbar')!)).toBeCloseTo(0.1, 12)
    expect(v.rueck.size).toBe(0)
    // Erwartung über alle Teile = Durchlaufzeit: 0,9 · 50 + 0,1 · 20 = 47
    const alle = { wert: [...v.weiter.wert, 20], masse: [...v.weiter.masse, ...v.ende.get('nicht lieferbar')!.masse] }
    expect(erwartung(alle)).toBeCloseTo(47, 9)
  })

  it('stimmt mit der Simulation überein, auch je Ergebnis', () => {
    const { p } = lieferbar()
    const sim = simuliere(p, 40_000, 3)
    expect(Math.abs(sim.mittelMin - 47)).toBeLessThan(4 * standardfehler(sim.zeiten) + 0.005 * 47)
    const nicht = sim.ergebnisse.find((e) => e.ergebnis === 'nicht lieferbar')!
    expect(nicht.mittelMin).toBeCloseTo(20, 9)
    expect(Math.abs(nicht.anteil - 0.1)).toBeLessThan(0.01)
  })

  it('rechnet verschachtelte Abschnitte mit Ende im inneren', () => {
    const { p, z, w } = verschachtelt()
    const k = berechneKennzahlen(p)
    // 10 + 10 + 0,8 · (10 + 10) = 36
    expect(k.durchlaufzeitMin).toBeCloseTo(36, 9)
    expect(k.schritte.get(z.id)?.haeufigkeit).toBeCloseTo(0.8, 12)
    expect(k.schritte.get(w.id)?.haeufigkeit).toBeCloseTo(0.8, 12)
    expect(k.enden.find((e) => e.ergebnis === 'storniert')?.anteil).toBeCloseTo(0.2, 12)
  })

  it('stimmt in zufälligen Prozessen mit Abschnitten mit Simulation und Tokenspiel überein', () => {
    const abweichungen: string[] = []
    let gezaehlt = 0
    for (let s = 1; s <= 300 && gezaehlt < 25; s++) {
      const p = zufallsProzess(s)
      if (![...durchlaufe(p.ablauf)].some((f) => f.block.typ === 'teilprozess')) continue
      gezaehlt++
      const k = berechneKennzahlen(p)
      const sim = simuliere(p, 20_000, s)
      // Toleranz aus der Streuung der Simulation: vier Standardfehler plus 0,5 %
      if (Math.abs(k.durchlaufzeitMin - sim.mittelMin) > 4 * standardfehler(sim.zeiten) + 0.005 * Math.max(k.durchlaufzeitMin, 1)) {
        abweichungen.push(`Startwert ${s}: Formel ${k.durchlaufzeitMin.toFixed(2)}, Simulation ${sim.mittelMin.toFixed(2)}`)
      }
      // Erwartung über Weiter- und Ende-Teil = Formel; Wiederholungen brechen die geometrische Reihe bei einer Restmasse unter 1e-7 je Glied ab
      const v = verteilungSequenz(p.ablauf.schritte, 'gesamt')
      const teile = [v.weiter, ...v.ende.values()]
      const gesamt = teile.reduce((x, t) => x + masse(t), 0)
      const mittel = teile.reduce((x, t) => x + erwartung(t) * masse(t), 0)
      if (Math.abs(gesamt - 1) > 1e-5 || Math.abs(mittel - k.durchlaufzeitMin) > 1e-4 * Math.max(1, k.durchlaufzeitMin)) abweichungen.push(`Startwert ${s}: Teilverteilungen Masse ${gesamt}, Mittel ${mittel} statt ${k.durchlaufzeitMin}`)
      // Häufigkeiten aus dem Tokenspiel = Formeln
      const { layout } = erzeugeBpmn(p)
      const gezaehltJe = zaehleMitFehler(graphAusLayout(layout), anteile(layout), 3_000, zufallMitStartwert(s), tokenZeiten(p, layout))
      for (const { block } of durchlaufe(p.ablauf)) {
        if (block.typ !== 'aufgabe') continue
        const formel = k.schritte.get(block.id)?.haeufigkeit ?? 0
        const x = gezaehltJe.get(block.id) ?? { mittel: 0, fehler: 0 }
        if (Math.abs(formel - x.mittel) > 4 * x.fehler + 0.01) abweichungen.push(`Startwert ${s}, ${block.name}: Formel ${formel.toFixed(3)}, Tokenspiel ${x.mittel.toFixed(3)}`)
      }
    }
    expect(gezaehlt).toBe(25)
    expect(abweichungen).toEqual([])
  }, 60_000)
})

describe('Abschnitt: BPMN', () => {
  it('exportiert einen aufgeklappten Teilprozess mit Fehler-Ende, Fehler und Fehler-Randereignis', async () => {
    const { p, tp, a, nein } = lieferbar()
    const { xml, layout } = erzeugeBpmn(p)
    const { rootElement, warnings } = await BpmnModdle().fromXML(xml)
    expect(warnings).toEqual([])
    const wurzel = (rootElement.rootElements ?? []) as (ModdleElement & { errorCode?: string; name?: string })[]
    const fehler = wurzel.find((e) => e.$type === 'bpmn:Error')!
    expect(fehler).toMatchObject({ id: 'Fehler_1', name: 'nicht lieferbar', errorCode: 'nicht lieferbar' })
    const prozessElement = wurzel.find((e) => e.$type === 'bpmn:Process')!
    const sub = kinder(prozessElement).find((e) => e.id === tp.id)!
    expect(sub.$type).toBe('bpmn:SubProcess')
    // innen: Start, Aufgabe, Entscheidung, normales Ende und Fehler-Ende
    const innen = kinder(sub).filter((e) => e.$type !== 'bpmn:SequenceFlow')
    expect(innen.map((e) => e.$type).sort()).toEqual(['bpmn:EndEvent', 'bpmn:EndEvent', 'bpmn:ExclusiveGateway', 'bpmn:StartEvent', 'bpmn:Task'])
    expect(innen.some((e) => e.id === a.id)).toBe(true)
    const fehlerEnde = innen.find((e) => e.id === `${nein.id}_ende`) as ModdleElement & { eventDefinitions: { $type: string; errorRef: { id: string } }[] }
    expect(fehlerEnde.eventDefinitions[0].$type).toBe('bpmn:ErrorEventDefinition')
    expect(fehlerEnde.eventDefinitions[0].errorRef.id).toBe('Fehler_1')
    // außen: Fehler-Randereignis am Abschnitt und ein Ende mit dem Ergebnis
    const rand = kinder(prozessElement).find((e) => e.$type === 'bpmn:BoundaryEvent') as ModdleElement & { attachedToRef: { id: string }; cancelActivity: boolean; eventDefinitions: { errorRef: { id: string } }[] }
    expect(rand.attachedToRef.id).toBe(tp.id)
    expect(rand.cancelActivity).toBe(true)
    expect(rand.eventDefinitions[0].errorRef.id).toBe('Fehler_1')
    const ende = kinder(prozessElement).find((e) => e.id === `${tp.id}_fehler_1_ende`) as ModdleElement & { name: string }
    expect(ende.$type).toBe('bpmn:EndEvent')
    expect(ende.name).toBe('nicht lieferbar')
    // Diagramm: aufgeklappt; im Bahnensatz nur der Teilprozess, nicht sein Inhalt
    expect(xml).toContain(`<bpmndi:BPMNShape id="${tp.id}_di" bpmnElement="${tp.id}" isExpanded="true">`)
    expect(xml).toContain(`<bpmn:flowNodeRef>${tp.id}</bpmn:flowNodeRef>`)
    expect(xml).not.toContain(`<bpmn:flowNodeRef>${a.id}</bpmn:flowNodeRef>`)
    expect(geometrieFehler(layout)).toEqual([])
  })

  it('setzt bei verschachtelten Abschnitten nur ein Fehler-Randereignis, am äußeren', async () => {
    const { p, aussen, innen } = verschachtelt()
    const { xml, layout } = erzeugeBpmn(p)
    const raender = layout.knoten.filter((k) => k.art === 'rand')
    expect(raender).toHaveLength(1)
    expect(raender[0].wirt).toBe(aussen.id)
    expect(layout.rahmen.find((r) => r.id === innen.id)?.eltern).toBe(aussen.id)
    const { rootElement, warnings } = await BpmnModdle().fromXML(xml)
    expect(warnings).toEqual([])
    const prozessElement = (rootElement.rootElements ?? []).find((e) => e.$type === 'bpmn:Process')!
    const aussenElement = kinder(prozessElement).find((e) => e.id === aussen.id)!
    expect(kinder(aussenElement).some((e) => e.id === innen.id && e.$type === 'bpmn:SubProcess')).toBe(true)
    expect(geometrieFehler(layout)).toEqual([])
  })

  it('ist im Tokenspiel sound, auf dem Layout und auf dem gelesenen XML, und zählt dieselben Häufigkeiten', async () => {
    for (const { p } of [lieferbar(), verschachtelt()]) {
      const { layout, xml } = erzeugeBpmn(p)
      const g = graphAusLayout(layout)
      const x = await graphAusXml(xml)
      expect(form(x)).toEqual(form(g))
      expect(pruefeSoundness(g).fehler).toEqual([])
      expect(pruefeSoundness(x).fehler).toEqual([])
      const k = berechneKennzahlen(p)
      const n = zaehleMitFehler(g, anteile(layout), 20_000, zufallMitStartwert(7), tokenZeiten(p, layout))
      for (const { block } of durchlaufe(p.ablauf)) {
        if (block.typ !== 'aufgabe') continue
        const zaehlung = n.get(block.id)!
        expect(Math.abs(zaehlung.mittel - k.schritte.get(block.id)!.haeufigkeit)).toBeLessThan(4 * zaehlung.fehler + 0.01)
      }
    }
  })

  it('rückt einen Bahnwechsel hinter einen Abschnitt in einem anderen Zweig', () => {
    // Gleichzeitig: Zweig 1 = Abschnitt in Bahn B, Zweig 2 = Aufgabe in A, dann Aufgabe in C (Bahnen A, B, C)
    const A = neueRolle('A')
    const B = neueRolle('B')
    const C = neueRolle('C')
    const par = neueParallel(2)
    const abschnitt = neuerTeilprozess({ name: 'Abschnitt in B', koerper: neueSequenz([neueAufgabe({ name: 'Eins erledigen', rolleId: B.id }), neueAufgabe({ name: 'Zwei erledigen', rolleId: B.id })]) })
    const vier = neueAufgabe({ name: 'Vier erledigen', rolleId: C.id })
    par.zweige[0].schritte = [abschnitt]
    par.zweige[1].schritte = [neueAufgabe({ name: 'Drei erledigen', rolleId: A.id }), vier]
    const p = neuerProzess({ name: 'Bahnwechsel', rollen: [A, B, C], ablauf: { id: 'haupt', schritte: [par] } })
    const { layout } = erzeugeBpmn(p)
    expect(geometrieFehler(layout)).toEqual([])
    const rahmen = layout.rahmen.find((r) => r.blockId === abschnitt.id)!
    const knotenVier = layout.knoten.find((k) => k.id === vier.id)!
    expect(knotenVier.spalte).toBeGreaterThan(rahmen.spalteBis)
    // Der Bahnwechsel von A nach C liegt rechts des Rahmens
    const wechsel = layout.kanten.find((e) => e.nach === vier.id)!
    const senkrecht = wechsel.punkte.find((q, i) => i > 0 && Math.abs(q.x - wechsel.punkte[i - 1].x) < 0.5)!
    expect(senkrecht.x).toBeGreaterThan(rahmen.x + rahmen.breite)
  })

  it('legt Rahmen, Randereignisse und Beschriftungen in 300 Zufallsprozessen nach den Zeichenregeln', () => {
    let rahmen = 0
    let verschachtelt = 0
    let fehlerEnden = 0
    const fehler: string[] = []
    for (let s = 1; s <= 300; s++) {
      const { layout } = erzeugeBpmn(zufallsProzess(s))
      rahmen += layout.rahmen.length
      verschachtelt += layout.rahmen.filter((r) => r.eltern !== null).length
      fehlerEnden += layout.knoten.filter((k) => k.art === 'rand').length
      for (const f of geometrieFehler(layout)) fehler.push(`Startwert ${s}: ${f}`)
    }
    expect(fehler.slice(0, 5)).toEqual([])
    expect(rahmen).toBeGreaterThan(60)
    expect(verschachtelt).toBeGreaterThan(5)
    expect(fehlerEnden).toBeGreaterThan(10)
  }, 60_000)
})

describe('Abschnitt: Modell', () => {
  it('kennt den Körper als Kindsequenz; Rahmen und nebenläufige Umgebung folgen aus der Kette', () => {
    const { p, tp, a } = lieferbar()
    expect(kinderSequenzen(tp)).toEqual([tp.koerper])
    const f = findeBlock(p, a.id)!
    expect(f.vorfahren.map((b) => b.id)).toEqual([tp.id])
    expect(rahmenUeber(f.kette).map((b) => b.id)).toEqual([tp.id])
    expect(nebenlaeufig(f.kette)).toBe(false)
    expect(findeSequenz(p, tp.koerper.id)?.besitzer?.id).toBe(tp.id)
    // im Zweig von Gleichzeitig ist auch der Abschnitt darin nebenläufig
    const par = neueParallel(2)
    par.zweige[0].schritte = [tp]
    par.zweige[1].schritte = [aufgabe('Rechnung schreiben', 5)]
    expect(nebenlaeufig(findeBlock(prozess([par]), a.id)!.kette)).toBe(true)
  })

  it('springt nicht über die Grenze eines Abschnitts zurück', () => {
    const x = aufgabe('Daten erfassen', 5)
    const y = aufgabe('Daten prüfen', 5)
    const e = neueEntscheidung({ frage: 'Daten korrekt?', zweige: [neuerZweig('Ja', 0.9), neuerZweig('Nein', 0.1)] })
    const tp = neuerTeilprozess({ name: 'Prüfen', koerper: neueSequenz([y, e]) })
    const p = prozess([x, tp])
    const ort = findeBlock(p, e.id)!
    // angeboten werden nur Ziele im Abschnitt
    expect(ruecksprungZiele(p, ort.sequenz.id, ort.index, true).map((z) => z.id)).toEqual([y.id, e.id])
    expect(setzeRuecksprung(p, e.id, e.zweige[1].id, x.id)).toBe(p)
    const innen = setzeRuecksprung(p, e.id, e.zweige[1].id, y.id)
    expect(innen).not.toBe(p)
    expect(pruefeProzess(innen).filter((b) => b.schwere === 'fehler')).toEqual([])
  })

  it('fasst Schritte zu einem Abschnitt zusammen und löst ihn wieder auf', () => {
    const schritte = [aufgabe('Auftrag erfassen', 5), aufgabe('Ware kommissionieren', 10), aufgabe('Ware verpacken', 5), aufgabe('Rechnung schreiben', 5)]
    const p = prozess(schritte)
    const q = fasseZusammen(p, 'haupt', 1, 2, 'Ware versenden')
    expect(q.ablauf.schritte).toHaveLength(3)
    const tp = q.ablauf.schritte[1]
    expect(tp.typ === 'teilprozess' && tp.name).toBe('Ware versenden')
    expect(tp.typ === 'teilprozess' && tp.koerper.schritte.map((b) => b.id)).toEqual([schritte[1].id, schritte[2].id])
    expect(berechneKennzahlen(q).durchlaufzeitMin).toBeCloseTo(berechneKennzahlen(p).durchlaufzeitMin, 12)
    const r = loeseAbschnittAuf(q, tp.id)
    expect(r.ablauf.schritte.map((b) => b.id)).toEqual(schritte.map((b) => b.id))
    // ungültige Bereiche ändern nichts
    expect(fasseZusammen(p, 'haupt', 2, 1, 'X')).toBe(p)
    expect(fasseZusammen(p, 'haupt', 3, 4, 'X')).toBe(p)
  })

  it('fasst nicht zusammen, wenn ein Rücksprung die neue Grenze queren würde', () => {
    const x = aufgabe('Daten erfassen', 5)
    const e = neueEntscheidung({ frage: 'Daten korrekt?', zweige: [neuerZweig('Ja', 0.9), neuerZweig('Nein', 0.1)] })
    const p = setzeRuecksprung(prozess([x, e, aufgabe('Daten speichern', 5)]), e.id, e.zweige[1].id, x.id)
    const bereich = p.ablauf.schritte[0]
    expect(bereich.typ === 'wiederholung' && bereich.modus).toBe('ruecksprung')
    // Die Entscheidung allein springt hinaus zurück; der ganze Bereich lässt sich zusammenfassen
    const koerper = bereich.typ === 'wiederholung' ? bereich.koerper : neueSequenz()
    expect(kannZusammenfassen(p, koerper.id, 1, 1)).toBe(false)
    expect(kannZusammenfassen(p, 'haupt', 0, 1)).toBe(true)
    expect(pruefeProzess(fasseZusammen(p, 'haupt', 0, 1, 'Erfassen')).filter((b) => b.schwere === 'fehler')).toEqual([])
  })

  it('führt in den Abschnitt hinein und danach dahinter weiter', () => {
    const { p, tp, a } = lieferbar()
    expect(cursorNachEinfuegen(tp, { sequenzId: 'haupt', index: 0 })).toEqual({ sequenzId: tp.koerper.id, index: tp.koerper.schritte.length })
    const ort = beschreibeCursor(p, { sequenzId: tp.koerper.id, index: 1 })
    expect(ort.bereich).toBe('im Abschnitt „Ware bereitstellen“')
    expect(ort.position).toBe(`nach „${a.name}“`)
    expect(ort.weiterText).toBe('Weiter nach „Ware bereitstellen“')
    expect(abschnittFertig(p, { sequenzId: tp.koerper.id, index: 2 })).toEqual({ sequenzId: 'haupt', index: 1 })
  })
})

describe('Abschnitt: Prüfregeln', () => {
  const schluessel = (p: Prozess) => pruefeProzess(p).map((b) => `${b.schwere}:${b.schluessel.split(':')[0]}`)

  it('meldet leere und unbenannte Abschnitte', () => {
    const leer = neuerTeilprozess({ name: 'Leer' })
    expect(schluessel(prozess([leer]))).toContain('fehler:leer')
    const ohneName = neuerTeilprozess({ koerper: neueSequenz([aufgabe('Ware packen', 5)]) })
    expect(schluessel(prozess([ohneName]))).toContain('warnung:name')
    expect(pruefeProzess(lieferbar().p).filter((b) => b.schwere === 'fehler')).toEqual([])
  })

  it('weist auf mehrere Rollen in einem Abschnitt hin und nennt die Bahn', () => {
    const tp = neuerTeilprozess({ name: 'Versand', koerper: neueSequenz([aufgabe('Ware packen', 5, VERSAND), aufgabe('Ware prüfen', 5), aufgabe('Ware buchen', 5, VERSAND)]) })
    const b = pruefeProzess(prozess([tp])).find((x) => x.schluessel === `rahmenbahn:${tp.id}`)
    expect(b?.schwere).toBe('hinweis')
    expect(b?.text).toContain('in der Bahn „Versand“')
  })

  it('meldet einen Rücksprung aus einem Abschnitt hinaus, auch in von Hand gebauten Dateien', () => {
    const x = aufgabe('Daten erfassen', 5)
    const e = neueEntscheidung({ frage: 'Korrekt?', zweige: [neuerZweig('Ja', 0.9), neuerZweig('Nein', 0.1)] })
    const bereich = neuerRuecksprungBereich([x, neuerTeilprozess({ name: 'Prüfen', koerper: neueSequenz([e]) })])
    e.zweige[1].zurueckZu = bereich.id
    const p = prozess([bereich])
    expect(schluessel(p)).toContain('fehler:rahmenrueck')
    // Das BPMN bleibt gültig: Der Rücksprung über die Grenze entfällt dort.
    expect(geometrieFehler(erzeugeBpmn(p).layout)).toEqual([])
  })

  it('erlaubt ein Ende in einem Abschnitt, der selbst in einem Zweig von Gleichzeitig liegt (Terminierung hinter dem Randereignis)', () => {
    const par = neueParallel(2)
    const { tp } = lieferbar()
    par.zweige[0].schritte = [tp]
    par.zweige[1].schritte = [aufgabe('Rechnung schreiben', 5)]
    const p = prozess([par])
    expect(schluessel(p).filter((s) => s.startsWith('fehler'))).toEqual([])
    // Das Randereignis am Abschnitt führt zu einer Terminierung: Sie bricht auch den anderen Zweig ab, die Zusammenführung wartet nicht ewig.
    const { layout } = erzeugeBpmn(p)
    const hinterRand = layout.knoten.filter((k) => k.art === 'ende' && k.blockId === tp.id && (k.rahmen ?? null) === null)
    expect(hinterRand.length).toBeGreaterThan(0)
    expect(hinterRand.every((k) => k.terminierung)).toBe(true)
    expect(pruefeSoundness(graphAusLayout(layout)).fehler).toEqual([])
  })
})

describe('Tokenspiel mit Rahmen', () => {
  // Rahmen F: innen Start → Gleichzeitig → (A → Fehler-Ende) und (B → Ende); Fehler-Randereignis an F → Ende „Abbruch“
  const graph: TokenGraph = {
    knoten: [
      { id: 's', typ: 'start', rein: [], raus: ['f1'], rahmen: null },
      { id: 'F', typ: 'rahmen', rein: ['f1'], raus: ['f2'], rahmen: null },
      { id: 'e', typ: 'ende', rein: ['f2'], raus: [], rahmen: null, endeArt: 'normal' },
      { id: 'r', typ: 'rand', rein: [], raus: ['f3'], rahmen: null, wirt: 'F', randArt: 'fehler', unterbrechend: true, fehler: 'X' },
      { id: 'e2', typ: 'ende', rein: ['f3'], raus: [], rahmen: null, endeArt: 'normal' },
      { id: 'is', typ: 'start', rein: [], raus: ['g1'], rahmen: 'F' },
      { id: 'und', typ: 'und', rein: ['g1'], raus: ['g2', 'g3'], rahmen: 'F' },
      { id: 'A', typ: 'aktivitaet', rein: ['g2'], raus: ['g4'], rahmen: 'F' },
      { id: 'fe', typ: 'ende', rein: ['g4'], raus: [], rahmen: 'F', endeArt: 'fehler', fehler: 'X' },
      { id: 'B', typ: 'aktivitaet', rein: ['g3'], raus: ['g5'], rahmen: 'F' },
      { id: 'ie', typ: 'ende', rein: ['g5'], raus: [], rahmen: 'F', endeArt: 'normal' },
    ],
    ziel: new Map([
      ['f1', 'F'],
      ['f2', 'e'],
      ['f3', 'e2'],
      ['g1', 'und'],
      ['g2', 'A'],
      ['g3', 'B'],
      ['g4', 'fe'],
      ['g5', 'ie'],
    ]),
  }

  it('lässt den Abbruch zuletzt schalten: Was im Rahmen noch laufen kann, läuft vorher', () => {
    const e = pruefeSoundness(graph)
    // Der Rahmen endet hier nie normal (das Fehler-Ende kommt immer); sonst ist alles erreichbar
    expect(e.fehler).toEqual(['Element e wird nie ausgeführt'])
    expect(e.vollstaendig).toBe(true)
    // B läuft in jedem Vorgang, obwohl A abbricht: abgebrochene Arbeit zählt voll
    const n = zaehleAusfuehrungen(graph, new Map(), 1_000, zufallMitStartwert(1))
    expect(n.get('A')).toBe(1)
    expect(n.get('B')).toBe(1)
  })

  it('fängt einen Fehler am äußeren von zwei Rahmen und leert beide', () => {
    // G liegt in F; das Fehler-Ende in G steigt zum Randereignis von F auf
    const g: TokenGraph = {
      knoten: [
        { id: 's', typ: 'start', rein: [], raus: ['f1'] },
        { id: 'F', typ: 'rahmen', rein: ['f1'], raus: ['f2'] },
        { id: 'e', typ: 'ende', rein: ['f2'], raus: [] },
        { id: 'r', typ: 'rand', rein: [], raus: ['f3'], wirt: 'F', randArt: 'fehler', fehler: 'X' },
        { id: 'e2', typ: 'ende', rein: ['f3'], raus: [] },
        { id: 'fs', typ: 'start', rein: [], raus: ['g1'], rahmen: 'F' },
        { id: 'G', typ: 'rahmen', rein: ['g1'], raus: ['g2'], rahmen: 'F' },
        { id: 'fe', typ: 'ende', rein: ['g2'], raus: [], rahmen: 'F' },
        { id: 'gs', typ: 'start', rein: [], raus: ['h1'], rahmen: 'G' },
        { id: 'x', typ: 'xor', rein: ['h1'], raus: ['h2', 'h3'], rahmen: 'G' },
        { id: 'ge', typ: 'ende', rein: ['h2'], raus: [], rahmen: 'G' },
        { id: 'gf', typ: 'ende', rein: ['h3'], raus: [], rahmen: 'G', endeArt: 'fehler', fehler: 'X' },
      ],
      ziel: new Map([
        ['f1', 'F'],
        ['f2', 'e'],
        ['f3', 'e2'],
        ['g1', 'G'],
        ['g2', 'fe'],
        ['h1', 'x'],
        ['h2', 'ge'],
        ['h3', 'gf'],
      ]),
    }
    expect(pruefeSoundness(g).fehler).toEqual([])
    const n = zaehleAusfuehrungen(g, new Map([['h2', 0.75], ['h3', 0.25]]), 1, zufallMitStartwert(1))
    // keine Aktivitäten, nur Endereignisse: Der Lauf endet ohne Verklemmung
    expect([...n.keys()].every((id) => g.knoten.find((k) => k.id === id)?.typ === 'ende')).toBe(true)
  })

  it('beendet mit einer Terminierung nur die eigene Ebene', () => {
    // Im Rahmen F: Gleichzeitig → (A → Terminierung) und (B → Ende); F endet danach normal, außen geht es weiter zu C
    const g: TokenGraph = {
      knoten: [
        { id: 's', typ: 'start', rein: [], raus: ['f1'] },
        { id: 'F', typ: 'rahmen', rein: ['f1'], raus: ['f2'] },
        { id: 'C', typ: 'aktivitaet', rein: ['f2'], raus: ['f3'] },
        { id: 'e', typ: 'ende', rein: ['f3'], raus: [] },
        { id: 'is', typ: 'start', rein: [], raus: ['g1'], rahmen: 'F' },
        { id: 'und', typ: 'und', rein: ['g1'], raus: ['g2', 'g3'], rahmen: 'F' },
        { id: 'A', typ: 'aktivitaet', rein: ['g2'], raus: ['g4'], rahmen: 'F' },
        { id: 't', typ: 'ende', rein: ['g4'], raus: [], rahmen: 'F', endeArt: 'terminierung' },
        { id: 'B', typ: 'aktivitaet', rein: ['g3'], raus: ['g5'], rahmen: 'F' },
        { id: 'ie', typ: 'ende', rein: ['g5'], raus: [], rahmen: 'F' },
      ],
      ziel: new Map([
        ['f1', 'F'],
        ['f2', 'C'],
        ['f3', 'e'],
        ['g1', 'und'],
        ['g2', 'A'],
        ['g3', 'B'],
        ['g4', 't'],
        ['g5', 'ie'],
      ]),
    }
    expect(pruefeSoundness(g).fehler).toEqual([])
    const n = zaehleAusfuehrungen(g, new Map(), 100, zufallMitStartwert(2))
    expect(n.get('C')).toBe(1)
  })
})

describe('Dateiformat 4', () => {
  /** FNV-1a über das exportierte XML */
  const pruefsumme = (s: string) => {
    let h = 0x811c9dc5
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(16)
  }

  it('liest eine Datei im Format 3 und ergibt dasselbe Projekt, dieselben Kennzahlen und dasselbe BPMN', () => {
    const projekt = beispielProjekt()
    const alt = JSON.parse(alsJson(projekt))
    alt.formatVersion = 3
    alt.ist.formatVersion = 3
    const ohneArt = (x: unknown): void => {
      if (Array.isArray(x)) return x.forEach(ohneArt)
      if (typeof x !== 'object' || x === null) return
      const o = x as Record<string, unknown>
      if (o.typ === 'parallel') delete o.art
      Object.values(o).forEach(ohneArt)
    }
    ohneArt(alt.ist.ablauf)
    expect(JSON.stringify(alt)).not.toContain('"art":"alle"')
    const neu = leseProjekt(alt)
    expect(neu).toEqual(projekt)
    expect(neu.formatVersion).toBe(4)
    expect(berechneKennzahlen(neu.ist).durchlaufzeitMin).toBeCloseTo(berechneKennzahlen(projekt.ist).durchlaufzeitMin, 12)
    // Dasselbe BPMN vor und nach dem Lesen. Die Prüfsummen hielten bis zur Trennung langer Parallelen den Stand von Format 3
    // fest (Commit 71820c2: fe7d9917 und eab2a465); seitdem liegen lange parallele Linien weiter auseinander, sonst ist alles gleich.
    expect(erzeugeBpmn(neu.ist).xml).toBe(erzeugeBpmn(projekt.ist).xml)
    expect(pruefsumme(erzeugeBpmn(beispielLieferdienst()).xml)).toBe('5a85386d')
    expect(pruefsumme(erzeugeBpmn(beispielOnlinebestellung()).xml)).toBe('7dc759c0')
  })

  it('speichert Abschnitte und lädt sie unverändert', () => {
    const { p } = verschachtelt()
    const projekt = { formatVersion: 4 as const, ist: p, soll: null, massnahmen: [], verworfen: [] }
    expect(leseProjekt(JSON.parse(alsJson(projekt)))).toEqual(projekt)
    const kaputt = JSON.parse(alsJson(projekt))
    delete kaputt.ist.ablauf.schritte[0].name
    expect(() => leseProjekt(kaputt)).toThrow('Abschnitt ohne Namensfeld')
    const fremdeArt = JSON.parse(alsJson({ ...projekt, ist: prozess([neueParallel(2)]) }))
    fremdeArt.ist.ablauf.schritte[0].art = 'irgendwann'
    expect(() => leseProjekt(fremdeArt)).toThrow('unbekannte Art von „Gleichzeitig“')
  })
})
