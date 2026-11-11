import { describe, expect, it } from 'vitest'
import { bewerteVorschlaege } from '../analyse/regeln'
import { leseDatei } from '../bpmn/einbettung'
import { bpmnFuerExport } from '../bpmn/export'
import { beispielProjekt } from '../modell/beispiel'
import { beispielMitCompliance } from './beispiel'
import { gestricheneKontrollen } from './verzahnung'

describe('Verzahnung mit „Verbessern“ (6.10)', () => {
  it('meldet die dokumentierte Freigabe, die der Vorschlag „Freigabe streichen“ entfernt', () => {
    const projekt = beispielMitCompliance()
    const v = bewerteVorschlaege(projekt.ist).find((x) => x.regel === 'freigabe')
    expect(v?.titel).toBe('Freigabe „Rechnung freigeben“ streichen')
    expect(gestricheneKontrollen(projekt, v!.anwenden(projekt.ist))).toEqual(['auf_freigeben'])
  })

  it('meldet nichts, wenn keine dokumentierte Kontrolle wegfällt oder es keine Angaben gibt', () => {
    const projekt = beispielMitCompliance()
    for (const v of bewerteVorschlaege(projekt.ist).filter((x) => x.regel !== 'freigabe')) expect(gestricheneKontrollen(projekt, v.anwenden(projekt.ist)), v.titel).toEqual([])
    const ohne = beispielProjekt()
    const freigabe = bewerteVorschlaege(ohne.ist).find((x) => x.regel === 'freigabe')!
    expect(gestricheneKontrollen(ohne, freigabe.anwenden(ohne.ist))).toEqual([])
  })
})

describe('BPMN-Export ohne Compliance-Angaben (9.9)', () => {
  it('lässt die Angaben nur in der Datei weg, das Projekt bleibt unverändert', () => {
    const projekt = beispielMitCompliance()
    const vorher = JSON.stringify(projekt)
    const ohne = leseDatei(bpmnFuerExport(projekt, 'ist', { ohneCompliance: true }))
    expect(ohne.art === 'projekt' && ohne.projekt.compliance).toBeUndefined()
    expect(JSON.stringify(projekt)).toBe(vorher)
    const mit = leseDatei(bpmnFuerExport(projekt, 'ist'))
    expect(mit.art === 'projekt' && mit.projekt.compliance).toEqual(projekt.compliance)
  })
})
