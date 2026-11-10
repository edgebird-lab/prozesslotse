import { describe, expect, it } from 'vitest'
import { neueAufgabe, neueRolle } from './modell/bausteine'
import { beispielProjekt } from './modell/beispiel'
import { entferneBlock, fuegeEin } from './modell/operationen'
import { aktiverProzess, reduziere, startZustand, wirksamerCursor, type Zustand } from './zustand'

const start = (): Zustand => startZustand(beispielProjekt(), true)

describe('Zustand mit Rückgängig', () => {
  it('macht Änderungen rückgängig und wiederholt sie', () => {
    const z0 = start()
    const z1 = reduziere(z0, { typ: 'prozess', aenderung: (p) => ({ ...p, name: 'Neu' }), zeit: 1000 })
    expect(z1.projekt.ist.name).toBe('Neu')
    const z2 = reduziere(z1, { typ: 'rueckgaengig' })
    expect(z2.projekt.ist.name).toBe(z0.projekt.ist.name)
    const z3 = reduziere(z2, { typ: 'wiederholen' })
    expect(z3.projekt.ist.name).toBe('Neu')
  })

  it('fasst Tippen im selben Feld zu einem Schritt zusammen', () => {
    let z = start()
    for (const [i, name] of ['N', 'Ne', 'Neu'].entries()) {
      z = reduziere(z, { typ: 'prozess', aenderung: (p) => ({ ...p, name }), gruppe: 'rahmen:name', zeit: 1000 + i * 300 })
    }
    expect(z.vergangenheit).toHaveLength(1)
    z = reduziere(z, { typ: 'prozess', aenderung: (p) => ({ ...p, name: 'Später' }), gruppe: 'rahmen:name', zeit: 9000 })
    expect(z.vergangenheit).toHaveLength(2)
  })

  it('wendet Änderungen als Funktion nacheinander an, ohne sich zu überschreiben', () => {
    const rolle = neueRolle('Vertrieb')
    const aufgabe = neueAufgabe({ name: 'Angebot schreiben', rolleId: rolle.id })
    let z = start()
    z = reduziere(z, { typ: 'prozess', aenderung: (p) => ({ ...p, rollen: [...p.rollen, rolle] }), zeit: 1 })
    z = reduziere(z, { typ: 'prozess', aenderung: (p) => fuegeEin(p, 'haupt', 0, aufgabe), zeit: 2 })
    const p = aktiverProzess(z)
    expect(p.rollen.at(-1)?.id).toBe(rolle.id)
    expect(p.ablauf.schritte[0].id).toBe(aufgabe.id)
  })

  it('räumt eine Auswahl auf, deren Baustein gelöscht wurde', () => {
    let z = reduziere(start(), { typ: 'auswahl', auswahl: 'auf_tour' })
    z = reduziere(z, { typ: 'prozess', aenderung: (p) => entferneBlock(p, 'auf_tour'), zeit: 1 })
    expect(z.auswahl).toBeNull()
  })

  it('bearbeitet in der Soll-Ansicht den Soll-Prozess und fällt ohne Soll auf Ist zurück', () => {
    let z = reduziere(start(), { typ: 'ansicht', ansicht: 'soll' })
    expect(z.ansicht).toBe('ist')
    z = reduziere(z, { typ: 'projekt', projekt: { ...z.projekt, soll: structuredClone(z.projekt.ist) }, zeit: 1, ansicht: 'soll' })
    z = reduziere(z, { typ: 'prozess', aenderung: (p) => ({ ...p, name: 'Soll-Name' }), zeit: 2 })
    expect(z.projekt.soll?.name).toBe('Soll-Name')
    expect(z.projekt.ist.name).not.toBe('Soll-Name')
  })

  it('setzt die Einfügeposition ohne Angabe ans Ende des Hauptablaufs', () => {
    const z = start()
    const p = aktiverProzess(z)
    expect(wirksamerCursor(z, p)).toEqual({ sequenzId: 'haupt', index: p.ablauf.schritte.length })
  })
})
