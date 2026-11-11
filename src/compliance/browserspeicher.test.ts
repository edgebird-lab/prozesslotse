import { afterEach, describe, expect, it, vi } from 'vitest'
import { beispielProjekt } from '../modell/beispiel'
import { ladeAusBrowser, loescheBrowserDaten, speichereImBrowser } from '../modell/speicher'
import type { Projekt } from '../modell/typen'
import { beispielMitCompliance } from './beispiel'
import type { DokuVersion } from './typen'

/** Speicher-Attrappe, die mitschreibt, welche Schlüssel gesetzt wurden. */
function attrappe(werfen = false) {
  const daten = new Map<string, string>()
  const geschrieben: string[] = []
  return {
    daten,
    geschrieben,
    getItem: (k: string) => daten.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (werfen) throw new DOMException('voll', 'QuotaExceededError')
      geschrieben.push(k)
      daten.set(k, v)
    },
    removeItem: (k: string) => void daten.delete(k),
  }
}

/** Versionen als Platzhalter; für das Schreiben zählt nur die Referenz der Liste. */
function mitVersionen(p: Projekt, anzahl: number): Projekt {
  const versionen = Array.from({ length: anzahl }, (_, i) => ({ nummer: i + 1, bezeichnung: `${i + 1}.0` }) as unknown as DokuVersion)
  return { ...p, compliance: { ...p.compliance!, versionen } }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Projekt im Browser-Speicher', () => {
  it('schreibt die Versionen nur, wenn sich die Liste geändert hat', () => {
    const speicher = attrappe()
    vi.stubGlobal('localStorage', speicher)
    let p = mitVersionen(beispielMitCompliance(), 3)
    expect(speichereImBrowser(p)).toBe(true)
    expect(speicher.geschrieben.filter((k) => k === 'prozesslotse:versionen')).toHaveLength(1)
    // Tippen in einem Feld: neues Projekt, gleiche Versionsliste
    for (const name of ['A', 'AB', 'ABC']) {
      p = { ...p, compliance: { ...p.compliance!, unternehmen: { ...p.compliance!.unternehmen, name } } }
      expect(speichereImBrowser(p)).toBe(true)
    }
    expect(speicher.geschrieben.filter((k) => k === 'prozesslotse:versionen')).toHaveLength(1)
    expect(speicher.geschrieben.filter((k) => k === 'prozesslotse:projekt')).toHaveLength(4)
    // Das Projekt selbst enthält die Versionen nicht
    expect(JSON.parse(speicher.daten.get('prozesslotse:projekt')!).compliance.versionen).toEqual([])
  })

  it('entfernt den Schlüssel der Versionen bei einem Projekt ohne Versionen', () => {
    const speicher = attrappe()
    vi.stubGlobal('localStorage', speicher)
    speichereImBrowser(mitVersionen(beispielMitCompliance(), 2))
    expect(speicher.daten.has('prozesslotse:versionen')).toBe(true)
    speichereImBrowser(beispielProjekt())
    expect(speicher.daten.has('prozesslotse:versionen')).toBe(false)
  })

  it('meldet einen vollen Speicher mit false', () => {
    vi.stubGlobal('localStorage', attrappe(true))
    expect(speichereImBrowser(beispielMitCompliance())).toBe(false)
  })

  it('lädt das Projekt mit Compliance-Angaben wieder', () => {
    vi.stubGlobal('localStorage', attrappe())
    const p = beispielMitCompliance()
    speichereImBrowser(p)
    expect(ladeAusBrowser()).toEqual(p)
  })

  it('löscht Projekt, Versionen und Einstellungen', () => {
    const speicher = attrappe()
    vi.stubGlobal('localStorage', speicher)
    speichereImBrowser(mitVersionen(beispielMitCompliance(), 1))
    speicher.daten.set('prozesslotse:einstellungen', '{"lernmodus":false}')
    speicher.daten.set('prozesslotse:dokument', '{}')
    loescheBrowserDaten()
    expect([...speicher.daten.keys()]).toEqual([])
    expect(ladeAusBrowser()).toBeNull()
  })
})
