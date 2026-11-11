import { describe, expect, it } from 'vitest'
import { neueAufgabe, neueEntscheidung, neueOder, neueParallel, neuerOderZweig, neuerProzess, neueRolle, neuerZweig, neuesWarten, neueWiederholung } from '../modell/bausteine'
import { beispielLieferdienst, beispielOnlinebestellung } from '../modell/beispiel'
import { durchlaufe, findeBlock, setzeRuecksprung } from '../modell/operationen'
import type { Aufgabe, Block, Id, Prozess } from '../modell/typen'
import { zufallsProzess } from '../testhilfen/zufallsprozess'
import { nummern } from './ableitung'
import { complianceLieferdienst } from './beispiel'
import { neueCompliance, neueKontrollAngaben } from './standard'
import type { Abschnitt, ComplianceProjekt, Dokument } from './typen'
import { entwurfsKontext, erzeugeDokumente } from './versionen'

// Durchsicht 11.11.2026: Ablaufsätze in Kapitel 4 (abnahme-3, recht-12, logik-0, logik-17) und Häufigkeit in 3.3 (logik-16)

const HEUTE = '2026-11-11'

function vd(p: Prozess, c: ComplianceProjekt = neueCompliance()): Dokument {
  return erzeugeDokumente(p, c, entwurfsKontext(c, HEUTE)).verfahrensdoku
}

/** Kapitel 4 ohne Kapitelüberschrift und ohne das letzte Unterkapitel 4.{n+1} */
function ablauf(d: Dokument): Abschnitt[] {
  const a = d.abschnitte
  const start = a.findIndex((x) => x.art === 'ueberschrift' && x.ebene === 1 && x.nummer === '4')
  const ende = a.findIndex((x, i) => i > start && x.art === 'ueberschrift' && x.text === 'Aufbewahrung, Vernichtung und Löschung')
  return a.slice(start + 1, ende)
}

function texte(a: Abschnitt): string[] {
  if (a.art === 'absatz' || a.art === 'hinweis') return [a.text]
  if (a.art === 'liste') return a.punkte
  if (a.art === 'ueberschrift') return [`${a.nummer} ${a.text}`]
  return []
}

/** Texte im Unterkapitel 4.k, ohne seine Überschrift */
function unterkapitel(d: Dokument, nummer: string): string[] {
  const a = ablauf(d)
  const start = a.findIndex((x) => x.art === 'ueberschrift' && x.nummer === nummer)
  if (start < 0) throw new Error(`kein Unterkapitel ${nummer}`)
  const ende = a.findIndex((x, i) => i > start && x.art === 'ueberschrift')
  return a.slice(start + 1, ende < 0 ? undefined : ende).flatMap(texte)
}

function kapitel4(d: Dokument): string[] {
  return ablauf(d).flatMap(texte)
}

function einfach(schritte: Block[], werte: Partial<Prozess> = {}): Prozess {
  const rolle = neueRolle('Team')
  const mitRolle = (b: Block): Block => {
    if (b.typ === 'aufgabe') return { ...b, rolleId: rolle.id }
    if (b.typ === 'entscheidung') return { ...b, zweige: b.zweige.map((z) => ({ ...z, schritte: z.schritte.map(mitRolle) })) }
    if (b.typ === 'oder') return { ...b, zweige: b.zweige.map((z) => ({ ...z, schritte: z.schritte.map(mitRolle) })) }
    if (b.typ === 'parallel') return { ...b, zweige: b.zweige.map((z) => ({ ...z, schritte: z.schritte.map(mitRolle) })) }
    if (b.typ === 'wiederholung') return { ...b, koerper: { ...b.koerper, schritte: b.koerper.schritte.map(mitRolle) } }
    return b
  }
  return neuerProzess({ name: 'Test', rollen: [rolle], ablauf: { id: 'haupt', schritte: schritte.map(mitRolle) }, ...werte })
}

const a = (name: string, werte: Partial<Aufgabe> = {}) => neueAufgabe({ name, ...werte })

// ---------------------------------------------------------------------------
// Prüfhilfen für Zufallsprozesse

/** Zweig-Pfad je Baustein: Kennungen der Entscheidungs- und ODER-Zweige, in denen er liegt */
function pfade(p: Prozess): Map<Id, string> {
  const m = new Map<Id, string>()
  const gehe = (schritte: Block[], pfad: string[]) => {
    for (const b of schritte) {
      m.set(b.id, pfad.join('/'))
      if (b.typ === 'entscheidung' || b.typ === 'oder') for (const z of b.zweige) gehe(z.schritte, [...pfad, z.id])
      else if (b.typ === 'parallel') for (const z of b.zweige) gehe(z.schritte, pfad)
      else if (b.typ === 'wiederholung') gehe(b.koerper.schritte, pfad)
    }
  }
  gehe(p.ablauf.schritte, [])
  return m
}

/** Zeilen, die zur Aufgabe ihres Unterkapitels gehören */
const AUFGABEN_ZEILE = /^(Nur wenn: |Zuständig: |Nachricht von |Grundlage: |Ergebnis: |Medienbruch: |Kontrolle: |Nachricht an )/
/** Anschluss, der den Zusammenhang eines Ablaufsatzes ausdrücklich nennt */
const ANSCHLUSS = /^(Nach |Wenn |In Zweig )/

/**
 * Ablaufsätze (Absätze zu Entscheidung, ODER, Gleichzeitig, Wiederholung, Warten), die ohne
 * Anschluss unter einer Überschrift oder hinter einem Satz mit anderem Zweig-Pfad stehen.
 */
function fremdePlaetze(p: Prozess): string[] {
  const idVon = new Map([...nummern(p)].map(([id, nr]) => [nr, id]))
  const pfad = pfade(p)
  const bausteine = [...durchlaufe(p.ablauf)].map((f) => f.block).filter((b) => b.typ !== 'aufgabe' && !(b.typ === 'wiederholung' && b.modus === 'ruecksprung'))
  const fehler: string[] = []
  let zusammenhang = ''
  let i = 0
  for (const x of ablauf(vd(p))) {
    if (x.art === 'ueberschrift') {
      zusammenhang = pfad.get(idVon.get(x.nummer) ?? '') ?? '?'
      continue
    }
    if (x.art !== 'absatz' || AUFGABEN_ZEILE.test(x.text)) continue
    const b = bausteine[i++]
    if (!b) return [...fehler, `mehr Ablaufsätze als Bausteine: ${x.text}`]
    if (!ANSCHLUSS.test(x.text) && pfad.get(b.id) !== zusammenhang) fehler.push(x.text)
    zusammenhang = pfad.get(b.id)!
  }
  if (i !== bausteine.length) fehler.push(`${bausteine.length - i} Ablaufsätze fehlen`)
  return fehler
}

/** Erster Baustein, mit dem es in einer Folge weitergeht: Wiederholung und Gleichzeitig werden betreten, Entscheidungen nicht. */
function ersterBaustein(schritte: Block[]): Block | null {
  for (const b of schritte) {
    if (b.typ === 'wiederholung') {
      const e = ersterBaustein(b.koerper.schritte)
      if (e) return e
    } else if (b.typ === 'parallel') {
      for (const z of b.zweige) {
        const e = ersterBaustein(z.schritte)
        if (e) return e
      }
    } else return b
  }
  return null
}

/** „weiter mit“ und „zurück zu“, die nicht auf den ersten Baustein ihres Ziels zeigen */
function falscheSprungziele(p: Prozess): string[] {
  const nr = nummern(p)
  const listen = ablauf(vd(p)).filter((x): x is Extract<Abschnitt, { art: 'liste' }> => x.art === 'liste')
  const verzweigungen = [...durchlaufe(p.ablauf)].map((f) => f.block).filter((b) => b.typ === 'entscheidung' || b.typ === 'oder' || b.typ === 'parallel')
  if (listen.length !== verzweigungen.length) return [`${listen.length} Listen, ${verzweigungen.length} Verzweigungen`]
  const erwartet = (b: Block | null, art: 'weiter' | 'zurueck'): string | null => {
    if (!b) return null
    if (b.typ === 'aufgabe') return `${art === 'weiter' ? 'weiter mit' : 'zurück zu'} ${nr.get(b.id)}`
    if (b.typ === 'entscheidung' || b.typ === 'oder') return `${art === 'weiter' ? 'weiter mit der' : 'zurück zur'} Entscheidung „${b.frage.trim() || 'offen'}“`
    if (b.typ === 'warten') return `${art === 'weiter' ? 'weiter mit' : 'zurück zu'} „${b.name.trim() || 'ohne Namen'}“ (Warten)`
    return null
  }
  const fehler: string[] = []
  verzweigungen.forEach((v, i) => {
    if (v.typ !== 'entscheidung') return
    v.zweige.forEach((z, j) => {
      const punkt = listen[i].punkte[j]
      const weiter = erwartet(ersterBaustein(z.schritte), 'weiter')
      if (weiter && !punkt.includes(`: ${weiter}`)) fehler.push(`${punkt} (erwartet „${weiter}“)`)
      if (z.zurueckZu) {
        const ziel = findeBlock(p, z.zurueckZu)?.block ?? null
        const zurueck = ziel ? erwartet(ersterBaustein(ziel.typ === 'wiederholung' ? ziel.koerper.schritte : [ziel]), 'zurueck') : null
        if (zurueck && !punkt.includes(zurueck)) fehler.push(`${punkt} (erwartet „${zurueck}“)`)
      }
    })
  })
  return fehler
}

// ---------------------------------------------------------------------------

describe('Wiederholung steht im ersten Schritt, den sie wiederholt (abnahme-3, recht-12)', () => {
  const d = vd(beispielLieferdienst(), complianceLieferdienst())

  it('nennt die Wiederholung als erste Zeile von 4.6, nicht unter 4.5 „Bestellung stornieren“', () => {
    expect(unterkapitel(d, '4.5').join(' ')).not.toMatch(/Wiederholung|mindestens einmal/)
    expect(unterkapitel(d, '4.6')[0]).toBe('Wiederholung: 4.6 bis 4.7 laufen mindestens einmal und erneut, solange „Fehler gefunden?“ mit „Ja“ beantwortet wird.')
  })

  it('steht bei einer Aufgabe vor der Wiederholung nicht mehr unter dieser Aufgabe', () => {
    const p = einfach([a('A'), neueWiederholung({ frage: 'Nacharbeit nötig?', koerper: { id: 'k', schritte: [a('B'), a('C')] } })])
    const text = vd(p)
    expect(unterkapitel(text, '4.1')).toEqual(['Zuständig: Team. System: offen.'])
    expect(unterkapitel(text, '4.2')[0]).toBe('Wiederholung: 4.2 bis 4.3 laufen mindestens einmal und erneut, solange „Nacharbeit nötig?“ mit „Ja“ beantwortet wird.')
  })
})

describe('Ablaufsätze nach einer Verzweigung nennen ihren Anschluss (recht-12)', () => {
  it('Onlinebestellung: „Gleichzeitig“ steht nicht wortlos unter 4.4 „Bestellung verfallen lassen“', () => {
    const text = unterkapitel(vd(beispielOnlinebestellung()), '4.4')
    expect(text).toContain('Nach der Entscheidung „Daten vollständig und korrekt?“: Die folgenden Zweige laufen gleichzeitig; weiter geht es, wenn alle fertig sind:')
  })

  it('ODER und Warten nach einer Entscheidung, Entscheidung am Anfang eines späteren Zweigs', () => {
    const wege = neueOder({ frage: 'Welche Unterlagen fehlen?', zweige: [neuerOderZweig('Gutachten fehlt', 0.5, { schritte: [a('Gutachten anfordern')] }), neuerOderZweig('Nachweis fehlt', 0.5, { schritte: [a('Nachweis anfordern')] })] })
    const express = neueEntscheidung({ frage: 'Express gewünscht?', zweige: [neuerZweig('Ja', 0.5, { schritte: [a('Express buchen')] }), neuerZweig('Nein', 0.5)] })
    const p = einfach([
      a('Antrag prüfen'),
      neueEntscheidung({ frage: 'Vollständig?', zweige: [neuerZweig('Ja', 0.5, { schritte: [a('Antrag annehmen')] }), neuerZweig('Nein', 0.5, { schritte: [express] })] }),
      wege,
      neueEntscheidung({ frage: 'Bezahlt?', zweige: [neuerZweig('Ja', 0.5, { schritte: [a('Ware senden')] }), neuerZweig('Nein', 0.5, { ende: 'Abgebrochen' })] }),
      neuesWarten({ name: 'Rückmeldung abwarten' }),
    ])
    const k4 = kapitel4(vd(p))
    expect(k4).toContain('Wenn „Vollständig?“ = „Nein“: Entscheidung „Express gewünscht?“:')
    expect(k4).toContain('Nach der Entscheidung „Vollständig?“: Je nach Fall laufen einer oder mehrere dieser Wege („Welche Unterlagen fehlen?“):')
    expect(k4).toContain('Nach der Entscheidung „Welche Unterlagen fehlen?“: Entscheidung „Bezahlt?“:')
    expect(k4).toContain('Nach der Entscheidung „Bezahlt?“: Warten: Rückmeldung abwarten (auf einen Zeitpunkt).')
    expect(fremdePlaetze(p)).toEqual([])
  })

  it('nach Gleichzeitig und Wiederholung; am Anfang eines Zweigs von Gleichzeitig', () => {
    const gleichzeitig = neueParallel(2)
    gleichzeitig.zweige[0].schritte = [a('Rechnung erstellen')]
    gleichzeitig.zweige[1].schritte = [neuesWarten({ name: 'Ware abwarten' }), a('Ware packen')]
    const p = einfach([
      gleichzeitig,
      neueEntscheidung({ frage: 'Abholung?', zweige: [neuerZweig('Ja', 0.5), neuerZweig('Nein', 0.5)] }),
      neueWiederholung({ frage: 'Weitere Position?', koerper: { id: 'k', schritte: [a('Position buchen')] } }),
      neuesWarten({ name: 'Zahlung abwarten' }),
    ])
    const k4 = kapitel4(vd(p))
    expect(k4).toContain('In Zweig 2: Warten: Ware abwarten (auf einen Zeitpunkt).')
    expect(k4).toContain('Nach den gleichzeitigen Zweigen (4.1 bis 4.2): Entscheidung „Abholung?“:')
    expect(k4).toContain('Nach der Wiederholung (4.3): Warten: Zahlung abwarten (auf einen Zeitpunkt).')
    expect(fremdePlaetze(p)).toEqual([])
  })

  it('in 300 Zufallsprozessen steht kein Ablaufsatz ohne Anschluss unter einer fremden Überschrift', () => {
    const betroffen: string[] = []
    for (let s = 1; s <= 300; s++) {
      const fehler = fremdePlaetze(zufallsProzess(s))
      if (fehler.length > 0) betroffen.push(`Prozess ${s}: ${fehler[0]}`)
    }
    expect(betroffen).toEqual([])
  })

  it('auch die mitgelieferten Beispiele nicht', () => {
    expect(fremdePlaetze(beispielLieferdienst())).toEqual([])
    expect(fremdePlaetze(beispielOnlinebestellung())).toEqual([])
  })
})

describe('Wiederholung mit Verzweigung im Körper (logik-17)', () => {
  it('behauptet nicht, jeder Schritt laufe mindestens einmal', () => {
    const mahnung = neueEntscheidung({ frage: 'Erste Mahnung?', zweige: [neuerZweig('Ja', 0.5, { schritte: [a('Mahnung schreiben')] }), neuerZweig('Nein', 0.5, { schritte: [a('Inkasso beauftragen')] })] })
    const p = einfach([a('Rechnung prüfen'), neueWiederholung({ frage: 'Noch offen?', koerper: { id: 'k', schritte: [a('Zahlung prüfen'), mahnung] } })])
    const d = vd(p)
    expect(kapitel4(d).join(' ')).not.toMatch(/laufen mindestens einmal/)
    expect(unterkapitel(d, '4.2')[0]).toBe('Wiederholung: Der Abschnitt mit den Schritten 4.2 bis 4.4 läuft mindestens einmal und erneut, solange „Noch offen?“ mit „Ja“ beantwortet wird.')
  })

  it('beginnt der Körper mit einer Entscheidung, steht der Satz vor ihr', () => {
    const mahnung = neueEntscheidung({ frage: 'Erste Mahnung?', zweige: [neuerZweig('Ja', 0.5, { schritte: [a('Mahnung schreiben')] }), neuerZweig('Nein', 0.5, { schritte: [a('Inkasso beauftragen')] })] })
    const k4 = kapitel4(vd(einfach([neueWiederholung({ frage: 'Noch offen?', koerper: { id: 'k', schritte: [mahnung] } })])))
    const i = k4.indexOf('Wiederholung: Der folgende Abschnitt mit den Schritten 4.1 bis 4.2 läuft mindestens einmal und erneut, solange „Noch offen?“ mit „Ja“ beantwortet wird.')
    expect(i).toBeGreaterThanOrEqual(0)
    expect(k4[i + 1]).toBe('Entscheidung „Erste Mahnung?“:')
  })

  it('liegt der einzige Schritt in einem Zweig, heißt es „Abschnitt mit Schritt“', () => {
    const vorraetig = neueEntscheidung({ frage: 'Artikel vorrätig?', zweige: [neuerZweig('Ja', 0.5, { schritte: [a('Artikel buchen')] }), neuerZweig('Nein', 0.5)] })
    const k4 = kapitel4(vd(einfach([neueWiederholung({ frage: 'Weitere Position?', koerper: { id: 'k', schritte: [vorraetig] } })])))
    expect(k4).toContain('Wiederholung: Der folgende Abschnitt mit Schritt 4.1 läuft mindestens einmal und erneut, solange „Weitere Position?“ mit „Ja“ beantwortet wird.')
    expect(k4.join(' ')).not.toContain('Der Schritt 4.1 läuft mindestens einmal')
  })

  it('ohne Verzweigung bleibt es bei „laufen mindestens einmal“', () => {
    const k4 = kapitel4(vd(einfach([neueWiederholung({ frage: 'Fehler?', koerper: { id: 'k', schritte: [a('Packen')] } })])))
    expect(k4).toContain('Wiederholung: 4.1 läuft mindestens einmal und erneut, solange „Fehler?“ mit „Ja“ beantwortet wird.')
  })
})

describe('„weiter mit“ und „zurück zu“ nennen den ersten Baustein des Ziels (logik-0)', () => {
  const express = () => neueEntscheidung({ frage: 'Express gewünscht?', zweige: [neuerZweig('Ja', 0.5, { schritte: [a('Expressversand buchen')] }), neuerZweig('Nein', 0.5, { schritte: [a('Normalversand buchen')] })] })

  it('Zweig beginnt mit einer Entscheidung', () => {
    const p = einfach([neueEntscheidung({ frage: 'Ware vorrätig?', zweige: [neuerZweig('Ja', 0.5, { schritte: [express()] }), neuerZweig('Nein', 0.5, { schritte: [a('Ersatz anbieten')] })] })])
    const listen = ablauf(vd(p)).filter((x) => x.art === 'liste')
    // außen: 4.1 läuft nur bei „Express gewünscht?“ = „Ja“; innen ist „weiter mit 4.1“ richtig
    expect(listen[0]).toEqual({ art: 'liste', punkte: ['„Ja“: weiter mit der Entscheidung „Express gewünscht?“', '„Nein“: weiter mit 4.3'] })
    expect(listen[1]).toEqual({ art: 'liste', punkte: ['„Ja“: weiter mit 4.1', '„Nein“: weiter mit 4.2'] })
  })

  it('Zweig beginnt mit einer ODER-Verzweigung', () => {
    const wege = neueOder({ frage: 'Welche Unterlagen fehlen?', zweige: [neuerOderZweig('Gutachten fehlt', 0.5, { schritte: [a('Gutachten anfordern')] }), neuerOderZweig('Nachweis fehlt', 0.5, { schritte: [a('Nachweis anfordern')] })] })
    const p = einfach([neueEntscheidung({ frage: 'Vollständig?', zweige: [neuerZweig('Ja', 0.5), neuerZweig('Nein', 0.5, { schritte: [wege] })] })])
    expect(kapitel4(vd(p))).toContain('„Nein“: weiter mit der Entscheidung „Welche Unterlagen fehlen?“')
  })

  it('Rücksprung auf eine frühere Entscheidung und auf die eigene', () => {
    const vorraetig = neueEntscheidung({ frage: 'Ware vorrätig?', zweige: [neuerZweig('Ja', 0.5), neuerZweig('Nein', 0.5, { schritte: [a('Ersatz anbieten')] })] })
    const fehler = neueEntscheidung({ frage: 'Fehler beim Packen?', zweige: [neuerZweig('Nein', 0.5), neuerZweig('Ja', 0.5, { schritte: [a('Packliste prüfen')] })] })
    let p = einfach([vorraetig, a('Ware packen'), fehler])
    p = setzeRuecksprung(p, fehler.id, fehler.zweige[1].id, vorraetig.id)
    expect(kapitel4(vd(p))).toContain('„Ja“: weiter mit 4.3, danach zurück zur Entscheidung „Ware vorrätig?“')

    const vollstaendig = neueEntscheidung({ frage: 'Unterlagen vollständig?', zweige: [neuerZweig('Ja', 0.5, { schritte: [a('Antrag bearbeiten')] }), neuerZweig('Nein', 0.5, { schritte: [a('Unterlagen nachfordern')] })] })
    let q = einfach([a('Antrag annehmen'), vollstaendig])
    q = setzeRuecksprung(q, vollstaendig.id, vollstaendig.zweige[1].id, vollstaendig.id)
    expect(kapitel4(vd(q))).toContain('„Nein“: weiter mit 4.3, danach zurück zur Entscheidung „Unterlagen vollständig?“')
  })

  it('Rücksprungbereich beginnt mit einem Warten', () => {
    const vollstaendig = neueEntscheidung({ frage: 'Vollständig?', zweige: [neuerZweig('Ja', 0.5), neuerZweig('Nein', 0.5)] })
    const warten = neuesWarten({ name: 'Unterlagen abwarten', art: 'nachricht' })
    let p = einfach([warten, a('Unterlagen prüfen'), vollstaendig])
    p = setzeRuecksprung(p, vollstaendig.id, vollstaendig.zweige[1].id, warten.id)
    expect(kapitel4(vd(p))).toContain('„Nein“: zurück zu „Unterlagen abwarten“ (Warten)')
  })

  it('Zweig beginnt mit einem Warten', () => {
    const p = einfach([neueEntscheidung({ frage: 'Ware da?', zweige: [neuerZweig('Ja', 0.5), neuerZweig('Nein', 0.5, { schritte: [neuesWarten({ name: 'Lieferung abwarten' }), a('Ware einlagern')] })] })])
    expect(kapitel4(vd(p))).toContain('„Nein“: weiter mit „Lieferung abwarten“ (Warten)')
  })

  it('beide Beispiele bleiben unverändert', () => {
    expect(kapitel4(vd(beispielLieferdienst(), complianceLieferdienst()))).toContain('„Nein“: weiter mit 4.5, danach endet der Vorgang mit „Bestellung storniert“')
    expect(kapitel4(vd(beispielOnlinebestellung()))).toContain('„Korrektur erhalten“ (Nachricht von Kunde): zurück zu 4.1')
  })

  it('in 300 Zufallsprozessen zeigt jedes Ziel auf den ersten Baustein', () => {
    const betroffen: string[] = []
    for (let s = 1; s <= 300; s++) {
      const fehler = falscheSprungziele(zufallsProzess(s))
      if (fehler.length > 0) betroffen.push(`Prozess ${s}: ${fehler[0]}`)
    }
    expect(betroffen).toEqual([])
  })
})

describe('Kapitel 3.3: Häufigkeit einer Kontrolle in einem Zweig (logik-16)', () => {
  function haeufigkeit(p: Prozess, kontrolleId: Id): string {
    const c = neueCompliance()
    c.kontrollen[kontrolleId] = neueKontrollAngaben('vier_augen')
    const d = vd(p, c)
    const i = d.abschnitte.findIndex((x) => x.art === 'ueberschrift' && x.nummer === '3.3')
    const t = d.abschnitte.slice(i).find((x) => x.art === 'tabelle')
    if (!t || t.art !== 'tabelle') throw new Error('keine Tabelle in 3.3')
    return t.zeilen[0][5]
  }

  it('Freigabe nur über einem Betrag', () => {
    const freigabe = a('Rechnung freigeben', { art: 'freigabe' })
    const p = einfach([a('Rechnung erstellen'), neueEntscheidung({ frage: 'Betrag über 1.000 €?', zweige: [neuerZweig('Ja', 0.2, { schritte: [freigabe] }), neuerZweig('Nein', 0.8)] }), a('Rechnung versenden')])
    expect(haeufigkeit(p, freigabe.id)).toBe('wenn „Betrag über 1.000 €?“ = „Ja“ (siehe 4.2)')
  })

  it('Prüfung in einem ODER-Weg und nach einem Ereignis, verschachtelt', () => {
    const pruefung = a('Bonität prüfen', { art: 'pruefung' })
    const wege = neueOder({ frage: 'Kundenart?', zweige: [neuerOderZweig('Neukunde', 0.3, { schritte: [pruefung] }), neuerOderZweig('Großauftrag', 0.2)] })
    const antwort = neueEntscheidung({ art: 'ereignis', frage: 'Antwort?', zweige: [neuerZweig('Auftrag erhalten', 0.8, { schritte: [wege], ereignis: { art: 'nachricht', dauerMin: 60 } }), neuerZweig('Frist abgelaufen', 0.2, { ende: 'Verfallen', ereignis: { art: 'zeit', dauerMin: 600 } })] })
    expect(haeufigkeit(einfach([antwort]), pruefung.id)).toBe('wenn „Auftrag erhalten“ zuerst eintritt und „Neukunde“ zutrifft (siehe 4.1)')
  })

  it('ohne Bedingung bleibt es bei „bei jedem Vorgang“', () => {
    const pruefung = a('Ware kontrollieren', { art: 'pruefung' })
    expect(haeufigkeit(einfach([neueWiederholung({ koerper: { id: 'k', schritte: [a('Packen'), pruefung] } })]), pruefung.id)).toBe('bei jedem Vorgang')
  })
})
