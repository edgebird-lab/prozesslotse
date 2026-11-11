/**
 * Zusammenführung von compliance mit der Modellierung: Eine Version, die unter Format 3
 * freigegeben wurde, lädt unter Format 4 mit stimmender Prüfsumme.
 *
 * `testdaten/format3-freigabe.prozesslotse` ist eine echte Projektdatei aus dem Zweig
 * `compliance` (Stand e7a9b35, FORMAT_VERSION 3): das Beispiel „Lieferdienst“ mit seinen
 * Compliance-Angaben, am Ende ergänzt um „Zahlungsziel abwarten“ (Warten auf einen
 * Zeitpunkt) und ein Gleichzeitig mit zwei Aufgaben, freigegeben als Version 1.0 am
 * 11.11.2026 und mit `alsJson` gespeichert. Im Rohstand hat „Gleichzeitig“ noch kein
 * Feld `art`; das Laden ergänzt es nur in der Kopie für Anzeige und Vergleich.
 */
import { describe, expect, it } from 'vitest'
import { alsJson, leseProjektText } from '../modell/speicher'
import { FORMAT_VERSION, type Parallel } from '../modell/typen'
import { pruefeCompliance } from './regeln'
import { eingefrorenerProzess, kanonischesJson } from './speicher'
import datei from './testdaten/format3-freigabe.prozesslotse?raw'
import { freigeben, geaenderteKapitel, pruefsummeStimmt } from './versionen'

const HEUTE = '2026-11-11'

/** „Gleichzeitig“ am Ende des Ablaufs, wie in der Datei eingefügt */
const parallelAmEnde = (schritte: readonly { typ: string }[]) => schritte[schritte.length - 1] as Parallel

describe('Version aus Format 3 unter Format 4', () => {
  const roh = JSON.parse(datei)

  it('die Datei ist wirklich Format 3, ihr Gleichzeitig ohne Art', () => {
    expect(roh.formatVersion).toBe(3)
    expect(roh.ist.formatVersion).toBe(3)
    const v = roh.compliance.versionen[0]
    expect(v.bezeichnung).toBe('1.0')
    expect(v.prozess.formatVersion).toBe(3)
    expect(parallelAmEnde(v.prozess.ablauf.schritte).typ).toBe('parallel')
    expect('art' in parallelAmEnde(v.prozess.ablauf.schritte)).toBe(false)
  })

  it('lädt mit „Prüfsumme stimmt“; der Rohstand bleibt, Anzeige und Vergleich bekommen Format 4', async () => {
    const projekt = leseProjektText(datei)
    expect(projekt.formatVersion).toBe(FORMAT_VERSION)
    expect(parallelAmEnde(projekt.ist.ablauf.schritte).art).toBe('alle')
    const v = projekt.compliance!.versionen[0]
    expect(await pruefsummeStimmt(v)).toBe(true)
    // Rohstand unverändert: gleiche Werte wie in der Datei, weiter Format 3 ohne `art`
    expect(kanonischesJson(v.prozess)).toBe(kanonischesJson(roh.compliance.versionen[0].prozess))
    expect(v.prozess.formatVersion).toBe(3)
    // Anzeige und Vergleich: migrierte Kopie
    const anzeige = eingefrorenerProzess(v)
    expect(anzeige.formatVersion).toBe(FORMAT_VERSION)
    expect(parallelAmEnde(anzeige.ablauf.schritte).art).toBe('alle')
  })

  it('meldet keine Änderung seit der Freigabe und keine falsche Prüfsumme; Kapitel 4 ist Wort für Wort gleich', () => {
    const projekt = leseProjektText(datei)
    const c = projekt.compliance!
    expect(geaenderteKapitel(c.versionen[0], projekt.ist, c)).toEqual([])
    const regeln = pruefeCompliance(projekt.ist, c, HEUTE).map((b) => b.regel)
    expect(regeln).not.toContain('V2')
    expect(regeln).not.toContain('V4')
  })

  it('Speichern und Laden ändern den Rohstand nicht; eine neue Freigabe friert Format 4 ein', async () => {
    let projekt = leseProjektText(datei)
    for (let i = 0; i < 2; i++) {
      const gespeichert = alsJson(projekt)
      expect(JSON.parse(gespeichert).formatVersion).toBe(FORMAT_VERSION)
      expect(kanonischesJson(JSON.parse(gespeichert).compliance.versionen[0].prozess)).toBe(kanonischesJson(roh.compliance.versionen[0].prozess))
      projekt = leseProjektText(gespeichert)
      expect(await pruefsummeStimmt(projekt.compliance!.versionen[0])).toBe(true)
    }
    const c = projekt.compliance!
    const v2 = await freigeben(projekt.ist, c, { bezeichnung: '1.1', gueltigAb: '2026-12-01', freigegebenVon: 'Erika Mustermann', aenderung: 'Format 4' }, HEUTE)
    expect(v2.geaenderteKapitel).toEqual([])
    expect(v2.prozess.formatVersion).toBe(FORMAT_VERSION)
    const zwei = leseProjektText(alsJson({ ...projekt, compliance: { ...c, versionen: [...c.versionen, v2] } }))
    for (const v of zwei.compliance!.versionen) expect(await pruefsummeStimmt(v)).toBe(true)
  })
})
