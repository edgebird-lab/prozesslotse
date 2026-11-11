/**
 * Adapter für Datenobjekte und Datenspeicher (Spezifikation 4.1). Heute
 * stammen sie aus den Tabellen in `compliance`; kommen sie später als
 * `dataObjectReference` und `dataStoreReference` ins Prozessmodell, ändert
 * sich nur diese Datei. Alle übrigen Funktionen arbeiten mit der `DatenSicht`.
 */
import { alleAufgaben } from '../modell/operationen'
import type { Id, Prozess } from '../modell/typen'
import type { ComplianceProjekt, ZugriffsRichtung } from './typen'

export interface DatenSicht {
  /** Reihenfolge wie in der Tabelle */
  objekte: { id: Id; name: string }[]
  speicher: { id: Id; name: string; mediumId: Id | null }[]
  /** nur Zugriffe auf Aufgaben, die im Ist-Prozess vorkommen */
  zugriffe: { aufgabeId: Id; zielId: Id; richtung: ZugriffsRichtung }[]
}

export function datenSicht(p: Prozess, c: ComplianceProjekt): DatenSicht {
  const aufgaben = new Set(alleAufgaben(p).map((a) => a.id))
  const objekte = new Set(c.unterlagen.map((u) => u.id))
  return {
    objekte: c.unterlagen.map((u) => ({ id: u.id, name: u.name })),
    speicher: c.ablageorte.map((a) => ({ id: a.id, name: a.name, mediumId: a.mediumId })),
    zugriffe: c.zugriffe.filter((z) => aufgaben.has(z.aufgabeId) && objekte.has(z.unterlageId)).map((z) => ({ aufgabeId: z.aufgabeId, zielId: z.unterlageId, richtung: z.richtung })),
  }
}
