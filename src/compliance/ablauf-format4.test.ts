/**
 * Zusammenführung von compliance mit der Modellierung (Format 4): Kapitel 4 beschreibt
 * Abschnitte, „für jedes Stück“, Unterbrechungen, „weiter beim ersten“, „in beliebiger
 * Reihenfolge“ und ein Ende neben gleichzeitig laufenden Schritten. Nummern, vorige Aufgabe,
 * Lückenprüfung und „Beheben“ funktionieren mit Aufgaben in Rahmen und Ausnahmewegen.
 */
import { describe, expect, it } from 'vitest'
import { behebenName, feldZiel } from '../ui/compliance/beheben'
import {
  neueAufgabe,
  neueEntscheidung,
  neueParallel,
  neuerMehrfach,
  neueRolle,
  neuerProzess,
  neuerRuecksprungBereich,
  neuerTeilnehmer,
  neuerTeilprozess,
  neuerZweig,
  neueSequenz,
  neuesWarten,
  neueUnterbrechung,
} from '../modell/bausteine'
import { beispielLieferdienst } from '../modell/beispiel'
import { alleAufgaben, durchlaufe, fasseZusammen, findeBlock } from '../modell/operationen'
import { unterbrechungenVon, type Aufgabe, type Block, type Prozess } from '../modell/typen'
import { zufallsProzess } from '../testhilfen/zufallsprozess'
import { kontext, nummern, vorigeAufgabe } from './ableitung'
import { complianceLieferdienst } from './beispiel'
import { pruefeCompliance } from './regeln'
import { neueCompliance, neueKontrollAngaben } from './standard'
import type { Abschnitt, ComplianceProjekt, Dokument } from './typen'
import { entwurfsKontext, erzeugeDokumente } from './versionen'

const HEUTE = '2026-11-11'

function vd(p: Prozess, c: ComplianceProjekt = neueCompliance()): Dokument {
  return erzeugeDokumente(p, c, entwurfsKontext(c, HEUTE)).verfahrensdoku
}

function texte(a: Abschnitt): string[] {
  if (a.art === 'absatz' || a.art === 'hinweis') return [a.text]
  if (a.art === 'liste') return a.punkte
  if (a.art === 'ueberschrift') return [`${a.nummer} ${a.text}`]
  return []
}

/** Kapitel 4 ohne Kapitelüberschrift und ohne das letzte Unterkapitel */
function ablauf(d: Dokument): Abschnitt[] {
  const a = d.abschnitte
  const start = a.findIndex((x) => x.art === 'ueberschrift' && x.ebene === 1 && x.nummer === '4')
  const ende = a.findIndex((x, i) => i > start && x.art === 'ueberschrift' && x.text === 'Aufbewahrung, Vernichtung und Löschung')
  return a.slice(start + 1, ende)
}

const kapitel4 = (p: Prozess, c?: ComplianceProjekt) => ablauf(vd(p, c)).flatMap(texte)

/** Texte im Unterkapitel 4.k ohne seine Überschrift */
function unterkapitel(p: Prozess, nummer: string, c?: ComplianceProjekt): string[] {
  const a = ablauf(vd(p, c))
  const start = a.findIndex((x) => x.art === 'ueberschrift' && x.nummer === nummer)
  if (start < 0) throw new Error(`kein Unterkapitel ${nummer}`)
  const ende = a.findIndex((x, i) => i > start && x.art === 'ueberschrift')
  return a.slice(start + 1, ende < 0 ? undefined : ende).flatMap(texte)
}

const ueberschriften = (p: Prozess) => ablauf(vd(p)).flatMap((x) => (x.art === 'ueberschrift' ? [`${x.nummer} ${x.text}`] : []))

const rolle = neueRolle('Lager')
const a = (name: string, werte: Partial<Aufgabe> = {}) => neueAufgabe({ name, rolleId: rolle.id, ...werte })
const prozess = (schritte: Block[], werte: Partial<Prozess> = {}) => neuerProzess({ name: 'Test', rollen: [rolle], ablauf: { id: 'haupt', schritte }, ...werte })

describe('Abschnitt mit Namen (Teilprozess)', () => {
  it('nennt den Abschnitt als erste Zeile seines ersten Schritts und schließt danach an', () => {
    const versand = neuerTeilprozess({ name: 'Ware versenden', koerper: neueSequenz([a('Ware packen'), a('Paket übergeben')]) })
    const p = prozess([a('Bestellung annehmen'), versand, neuesWarten({ name: 'Zahlung abwarten' })])
    expect(unterkapitel(p, '4.2')[0]).toBe('Abschnitt „Ware versenden“ mit den Schritten 4.2 bis 4.3.')
    expect(unterkapitel(p, '4.1')).toEqual(['Zuständig: Lager. System: offen.'])
    expect(kapitel4(p)).toContain('Nach dem Abschnitt „Ware versenden“ (4.2 bis 4.3): Warten: Zahlung abwarten (auf einen Zeitpunkt).')
  })

  it('beginnt der Abschnitt mit einer Entscheidung, steht der Satz vor ihr', () => {
    const pruefen = neuerTeilprozess({
      name: 'Antrag prüfen',
      koerper: neueSequenz([neueEntscheidung({ frage: 'Vollständig?', zweige: [neuerZweig('Ja', 0.8, { schritte: [a('Antrag annehmen')] }), neuerZweig('Nein', 0.2, { schritte: [a('Unterlagen nachfordern')] })] })]),
    })
    const k4 = kapitel4(prozess([a('Antrag erfassen'), pruefen]))
    const i = k4.indexOf('Abschnitt „Antrag prüfen“ mit den Schritten 4.2 bis 4.3.')
    expect(i).toBeGreaterThan(0)
    expect(k4[i + 1]).toBe('Entscheidung „Vollständig?“:')
    // ohne Namen und ohne Aufgaben
    expect(kapitel4(prozess([a('Antrag erfassen'), neuerTeilprozess({ koerper: neueSequenz([neuesWarten({ name: 'Frist abwarten' })]) })]))).toContain('Abschnitt „ohne Namen“ ohne Aufgaben.')
  })

  it('„weiter mit“ betritt den Abschnitt', () => {
    const express = neuerTeilprozess({ name: 'Express', koerper: neueSequenz([a('Express buchen')]) })
    const p = prozess([neueEntscheidung({ frage: 'Eilig?', zweige: [neuerZweig('Ja', 0.2, { schritte: [express] }), neuerZweig('Nein', 0.8)] })])
    expect(kapitel4(p)).toContain('„Ja“: weiter mit 4.1')
  })
})

describe('Für jedes Stück einer Liste (Mehrfachinstanz)', () => {
  it('nacheinander und zur selben Zeit', () => {
    const positionen = neuerMehrfach({ name: 'Für jede Position', koerper: neueSequenz([a('Artikel holen'), a('Artikel scannen')]) })
    const pakete = neuerMehrfach({ name: 'Für jedes Paket', ausfuehrung: 'gleichzeitig', koerper: neueSequenz([a('Paket verladen')]) })
    const p = prozess([a('Auftrag annehmen'), positionen, pakete, neuesWarten({ name: 'Abholung abwarten' })])
    expect(unterkapitel(p, '4.2')[0]).toBe('„Für jede Position“: 4.2 bis 4.3 laufen einmal je Stück der Liste, ein Stück nach dem anderen.')
    expect(unterkapitel(p, '4.4')[0]).toBe('„Für jedes Paket“: 4.4 läuft einmal je Stück der Liste, alle Stücke zur selben Zeit.')
    expect(kapitel4(p)).toContain('Nach „Für jedes Paket“ (4.4): Warten: Abholung abwarten (auf einen Zeitpunkt).')
  })

  it('mit Verzweigung im Körper läuft nur der Teil sicher; als Ziel bleibt „für jedes Stück“ selbst', () => {
    const vorraetig = neueEntscheidung({ frage: 'Artikel da?', zweige: [neuerZweig('Ja', 0.9, { schritte: [a('Artikel buchen')] }), neuerZweig('Nein', 0.1, { schritte: [a('Artikel nachbestellen')] })] })
    const positionen = neuerMehrfach({ name: 'Für jede Position', koerper: neueSequenz([a('Artikel suchen'), vorraetig]) })
    const p = prozess([neueEntscheidung({ frage: 'Auftrag gültig?', zweige: [neuerZweig('Ja', 0.9, { schritte: [positionen] }), neuerZweig('Nein', 0.1, { ende: 'Abgelehnt' })] })])
    const k4 = kapitel4(p)
    expect(k4).toContain('„Ja“: weiter mit „Für jede Position“ (4.1 bis 4.3)')
    expect(unterkapitel(p, '4.1')).toContain('„Für jede Position“: Der Teil mit den Schritten 4.1 bis 4.3 läuft einmal je Stück der Liste, ein Stück nach dem anderen.')
  })
})

describe('Unterbrechungen', () => {
  const kunde = neuerTeilnehmer('Kunde')

  it('an einer Aufgabe: Ausnahme mit Ende, Frist ohne Aufgaben, Nebenweg; die Aufgaben der Ausnahmewege folgen direkt', () => {
    const storno = neueUnterbrechung({ bezeichnung: 'Kunde storniert', art: 'nachricht', von: kunde.id, ende: 'Storniert', schritte: [a('Storno bestätigen')] })
    const frist = neueUnterbrechung({ bezeichnung: 'Frist abgelaufen', art: 'zeit' })
    const rueckfrage = neueUnterbrechung({ bezeichnung: 'Rückfrage', unterbrechend: false, anteil: 0.3, schritte: [a('Rückfrage beantworten')] })
    const packen = a('Ware packen', { unterbrechungen: [storno, frist, rueckfrage] })
    const p = prozess([a('Bestellung annehmen'), packen, a('Ware versenden')], { teilnehmer: [kunde] })
    expect(ueberschriften(p)).toEqual(['4.1 Bestellung annehmen', '4.2 Ware packen', '4.3 Storno bestätigen', '4.4 Rückfrage beantworten', '4.5 Ware versenden'])
    expect(unterkapitel(p, '4.2')).toEqual([
      'Zuständig: Lager. System: offen.',
      'Ausnahme: Tritt „Kunde storniert“ ein (Nachricht von Kunde), wird der Schritt abgebrochen; weiter mit 4.3, danach endet der Vorgang mit „Storniert“.',
      'Ausnahme: Tritt „Frist abgelaufen“ ein (Frist), wird der Schritt abgebrochen; es geht nach dem Schritt weiter.',
      'Nebenweg: Tritt „Rückfrage“ ein (Nachricht), läuft der Schritt weiter; daneben läuft 4.4.',
    ])
    expect(unterkapitel(p, '4.3')[0]).toBe('Nur wenn: „Kunde storniert“ tritt während 4.2 ein.')
    expect(unterkapitel(p, '4.4')[0]).toBe('Nur wenn: „Rückfrage“ tritt während 4.2 ein.')
    expect(unterkapitel(p, '4.5')).toEqual(['Zuständig: Lager. System: offen.'])
  })

  it('„noch einmal von vorn“ und ein Ablaufsatz nach dem Ausnahmeweg', () => {
    const packen = a('Ware packen')
    const bereich = neuerRuecksprungBereich([packen])
    const frist = neueUnterbrechung({ bezeichnung: 'Frist abgelaufen', art: 'zeit', zurueckZu: bereich.id, schritte: [a('Lager informieren')] })
    packen.unterbrechungen = [frist]
    const p = prozess([bereich, neuesWarten({ name: 'Abholung abwarten' })])
    const k4 = kapitel4(p)
    expect(k4).toContain('Ausnahme: Tritt „Frist abgelaufen“ ein (Frist), wird der Schritt abgebrochen; weiter mit 4.2, danach zurück zu 4.1.')
    // steht unter 4.2 aus dem Ausnahmeweg und nennt darum seinen Anschluss
    expect(k4).toContain('Nach Schritt 4.1: Warten: Abholung abwarten (auf einen Zeitpunkt).')
  })

  it('an einem Abschnitt und an „für jedes Stück“', () => {
    const storno = neueUnterbrechung({ bezeichnung: 'Kunde storniert', ende: 'Storniert', schritte: [a('Storno buchen')] })
    const versand = neuerTeilprozess({ name: 'Ware versenden', koerper: neueSequenz([a('Ware packen'), a('Paket übergeben')]), unterbrechungen: [storno] })
    const verzug = neueUnterbrechung({ bezeichnung: 'Lieferzeit überschritten', art: 'zeit', unterbrechend: false, anteil: 0.2, schritte: [a('Kunde informieren')] })
    const ausfall = neueUnterbrechung({ bezeichnung: 'Lager gesperrt', art: 'nachricht' })
    const positionen = neuerMehrfach({ name: 'Für jede Position', ausfuehrung: 'gleichzeitig', koerper: neueSequenz([a('Artikel kommissionieren')]), unterbrechungen: [verzug, ausfall] })
    const p = prozess([versand, positionen, a('Rechnung schreiben')])
    expect(ueberschriften(p)).toEqual(['4.1 Ware packen', '4.2 Paket übergeben', '4.3 Storno buchen', '4.4 Artikel kommissionieren', '4.5 Kunde informieren', '4.6 Rechnung schreiben'])
    expect(unterkapitel(p, '4.1').slice(0, 2)).toEqual([
      'Abschnitt „Ware versenden“ mit den Schritten 4.1 bis 4.2.',
      'Ausnahme im Abschnitt „Ware versenden“: Tritt „Kunde storniert“ ein (Nachricht), wird der Abschnitt abgebrochen; weiter mit 4.3, danach endet der Vorgang mit „Storniert“.',
    ])
    expect(unterkapitel(p, '4.3')[0]).toBe('Nur wenn: „Kunde storniert“ tritt während des Abschnitts „Ware versenden“ ein.')
    expect(unterkapitel(p, '4.4').slice(0, 3)).toEqual([
      '„Für jede Position“: 4.4 läuft einmal je Stück der Liste, alle Stücke zur selben Zeit.',
      'Nebenweg bei „Für jede Position“: Tritt „Lieferzeit überschritten“ ein (Frist), läuft die Arbeit an den Stücken weiter; daneben läuft 4.5.',
      'Ausnahme bei „Für jede Position“: Tritt „Lager gesperrt“ ein (Nachricht), endet die Arbeit an allen Stücken; es geht nach der ganzen Liste weiter.',
    ])
    expect(unterkapitel(p, '4.5')[0]).toBe('Nur wenn: „Lieferzeit überschritten“ tritt während „Für jede Position“ ein.')
  })
})

describe('Prozess endet sofort (Ende neben gleichzeitig laufenden Schritten)', () => {
  it('Unterbrechung in einem Zweig von Gleichzeitig, Entscheidung bei Stücken zur selben Zeit und in „weiter beim ersten“', () => {
    const storno = neueUnterbrechung({ bezeichnung: 'Kunde storniert', ende: 'Storniert' })
    const g = neueParallel(2)
    g.zweige[0].schritte = [a('Ware packen', { unterbrechungen: [storno] })]
    g.zweige[1].schritte = [a('Rechnung schreiben')]
    const defekt = () => neueEntscheidung({ frage: 'Defekt?', zweige: [neuerZweig('Nein', 0.9), neuerZweig('Ja', 0.1, { ende: 'Reklamation' })] })
    const stuecke = neuerMehrfach({ name: 'Für jedes Gerät', ausfuehrung: 'gleichzeitig', koerper: neueSequenz([a('Gerät testen'), defekt()]) })
    const erster = neueParallel(2, 'erster')
    erster.zweige[0].schritte = [a('Anruf versuchen'), defekt()]
    erster.zweige[1].schritte = [a('E-Mail schreiben')]
    const k4 = kapitel4(prozess([g, stuecke, erster]))
    expect(k4).toContain('Ausnahme: Tritt „Kunde storniert“ ein (Nachricht), wird der Schritt abgebrochen; der gesamte Vorgang endet sofort mit „Storniert“.')
    expect(k4.filter((t) => t === '„Ja“: Der gesamte Vorgang endet sofort mit „Reklamation“')).toHaveLength(2)
  })

  it('nacheinander, in einem Abschnitt und bei Stücken der Reihe nach endet nur der Vorgang', () => {
    const defekt = () => neueEntscheidung({ frage: 'Defekt?', zweige: [neuerZweig('Nein', 0.9), neuerZweig('Ja', 0.1, { ende: 'Reklamation' })] })
    const reihe = neueParallel(2, 'nacheinander')
    reihe.zweige[0].schritte = [a('Gerät A testen'), defekt()]
    reihe.zweige[1].schritte = [a('Gerät B testen')]
    const abschnitt = neuerTeilprozess({ name: 'Prüfung', koerper: neueSequenz([a('Gerät C testen'), defekt()]) })
    const stuecke = neuerMehrfach({ name: 'Für jedes Gerät', koerper: neueSequenz([a('Gerät testen'), defekt()]) })
    const k4 = kapitel4(prozess([reihe, abschnitt, stuecke]))
    expect(k4.filter((t) => t === '„Ja“: Der Vorgang endet mit „Reklamation“')).toHaveLength(3)
    expect(k4.join(' ')).not.toContain('sofort')
  })

  it('„weiter mit“ nennt bei „in beliebiger Reihenfolge“ alle Zweige', () => {
    const reihe = neueParallel(2, 'nacheinander')
    reihe.zweige[0].schritte = [a('Ausweis prüfen')]
    reihe.zweige[1].schritte = [a('Nachweis prüfen')]
    const p = prozess([neueEntscheidung({ frage: 'Neukunde?', zweige: [neuerZweig('Ja', 0.3, { schritte: [reihe] }), neuerZweig('Nein', 0.7)] })])
    expect(kapitel4(p)).toContain('„Ja“: weiter mit den Zweigen in beliebiger Reihenfolge (4.1 bis 4.2)')
  })
})

describe('Nummern, vorige Aufgabe, Lückenprüfung und „Beheben“ mit Aufgaben in Rahmen', () => {
  const buchhaltung = neueRolle('Buchhaltung', { personen: 1 })
  const b = (name: string, werte: Partial<Aufgabe> = {}) => neueAufgabe({ name, rolleId: buchhaltung.id, ...werte })

  it('vorige Aufgabe: vor dem Rahmen weiter, im Ausnahmeweg die unterbrochene Aufgabe', () => {
    const freigabe = b('Rechnung freigeben', { art: 'freigabe' })
    const mahnungFreigeben = b('Mahnung freigeben', { art: 'freigabe' })
    const mahnung = b('Mahnung schreiben', { unterbrechungen: [neueUnterbrechung({ bezeichnung: 'Betrag zu hoch', schritte: [mahnungFreigeben] })] })
    const p = neuerProzess({
      name: 'Rechnung',
      rollen: [buchhaltung],
      ablauf: { id: 'haupt', schritte: [b('Rechnung erstellen'), neuerTeilprozess({ name: 'Abschluss', koerper: neueSequenz([freigabe]) }), neuerMehrfach({ name: 'Für jede Mahnung', koerper: neueSequenz([mahnung]) })] },
    })
    expect([...nummern(p).values()]).toEqual(['4.1', '4.2', '4.3', '4.4'])
    expect(vorigeAufgabe(p, freigabe.id)?.name).toBe('Rechnung erstellen')
    expect(vorigeAufgabe(p, mahnungFreigeben.id)?.name).toBe('Mahnung schreiben')
    expect(vorigeAufgabe(p, mahnung.id)?.name).toBe('Rechnung erstellen')

    // K1 an beiden Freigaben, „Beheben“ nennt den Schritt und springt zur Karte der Kontrolle
    const c = neueCompliance()
    const befunde = pruefeCompliance(p, c, HEUTE).filter((x) => x.regel === 'K1')
    expect(befunde.map((x) => x.blockId)).toEqual([freigabe.id, mahnungFreigeben.id])
    expect(befunde.map((x) => x.titel)).toEqual(['Freigabe ohne Vier-Augen-Prinzip', 'Freigabe ohne Vier-Augen-Prinzip'])
    expect(befunde.map((x) => behebenName(x, kontext(p, c)))).toEqual(['Beheben: Freigabe ohne Vier-Augen-Prinzip – Rechnung freigeben', 'Beheben: Freigabe ohne Vier-Augen-Prinzip – Mahnung freigeben'])
    expect(befunde.map((x) => feldZiel(x, c))).toEqual([null, null])

    // K2 und Kapitel 3.3 für eine Kontrolle im Ausnahmeweg
    c.kontrollen[mahnungFreigeben.id] = neueKontrollAngaben('vier_augen')
    const k2 = pruefeCompliance(p, c, HEUTE).find((x) => x.regel === 'K2')!
    expect(k2.blockId).toBe(mahnungFreigeben.id)
    expect(feldZiel(k2, c)).toBe(`ziel-kontrolle-${mahnungFreigeben.id}-nachweis`)
    const d = vd(p, c)
    const i = d.abschnitte.findIndex((x) => x.art === 'ueberschrift' && x.nummer === '3.3')
    const t = d.abschnitte.slice(i).find((x) => x.art === 'tabelle')
    expect(t?.art === 'tabelle' && t.zeilen.map((z) => [z[0], z[5]])).toEqual([
      ['4.2 Rechnung freigeben', 'bei jedem Vorgang'],
      ['4.4 Mahnung freigeben', 'wenn „Betrag zu hoch“ während 4.3 eintritt (siehe 4.4)'],
    ])
  })

  it('Lieferdienst mit Kommissionieren als Abschnitt: gleiche Nummern, gleiche Befunde, Satz zum Abschnitt', () => {
    const ohne = beispielLieferdienst()
    const ort = findeBlock(ohne, 'auf_kommissionieren')!
    const p = fasseZusammen(ohne, ort.sequenz.id, ort.index, ort.index + 1, 'Ware bereitstellen')
    expect(p).not.toBe(ohne)
    expect([...nummern(p)]).toEqual([...nummern(ohne)])
    const c = complianceLieferdienst()
    const regeln = (q: Prozess) => pruefeCompliance(q, c, HEUTE).map((x) => `${x.regel}:${x.blockId ?? ''}`)
    expect(regeln(p)).toEqual(regeln(ohne))
    expect(unterkapitel(p, '4.6', c).slice(0, 2)).toEqual([
      'Wiederholung: 4.6 bis 4.7 laufen mindestens einmal und erneut, solange „Fehler gefunden?“ mit „Ja“ beantwortet wird.',
      'Abschnitt „Ware bereitstellen“ mit den Schritten 4.6 bis 4.7.',
    ])
  })
})

describe('300 Zufallsprozesse mit allen Bausteinen aus Format 4', () => {
  it('beschreiben jeden Abschnitt, jedes „für jedes Stück“ und jede Unterbrechung genau einmal', () => {
    let rahmen = 0
    let unterbrechungen = 0
    for (let s = 1; s <= 300; s++) {
      const p = zufallsProzess(s)
      const k4 = kapitel4(p)
      const bloecke = [...durchlaufe(p.ablauf)].map((f) => f.block)
      const abschnitte = bloecke.filter((x) => x.typ === 'teilprozess')
      const listen = bloecke.filter((x) => x.typ === 'mehrfach')
      const zahl = bloecke.reduce((n, x) => n + unterbrechungenVon(x).length, 0)
      rahmen += abschnitte.length + listen.length
      unterbrechungen += zahl
      expect(k4.filter((t) => /(^|: )Abschnitt „[^“]*“ (mit|ohne) /.test(t)), `Prozess ${s}`).toHaveLength(abschnitte.length)
      expect(k4.filter((t) => / einmal je Stück der Liste, /.test(t)), `Prozess ${s}`).toHaveLength(listen.length)
      expect(k4.filter((t) => /^(Ausnahme|Nebenweg)( im Abschnitt „[^“]*“| bei „[^“]*“)?: Tritt /.test(t)), `Prozess ${s}`).toHaveLength(zahl)
      // jede Aufgabe genau einmal als Unterkapitel, in der Reihenfolge der Nummern
      expect(ueberschriften(p).map((u) => u.split(' ')[0]), `Prozess ${s}`).toEqual(alleAufgaben(p).map((_, i) => `4.${i + 1}`))
    }
    // die Zufallsprozesse enthalten die neuen Bausteine wirklich
    expect(rahmen).toBeGreaterThan(100)
    expect(unterbrechungen).toBeGreaterThan(100)
  }, 60_000)
})
