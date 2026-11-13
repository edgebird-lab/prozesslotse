import { ladeHerunter } from '../ui/hilfen'
import type { DateiArt, Plattform } from './typen'

const MIME: Record<DateiArt, string> = {
  projekt: 'application/json',
  bpmn: 'application/xml',
  svg: 'image/svg+xml',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  beratungsakte: 'application/json',
}

/**
 * Browser: Öffnen läuft über das Dateifeld der Oberfläche, Speichern über
 * einen Download. Das Projekt liegt zusätzlich im Browserspeicher, deshalb
 * fragt der Browser beim Schließen nicht nach; nur solange der Browserspeicher
 * ungespeicherte Änderungen nicht sichert, warnt die Oberfläche (App.tsx).
 */
export const browserPlattform: Plattform = {
  desktop: false,
  oeffnen: async () => null,
  startDatei: async () => null,
  speichern: async () => {
    throw new Error('Im Browser gibt es kein Speichern an einen Pfad.')
  },
  speichernUnter: async (vorschlag, inhalt, art) => {
    ladeHerunter(vorschlag, inhalt, MIME[art])
    return { pfad: null, name: vorschlag }
  },
  speichereBytes: async (vorschlag, bytes, art) => {
    ladeHerunter(vorschlag, new Blob([bytes as Uint8Array<ArrayBuffer>], { type: MIME[art] }))
    return { pfad: null, name: vorschlag }
  },
  zuletzt: async () => [],
  oeffneZuletzt: async () => {
    throw new Error('Im Browser gibt es keine zuletzt geöffneten Dateien.')
  },
  setzeTitel: (titel) => {
    document.title = titel
  },
  beiDatei: () => () => {},
  beimSchliessen: () => () => {},
  beiMenue: () => () => {},
  alsPdf: async () => false,
}
