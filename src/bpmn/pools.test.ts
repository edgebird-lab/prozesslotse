/**
 * Externe Teilnehmer (Kunde, Lieferant) als eigene Pools mit Nachrichtenflüssen.
 */
import { describe, expect, it } from 'vitest'
import { BpmnModdle } from 'bpmn-moddle'
import { berechneKennzahlen } from '../analyse/kennzahlen'
import { findeSchwachstellen } from '../analyse/hinweise'
import { neueAufgabe, neuerProzess, neuerTeilnehmer, neuesWarten } from '../modell/bausteine'
import { beispielLieferdienst, beispielOnlinebestellung } from '../modell/beispiel'
import { entferneTeilnehmer, findeBlock, nachrichtenVerweise } from '../modell/operationen'
import { pruefeProzess } from '../modell/pruefung'
import { alsJson, leseProjektText } from '../modell/speicher'
import { neuesProjekt } from '../modell/bausteine'
import { zufallsProzess } from '../testhilfen/zufallsprozess'
import { geometrieFehler } from '../testhilfen/geometrie'
import { erzeugeBpmn } from './export'

describe('Externe Teilnehmer als Pools', () => {
  it('exportiert den Kunden als Pool ohne Inhalt mit fünf Nachrichtenflüssen', async () => {
    const p = beispielOnlinebestellung()
    const { xml, layout } = erzeugeBpmn(p)
    expect(layout.pools).toHaveLength(1)
    expect(xml).toContain('<bpmn:participant id="Pool_tln_kunde" name="Kunde" />')
    // Bestellung kommt vom Kunden, Rückfrage geht hin, Korrektur und Storno kommen zurück, Versand geht hin
    expect(layout.nachrichten.map((n) => [n.von, n.nach])).toEqual(
      expect.arrayContaining([
        ['Pool_tln_kunde', 'Start'],
        ['auf_nachfragen', 'Pool_tln_kunde'],
        ['Pool_tln_kunde', 'zw_korrektur_ereignis'],
        ['Pool_tln_kunde', 'zw_storno_ereignis'],
        ['auf_versenden', 'Pool_tln_kunde'],
      ]),
    )
    expect(layout.nachrichten).toHaveLength(5)
    const { warnings, rootElement } = await BpmnModdle().fromXML(xml)
    expect(warnings).toEqual([])
    const kollaboration = (rootElement.rootElements ?? []).find((e) => e.$type === 'bpmn:Collaboration') as unknown as { messageFlows: unknown[] }
    expect(kollaboration.messageFlows).toHaveLength(5)
    expect(geometrieFehler(layout)).toEqual([])
  })

  it('legt Pools abwechselnd über und unter den Hauptpool, Nachrichten enden an ihrem Rand', () => {
    const kunde = neuerTeilnehmer('Kunde')
    const lieferant = neuerTeilnehmer('Lieferant')
    const p = neuerProzess({
      name: 'Beschaffung',
      teilnehmer: [kunde, lieferant],
      ablauf: { id: 'haupt', schritte: [neueAufgabe({ name: 'Auftrag bestätigen', nachrichtAn: kunde.id }), neueAufgabe({ name: 'Ware bestellen', nachrichtAn: lieferant.id }), neuesWarten({ name: 'Lieferung abwarten', art: 'nachricht', von: lieferant.id })] },
    })
    const { layout } = erzeugeBpmn(p)
    const [oben, unten] = layout.pools
    expect(oben.lage).toBe('oben')
    expect(oben.y + oben.hoehe).toBeLessThan(layout.pool.y)
    expect(unten.lage).toBe('unten')
    expect(unten.y).toBeGreaterThan(layout.pool.y + layout.pool.hoehe)
    expect(geometrieFehler(layout)).toEqual([])
  })

  it('hält Nachrichtenflüsse in 300 Zufallsprozessen von Knoten fern', () => {
    const fehler: string[] = []
    let nachrichten = 0
    for (let s = 1; s <= 300; s++) {
      const { layout } = erzeugeBpmn(zufallsProzess(s))
      nachrichten += layout.nachrichten.length
      for (const f of geometrieFehler(layout)) fehler.push(`Startwert ${s}: ${f}`)
    }
    expect(fehler.slice(0, 5)).toEqual([])
    expect(nachrichten).toBeGreaterThan(300)
    // 300 Layouts: mit Unterbrechungen in den Zufallsprozessen braucht das unter Last mehr als die üblichen 5 Sekunden
  }, 60_000)

  it('zählt Kontakte mit dem Kunden je Vorgang wie von Hand', () => {
    // Lieferdienst: Bestellung (1) + Benachrichtigung und neuer Termin je 0,976 · 0,1 + Rechnung 0,976
    const k = berechneKennzahlen(beispielLieferdienst())
    expect(k.kontakte).toHaveLength(1)
    expect(k.kontakte[0].anzahl).toBeCloseTo(1 + 0.976 * 0.1 * 2 + 0.976, 10)
    // unter der Schwelle: kein Hinweis auf Kontaktreduktion
    expect(findeSchwachstellen(beispielLieferdienst(), k).map((b) => b.schluessel)).not.toContain('kontakte:tln_kunde')
  })

  it('entfernt einen Teilnehmer samt aller Verweise', () => {
    const p = beispielOnlinebestellung()
    expect(nachrichtenVerweise(p)).toHaveLength(5)
    const q = entferneTeilnehmer(p, 'tln_kunde')
    expect(q.teilnehmer).toEqual([])
    expect(nachrichtenVerweise(q)).toEqual([])
    expect(findeBlock(q, 'auf_nachfragen')?.block).toMatchObject({ nachrichtAn: null })
    expect(erzeugeBpmn(q).layout.nachrichten).toEqual([])
  })

  it('meldet externe Beteiligte ohne Namen oder ohne Nachrichten', () => {
    const p = neuerProzess({ name: 'Test', teilnehmer: [neuerTeilnehmer(''), neuerTeilnehmer('Bank')] })
    const arten = pruefeProzess(p).map((b) => b.schluessel.split(':')[0])
    expect(arten).toContain('teilnehmername')
    expect(arten.filter((a) => a === 'teilnehmer-unbenutzt')).toHaveLength(2)
    expect(pruefeProzess(beispielOnlinebestellung()).filter((b) => b.schluessel.startsWith('teilnehmer'))).toEqual([])
  })

  it('legt den Beteiligten mit den meisten Nachrichten nach oben', () => {
    const bank = neuerTeilnehmer('Bank')
    const kunde = neuerTeilnehmer('Kunde')
    const p = neuerProzess({
      name: 'Kredit',
      teilnehmer: [bank, kunde],
      ablauf: { id: 'haupt', schritte: [neueAufgabe({ name: 'Antrag bestätigen', nachrichtAn: kunde.id }), neueAufgabe({ name: 'Schufa anfragen', nachrichtAn: bank.id }), neuesWarten({ name: 'Unterlagen abwarten', art: 'nachricht', von: kunde.id })] },
    })
    const { layout } = erzeugeBpmn(p)
    expect(layout.pools.find((x) => x.lage === 'oben')?.teilnehmerId).toBe(kunde.id)
    expect(layout.pools.find((x) => x.lage === 'unten')?.teilnehmerId).toBe(bank.id)
    expect(geometrieFehler(layout)).toEqual([])
  })

  it('verwirft beim Laden Absender an Zeit- und Bedingungsereignissen', () => {
    const p = beispielLieferdienst()
    const projekt = neuesProjekt(p)
    const roh = JSON.parse(alsJson(projekt))
    roh.ist.ausloeser = { ...roh.ist.ausloeser, art: 'zeit', von: 'tln_kunde' }
    const warten = JSON.stringify(roh).includes('"typ":"warten"')
    expect(warten).toBe(true)
    // ein Warten auf Zeit mit Absender, wie ihn ältere Stände nach einem Wechsel der Art behalten konnten
    const zuZeit = (x: unknown): void => {
      if (Array.isArray(x)) x.forEach(zuZeit)
      else if (x && typeof x === 'object') {
        const o = x as Record<string, unknown>
        if (o.typ === 'warten') {
          o.art = 'zeit'
          o.von = 'tln_kunde'
        }
        Object.values(o).forEach(zuZeit)
      }
    }
    zuZeit(roh.ist.ablauf)
    const gelesen = leseProjektText(JSON.stringify(roh)).ist
    expect(gelesen.ausloeser.von).toBeNull()
    expect(nachrichtenVerweise(gelesen).every((v) => v.ort !== 'start')).toBe(true)
    expect(erzeugeBpmn(gelesen).layout.nachrichten.every((n) => !n.nach.startsWith('wrt_'))).toBe(true)
  })

  it('liest Dateien ohne Teilnehmerliste', () => {
    const projekt = neuesProjekt(beispielLieferdienst())
    const alt = JSON.parse(alsJson(projekt))
    delete alt.ist.teilnehmer
    expect(leseProjektText(JSON.stringify(alt)).ist.teilnehmer).toEqual([])
  })
})
