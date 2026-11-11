/**
 * Vorschläge für externe Empfänger einer Unterlage (Spezifikation 5.3,
 * Teilschritt 2): die externen Teilnehmer des Ablaufs. Wer zu einer
 * angehakten Gruppe der Betroffenen gehört (Kunde ↔ Kunden), bekommt dort
 * seine eigenen Daten und wird nicht vorgeschlagen.
 */
import type { Betroffene, DatenobjektAngaben } from './typen'

/** Wortformen je Gruppe; ein Name passt, wenn eines seiner Wörter auf eine davon endet (z. B. „Endkunde“). */
const FORMEN: Record<Betroffene, string[]> = {
  kunden: ['kunde', 'kunden', 'kundin', 'kundinnen', 'kundschaft'],
  interessenten: ['interessent', 'interessenten', 'interessentin', 'interessentinnen'],
  lieferanten: ['lieferant', 'lieferanten', 'lieferantin', 'lieferantinnen', 'dienstleister', 'dienstleisterin', 'dienstleisterinnen'],
  beschaeftigte: ['beschäftigte', 'beschäftigter', 'mitarbeiter', 'mitarbeiterin', 'mitarbeiterinnen', 'mitarbeitende'],
  bewerber: ['bewerber', 'bewerberin', 'bewerberinnen'],
  patienten: ['patient', 'patienten', 'patientin', 'patientinnen'],
  sonstige: [],
}

/** Gehört ein Teilnehmer (Name aus dem Ablauf) zu einer der Gruppen? */
export function gehoertZuBetroffenen(teilnehmer: string, betroffene: readonly Betroffene[]): boolean {
  const woerter = teilnehmer.toLocaleLowerCase('de').split(/[^\p{L}]+/u).filter(Boolean)
  return betroffene.some((b) => FORMEN[b].some((form) => woerter.some((w) => w.endsWith(form))))
}

/** Teilnehmer, die als Empfänger in Frage kommen: noch nicht eingetragen und nicht selbst betroffen. */
export function empfaengerVorschlaege(teilnehmer: readonly string[], d: Pick<DatenobjektAngaben, 'betroffene' | 'externeEmpfaenger'>): string[] {
  return teilnehmer.filter((t) => !d.externeEmpfaenger.some((e) => e.kategorie === t) && !gehoertZuBetroffenen(t, d.betroffene))
}
