/**
 * Seitensatz der Dokumente (Sichtprüfung, Mängel 3 und 7): „z. B.“ und „E-Mail“ brechen
 * nicht um, nur die großen Kapitel beginnen auf einer neuen Seite, Formulare wie 9.2
 * bleiben auf einer Seite, Absätze ohne einzelne Zeile am Seitenrand. Alles nur in der
 * Ausgabe; der Dokumenttext bleibt für Prüfsumme und Vergleich unverändert.
 */
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { beispielLieferdienst } from '../modell/beispiel'
import { complianceLieferdienst } from './beispiel'
import { erzeugeDocx } from './docx'
import type { Dokument } from './typen'
import { festeLeerzeichen, neueSeiteVor } from './typografie'
import { entwurfsKontext, erzeugeDokumente } from './versionen'

const NBSP = ' '
const c = complianceLieferdienst()
const { verfahrensdoku, verzeichnis } = erzeugeDokumente(beispielLieferdienst(), c, entwurfsKontext(c, '2026-11-11'))
const xml = async (d: Dokument) => strFromU8(unzipSync(await erzeugeDocx(d))['word/document.xml'])
const texte = (d: Dokument) => JSON.stringify(d.abschnitte)

describe('„z. B.“ und „E-Mail“ bleiben zusammen', () => {
  it('nur in der Ausgabe: geschütztes Leerzeichen in „z. B.“, geschützter Bindestrich in „E-Mail“', () => {
    expect(festeLeerzeichen('Tabelle (z. B. Excel)')).toBe(`Tabelle (z.${NBSP}B. Excel)`)
    expect(festeLeerzeichen('Z. B. so')).toBe(`Z.${NBSP}B. so`)
    expect(festeLeerzeichen('Name, Telefon, E-Mail, E-Mail-Versand')).toBe('Name, Telefon, E‑Mail, E‑Mail-Versand')
    // andere Bindestriche und Wörter auf „z“ bleiben
    for (const t of ['Lebensmittel-Lieferdienst', 'Satz. Beispiel', 'Satz. B. ist', 'Mail-Server']) expect(festeLeerzeichen(t)).toBe(t)
    // Das Dokument selbst behält die normalen Zeichen
    expect(texte(verfahrensdoku)).toContain('z. B.')
    expect(texte(verzeichnis)).toContain('E-Mail')
  })

  it('DOCX: „z. B.“ mit geschütztem Leerzeichen, „E-Mail“ mit dem geschützten Bindestrich von Word', async () => {
    const vd = await xml(verfahrensdoku)
    expect(vd).toContain(`z.${NBSP}B.`)
    expect(vd).not.toMatch(/z\. B\./)
    const vvt = await xml(verzeichnis)
    expect(vvt).toMatch(/<w:t[^>]*>E<\/w:t><w:noBreakHyphen\/><w:t[^>]*>Mail/)
    expect(vvt).not.toContain('E-Mail')
  })
})

describe('Seitenumbruch nur vor den großen Kapiteln', () => {
  it('Verfahrensdokumentation 2, 3, 4 und 9; Verzeichnis B und C', () => {
    expect(['1', '2', '3', '4', '5', '6', '7', '8', '9'].filter((n) => neueSeiteVor('verfahrensdokumentation', n))).toEqual(['2', '3', '4', '9'])
    expect(['A', 'B', 'C', 'D'].filter((n) => neueSeiteVor('verarbeitungsverzeichnis', n))).toEqual(['B', 'C'])
  })

  it('DOCX: Seitenumbruch vor genau diesen Überschriften', async () => {
    const umbrueche = (x: string) => [...x.matchAll(/<w:p>(?:(?!<\/w:p>).)*?<w:pageBreakBefore\/>(?:(?!<\/w:p>).)*?<w:t[^>]*>([^<]*)</g)].map((m) => m[1].split(' ')[0])
    expect(umbrueche(await xml(verfahrensdoku))).toEqual(['2', '3', '4', '9'])
    expect(umbrueche(await xml(verzeichnis))).toEqual(['B', 'C'])
  })
})

describe('Formulare und Absätze an der Seitengrenze (DOCX)', () => {
  it('9.2 Nachweis der Einweisung: jede Zeile bleibt bei der nächsten, die Tabelle auf einer Seite', async () => {
    const vd = await xml(verfahrensdoku)
    const tabellen = vd.split('<w:tbl>').slice(1).map((t) => t.slice(0, t.indexOf('</w:tbl>')))
    const formular = tabellen.find((t) => t.includes('Unterschrift'))!
    const zeilen = formular.split('<w:tr>').slice(1)
    expect(zeilen).toHaveLength(9)
    // Word hält eine Zeile bei der nächsten, wenn die Absätze ihrer Zellen „mit dem nächsten zusammenhalten“
    expect(zeilen.slice(0, -1).every((z) => z.includes('<w:keepNext/>'))).toBe(true)
    expect(zeilen[zeilen.length - 1]).not.toContain('<w:keepNext/>')
    // andere Tabellen dürfen umbrechen
    expect(tabellen.find((t) => t.includes('Beispiel 2026'))).not.toContain('<w:keepNext/>')
  })

  it('Absätze mit Absatzkontrolle (keine einzelne Zeile am Seitenrand)', async () => {
    const vd = await xml(verfahrensdoku)
    const absatz = vd.split('<w:p>').find((p) => p.includes('Für Kaufleute gelten zusätzlich'))!
    expect(absatz).toContain('<w:widowControl/>')
  })
})
