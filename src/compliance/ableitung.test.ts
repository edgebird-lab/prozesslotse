import { describe, expect, it } from 'vitest'
import { neuerProzess } from '../modell/bausteine'
import { beispielLieferdienst, beispielOnlinebestellung } from '../modell/beispiel'
import { ablageVon, datenImSystem, entstehtIn, ersteller, hatPersonenbezug, imEinsatz, kontext, nummern, nutzer, rollenMitZugriff, systemeImEinsatz, vorigeAufgabe } from './ableitung'
import { complianceLieferdienst } from './beispiel'
import { neueCompliance } from './standard'

const k = () => kontext(beispielLieferdienst(), complianceLieferdienst())

describe('Nummern der Aufgaben', () => {
  it('zählt im Lieferdienst 4.1 bis 4.18 in Lesereihenfolge', () => {
    const n = nummern(beispielLieferdienst())
    expect(n.size).toBe(18)
    expect(n.get('auf_annehmen')).toBe('4.1')
    expect(n.get('auf_ersatz')).toBe('4.3')
    expect(n.get('auf_stornieren')).toBe('4.5')
    expect(n.get('auf_kommissionieren')).toBe('4.6')
    expect(n.get('auf_kontrollieren')).toBe('4.7')
    expect(n.get('auf_erneut')).toBe('4.13')
    expect(n.get('auf_rechnung')).toBe('4.16')
    expect(n.get('auf_versenden')).toBe('4.18')
  })

  it('zählt in der Onlinebestellung 4.1 bis 4.8, auch in Rücksprungbereich und Gleichzeitig', () => {
    const n = nummern(beispielOnlinebestellung())
    expect([...n.entries()]).toEqual([
      ['auf_erfassen', '4.1'],
      ['auf_nachfragen', '4.2'],
      ['auf_storno', '4.3'],
      ['auf_verfall', '4.4'],
      ['auf_rechnung', '4.5'],
      ['auf_kommissionieren', '4.6'],
      ['auf_verpacken', '4.7'],
      ['auf_versenden', '4.8'],
    ])
    expect(nummern(neuerProzess()).size).toBe(0)
  })
})

describe('Vorige Aufgabe', () => {
  const p = beispielLieferdienst()
  it('nimmt die Aufgabe davor in derselben Folge', () => {
    expect(vorigeAufgabe(p, 'auf_freigeben')?.id).toBe('auf_rechnung')
    expect(vorigeAufgabe(p, 'auf_kontrollieren')?.id).toBe('auf_kommissionieren')
  })
  it('geht am Anfang eines Zweigs im umgebenden Block weiter', () => {
    expect(vorigeAufgabe(p, 'auf_ersatz')?.id).toBe('auf_erfassen')
    expect(vorigeAufgabe(p, 'auf_aendern')?.id).toBe('auf_ersatz')
    expect(vorigeAufgabe(p, 'auf_quittieren')?.id).toBe('auf_ausliefern')
    expect(vorigeAufgabe(p, 'auf_kommissionieren')?.id).toBe('auf_erfassen')
  })
  it('überspringt zusammengesetzte Bausteine und Warten, ohne sie zu betreten', () => {
    // vor „Tour planen“ stehen die Wiederholung und die Entscheidung; ihr Inhalt zählt nicht
    expect(vorigeAufgabe(p, 'auf_tour')?.id).toBe('auf_erfassen')
    expect(vorigeAufgabe(p, 'auf_erneut')?.id).toBe('auf_benachrichtigen')
    expect(vorigeAufgabe(p, 'auf_abgeben')?.id).toBe('auf_ausliefern')
  })
  it('liefert am Anfang des Ablaufs null', () => {
    expect(vorigeAufgabe(p, 'auf_annehmen')).toBeNull()
    expect(vorigeAufgabe(p, 'gibt_es_nicht')).toBeNull()
  })
})

describe('Ersteller, Nutzer, Rollen', () => {
  it('ordnet Ersteller und Nutzer nach dem Ablauf', () => {
    expect(ersteller(k(), 'dob_lieferschein').map((a) => a.id)).toEqual(['auf_kommissionieren', 'auf_quittieren'])
    expect(nutzer(k(), 'dob_lieferschein').map((a) => a.id)).toEqual(['auf_ausliefern', 'auf_abgeben', 'auf_bestaetigen'])
    expect(entstehtIn(k(), 'dob_rechnung')?.id).toBe('auf_rechnung')
  })

  it('trennt Rollen mit Zugriff nach intern und extern, in der Reihenfolge der Rollen', () => {
    expect(rollenMitZugriff(k(), 'dob_rechnung').intern.map((r) => r.id)).toEqual(['rol_buchhaltung', 'rol_leitung'])
    const c = complianceLieferdienst()
    c.rollen.rol_leitung = { extern: true, organisation: 'Beirat' }
    const r = rollenMitZugriff(kontext(beispielLieferdienst(), c), 'dob_rechnung')
    expect(r.intern.map((x) => x.id)).toEqual(['rol_buchhaltung'])
    expect(r.extern.map((x) => x.id)).toEqual(['rol_leitung'])
  })
})

describe('Systeme und ihre Daten', () => {
  it('kennt die digitalen Systeme im Einsatz in Modellreihenfolge', () => {
    expect(systemeImEinsatz(k()).map((m) => m.id)).toEqual(['med_excel', 'med_erp'])
    expect(imEinsatz(k(), 'med_papier')).toBe(true)
    expect(systemeImEinsatz(kontext(neuerProzess(), neueCompliance()))).toEqual([])
  })

  it('findet die Daten in einem System über Ablage und Zugriffe', () => {
    expect(datenImSystem(k(), 'med_erp')).toEqual(['dob_bestellnotiz', 'dob_bestellung', 'dob_lieferschein', 'dob_rechnung'])
    expect(datenImSystem(k(), 'med_excel')).toEqual(['dob_bestellung', 'dob_tourenliste'])
    expect(datenImSystem(k(), 'med_papier')).toEqual(['dob_bestellnotiz', 'dob_bestellung', 'dob_lieferschein', 'dob_tourenliste'])
    expect(hatPersonenbezug(k(), 'med_erp')).toBe(true)
  })

  it('nennt aufbewahrungspflichtige Unterlagen je System', () => {
    expect(ablageVon(k(), 'med_erp')).toEqual(['dob_bestellung', 'dob_rechnung'])
    expect(ablageVon(k(), 'med_papier')).toEqual(['dob_lieferschein'])
    expect(ablageVon(k(), 'med_excel')).toEqual([])
  })
})
