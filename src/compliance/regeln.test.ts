import { describe, expect, it } from 'vitest'
import { neueAufgabe } from '../modell/bausteine'
import { beispielLieferdienst } from '../modell/beispiel'
import { aendereBlock, fuegeEin } from '../modell/operationen'
import type { Aufgabe, Prozess } from '../modell/typen'
import { complianceLieferdienst } from './beispiel'
import { offenePunkte, pruefeCompliance } from './regeln'
import { neueFrist, neueWeitereKontrolle } from './standard'
import type { ComplianceBefund, ComplianceProjekt } from './typen'
import { freigeben } from './versionen'

const HEUTE = '2026-11-11'

/** Abwandlung der Testdaten aus 9.1; `aendern` darf die frische Kopie direkt ändern. */
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

describe('Gesamttest Testdaten (9.5)', () => {
  it('liefert genau 8 Befunde in dieser Reihenfolge', () => {
    const befunde = pruefe()
    expect(befunde.map((b) => [b.schluessel, b.schwere])).toEqual([
      ['compliance:B1:dob_bestellnotiz', 'warnung'],
      ['compliance:D6:dob_tourenliste', 'warnung'],
      ['compliance:S2:med_erp', 'warnung'],
      ['compliance:T1:ueberpruefung', 'warnung'],
      // die GmbH ist Kaufmann: Lieferschein ggf. 6 Jahre als Handelsbrief (§ 257 HGB)
      ['compliance:B10:dob_lieferschein', 'hinweis'],
      ['compliance:S4:med_erp', 'hinweis'],
      ['compliance:K2:auf_kontrollieren', 'hinweis'],
      ['compliance:V1', 'hinweis'],
    ])
  })

  it('zählt offene Punkte je Teilschritt (Fehler und Warnungen)', () => {
    const befunde = pruefe()
    expect(offenePunkte(befunde, 'belege')).toBe(1)
    expect(offenePunkte(befunde, 'fristen')).toBe(1)
    expect(offenePunkte(befunde, 'systeme')).toBe(1)
    expect(offenePunkte(befunde, 'tom')).toBe(1)
    expect(offenePunkte(befunde, 'kontrollen')).toBe(0)
    expect(offenePunkte(befunde, 'unternehmen')).toBe(0)
    expect(offenePunkte(befunde, 'luecken')).toBe(4)
  })
})

describe('Unternehmen U1–U4', () => {
  it('U1 nennt fehlende Angaben zum Verantwortlichen', () => {
    const b = finde(pruefe(mitAngaben((c) => Object.assign(c.unternehmen, { name: '', telefon: '', email: '' }))), 'compliance:U1')
    expect(b?.schwere).toBe('warnung')
    expect(b?.text).toBe('Für das Verzeichnis fehlen: Name, Telefon oder E-Mail.')
    expect(finde(pruefe(mitAngaben((c) => (c.unternehmen.email = ''))), 'compliance:U1')).toBeUndefined()
    expect(finde(pruefe(), 'compliance:U1')).toBeUndefined()
  })

  it('U2 fragt nach der Geschäftsleitung', () => {
    expect(finde(pruefe(mitAngaben((c) => (c.unternehmen.geschaeftsleitung = ' '))), 'compliance:U2')?.schwere).toBe('hinweis')
    expect(finde(pruefe(), 'compliance:U2')).toBeUndefined()
  })

  it('U3 verlangt ab 20 Personen einen Datenschutzbeauftragten', () => {
    expect(finde(pruefe(mitAngaben((c) => (c.unternehmen.personenMitDaten = 19))), 'compliance:U3')).toBeUndefined()
    const b = finde(pruefe(mitAngaben((c) => (c.unternehmen.personenMitDaten = 20))), 'compliance:U3')
    expect(b?.schwere).toBe('warnung')
    expect(b?.text).toContain('20 Personen arbeiten ständig')
    const mitDsb = mitAngaben((c) => {
      c.unternehmen.personenMitDaten = 25
      c.unternehmen.datenschutzbeauftragter = { name: 'Datenschutz Beispiel', anschrift: { strasse: '', plz: '', ort: '' }, telefon: '', email: '', extern: true }
    })
    expect(finde(pruefe(mitDsb), 'compliance:U3')).toBeUndefined()
  })

  it('U4 fragt nach der Zahl der Personen', () => {
    expect(finde(pruefe(mitAngaben((c) => (c.unternehmen.personenMitDaten = null))), 'compliance:U4')?.schwere).toBe('hinweis')
    expect(finde(pruefe(), 'compliance:U4')).toBeUndefined()
  })
})

describe('Belege B1–B9', () => {
  it('B1 meldet Unterlagen ohne Einordnung', () => {
    expect(finde(pruefe(), 'compliance:B1:dob_bestellnotiz')?.schwere).toBe('warnung')
    expect(regeln(pruefe(mitAngaben((c) => (c.datenobjekte.dob_bestellnotiz.aufbewahrungsart = 'keine'))), 'B1')).toEqual([])
  })

  it('B2 meldet kürzere Fristen als vorgeschrieben als Fehler', () => {
    const b = finde(pruefe(mitAngaben((c) => (c.datenobjekte.dob_rechnung.aufbewahrungJahre = 6))), 'compliance:B2:dob_rechnung')
    expect(b?.schwere).toBe('fehler')
    expect(b?.text).toBe('„Ausgangsrechnung“ soll 6 Jahre aufbewahrt werden, vorgeschrieben sind 8 Jahre.')
    expect(regeln(pruefe(mitAngaben((c) => (c.datenobjekte.dob_rechnung.aufbewahrungJahre = 8))), 'B2')).toEqual([])
  })

  it('B3 meldet aufbewahrungspflichtige Unterlagen ohne Ablageort', () => {
    expect(finde(pruefe(mitAngaben((c) => (c.datenobjekte.dob_rechnung.ablageSpeicherIds = []))), 'compliance:B3:dob_rechnung')?.schwere).toBe('warnung')
    expect(regeln(pruefe(), 'B3')).toEqual([])
  })

  /** Ausgangsrechnung nur im Postfach */
  function imPostfach(revisionssicher = false): [ComplianceProjekt, Prozess] {
    const p = beispielLieferdienst()
    p.medien.push({ id: 'med_mail', name: 'Postfach Rechnungen', art: 'email' })
    const c = mitAngaben((x) => {
      x.ablageorte.push({ id: 'dsp_mail', name: 'Ordner Rechnungen', mediumId: 'med_mail' })
      x.datenobjekte.dob_rechnung.ablageSpeicherIds = ['dsp_mail']
      if (revisionssicher) x.systeme.med_mail = { ...x.systeme.med_erp, unveraenderbarkeit: 'revisionssicher' }
    })
    return [c, p]
  }

  it('B4 meldet ein Postfach als einziges Archiv, ohne zusätzlich B5', () => {
    const befunde = pruefe(...imPostfach())
    expect(finde(befunde, 'compliance:B4:dob_rechnung')?.text).toContain('„Ausgangsrechnung“ liegt nur im Postfach „Postfach Rechnungen“.')
    expect(regeln(befunde, 'B5')).toEqual([])
    const sicher = pruefe(...imPostfach(true))
    expect(regeln(sicher, 'B4')).toEqual([])
    expect(regeln(sicher, 'B5')).toEqual([])
  })

  it('B5 meldet elektronische Ablage ohne Schutz vor Änderung, aber nicht, wenn ein System protokolliert', () => {
    const befunde = pruefe(mitAngaben((c) => (c.systeme.med_erp.unveraenderbarkeit = 'keine')))
    expect(regeln(befunde, 'B5')).toEqual(['compliance:B5:dob_bestellung', 'compliance:B5:dob_rechnung'])
    expect(finde(befunde, 'compliance:B5:dob_rechnung')?.teilschritt).toBe('systeme')
    const zwei = mitAngaben((c) => {
      c.ablageorte.push({ id: 'dsp_excel', name: 'Ablage Excel', mediumId: 'med_excel' })
      c.datenobjekte.dob_rechnung.ablageSpeicherIds = ['dsp_warenwirtschaft', 'dsp_excel']
    })
    expect(regeln(pruefe(zwei), 'B5')).toEqual([])
    expect(regeln(pruefe(), 'B5')).toEqual([])
  })

  it('B6 meldet elektronische Belege, die nur ausgedruckt aufbewahrt werden', () => {
    const b = finde(pruefe(mitAngaben((c) => (c.datenobjekte.dob_bestellung.ablageform = 'ausdruck'))), 'compliance:B6:dob_bestellung')
    expect(b?.schwere).toBe('fehler')
    expect(regeln(pruefe(mitAngaben((c) => (c.datenobjekte.dob_lieferschein.ablageform = 'ausdruck'))), 'B6')).toEqual([])
    expect(regeln(pruefe(), 'B6')).toEqual([])
  })

  it('B6 ist nur ein Hinweis, wenn eine ausgehende Rechnung nicht aus einem Fakturierungssystem stammt', () => {
    const nurPapier = mitAngaben((c) => (c.datenobjekte.dob_rechnung.ablageSpeicherIds = ['dsp_ordner']))
    expect(finde(pruefe(nurPapier, mitAufgabe('auf_rechnung', { mediumId: 'med_excel' })), 'compliance:B6:dob_rechnung')?.schwere).toBe('hinweis')
    expect(finde(pruefe(nurPapier), 'compliance:B6:dob_rechnung')?.schwere).toBe('fehler')
  })

  it('B7 meldet umgewandelte Originale, als Fehler nur bei E-Rechnungen', () => {
    expect(finde(pruefe(mitAngaben((c) => (c.datenobjekte.dob_rechnung.ablageform = 'umgewandelt'))), 'compliance:B7:dob_rechnung')?.schwere).toBe('hinweis')
    const strukturiert = mitAngaben((c) => Object.assign(c.datenobjekte.dob_rechnung, { form: 'strukturiert', ablageform: 'umgewandelt' }))
    const b = finde(pruefe(strukturiert), 'compliance:B7:dob_rechnung')
    expect(b?.schwere).toBe('fehler')
    expect(b?.text).toContain('XML-Datei')
    expect(regeln(pruefe(), 'B7')).toEqual([])
  })

  it('B8 erinnert an die Dokumentation des ersetzenden Scannens', () => {
    const scan = (vernichtet: boolean) => mitAngaben((c) => Object.assign(c.datenobjekte.dob_lieferschein, { ablageform: 'scan', originalVernichtet: vernichtet }))
    expect(finde(pruefe(scan(true)), 'compliance:B8:dob_lieferschein')?.schwere).toBe('hinweis')
    expect(regeln(pruefe(scan(false)), 'B8')).toEqual([])
  })

  it('B9 meldet abgetippte Belege ohne Kontrolle', () => {
    const beleg = mitAngaben((c) => (c.datenobjekte.dob_bestellung.aufbewahrungsart = 'buchungsbeleg'))
    const b = finde(pruefe(beleg), 'compliance:B9:auf_erfassen')
    expect(b?.schwere).toBe('hinweis')
    expect(b?.blockId).toBe('auf_erfassen')
    expect(b?.text).toBe('In „Bestellung in Warenwirtschaft erfassen“ wird „Bestellung“ von Hand übertragen, und keine Kontrolle prüft das Ergebnis.')
    beleg.zugriffe.push({ aufgabeId: 'auf_kontrollieren', unterlageId: 'dob_bestellung', richtung: 'liest' })
    expect(regeln(pruefe(beleg), 'B9')).toEqual([])
    const mitStichprobe = mitAngaben((c) => {
      c.datenobjekte.dob_bestellung.aufbewahrungsart = 'buchungsbeleg'
      c.weitereKontrollen.push(neueWeitereKontrolle({ name: 'Abgleich', bezugAufgabeId: 'auf_erfassen', nachweis: 'abzeichnen' }))
    })
    expect(regeln(pruefe(mitStichprobe), 'B9')).toEqual([])
    expect(regeln(pruefe(), 'B9')).toEqual([])
  })
})

describe('Daten D1–D9', () => {
  it('D1 fragt nach dem Personenbezug', () => {
    expect(finde(pruefe(mitAngaben((c) => (c.datenobjekte.dob_bestellnotiz.personenbezogen = null))), 'compliance:D1:dob_bestellnotiz')?.schwere).toBe('hinweis')
    expect(regeln(pruefe(), 'D1')).toEqual([])
  })

  it('D2 meldet fehlende Betroffene oder Datenkategorien', () => {
    expect(finde(pruefe(mitAngaben((c) => (c.datenobjekte.dob_tourenliste.datenkategorien = []))), 'compliance:D2:dob_tourenliste')?.text).toBe('Für „Tourenliste“ fehlen Datenkategorien.')
    const beide = mitAngaben((c) => Object.assign(c.datenobjekte.dob_tourenliste, { datenkategorien: [], betroffene: [] }))
    expect(finde(pruefe(beide), 'compliance:D2:dob_tourenliste')?.text).toBe('Für „Tourenliste“ fehlen betroffene Personen und Datenkategorien.')
    expect(regeln(pruefe(), 'D2')).toEqual([])
  })

  it('D3 meldet fehlende Rechtsgrundlagen', () => {
    expect(finde(pruefe(mitAngaben((c) => (c.datenobjekte.dob_rechnung.rechtsgrundlagen = []))), 'compliance:D3:dob_rechnung')?.schwere).toBe('warnung')
    expect(regeln(pruefe(), 'D3')).toEqual([])
  })

  it('D4 fragt nach dem berechtigten Interesse', () => {
    const ohne = mitAngaben((c) => c.datenobjekte.dob_rechnung.rechtsgrundlagen.push('interesse'))
    expect(finde(pruefe(ohne), 'compliance:D4:dob_rechnung')?.schwere).toBe('hinweis')
    ohne.datenobjekte.dob_rechnung.berechtigtesInteresse = 'Forderungen durchsetzen'
    expect(regeln(pruefe(ohne), 'D4')).toEqual([])
  })

  it('D5 meldet besonders geschützte Daten', () => {
    expect(finde(pruefe(mitAngaben((c) => (c.datenobjekte.dob_rechnung.besondereKategorien = ['gesundheit']))), 'compliance:D5:dob_rechnung')?.text).toContain('„Ausgangsrechnung“ enthält Gesundheitsdaten.')
    expect(finde(pruefe(mitAngaben((c) => (c.datenobjekte.dob_rechnung.strafrechtlich = true))), 'compliance:D5:dob_rechnung')?.text).toContain('Daten über strafrechtliche Verurteilungen und Straftaten')
    expect(regeln(pruefe(), 'D5')).toEqual([])
  })

  it('D6 verlangt eine Löschfrist für personenbezogene Daten ohne Aufbewahrungspflicht', () => {
    expect(finde(pruefe(), 'compliance:D6:dob_tourenliste')?.teilschritt).toBe('fristen')
    expect(regeln(pruefe(mitAngaben((c) => (c.datenobjekte.dob_tourenliste.loeschfrist = neueFrist()))), 'D6')).toEqual([])
    // Grenzfall: Einordnung „Weiß nicht“ ohne Löschfrist ergibt B1, aber kein D6
    expect(finde(pruefe(), 'compliance:B1:dob_bestellnotiz')).toBeDefined()
    expect(finde(pruefe(), 'compliance:D6:dob_bestellnotiz')).toBeUndefined()
  })

  it('D7 verlangt eine Begründung für längere Aufbewahrung', () => {
    const laenger = mitAngaben((c) => (c.datenobjekte.dob_rechnung.aufbewahrungJahre = 10))
    expect(finde(pruefe(laenger), 'compliance:D7:dob_rechnung')?.text).toBe(
      '„Ausgangsrechnung“ wird 10 Jahre statt 8 Jahre aufbewahrt. Personenbezogene Daten nur so lange speichern wie nötig: Grund angeben.',
    )
    laenger.begruendungLaengereAufbewahrung = 'Einheitliche Frist nach Empfehlung der Steuerberatung'
    expect(regeln(pruefe(laenger), 'D7')).toEqual([])
    expect(regeln(pruefe(mitAngaben((c) => (c.datenobjekte.dob_rechnung.aufbewahrungJahre = 8))), 'D7')).toEqual([])
  })

  it('D7 zählt beim Lieferschein jede gewählte Frist als länger, bei Kaufleuten erst eine über 6 Jahren', () => {
    const einzel = mitAngaben((c) => {
      Object.assign(c.unternehmen, { rechtsform: 'einzelunternehmen', gewinnermittlung: 'euer' })
      c.datenobjekte.dob_lieferschein.aufbewahrungJahre = 2
    })
    const b = finde(pruefe(einzel), 'compliance:D7:dob_lieferschein')
    expect(b?.text).toContain('„Lieferschein“ wird 2 Jahre statt bis zum Versand der Rechnung aufbewahrt.')
    // Der Lieferdienst ist eine GmbH: 2 Jahre sind nicht länger als handelsrechtlich ggf. verlangt
    expect(regeln(pruefe(mitAngaben((c) => (c.datenobjekte.dob_lieferschein.aufbewahrungJahre = 2))), 'D7')).toEqual([])
  })

  it('D8 meldet Empfänger ohne gesicherten Standort', () => {
    const empfaenger = (werte: object) => mitAngaben((c) => Object.assign(c.datenobjekte.dob_rechnung.externeEmpfaenger[0], werte))
    expect(finde(pruefe(empfaenger({ standort: 'unbekannt' })), 'compliance:D8:emp_steuerberatung')?.text).toBe('Für „Steuerberatung“ ist nicht bekannt, wo die Daten verarbeitet werden.')
    expect(finde(pruefe(empfaenger({ standort: 'drittland', drittland: 'USA', garantie: null })), 'compliance:D8:emp_steuerberatung')?.text).toBe(
      'Für „Steuerberatung“ ist keine Garantie für die Übermittlung nach USA eingetragen.',
    )
    // Grenzfall: Standardvertragsklauseln ohne Name ergibt D8, mit Name nicht
    const scc = { standort: 'drittland', drittland: 'USA', garantie: 'standardvertragsklauseln' }
    expect(finde(pruefe(empfaenger({ ...scc, name: '' })), 'compliance:D8:emp_steuerberatung')?.text).toBe('Für „Steuerberatung“ ist der Empfänger in USA nicht benannt.')
    expect(regeln(pruefe(empfaenger({ ...scc, name: 'Beispiel Inc.' })), 'D8')).toEqual([])
    expect(regeln(pruefe(), 'D8')).toEqual([])
  })

  it('D9 verlangt einen Zweck, sobald Daten personenbezogen sind', () => {
    expect(finde(pruefe(mitAngaben((c) => (c.verarbeitung.zwecke = [' ']))), 'compliance:D9')?.schwere).toBe('warnung')
    expect(regeln(pruefe(), 'D9')).toEqual([])
  })
})

describe('Systeme S1–S6', () => {
  it('S1 fragt, wo das System läuft; mit Personenbezug als Warnung', () => {
    expect(finde(pruefe(mitAngaben((c) => (c.systeme.med_excel.betrieb = null))), 'compliance:S1:med_excel')?.schwere).toBe('warnung')
    const ohnePersonen = mitAngaben((c) => {
      c.systeme.med_excel.betrieb = null
      c.datenobjekte.dob_tourenliste.personenbezogen = false
      c.datenobjekte.dob_bestellung.personenbezogen = false
    })
    expect(finde(pruefe(ohnePersonen), 'compliance:S1:med_excel')?.schwere).toBe('hinweis')
    expect(regeln(pruefe(), 'S1')).toEqual([])
  })

  it('S2 verlangt einen AV-Vertrag, aber nicht ohne Auftragsverarbeitung', () => {
    expect(finde(pruefe(), 'compliance:S2:med_erp')?.text).toBe(
      'WaWi-Cloud (Beispielanbieter) verarbeitet in „Warenwirtschaft“ personenbezogene Daten. Dafür ist ein Vertrag zur Auftragsverarbeitung nötig.',
    )
    expect(finde(pruefe(mitAngaben((c) => (c.systeme.med_erp.auftragsverarbeitung = null))), 'compliance:S2:med_erp')?.text).toContain('Prüfe zuerst, ob im Auftrag verarbeitet wird.')
    expect(regeln(pruefe(mitAngaben((c) => (c.systeme.med_erp.auftragsverarbeitung = false))), 'S2')).toEqual([])
    expect(regeln(pruefe(mitAngaben((c) => (c.systeme.med_erp.avVertrag = 'ja'))), 'S2')).toEqual([])
  })

  it('S3 meldet unklaren Speicherort oder fehlende Garantie', () => {
    expect(finde(pruefe(mitAngaben((c) => (c.systeme.med_erp.standort = 'unbekannt'))), 'compliance:S3:med_erp')?.schwere).toBe('warnung')
    expect(finde(pruefe(mitAngaben((c) => Object.assign(c.systeme.med_erp, { standort: 'drittland', drittland: 'USA', garantie: 'keine' }))), 'compliance:S3:med_erp')).toBeDefined()
    expect(regeln(pruefe(mitAngaben((c) => Object.assign(c.systeme.med_erp, { standort: 'drittland', drittland: 'USA', garantie: 'standardvertragsklauseln' }))), 'S3')).toEqual([])
    expect(regeln(pruefe(), 'S3')).toEqual([])
  })

  it('S4 verlangt Version und Einsatzbeginn', () => {
    expect(finde(pruefe(), 'compliance:S4:med_erp')?.schwere).toBe('hinweis')
    expect(regeln(pruefe(mitAngaben((c) => Object.assign(c.systeme.med_erp, { version: '7.1', seit: '2024-01-01' }))), 'S4')).toEqual([])
  })

  it('S5 meldet Systeme mit Ablage ohne Datensicherung', () => {
    const b = finde(pruefe(mitAngaben((c) => (c.systeme.med_erp.sicherung = 'unklar'))), 'compliance:S5:med_erp')
    expect(b?.text).toBe('„Warenwirtschaft“ bewahrt „Bestellung“ und „Ausgangsrechnung“ auf, eine Datensicherung ist nicht bekannt.')
    expect(finde(pruefe(mitAngaben((c) => (c.systeme.med_erp.sicherung = 'keine'))), 'compliance:S5:med_erp')?.text).toContain('nicht eingerichtet')
    // ohne aufbewahrungspflichtige Ablage kein S5
    expect(regeln(pruefe(mitAngaben((c) => (c.systeme.med_excel.sicherung = 'keine'))), 'S5')).toEqual([])
  })

  it('S6 verlangt einen Test der Rücksicherung innerhalb von 365 Tagen', () => {
    const getestet = (datum: string | null) => mitAngaben((c) => (c.systeme.med_excel.wiederherstellungGetestet = datum))
    expect(regeln(pruefe(getestet('2025-11-11')), 'S6')).toEqual([])
    expect(finde(pruefe(getestet('2025-11-10')), 'compliance:S6:med_excel')?.text).toBe('Für „Excel-Tourenliste“ wurde seit dem 10.11.2025 nicht geprüft, ob sich die Sicherung zurückspielen lässt.')
    expect(finde(pruefe(getestet(null)), 'compliance:S6:med_excel')?.text).toContain('noch nie')
    expect(regeln(pruefe(), 'S6')).toEqual([])
  })
})

describe('Vier-Augen-Prüfung K1 (9.3)', () => {
  const buchhaltungGibtFrei = () => mitAufgabe('auf_freigeben', { rolleId: 'rol_buchhaltung' })

  it('a: Buchhaltung erstellt, Niederlassungsleitung gibt frei: kein K1', () => {
    expect(regeln(pruefe(), 'K1')).toEqual([])
  })

  it('b: Buchhaltung mit einer Person gibt selbst frei: Warnung', () => {
    const b = finde(pruefe(mitAngaben(), buchhaltungGibtFrei()), 'compliance:K1:auf_freigeben')
    expect(b?.schwere).toBe('warnung')
    expect(b?.blockId).toBe('auf_freigeben')
    expect(b?.text).toContain('„Rechnung freigeben“ gibt frei, was „Buchhaltung“ in „Rechnung erstellen“ erstellt hat, und die Rolle hat nur eine Person.')
  })

  it('c: Buchhaltung mit zwei Personen: Hinweis', () => {
    const p = buchhaltungGibtFrei()
    p.rollen = p.rollen.map((r) => (r.id === 'rol_buchhaltung' ? { ...r, personen: 2 } : r))
    const b = finde(pruefe(mitAngaben(), p), 'compliance:K1:auf_freigeben')
    expect(b?.schwere).toBe('hinweis')
    expect(b?.titel).toBe('Vier-Augen-Prinzip nur organisatorisch')
  })

  it('d: nachgelagerte Stichprobe gleicht aus: Hinweis', () => {
    const c = mitAngaben((x) => x.weitereKontrollen.push(neueWeitereKontrolle({ name: 'Stichprobe Steuerberatung', extern: true, bezugAufgabeId: 'auf_freigeben', nachweis: 'abzeichnen' })))
    const b = finde(pruefe(c, buchhaltungGibtFrei()), 'compliance:K1:auf_freigeben')
    expect(b?.schwere).toBe('hinweis')
    expect(b?.text).toContain('ausgeglichen durch „Stichprobe Steuerberatung“')
  })

  it('e: ohne Zugriffe gilt die vorige Aufgabe als Ersteller', () => {
    const c = mitAngaben((x) => (x.zugriffe = x.zugriffe.filter((z) => z.aufgabeId !== 'auf_freigeben')))
    expect(finde(pruefe(c, buchhaltungGibtFrei()), 'compliance:K1:auf_freigeben')?.schwere).toBe('warnung')
  })

  it('f: Freigabe als erster Schritt ohne Zugriffe: kein K1', () => {
    const p = fuegeEin(beispielLieferdienst(), 'haupt', 0, neueAufgabe({ id: 'auf_vorab', name: 'Auftrag freigeben', art: 'freigabe', rolleId: 'rol_buchhaltung', mediumId: 'med_erp' }))
    expect(regeln(pruefe(mitAngaben(), p), 'K1')).toEqual([])
  })

  it('g: Prüfung mit Kontrollart Plausibilität: kein K1, als Vier-Augen-Kontrolle schon', () => {
    expect(finde(pruefe(), 'compliance:K1:auf_kontrollieren')).toBeUndefined()
    const vierAugen = mitAngaben((c) => (c.kontrollen.auf_kontrollieren.art = 'vier_augen'))
    const b = finde(pruefe(vierAugen), 'compliance:K1:auf_kontrollieren')
    // Lager hat 5 Personen
    expect(b?.schwere).toBe('hinweis')
    expect(b?.text).toContain('Erstellen und Prüfen liegen bei „Lager“')
  })
})

describe('Kontrollen K2–K6, Schutzmaßnahmen T1', () => {
  it('K2 meldet Kontrollen ohne Nachweis, auch weitere Kontrollen', () => {
    expect(finde(pruefe(), 'compliance:K2:auf_kontrollieren')?.blockId).toBe('auf_kontrollieren')
    expect(regeln(pruefe(mitAngaben((c) => (c.kontrollen.auf_kontrollieren.nachweis = 'abzeichnen'))), 'K2')).toEqual([])
    const weitere = mitAngaben((c) => {
      c.kontrollen.auf_kontrollieren.nachweis = 'abzeichnen'
      c.weitereKontrollen.push(neueWeitereKontrolle({ id: 'wk_stichprobe', name: 'Stichprobe', nachweis: 'unklar' }))
    })
    expect(regeln(pruefe(weitere), 'K2')).toEqual(['compliance:K2:wk_stichprobe'])
  })

  it('K3 fragt nach Angaben zu Prüfungen und Freigaben', () => {
    expect(finde(pruefe(mitAngaben((c) => delete c.kontrollen.auf_kontrollieren)), 'compliance:K3:auf_kontrollieren')?.schwere).toBe('hinweis')
    expect(regeln(pruefe(), 'K3')).toEqual([])
  })

  it('K4 meldet Buchungsbelege ohne jede Kontrolle', () => {
    const ohneKontrollen = mitAufgabe('auf_kontrollieren', { art: 'normal' }, mitAufgabe('auf_freigeben', { art: 'normal' }))
    expect(finde(pruefe(mitAngaben(), ohneKontrollen), 'compliance:K4')?.schwere).toBe('hinweis')
    expect(regeln(pruefe(), 'K4')).toEqual([])
  })

  it('K5 meldet einen Ein-Personen-Betrieb ohne externen Ausgleich', () => {
    const p = beispielLieferdienst()
    p.rollen = p.rollen.map((r) => ({ ...r, personen: 0.1 }))
    expect(finde(pruefe(mitAngaben(), p), 'compliance:K5')?.schwere).toBe('hinweis')
    const ausgleich = mitAngaben((c) => c.weitereKontrollen.push(neueWeitereKontrolle({ name: 'Stichprobe Steuerberatung', extern: true, nachweis: 'abzeichnen' })))
    expect(regeln(pruefe(ausgleich, p), 'K5')).toEqual([])
    expect(regeln(pruefe(), 'K5')).toEqual([])
  })

  it('K6 fragt nach der Einweisung', () => {
    expect(finde(pruefe(mitAngaben((c) => (c.einweisung.turnus = null))), 'compliance:K6')?.schwere).toBe('hinweis')
    expect(finde(pruefe(mitAngaben((c) => (c.einweisung.turnus = 'keine'))), 'compliance:K6')).toBeDefined()
    expect(regeln(pruefe(), 'K6')).toEqual([])
  })

  it('T1 meldet leere Bereiche, Pseudonymisierung nur als Hinweis', () => {
    expect(finde(pruefe(), 'compliance:T1:ueberpruefung')?.schwere).toBe('warnung')
    expect(finde(pruefe(mitAngaben((c) => (c.toms.pseudonymisierung.nichtZutreffend = ''))), 'compliance:T1:pseudonymisierung')?.schwere).toBe('hinweis')
    expect(finde(pruefe(mitAngaben((c) => (c.toms.verschluesselung.massnahmen = []))), 'compliance:T1:verschluesselung')?.schwere).toBe('warnung')
    expect(regeln(pruefe(mitAngaben((c) => (c.toms.ueberpruefung.nichtZutreffend = 'Wird mit der Firmenmappe geprüft'))), 'T1')).toEqual([])
  })
})

describe('Versionen V1–V3', () => {
  async function mitVersion(freigegebenAm: string, zuletztGeprueft: string | null = null): Promise<ComplianceProjekt> {
    const c = mitAngaben()
    const v = await freigeben(beispielLieferdienst(), c, { bezeichnung: '1.0', gueltigAb: freigegebenAm, freigegebenVon: 'Erika Mustermann', aenderung: 'Erstfassung' }, freigegebenAm)
    return { ...c, versionen: [v], zuletztGeprueft }
  }

  it('V1 meldet einen Entwurf ohne Freigabe', async () => {
    expect(finde(pruefe(), 'compliance:V1')?.schwere).toBe('hinweis')
    expect(regeln(pruefe(await mitVersion(HEUTE)), 'V1')).toEqual([])
  })

  it('V3 meldet eine Überprüfung nach mehr als 365 Tagen', async () => {
    expect(regeln(pruefe(await mitVersion('2025-11-11')), 'V3')).toEqual([])
    expect(finde(pruefe(await mitVersion('2025-11-10')), 'compliance:V3')?.text).toBe('Die letzte Prüfung ist 366 Tage her. Einmal im Jahr prüfen, ob alles noch stimmt.')
    // „Geprüft, keine Änderung“ zählt als Prüfung
    expect(regeln(pruefe(await mitVersion('2024-01-01', '2026-01-01')), 'V3')).toEqual([])
    expect(regeln(pruefe(await mitVersion('2024-01-01')), 'V2')).toEqual([])
  })
})

describe('Durchsicht: ausgeblendeter Dienstleister', () => {
  it('meldet S2 und S3 nicht für ein System auf eigenen Geräten mit altem Dienstleister', () => {
    const c = mitAngaben((x) => Object.assign(x.systeme.med_erp, { betrieb: 'lokal', standort: 'unbekannt' }))
    const befunde = pruefe(c)
    expect(regeln(befunde, 'S2')).toEqual([])
    expect(regeln(befunde, 'S3')).toEqual([])
  })
})
