/**
 * Arten von „Gleichzeitig“: alle, weiter beim ersten (Teilprozess mit
 * Terminierung je Zweig) und in beliebiger Reihenfolge (Ad-hoc-Teilprozess).
 * Rechnung, Prüfregeln, Operationen, Führung, Layout, BPMN-Export und
 * Tokenspiel, mit von Hand nachgerechneten Werten (Design:
 * docs/modellierung-v4.md, Abschnitt 4).
 */
import { BpmnModdle, type ModdleElement } from 'bpmn-moddle'
import { describe, expect, it } from 'vitest'
import { erzeugeBpmn } from '../bpmn/export'
import { RAHMEN_RAND } from '../bpmn/linien'
import { graphAusLayout, pruefeSoundness, zaehleMitFehler, type TokenGraph } from '../bpmn/tokenspiel'
import { neueAufgabe, neueEntscheidung, neueParallel, neuerProzess, neueRolle, neuerRuecksprungBereich, neuerTeilprozess, neuerZweig, neueSequenz } from '../modell/bausteine'
import { abschnittFertig, beschreibeCursor, cursorNachEinfuegen } from '../modell/fuehrung'
import { ausgaengeBlock, blockTitel, durchlaufe, einzelneAktivitaet, findeBlock, findeSequenz, nebenlaeufig, rahmenUeber, ruecksprungZiele, setzeRuecksprung } from '../modell/operationen'
import { pruefeProzess } from '../modell/pruefung'
import { alsJson, leseProjekt } from '../modell/speicher'
import type { Aufgabe, Block, Parallel, ParallelArt, Prozess, Rolle } from '../modell/typen'
import { graphAusXml } from '../testhilfen/bpmn-graph'
import { geometrieFehler } from '../testhilfen/geometrie'
import { standardfehler } from '../testhilfen/statistik'
import { zufallsProzess } from '../testhilfen/zufallsprozess'
import { findeSchwachstellen } from './hinweise'
import { berechneKennzahlen } from './kennzahlen'
import { simuliere, zufallMitStartwert } from './simulation'
import { erwartung, ersterAusgang, masse, verteilungSequenz, zuerstFertig } from './verteilung'
import { tokenZeiten } from '../testhilfen/tokenzeiten'

const LAGER = neueRolle('Lager', { personen: 1 })
const BUERO = neueRolle('Büro')
const BUCHHALTUNG = neueRolle('Buchhaltung')

function aufgabe(name: string, minuten: number, rolle: Rolle = LAGER, liegezeitMin = 0): Aufgabe {
  return neueAufgabe({ name, bearbeitungMin: minuten, liegezeitMin, rolleId: rolle.id })
}

function prozess(schritte: Block[]): Prozess {
  return neuerProzess({ name: 'Test', ergebnis: 'Fertig', rollen: [LAGER, BUERO, BUCHHALTUNG], ablauf: { id: 'haupt', schritte } })
}

function gleichzeitig(art: ParallelArt, ...zweige: Block[][]): Parallel {
  const b = neueParallel(zweige.length, art)
  return { ...b, zweige: zweige.map((schritte) => neueSequenz(schritte)) }
}

/** Design: A 30 Min.; B Entscheidung 50 % 10 Min. / 50 % 50 Min.; weiter beim ersten */
function angebote() {
  const a = aufgabe('Angebot A einholen', 30)
  const b10 = aufgabe('Angebot B schnell einholen', 10)
  const b50 = aufgabe('Angebot B langsam einholen', 50)
  const e = neueEntscheidung({ frage: 'Antwortet B schnell?', zweige: [neuerZweig('Ja', 0.5, { schritte: [b10] }), neuerZweig('Nein', 0.5, { schritte: [b50] })] })
  const par = gleichzeitig('erster', [a], [e])
  return { p: prozess([par]), par, a, b10, b50 }
}

/** Design: Zweige 20, 30, 40 Min. in beliebiger Reihenfolge; mit Ende im ersten Zweig in 20 % */
function unterlagen(mitEnde: boolean) {
  const a = aufgabe('Unterlagen prüfen', 20, BUERO)
  const ende = neueEntscheidung({ frage: 'Vollständig?', zweige: [neuerZweig('Ja', 0.8), neuerZweig('Nein', 0.2, { ende: 'abgelehnt' })] })
  const b = aufgabe('Termin vereinbaren', 30, LAGER)
  const c = aufgabe('Akte anlegen', 40, BUERO)
  const par = gleichzeitig('nacheinander', mitEnde ? [a, ende] : [a], [b], [c])
  return { p: prozess([par]), par, a, b, c }
}

function anteile(layout: ReturnType<typeof erzeugeBpmn>['layout']): Map<string, number> {
  return new Map(layout.kanten.filter((k) => k.anteil !== undefined).map((k) => [k.id, k.anteil!]))
}

/** Vergleichbare Form eines Graphen, mit Ad-hoc-Rahmen und ihren Aktivitäten */
function form(g: TokenGraph): string[] {
  const quelle = new Map<string, string>()
  for (const k of g.knoten) for (const f of k.raus) quelle.set(f, k.id)
  const knoten = g.knoten.map((k) => [k.id, k.typ, k.rahmen ?? '', k.endeArt ?? '', k.fehler ?? '', k.wirt ?? '', k.randArt ?? '', k.unterbrechend ?? '', k.mehrfach ? (k.mehrfach.nacheinander ? 'nacheinander' : 'gleichzeitig') : '', k.adhoc ? `adhoc:${[...k.adhoc].sort().join(',')}` : ''].join(':'))
  return [...knoten, ...[...g.ziel].map(([f, z]) => `${quelle.get(f)}->${z}`)].sort()
}

/** Häufigkeiten aus dem Tokenspiel gegen die Formeln, Toleranz aus dem Standardfehler */
function tokenAbweichungen(p: Prozess, laeufe: number, startwert: number): string[] {
  const { layout } = erzeugeBpmn(p)
  const k = berechneKennzahlen(p)
  const gezaehlt = zaehleMitFehler(graphAusLayout(layout), anteile(layout), laeufe, zufallMitStartwert(startwert), tokenZeiten(p, layout))
  const abweichungen: string[] = []
  const vergleiche = (name: string, id: string, formel: number) => {
    const x = gezaehlt.get(id) ?? { mittel: 0, fehler: 0 }
    if (Math.abs(formel - x.mittel) > 4 * x.fehler + 0.01) abweichungen.push(`${name}: Formel ${formel.toFixed(3)}, Tokenspiel ${x.mittel.toFixed(3)} ± ${x.fehler.toFixed(3)}`)
  }
  for (const { block } of durchlaufe(p.ablauf)) {
    if (block.typ === 'aufgabe') vergleiche(block.name, block.id, k.schritte.get(block.id)?.haeufigkeit ?? 0)
    // Wie oft ein Zweig von „weiter beim ersten“ normal zuerst fertig ist, gezählt an seiner Terminierung (wer mit einem Ende
    // gewinnt, endet am Fehler-Ende); ohne Enden in den Zweigen ist das `zuerstFertig`
    if (block.typ === 'parallel' && block.art === 'erster') {
      const je = ersterAusgang(block, 'gesamt').je
      block.zweige.forEach((z, i) => vergleiche(`zuerst ${z.id}`, `${z.id}_ende`, (k.haeufigkeiten.get(block.id) ?? 0) * je[i].weiter))
    }
  }
  return abweichungen
}

function kinder(e: ModdleElement): ModdleElement[] {
  return (e.flowElements ?? []) as ModdleElement[]
}

type MitDefinition = ModdleElement & { eventDefinitions?: { $type: string }[]; ordering?: string; completionCondition?: { body?: string }; attachedToRef?: { id: string } }

describe('Weiter beim ersten: Rechnung', () => {
  it('rechnet das Minimum der Zweige (Design: 20 Min., A zuerst in 50 %, Arbeit 60 Min.)', () => {
    const { p, par, a, b10, b50 } = angebote()
    const k = berechneKennzahlen(p)
    // B braucht in der Hälfte der Fälle 10 Min. (B zuerst), sonst 50 Min. (A zuerst nach 30): 0,5 · 10 + 0,5 · 30
    expect(k.durchlaufzeitMin).toBeCloseTo(20, 9)
    // ohne Liegezeiten ist die TCT dieselbe Kombination mit denselben Zeiten
    expect(k.kritischeArbeitMin).toBeCloseTo(20, 9)
    expect(zuerstFertig(par)).toEqual([0.5, 0.5])
    expect(k.zuerstFertig.get(par.zweige[0].id)).toBeCloseTo(0.5, 12)
    expect(k.zuerstFertig.get(par.zweige[1].id)).toBeCloseTo(0.5, 12)
    // Was abgebrochen wird, zählt voll: 30 + 0,5 · 10 + 0,5 · 50
    expect(k.arbeitszeitMin).toBeCloseTo(60, 9)
    expect(k.schritte.get(a.id)?.haeufigkeit).toBeCloseTo(1, 12)
    expect(k.schritte.get(b10.id)?.haeufigkeit).toBeCloseTo(0.5, 12)
    expect(k.schritte.get(b50.id)?.haeufigkeit).toBeCloseTo(0.5, 12)
    expect(k.enden).toEqual([{ ergebnis: 'Fertig', anteil: 1, regulaer: true }])
    // Verteilung: 10 Min. mit 0,5, 30 Min. mit 0,5
    const v = verteilungSequenz(p.ablauf.schritte, 'gesamt')
    expect(v.weiter.wert).toEqual([10, 30])
    expect(v.weiter.masse.map((x) => Math.round(x * 1e9) / 1e9)).toEqual([0.5, 0.5])
    // Beiträge zur Durchlaufzeit ergeben genau die Durchlaufzeit
    const summe = [...k.schritte.values()].reduce((s, x) => s + x.beitragWartenMin + x.beitragArbeitMin, 0)
    expect(summe).toBeCloseTo(20, 9)
  })

  it('gibt bei Gleichstand dem früheren Zweig den Vorzug (A 30, B 30: Dauer 30, Gewinner A)', () => {
    const par = gleichzeitig('erster', [aufgabe('A erledigen', 30)], [aufgabe('B erledigen', 30)])
    const p = prozess([par])
    const k = berechneKennzahlen(p)
    expect(k.durchlaufzeitMin).toBeCloseTo(30, 9)
    expect(zuerstFertig(par)).toEqual([1, 0])
    // Die Rechnung zeigt keinen Zeitgewinn: ein Hinweis erklärt, warum
    const hinweis = pruefeProzess(p).find((b) => b.schluessel === `erstergleich:${par.id}`)
    expect(hinweis?.schwere).toBe('hinweis')
    expect(hinweis?.text).toContain('Die Rechnung kennt nur Durchschnittszeiten und zeigt hier keinen Zeitgewinn')
    // mit Streuung gibt es einen Gewinn und keinen Hinweis
    expect(pruefeProzess(angebote().p).some((b) => b.schluessel.startsWith('erstergleich'))).toBe(false)
  })

  it('nimmt für die TCT das Minimum der Bearbeitungszeiten (A: liegt 60, 10 Min.; B: 40 Min.)', () => {
    const a = aufgabe('A erledigen', 10, LAGER, 60)
    const b = aufgabe('B erledigen', 40, LAGER)
    const par = gleichzeitig('erster', [a], [b])
    const k = berechneKennzahlen(prozess([par]))
    // Durchlaufzeit: min(70, 40) = 40, B ist zuerst fertig; TCT: min(10, 40) = 10
    expect(k.durchlaufzeitMin).toBeCloseTo(40, 9)
    expect(k.kritischeArbeitMin).toBeCloseTo(10, 9)
    expect(zuerstFertig(par)).toEqual([0, 1])
    // Arbeit: beide Zweige voll
    expect(k.arbeitszeitMin).toBeCloseTo(50, 9)
  })

  it('zählt Übergaben hinein zu jedem Zweig, heraus nur vom Gewinner', () => {
    const x = aufgabe('Bedarf erfassen', 5, BUERO)
    const { par, a, b10, b50 } = angebote()
    // Zweig B gehört der Buchhaltung
    const b = { ...par, zweige: [par.zweige[0], { ...par.zweige[1], schritte: [{ ...(par.zweige[1].schritte[0] as ReturnType<typeof neueEntscheidung>), zweige: [neuerZweig('Ja', 0.5, { schritte: [{ ...b10, rolleId: BUCHHALTUNG.id }] }), neuerZweig('Nein', 0.5, { schritte: [{ ...b50, rolleId: BUCHHALTUNG.id }] })] }] }] }
    const y = aufgabe('Bestellung auslösen', 5, BUERO)
    const k = berechneKennzahlen(prozess([x, b, y]))
    // hinein: Büro → Lager (1) und Büro → Buchhaltung (0,5 + 0,5); heraus: Lager → Büro (A zuerst, 0,5), Buchhaltung → Büro (0,5)
    expect(k.uebergaben).toBeCloseTo(3, 9)
    expect(k.paare.get(`${x.id}>${a.id}`)).toBeCloseTo(1, 12)
    expect(k.paare.get(`${a.id}>${y.id}`)).toBeCloseTo(0.5, 12)
    expect((k.paare.get(`${b10.id}>${y.id}`) ?? 0) + (k.paare.get(`${b50.id}>${y.id}`) ?? 0)).toBeCloseTo(0.5, 12)
  })

  it('stimmt mit der Simulation überein', () => {
    for (const [i, p] of [angebote().p, prozess([gleichzeitig('erster', [aufgabe('A', 30)], [aufgabe('B', 30)])])].entries()) {
      const k = berechneKennzahlen(p)
      const sim = simuliere(p, 20_000, 7 + i)
      expect(Math.abs(sim.mittelMin - k.durchlaufzeitMin)).toBeLessThan(4 * standardfehler(sim.zeiten) + 0.005 * k.durchlaufzeitMin)
    }
  })
})

describe('In beliebiger Reihenfolge: Rechnung', () => {
  it('rechnet wie eine Folge in der Reihenfolge der Liste (Design: 90 Min.)', () => {
    const { p, a, b, c } = unterlagen(false)
    const k = berechneKennzahlen(p)
    expect(k.durchlaufzeitMin).toBeCloseTo(90, 9)
    expect(k.kritischeArbeitMin).toBeCloseTo(90, 9)
    expect(k.arbeitszeitMin).toBeCloseTo(90, 9)
    for (const x of [a, b, c]) expect(k.schritte.get(x.id)?.haeufigkeit).toBeCloseTo(1, 12)
    // Übergaben wie in einer Folge: Büro → Lager → Büro
    expect(k.uebergaben).toBeCloseTo(2, 12)
  })

  it('lässt die Zweige danach nur laufen, wenn der Vorgang nicht vorher endet (Design: Häufigkeit 0,8)', () => {
    const { p, b, c } = unterlagen(true)
    const k = berechneKennzahlen(p)
    // 20 + 0,8 · (30 + 40) = 76
    expect(k.durchlaufzeitMin).toBeCloseTo(76, 9)
    expect(k.schritte.get(b.id)?.haeufigkeit).toBeCloseTo(0.8, 12)
    expect(k.schritte.get(c.id)?.haeufigkeit).toBeCloseTo(0.8, 12)
    expect(k.enden.map((e) => [e.ergebnis, Math.round(e.anteil * 1e9) / 1e9])).toEqual([
      ['Fertig', 0.8],
      ['abgelehnt', 0.2],
    ])
    expect(k.uebergaben).toBeCloseTo(1.6, 12)
    const sim = simuliere(p, 20_000, 3)
    expect(Math.abs(sim.mittelMin - 76)).toBeLessThan(4 * standardfehler(sim.zeiten) + 0.005 * 76)
    const v = verteilungSequenz(p.ablauf.schritte, 'gesamt')
    expect(masse(v.weiter)).toBeCloseTo(0.8, 12)
    expect(erwartung(v.ende.get('abgelehnt')!)).toBeCloseTo(20, 9)
  })
})

describe('Arten von Gleichzeitig: Prüfregeln und Operationen', () => {
  const schluessel = (p: Prozess) => pruefeProzess(p).map((b) => `${b.schwere}:${b.schluessel.split(':')[0]}`)

  it('erlaubt ein Ende in den Zweigen aller Arten; es bricht ab, was gleichzeitig läuft', () => {
    const endet = () => neueEntscheidung({ frage: 'Abgelehnt?', zweige: [neuerZweig('Nein', 0.8), neuerZweig('Ja', 0.2, { ende: 'abgelehnt' })] })
    const erster = prozess([gleichzeitig('erster', [aufgabe('A', 10), endet()], [aufgabe('B', 20)])])
    expect(schluessel(erster).filter((s) => s.startsWith('fehler'))).toEqual([])
    const nacheinander = prozess([gleichzeitig('nacheinander', [aufgabe('A', 10), endet()], [aufgabe('B', 20)])])
    expect(schluessel(nacheinander).filter((s) => s.startsWith('fehler'))).toEqual([])
    // Zweig 1 kann den Vorgang beenden: Die Reihenfolge der Liste zählt für die Rechnung
    expect(schluessel(nacheinander)).toContain('hinweis:adhocreihe')
    // In einem Zweig von „Gleichzeitig“ (bis Schritt 5 eine Verklemmung): Fehler-Ende im Ad-hoc-Rahmen, hinter dessen Randereignis eine Terminierung
    const aussen = prozess([gleichzeitig('alle', [gleichzeitig('nacheinander', [aufgabe('A', 10), endet()], [aufgabe('B', 20)])], [aufgabe('C', 5)])])
    expect(schluessel(aussen).filter((s) => s.startsWith('fehler'))).toEqual([])
    const { layout } = erzeugeBpmn(aussen)
    expect(layout.knoten.filter((k) => k.art === 'ende' && k.name === 'abgelehnt').map((k) => (k.fehler ? 'fehler' : k.terminierung ? 'terminierung' : 'normal')).sort()).toEqual(['fehler', 'terminierung'])
    expect(pruefeSoundness(graphAusLayout(layout)).fehler).toEqual([])
  })

  it('warnt, wenn ein Zweig vorn den Vorgang immer beendet', () => {
    const immer = neueEntscheidung({ frage: 'Wie?', zweige: [neuerZweig('a', 0.5, { ende: 'x' }), neuerZweig('b', 0.5, { ende: 'y' })] })
    const p = prozess([gleichzeitig('nacheinander', [aufgabe('A', 10), immer], [aufgabe('B', 20)])])
    expect(schluessel(p)).toContain('warnung:adhocende')
    // als letzter Zweig ist es in Ordnung
    const q = prozess([gleichzeitig('nacheinander', [aufgabe('B', 20)], [aufgabe('A', 10), immer])])
    expect(schluessel(q).some((s) => s.includes('adhoc'))).toBe(false)
    // „weiter beim ersten“ geht weiter, wenn ein Zweig weiterkommt; „in beliebiger Reihenfolge“ nur, wenn jeder Zweig weiterkommt
    expect(ausgaengeBlock(gleichzeitig('erster', [aufgabe('A', 10), immer], [aufgabe('B', 20)])).has('weiter')).toBe(true)
    expect(ausgaengeBlock(gleichzeitig('nacheinander', [aufgabe('A', 10), immer], [aufgabe('B', 20)])).has('weiter')).toBe(false)
  })

  it('meldet leere Zweige, zu wenige Zweige und Rücksprünge aus einem Zweig mit dem Namen der Art', () => {
    const leer = gleichzeitig('erster', [aufgabe('A', 10)], [])
    expect(pruefeProzess(prozess([leer])).find((b) => b.schluessel.startsWith('leer:'))?.text).toBe('Zweig 2 von „Weiter beim ersten“ hat keine Schritte.')
    const einer = gleichzeitig('nacheinander', [aufgabe('A', 10)])
    expect(pruefeProzess(prozess([einer])).find((b) => b.schluessel.startsWith('zweige:'))?.text).toBe('„In beliebiger Reihenfolge“ braucht mindestens zwei Zweige.')
    // Rücksprung aus einem Zweig hinaus (nur in von Hand gebauten Dateien): Fehler
    const x = aufgabe('Erfassen', 5)
    const e = neueEntscheidung({ frage: 'Gut?', zweige: [neuerZweig('Ja', 0.9), neuerZweig('Nein', 0.1)] })
    const bereich = neuerRuecksprungBereich([x, gleichzeitig('nacheinander', [aufgabe('A', 10), e], [aufgabe('B', 5)])])
    const zurueck = { ...bereich, koerper: { ...bereich.koerper, schritte: bereich.koerper.schritte.map((s) => (s.typ === 'parallel' ? { ...s, zweige: s.zweige.map((z, i) => (i === 0 ? { ...z, schritte: [z.schritte[0], { ...e, zweige: [e.zweige[0], { ...e.zweige[1], zurueckZu: bereich.id }] }] } : z)) } : s)) } }
    const befund = pruefeProzess(prozess([zurueck])).find((b) => b.schluessel.startsWith('rahmenrueck:'))
    expect(befund?.titel).toBe('Rücksprung aus „In beliebiger Reihenfolge“')
  })

  it('weist auf mehrere Rollen im Rahmen hin, und auf dieselben Leute in Zweigen nur, wenn sie gleichzeitig laufen', () => {
    for (const art of ['erster', 'nacheinander'] as const) {
      const p = prozess([gleichzeitig(art, [aufgabe('A', 10, LAGER)], [aufgabe('B', 20, LAGER)], [aufgabe('C', 5, BUERO)])])
      const hinweis = pruefeProzess(p).find((b) => b.schluessel.startsWith('rahmenbahn:'))
      expect(hinweis?.text).toContain('in einem Rahmen in der Bahn „Lager“')
      const dieselben = findeSchwachstellen(p, berechneKennzahlen(p)).some((b) => b.schluessel.startsWith('parallelrolle:'))
      // Lager hat eine Person: Bei „weiter beim ersten“ arbeitet sie an zwei Stellen zugleich, bei „in beliebiger Reihenfolge“ nacheinander
      expect(dieselben).toBe(art === 'erster')
    }
  })

  it('kennt die Umgebungen: „weiter beim ersten“ ist nebenläufig, beide sind Rahmen', () => {
    for (const art of ['erster', 'nacheinander'] as const) {
      const a = aufgabe('A', 10)
      const e = neueEntscheidung({ frage: 'Gut?', zweige: [neuerZweig('Ja', 0.9), neuerZweig('Nein', 0.1)] })
      const par = gleichzeitig(art, [aufgabe('Vorher', 5), a, e], [aufgabe('B', 5)])
      const p = prozess([aufgabe('Erfassen', 5), par])
      const f = findeBlock(p, a.id)!
      expect(nebenlaeufig(f.kette)).toBe(art === 'erster')
      expect(rahmenUeber(f.kette).map((b) => b.id)).toEqual([par.id])
      // Rücksprünge nur innerhalb des Zweigs
      const ziele = ruecksprungZiele(p, f.sequenz.id, 2, true).map((z) => z.titel)
      expect(ziele).toEqual(['Vorher', 'A', 'Gut?'])
      const mitRueck = setzeRuecksprung(p, e.id, e.zweige[1].id, a.id)
      expect(pruefeProzess(mitRueck).filter((b) => b.schwere === 'fehler')).toEqual([])
      expect(blockTitel(par)).toBe(art === 'erster' ? 'Weiter beim ersten (2 Zweige)' : 'In beliebiger Reihenfolge (2 Zweige)')
    }
  })

  it('nimmt einen Zweig als eine Aktivität, wenn er genau eine Aufgabe, ein Abschnitt oder „für jedes Stück“ ohne Unterbrechungen ist', () => {
    expect(einzelneAktivitaet(neueSequenz([aufgabe('A', 5)]))?.typ).toBe('aufgabe')
    expect(einzelneAktivitaet(neueSequenz([neuerTeilprozess({ name: 'X', koerper: neueSequenz([aufgabe('A', 5)]) })]))?.typ).toBe('teilprozess')
    expect(einzelneAktivitaet(neueSequenz([aufgabe('A', 5), aufgabe('B', 5)]))).toBeNull()
    expect(einzelneAktivitaet(neueSequenz([neueEntscheidung()]))).toBeNull()
  })

  it('führt durch die Zweige: Ort, nächste Stelle, Ende erlaubt nur ohne Nebenläufigkeit', () => {
    for (const art of ['erster', 'nacheinander'] as const) {
      const par = gleichzeitig(art, [aufgabe('A', 10)], [])
      const p = prozess([par])
      expect(cursorNachEinfuegen(par, { sequenzId: 'haupt', index: 0 })).toEqual({ sequenzId: par.zweige[0].id, index: 1 })
      const ort = beschreibeCursor(p, { sequenzId: par.zweige[1].id, index: 0 })
      expect(ort.bereich).toBe(`in Zweig 2 von „${art === 'erster' ? 'Weiter beim ersten' : 'In beliebiger Reihenfolge'}“`)
      expect(ort.inParallele).toBe(art === 'erster')
      expect(abschnittFertig(p, { sequenzId: par.zweige[0].id, index: 1 })).toEqual({ sequenzId: par.zweige[1].id, index: 0 })
      expect(abschnittFertig(p, { sequenzId: par.zweige[1].id, index: 0 })).toEqual({ sequenzId: 'haupt', index: 1 })
      expect(findeSequenz(p, par.zweige[1].id)?.besitzer?.id).toBe(par.id)
    }
  })

  it('speichert alle drei Arten und lädt sie unverändert', () => {
    const p = prozess([gleichzeitig('alle', [aufgabe('A', 1)], [aufgabe('B', 1)]), angebote().par, unterlagen(true).par])
    const projekt = { formatVersion: 4 as const, ist: p, soll: null, massnahmen: [], verworfen: [] }
    expect(leseProjekt(JSON.parse(alsJson(projekt)))).toEqual(projekt)
  })
})

describe('Arten von Gleichzeitig: BPMN', () => {
  it('exportiert „weiter beim ersten“ als Teilprozess mit einer Terminierung je Zweig', async () => {
    const x = aufgabe('Bedarf erfassen', 5, BUERO)
    const { par } = angebote()
    const dritter = { ...par, zweige: [...par.zweige, neueSequenz([aufgabe('Angebot C einholen', 40)])] }
    const p = prozess([x, dritter, aufgabe('Bestellen', 5, BUERO)])
    const { xml, layout } = erzeugeBpmn(p)
    expect(geometrieFehler(layout)).toEqual([])
    const { rootElement, warnings } = await BpmnModdle().fromXML(xml)
    expect(warnings).toEqual([])
    const prozessElement = (rootElement.rootElements ?? []).find((e) => e.$type === 'bpmn:Process')!
    const rahmen = kinder(prozessElement).find((e) => e.id === par.id)!
    expect(rahmen.$type).toBe('bpmn:SubProcess')
    expect((rahmen as MitDefinition & { name: string }).name).toBe('Weiter beim ersten')
    const enden = kinder(rahmen).filter((e) => e.$type === 'bpmn:EndEvent') as MitDefinition[]
    expect(enden.map((e) => e.eventDefinitions?.[0]?.$type)).toEqual(['bpmn:TerminateEventDefinition', 'bpmn:TerminateEventDefinition', 'bpmn:TerminateEventDefinition'])
    expect(kinder(rahmen).filter((e) => e.$type === 'bpmn:ParallelGateway')).toHaveLength(1)
    expect(xml).toContain('Zweig 1 ist in 50 % der Fälle zuerst fertig; dann werden die übrigen Zweige abgebrochen')
    // Die Terminierungen stehen untereinander in einer Spalte hinter dem breitesten Zweig
    const terminierungen = layout.knoten.filter((k) => k.terminierung)
    expect(new Set(terminierungen.map((k) => Math.round(k.x))).size).toBe(1)
    expect(terminierungen.map((k) => k.zuerst)).toEqual([0.5, 0.5, 0])
  })

  it('exportiert „in beliebiger Reihenfolge“ als Ad-hoc-Teilprozess, mehrschrittige Zweige als „Zweig n“', async () => {
    const { p, par, b, c } = unterlagen(true)
    const { xml, layout } = erzeugeBpmn(p)
    expect(geometrieFehler(layout)).toEqual([])
    const { rootElement, warnings } = await BpmnModdle().fromXML(xml)
    expect(warnings).toEqual([])
    const prozessElement = (rootElement.rootElements ?? []).find((e) => e.$type === 'bpmn:Process')!
    const adhoc = kinder(prozessElement).find((e) => e.id === par.id) as MitDefinition
    expect(adhoc.$type).toBe('bpmn:AdHocSubProcess')
    expect(adhoc.ordering).toBe('Sequential')
    expect(adhoc.completionCondition?.body).toBe('alle Zweige erledigt')
    // je Zweig genau eine Aktivität, kein Sequenzfluss, kein Start und kein Ende direkt darin
    expect(kinder(adhoc).map((e) => e.$type).sort()).toEqual(['bpmn:SubProcess', 'bpmn:Task', 'bpmn:Task'].sort())
    const zweig = kinder(adhoc).find((e) => e.$type === 'bpmn:SubProcess') as MitDefinition & { name: string }
    expect(zweig.name).toBe('Zweig 1')
    expect(kinder(adhoc).filter((e) => e.$type === 'bpmn:Task').map((e) => e.id).sort()).toEqual([b.id, c.id].sort())
    // Das Ende im Zweig steigt als Fehler zum Ad-hoc-Rahmen auf, dessen Randereignis zum Ende „abgelehnt“ führt
    expect(kinder(zweig).some((e) => e.$type === 'bpmn:EndEvent' && (e as MitDefinition).eventDefinitions?.[0]?.$type === 'bpmn:ErrorEventDefinition')).toBe(true)
    const rand = kinder(prozessElement).find((e) => e.$type === 'bpmn:BoundaryEvent') as MitDefinition
    expect(rand.attachedToRef?.id).toBe(par.id)
    // Der eingebettete Zweig beginnt in der ersten Spalte des Ad-hoc-Rahmens; seine Kante liegt 8 px weiter innen
    const aussen = layout.rahmen.find((r) => r.id === par.id)!
    const innen = layout.rahmen.find((r) => r.eltern === par.id)!
    expect(innen.x - aussen.x).toBeCloseTo(RAHMEN_RAND.ebene, 6)
    expect(aussen.aktivitaeten).toEqual([innen.id, b.id, c.id])
    // Ein- und Austritt auf der Höhe der ersten Aktivität
    expect(aussen.anschlussY).toBeCloseTo(innen.anschlussY, 6)
  })

  it('ist im Tokenspiel sound, auf dem Layout und auf dem gelesenen XML, und zählt dieselben Häufigkeiten', async () => {
    const beispiele = [angebote().p, unterlagen(false).p, unterlagen(true).p, prozess([aufgabe('Vorher', 5, BUERO), gleichzeitig('nacheinander', [unterlagen(true).par], [angebote().par]), aufgabe('Nachher', 5, BUERO)])]
    for (const [i, p] of beispiele.entries()) {
      const { layout, xml } = erzeugeBpmn(p)
      expect(geometrieFehler(layout)).toEqual([])
      const g = graphAusLayout(layout)
      const x = await graphAusXml(xml)
      expect(form(x)).toEqual(form(g))
      expect(pruefeSoundness(g).fehler).toEqual([])
      expect(pruefeSoundness(x).fehler).toEqual([])
      expect(tokenAbweichungen(p, 20_000, 5 + i)).toEqual([])
    }
  }, 60_000)

  it('findet im Tokenspiel jede Reihenfolge und jede Terminierung als erste', () => {
    // Zweig 2 ist immer zuerst fertig, trotzdem kann im BPMN (ohne Zeiten) jede Terminierung die erste sein
    const p = prozess([gleichzeitig('erster', [aufgabe('A', 30), aufgabe('B', 30)], [aufgabe('C', 5)])])
    const e = pruefeSoundness(graphAusLayout(erzeugeBpmn(p).layout))
    expect(e.fehler).toEqual([])
    // drei Zweige in beliebiger Reihenfolge: offen ist jede Teilmenge, jede Aktivität kann als erste beginnen
    const q = unterlagen(false).p
    const r = pruefeSoundness(graphAusLayout(erzeugeBpmn(q).layout))
    expect(r.fehler).toEqual([])
    expect(r.zustaende).toBeGreaterThanOrEqual(8)
  })
})

describe('Arten von Gleichzeitig in Zufallsprozessen', () => {
  const neueArt = (p: Prozess) => [...durchlaufe(p.ablauf)].some((f) => f.block.typ === 'parallel' && f.block.art !== 'alle')

  it('erzeugt beide Arten, auch mit Enden und eingebetteten Zweigen, und legt sie nach den Zeichenregeln', () => {
    let erster = 0
    let nacheinander = 0
    let zweigRahmen = 0
    let endenImZweig = 0
    const fehler: string[] = []
    for (let s = 1; s <= 300; s++) {
      const p = zufallsProzess(s)
      for (const { block, kette } of durchlaufe(p.ablauf)) {
        if (block.typ === 'parallel' && block.art === 'erster') erster++
        if (block.typ === 'parallel' && block.art === 'nacheinander') nacheinander++
        if (block.typ === 'entscheidung' && block.zweige.some((z) => z.ende !== null) && kette.some((g) => g.block.typ === 'parallel' && g.block.art === 'nacheinander')) endenImZweig++
      }
      const { layout } = erzeugeBpmn(p)
      zweigRahmen += layout.rahmen.filter((r) => r.name.startsWith('Zweig ')).length
      for (const f of geometrieFehler(layout)) fehler.push(`Startwert ${s}: ${f}`)
      for (const b of pruefeProzess(p)) if (b.schwere === 'fehler') fehler.push(`Startwert ${s}: ${b.titel}: ${b.text}`)
    }
    expect(fehler.slice(0, 5)).toEqual([])
    expect(erster).toBeGreaterThan(20)
    expect(nacheinander).toBeGreaterThan(20)
    expect(zweigRahmen).toBeGreaterThan(20)
    expect(endenImZweig).toBeGreaterThan(5)
  }, 60_000)

  it('stimmt mit Simulation, Verteilung und Tokenspiel überein; sound auf Layout und XML', async () => {
    const abweichungen: string[] = []
    let gezaehlt = 0
    for (let s = 1; s <= 300 && gezaehlt < 40; s++) {
      const p = zufallsProzess(s)
      if (!neueArt(p)) continue
      gezaehlt++
      const k = berechneKennzahlen(p)
      const sim = simuliere(p, 20_000, s)
      if (Math.abs(k.durchlaufzeitMin - sim.mittelMin) > 4 * standardfehler(sim.zeiten) + 0.005 * Math.max(k.durchlaufzeitMin, 1)) {
        abweichungen.push(`Startwert ${s}: Formel ${k.durchlaufzeitMin.toFixed(2)}, Simulation ${sim.mittelMin.toFixed(2)}`)
      }
      for (const e of k.enden) {
        const x = sim.ergebnisse.find((r) => r.ergebnis === e.ergebnis && r.regulaer === e.regulaer)?.anteil ?? 0
        if (Math.abs(x - e.anteil) > 4 * Math.sqrt((e.anteil * (1 - e.anteil)) / 20_000) + 0.002) abweichungen.push(`Startwert ${s}: Ende „${e.ergebnis}“ Formel ${e.anteil.toFixed(4)}, Simulation ${x.toFixed(4)}`)
      }
      const v = verteilungSequenz(p.ablauf.schritte, 'gesamt')
      const teile = [v.weiter, ...v.ende.values()]
      const gesamt = teile.reduce((x, t) => x + masse(t), 0)
      const mittel = teile.reduce((x, t) => x + erwartung(t) * masse(t), 0)
      if (Math.abs(gesamt - 1) > 1e-5 || Math.abs(mittel - k.durchlaufzeitMin) > 1e-4 * Math.max(1, k.durchlaufzeitMin)) abweichungen.push(`Startwert ${s}: Teilverteilungen Masse ${gesamt}, Mittel ${mittel} statt ${k.durchlaufzeitMin}`)
      if (k.kritischeArbeitMin > k.durchlaufzeitMin + 1e-6) abweichungen.push(`Startwert ${s}: TCT ${k.kritischeArbeitMin} über der Durchlaufzeit ${k.durchlaufzeitMin}`)
      for (const a of tokenAbweichungen(p, 3_000, s)) abweichungen.push(`Startwert ${s}: ${a}`)
      const { layout, xml } = erzeugeBpmn(p)
      const g = graphAusLayout(layout)
      const x = await graphAusXml(xml)
      if (JSON.stringify(form(x)) !== JSON.stringify(form(g))) abweichungen.push(`Startwert ${s}: XML und Layout verschieden`)
      for (const [name, graph] of [['Layout', g], ['XML', x]] as const) {
        const e = pruefeSoundness(graph, 2_000)
        if (!e.reduziert) for (const f of e.fehler) abweichungen.push(`Startwert ${s} (${name}): ${f}`)
      }
    }
    expect(gezaehlt).toBe(40)
    expect(abweichungen.slice(0, 10)).toEqual([])
  }, 180_000)
})
