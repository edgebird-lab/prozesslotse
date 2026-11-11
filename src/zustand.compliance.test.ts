import { describe, expect, it } from 'vitest'
import { beispielMitCompliance } from './compliance/beispiel'
import { loescheUnterlage } from './compliance/unterlagen'
import { beispielProjekt } from './modell/beispiel'
import { entferneBlock, entferneMedium } from './modell/operationen'
import { reduziere, startZustand, type Zustand } from './zustand'

const start = (): Zustand => startZustand(beispielMitCompliance(), true)

describe('Zustand: Compliance-Angaben', () => {
  it('ändert Angaben rückgängig machbar und fasst Tippen zusammen', () => {
    let z = start()
    for (const [i, name] of ['L', 'Li', 'Lie'].entries()) {
      z = reduziere(z, { typ: 'compliance', aenderung: (c) => ({ ...c, unternehmen: { ...c.unternehmen, name } }), gruppe: 'unternehmen.name', zeit: 1000 + i * 300 })
    }
    expect(z.projekt.compliance?.unternehmen.name).toBe('Lie')
    expect(z.vergangenheit).toHaveLength(1)
    z = reduziere(z, { typ: 'rueckgaengig' })
    expect(z.projekt.compliance?.unternehmen.name).toBe('Lieferdienst Muster GmbH')
  })

  it('legt Compliance-Angaben erst bei der ersten Änderung an', () => {
    let z = startZustand(beispielProjekt(), true)
    z = reduziere(z, { typ: 'compliance', aenderung: (c) => c, zeit: 1 })
    expect(z.projekt.compliance).toBeUndefined()
    expect(z.vergangenheit).toHaveLength(0)
    z = reduziere(z, { typ: 'compliance', aenderung: (c) => ({ ...c, mitgeltend: ['Berechtigungskonzept'] }), zeit: 2 })
    expect(z.projekt.compliance?.mitgeltend).toEqual(['Berechtigungskonzept'])
    expect(z.projekt.compliance?.version).toBe(1)
  })

  it('löscht eine Unterlage mit Angaben und Zugriffen in einem Rückgängig-Schritt', () => {
    const z0 = start()
    const z1 = reduziere(z0, { typ: 'compliance', aenderung: (c) => loescheUnterlage(c, 'dob_rechnung'), zeit: 1 })
    expect(z1.projekt.compliance?.datenobjekte.dob_rechnung).toBeUndefined()
    expect(z1.projekt.compliance?.zugriffe.some((x) => x.unterlageId === 'dob_rechnung')).toBe(false)
    const z2 = reduziere(z1, { typ: 'rueckgaengig' })
    expect(z2.projekt.compliance).toBe(z0.projekt.compliance)
  })

  it('bereinigt beim Löschen einer Aufgabe im Ist im selben Schritt', () => {
    const z0 = start()
    const z1 = reduziere(z0, { typ: 'prozess', aenderung: (p) => entferneBlock(p, 'auf_rechnung'), zeit: 1 })
    const c = z1.projekt.compliance!
    expect(c.zugriffe.some((x) => x.aufgabeId === 'auf_rechnung')).toBe(false)
    expect(c.unterlagen.find((u) => u.id === 'dob_rechnung')?.name).toBe('Ausgangsrechnung')
    expect(z1.vergangenheit).toHaveLength(1)
    const z2 = reduziere(z1, { typ: 'rueckgaengig' })
    expect(z2.projekt).toBe(z0.projekt)
  })

  it('löst Ablageorte von einem gelöschten Medium', () => {
    const z = reduziere(start(), { typ: 'prozess', aenderung: (p) => entferneMedium(p, 'med_papier'), zeit: 1 })
    expect(z.projekt.compliance?.ablageorte.find((a) => a.id === 'dsp_ordner')?.mediumId).toBeNull()
  })

  it('lässt die Angaben bei Änderungen am Soll-Prozess unverändert', () => {
    let z = start()
    z = reduziere(z, { typ: 'projekt', projekt: { ...z.projekt, soll: structuredClone(z.projekt.ist) }, zeit: 1, ansicht: 'soll' })
    const vorher = z.projekt.compliance
    z = reduziere(z, { typ: 'prozess', aenderung: (p) => entferneBlock(p, 'auf_freigeben'), zeit: 2 })
    expect(z.projekt.soll?.ablauf.schritte.some((b) => b.id === 'auf_freigeben')).toBe(false)
    expect(z.projekt.compliance).toBe(vorher)
  })

  it('wechselt im Schritt „Dokumentieren“ auf den Ist-Prozess; der Teilschritt ist nicht rückgängig machbar', () => {
    let z = start()
    z = reduziere(z, { typ: 'projekt', projekt: { ...z.projekt, soll: structuredClone(z.projekt.ist) }, zeit: 1, ansicht: 'soll' })
    expect(z.ansicht).toBe('soll')
    z = reduziere(z, { typ: 'schritt', schritt: 'dokumentieren' })
    expect(z.ansicht).toBe('ist')
    expect(z.teilschritt).toBe('unternehmen')
    const verlauf = z.vergangenheit.length
    z = reduziere(z, { typ: 'teilschritt', teilschritt: 'luecken' })
    expect(z.teilschritt).toBe('luecken')
    expect(z.vergangenheit).toHaveLength(verlauf)
  })
})
