/**
 * Prüfsumme freigegebener Versionen (Prüfung daten-4, logik-19): Sie deckt den
 * eingefrorenen Prozess ab und lässt sich nach dem Laden nachrechnen.
 */
import { describe, expect, it } from 'vitest'
import { beispielLieferdienst } from '../modell/beispiel'
import { alsJson, leseProjektText } from '../modell/speicher'
import { beispielMitCompliance, complianceLieferdienst } from './beispiel'
import type { DokuVersion } from './typen'
import { freigeben, pruefsumme, pruefsummeStimmt } from './versionen'

const HEUTE = '2026-11-11'

/** Datei mit einer freigegebenen Version als JSON-Daten zum Verändern */
async function datei(): Promise<Record<string, any>> {
  const c = complianceLieferdienst()
  const v = await freigeben(beispielLieferdienst(), c, { bezeichnung: '1.0', gueltigAb: HEUTE, freigegebenVon: 'Erika Mustermann', aenderung: 'Erstfassung' }, HEUTE)
  return JSON.parse(alsJson({ ...beispielMitCompliance(), compliance: { ...c, versionen: [v] } }))
}

const geladen = (d: Record<string, any>): DokuVersion => leseProjektText(JSON.stringify(d)).compliance!.versionen[0]

describe('Nachrechnen der Prüfsumme', () => {
  it('stimmt für eine unveränderte Version nach Speichern und Laden', async () => {
    expect(await pruefsummeStimmt(geladen(await datei()))).toBe(true)
  })

  it('erkennt einen geänderten Absatz in der gespeicherten Version', async () => {
    const d = await datei()
    const abschnitte = d.compliance.versionen[0].verfahrensdoku.abschnitte
    abschnitte[abschnitte.findIndex((a: { art: string }) => a.art === 'absatz')].text = 'Beschädigt oder nachträglich geändert.'
    expect(await pruefsummeStimmt(geladen(d))).toBe(false)
  })

  it('deckt den eingefrorenen Prozess ab, aus dem das Diagramm der Anlage entsteht', async () => {
    const d = await datei()
    const prozess = d.compliance.versionen[0].prozess
    prozess.ablauf.schritte = prozess.ablauf.schritte.slice(0, 1)
    expect(await pruefsummeStimmt(geladen(d))).toBe(false)
    // dieselbe Änderung ändert auch die Prüfsumme selbst
    const v = geladen(await datei())
    expect(await pruefsumme({ ...v, prozess: { ...v.prozess, name: 'Anderer Prozess' } })).not.toBe(v.pruefsumme)
  })

  it('bemerkt auch eine Änderung im Verzeichnis', async () => {
    const d = await datei()
    d.compliance.versionen[0].verzeichnis.titel = 'Anderes Verzeichnis'
    expect(await pruefsummeStimmt(geladen(d))).toBe(false)
  })
})
