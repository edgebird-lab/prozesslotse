/**
 * Unterlagen (Datenobjekte), Ablageorte (Datenspeicher) und Zugriffe
 * (welcher Schritt eine Unterlage liest oder schreibt), Spezifikation 4.1.
 * Alle Operationen sind unveränderlich: Sie liefern ein neues Objekt und
 * lassen das alte stehen; darauf bauen Rückgängig und der Versionsvergleich.
 * Ids sind stabil; Umbenennen ändert nichts an den Angaben.
 */
import { neueId } from '../modell/bausteine'
import type { Id } from '../modell/typen'
import type { ComplianceProjekt, ZugriffsRichtung } from './typen'

export interface NeueUnterlage {
  /** fest vorgegebene Id, z. B. in Tests; sonst eine neue mit Präfix `unt` */
  id?: Id
  /** Aufgabe, in der die Unterlage entsteht (Zugriff „schreibt“) */
  entstehtIn?: Id | null
  /** Aufgaben, die die Unterlage nutzen (Zugriff „liest“) */
  genutztIn?: Id[]
}

export function legeUnterlageAn(c: ComplianceProjekt, name: string, optionen: NeueUnterlage = {}): { compliance: ComplianceProjekt; id: Id } {
  const id = optionen.id ?? neueId('unt')
  let neu: ComplianceProjekt = { ...c, unterlagen: [...c.unterlagen, { id, name }] }
  if (optionen.entstehtIn) neu = setzeZugriff(neu, optionen.entstehtIn, id, 'schreibt')
  for (const a of optionen.genutztIn ?? []) neu = setzeZugriff(neu, a, id, 'liest')
  return { compliance: neu, id }
}

export function benenneUnterlageUm(c: ComplianceProjekt, id: Id, name: string): ComplianceProjekt {
  if (!c.unterlagen.some((u) => u.id === id && u.name !== name)) return c
  return { ...c, unterlagen: c.unterlagen.map((u) => (u.id === id ? { ...u, name } : u)) }
}

/** Entfernt die Unterlage samt Angaben und Zugriffen; ein Rückgängig-Schritt stellt alles wieder her. */
export function loescheUnterlage(c: ComplianceProjekt, id: Id): ComplianceProjekt {
  if (!c.unterlagen.some((u) => u.id === id)) return c
  const datenobjekte = { ...c.datenobjekte }
  delete datenobjekte[id]
  return {
    ...c,
    unterlagen: c.unterlagen.filter((u) => u.id !== id),
    zugriffe: c.zugriffe.filter((z) => z.unterlageId !== id),
    datenobjekte,
  }
}

export function legeAblageortAn(c: ComplianceProjekt, name: string, mediumId: Id | null, id: Id = neueId('abl')): { compliance: ComplianceProjekt; id: Id } {
  return { compliance: { ...c, ablageorte: [...c.ablageorte, { id, name, mediumId }] }, id }
}

export function aendereAblageort(c: ComplianceProjekt, id: Id, werte: { name?: string; mediumId?: Id | null }): ComplianceProjekt {
  const alt = c.ablageorte.find((a) => a.id === id)
  if (!alt) return c
  const neu = { ...alt, ...werte }
  if (neu.name === alt.name && neu.mediumId === alt.mediumId) return c
  return { ...c, ablageorte: c.ablageorte.map((a) => (a.id === id ? neu : a)) }
}

/** Entfernt den Ablageort und nimmt ihn aus der Ablage aller Unterlagen. */
export function loescheAblageort(c: ComplianceProjekt, id: Id): ComplianceProjekt {
  if (!c.ablageorte.some((a) => a.id === id)) return c
  const datenobjekte = Object.fromEntries(
    Object.entries(c.datenobjekte).map(([k, d]) => [k, d.ablageSpeicherIds.includes(id) ? { ...d, ablageSpeicherIds: d.ablageSpeicherIds.filter((s) => s !== id) } : d]),
  )
  return { ...c, ablageorte: c.ablageorte.filter((a) => a.id !== id), datenobjekte }
}

/** Setzt einen Zugriff; er ist eindeutig je Aufgabe, Unterlage und Richtung. */
export function setzeZugriff(c: ComplianceProjekt, aufgabeId: Id, unterlageId: Id, richtung: ZugriffsRichtung): ComplianceProjekt {
  if (c.zugriffe.some((z) => z.aufgabeId === aufgabeId && z.unterlageId === unterlageId && z.richtung === richtung)) return c
  return { ...c, zugriffe: [...c.zugriffe, { aufgabeId, unterlageId, richtung }] }
}

export function loeseZugriff(c: ComplianceProjekt, aufgabeId: Id, unterlageId: Id, richtung: ZugriffsRichtung): ComplianceProjekt {
  if (!c.zugriffe.some((z) => z.aufgabeId === aufgabeId && z.unterlageId === unterlageId && z.richtung === richtung)) return c
  return { ...c, zugriffe: c.zugriffe.filter((z) => !(z.aufgabeId === aufgabeId && z.unterlageId === unterlageId && z.richtung === richtung)) }
}

/**
 * Setzt alle Zugriffe einer Richtung für eine Unterlage auf genau diese Aufgaben,
 * z. B. „In welchen Schritten wird es genutzt?“. Die Reihenfolge bestehender Zugriffe bleibt.
 */
export function setzeZugriffe(c: ComplianceProjekt, unterlageId: Id, richtung: ZugriffsRichtung, aufgabeIds: Id[]): ComplianceProjekt {
  const soll = new Set(aufgabeIds)
  const bisher = c.zugriffe.filter((z) => z.unterlageId === unterlageId && z.richtung === richtung).map((z) => z.aufgabeId)
  if (bisher.length === soll.size && bisher.every((a) => soll.has(a))) return c
  const behalten = c.zugriffe.filter((z) => !(z.unterlageId === unterlageId && z.richtung === richtung && !soll.has(z.aufgabeId)))
  const neu = aufgabeIds.filter((a) => !bisher.includes(a)).map((aufgabeId) => ({ aufgabeId, unterlageId, richtung }))
  return { ...c, zugriffe: [...behalten, ...neu] }
}
