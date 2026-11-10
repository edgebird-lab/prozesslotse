import { describe, expect, it } from 'vitest'
import { berechneKennzahlen } from '../analyse/kennzahlen'
import { zufallMitStartwert } from '../analyse/simulation'
import { beispielLieferdienst, beispielOnlinebestellung } from '../modell/beispiel'
import { durchlaufe } from '../modell/operationen'
import { pruefeProzess } from '../modell/pruefung'
import type { Prozess } from '../modell/typen'
import { graphAusXml } from '../testhilfen/bpmn-graph'
import { zufallsProzess } from '../testhilfen/zufallsprozess'
import { erzeugeBpmn } from './export'
import { graphAusLayout, pruefeSoundness, zaehleAusfuehrungen, type TokenGraph } from './tokenspiel'

/** Vergleichbare Form eines Graphen: Knoten mit Typ und Flüsse von → nach */
function form(g: TokenGraph): string[] {
  const quelle = new Map<string, string>()
  for (const k of g.knoten) for (const f of k.raus) quelle.set(f, k.id)
  return [...g.knoten.map((k) => `${k.id}:${k.typ}`), ...[...g.ziel].map(([f, z]) => `${quelle.get(f)}->${z}`)].sort()
}

describe('Tokenspiel auf dem exportierten BPMN', () => {
  it('erkennt eine Verklemmung und eine Schleife ohne Ausweg', () => {
    // Start → XOR → (a | b) → AND-Zusammenführung: wartet ewig auf den zweiten Zweig
    const verklemmt = pruefeSoundness({
      knoten: [
        { id: 's', typ: 'start', rein: [], raus: ['f1'] },
        { id: 'x', typ: 'xor', rein: ['f1'], raus: ['f2', 'f3'] },
        { id: 'a', typ: 'aktivitaet', rein: ['f2'], raus: ['f4'] },
        { id: 'b', typ: 'aktivitaet', rein: ['f3'], raus: ['f5'] },
        { id: 'j', typ: 'und', rein: ['f4', 'f5'], raus: ['f6'] },
        { id: 'e', typ: 'ende', rein: ['f6'], raus: [] },
      ],
      ziel: new Map([['f1', 'x'], ['f2', 'a'], ['f3', 'b'], ['f4', 'j'], ['f5', 'j'], ['f6', 'e']]),
    })
    expect(verklemmt.sound).toBe(false)
    expect(verklemmt.fehler.join(' ')).toContain('Verklemmung')

    // Start → a → XOR zurück zu a (kein Ausgang)
    const endlos = pruefeSoundness({
      knoten: [
        { id: 's', typ: 'start', rein: [], raus: ['f1'] },
        { id: 'm', typ: 'xor', rein: ['f1', 'f3'], raus: ['f2'] },
        { id: 'a', typ: 'aktivitaet', rein: ['f2'], raus: ['f3'] },
        { id: 'e', typ: 'ende', rein: [], raus: [] },
      ],
      ziel: new Map([['f1', 'm'], ['f2', 'a'], ['f3', 'm']]),
    })
    expect(endlos.sound).toBe(false)
    expect(endlos.fehler.join(' ')).toContain('nie vollständig enden')
  })

  it('bestätigt die Soundness des Fallbeispiels', async () => {
    const g = await graphAusXml(erzeugeBpmn(beispielLieferdienst()).xml)
    const e = pruefeSoundness(g)
    expect(e.fehler).toEqual([])
    expect(e.zustaende).toBeGreaterThan(10)
  })

  it('bestätigt die Soundness von 300 zufälligen verschachtelten Prozessen', async () => {
    const fehler: string[] = []
    let zuGross = 0
    let verkuerzt = 0
    for (let s = 1; s <= 300; s++) {
      const { layout, xml } = erzeugeBpmn(zufallsProzess(s))
      const g = graphAusLayout(layout)
      // Stichprobe: das XML beschreibt genau denselben Graphen wie das Layout
      if (s % 10 === 0) expect(form(await graphAusXml(xml))).toEqual(form(g))
      // vollständige Suche bis 2.000 Zustände, darüber die verkürzte
      const e = pruefeSoundness(g, 2_000)
      if (!e.vollstaendig) zuGross++
      if (e.reduziert) verkuerzt++
      else for (const f of e.fehler) fehler.push(`Startwert ${s}: ${f}`)
    }
    expect(fehler.slice(0, 10)).toEqual([])
    // Nur wenige Prozesse mit sehr vielen Gleichzeitig-Zweigen sprengen den Zustandsraum
    expect(zuGross).toBe(0)
    expect(verkuerzt).toBeLessThan(60)
  }, 30_000)
})

/** Häufigkeit je Aufgabe: Tokenspiel auf dem BPMN-Graphen gegen die Formeln der Kennzahlen. */
function haeufigkeitsAbweichungen(p: Prozess, laeufe: number, startwert: number): string[] {
  const { layout } = erzeugeBpmn(p)
  const anteil = new Map(layout.kanten.filter((k) => k.anteil !== undefined).map((k) => [k.id, k.anteil!]))
  const simuliert = zaehleAusfuehrungen(graphAusLayout(layout), anteil, laeufe, zufallMitStartwert(startwert))
  const k = berechneKennzahlen(p)
  const abweichungen: string[] = []
  for (const { block } of durchlaufe(p.ablauf)) {
    if (block.typ !== 'aufgabe') continue
    const formel = k.schritte.get(block.id)?.haeufigkeit ?? 0
    const sim = simuliert.get(block.id) ?? 0
    if (Math.abs(formel - sim) > 0.03 + 0.05 * formel) abweichungen.push(`${block.id}: Formel ${formel.toFixed(3)}, Tokenspiel ${sim.toFixed(3)}`)
  }
  return abweichungen
}

describe('Neue Konstrukte: Rücksprung und Ereignis-Entscheidung', () => {
  it('erzeugt im Zufallsgenerator Rücksprünge und Ereignis-Entscheidungen ohne Modellfehler', () => {
    let ruecksprung = 0
    let ereignis = 0
    const fehler: string[] = []
    for (let s = 1; s <= 300; s++) {
      const p = zufallsProzess(s)
      for (const { block } of durchlaufe(p.ablauf)) {
        if (block.typ === 'wiederholung' && block.modus === 'ruecksprung') ruecksprung++
        if (block.typ === 'entscheidung' && block.art === 'ereignis') ereignis++
      }
      for (const b of pruefeProzess(p)) if (b.schwere === 'fehler') fehler.push(`Startwert ${s}: ${b.titel}: ${b.text}`)
    }
    expect(fehler.slice(0, 5)).toEqual([])
    expect(ruecksprung).toBeGreaterThan(30)
    expect(ereignis).toBeGreaterThan(30)
  })

  it('bestätigt die Soundness der Onlinebestellung', async () => {
    const { xml } = erzeugeBpmn(beispielOnlinebestellung())
    expect(xml).toContain('<bpmn:eventBasedGateway')
    const e = pruefeSoundness(await graphAusXml(xml))
    expect(e.fehler).toEqual([])
  })

  it('Prüfung und Tokenspiel stimmen überein: kein Fehler ⇒ sound, nicht sound ⇒ Fehler', () => {
    const widersprueche: string[] = []
    let ungueltig = 0
    for (let s = 1; s <= 400; s++) {
      const p = zufallsProzess(s, { auchUngueltig: true })
      const fehler = pruefeProzess(p).filter((b) => b.schwere === 'fehler')
      if (fehler.length > 0) ungueltig++
      const e = pruefeSoundness(graphAusLayout(erzeugeBpmn(p).layout), 2_000)
      if (!e.vollstaendig) continue
      if (fehler.length === 0 && !e.sound) widersprueche.push(`Startwert ${s}: kein Prüffehler, aber ${e.fehler[0]}`)
      if (fehler.length > 0 && e.sound && fehler.some((f) => /unerreichbar|ausweglos|fragelos|verklemmung|totesende/.test(f.schluessel)))
        widersprueche.push(`Startwert ${s}: Prüffehler ${fehler[0].schluessel}, aber sound`)
    }
    expect(widersprueche.slice(0, 10)).toEqual([])
    // der Generator erzeugt tatsächlich ungültige Modelle
    expect(ungueltig).toBeGreaterThan(30)
  }, 60_000)

  it('zählt im Tokenspiel dieselben Häufigkeiten wie die Formeln', () => {
    expect(haeufigkeitsAbweichungen(beispielLieferdienst(), 20_000, 1)).toEqual([])
    expect(haeufigkeitsAbweichungen(beispielOnlinebestellung(), 20_000, 2)).toEqual([])
    const abweichungen: string[] = []
    for (let s = 1; s <= 60; s++) for (const a of haeufigkeitsAbweichungen(zufallsProzess(s), 3_000, s)) abweichungen.push(`Startwert ${s}: ${a}`)
    expect(abweichungen.slice(0, 10)).toEqual([])
  }, 60_000)
})
