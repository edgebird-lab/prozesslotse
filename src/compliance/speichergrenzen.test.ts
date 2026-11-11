/**
 * Größe der Versionen (Prüfung daten-9): Die Spezifikation 7.3 nennt Grundgröße, Zuwachs je Version
 * und daraus die Grenzen von Browser-Speicher und Projektdatei. Dieser Test hält die Messung fest;
 * ändert sich die Größe deutlich, sind die Zahlen in 7.3 und in der README neu zu messen.
 */
import { describe, expect, it } from 'vitest'
import { alsJson } from '../modell/speicher'
import { beispielMitCompliance } from './beispiel'
import { addiereTage } from './datum'
import type { ComplianceProjekt } from './typen'
import { freigeben } from './versionen'

/** Gemessene Werte aus Spezifikation 7.3 */
const GRUNDGROESSE = 33_000
const ZUWACHS = 200
const BROWSER_ZEICHEN = 5_000_000
const DATEI_BYTES = 20 * 1024 * 1024

describe('Wachstum der Versionen (Spezifikation 7.3)', () => {
  it('Grundgröße und Zuwachs je Version passen zu den Zahlen der Spezifikation; daraus folgen die Grenzen', async () => {
    const p = beispielMitCompliance()
    let c: ComplianceProjekt = p.compliance!
    for (let i = 0; i < 10; i++) {
      // eine Freigabe im Monat
      const tag = addiereTage('2026-01-01', 31 * i)
      const v = await freigeben(p.ist, c, { bezeichnung: `${i + 1}.0`, gueltigAb: tag, freigegebenVon: 'Erika Mustermann', aenderung: i === 0 ? 'Erstfassung' : 'Rechnung wird zusätzlich geprüft' }, tag)
      c = { ...c, versionen: [...c.versionen, v] }
    }
    const groesse = c.versionen.map((v) => JSON.stringify(v).length)
    const zuwachs = (groesse[9] - groesse[0]) / 9
    expect(groesse[0] / GRUNDGROESSE).toBeGreaterThan(0.9)
    expect(groesse[0] / GRUNDGROESSE).toBeLessThan(1.1)
    expect(zuwachs / ZUWACHS).toBeGreaterThan(0.8)
    expect(zuwachs / ZUWACHS).toBeLessThan(1.25)

    // Hochrechnung wie in 7.3: Versionsschlüssel bei n Versionen
    const schluessel = (n: number) => n * groesse[0] + (zuwachs * n * (n - 1)) / 2
    expect(Math.abs(schluessel(10) - JSON.stringify(c.versionen).length)).toBeLessThan(1000)
    // Browser-Speicher voll bei rund 115 Versionen
    expect(schluessel(110)).toBeLessThan(BROWSER_ZEICHEN)
    expect(schluessel(120)).toBeGreaterThan(BROWSER_ZEICHEN)
    // Projektdatei (mit Einrückung) erreicht 20 MiB bei rund 185 Versionen
    const dateiJeZeichen = Buffer.byteLength(alsJson({ ...p, compliance: c }), 'utf8') / JSON.stringify(c.versionen).length
    expect(schluessel(175) * dateiJeZeichen).toBeLessThan(DATEI_BYTES)
    expect(schluessel(195) * dateiJeZeichen).toBeGreaterThan(DATEI_BYTES)
  })
})
