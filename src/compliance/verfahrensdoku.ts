/**
 * Verfahrensdokumentation nach GoBD Rz. 151–155 (Spezifikation 6.6). Reine
 * Funktion: gleiche Eingabe ergibt gleiches Dokument. Leere Werte erscheinen als
 * „–“, offene Pflichtangaben als „offen“.
 */
import { teilnehmerName } from '../modell/operationen'
import { MEDIUM_ARTEN, type Prozess } from '../modell/typen'
import { formatiereZahl } from '../modell/zeit'
import {
  ablageVon,
  ablageVonObjekt,
  angaben,
  aufzaehlung,
  entstehtIn,
  hatPersonenbezug,
  kontext,
  kontrollAngaben,
  mitDienstleister,
  objektName,
  rollenAngaben,
  schrittText,
  systemAngaben,
  systemeImEinsatz,
  type Kontext,
} from './ableitung'
import { ablaufBeschreibung, wennText } from './ablauftext'
import { formatiereDatum } from './datum'
import { kapitelText } from './dokument'
import { aufbewahrenBisText, aufbewahrungText, beispielBis, fristText, gueltigBisIn, istKaufmann, laengerAlsVorgeschrieben, lieferscheinHgb } from './fristen'
import { mitgeltendeUnterlagen, mitgeltendText } from './mitgeltend'
import {
  ABLAGEFORMEN,
  AUFBEWAHRUNGSARTEN,
  BELEGFORMEN,
  BETRIEBE,
  GEWINNERMITTLUNGEN,
  istPflichtig,
  KONTROLLARTEN,
  LOESCH_TURNUS,
  NACHWEISE,
  RECHTSFORMEN,
  RECHTSSTAND,
  SICHERUNGEN,
  STANDORTE,
  textVon,
  UNVERAENDERBARKEIT,
} from './standard'
import {
  AUFBAU_RZ153,
  DATENSCHUTZ,
  DATENZUGRIFF,
  FRISTEN_INSTITUTE,
  fristenTabelle,
  FRISTENREGEL,
  GLOSSAR,
  GRUNDLAGEN,
  HISTORIE,
  geprueftText,
  hinweisVerfahrensdoku,
  iks,
  KRITERIEN,
  LIEFERSCHEIN_HGB,
  SYSTEMWECHSEL,
} from './textbausteine'
import type { Abschnitt, ComplianceProjekt, DatenobjektAngaben, Dokument, IsoDatum, Nachweis, SystemAngaben, VersionKopf } from './typen'

/** Wofür ein Dokument erzeugt wird: Version (null = Entwurf), bisherige Versionen, Bezugsjahr, Tag. */
export interface DokuKontext {
  version: VersionKopf | null
  /** Versionen bis einschließlich `version` bzw. alle bisherigen beim Entwurf */
  historie: VersionKopf[]
  /** Jahr für die Beispieldaten in Kapitel 2.4 */
  bezugsjahr: number
  heute: IsoDatum
}

export function prozessName(p: Prozess): string {
  return p.name.trim() || 'Unbenannter Prozess'
}

export function firmenName(c: ComplianceProjekt): string {
  return c.unternehmen.name.trim() || 'offen'
}

export function anschriftText(a: { strasse: string; plz: string; ort: string }): string {
  const ort = [a.plz.trim(), a.ort.trim()].filter(Boolean).join(' ')
  return [a.strasse.trim(), ort].filter(Boolean).join(', ') || 'offen'
}

/** Erster Buchstabe groß, für Sätze aus Satzteilen wie „fachlich geprüft von …“ */
export function satzAnfang(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Zeile für das Deckblatt: „Version 1.0 · gültig ab 11.11.2026“ oder „Entwurf · Stand 11.11.2026“ */
export function versionsZeile(kx: DokuKontext): string {
  return kx.version ? `Version ${kx.version.bezeichnung} · gültig ab ${formatiereDatum(kx.version.gueltigAb)}` : `Entwurf · Stand ${formatiereDatum(kx.heute)}`
}

function vorgaenger(kx: DokuKontext): VersionKopf | null {
  // zurückgezogene Freigaben galten nie und sind kein Vorgänger
  const fruehere = (kx.version ? kx.historie.filter((v) => v.nummer < kx.version!.nummer) : kx.historie).filter((v) => !v.zurueckgezogen)
  return fruehere[fruehere.length - 1] ?? null
}

/** Unterlagen in der Reihenfolge ihrer Entstehung; ohne Ersteller am Ende nach Name. */
export function unterlagenNachEntstehung(k: Kontext): { id: string; name: string; d: DatenobjektAngaben }[] {
  const mit = k.sicht.objekte.map((o) => ({ id: o.id, name: o.name.trim() || 'Unbenannte Unterlage', d: angaben(k.c, o.id), pos: entstehtIn(k, o.id) }))
  const mitErsteller = mit.filter((o) => o.pos).sort((a, b) => k.position.get(a.pos!.id)! - k.position.get(b.pos!.id)!)
  const ohne = mit.filter((o) => !o.pos).sort((a, b) => a.name.localeCompare(b.name, 'de'))
  return [...mitErsteller, ...ohne]
}

function ablageText(k: Kontext, d: DatenobjektAngaben): string {
  const orte = ablageVonObjekt(k, d).map((s) => s.name.trim() || 'Unbenannter Ablageort')
  if (orte.length === 0) return istPflichtig(d.aufbewahrungsart) ? 'offen' : '–'
  return `${orte.join(', ')}${d.ablageform ? ` (${textVon(ABLAGEFORMEN, d.ablageform, 'dok')})` : ''}`
}

export function standortText(s: { standort: SystemAngaben['standort']; drittland: string }): string {
  return s.standort === 'drittland' ? `Drittland: ${s.drittland.trim() || 'offen'}` : textVon(STANDORTE, s.standort, 'dok')
}

export function erzeugeVerfahrensdoku(ist: Prozess, c: ComplianceProjekt, kx: DokuKontext): Dokument {
  const k = kontext(ist, c)
  const u = c.unternehmen
  const name = prozessName(ist)
  const firma = firmenName(c)
  // Kaufleute: beim Lieferschein zusätzlich die mögliche Frist als Handelsbrief (§ 257 HGB)
  const kaufmann = istKaufmann(u)
  const aufbewahrung = (d: DatenobjektAngaben) => `${aufbewahrungText(d)}${lieferscheinHgb(d, kaufmann) ? `; ${LIEFERSCHEIN_HGB}` : ''}`
  const a: Abschnitt[] = []
  const h = (ebene: 1 | 2 | 3, nummer: string, text: string) => a.push({ art: 'ueberschrift', ebene, nummer, text })
  const absatz = (text: string) => a.push({ art: 'absatz', text })
  const liste = (punkte: string[]) => a.push({ art: 'liste', punkte })
  const tabelle = (kopf: string[], zeilen: string[][]) => a.push({ art: 'tabelle', kopf, zeilen })

  // Deckblatt; eine freigegebene Fassung trägt statt des Vorlagenhinweises die Verantwortung des Unternehmens (recht-5)
  absatz(versionsZeile(kx))
  if (kx.version?.fachlichGeprueft) absatz(`${satzAnfang(geprueftText(kx.version.fachlichGeprueft))}.`)
  a.push({ art: 'hinweis', text: hinweisVerfahrensdoku(name, kx.heute, RECHTSSTAND, kx.version !== null) })

  // 1
  h(1, '1', 'Vorbemerkungen zur Verfahrensdokumentation')
  // Satzbau ohne Artikel vor Freitext; offene Angaben ergeben keinen Satz wie „bei offen“
  const unternehmen = u.name.trim() ? ` des Unternehmens ${u.name.trim()}` : '; der Name des Unternehmens ist offen'
  absatz(`Gegenstand dieser Dokumentation ist der Prozess „${name}“${unternehmen}. Inhalt und jede Änderung bedürfen der Zustimmung der Geschäftsleitung (${u.geschaeftsleitung.trim() || 'Name offen'}).`)
  absatz(
    kx.version
      ? `Version ${kx.version.bezeichnung}, freigegeben von ${kx.version.freigegebenVon.trim() || 'offen'} am ${formatiereDatum(kx.version.freigegebenAm)}. Sie gilt für das Verfahren, wie es seit dem ${formatiereDatum(kx.version.gueltigAb)} angewandt wird.`
      : 'Entwurf, noch nicht freigegeben.',
  )
  const vorige = vorgaenger(kx)
  if (vorige) absatz(`Vorgängerversion: ${vorige.bezeichnung}. Was sich geändert hat, zeigt Kapitel 7.`)
  absatz(AUFBAU_RZ153)

  // 2
  h(1, '2', 'Zielsetzung und Überblick')
  h(2, '2.1', 'Zielsetzung und Anwendungsbereich')
  const ausloeser = ist.ausloeser.text.trim().replace(/[.\s]+$/, '') || 'offen'
  const von = ist.ausloeser.art === 'nachricht' && ist.ausloeser.von ? ` (Nachricht von ${teilnehmerName(ist, ist.ausloeser.von)})` : ''
  absatz(`Die Dokumentation gilt für den Prozess „${name}“. Er beginnt mit: ${ausloeser}${von}. Er endet regulär mit: ${ist.ergebnis.trim().replace(/[.\s]+$/, '') || 'offen'}.`)
  if (ist.beschreibung.trim()) absatz(ist.beschreibung.trim())
  absatz('Betroffene Unterlagen: siehe 2.4.')

  h(2, '2.2', 'Unternehmen und organisatorisches Umfeld')
  h(3, '2.2.1', 'Unternehmensportrait')
  tabelle(
    ['Angabe', 'Inhalt'],
    [
      ['Name', firma],
      ['Sitz', anschriftText(u.anschrift)],
      ['Rechtsform', textVon(RECHTSFORMEN, u.rechtsform, 'dok')],
      ['Branche', u.branche.trim() || '–'],
      ['Geschäftszweck', u.geschaeftszweck.trim() || '–'],
      ['Gewinnermittlung', textVon(GEWINNERMITTLUNGEN, u.gewinnermittlung, 'dok')],
    ],
  )
  h(3, '2.2.2', 'Aufbau- und Ablauforganisation')
  if (ist.rollen.length > 0) {
    tabelle(
      ['Rolle', 'Personen', 'intern oder extern'],
      ist.rollen.map((r) => {
        const ra = rollenAngaben(c, r.id)
        return [r.name.trim() || 'Unbenannte Rolle', formatiereZahl(r.personen, 1), ra.extern ? `extern${ra.organisation.trim() ? ` (${ra.organisation.trim()})` : ''}` : 'intern']
      }),
    )
  } else absatz('Rollen: offen.')
  absatz('Den Ablauf zeigt das Diagramm in Kapitel 9.1.')
  h(3, '2.2.3', 'Einsatzorte')
  const standorte = u.standorte.map((s) => s.trim()).filter(Boolean)
  if (standorte.length > 0) liste(standorte)
  else absatz('Standorte: offen.')
  const papier = k.sicht.speicher.filter((s) => s.mediumId && k.medien.get(s.mediumId)?.art === 'papier').map((s) => s.name.trim() || 'Unbenannter Ablageort')
  if (papier.length > 0) absatz(`Papierablagen: ${papier.join(', ')}.`)

  h(2, '2.3', 'Rechtliche Grundlagen und Ordnungsmäßigkeitskriterien')
  absatz(GRUNDLAGEN)
  absatz(FRISTENREGEL)
  // fristenTabelle liefert Kopien: eingefrorene Versionen teilen sich sonst das Modul-Array
  tabelle(['Unterlagen', 'Vorschrift', 'Frist'], fristenTabelle(kaufmann))
  absatz(FRISTEN_INSTITUTE)
  tabelle(
    ['Nr.', 'Anforderung', 'Bedeutung'],
    KRITERIEN.map(([anforderung, bedeutung], i) => [String(i + 1), anforderung, bedeutung]),
  )
  const unterlagen = unterlagenNachEntstehung(k)
  const laenger = unterlagen.filter((o) => laengerAlsVorgeschrieben(o.d, kaufmann))
  if (laenger.length > 0) absatz(`Länger als vorgeschrieben werden aufbewahrt: ${laenger.map((o) => o.name).join(', ')}. Grund: ${c.begruendungLaengereAufbewahrung.trim().replace(/[.\s]+$/, '') || 'offen'}.`)

  h(2, '2.4', 'Relevante Dokumente')
  if (unterlagen.length > 0) {
    tabelle(
      ['Unterlage', 'Einordnung', 'Form', 'Entsteht in', 'Ablage', 'Aufbewahrung', `Beispiel ${kx.bezugsjahr}`],
      unterlagen.map((o) => {
        const e = entstehtIn(k, o.id)
        return [o.name, textVon(AUFBEWAHRUNGSARTEN, o.d.aufbewahrungsart, 'dok'), textVon(BELEGFORMEN, o.d.form, 'dok'), e ? schrittText(k, e) : '–', ablageText(k, o.d), aufbewahrung(o.d), beispielBis(o.d, kx.bezugsjahr)]
      }),
    )
    absatz(`Die Spalte „Beispiel ${kx.bezugsjahr}“ nennt das Fristende für eine Unterlage aus dem Jahr ${kx.bezugsjahr}.`)
  } else absatz('Unterlagen: offen.')

  h(2, '2.5', 'Einweisung in das Verfahren')
  const turnus = c.einweisung.turnus
  // Protokoll (2.5, 9.2) und „eingewiesene Personen“ (3.3) nur bei festgelegter Einweisung; bei „Keine“ ist der Schalter ausgeblendet
  const eingewiesen = turnus === 'einmalig' || turnus === 'jaehrlich'
  const protokoll = eingewiesen && c.einweisung.protokoll
  absatz(
    turnus === 'einmalig'
      ? 'Wer mitarbeitet, wird vor Beginn eingewiesen.'
      : turnus === 'jaehrlich'
        ? 'Wer mitarbeitet, wird vor Beginn und danach jährlich eingewiesen.'
        : turnus === 'keine'
          ? 'Eine Einweisung ist nicht vorgesehen.'
          : 'Eine Einweisung ist nicht festgelegt.',
  )
  if (protokoll) absatz('Die Einweisung wird schriftlich festgehalten (Kapitel 9.2).')

  h(2, '2.6', 'Abgrenzung der Bearbeitungsbereiche')
  const extern: string[] = []
  for (const r of ist.rollen) {
    const ra = rollenAngaben(c, r.id)
    const schritte = k.aufgaben.filter((x) => x.rolleId === r.id)
    if (!ra.extern || schritte.length === 0) continue
    const wer = ra.organisation.trim() ? `${ra.organisation.trim()} (${r.name.trim() || 'Rolle'})` : r.name.trim() || 'Externe Rolle'
    extern.push(`${wer}: ${schritte.map((x) => schrittText(k, x)).join(', ')}`)
  }
  for (const m of systemeImEinsatz(k)) {
    const s = systemAngaben(c, m.id)
    if (mitDienstleister(s)) extern.push(`${s.dienstleister.trim() || 'Anbieter'}: betreibt „${m.name.trim() || 'Unbenanntes System'}“ (${standortText(s)})`)
  }
  for (const t of ist.teilnehmer) extern.push(`${t.name.trim() || 'Externer Beteiligter'}: tauscht Nachrichten mit dem Unternehmen aus`)
  if (u.steuerberatung.trim()) extern.push(`${u.steuerberatung.trim()}: Steuerberatung`)
  // Ohne Angabe zum Betrieb ist offen, ob ein Dienstleister beteiligt ist
  const betriebOffen = systemeImEinsatz(k)
    .filter((m) => systemAngaben(c, m.id).betrieb === null && !mitDienstleister(systemAngaben(c, m.id)))
    .map((m) => m.name.trim() || 'Unbenanntes System')
  const offenSatz = betriebOffen.length > 0 ? `Wer ${aufzaehlung(betriebOffen)} betreibt, ist offen.` : null
  if (extern.length > 0) {
    liste(extern)
    if (offenSatz) absatz(offenSatz)
    absatz('Mit externen Stellen ist diese Dokumentation abzustimmen.')
  } else absatz(offenSatz ?? 'Alle Schritte finden im Unternehmen statt.')

  // 3
  h(1, '3', 'Organisation und Sicherheit des IT-gestützten Verfahrens')
  h(2, '3.1', 'Eingesetzte Hard- und Software')
  const systeme = systemeImEinsatz(k)
  if (systeme.length > 0) {
    tabelle(
      ['System', 'Art', 'Hersteller', 'Version', 'im Einsatz seit', 'Betrieb', 'Dienstleister und Standort'],
      systeme.map((m) => {
        const s = systemAngaben(c, m.id)
        return [
          m.name.trim() || 'Unbenanntes System',
          MEDIUM_ARTEN.find((x) => x.art === m.art)?.name ?? m.art,
          s.hersteller.trim() || '–',
          s.version.trim() || 'offen',
          s.seit ? formatiereDatum(s.seit) : 'offen',
          textVon(BETRIEBE, s.betrieb, 'dok'),
          mitDienstleister(s) ? `${s.dienstleister.trim() || 'offen'}, ${standortText(s)}` : '–',
        ]
      }),
    )
    // Aufbewahrung im Drittland nur mit Bewilligung des Finanzamts (§ 146 Abs. 2b AO, Regel S7)
    for (const m of systeme) {
      const s = systemAngaben(c, m.id)
      const ablage = ablageVon(k, m.id)
      if (!mitDienstleister(s) || s.standort !== 'drittland' || ablage.length === 0) continue
      absatz(
        `„${m.name.trim() || 'Unbenanntes System'}“ bewahrt ${aufzaehlung(ablage.map((id) => objektName(k, id)))} im Drittland (${s.drittland.trim() || 'offen'}) auf. Bewilligung des Finanzamts nach § 146 Abs. 2b AO${s.bewilligungVom ? ` vom ${formatiereDatum(s.bewilligungVom)}` : ': offen'}.`,
      )
    }
    absatz(SYSTEMWECHSEL)
  } else absatz('Im Prozess werden keine IT-Systeme eingesetzt.')

  h(2, '3.2', 'Zuständigkeiten')
  tabelle(
    // Freigabe und Durchführung der Löschung sind Freitext, dort steht oft ein Name
    ['Schritt', 'Rolle oder Person', 'System'],
    [
      ...k.aufgaben.map((x) => [
        schrittText(k, x),
        ist.rollen.find((r) => r.id === x.rolleId)?.name.trim() || 'offen',
        (x.mediumId ? k.medien.get(x.mediumId)?.name.trim() : '') || 'offen',
      ]),
      ['Freigabe der Löschung nach Fristablauf', c.loeschung.freigabe.trim() || 'offen', '–'],
      ['Durchführung der Löschung', c.loeschung.durchfuehrung.trim() || 'offen', '–'],
    ],
  )

  h(2, '3.3', 'Organisation und Internes Kontrollsystem')
  const ablauf = ablaufBeschreibung(k)
  const kontrollen = k.aufgaben.filter((x) => x.art === 'pruefung' || x.art === 'freigabe')
  // Kontrollen ohne Nachweis im System oder per Kürzel bzw. ohne Zuständige; A.4 nennt sie, statt Festlegung zuzusichern
  const offen = { nachweis: [] as string[], zustaendigkeit: [] as string[] }
  const vermerke = (name: string, nachweis: Nachweis | null, wer: string) => {
    if (nachweis !== 'system' && nachweis !== 'abzeichnen') offen.nachweis.push(name)
    if (!wer) offen.zustaendigkeit.push(name)
  }
  const zeilen = [
    ...kontrollen.map((x) => {
      const angabe = kontrollAngaben(c, x.id)
      const wer = ist.rollen.find((r) => r.id === x.rolleId)?.name.trim() ?? ''
      vermerke(schrittText(k, x), angabe?.nachweis ?? null, wer)
      // Liegt die Kontrolle in einem Zweig, läuft sie nur unter dessen Bedingung (wie „Nur wenn“ in Kapitel 4)
      const bedingungen = ablauf.bedingungen.get(x.id) ?? []
      return [
        schrittText(k, x),
        angabe ? textVon(KONTROLLARTEN, angabe.art, 'dok') : 'offen',
        wer || 'offen',
        angabe?.ziel.trim() || 'offen',
        angabe ? textVon(NACHWEISE, angabe.nachweis, 'dok') : 'offen',
        bedingungen.length > 0 ? `${wennText(bedingungen)} (siehe ${k.nummer.get(x.id) ?? '4.?'})` : 'bei jedem Vorgang',
      ]
    }),
    ...c.weitereKontrollen.map((w) => {
      const bezug = k.aufgaben.find((x) => x.id === w.bezugAufgabeId)
      vermerke(w.name.trim() || 'Weitere Kontrolle', w.nachweis, w.verantwortlich.trim())
      return [
        w.name.trim() || 'Weitere Kontrolle',
        textVon(KONTROLLARTEN, w.art, 'dok'),
        `${w.verantwortlich.trim() || 'offen'}${w.extern ? ' (extern)' : ''}`,
        bezug ? `Ergebnis von ${schrittText(k, bezug)}` : '–',
        textVon(NACHWEISE, w.nachweis, 'dok'),
        w.haeufigkeit.trim() || 'offen',
      ]
    }),
  ]
  absatz(iks(eingewiesen, offen))
  if (zeilen.length > 0) tabelle(['Kontrolle', 'Art', 'Wer', 'Was geprüft wird', 'Nachweis', 'Häufigkeit'], zeilen)
  else absatz('Im Ablauf ist keine Kontrolle beschrieben.')

  h(2, '3.4', 'Datenschutz und Datensicherheit')
  absatz(DATENSCHUTZ)
  if (systeme.length > 0) {
    tabelle(
      ['System', 'Schutz vor Änderung', 'Datensicherung', 'Intervall', 'Rücksicherung getestet', 'Zugriffsschutz'],
      systeme.map((m) => {
        const s = systemAngaben(c, m.id)
        // Intervall und Test fragt die Oberfläche nur bei eingerichteter Sicherung ab; ausgeblendete Altangaben zählen nicht
        const gesichert = s.sicherung === 'manuell' || s.sicherung === 'automatisch' || s.sicherung === 'anbieter'
        return [
          m.name.trim() || 'Unbenanntes System',
          textVon(UNVERAENDERBARKEIT, s.unveraenderbarkeit, 'dok'),
          textVon(SICHERUNGEN, s.sicherung, 'dok'),
          (gesichert && s.sicherungIntervall.trim()) || '–',
          gesichert && s.wiederherstellungGetestet ? 'ja' : 'nein',
          s.zugriffsschutz.trim() || 'offen',
        ]
      }),
    )
  }

  // GoBD Rz. 152, 156–159: je System, das aufbewahrungspflichtige Unterlagen ablegt
  h(2, '3.5', 'Wiederfinden, Lesbarmachung und Datenzugriff')
  const mitAblage = systeme.map((m) => ({ m, ablage: ablageVon(k, m.id) })).filter(({ ablage }) => ablage.length > 0)
  if (mitAblage.length > 0) {
    absatz(DATENZUGRIFF)
    tabelle(
      ['System', 'Aufbewahrte Unterlagen', 'Wiederfinden über', 'Datenzugriff, auch nach Vertragsende oder Systemwechsel'],
      mitAblage.map(({ m, ablage }) => {
        const s = systemAngaben(c, m.id)
        return [m.name.trim() || 'Unbenanntes System', ablage.map((id) => objektName(k, id)).join(', '), s.wiederfinden?.trim() || 'offen', s.datenzugriff?.trim() || 'offen']
      }),
    )
  } else absatz('Im Prozess werden keine aufbewahrungspflichtigen Unterlagen in IT-Systemen abgelegt.')

  // 4
  h(1, '4', `Verfahren und Maßnahmen: ${name}`)
  a.push(...ablauf.abschnitte)
  h(2, `4.${k.aufgaben.length + 1}`, 'Aufbewahrung, Vernichtung und Löschung')
  const saetze = [
    ...unterlagen.filter((o) => istPflichtig(o.d.aufbewahrungsart)).map((o) => {
      const orte = ablageVonObjekt(k, o.d).map((s) => s.name.trim() || 'Unbenannter Ablageort')
      const hgb = lieferscheinHgb(o.d, kaufmann) ? ` ${LIEFERSCHEIN_HGB.charAt(0).toUpperCase()}${LIEFERSCHEIN_HGB.slice(1)}.` : ''
      return `„${o.name}“: aufbewahren ${aufbewahrungText(o.d)}; Ablage: ${orte.join(', ') || 'offen'}.${hgb}`
    }),
    // Beurteilt ist nur das Steuerrecht; andere Gesetze können eigene Fristen haben
    ...unterlagen.filter((o) => o.d.aufbewahrungsart === 'keine' && o.d.personenbezogen === true && o.d.loeschfrist).map((o) => `„${o.name}“: keine steuerliche Aufbewahrungspflicht (§ 147 AO); löschen ${fristText(o.d.loeschfrist!)}.`),
  ]
  if (saetze.length > 0) liste(saetze)
  // Aufzählung statt Satz: Rollen und Namen sind Freitext ohne bekannten Artikel
  const loeschTurnus = c.loeschung.turnus === null ? 'offen' : c.loeschung.turnus === 'keiner' ? 'kein fester' : textVon(LOESCH_TURNUS, c.loeschung.turnus, 'dok')
  absatz(
    `Vor Ablauf der Frist wird nichts vernichtet oder gelöscht. Freigabe der Löschung: ${c.loeschung.freigabe.trim() || 'offen'}. Durchführung: ${c.loeschung.durchfuehrung.trim() || 'offen'}. Turnus: ${loeschTurnus}.`,
  )

  // 5
  h(1, '5', 'Ersetzendes Scannen')
  const gescannt = unterlagen.filter((o) => o.d.form === 'papier' && o.d.ablageform === 'scan')
  const scan = gescannt.filter((o) => o.d.originalVernichtet === true)
  const scanOffen = gescannt.filter((o) => o.d.originalVernichtet === null)
  // Ob es die eigene Verfahrensdokumentation gibt, wird erfragt, nicht unterstellt (GoBD Rz. 136)
  const scanDoku = scan.length > 0 && c.ersetzendesScannen.verfahrensdoku === true
  if (scan.length > 0) {
    absatz(
      `Für ${aufzaehlung(scan.map((o) => o.name))} gilt das ersetzende Scannen. ${scanDoku ? 'Es ist in einer eigenen Verfahrensdokumentation beschrieben (Kapitel 6).' : 'Dafür ist eine eigene Verfahrensdokumentation nötig (GoBD Rz. 136); offen.'}`,
    )
    absatz('Ausgenommen sind Jahresabschlüsse und Eröffnungsbilanz; sie werden im Original aufbewahrt (§ 147 Abs. 2 AO, § 257 Abs. 3 HGB).')
  }
  if (scanOffen.length > 0) absatz(`Ob die Papierbelege von ${aufzaehlung(scanOffen.map((o) => o.name))} nach dem Scannen vernichtet werden, ist offen.`)
  if (scan.length === 0 && scanOffen.length === 0) absatz('Entfällt: Papierunterlagen werden nicht gescannt und anschließend vernichtet.')

  // 6
  h(1, '6', 'Mitgeltende Unterlagen')
  liste([
    'Verzeichnis von Verarbeitungstätigkeiten, gleiche Version',
    'BPMN-Datei des Ist-Prozesses',
    ...(scanDoku ? [`Verfahrensdokumentation zum ersetzenden Scannen, Stand ${c.ersetzendesScannen.stand ? formatiereDatum(c.ersetzendesScannen.stand) : 'offen'}`] : []),
    ...systeme
      .map((m) => ({ m, s: systemAngaben(c, m.id) }))
      // nur, wenn die Frage nach dem Vertrag gestellt wird (wie S2); ausgeblendete Altangaben zählen nicht
      .filter(({ m, s }) => mitDienstleister(s) && hatPersonenbezug(k, m.id) && s.auftragsverarbeitung !== false && s.avVertrag === 'ja')
      .map(({ m, s }) => `Vertrag zur Auftragsverarbeitung mit ${s.dienstleister.trim() || s.hersteller.trim() || `dem Anbieter von „${m.name.trim()}“`} vom ${s.avVertragVom ? formatiereDatum(s.avVertragVom) : 'offen'}`),
    ...mitgeltendeUnterlagen(c).flatMap((m) => mitgeltendText(m) ?? []),
  ])

  // 7
  h(1, '7', 'Änderungshistorie')
  absatz(HISTORIE)
  if (kx.historie.length > 0) {
    tabelle(
      ['Version', 'gültig ab', 'gültig bis', 'freigegeben', 'geänderte Kapitel', 'Inhalt', 'aufbewahren bis', 'Prüfsumme'],
      kx.historie.map((v, i) => {
        const bis = gueltigBisIn(kx.historie, i)
        // Eine zurückgezogene Freigabe galt nie; sie bleibt in der Historie sichtbar
        const rueckzug = v.zurueckgezogen
        return [
          v.bezeichnung,
          formatiereDatum(v.gueltigAb),
          rueckzug ? `zurückgezogen am ${formatiereDatum(rueckzug.am)}` : bis ? formatiereDatum(bis) : 'laufend',
          `${formatiereDatum(v.freigegebenAm)}, ${v.freigegebenVon.trim() || 'offen'}${v.fachlichGeprueft ? `; ${geprueftText(v.fachlichGeprueft)}` : ''}`,
          kapitelText(v.geaenderteKapitel, 'verfahrensdokumentation') || '–',
          rueckzug ? `${v.aenderung.trim() || '–'}; zurückgezogen: ${rueckzug.grund.trim()}` : v.aenderung.trim() || '–',
          rueckzug ? 'mit der Änderungshistorie' : aufbewahrenBisText(bis),
          v.nummer === kx.version?.nummer || !v.pruefsumme ? '–' : v.pruefsumme.slice(0, 12),
        ]
      }),
    )
  } else absatz('Noch keine Version freigegeben.')

  // 8
  h(1, '8', 'Glossar')
  tabelle(['Begriff', 'Bedeutung'], GLOSSAR.map(([begriff, bedeutung]) => [begriff, bedeutung]))

  // 9
  h(1, '9', 'Anlage')
  h(2, '9.1', 'Ablaufdiagramm')
  a.push({ art: 'diagramm' })
  if (protokoll) {
    h(2, '9.2', 'Nachweis der Einweisung')
    tabelle(
      ['Datum', 'Name', 'Rolle', 'Unterschrift'],
      Array.from({ length: 8 }, () => ['', '', '', '']),
    )
  }

  return {
    art: 'verfahrensdokumentation',
    titel: 'Verfahrensdokumentation',
    untertitel: `${name} · ${firma}`,
    versionText: kx.version ? kx.version.bezeichnung : 'Entwurf',
    stand: kx.heute,
    rechtsstand: RECHTSSTAND,
    abschnitte: a,
  }
}
