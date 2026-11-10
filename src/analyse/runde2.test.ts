/**
 * Tests zur zweiten Prüfrunde: Warteschlangenmodell, Zweck von
 * Wiederholungen, Kontrollen ohne Folge, Freigabe mit folgender Entscheidung,
 * Knock-out-Reihenfolge, Durchlaufzeit je Ergebnis.
 */
import { describe, expect, it } from 'vitest'
import { neueAufgabe, neueEntscheidung, neueParallel, neuerProzess, neueRolle, neuerZweig, neueWiederholung } from '../modell/bausteine'
import { beispielOnlinebestellung } from '../modell/beispiel'
import { findeBlock } from '../modell/operationen'
import { pruefeProzess } from '../modell/pruefung'
import type { Aufgabe, Block, Prozess, Rolle } from '../modell/typen'
import { findeSchwachstellen } from './hinweise'
import { berechneKennzahlen } from './kennzahlen'
import { bewerteVorschlaege, findeVorschlaege } from './regeln'
import { simuliere } from './simulation'
import { engpassSchwelle, erlangC, WARTEFAKTOR_SCHWELLE, wartefaktor } from './warteschlange'

const R = neueRolle('Team', { stundensatz: 60, personen: 1, verfuegbarProzent: 100 })

function aufgabe(name: string, bearbeitungMin: number, liegezeitMin = 0, werte: Partial<Aufgabe> = {}, rolle: Rolle = R): Aufgabe {
  return neueAufgabe({ name, bearbeitungMin, liegezeitMin, rolleId: rolle.id, ...werte })
}

function prozess(schritte: Block[], werte: Partial<Prozess> = {}): Prozess {
  return neuerProzess({ name: 'Test', vorgaengeProTag: 10, rollen: [R], ergebnis: 'Fertig', ablauf: { id: 'haupt', schritte }, ...werte })
}

function befunde(p: Prozess): string[] {
  return findeSchwachstellen(p, berechneKennzahlen(p)).map((b) => b.schluessel.split(':')[0])
}

describe('Warteschlangenmodell M/M/c', () => {
  it('stimmt mit den bekannten Formeln überein', () => {
    // M/M/1: Wartewahrscheinlichkeit = Auslastung, Wartezeit = ρ / (1 − ρ) Bearbeitungszeiten
    expect(erlangC(1, 0.8)).toBeCloseTo(0.8, 12)
    expect(wartefaktor(1, 0.8)).toBeCloseTo(4, 12)
    // M/M/2: C = 2ρ² / (1 + ρ), Wartezeit = ρ² / (1 − ρ²)
    expect(erlangC(2, 0.5)).toBeCloseTo(1 / 3, 12)
    expect(wartefaktor(2, 0.5)).toBeCloseTo(1 / 3, 12)
    expect(wartefaktor(3, 1)).toBe(Infinity)
  })

  it('setzt die Engpass-Schwelle nach Teamgröße: eine Person 80 %, zwei etwa 89 %', () => {
    expect(WARTEFAKTOR_SCHWELLE).toBe(4)
    expect(engpassSchwelle(1, 4)).toBeCloseTo(0.8, 6)
    expect(engpassSchwelle(2, 4)).toBeCloseTo(Math.sqrt(0.8), 6)
    expect(engpassSchwelle(6, 4)).toBeGreaterThan(0.94)
  })

  it('meldet bei gleicher Auslastung einen Engpass für eine Person, nicht für ein Team', () => {
    // 10 Vorgänge à 41 Min. = 410 Min. von 480: 85 % Auslastung
    const allein = prozess([aufgabe('Antrag prüfen', 41)])
    expect(berechneKennzahlen(allein).rollen[0].auslastung).toBeCloseTo(410 / 480, 10)
    expect(befunde(allein)).toContain('engpass')
    const team = { ...allein, vorgaengeProTag: 60, rollen: [{ ...R, personen: 6 }] }
    expect(berechneKennzahlen(team).rollen[0].auslastung).toBeCloseTo(410 / 480, 10)
    expect(befunde(team)).not.toContain('engpass')
  })

  it('blendet das Gesetz von Little bei Überlast aus', () => {
    const p = prozess([aufgabe('Antrag prüfen', 60)])
    expect(berechneKennzahlen(p).stabil).toBe(false)
    expect(berechneKennzahlen({ ...p, vorgaengeProTag: 4 }).stabil).toBe(true)
  })
})

describe('Wiederholungen nach Zweck', () => {
  it('meldet Nacharbeit mit dem tatsächlichen Wiederholungsanteil', () => {
    // 40 % Wiederholung, aber 50 % der Durchläufe enden vorher: wiederholt wird in 20 % der Durchläufe
    const ende = neueEntscheidung({ frage: 'Abbrechen?', zweige: [neuerZweig('Ja', 0.5, { ende: 'Abgebrochen' }), neuerZweig('Nein', 0.5)] })
    const w = neueWiederholung({ frage: 'Fehler gefunden?', anteilWiederholung: 0.4, koerper: { id: 'k', schritte: [aufgabe('Teil fertigen', 5), ende] } })
    const p = prozess([w])
    const k = berechneKennzahlen(p)
    expect(k.wiederholAnteil.get(w.id)).toBeCloseTo(0.2, 10)
    const text = findeSchwachstellen(p, k).find((b) => b.schluessel === `nacharbeit:${w.id}`)?.text
    expect(text).toContain('20 %')
    expect(text).toContain('1,25-mal')
  })

  it('wertet eine Mengenschleife nicht als Nacharbeit', () => {
    const w = neueWiederholung({ frage: 'Weitere Position?', zweck: 'menge', anteilWiederholung: 0.6, koerper: { id: 'k', schritte: [aufgabe('Position erfassen', 2)] } })
    const p = prozess([w])
    expect(befunde(p)).not.toContain('nacharbeit')
    expect(findeVorschlaege(p).map((v) => v.regel)).not.toContain('nacharbeit')
    expect(findeVorschlaege({ ...p, ablauf: { id: 'haupt', schritte: [{ ...w, zweck: 'nacharbeit' }] } }).map((v) => v.regel)).toContain('nacharbeit')
  })
})

describe('Kontrollen und ihre Folge', () => {
  const nein = () => neueEntscheidung({ frage: 'In Ordnung?', zweige: [neuerZweig('Ja', 0.9), neuerZweig('Nein', 0.1, { ende: 'Abgelehnt' })] })

  it('meldet eine Prüfung, nach der nichts entschieden wird', () => {
    expect(befunde(prozess([aufgabe('Antrag prüfen', 5, 0, { art: 'pruefung' }), aufgabe('Antrag ablegen', 1)]))).toContain('ohnefolge')
    expect(befunde(prozess([aufgabe('Antrag prüfen', 5, 0, { art: 'pruefung' }), nein()]))).not.toContain('ohnefolge')
    // am Ende einer Wiederholung entscheidet deren Frage
    const w = neueWiederholung({ frage: 'Fehler gefunden?', anteilWiederholung: 0.05, koerper: { id: 'k', schritte: [aufgabe('Teil fertigen', 5), aufgabe('Teil prüfen', 1, 0, { art: 'pruefung' })] } })
    expect(befunde(prozess([w]))).not.toContain('ohnefolge')
    // am Ende eines Zweigs zählt, was nach der Entscheidung kommt
    const e = neueEntscheidung({ frage: 'Großauftrag?', zweige: [neuerZweig('Ja', 0.3, { schritte: [aufgabe('Bonität prüfen', 5, 0, { art: 'pruefung' })] }), neuerZweig('Nein', 0.7)] })
    expect(befunde(prozess([e, nein()]))).not.toContain('ohnefolge')
    expect(befunde(prozess([e, aufgabe('Auftrag anlegen', 1)]))).toContain('ohnefolge')
  })

  it('nimmt die Freigabequote aus der folgenden Entscheidung und streicht beide zusammen', () => {
    const f = aufgabe('Angebot freigeben', 5, 240, { art: 'freigabe', freigabeQuote: 0.5 })
    const danach = aufgabe('Angebot versenden', 2)
    const e = neueEntscheidung({ frage: 'Freigegeben?', zweige: [neuerZweig('Ja', 0.95, { schritte: [danach] }), neuerZweig('Nein', 0.05, { ende: 'Abgelehnt' })] })
    const p = prozess([aufgabe('Angebot erstellen', 30), f, e])
    expect(befunde(p)).toContain('freigabe') // 95 % aus der Entscheidung, nicht 50 % aus der Angabe
    const v = bewerteVorschlaege(p).find((x) => x.regel === 'freigabe')!
    expect(v.blockIds).toEqual([f.id, e.id])
    const q = v.anwenden(p)
    expect(findeBlock(q, e.id)).toBeNull()
    expect(findeBlock(q, danach.id)?.sequenz.id).toBe('haupt')
    // vorher: 30 + 245 + 0,95 · 2; nachher: 30 + 2
    expect(v.wirkung.durchlaufzeitMin).toBeCloseTo(32 - (30 + 245 + 0.95 * 2), 10)
    expect(pruefeProzess(q).filter((b) => b.schwere === 'fehler')).toEqual([])
  })
})

describe('Knock-out-Reihenfolge', () => {
  // Prüfung A dauert lange und sortiert selten aus, Prüfung B geht schnell und sortiert oft aus.
  const stufe = (name: string, dauer: number, aus: number) => [
    aufgabe(name, dauer, 0, { art: 'pruefung' }),
    neueEntscheidung({ frage: `${name}: bestanden?`, zweige: [neuerZweig('Ja', 1 - aus), neuerZweig('Nein', aus, { ende: 'Abgelehnt', schritte: [aufgabe('Absage senden', 1)] })] }),
  ]

  it('stellt die Prüfung nach vorn, die je Minute am meisten aussortiert', () => {
    const [a, ea] = stufe('Unterlagen prüfen', 60, 0.05)
    const [b, eb] = stufe('Bonität prüfen', 10, 0.3)
    const p = prozess([a, ea, b, eb, aufgabe('Vertrag anlegen', 5)])
    const v = bewerteVorschlaege(p).find((x) => x.regel === 'knockout')!
    expect(v.titel).toContain('Bonität prüfen')
    const q = v.anwenden(p)
    expect(q.ablauf.schritte.map((x) => x.id)).toEqual([b.id, eb.id, a.id, ea.id, p.ablauf.schritte[4].id])
    // vorher 60 + 0,05 · 1 + 0,95 · (10 + 0,3 · 1); nachher 10 + 0,3 · 1 + 0,7 · (60 + 0,05 · 1); der Rest ist gleich
    const vorher = 60 + 0.05 + 0.95 * 10.3
    const nachher = 10.3 + 0.7 * 60.05
    expect(v.wirkung.durchlaufzeitMin).toBeCloseTo(nachher - vorher, 10)
    expect(pruefeProzess(q).filter((x) => x.schwere === 'fehler')).toEqual([])
  })

  it('schlägt nichts vor, wenn die Reihenfolge schon stimmt oder eine Prüfung die vorige braucht', () => {
    const [a, ea] = stufe('Bonität prüfen', 10, 0.3)
    const [b, eb] = stufe('Unterlagen prüfen', 60, 0.05)
    expect(findeVorschlaege(prozess([a, ea, b, eb])).map((x) => x.regel)).not.toContain('knockout')
    const [c, ec] = stufe('Unterlagen prüfen', 60, 0.05)
    const [d, ed] = stufe('Bonität prüfen', 10, 0.3)
    const abhaengig = { ...(d as Aufgabe), brauchtVorgaenger: true }
    expect(findeVorschlaege(prozess([c, ec, abhaengig, ed])).map((x) => x.regel)).not.toContain('knockout')
  })
})

describe('Weitere Hinweise', () => {
  it('meldet dieselbe Person in zwei Zweigen von „Gleichzeitig“', () => {
    const par = neueParallel()
    par.zweige[0].schritte.push(aufgabe('Angebot schreiben', 30))
    par.zweige[1].schritte.push(aufgabe('Muster packen', 20))
    expect(befunde(prozess([par]))).toContain('parallelrolle')
    expect(befunde(prozess([par], { rollen: [{ ...R, personen: 2 }] }))).not.toContain('parallelrolle')
  })

  it('meldet Ausgänge, die sich im Ablauf nicht unterscheiden', () => {
    const e = neueEntscheidung({ frage: 'Eilig?', zweige: [neuerZweig('Ja', 0.2), neuerZweig('Nein', 0.8)] })
    expect(pruefeProzess(prozess([aufgabe('Antrag erfassen', 5), e])).map((b) => b.schluessel.split(':')[0])).toContain('gleiche-ausgaenge')
  })
})

describe('Durchlaufzeit je Ergebnis', () => {
  it('trennt in der Onlinebestellung versendete, stornierte und verfallene Bestellungen', () => {
    const p = beispielOnlinebestellung()
    const k = berechneKennzahlen(p)
    const s = simuliere(p, 40_000, 3)
    expect(s.ergebnisse[0]).toMatchObject({ ergebnis: 'Ware versendet', regulaer: true })
    for (const e of k.enden) {
      const x = s.ergebnisse.find((y) => y.ergebnis === e.ergebnis && y.regulaer === e.regulaer)!
      expect(Math.abs(x.anteil - e.anteil)).toBeLessThan(0.01)
    }
    // Der Gesamtschnitt ist das gewichtete Mittel der Ergebnisse.
    const gemischt = s.ergebnisse.reduce((t, e) => t + e.anteil * e.mittelMin, 0)
    expect(gemischt).toBeCloseTo(s.mittelMin, 6)
    // Verfallene Bestellungen warten 7 Tage auf eine Antwort und dauern am längsten.
    const verfallen = s.ergebnisse.find((e) => e.ergebnis === 'Bestellung verfallen')!
    expect(verfallen.mittelMin).toBeGreaterThan(s.ergebnisse[0].mittelMin)
  })
})
