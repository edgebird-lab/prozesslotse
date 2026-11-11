/**
 * Neue Angaben aus der Prüfung vom 11.11.2026 (Paket „Angaben“): Wiederfinden und
 * Datenzugriff (GoBD Rz. 152), Ausnahme nach Art. 9 Abs. 2 DSGVO, Zugriffsschutz,
 * mitgeltende Unterlagen, Lieferscheine bei Kaufleuten (§ 257 HGB), Institute,
 * offene Standorte und offener Betrieb in Verzeichnis B.5 und Kapitel 2.6.
 */
import { describe, expect, it } from 'vitest'
import { neueAufgabe, neueRolle, neuerProzess } from '../modell/bausteine'
import { beispielLieferdienst } from '../modell/beispiel'
import { aendereBlock } from '../modell/operationen'
import { alsJson, Formatfehler, leseProjekt } from '../modell/speicher'
import type { Prozess } from '../modell/typen'
import { COMPLIANCE_LERNINHALTE } from '../ui/compliance/lerninhalte'
import { beispielMitCompliance, complianceLieferdienst } from './beispiel'
import { kapitel } from './dokument'
import { istKaufmann, laengerAlsVorgeschrieben, loeschText } from './fristen'
import { mitgeltendeUnterlagen, setzeMitgeltendeUnterlagen } from './mitgeltend'
import { pruefeCompliance } from './regeln'
import { neueCompliance, neueFrist, neuerEmpfaenger, standardDatenobjekt } from './standard'
import type { Abschnitt, ComplianceBefund, ComplianceProjekt, DatenobjektAngaben, Dokument } from './typen'
import { entwurfsKontext, erzeugeDokumente, freigeben, geaenderteKapitel } from './versionen'

const HEUTE = '2026-11-11'
const HGB = 'handelsrechtlich ggf. 6 Jahre, falls Handelsbrief (§ 257 HGB); mit Steuerberatung klären'

function mitAngaben(aendern: (c: ComplianceProjekt) => void = () => {}): ComplianceProjekt {
  const c = complianceLieferdienst()
  aendern(c)
  return c
}

function dokumente(c: ComplianceProjekt = complianceLieferdienst(), p: Prozess = beispielLieferdienst()) {
  return erzeugeDokumente(p, c, entwurfsKontext(c, HEUTE))
}

function texte(a: Abschnitt): string[] {
  switch (a.art) {
    case 'ueberschrift':
      return [`${a.nummer} ${a.text}`]
    case 'absatz':
    case 'hinweis':
      return [a.text]
    case 'liste':
      return a.punkte
    case 'tabelle':
      return [...a.kopf, ...a.zeilen.flat()]
    case 'diagramm':
      return []
  }
}

function abschnitteVon(d: Dokument, schluessel: string): Abschnitt[] {
  return kapitel(d).get(schluessel) ?? []
}

function textIn(d: Dokument, schluessel: string): string[] {
  return abschnitteVon(d, schluessel).flatMap(texte)
}

function tabelleIn(d: Dokument, schluessel: string, index = 0) {
  const t = abschnitteVon(d, schluessel).filter((a) => a.art === 'tabelle')[index]
  if (!t || t.art !== 'tabelle') throw new Error(`keine Tabelle in ${schluessel}`)
  return t
}

function zeile(t: { zeilen: string[][] }, erste: string): string[] | undefined {
  return t.zeilen.find((z) => z[0] === erste)
}

function finde(befunde: ComplianceBefund[], schluessel: string): ComplianceBefund | undefined {
  return befunde.find((b) => b.schluessel === schluessel)
}

function regeln(befunde: ComplianceBefund[], regel: string): string[] {
  return befunde.filter((b) => b.regel === regel).map((b) => b.schluessel)
}

function pruefe(c: ComplianceProjekt = complianceLieferdienst(), p: Prozess = beispielLieferdienst()): ComplianceBefund[] {
  return pruefeCompliance(p, c, HEUTE)
}

/** Projekt als JSON-Daten, wie sie aus einer Datei kommen */
function datei(): Record<string, any> {
  return JSON.parse(alsJson(beispielMitCompliance()))
}

describe('recht-4: Wiederfinden, Lesbarmachung und Datenzugriff (GoBD Rz. 152)', () => {
  const ohneAngaben = () =>
    mitAngaben((c) => {
      c.systeme.med_erp.wiederfinden = ''
      c.systeme.med_erp.datenzugriff = ''
    })

  it('beschreibt je System mit Ablage in Kapitel 3.5, wie Unterlagen wiedergefunden werden und die Finanzverwaltung zugreift', () => {
    const { verfahrensdoku } = dokumente()
    expect(textIn(verfahrensdoku, '3.5')[0]).toBe('3.5 Wiederfinden, Lesbarmachung und Datenzugriff')
    const t = tabelleIn(verfahrensdoku, '3.5')
    expect(t.kopf).toEqual(['System', 'Aufbewahrte Unterlagen', 'Wiederfinden über', 'Datenzugriff, auch nach Vertragsende oder Systemwechsel'])
    // nur Systeme mit aufbewahrungspflichtiger Ablage: die Excel-Tourenliste bewahrt nichts auf
    expect(t.zeilen).toEqual([
      ['Warenwirtschaft', 'Bestellung, Ausgangsrechnung', 'Suche nach Rechnungs-, Bestell- oder Kundennummer', 'Export aller Rechnungen und Buchungsdaten als CSV und PDF; bei Vertragsende Gesamtexport nach Vertrag'],
    ])
    expect(textIn(verfahrensdoku, '3.5').join(' ')).toContain('§ 147 Abs. 2, 5 und 6 AO')
  })

  it('schreibt leere Angaben als „offen“ und meldet sie als Hinweis S7', () => {
    const c = ohneAngaben()
    expect(zeile(tabelleIn(dokumente(c).verfahrensdoku, '3.5'), 'Warenwirtschaft')?.slice(2)).toEqual(['offen', 'offen'])
    const b = finde(pruefe(c), 'compliance:S7:med_erp')
    expect(b).toMatchObject({ schwere: 'hinweis', teilschritt: 'systeme', ziel: { art: 'system', id: 'med_erp' } })
    expect(b?.text).toBe(
      'Für „Warenwirtschaft“ ist offen, wie eine Unterlage wiedergefunden wird und wie die Finanzverwaltung bei einer Außenprüfung auf die Daten zugreift, auch nach Vertragsende oder Systemwechsel.',
    )
    expect(b?.quelle).toContain('GoBD Rz. 152')
    c.systeme.med_erp.wiederfinden = 'Rechnungsnummer'
    expect(finde(pruefe(c), 'compliance:S7:med_erp')?.text).toBe(
      'Für „Warenwirtschaft“ ist offen, wie die Finanzverwaltung bei einer Außenprüfung auf die Daten zugreift, auch nach Vertragsende oder Systemwechsel.',
    )
    // Beispiel ausgefüllt, und ohne aufbewahrungspflichtige Ablage gibt es keine Frage
    expect(regeln(pruefe(), 'S7')).toEqual([])
    expect(finde(pruefe(c), 'compliance:S7:med_excel')).toBeUndefined()
  })

  it('kommt mit älteren Dateien ohne die neuen Felder zurecht und prüft sie streng, wenn sie da sind', () => {
    const d = datei()
    delete d.compliance.systeme.med_erp.wiederfinden
    delete d.compliance.systeme.med_erp.datenzugriff
    const p = leseProjekt(d)
    expect(zeile(tabelleIn(dokumente(p.compliance!).verfahrensdoku, '3.5'), 'Warenwirtschaft')?.slice(2)).toEqual(['offen', 'offen'])
    expect(finde(pruefe(p.compliance!), 'compliance:S7:med_erp')).toBeDefined()
    const e = datei()
    e.compliance.systeme.med_erp.datenzugriff = 5
    expect(() => leseProjekt(e)).toThrow(Formatfehler)
    expect(() => leseProjekt(e)).toThrow('‚systeme.med_erp.datenzugriff‘ fehlt oder ist kein Text')
  })

  it('ordnet Kapitel 3.5 in Kapitel 1 der Betriebsdokumentation zu', () => {
    expect(textIn(dokumente().verfahrensdoku, '1').join(' ')).toContain('Betriebsdokumentation in Kapitel 3.2 bis 3.5.')
  })
})

/** „Krankmeldung Fahrer“: Gesundheitsdaten von Beschäftigten, wie in der Prüfvariante 06 */
function mitKrankmeldung(werte: Partial<DatenobjektAngaben> = {}): ComplianceProjekt {
  return mitAngaben((c) => {
    c.unterlagen.push({ id: 'dob_krank', name: 'Krankmeldung Fahrer' })
    c.zugriffe.push({ aufgabeId: 'auf_tour', unterlageId: 'dob_krank', richtung: 'liest' })
    c.datenobjekte.dob_krank = {
      ...standardDatenobjekt(),
      aufbewahrungsart: 'keine',
      personenbezogen: true,
      betroffene: ['beschaeftigte'],
      datenkategorien: ['identifikation', 'personal'],
      besondereKategorien: ['gesundheit'],
      rechtsgrundlagen: ['rechtspflicht'],
      loeschfrist: neueFrist({ anzahl: 1, einheit: 'jahre', beginn: 'jahresende' }),
      ...werte,
    }
  })
}

describe('recht-7: Ausnahme nach Art. 9 Abs. 2 DSGVO', () => {
  it('nennt die fehlende Ausnahme in B.2 und B.3 als „offen“ und warnt mit D5', () => {
    const c = mitKrankmeldung()
    const { verzeichnis } = dokumente(c)
    expect(textIn(verzeichnis, 'B.2')).toContain('Art. 9 Abs. 2 DSGVO: offen (für Krankmeldung Fahrer)')
    expect(zeile(tabelleIn(verzeichnis, 'B.3'), 'Krankmeldung Fahrer')?.[3]).toBe('lit. c; Art. 9 Abs. 2: offen')
    const d5 = finde(pruefe(c), 'compliance:D5:dob_krank')
    expect(d5?.schwere).toBe('warnung')
    expect(d5?.text).toContain('Gib an, welche Ausnahme nach Art. 9 Abs. 2 DSGVO die Verarbeitung erlaubt')
    expect(d5?.text).toContain('BDSG')
  })

  it('gibt die gewählte Ausnahme in B.2 und B.3 aus; D5 bleibt dann ein Hinweis', () => {
    const c = mitKrankmeldung({ ausnahmeArt9: 'arbeitsrecht' })
    const { verzeichnis } = dokumente(c)
    expect(textIn(verzeichnis, 'B.2')).toContain('Art. 9 Abs. 2 lit. b DSGVO: Rechte und Pflichten aus Arbeitsrecht, sozialer Sicherheit und Sozialschutz (für Krankmeldung Fahrer)')
    expect(textIn(verzeichnis, 'B.2').join(' ')).not.toContain('offen')
    expect(zeile(tabelleIn(verzeichnis, 'B.3'), 'Krankmeldung Fahrer')?.[3]).toBe('lit. c; Art. 9 Abs. 2 lit. b')
    const d5 = finde(pruefe(c), 'compliance:D5:dob_krank')
    expect(d5?.schwere).toBe('hinweis')
    expect(d5?.text).not.toContain('Gib an')
    // Art. 10 hat keine Ausnahme nach Art. 9 Abs. 2: bleibt eine Warnung
    expect(finde(pruefe(mitKrankmeldung({ ausnahmeArt9: 'arbeitsrecht', strafrechtlich: true })), 'compliance:D5:dob_krank')?.schwere).toBe('warnung')
  })

  it('fragt ohne besondere Kategorien nicht nach einer Ausnahme und nennt Art. 6 auch dann, wenn er fehlt', () => {
    expect(textIn(dokumente().verzeichnis, 'B.2').join(' ')).not.toContain('Art. 9')
    const ohneArt6 = mitKrankmeldung()
    for (const d of Object.values(ohneArt6.datenobjekte)) d.rechtsgrundlagen = []
    expect(textIn(dokumente(ohneArt6).verzeichnis, 'B.2')).toEqual(['B.2 Rechtsgrundlagen', 'Art. 6 Abs. 1 DSGVO: offen', 'Art. 9 Abs. 2 DSGVO: offen (für Krankmeldung Fahrer)'])
  })

  it('prüft die Ausnahme beim Laden streng, ältere Dateien ohne das Feld laden', () => {
    const d = datei()
    d.compliance.datenobjekte.dob_rechnung.ausnahmeArt9 = 'lit_x'
    expect(() => leseProjekt(d)).toThrow('‚datenobjekte.dob_rechnung.ausnahmeArt9‘ hat den unbekannten Wert „lit_x“')
    const e = datei()
    delete e.compliance.datenobjekte.dob_rechnung.ausnahmeArt9
    expect(() => leseProjekt(e)).not.toThrow()
    e.compliance.datenobjekte.dob_rechnung.ausnahmeArt9 = 'arbeitsrecht'
    expect(leseProjekt(e).compliance?.datenobjekte.dob_rechnung.ausnahmeArt9).toBe('arbeitsrecht')
  })
})

describe('recht-15 und recht-16: Datenkategorien im Verzeichnis', () => {
  it('nennt besondere Kategorien und Art. 10 in der Zeile der Unterlage', () => {
    const t = tabelleIn(dokumente(mitKrankmeldung()).verzeichnis, 'B.3')
    expect(zeile(t, 'Krankmeldung Fahrer')?.[2]).toBe('Identifikationsdaten (z. B. Name, Kunden- oder Personalnummer), Personaldaten, Gesundheitsdaten (Art. 9 DSGVO)')
    const straf = tabelleIn(dokumente(mitKrankmeldung({ besondereKategorien: [], datenkategorien: [], strafrechtlich: true })).verzeichnis, 'B.3')
    expect(zeile(straf, 'Krankmeldung Fahrer')?.[2]).toBe('offen, Daten über strafrechtliche Verurteilungen und Straftaten (Art. 10 DSGVO)')
  })

  it('schreibt „Identifikationsdaten“ ohne die Kundennummer als einzige Angabe', () => {
    const texteB3 = textIn(dokumente(mitKrankmeldung()).verzeichnis, 'B.3')
    expect(texteB3).toContain('Identifikationsdaten (z. B. Name, Kunden- oder Personalnummer)')
    expect(texteB3.join(' ')).not.toContain('(Name, Kundennummer)')
  })
})

describe('recht-3 und logik-18: Zugriffsschutz und mitgeltende Unterlagen', () => {
  it('führt den Zugriffsschutz je System als Spalte in Kapitel 3.4, leer als „offen“', () => {
    const t = tabelleIn(dokumente().verfahrensdoku, '3.4')
    expect(t.kopf).toEqual(['System', 'Schutz vor Änderung', 'Datensicherung', 'Intervall', 'Rücksicherung getestet', 'Zugriffsschutz'])
    expect(zeile(t, 'Warenwirtschaft')?.[5]).toBe('eigenes Konto je Person, Rechte nach Rolle')
    const leer = tabelleIn(dokumente(mitAngaben((c) => (c.systeme.med_erp.zugriffsschutz = ' '))).verfahrensdoku, '3.4')
    expect(zeile(leer, 'Warenwirtschaft')?.[5]).toBe('offen')
  })

  it('nennt den Zugriffsschutz der Systeme mit Personenbezug im Verzeichnis unter C.3', () => {
    const c3 = textIn(dokumente().verzeichnis, 'C.3')
    expect(c3).toContain('Zugriffsschutz je System:')
    expect(c3).toContain('Warenwirtschaft: eigenes Konto je Person, Rechte nach Rolle')
    expect(c3).toContain('Excel-Tourenliste: eigenes Windows-Konto, Ordner nur für die Disposition')
  })

  it('meldet eine Änderung des Zugriffsschutzes nach der Freigabe als geändert', async () => {
    const c = complianceLieferdienst()
    const v = await freigeben(beispielLieferdienst(), c, { bezeichnung: '1.0', gueltigAb: HEUTE, freigegebenVon: 'Erika Mustermann', aenderung: 'Erstfassung' }, HEUTE)
    const danach = { ...c, versionen: [v], systeme: { ...c.systeme, med_erp: { ...c.systeme.med_erp, zugriffsschutz: 'zusätzlich Zwei-Faktor-Anmeldung' } } }
    expect(geaenderteKapitel(v, beispielLieferdienst(), danach)).toEqual(['VD 3.4', 'VVT C.3'])
  })

  it('führt mitgeltende Unterlagen mit Ablageort in Kapitel 6, auch ältere Einträge ohne Ablageort', () => {
    const c = mitAngaben((x) => {
      x.mitgeltend = ['Arbeitsanweisung Kasse', ' ']
      x.mitgeltendeUnterlagen = [{ id: 'mit_1', name: 'Berechtigungskonzept', ablageort: 'Ordner Organisation, Büro' }]
    })
    const k6 = textIn(dokumente(c).verfahrensdoku, '6')
    expect(k6).toContain('Arbeitsanweisung Kasse')
    expect(k6).toContain('Berechtigungskonzept (Ablage: Ordner Organisation, Büro)')
  })

  it('übernimmt ältere Einträge beim ersten Ändern in die neue Liste', () => {
    const c = mitAngaben((x) => (x.mitgeltend = ['Arbeitsanweisung Kasse', '']))
    const liste = mitgeltendeUnterlagen(c)
    expect(liste.map((m) => [m.name, m.ablageort])).toEqual([['Arbeitsanweisung Kasse', '']])
    const neu = setzeMitgeltendeUnterlagen(c, [...liste, { id: 'mit_2', name: 'Berechtigungskonzept', ablageort: 'DMS' }])
    expect(neu.mitgeltend).toEqual([])
    expect(mitgeltendeUnterlagen(neu).map((m) => m.name)).toEqual(['Arbeitsanweisung Kasse', 'Berechtigungskonzept'])
    expect(c.mitgeltend).toEqual(['Arbeitsanweisung Kasse', ''])
  })

  it('prüft mitgeltende Unterlagen beim Laden streng', () => {
    const d = datei()
    d.compliance.mitgeltendeUnterlagen = [{ id: 'mit_1', name: 'Berechtigungskonzept', ablageort: 'DMS' }]
    expect(leseProjekt(d).compliance?.mitgeltendeUnterlagen).toEqual([{ id: 'mit_1', name: 'Berechtigungskonzept', ablageort: 'DMS' }])
    d.compliance.mitgeltendeUnterlagen.push({ id: 'mit_1', name: 'Doppelt', ablageort: '' })
    expect(() => leseProjekt(d)).toThrow('‚mitgeltendeUnterlagen.1.id‘ kommt doppelt vor')
    const e = datei()
    e.compliance.mitgeltendeUnterlagen = [{ id: 'mit_1', name: 'Berechtigungskonzept' }]
    expect(() => leseProjekt(e)).toThrow('‚mitgeltendeUnterlagen.0.ablageort‘ fehlt oder ist kein Text')
    const f = datei()
    delete f.compliance.mitgeltendeUnterlagen
    expect(() => leseProjekt(f)).not.toThrow()
  })
})

describe('recht-0: Lieferscheine bei Kaufleuten (§ 257 HGB)', () => {
  const einzel = (aendern: (c: ComplianceProjekt) => void = () => {}) =>
    mitAngaben((c) => {
      Object.assign(c.unternehmen, { rechtsform: 'einzelunternehmen', gewinnermittlung: 'euer' })
      aendern(c)
    })

  it('erkennt Kaufleute an Rechtsform oder Bilanz', () => {
    for (const rechtsform of ['ek', 'ohg', 'kg', 'gmbh', 'ug', 'gmbh_co_kg', 'eg'] as const) expect(istKaufmann({ rechtsform, gewinnermittlung: 'euer' }), rechtsform).toBe(true)
    for (const rechtsform of ['einzelunternehmen', 'gbr', 'partg', 'ev', 'sonstige', null] as const) expect(istKaufmann({ rechtsform, gewinnermittlung: 'euer' }), String(rechtsform)).toBe(false)
    expect(istKaufmann({ rechtsform: 'einzelunternehmen', gewinnermittlung: 'bilanz' })).toBe(true)
    expect(istKaufmann({ rechtsform: null, gewinnermittlung: null })).toBe(false)
  })

  it('ergänzt bei der GmbH die handelsrechtliche Frist in Fristentabelle, 2.4, 4.19, B.3 und B.6', () => {
    const { verfahrensdoku, verzeichnis } = dokumente()
    expect(zeile(tabelleIn(verfahrensdoku, '2.3'), 'Lieferscheine, die keine Buchungsbelege sind')?.[2]).toBe(`bis zum Erhalt bzw. Versand der Rechnung; ${HGB}`)
    expect(zeile(tabelleIn(verfahrensdoku, '2.4'), 'Lieferschein')?.[5]).toBe(`bis zum Versand der Rechnung; ${HGB}`)
    expect(textIn(verfahrensdoku, '4')).toContain('„Lieferschein“: aufbewahren bis zum Versand der Rechnung; Ablage: Ordner Lieferscheine. Handelsrechtlich ggf. 6 Jahre, falls Handelsbrief (§ 257 HGB); mit Steuerberatung klären.')
    expect(zeile(tabelleIn(verzeichnis, 'B.3'), 'Lieferschein')?.[4]).toBe(`bis zum Versand der Rechnung (§ 147 Abs. 3 AO); ${HGB}`)
    expect(zeile(tabelleIn(verzeichnis, 'B.6'), 'Lieferschein')?.[1]).toBe(`bis zum Versand der Rechnung (§ 147 Abs. 3 AO); ${HGB}`)
  })

  it('meldet den Lieferschein bei Kaufleuten als Hinweis B10, bis eine Frist von mindestens 6 Jahren gewählt ist', () => {
    const b = finde(pruefe(), 'compliance:B10:dob_lieferschein')
    expect(b).toMatchObject({ schwere: 'hinweis', teilschritt: 'fristen', ziel: { art: 'frist', id: 'dob_lieferschein' } })
    expect(b?.text).toContain('Für Kaufleute kann er als Handelsbrief 6 Jahre aufzubewahren sein (§ 257 HGB).')
    expect(finde(pruefe(mitAngaben((c) => (c.datenobjekte.dob_lieferschein.aufbewahrungJahre = 2))), 'compliance:B10:dob_lieferschein')).toBeDefined()
    expect(regeln(pruefe(mitAngaben((c) => (c.datenobjekte.dob_lieferschein.aufbewahrungJahre = 6))), 'B10')).toEqual([])
    expect(regeln(pruefe(einzel()), 'B10')).toEqual([])
  })

  it('löst bei Kaufleuten D7 und „länger als vorgeschrieben“ erst über 6 Jahren aus', () => {
    const sechs = mitAngaben((c) => (c.datenobjekte.dob_lieferschein.aufbewahrungJahre = 6))
    expect(regeln(pruefe(sechs), 'D7')).toEqual([])
    expect(textIn(dokumente(sechs).verfahrensdoku, '2.3').join(' ')).not.toContain('Länger als vorgeschrieben')
    expect(regeln(pruefe(mitAngaben((c) => (c.datenobjekte.dob_lieferschein.aufbewahrungJahre = 2))), 'D7')).toEqual([])
    const acht = mitAngaben((c) => (c.datenobjekte.dob_lieferschein.aufbewahrungJahre = 8))
    expect(finde(pruefe(acht), 'compliance:D7:dob_lieferschein')?.text).toBe('„Lieferschein“ wird 8 Jahre statt 6 Jahre aufbewahrt. Personenbezogene Daten nur so lange speichern wie nötig: Grund angeben.')
    expect(laengerAlsVorgeschrieben({ ...standardDatenobjekt(), aufbewahrungsart: 'lieferschein', aufbewahrungJahre: 6 }, true)).toBe(false)
    expect(laengerAlsVorgeschrieben({ ...standardDatenobjekt(), aufbewahrungsart: 'lieferschein', aufbewahrungJahre: 7 }, true)).toBe(true)
    // ohne Kaufmannseigenschaft wie bisher: jede gewählte Frist ist länger
    expect(finde(pruefe(einzel((c) => (c.datenobjekte.dob_lieferschein.aufbewahrungJahre = 2))), 'compliance:D7:dob_lieferschein')?.text).toContain('wird 2 Jahre statt bis zum Versand der Rechnung aufbewahrt')
  })

  it('nennt bei gewählter Frist nicht mehr § 147 Abs. 3 AO als Grundlage der Löschung', () => {
    const d: DatenobjektAngaben = { ...standardDatenobjekt(), aufbewahrungsart: 'lieferschein', richtung: 'ausgang', aufbewahrungJahre: 6 }
    expect(loeschText(d, true)).toBe('nach Ablauf der Aufbewahrung: 6 Jahre ab Ende des Kalenderjahres der Entstehung')
    expect(loeschText({ ...d, aufbewahrungJahre: 2 }, true)).toBe(`nach Ablauf der Aufbewahrung: 2 Jahre ab Ende des Kalenderjahres der Entstehung; ${HGB}`)
    expect(loeschText({ ...d, aufbewahrungJahre: null }, false)).toBe('bis zum Versand der Rechnung (§ 147 Abs. 3 AO)')
  })

  it('lässt Dokumente ohne Kaufmannseigenschaft unverändert', () => {
    const { verfahrensdoku, verzeichnis } = dokumente(einzel())
    expect(zeile(tabelleIn(verfahrensdoku, '2.3'), 'Lieferscheine, die keine Buchungsbelege sind')?.[2]).toBe('bis zum Erhalt bzw. Versand der Rechnung')
    expect(zeile(tabelleIn(verfahrensdoku, '2.4'), 'Lieferschein')?.[5]).toBe('bis zum Versand der Rechnung')
    expect(zeile(tabelleIn(verzeichnis, 'B.6'), 'Lieferschein')?.[1]).toBe('bis zum Versand der Rechnung (§ 147 Abs. 3 AO)')
  })

  it('erklärt im Lernhinweis, wann ein Lieferschein zur Rechnung gehört', () => {
    expect(COMPLIANCE_LERNINHALTE.belege.text).toContain('Lieferschein')
    expect(COMPLIANCE_LERNINHALTE.belege.quelle).toContain('§ 31 Abs. 1 UStDV')
  })
})

describe('recht-20: Institute nach KWG, VAG und WpIG', () => {
  it('nennt unter der Fristentabelle die Ausnahme mit 10 Jahren für Buchungsbelege', () => {
    const k23 = abschnitteVon(dokumente().verfahrensdoku, '2.3')
    const i = k23.findIndex((a) => a.art === 'tabelle')
    expect(k23[i + 1]).toEqual({
      art: 'absatz',
      text: 'Ausnahme: Für Kredit- und Finanzdienstleistungsinstitute, Versicherungsunternehmen und Wertpapierinstitute gelten für Buchungsbelege weiter 10 Jahre (Art. 97 § 19a Abs. 3 EGAO, § 257 Abs. 4 Satz 2 HGB).',
    })
  })
})

/** Lieferdienst mit neuem System „E-Mail-Postfach“ für „Rechnung versenden“, Betrieb noch nicht angegeben */
function mitPostfach(): Prozess {
  const p = beispielLieferdienst()
  p.medien.push({ id: 'med_mail', name: 'E-Mail-Postfach', art: 'email' })
  return aendereBlock(p, 'auf_versenden', (b) => (b.typ === 'aufgabe' ? { ...b, mediumId: 'med_mail' } : b))
}

describe('recht-6 und logik-5: offene Standorte und offener Betrieb', () => {
  const b5 = (c: ComplianceProjekt, p?: Prozess) => textIn(dokumente(c, p).verzeichnis, 'B.5')

  it('schreibt bei unbekanntem Standort nicht „findet nicht statt“', () => {
    const texteB5 = b5(mitAngaben((c) => (c.systeme.med_erp.standort = 'unbekannt')))
    expect(texteB5).not.toContain('Eine Übermittlung in Drittländer findet nicht statt und ist nicht geplant.')
    expect(texteB5).toContain('Ob personenbezogene Daten in Drittländer übermittelt werden, ist noch offen bei: WaWi-Cloud (Beispielanbieter).')
    // alle Standorte bekannt: der Satz bleibt
    expect(b5(complianceLieferdienst())).toContain('Eine Übermittlung in Drittländer findet nicht statt und ist nicht geplant.')
  })

  it('zählt ein System mit Personenbezug und offenem Betrieb als offen und warnt mit S1', () => {
    const p = mitPostfach()
    const texteB5 = b5(complianceLieferdienst(), p)
    expect(texteB5).not.toContain('Eine Übermittlung in Drittländer findet nicht statt und ist nicht geplant.')
    expect(texteB5).toContain('Ob personenbezogene Daten in Drittländer übermittelt werden, ist noch offen bei: „E-Mail-Postfach“ (Betrieb offen).')
    expect(finde(pruefe(complianceLieferdienst(), p), 'compliance:S1:med_mail')?.schwere).toBe('warnung')
    // ohne Personenbezug bleibt S1 ein Hinweis
    const ohne = mitAngaben((c) => (c.datenobjekte.dob_rechnung.personenbezogen = false))
    expect(finde(pruefe(ohne, p), 'compliance:S1:med_mail')?.schwere).toBe('hinweis')
  })

  it('setzt den Standort neuer Empfänger auf „Weiß nicht“ und nennt ihn dann als offen', () => {
    expect(neuerEmpfaenger().standort).toBe('unbekannt')
    const c = mitAngaben((x) => x.datenobjekte.dob_rechnung.externeEmpfaenger.push(neuerEmpfaenger({ kategorie: 'Inkasso' })))
    expect(b5(c)).toContain('Ob personenbezogene Daten in Drittländer übermittelt werden, ist noch offen bei: Inkasso.')
  })

  it('sagt in Kapitel 2.6 nicht „Alle Schritte finden im Unternehmen statt“, solange der Betrieb eines Systems offen ist', () => {
    const rolle = neueRolle('Team')
    const p = neuerProzess({
      name: 'Kasse',
      rollen: [rolle],
      medien: [{ id: 'med_kasse', name: 'Kassensystem', art: 'fachanwendung' }],
      ablauf: { id: 'haupt', schritte: [neueAufgabe({ name: 'Kassieren', rolleId: rolle.id, mediumId: 'med_kasse' })] },
    })
    const c = neueCompliance()
    expect(textIn(dokumente(c, p).verfahrensdoku, '2.6')).toEqual(['2.6 Abgrenzung der Bearbeitungsbereiche', 'Wer „Kassensystem“ betreibt, ist offen.'])
    c.systeme.med_kasse = { ...complianceLieferdienst().systeme.med_excel, betrieb: 'lokal' }
    expect(textIn(dokumente(c, p).verfahrensdoku, '2.6')).toEqual(['2.6 Abgrenzung der Bearbeitungsbereiche', 'Alle Schritte finden im Unternehmen statt.'])
    // mit externen Stellen: der offene Betrieb steht zusätzlich da
    const lieferdienst = mitAngaben((x) => Object.assign(x.systeme.med_erp, { betrieb: null, dienstleister: '' }))
    expect(textIn(dokumente(lieferdienst).verfahrensdoku, '2.6')).toContain('Wer „Warenwirtschaft“ betreibt, ist offen.')
  })
})

describe('recht-19: Beispiel mit Kaufversion statt Microsoft 365', () => {
  it('führt Excel als Kaufversion mit Version im lokalen Betrieb, ohne Dienstleister', () => {
    const s = complianceLieferdienst().systeme.med_excel
    expect(s.version).toMatch(/^Excel 20\d\d \(Kaufversion\)$/)
    expect(s.version).not.toContain('365')
    expect(s).toMatchObject({ hersteller: 'Microsoft', betrieb: 'lokal', dienstleister: '' })
    // Einsatzbeginn nach dem Erscheinen von Office 2024 (1. Oktober 2024)
    expect(s.seit! >= '2024-10-01').toBe(true)
  })

  it('ändert an den Befunden des Beispiels nichts', () => {
    const vorher = mitAngaben((c) => Object.assign(c.systeme.med_excel, { version: 'Microsoft 365', seit: '2023-01-01' }))
    expect(pruefe().map((b) => [b.schluessel, b.schwere])).toEqual(pruefe(vorher).map((b) => [b.schluessel, b.schwere]))
  })
})
