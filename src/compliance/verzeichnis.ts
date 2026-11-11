/**
 * Verzeichnis von Verarbeitungstätigkeiten nach Art. 30 Abs. 1 DSGVO im Aufbau
 * des Musters der Datenschutzkonferenz (Spezifikation 3.5 und 6.7). Listen über
 * mehrere Unterlagen sind eindeutig und in Katalogreihenfolge.
 */
import type { Prozess } from '../modell/typen'
import { hatPersonenbezug, kontext, mitDienstleister, rollenAngaben, rollenMitZugriff, systemAngaben, systemeImEinsatz } from './ableitung'
import { formatiereDatum } from './datum'
import { istKaufmann, loeschText } from './fristen'
import { AUSNAHMEN_ART9, BESONDERE_KATEGORIEN, BETROFFENE, DATENKATEGORIEN, GARANTIEN, RECHTSGRUNDLAGEN, RECHTSSTAND, STRAFRECHTLICH_TEXT, textVon, TOM_BEREICHE, type Eintrag } from './standard'
import { geprueftText, hinweisVerzeichnis } from './textbausteine'
import type { Abschnitt, ComplianceProjekt, Dokument, Kontakt, VersionKopf } from './typen'
import { anschriftText, firmenName, satzAnfang, prozessName, unterlagenNachEntstehung, versionsZeile, type DokuKontext } from './verfahrensdoku'

function vereinigt<T extends string>(katalog: readonly Eintrag<T>[], werte: T[][]): Eintrag<T>[] {
  const alle = new Set(werte.flat())
  return katalog.filter((e) => alle.has(e.wert))
}

function kontaktText(k: Kontakt): string {
  const teile = [k.name.trim() || 'offen', anschriftText(k.anschrift), k.telefon.trim(), k.email.trim()].filter((t) => t && t !== 'offen')
  return teile.length > 0 ? teile.join(', ') : 'offen'
}

export function erzeugeVerzeichnis(ist: Prozess, c: ComplianceProjekt, kx: DokuKontext): Dokument {
  const k = kontext(ist, c)
  const u = c.unternehmen
  const v = c.verarbeitung
  const name = prozessName(ist)
  const firma = firmenName(c)
  const a: Abschnitt[] = []
  const h = (ebene: 1 | 2 | 3, nummer: string, text: string) => a.push({ art: 'ueberschrift', ebene, nummer, text })
  const absatz = (text: string) => a.push({ art: 'absatz', text })
  const liste = (punkte: string[]) => a.push({ art: 'liste', punkte })
  const tabelle = (kopf: string[], zeilen: string[][]) => a.push({ art: 'tabelle', kopf, zeilen })

  // Deckblatt; eine freigegebene Fassung trägt statt des Vorlagenhinweises die Verantwortung des Unternehmens (recht-5)
  absatz(versionsZeile(kx))
  if (kx.version?.fachlichGeprueft) absatz(`${satzAnfang(geprueftText(kx.version.fachlichGeprueft))}.`)
  a.push({ art: 'hinweis', text: hinweisVerzeichnis(name, kx.heute, RECHTSSTAND, kx.version !== null) })

  // A
  h(1, 'A', 'Angaben zum Verantwortlichen')
  tabelle(
    ['Angabe', 'Inhalt'],
    [
      ['Name', firma],
      ['Anschrift', anschriftText(u.anschrift)],
      ['Telefon', u.telefon.trim() || '–'],
      ['E-Mail', u.email.trim() || '–'],
      ['Internet', u.internet.trim() || '–'],
      ...(u.gemeinsamVerantwortlicher ? [['Gemeinsam Verantwortlicher', kontaktText(u.gemeinsamVerantwortlicher)]] : []),
      ...(u.vertreter ? [['Vertreter in der EU', kontaktText(u.vertreter)]] : []),
      ['Datenschutzbeauftragter', u.datenschutzbeauftragter ? `${kontaktText(u.datenschutzbeauftragter)} (${u.datenschutzbeauftragter.extern ? 'extern' : 'intern'})` : 'nicht benannt'],
    ],
  )

  // B
  const benennung = v.benennung.trim() || name
  h(1, 'B', `Verarbeitungstätigkeit ${v.laufendeNummer.trim() || '1'}: ${benennung}`)
  tabelle(
    ['Angabe', 'Inhalt'],
    [
      ['Benennung', benennung],
      ['Laufende Nummer', v.laufendeNummer.trim() || '1'],
      ['Eingeführt am', v.eingefuehrtAm ? formatiereDatum(v.eingefuehrtAm) : 'offen'],
      ['Letzte Änderung', kx.version ? formatiereDatum(kx.version.gueltigAb) : 'Entwurf'],
      ['Fachabteilung', v.fachabteilung.trim() || '–'],
      ['Ansprechpartner', v.ansprechpartner.trim() || 'offen'],
      ['Telefon', v.telefon.trim() || '–'],
      ['E-Mail', v.email.trim() || '–'],
    ],
  )

  const personen = unterlagenNachEntstehung(k).filter((o) => o.d.personenbezogen === true)
  const kaufmann = istKaufmann(u)
  // Besondere Kategorien brauchen zusätzlich zu Art. 6 eine Ausnahme nach Art. 9 Abs. 2 DSGVO
  const mitBesonderen = personen.filter((o) => o.d.besondereKategorien.length > 0)
  const art9 = (o: (typeof personen)[number]) => AUSNAHMEN_ART9.find((e) => e.wert === o.d.ausnahmeArt9)

  h(2, 'B.1', 'Zwecke (Art. 30 Abs. 1 lit. b DSGVO)')
  const zwecke = v.zwecke.map((z) => z.trim()).filter(Boolean)
  if (zwecke.length > 0) liste(zwecke)
  else absatz('offen')

  h(2, 'B.2', 'Rechtsgrundlagen')
  const grundlagen = RECHTSGRUNDLAGEN.filter((r) => personen.some((o) => o.d.rechtsgrundlagen.includes(r.wert)))
  const art6 = grundlagen.map((r) => {
    const interessen = r.wert === 'interesse' ? [...new Set(personen.filter((o) => o.d.rechtsgrundlagen.includes('interesse')).map((o) => o.d.berechtigtesInteresse.trim()).filter(Boolean))] : []
    return `Art. 6 Abs. 1 lit. ${r.lit} DSGVO: ${r.dok ?? r.text}${interessen.length > 0 ? ` (${interessen.join('; ')})` : ''}`
  })
  const ausnahmen = [
    ...AUSNAHMEN_ART9.flatMap((e) => {
      const namen = mitBesonderen.filter((o) => o.d.ausnahmeArt9 === e.wert).map((o) => o.name)
      return namen.length > 0 ? [`Art. 9 Abs. 2 lit. ${e.lit} DSGVO: ${e.dok ?? e.text} (für ${namen.join(', ')})`] : []
    }),
    ...(mitBesonderen.some((o) => !art9(o)) ? [`Art. 9 Abs. 2 DSGVO: offen (für ${mitBesonderen.filter((o) => !art9(o)).map((o) => o.name).join(', ')})`] : []),
  ]
  if (art6.length + ausnahmen.length > 0) liste([...(art6.length > 0 ? art6 : ['Art. 6 Abs. 1 DSGVO: offen']), ...ausnahmen])
  else absatz('offen')

  h(2, 'B.3', 'Betroffene Personen und Daten (lit. c)')
  const betroffene = vereinigt(BETROFFENE, personen.map((o) => o.d.betroffene))
  const kategorien = vereinigt(DATENKATEGORIEN, personen.map((o) => o.d.datenkategorien))
  const besondere = vereinigt(BESONDERE_KATEGORIEN, personen.map((o) => o.d.besondereKategorien))
  absatz('Betroffene Personen:')
  if (betroffene.length > 0) liste(betroffene.map((e) => e.dok ?? e.text))
  else absatz('offen')
  absatz('Kategorien personenbezogener Daten:')
  if (kategorien.length > 0) liste(kategorien.map((e) => e.dok ?? e.text))
  else absatz('offen')
  if (besondere.length > 0) {
    absatz('Besondere Kategorien personenbezogener Daten (Art. 9 Abs. 1 DSGVO):')
    liste(besondere.map((e) => e.text))
  }
  const straf = personen.filter((o) => o.d.strafrechtlich)
  if (straf.length > 0) absatz(`${STRAFRECHTLICH_TEXT} (Art. 10 DSGVO): in ${straf.map((o) => o.name).join(', ')}.`)
  if (personen.length > 0) {
    tabelle(
      ['Unterlage', 'Betroffene', 'Daten', 'Rechtsgrundlage', 'Löschung'],
      personen.map((o) => {
        const besondereDaten = BESONDERE_KATEGORIEN.filter((e) => o.d.besondereKategorien.includes(e.wert)).map((e) => e.text)
        const daten = [
          DATENKATEGORIEN.filter((e) => o.d.datenkategorien.includes(e.wert)).map((e) => e.dok ?? e.text).join(', ') || 'offen',
          ...(besondereDaten.length > 0 ? [`${besondereDaten.join(', ')} (Art. 9 DSGVO)`] : []),
          ...(o.d.strafrechtlich ? [`${STRAFRECHTLICH_TEXT} (Art. 10 DSGVO)`] : []),
        ]
        const grundlage = RECHTSGRUNDLAGEN.filter((r) => o.d.rechtsgrundlagen.includes(r.wert)).map((r) => `lit. ${r.lit}`).join(', ') || 'offen'
        const ausnahme = besondereDaten.length > 0 ? `; Art. 9 Abs. 2${art9(o) ? ` lit. ${art9(o)!.lit}` : ': offen'}` : ''
        return [o.name, BETROFFENE.filter((e) => o.d.betroffene.includes(e.wert)).map((e) => e.text).join(', ') || 'offen', daten.join(', '), `${grundlage}${ausnahme}`, loeschText(o.d, kaufmann)]
      }),
    )
  }

  h(2, 'B.4', 'Empfänger (lit. d)')
  const intern = ist.rollen.filter((r) => !rollenAngaben(c, r.id).extern && personen.some((o) => rollenMitZugriff(k, o.id).intern.includes(r)))
  absatz('Intern (Rollen mit Zugriff):')
  if (intern.length > 0) liste(intern.map((r) => r.name.trim() || 'Unbenannte Rolle'))
  else absatz('keine')
  const extern: string[] = []
  for (const r of ist.rollen) {
    const ra = rollenAngaben(c, r.id)
    if (!ra.extern || !personen.some((o) => rollenMitZugriff(k, o.id).extern.includes(r))) continue
    extern.push(ra.organisation.trim() ? `${ra.organisation.trim()} (${r.name.trim() || 'Rolle'})` : r.name.trim() || 'Externe Rolle')
  }
  const systeme = systemeImEinsatz(k).filter((m) => hatPersonenbezug(k, m.id))
  for (const m of systeme) {
    const s = systemAngaben(c, m.id)
    if (!mitDienstleister(s)) continue
    const dienstleister = s.dienstleister.trim() || `Anbieter von „${m.name.trim() || 'Unbenanntes System'}“`
    extern.push(s.auftragsverarbeitung === true ? `${dienstleister} (Auftragsverarbeiter, „${m.name.trim() || 'Unbenanntes System'}“)` : dienstleister)
  }
  for (const kategorie of new Set(personen.flatMap((o) => o.d.externeEmpfaenger.map((e) => e.kategorie.trim() || e.name.trim() || 'Empfänger ohne Angabe')))) extern.push(kategorie)
  absatz('Extern:')
  if (extern.length > 0) liste([...new Set(extern)])
  else absatz('keine')

  h(2, 'B.5', 'Übermittlung in Drittländer (lit. e)')
  const drittland: string[][] = []
  const offen: string[] = []
  for (const m of systeme) {
    const s = systemAngaben(c, m.id)
    // Ohne Angabe zum Betrieb ist offen, ob ein Dienstleister die Daten verarbeitet und wo
    if (s.betrieb === null && !mitDienstleister(s)) offen.push(`„${m.name.trim() || 'Unbenanntes System'}“ (Betrieb offen)`)
    if (!mitDienstleister(s)) continue
    const wer = s.dienstleister.trim() || `Anbieter von „${m.name.trim()}“`
    if (s.standort === 'drittland') drittland.push([wer, s.drittland.trim() || 'offen', textVon(GARANTIEN, s.garantie, 'dok')])
    if (s.standort === 'unbekannt') offen.push(wer)
  }
  for (const o of personen) {
    for (const e of o.d.externeEmpfaenger) {
      const wer = e.name.trim() || e.kategorie.trim() || 'Empfänger ohne Angabe'
      if (e.standort === 'drittland') drittland.push([e.name.trim() || `offen (${e.kategorie.trim() || 'Empfänger'})`, e.drittland.trim() || 'offen', textVon(GARANTIEN, e.garantie, 'dok')])
      if (e.standort === 'unbekannt') offen.push(wer)
    }
  }
  // „findet nicht statt“ nur, wenn alle Standorte bekannt sind; sonst stünde dort eine ungeprüfte Aussage
  if (drittland.length > 0) {
    tabelle(['Empfänger', 'Land', 'Garantie'], drittland)
    if (offen.length > 0) absatz(`Ort der Verarbeitung offen bei: ${[...new Set(offen)].join(', ')}.`)
  } else if (offen.length > 0) absatz(`Ob personenbezogene Daten in Drittländer übermittelt werden, ist noch offen bei: ${[...new Set(offen)].join(', ')}.`)
  else absatz('Eine Übermittlung in Drittländer findet nicht statt und ist nicht geplant.')

  h(2, 'B.6', 'Löschfristen (lit. f)')
  if (personen.length > 0) tabelle(['Unterlage', 'Löschfrist'], personen.map((o) => [o.name, loeschText(o.d, kaufmann)]))
  else absatz('offen')

  h(2, 'B.7', 'Technische und organisatorische Maßnahmen (lit. g)')
  absatz('Siehe Abschnitt C.')

  // C
  h(1, 'C', 'Technische und organisatorische Maßnahmen (Art. 32 Abs. 1 DSGVO)')
  TOM_BEREICHE.forEach((b, i) => {
    h(2, `C.${i + 1}`, b.name)
    const t = c.toms[b.wert]
    const massnahmen = t.massnahmen.map((m) => m.trim()).filter(Boolean)
    if (massnahmen.length > 0) liste(massnahmen)
    else if (t.nichtZutreffend.trim()) absatz(`Trifft nicht zu: ${t.nichtZutreffend.trim()}`)
    else absatz('Keine Maßnahme eingetragen.')
    // Zugriffsschutz der Systeme mit Personenbezug (Teilschritt „Systeme und Dienstleister“)
    if (b.wert === 'vertraulichkeit' && systeme.length > 0) {
      absatz('Zugriffsschutz je System:')
      liste(systeme.map((m) => `${m.name.trim() || 'Unbenanntes System'}: ${systemAngaben(c, m.id).zugriffsschutz.trim() || 'offen'}`))
    }
  })

  // D
  h(1, 'D', 'Änderungen')
  if (kx.historie.length > 0) {
    // Eine zurückgezogene Freigabe galt nie; sie bleibt mit Datum und Grund sichtbar
    const aenderung = (x: VersionKopf) => {
      const text = x.aenderung.trim() || '–'
      const geprueft = x.fachlichGeprueft ? `; ${geprueftText(x.fachlichGeprueft)}` : ''
      return x.zurueckgezogen ? `${text}${geprueft}; zurückgezogen am ${formatiereDatum(x.zurueckgezogen.am)}: ${x.zurueckgezogen.grund.trim()}` : `${text}${geprueft}`
    }
    tabelle(['Version', 'gültig ab', 'Änderung'], kx.historie.map((x) => [x.bezeichnung, formatiereDatum(x.gueltigAb), aenderung(x)]))
  } else absatz('Noch keine Version freigegeben.')
  tabelle(['Ort, Datum', 'Unterschrift des Verantwortlichen'], [['', '']])

  return {
    art: 'verarbeitungsverzeichnis',
    titel: 'Verzeichnis von Verarbeitungstätigkeiten',
    untertitel: `Verantwortlicher nach Art. 30 Abs. 1 DSGVO · ${firma}`,
    versionText: kx.version ? kx.version.bezeichnung : 'Entwurf',
    stand: kx.heute,
    rechtsstand: RECHTSSTAND,
    abschnitte: a,
  }
}
