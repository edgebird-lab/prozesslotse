/**
 * Datenmodell der Compliance-Doku: Angaben, aus denen die
 * Verfahrensdokumentation nach GoBD und das Verzeichnis von
 * Verarbeitungstätigkeiten nach Art. 30 Abs. 1 DSGVO entstehen.
 *
 * Die Angaben hängen als optionales Feld `compliance` am Projekt. Unterlagen,
 * Ablageorte und Zugriffe führt die Erweiterung selbst (Spezifikation 4.1);
 * Angaben zu Systemen, Rollen und Kontrollen verweisen über die Id auf das
 * Prozessmodell, das dadurch unverändert bleibt.
 */
import type { Befund } from '../modell/pruefung'
import type { Id, Prozess } from '../modell/typen'

/** Kalenderdatum JJJJ-MM-TT, ohne Uhrzeit und Zeitzone. */
export type IsoDatum = string

export const COMPLIANCE_VERSION = 1

// ---------- Unternehmen und Verarbeitungstätigkeit ----------

/** 'ek' = eingetragener Kaufmann; 'einzelunternehmen' = ohne Eintragung (Kleingewerbe, freier Beruf) */
export type Rechtsform = 'einzelunternehmen' | 'ek' | 'gbr' | 'partg' | 'ohg' | 'kg' | 'gmbh' | 'ug' | 'gmbh_co_kg' | 'eg' | 'ev' | 'sonstige'

export interface Anschrift {
  strasse: string
  plz: string
  ort: string
}

export interface Kontakt {
  name: string
  anschrift: Anschrift
  telefon: string
  email: string
}

export type Gewinnermittlung = 'bilanz' | 'euer'

export interface Unternehmen {
  name: string
  rechtsform: Rechtsform | null
  anschrift: Anschrift
  telefon: string
  email: string
  internet: string
  branche: string
  geschaeftszweck: string
  gewinnermittlung: Gewinnermittlung | null
  /** Inhaber oder Geschäftsführung; genehmigt und gibt die Verfahrensdokumentation frei. */
  geschaeftsleitung: string
  standorte: string[]
  /** Personen, die in der Regel ständig mit automatisierter Verarbeitung personenbezogener Daten beschäftigt sind (§ 38 Abs. 1 BDSG). */
  personenMitDaten: number | null
  datenschutzbeauftragter: (Kontakt & { extern: boolean }) | null
  gemeinsamVerantwortlicher: Kontakt | null
  vertreter: Kontakt | null
  steuerberatung: string
}

export interface Verarbeitungstaetigkeit {
  /** Name im Verzeichnis; leer = Prozessname */
  benennung: string
  /** z. B. „1“ */
  laufendeNummer: string
  eingefuehrtAm: IsoDatum | null
  fachabteilung: string
  ansprechpartner: string
  telefon: string
  email: string
  /** Art. 30 Abs. 1 lit. b */
  zwecke: string[]
}

// ---------- Unterlagen und Ablageorte (4.1) ----------

export interface Unterlage {
  id: Id
  /** z. B. „Ausgangsrechnung“ */
  name: string
}

export interface Ablageort {
  id: Id
  /** z. B. „Belegarchiv“, „Ordner Lieferscheine“ */
  name: string
  /** System (Medium.id); null = noch nicht zugeordnet */
  mediumId: Id | null
}

export type ZugriffsRichtung = 'liest' | 'schreibt'

export interface Zugriff {
  aufgabeId: Id
  unterlageId: Id
  richtung: ZugriffsRichtung
}

// ---------- Belege und Daten (je Unterlage) ----------

/** Einordnung nach § 147 Abs. 1 AO; bestimmt die gesetzliche Mindestfrist. */
export type Aufbewahrungsart = 'buecher' | 'buchungsbeleg' | 'geschaeftsbrief' | 'sonstige' | 'lieferschein' | 'keine' | 'unklar'
export type Belegform = 'papier' | 'bild' | 'strukturiert' | 'datensatz'
export type Richtung = 'eingang' | 'ausgang' | 'intern'
export type Ablageform = 'original' | 'scan' | 'ausdruck' | 'umgewandelt'

export type Betroffene = 'kunden' | 'interessenten' | 'lieferanten' | 'beschaeftigte' | 'bewerber' | 'patienten' | 'sonstige'
export type Datenkategorie = 'identifikation' | 'kontakt' | 'vertrag' | 'zahlung' | 'bank' | 'korrespondenz' | 'personal' | 'nutzung' | 'sonstige'
/** Art. 9 Abs. 1 DSGVO */
export type BesondereKategorie = 'herkunft' | 'politik' | 'religion' | 'gewerkschaft' | 'genetik' | 'biometrie' | 'gesundheit' | 'sexualleben'
/** Art. 6 Abs. 1 lit. a bis f DSGVO, in dieser Reihenfolge */
export type Rechtsgrundlage = 'einwilligung' | 'vertrag' | 'rechtspflicht' | 'lebenswichtig' | 'oeffentlich' | 'interesse'

export type Standort = 'deutschland' | 'eu_ewr' | 'drittland' | 'unbekannt'
export type Garantie = 'angemessenheitsbeschluss' | 'standardvertragsklauseln' | 'andere' | 'keine'

export interface Empfaenger {
  id: Id
  /** z. B. „Steuerberatung“, „Paketdienst“ */
  kategorie: string
  /** konkreter Empfänger, z. B. „Kanzlei Beispiel“; Pflicht bei Standort „drittland“ (DSK-Hinweise Ziff. 6.5) */
  name: string
  standort: Standort
  /** nur bei Standort „drittland“ */
  drittland: string
  garantie: Garantie | null
}

export type Zeiteinheit = 'tage' | 'monate' | 'jahre'
export type FristBeginn = 'entstehung' | 'jahresende' | 'ereignis'

export interface Frist {
  /** ganze Zahl von 0 bis 100 */
  anzahl: number
  einheit: Zeiteinheit
  beginn: FristBeginn
  /** nur bei beginn = 'ereignis', z. B. „Ende der Kundenbeziehung“ */
  ereignis: string
}

export interface DatenobjektAngaben {
  aufbewahrungsart: Aufbewahrungsart
  form: Belegform | null
  richtung: Richtung | null
  /** Ablageorte (Ablageort.id), in denen aufbewahrt wird */
  ablageSpeicherIds: Id[]
  ablageform: Ablageform | null
  /** nur bei Papier mit Scan: wird das Original danach vernichtet? */
  originalVernichtet: boolean | null
  /** gewählte Aufbewahrung in ganzen Jahren ab Schluss des Kalenderjahres; null = gesetzliche Mindestfrist */
  aufbewahrungJahre: number | null
  personenbezogen: boolean | null
  betroffene: Betroffene[]
  datenkategorien: Datenkategorie[]
  besondereKategorien: BesondereKategorie[]
  /** Daten über strafrechtliche Verurteilungen und Straftaten (Art. 10 DSGVO) */
  strafrechtlich: boolean
  rechtsgrundlagen: Rechtsgrundlage[]
  /** bei lit. f: welches Interesse */
  berechtigtesInteresse: string
  /** nur für personenbezogene Daten ohne steuerliche Aufbewahrungspflicht */
  loeschfrist: Frist | null
  externeEmpfaenger: Empfaenger[]
}

// ---------- Systeme und Rollen ----------

export type Betrieb = 'lokal' | 'eigener_server' | 'cloud'
export type Unveraenderbarkeit = 'revisionssicher' | 'protokolliert' | 'keine' | 'unklar'
export type Sicherung = 'keine' | 'manuell' | 'automatisch' | 'anbieter' | 'unklar'
export type AvVertrag = 'ja' | 'nein' | 'unklar'

/** nur für digitale Medien (istDigital(medium.art)) */
export interface SystemAngaben {
  hersteller: string
  version: string
  seit: IsoDatum | null
  betrieb: Betrieb | null
  dienstleister: string
  standort: Standort
  drittland: string
  garantie: Garantie | null
  /** Verarbeitet der Dienstleister personenbezogene Daten im Auftrag? null = unklar */
  auftragsverarbeitung: boolean | null
  avVertrag: AvVertrag
  avVertragVom: IsoDatum | null
  /**
   * Bewilligung des Finanzamts, Unterlagen elektronisch in einem Drittstaat aufzubewahren (§ 146 Abs. 2b AO);
   * gefragt nur bei Standort „drittland“ mit aufbewahrungspflichtiger Ablage. Fehlt in älteren Dateien.
   */
  bewilligungVom?: IsoDatum | null
  unveraenderbarkeit: Unveraenderbarkeit
  sicherung: Sicherung
  /** z. B. „täglich“ */
  sicherungIntervall: string
  wiederherstellungGetestet: IsoDatum | null
  /** Kurzbeschreibung, z. B. „eigenes Konto je Person, Zwei-Faktor-Anmeldung“ */
  zugriffsschutz: string
}

export interface RollenAngaben {
  extern: boolean
  /** bei externen Rollen, z. B. „Kanzlei Beispiel“ */
  organisation: string
}

// ---------- Kontrollen ----------

export type KontrollArt = 'vier_augen' | 'plausibilitaet' | 'abstimmung' | 'stichprobe' | 'berechtigung' | 'sonstige'
export type Nachweis = 'system' | 'abzeichnen' | 'keiner' | 'unklar'

/** Angaben zu einer Aufgabe der Art „Prüfung“ oder „Freigabe“ */
export interface KontrollAngaben {
  art: KontrollArt
  /** z. B. „Rechnung sachlich und rechnerisch richtig“ */
  ziel: string
  nachweis: Nachweis
}

/** Kontrolle außerhalb des Ablaufs, z. B. monatliche Stichprobe durch die Steuerberatung */
export interface WeitereKontrolle {
  id: Id
  name: string
  art: KontrollArt
  verantwortlich: string
  extern: boolean
  /** z. B. „monatlich, 10 Belege“ */
  haeufigkeit: string
  nachweis: Nachweis
  /** Aufgabe, die diese Kontrolle absichert */
  bezugAufgabeId: Id | null
}

export type EinweisungTurnus = 'einmalig' | 'jaehrlich' | 'keine'

export interface Einweisung {
  turnus: EinweisungTurnus | null
  protokoll: boolean
}

export type LoeschTurnus = 'jaehrlich' | 'halbjaehrlich' | 'keiner'

export interface Loeschorganisation {
  /** wer Vernichtung und Löschung nach Fristablauf freigibt */
  freigabe: string
  /** wer sie durchführt */
  durchfuehrung: string
  turnus: LoeschTurnus | null
}

// ---------- Schutzmaßnahmen ----------

/** Bereiche nach DSK-Hinweisen Ziff. 6.8, in dieser Reihenfolge */
export type TomBereich = 'pseudonymisierung' | 'verschluesselung' | 'vertraulichkeit' | 'verfuegbarkeit' | 'wiederherstellung' | 'ueberpruefung'

export interface TomAngaben {
  massnahmen: string[]
  /** Begründung, falls der Bereich nicht zutrifft; leer = trifft zu */
  nichtZutreffend: string
}

// ---------- Dokumente und Versionen ----------

export type Abschnitt =
  | { art: 'ueberschrift'; ebene: 1 | 2 | 3; nummer: string; text: string }
  | { art: 'absatz'; text: string }
  | { art: 'liste'; punkte: string[] }
  | { art: 'tabelle'; kopf: string[]; zeilen: string[][] }
  | { art: 'hinweis'; text: string }
  /** Platzhalter: Druckansicht zeigt das BPMN-Diagramm, DOCX einen Verweis */
  | { art: 'diagramm' }

export type DokumentArt = 'verfahrensdokumentation' | 'verarbeitungsverzeichnis'

export interface Dokument {
  art: DokumentArt
  titel: string
  untertitel: string
  /** „1.0“ oder „Entwurf“ */
  versionText: string
  stand: IsoDatum
  rechtsstand: IsoDatum
  abschnitte: Abschnitt[]
}

export interface DokuVersion {
  /** 1, 2, 3 … fortlaufend */
  nummer: number
  /** z. B. „1.0“; eindeutig */
  bezeichnung: string
  gueltigAb: IsoDatum
  freigegebenAm: IsoDatum
  freigegebenVon: string
  aenderung: string
  /** automatisch, z. B. ['VD 3.2', 'VD 4', 'VVT B'] */
  geaenderteKapitel: string[]
  /** Ist-Prozess bei der Freigabe, für Diagramm und Vergleich */
  prozess: Prozess
  verfahrensdoku: Dokument
  verzeichnis: Dokument
  /** SHA-256 als Hex (64 Zeichen) über kanonisches JSON von [verfahrensdoku, verzeichnis] (6.8) */
  pruefsumme: string
}

/** Kopf einer Version ohne Inhalte: genügt für Kapitel 1, Änderungshistorie und Versionsliste. */
export type VersionKopf = Omit<DokuVersion, 'prozess' | 'verfahrensdoku' | 'verzeichnis' | 'pruefsumme'> & { pruefsumme?: string }

// ---------- Gesamt ----------

export interface ComplianceProjekt {
  version: typeof COMPLIANCE_VERSION
  unternehmen: Unternehmen
  verarbeitung: Verarbeitungstaetigkeit
  unterlagen: Unterlage[]
  ablageorte: Ablageort[]
  zugriffe: Zugriff[]
  /** Schlüssel: Unterlage.id */
  datenobjekte: Record<Id, DatenobjektAngaben>
  /** Schlüssel: Medium.id */
  systeme: Record<Id, SystemAngaben>
  /** Schlüssel: Rolle.id */
  rollen: Record<Id, RollenAngaben>
  /** Schlüssel: Aufgabe.id einer Prüfung oder Freigabe */
  kontrollen: Record<Id, KontrollAngaben>
  weitereKontrollen: WeitereKontrolle[]
  einweisung: Einweisung
  loeschung: Loeschorganisation
  /** gilt für alle Unterlagen, die länger als gesetzlich aufbewahrt werden */
  begruendungLaengereAufbewahrung: string
  toms: Record<TomBereich, TomAngaben>
  /** zusätzliche mitgeltende Unterlagen, z. B. „Berechtigungskonzept“ */
  mitgeltend: string[]
  versionen: DokuVersion[]
  /** „Geprüft, keine Änderung“ ohne neue Version */
  zuletztGeprueft: IsoDatum | null
}

// ---------- Befunde und Oberfläche ----------

export type Teilschritt = 'unternehmen' | 'belege' | 'systeme' | 'fristen' | 'kontrollen' | 'tom' | 'luecken' | 'dokumente'

/** Wohin „Beheben“ springt; das Element hat die Id `ziel-{art}` bzw. `ziel-{art}-{id}`. */
export type ZielArt = 'unternehmen' | 'zwecke' | 'datenobjekt' | 'frist' | 'system' | 'kontrolle' | 'einweisung' | 'tom' | 'version'

export interface ComplianceBefund extends Befund {
  /** z. B. 'B4' */
  regel: string
  teilschritt: Exclude<Teilschritt, 'luecken'>
  /** Objekt, zu dem „Beheben“ springt; blockId (aus Befund) markiert Aufgaben im Diagramm */
  ziel?: { art: ZielArt; id?: string }
}
