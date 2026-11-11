import { describe, expect, it } from 'vitest'
import { bewerteVorschlaege } from '../analyse/regeln'
import { entferneBlock } from '../modell/operationen'
import type { Projekt, Prozess } from '../modell/typen'
import { beispielMitCompliance } from './beispiel'
import { gestricheneKontrollen } from './verzahnung'

// logik-6: „Verbessern“ wendet die Vorschläge auf das Soll an, falls es eines gibt (VerbessernSchritt.tsx)

/** Hinweise je Vorschlag, wie „Verbessern“ sie zeigt: Vorschläge auf das Soll bzw. Ist angewandt */
function hinweise(projekt: Projekt): Record<string, string[]> {
  const basis: Prozess = projekt.soll ?? projekt.ist
  return Object.fromEntries(bewerteVorschlaege(basis).map((v) => [v.titel, gestricheneKontrollen(projekt, v.anwenden(basis), basis)]))
}

const mitHinweis = (h: Record<string, string[]>) => Object.keys(h).filter((t) => h[t].length > 0)

describe('Hinweis auf gestrichene Kontrollen bei vorhandenem Soll (logik-6)', () => {
  it('ist das Soll eine Kopie des Ist, trägt nur der Vorschlag „Freigabe streichen“ den Hinweis', () => {
    const projekt = beispielMitCompliance()
    const h = hinweise({ ...projekt, soll: structuredClone(projekt.ist) })
    expect(mitHinweis(h)).toEqual(['Freigabe „Rechnung freigeben“ streichen'])
    expect(h['Freigabe „Rechnung freigeben“ streichen']).toEqual(['auf_freigeben'])
  })

  it('nach Übernahme von „Freigabe streichen“ zeigt kein Vorschlag mehr den Hinweis', () => {
    const projekt = beispielMitCompliance()
    const freigabe = bewerteVorschlaege(projekt.ist).find((v) => v.regel === 'freigabe')!
    const h = hinweise({ ...projekt, soll: freigabe.anwenden(projekt.ist) })
    expect(Object.keys(h).length).toBeGreaterThan(0)
    expect(mitHinweis(h)).toEqual([])
  })

  it('auch nicht, wenn die Freigabe im Soll von Hand gelöscht wurde', () => {
    const projekt = beispielMitCompliance()
    const h = hinweise({ ...projekt, soll: entferneBlock(projekt.ist, 'auf_freigeben') })
    expect(mitHinweis(h)).toEqual([])
  })
})
