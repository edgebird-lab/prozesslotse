import { describe, expect, it } from 'vitest'
import { neueAufgabe, neueEntscheidung, neueWiederholung } from './bausteine'
import { beispielLieferdienst } from './beispiel'
import { abschnittFertig, beschreibeCursor, cursorNachEinfuegen } from './fuehrung'

describe('Führung durch den Ablauf', () => {
  const p = beispielLieferdienst()

  it('beschreibt die Einfügeposition verständlich', () => {
    const ort = beschreibeCursor(p, { sequenzId: 'zw_vorrat_nein', index: 1 })
    expect(ort.bereich).toBe('im Ausgang „Nein“ von „Ware vorrätig?“')
    expect(ort.position).toBe('nach „Kunden anrufen und Ersatz anbieten“')
    expect(ort.unerreichbar).toBe(false)
    expect(beschreibeCursor(p, { sequenzId: 'haupt', index: 0 }).position).toBe('am Anfang')
  })

  it('springt nach einer Entscheidung in den ersten Ausgang und nach einer Wiederholung in ihren Körper', () => {
    const e = neueEntscheidung()
    expect(cursorNachEinfuegen(e, { sequenzId: 'haupt', index: 3 })).toEqual({ sequenzId: e.zweige[0].id, index: 0 })
    const w = neueWiederholung()
    expect(cursorNachEinfuegen(w, { sequenzId: 'haupt', index: 3 })).toEqual({ sequenzId: w.koerper.id, index: 0 })
    expect(cursorNachEinfuegen(neueAufgabe(), { sequenzId: 'haupt', index: 3 })).toEqual({ sequenzId: 'haupt', index: 4 })
  })

  it('geht bei „Abschnitt fertig“ zum nächsten Ausgang, dann hinter den Block, im Hauptablauf zum Prüfen', () => {
    expect(abschnittFertig(p, { sequenzId: 'zw_vorrat_ja', index: 0 })).toEqual({ sequenzId: 'zw_vorrat_nein', index: 2 })
    expect(abschnittFertig(p, { sequenzId: 'zw_vorrat_nein', index: 2 })).toEqual({ sequenzId: 'haupt', index: 3 })
    expect(abschnittFertig(p, { sequenzId: 'seq_kommission', index: 2 })).toEqual({ sequenzId: 'haupt', index: 4 })
    expect(abschnittFertig(p, { sequenzId: 'haupt', index: 5 })).toBe('fertig')
    expect(beschreibeCursor(p, { sequenzId: 'zw_vorrat_ja', index: 0 }).weiterText).toBe('Weiter im Ausgang „Nein“ von „Ware vorrätig?“')
    expect(beschreibeCursor(p, { sequenzId: 'zw_vorrat_nein', index: 2 }).weiterText).toBe('Weiter nach „Ware vorrätig?“')
  })

  it('erkennt Stellen, die nie erreicht werden', () => {
    const ende = neueEntscheidung({ zweige: [{ ...neueEntscheidung().zweige[0], ende: 'A' }, { ...neueEntscheidung().zweige[1], ende: 'B' }] })
    const q = { ...p, ablauf: { ...p.ablauf, schritte: [ende] } }
    expect(beschreibeCursor(q, { sequenzId: 'haupt', index: 1 }).unerreichbar).toBe(true)
  })
})
