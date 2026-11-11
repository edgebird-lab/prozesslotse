import { BpmnModdle } from 'bpmn-moddle'
import { describe, expect, it } from 'vitest'
import { neuerProzess } from '../modell/bausteine'
import { beispielLieferdienst } from '../modell/beispiel'
import { erzeugeBpmn } from './export'
import { zufallsProzess } from '../testhilfen/zufallsprozess'
import { geometrieFehler } from '../testhilfen/geometrie'

async function pruefeSchema(xml: string): Promise<void> {
  const moddle = BpmnModdle()
  const { rootElement, warnings } = await moddle.fromXML(xml)
  expect(warnings.map((w: { message: string }) => w.message)).toEqual([])
  expect(rootElement.$type).toBe('bpmn:Definitions')
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
  }, 60_000)
})
