import { describe, expect, it } from 'vitest'
import { ausMinuten, formatiereDauer, formatiereEuro, formatiereProzent, formatiereZahl, inMinuten, passendeEinheit } from './zeit'

describe('Zeiten', () => {
  it('rechnet Einheiten mit einem 8-Stunden-Tag um', () => {
    expect(inMinuten(1.5, 'std', 8)).toBe(90)
    expect(inMinuten(2, 'tag', 8)).toBe(960)
    expect(ausMinuten(240, 'tag', 8)).toBe(0.5)
  })

  it('wählt eine passende Einheit zum Bearbeiten', () => {
    expect(passendeEinheit(20, 8)).toBe('min')
    expect(passendeEinheit(90, 8)).toBe('std')
    expect(passendeEinheit(100, 8)).toBe('min')
    expect(passendeEinheit(480, 8)).toBe('tag')
    expect(passendeEinheit(600, 8)).toBe('tag')
    expect(passendeEinheit(300, 8)).toBe('std')
  })

  it('formatiert Dauern lesbar', () => {
    expect(formatiereDauer(45, 8)).toBe('45 Min.')
    expect(formatiereDauer(4.5, 8)).toBe('4,5 Min.')
    expect(formatiereDauer(150, 8)).toBe('2,5 Std.')
    expect(formatiereDauer(480, 8)).toBe('1 Arbeitstag')
    expect(formatiereDauer(720, 8)).toBe('1,5 Arbeitstage')
  })

  it('formatiert Zahlen, Prozente und Euro auf Deutsch', () => {
    expect(formatiereZahl(-0.04)).toBe('0')
    expect(formatiereZahl(1234.56, 1)).toBe('1.234,6')
    expect(formatiereProzent(0.123)).toBe('12 %')
    expect(formatiereEuro(3.5).replace(/\s/g, ' ')).toBe('3,50 €')
  })
})
