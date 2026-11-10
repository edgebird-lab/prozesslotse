import { describe, expect, it } from 'vitest'
import { berechneKennzahlen } from '../analyse/kennzahlen'
import { findeSchwachstellen } from '../analyse/hinweise'
import { simuliere } from '../analyse/simulation'
import { findeVorschlaege } from '../analyse/regeln'
import { neueAufgabe, neueEntscheidung, neueParallel, neuerProzess, neueRolle, neuerZweig } from './bausteine'
import { beispielLieferdienst, beispielOnlinebestellung, beispielProjekt } from './beispiel'
import { entferneRuecksprung, findeBlock, fuegeEin, normalisiere, ruecksprungZiele, setzeRuecksprung, verlaesstBlock } from './operationen'
import { pruefeProzess } from './pruefung'
import { alsJson, leseProjektText } from './speicher'
import type { Block, Prozess } from './typen'

const R = neueRolle('Team', { stundensatz: 60 })
const aufgabe = (name: string, min = 10) => neueAufgabe({ name, bearbeitungMin: min, rolleId: R.id })
const prozess = (schritte: Block[]): Prozess => neuerProzess({ name: 'Test', rollen: [R], ergebnis: 'Fertig', ablauf: { id: 'haupt', schritte } })

describe('Rücksprung', () => {
  // A → B → Entscheidung „ok?“ (Ja 80 % weiter / Nein 20 % → C, dann zurück zu A) → D
  function aufbau() {
    const a = aufgabe('A erledigen')
    const b = aufgabe('B erledigen')
    const c = aufgabe('C erledigen', 5)
    const ent = neueEntscheidung({ frage: 'ok?', zweige: [neuerZweig('Ja', 0.8), neuerZweig('Nein', 0.2, { schritte: [c] })] })
    const d = aufgabe('D erledigen')
    return { a, b, c, d, ent, p: prozess([a, b, ent, d]) }
  }

  it('bietet als Ziele alle Schritte davor und die Entscheidung selbst an', () => {
    const { a, b, ent, p } = aufbau()
    expect(ruecksprungZiele(p, 'haupt', 2, true).map((z) => z.id)).toEqual([a.id, b.id, ent.id])
    expect(ruecksprungZiele(p, 'haupt', 2, false).map((z) => z.id)).toEqual([a.id, b.id])
  })

  it('fasst den Abschnitt vom Ziel bis zur Entscheidung zu einem Rücksprungbereich zusammen', () => {
    const { a, b, ent, d, p } = aufbau()
    const q = setzeRuecksprung(p, ent.id, ent.zweige[1].id, a.id)
    const [bereich, danach] = q.ablauf.schritte
    expect(bereich.typ === 'wiederholung' && bereich.modus).toBe('ruecksprung')
    expect(bereich.typ === 'wiederholung' && bereich.koerper.schritte.map((x) => x.id)).toEqual([a.id, b.id, ent.id])
    expect(danach.id).toBe(d.id)
    const neu = findeBlock(q, ent.id)?.block
    expect(neu?.typ === 'entscheidung' && neu.zweige[1].zurueckZu).toBe(bereich.id)
    expect(pruefeProzess(q).filter((x) => x.schwere === 'fehler')).toEqual([])
  })

  it('rechnet Häufigkeit und Durchlaufzeit wie von Hand', () => {
    const { a, c, d, ent, p } = aufbau()
    const q = setzeRuecksprung(p, ent.id, ent.zweige[1].id, a.id)
    const k = berechneKennzahlen(q)
    // Der Bereich läuft im Schnitt 1 / (1 − 0,2) = 1,25-mal
    expect(k.schritte.get(a.id)?.haeufigkeit).toBeCloseTo(1.25, 10)
    expect(k.schritte.get(c.id)?.haeufigkeit).toBeCloseTo(0.25, 10)
    expect(k.schritte.get(d.id)?.haeufigkeit).toBeCloseTo(1, 10)
    // (10 + 10 + 0,2 · 5) · 1,25 + 10 = 36,25
    expect(k.durchlaufzeitMin).toBeCloseTo(36.25, 10)
    expect(simuliere(q, 40_000, 3).mittelMin).toBeCloseTo(36.25, 0)
  })

  it('erweitert einen bestehenden Bereich, statt einen zweiten zu verschachteln', () => {
    const { a, ent, p } = aufbau()
    let q = setzeRuecksprung(p, ent.id, ent.zweige[1].id, a.id)
    const bereichId = q.ablauf.schritte[0].id
    const e2 = neueEntscheidung({ frage: 'Noch ok?', zweige: [neuerZweig('Ja', 0.9), neuerZweig('Nein', 0.1)] })
    q = fuegeEin(q, 'haupt', 1, e2)
    q = setzeRuecksprung(q, e2.id, e2.zweige[1].id, bereichId)
    expect(q.ablauf.schritte).toHaveLength(2)
    const bereich = q.ablauf.schritte[0]
    expect(bereich.typ === 'wiederholung' && bereich.koerper.schritte.at(-1)?.id).toBe(e2.id)
  })

  it('löst den Bereich auf, wenn der letzte Rücksprung entfernt wird', () => {
    const { a, b, ent, d, p } = aufbau()
    const q = setzeRuecksprung(p, ent.id, ent.zweige[1].id, a.id)
    const r = entferneRuecksprung(q, ent.id, ent.zweige[1].id)
    expect(r.ablauf.schritte.map((x) => x.id)).toEqual([a.id, b.id, ent.id, d.id])
    expect(normalisiere(r)).toBe(r)
  })

  it('springt nie aus „Gleichzeitig“ heraus', () => {
    const vorher = aufgabe('Vorher erledigen')
    const ent = neueEntscheidung({ frage: 'ok?', zweige: [neuerZweig('Ja', 0.5), neuerZweig('Nein', 0.5)] })
    const par = neueParallel()
    par.zweige[0].schritte.push(ent)
    par.zweige[1].schritte.push(aufgabe('Anderes tun'))
    const p = prozess([vorher, par])
    expect(ruecksprungZiele(p, par.zweige[0].id, 0, true).map((z) => z.id)).toEqual([ent.id])
    expect(setzeRuecksprung(p, ent.id, ent.zweige[1].id, vorher.id)).toBe(p)
  })

  it('meldet einen Bereich, der immer zurückspringt, als Endlosschleife', () => {
    const a = aufgabe('A erledigen')
    const ent = neueEntscheidung({ frage: 'ok?', zweige: [neuerZweig('Nein', 1)] })
    let p = prozess([a, ent])
    p = setzeRuecksprung(p, ent.id, ent.zweige[0].id, a.id)
    const befunde = findeSchwachstellen(p, berechneKennzahlen(p))
    expect(befunde.map((b) => b.schluessel.split(':')[0])).toContain('endlos')
  })

  it('schließt Blöcke mit Rücksprung nach außen vom Parallelisieren aus', () => {
    const { a, ent, p } = aufbau()
    const q = setzeRuecksprung(p, ent.id, ent.zweige[1].id, a.id)
    expect(verlaesstBlock(q.ablauf.schritte[0])).toBe(false) // Ziel liegt innen
    const innen = findeBlock(q, ent.id)!.block
    expect(verlaesstBlock(innen)).toBe(true) // die Entscheidung allein verlässt ihren Platz
    const nachher = neueAufgabe({ name: 'Nachher erledigen', rolleId: neueRolle('X').id, brauchtVorgaenger: false })
    const r = fuegeEin(q, findeBlock(q, ent.id)!.sequenz.id, 3, nachher)
    expect(findeVorschlaege(r).some((v) => v.regel === 'parallelisieren' && v.blockIds.includes(ent.id))).toBe(false)
  })
})

describe('Onlinebestellung (Rücksprung und Ereignis-Entscheidung)', () => {
  const p = beispielOnlinebestellung()

  it('hat keine Modellfehler und keine überlastete Rolle', () => {
    expect(pruefeProzess(p).filter((b) => b.schwere === 'fehler')).toEqual([])
    expect(findeSchwachstellen(p, berechneKennzahlen(p)).filter((b) => b.schwere === 'fehler')).toEqual([])
  })

  it('rechnet Enden und Häufigkeiten wie von Hand', () => {
    const k = berechneKennzahlen(p)
    // je Durchlauf: Fehler 12 %, davon 70 % Korrektur → zurück; 20 % Storno, 10 % Frist → Ende
    const n = 1 / (1 - 0.12 * 0.7)
    expect(k.schritte.get('auf_erfassen')?.haeufigkeit).toBeCloseTo(n, 10)
    expect(k.wiederholAnteil.get('rsp_daten')).toBeCloseTo(0.084, 10)
    const ende = Object.fromEntries(k.enden.map((e) => [e.ergebnis, e.anteil]))
    expect(ende['Bestellung storniert']).toBeCloseTo(0.12 * 0.2 * n, 10)
    expect(ende['Bestellung verfallen']).toBeCloseTo(0.12 * 0.1 * n, 10)
    expect(ende['Ware versendet']).toBeCloseTo(0.88 * n, 10)
    expect(k.enden.reduce((s, e) => s + e.anteil, 0)).toBeCloseTo(1, 10)
  })

  it('zählt die Wartezeit auf das Ereignis zur Durchlaufzeit und stimmt mit der Simulation überein', () => {
    const k = berechneKennzahlen(p)
    expect(k.schritte.get('zw_frist')?.beitragWartenMin).toBeGreaterThan(0)
    const s = simuliere(p, 40_000, 5)
    expect(Math.abs(s.mittelMin - k.durchlaufzeitMin) / k.durchlaufzeitMin).toBeLessThan(0.02)
  })
})

describe('Dateiformat', () => {
  it('liest Projekte im alten Format 1 und stellt sie um', () => {
    const v2 = beispielProjekt()
    const v1 = JSON.parse(alsJson(v2))
    v1.formatVersion = 1
    v1.ist.formatVersion = 1
    const entferne = (x: unknown): void => {
      if (Array.isArray(x)) return x.forEach(entferne)
      if (typeof x !== 'object' || x === null) return
      const o = x as Record<string, unknown>
      if (o.typ === 'entscheidung') delete o.art
      if (o.typ === 'wiederholung') delete o.modus
      if ('anteil' in o && 'bezeichnung' in o) {
        delete o.zurueckZu
        delete o.ereignis
      }
      Object.values(o).forEach(entferne)
    }
    entferne(v1.ist.ablauf)
    expect(leseProjektText(JSON.stringify(v1))).toEqual(v2)
    expect(beispielLieferdienst().formatVersion).toBe(2)
  })
})
