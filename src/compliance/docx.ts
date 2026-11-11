/**
 * Dokument → Word-Datei (Spezifikation 7.4). Die Bibliothek `docx` wird erst
 * beim ersten Export geladen, damit sie die Oberfläche nicht vergrößert.
 * Überschriften nutzen die Formatvorlagen „Überschrift 1–3“, damit
 * Navigationsbereich und Inhaltsverzeichnis in Word funktionieren.
 */
import { gliederung } from './dokument'
import { FUSSZEILE_VORLAGE } from './textbausteine'
import type { Dokument } from './typen'

/** A4 hoch in Twips, Ränder 2 cm */
const SEITE = { breite: 11906, hoehe: 16838, rand: 1134 }

export const DIAGRAMM_VERWEIS = 'Das Ablaufdiagramm liegt als BPMN-Datei bei und ist in der Druckfassung enthalten.'

export async function erzeugeDocx(d: Dokument): Promise<Uint8Array> {
  const { AlignmentType, Document, Footer, HeadingLevel, HeightRule, Packer, PageBreak, PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } = await import('docx')
  type Kind = InstanceType<typeof Paragraph> | InstanceType<typeof Table>
  const ebene = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 } as const
  const grau = { type: ShadingType.CLEAR, color: 'auto', fill: 'EDEDEB' }
  const version = d.versionText === 'Entwurf' ? 'Entwurf' : `Version ${d.versionText}`

  const zelle = (text: string, kopf: boolean) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: kopf })] })] })
  const tabelle = (kopf: string[], zeilen: string[][]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, cantSplit: true, children: kopf.map((t) => zelle(t, true)) }),
        // leere Zeilen (z. B. Unterschriften) bekommen Platz zum Ausfüllen
        ...zeilen.map((z) => new TableRow({ cantSplit: true, height: z.every((t) => !t) ? { value: 567, rule: HeightRule.ATLEAST } : undefined, children: z.map((t) => zelle(t, false)) })),
      ],
    })

  const erste = d.abschnitte.findIndex((a) => a.art === 'ueberschrift')
  const deckblatt = erste < 0 ? d.abschnitte : d.abschnitte.slice(0, erste)
  const inhalt = erste < 0 ? [] : d.abschnitte.slice(erste)

  const kinder: Kind[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(d.titel)] }),
    new Paragraph({ children: [new TextRun({ text: d.untertitel, size: 28 })] }),
  ]
  for (const a of deckblatt) {
    if (a.art === 'hinweis') kinder.push(new Paragraph({ shading: grau, spacing: { before: 240 }, children: [new TextRun(a.text)] }))
    else if (a.art === 'absatz') kinder.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun(a.text)] }))
  }
  kinder.push(new Paragraph({ children: [new PageBreak()] }))
  kinder.push(new Paragraph({ children: [new TextRun({ text: 'Gliederung', bold: true, size: 28 })] }))
  for (const g of gliederung(d)) kinder.push(new Paragraph({ indent: { left: g.ebene === 2 ? 425 : 0 }, children: [new TextRun(`${g.nummer} ${g.text}`)] }))

  for (const a of inhalt) {
    switch (a.art) {
      case 'ueberschrift':
        kinder.push(new Paragraph({ heading: ebene[a.ebene], pageBreakBefore: a.ebene === 1, keepNext: true, children: [new TextRun(`${a.nummer} ${a.text}`)] }))
        break
      case 'absatz':
        kinder.push(new Paragraph({ children: [new TextRun(a.text)] }))
        break
      case 'hinweis':
        kinder.push(new Paragraph({ shading: grau, children: [new TextRun(a.text)] }))
        break
      case 'liste':
        for (const p of a.punkte) kinder.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(p)] }))
        break
      case 'tabelle':
        kinder.push(tabelle(a.kopf, a.zeilen))
        // Abstand nach der Tabelle
        kinder.push(new Paragraph({ children: [] }))
        break
      case 'diagramm':
        kinder.push(new Paragraph({ shading: grau, children: [new TextRun(DIAGRAMM_VERWEIS)] }))
        break
    }
  }

  const klein = 16
  const fuss = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `${FUSSZEILE_VORLAGE} · ${d.titel} · ${version} · Seite `, size: klein }),
          new TextRun({ children: [PageNumber.CURRENT], size: klein }),
          new TextRun({ text: ' von ', size: klein }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: klein }),
        ],
      }),
    ],
  })

  const dokument = new Document({
    creator: 'Prozesslotse',
    title: `${d.titel} – ${d.untertitel}`,
    description: 'Vorlage zur Prüfung durch Steuerberatung bzw. Datenschutzbeauftragten.',
    styles: { default: { document: { run: { font: 'Calibri', size: 21 } } } },
    sections: [
      {
        properties: { page: { size: { width: SEITE.breite, height: SEITE.hoehe }, margin: { top: SEITE.rand, right: SEITE.rand, bottom: SEITE.rand, left: SEITE.rand } } },
        footers: { default: fuss },
        children: kinder,
      },
    ],
  })
  return new Uint8Array(await Packer.toArrayBuffer(dokument))
}

/** „…-verfahrensdokumentation-entwurf.docx“ bzw. „…-verfahrensdokumentation-v1-0.docx“ */
export function docxEndung(d: Dokument): string {
  const art = d.art === 'verfahrensdokumentation' ? 'verfahrensdokumentation' : 'verarbeitungsverzeichnis'
  const version = d.versionText === 'Entwurf' ? 'entwurf' : `v${d.versionText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
  return `-${art}-${version}.docx`
}
