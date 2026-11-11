import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { neuerProzess } from '../modell/bausteine'
import { beispielLieferdienst } from '../modell/beispiel'
import { complianceLieferdienst } from './beispiel'
import { docxEndung, erzeugeDocx } from './docx'
import { neueCompliance } from './standard'
import { entwurfsKontext, erzeugeDokumente } from './versionen'

function dateien(bytes: Uint8Array): Record<string, string> {
  return Object.fromEntries(Object.entries(unzipSync(bytes)).map(([name, inhalt]) => [name, strFromU8(inhalt)]))
}

describe('DOCX (9.8)', () => {
  const c = complianceLieferdienst()
  const { verfahrensdoku, verzeichnis } = erzeugeDokumente(beispielLieferdienst(), c, entwurfsKontext(c, '2026-11-11'))

  it('ist ein ZIP mit Dokument, Fußzeile und A4-Seite', async () => {
    const d = dateien(await erzeugeDocx(verfahrensdoku))
    const xml = d['word/document.xml']
    expect(xml).toContain('Verfahrensdokumentation')
    expect(xml).toContain('4 Verfahren und Maßnahmen')
    expect(xml).toContain('Vorlage')
    expect(xml).toContain('w:w="11906"')
    expect(xml).toContain('w:h="16838"')
    expect(xml).toContain('w:val="Heading1"')
    const fusszeilen = Object.keys(d).filter((n) => /^word\/footer\d*\.xml$/.test(n))
    expect(fusszeilen.length).toBeGreaterThan(0)
    expect(fusszeilen.some((n) => d[n].includes('Vorlage – vor Verwendung prüfen lassen'))).toBe(true)
  })

  it('übernimmt die Tabelle aus Kapitel 2.4 mit Kopf und fünf Zeilen', async () => {
    const xml = dateien(await erzeugeDocx(verfahrensdoku))['word/document.xml']
    const tabellen = xml.split('<w:tbl>').slice(1).map((t) => t.slice(0, t.indexOf('</w:tbl>')))
    const relevant = tabellen.find((t) => t.includes('Beispiel 2026'))
    expect(relevant?.match(/<w:tr[ >]/g)).toHaveLength(6)
  })

  it('maskiert Sonderzeichen und erzeugt auch das Verzeichnis', async () => {
    const p = { ...beispielLieferdienst(), name: 'Rechnung <Test> & „Prüfung“' }
    const { verzeichnis: v } = erzeugeDokumente(p, c, entwurfsKontext(c, '2026-11-11'))
    const xml = dateien(await erzeugeDocx(v))['word/document.xml']
    expect(xml).toContain('Rechnung &lt;Test&gt; &amp; „Prüfung“')
    expect(dateien(await erzeugeDocx(verzeichnis))['word/document.xml']).toContain('Verzeichnis von Verarbeitungstätigkeiten')
  })

  it('erzeugt für einen leeren Prozess eine gültige Datei', async () => {
    const leer = neueCompliance()
    const { verfahrensdoku: d } = erzeugeDokumente(neuerProzess(), leer, entwurfsKontext(leer, '2026-11-11'))
    const bytes = await erzeugeDocx(d)
    expect(bytes.length).toBeGreaterThan(5000)
    expect(dateien(bytes)['[Content_Types].xml']).toContain('wordprocessingml')
  })

  it('benennt die Datei nach Dokument und Version', () => {
    expect(docxEndung(verfahrensdoku)).toBe('-verfahrensdokumentation-entwurf.docx')
    expect(docxEndung({ ...verzeichnis, versionText: '1.0' })).toBe('-verarbeitungsverzeichnis-v1-0.docx')
  })
})
