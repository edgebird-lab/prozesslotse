import { describe, expect, it } from 'vitest'
import { beispielLieferdienst } from '../modell/beispiel'
import type { Prozess } from '../modell/typen'
import { complianceLieferdienst } from './beispiel'
import { kapitel } from './dokument'
import { pruefeCompliance } from './regeln'
import { neueWeitereKontrolle } from './standard'
import type { Abschnitt, ComplianceProjekt, Dokument, EinweisungTurnus } from './typen'
import { entwurfsKontext, erzeugeDokumente } from './versionen'

// Durchsicht 11.11.2026: Einweisung „Keine“ (logik-8, bedienung-18) und feste Sätze in 3.3 (recht-11)

const HEUTE = '2026-11-11'

function vd(c: ComplianceProjekt, p: Prozess = beispielLieferdienst()): Dokument {
  return erzeugeDokumente(p, c, entwurfsKontext(c, HEUTE)).verfahrensdoku
}

function texte(d: Dokument, schluessel: string): string[] {
  return (kapitel(d).get(schluessel) ?? []).flatMap((a: Abschnitt) => (a.art === 'absatz' ? [a.text] : a.art === 'ueberschrift' ? [`${a.nummer} ${a.text}`] : []))
}

function mitEinweisung(turnus: EinweisungTurnus | null, protokoll: boolean): ComplianceProjekt {
  const c = complianceLieferdienst()
  c.einweisung = { turnus, protokoll }
  return c
}

/** Ein-Personen-Betrieb wie bei K5: alle internen Rollen mit Aufgaben zusammen höchstens eine Person */
function einePerson(): Prozess {
  const p = beispielLieferdienst()
  p.rollen = p.rollen.map((r) => ({ ...r, personen: 0.1 }))
  return p
}

const iks = (d: Dokument) => texte(d, '3.3').find((t) => t.includes('Kapitel 4')) ?? ''

describe('Kapitel 2.5 und 9.2 bei Einweisung „Keine“ (logik-8)', () => {
  it('„Keine“ mit eingeschaltetem Protokoll: kein Widerspruch, keine Anlage 9.2', () => {
    const d = vd(mitEinweisung('keine', true))
    expect(texte(d, '2.5')).toEqual(['2.5 Einweisung in das Verfahren', 'Eine Einweisung ist nicht vorgesehen.'])
    expect(kapitel(d).has('9.2')).toBe(false)
  })

  it('offen mit Protokoll: nur „nicht festgelegt“, keine Anlage 9.2', () => {
    const d = vd(mitEinweisung(null, true))
    expect(texte(d, '2.5')).toEqual(['2.5 Einweisung in das Verfahren', 'Eine Einweisung ist nicht festgelegt.'])
    expect(kapitel(d).has('9.2')).toBe(false)
  })

  it('festgelegte Einweisung mit Protokoll bleibt, wie sie war', () => {
    const d = vd(mitEinweisung('einmalig', true))
    expect(texte(d, '2.5')).toEqual(['2.5 Einweisung in das Verfahren', 'Wer mitarbeitet, wird vor Beginn eingewiesen.', 'Die Einweisung wird schriftlich festgehalten (Kapitel 9.2).'])
    expect(kapitel(d).has('9.2')).toBe(true)
  })
})

describe('Befund K6 bei Einweisung „Keine“ (bedienung-18)', () => {
  const k6 = (c: ComplianceProjekt, p: Prozess = beispielLieferdienst()) => pruefeCompliance(p, c, HEUTE).find((b) => b.regel === 'K6')

  it('nennt „Keine“ als Antwort und rät zur Einweisung vor Beginn', () => {
    const b = k6(mitEinweisung('keine', false))
    expect(b).toMatchObject({ schwere: 'hinweis', titel: 'Keine Einweisung vorgesehen', text: 'Wer im Prozess mitarbeitet, sollte das Verfahren kennen. Wähle „Einmalig vor Beginn“, sobald jemand mitarbeitet.' })
  })

  it('entfällt im Ein-Personen-Betrieb', () => {
    expect(k6(mitEinweisung('keine', false), einePerson())).toBeUndefined()
    // K5 meldet den Ein-Personen-Betrieb weiterhin
    expect(pruefeCompliance(einePerson(), mitEinweisung('keine', false), HEUTE).some((b) => b.regel === 'K5')).toBe(true)
  })

  it('fragt bei offener Antwort weiter, auch im Ein-Personen-Betrieb', () => {
    expect(k6(mitEinweisung(null, false))).toMatchObject({ titel: 'Einweisung nicht festgelegt', text: 'Wie werden Beteiligte in das Verfahren eingewiesen?' })
    expect(k6(mitEinweisung(null, false), einePerson())).toBeDefined()
  })
})

describe('Feste Sätze in 3.3 sichern nur zu, was die Angaben tragen (recht-11, bedienung-18)', () => {
  it('ohne festgelegte Einweisung nicht „Nur eingewiesene Personen …“', () => {
    for (const turnus of ['keine', null] as const) {
      const satz = iks(vd(mitEinweisung(turnus, false)))
      expect(satz, String(turnus)).not.toContain('eingewiesen')
      expect(satz, String(turnus)).toMatch(/^In den Schritten aus Kapitel 4 wird stets so gearbeitet, wie dort beschrieben\./)
    }
    expect(iks(vd(mitEinweisung('jaehrlich', false)))).toMatch(/^Nur eingewiesene Personen arbeiten in den Schritten aus Kapitel 4/)
  })

  it('Kontrolle ohne Nachweis: kein „Für jede Kontrolle ist festgelegt …“', () => {
    // Beispiel: 4.7 hat „Kein Nachweis“
    const satz = iks(vd(complianceLieferdienst()))
    expect(satz).not.toContain('Für jede Kontrolle ist festgelegt')
    expect(satz).toContain('Kontrollen sind so auszuüben und zu belegen, wie in der Tabelle angegeben (GoBD Rz. 100). Nachweis offen bei: 4.7 Kommissionierung kontrollieren.')
  })

  it('weitere Kontrolle ohne Verantwortlichen und ohne Nachweis', () => {
    const c = complianceLieferdienst()
    c.kontrollen.auf_kontrollieren.nachweis = 'abzeichnen'
    c.weitereKontrollen.push(neueWeitereKontrolle({ name: 'Stichprobe Kasse', nachweis: 'unklar' }))
    expect(iks(vd(c))).toContain('Nachweis offen bei: Stichprobe Kasse. Zuständigkeit offen bei: Stichprobe Kasse.')
  })

  it('sind alle Kontrollen belegt und zugeordnet, bleibt der Satz', () => {
    const c = complianceLieferdienst()
    c.kontrollen.auf_kontrollieren.nachweis = 'abzeichnen'
    expect(iks(vd(c))).toBe(
      'Nur eingewiesene Personen arbeiten in den Schritten aus Kapitel 4, und zwar stets so, wie dort beschrieben. Für jede Kontrolle ist festgelegt, wer sie ausübt und wie sie belegt wird (GoBD Rz. 100). Weicht die Praxis von dieser Beschreibung ab, erfährt es die Geschäftsleitung; Anlass und Maßnahme werden schriftlich festgehalten.',
    )
  })
})
