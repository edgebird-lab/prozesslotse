import { describe, expect, it } from 'vitest'
import { beispielLieferdienst } from '../modell/beispiel'
import { complianceLieferdienst } from './beispiel'
import { kapitel } from './dokument'
import type { Abschnitt, ComplianceProjekt, Dokument } from './typen'
import { entwurfsKontext, erzeugeDokumente } from './versionen'

// Dokumenttexte zu den Funden recht-1 und recht-10

const HEUTE = '2026-11-11'

function verfahrensdoku(c: ComplianceProjekt): Dokument {
  return erzeugeDokumente(beispielLieferdienst(), c, entwurfsKontext(c, HEUTE)).verfahrensdoku
}

function texteIn(d: Dokument, schluessel: string): string[] {
  return (kapitel(d).get(schluessel) ?? []).flatMap((a: Abschnitt) => (a.art === 'absatz' || a.art === 'hinweis' ? [a.text] : a.art === 'liste' ? a.punkte : a.art === 'tabelle' ? a.zeilen.flat() : []))
}

describe('recht-10: Kapitel 5 nimmt Abschlüsse vom ersetzenden Scannen aus', () => {
  it('nennt die Ausnahme, sobald Papier nach dem Scannen vernichtet wird', () => {
    const c = complianceLieferdienst()
    Object.assign(c.datenobjekte.dob_lieferschein, { ablageform: 'scan', originalVernichtet: true })
    expect(texteIn(verfahrensdoku(c), '5')).toContain('Ausgenommen sind Jahresabschlüsse und Eröffnungsbilanz; sie werden im Original aufbewahrt (§ 147 Abs. 2 AO, § 257 Abs. 3 HGB).')
  })

  it('ohne Scannen bleibt es bei „Entfällt“', () => {
    expect(texteIn(verfahrensdoku(complianceLieferdienst()), '5').join(' ')).not.toContain('Jahresabschlüsse')
  })
})

describe('recht-1: Kapitel 3.1 nennt die Bewilligung nach § 146 Abs. 2b AO', () => {
  const imDrittland = (bewilligungVom: string | null) => {
    const c = complianceLieferdienst()
    Object.assign(c.systeme.med_erp, { standort: 'drittland', drittland: 'USA', garantie: 'standardvertragsklauseln', bewilligungVom })
    return c
  }

  it('mit Datum der Bewilligung oder „offen“', () => {
    expect(texteIn(verfahrensdoku(imDrittland(null)), '3.1')).toContain('„Warenwirtschaft“ bewahrt „Bestellung“ und „Ausgangsrechnung“ im Drittland (USA) auf. Bewilligung des Finanzamts nach § 146 Abs. 2b AO: offen.')
    expect(texteIn(verfahrensdoku(imDrittland('2026-02-01')), '3.1')).toContain(
      '„Warenwirtschaft“ bewahrt „Bestellung“ und „Ausgangsrechnung“ im Drittland (USA) auf. Bewilligung des Finanzamts nach § 146 Abs. 2b AO vom 01.02.2026.',
    )
  })

  it('nicht bei Systemen in Deutschland oder der EU', () => {
    expect(texteIn(verfahrensdoku(complianceLieferdienst()), '3.1').join(' ')).not.toContain('Bewilligung')
  })
})
