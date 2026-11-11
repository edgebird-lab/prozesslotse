import { describe, expect, it } from 'vitest'
import { neueAufgabe, neuerProzess } from '../modell/bausteine'
import { beispielLieferdienst } from '../modell/beispiel'
import { fuegeEin } from '../modell/operationen'
import type { Prozess } from '../modell/typen'
import { kontext } from './ableitung'
import { complianceLieferdienst } from './beispiel'
import { hatAngaben } from './fortschritt'
import { leererKontakt, neueCompliance, neueFrist, neueWeitereKontrolle, TEILSCHRITTE } from './standard'
import type { ComplianceProjekt } from './typen'
import { freigeben } from './versionen'

// bedienung-1: Ein Häkchen gibt es erst, wenn im Teilschritt etwas eingetragen ist

const HEUTE = '2026-11-11'

/** Ablauf mit einer Aufgabe im System „Rechnungsprogramm“ */
function einSchritt(): Prozess {
  const p = neuerProzess({ medien: [{ id: 'med_rechnung', name: 'Rechnungsprogramm', art: 'fachanwendung' }] })
  return fuegeEin(p, 'haupt', 0, neueAufgabe({ id: 'auf_a', name: 'Rechnung schreiben', art: 'freigabe', mediumId: 'med_rechnung' }))
}

function mitAngaben(p: Prozess, c: ComplianceProjekt): string[] {
  const k = kontext(p, c)
  return TEILSCHRITTE.filter((t) => hatAngaben(k, t.id)).map((t) => t.id)
}

function nur(aendern: (c: ComplianceProjekt) => void): string[] {
  const c = neueCompliance()
  aendern(c)
  return mitAngaben(einSchritt(), c)
}

describe('Angaben je Teilschritt (bedienung-1)', () => {
  it('im neuen Projekt ist nirgends etwas eingetragen', () => {
    expect(mitAngaben(einSchritt(), neueCompliance())).toEqual([])
    expect(mitAngaben(neuerProzess(), neueCompliance())).toEqual([])
  })

  it('im Beispiel überall außer bei den Dokumenten, solange es keine Freigabe gibt', async () => {
    const p = beispielLieferdienst()
    const c = complianceLieferdienst()
    expect(mitAngaben(p, c)).toEqual(['unternehmen', 'belege', 'systeme', 'fristen', 'kontrollen', 'tom', 'luecken'])
    const v = await freigeben(p, c, { bezeichnung: '1.0', gueltigAb: HEUTE, freigegebenVon: 'Erika Mustermann', aenderung: 'Erstfassung' }, HEUTE)
    expect(mitAngaben(p, { ...c, versionen: [v] })).toContain('dokumente')
  })

  it('zählt je Teilschritt nur, was er abfragt; Leerzeichen zählen nicht', () => {
    expect(nur((c) => (c.unternehmen.name = 'Beispiel GmbH'))).toEqual(['unternehmen', 'luecken'])
    expect(nur((c) => (c.unternehmen.name = '  '))).toEqual([])
    expect(nur((c) => (c.unternehmen.datenschutzbeauftragter = { ...leererKontakt(), extern: false }))).toEqual(['unternehmen', 'luecken'])
    expect(nur((c) => (c.verarbeitung.laufendeNummer = '1'))).toEqual([])
    expect(nur((c) => (c.verarbeitung.zwecke = ['Rechnungen schreiben']))).toEqual(['belege', 'luecken'])
    expect(nur((c) => (c.unterlagen = [{ id: 'unt_rechnung', name: 'Rechnung' }]))).toEqual(['belege', 'luecken'])
    expect(nur((c) => (c.systeme.med_rechnung = { ...complianceLieferdienst().systeme.med_excel }))).toEqual(['systeme', 'luecken'])
    // Angaben zu einem System, das im Ablauf nicht mehr vorkommt, zählen nicht
    expect(nur((c) => (c.systeme.med_alt = { ...complianceLieferdienst().systeme.med_excel }))).toEqual([])
    expect(nur((c) => (c.loeschung.turnus = 'jaehrlich'))).toEqual(['fristen', 'luecken'])
    expect(nur((c) => (c.loeschung.freigabe = 'Inhaberin'))).toEqual(['fristen', 'luecken'])
    expect(
      nur((c) => {
        c.unterlagen = [{ id: 'unt_notiz', name: 'Notiz' }]
        c.datenobjekte.unt_notiz = { ...complianceLieferdienst().datenobjekte.dob_tourenliste, loeschfrist: neueFrist() }
      }),
    ).toEqual(['belege', 'fristen', 'luecken'])
    expect(nur((c) => (c.kontrollen.auf_a = { art: 'vier_augen', ziel: '', nachweis: 'unklar' }))).toEqual(['kontrollen', 'luecken'])
    expect(nur((c) => c.weitereKontrollen.push(neueWeitereKontrolle({ name: 'Stichprobe' })))).toEqual(['kontrollen', 'luecken'])
    expect(nur((c) => (c.einweisung.turnus = 'einmalig'))).toEqual(['kontrollen', 'luecken'])
    expect(nur((c) => (c.toms.verschluesselung.massnahmen = ['TLS']))).toEqual(['tom', 'luecken'])
    expect(nur((c) => (c.toms.pseudonymisierung.nichtZutreffend = 'keine Auswertungen'))).toEqual(['tom', 'luecken'])
    expect(nur((c) => (c.toms.verschluesselung.massnahmen = [' ']))).toEqual([])
  })
})
