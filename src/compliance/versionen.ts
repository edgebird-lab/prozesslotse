/**
 * Versionen der Compliance-Doku (Spezifikation 6.8): Freigabe, geänderte
 * Kapitel und Prüfsumme. Eine Freigabe friert den Ist-Prozess und beide
 * Dokumente ein. Die Prüfsumme (SHA-256 über kanonisches JSON von
 * eingefrorenem Prozess und beiden Dokumenten) rechnet die App nach dem Laden
 * nach; so fallen beschädigte oder veränderte Versionen auf. Vor gezielter
 * Änderung schützt sie nicht, weil sie sich neu berechnen lässt.
 */
import type { Prozess } from '../modell/typen'
import { addiereJahre, addiereTage, formatiereDatum, istPlausiblesDatum, jahrVon, tageZwischen } from './datum'
import { geaenderteKapitelIn } from './dokument'
import { kanonischesJson } from './speicher'
import type { ComplianceProjekt, Dokument, DokuVersion, IsoDatum, VersionKopf } from './typen'
import { erzeugeVerfahrensdoku, type DokuKontext } from './verfahrensdoku'
import { erzeugeVerzeichnis } from './verzeichnis'

export class FreigabeFehler extends Error {}

export interface FreigabeEingaben {
  bezeichnung: string
  gueltigAb: IsoDatum
  freigegebenVon: string
  aenderung: string
}

export function kopfVon(v: DokuVersion): VersionKopf {
  const { prozess: _p, verfahrensdoku: _vd, verzeichnis: _vvt, ...kopf } = v
  return kopf
}

/** Kontext für den Entwurf: alle bisherigen Versionen, Beispieljahr = laufendes Jahr. */
export function entwurfsKontext(c: ComplianceProjekt, heute: IsoDatum): DokuKontext {
  return { version: null, historie: c.versionen.map(kopfVon), bezugsjahr: jahrVon(heute), heute }
}

/** Kontext, mit dem Version `v` erzeugt wurde: Historie bis v, Bezugsjahr von gültig ab, Tag der Freigabe. */
export function versionsKontext(v: DokuVersion, versionen: DokuVersion[]): DokuKontext {
  return { version: kopfVon(v), historie: versionen.filter((x) => x.nummer <= v.nummer).map(kopfVon), bezugsjahr: jahrVon(v.gueltigAb), heute: v.freigegebenAm }
}

export function erzeugeDokumente(ist: Prozess, c: ComplianceProjekt, kx: DokuKontext): { verfahrensdoku: Dokument; verzeichnis: Dokument } {
  return { verfahrensdoku: erzeugeVerfahrensdoku(ist, c, kx), verzeichnis: erzeugeVerzeichnis(ist, c, kx) }
}

/**
 * Kapitel, die sich seit Version `v` fachlich geändert haben: Beide Dokumente
 * werden mit dem Kontext von `v` neu erzeugt und je Kapitel mit dem
 * eingefrorenen Stand verglichen.
 */
export function geaenderteKapitel(v: DokuVersion, ist: Prozess, c: ComplianceProjekt): string[] {
  const neu = erzeugeDokumente(ist, c, versionsKontext(v, c.versionen))
  return [...geaenderteKapitelIn(v.verfahrensdoku, neu.verfahrensdoku), ...geaenderteKapitelIn(v.verzeichnis, neu.verzeichnis)]
}

/** Letzte Version, deren Freigabe nicht zurückgezogen ist; nur solche zählen für Reihenfolge und Gültigkeit. */
export function letzteWirksame<T extends Pick<VersionKopf, 'zurueckgezogen'>>(versionen: readonly T[]): T | null {
  for (let i = versionen.length - 1; i >= 0; i--) if (!versionen[i].zurueckgezogen) return versionen[i]
  return null
}

/** Liegt „Gültig ab“ mehr Tage nach dem Freigabetag, fragt der Dialog nach. */
export const RUECKFRAGE_TAGE = 30

/** Spätestes „Gültig ab“: ein Jahr nach dem Freigabetag; ein späteres Datum ist fast immer ein Tippfehler. */
export function spaetestesGueltigAb(heute: IsoDatum): IsoDatum {
  return addiereJahre(heute, 1)
}

/** Frühestes „Gültig ab“: der Tag nach dem der letzten wirksamen Version; null ohne Vorgänger (dann ist auch ein Datum in der Vergangenheit möglich). */
export function fruehestesGueltigAb(c: ComplianceProjekt): IsoDatum | null {
  const letzte = letzteWirksame(c.versionen)
  return letzte ? addiereTage(letzte.gueltigAb, 1) : null
}

/** Vorgabe im Dialog: heute oder, wenn das später ist, der Tag nach dem „Gültig ab“ der letzten wirksamen Version. */
export function vorgabeGueltigAb(c: ComplianceProjekt, heute: IsoDatum): IsoDatum {
  const frueh = fruehestesGueltigAb(c)
  return frueh && frueh > heute ? frueh : heute
}

export type FreigabeFeld = 'bezeichnung' | 'gueltigAb' | 'freigegebenVon' | 'aenderung'

/** Erster Fehler in den Eingaben des Freigabe-Dialogs mit dem Feld, zu dem er gehört; null, wenn alles passt. */
export function freigabeFehler(c: ComplianceProjekt, e: FreigabeEingaben, heute: IsoDatum): { feld: FreigabeFeld; text: string } | null {
  const bezeichnung = e.bezeichnung.trim()
  const letzte = letzteWirksame(c.versionen)
  if (!bezeichnung) return { feld: 'bezeichnung', text: 'Bitte eine Bezeichnung angeben.' }
  // auch zurückgezogene Versionen behalten ihre Bezeichnung
  if (c.versionen.some((v) => v.bezeichnung === bezeichnung)) return { feld: 'bezeichnung', text: `Die Bezeichnung ${bezeichnung} gibt es schon.` }
  if (!istPlausiblesDatum(e.gueltigAb)) return { feld: 'gueltigAb', text: 'Gültig ab ist kein gültiges Datum.' }
  if (letzte && e.gueltigAb <= letzte.gueltigAb) return { feld: 'gueltigAb', text: `Gültig ab muss nach dem ${formatiereDatum(letzte.gueltigAb)} liegen.` }
  const spaetestens = spaetestesGueltigAb(heute)
  if (e.gueltigAb > spaetestens) return { feld: 'gueltigAb', text: `Gültig ab darf höchstens ein Jahr nach dem Freigabetag liegen, also spätestens am ${formatiereDatum(spaetestens)}.` }
  if (!e.freigegebenVon.trim()) return { feld: 'freigegebenVon', text: 'Bitte angeben, wer freigibt.' }
  if (letzte && !e.aenderung.trim()) return { feld: 'aenderung', text: 'Bitte den Inhalt der Änderung beschreiben.' }
  return null
}

/** Prüft die Eingaben des Freigabe-Dialogs; liefert die erste Fehlermeldung oder null. */
export function pruefeFreigabe(c: ComplianceProjekt, e: FreigabeEingaben, heute: IsoDatum): string | null {
  return freigabeFehler(c, e, heute)?.text ?? null
}

/** Rückfrage, wenn „Gültig ab“ mehr als 30 Tage nach dem Freigabetag liegt; null, wenn keine nötig ist. */
export function rueckfrageGueltigAb(e: FreigabeEingaben, heute: IsoDatum): string | null {
  const tage = tageZwischen(heute, e.gueltigAb)
  if (tage <= RUECKFRAGE_TAGE) return null
  return `Version ${e.bezeichnung.trim()} soll erst ab dem ${formatiereDatum(e.gueltigAb)} gelten, ${tage} Tage nach dem Freigabetag. Stimmt das Datum?`
}

/** Lässt sich die Freigabe von `v` zurückziehen? Nur bei der letzten wirksamen Version, solange sie noch nicht gilt. */
export function kannZurueckziehen(c: ComplianceProjekt, v: DokuVersion, heute: IsoDatum): boolean {
  return letzteWirksame(c.versionen) === v && v.gueltigAb > heute
}

/** Prüft „Freigabe zurückziehen“; liefert die Fehlermeldung oder null. */
export function pruefeRueckzug(c: ComplianceProjekt, nummer: number, grund: string, heute: IsoDatum): string | null {
  const v = letzteWirksame(c.versionen)
  if (!v || v.nummer !== nummer) return 'Zurückziehen lässt sich nur die Freigabe der letzten Version, die noch gilt oder gelten soll.'
  if (v.gueltigAb <= heute) return `Version ${v.bezeichnung} gilt seit dem ${formatiereDatum(v.gueltigAb)}; eine Version, die in Kraft ist, lässt sich nicht zurückziehen. Gib stattdessen eine neue Version frei.`
  if (!grund.trim()) return 'Bitte den Grund für den Rückzug angeben.'
  return null
}

/**
 * Zieht die Freigabe der letzten wirksamen Version zurück, solange sie noch nicht gilt. Sie bleibt mit
 * Datum und Grund in der Liste, zählt aber für Reihenfolge und Gültigkeit nicht mehr; ihre Nummer wird
 * nicht wieder vergeben. Wirft `FreigabeFehler` bei ungültigen Angaben.
 */
export function zieheZurueck(c: ComplianceProjekt, nummer: number, grund: string, heute: IsoDatum): ComplianceProjekt {
  const fehler = pruefeRueckzug(c, nummer, grund, heute)
  if (fehler) throw new FreigabeFehler(fehler)
  return { ...c, versionen: c.versionen.map((v) => (v.nummer === nummer ? { ...v, zurueckgezogen: { am: heute, grund: grund.trim() } } : v)) }
}

/** Was die Prüfsumme abdeckt: der eingefrorene Prozess (Diagramm der Anlage) und beide Dokumente. */
export type VersionInhalt = Pick<DokuVersion, 'prozess' | 'verfahrensdoku' | 'verzeichnis'>

/** SHA-256 als Hex über das kanonische JSON von [prozess, verfahrensdoku, verzeichnis]. */
export async function pruefsumme(v: VersionInhalt): Promise<string> {
  const daten = new TextEncoder().encode(kanonischesJson([v.prozess, v.verfahrensdoku, v.verzeichnis]))
  const hash = await globalThis.crypto.subtle.digest('SHA-256', daten)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Rechnet die Prüfsumme einer gespeicherten Version nach; false, wenn die Version verändert oder beschädigt ist. */
export async function pruefsummeStimmt(v: DokuVersion): Promise<boolean> {
  return (await pruefsumme(v)) === v.pruefsumme
}

/** Friert Ist-Prozess und beide Dokumente als neue Version ein; wirft `FreigabeFehler` bei ungültigen Eingaben. */
export async function freigeben(ist: Prozess, c: ComplianceProjekt, e: FreigabeEingaben, heute: IsoDatum): Promise<DokuVersion> {
  const fehler = pruefeFreigabe(c, e, heute)
  if (fehler) throw new FreigabeFehler(fehler)
  // Geändert gegenüber der Version, die gilt oder gelten soll; zurückgezogene zählen nicht, behalten aber ihre Nummer
  const letzte = letzteWirksame(c.versionen)
  const kopf: VersionKopf = {
    nummer: c.versionen.length + 1,
    bezeichnung: e.bezeichnung.trim(),
    gueltigAb: e.gueltigAb,
    freigegebenAm: heute,
    freigegebenVon: e.freigegebenVon.trim(),
    aenderung: e.aenderung.trim(),
    geaenderteKapitel: letzte ? geaenderteKapitel(letzte, ist, c) : [],
  }
  const kx: DokuKontext = { version: kopf, historie: [...c.versionen.map(kopfVon), kopf], bezugsjahr: jahrVon(e.gueltigAb), heute }
  const { verfahrensdoku, verzeichnis } = erzeugeDokumente(ist, c, kx)
  const prozess = structuredClone(ist)
  return { ...kopf, prozess, verfahrensdoku, verzeichnis, pruefsumme: await pruefsumme({ prozess, verfahrensdoku, verzeichnis }) }
}

/** Vorschlag für die Bezeichnung der nächsten Version: „{nummer}.0“, notfalls mit Zusatz. */
export function naechsteBezeichnung(c: ComplianceProjekt): string {
  let n = c.versionen.length + 1
  while (c.versionen.some((v) => v.bezeichnung === `${n}.0`)) n++
  return `${n}.0`
}
