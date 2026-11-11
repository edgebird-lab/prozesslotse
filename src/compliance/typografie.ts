/**
 * Satz der Dokumente: Nach Verweiszeichen wie „§“, „Abs.“ oder „Art.“ steht ein
 * geschütztes Leerzeichen, damit das Zeichen nicht allein am Zeilenende steht
 * (DIN 5008); ebenso bleibt „z. B.“ zusammen, und „E-Mail“ bricht nicht am
 * Bindestrich um. Das gilt nur für die Ausgabe (Druck und Word-Datei); der Text
 * im Dokumentmodell bleibt unverändert, damit Prüfsummen und der Vergleich mit
 * freigegebenen Versionen gleich bleiben.
 */
import type { DokumentArt } from './typen'

const VERWEIS = /(§§?|\b(?:Abs|Nr|Art|Rz|lit|Ziff)\.) (?=[\p{L}\d])/gu
/** „z. B.“: sonst steht „z.“ am Zeilenende und „B.“ am Anfang der nächsten Zeile */
const ZUM_BEISPIEL = /\b([zZ])\. B\./g
/** „E-Mail“ mit geschütztem Bindestrich, nicht „E-“ am Zeilenende */
const E_MAIL = /\bE-Mail/g

/** Geschützter Bindestrich (U+2011): sieht aus wie „-“, bricht aber nicht um; die Word-Datei setzt dafür ihr eigenes Zeichen. */
export const GESCHUETZTER_BINDESTRICH = '‑'

export function festeLeerzeichen(text: string): string {
  return text.replace(VERWEIS, '$1 ').replace(ZUM_BEISPIEL, '$1. B.').replace(E_MAIL, `E${GESCHUETZTER_BINDESTRICH}Mail`)
}

/**
 * Kapitel der Ebene 1, vor denen Druck und Word-Datei eine neue Seite beginnen: nur
 * die großen. Kurze Kapitel (Verfahrensdokumentation 1 und 5 bis 8, Verzeichnis A
 * und D) laufen weiter, statt fast leere Seiten zu hinterlassen.
 */
const NEUE_SEITE: Record<DokumentArt, ReadonlySet<string>> = {
  verfahrensdokumentation: new Set(['2', '3', '4', '9']),
  verarbeitungsverzeichnis: new Set(['B', 'C']),
}

export function neueSeiteVor(art: DokumentArt, nummer: string): boolean {
  return NEUE_SEITE[art].has(nummer)
}
