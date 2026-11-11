/**
 * Datenmodell des Prozesslotsen.
 *
 * Ein Prozess ist ein Baum aus Bausteinen. Jede Verzweigung wird automatisch
 * wieder zusammengeführt, deshalb kann ein so gebautes Modell keine
 * Verklemmungen und keine unerreichbaren Schritte enthalten (blockstrukturiertes
 * Modell). Alle Zeiten sind Minuten Arbeitszeit; ein Arbeitstag hat
 * `arbeitsstundenProTag` Stunden.
 */
import type { ComplianceProjekt } from '../compliance/typen'

export type Id = string

/** Version des Dateiformats. Bei inkompatiblen Änderungen erhöhen; ältere Dateien migriert speicher.ts. */
export const FORMAT_VERSION = 4

export type WarteArt = 'zeit' | 'nachricht'

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

/**
 * Externer Beteiligter mit eigenem Pool, z. B. Kunde oder Lieferant. Was er
 * intern tut, gehört nicht zum Modell; sichtbar sind nur die Nachrichten.
 */
export interface Teilnehmer {
  id: Id
  name: string
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
  /** Schickt eine Nachricht an diesen externen Teilnehmer (Nachrichtenfluss). */
  nachrichtAn?: Id | null
  /** Wartet auf eine Nachricht dieses externen Teilnehmers. */
  nachrichtVon?: Id | null
  /** Was während des Schritts dazwischenkommen kann (Randereignisse); fehlt = keine. */
  unterbrechungen?: Unterbrechung[]
}

/** Eine Folge von Schritten. Der Hauptablauf und jeder Zweig sind Sequenzen. */
export interface Sequenz {
  id: Id
  schritte: Block[]
}

/** Wann eine Nachricht, die eine Aufgabe unterbricht, meist kommt. */
export type NachrichtZeitpunkt = 'vorher' | 'waehrend' | 'unbekannt'

/**
 * Unterbrechung eines Schritts (Aufgabe, Abschnitt, „für jedes Stück“): im
 * BPMN ein Randereignis (Zeit oder Nachricht) mit Ausnahmeweg. Die Sequenz ist
 * der Ausnahmeweg, wie bei `EntscheidungsZweig`.
 *
 * - **unterbrechend**: Die Arbeit am Schritt wird abgebrochen; das kommt in
 *   einem festen Anteil der Ausführungen vor. Danach geht es hinter dem
 *   Schritt weiter, springt zurück (`zurueckZu`) oder der Vorgang endet (`ende`).
 * - **Nebenweg** (nicht unterbrechend): Der Schritt läuft weiter, der
 *   Ausnahmeweg läuft im Schnitt `anteil`-mal je Ausführung nebenher und endet
 *   für sich; er hat kein „Danach“ und verlängert den Vorgang nicht (Annahme).
 */
export interface Unterbrechung extends Sequenz {
  /** z. B. „Kunde storniert“, „Frist abgelaufen“ */
  bezeichnung: string
  art: WarteArt
  /** nur bei Nachricht: externer Absender, sonst null */
  von: Id | null
  /** true: Die Arbeit am Schritt wird abgebrochen. false: Nebenweg, der Schritt läuft weiter. */
  unterbrechend: boolean
  /** unterbrechend: Anteil der Ausführungen des Schritts (0–1). Nebenweg: wie oft je Ausführung (≥ 0, auch über 1). */
  anteil: number
  /** nur Zeit: Frist in Minuten ab Eingang beim Schritt (Beginn der Liegezeit bzw. des Rahmens) */
  fristMin: number
  /** nur Nachricht an einer Aufgabe: wann sie meist kommt */
  zeitpunkt: NachrichtZeitpunkt
  /** nur unterbrechend: Ergebnis, wenn der Vorgang danach endet */
  ende: string | null
  /** nur unterbrechend: Rücksprungbereich; `ende` und `zurueckZu` null = weiter hinter dem Schritt */
  zurueckZu: Id | null
}

/** Ereignis am Anfang eines Ausgangs einer Ereignis-Entscheidung. */
export interface ZweigEreignis {
  art: WarteArt
  /** Wie lange es im Schnitt dauert, bis dieses Ereignis eintritt (wenn es das erste ist). */
  dauerMin: number
  /** Bei einer Nachricht: von welchem externen Teilnehmer sie kommt. */
  von?: Id | null
}

export interface EntscheidungsZweig extends Sequenz {
  /** Antwort auf die Frage, z. B. „Ja“; bei einer Ereignis-Entscheidung der Name des Ereignisses. */
  bezeichnung: string
  /** Anteil der Fälle, die diesen Zweig nehmen (0–1). */
  anteil: number
  /** Wenn gesetzt, endet der Prozess am Ende dieses Zweigs mit diesem Ergebnis. */
  ende: string | null
  /**
   * Wenn gesetzt, springt der Ablauf am Ende dieses Zweigs zurück an den Anfang
   * des Rücksprungbereichs mit dieser Kennung (eine Wiederholung im Modus
   * „ruecksprung“, die den Zweig umschließt).
   */
  zurueckZu: Id | null
  /** Nur bei Ereignis-Entscheidungen: welches Ereignis diesen Ausgang auslöst. */
  ereignis: ZweigEreignis | null
}

/**
 * „daten“: Entweder-oder nach einer Prüfung oder Angabe (exklusives Gateway).
 * „ereignis“: Es geht dort weiter, wo zuerst etwas eintritt (ereignisbasiertes Gateway).
 */
export type EntscheidungsArt = 'daten' | 'ereignis'

/** Entweder-oder: genau ein Zweig wird genommen. */
export interface Entscheidung {
  typ: 'entscheidung'
  id: Id
  art: EntscheidungsArt
  /** Frage, z. B. „Ware vorrätig?“ */
  frage: string
  zweige: EntscheidungsZweig[]
}

/**
 * Wie mehrere unabhängige Dinge erledigt werden; jede Funktion über
 * „Gleichzeitig“ unterscheidet die Art erschöpfend.
 *
 * - **alle**: Die Zweige laufen gleichzeitig, weiter geht es, wenn alle fertig
 *   sind (paralleles Gateway).
 * - **erster**: Die Zweige laufen gleichzeitig, weiter geht es, sobald einer
 *   fertig ist; die übrigen werden abgebrochen (Teilprozess, in dem jeder Zweig
 *   mit einer Terminierung endet).
 * - **nacheinander**: Eine Person erledigt die Zweige nacheinander, die
 *   Reihenfolge ist egal (Ad-hoc-Teilprozess); gerechnet wird in der
 *   Reihenfolge der Liste.
 */
export type ParallelArt = 'alle' | 'erster' | 'nacheinander'

/** Mehrere Dinge unabhängig voneinander: gleichzeitig, bis eins fertig ist, oder in beliebiger Reihenfolge (siehe `ParallelArt`). */
export interface Parallel {
  typ: 'parallel'
  id: Id
  art: ParallelArt
  zweige: Sequenz[]
}

/** Ein Weg einer ODER-Verzweigung mit eigener Wahrscheinlichkeit. */
export interface OderZweig extends Sequenz {
  /** Was in diesem Fall zu tun ist, z. B. „Gehaltsnachweis fehlt“. */
  bezeichnung: string
  /** Anteil der Fälle, in denen dieser Weg vorkommt (0–1), unabhängig von den anderen Wegen. */
  anteil: number
}

/**
 * ODER: Je nach Fall laufen einer, mehrere oder alle Wege (inklusives Gateway).
 * Weiter geht es, wenn alle gewählten Wege fertig sind.
 */
export interface Oder {
  typ: 'oder'
  id: Id
  /** Worum es geht, z. B. „Welche Unterlagen fehlen?“ */
  frage: string
  zweige: OderZweig[]
  /** Weg, der genau dann läuft, wenn keiner der anderen zutrifft (Standardfluss); sein eigener Anteil zählt nicht. */
  standard: Id | null
}

/**
 * „anteil“: Nach jedem Durchlauf entscheidet eine Frage mit festem Anteil über die Wiederholung.
 * „ruecksprung“: Rücksprungbereich; wiederholt wird, wenn ein Ausgang darin mit
 * `zurueckZu` auf diesen Bereich zeigt. Der Assistent legt solche Bereiche selbst an.
 */
export type WiederholungsModus = 'anteil' | 'ruecksprung'

/** Wiederholung: der Körper läuft mindestens einmal und wird unter Umständen wiederholt. */
/** Wozu wiederholt wird: Korrektur eines Fehlers oder mehrere gleiche Durchgänge (z. B. je Position). */
export type WiederholungsZweck = 'nacharbeit' | 'menge'

export interface Wiederholung {
  typ: 'wiederholung'
  id: Id
  modus: WiederholungsModus
  /** Fehlt die Angabe, gilt „nacharbeit“. Nur Nacharbeit gilt als Schwachstelle. */
  zweck?: WiederholungsZweck
  /** Frage nach jedem Durchlauf; „Ja“ bedeutet wiederholen, z. B. „Nacharbeit nötig?“ (nur Modus „anteil“) */
  frage: string
  /** Wahrscheinlichkeit, dass nach einem Durchlauf wiederholt wird, 0 bis unter 1 (nur Modus „anteil“). */
  anteilWiederholung: number
  koerper: Sequenz
}

/** Warten auf einen Zeitpunkt oder eine Nachricht (Zwischenereignis). */
export interface Warten {
  typ: 'warten'
  id: Id
  name: string
  art: WarteArt
  dauerMin: number
  /** Bei einer Nachricht: von welchem externen Teilnehmer sie kommt. */
  von?: Id | null
}

/**
 * Abschnitt mit Namen (aufgeklappter Teilprozess): fasst Schritte in einem
 * Rahmen mit eigenem Start und Ende zusammen. Gerechnet wird er wie die Folge
 * seiner Schritte; im Diagramm liegt er mit allen Schritten in einer Bahn.
 */
export interface Teilprozess {
  typ: 'teilprozess'
  id: Id
  /** Name des Abschnitts, z. B. „Ware versenden“ */
  name: string
  koerper: Sequenz
  /** Was während des Abschnitts dazwischenkommen kann; fehlt = keine. */
  unterbrechungen?: Unterbrechung[]
}

/** fest: immer etwa gleich viele Stücke; schwankt: die Zahl streut stark (geometrisch ab 1) */
export type MehrfachStreuung = 'fest' | 'schwankt'
/** nacheinander: eine Person arbeitet die Stücke der Reihe nach ab; gleichzeitig: alle Stücke zur selben Zeit */
export type MehrfachAusfuehrung = 'nacheinander' | 'gleichzeitig'

/**
 * Für jedes Stück einer Liste (Mehrfachinstanz), z. B. „Für jede Position“: Der
 * Körper läuft einmal je Stück. Die Anzahl N je Vorgang hat das Mittel
 * `anzahl`; wie sie streut, legt `streuung` fest (siehe anzahl.ts). Die
 * Liegezeit zählt einmal vor dem ersten Stück, nicht je Stück. Im Diagramm
 * trägt eine einzelne Aufgabe die Markierung, sonst ein Rahmen.
 */
export interface Mehrfach {
  typ: 'mehrfach'
  id: Id
  /** z. B. „Für jede Position“ */
  name: string
  /** Stücke je Vorgang im Schnitt, ≥ 0 (bei „schwankt“ ≥ 1) */
  anzahl: number
  streuung: MehrfachStreuung
  ausfuehrung: MehrfachAusfuehrung
  /** Liegezeit einmal vor dem ersten Stück, in Minuten */
  liegezeitMin: number
  koerper: Sequenz
  /** Was während der ganzen Liste dazwischenkommen kann; fehlt = keine. */
  unterbrechungen?: Unterbrechung[]
}

export type Block = Aufgabe | Entscheidung | Oder | Parallel | Wiederholung | Warten | Teilprozess | Mehrfach
export type BlockTyp = Block['typ']

/** Schritte, die Unterbrechungen haben können (Randereignisse im BPMN). */
export type Unterbrechbar = Aufgabe | Teilprozess | Mehrfach

export function istUnterbrechbar(b: Block): b is Unterbrechbar {
  return b.typ === 'aufgabe' || b.typ === 'teilprozess' || b.typ === 'mehrfach'
}

/** Unterbrechungen eines Bausteins; leer, wenn er keine haben kann oder keine hat. */
export function unterbrechungenVon(b: Block): Unterbrechung[] {
  return istUnterbrechbar(b) ? (b.unterbrechungen ?? []) : []
}

/** Für erschöpfende Unterscheidungen: Der Übersetzer meldet jeden vergessenen Fall. */
export function unerwartet(x: never): never {
  throw new Error(`Unerwarteter Fall: ${JSON.stringify(x)}`)
}

export type AusloeserArt = 'nachricht' | 'zeit' | 'bedingung' | 'manuell'

export interface Prozess {
  formatVersion: typeof FORMAT_VERSION
  id: Id
  name: string
  beschreibung: string
  /** Bei einer Nachricht: `von` ist der externe Teilnehmer, der sie schickt. */
  ausloeser: { art: AusloeserArt; text: string; von?: Id | null }
  /** Ergebnis am regulären Ende, z. B. „Ware zugestellt“. */
  ergebnis: string
  /** Neue Vorgänge pro Arbeitstag. */
  vorgaengeProTag: number
  arbeitsstundenProTag: number
  rollen: Rolle[]
  medien: Medium[]
  /** Externe Teilnehmer (eigene Pools) wie Kunde oder Lieferant. */
  teilnehmer: Teilnehmer[]
  ablauf: Sequenz
}

/** Stelle, an der der Assistent als Nächstes einfügt. */
export interface Cursor {
  sequenzId: Id
  index: number
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
  /** Compliance-Doku (src/compliance); fehlt bei Projekten ohne diese Angaben. */
  compliance?: ComplianceProjekt
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
