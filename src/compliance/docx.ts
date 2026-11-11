/**
 * Dokument → Word-Datei (Spezifikation 7.4). Die Bibliothek `docx` wird erst
 * beim ersten Export geladen, damit sie die Oberfläche nicht vergrößert.
 * Überschriften nutzen die Formatvorlagen „Überschrift 1–3“, damit
 * Navigationsbereich und Inhaltsverzeichnis in Word funktionieren.
 */
import { gliederung } from './dokument'
import { textBreite } from './schriftbreite'
import { fusszeile, istEntwurf } from './textbausteine'
import type { Dokument } from './typen'
import { festeLeerzeichen } from './typografie'

/** A4 hoch in Twips, Ränder 2 cm */
const SEITE = { breite: 11906, hoehe: 16838, rand: 1134 }
/** Satzbreite in Twips */
const SATZ = SEITE.breite - 2 * SEITE.rand
/** Tabellen in 9 pt (Word zählt halbe Punkte), Innenabstand links und rechts je 4 pt (in Twips) */
const TABELLE = { pt: 9, groesse: 18, rand: 80 }
/** 6 pt Abstand nach Absätzen, in Twips */
const NACH = 120

export const DIAGRAMM_VERWEIS = 'Das Ablaufdiagramm liegt als BPMN-Datei bei und ist in der Druckfassung enthalten.'

/** Wort aus Buchstaben, das Word nach Silben trennen kann (Dokumentsprache Deutsch) */
const TRENNBAR = /^[„"(]*\p{L}{6,}[-,.;:)“"]*$/u

/**
 * Spaltenbreiten in Twips nach dem Inhalt, ähnlich wie ein Browser Tabellen setzt:
 * Jede Spalte bekommt mindestens ihr breitestes Wort, damit Word Daten, Zahlen und
 * Prüfsummen nicht mitten im Zeichen umbricht; der übrige Platz verteilt sich nach
 * der Länge der Texte. Reicht der Platz nicht, werden nur die längsten Wörter aus
 * Buchstaben gekürzt; `silbentrennung` sagt dann, dass Word sie trennen muss.
 */
export function spaltenbreiten(kopf: string[], zeilen: string[][], satz = SATZ): { breiten: number[]; silbentrennung: boolean } {
  const n = kopf.length
  const summe = (a: number[]) => a.reduce((x, y) => x + y, 0)
  // leere Tabellen (Unterschriften) gleichmäßig
  if (zeilen.every((z) => z.every((t) => !t.trim()))) return { breiten: ganzzahlig(Array<number>(n).fill(satz / n), satz), silbentrennung: false }
  const tw = (text: string, fett: boolean) => textBreite(text, TABELLE.pt, fett) * 20
  const hart = Array<number>(n).fill(0)
  const weich = Array<number>(n).fill(0)
  const voll = Array<number>(n).fill(0)
  ;[kopf, ...zeilen].forEach((zeile, z) =>
    zeile.forEach((roh, j) => {
      const text = festeLeerzeichen(roh)
      voll[j] = Math.max(voll[j], ...text.split('\n').map((t) => tw(t, z === 0)))
      // Word bricht an Leerzeichen und nach Bindestrichen um, nicht am geschützten Leerzeichen
      for (const teil of text.split(/[ \t\n]+|(?<=-)/)) {
        if (!teil) continue
        const b = tw(teil, z === 0)
        if (TRENNBAR.test(teil)) weich[j] = Math.max(weich[j], b)
        else hart[j] = Math.max(hart[j], b)
      }
    }),
  )
  // Innenabstand links und rechts und 1,5 pt Reserve
  const rand = 2 * TABELLE.rand + 30
  // Mindestbreite, wenn Wörter aus Buchstaben höchstens `deckel` breit sein dürfen
  const mindest = (deckel: number) => hart.map((h, j) => Math.max(h, Math.min(weich[j], deckel)) + rand)
  const laengstes = Math.max(...weich)
  const bequem = voll.map((v, j) => Math.max(v + rand, mindest(laengstes)[j]))
  if (summe(bequem) <= satz) return { breiten: ganzzahlig(bequem.map((b) => (b * satz) / summe(bequem)), satz), silbentrennung: false }
  // größter Deckel, mit dem alles passt
  let deckel = laengstes
  if (summe(mindest(deckel)) > satz) {
    let unten = 0
    for (let i = 0; i < 30; i++) {
      const mitte = (unten + deckel) / 2
      if (summe(mindest(mitte)) <= satz) unten = mitte
      else deckel = mitte
    }
    deckel = unten
  }
  const basis = mindest(deckel)
  const silbentrennung = deckel < laengstes
  const frei = satz - summe(basis)
  if (frei < 0) return { breiten: ganzzahlig(basis.map((b) => (b * satz) / summe(basis)), satz), silbentrennung }
  const spiel = bequem.map((b, j) => b - basis[j])
  return { breiten: ganzzahlig(basis.map((b, j) => b + (summe(spiel) > 0 ? (frei * spiel[j]) / summe(spiel) : frei / n)), satz), silbentrennung }
}

/** Auf ganze Twips; die letzte Spalte gleicht die Rundung aus. */
function ganzzahlig(breiten: number[], satz: number): number[] {
  const r = breiten.map((b) => Math.floor(b))
  r[r.length - 1] += satz - r.reduce((x, y) => x + y, 0)
  return r
}

export async function erzeugeDocx(d: Dokument): Promise<Uint8Array> {
  const { AlignmentType, Document, Footer, HeadingLevel, HeightRule, Packer, PageBreak, PageNumber, Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType } = await import('docx')
  type Kind = InstanceType<typeof Paragraph> | InstanceType<typeof Table>
  const ebene = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 } as const
  // Abstand vor und nach Überschriften; Ebene 1 beginnt ohnehin auf einer neuen Seite
  const abstand = { 1: { after: NACH }, 2: { before: 240, after: 80 }, 3: { before: 180, after: 60 } } as const
  const grau = { type: ShadingType.CLEAR, color: 'auto', fill: 'EDEDEB' }
  /** Text mit geschützten Leerzeichen nach §, Abs., Nr. usw. */
  const lauf = (text: string) => new TextRun(festeLeerzeichen(text))

  // Silbentrennung nur, wenn ein Wort sonst nicht in seine Spalte passt; sonst bleibt der Satz ohne Trennstriche
  let silbentrennung = false
  const zelle = (text: string, kopf: boolean) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: festeLeerzeichen(text), bold: kopf, size: TABELLE.groesse })] })] })
  const tabelle = (kopf: string[], zeilen: string[][]) => {
    const spalten = spaltenbreiten(kopf, zeilen)
    silbentrennung ||= spalten.silbentrennung
    return new Table({
      width: { size: SATZ, type: WidthType.DXA },
      columnWidths: spalten.breiten,
      layout: TableLayoutType.FIXED,
      margins: { left: TABELLE.rand, right: TABELLE.rand },
      rows: [
        new TableRow({ tableHeader: true, cantSplit: true, children: kopf.map((t) => zelle(t, true)) }),
        // leere Zeilen (z. B. Unterschriften) bekommen Platz zum Ausfüllen
        ...zeilen.map((z) => new TableRow({ cantSplit: true, height: z.every((t) => !t) ? { value: 567, rule: HeightRule.ATLEAST } : undefined, children: z.map((t) => zelle(t, false)) })),
      ],
    })
  }

  const erste = d.abschnitte.findIndex((a) => a.art === 'ueberschrift')
  const deckblatt = erste < 0 ? d.abschnitte : d.abschnitte.slice(0, erste)
  const inhalt = erste < 0 ? [] : d.abschnitte.slice(erste)

  const kinder: Kind[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(d.titel)] }),
    new Paragraph({ children: [new TextRun({ text: festeLeerzeichen(d.untertitel), size: 28 })] }),
  ]
  for (const a of deckblatt) {
    if (a.art === 'hinweis') kinder.push(new Paragraph({ shading: grau, spacing: { before: 240 }, children: [lauf(a.text)] }))
    else if (a.art === 'absatz') kinder.push(new Paragraph({ spacing: { before: 120 }, children: [lauf(a.text)] }))
  }
  kinder.push(new Paragraph({ children: [new PageBreak()] }))
  kinder.push(new Paragraph({ children: [new TextRun({ text: 'Gliederung', bold: true, size: 28 })] }))
  for (const g of gliederung(d)) kinder.push(new Paragraph({ indent: { left: g.ebene === 2 ? 425 : 0 }, children: [lauf(`${g.nummer} ${g.text}`)] }))

  for (const a of inhalt) {
    switch (a.art) {
      case 'ueberschrift':
        kinder.push(new Paragraph({ heading: ebene[a.ebene], pageBreakBefore: a.ebene === 1, keepNext: true, spacing: abstand[a.ebene], children: [lauf(`${a.nummer} ${a.text}`)] }))
        break
      case 'absatz':
        kinder.push(new Paragraph({ spacing: { after: NACH }, children: [lauf(a.text)] }))
        break
      case 'hinweis':
        kinder.push(new Paragraph({ shading: grau, spacing: { after: NACH }, children: [lauf(a.text)] }))
        break
      case 'liste':
        // Abstand erst nach dem letzten Punkt
        a.punkte.forEach((p, i) => kinder.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: i === a.punkte.length - 1 ? NACH : 40 }, children: [lauf(p)] })))
        break
      case 'tabelle':
        kinder.push(tabelle(a.kopf, a.zeilen))
        // Abstand nach der Tabelle
        kinder.push(new Paragraph({ children: [] }))
        break
      case 'diagramm':
        kinder.push(new Paragraph({ shading: grau, spacing: { after: NACH }, children: [new TextRun(DIAGRAMM_VERWEIS)] }))
        break
    }
  }

  const klein = 16
  const fuss = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `${fusszeile(d)} · Seite `, size: klein }),
          new TextRun({ children: [PageNumber.CURRENT], size: klein }),
          new TextRun({ text: ' von ', size: klein }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: klein }),
        ],
      }),
    ],
  })

  const dokument = new Document({
    creator: 'Prozesslotse',
    // sonst „Un-named“, der Standard der Bibliothek
    lastModifiedBy: 'Prozesslotse',
    title: `${d.titel} – ${d.untertitel}`,
    // Entwurf: Vorlage zur Prüfung; freigegeben: Verantwortung beim Unternehmen (recht-5)
    description: istEntwurf(d) ? 'Vorlage zur Prüfung durch Steuerberatung bzw. Datenschutzbeauftragten.' : 'Aus einer Vorlage mit dem Prozesslotsen erstellt; die Verantwortung für den Inhalt liegt beim Unternehmen.',
    // Deutsch auch in einem anders eingestellten Word: Rechtschreibprüfung, Silbentrennung, Sprache im PDF
    styles: { default: { document: { run: { font: 'Calibri', size: 21, language: { value: 'de-DE' } } } } },
    hyphenation: silbentrennung ? { autoHyphenation: true } : undefined,
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
