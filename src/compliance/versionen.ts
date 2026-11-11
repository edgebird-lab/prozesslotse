/**
 * Versionen der Compliance-Doku (Spezifikation 6.8): Freigabe, geänderte
 * Kapitel und Prüfsumme. Eine Freigabe friert den Ist-Prozess und beide
 * Dokumente ein. Die Prüfsumme (SHA-256 über kanonisches JSON) erkennt
 * Beschädigungen und ordnet Ausdrucke einer Version zu; vor gezielter Änderung
 * schützt sie nicht.
 */
import type { Prozess } from '../modell/typen'
import { formatiereDatum, istIsoDatum, jahrVon } from './datum'
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

/** Prüft die Eingaben des Freigabe-Dialogs; liefert die erste Fehlermeldung oder null. */
export function pruefeFreigabe(c: ComplianceProjekt, e: FreigabeEingaben): string | null {
  const bezeichnung = e.bezeichnung.trim()
  const letzte = c.versionen[c.versionen.length - 1]
  if (!bezeichnung) return 'Bitte eine Bezeichnung angeben.'
  if (c.versionen.some((v) => v.bezeichnung === bezeichnung)) return `Die Bezeichnung ${bezeichnung} gibt es schon.`
  if (!istIsoDatum(e.gueltigAb)) return 'Gültig ab ist kein gültiges Datum.'
  if (letzte && e.gueltigAb <= letzte.gueltigAb) return `Gültig ab muss nach dem ${formatiereDatum(letzte.gueltigAb)} liegen.`
  if (!e.freigegebenVon.trim()) return 'Bitte angeben, wer freigibt.'
  if (letzte && !e.aenderung.trim()) return 'Bitte den Inhalt der Änderung beschreiben.'
  return null
}

/** SHA-256 als Hex über das kanonische JSON beider Dokumente. */
export async function pruefsumme(verfahrensdoku: Dokument, verzeichnis: Dokument): Promise<string> {
  const daten = new TextEncoder().encode(kanonischesJson([verfahrensdoku, verzeichnis]))
  const hash = await globalThis.crypto.subtle.digest('SHA-256', daten)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Friert Ist-Prozess und beide Dokumente als neue Version ein; wirft `FreigabeFehler` bei ungültigen Eingaben. */
export async function freigeben(ist: Prozess, c: ComplianceProjekt, e: FreigabeEingaben, heute: IsoDatum): Promise<DokuVersion> {
  const fehler = pruefeFreigabe(c, e)
  if (fehler) throw new FreigabeFehler(fehler)
  const letzte = c.versionen[c.versionen.length - 1]
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
  return { ...kopf, prozess: structuredClone(ist), verfahrensdoku, verzeichnis, pruefsumme: await pruefsumme(verfahrensdoku, verzeichnis) }
}

/** Vorschlag für die Bezeichnung der nächsten Version: „{nummer}.0“, notfalls mit Zusatz. */
export function naechsteBezeichnung(c: ComplianceProjekt): string {
  let n = c.versionen.length + 1
  while (c.versionen.some((v) => v.bezeichnung === `${n}.0`)) n++
  return `${n}.0`
}
