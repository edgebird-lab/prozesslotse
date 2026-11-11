/**
 * Verzahnung der Compliance-Doku mit den übrigen Schritten (Spezifikation 6.10
 * und 8): Hinweis, wenn ein Verbesserungsvorschlag eine dokumentierte Kontrolle
 * streicht. Der BPMN-Export ohne Compliance-Angaben steckt in `bpmnFuerExport`.
 */
import { alleAufgaben } from '../modell/operationen'
import type { Id, Projekt, Prozess } from '../modell/typen'

/** Kontrollen mit Angaben, deren Aufgabe es im Ist gibt, im Kandidaten (z. B. dem Soll nach einem Vorschlag) aber nicht mehr. */
export function gestricheneKontrollen(projekt: Projekt, kandidat: Prozess): Id[] {
  const c = projekt.compliance
  if (!c) return []
  const ist = new Set(alleAufgaben(projekt.ist).map((a) => a.id))
  const bleibt = new Set(alleAufgaben(kandidat).map((a) => a.id))
  return Object.keys(c.kontrollen).filter((id) => ist.has(id) && !bleibt.has(id))
}
