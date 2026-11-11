/**
 * Nachprüfung „sicht“, Mangel 6: Stimmt die Prüfsumme einer Version nicht, meldet
 * „Lücken“ das als Warnung (Regel V4). Das Nachrechnen läuft nach dem Laden
 * asynchron; die Oberfläche übergibt die Versionen mit falscher Prüfsumme.
 */
import { describe, expect, it } from 'vitest'
import { beispielLieferdienst } from '../modell/beispiel'
import { complianceLieferdienst } from './beispiel'
import { offenePunkte, pruefsummenBefunde } from './regeln'
import { freigeben } from './versionen'

const HEUTE = '2026-11-11'

describe('V4 Prüfsumme stimmt nicht', () => {
  it('meldet jede Version mit falscher Prüfsumme als Warnung im Teilschritt „Dokumente“', async () => {
    const v = await freigeben(beispielLieferdienst(), complianceLieferdienst(), { bezeichnung: '1.0', gueltigAb: HEUTE, freigegebenVon: 'Erika Mustermann', aenderung: 'Erstfassung' }, HEUTE)
    const befunde = pruefsummenBefunde([v])
    expect(befunde).toEqual([
      {
        schluessel: 'compliance:V4:1',
        regel: 'V4',
        teilschritt: 'dokumente',
        schwere: 'warnung',
        titel: 'Prüfsumme stimmt nicht',
        text: 'Version 1.0 passt nicht mehr zu ihrer Prüfsumme: Sie wurde außerhalb der App verändert oder ist beschädigt. Öffne eine unveränderte Projektdatei, etwa aus einer Sicherung.',
        quelle: 'GoBD Rz. 154',
        ziel: { art: 'version' },
      },
    ])
    // zählt als offener Punkt: kein Häkchen am Teilschritt
    expect(offenePunkte(befunde, 'dokumente')).toBe(1)
  })

  it('meldet nichts, solange alle Prüfsummen stimmen', () => {
    expect(pruefsummenBefunde([])).toEqual([])
  })
})
