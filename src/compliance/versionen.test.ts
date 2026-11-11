import { describe, expect, it } from 'vitest'
import { beispielLieferdienst } from '../modell/beispiel'
import { aendereBlock } from '../modell/operationen'
import { alsJson, leseProjekt, leseProjektText } from '../modell/speicher'
import type { Prozess } from '../modell/typen'
import { beispielMitCompliance, complianceLieferdienst } from './beispiel'
import { aufbewahrenBis, gueltigBisIn } from './fristen'
import { pruefeCompliance } from './regeln'
import type { ComplianceProjekt, DokuVersion } from './typen'
import { freigeben, FreigabeFehler, geaenderteKapitel, naechsteBezeichnung, pruefsumme } from './versionen'

const HEUTE = '2026-11-11'
const ERSTE = { bezeichnung: '1.0', gueltigAb: HEUTE, freigegebenVon: 'Erika Mustermann', aenderung: 'Erstfassung' }

async function mitErsterVersion(): Promise<{ c: ComplianceProjekt; v: DokuVersion }> {
  const c = complianceLieferdienst()
  const v = await freigeben(beispielLieferdienst(), c, ERSTE, HEUTE)
  return { c: { ...c, versionen: [v] }, v }
}

function umbenannt(p: Prozess, id: string, name: string): Prozess {
  return aendereBlock(p, id, (b) => (b.typ === 'aufgabe' ? { ...b, name } : b))
}

describe('Freigabe (9.7)', () => {
  it('friert die erste Version mit Prüfsumme ein; gleiche Eingabe ergibt gleiche Prüfsumme', async () => {
    const { v } = await mitErsterVersion()
    expect(v.nummer).toBe(1)
    expect(v.geaenderteKapitel).toEqual([])
    expect(v.pruefsumme).toMatch(/^[0-9a-f]{64}$/)
    expect(v.prozess).toEqual(beispielLieferdienst())
    const nochmal = await freigeben(beispielLieferdienst(), complianceLieferdienst(), ERSTE, HEUTE)
    expect(nochmal.pruefsumme).toBe(v.pruefsumme)
  })

  it('rechnet die Prüfsumme nach Speichern und Laden gleich, auch bei anderer Reihenfolge der Schlüssel', async () => {
    const { c } = await mitErsterVersion()
    const projekt = leseProjektText(alsJson({ ...beispielMitCompliance(), compliance: c }))
    const v = projekt.compliance!.versionen[0]
    const umgedreht = <T,>(x: T): T => (Array.isArray(x) ? (x.map(umgedreht) as T) : x && typeof x === 'object' ? (Object.fromEntries(Object.entries(x).reverse().map(([k, w]) => [k, umgedreht(w)])) as T) : x)
    expect(await pruefsumme(umgedreht(v.verfahrensdoku), umgedreht(v.verzeichnis))).toBe(v.pruefsumme)
  })

  it('verlangt ein späteres Gültig-ab und eine neue Bezeichnung', async () => {
    const { c } = await mitErsterVersion()
    await expect(freigeben(beispielLieferdienst(), c, { ...ERSTE, bezeichnung: '2.0', aenderung: 'Neu' }, HEUTE)).rejects.toThrow('Gültig ab muss nach dem 11.11.2026 liegen.')
    await expect(freigeben(beispielLieferdienst(), c, { ...ERSTE, gueltigAb: '2027-01-01' }, HEUTE)).rejects.toThrow('Die Bezeichnung 1.0 gibt es schon.')
    await expect(freigeben(beispielLieferdienst(), c, { ...ERSTE, bezeichnung: '2.0', gueltigAb: '2027-01-01', aenderung: ' ' }, HEUTE)).rejects.toThrow(FreigabeFehler)
    await expect(freigeben(beispielLieferdienst(), complianceLieferdienst(), { ...ERSTE, freigegebenVon: '' }, HEUTE)).rejects.toThrow('Bitte angeben, wer freigibt.')
    await expect(freigeben(beispielLieferdienst(), complianceLieferdienst(), { ...ERSTE, gueltigAb: '2026-02-30' }, HEUTE)).rejects.toThrow('Gültig ab ist kein gültiges Datum.')
    expect(naechsteBezeichnung(c)).toBe('2.0')
  })

  it('erkennt nach Umbenennen einer Aufgabe die geänderten Kapitel und meldet V2', async () => {
    const { c } = await mitErsterVersion()
    const p = umbenannt(beispielLieferdienst(), 'auf_freigeben', 'Rechnung prüfen und freigeben')
    expect(geaenderteKapitel(c.versionen[0], p, c)).toEqual(['VD 3.2', 'VD 3.3', 'VD 4'])
    const v2 = pruefeCompliance(p, c, HEUTE).find((b) => b.regel === 'V2')
    expect(v2?.schwere).toBe('warnung')
    expect(v2?.text).toBe('Seit Version 1.0 geändert: VD 3.2, VD 3.3, VD 4. Neue Version freigeben, damit Dokumentation und Praxis übereinstimmen.')
    // ohne Änderung kein V2
    expect(geaenderteKapitel(c.versionen[0], beispielLieferdienst(), c)).toEqual([])
  })

  it('erkennt einen Wechsel der Geschäftsleitung in Kapitel 1', async () => {
    const { c } = await mitErsterVersion()
    const neu = { ...c, unternehmen: { ...c.unternehmen, geschaeftsleitung: 'Max Beispiel' } }
    expect(geaenderteKapitel(c.versionen[0], beispielLieferdienst(), neu)).toEqual(['VD 1'])
  })

  it('erkennt Änderungen im Verzeichnis', async () => {
    const { c } = await mitErsterVersion()
    const neu = { ...c, verarbeitung: { ...c.verarbeitung, zwecke: [...c.verarbeitung.zwecke, 'Kunden informieren'] } }
    expect(geaenderteKapitel(c.versionen[0], beispielLieferdienst(), neu)).toEqual(['VVT B.1'])
  })

  it('zählt das Datum des letzten Rücksicherungstests nicht als Änderung', async () => {
    const { c } = await mitErsterVersion()
    const neu = { ...c, systeme: { ...c.systeme, med_excel: { ...c.systeme.med_excel, wiederherstellungGetestet: '2026-11-01' } } }
    expect(geaenderteKapitel(c.versionen[0], beispielLieferdienst(), neu)).toEqual([])
  })

  it('setzt bei Version 2 gültig bis und aufbewahren bis der Version 1', async () => {
    const { c } = await mitErsterVersion()
    const p = umbenannt(beispielLieferdienst(), 'auf_freigeben', 'Rechnung prüfen und freigeben')
    const v2 = await freigeben(p, c, { bezeichnung: '2.0', gueltigAb: '2027-04-01', freigegebenVon: 'Erika Mustermann', aenderung: 'Freigabe umbenannt' }, '2027-03-15')
    expect(v2.nummer).toBe(2)
    expect(v2.geaenderteKapitel).toEqual(['VD 3.2', 'VD 3.3', 'VD 4'])
    const versionen = [...c.versionen, v2]
    expect(gueltigBisIn(versionen, 0)).toBe('2027-03-31')
    expect(aufbewahrenBis(gueltigBisIn(versionen, 0))).toBe('2037-12-31')
    // Kapitel 7 der neuen Version zeigt beide Versionen; die eigene Prüfsumme steht noch nicht fest
    const historie = v2.verfahrensdoku.abschnitte.find((a) => a.art === 'tabelle' && a.kopf[0] === 'Version')
    expect(historie && historie.art === 'tabelle' ? historie.zeilen.map((z) => [z[0], z[2], z[6], z[7]]) : []).toEqual([
      ['1.0', '31.03.2027', 'mindestens bis 31.12.2037', c.versionen[0].pruefsumme.slice(0, 12)],
      ['2.0', 'laufend', '10 Jahre nach Ende der Gültigkeit', '–'],
    ])
    // Kapitel 1 nennt den Vorgänger
    expect(JSON.stringify(v2.verfahrensdoku.abschnitte)).toContain('Vorgängerversion: 1.0. Was sich geändert hat, zeigt Kapitel 7.')
  })

  it('misst die Größe einer Version (Ziel unter 150 KB)', async () => {
    const { v } = await mitErsterVersion()
    expect(JSON.stringify(v).length).toBeLessThan(150_000)
  })
})

describe('Laden von Versionen (9.9)', () => {
  it('migriert den eingefrorenen Prozess aus einem älteren Format', async () => {
    const { c } = await mitErsterVersion()
    const daten = JSON.parse(alsJson({ ...beispielMitCompliance(), compliance: c }))
    // von Hand auf Format 2 zurückgesetzt: ohne externe Teilnehmer und mit formatVersion 2
    const alt = daten.compliance.versionen[0].prozess
    alt.formatVersion = 2
    delete alt.teilnehmer
    const projekt = leseProjekt(daten)
    const prozess = projekt.compliance!.versionen[0].prozess
    expect(prozess.formatVersion).toBe(3)
    expect(prozess.teilnehmer).toEqual([])
  })

  it('lehnt beschädigte Versionen mit Feldnamen ab', async () => {
    const { c } = await mitErsterVersion()
    const kaputt = JSON.parse(alsJson({ ...beispielMitCompliance(), compliance: c }))
    kaputt.compliance.versionen[0].prozess.ablauf.schritte[0].typ = 'zauberei'
    expect(() => leseProjekt(kaputt)).toThrow('‚versionen.0.prozess‘ ist kein gültiger Prozess')
    const ohneSumme = JSON.parse(alsJson({ ...beispielMitCompliance(), compliance: c }))
    ohneSumme.compliance.versionen[0].pruefsumme = 'abc'
    expect(() => leseProjekt(ohneSumme)).toThrow('‚versionen.0.pruefsumme‘ ist keine SHA-256-Prüfsumme')
    const abschnitt = JSON.parse(alsJson({ ...beispielMitCompliance(), compliance: c }))
    abschnitt.compliance.versionen[0].verzeichnis.abschnitte[2].art = 'bild'
    expect(() => leseProjekt(abschnitt)).toThrow('‚versionen.0.verzeichnis.abschnitte.2.art‘')
  })
})

describe('Durchsicht: Dokumentarten in Versionen', () => {
  it('lehnt vertauschte Dokumente ab', async () => {
    const { c } = await mitErsterVersion()
    const d = JSON.parse(alsJson({ ...beispielMitCompliance(), compliance: c }))
    const v = d.compliance.versionen[0]
    ;[v.verfahrensdoku, v.verzeichnis] = [v.verzeichnis, v.verfahrensdoku]
    expect(() => leseProjekt(d)).toThrow('‚versionen.0.verfahrensdoku.art‘ muss „verfahrensdokumentation“ sein')
  })
})
