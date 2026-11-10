// Prototyp: Brücke zum Tauri-Kern. Wird nur im Programm geladen (dynamischer Import).
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'

export interface Geladen {
  pfad: string
  name: string
  inhalt: string
}

export const startDatei = () => invoke<Geladen | null>('start_datei')
export const oeffnen = () => invoke<Geladen | null>('oeffnen')
export const speichern = (pfad: string, inhalt: string) => invoke<void>('speichern', { pfad, inhalt })
export const speichernUnter = (vorschlag: string, inhalt: string, filterName: string, endung: string) =>
  invoke<string | null>('speichern_unter', { vorschlag, inhalt, filterName, endung })
export const bereit = () => invoke<void>('bereit')
export const setzeTitel = (titel: string) => getCurrentWindow().setTitle(titel)
export const beiDatei = (f: (g: Geladen) => void) => listen<Geladen>('datei-oeffnen', (e) => f(e.payload))
