import { describe, expect, it } from 'vitest'
import { geaenderteKapitelIn, gliederung, kapitelSchluessel } from './dokument'
import type { Abschnitt, Dokument, DokumentArt } from './typen'

function dok(abschnitte: Abschnitt[], art: DokumentArt = 'verfahrensdokumentation'): Dokument {
  return { art, titel: 'T', untertitel: '', versionText: 'Entwurf', stand: '2026-11-11', rechtsstand: '2026-11-11', abschnitte }
}

const h = (ebene: 1 | 2 | 3, nummer: string): Abschnitt => ({ art: 'ueberschrift', ebene, nummer, text: `Kapitel ${nummer}` })
const p = (text: string): Abschnitt => ({ art: 'absatz', text })

const BASIS: Abschnitt[] = [p('Deckblatt'), h(1, '1'), p('a'), h(1, '2'), h(2, '2.1'), p('b'), h(2, '2.2'), h(3, '2.2.1'), p('c'), h(1, '4'), h(2, '4.1'), p('d'), h(2, '4.2'), p('e'), h(1, '7'), p('f')]

describe('Kapitelschlüssel', () => {
  it('ordnet jeden Abschnitt der letzten Überschrift der Ebene 1 oder 2 zu', () => {
    expect(kapitelSchluessel(BASIS)).toEqual(['Deckblatt', '1', '1', '2', '2.1', '2.1', '2.2', '2.2', '2.2', '4', '4.1', '4.1', '4.2', '4.2', '7', '7'])
  })

  it('fasst Kapitel zusammen, deren Unterkapitel sich verschieben würden', () => {
    expect(kapitelSchluessel(BASIS, new Set(['4'])).slice(9, 14)).toEqual(['4', '4', '4', '4', '4'])
  })
})

describe('Vergleich zweier Stände', () => {
  it('meldet nichts bei gleichem Inhalt', () => {
    expect(geaenderteKapitelIn(dok(BASIS), dok(structuredClone(BASIS)))).toEqual([])
  })

  it('nennt geänderte Kapitel mit Präfix; Ebene 3 zählt zu ihrer Ebene 2, Kapitel 4 als Ganzes', () => {
    const neu = structuredClone(BASIS)
    neu[8] = p('c geändert')
    neu[13] = p('e geändert')
    expect(geaenderteKapitelIn(dok(BASIS), dok(neu))).toEqual(['VD 2.2', 'VD 4'])
  })

  it('übergeht Deckblatt und Kapitel 7 der Verfahrensdokumentation', () => {
    const neu = structuredClone(BASIS)
    neu[0] = p('anderes Datum')
    neu[15] = p('neue Version in der Historie')
    expect(geaenderteKapitelIn(dok(BASIS), dok(neu))).toEqual([])
  })

  it('erkennt neue und weggefallene Kapitel', () => {
    const neu = [...structuredClone(BASIS), h(1, '9'), h(2, '9.2'), p('Einweisung')]
    expect(geaenderteKapitelIn(dok(BASIS), dok(neu))).toEqual(['VD 9', 'VD 9.2'])
    expect(geaenderteKapitelIn(dok(neu), dok(BASIS))).toEqual(['VD 9', 'VD 9.2'])
  })

  it('übergeht im Verzeichnis Abschnitt D', () => {
    const alt = [p('Deckblatt'), h(1, 'A'), p('x'), h(1, 'B'), h(2, 'B.1'), p('y'), h(1, 'D'), p('z')]
    const neu = structuredClone(alt)
    neu[5] = p('y geändert')
    neu[7] = p('z geändert')
    expect(geaenderteKapitelIn(dok(alt, 'verarbeitungsverzeichnis'), dok(neu, 'verarbeitungsverzeichnis'))).toEqual(['VVT B.1'])
  })
})

describe('Gliederung', () => {
  it('listet die Überschriften der Ebenen 1 und 2', () => {
    expect(gliederung(dok(BASIS)).map((g) => g.nummer)).toEqual(['1', '2', '2.1', '2.2', '4', '4.1', '4.2', '7'])
  })
})
