/**
 * Zustand der Oberfläche. Das Projekt (Ist, Soll, Maßnahmen) ist
 * rückgängig machbar; Schritt, Ansicht, Einfügeposition und Auswahl nicht.
 */
import { bereinigeCompliance } from './compliance/speicher'
import { neueCompliance } from './compliance/standard'
import type { ComplianceProjekt, Teilschritt } from './compliance/typen'
import { findeBlock, findeSequenz, normalisiere } from './modell/operationen'
import type { Cursor, Id, Projekt, Prozess } from './modell/typen'

export type { Cursor }

export type Schritt = 'rahmen' | 'beteiligte' | 'ablauf' | 'pruefen' | 'verbessern' | 'dokumentieren' | 'bericht'
export type Ansicht = 'ist' | 'soll'

export const SCHRITTE: { id: Schritt; name: string }[] = [
  { id: 'rahmen', name: 'Rahmen' },
  { id: 'beteiligte', name: 'Beteiligte' },
  { id: 'ablauf', name: 'Ablauf' },
  { id: 'pruefen', name: 'Prüfen' },
  { id: 'verbessern', name: 'Verbessern' },
  { id: 'dokumentieren', name: 'Dokumentieren' },
  { id: 'bericht', name: 'Bericht' },
]

/** Die Datei hinter dem Projekt. */
export interface Dokument {
  /** Pfad im Windows-Programm; im Browser und bei neuen Projekten null. */
  pfad: string | null
  /** Dateiname zur Anzeige; null bei einem neuen, nie gespeicherten Projekt. */
  name: string | null
  /** Stand beim letzten Öffnen oder Speichern; null, wenn unbekannt (wiederhergestellte Änderungen). */
  gespeichert: Projekt | null
}

export interface Zustand {
  projekt: Projekt
  dokument: Dokument
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
  /** Teilschritt im Schritt „Dokumentieren“ (nicht rückgängig machbar) */
  teilschritt: Teilschritt
}

export type Aktion =
  | { typ: 'prozess'; aenderung: Prozess | ((p: Prozess) => Prozess); gruppe?: string; zeit: number; cursor?: Cursor | null; auswahl?: Id | null }
  | { typ: 'projekt'; projekt: Projekt; zeit: number; ansicht?: Ansicht }
  | { typ: 'laden'; projekt: Projekt; schritt?: Schritt; ansicht?: Ansicht; dokument?: Partial<Dokument> }
  | { typ: 'gespeichert'; projekt: Projekt; pfad: string | null; name: string }
  | { typ: 'rueckgaengig' }
  | { typ: 'wiederholen' }
  | { typ: 'schritt'; schritt: Schritt }
  | { typ: 'ansicht'; ansicht: Ansicht }
  | { typ: 'cursor'; cursor: Cursor | null }
  | { typ: 'auswahl'; auswahl: Id | null }
  | { typ: 'lernmodus'; an: boolean }
  | { typ: 'compliance'; aenderung: (c: ComplianceProjekt) => ComplianceProjekt; gruppe?: string; zeit: number }
  | { typ: 'teilschritt'; teilschritt: Teilschritt }

const MAX_VERLAUF = 100
const GRUPPE_MS = 1500

export function startZustand(projekt: Projekt, lernmodus: boolean, dokument: Partial<Dokument> = {}): Zustand {
  return {
    projekt,
    dokument: { pfad: null, name: null, gespeichert: projekt, ...dokument },
    vergangenheit: [],
    zukunft: [],
    gruppe: null,
    gruppeZeit: 0,
    schritt: 'rahmen',
    ansicht: 'ist',
    cursor: null,
    auswahl: null,
    lernmodus,
    teilschritt: 'unternehmen',
  }
}

/** Entfernt Compliance-Angaben zu Medien, Rollen und Aufgaben, die es im Ist-Prozess nicht mehr gibt. */
function mitBereinigterCompliance(projekt: Projekt): Projekt {
  if (!projekt.compliance) return projekt
  const c = bereinigeCompliance(projekt.compliance, projekt.ist)
  return c === projekt.compliance ? projekt : { ...projekt, compliance: c }
}

/**
 * Weicht das Projekt vom gespeicherten Stand ab? Projekte sind unveränderlich,
 * deshalb genügt der Vergleich der Referenz; wer bis zum gespeicherten Stand
 * zurücknimmt, hat wieder nichts geändert.
 */
export function istGeaendert(z: Pick<Zustand, 'projekt' | 'dokument'>): boolean {
  return z.dokument.gespeichert !== z.projekt
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
      // Aufräumen: Rücksprungbereiche ohne Rücksprung auflösen (z. B. nach dem Löschen einer Entscheidung)
      const prozess = normalisiere(typeof a.aenderung === 'function' ? a.aenderung(alt) : a.aenderung)
      if (prozess === alt) return { ...z, cursor: a.cursor !== undefined ? a.cursor : z.cursor, auswahl: a.auswahl !== undefined ? a.auswahl : z.auswahl }
      // Änderungen am Ist bereinigen die Compliance-Angaben im selben Rückgängig-Schritt, Änderungen am Soll nicht
      const projekt = z.ansicht === 'soll' && z.projekt.soll ? { ...z.projekt, soll: prozess } : mitBereinigterCompliance({ ...z.projekt, ist: prozess })
      const neu = mitVerlauf(z, projekt, a.zeit, a.gruppe)
      return bereinige({
        ...neu,
        cursor: a.cursor !== undefined ? a.cursor : neu.cursor,
        auswahl: a.auswahl !== undefined ? a.auswahl : neu.auswahl,
      })
    }
    case 'projekt':
      return bereinige({ ...mitVerlauf(z, mitBereinigterCompliance(a.projekt), a.zeit), ansicht: a.ansicht ?? z.ansicht })
    case 'laden': {
      const neu = startZustand(a.projekt, z.lernmodus, a.dokument)
      return { ...neu, schritt: a.schritt ?? 'rahmen', ansicht: a.ansicht === 'soll' && a.projekt.soll ? 'soll' : 'ist' }
    }
    case 'gespeichert':
      // Gespeichert wurde der Stand, der beim Speichern vorlag; spätere Änderungen bleiben „geändert“.
      return { ...z, dokument: { pfad: a.pfad, name: a.name, gespeichert: a.projekt } }
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
      // Die Dokumentation beschreibt immer den Ist-Prozess
      if (a.schritt === 'dokumentieren') return bereinige({ ...z, schritt: a.schritt, gruppe: null, ansicht: 'ist', cursor: z.ansicht === 'ist' ? z.cursor : null, auswahl: z.ansicht === 'ist' ? z.auswahl : null })
      return { ...z, schritt: a.schritt, gruppe: null }
    case 'ansicht':
      return bereinige({ ...z, ansicht: a.ansicht, cursor: null, auswahl: null })
    case 'cursor':
      return { ...z, cursor: a.cursor, auswahl: null }
    case 'auswahl':
      return { ...z, auswahl: a.auswahl }
    case 'lernmodus':
      return { ...z, lernmodus: a.an }
    case 'compliance': {
      const alt = z.projekt.compliance ?? neueCompliance()
      const neu = a.aenderung(alt)
      if (neu === alt) return z
      return mitVerlauf(z, { ...z.projekt, compliance: neu }, a.zeit, a.gruppe)
    }
    case 'teilschritt':
      return { ...z, teilschritt: a.teilschritt, gruppe: null }
  }
}

/** Einfügeposition, auch wenn keine gesetzt ist: dann am Ende des Hauptablaufs. */
export function wirksamerCursor(z: Pick<Zustand, 'cursor'>, p: Prozess): Cursor {
  if (z.cursor && findeSequenz(p, z.cursor.sequenzId)) return z.cursor
  return { sequenzId: p.ablauf.id, index: p.ablauf.schritte.length }
}
