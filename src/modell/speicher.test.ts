import { describe, expect, it } from 'vitest'
import { beispielProjekt } from './beispiel'
import { alsJson, Formatfehler, leseProjekt, leseProjektText } from './speicher'

describe('Speichern und Laden', () => {
  it('liest ein gespeichertes Projekt unverändert wieder ein', () => {
    const projekt = beispielProjekt()
    expect(leseProjektText(alsJson(projekt))).toEqual(projekt)
  })

  it('lehnt kaputte oder fremde Dateien mit verständlicher Meldung ab', () => {
    expect(() => leseProjektText('{nicht json')).toThrow(Formatfehler)
    expect(() => leseProjekt({ formatVersion: 99 })).toThrow('Dateiformat 99')

    const p = JSON.parse(alsJson(beispielProjekt()))
    p.ist.ablauf.schritte[0].typ = 'zauberei'
    expect(() => leseProjekt(p)).toThrow('unbekannter Baustein „zauberei“')
  })
})
