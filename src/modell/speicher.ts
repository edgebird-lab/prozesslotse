/**
 * Speichern im Browser und als JSON-Datei. Beim Laden wird die Struktur
 * geprüft, damit eine beschädigte oder fremde Datei keinen Absturz auslöst.
 */
import { FORMAT_VERSION, type Block, type Projekt, type Prozess, type Sequenz } from './typen'

const PROJEKT_SCHLUESSEL = 'prozesslotse:projekt'
const EINSTELLUNGEN_SCHLUESSEL = 'prozesslotse:einstellungen'

export class Formatfehler extends Error {}

type Obj = Record<string, unknown>

function istObj(x: unknown): x is Obj {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function fordere(bedingung: unknown, meldung: string): asserts bedingung {
  if (!bedingung) throw new Formatfehler(meldung)
}

const istText = (x: unknown): x is string => typeof x === 'string'
const istZahl = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

function pruefeSequenz(x: unknown, wo: string): asserts x is Sequenz {
  fordere(istObj(x) && istText(x.id) && Array.isArray(x.schritte), `${wo}: Schrittliste fehlt.`)
  x.schritte.forEach((b, i) => pruefeBlock(b, `${wo}, Schritt ${i + 1}`))
}

function pruefeBlock(x: unknown, wo: string): asserts x is Block {
  fordere(istObj(x) && istText(x.id) && istText(x.typ), `${wo}: kein gültiger Baustein.`)
  switch (x.typ) {
    case 'aufgabe':
      fordere(istText(x.name) && istZahl(x.bearbeitungMin) && istZahl(x.liegezeitMin), `${wo}: Aufgabe unvollständig.`)
      fordere(x.art === 'normal' || x.art === 'pruefung' || x.art === 'freigabe', `${wo}: unbekannte Aufgabenart.`)
      fordere(istZahl(x.freigabeQuote), `${wo}: Freigabequote fehlt.`)
      fordere(x.uebertragung === null || (istObj(x.uebertragung) && istZahl(x.uebertragung.minuten)), `${wo}: Übertragung ungültig.`)
      return
    case 'entscheidung':
      fordere(istText(x.frage) && Array.isArray(x.zweige), `${wo}: Entscheidung unvollständig.`)
      x.zweige.forEach((z, i) => {
        pruefeSequenz(z, `${wo}, Ausgang ${i + 1}`)
        const zweig = z as unknown as Obj
        fordere(istText(zweig.bezeichnung) && istZahl(zweig.anteil) && (zweig.ende === null || istText(zweig.ende)), `${wo}, Ausgang ${i + 1}: Angaben fehlen.`)
      })
      return
    case 'parallel':
      fordere(Array.isArray(x.zweige), `${wo}: Zweige fehlen.`)
      x.zweige.forEach((z, i) => pruefeSequenz(z, `${wo}, Zweig ${i + 1}`))
      return
    case 'wiederholung':
      fordere(istText(x.frage) && istZahl(x.anteilWiederholung), `${wo}: Wiederholung unvollständig.`)
      pruefeSequenz(x.koerper, `${wo}, Körper`)
      return
    case 'warten':
      fordere(istText(x.name) && istZahl(x.dauerMin) && (x.art === 'zeit' || x.art === 'nachricht'), `${wo}: Warten unvollständig.`)
      return
    default:
      throw new Formatfehler(`${wo}: unbekannter Baustein „${String(x.typ)}“.`)
  }
}

function pruefeProzess(x: unknown, wo: string): asserts x is Prozess {
  fordere(istObj(x), `${wo} fehlt.`)
  fordere(x.formatVersion === FORMAT_VERSION, `${wo}: Dateiformat ${String(x.formatVersion)} wird nicht unterstützt.`)
  fordere(istText(x.name) && istText(x.ergebnis) && istZahl(x.vorgaengeProTag) && istZahl(x.arbeitsstundenProTag), `${wo}: Grunddaten fehlen.`)
  fordere(istObj(x.ausloeser) && istText(x.ausloeser.text), `${wo}: Auslöser fehlt.`)
  fordere(Array.isArray(x.rollen) && x.rollen.every((r) => istObj(r) && istText(r.id) && istText(r.name) && istZahl(r.stundensatz) && istZahl(r.personen) && istZahl(r.verfuegbarProzent)), `${wo}: Rollen ungültig.`)
  fordere(Array.isArray(x.medien) && x.medien.every((m) => istObj(m) && istText(m.id) && istText(m.name) && istText(m.art)), `${wo}: Systeme ungültig.`)
  pruefeSequenz(x.ablauf, `${wo}, Ablauf`)
}

/** Prüft geladene Daten und gibt sie als Projekt zurück; wirft `Formatfehler`. */
export function leseProjekt(daten: unknown): Projekt {
  fordere(istObj(daten), 'Die Datei enthält kein Prozesslotse-Projekt.')
  fordere(daten.formatVersion === FORMAT_VERSION, `Dateiformat ${String(daten.formatVersion)} wird nicht unterstützt.`)
  pruefeProzess(daten.ist, 'Ist-Prozess')
  if (daten.soll !== null) pruefeProzess(daten.soll, 'Soll-Prozess')
  fordere(Array.isArray(daten.massnahmen) && Array.isArray(daten.verworfen), 'Maßnahmenliste fehlt.')
  return daten as unknown as Projekt
}

export function leseProjektText(text: string): Projekt {
  let daten: unknown
  try {
    daten = JSON.parse(text)
  } catch {
    throw new Formatfehler('Die Datei ist kein gültiges JSON.')
  }
  return leseProjekt(daten)
}

export function alsJson(p: Projekt): string {
  return JSON.stringify(p, null, 2)
}

// Browser-Speicher: kann in privaten Fenstern fehlen oder blockiert sein.

export function ladeAusBrowser(): Projekt | null {
  try {
    const text = globalThis.localStorage?.getItem(PROJEKT_SCHLUESSEL)
    return text ? leseProjektText(text) : null
  } catch {
    return null
  }
}

export function speichereImBrowser(p: Projekt): boolean {
  try {
    globalThis.localStorage?.setItem(PROJEKT_SCHLUESSEL, JSON.stringify(p))
    return true
  } catch {
    return false
  }
}

export interface Einstellungen {
  lernmodus: boolean
}

export function ladeEinstellungen(): Einstellungen {
  try {
    const text = globalThis.localStorage?.getItem(EINSTELLUNGEN_SCHLUESSEL)
    const daten: unknown = text ? JSON.parse(text) : null
    if (istObj(daten) && typeof daten.lernmodus === 'boolean') return { lernmodus: daten.lernmodus }
  } catch {
    // Standardwerte verwenden
  }
  return { lernmodus: true }
}

export function speichereEinstellungen(e: Einstellungen): void {
  try {
    globalThis.localStorage?.setItem(EINSTELLUNGEN_SCHLUESSEL, JSON.stringify(e))
  } catch {
    // nicht kritisch
  }
}
