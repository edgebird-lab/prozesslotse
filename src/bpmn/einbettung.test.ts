import { describe, expect, it } from 'vitest'
import { neuerProzess, neuesProjekt } from '../modell/bausteine'
import { beispielOnlineProjekt, beispielProjekt } from '../modell/beispiel'
import { Formatfehler } from '../modell/speicher'
import { BpmnModdle } from 'bpmn-moddle'
import { leseDatei, projektAusBpmn, PROJEKT_NS } from './einbettung'
import { bpmnFuerExport, erzeugeBpmn } from './export'

function kopie<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

describe('Projekt im BPMN', () => {
  it('öffnet eine exportierte BPMN-Datei wieder als vollständiges Projekt', () => {
    const projekt = beispielProjekt()
    const g = leseDatei(bpmnFuerExport(projekt, 'ist'))
    expect(g.art).toBe('projekt')
    if (g.art !== 'projekt') return
    expect(g.projekt).toEqual(kopie(projekt))
    expect(g.ansicht).toBe('ist')
  })

  it('merkt sich, ob Ist oder Soll exportiert wurde', () => {
    const projekt = { ...beispielOnlineProjekt() }
    projekt.soll = kopie(projekt.ist)
    expect(leseDatei(bpmnFuerExport(projekt, 'soll'))).toMatchObject({ art: 'projekt', ansicht: 'soll' })
    // ohne Soll gibt es nur Ist
    expect(leseDatei(bpmnFuerExport(beispielOnlineProjekt(), 'soll'))).toMatchObject({ art: 'projekt', ansicht: 'ist' })
  })

  it('übersteht Sonderzeichen in Namen', () => {
    const p = neuerProzess({ name: 'Prüfen <&> "Angebot" ]]> 🚚 Größe' })
    const projekt = neuesProjekt(p)
    const g = leseDatei(bpmnFuerExport(projekt, 'ist'))
    expect(g.art === 'projekt' && g.projekt.ist.name).toBe('Prüfen <&> "Angebot" ]]> 🚚 Größe')
  })

  it('findet das Projekt auch, wenn ein anderes Werkzeug den Präfix umbenennt oder CDATA nutzt', () => {
    const projekt = beispielProjekt()
    const xml = bpmnFuerExport(projekt, 'ist')
    const umbenannt = xml.replaceAll('<pl:projekt', '<ns7:projekt').replaceAll('</pl:projekt>', '</ns7:projekt>').replace('xmlns:pl=', 'xmlns:ns7=')
    expect(projektAusBpmn(umbenannt)?.projekt).toEqual(kopie(projekt))
    const cdata = `<?xml version="1.0"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:x="${PROJEKT_NS}"><bpmn:process id="P"><bpmn:extensionElements><x:projekt ansicht="ist"><![CDATA[${JSON.stringify(projekt)}]]></x:projekt></bpmn:extensionElements></bpmn:process></bpmn:definitions>`
    expect(projektAusBpmn(cdata)?.projekt).toEqual(kopie(projekt))
  })

  it('zeigt fremde BPMN-Dateien nur an', () => {
    const fremd = erzeugeBpmn(beispielProjekt().ist).xml
    expect(leseDatei(fremd)).toMatchObject({ art: 'fremdesBpmn' })
    expect(leseDatei(`﻿${fremd}`)).toMatchObject({ art: 'fremdesBpmn' })
  })

  it('meldet beschädigte und unbekannte Dateien verständlich', () => {
    const kaputt = bpmnFuerExport(beispielProjekt(), 'ist').replace(/("formatVersion":)/, '$1 x')
    expect(() => leseDatei(kaputt)).toThrow(Formatfehler)
    expect(() => leseDatei('<html><body>Hallo</body></html>')).toThrow('weder ein Prozesslotse-Projekt noch ein BPMN-Diagramm')
    expect(() => leseDatei('kein json')).toThrow('kein gültiges JSON')
  })

  it('bleibt gültiges BPMN, das andere Werkzeuge lesen können', async () => {
    const { warnings, rootElement } = await BpmnModdle().fromXML(bpmnFuerExport(beispielProjekt(), 'ist'))
    expect(warnings).toEqual([])
    expect(rootElement.rootElements?.some((r) => r.$type === 'bpmn:Process')).toBe(true)
  })
})
