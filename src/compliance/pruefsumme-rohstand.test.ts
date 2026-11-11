/**
 * Nachprüfung „regression“, Mangel 1: Die Prüfsumme einer Version muss nach dem
 * Laden stimmen, auch wenn das Laden den eingefrorenen Prozess migriert oder
 * normalisiert. Der eingefrorene Prozess bleibt als Rohstand erhalten; Anzeige und
 * Vergleich nutzen eine angepasste Kopie (`eingefrorenerProzess`).
 *
 * Die zusätzliche Normalisierung simuliert, was andere Zweige beim Laden tun:
 * main entfernt `von` an Zeit-Ereignissen (entferneFremdeAbsender), die
 * Modellierung hebt auf Format 4.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
// zuerst: So bekommt compliance/speicher beim Kreisimport das ersetzte leseProjekt (siehe vi.mock unten)
import { eingefrorenerProzess, kanonischesJson } from './speicher'
import { neuesWarten } from '../modell/bausteine'
import { fuegeEin } from '../modell/operationen'
import { alsJson, leseProjektText } from '../modell/speicher'
import { FORMAT_VERSION, type Block, type Prozess } from '../modell/typen'
import { beispielMitCompliance } from './beispiel'
import type { DokuVersion } from './typen'
import { freigeben, pruefsumme, pruefsummeStimmt } from './versionen'

const sim = vi.hoisted(() => ({ normalisiere: null as null | ((ist: Prozess) => void) }))

// Nur der Weg, den eingefrorene Prozesse nehmen (compliance/speicher → leseProjekt), bekommt die zusätzliche Normalisierung
vi.mock('../modell/speicher', async (original) => {
  const m = await original<typeof import('../modell/speicher')>()
  return {
    ...m,
    leseProjekt: (daten: unknown) => {
      const p = m.leseProjekt(daten)
      sim.normalisiere?.(p.ist)
      return p
    },
  }
})

afterEach(() => {
  sim.normalisiere = null
})

const HEUTE = '2026-11-11'
const EINGABEN = { bezeichnung: '1.0', gueltigAb: HEUTE, freigegebenVon: 'Erika Mustermann', aenderung: 'Erstfassung' }

/** wie entferneFremdeAbsender in main: Absender nur an Nachrichten */
function entferneFremdeAbsender(p: Prozess): void {
  const sequenz = (schritte: Block[]) => {
    for (const b of schritte) {
      if (b.typ === 'warten' && b.art !== 'nachricht') b.von = null
      if (b.typ === 'entscheidung') for (const z of b.zweige) sequenz(z.schritte)
      if (b.typ === 'parallel' || b.typ === 'oder') for (const z of b.zweige) sequenz(z.schritte)
      if (b.typ === 'wiederholung') sequenz(b.koerper.schritte)
    }
  }
  sequenz(p.ablauf.schritte)
}

/** Beispiel mit „Warten auf Termin“ und einer freigegebenen Version, gespeichert als Text */
async function dateiMitWarten(): Promise<{ text: string; v: DokuVersion }> {
  const p = beispielMitCompliance()
  const ist = fuegeEin(p.ist, p.ist.ablauf.id, 1, neuesWarten({ name: 'Bis morgen warten' }))
  const v = await freigeben(ist, p.compliance!, EINGABEN, HEUTE)
  return { text: alsJson({ ...p, ist, compliance: { ...p.compliance!, versionen: [v] } }), v }
}

const ersteVersion = (text: string): DokuVersion => leseProjektText(text).compliance!.versionen[0]

describe('Prüfsumme gegen den eingefrorenen Rohstand', () => {
  it('Version mit „Warten auf Termin“: stimmt nach Speichern und Laden, auch wenn das Laden „von“ entfernt', async () => {
    sim.normalisiere = entferneFremdeAbsender
    const { text, v } = await dateiMitWarten()
    const geladen = ersteVersion(text)
    expect(await pruefsummeStimmt(geladen)).toBe(true)
    expect(kanonischesJson(geladen.prozess)).toBe(kanonischesJson(v.prozess))
    // Anzeige und Vergleich sehen den normalisierten Stand
    const warten = eingefrorenerProzess(geladen).ablauf.schritte[1]
    expect(warten.typ === 'warten' && warten.von).toBeNull()
  })

  it('Version mit eingefrorenem Prozess in Format 2: stimmt nach dem Laden; die Anzeige bekommt eine migrierte Kopie', async () => {
    const p = beispielMitCompliance()
    const v1 = await freigeben(p.ist, p.compliance!, EINGABEN, HEUTE)
    // so, wie eine Version aussähe, die unter Format 2 eingefroren wurde (ohne Teilnehmer)
    const alt = structuredClone(v1)
    const roh = alt.prozess as unknown as Record<string, unknown>
    roh.formatVersion = 2
    delete roh.teilnehmer
    alt.pruefsumme = await pruefsumme(alt)
    const geladen = ersteVersion(alsJson({ ...p, compliance: { ...p.compliance!, versionen: [alt] } }))
    expect(await pruefsummeStimmt(geladen)).toBe(true)
    expect(geladen.prozess.formatVersion).toBe(2)
    expect(geladen.prozess.teilnehmer).toBeUndefined()
    const anzeige = eingefrorenerProzess(geladen)
    expect(anzeige.formatVersion).toBe(FORMAT_VERSION)
    expect(anzeige.teilnehmer).toEqual([])
  })

  it('stimmt auch bei einer weiteren Anpassung beim Laden (simuliert: Sprung auf Format 4)', async () => {
    sim.normalisiere = (ist) => {
      ;(ist as unknown as { formatVersion: number }).formatVersion = 4
      entferneFremdeAbsender(ist)
    }
    const { text } = await dateiMitWarten()
    const geladen = ersteVersion(text)
    expect(await pruefsummeStimmt(geladen)).toBe(true)
    expect(eingefrorenerProzess(geladen).formatVersion).toBe(4)
  })

  it('Speichern und erneutes Laden ändern den eingefrorenen Rohstand nicht', async () => {
    sim.normalisiere = (ist) => {
      ;(ist as unknown as { formatVersion: number }).formatVersion = 4
      entferneFremdeAbsender(ist)
    }
    const { text, v } = await dateiMitWarten()
    const roh = JSON.stringify(v.prozess)
    let projekt = leseProjektText(text)
    for (let i = 0; i < 2; i++) {
      // Speichern wie die App (alsJson) und wieder laden
      const gespeichert = alsJson(projekt)
      // in der Datei steht der eingefrorene Prozess so wie bei der Freigabe (gleiche Schlüsselreihenfolge, gleiche Werte)
      expect(JSON.stringify(JSON.parse(gespeichert).compliance.versionen[0].prozess)).toBe(roh)
      projekt = leseProjektText(gespeichert)
      expect(JSON.stringify(projekt.compliance!.versionen[0].prozess)).toBe(roh)
    }
    expect(await pruefsummeStimmt(projekt.compliance!.versionen[0])).toBe(true)
  })
})
