import { ladeHerunter } from '../ui/hilfen'
import type { DateiArt, Plattform } from './typen'

const MIME: Record<DateiArt, string> = {
  projekt: 'application/json',
  bpmn: 'application/xml',
  svg: 'image/svg+xml',
}

/**
 * Browser: Öffnen läuft über das Dateifeld der Oberfläche, Speichern über
 * einen Download. Das Projekt liegt zusätzlich im Browserspeicher, deshalb
 * fragt der Browser beim Schließen nicht nach.
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
