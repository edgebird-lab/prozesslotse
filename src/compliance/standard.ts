/**
 * Standardwerte, Kataloge und feste Texte der Compliance-Doku (Spezifikation 4.3).
 * Fehlt ein Eintrag in `datenobjekte`, `systeme`, `rollen` oder `kontrollen`,
 * gilt der Standardwert; geschrieben wird erst bei der ersten Änderung.
 */
import { neueId } from '../modell/bausteine'
import type {
  Ablageform,
  Aufbewahrungsart,
  AvVertrag,
  Belegform,
  BesondereKategorie,
  Betrieb,
  Betroffene,
  ComplianceProjekt,
  Datenkategorie,
  DatenobjektAngaben,
  EinweisungTurnus,
  Empfaenger,
  Frist,
  FristBeginn,
  Garantie,
  Gewinnermittlung,
  KontrollAngaben,
  KontrollArt,
  Kontakt,
  LoeschTurnus,
  Nachweis,
  Rechtsform,
  Rechtsgrundlage,
  Richtung,
  RollenAngaben,
  Sicherung,
  Standort,
  SystemAngaben,
  Teilschritt,
  TomAngaben,
  TomBereich,
  Unveraenderbarkeit,
  WeitereKontrolle,
  Zeiteinheit,
} from './typen'
import { COMPLIANCE_VERSION } from './typen'

/** Rechtsstand der Texte, Fristen und Regeln; steht in jedem Dokument. */
export const RECHTSSTAND = '2026-11-11'

/** Eintrag eines Katalogs: Wert im Modell, Text in der Oberfläche, Kurzform im Dokument. */
export interface Eintrag<T extends string> {
  wert: T
  text: string
  /** Erläuterung in der Oberfläche, z. B. Beispiele */
  beschreibung?: string
  /** Text im Dokument, falls er vom Oberflächentext abweicht */
  dok?: string
}

/** Text im Dokument (oder in der Oberfläche) zu einem Wert; „offen“, wenn nichts gewählt ist. */
export function textVon<T extends string>(katalog: readonly Eintrag<T>[], wert: T | null | undefined, feld: 'text' | 'dok' = 'text'): string {
  const e = katalog.find((k) => k.wert === wert)
  if (!e) return 'offen'
  return feld === 'dok' ? (e.dok ?? e.text) : e.text
}

export const TEILSCHRITTE: { id: Teilschritt; name: string }[] = [
  { id: 'unternehmen', name: 'Unternehmen' },
  { id: 'belege', name: 'Belege und Daten' },
  { id: 'systeme', name: 'Systeme und Dienstleister' },
  { id: 'fristen', name: 'Aufbewahrung und Löschung' },
  { id: 'kontrollen', name: 'Kontrollen' },
  { id: 'tom', name: 'Schutzmaßnahmen' },
  { id: 'luecken', name: 'Lücken' },
  { id: 'dokumente', name: 'Dokumente' },
]

export const RECHTSFORMEN: Eintrag<Rechtsform>[] = [
  { wert: 'einzelunternehmen', text: 'Einzelunternehmen (ohne Handelsregister)', dok: 'Einzelunternehmen' },
  { wert: 'ek', text: 'Eingetragener Kaufmann (e. K.)' },
  { wert: 'gbr', text: 'GbR' },
  { wert: 'partg', text: 'Partnerschaftsgesellschaft' },
  { wert: 'ohg', text: 'OHG' },
  { wert: 'kg', text: 'KG' },
  { wert: 'gmbh', text: 'GmbH' },
  { wert: 'ug', text: 'UG (haftungsbeschränkt)' },
  { wert: 'gmbh_co_kg', text: 'GmbH & Co. KG' },
  { wert: 'eg', text: 'eG' },
  { wert: 'ev', text: 'e. V.' },
  { wert: 'sonstige', text: 'Sonstige' },
]

export const GEWINNERMITTLUNGEN: Eintrag<Gewinnermittlung>[] = [
  { wert: 'bilanz', text: 'Bilanz' },
  { wert: 'euer', text: 'Einnahmen-Überschuss-Rechnung' },
]

/** Einordnung nach § 147 AO mit gesetzlicher Mindestfrist in Jahren (null = keine feste Jahresfrist). */
export const AUFBEWAHRUNGSARTEN: (Eintrag<Aufbewahrungsart> & { jahre: number | null })[] = [
  { wert: 'buecher', text: 'Buch, Aufzeichnung oder Organisationsunterlage', beschreibung: 'z. B. Kassenbuch, Journal, Inventar; 10 Jahre', dok: 'Buch oder Organisationsunterlage', jahre: 10 },
  { wert: 'buchungsbeleg', text: 'Buchungsbeleg', beschreibung: 'Rechnung, Quittung, Kontoauszug, Gutschrift; 8 Jahre', jahre: 8 },
  { wert: 'geschaeftsbrief', text: 'Handels- oder Geschäftsbrief', beschreibung: 'Angebot, Auftragsbestätigung, schriftliche Bestellung; 6 Jahre', dok: 'Geschäftsbrief', jahre: 6 },
  { wert: 'sonstige', text: 'Sonstige steuerlich bedeutsame Unterlage', beschreibung: '6 Jahre', dok: 'Sonstige Unterlage', jahre: 6 },
  { wert: 'lieferschein', text: 'Lieferschein ohne Buchungsfunktion', beschreibung: 'bis die Rechnung da ist bzw. verschickt wurde', dok: 'Lieferschein', jahre: null },
  { wert: 'keine', text: 'Nicht aufbewahrungspflichtig', beschreibung: 'interne Notiz, E-Mail nur als Transportmittel', dok: 'nicht aufbewahrungspflichtig', jahre: null },
  { wert: 'unklar', text: 'Weiß nicht', beschreibung: 'Im Zweifel die Steuerberatung fragen', dok: 'offen', jahre: null },
]

/** Aufbewahrungspflichtig nach § 147 AO (6.2). */
export const PFLICHTIG: ReadonlySet<Aufbewahrungsart> = new Set<Aufbewahrungsart>(['buecher', 'buchungsbeleg', 'geschaeftsbrief', 'sonstige', 'lieferschein'])

export function istPflichtig(art: Aufbewahrungsart): boolean {
  return PFLICHTIG.has(art)
}

export const BELEGFORMEN: Eintrag<Belegform>[] = [
  { wert: 'papier', text: 'Auf Papier', dok: 'Papier' },
  { wert: 'bild', text: 'Als PDF oder Bild, z. B. per E-Mail', dok: 'PDF oder Bild' },
  { wert: 'strukturiert', text: 'Als E-Rechnung (XRechnung, ZUGFeRD)', dok: 'E-Rechnung (strukturiert)' },
  { wert: 'datensatz', text: 'Als Datensatz in einem Programm', dok: 'Datensatz' },
]

export const RICHTUNGEN: Eintrag<Richtung>[] = [
  { wert: 'eingang', text: 'Kommt von außen', dok: 'eingehend' },
  { wert: 'ausgang', text: 'Geht nach außen', dok: 'ausgehend' },
  { wert: 'intern', text: 'Bleibt intern', dok: 'intern' },
]

export const ABLAGEFORMEN: Eintrag<Ablageform>[] = [
  { wert: 'original', text: 'Im Original', dok: 'Original' },
  { wert: 'scan', text: 'Als Scan des Papiers', dok: 'Scan' },
  { wert: 'ausdruck', text: 'Als Ausdruck', dok: 'Ausdruck' },
  { wert: 'umgewandelt', text: 'Umgewandelt, z. B. PDF statt XML', dok: 'umgewandelt' },
]

export const BETROFFENE: Eintrag<Betroffene>[] = [
  { wert: 'kunden', text: 'Kunden' },
  { wert: 'interessenten', text: 'Interessenten' },
  { wert: 'lieferanten', text: 'Lieferanten und Dienstleister' },
  { wert: 'beschaeftigte', text: 'Beschäftigte' },
  { wert: 'bewerber', text: 'Bewerber' },
  { wert: 'patienten', text: 'Patienten' },
  { wert: 'sonstige', text: 'Sonstige' },
]

export const DATENKATEGORIEN: Eintrag<Datenkategorie>[] = [
  { wert: 'identifikation', text: 'Name, Kundennummer', dok: 'Identifikationsdaten (Name, Kundennummer)' },
  { wert: 'kontakt', text: 'Anschrift, Telefon, E-Mail', dok: 'Kontaktdaten (Anschrift, Telefon, E-Mail)' },
  { wert: 'vertrag', text: 'Vertrags- und Bestelldaten' },
  { wert: 'zahlung', text: 'Rechnungs- und Zahlungsdaten' },
  { wert: 'bank', text: 'Bankverbindung' },
  { wert: 'korrespondenz', text: 'Korrespondenz' },
  { wert: 'personal', text: 'Personaldaten' },
  { wert: 'nutzung', text: 'Nutzungs- und Protokolldaten' },
  { wert: 'sonstige', text: 'Sonstige' },
]

/** `dok` passt in Sätze wie „„Krankmeldung“ enthält Gesundheitsdaten“. */
export const BESONDERE_KATEGORIEN: Eintrag<BesondereKategorie>[] = [
  { wert: 'herkunft', text: 'Herkunft', dok: 'Angaben zur Herkunft' },
  { wert: 'politik', text: 'Politische Meinungen', dok: 'politische Meinungen' },
  { wert: 'religion', text: 'Religiöse oder weltanschauliche Überzeugungen', dok: 'religiöse oder weltanschauliche Überzeugungen' },
  { wert: 'gewerkschaft', text: 'Gewerkschaftszugehörigkeit', dok: 'Angaben zur Gewerkschaftszugehörigkeit' },
  { wert: 'genetik', text: 'Genetische Daten', dok: 'genetische Daten' },
  { wert: 'biometrie', text: 'Biometrische Daten zur Identifizierung', dok: 'biometrische Daten zur Identifizierung' },
  { wert: 'gesundheit', text: 'Gesundheitsdaten' },
  { wert: 'sexualleben', text: 'Sexualleben oder sexuelle Orientierung', dok: 'Angaben zum Sexualleben oder zur sexuellen Orientierung' },
]

/** Art. 10 DSGVO, im selben Satzbau wie die besonderen Kategorien */
export const STRAFRECHTLICH_TEXT = 'Daten über strafrechtliche Verurteilungen und Straftaten'

/** Art. 6 Abs. 1 lit. a bis f DSGVO, in dieser Reihenfolge. */
export const RECHTSGRUNDLAGEN: (Eintrag<Rechtsgrundlage> & { lit: string })[] = [
  { wert: 'einwilligung', lit: 'a', text: 'Einwilligung (Art. 6 Abs. 1 lit. a)', dok: 'Einwilligung der Person' },
  { wert: 'vertrag', lit: 'b', text: 'Für einen Vertrag oder eine Anfrage der Person nötig (lit. b)', dok: 'für einen Vertrag mit der Person oder ihre Anfrage nötig' },
  { wert: 'rechtspflicht', lit: 'c', text: 'Gesetzliche Pflicht, z. B. Aufbewahrung (lit. c)', dok: 'gesetzliche Pflicht, z. B. Aufbewahrung nach § 147 AO' },
  { wert: 'lebenswichtig', lit: 'd', text: 'Schutz lebenswichtiger Interessen (lit. d)', dok: 'Schutz lebenswichtiger Interessen' },
  { wert: 'oeffentlich', lit: 'e', text: 'Aufgabe im öffentlichen Interesse (lit. e)', dok: 'Aufgabe im öffentlichen Interesse' },
  { wert: 'interesse', lit: 'f', text: 'Berechtigtes Interesse (lit. f)', dok: 'berechtigtes Interesse' },
]

export const STANDORTE: Eintrag<Standort>[] = [
  { wert: 'deutschland', text: 'Deutschland' },
  { wert: 'eu_ewr', text: 'EU oder EWR' },
  { wert: 'drittland', text: 'Anderes Land (Drittland)', dok: 'Drittland' },
  { wert: 'unbekannt', text: 'Weiß nicht', dok: 'offen' },
]

export const GARANTIEN: Eintrag<Garantie>[] = [
  { wert: 'angemessenheitsbeschluss', text: 'Angemessenheitsbeschluss (Art. 45)', dok: 'Angemessenheitsbeschluss (Art. 45 DSGVO)' },
  { wert: 'standardvertragsklauseln', text: 'Standardvertragsklauseln (Art. 46)', dok: 'Standardvertragsklauseln (Art. 46 DSGVO)' },
  { wert: 'andere', text: 'Andere Garantie' },
  { wert: 'keine', text: 'Keine' },
]

export const BETRIEBE: Eintrag<Betrieb>[] = [
  { wert: 'lokal', text: 'Auf eigenen Geräten' },
  { wert: 'eigener_server', text: 'Auf eigenem Server' },
  { wert: 'cloud', text: 'Als Cloud-Dienst' },
]

export const UNVERAENDERBARKEIT: Eintrag<Unveraenderbarkeit>[] = [
  { wert: 'revisionssicher', text: 'Revisionssicheres Archiv' },
  { wert: 'protokolliert', text: 'Änderungen werden protokolliert' },
  { wert: 'keine', text: 'Keine, z. B. einfache Dateiablage', dok: 'keiner' },
  { wert: 'unklar', text: 'Weiß nicht', dok: 'offen' },
]

export const SICHERUNGEN: Eintrag<Sicherung>[] = [
  { wert: 'keine', text: 'Keine' },
  { wert: 'manuell', text: 'Von Hand' },
  { wert: 'automatisch', text: 'Automatisch' },
  { wert: 'anbieter', text: 'Durch den Anbieter' },
  { wert: 'unklar', text: 'Weiß nicht', dok: 'offen' },
]

export const AV_VERTRAEGE: Eintrag<AvVertrag>[] = [
  { wert: 'ja', text: 'Ja' },
  { wert: 'nein', text: 'Nein' },
  { wert: 'unklar', text: 'Weiß nicht' },
]

/** angelehnt an GoBD Rz. 100 */
export const KONTROLLARTEN: Eintrag<KontrollArt>[] = [
  { wert: 'vier_augen', text: 'Vier-Augen-Prinzip' },
  { wert: 'plausibilitaet', text: 'Plausibilität und Vollständigkeit' },
  { wert: 'abstimmung', text: 'Abstimmung, z. B. Bank mit Buchhaltung', dok: 'Abstimmung' },
  { wert: 'stichprobe', text: 'Stichprobe' },
  { wert: 'berechtigung', text: 'Berechtigung im System' },
  { wert: 'sonstige', text: 'Sonstige' },
]

export const NACHWEISE: Eintrag<Nachweis>[] = [
  { wert: 'system', text: 'Im System protokolliert' },
  { wert: 'abzeichnen', text: 'Abgezeichnet mit Datum und Kürzel' },
  { wert: 'keiner', text: 'Kein Nachweis', dok: 'keiner' },
  { wert: 'unklar', text: 'Weiß nicht', dok: 'offen' },
]

export const EINWEISUNGEN: Eintrag<EinweisungTurnus>[] = [
  { wert: 'einmalig', text: 'Einmalig vor Beginn' },
  { wert: 'jaehrlich', text: 'Vor Beginn und jährlich' },
  { wert: 'keine', text: 'Keine' },
]

export const LOESCH_TURNUS: Eintrag<LoeschTurnus>[] = [
  { wert: 'jaehrlich', text: 'Jährlich', dok: 'jährlich' },
  { wert: 'halbjaehrlich', text: 'Halbjährlich', dok: 'halbjährlich' },
  { wert: 'keiner', text: 'Kein fester Turnus', dok: 'ohne festen Turnus' },
]

export const ZEITEINHEITEN: (Eintrag<Zeiteinheit> & { eins: string; viele: string })[] = [
  { wert: 'tage', text: 'Tage', eins: 'Tag', viele: 'Tage' },
  { wert: 'monate', text: 'Monate', eins: 'Monat', viele: 'Monate' },
  { wert: 'jahre', text: 'Jahre', eins: 'Jahr', viele: 'Jahre' },
]

export const FRIST_BEGINNE: Eintrag<FristBeginn>[] = [
  { wert: 'entstehung', text: 'Ab Entstehung bzw. Eingang' },
  { wert: 'jahresende', text: 'Ab Ende des Kalenderjahres' },
  { wert: 'ereignis', text: 'Nach einem Ereignis' },
]

/** Bereiche nach DSK-Hinweisen Ziff. 6.8 mit Vorschlägen in eigenen Worten. */
export const TOM_BEREICHE: { wert: TomBereich; name: string; vorschlaege: string[] }[] = [
  { wert: 'pseudonymisierung', name: 'Pseudonymisierung', vorschlaege: ['Auswertungen mit Kundennummer statt Name', 'Testdaten ohne echte Namen'] },
  {
    wert: 'verschluesselung',
    name: 'Verschlüsselung',
    vorschlaege: ['Laufwerke von Laptops und PCs verschlüsselt', 'Webzugriffe und E-Mail-Versand über TLS', 'Datensicherungen verschlüsselt', 'Smartphones mit Gerätesperre und Verschlüsselung'],
  },
  {
    wert: 'vertraulichkeit',
    name: 'Vertraulichkeit und Integrität',
    vorschlaege: [
      'Eigenes Benutzerkonto je Person, keine geteilten Passwörter',
      'Zugriff nur, wenn für die Aufgabe nötig (Rechtekonzept)',
      'Zwei-Faktor-Anmeldung bei Cloud-Diensten',
      'Bildschirmsperre bei Inaktivität',
      'Updates und Virenschutz automatisch',
      'Papierunterlagen in abschließbarem Schrank oder Raum',
      'Beschäftigte auf Vertraulichkeit verpflichtet',
      'Datenträger und Papier datenschutzgerecht vernichtet',
    ],
  },
  {
    wert: 'verfuegbarkeit',
    name: 'Verfügbarkeit und Belastbarkeit',
    vorschlaege: [
      'Tägliche automatische Datensicherung',
      'Sicherung an einem zweiten Ort oder offline',
      'Unterbrechungsfreie Stromversorgung für den Server',
      'Zugesicherte Verfügbarkeit im Vertrag mit dem Anbieter',
    ],
  },
  { wert: 'wiederherstellung', name: 'Wiederherstellung', vorschlaege: ['Rücksicherung mindestens jährlich getestet', 'Notfallplan mit Ansprechpartnern und Reihenfolge des Wiederanlaufs'] },
  {
    wert: 'ueberpruefung',
    name: 'Überprüfung',
    vorschlaege: ['Jährliche Überprüfung der Maßnahmen und dieser Dokumentation', 'Sicherheitsvorfälle werden erfasst und ausgewertet', 'Dienstleister vor Beauftragung geprüft'],
  },
]

export const TOM_REIHENFOLGE: TomBereich[] = TOM_BEREICHE.map((b) => b.wert)

export function tomName(b: TomBereich): string {
  return TOM_BEREICHE.find((x) => x.wert === b)?.name ?? b
}

// ---------- Standardwerte ----------

export function leereAnschrift() {
  return { strasse: '', plz: '', ort: '' }
}

export function leererKontakt(): Kontakt {
  return { name: '', anschrift: leereAnschrift(), telefon: '', email: '' }
}

function leereToms(): Record<TomBereich, TomAngaben> {
  const leer = (): TomAngaben => ({ massnahmen: [], nichtZutreffend: '' })
  return { pseudonymisierung: leer(), verschluesselung: leer(), vertraulichkeit: leer(), verfuegbarkeit: leer(), wiederherstellung: leer(), ueberpruefung: leer() }
}

export function neueCompliance(): ComplianceProjekt {
  return {
    version: COMPLIANCE_VERSION,
    unternehmen: {
      name: '',
      rechtsform: null,
      anschrift: leereAnschrift(),
      telefon: '',
      email: '',
      internet: '',
      branche: '',
      geschaeftszweck: '',
      gewinnermittlung: null,
      geschaeftsleitung: '',
      standorte: [],
      personenMitDaten: null,
      datenschutzbeauftragter: null,
      gemeinsamVerantwortlicher: null,
      vertreter: null,
      steuerberatung: '',
    },
    verarbeitung: { benennung: '', laufendeNummer: '1', eingefuehrtAm: null, fachabteilung: '', ansprechpartner: '', telefon: '', email: '', zwecke: [] },
    unterlagen: [],
    ablageorte: [],
    zugriffe: [],
    datenobjekte: {},
    systeme: {},
    rollen: {},
    kontrollen: {},
    weitereKontrollen: [],
    einweisung: { turnus: null, protokoll: false },
    loeschung: { freigabe: '', durchfuehrung: '', turnus: null },
    begruendungLaengereAufbewahrung: '',
    toms: leereToms(),
    mitgeltend: [],
    ersetzendesScannen: { verfahrensdoku: null, stand: null },
    versionen: [],
    zuletztGeprueft: null,
  }
}

export function standardDatenobjekt(): DatenobjektAngaben {
  return {
    aufbewahrungsart: 'unklar',
    form: null,
    richtung: null,
    ablageSpeicherIds: [],
    ablageform: null,
    originalVernichtet: null,
    aufbewahrungJahre: null,
    personenbezogen: null,
    betroffene: [],
    datenkategorien: [],
    besondereKategorien: [],
    strafrechtlich: false,
    rechtsgrundlagen: [],
    berechtigtesInteresse: '',
    loeschfrist: null,
    externeEmpfaenger: [],
  }
}

export function standardSystem(): SystemAngaben {
  return {
    hersteller: '',
    version: '',
    seit: null,
    betrieb: null,
    dienstleister: '',
    standort: 'unbekannt',
    drittland: '',
    garantie: null,
    auftragsverarbeitung: null,
    avVertrag: 'unklar',
    avVertragVom: null,
    unveraenderbarkeit: 'unklar',
    sicherung: 'unklar',
    sicherungIntervall: '',
    wiederherstellungGetestet: null,
    zugriffsschutz: '',
  }
}

export function standardRolle(): RollenAngaben {
  return { extern: false, organisation: '' }
}

/** Erste Angaben zu einer Prüfung oder Freigabe; Freigaben sind meist Vier-Augen-Kontrollen. */
export function neueKontrollAngaben(art: KontrollArt = 'plausibilitaet'): KontrollAngaben {
  return { art, ziel: '', nachweis: 'unklar' }
}

export function neueFrist(werte: Partial<Frist> = {}): Frist {
  return { anzahl: 30, einheit: 'tage', beginn: 'entstehung', ereignis: '', ...werte }
}

export function neuerEmpfaenger(werte: Partial<Empfaenger> = {}): Empfaenger {
  return { id: neueId('emp'), kategorie: '', name: '', standort: 'deutschland', drittland: '', garantie: null, ...werte }
}

export function neueWeitereKontrolle(werte: Partial<WeitereKontrolle> = {}): WeitereKontrolle {
  return { id: neueId('wk'), name: '', art: 'stichprobe', verantwortlich: '', extern: false, haeufigkeit: '', nachweis: 'unklar', bezugAufgabeId: null, ...werte }
}
