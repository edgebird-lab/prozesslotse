import { createContext, useCallback, useContext } from 'react'

export interface FrageKnopf<T extends string> {
  wert: T
  text: string
  art?: 'haupt' | 'gefahr'
}

/** Rückfrage mit mehreren Antworten, z. B. „Speichern / Nicht speichern / Abbrechen“. */
export interface Frage<T extends string> {
  titel: string
  text: string
  knoepfe: FrageKnopf<T>[]
  /** Antwort bei Escape oder Schließen; bekommt auch den Fokus, damit Enter nichts zerstört. */
  abbrechen: T
}

export type FrageFn = <T extends string>(f: Frage<T>) => Promise<T>

export const FrageKontext = createContext<FrageFn | null>(null)

export function useFrage(): FrageFn {
  const f = useContext(FrageKontext)
  if (!f) throw new Error('useFrage außerhalb von FrageDialog')
  return f
}

/** Ja/Abbrechen-Rückfrage; true bei Ja. */
export function useBestaetigen(): (titel: string, text: string, ja: string) => Promise<boolean> {
  const frage = useFrage()
  return useCallback(
    (titel, text, ja) =>
      frage({ titel, text, knoepfe: [{ wert: 'ja', text: ja, art: 'gefahr' }, { wert: 'nein', text: 'Abbrechen' }], abbrechen: 'nein' }).then((w) => w === 'ja'),
    [frage],
  )
}
