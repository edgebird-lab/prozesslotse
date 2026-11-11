import { describe, expect, it } from 'vitest'
import { beispielLieferdienst } from '../modell/beispiel'
import { complianceLieferdienst } from './beispiel'
import { pruefeCompliance } from './regeln'
import { UNVERAENDERBARKEIT } from './standard'

// Fachbegriffe und Abkürzungen in Befunden und Katalogen werden für Laien erklärt
const HEUTE = '2026-11-11'

describe('Fachbegriffe in Befunden und Katalogen', () => {
  it('„Revisionssicheres Archiv“ hat eine Erklärung', () => {
    expect(UNVERAENDERBARKEIT.find((e) => e.wert === 'revisionssicher')?.beschreibung).toBe('Archiv, das Ändern und Löschen technisch verhindert')
  })

  it('S2 heißt „Vertrag zur Auftragsverarbeitung fehlt“ statt „AV-Vertrag“', () => {
    const s2 = pruefeCompliance(beispielLieferdienst(), complianceLieferdienst(), HEUTE).find((b) => b.regel === 'S2')
    expect(s2?.titel).toBe('Vertrag zur Auftragsverarbeitung fehlt')
  })

  it('B4 schreibt „DMS“ aus', () => {
    const p = beispielLieferdienst()
    p.medien.push({ id: 'med_mail', name: 'Postfach Rechnungen', art: 'email' })
    const c = complianceLieferdienst()
    c.ablageorte.push({ id: 'dsp_mail', name: 'Ordner Rechnungen', mediumId: 'med_mail' })
    c.datenobjekte.dob_rechnung.ablageSpeicherIds = ['dsp_mail']
    const b4 = pruefeCompliance(p, c, HEUTE).find((b) => b.regel === 'B4')
    expect(b4?.text).toContain('Archiv oder Dokumentenmanagementsystem (DMS) ergänzen.')
  })
})
