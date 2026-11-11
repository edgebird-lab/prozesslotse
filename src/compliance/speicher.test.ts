import { describe, expect, it } from 'vitest'
import { beispielLieferdienst, beispielProjekt } from '../modell/beispiel'
import { entferneBlock, entferneMedium } from '../modell/operationen'
import { alsJson, Formatfehler, leseProjekt, leseProjektText } from '../modell/speicher'
import { beispielMitCompliance, complianceLieferdienst } from './beispiel'
import { bereinigeCompliance, kanonischesJson, uebernimmFirmenangaben } from './speicher'
import { neueCompliance } from './standard'

/** Projekt als JSON-Daten, wie sie aus einer Datei kommen */
function datei(): Record<string, any> {
  return JSON.parse(alsJson(beispielMitCompliance()))
}

describe('Compliance-Angaben laden', () => {
  it('lädt Dateien ohne Compliance-Angaben unverändert', () => {
    const p = leseProjektText(alsJson(beispielProjekt()))
    expect(p.compliance).toBeUndefined()
    expect('compliance' in p).toBe(false)
  })

  it('liest das Beispiel mit Compliance-Angaben unverändert wieder ein', () => {
    const projekt = beispielMitCompliance()
    expect(leseProjektText(alsJson(projekt))).toEqual(projekt)
  })

  it('lehnt eine unbekannte Version ab', () => {
    const d = datei()
    d.compliance.version = 2
    expect(() => leseProjekt(d)).toThrow('Compliance-Angaben in Version 2 werden nicht unterstützt.')
  })

  it('nennt das Feld bei einem ungültigen Datum', () => {
    const d = datei()
    d.compliance.systeme.med_erp.seit = '2026-13-01'
    expect(() => leseProjekt(d)).toThrow(Formatfehler)
    expect(() => leseProjekt(d)).toThrow('Compliance-Angaben: ‚systeme.med_erp.seit‘ ist kein gültiges Datum.')
    d.compliance.systeme.med_erp.seit = '2026-02-30'
    expect(() => leseProjekt(d)).toThrow('‚systeme.med_erp.seit‘ ist kein gültiges Datum')
  })

  it('lehnt unbekannte Katalogwerte ab', () => {
    const d = datei()
    d.compliance.datenobjekte.dob_rechnung.aufbewahrungsart = 'ewig'
    expect(() => leseProjekt(d)).toThrow('‚datenobjekte.dob_rechnung.aufbewahrungsart‘ hat den unbekannten Wert „ewig“')
    const e = datei()
    e.compliance.datenobjekte.dob_rechnung.betroffene.push('aliens')
    expect(() => leseProjekt(e)).toThrow('‚datenobjekte.dob_rechnung.betroffene.1‘')
  })

  it('prüft Zahlenbereiche', () => {
    const d = datei()
    d.compliance.datenobjekte.dob_rechnung.aufbewahrungJahre = 31
    expect(() => leseProjekt(d)).toThrow('‚datenobjekte.dob_rechnung.aufbewahrungJahre‘ ist keine ganze Zahl von 0 bis 30')
    d.compliance.datenobjekte.dob_rechnung.aufbewahrungJahre = 8.5
    expect(() => leseProjekt(d)).toThrow(Formatfehler)
    const e = datei()
    e.compliance.unternehmen.personenMitDaten = -1
    expect(() => leseProjekt(e)).toThrow('‚unternehmen.personenMitDaten‘')
    const f = datei()
    f.compliance.datenobjekte.dob_tourenliste.loeschfrist = { anzahl: 101, einheit: 'tage', beginn: 'entstehung', ereignis: '' }
    expect(() => leseProjekt(f)).toThrow('‚datenobjekte.dob_tourenliste.loeschfrist.anzahl‘ ist keine ganze Zahl von 0 bis 100')
  })

  it('lehnt Verweise auf unbekannte Unterlagen und Ablageorte ab', () => {
    const d = datei()
    d.compliance.zugriffe.push({ aufgabeId: 'auf_rechnung', unterlageId: 'dob_gibtsnicht', richtung: 'liest' })
    expect(() => leseProjekt(d)).toThrow('‚zugriffe.16.unterlageId‘ verweist auf eine unbekannte Unterlage')
    const e = datei()
    e.compliance.datenobjekte.dob_rechnung.ablageSpeicherIds = ['dsp_weg']
    expect(() => leseProjekt(e)).toThrow('‚datenobjekte.dob_rechnung.ablageSpeicherIds.0‘ verweist auf einen unbekannten Ablageort')
    const f = datei()
    f.compliance.datenobjekte.dob_weg = f.compliance.datenobjekte.dob_rechnung
    expect(() => leseProjekt(f)).toThrow('‚datenobjekte.dob_weg‘ gehört zu keiner Unterlage')
    const g = datei()
    g.compliance.unterlagen.push({ id: 'dob_rechnung', name: 'doppelt' })
    expect(() => leseProjekt(g)).toThrow('‚unterlagen.5.id‘ kommt doppelt vor')
  })

  it('verlangt alle sechs Schutzbereiche', () => {
    const d = datei()
    delete d.compliance.toms.wiederherstellung
    expect(() => leseProjekt(d)).toThrow('‚toms.wiederherstellung‘ fehlt oder ist kein Objekt')
  })
})

describe('Bereinigen', () => {
  it('ändert nichts, wenn alles zum Ist-Prozess passt', () => {
    const c = complianceLieferdienst()
    expect(bereinigeCompliance(c, beispielLieferdienst())).toBe(c)
  })

  it('entfernt Zugriffe und Kontrollen einer gelöschten Aufgabe, die Unterlage bleibt', () => {
    const c = complianceLieferdienst()
    const neu = bereinigeCompliance(c, entferneBlock(beispielLieferdienst(), 'auf_freigeben'))
    expect(neu.kontrollen.auf_freigeben).toBeUndefined()
    expect(neu.zugriffe.some((z) => z.aufgabeId === 'auf_freigeben')).toBe(false)
    expect(neu.unterlagen).toBe(c.unterlagen)
    expect(neu.datenobjekte).toBe(c.datenobjekte)
  })

  it('löst Ablageorte von einem gelöschten Medium', () => {
    const c = complianceLieferdienst()
    const neu = bereinigeCompliance(c, entferneMedium(beispielLieferdienst(), 'med_papier'))
    expect(neu.ablageorte.find((a) => a.id === 'dsp_ordner')?.mediumId).toBeNull()
    expect(neu.ablageorte.find((a) => a.id === 'dsp_warenwirtschaft')?.mediumId).toBe('med_erp')
    const ohneErp = bereinigeCompliance(c, entferneMedium(beispielLieferdienst(), 'med_erp'))
    expect(ohneErp.systeme.med_erp).toBeUndefined()
    expect(ohneErp.systeme.med_excel).toBe(c.systeme.med_excel)
  })

  it('löst weitere Kontrollen von einer gelöschten Aufgabe', () => {
    const c = { ...complianceLieferdienst(), weitereKontrollen: [{ id: 'wk_1', name: 'Stichprobe', art: 'stichprobe' as const, verantwortlich: 'Kanzlei', extern: true, haeufigkeit: 'monatlich', nachweis: 'abzeichnen' as const, bezugAufgabeId: 'auf_freigeben' }] }
    expect(bereinigeCompliance(c, entferneBlock(beispielLieferdienst(), 'auf_freigeben')).weitereKontrollen[0].bezugAufgabeId).toBeNull()
  })
})

describe('Firmenangaben übernehmen', () => {
  it('übernimmt genau fünf Felder; Unterlagen und Versionen bleiben', () => {
    const ziel = neueCompliance()
    const quelle = complianceLieferdienst()
    const neu = uebernimmFirmenangaben(ziel, quelle)
    expect(neu.unternehmen).toEqual(quelle.unternehmen)
    expect(neu.unternehmen).not.toBe(quelle.unternehmen)
    expect(neu.toms).toEqual(quelle.toms)
    expect(neu.einweisung).toEqual(quelle.einweisung)
    expect(neu.loeschung).toEqual(quelle.loeschung)
    expect(neu.begruendungLaengereAufbewahrung).toBe(quelle.begruendungLaengereAufbewahrung)
    expect(neu.unterlagen).toBe(ziel.unterlagen)
    expect(neu.versionen).toBe(ziel.versionen)
    expect(neu.verarbeitung).toBe(ziel.verarbeitung)
    expect(neu.systeme).toBe(ziel.systeme)
  })
})

describe('Kanonisches JSON', () => {
  it('sortiert Schlüssel und lässt Leerraum weg', () => {
    expect(kanonischesJson({ b: 1, a: [true, null, 'x'], c: { z: 'ä', y: undefined } })).toBe('{"a":[true,null,"x"],"b":1,"c":{"z":"ä"}}')
    expect(kanonischesJson({ a: 1, b: 2 })).toBe(kanonischesJson({ b: 2, a: 1 }))
  })
})
