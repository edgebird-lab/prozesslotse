import { describe, expect, it } from 'vitest'
import { neueAufgabe, neueEntscheidung, neueParallel, neuerProzess, neueRolle, neuerZweig, neueWiederholung, neuesMedium } from '../modell/bausteine'
import { beispielLieferdienst } from '../modell/beispiel'
import type { Aufgabe, Block, Prozess, Rolle } from '../modell/typen'
import { berechneKennzahlen } from './kennzahlen'
import { simuliere } from './simulation'

const R = neueRolle('Team', { stundensatz: 60, personen: 1, verfuegbarProzent: 100 })
const R2 = neueRolle('Prüfung', { stundensatz: 60 })

function aufgabe(name: string, bearbeitungMin: number, liegezeitMin = 0, rolle: Rolle = R, werte: Partial<Aufgabe> = {}): Aufgabe {
  return neueAufgabe({ name, bearbeitungMin, liegezeitMin, rolleId: rolle.id, ...werte })
}

function prozess(schritte: Block[], werte: Partial<Prozess> = {}): Prozess {
  return neuerProzess({ name: 'Test', vorgaengeProTag: 10, rollen: [R, R2], ablauf: { id: 'haupt', schritte }, ...werte })
}

describe('Kennzahlen', () => {
  // A (20 Min. liegen, 10 Min. arbeiten) → Entscheidung 75 % nichts / 25 % B (30 Min.) → Wiederholung 50 % von C (10 Min.)
  const a = aufgabe('A erledigen', 10, 20)
  const b = aufgabe('B erledigen', 30)
  const c = aufgabe('C erledigen', 10)
  const ent = neueEntscheidung({ frage: 'B nötig?', zweige: [neuerZweig('Nein', 0.75), neuerZweig('Ja', 0.25, { schritte: [b] })] })
  const wdh = neueWiederholung({ anteilWiederholung: 0.5, koerper: { id: 'k', schritte: [c] } })
  const einfach = prozess([a, ent, wdh])

  it('rechnet Durchlaufzeit, Häufigkeiten und Flusseffizienz wie von Hand', () => {
    const k = berechneKennzahlen(einfach)
    // 30 + 0,25 · 30 + 10 / (1 − 0,5) = 57,5
    expect(k.durchlaufzeitMin).toBeCloseTo(57.5, 10)
    expect(k.schritte.get(a.id)?.haeufigkeit).toBeCloseTo(1, 10)
    expect(k.schritte.get(b.id)?.haeufigkeit).toBeCloseTo(0.25, 10)
    expect(k.schritte.get(c.id)?.haeufigkeit).toBeCloseTo(2, 10)
    expect(k.arbeitszeitMin).toBeCloseTo(37.5, 10)
    expect(k.flusseffizienz).toBeCloseTo(37.5 / 57.5, 10)
  })

  it('rechnet Kosten, Auslastung und offene Vorgänge', () => {
    const k = berechneKennzahlen(einfach)
    expect(k.kostenProVorgang).toBeCloseTo(37.5, 10) // 37,5 Min. zu 60 €/Std.
    expect(k.kostenProTag).toBeCloseTo(375, 10)
    const team = k.rollen.find((r) => r.rolle.id === R.id)
    expect(team?.stundenProTag).toBeCloseTo(6.25, 10) // 10 Vorgänge · 37,5 Min.
    expect(team?.auslastung).toBeCloseTo(6.25 / 8, 10)
    expect(k.engpass?.rolle.id).toBe(R.id)
    expect(k.offeneVorgaenge).toBeCloseTo((10 * 57.5) / 480, 10) // Little
  })

  it('berücksichtigt ein vorzeitiges Prozessende', () => {
    const x = aufgabe('X erledigen', 10)
    const y = aufgabe('Y erledigen', 5)
    const z = aufgabe('Z erledigen', 20)
    const e = neueEntscheidung({ frage: 'Ablehnen?', zweige: [neuerZweig('Ja', 0.2, { ende: 'Abgelehnt', schritte: [y] }), neuerZweig('Nein', 0.8)] })
    const k = berechneKennzahlen(prozess([x, e, z], { ergebnis: 'Erledigt' }))
    expect(k.durchlaufzeitMin).toBeCloseTo(27, 10) // 10 + 0,2 · 5 + 0,8 · 20
    expect(k.schritte.get(z.id)?.haeufigkeit).toBeCloseTo(0.8, 10)
    expect(k.enden).toEqual([
      { ergebnis: 'Erledigt', anteil: expect.closeTo(0.8, 10), regulaer: true },
      { ergebnis: 'Abgelehnt', anteil: expect.closeTo(0.2, 10), regulaer: false },
    ])
  })

  it('nimmt bei „Gleichzeitig“ den längsten Zweig und zählt Übergaben je Strang', () => {
    const papier = neuesMedium('Papier', 'papier')
    const erp = neuesMedium('ERP', 'erp')
    const x = aufgabe('X erledigen', 10, 0, R, { mediumId: erp.id })
    const y = aufgabe('Y erledigen', 10, 60, R2, { mediumId: erp.id })
    const z = aufgabe('Z erledigen', 30, 0, R, { mediumId: papier.id })
    const w = aufgabe('W erledigen', 5, 0, R, { mediumId: erp.id })
    const par = neueParallel()
    par.zweige[0].schritte.push(y)
    par.zweige[1].schritte.push(z)
    const k = berechneKennzahlen(prozess([x, par, w], { medien: [papier, erp] }))
    expect(k.durchlaufzeitMin).toBeCloseTo(85, 10) // 10 + max(70, 30) + 5
    expect(k.kritischeArbeitMin).toBeCloseTo(25, 10)
    expect(k.arbeitszeitMin).toBeCloseTo(55, 10)
    expect(k.uebergaben).toBeCloseTo(2, 10) // X→Y und Y→W wechseln die Rolle
    expect(k.systemwechsel).toBeCloseTo(2, 10) // X→Z und Z→W wechseln das System
  })

  it('zählt Übergaben in Wiederholungen über alle Durchläufe', () => {
    const s = aufgabe('S erledigen', 1, 0, R2)
    const x = aufgabe('X erledigen', 1, 0, R)
    const y = aufgabe('Y prüfen', 1, 0, R2)
    const w = neueWiederholung({ anteilWiederholung: 0.5, koerper: { id: 'k2', schritte: [x, y] } })
    const k = berechneKennzahlen(prozess([s, w]))
    // S→X einmal, X→Y zweimal, Y→X einmal (Rücksprung): alle wechseln die Rolle
    expect(k.paare.get(`${s.id}>${x.id}`)).toBeCloseTo(1, 10)
    expect(k.paare.get(`${x.id}>${y.id}`)).toBeCloseTo(2, 10)
    expect(k.paare.get(`${y.id}>${x.id}`)).toBeCloseTo(1, 10)
    expect(k.uebergaben).toBeCloseTo(4, 10)
  })

  it('löst eine Wiederholung mit möglichem Prozessende geschlossen', () => {
    const x = aufgabe('X erledigen', 10)
    const e = neueEntscheidung({ frage: 'Abbrechen?', zweige: [neuerZweig('Ja', 0.1, { ende: 'Abgebrochen' }), neuerZweig('Nein', 0.9)] })
    const w = neueWiederholung({ anteilWiederholung: 0.5, koerper: { id: 'k3', schritte: [x, e] } })
    const k = berechneKennzahlen(prozess([w]))
    // Körper läuft 1 / (1 − 0,5 · 0,9) = 1,818…-mal
    expect(k.schritte.get(x.id)?.haeufigkeit).toBeCloseTo(1 / 0.55, 10)
    expect(k.enden.find((x) => !x.regulaer)?.anteil).toBeCloseTo(0.1 / 0.55, 10)
    expect(k.enden.reduce((s, x) => s + x.anteil, 0)).toBeCloseTo(1, 10)
  })

  it('zählt Medienbrüche nach Häufigkeit', () => {
    const x = aufgabe('X erfassen', 4, 0, R, { uebertragung: { quelleMediumId: null, minuten: 3 } })
    const e = neueEntscheidung({ frage: 'Nötig?', zweige: [neuerZweig('Ja', 0.5, { schritte: [x] }), neuerZweig('Nein', 0.5)] })
    const k = berechneKennzahlen(prozess([e]))
    expect(k.medienbrueche).toBeCloseTo(0.5, 10)
    expect(k.uebertragungMin).toBeCloseTo(1.5, 10)
  })

  it('stimmt mit der Simulation überein, wenn nichts parallel läuft', () => {
    const k = berechneKennzahlen(einfach)
    const s = simuliere(einfach, 40_000, 7)
    expect(s.mittelMin).toBeGreaterThan(k.durchlaufzeitMin * 0.98)
    expect(s.mittelMin).toBeLessThan(k.durchlaufzeitMin * 1.02)
    expect(s.medianMin).toBeLessThanOrEqual(s.p90Min)
  })

  it('liefert für das Fallbeispiel plausible Werte', () => {
    const p = beispielLieferdienst()
    const k = berechneKennzahlen(p)
    const s = simuliere(p)
    expect(k.enden.reduce((x, e) => x + e.anteil, 0)).toBeCloseTo(1, 10)
    expect(k.engpass?.rolle.id).toBe('rol_leitung')
    expect(k.flusseffizienz).toBeLessThan(0.05)
    expect(k.medienbrueche).toBeCloseTo(1 + 0.976 + 0.976, 10)
    // Simulation und Formel liegen nah beieinander (hier läuft nichts parallel)
    expect(Math.abs(s.mittelMin - k.durchlaufzeitMin) / k.durchlaufzeitMin).toBeLessThan(0.02)
  })
})
