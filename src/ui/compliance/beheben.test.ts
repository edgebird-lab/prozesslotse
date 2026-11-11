import { describe, expect, it } from 'vitest'
import { kontext } from '../../compliance/ableitung'
import { complianceLieferdienst } from '../../compliance/beispiel'
import { pruefeCompliance } from '../../compliance/regeln'
import { neueCompliance } from '../../compliance/standard'
import { beispielLieferdienst, beispielOnlinebestellung } from '../../modell/beispiel'
import type { ComplianceProjekt } from '../../compliance/typen'
import { behebenName, feldZiel } from './beheben'

const HEUTE = '2026-11-11'

describe('Knopf „Beheben“: zugänglicher Name mit Objekt', () => {
  it('unterscheidet gleichlautende Befunde im Projekt ohne Angaben', () => {
    const p = beispielOnlinebestellung()
    const c = neueCompliance()
    const namen = pruefeCompliance(p, c, HEUTE).map((b) => behebenName(b, kontext(p, c)))
    expect(new Set(namen).size).toBe(namen.length)
    expect(namen).toContain('Beheben: Schutzmaßnahmen fehlen – Verschlüsselung')
    expect(namen).toContain('Beheben: Betrieb des Systems unklar – ERP')
    // Befunde ohne eigenes Objekt behalten den Titel
    expect(namen).toContain('Beheben: Zahl der Personen fehlt')
  })

  it('nennt Unterlage, System und Schritt', () => {
    const p = beispielLieferdienst()
    const c = complianceLieferdienst()
    const namen = pruefeCompliance(p, c, HEUTE).map((b) => behebenName(b, kontext(p, c)))
    expect(namen).toContain('Beheben: Aufbewahrungsfrist fehlt – Bestellnotiz')
    expect(namen).toContain('Beheben: Programmversion fehlt – Warenwirtschaft')
    expect(namen).toContain('Beheben: Kontrolle ohne Nachweis – Kommissionierung kontrollieren')
  })
})

describe('„Beheben“ springt auch bei den neuen Regeln auf die Frage (B10, B11, S7, S8, D5)', () => {
  /** Ziel des ersten Befunds der Regel im Beispiel nach der Änderung */
  function ziel(regel: string, aendern: (c: ComplianceProjekt) => void, p = beispielLieferdienst()): string | null {
    const c = complianceLieferdienst()
    aendern(c)
    const b = pruefeCompliance(p, c, HEUTE).find((x) => x.regel === regel)
    if (!b) throw new Error(`kein Befund ${regel}`)
    return feldZiel(b, c)
  }

  it('B10: Namensfeld von „Neue Unterlage“', () => {
    const p = beispielLieferdienst()
    const c = neueCompliance()
    const b = pruefeCompliance(p, c, HEUTE).find((x) => x.regel === 'B10')!
    expect(feldZiel(b, c)).toBe('ziel-datenobjekt')
  })

  it('B11: gewählte Frist des Lieferscheins', () => {
    expect(ziel('B11', (c) => (c.datenobjekte.dob_lieferschein.aufbewahrungJahre = null))).toBe('ziel-frist-dob_lieferschein')
  })

  it('S7: Bewilligung im Drittland, sonst der Ort der Verarbeitung', () => {
    expect(ziel('S7', (c) => Object.assign(c.systeme.med_erp, { standort: 'drittland', drittland: 'USA', garantie: 'standardvertragsklauseln' }))).toBe('ziel-system-med_erp-bewilligung')
    expect(ziel('S7', (c) => (c.systeme.med_erp.standort = 'unbekannt'))).toBe('ziel-system-med_erp-standort')
  })

  it('S8: zuerst Wiederfinden, dann Datenzugriff', () => {
    expect(ziel('S8', (c) => (c.systeme.med_erp.wiederfinden = ''))).toBe('ziel-system-med_erp-wiederfinden')
    expect(ziel('S8', (c) => (c.systeme.med_erp.datenzugriff = ' '))).toBe('ziel-system-med_erp-datenzugriff')
  })

  it('D5: ohne Ausnahme nach Art. 9 Abs. 2 deren Auswahl, mit ihr die Kategorien', () => {
    const besondere = (c: ComplianceProjekt) => (c.datenobjekte.dob_rechnung.besondereKategorien = ['gesundheit'])
    expect(ziel('D5', besondere)).toBe('ziel-datenobjekt-dob_rechnung-art9')
    expect(
      ziel('D5', (c) => {
        besondere(c)
        c.datenobjekte.dob_rechnung.ausnahmeArt9 = 'einwilligung'
      }),
    ).toBe('ziel-datenobjekt-dob_rechnung-besondere')
  })
})
