/**
 * Datenmodell des Prozesslotsen.
 *
 * Ein Prozess ist ein Baum aus Bausteinen. Jede Verzweigung wird automatisch
 * wieder zusammengeführt, deshalb kann ein so gebautes Modell keine
 * Verklemmungen und keine unerreichbaren Schritte enthalten (blockstrukturiertes
 * Modell). Alle Zeiten sind Minuten Arbeitszeit; ein Arbeitstag hat
 * `arbeitsstundenProTag` Stunden.
 */

export type Id = string

/** Version des Dateiformats. Bei inkompatiblen Änderungen erhöhen. */
export const FORMAT_VERSION = 1

export type MediumArt =
  | 'papier'
  | 'telefon'
  | 'email'
  | 'tabelle'
  | 'fachanwendung'
  | 'erp'
  | 'sonstiges'

/** Womit gearbeitet wird: Papier, Telefon oder ein IT-System. */
export interface Medium {
  id: Id
  name: string
  art: MediumArt
}

/** Wer arbeitet: eine Rolle mit Kosten und Kapazität. */
export interface Rolle {
  id: Id
  name: string
  /** Vollkosten je Stunde in Euro. */
  stundensatz: number
  /** Personen in dieser Rolle (Vollzeitäquivalente, auch 0,5 möglich). */
  personen: number
  /** Anteil ihrer Arbeitszeit, der für diesen Prozess zur Verfügung steht (0–100). */
  verfuegbarProzent: number
}

export type AufgabenArt = 'normal' | 'pruefung' | 'freigabe'

/** Daten werden von Hand aus einem anderen Medium übertragen (Medienbruch). */
export interface Uebertragung {
  quelleMediumId: Id | null
  /** Minuten der Bearbeitungszeit, die auf das Übertragen entfallen. */
  minuten: number
}

export interface Aufgabe {
  typ: 'aufgabe'
  id: Id
  /** Objekt und Verb, z. B. „Bestellung prüfen“. */
  name: string
  rolleId: Id | null
  mediumId: Id | null
  /** Reine Bearbeitungszeit in Minuten. */
  bearbeitungMin: number
  /** Liegezeit vor Beginn des Schritts in Minuten. */
  liegezeitMin: number
  art: AufgabenArt
  /** Nur bei Freigaben: Anteil der Fälle, in denen freigegeben wird (0–1). */
  freigabeQuote: number
  /** Braucht der Schritt das Ergebnis des vorherigen? `null` = nicht beantwortet. */
  brauchtVorgaenger: boolean | null
  /** Medienbruch, falls Daten von Hand übertragen werden. */
  uebertragung: Uebertragung | null
}

/** Eine Folge von Schritten. Der Hauptablauf und jeder Zweig sind Sequenzen. */
export interface Sequenz {
  id: Id
  schritte: Block[]
}

export interface EntscheidungsZweig extends Sequenz {
  /** Antwort auf die Frage, z. B. „Ja“. */
  bezeichnung: string
  /** Anteil der Fälle, die diesen Zweig nehmen (0–1). */
  anteil: number
  /** Wenn gesetzt, endet der Prozess am Ende dieses Zweigs mit diesem Ergebnis. */
  ende: string | null
}

/** Entweder-oder: genau ein Zweig wird genommen (exklusives Gateway). */
export interface Entscheidung {
  typ: 'entscheidung'
  id: Id
  /** Frage, z. B. „Ware vorrätig?“ */
  frage: string
  zweige: EntscheidungsZweig[]
}

/** Gleichzeitig: alle Zweige laufen, weiter geht es, wenn alle fertig sind (paralleles Gateway). */
export interface Parallel {
  typ: 'parallel'
  id: Id
  zweige: Sequenz[]
}

/** Wiederholung: der Körper läuft mindestens einmal und wird mit einer Wahrscheinlichkeit wiederholt. */
export interface Wiederholung {
  typ: 'wiederholung'
  id: Id
  /** Frage nach jedem Durchlauf; „Ja“ bedeutet wiederholen, z. B. „Nacharbeit nötig?“ */
  frage: string
  /** Wahrscheinlichkeit, dass nach einem Durchlauf wiederholt wird (0 bis unter 1). */
  anteilWiederholung: number
  koerper: Sequenz
}

export type WarteArt = 'zeit' | 'nachricht'

/** Warten auf einen Zeitpunkt oder eine Nachricht (Zwischenereignis). */
export interface Warten {
  typ: 'warten'
  id: Id
  name: string
  art: WarteArt
  dauerMin: number
}

export type Block = Aufgabe | Entscheidung | Parallel | Wiederholung | Warten
export type BlockTyp = Block['typ']

export type AusloeserArt = 'nachricht' | 'zeit' | 'bedingung' | 'manuell'

export interface Prozess {
  formatVersion: typeof FORMAT_VERSION
  id: Id
  name: string
  beschreibung: string
  ausloeser: { art: AusloeserArt; text: string }
  /** Ergebnis am regulären Ende, z. B. „Ware zugestellt“. */
  ergebnis: string
  /** Neue Vorgänge pro Arbeitstag. */
  vorgaengeProTag: number
  arbeitsstundenProTag: number
  rollen: Rolle[]
  medien: Medium[]
  ablauf: Sequenz
}

/** Eine übernommene Verbesserung, wie sie im Bericht erscheint. */
export interface Massnahme {
  schluessel: string
  titel: string
  begruendung: string
}

/** Alles, was gespeichert wird: Ist-Prozess, Soll-Prozess und Entscheidungen dazu. */
export interface Projekt {
  formatVersion: typeof FORMAT_VERSION
  ist: Prozess
  soll: Prozess | null
  massnahmen: Massnahme[]
  verworfen: string[]
}

export const MEDIUM_ARTEN: { art: MediumArt; name: string; digital: boolean }[] = [
  { art: 'papier', name: 'Papier', digital: false },
  { art: 'telefon', name: 'Telefon', digital: false },
  { art: 'email', name: 'E-Mail', digital: true },
  { art: 'tabelle', name: 'Tabelle (z. B. Excel)', digital: true },
  { art: 'fachanwendung', name: 'Fachanwendung', digital: true },
  { art: 'erp', name: 'ERP-System', digital: true },
  { art: 'sonstiges', name: 'Sonstiges', digital: true },
]

export function istDigital(art: MediumArt): boolean {
  return MEDIUM_ARTEN.find((m) => m.art === art)?.digital ?? true
}
