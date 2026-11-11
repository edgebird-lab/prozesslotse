import { describe, expect, it } from 'vitest'
import { beispielLieferdienst } from '../modell/beispiel'
import { complianceLieferdienst } from './beispiel'
import { kapitel } from './dokument'
import type { Abschnitt, ComplianceProjekt, Dokument, Sicherung } from './typen'
import { entwurfsKontext, erzeugeDokumente } from './versionen'

// Durchsicht 11.11.2026: Angaben, die die Oberfläche ausblendet, erscheinen nicht in Kapitel 3.4 und 6 (logik-3)

const HEUTE = '2026-11-11'

function vd(c: ComplianceProjekt): Dokument {
  return erzeugeDokumente(beispielLieferdienst(), c, entwurfsKontext(c, HEUTE)).verfahrensdoku
}

function kapitel6(c: ComplianceProjekt): string[] {
  return (kapitel(vd(c)).get('6') ?? []).flatMap((a: Abschnitt) => (a.art === 'liste' ? a.punkte : []))
}

/** Warenwirtschaft mit eingetragenem AV-Vertrag, danach `aendern` */
function mitVertrag(aendern: (c: ComplianceProjekt) => void = () => {}): ComplianceProjekt {
  const c = complianceLieferdienst()
  Object.assign(c.systeme.med_erp, { avVertrag: 'ja', avVertragVom: '2025-01-15' })
  aendern(c)
  return c
}

const VERTRAG = 'Vertrag zur Auftragsverarbeitung mit WaWi-Cloud (Beispielanbieter) vom 15.01.2025'

describe('Kapitel 6 nennt einen AV-Vertrag nur, wenn die Frage danach gestellt wird', () => {
  it('sichtbar: Cloud-Dienst mit Personendaten und Auftragsverarbeitung', () => {
    expect(kapitel6(mitVertrag())).toContain(VERTRAG)
  })

  it('nicht, wenn das System inzwischen auf eigenen Geräten läuft', () => {
    expect(kapitel6(mitVertrag((c) => (c.systeme.med_erp.betrieb = 'lokal'))).join(' ')).not.toContain('Auftragsverarbeitung')
  })

  it('nicht, wenn keine Auftragsverarbeitung vorliegt', () => {
    expect(kapitel6(mitVertrag((c) => (c.systeme.med_erp.auftragsverarbeitung = false))).join(' ')).not.toContain('Auftragsverarbeitung')
  })

  it('nicht, wenn im System keine personenbezogenen Daten liegen', () => {
    const c = mitVertrag((x) => {
      for (const id of ['dob_bestellnotiz', 'dob_bestellung', 'dob_lieferschein', 'dob_tourenliste', 'dob_rechnung']) x.datenobjekte[id].personenbezogen = false
    })
    expect(kapitel6(c).join(' ')).not.toContain('Auftragsverarbeitung')
  })
})

describe('Kapitel 3.4 zeigt Intervall und Test nur bei eingerichteter Sicherung', () => {
  function zeile(sicherung: Sicherung): string[] {
    const c = complianceLieferdienst()
    // Excel-Tourenliste hat im Beispiel „täglich“ und einen Test vom 30.06.2026
    c.systeme.med_excel.sicherung = sicherung
    const t = (kapitel(vd(c)).get('3.4') ?? []).find((a) => a.art === 'tabelle')
    if (!t || t.art !== 'tabelle') throw new Error('keine Tabelle in 3.4')
    // Spalten 3 bis 5 (Datensicherung, Intervall, Test); danach folgt der Zugriffsschutz aus fix/angaben
    return t.zeilen.find((z) => z[0] === 'Excel-Tourenliste')!.slice(0, 5)
  }

  it('„Keine“ und „Weiß nicht“: kein Intervall, nicht getestet', () => {
    expect(zeile('keine').slice(2)).toEqual(['Keine', '–', 'nein'])
    expect(zeile('unklar').slice(2)).toEqual(['offen', '–', 'nein'])
  })

  it('eingerichtete Sicherung wie bisher', () => {
    expect(zeile('automatisch').slice(2)).toEqual(['Automatisch', 'täglich', 'ja'])
    expect(zeile('anbieter').slice(2)).toEqual(['Durch den Anbieter', 'täglich', 'ja'])
  })
})
