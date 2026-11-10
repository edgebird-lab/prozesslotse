import { createContext, useContext, type Dispatch } from 'react'
import type { Cursor, Id, Prozess } from '../modell/typen'
import type { Aktion, Zustand } from '../zustand'
import type { DateiBefehle } from './datei'

export interface AenderungsOptionen {
  /** Gleiche Gruppe kurz hintereinander ergibt einen Rückgängig-Schritt. */
  gruppe?: string
  cursor?: Cursor | null
  auswahl?: Id | null
}

export interface AppApi {
  z: Zustand
  /** Der Prozess, der gerade angezeigt und bearbeitet wird (Ist oder Soll). */
  p: Prozess
  dispatch: Dispatch<Aktion>
  /** Ändert den aktiven Prozess; als Funktion bekommt sie immer den neuesten Stand. */
  aendere: (aenderung: Prozess | ((p: Prozess) => Prozess), optionen?: AenderungsOptionen) => void
  /** Bausteine, die im Diagramm vorübergehend hervorgehoben werden. */
  setHervorhebung: (ids: Id[]) => void
  /** Öffnen, Speichern, Exportieren */
  datei: DateiBefehle
  /** Kurze Statusmeldung in der Kopfzeile */
  melde: (text: string) => void
}

export const AppKontext = createContext<AppApi | null>(null)

export function useApp(): AppApi {
  const api = useContext(AppKontext)
  if (!api) throw new Error('useApp außerhalb von AppKontext')
  return api
}
