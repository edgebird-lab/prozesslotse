import { describe, expect, it } from 'vitest'
import { empfaengerVorschlaege, gehoertZuBetroffenen } from './empfaenger'
import { neuerEmpfaenger } from './standard'

describe('Vorschläge für externe Empfänger', () => {
  it('erkennt Teilnehmer, die zu einer angehakten Gruppe der Betroffenen gehören', () => {
    expect(gehoertZuBetroffenen('Kunde', ['kunden'])).toBe(true)
    expect(gehoertZuBetroffenen('Endkunden', ['kunden'])).toBe(true)
    expect(gehoertZuBetroffenen('Lieferant', ['lieferanten'])).toBe(true)
    expect(gehoertZuBetroffenen('Paketdienstleister', ['lieferanten'])).toBe(true)
    expect(gehoertZuBetroffenen('Bewerberin', ['bewerber'])).toBe(true)
    expect(gehoertZuBetroffenen('Kunde', ['beschaeftigte'])).toBe(false)
    expect(gehoertZuBetroffenen('Kundenservice', ['kunden'])).toBe(false)
    expect(gehoertZuBetroffenen('Steuerberatung', ['kunden', 'sonstige'])).toBe(false)
  })

  it('schlägt den Kunden nicht vor, wenn Kunden betroffen sind; andere Externe schon', () => {
    const d = { betroffene: ['kunden' as const], externeEmpfaenger: [] }
    expect(empfaengerVorschlaege(['Kunde', 'Spedition'], d)).toEqual(['Spedition'])
    expect(empfaengerVorschlaege(['Kunde', 'Spedition'], { ...d, betroffene: [] })).toEqual(['Kunde', 'Spedition'])
  })

  it('schlägt keine schon eingetragenen Empfänger vor', () => {
    expect(empfaengerVorschlaege(['Spedition'], { betroffene: [], externeEmpfaenger: [neuerEmpfaenger({ kategorie: 'Spedition' })] })).toEqual([])
  })
})
