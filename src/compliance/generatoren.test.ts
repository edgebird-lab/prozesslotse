import { describe, expect, it } from 'vitest'
import { neueAufgabe, neueOder, neuerOderZweig, neuerProzess, neuerTeilnehmer, neuerZweig, neueEntscheidung, neueParallel, neueRolle, neuesWarten } from '../modell/bausteine'
import { beispielLieferdienst, beispielOnlinebestellung } from '../modell/beispiel'
import { alleAufgaben, durchlaufe } from '../modell/operationen'
import type { Block, Prozess } from '../modell/typen'
import { zufallsProzess } from '../testhilfen/zufallsprozess'
import { complianceLieferdienst } from './beispiel'
import { kapitel } from './dokument'
import { neueCompliance, RECHTSSTAND } from './standard'
import type { Abschnitt, ComplianceProjekt, Dokument } from './typen'
import { entwurfsKontext, erzeugeDokumente, freigeben } from './versionen'

const HEUTE = '2026-11-11'

function dokumente(p: Prozess = beispielLieferdienst(), c: ComplianceProjekt = complianceLieferdienst()) {
  return erzeugeDokumente(p, c, entwurfsKontext(c, HEUTE))
}

/** Alle Texte eines Abschnitts */
function texte(a: Abschnitt): string[] {
  switch (a.art) {
    case 'ueberschrift':
      return [`${a.nummer} ${a.text}`]
    case 'absatz':
    case 'hinweis':
      return [a.text]
    case 'liste':
      return a.punkte
    case 'tabelle':
      return [...a.kopf, ...a.zeilen.flat()]
    case 'diagramm':
      return []
  }
}

function alleTexte(d: Dokument): string[] {
  return [d.titel, d.untertitel, d.versionText, ...d.abschnitte.flatMap(texte)]
}

function abschnitteVon(d: Dokument, schluessel: string): Abschnitt[] {
  return kapitel(d).get(schluessel) ?? []
}

function tabelleIn(d: Dokument, schluessel: string, index = 0) {
  const t = abschnitteVon(d, schluessel).filter((a) => a.art === 'tabelle')[index]
  if (!t || t.art !== 'tabelle') throw new Error(`keine Tabelle in ${schluessel}`)
  return t
}

function ueberschriften(d: Dokument, ebene: 1 | 2 | 3): string[] {
  return d.abschnitte.flatMap((a) => (a.art === 'ueberschrift' && a.ebene === ebene ? [`${a.nummer} ${a.text}`] : []))
}

function kapitel4(d: Dokument): string[] {
  return abschnitteVon(d, '4').flatMap(texte)
}

const VERBOTEN = /konform|rechtssicher|garantiert/i

describe('Verfahrensdokumentation Lieferdienst (9.6)', () => {
  const { verfahrensdoku: vd } = dokumente()

  it('hat die Kapitel des Musters, Kapitel 4 mit dem Prozessnamen', () => {
    expect(ueberschriften(vd, 1)).toEqual([
      '1 Vorbemerkungen zur Verfahrensdokumentation',
      '2 Zielsetzung und Überblick',
      '3 Organisation und Sicherheit des IT-gestützten Verfahrens',
      '4 Verfahren und Maßnahmen: Bestellung bis Rechnung (Lieferdienst)',
      '5 Ersetzendes Scannen',
      '6 Mitgeltende Unterlagen',
      '7 Änderungshistorie',
      '8 Glossar',
      '9 Anlage',
    ])
  })

  it('beschreibt in Kapitel 4 jede Aufgabe als Unterkapitel und schließt mit Aufbewahrung', () => {
    const unter = ueberschriften(vd, 2).filter((u) => u.startsWith('4.'))
    expect(unter).toHaveLength(19)
    expect(unter.slice(0, 18)).toEqual(alleAufgaben(beispielLieferdienst()).map((a, i) => `4.${i + 1} ${a.name}`))
    expect(unter[18]).toBe('4.19 Aufbewahrung, Vernichtung und Löschung')
  })

  it('nennt die Bedingungen verschachtelter Entscheidungen', () => {
    const k4 = kapitel4(vd)
    expect(k4).toContain('Nur wenn: „Ware vorrätig?“ = „Nein“, „Ersatz angenommen?“ = „Nein“.')
    expect(k4).toContain('„Nein“: weiter mit 4.5, danach endet der Vorgang mit „Bestellung storniert“')
    expect(k4).toContain('Die Schritte 4.6 bis 4.7 laufen mindestens einmal und werden wiederholt, solange gilt: „Fehler gefunden?“.')
    expect(k4).toContain('Medienbruch: Daten aus Papier werden von Hand übertragen.')
    expect(k4).toContain('Kontrolle: Vier-Augen-Prinzip; geprüft wird: Rechnung sachlich und rechnerisch richtig; Nachweis: Im System protokolliert.')
    expect(k4).toContain('Warten: Neuen Liefertermin abwarten (auf eine Nachricht von Kunde).')
    expect(k4).toContain('Nachricht an Kunde.')
  })

  it('beginnt Kapitel 2.1 mit dem Auslöser samt Absender', () => {
    expect(abschnitteVon(vd, '2.1').flatMap(texte).join(' ')).toContain('Er beginnt mit: Kunde bestellt telefonisch (Nachricht von Kunde).')
  })

  it('führt in 3.1 die Systeme und in 3.3 die Kontrollen', () => {
    const systeme = tabelleIn(vd, '3.1')
    expect(systeme.zeilen.map((z) => z[0])).toEqual(['Excel-Tourenliste', 'Warenwirtschaft'])
    expect(systeme.zeilen[1][5]).toBe('Als Cloud-Dienst')
    const kontrollen = tabelleIn(vd, '3.3')
    expect(kontrollen.zeilen.map((z) => z[0])).toEqual(['4.7 Kommissionierung kontrollieren', '4.17 Rechnung freigeben'])
    expect(kontrollen.zeilen[0][5]).toBe('bei jedem Vorgang')
  })

  it('listet in 2.4 die Unterlagen nach Entstehung mit Fristende im Bezugsjahr', () => {
    const t = tabelleIn(vd, '2.4')
    expect(t.kopf[6]).toBe('Beispiel 2026')
    expect(t.zeilen.map((z) => z[0])).toEqual(['Bestellnotiz', 'Bestellung', 'Lieferschein', 'Tourenliste', 'Ausgangsrechnung'])
    expect(t.zeilen.find((z) => z[0] === 'Ausgangsrechnung')?.[6]).toBe('bis 31.12.2034')
    expect(t.zeilen.find((z) => z[0] === 'Bestellung')?.[6]).toBe('bis 31.12.2032')
    expect(t.zeilen.find((z) => z[0] === 'Lieferschein')?.[5]).toBe('bis zum Versand der Rechnung')
  })

  it('lässt Kapitel 5 ohne Scannen entfallen', () => {
    expect(abschnitteVon(vd, '5').flatMap(texte)).toContain('Entfällt: Papierunterlagen werden nicht gescannt und anschließend vernichtet.')
  })

  it('ist ein Entwurf mit Hinweis und Rechtsstand', () => {
    expect(vd.versionText).toBe('Entwurf')
    expect(vd.rechtsstand).toBe(RECHTSSTAND)
    expect(vd.abschnitte[0]).toEqual({ art: 'absatz', text: 'Entwurf · Stand 11.11.2026' })
    expect(vd.abschnitte[1]).toMatchObject({ art: 'hinweis' })
    expect((vd.abschnitte[1] as { text: string }).text).toContain('Vorlage, erstellt mit dem Prozesslotsen am 11.11.2026. Rechtsstand 11.11.2026.')
  })

  it('hat ein Glossar mit zehn Begriffen und ein Formular für die Einweisung', () => {
    expect(tabelleIn(vd, '8').zeilen).toHaveLength(10)
    expect(tabelleIn(vd, '9.2').zeilen).toHaveLength(8)
  })

  it('verweist in Kapitel 5 und 6 auf das ersetzende Scannen, wenn Papier vernichtet wird', () => {
    const c = complianceLieferdienst()
    Object.assign(c.datenobjekte.dob_lieferschein, { ablageform: 'scan', originalVernichtet: true })
    const { verfahrensdoku } = dokumente(beispielLieferdienst(), c)
    expect(abschnitteVon(verfahrensdoku, '5').flatMap(texte).join(' ')).toContain('Für „Lieferschein“ gilt das ersetzende Scannen.')
    expect(abschnitteVon(verfahrensdoku, '6').flatMap(texte)).toContain('Verfahrensdokumentation zum ersetzenden Scannen')
  })
})

describe('Ablaufbeschreibung Onlinebestellung (ohne Compliance-Angaben)', () => {
  const { verfahrensdoku: vd } = dokumente(beispielOnlinebestellung(), neueCompliance())

  it('nummeriert 4.1 bis 4.8 und beschreibt Ereignis-Entscheidung, Rücksprung und Gleichzeitig', () => {
    expect(ueberschriften(vd, 2).filter((u) => u.startsWith('4.'))).toHaveLength(9)
    const k4 = kapitel4(vd)
    expect(k4).toContain('Es wird abgewartet, was zuerst eintritt („Antwort des Kunden?“):')
    expect(k4).toContain('„Korrektur erhalten“ (Nachricht von Kunde): zurück zu 4.1')
    expect(k4).toContain('„7 Tage ohne Antwort“ (Frist): weiter mit 4.4, danach endet der Vorgang mit „Bestellung verfallen“')
    expect(k4).toContain('Die folgenden Zweige laufen gleichzeitig; weiter geht es, wenn alle fertig sind:')
    expect(k4).toContain('Zweig 1: 4.5')
    expect(k4).toContain('Zweig 2: 4.6 bis 4.7')
    expect(k4).toContain('Nur wenn: „Daten vollständig und korrekt?“ = „Nein“, „Stornierung erhalten“ tritt zuerst ein.')
  })
})

describe('Satzbausteine für Format 3', () => {
  function einfach(schritte: Block[], werte: Partial<Prozess> = {}): Prozess {
    const rolle = neueRolle('Team')
    return neuerProzess({ name: 'Test', rollen: [rolle], ablauf: { id: 'haupt', schritte: schritte.map((b) => (b.typ === 'aufgabe' ? { ...b, rolleId: rolle.id } : b)) }, ...werte })
  }
  const k4 = (p: Prozess) => kapitel4(dokumente(p, neueCompliance()).verfahrensdoku)

  it('ODER-Verzweigung mit Weg für „keiner trifft zu“', () => {
    const a = neueAufgabe({ name: 'Gutachten anfordern' })
    const b = neueAufgabe({ name: 'Nachweis anfordern' })
    const keiner = neuerOderZweig('Keiner davon', 0)
    const oder = neueOder({ frage: 'Welche Unterlagen fehlen?', zweige: [neuerOderZweig('Gutachten fehlt', 0.3, { schritte: [a] }), neuerOderZweig('Nachweis fehlt', 0.4, { schritte: [b] }), keiner], standard: keiner.id })
    const text = k4(einfach([oder]))
    expect(text).toContain('Je nach Fall laufen einer oder mehrere dieser Wege („Welche Unterlagen fehlen?“):')
    expect(text).toContain('„Gutachten fehlt“: 4.1')
    expect(text).toContain('„Keiner davon“: ohne Aufgaben (wenn keiner zutrifft)')
    expect(text).toContain('Nur wenn: „Nachweis fehlt“ trifft zu.')
  })

  it('externe Teilnehmer an Auslöser, Aufgabe, Warten und Ereignis', () => {
    const kunde = neuerTeilnehmer('Kunde')
    const anfrage = neueAufgabe({ name: 'Angebot senden', nachrichtAn: kunde.id })
    const eingang = neueAufgabe({ name: 'Auftrag bestätigen', nachrichtVon: kunde.id })
    const warten = neuesWarten({ name: 'Unterschrift abwarten', art: 'nachricht', von: kunde.id })
    const antwort = neueEntscheidung({
      art: 'ereignis',
      frage: 'Antwort?',
      zweige: [neuerZweig('Zusage', 0.8, { ereignis: { art: 'nachricht', dauerMin: 60, von: kunde.id } }), neuerZweig('Keine Antwort', 0.2, { ende: 'Angebot verfallen', ereignis: { art: 'zeit', dauerMin: 600 } })],
    })
    const p = einfach([anfrage, antwort, eingang, warten], { teilnehmer: [kunde], ausloeser: { art: 'nachricht', text: 'Anfrage geht ein', von: kunde.id } })
    const text = k4(p)
    expect(text).toContain('Nachricht an Kunde.')
    expect(text).toContain('Nachricht von Kunde.')
    expect(text).toContain('Warten: Unterschrift abwarten (auf eine Nachricht von Kunde).')
    expect(text).toContain('„Zusage“ (Nachricht von Kunde): weiter im Ablauf')
    expect(text).toContain('„Keine Antwort“ (Frist): Der Vorgang endet mit „Angebot verfallen“')
    const { verfahrensdoku } = dokumente(p, neueCompliance())
    expect(abschnitteVon(verfahrensdoku, '2.1').flatMap(texte).join(' ')).toContain('Er beginnt mit: Anfrage geht ein (Nachricht von Kunde).')
    expect(abschnitteVon(verfahrensdoku, '2.6').flatMap(texte)).toContain('Kunde: tauscht Nachrichten mit dem Unternehmen aus')
  })

  it('Abbruch, erster von n und beliebige Reihenfolge, sobald es sie im Modell gibt', () => {
    const parallel = () => {
      const par = neueParallel(2)
      return { ...par, zweige: par.zweige.map((z, i) => ({ ...z, schritte: [neueAufgabe({ name: `Teil ${i + 1} erledigen` })] })) }
    }
    const erster = { ...parallel(), zusammenfuehrung: 'erster' } as Block
    const nacheinander = { ...parallel(), ausfuehrung: 'nacheinander' } as Block
    const ja = Object.assign(neuerZweig('Ja', 0.01, { ende: 'Abgebrochen', schritte: [neueAufgabe({ name: 'Konto sperren' })] }), { beendetAlles: true })
    const abbruch = neueEntscheidung({ frage: 'Betrug?', zweige: [neuerZweig('Nein', 0.99), ja] })
    const text = k4(einfach([erster, nacheinander, abbruch]))
    expect(text).toContain('Die folgenden Zweige laufen gleichzeitig; weiter geht es, sobald der erste fertig ist:')
    expect(text).toContain('Die folgenden Zweige werden in beliebiger Reihenfolge nacheinander erledigt:')
    expect(text.filter((t) => t.startsWith('Zweig '))).toEqual(['Zweig 1: 4.1', 'Zweig 2: 4.2', 'Zweig 1: 4.3', 'Zweig 2: 4.4'])
    expect(text).toContain('„Ja“: weiter mit 4.5, danach endet der gesamte Vorgang sofort mit „Abgebrochen“')
  })

  it('kennt alle Felder der Bausteine, damit neue Angaben nicht still fehlen', () => {
    // Kommt beim Zusammenführen mit main ein Feld hinzu (z. B. Unterbrechungen an Aufgaben), muss Kapitel 4 es beschreiben.
    const BEKANNT: Record<string, string[]> = {
      aufgabe: ['typ', 'id', 'name', 'rolleId', 'mediumId', 'bearbeitungMin', 'liegezeitMin', 'art', 'freigabeQuote', 'brauchtVorgaenger', 'uebertragung', 'nachrichtAn', 'nachrichtVon'],
      entscheidung: ['typ', 'id', 'art', 'frage', 'zweige'],
      oder: ['typ', 'id', 'frage', 'zweige', 'standard'],
      parallel: ['typ', 'id', 'zweige', 'zusammenfuehrung', 'ausfuehrung'],
      wiederholung: ['typ', 'id', 'modus', 'zweck', 'frage', 'anteilWiederholung', 'koerper'],
      warten: ['typ', 'id', 'name', 'art', 'dauerMin', 'von'],
    }
    const ZWEIG = ['id', 'schritte', 'bezeichnung', 'anteil', 'ende', 'zurueckZu', 'ereignis', 'beendetAlles']
    const unbekannt = new Set<string>()
    for (let s = 1; s <= 300; s++) {
      for (const { block } of durchlaufe(zufallsProzess(s).ablauf)) {
        const bekannt = BEKANNT[block.typ]
        if (!bekannt) unbekannt.add(block.typ)
        else for (const feld of Object.keys(block)) if (!bekannt.includes(feld)) unbekannt.add(`${block.typ}.${feld}`)
        if (block.typ === 'entscheidung' || block.typ === 'oder') for (const z of block.zweige) for (const feld of Object.keys(z)) if (!ZWEIG.includes(feld)) unbekannt.add(`zweig.${feld}`)
      }
    }
    expect([...unbekannt]).toEqual([])
  })
})

describe('Zufallsprozesse', () => {
  it('erzeugen 300-mal ohne Absturz, mit einem Unterkapitel je Aufgabe und nur vorhandenen Nummern', () => {
    for (let s = 1; s <= 300; s++) {
      const p = zufallsProzess(s)
      const n = alleAufgaben(p).length
      const { verfahrensdoku, verzeichnis } = dokumente(p, neueCompliance())
      const unter = ueberschriften(verfahrensdoku, 2).filter((u) => u.startsWith('4.'))
      expect(unter, `Prozess ${s}`).toHaveLength(n + 1)
      const genannt = kapitel4(verfahrensdoku).flatMap((t) => [...t.matchAll(/\b4\.(\d+|\?)/g)].map((m) => m[1]))
      for (const nr of genannt) expect(nr === '?' ? NaN : Number(nr), `Prozess ${s}: 4.${nr}`).toBeLessThanOrEqual(n + 1)
      for (const t of [...alleTexte(verfahrensdoku), ...alleTexte(verzeichnis)]) expect(t, `Prozess ${s}`).not.toMatch(VERBOTEN)
    }
  })
})

describe('Verzeichnis von Verarbeitungstätigkeiten (9.6)', () => {
  const { verzeichnis: vvt } = dokumente()
  const b = (schluessel: string) => abschnitteVon(vvt, schluessel).flatMap(texte)

  it('fasst Betroffene, Datenkategorien und Rechtsgrundlagen in Katalogreihenfolge zusammen', () => {
    const b3 = vvt.abschnitte.filter((a) => a.art === 'liste' && kapitel(vvt).get('B.3')?.includes(a))
    expect(b3.map((a) => (a as { punkte: string[] }).punkte)).toEqual([['Kunden'], ['Kontaktdaten (Anschrift, Telefon, E-Mail)', 'Vertrags- und Bestelldaten', 'Rechnungs- und Zahlungsdaten']])
    expect(b('B.2')).toEqual([
      'B.2 Rechtsgrundlagen',
      'Art. 6 Abs. 1 lit. b DSGVO: für einen Vertrag mit der Person oder ihre Anfrage nötig',
      'Art. 6 Abs. 1 lit. c DSGVO: gesetzliche Pflicht, z. B. Aufbewahrung nach § 147 AO',
    ])
  })

  it('nennt interne Rollen in Modellreihenfolge und externe Empfänger', () => {
    const listen = abschnitteVon(vvt, 'B.4').filter((a) => a.art === 'liste') as { punkte: string[] }[]
    expect(listen[0].punkte).toEqual(['Innendienst', 'Lager', 'Disposition', 'Fahrer', 'Buchhaltung', 'Niederlassungsleitung'])
    expect(listen[1].punkte).toEqual(['WaWi-Cloud (Beispielanbieter) (Auftragsverarbeiter, „Warenwirtschaft“)', 'Steuerberatung'])
  })

  it('sagt immer etwas zu Drittländern und beschreibt alle sechs Schutzbereiche', () => {
    expect(b('B.5')).toContain('Eine Übermittlung in Drittländer findet nicht statt und ist nicht geplant.')
    expect(ueberschriften(vvt, 2).filter((u) => u.startsWith('C.'))).toHaveLength(6)
    expect(b('C.6')).toContain('Keine Maßnahme eingetragen.')
    expect(b('C.1')).toContain('Trifft nicht zu: Keine Auswertungen, die Pseudonyme brauchen')
  })

  it('führt externe Rollen als extern, nicht als intern', () => {
    const p = beispielLieferdienst()
    p.rollen.push({ id: 'rol_stb', name: 'Steuerberatung', stundensatz: 90, personen: 1, verfuegbarProzent: 10 })
    p.ablauf.schritte.push(neueAufgabe({ id: 'auf_pruefen_stb', name: 'Rechnungen prüfen', rolleId: 'rol_stb', mediumId: 'med_erp' }))
    const c = complianceLieferdienst()
    c.rollen.rol_stb = { extern: true, organisation: 'Kanzlei Beispiel' }
    c.zugriffe.push({ aufgabeId: 'auf_pruefen_stb', unterlageId: 'dob_rechnung', richtung: 'liest' })
    const listen = abschnitteVon(dokumente(p, c).verzeichnis, 'B.4').filter((a) => a.art === 'liste') as { punkte: string[] }[]
    expect(listen[0].punkte).not.toContain('Steuerberatung')
    expect(listen[1].punkte).toContain('Kanzlei Beispiel (Steuerberatung)')
  })

  it('nennt Empfänger im Drittland konkret in einer Tabelle', () => {
    const c = complianceLieferdienst()
    Object.assign(c.datenobjekte.dob_rechnung.externeEmpfaenger[0], { standort: 'drittland', drittland: 'USA', garantie: 'standardvertragsklauseln', name: 'Beispiel Inc.' })
    const t = tabelleIn(dokumente(beispielLieferdienst(), c).verzeichnis, 'B.5')
    expect(t.zeilen).toEqual([['Beispiel Inc.', 'USA', 'Standardvertragsklauseln (Art. 46 DSGVO)']])
  })
})

describe('Allgemein', () => {
  it('erzeugt bei gleicher Eingabe dasselbe Dokument', () => {
    expect(JSON.stringify(dokumente())).toBe(JSON.stringify(dokumente()))
  })

  it('verspricht nirgends Konformität', () => {
    const { verfahrensdoku, verzeichnis } = dokumente()
    for (const t of [...alleTexte(verfahrensdoku), ...alleTexte(verzeichnis)]) expect(t).not.toMatch(VERBOTEN)
  })

  it('trägt Hinweis A.0 und Rechtsstand in beiden Dokumenten, auch in eingefrorenen Versionen', async () => {
    const c = complianceLieferdienst()
    const v = await freigeben(beispielLieferdienst(), c, { bezeichnung: '1.0', gueltigAb: HEUTE, freigegebenVon: 'Erika Mustermann', aenderung: 'Erstfassung' }, HEUTE)
    for (const d of [...Object.values(dokumente()), v.verfahrensdoku, v.verzeichnis]) {
      expect(d.rechtsstand).toBe(RECHTSSTAND)
      const hinweis = d.abschnitte.find((a) => a.art === 'hinweis')
      expect(hinweis && 'text' in hinweis ? hinweis.text : '').toMatch(/^Vorlage, erstellt mit dem Prozesslotsen am .*Rechtsstand 11\.11\.2026\./)
    }
    expect(v.verfahrensdoku.versionText).toBe('1.0')
    expect(v.verfahrensdoku.abschnitte[0]).toEqual({ art: 'absatz', text: 'Version 1.0 · gültig ab 11.11.2026' })
  })

  it('erzeugt für einen leeren Prozess ohne Angaben vollständige Dokumente', () => {
    const { verfahrensdoku, verzeichnis } = dokumente(neuerProzess(), neueCompliance())
    expect(ueberschriften(verfahrensdoku, 2)).toContain('4.1 Aufbewahrung, Vernichtung und Löschung')
    expect(alleTexte(verzeichnis)).toContain('Eine Übermittlung in Drittländer findet nicht statt und ist nicht geplant.')
  })
})
