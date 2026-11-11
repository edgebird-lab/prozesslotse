import { describe, expect, it } from 'vitest'
import { festeLeerzeichen } from './typografie'

const NBSP = '\u00a0'

describe('feste Leerzeichen nach Verweiszeichen (recht-18)', () => {
  it('bindet §, §§, Abs., Nr., Art., Rz., lit. und Ziff. an das Folgende', () => {
    expect(festeLeerzeichen('(§ 147 Abs. 1 Nr. 2 und 3 AO)')).toBe(`(§${NBSP}147 Abs.${NBSP}1 Nr.${NBSP}2 und 3 AO)`)
    expect(festeLeerzeichen('§§ 238 ff. HGB')).toBe(`§§${NBSP}238 ff. HGB`)
    expect(festeLeerzeichen('Art. 6 Abs. 1 lit. f DSGVO, GoBD Rz. 151–155, Ziff. 6.8')).toBe(`Art.${NBSP}6 Abs.${NBSP}1 lit.${NBSP}f DSGVO, GoBD Rz.${NBSP}151–155, Ziff.${NBSP}6.8`)
  })

  it('lässt andere Wörter, Satzenden und Text ohne Verweis unverändert', () => {
    for (const t of ['Die Art der Ablage', 'Vertragsart. Danach', 'Nr.', 'Bestellung bis Rechnung', 'Satz 1', '']) expect(festeLeerzeichen(t)).toBe(t)
  })
})
