import { describe, expect, it } from 'vitest'
import { beispielLieferdienst } from '../modell/beispiel'
import { alsJson, leseProjekt, leseProjektText } from '../modell/speicher'
import { beispielMitCompliance, complianceLieferdienst } from './beispiel'
import { kapitel } from './dokument'
import { pruefeCompliance } from './regeln'
import type { Abschnitt, ComplianceProjekt, Dokument } from './typen'
import { entwurfsKontext, erzeugeDokumente } from './versionen'

// Durchsicht 11.11.2026: Kapitel 5 und 6 zum ersetzenden Scannen (recht-2, recht-9)

const HEUTE = '2026-11-11'

function vd(c: ComplianceProjekt): Dokument {
  return erzeugeDokumente(beispielLieferdienst(), c, entwurfsKontext(c, HEUTE)).verfahrensdoku
}

function texte(d: Dokument, schluessel: string): string[] {
  return (kapitel(d).get(schluessel) ?? []).flatMap((a: Abschnitt) => (a.art === 'absatz' ? [a.text] : a.art === 'liste' ? a.punkte : []))
}

/** Lieferschein (Papier) als Scan; `vernichtet`: Antwort auf „Wird das Papier nach dem Scannen vernichtet?“ */
function scan(vernichtet: boolean | null, aendern: (c: ComplianceProjekt) => void = () => {}): ComplianceProjekt {
  const c = complianceLieferdienst()
  Object.assign(c.datenobjekte.dob_lieferschein, { ablageform: 'scan', originalVernichtet: vernichtet })
  aendern(c)
  return c
}

const b8 = (c: ComplianceProjekt, id = 'dob_lieferschein') => pruefeCompliance(beispielLieferdienst(), c, HEUTE).find((b) => b.schluessel === `compliance:B8:${id}`)

describe('Kapitel 5, wenn offen ist, ob das Papier vernichtet wird (recht-2)', () => {
  it('sagt nicht „Entfällt“, sondern nennt die offene Frage', () => {
    const k5 = texte(vd(scan(null)), '5')
    expect(k5).toEqual(['Ob die Papierbelege von „Lieferschein“ nach dem Scannen vernichtet werden, ist offen.'])
  })

  it('meldet die offene Frage als Hinweis bei der Unterlage', () => {
    expect(b8(scan(null))).toMatchObject({ teilschritt: 'belege', schwere: 'hinweis', titel: 'Vernichtung nach dem Scannen offen', ziel: { art: 'datenobjekt', id: 'dob_lieferschein' } })
  })

  it('nennt im Mischfall beides', () => {
    const c = scan(true, (x) => Object.assign(x.datenobjekte.dob_bestellnotiz, { ablageform: 'scan', originalVernichtet: null }))
    const k5 = texte(vd(c), '5')
    expect(k5[0]).toMatch(/^Für „Lieferschein“ gilt das ersetzende Scannen\./)
    expect(k5[1]).toBe('Ob die Papierbelege von „Bestellnotiz“ nach dem Scannen vernichtet werden, ist offen.')
    expect(b8(c, 'dob_bestellnotiz')?.schwere).toBe('hinweis')
  })

  it('„Entfällt“ nur, wenn nichts gescannt und vernichtet wird', () => {
    expect(texte(vd(scan(false)), '5')).toEqual(['Entfällt: Papierunterlagen werden nicht gescannt und anschließend vernichtet.'])
    expect(b8(scan(false))).toBeUndefined()
  })
})

describe('Eigene Verfahrensdokumentation zum Scannen wird erfragt, nicht behauptet (recht-9)', () => {
  it('ohne Antwort: Kapitel 5 nennt sie als nötig und offen, Kapitel 6 führt sie nicht, B8 warnt', () => {
    const d = vd(scan(true))
    expect(texte(d, '5')).toEqual(['Für „Lieferschein“ gilt das ersetzende Scannen. Dafür ist eine eigene Verfahrensdokumentation nötig (GoBD Rz. 136); offen.'])
    expect(texte(d, '6').join(' ')).not.toContain('Scannen')
    expect(b8(scan(true))).toMatchObject({ schwere: 'warnung', titel: 'Verfahrensdokumentation zum Scannen ungeklärt' })
  })

  it('„Nein“: ebenso, B8 als Warnung „fehlt“', () => {
    const c = scan(true, (x) => (x.ersetzendesScannen = { verfahrensdoku: false, stand: null }))
    expect(texte(vd(c), '5')[0]).toContain('Dafür ist eine eigene Verfahrensdokumentation nötig (GoBD Rz. 136); offen.')
    expect(b8(c)).toMatchObject({ schwere: 'warnung', titel: 'Verfahrensdokumentation zum Scannen fehlt' })
  })

  it('„Ja“ mit Stand: Verweis in Kapitel 5, Eintrag in Kapitel 6, B8 nur als Hinweis', () => {
    const c = scan(true, (x) => (x.ersetzendesScannen = { verfahrensdoku: true, stand: '2026-03-01' }))
    const d = vd(c)
    expect(texte(d, '5')).toEqual(['Für „Lieferschein“ gilt das ersetzende Scannen. Es ist in einer eigenen Verfahrensdokumentation beschrieben (Kapitel 6).'])
    expect(texte(d, '6')).toContain('Verfahrensdokumentation zum ersetzenden Scannen, Stand 01.03.2026')
    expect(b8(c)?.schwere).toBe('hinweis')
  })

  it('ohne Unterlage, die gescannt und vernichtet wird, zählt die Antwort nicht', () => {
    const c = complianceLieferdienst()
    c.ersetzendesScannen = { verfahrensdoku: true, stand: '2026-03-01' }
    expect(texte(vd(c), '6').join(' ')).not.toContain('Scannen')
  })
})

describe('Neue Angabe zum Scannen beim Laden', () => {
  it('ältere Dateien ohne die Angabe laden mit „Weiß nicht“', () => {
    const d = JSON.parse(alsJson(beispielMitCompliance()))
    delete d.compliance.ersetzendesScannen
    expect(leseProjekt(d).compliance?.ersetzendesScannen).toEqual({ verfahrensdoku: null, stand: null })
  })

  it('liest die Angabe unverändert wieder ein und prüft sie', () => {
    const projekt = beispielMitCompliance()
    projekt.compliance!.ersetzendesScannen = { verfahrensdoku: true, stand: '2026-03-01' }
    expect(leseProjektText(alsJson(projekt))).toEqual(projekt)
    const d = JSON.parse(alsJson(projekt))
    d.compliance.ersetzendesScannen.stand = '2026-02-30'
    expect(() => leseProjekt(d)).toThrow('‚ersetzendesScannen.stand‘ ist kein gültiges Datum')
    d.compliance.ersetzendesScannen = { verfahrensdoku: 'vielleicht', stand: null }
    expect(() => leseProjekt(d)).toThrow('‚ersetzendesScannen.verfahrensdoku‘ ist weder ja, nein noch offen')
  })
})
