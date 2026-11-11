/**
 * logik-9 (Rest aus der Nachprüfung „erledigt“): Datumsangaben nach heute bei
 * „Im Einsatz seit“, „Vertrag vom“, „Bewilligung des Finanzamts vom“ und
 * „Eingeführt am“ meldet Regel S9 als Hinweis; meist ist es ein Tippfehler.
 */
import { describe, expect, it } from 'vitest'
import { beispielLieferdienst } from '../modell/beispiel'
import { complianceLieferdienst } from './beispiel'
import { pruefeCompliance } from './regeln'
import type { ComplianceProjekt } from './typen'

const HEUTE = '2026-11-11'

const s9 = (c: ComplianceProjekt, heute = HEUTE) => pruefeCompliance(beispielLieferdienst(), c, heute).filter((b) => b.regel === 'S9')

describe('S9 Datum in der Zukunft', () => {
  it('„Im Einsatz seit“ nach heute: Hinweis am System, der zur Frage springt', () => {
    const c = complianceLieferdienst()
    c.systeme.med_excel.seit = '2062-06-30'
    expect(s9(c)).toEqual([
      {
        schluessel: 'compliance:S9:med_excel',
        regel: 'S9',
        teilschritt: 'systeme',
        schwere: 'hinweis',
        titel: 'Datum in der Zukunft',
        text: 'Für „Excel-Tourenliste“ liegt „Im Einsatz seit“ in der Zukunft (30.06.2062). Datum prüfen.',
        quelle: 'Plausibilitätsprüfung der App',
        ziel: { art: 'system', id: 'med_excel' },
      },
    ])
  })

  it('„Vertrag vom“ und „Bewilligung des Finanzamts vom“ nach heute: ein Hinweis je System, beide Angaben genannt', () => {
    const c = complianceLieferdienst()
    Object.assign(c.systeme.med_erp, { avVertrag: 'ja', avVertragVom: '2027-01-15', standort: 'drittland', drittland: 'USA', garantie: 'standardvertragsklauseln', bewilligungVom: '2027-02-01' })
    const befunde = s9(c)
    expect(befunde).toHaveLength(1)
    expect(befunde[0].text).toBe('Für „Warenwirtschaft“ liegen „Vertrag vom“ (15.01.2027) und „Bewilligung des Finanzamts vom“ (01.02.2027) in der Zukunft. Daten prüfen.')
    expect(befunde[0].ziel).toEqual({ art: 'system', id: 'med_erp' })
  })

  it('„Eingeführt am“ nach heute: Hinweis im Teilschritt „Unternehmen“', () => {
    const c = complianceLieferdienst()
    c.verarbeitung.eingefuehrtAm = '2027-01-01'
    expect(s9(c)).toEqual([
      {
        schluessel: 'compliance:S9',
        regel: 'S9',
        teilschritt: 'unternehmen',
        schwere: 'hinweis',
        titel: 'Datum in der Zukunft',
        text: '„Eingeführt am“ der Verarbeitungstätigkeit liegt in der Zukunft (01.01.2027). Datum prüfen.',
        quelle: 'Plausibilitätsprüfung der App',
        ziel: { art: 'unternehmen', id: 'eingefuehrt' },
      },
    ])
  })

  it('heute und früher meldet nichts; ausgeblendete Angaben auch nicht', () => {
    const c = complianceLieferdienst()
    c.systeme.med_excel.seit = HEUTE
    c.verarbeitung.eingefuehrtAm = '2020-01-01'
    // Vertrag nur, wenn es einen gibt; Bewilligung nur bei Aufbewahrung im Drittland
    Object.assign(c.systeme.med_erp, { avVertrag: 'nein', avVertragVom: '2099-01-01', standort: 'eu_ewr', bewilligungVom: '2099-01-01' })
    expect(s9(c)).toEqual([])
    // Das Beispiel bleibt bei seinen 7 Befunden
    expect(pruefeCompliance(beispielLieferdienst(), complianceLieferdienst(), HEUTE)).toHaveLength(7)
  })
})
