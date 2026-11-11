/**
 * Zusammenführung von fix/druck-nach in compliance: Wer einen eingefrorenen Prozess anzeigt oder
 * druckt (Vorschau, Druck mit Anlage 9.1, Windows-Programm, DOCX), nimmt `eingefrorenerProzess(v)`,
 * nie `v.prozess`. `v.prozess` ist der Rohstand, über den die Prüfsumme gerechnet ist (6.8); er kann
 * ein älteres Format haben. Ein Diagramm aus ihm sähe das Laden nie, und wer ihn anpasste, zerstörte
 * die Prüfsumme. Das Layout ist gegen fehlende Felder abgesichert, deshalb fiele ein Rückfall auf
 * `v.prozess` im Browser nicht auf; dieser Test liest darum die Quelltexte.
 */
import { describe, expect, it } from 'vitest'
import { alsJson, leseProjektText } from '../modell/speicher'
import { beispielMitCompliance } from './beispiel'
import { eingefrorenerProzess } from './speicher'
import { freigeben, pruefsumme, pruefsummeStimmt } from './versionen'

const QUELLEN = import.meta.glob<string>(['../**/*.ts', '../**/*.tsx', '!../**/*.test.ts'], { query: '?raw', import: 'default', eager: true })
const datei = (name: string): string => {
  const pfad = Object.keys(QUELLEN).find((p) => p.endsWith(`/${name}`))
  if (!pfad) throw new Error(`${name} fehlt`)
  return QUELLEN[pfad]
}
/** Code ohne Kommentarzeilen */
const codezeilen = (text: string) =>
  text
    .split('\n')
    .map((z) => z.trim())
    .filter((z) => z && !z.startsWith('//') && !z.startsWith('*') && !z.startsWith('/*'))

describe('Eingefrorene Prozesse nur über eingefrorenerProzess(v)', () => {
  it('liest alle Quelltexte (Oberfläche, Compliance, DOCX)', () => {
    expect(Object.keys(QUELLEN).length).toBeGreaterThan(50)
    for (const name of ['DokumenteTeil.tsx', 'DokumentAnsicht.tsx', 'DiagrammDruck.tsx', 'docx.ts', 'versionen.ts', 'speicher.ts']) expect(datei(name).length).toBeGreaterThan(0)
  })

  it('auf `.prozess` greifen nur Prüfsumme, Ladeprüfung und eingefrorenerProzess selbst zu', () => {
    const zugriffe: string[] = []
    // Schlüssel relativ zu src/compliance: „./speicher.ts“, „../ui/…“
    const ort = (pfad: string) => pfad.replace(/^\.\//, 'compliance/').replace(/^\.\.\//, '')
    for (const [pfad, text] of Object.entries(QUELLEN)) for (const z of codezeilen(text)) if (/\.prozess\b/.test(z)) zugriffe.push(`${ort(pfad)}: ${z}`)
    expect(zugriffe.sort()).toEqual(
      [
        // Ladeprüfung: Kopie für Anzeige anlegen, Rohstand unverändert
        'compliance/speicher.ts: pruefeEingefrorenenProzess(o.prozess, `${p}.prozess`)',
        // eingefrorenerProzess
        'compliance/speicher.ts: let p = angepasst.get(v.prozess)',
        'compliance/speicher.ts: p = passeAn(v.prozess)',
        'compliance/speicher.ts: p = v.prozess',
        'compliance/speicher.ts: angepasst.set(v.prozess, p)',
        // Prüfsumme über den Rohstand (6.8)
        'compliance/versionen.ts: const daten = new TextEncoder().encode(kanonischesJson([v.prozess, v.verfahrensdoku, v.verzeichnis]))',
      ].sort(),
    )
  })

  it('Vorschau und Druck einer Version bekommen den angepassten Prozess; Druck und DOCX lesen keinen Prozess', () => {
    expect(datei('DokumenteTeil.tsx')).toContain('<DokumentAnsicht dokument={dokument} prozess={version ? eingefrorenerProzess(version) : ist} />')
    // Anlage 9.1 im Druck entsteht aus dem SVG des Diagramms, das DokumentAnsicht aus seinem Prozess zeichnet
    expect(datei('DiagrammDruck.tsx')).not.toMatch(/prozess/i)
    expect(datei('DokumentAnsicht.tsx')).toContain('useBpmn(prozess)')
    // DOCX: nur das eingefrorene Dokument, das Diagramm liegt als BPMN-Datei bei
    expect(datei('docx.ts')).not.toMatch(/\bprozess\b/)
  })

  it('ein Rohstand in Format 2 bleibt unverändert, die Anzeige bekommt Format 3; die Prüfsumme stimmt', async () => {
    const p = beispielMitCompliance()
    const v = await freigeben(p.ist, p.compliance!, { bezeichnung: '1.0', gueltigAb: '2026-11-11', freigegebenVon: 'Erika Mustermann', aenderung: 'Erstfassung', geprueftVon: 'Steuerberatung Muster', geprueftAm: '2026-11-10' }, '2026-11-11')
    const roh = v.prozess as unknown as Record<string, unknown>
    roh.formatVersion = 2
    delete roh.teilnehmer
    v.pruefsumme = await pruefsumme(v)
    const geladen = leseProjektText(alsJson({ ...p, compliance: { ...p.compliance!, versionen: [v] } })).compliance!.versionen[0]
    const anzeige = eingefrorenerProzess(geladen)
    expect(anzeige).not.toBe(geladen.prozess)
    expect(anzeige.formatVersion).toBe(3)
    expect(geladen.prozess.formatVersion).toBe(2)
    expect(geladen.fachlichGeprueft).toEqual({ von: 'Steuerberatung Muster', am: '2026-11-10' })
    expect(await pruefsummeStimmt(geladen)).toBe(true)
  })
})
