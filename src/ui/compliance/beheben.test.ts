import { describe, expect, it } from 'vitest'
import { kontext } from '../../compliance/ableitung'
import { complianceLieferdienst } from '../../compliance/beispiel'
import { pruefeCompliance } from '../../compliance/regeln'
import { neueCompliance } from '../../compliance/standard'
import { beispielLieferdienst, beispielOnlinebestellung } from '../../modell/beispiel'
import { behebenName } from './beheben'

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
