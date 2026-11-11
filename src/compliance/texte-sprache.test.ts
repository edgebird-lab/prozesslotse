import { describe, expect, it } from 'vitest'
import { beispielLieferdienst } from '../modell/beispiel'
import { complianceLieferdienst } from './beispiel'
import { kapitel } from './dokument'
import { fristText } from './fristen'
import { pruefeCompliance } from './regeln'
import { neueFrist } from './standard'
import { FRISTEN_TABELLE } from './textbausteine'
import type { Abschnitt, ComplianceProjekt, Dokument } from './typen'
import { entwurfsKontext, erzeugeDokumente } from './versionen'

// Durchsicht 11.11.2026: Wortlaut der Kapiteltexte (bedienung-22, recht-23, recht-14, recht-11 b und c) und die Fristentabelle (daten-8)

const HEUTE = '2026-11-11'

function dokumente(c: ComplianceProjekt) {
  return erzeugeDokumente(beispielLieferdienst(), c, entwurfsKontext(c, HEUTE))
}

const vd = (c: ComplianceProjekt): Dokument => dokumente(c).verfahrensdoku

function texte(d: Dokument, schluessel: string): string[] {
  return (kapitel(d).get(schluessel) ?? []).flatMap((a: Abschnitt) => (a.art === 'absatz' ? [a.text] : a.art === 'liste' ? a.punkte : []))
}

function tabelleIn(d: Dokument, schluessel: string, nr = 0): { kopf: string[]; zeilen: string[][] } {
  const t = (kapitel(d).get(schluessel) ?? []).filter((a) => a.art === 'tabelle')[nr]
  if (!t || t.art !== 'tabelle') throw new Error(`keine Tabelle ${nr} in ${schluessel}`)
  return t
}

function geaendert(aendern: (c: ComplianceProjekt) => void): ComplianceProjekt {
  const c = complianceLieferdienst()
  aendern(c)
  return c
}

/** Kapitel 4 (die Ablage fasst es als Ganzes); im Beispiel endet es mit 4.19 Aufbewahrung, Vernichtung und Löschung */
const k419 = (c: ComplianceProjekt) => texte(vd(c), '4')

describe('Kapitel 2.3: Begründung der längeren Aufbewahrung (bedienung-22)', () => {
  it('endet mit genau einem Punkt, auch wenn die Eingabe schon einen hat', () => {
    const c = geaendert((x) => {
      x.datenobjekte.dob_rechnung.aufbewahrungJahre = 10
      x.begruendungLaengereAufbewahrung = 'Empfehlung der Steuerberatung: einheitliche Frist erleichtert die Ablage. '
    })
    const satz = texte(vd(c), '2.3').find((t) => t.startsWith('Länger als vorgeschrieben'))
    expect(satz).toBe('Länger als vorgeschrieben werden aufbewahrt: Ausgangsrechnung. Grund: Empfehlung der Steuerberatung: einheitliche Frist erleichtert die Ablage.')
  })
})

describe('Kapitel 1 ohne „bei offen“ und ohne Artikel vor Freitext (bedienung-22, recht-23)', () => {
  it('nennt Unternehmen und Geschäftsleitung', () => {
    expect(texte(vd(complianceLieferdienst()), '1')[0]).toBe(
      'Gegenstand dieser Dokumentation ist der Prozess „Bestellung bis Rechnung (Lieferdienst)“ des Unternehmens Lieferdienst Muster GmbH. Inhalt und jede Änderung bedürfen der Zustimmung der Geschäftsleitung (Erika Mustermann).',
    )
  })

  it('kennzeichnet leere Angaben als offen, ohne den Satz zu zerbrechen', () => {
    const c = geaendert((x) => {
      x.unternehmen.name = ''
      x.unternehmen.geschaeftsleitung = ' '
    })
    expect(texte(vd(c), '1')[0]).toBe(
      'Gegenstand dieser Dokumentation ist der Prozess „Bestellung bis Rechnung (Lieferdienst)“; der Name des Unternehmens ist offen. Inhalt und jede Änderung bedürfen der Zustimmung der Geschäftsleitung (Name offen).',
    )
  })
})

describe('Kapitel 4.{n+1}: Löschorganisation als Aufzählung (bedienung-22, recht-23)', () => {
  it('ohne „durchgeführt wird sie von Buchhaltung“', () => {
    const k = k419(complianceLieferdienst())
    expect(k).toContain('Vor Ablauf der Frist wird nichts vernichtet oder gelöscht. Freigabe der Löschung: Erika Mustermann. Durchführung: Buchhaltung. Turnus: jährlich.')
    expect(k.join(' ')).not.toContain('durchgeführt wird sie von')
  })

  it('leere Angaben und „Kein fester Turnus“', () => {
    expect(k419(geaendert((x) => (x.loeschung = { freigabe: '', durchfuehrung: '', turnus: null })))).toContain(
      'Vor Ablauf der Frist wird nichts vernichtet oder gelöscht. Freigabe der Löschung: offen. Durchführung: offen. Turnus: offen.',
    )
    expect(k419(geaendert((x) => (x.loeschung.turnus = 'keiner'))).join(' ')).toContain('Turnus: kein fester.')
  })
})

describe('Kapitel 3.2: Spalte für Rolle oder Person (recht-23)', () => {
  it('heißt „Rolle oder Person“, weil Freigabe und Durchführung der Löschung oft Namen sind', () => {
    const t = tabelleIn(vd(complianceLieferdienst()), '3.2')
    expect(t.kopf).toEqual(['Schritt', 'Rolle oder Person', 'System'])
    expect(t.zeilen.find((z) => z[0] === 'Freigabe der Löschung nach Fristablauf')?.[1]).toBe('Erika Mustermann')
  })
})

describe('Nachweise mitten im Satz klein (recht-23)', () => {
  it('Kapitel 4 und Tabelle 3.3', () => {
    const d = vd(complianceLieferdienst())
    expect(texte(d, '4')).toContain('Kontrolle: Vier-Augen-Prinzip; geprüft wird: Rechnung sachlich und rechnerisch richtig; Nachweis: im System protokolliert.')
    const nachweise = tabelleIn(d, '3.3').zeilen.map((z) => z[4])
    expect(nachweise).toEqual(['keiner', 'im System protokolliert'])
    const c = geaendert((x) => (x.kontrollen.auf_kontrollieren.nachweis = 'abzeichnen'))
    expect(tabelleIn(vd(c), '3.3').zeilen[0][4]).toBe('abgezeichnet mit Datum und Kürzel')
  })
})

describe('Löschfrist 0 ohne „0 Tage“ (recht-23)', () => {
  it('nennt nur den Anlass', () => {
    expect(fristText(neueFrist({ anzahl: 0, einheit: 'tage', beginn: 'ereignis', ereignis: 'Ende des Beschäftigungsverhältnisses' }))).toBe('bei „Ende des Beschäftigungsverhältnisses“')
    expect(fristText(neueFrist({ anzahl: 0, einheit: 'monate', beginn: 'entstehung' }))).toBe('bei Entstehung bzw. Eingang')
    expect(fristText(neueFrist({ anzahl: 0, einheit: 'jahre', beginn: 'jahresende' }))).toBe('mit Ende des Kalenderjahres der Entstehung')
    expect(fristText(neueFrist({ anzahl: 1, einheit: 'tage', beginn: 'ereignis', ereignis: 'Vertragsende' }))).toBe('1 Tag nach „Vertragsende“')
  })

  it('so auch im Dokument', () => {
    const c = geaendert((x) => (x.datenobjekte.dob_tourenliste.loeschfrist = neueFrist({ anzahl: 0, beginn: 'ereignis', ereignis: 'Ende der Tour' })))
    expect(k419(c)).toContain('„Tourenliste“: keine steuerliche Aufbewahrungspflicht (§ 147 AO); löschen bei „Ende der Tour“.')
  })
})

describe('Besondere Kategorie Herkunft mit dem Wortlaut von Art. 9 Abs. 1 DSGVO (recht-23)', () => {
  const c = () => geaendert((x) => (x.datenobjekte.dob_bestellung.besondereKategorien = ['herkunft']))

  it('im Verzeichnis B.3', () => {
    expect(texte(dokumente(c()).verzeichnis, 'B.3')).toContain('Rassische und ethnische Herkunft')
  })

  it('im Befund D5', () => {
    const d5 = pruefeCompliance(beispielLieferdienst(), c(), HEUTE).find((b) => b.schluessel === 'compliance:D5:dob_bestellung')
    expect(d5?.text).toContain('„Bestellung“ enthält Angaben zur rassischen und ethnischen Herkunft.')
  })
})

describe('„nicht aufbewahrungspflichtig“ gilt nur steuerlich (recht-14)', () => {
  it('Einordnung in 2.4', () => {
    const t = tabelleIn(vd(complianceLieferdienst()), '2.4')
    expect(t.zeilen.find((z) => z[0] === 'Tourenliste')?.[1]).toBe('keine steuerliche Aufbewahrungspflicht')
  })

  it('Satz in 4.{n+1}', () => {
    const c = geaendert((x) => (x.datenobjekte.dob_tourenliste.loeschfrist = neueFrist({ anzahl: 30, beginn: 'entstehung' })))
    expect(k419(c)).toContain('„Tourenliste“: keine steuerliche Aufbewahrungspflicht (§ 147 AO); löschen 30 Tage ab Entstehung bzw. Eingang.')
    expect(k419(c).join(' ')).not.toContain('nicht aufbewahrungspflichtig')
  })
})

describe('Keine Zusicherungen in 3.1 und 3.4 (recht-11 b und c)', () => {
  it('Systemwechsel als Vorgabe', () => {
    expect(texte(vd(complianceLieferdienst()), '3.1')).toContain(
      'Bei einem Systemwechsel ist die Lesbarkeit der aufbewahrten Unterlagen sicherzustellen; der Wechsel wird in Kapitel 7 festgehalten.',
    )
  })

  it('„Revisionssicheres Archiv“ erscheint im Dokument als Beschreibung, nicht als Gütesiegel', () => {
    const c = geaendert((x) => (x.systeme.med_erp.unveraenderbarkeit = 'revisionssicher'))
    const zeile = tabelleIn(vd(c), '3.4').zeilen.find((z) => z[0] === 'Warenwirtschaft')
    expect(zeile?.[1]).toBe('Archiv mit Schutz vor Änderung und Löschung')
    expect(JSON.stringify(vd(c))).not.toMatch(/revisionssicher/i)
  })
})

describe('Fristentabelle: jedes Dokument hat seine eigene Kopie (daten-8)', () => {
  it('teilt kein Array mit der Konstante oder einem anderen Dokument', () => {
    const c = complianceLieferdienst()
    const t1 = tabelleIn(vd(c), '2.3')
    const t2 = tabelleIn(vd(c), '2.3')
    expect(t1.zeilen).toEqual(FRISTEN_TABELLE)
    expect(t1.zeilen).not.toBe(FRISTEN_TABELLE)
    expect(t1.zeilen).not.toBe(t2.zeilen)
    expect(t1.zeilen[0]).not.toBe(FRISTEN_TABELLE[0])
  })

  it('eine Änderung an einem Dokument ändert weder die Konstante noch ein anderes', () => {
    const c = complianceLieferdienst()
    const t1 = tabelleIn(vd(c), '2.3')
    const vorher = JSON.stringify(FRISTEN_TABELLE)
    t1.zeilen[0][2] = 'geändert'
    t1.zeilen.push(['neu', 'neu', 'neu'])
    try {
      expect(JSON.stringify(FRISTEN_TABELLE)).toBe(vorher)
      expect(tabelleIn(vd(c), '2.3').zeilen[0][2]).toBe('10 Jahre')
    } finally {
      // Falls die Kopie fehlt, die Konstante für die übrigen Tests wiederherstellen
      FRISTEN_TABELLE.splice(0, FRISTEN_TABELLE.length, ...JSON.parse(vorher))
    }
  })
})
