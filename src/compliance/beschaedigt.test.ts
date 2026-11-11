/**
 * Laden von Dateien mit fehlerhaftem Compliance-Teil (Prüfung daten-3) und
 * Datumsangaben, mit denen die Dokumente nicht rechnen können (logik-7).
 */
import { describe, expect, it } from 'vitest'
import { beispielLieferdienst } from '../modell/beispiel'
import { alsJson, ComplianceFormatfehler, Formatfehler, leseProjekt, leseProjektText } from '../modell/speicher'
import { beispielMitCompliance, complianceLieferdienst } from './beispiel'
import { freigeben } from './versionen'

const HEUTE = '2026-11-11'

/** Projektdatei des Beispiels mit einer freigegebenen Version, als JSON-Daten zum Verändern */
async function datei(): Promise<Record<string, any>> {
  const c = complianceLieferdienst()
  const v = await freigeben(beispielLieferdienst(), c, { bezeichnung: '1.0', gueltigAb: HEUTE, freigegebenVon: 'Erika Mustermann', aenderung: 'Erstfassung' }, HEUTE)
  return JSON.parse(alsJson({ ...beispielMitCompliance(), compliance: { ...c, versionen: [v] } }))
}

function fehlerBeim(d: unknown): unknown {
  try {
    leseProjektText(JSON.stringify(d))
  } catch (e) {
    return e
  }
  return null
}

describe('Fehlerhafter Compliance-Teil (daten-3)', () => {
  it('meldet Feld und Fehler und liefert den gültigen Prozess ohne Compliance-Angaben', async () => {
    const d = await datei()
    d.compliance.systeme.med_erp.seit = '01.03.2019'
    const e = fehlerBeim(d)
    expect(e).toBeInstanceOf(ComplianceFormatfehler)
    const f = e as ComplianceFormatfehler
    expect(f.detail).toBe('systeme.med_erp.seit: ist kein gültiges Datum')
    expect(f.message).toBe('Compliance-Angaben: ‚systeme.med_erp.seit‘ ist kein gültiges Datum.')
    expect('compliance' in f.ohneCompliance).toBe(false)
    expect(f.ohneCompliance.ist.name).toBe(beispielLieferdienst().name)
    // Der Prozess allein ist eine gültige Projektdatei
    expect(leseProjektText(alsJson(f.ohneCompliance)).ist).toEqual(beispielLieferdienst())
  })

  it('gilt auch für „compliance: null“ und für eine neuere Fassung der Angaben', async () => {
    const d = await datei()
    d.compliance = null
    expect((fehlerBeim(d) as ComplianceFormatfehler).detail).toBe('Compliance-Angaben: kein gültiges Objekt')
    const neuer = await datei()
    neuer.compliance.version = 2
    expect((fehlerBeim(neuer) as ComplianceFormatfehler).detail).toBe('Compliance-Angaben in Version 2 werden nicht unterstützt')
  })

  it('nennt bei einem beschädigten eingefrorenen Prozess das Feld der Version', async () => {
    const d = await datei()
    d.compliance.versionen[0].prozess.ablauf.schritte[0].typ = 'zauberei'
    const e = fehlerBeim(d) as ComplianceFormatfehler
    expect(e).toBeInstanceOf(ComplianceFormatfehler)
    expect(e.feld).toBe('versionen.0.prozess')
    expect(e.message).toBe('Compliance-Angaben: ‚versionen.0.prozess‘ ist kein gültiger Prozess (Ablauf, Schritt 1: unbekannter Baustein „zauberei“).')
  })

  it('ein fehlerhafter Prozess bleibt ein gewöhnlicher Formatfehler', async () => {
    const d = await datei()
    d.ist.ablauf.schritte[0].typ = 'zauberei'
    const e = fehlerBeim(d)
    expect(e).toBeInstanceOf(Formatfehler)
    expect(e).not.toBeInstanceOf(ComplianceFormatfehler)
  })

  it('schreibt eine Prüfsumme in Großbuchstaben still klein', async () => {
    const d = await datei()
    const summe: string = d.compliance.versionen[0].pruefsumme
    d.compliance.versionen[0].pruefsumme = summe.toUpperCase()
    expect(leseProjekt(d).compliance!.versionen[0].pruefsumme).toBe(summe)
  })
})

describe('Datumsangaben beim Laden (logik-7)', () => {
  it('lehnt ein Gültig-ab im Jahr 9995 ab, statt später beim Rechnen der Fristen abzustürzen', async () => {
    const d = await datei()
    d.compliance.versionen[0].gueltigAb = '9995-01-01'
    const e = fehlerBeim(d) as ComplianceFormatfehler
    expect(e).toBeInstanceOf(ComplianceFormatfehler)
    expect(e.message).toBe('Compliance-Angaben: ‚versionen.0.gueltigAb‘ liegt nicht zwischen 1900 und 2199.')
  })

  it('prüft alle Datumsfelder auf 1900 bis 2199', async () => {
    for (const setze of [
      (d: Record<string, any>) => (d.compliance.systeme.med_erp.seit = '0002-01-01'),
      (d: Record<string, any>) => (d.compliance.verarbeitung.eingefuehrtAm = '2200-01-01'),
      (d: Record<string, any>) => (d.compliance.versionen[0].verfahrensdoku.stand = '1899-12-31'),
    ]) {
      const d = await datei()
      setze(d)
      expect((fehlerBeim(d) as Error).message).toMatch(/liegt nicht zwischen 1900 und 2199\.$/)
    }
  })
})
