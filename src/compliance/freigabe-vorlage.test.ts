/**
 * Vorlagenhinweis nur auf Entwürfen (recht-5): Freigegebene Fassungen tragen in der
 * Fußzeile Version und Freigabetag, auf dem Deckblatt die Verantwortung des
 * Unternehmens und optional „fachlich geprüft von … am …“ aus dem Freigabe-Dialog.
 */
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { beispielLieferdienst } from '../modell/beispiel'
import { alsJson, leseProjektText } from '../modell/speicher'
import { beispielMitCompliance, complianceLieferdienst } from './beispiel'
import { erzeugeDocx } from './docx'
import { fusszeile, hinweisVerfahrensdoku } from './textbausteine'
import type { Abschnitt, ComplianceProjekt, Dokument, DokuVersion } from './typen'
import { entwurfsKontext, erzeugeDokumente, freigabeFehler, freigeben, geaenderteKapitel, pruefsumme, pruefsummeStimmt, type FreigabeEingaben } from './versionen'

const HEUTE = '2026-11-11'
const ERSTE: FreigabeEingaben = { bezeichnung: '1.0', gueltigAb: HEUTE, freigegebenVon: 'Erika Mustermann', aenderung: 'Erstfassung' }
const GEPRUEFT: FreigabeEingaben = { ...ERSTE, geprueftVon: 'Steuerberatung Muster', geprueftAm: '2026-11-10' }

const deckblatt = (d: Dokument): Abschnitt[] => d.abschnitte.slice(0, d.abschnitte.findIndex((a) => a.art === 'ueberschrift'))
const hinweis = (d: Dokument) => {
  const h = deckblatt(d).find((a) => a.art === 'hinweis')
  return h && 'text' in h ? h.text : ''
}
const absaetze = (d: Dokument) => deckblatt(d).flatMap((a) => (a.art === 'absatz' ? [a.text] : []))
const tabelleNach = (d: Dokument, nummer: string) => {
  const i = d.abschnitte.findIndex((a) => a.art === 'ueberschrift' && a.nummer === nummer)
  return d.abschnitte.slice(i).find((a) => a.art === 'tabelle') as Extract<Abschnitt, { art: 'tabelle' }>
}

async function dateien(d: Dokument): Promise<Record<string, string>> {
  return Object.fromEntries(Object.entries(unzipSync(await erzeugeDocx(d))).map(([name, inhalt]) => [name, strFromU8(inhalt)]))
}
const fussXml = (d: Record<string, string>) =>
  Object.keys(d)
    .filter((n) => /^word\/footer\d*\.xml$/.test(n))
    .map((n) => d[n])
    .join('')

describe('Entwurf: Vorlagenhinweis auf Deckblatt und Fußzeile', () => {
  const c = complianceLieferdienst()
  const { verfahrensdoku, verzeichnis } = erzeugeDokumente(beispielLieferdienst(), c, entwurfsKontext(c, HEUTE))

  it('Deckblatt mit „Vorlage … vor Verwendung prüfen lassen“, Fußzeile mit Vorlage und „Entwurf“', () => {
    expect(hinweis(verfahrensdoku)).toMatch(/^Vorlage, erstellt mit dem Prozesslotsen am 11\.11\.2026\. Rechtsstand 11\.11\.2026\. Vor Verwendung von der Steuerberatung prüfen lassen\./)
    expect(hinweis(verzeichnis)).toMatch(/^Vorlage, erstellt mit dem Prozesslotsen am 11\.11\.2026\. Rechtsstand 11\.11\.2026\. Vor Verwendung vom Datenschutzbeauftragten/)
    expect(fusszeile(verfahrensdoku)).toBe('Vorlage – vor Verwendung prüfen lassen · Verfahrensdokumentation · Entwurf')
    expect(fusszeile(verzeichnis)).toBe('Vorlage – vor Verwendung prüfen lassen · Verzeichnis von Verarbeitungstätigkeiten · Entwurf')
  })

  it('DOCX: Fußzeile mit Vorlagenhinweis', async () => {
    expect(fussXml(await dateien(verfahrensdoku))).toContain('Vorlage – vor Verwendung prüfen lassen · Verfahrensdokumentation · Entwurf · Seite ')
  })
})

describe('Freigegebene Fassung: Verantwortung beim Unternehmen, Version und Freigabetag', () => {
  it('Deckblatt ohne Vorlagenhinweis, mit Verantwortung und empfohlener Prüfung', async () => {
    const v = await freigeben(beispielLieferdienst(), complianceLieferdienst(), ERSTE, HEUTE)
    expect(hinweis(v.verfahrensdoku)).toMatch(
      /^Aus einer Vorlage mit dem Prozesslotsen erstellt; die Verantwortung für den Inhalt liegt beim Unternehmen\. Eine Prüfung durch die Steuerberatung wird empfohlen\. Rechtsstand 11\.11\.2026\. Beschreibt nur den Prozess/,
    )
    expect(hinweis(v.verzeichnis)).toMatch(
      /^Aus einer Vorlage mit dem Prozesslotsen erstellt; die Verantwortung für den Inhalt liegt beim Unternehmen\. Eine Prüfung durch den Datenschutzbeauftragten oder eine fachkundige Person wird empfohlen\. Rechtsstand 11\.11\.2026\. Beschreibt die Verarbeitung/,
    )
    for (const d of [v.verfahrensdoku, v.verzeichnis]) {
      expect(hinweis(d)).not.toMatch(/Vorlage, erstellt|[Vv]or Verwendung/)
      // ohne Angabe im Dialog keine Zeile zur fachlichen Prüfung
      expect(absaetze(d)).toEqual(['Version 1.0 · gültig ab 11.11.2026'])
    }
    expect(v.fachlichGeprueft).toBeUndefined()
  })

  it('Fußzeile „{Dokument} · Version {n} · freigegeben am {Datum}“, ohne „Vorlage“', async () => {
    const v = await freigeben(beispielLieferdienst(), complianceLieferdienst(), { ...ERSTE, gueltigAb: '2026-12-01' }, HEUTE)
    expect(fusszeile(v.verfahrensdoku)).toBe('Verfahrensdokumentation · Version 1.0 · freigegeben am 11.11.2026')
    expect(fusszeile(v.verzeichnis)).toBe('Verzeichnis von Verarbeitungstätigkeiten · Version 1.0 · freigegeben am 11.11.2026')
    const fuss = fussXml(await dateien(v.verfahrensdoku))
    expect(fuss).toContain('Verfahrensdokumentation · Version 1.0 · freigegeben am 11.11.2026 · Seite ')
    expect(fuss).not.toContain('Vorlage')
  })

  it('„fachlich geprüft von … am …“ auf dem Deckblatt, in Kapitel 7 und in Abschnitt D, auch in späteren Versionen', async () => {
    const p = beispielLieferdienst()
    const c = complianceLieferdienst()
    const v1 = await freigeben(p, c, GEPRUEFT, HEUTE)
    expect(v1.fachlichGeprueft).toEqual({ von: 'Steuerberatung Muster', am: '2026-11-10' })
    for (const d of [v1.verfahrensdoku, v1.verzeichnis]) expect(absaetze(d)).toEqual(['Version 1.0 · gültig ab 11.11.2026', 'Fachlich geprüft von Steuerberatung Muster am 10.11.2026.'])
    expect(tabelleNach(v1.verfahrensdoku, '7').zeilen[0][3]).toBe('11.11.2026, Erika Mustermann; fachlich geprüft von Steuerberatung Muster am 10.11.2026')
    expect(tabelleNach(v1.verzeichnis, 'D').zeilen[0][2]).toBe('Erstfassung; fachlich geprüft von Steuerberatung Muster am 10.11.2026')

    // Version 2 ohne Prüfung führt die Prüfung von Version 1 in ihrer Historie
    const c1: ComplianceProjekt = { ...c, versionen: [v1] }
    const v2 = await freigeben(p, c1, { bezeichnung: '2.0', gueltigAb: '2026-12-01', freigegebenVon: 'Erika Mustermann', aenderung: 'Jährliche Durchsicht' }, HEUTE)
    expect(absaetze(v2.verfahrensdoku)).toEqual(['Version 2.0 · gültig ab 01.12.2026'])
    expect(tabelleNach(v2.verfahrensdoku, '7').zeilen.map((z) => z[3])).toEqual(['11.11.2026, Erika Mustermann; fachlich geprüft von Steuerberatung Muster am 10.11.2026', '11.11.2026, Erika Mustermann'])
    expect(tabelleNach(v2.verzeichnis, 'D').zeilen.map((z) => z[2])).toEqual(['Erstfassung; fachlich geprüft von Steuerberatung Muster am 10.11.2026', 'Jährliche Durchsicht'])
  })

  it('ohne Datum nur „fachlich geprüft von …“', async () => {
    const v = await freigeben(beispielLieferdienst(), complianceLieferdienst(), { ...ERSTE, geprueftVon: ' Datenschutz Nord ', geprueftAm: null }, HEUTE)
    expect(v.fachlichGeprueft).toEqual({ von: 'Datenschutz Nord', am: null })
    expect(absaetze(v.verzeichnis)[1]).toBe('Fachlich geprüft von Datenschutz Nord.')
  })

  it('DOCX einer Version: Deckblatt mit Verantwortung und fachlicher Prüfung', async () => {
    const v = await freigeben(beispielLieferdienst(), complianceLieferdienst(), GEPRUEFT, HEUTE)
    const xml = (await dateien(v.verzeichnis))['word/document.xml']
    expect(xml).toContain('Fachlich geprüft von Steuerberatung Muster am 10.11.2026.')
    expect(xml).toContain('die Verantwortung für den Inhalt liegt beim Unternehmen')
    expect(xml).not.toContain('Vor Verwendung')
  })
})

describe('Eingaben zur fachlichen Prüfung im Freigabe-Dialog', () => {
  const c = complianceLieferdienst()
  it('sind optional; ein Datum braucht einen Namen und liegt spätestens am Freigabetag', () => {
    expect(freigabeFehler(c, ERSTE, HEUTE)).toBeNull()
    expect(freigabeFehler(c, GEPRUEFT, HEUTE)).toBeNull()
    expect(freigabeFehler(c, { ...GEPRUEFT, geprueftAm: HEUTE }, HEUTE)).toBeNull()
    expect(freigabeFehler(c, { ...ERSTE, geprueftVon: 'Steuerberatung Muster' }, HEUTE)).toBeNull()
    expect(freigabeFehler(c, { ...GEPRUEFT, geprueftVon: '  ' }, HEUTE)).toEqual({ feld: 'geprueftVon', text: 'Bitte angeben, wer fachlich geprüft hat, oder das Datum leeren.' })
    expect(freigabeFehler(c, { ...GEPRUEFT, geprueftAm: '2026-11-12' }, HEUTE)).toEqual({ feld: 'geprueftAm', text: 'Geprüft am darf nicht nach dem Freigabetag liegen, also spätestens am 11.11.2026.' })
  })

  it('ein leerer Name ohne Datum ergibt keine Prüfung', async () => {
    const v = await freigeben(beispielLieferdienst(), c, { ...ERSTE, geprueftVon: '', geprueftAm: null }, HEUTE)
    expect('fachlichGeprueft' in v).toBe(false)
  })
})

describe('Laden und Prüfsumme', () => {
  /** Datei mit Version 1 als JSON-Daten zum Verändern */
  async function datei(e: FreigabeEingaben): Promise<Record<string, any>> {
    const c = complianceLieferdienst()
    const v = await freigeben(beispielLieferdienst(), c, e, HEUTE)
    return JSON.parse(alsJson({ ...beispielMitCompliance(), compliance: { ...c, versionen: [v] } }))
  }
  const geladen = (d: Record<string, any>): DokuVersion => leseProjektText(JSON.stringify(d)).compliance!.versionen[0]

  it('lädt Versionen mit und ohne fachliche Prüfung; die Prüfsumme stimmt', async () => {
    const mit = geladen(await datei(GEPRUEFT))
    expect(mit.fachlichGeprueft).toEqual({ von: 'Steuerberatung Muster', am: '2026-11-10' })
    expect(await pruefsummeStimmt(mit)).toBe(true)
    const ohne = await datei(ERSTE)
    expect('fachlichGeprueft' in ohne.compliance.versionen[0]).toBe(false)
    expect(await pruefsummeStimmt(geladen(ohne))).toBe(true)
  })

  it('prüft die fachliche Prüfung streng, wenn sie da ist', async () => {
    for (const [falsch, meldung] of [
      [{ von: '', am: null }, /fachlichGeprueft\.von‘ ist leer/],
      [{ von: 'X', am: '2026-11-12' }, /fachlichGeprueft\.am‘ liegt nach der Freigabe/],
      [{ von: 'X', am: '11.11.2026' }, /fachlichGeprueft\.am‘ ist kein gültiges Datum/],
      [{ am: null }, /fachlichGeprueft\.von‘ fehlt/],
      ['Steuerberatung', /fachlichGeprueft‘ fehlt oder ist kein Objekt/],
    ] as const) {
      const d = await datei(ERSTE)
      d.compliance.versionen[0].fachlichGeprueft = falsch
      expect(() => geladen(d)).toThrow(meldung)
    }
  })

  it('die Angabe im eingefrorenen Deckblatt gehört zur Prüfsumme', async () => {
    const d = await datei(GEPRUEFT)
    const abschnitte = d.compliance.versionen[0].verzeichnis.abschnitte
    abschnitte[1].text = 'Fachlich geprüft von Jemand anderem am 10.11.2026.'
    expect(await pruefsummeStimmt(geladen(d))).toBe(false)
  })

  it('ältere Versionen mit Vorlagenhinweis auf dem Deckblatt bleiben gültig und gelten nicht als geändert', async () => {
    // So sahen freigegebene Fassungen vor recht-5 aus: Deckblatt mit dem Hinweis des Entwurfs
    const p = beispielLieferdienst()
    const c = complianceLieferdienst()
    const neu = await freigeben(p, c, ERSTE, HEUTE)
    const alt = structuredClone(neu)
    for (const d of [alt.verfahrensdoku, alt.verzeichnis]) {
      const i = d.abschnitte.findIndex((a) => a.art === 'hinweis')
      d.abschnitte[i] = { art: 'hinweis', text: hinweisVerfahrensdoku(p.name, HEUTE, '2026-11-11') }
    }
    alt.pruefsumme = await pruefsumme(alt)
    expect(alt.pruefsumme).not.toBe(neu.pruefsumme)
    const d = JSON.parse(alsJson({ ...beispielMitCompliance(), compliance: { ...c, versionen: [alt] } }))
    const geladenAlt = geladen(d)
    expect(await pruefsummeStimmt(geladenAlt)).toBe(true)
    // Das Deckblatt zählt beim Vergleich nicht: kein V2 nur wegen des neuen Hinweises
    expect(geaenderteKapitel(geladenAlt, p, { ...c, versionen: [geladenAlt] })).toEqual([])
    // Druck und DOCX zeigen das eingefrorene Deckblatt; nur die Fußzeile entsteht neu bei der Ausgabe
    expect(hinweis(geladenAlt.verfahrensdoku)).toMatch(/^Vorlage, erstellt/)
    expect(fusszeile(geladenAlt.verfahrensdoku)).toBe('Verfahrensdokumentation · Version 1.0 · freigegeben am 11.11.2026')
  })
})
