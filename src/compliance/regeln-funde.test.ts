import { describe, expect, it } from 'vitest'
import { neueAufgabe } from '../modell/bausteine'
import { beispielLieferdienst } from '../modell/beispiel'
import { aendereBlock, fuegeEin } from '../modell/operationen'
import type { Aufgabe, Prozess } from '../modell/typen'
import { complianceLieferdienst } from './beispiel'
import { offenePunkte, pruefeCompliance } from './regeln'
import { leererKontakt, neueFrist } from './standard'
import type { Aufbewahrungsart, ComplianceBefund, ComplianceProjekt, SystemAngaben } from './typen'

// Funde der zweiten Prüfung zur Lückenprüfung (Paket „Regeln“): je Fund ein Fall, der vor der Behebung scheiterte

const HEUTE = '2026-11-11'

function mitAngaben(aendern: (c: ComplianceProjekt) => void = () => {}): ComplianceProjekt {
  const c = complianceLieferdienst()
  aendern(c)
  return c
}

function mitAufgabe(id: string, werte: Partial<Aufgabe>, p: Prozess = beispielLieferdienst()): Prozess {
  return aendereBlock(p, id, (b) => (b.typ === 'aufgabe' ? { ...b, ...werte } : b))
}

function pruefe(c: ComplianceProjekt = mitAngaben(), p: Prozess = beispielLieferdienst(), heute = HEUTE): ComplianceBefund[] {
  return pruefeCompliance(p, c, heute)
}

function finde(befunde: ComplianceBefund[], schluessel: string): ComplianceBefund | undefined {
  return befunde.find((b) => b.schluessel === schluessel)
}

function regeln(befunde: ComplianceBefund[], regel: string): string[] {
  return befunde.filter((b) => b.regel === regel).map((b) => b.schluessel)
}

const empfaenger = (werte: object) => mitAngaben((c) => Object.assign(c.datenobjekte.dob_rechnung.externeEmpfaenger[0], werte))
const warenwirtschaft = (werte: Partial<SystemAngaben>) => mitAngaben((c) => Object.assign(c.systeme.med_erp, werte))

describe('logik-4: halb ausgefüllte Pflichtangaben', () => {
  it('U1: ein benannter Datenschutzbeauftragter ohne Namen oder Kontakt ist eine Lücke (Art. 30 Abs. 1 lit. a)', () => {
    const leer = mitAngaben((c) => {
      c.unternehmen.personenMitDaten = 25
      c.unternehmen.datenschutzbeauftragter = { ...leererKontakt(), extern: false }
    })
    const b = finde(pruefe(leer), 'compliance:U1')
    expect(b?.schwere).toBe('warnung')
    expect(b?.text).toBe('Für das Verzeichnis fehlen: Name und Kontaktdaten des Datenschutzbeauftragten.')
    expect(b?.ziel).toEqual({ art: 'unternehmen', id: 'datenschutzbeauftragter' })
    // U3 nicht: einer ist benannt
    expect(finde(pruefe(leer), 'compliance:U3')).toBeUndefined()

    const ohneName = mitAngaben((c) => (c.unternehmen.datenschutzbeauftragter = { ...leererKontakt(), email: 'dsb@beispiel.example', extern: true }))
    expect(finde(pruefe(ohneName), 'compliance:U1')?.text).toBe('Für das Verzeichnis fehlen: Name des Datenschutzbeauftragten.')
    const ohneKontakt = mitAngaben((c) => (c.unternehmen.datenschutzbeauftragter = { ...leererKontakt(), name: 'Datenschutz Beispiel', extern: true }))
    expect(finde(pruefe(ohneKontakt), 'compliance:U1')?.text).toBe('Für das Verzeichnis fehlen: Kontaktdaten des Datenschutzbeauftragten.')
    // fehlt auch beim Unternehmen etwas, springt „Beheben“ zuerst dorthin
    const beides = mitAngaben((c) => {
      c.unternehmen.telefon = ''
      c.unternehmen.email = ''
      c.unternehmen.datenschutzbeauftragter = { ...leererKontakt(), extern: false }
    })
    expect(finde(pruefe(beides), 'compliance:U1')?.text).toBe('Für das Verzeichnis fehlen: Telefon oder E-Mail, Name und Kontaktdaten des Datenschutzbeauftragten.')
    expect(finde(pruefe(beides), 'compliance:U1')?.ziel).toEqual({ art: 'unternehmen', id: 'telefon' })

    const vollstaendig = mitAngaben((c) => (c.unternehmen.datenschutzbeauftragter = { ...leererKontakt(), name: 'Datenschutz Beispiel', telefon: '0123 4567', extern: true }))
    expect(finde(pruefe(vollstaendig), 'compliance:U1')).toBeUndefined()
    const nurAnschrift = mitAngaben(
      (c) => (c.unternehmen.datenschutzbeauftragter = { ...leererKontakt(), name: 'Datenschutz Beispiel', anschrift: { strasse: 'Weg 2', plz: '12345', ort: 'Musterstadt' }, extern: true }),
    )
    expect(finde(pruefe(nurAnschrift), 'compliance:U1')).toBeUndefined()
  })

  it('D6: eine Löschfrist „nach einem Ereignis“ ohne Ereignis ist keine bestimmbare Frist', () => {
    const ohneEreignis = mitAngaben((c) => (c.datenobjekte.dob_tourenliste.loeschfrist = neueFrist({ beginn: 'ereignis', ereignis: ' ' })))
    const b = finde(pruefe(ohneEreignis), 'compliance:D6:dob_tourenliste')
    expect(b?.schwere).toBe('warnung')
    expect(b?.teilschritt).toBe('fristen')
    expect(b?.titel).toBe('Ereignis der Löschfrist fehlt')
    expect(b?.text).toBe('Die Löschfrist für „Tourenliste“ hängt an einem Ereignis, das nicht benannt ist. Nenne das Ereignis, z. B. „Ende der Kundenbeziehung“.')
    const mitEreignis = mitAngaben((c) => (c.datenobjekte.dob_tourenliste.loeschfrist = neueFrist({ beginn: 'ereignis', ereignis: 'Ende der Tour' })))
    expect(regeln(pruefe(mitEreignis), 'D6')).toEqual([])
  })

  it('D8: ein Empfänger im Drittland ohne Ländernamen ist eine Lücke (Art. 30 Abs. 1 lit. e)', () => {
    const b = finde(pruefe(empfaenger({ standort: 'drittland', drittland: ' ', garantie: 'standardvertragsklauseln', name: 'Beispiel Inc.' })), 'compliance:D8:emp_steuerberatung')
    expect(b?.schwere).toBe('warnung')
    expect(b?.text).toBe('Für „Steuerberatung“ ist das Drittland nicht angegeben.')
    expect(finde(pruefe(empfaenger({ standort: 'drittland', drittland: '', garantie: null, name: '' })), 'compliance:D8:emp_steuerberatung')?.text).toBe(
      'Für „Steuerberatung“ ist das Drittland nicht angegeben, keine Garantie für die Übermittlung eingetragen und der Empfänger nicht benannt.',
    )
  })

  it('S3: ein System im Drittland ohne Ländernamen ist eine Lücke', () => {
    const b = finde(pruefe(warenwirtschaft({ standort: 'drittland', drittland: '', garantie: 'standardvertragsklauseln' })), 'compliance:S3:med_erp')
    expect(b?.schwere).toBe('warnung')
    expect(b?.text).toBe('„Warenwirtschaft“ verarbeitet die Daten in einem Drittland, ohne dass das Land eingetragen ist.')
    expect(finde(pruefe(warenwirtschaft({ standort: 'drittland', drittland: '', garantie: null })), 'compliance:S3:med_erp')?.text).toBe(
      '„Warenwirtschaft“ verarbeitet die Daten in einem Drittland, ohne dass das Land und eine Garantie für die Übermittlung eingetragen sind, z. B. Standardvertragsklauseln.',
    )
  })

  it('S2: ein AV-Vertrag „ja“ ohne Datum ergibt einen Hinweis, der nicht als offener Punkt zählt', () => {
    const ohneDatum = pruefe(warenwirtschaft({ avVertrag: 'ja' }))
    const b = finde(ohneDatum, 'compliance:S2:med_erp')
    expect(b?.schwere).toBe('hinweis')
    expect(b?.titel).toBe('Datum des AV-Vertrags fehlt')
    expect(b?.text).toBe('Für „Warenwirtschaft“ ist ein Vertrag zur Auftragsverarbeitung ohne Datum eingetragen. Datum ergänzen; Kapitel 6 der Verfahrensdokumentation nennt den Vertrag mit Datum.')
    expect(offenePunkte(ohneDatum, 'systeme')).toBe(0)
    expect(regeln(pruefe(warenwirtschaft({ avVertrag: 'ja', avVertragVom: '2025-01-15' })), 'S2')).toEqual([])
    // ohne Auftragsverarbeitung fragt die App nicht nach dem Vertrag
    expect(regeln(pruefe(warenwirtschaft({ avVertrag: 'ja', auftragsverarbeitung: false })), 'S2')).toEqual([])
  })
})

describe('logik-9: Datum des Rücksicherungstests in der Zukunft', () => {
  it('S6 meldet ein Testdatum nach heute', () => {
    const getestet = (datum: string) => mitAngaben((c) => (c.systeme.med_excel.wiederherstellungGetestet = datum))
    const b = finde(pruefe(getestet('2062-06-30')), 'compliance:S6:med_excel')
    expect(b?.schwere).toBe('hinweis')
    expect(b?.text).toBe('Für „Excel-Tourenliste“ liegt der letzte Test der Rücksicherung in der Zukunft (30.06.2062). Datum prüfen.')
    expect(finde(pruefe(getestet('2026-11-12')), 'compliance:S6:med_excel')).toBeDefined()
    expect(regeln(pruefe(getestet(HEUTE)), 'S6')).toEqual([])
  })
})

describe('logik-12: B9 und die Reihenfolge der Kontrollen', () => {
  /** Eine Prüfung ganz am Anfang liest die Bestellung, die erst danach abgetippt wird. */
  function vorabPruefung(): [ComplianceProjekt, Prozess] {
    const p = fuegeEin(beispielLieferdienst(), 'haupt', 0, neueAufgabe({ id: 'auf_vorab', name: 'Bestellung vorab prüfen', art: 'pruefung', rolleId: 'rol_innendienst', mediumId: 'med_papier' }))
    const c = mitAngaben((x) => {
      x.datenobjekte.dob_bestellung.aufbewahrungsart = 'buchungsbeleg'
      x.zugriffe.push({ aufgabeId: 'auf_vorab', unterlageId: 'dob_bestellung', richtung: 'liest' })
    })
    return [c, p]
  }

  it('eine Prüfung vor dem Abtippen gilt nicht als Erfassungskontrolle', () => {
    expect(regeln(pruefe(...vorabPruefung()), 'B9')).toEqual(['compliance:B9:auf_erfassen'])
  })

  it('eine Prüfung nach dem Abtippen gilt weiter als Erfassungskontrolle', () => {
    const [c, p] = vorabPruefung()
    c.zugriffe.push({ aufgabeId: 'auf_kontrollieren', unterlageId: 'dob_bestellung', richtung: 'liest' })
    expect(regeln(pruefe(c, p), 'B9')).toEqual([])
  })
})

describe('logik-13 und logik-14: B6 bei elektronischen Unterlagen auf Papier', () => {
  /** Ausgehende Unterlage aus einer Tabellenkalkulation, nur im Papierordner */
  const nurPapier = (art: Aufbewahrungsart) => mitAngaben((c) => Object.assign(c.datenobjekte.dob_rechnung, { aufbewahrungsart: art, ablageSpeicherIds: ['dsp_ordner'] }))
  const ausTabelle = () => mitAufgabe('auf_rechnung', { mediumId: 'med_excel' })

  it('die Ausnahme für auf Papier versandte Briefe gilt nicht für Bücher und sonstige Unterlagen (GoBD Rz. 120)', () => {
    expect(finde(pruefe(nurPapier('sonstige'), ausTabelle()), 'compliance:B6:dob_rechnung')?.schwere).toBe('fehler')
    expect(finde(pruefe(nurPapier('buecher'), ausTabelle()), 'compliance:B6:dob_rechnung')?.schwere).toBe('fehler')
    expect(finde(pruefe(nurPapier('geschaeftsbrief'), ausTabelle()), 'compliance:B6:dob_rechnung')?.schwere).toBe('hinweis')
    expect(finde(pruefe(nurPapier('buchungsbeleg'), ausTabelle()), 'compliance:B6:dob_rechnung')?.schwere).toBe('hinweis')
    expect(finde(pruefe(nurPapier('lieferschein'), ausTabelle()), 'compliance:B6:dob_rechnung')?.schwere).toBe('hinweis')
  })

  it('der Text nennt den Auslöser und widerspricht keinem digitalen Ablageort', () => {
    // „Als Ausdruck“, abgelegt in der Warenwirtschaft
    const ausdruck = finde(pruefe(mitAngaben((c) => (c.datenobjekte.dob_rechnung.ablageform = 'ausdruck')), ausTabelle()), 'compliance:B6:dob_rechnung')
    expect(ausdruck?.titel).toBe('Elektronische Unterlage auf Papier aufbewahrt')
    expect(ausdruck?.text).toBe('„Ausgangsrechnung“ wird als Ausdruck aufbewahrt. Nur zulässig, wenn „Ausgangsrechnung“ auf Papier versandt und die Datei nicht aufbewahrt wird.')
    expect(ausdruck?.titel + ' ' + ausdruck?.text).not.toContain('nur auf Papier')
    // nur Papierablagen
    const papier = finde(pruefe(nurPapier('buchungsbeleg'), ausTabelle()), 'compliance:B6:dob_rechnung')
    expect(papier?.text).toBe('„Ausgangsrechnung“ liegt nur in Papierablagen. Nur zulässig, wenn „Ausgangsrechnung“ auf Papier versandt und die Datei nicht aufbewahrt wird.')
    expect(finde(pruefe(nurPapier('sonstige'), ausTabelle()), 'compliance:B6:dob_rechnung')?.titel).toBe('Elektronische Unterlage auf Papier aufbewahrt')
  })
})

describe('logik-21: Maßnahmen nur aus Leerzeichen', () => {
  it('T1 meldet den Bereich wie Verzeichnis C („Keine Maßnahme eingetragen.“)', () => {
    expect(finde(pruefe(mitAngaben((c) => (c.toms.verschluesselung.massnahmen = ['  ']))), 'compliance:T1:verschluesselung')?.schwere).toBe('warnung')
    expect(regeln(pruefe(mitAngaben((c) => (c.toms.verschluesselung.massnahmen = ['  ', 'TLS']))), 'T1')).toEqual(['compliance:T1:ueberpruefung'])
  })
})

describe('recht-1: aufbewahrungspflichtige Unterlagen außerhalb der EU (§ 146 Abs. 2b AO)', () => {
  const imDrittland = (werte: Partial<SystemAngaben> = {}) =>
    warenwirtschaft({ standort: 'drittland', drittland: 'USA', garantie: 'standardvertragsklauseln', avVertrag: 'ja', avVertragVom: '2025-01-15', ...werte })

  it('S7 warnt, solange keine Bewilligung des Finanzamts eingetragen ist', () => {
    const befunde = pruefe(imDrittland())
    const b = finde(befunde, 'compliance:S7:med_erp')
    expect(b?.schwere).toBe('warnung')
    expect(b?.teilschritt).toBe('systeme')
    expect(b?.titel).toBe('Aufbewahrung im Drittland ohne Bewilligung')
    expect(b?.text).toBe(
      '„Warenwirtschaft“ bewahrt „Bestellung“ und „Ausgangsrechnung“ im Drittland (USA) auf. Elektronische Bücher, Aufzeichnungen und Rechnungen dürfen außerhalb der EU nur mit Bewilligung des Finanzamts aufbewahrt werden. Mit der Steuerberatung klären und das Datum der Bewilligung eintragen.',
    )
    expect(b?.quelle).toBe('§ 146 Abs. 2, 2b AO; § 14b Abs. 5 UStG')
    expect(b?.ziel).toEqual({ art: 'system', id: 'med_erp' })
    // Datenschutz ist sauber gelöst: S7 ist die einzige Meldung zum System
    expect(befunde.filter((x) => x.schluessel.endsWith(':med_erp') && x.schwere !== 'hinweis').map((x) => x.regel)).toEqual(['S7'])
    expect(regeln(pruefe(imDrittland({ bewilligungVom: '2026-02-01' })), 'S7')).toEqual([])
  })

  it('S7 gilt auch ohne Personenbezug und ohne Ländernamen', () => {
    const ohnePersonen = imDrittland({ drittland: '' })
    for (const d of Object.values(ohnePersonen.datenobjekte)) d.personenbezogen = false
    expect(finde(pruefe(ohnePersonen), 'compliance:S7:med_erp')?.text).toContain('„Warenwirtschaft“ bewahrt „Bestellung“ und „Ausgangsrechnung“ in einem Drittland auf.')
  })

  it('S7 fragt bei unbekanntem Standort nach, als Hinweis', () => {
    const b = finde(pruefe(warenwirtschaft({ standort: 'unbekannt' })), 'compliance:S7:med_erp')
    expect(b?.schwere).toBe('hinweis')
    expect(b?.titel).toBe('Ort der Aufbewahrung unklar')
    expect(b?.text).toBe('„Warenwirtschaft“ bewahrt „Bestellung“ und „Ausgangsrechnung“ auf, aber der Ort der Verarbeitung ist nicht bekannt. Liegen die Daten außerhalb der EU, braucht es eine Bewilligung des Finanzamts.')
  })

  it('kein S7 in der EU, ohne aufbewahrungspflichtige Ablage oder auf eigenen Geräten', () => {
    expect(regeln(pruefe(), 'S7')).toEqual([])
    expect(regeln(pruefe(warenwirtschaft({ standort: 'deutschland' })), 'S7')).toEqual([])
    const ohneAblage = imDrittland()
    for (const d of Object.values(ohneAblage.datenobjekte)) d.ablageSpeicherIds = []
    expect(regeln(pruefe(ohneAblage), 'S7')).toEqual([])
    // ausgeblendeter alter Standort zählt nicht
    expect(regeln(pruefe(imDrittland({ betrieb: 'lokal' })), 'S7')).toEqual([])
  })
})

describe('recht-10: Jahresabschluss und Eröffnungsbilanz im Original', () => {
  const gescannt = (art: Aufbewahrungsart) => mitAngaben((c) => Object.assign(c.datenobjekte.dob_lieferschein, { aufbewahrungsart: art, ablageform: 'scan', originalVernichtet: true }))

  it('B8 nennt die Ausnahme bei Büchern und Abschlüssen', () => {
    const b = finde(pruefe(gescannt('buecher')), 'compliance:B8:dob_lieferschein')
    expect(b?.text).toBe(
      '„Lieferschein“ wird gescannt und das Papier vernichtet. Dafür braucht es eine eigene Verfahrensbeschreibung, z. B. nach dem Muster von BStBK und DStV. Jahresabschlüsse und Eröffnungsbilanz sind im Original aufzubewahren.',
    )
    expect(b?.quelle).toBe('GoBD Rz. 136, 140; § 147 Abs. 2 AO; § 257 Abs. 3 HGB')
    const sonst = finde(pruefe(gescannt('lieferschein')), 'compliance:B8:dob_lieferschein')
    expect(sonst?.text).not.toContain('Jahresabschlüsse')
    expect(sonst?.quelle).toBe('GoBD Rz. 136')
  })
})

describe('recht-21: Länder ohne Artikel in D8 und S3', () => {
  it('D8 setzt das Land in Klammern hinter „Drittland“', () => {
    expect(finde(pruefe(empfaenger({ standort: 'drittland', drittland: 'Schweiz', garantie: null, name: 'Beispiel AG' })), 'compliance:D8:emp_steuerberatung')?.text).toBe(
      'Für „Steuerberatung“ ist keine Garantie für die Übermittlung in das Drittland (Schweiz) eingetragen.',
    )
    expect(finde(pruefe(empfaenger({ standort: 'drittland', drittland: 'USA', garantie: 'standardvertragsklauseln', name: '' })), 'compliance:D8:emp_steuerberatung')?.text).toBe(
      'Für „Steuerberatung“ ist der Empfänger im Drittland (USA) nicht benannt.',
    )
    expect(finde(pruefe(empfaenger({ standort: 'drittland', drittland: 'USA', garantie: 'keine', name: '' })), 'compliance:D8:emp_steuerberatung')?.text).toBe(
      'Für „Steuerberatung“ ist keine Garantie für die Übermittlung in das Drittland (USA) eingetragen und der Empfänger dort nicht benannt.',
    )
  })

  it('S3 ebenso', () => {
    expect(finde(pruefe(warenwirtschaft({ standort: 'drittland', drittland: 'USA', garantie: 'keine' })), 'compliance:S3:med_erp')?.text).toBe(
      '„Warenwirtschaft“ verarbeitet die Daten im Drittland (USA), ohne dass eine Garantie für die Übermittlung eingetragen ist, z. B. Standardvertragsklauseln.',
    )
  })
})

describe('bedienung-17: ein Wort für dasselbe', () => {
  it('D2 heißt wie sein Text „Datenkategorien“', () => {
    expect(finde(pruefe(mitAngaben((c) => (c.datenobjekte.dob_tourenliste.datenkategorien = []))), 'compliance:D2:dob_tourenliste')?.titel).toBe('Betroffene oder Datenkategorien fehlen')
  })
})
