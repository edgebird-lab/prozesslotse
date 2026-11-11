import { describe, expect, it } from 'vitest'
import { addiereJahre, addiereMonate, addiereTage, formatiereDatum, heuteIso, istIsoDatum, istPlausiblesDatum, tageZwischen } from './datum'
import {
  aufbewahrenBis,
  aufbewahrenBisText,
  aufbewahrungBis,
  aufbewahrungText,
  beispielBis,
  fristEnde,
  fristText,
  gueltigBisIn,
  laengerAlsVorgeschrieben,
  loeschText,
  mindestJahre,
  vernichtungAb,
  wirksameJahre,
} from './fristen'
import { neueFrist, standardDatenobjekt } from './standard'
import type { Aufbewahrungsart, DatenobjektAngaben } from './typen'

const objekt = (werte: Partial<DatenobjektAngaben>): DatenobjektAngaben => ({ ...standardDatenobjekt(), ...werte })

describe('Datum (6.1)', () => {
  it('erkennt gültige Kalenderdaten', () => {
    expect(istIsoDatum('2026-11-11')).toBe(true)
    expect(istIsoDatum('2026-02-30')).toBe(false)
    expect(istIsoDatum('2026-13-01')).toBe(false)
    expect(istIsoDatum('2028-02-29')).toBe(true)
    expect(istIsoDatum('2027-02-29')).toBe(false)
    expect(istIsoDatum('2026-1-1')).toBe(false)
    expect(istIsoDatum('11.11.2026')).toBe(false)
  })

  it('formatiert deutsch', () => {
    expect(formatiereDatum('2026-11-11')).toBe('11.11.2026')
    expect(formatiereDatum('2027-03-01')).toBe('01.03.2027')
  })

  it('addiert Tage über Monats- und Jahresgrenzen', () => {
    expect(addiereTage('2026-12-31', 30)).toBe('2027-01-30')
    expect(addiereTage('2026-03-01', -1)).toBe('2026-02-28')
    expect(addiereTage('2028-03-01', -1)).toBe('2028-02-29')
    // Sommerzeit spielt keine Rolle
    expect(addiereTage('2026-03-28', 2)).toBe('2026-03-30')
  })

  it('kappt Monate auf das Monatsende', () => {
    expect(addiereMonate('2026-08-31', 6)).toBe('2027-02-28')
    expect(addiereMonate('2026-01-31', 1)).toBe('2026-02-28')
    expect(addiereMonate('2026-03-31', -1)).toBe('2026-02-28')
    expect(addiereJahre('2028-02-29', 1)).toBe('2029-02-28')
    expect(addiereJahre('2028-02-29', 4)).toBe('2032-02-29')
  })

  it('zählt Kalendertage', () => {
    expect(tageZwischen('2025-11-11', '2026-11-11')).toBe(365)
    expect(tageZwischen('2027-11-11', '2028-11-11')).toBe(366)
    expect(tageZwischen('2026-11-11', '2026-11-10')).toBe(-1)
  })

  it('bildet „heute“ aus dem lokalen Datum, nicht aus UTC', () => {
    // 23:30 Uhr Ortszeit am 31.12. bleibt der 31.12., auch wenn es in UTC schon der 1.1. wäre
    expect(heuteIso(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31')
    expect(heuteIso(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01')
  })
})

describe('Fristen (9.2)', () => {
  it('kennt die gesetzlichen Mindestfristen', () => {
    const arten: Aufbewahrungsart[] = ['buecher', 'buchungsbeleg', 'geschaeftsbrief', 'sonstige', 'lieferschein', 'keine', 'unklar']
    expect(arten.map(mindestJahre)).toEqual([10, 8, 6, 6, null, null, null])
  })

  it('rechnet Ende der Aufbewahrung und frühestes Vernichtungsdatum', () => {
    expect(aufbewahrungBis(2026, 8)).toBe('2034-12-31')
    expect(vernichtungAb(2026, 8)).toBe('2035-01-01')
    expect(aufbewahrungBis(2026, 10)).toBe('2036-12-31')
  })

  it('rechnet Löschfristen nach Beginn und Einheit', () => {
    expect(fristEnde('2026-03-15', neueFrist({ anzahl: 6, einheit: 'monate', beginn: 'entstehung' }))).toBe('2026-09-15')
    expect(fristEnde('2026-08-31', neueFrist({ anzahl: 6, einheit: 'monate', beginn: 'entstehung' }))).toBe('2027-02-28')
    expect(fristEnde('2028-02-29', neueFrist({ anzahl: 1, einheit: 'jahre', beginn: 'entstehung' }))).toBe('2029-02-28')
    expect(fristEnde('2026-03-15', neueFrist({ anzahl: 3, einheit: 'jahre', beginn: 'jahresende' }))).toBe('2029-12-31')
    expect(fristEnde('2026-03-15', neueFrist({ anzahl: 6, einheit: 'monate', beginn: 'jahresende' }))).toBe('2027-06-30')
    expect(fristEnde('2026-12-31', neueFrist({ anzahl: 30, einheit: 'tage', beginn: 'entstehung' }))).toBe('2027-01-30')
    expect(fristEnde('2026-03-15', neueFrist({ anzahl: 2, einheit: 'jahre', beginn: 'ereignis', ereignis: 'Ende der Kundenbeziehung' }))).toBeNull()
  })

  it('beschreibt Fristen in Worten', () => {
    expect(fristText(neueFrist({ anzahl: 8, einheit: 'jahre', beginn: 'jahresende' }))).toBe('8 Jahre ab Ende des Kalenderjahres der Entstehung')
    expect(fristText(neueFrist({ anzahl: 1, einheit: 'jahre', beginn: 'entstehung' }))).toBe('1 Jahr ab Entstehung bzw. Eingang')
    expect(fristText(neueFrist({ anzahl: 30, einheit: 'tage', beginn: 'entstehung' }))).toBe('30 Tage ab Entstehung bzw. Eingang')
    expect(fristText(neueFrist({ anzahl: 1, einheit: 'monate', beginn: 'ereignis', ereignis: 'Ende der Kundenbeziehung' }))).toBe('1 Monat nach „Ende der Kundenbeziehung“')
  })

  it('beschreibt die Aufbewahrung je Einordnung', () => {
    expect(aufbewahrungText(objekt({ aufbewahrungsart: 'buecher' }))).toBe('10 Jahre ab Ende des Kalenderjahres der letzten Eintragung bzw. Aufstellung')
    expect(aufbewahrungText(objekt({ aufbewahrungsart: 'buchungsbeleg' }))).toBe('8 Jahre ab Ende des Kalenderjahres der Entstehung')
    expect(aufbewahrungText(objekt({ aufbewahrungsart: 'buchungsbeleg', aufbewahrungJahre: 10 }))).toBe('10 Jahre ab Ende des Kalenderjahres der Entstehung')
    expect(aufbewahrungText(objekt({ aufbewahrungsart: 'lieferschein', richtung: 'ausgang' }))).toBe('bis zum Versand der Rechnung')
    expect(aufbewahrungText(objekt({ aufbewahrungsart: 'lieferschein', richtung: 'eingang' }))).toBe('bis zum Erhalt der Rechnung')
    expect(aufbewahrungText(objekt({ aufbewahrungsart: 'lieferschein' }))).toBe('bis zum Erhalt bzw. Versand der Rechnung')
    expect(aufbewahrungText(objekt({ aufbewahrungsart: 'lieferschein', aufbewahrungJahre: 1 }))).toBe('1 Jahr ab Ende des Kalenderjahres der Entstehung')
    expect(aufbewahrungText(objekt({ aufbewahrungsart: 'keine' }))).toBe('–')
    expect(aufbewahrungText(objekt({ aufbewahrungsart: 'unklar' }))).toBe('offen')
  })

  it('rechnet ein Beispiel für das Bezugsjahr', () => {
    expect(beispielBis(objekt({ aufbewahrungsart: 'buchungsbeleg' }), 2026)).toBe('bis 31.12.2034')
    expect(beispielBis(objekt({ aufbewahrungsart: 'sonstige' }), 2026)).toBe('bis 31.12.2032')
    expect(beispielBis(objekt({ aufbewahrungsart: 'lieferschein' }), 2026)).toBe('–')
    expect(wirksameJahre(objekt({ aufbewahrungsart: 'geschaeftsbrief', aufbewahrungJahre: 10 }))).toBe(10)
  })

  it('nennt im Verzeichnis die Löschfrist', () => {
    expect(loeschText(objekt({ aufbewahrungsart: 'buchungsbeleg' }))).toBe('nach Ablauf der Aufbewahrung: 8 Jahre ab Ende des Kalenderjahres der Entstehung (§ 147 AO)')
    expect(loeschText(objekt({ aufbewahrungsart: 'lieferschein', richtung: 'ausgang' }))).toBe('bis zum Versand der Rechnung (§ 147 Abs. 3 AO)')
    expect(loeschText(objekt({ aufbewahrungsart: 'keine', loeschfrist: neueFrist() }))).toBe('30 Tage ab Entstehung bzw. Eingang')
    expect(loeschText(objekt({ aufbewahrungsart: 'keine' }))).toBe('offen')
    expect(loeschText(objekt({ aufbewahrungsart: 'unklar', loeschfrist: neueFrist() }))).toBe('offen')
  })

  it('erkennt längere Aufbewahrung, beim Lieferschein jede gewählte Frist', () => {
    expect(laengerAlsVorgeschrieben(objekt({ aufbewahrungsart: 'buchungsbeleg', aufbewahrungJahre: 10 }))).toBe(true)
    expect(laengerAlsVorgeschrieben(objekt({ aufbewahrungsart: 'buchungsbeleg', aufbewahrungJahre: 8 }))).toBe(false)
    expect(laengerAlsVorgeschrieben(objekt({ aufbewahrungsart: 'buchungsbeleg' }))).toBe(false)
    expect(laengerAlsVorgeschrieben(objekt({ aufbewahrungsart: 'lieferschein', aufbewahrungJahre: 0 }))).toBe(true)
    expect(laengerAlsVorgeschrieben(objekt({ aufbewahrungsart: 'keine', aufbewahrungJahre: 3 }))).toBe(false)
  })
})

describe('Fristen der Dokumentation (6.2, Versionen)', () => {
  it('rechnet gültig bis und aufbewahren bis', () => {
    const versionen = [{ gueltigAb: '2026-11-11' }, { gueltigAb: '2027-04-01' }]
    expect(gueltigBisIn(versionen, 0)).toBe('2027-03-31')
    expect(gueltigBisIn(versionen, 1)).toBeNull()
    expect(aufbewahrenBis('2027-03-31')).toBe('2037-12-31')
    expect(aufbewahrenBis(null)).toBeNull()
    expect(aufbewahrenBisText('2027-03-31')).toBe('mindestens bis 31.12.2037')
    expect(aufbewahrenBisText(null)).toBe('10 Jahre nach Ende der Gültigkeit')
    // Gültig ab 1. Januar: gültig bis am 31.12. des Vorjahres
    expect(gueltigBisIn([{ gueltigAb: '2026-11-11' }, { gueltigAb: '2028-01-01' }], 0)).toBe('2027-12-31')
  })
})

describe('Datum: Grenzfälle aus der Durchsicht', () => {
  it('rechnet auch Jahre unter 100 richtig (ohne Sonderbehandlung durch Date)', () => {
    expect(addiereTage('0060-01-01', -1)).toBe('0059-12-31')
    expect(tageZwischen('0099-12-31', '0100-01-01')).toBe(1)
    expect(addiereTage('0004-02-28', 1)).toBe('0004-02-29')
  })

  it('stimmt über 200 Jahre Tag für Tag mit der Zeitrechnung von Date überein', () => {
    const start = Date.UTC(1900, 0, 1)
    for (let i = 0; i < 73_000; i += 17) {
      const d = new Date(start + i * 86_400_000)
      const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      expect(tageZwischen('1900-01-01', iso)).toBe(i)
      expect(addiereTage('1900-01-01', i)).toBe(iso)
    }
  })

  it('lässt in Eingaben nur plausible Jahre zu', () => {
    expect(istPlausiblesDatum('2026-11-11')).toBe(true)
    expect(istPlausiblesDatum('2199-12-31')).toBe(true)
    expect(istPlausiblesDatum('2200-01-01')).toBe(false)
    expect(istPlausiblesDatum('0026-11-11')).toBe(false)
    expect(istPlausiblesDatum('20266-06-30')).toBe(false)
    expect(istPlausiblesDatum('2026-02-30')).toBe(false)
  })

  it('wertet eine früher gewählte Frist nach einem Wechsel auf „keine“ oder „unklar“ nicht mehr', () => {
    const keine = objekt({ aufbewahrungsart: 'keine', aufbewahrungJahre: 10, loeschfrist: neueFrist() })
    expect(wirksameJahre(keine)).toBeNull()
    expect(aufbewahrungText(keine)).toBe('–')
    expect(beispielBis(keine, 2026)).toBe('–')
    expect(aufbewahrungText(objekt({ aufbewahrungsart: 'unklar', aufbewahrungJahre: 10 }))).toBe('offen')
  })
})
