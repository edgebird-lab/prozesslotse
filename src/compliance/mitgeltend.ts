/**
 * Mitgeltende Unterlagen (Kapitel 6 der Verfahrensdokumentation), z. B. ein
 * Berechtigungskonzept, mit Ablageort. Ältere Dateien führen sie nur als Namen
 * in `mitgeltend`; sie erscheinen weiter und gehen bei der ersten Änderung in
 * `mitgeltendeUnterlagen` über.
 */
import type { ComplianceProjekt, MitgeltendeUnterlage } from './typen'

/** Alle mitgeltenden Unterlagen: ältere Einträge ohne Ablageort zuerst, leere Namen ausgelassen. */
export function mitgeltendeUnterlagen(c: ComplianceProjekt): MitgeltendeUnterlage[] {
  const alt = c.mitgeltend.flatMap((name, i) => (name.trim() ? [{ id: `mit_alt_${i}`, name, ablageort: '' }] : []))
  return [...alt, ...(c.mitgeltendeUnterlagen ?? [])]
}

/** Setzt die Liste; ältere Einträge aus `mitgeltend` sind darin enthalten und werden dort geleert. */
export function setzeMitgeltendeUnterlagen(c: ComplianceProjekt, liste: MitgeltendeUnterlage[]): ComplianceProjekt {
  return { ...c, mitgeltend: [], mitgeltendeUnterlagen: liste }
}

/** Eintrag für Kapitel 6, z. B. „Berechtigungskonzept (Ablage: Ordner Organisation)“; null bei leerem Namen. */
export function mitgeltendText(m: MitgeltendeUnterlage): string | null {
  const name = m.name.trim()
  if (!name) return null
  return m.ablageort.trim() ? `${name} (Ablage: ${m.ablageort.trim()})` : name
}
