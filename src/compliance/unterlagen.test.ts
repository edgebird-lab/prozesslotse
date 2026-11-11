import { describe, expect, it } from 'vitest'
import { neuerProzess } from '../modell/bausteine'
import { beispielLieferdienst } from '../modell/beispiel'
import { complianceLieferdienst } from './beispiel'
import { datenSicht } from './quelle'
import { neueCompliance } from './standard'
import { aendereAblageort, benenneUnterlageUm, legeAblageortAn, legeUnterlageAn, loescheAblageort, loescheUnterlage, loeseZugriff, setzeZugriff, setzeZugriffe } from './unterlagen'

describe('Unterlagen, Ablageorte und Zugriffe', () => {
  it('legt eine Unterlage mit Entstehung und Nutzung an', () => {
    const { compliance: c, id } = legeUnterlageAn(neueCompliance(), 'Angebot', { entstehtIn: 'auf_a', genutztIn: ['auf_b', 'auf_c'] })
    expect(id).toMatch(/^unt_[a-z0-9]{8}$/)
    expect(c.unterlagen).toEqual([{ id, name: 'Angebot' }])
    expect(c.zugriffe).toEqual([
      { aufgabeId: 'auf_a', unterlageId: id, richtung: 'schreibt' },
      { aufgabeId: 'auf_b', unterlageId: id, richtung: 'liest' },
      { aufgabeId: 'auf_c', unterlageId: id, richtung: 'liest' },
    ])
    // Angaben entstehen erst bei der ersten Änderung
    expect(c.datenobjekte).toEqual({})
  })

  it('benennt um, ohne Angaben zu verlieren, und ändert nichts bei gleichem Namen', () => {
    const c = complianceLieferdienst()
    const neu = benenneUnterlageUm(c, 'dob_rechnung', 'Rechnung an Kunden')
    expect(neu.unterlagen.find((u) => u.id === 'dob_rechnung')?.name).toBe('Rechnung an Kunden')
    expect(neu.datenobjekte.dob_rechnung).toBe(c.datenobjekte.dob_rechnung)
    expect(benenneUnterlageUm(c, 'dob_rechnung', 'Ausgangsrechnung')).toBe(c)
    expect(benenneUnterlageUm(c, 'gibt_es_nicht', 'X')).toBe(c)
  })

  it('löscht eine Unterlage samt Angaben und Zugriffen', () => {
    const c = complianceLieferdienst()
    const neu = loescheUnterlage(c, 'dob_lieferschein')
    expect(neu.unterlagen.map((u) => u.id)).not.toContain('dob_lieferschein')
    expect(neu.datenobjekte.dob_lieferschein).toBeUndefined()
    expect(neu.zugriffe.some((z) => z.unterlageId === 'dob_lieferschein')).toBe(false)
    // 5 von 16 Zugriffen betreffen den Lieferschein
    expect(neu.zugriffe).toHaveLength(11)
    expect(c.zugriffe).toHaveLength(16)
  })

  it('löscht einen Ablageort und nimmt ihn aus jeder Ablage', () => {
    const c = complianceLieferdienst()
    const neu = loescheAblageort(c, 'dsp_warenwirtschaft')
    expect(neu.ablageorte.map((a) => a.id)).toEqual(['dsp_ordner'])
    expect(neu.datenobjekte.dob_rechnung.ablageSpeicherIds).toEqual([])
    expect(neu.datenobjekte.dob_bestellung.ablageSpeicherIds).toEqual([])
    expect(neu.datenobjekte.dob_lieferschein).toBe(c.datenobjekte.dob_lieferschein)
  })

  it('legt Ablageorte an und ändert sie', () => {
    const { compliance: c, id } = legeAblageortAn(neueCompliance(), 'Belegarchiv', 'med_dms', 'abl_test')
    expect(c.ablageorte).toEqual([{ id: 'abl_test', name: 'Belegarchiv', mediumId: 'med_dms' }])
    expect(aendereAblageort(c, id, { mediumId: null }).ablageorte[0].mediumId).toBeNull()
    expect(aendereAblageort(c, id, { name: 'Belegarchiv' })).toBe(c)
  })

  it('hält jeden Zugriff je Aufgabe, Unterlage und Richtung nur einmal', () => {
    const c = complianceLieferdienst()
    expect(setzeZugriff(c, 'auf_rechnung', 'dob_rechnung', 'schreibt')).toBe(c)
    const mitLesen = setzeZugriff(c, 'auf_rechnung', 'dob_rechnung', 'liest')
    expect(mitLesen.zugriffe).toHaveLength(17)
    expect(loeseZugriff(mitLesen, 'auf_rechnung', 'dob_rechnung', 'liest').zugriffe).toEqual(c.zugriffe)
    expect(loeseZugriff(c, 'auf_rechnung', 'dob_rechnung', 'liest')).toBe(c)
  })

  it('setzt die Zugriffe einer Richtung auf eine Auswahl von Aufgaben', () => {
    const c = complianceLieferdienst()
    const neu = setzeZugriffe(c, 'dob_rechnung', 'liest', ['auf_versenden', 'auf_abgeben'])
    expect(neu.zugriffe.filter((z) => z.unterlageId === 'dob_rechnung' && z.richtung === 'liest').map((z) => z.aufgabeId)).toEqual(['auf_versenden', 'auf_abgeben'])
    expect(neu.zugriffe.filter((z) => z.richtung === 'schreibt')).toEqual(c.zugriffe.filter((z) => z.richtung === 'schreibt'))
    expect(setzeZugriffe(c, 'dob_rechnung', 'liest', ['auf_versenden', 'auf_freigeben'])).toBe(c)
    expect(setzeZugriffe(c, 'dob_rechnung', 'schreibt', []).zugriffe.some((z) => z.unterlageId === 'dob_rechnung' && z.richtung === 'schreibt')).toBe(false)
  })
})

describe('DatenSicht', () => {
  it('liefert für den Lieferdienst Unterlagen, Ablageorte und Zugriffe in Tabellenreihenfolge', () => {
    const s = datenSicht(beispielLieferdienst(), complianceLieferdienst())
    expect(s.objekte.map((o) => o.name)).toEqual(['Bestellnotiz', 'Bestellung', 'Lieferschein', 'Tourenliste', 'Ausgangsrechnung'])
    expect(s.speicher).toEqual([
      { id: 'dsp_warenwirtschaft', name: 'Warenwirtschaft', mediumId: 'med_erp' },
      { id: 'dsp_ordner', name: 'Ordner Lieferscheine', mediumId: 'med_papier' },
    ])
    expect(s.zugriffe).toHaveLength(16)
    expect(s.zugriffe[0]).toEqual({ aufgabeId: 'auf_annehmen', zielId: 'dob_bestellnotiz', richtung: 'schreibt' })
  })

  it('lässt Zugriffe auf Aufgaben weg, die im Prozess fehlen', () => {
    const s = datenSicht(neuerProzess(), complianceLieferdienst())
    expect(s.objekte).toHaveLength(5)
    expect(s.zugriffe).toEqual([])
    expect(datenSicht(neuerProzess(), neueCompliance())).toEqual({ objekte: [], speicher: [], zugriffe: [] })
  })
})
