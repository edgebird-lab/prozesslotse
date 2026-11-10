/**
 * Zustand der Oberfläche. Das Projekt (Ist, Soll, Maßnahmen) ist
 * rückgängig machbar; Schritt, Ansicht, Einfügeposition und Auswahl nicht.
 */
import { findeBlock, findeSequenz } from './modell/operationen'
import type { Cursor, Id, Projekt, Prozess } from './modell/typen'

export type { Cursor }

export type Schritt = 'rahmen' | 'beteiligte' | 'ablauf' | 'pruefen' | 'verbessern' | 'bericht'
export type Ansicht = 'ist' | 'soll'

export const SCHRITTE: { id: Schritt; name: string }[] = [
  { id: 'rahmen', name: 'Rahmen' },
  { id: 'beteiligte', name: 'Beteiligte' },
  { id: 'ablauf', name: 'Ablauf' },
  { id: 'pruefen', name: 'Prüfen' },
  { id: 'verbessern', name: 'Verbessern' },
  { id: 'bericht', name: 'Bericht' },
]

export interface Zustand {
  projekt: Projekt
  vergangenheit: Projekt[]
  zukunft: Projekt[]
  /** Zusammengehörige Eingaben (z. B. Tippen in einem Feld) werden zu einem Rückgängig-Schritt. */
  gruppe: string | null
  gruppeZeit: number
  schritt: Schritt
  ansicht: Ansicht
  cursor: Cursor | null
  auswahl: Id | null
  lernmodus: boolean
}

export type Aktion =
  | { typ: 'prozess'; aenderung: Prozess | ((p: Prozess) => Prozess); gruppe?: string; zeit: number; cursor?: Cursor | null; auswahl?: Id | null }
  | { typ: 'projekt'; projekt: Projekt; zeit: number; ansicht?: Ansicht }
  | { typ: 'laden'; projekt: Projekt; schritt?: Schritt }
  | { typ: 'rueckgaengig' }
  | { typ: 'wiederholen' }
  | { typ: 'schritt'; schritt: Schritt }
  | { typ: 'ansicht'; ansicht: Ansicht }
  | { typ: 'cursor'; cursor: Cursor | null }
  | { typ: 'auswahl'; auswahl: Id | null }
  | { typ: 'lernmodus'; an: boolean }

const MAX_VERLAUF = 100
const GRUPPE_MS = 1500

export function startZustand(projekt: Projekt, lernmodus: boolean): Zustand {
  return {
    projekt,
    vergangenheit: [],
    zukunft: [],
    gruppe: null,
    gruppeZeit: 0,
    schritt: 'rahmen',
    ansicht: 'ist',
    cursor: null,
    auswahl: null,
    lernmodus,
  }
}

export function aktiverProzess(z: Pick<Zustand, 'projekt' | 'ansicht'>): Prozess {
  return z.ansicht === 'soll' && z.projekt.soll ? z.projekt.soll : z.projekt.ist
}

function mitVerlauf(z: Zustand, projekt: Projekt, zeit: number, gruppe?: string): Zustand {
  const zusammenfassen = gruppe !== undefined && z.gruppe === gruppe && zeit - z.gruppeZeit < GRUPPE_MS
  return {
    ...z,
    projekt,
    vergangenheit: zusammenfassen ? z.vergangenheit : [...z.vergangenheit.slice(-(MAX_VERLAUF - 1)), z.projekt],
    zukunft: [],
    gruppe: gruppe ?? null,
    gruppeZeit: zeit,
  }
}

/** Entfernt Auswahl und Einfügeposition, die nach einer Änderung ins Leere zeigen. */
function bereinige(z: Zustand): Zustand {
  const p = aktiverProzess(z)
  const ansicht = z.ansicht === 'soll' && !z.projekt.soll ? 'ist' : z.ansicht
  const auswahl = z.auswahl && findeBlock(p, z.auswahl) ? z.auswahl : null
  let cursor = z.cursor
  if (cursor) {
    const seq = findeSequenz(p, cursor.sequenzId)
    cursor = seq ? { ...cursor, index: Math.min(cursor.index, seq.sequenz.schritte.length) } : null
  }
  return { ...z, ansicht, auswahl, cursor }
}

export function reduziere(z: Zustand, a: Aktion): Zustand {
  switch (a.typ) {
    case 'prozess': {
      const alt = aktiverProzess(z)
      const prozess = typeof a.aenderung === 'function' ? a.aenderung(alt) : a.aenderung
      if (prozess === alt) return { ...z, cursor: a.cursor !== undefined ? a.cursor : z.cursor, auswahl: a.auswahl !== undefined ? a.auswahl : z.auswahl }
      const projekt = z.ansicht === 'soll' && z.projekt.soll ? { ...z.projekt, soll: prozess } : { ...z.projekt, ist: prozess }
      const neu = mitVerlauf(z, projekt, a.zeit, a.gruppe)
      return bereinige({
        ...neu,
        cursor: a.cursor !== undefined ? a.cursor : neu.cursor,
        auswahl: a.auswahl !== undefined ? a.auswahl : neu.auswahl,
      })
    }
    case 'projekt':
      return bereinige({ ...mitVerlauf(z, a.projekt, a.zeit), ansicht: a.ansicht ?? z.ansicht })
    case 'laden':
      return { ...startZustand(a.projekt, z.lernmodus), schritt: a.schritt ?? 'rahmen' }
    case 'rueckgaengig': {
      const vorher = z.vergangenheit[z.vergangenheit.length - 1]
      if (!vorher) return z
      return bereinige({ ...z, projekt: vorher, vergangenheit: z.vergangenheit.slice(0, -1), zukunft: [z.projekt, ...z.zukunft], gruppe: null })
    }
    case 'wiederholen': {
      const nachher = z.zukunft[0]
      if (!nachher) return z
      return bereinige({ ...z, projekt: nachher, vergangenheit: [...z.vergangenheit, z.projekt], zukunft: z.zukunft.slice(1), gruppe: null })
    }
    case 'schritt':
      return { ...z, schritt: a.schritt, gruppe: null }
    case 'ansicht':
      return bereinige({ ...z, ansicht: a.ansicht, cursor: null, auswahl: null })
    case 'cursor':
      return { ...z, cursor: a.cursor, auswahl: null }
    case 'auswahl':
      return { ...z, auswahl: a.auswahl }
    case 'lernmodus':
      return { ...z, lernmodus: a.an }
  }
}

/** Einfügeposition, auch wenn keine gesetzt ist: dann am Ende des Hauptablaufs. */
export function wirksamerCursor(z: Pick<Zustand, 'cursor'>, p: Prozess): Cursor {
  if (z.cursor && findeSequenz(p, z.cursor.sequenzId)) return z.cursor
  return { sequenzId: p.ablauf.id, index: p.ablauf.schritte.length }
}
