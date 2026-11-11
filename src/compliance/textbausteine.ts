/**
 * Feste Textbausteine (Spezifikation 6.9). Übernommen sind nur Gliederung und
 * Kapitelnamen des Musters von BStBK und DStV; alle Sätze sind eigene
 * Formulierungen. Die Dokumente versprechen nirgends Konformität.
 */
import { formatiereDatum } from './datum'
import type { IsoDatum } from './typen'

/** A.0: Hinweis auf dem Deckblatt der Verfahrensdokumentation */
export function hinweisVerfahrensdoku(prozess: string, stand: IsoDatum, rechtsstand: IsoDatum): string {
  return `Vorlage, erstellt mit dem Prozesslotsen am ${formatiereDatum(stand)}. Rechtsstand ${formatiereDatum(rechtsstand)}. Vor Verwendung von der Steuerberatung prüfen lassen. Beschreibt nur den Prozess „${prozess}“ und die Systeme darin, nicht alle Systeme des Betriebs. Gliederung angelehnt an die Muster-Verfahrensdokumentation zum ersetzenden Scannen von BStBK und DStV (Version 2.1, Stand 27.02.2026); Texte eigene Formulierungen.`
}

/** A.0 in der Fassung für das Verzeichnis */
export function hinweisVerzeichnis(prozess: string, stand: IsoDatum, rechtsstand: IsoDatum): string {
  return `Vorlage, erstellt mit dem Prozesslotsen am ${formatiereDatum(stand)}. Rechtsstand ${formatiereDatum(rechtsstand)}. Vor Verwendung vom Datenschutzbeauftragten oder einer fachkundigen Person prüfen lassen. Beschreibt die Verarbeitung im Prozess „${prozess}“. Aufbau angelehnt an das Muster der Datenschutzkonferenz (Februar 2018).`
}

/** A.1, immer: Zuordnung nach GoBD Rz. 153 */
export const AUFBAU_RZ153 =
  'Aufbau nach GoBD Rz. 153: allgemeine Beschreibung in Kapitel 2, Anwenderdokumentation in Kapitel 4, technische Systemdokumentation in Kapitel 3.1, Betriebsdokumentation in Kapitel 3.2 bis 3.4.'

/** A.2, Kapitel 2.3 */
export const GRUNDLAGEN =
  'Maßgeblich sind die Abgabenordnung (§§ 145 bis 147 AO), § 14b UStG und die GoBD (BMF-Schreiben vom 28.11.2019 in der Fassung vom 14.07.2025). Für Kaufleute gelten zusätzlich §§ 238, 239 und 257 HGB.'

export const FRISTENREGEL =
  'Die Frist beginnt mit dem Ende des Kalenderjahres, in dem die Unterlage entstanden, eingegangen oder abgesandt wurde; bei Büchern zählt die letzte Eintragung. Sie läuft nicht ab, solange die Unterlagen für Steuern mit noch offener Festsetzungsfrist von Bedeutung sind (§ 147 Abs. 3 und 4 AO).'

/** Fristen nach § 147 AO (Spezifikation 3.2) */
export const FRISTEN_TABELLE: string[][] = [
  ['Bücher, Aufzeichnungen, Inventare, Jahresabschlüsse, Lageberichte, Eröffnungsbilanz, Arbeitsanweisungen und Organisationsunterlagen, auch diese Verfahrensdokumentation', '§ 147 Abs. 1 Nr. 1 AO', '10 Jahre'],
  ['Buchungsbelege und Rechnungen (auch § 14b UStG)', '§ 147 Abs. 1 Nr. 4 AO', '8 Jahre'],
  ['Empfangene Handels- oder Geschäftsbriefe und Kopien der versandten', '§ 147 Abs. 1 Nr. 2 und 3 AO', '6 Jahre'],
  ['Sonstige Unterlagen, soweit sie für die Besteuerung von Bedeutung sind', '§ 147 Abs. 1 Nr. 5 AO', '6 Jahre'],
  ['Lieferscheine, die keine Buchungsbelege sind', '§ 147 Abs. 3 AO', 'bis zum Erhalt bzw. Versand der Rechnung'],
]

/** A.3: Reihenfolge der 13 Anforderungen wie im Muster (Ziff. 2.3), Erklärungen eigene Kurzfassungen */
export const KRITERIEN: [string, string][] = [
  ['Nachvollziehbarkeit und Nachprüfbarkeit', 'Jeder Vorgang lässt sich von der Entstehung bis zur Buchung und zurück verfolgen.'],
  ['Einzelaufzeichnung', 'Jeder Vorgang wird einzeln aufgezeichnet.'],
  ['Vollständigkeit', 'Jeder Vorgang ist erfasst, keiner fehlt.'],
  ['Richtigkeit', 'Belege stimmen mit dem tatsächlichen Geschehen überein.'],
  ['Lesbarkeit', 'Unterlagen lassen sich jederzeit lesbar machen; die Wiedergabe entspricht dem Original.'],
  ['Maschinelle Auswertbarkeit', 'Daten lassen sich elektronisch durchsuchen und auswerten.'],
  ['Zeitgerechte Belegsicherung', 'Belege sind kurz nach Entstehen oder Eingang erfasst und vor Verlust geschützt.'],
  ['Ordnung', 'Jede Unterlage hat einen festen Platz und ist schnell wiederzufinden.'],
  ['Unveränderbarkeit', 'Erfasstes wird nicht ohne Kenntlichmachung geändert oder gelöscht.'],
  ['Verfügbarkeit', 'Unterlagen sind bis zum Fristende vorhanden und abrufbar.'],
  ['Integrität', 'Inhalte bleiben vollständig und unverfälscht.'],
  ['Authentizität', 'Herkunft und Urheber einer Unterlage stehen eindeutig fest.'],
  ['Vertraulichkeit', 'Nur Berechtigte können lesen oder ändern.'],
]

/**
 * A.4, Kapitel 3.3. Sichert nur zu, was die Angaben tragen: eingewiesene Personen
 * nur bei festgelegter Einweisung; „für jede Kontrolle festgelegt“ nur, wenn keine
 * Kontrolle ohne Nachweis oder Zuständigkeit ist (sonst Vorgabe mit den offenen).
 */
export function iks(mitEinweisung: boolean, offen: { nachweis: string[]; zustaendigkeit: string[] }): string {
  const arbeit = mitEinweisung
    ? 'Nur eingewiesene Personen arbeiten in den Schritten aus Kapitel 4, und zwar stets so, wie dort beschrieben.'
    : 'In den Schritten aus Kapitel 4 wird stets so gearbeitet, wie dort beschrieben.'
  const luecken = [
    ...(offen.nachweis.length > 0 ? [`Nachweis offen bei: ${offen.nachweis.join(', ')}.`] : []),
    ...(offen.zustaendigkeit.length > 0 ? [`Zuständigkeit offen bei: ${offen.zustaendigkeit.join(', ')}.`] : []),
  ]
  const kontrollen =
    luecken.length === 0
      ? 'Für jede Kontrolle ist festgelegt, wer sie ausübt und wie sie belegt wird (GoBD Rz. 100).'
      : `Kontrollen sind so auszuüben und zu belegen, wie in der Tabelle angegeben (GoBD Rz. 100). ${luecken.join(' ')}`
  return `${arbeit} ${kontrollen} Weicht die Praxis von dieser Beschreibung ab, erfährt es die Geschäftsleitung; Anlass und Maßnahme werden schriftlich festgehalten.`
}

/** A.5, Kapitel 3.4 */
export const DATENSCHUTZ =
  'Zugriff auf die Unterlagen haben nur berechtigte Personen, vom Entstehen bis zur Vernichtung. Wann vernichtet und gelöscht wird, regelt das letzte Unterkapitel von Kapitel 4. Die Schutzmaßnahmen im Einzelnen nennt das Verzeichnis von Verarbeitungstätigkeiten in Abschnitt C.'

/** Kapitel 3.1: Vorgabe statt Zusicherung, die Lesbarkeit nach einem Wechsel fragt die App nicht ab */
export const SYSTEMWECHSEL = 'Bei einem Systemwechsel ist die Lesbarkeit der aufbewahrten Unterlagen sicherzustellen; der Wechsel wird in Kapitel 7 festgehalten.'

export const HISTORIE = 'Jede frühere Fassung bleibt samt Zeitraum, in dem sie galt, gespeichert, mindestens bis zum Datum in der Spalte „aufbewahren bis“.'

/** A.6: zehn Begriffe, je ein Satz mit Fundstelle */
export const GLOSSAR: [string, string][] = [
  ['Aufbewahrungsfrist', 'Zeitraum, in dem eine Unterlage vorhanden sein muss; er beginnt mit dem Ende des Kalenderjahres ihrer Entstehung (§ 147 Abs. 3 und 4 AO).'],
  ['Auftragsverarbeiter', 'Dienstleister, der personenbezogene Daten im Auftrag und nach Weisung des Unternehmens verarbeitet (Art. 4 Nr. 8, Art. 28 DSGVO).'],
  ['Beleg', 'Nachweis eines Geschäftsvorfalls, etwa eine Rechnung oder Quittung; er begründet die Buchung (GoBD Rz. 61 ff.).'],
  ['E-Rechnung', 'Rechnung in einem strukturierten elektronischen Format wie XRechnung oder ZUGFeRD, das sich maschinell auswerten lässt (§ 14 Abs. 1 UStG).'],
  ['Geschäftsbrief', 'Schreiben, mit dem ein Geschäft vorbereitet, abgeschlossen, abgewickelt oder rückgängig gemacht wird, etwa ein Angebot oder eine Auftragsbestätigung (§ 147 Abs. 1 Nr. 2 und 3 AO).'],
  ['GoBD', 'Verwaltungsanweisung des Bundesfinanzministeriums dazu, wie Bücher und Unterlagen elektronisch zu führen und aufzubewahren sind (BMF-Schreiben vom 28.11.2019, Fassung vom 14.07.2025).'],
  ['Internes Kontrollsystem', 'Gesamtheit der Regeln und Kontrollen, die dafür sorgen, dass Vorgänge vollständig und richtig erfasst werden (GoBD Rz. 100 bis 102).'],
  ['Unveränderbarkeit', 'Einmal erfasste Informationen dürfen nicht ohne Kenntlichmachung geändert oder gelöscht werden (§ 146 Abs. 4 AO, GoBD Rz. 107 ff.).'],
  ['Verfahrensdokumentation', 'Beschreibung, wie Unterlagen entstehen, verarbeitet, aufbewahrt und wiedergegeben werden, so dass sachverständige Dritte das Verfahren nachvollziehen können (GoBD Rz. 151 bis 155).'],
  ['Vier-Augen-Prinzip', 'Eine zweite Person prüft oder gibt frei, was eine erste erstellt hat; so fallen Fehler und Missbrauch eher auf (GoBD Rz. 100).'],
]

/** DOCX und Druck: Fußzeile auf jeder Seite (Spezifikation 7.4) */
export const FUSSZEILE_VORLAGE = 'Vorlage – vor Verwendung prüfen lassen'

/** Hinweisband in der Oberfläche (5.4) */
export function hinweisband(rechtsstand: IsoDatum): string {
  return `Vorlage zur Prüfung durch Steuerberatung bzw. Datenschutzbeauftragten. Keine Rechts- oder Steuerberatung. Rechtsstand ${formatiereDatum(rechtsstand)}.`
}
