import { browserPlattform } from './browser'
import { desktopPlattform } from './desktop'
import type { Plattform } from './typen'

export type { Datei, DateiArt, MenueBefehl, Plattform, Zuletzt } from './typen'

/** Läuft die Oberfläche im Windows-Programm? Tauri legt dieses Objekt vor dem Laden der Seite an. */
export const istDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const plattform: Plattform = istDesktop ? desktopPlattform : browserPlattform
