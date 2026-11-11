/**
 * Satz der Dokumente: Nach Verweiszeichen wie „§“, „Abs.“ oder „Art.“ steht ein
 * geschütztes Leerzeichen, damit das Zeichen nicht allein am Zeilenende steht
 * (DIN 5008). Das gilt nur für die Ausgabe (Druck und Word-Datei); der Text im
 * Dokumentmodell bleibt unverändert, damit Prüfsummen und der Vergleich mit
 * freigegebenen Versionen gleich bleiben.
 */
const VERWEIS = /(§§?|\b(?:Abs|Nr|Art|Rz|lit|Ziff)\.) (?=[\p{L}\d])/gu

export function festeLeerzeichen(text: string): string {
  return text.replace(VERWEIS, '$1\u00a0')
}
