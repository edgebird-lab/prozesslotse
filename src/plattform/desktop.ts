/**
 * Windows-Programm (Tauri): Die Oberfläche ruft Befehle des Rust-Teils auf
 * (src-tauri/src/lib.rs). Dateizugriff gibt es nur über diese Befehle und nur
 * für Pfade, die der Benutzer selbst gewählt hat. Die Tauri-Bibliotheken werden
 * erst beim ersten Aufruf geladen, damit die Web-Version sie nie mitlädt.
 */
import type { Datei, MenueBefehl, Plattform, Zuletzt } from './typen'

const kern = () => import('@tauri-apps/api/core')
const ereignisse = () => import('@tauri-apps/api/event')
const fenster = () => import('@tauri-apps/api/window')

async function rufe<T>(befehl: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await kern()
  return invoke<T>(befehl, args)
}

/** Meldet einen Listener an, der sich auch abmelden lässt, bevor die Anmeldung fertig ist. */
function horche(anmelden: () => Promise<() => void>): () => void {
  let abmelden: (() => void) | null = null
  let beendet = false
  void anmelden().then((f) => {
    if (beendet) f()
    else abmelden = f
  })
  return () => {
    beendet = true
    abmelden?.()
  }
}

export const desktopPlattform: Plattform = {
  desktop: true,
  oeffnen: () => rufe<Datei | null>('oeffnen'),
  startDatei: () => rufe<Datei | null>('start_datei'),
  speichern: (pfad, inhalt) => rufe<void>('speichern', { pfad, inhalt }),
  speichernUnter: (vorschlag, inhalt, art) => rufe<{ pfad: string; name: string } | null>('speichern_unter', { vorschlag, inhalt, art }),
  zuletzt: () => rufe<Zuletzt[]>('zuletzt'),
  oeffneZuletzt: (pfad) => rufe<Datei>('oeffne_zuletzt', { pfad }),
  setzeTitel: (titel) => {
    document.title = titel
    void fenster().then(({ getCurrentWindow }) => getCurrentWindow().setTitle(titel))
  },
  beiDatei: (f) => horche(async () => (await ereignisse()).listen<Datei>('datei-oeffnen', (e) => f(e.payload))),
  beimSchliessen: (darf) =>
    horche(async () =>
      (await fenster()).getCurrentWindow().onCloseRequested(async (e) => {
        if (!(await darf())) e.preventDefault()
      }),
    ),
  beiMenue: (f) => horche(async () => (await ereignisse()).listen<MenueBefehl>('menue', (e) => f(e.payload))),
  alsPdf: async (vorschlag) => (await rufe<string | null>('als_pdf', { vorschlag })) !== null,
}
