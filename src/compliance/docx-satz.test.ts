import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { beispielLieferdienst } from '../modell/beispiel'
import { complianceLieferdienst } from './beispiel'
import { erzeugeDocx } from './docx'
import { textBreite } from './schriftbreite'
import { entwurfsKontext, erzeugeDokumente, freigeben, versionsKontext } from './versionen'

// Word-Datei: Sprache, Satzbild und Tabellen (recht-8, recht-17, recht-18)

/** geschütztes Leerzeichen */
const NBSP = String.fromCharCode(0xa0)
/** Satzbreite A4 hoch mit 2 cm Rand in Twips */
const SATZ = 11906 - 2 * 1134

function dateien(bytes: Uint8Array): Record<string, string> {
  return Object.fromEntries(Object.entries(unzipSync(bytes)).map(([name, inhalt]) => [name, strFromU8(inhalt)]))
}

interface WordTabelle {
  xml: string
  spalten: number[]
  rand: number
  zeilen: string[][]
}

function tabellen(xml: string): WordTabelle[] {
  return xml
    .split('<w:tbl>')
    .slice(1)
    .map((t) => t.slice(0, t.indexOf('</w:tbl>')))
    .map((t) => {
      const mar = /<w:tblCellMar>(.*?)<\/w:tblCellMar>/.exec(t)?.[1] ?? ''
      const seite = (s: string) => Number(new RegExp(`<w:${s} w:type="dxa" w:w="(\\d+)"`).exec(mar)?.[1] ?? 108)
      return {
        xml: t,
        spalten: [...t.matchAll(/<w:gridCol w:w="(\d+)"/g)].map((m) => Number(m[1])),
        rand: seite('left') + seite('right'),
        zeilen: t
          .split(/<w:tr[ >]/)
          .slice(1)
          .map((z) => z.split('<w:tc>').slice(1).map((c) => [...c.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(''))),
      }
    })
}

/** Absatz (w:p) mit diesem Text */
function absatz(xml: string, text: string): string {
  const p = xml.split('<w:p>').find((x) => x.includes(text))
  if (!p) throw new Error(`kein Absatz mit „${text}“`)
  return p.slice(0, p.indexOf('</w:p>'))
}

const p = beispielLieferdienst()
const c = complianceLieferdienst()
const entwurf = erzeugeDokumente(p, c, entwurfsKontext(c, '2026-11-11'))

/** Zwei Versionen: Kapitel 7 hat dann gültig bis, aufbewahren bis und die Prüfsumme der Version 1.0 */
async function zweiteVersion() {
  const v1 = await freigeben(p, c, { bezeichnung: '1.0', gueltigAb: '2026-11-11', freigegebenVon: 'Erika Mustermann', aenderung: 'Erstfassung' }, '2026-11-11')
  const c1 = { ...c, versionen: [v1] }
  const v2 = await freigeben(p, c1, { bezeichnung: '2.0', gueltigAb: '2027-01-01', freigegebenVon: 'Erika Mustermann', aenderung: 'Jährliche Durchsicht' }, '2026-12-15')
  return erzeugeDokumente(p, { ...c1, versionen: [v1, v2] }, versionsKontext(v2, [v1, v2])).verfahrensdoku
}

/** Lange Systemnamen in Tabelle 3.1 */
function langeNamen() {
  const lang = { ...p, medien: p.medien.map((m) => (m.id === 'med_erp' ? { ...m, name: 'Warenwirtschaftssystem' } : m.id === 'med_excel' ? { ...m, name: 'Buchhaltungssoftware', art: 'fachanwendung' as const } : m)) }
  return erzeugeDokumente(lang, c, entwurfsKontext(c, '2026-11-11')).verfahrensdoku
}

/** Wörter, die keine Spalte von 3.1 ganz aufnehmen kann */
function ueberlangeNamen() {
  const lang = { ...p, medien: p.medien.map((m) => (m.id === 'med_erp' ? { ...m, name: 'Warenwirtschaftsverwaltungsprogrammsystem' } : m)) }
  const mitHersteller = { ...c, systeme: { ...c.systeme, med_erp: { ...c.systeme.med_erp, hersteller: 'Großhandelssoftwareentwicklungsgesellschaft' } } }
  return erzeugeDokumente(lang, mitHersteller, entwurfsKontext(c, '2026-11-11')).verfahrensdoku
}

/** Wörter mit Ziffer (Daten, Versionen, Prüfsummen), die Word nie trennen darf */
const MIT_ZIFFER = /\d/

describe('Word-Datei: Sprache und Satzbild', () => {
  it('ist als Deutsch ausgezeichnet (recht-17)', async () => {
    for (const d of [entwurf.verfahrensdoku, entwurf.verzeichnis]) {
      const styles = dateien(await erzeugeDocx(d))['word/styles.xml']
      expect(/<w:rPrDefault>(.*?)<\/w:rPrDefault>/.exec(styles)?.[1]).toContain('<w:lang w:val="de-DE"/>')
    }
  })

  it('nennt den Prozesslotsen als letzten Bearbeiter statt „Un-named“ (recht-18)', async () => {
    const d = dateien(await erzeugeDocx(entwurf.verzeichnis))
    expect(d['docProps/core.xml']).toContain('<cp:lastModifiedBy>Prozesslotse</cp:lastModifiedBy>')
  })

  it('setzt Abstand nach Absätzen und vor Zwischenüberschriften (recht-18)', async () => {
    const xml = dateien(await erzeugeDocx(entwurf.verfahrensdoku))['word/document.xml']
    const nach = (x: string) => Number(/<w:spacing [^>]*w:after="(\d+)"/.exec(x)?.[1] ?? 0)
    const vor = (x: string) => Number(/<w:spacing [^>]*w:before="(\d+)"/.exec(x)?.[1] ?? 0)
    // 6 pt nach einem Absatz und einem Hinweis, Abstand vor Überschriften der Ebenen 2 und 3
    expect(nach(absatz(xml, 'Den Ablauf zeigt das Diagramm in Kapitel 9.1.'))).toBeGreaterThanOrEqual(120)
    expect(nach(absatz(xml, 'Das Ablaufdiagramm liegt als BPMN-Datei bei'))).toBeGreaterThanOrEqual(120)
    const ebene2 = xml.split('<w:p>').filter((x) => x.includes('<w:pStyle w:val="Heading2"/>'))
    const ebene3 = xml.split('<w:p>').filter((x) => x.includes('<w:pStyle w:val="Heading3"/>'))
    expect(ebene2.length).toBeGreaterThan(5)
    expect(ebene3.length).toBeGreaterThan(0)
    for (const h of [...ebene2, ...ebene3]) expect(vor(h)).toBeGreaterThanOrEqual(180)
  })

  it('hält §, Abs., Nr., Art., Rz. und lit. mit dem Folgenden zusammen (recht-18)', async () => {
    for (const d of [entwurf.verfahrensdoku, entwurf.verzeichnis]) {
      const xml = dateien(await erzeugeDocx(d))['word/document.xml']
      expect(xml).toContain(`§${NBSP}147`)
      expect(xml.match(/(?:§§?|\b(?:Abs|Nr|Art|Rz|lit|Ziff)\.) [\dA-Za-z]/g)).toBeNull()
    }
  })
})

describe('Word-Datei: Tabellen (recht-8)', () => {
  it('misst Calibri wie Word', () => {
    expect(textBreite('0123456789', 10)).toBeCloseTo(50.7)
    expect(textBreite('~', 10)).toBeCloseTo(4.98)
    expect(textBreite('Aufbewahrung', 9, true)).toBeCloseTo(55.6, 1)
    expect(textBreite(`ß${NBSP}×`, 10, true)).toBeCloseTo(5.55 + 2.26 + 4.98)
  })

  it('setzt Tabellen in 9 pt mit festen Spaltenbreiten über die ganze Satzbreite', async () => {
    const ts = tabellen(dateien(await erzeugeDocx(entwurf.verfahrensdoku))['word/document.xml'])
    expect(ts.length).toBeGreaterThan(5)
    for (const t of ts) {
      expect(t.xml).toContain('<w:tblLayout w:type="fixed"/>')
      expect(Math.abs(t.spalten.reduce((a, b) => a + b, 0) - SATZ)).toBeLessThanOrEqual(2)
      const groessen = [...t.xml.matchAll(/<w:sz w:val="(\d+)"\/>/g)].map((m) => m[1])
      expect(new Set(groessen)).toEqual(new Set(['18']))
    }
  })

  it('bricht Daten, Prüfsummen und Wörter nicht mitten im Zeichen um: jedes Wort passt in seine Spalte', async () => {
    const dokumente = { entwurf: entwurf.verfahrensdoku, verzeichnis: entwurf.verzeichnis, 'Version 2.0': await zweiteVersion(), 'lange Namen': langeNamen() }
    let pruefsummen = 0
    for (const [name, d] of Object.entries(dokumente)) {
      for (const t of tabellen(dateien(await erzeugeDocx(d))['word/document.xml'])) {
        t.zeilen.forEach((zeile, i) =>
          zeile.forEach((zelle, j) => {
            // Word bricht an Leerzeichen und nach Bindestrichen um („Excel-|Tourenliste“), sonst nur mitten im Wort
            for (const wort of zelle.split(/[ \n]+|(?<=-)/).filter(Boolean)) {
              // 1 pt Reserve für die Rundung in Word
              const breite = (textBreite(wort, 9, i === 0) + 1) * 20
              expect(breite, `${name}: „${wort}“ in Spalte ${j + 1} (${t.zeilen[0][j]})`).toBeLessThanOrEqual(t.spalten[j] - t.rand)
              if (/^[0-9a-f]{12}$/.test(wort)) pruefsummen++
            }
          }),
        )
      }
    }
    expect(pruefsummen).toBeGreaterThan(0)
  })

  it('schaltet die Silbentrennung nur ein, wenn ein Wort sonst nicht in seine Spalte passt; Daten bleiben ganz', async () => {
    for (const d of [entwurf.verfahrensdoku, entwurf.verzeichnis, langeNamen()]) expect(dateien(await erzeugeDocx(d))['word/settings.xml']).not.toContain('autoHyphenation')
    const d = dateien(await erzeugeDocx(ueberlangeNamen()))
    expect(d['word/settings.xml']).toMatch(/<w:autoHyphenation(?: w:val="(?:true|1)")?\/>/)
    for (const t of tabellen(d['word/document.xml'])) {
      t.zeilen.forEach((zeile, i) =>
        zeile.forEach((zelle, j) => {
          for (const wort of zelle.split(/[ \n]+|(?<=-)/).filter((w) => MIT_ZIFFER.test(w))) expect((textBreite(wort, 9, i === 0) + 1) * 20, `„${wort}“`).toBeLessThanOrEqual(t.spalten[j] - t.rand)
        }),
      )
    }
  })
})
