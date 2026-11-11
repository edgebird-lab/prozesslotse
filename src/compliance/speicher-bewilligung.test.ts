import { describe, expect, it } from 'vitest'
import { Formatfehler } from '../modell/speicher'
import { complianceLieferdienst } from './beispiel'
import { validiereCompliance } from './speicher'

// recht-1: das neue Feld „Bewilligung des Finanzamts vom“ wird geprüft; ältere Dateien ohne das Feld laden weiter

describe('Feld bewilligungVom (recht-1)', () => {
  const mit = (wert: unknown) => {
    const c = JSON.parse(JSON.stringify(complianceLieferdienst())) as Record<string, unknown> & { systeme: Record<string, Record<string, unknown>> }
    c.systeme.med_erp.bewilligungVom = wert
    return c
  }

  it('lädt Dateien ohne das Feld, mit Datum oder leer', () => {
    expect(() => validiereCompliance(JSON.parse(JSON.stringify(complianceLieferdienst())))).not.toThrow()
    expect(() => validiereCompliance(mit('2026-02-01'))).not.toThrow()
    expect(() => validiereCompliance(mit(null))).not.toThrow()
  })

  it('meldet ein ungültiges Datum mit Feldnamen', () => {
    expect(() => validiereCompliance(mit('2026-02-30'))).toThrow(Formatfehler)
    expect(() => validiereCompliance(mit('2026-02-30'))).toThrow('systeme.med_erp.bewilligungVom')
    expect(() => validiereCompliance(mit(42))).toThrow('systeme.med_erp.bewilligungVom')
  })
})
