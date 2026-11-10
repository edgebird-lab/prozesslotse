import { BpmnModdle } from 'bpmn-moddle'
import { describe, expect, it } from 'vitest'
import { zufallMitStartwert } from '../analyse/simulation'
import { neueAufgabe, neueEntscheidung, neueParallel, neuerProzess, neueRolle, neuerZweig, neuesMedium, neuesWarten, neueWiederholung } from '../modell/bausteine'
import { beispielLieferdienst } from '../modell/beispiel'
import type { Block, Prozess, Sequenz } from '../modell/typen'
import { erzeugeBpmn } from './export'
import type { Layout, Rechteck } from './layout'

async function pruefeSchema(xml: string): Promise<void> {
  const moddle = BpmnModdle()
  const { rootElement, warnings } = await moddle.fromXML(xml)
  expect(warnings.map((w: { message: string }) => w.message)).toEqual([])
  expect(rootElement.$type).toBe('bpmn:Definitions')
}

function ueberlappen(a: Rechteck, b: Rechteck): boolean {
  return a.x < b.x + b.breite - 1 && b.x < a.x + a.breite - 1 && a.y < b.y + b.hoehe - 1 && b.y < a.y + a.hoehe - 1
}

function segmentSchneidet(p: { x: number; y: number }, q: { x: number; y: number }, r: Rechteck): boolean {
  const x1 = Math.min(p.x, q.x)
  const x2 = Math.max(p.x, q.x)
  const y1 = Math.min(p.y, q.y)
  const y2 = Math.max(p.y, q.y)
  return x1 < r.x + r.breite - 1 && x2 > r.x + 1 && y1 < r.y + r.hoehe - 1 && y2 > r.y + 1
}

/** Prüft die geometrischen Zusagen des Layouts und gibt Verstöße als Text zurück. */
function geometrieFehler(l: Layout): string[] {
  const fehler: string[] = []
  const nachId = new Map(l.knoten.map((k) => [k.id, k]))
  for (let i = 0; i < l.knoten.length; i++) {
    for (let j = i + 1; j < l.knoten.length; j++) {
      if (ueberlappen(l.knoten[i], l.knoten[j])) fehler.push(`Überlappung ${l.knoten[i].id} / ${l.knoten[j].id}`)
    }
  }
  for (const k of l.knoten) {
    const bahn = l.bahnen.find((b) => b.schluessel === k.bahn)
    if (!bahn || k.y < bahn.y || k.y + k.hoehe > bahn.y + bahn.hoehe) fehler.push(`${k.id} liegt nicht in seiner Bahn`)
  }
  for (const e of l.kanten) {
    for (let i = 1; i < e.punkte.length; i++) {
      const p = e.punkte[i - 1]
      const q = e.punkte[i]
      if (Math.abs(p.x - q.x) > 0.01 && Math.abs(p.y - q.y) > 0.01) fehler.push(`${e.id} ist nicht rechtwinklig`)
      for (const k of l.knoten) {
        if (k.id === e.von || k.id === e.nach) continue
        if (segmentSchneidet(p, q, k)) fehler.push(`${e.id} (${e.von}→${e.nach}) läuft durch ${k.id}`)
      }
    }
    if (!nachId.has(e.von) || !nachId.has(e.nach)) fehler.push(`${e.id} verweist ins Leere`)
  }
  return fehler
}

// Zufällige, gültige Prozesse für einen Belastungstest des Layouts
function zufallsProzess(startwert: number): Prozess {
  const zufall = zufallMitStartwert(startwert)
  const wahl = <T,>(liste: T[]): T => liste[Math.floor(zufall() * liste.length)]
  const rollen = [neueRolle('A'), neueRolle('B'), neueRolle('C')]
  const medien = [neuesMedium('Papier', 'papier'), neuesMedium('ERP', 'erp')]
  let nr = 0
  const aufgabe = () => neueAufgabe({ name: `Schritt ${++nr} erledigen`, rolleId: wahl(rollen).id, mediumId: wahl(medien).id, bearbeitungMin: 5 })

  function sequenz(tiefe: number, inParallel: boolean, mindestens = 0): Block[] {
    const anzahl = Math.max(mindestens, Math.floor(zufall() * 4))
    return Array.from({ length: anzahl }, () => block(tiefe, inParallel))
  }
  function block(tiefe: number, inParallel: boolean): Block {
    const r = zufall()
    if (tiefe >= 3 || r < 0.45) return aufgabe()
    if (r < 0.52) return neuesWarten({ name: 'Warten', dauerMin: 30 })
    if (r < 0.75) {
      const n = 2 + Math.floor(zufall() * 2)
      const zweige = Array.from({ length: n }, (_, i) =>
        neuerZweig(`Fall ${i + 1}`, 1 / n, {
          schritte: sequenz(tiefe + 1, inParallel),
          ende: !inParallel && i > 0 && zufall() < 0.3 ? `Ende ${i}` : null,
        }),
      )
      return neueEntscheidung({ frage: 'Welcher Fall?', zweige })
    }
    if (r < 0.9) {
      const par = neueParallel(2 + Math.floor(zufall() * 2))
      par.zweige = par.zweige.map((z: Sequenz) => ({ ...z, schritte: sequenz(tiefe + 1, true, 1) }))
      return par
    }
    return neueWiederholung({ frage: 'Nochmal?', koerper: { id: `k${++nr}`, schritte: sequenz(tiefe + 1, inParallel, 1) } })
  }

  return neuerProzess({ name: `Zufall ${startwert}`, rollen, medien, ablauf: { id: 'haupt', schritte: sequenz(0, false, 1) } })
}

describe('BPMN-Export', () => {
  it('erzeugt für das Fallbeispiel gültiges BPMN 2.0', async () => {
    const { xml } = erzeugeBpmn(beispielLieferdienst())
    await pruefeSchema(xml)
    expect(xml).toContain('<bpmn:manualTask id="auf_annehmen" name="Bestellung telefonisch annehmen">')
    expect(xml).toContain('<bpmn:userTask id="auf_erfassen"')
    expect(xml).toContain('Medienbruch: Daten aus Papier von Hand übertragen')
    expect(xml).toContain('<bpmn:exclusiveGateway id="ent_vorrat_auf" name="Ware vorrätig?" gatewayDirection="Diverging">')
    expect(xml).toContain('<bpmn:messageEventDefinition id="Start_def" />')
  })

  it('ordnet das Fallbeispiel ohne Überlappungen und ohne Kanten durch fremde Elemente an', () => {
    const { layout } = erzeugeBpmn(beispielLieferdienst())
    expect(geometrieFehler(layout)).toEqual([])
    expect(layout.bahnen.map((b) => b.name)).toEqual(['Innendienst', 'Lager', 'Disposition', 'Fahrer', 'Buchhaltung', 'Niederlassungsleitung'])
  })

  it('verbindet jeden Baustein mit seinen BPMN-Elementen', () => {
    const { elementZuBlock, blockZuElementen } = erzeugeBpmn(beispielLieferdienst())
    expect(blockZuElementen.get('ent_vorrat')?.sort()).toEqual(['ent_vorrat_auf', 'ent_vorrat_zu'])
    expect(blockZuElementen.get('wdh_kommission')?.sort()).toEqual(['wdh_kommission_ein', 'wdh_kommission_frage'])
    expect(elementZuBlock.get('auf_tour')).toBe('auf_tour')
  })

  it('zeichnet einen leeren Prozess als Start und Ende', async () => {
    const { xml, layout } = erzeugeBpmn(neuerProzess({ name: 'Leer' }))
    await pruefeSchema(xml)
    expect(layout.knoten.map((k) => k.art)).toEqual(['start', 'ende'])
  })

  it('übersteht 300 zufällige verschachtelte Prozesse', async () => {
    const fehler: string[] = []
    for (let s = 1; s <= 300; s++) {
      const p = zufallsProzess(s)
      const { layout, xml } = erzeugeBpmn(p)
      for (const f of geometrieFehler(layout)) fehler.push(`Startwert ${s}: ${f}`)
      if (s % 10 === 0) await pruefeSchema(xml)
    }
    expect(fehler.slice(0, 10)).toEqual([])
  })
})
