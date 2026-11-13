import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { dateinameBeratungsakte, leseBeratungsakte, pruefeBeratungsakte, serialisiereBeratungsakte, type Beratungsakte } from '../beratungsakte/beratungsakte'
import { SCHEMA } from '../beratungsakte/schema'
import { beispielMitCompliance } from '../compliance/beispiel'
import { neuerProzess, neuesProjekt } from '../modell/bausteine'
import { beispielLieferdienst, beispielProjekt } from '../modell/beispiel'
import type { Projekt } from '../modell/typen'
import { APP_KENNUNG, beratungsakteAusProjekt, mandantAusProjekt, SCHWERE_IN_AKTE } from './beratungsakte'
import { bewerteVorschlaege } from './regeln'

const JETZT = new Date(2026, 10, 13, 12, 0, 0)
const TAG = 8 * 60

function akteDesBeispiels(): Beratungsakte {
  const projekt = beispielMitCompliance()
  return beratungsakteAusProjekt({ projekt, mandant: { name: mandantAusProjekt(projekt) }, jetzt: JETZT })
}

function gueltigOhneHinweise(akte: Beratungsakte) {
  const ergebnis = pruefeBeratungsakte(JSON.parse(serialisiereBeratungsakte(akte)))
  expect(ergebnis.fehler).toEqual([])
  expect(ergebnis.hinweise).toEqual([])
  expect(ergebnis.gueltig).toBe(true)
}

const kennzahl = (akte: Beratungsakte, kennung: string) => akte.kennzahlen.find((k) => k.kennung === kennung)!
const ns = (x: { erweiterungen?: Record<string, Record<string, unknown>> }) => x.erweiterungen?.[APP_KENNUNG]

/** Übernimmt Vorschläge wie der Knopf „Übernehmen“ im Schritt „Verbessern“. */
function uebernimm(projekt: Projekt, anzahl: number): Projekt {
  let p = projekt
  for (let i = 0; i < anzahl; i++) {
    const basis = p.soll ?? p.ist
    const v = bewerteVorschlaege(basis, p.verworfen)[0]
    p = { ...p, soll: v.anwenden(basis), massnahmen: [...p.massnahmen, { schluessel: v.schluessel, titel: v.titel, begruendung: v.annahme ? `${v.begruendung} ${v.annahme}` : v.begruendung }] }
  }
  return p
}

describe('Beratungsakte aus dem Fallbeispiel', () => {
  it('ist gültig, ohne Hinweise, mit App, Version und Art', () => {
    const akte = akteDesBeispiels()
    gueltigOhneHinweise(akte)
    const paket = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as { version: string }
    expect(akte.erzeugtVon).toEqual({ app: 'prozesslotse', name: 'Prozesslotse', version: paket.version })
    expect(akte.erzeugtAm).toMatch(/^2026-11-13T12:00:00[+-]\d\d:\d\d$/)
    expect(akte.mandant).toEqual({ name: 'Lieferdienst Muster GmbH' })
    expect(akte.analyse).toEqual({ art: 'prozessanalyse', titel: 'Bestellung bis Rechnung (Lieferdienst)', stand: '2026-11-13' })
    expect(ns(akte)).toEqual({ vorgaengeProTag: 120, arbeitsstundenProTag: 8, sollProzess: false })
  })

  it('enthält die Kennzahlen des Berichts mit den Werten aus der README', () => {
    const akte = akteDesBeispiels()
    expect(akte.kennzahlen.map((k) => [k.kennung, k.einheit])).toEqual([
      ['durchlaufzeit', 'min'],
      ['durchlaufzeit-p90', 'min'],
      ['flusseffizienz', '%'],
      ['arbeitszeit', 'min'],
      ['kosten-je-vorgang', '€'],
      ['kosten-pro-tag', '€'],
      ['vorgaenge-in-arbeit', 'Anzahl'],
      ['medienbrueche', 'Anzahl'],
      ['uebergaben', 'Anzahl'],
      ['hoechste-auslastung', '%'],
    ])
    // README: 6,7 Arbeitstage Durchlaufzeit, davon nur 1,5 % Bearbeitung, Engpass Niederlassungsleitung 98 %, drei Medienbrüche
    expect((kennzahl(akte, 'durchlaufzeit').wert as number) / TAG).toBeCloseTo(6.74, 2)
    expect(kennzahl(akte, 'flusseffizienz').wert).toBeCloseTo(1.46, 1)
    expect(Math.round(kennzahl(akte, 'hoechste-auslastung').wert as number)).toBe(98)
    expect(Math.round(kennzahl(akte, 'medienbrueche').wert as number)).toBe(3)
    expect(kennzahl(akte, 'durchlaufzeit-p90').wert).toBeGreaterThan(kennzahl(akte, 'durchlaufzeit').wert as number)
    // ohne Soll-Prozess kein Namensraum an den Kennzahlen
    expect(akte.kennzahlen.every((k) => k.erweiterungen === undefined)).toBe(true)
  })

  it('enthält die Befunde des Berichts mit Fundstelle und Originalstufe', () => {
    const akte = akteDesBeispiels()
    expect(akte.befunde.map((b) => b.kennung)).toEqual([
      'engpass:rol_buchhaltung',
      'engpass:rol_leitung',
      'medienbruch:auf_erfassen',
      'medienbruch:auf_tour',
      'medienbruch:auf_bestaetigen',
      'liegezeit:auf_freigeben',
      'nacharbeit:wdh_kommission',
      'freigabe:auf_freigeben',
      'pingpong:auf_tour:rol_lager',
      'pingpong:auf_freigeben:rol_buchhaltung',
      'flusseffizienz',
    ])
    const leitung = akte.befunde.find((b) => b.kennung === 'engpass:rol_leitung')!
    expect(leitung.schwere).toBe('mittel')
    expect(leitung.fundstelle).toBe('Rolle „Niederlassungsleitung“')
    expect(leitung.text).toMatch(/^Engpass: Niederlassungsleitung\. Auslastung 98 % bei einer Person\./)
    expect(ns(leitung)).toEqual({ schwere: 'warnung' })
    const buchhaltung = akte.befunde.find((b) => b.kennung === 'engpass:rol_buchhaltung')!
    expect(buchhaltung.text).toContain('Auslastung 81 %')
    expect(akte.befunde.find((b) => b.kennung === 'medienbruch:auf_tour')!.fundstelle).toBe('Schritt „Tour planen“')
    expect(akte.befunde.find((b) => b.kennung === 'flusseffizienz')).toMatchObject({ schwere: 'hinweis', fundstelle: 'Gesamter Prozess' })
  })

  it('enthält die sieben Vorschläge mit berechneter Wirkung und Bezug auf die Befunde', () => {
    const akte = akteDesBeispiels()
    expect(akte.massnahmen.map((m) => m.kennung).sort()).toEqual(
      [
        'freigabe:auf_freigeben',
        'medienbruch:auf_bestaetigen',
        'medienbruch:auf_erfassen',
        'medienbruch:auf_tour',
        'nacharbeit:wdh_kommission',
        'parallelisieren:wdh_kommission:auf_tour',
        'zusammenlegen:auf_annehmen:auf_erfassen',
      ].sort(),
    )
    // sortiert wie im Schritt „Verbessern“: größte Wirkung auf die Durchlaufzeit zuerst
    const freigabe = akte.massnahmen[0]
    expect(freigabe.kennung).toBe('freigabe:auf_freigeben')
    expect(freigabe.text).toMatch(/^Freigabe „Rechnung freigeben“ streichen\. Sie wird in 98 % der Fälle erteilt/)
    expect(freigabe.text).toContain('Angenommen wird')
    expect(freigabe).toMatchObject({ prioritaet: 'mittel', aufwand: 'nicht geschätzt' })
    expect(freigabe.befunde).toEqual(['liegezeit:auf_freigeben', 'freigabe:auf_freigeben', 'pingpong:auf_freigeben:rol_buchhaltung'])
    const w = ns(freigabe) as { status: string; regel: string; wirkung: { durchlaufzeitMin: number; kostenProVorgang: number } }
    expect(w.status).toBe('vorschlag')
    expect(w.regel).toBe('freigabe')
    // regeln.test.ts: −(960 + 1) × 0,976 Minuten und −(1/60) × 65 × 0,976 € je Vorgang
    expect(w.wirkung.durchlaufzeitMin).toBeCloseTo(-(960 + 1) * 0.976, 2)
    expect(w.wirkung.kostenProVorgang).toBeCloseTo(-(1 / 60) * 65 * 0.976, 2)

    const bezug = Object.fromEntries(akte.massnahmen.map((m) => [m.kennung, m.befunde]))
    expect(bezug['medienbruch:auf_tour']).toEqual(['medienbruch:auf_tour'])
    expect(bezug['nacharbeit:wdh_kommission']).toEqual(['nacharbeit:wdh_kommission'])
    expect(bezug['parallelisieren:wdh_kommission:auf_tour']).toEqual([])
    const kennungen = new Set(akte.befunde.map((b) => b.kennung))
    for (const m of akte.massnahmen) for (const b of m.befunde) expect(kennungen.has(b), `${m.kennung} → ${b}`).toBe(true)
  })

  it('übernommene Maßnahmen haben hohe Priorität, der Soll-Wert steht im Namensraum (README: 4,5 Arbeitstage)', () => {
    const projekt = uebernimm(beispielProjekt(), 2)
    const akte = beratungsakteAusProjekt({ projekt, mandant: { name: 'Lieferdienst Muster GmbH' }, jetzt: JETZT })
    gueltigOhneHinweise(akte)
    expect(akte.massnahmen.slice(0, 2).map((m) => [m.kennung, m.prioritaet, (ns(m) as { status: string }).status])).toEqual([
      ['freigabe:auf_freigeben', 'hoch', 'uebernommen'],
      ['parallelisieren:wdh_kommission:auf_tour', 'hoch', 'uebernommen'],
    ])
    expect(akte.massnahmen[0].befunde).toEqual(['liegezeit:auf_freigeben', 'freigabe:auf_freigeben', 'pingpong:auf_freigeben:rol_buchhaltung'])
    expect(akte.massnahmen.slice(2).every((m) => m.prioritaet === 'mittel' && (ns(m) as { status: string }).status === 'vorschlag')).toBe(true)
    expect(akte.massnahmen.some((m, i) => i >= 2 && m.kennung === 'freigabe:auf_freigeben')).toBe(false)
    const soll = (ns(kennzahl(akte, 'durchlaufzeit')) as { soll: number }).soll
    expect(soll / TAG).toBeCloseTo(4.45, 2)
    expect((kennzahl(akte, 'durchlaufzeit').wert as number) / TAG).toBeCloseTo(6.74, 2)
    expect(ns(akte)).toMatchObject({ sollProzess: true })
  })

  it('behält verworfene Vorschläge am Ende, mit Status „verworfen“ und niedriger Priorität', () => {
    const projekt = { ...beispielProjekt(), verworfen: ['freigabe:auf_freigeben'] }
    const akte = beratungsakteAusProjekt({ projekt, mandant: { name: 'M' }, jetzt: JETZT })
    gueltigOhneHinweise(akte)
    expect(akte.massnahmen).toHaveLength(7)
    const letzte = akte.massnahmen[6]
    expect(letzte.kennung).toBe('freigabe:auf_freigeben')
    expect(letzte.prioritaet).toBe('niedrig')
    expect(letzte.text).toMatch(/\(Vorschlag verworfen\)$/)
    expect((ns(letzte) as { status: string }).status).toBe('verworfen')
    expect(akte.massnahmen.slice(0, 6).every((m) => (ns(m) as { status: string }).status === 'vorschlag')).toBe(true)
  })
})

describe('Abbildung der Stufen', () => {
  it('bildet jede Schwere der App ab', () => {
    expect(SCHWERE_IN_AKTE).toEqual({ fehler: 'hoch', warnung: 'mittel', hinweis: 'hinweis' })
  })

  it('überlastete Rolle (Fehler) wird „hoch“, wachsender Bestand ein Text statt einer Zahl', () => {
    const projekt = neuesProjekt({ ...beispielLieferdienst(), vorgaengeProTag: 1000 })
    const akte = beratungsakteAusProjekt({ projekt, mandant: { name: 'M' }, jetzt: JETZT })
    gueltigOhneHinweise(akte)
    const ueberlastet = akte.befunde.filter((b) => b.kennung.startsWith('ueberlastet:'))
    expect(ueberlastet.length).toBeGreaterThan(0)
    for (const b of ueberlastet) {
      expect(b.schwere).toBe('hoch')
      expect(ns(b)).toEqual({ schwere: 'fehler' })
    }
    expect(kennzahl(akte, 'vorgaenge-in-arbeit').wert).toBe('wächst (Überlast)')
    expect(new Set(akte.befunde.map((b) => b.schwere))).toEqual(new Set(['hoch', 'mittel', 'hinweis']))
  })
})

describe('Mandant, Dateiname und Grenzfälle', () => {
  it('belegt den Mandanten mit dem Unternehmen aus der Compliance-Doku vor', () => {
    expect(mandantAusProjekt(beispielMitCompliance())).toBe('Lieferdienst Muster GmbH')
    expect(mandantAusProjekt(beispielProjekt())).toBe('')
  })

  it('Dateiname mit Umlauten, Mandantennummer und Quelldatei', () => {
    const akte = beratungsakteAusProjekt({ projekt: beispielProjekt(), mandant: { name: ' Bäckerei Groß & Söhne GbR ', kennung: ' K-0815 ' }, jetzt: JETZT, quelldatei: 'lieferdienst.prozesslotse' })
    gueltigOhneHinweise(akte)
    expect(akte.mandant).toEqual({ name: 'Bäckerei Groß & Söhne GbR', kennung: 'K-0815' })
    expect(akte.analyse.quelldatei).toBe('lieferdienst.prozesslotse')
    expect(dateinameBeratungsakte(akte)).toBe('Bäckerei-Groß-&-Söhne-GbR-prozesslotse-2026-11-13.beratungsakte.json')
  })

  it('leere Mandantennummer und fehlende Quelldatei fehlen in der Akte', () => {
    const akte = beratungsakteAusProjekt({ projekt: beispielProjekt(), mandant: { name: 'M', kennung: '  ' }, jetzt: JETZT, quelldatei: null })
    expect(akte.mandant).toEqual({ name: 'M' })
    expect('quelldatei' in akte.analyse).toBe(false)
  })

  it('ein leeres Projekt ergibt eine gültige Akte', () => {
    const akte = beratungsakteAusProjekt({ projekt: neuesProjekt(neuerProzess()), mandant: { name: 'M' }, jetzt: JETZT })
    gueltigOhneHinweise(akte)
    expect(akte.analyse.titel).toBe('Unbenannter Prozess')
    expect(akte.kennzahlen).toHaveLength(10)
    expect(akte.massnahmen).toEqual([])
  })

  it('lehnt einen leeren Mandanten ab', () => {
    expect(() => beratungsakteAusProjekt({ projekt: beispielProjekt(), mandant: { name: '' }, jetzt: JETZT })).toThrow('Bitte den Mandanten angeben.')
    expect(() => beratungsakteAusProjekt({ projekt: beispielProjekt(), mandant: { name: '   ' }, jetzt: JETZT })).toThrow('Bitte den Mandanten angeben.')
  })

  it('macht aus beliebigen Schlüsseln gültige, eindeutige Kennungen', () => {
    const lang = 'knockout:' + Array.from({ length: 12 }, (_, i) => `auf_baustein${i}`).join(':')
    const projekt: Projekt = {
      ...beispielProjekt(),
      massnahmen: [
        { schluessel: 'eigene Maßnahme', titel: 'A', begruendung: 'a' },
        { schluessel: 'eigene Maßnahme', titel: 'B', begruendung: 'b' },
        { schluessel: lang, titel: 'C', begruendung: 'c' },
      ],
    }
    const akte = beratungsakteAusProjekt({ projekt, mandant: { name: 'M' }, jetzt: JETZT })
    gueltigOhneHinweise(akte)
    expect(akte.massnahmen.slice(0, 2).map((m) => m.kennung)).toEqual(['eigene_Ma_nahme', 'eigene_Ma_nahme-2'])
    expect(akte.massnahmen[2].kennung.length).toBeLessThanOrEqual(64)
    expect(akte.massnahmen[0].text).toBe('A. a')
  })
})

describe('Kopie der Bibliothek (src/beratungsakte)', () => {
  const ordner = join(__dirname, '../../testdaten/beratungsakte')
  const dateien = (art: string) => readdirSync(join(ordner, art)).filter((d) => d.endsWith('.json'))

  it('liest alle gültigen Beispiele', () => {
    expect(dateien('gueltig').length).toBeGreaterThan(0)
    for (const d of dateien('gueltig')) {
      const r = leseBeratungsakte(readFileSync(join(ordner, 'gueltig', d), 'utf8'))
      expect(r.ok, d).toBe(true)
    }
  })

  it('lehnt alle ungültigen Beispiele ab', () => {
    expect(dateien('ungueltig').length).toBeGreaterThan(0)
    for (const d of dateien('ungueltig')) {
      const r = leseBeratungsakte(readFileSync(join(ordner, 'ungueltig', d), 'utf8'))
      expect(r.ok, d).toBe(false)
    }
  })

  it('meldet eine neuere Hauptversion', () => {
    const r = leseBeratungsakte(readFileSync(join(ordner, 'ungueltig', 'neuere-hauptversion.json'), 'utf8'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fehler.map((f) => f.code)).toContain('neuere-hauptversion')
  })

  it('schema.ts entspricht der Schema-Datei', () => {
    expect(SCHEMA).toEqual(JSON.parse(readFileSync(join(__dirname, '../beratungsakte/beratungsakte-v1.schema.json'), 'utf8')))
  })
})

// Mit BERATUNGSAKTE_AUSGABE=<Ordner> schreibt der Test die Akte des Fallbeispiels dorthin (Beispieldatei des Formats).
it.runIf(!!process.env.BERATUNGSAKTE_AUSGABE)('schreibt die Akte des Fallbeispiels', () => {
  const ziel = process.env.BERATUNGSAKTE_AUSGABE!
  const akte = akteDesBeispiels()
  mkdirSync(ziel, { recursive: true })
  writeFileSync(join(ziel, dateinameBeratungsakte(akte)), serialisiereBeratungsakte(akte), 'utf8')
})
