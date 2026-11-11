/**
 * Speichern im Browser und als JSON-Datei. Beim Laden wird die Struktur
 * geprüft, damit eine beschädigte oder fremde Datei keinen Absturz auslöst.
 */
import { FORMAT_VERSION, type Block, type Projekt, type Prozess, type Sequenz } from './typen'

const PROJEKT_SCHLUESSEL = 'prozesslotse:projekt'
const EINSTELLUNGEN_SCHLUESSEL = 'prozesslotse:einstellungen'
const DOKUMENT_SCHLUESSEL = 'prozesslotse:dokument'

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
      fordere(istVerweis(x.nachrichtAn) && istVerweis(x.nachrichtVon), `${wo}: Nachrichtenverweis ungültig.`)
      return
    case 'entscheidung':
      fordere(istText(x.frage) && Array.isArray(x.zweige) && (x.art === 'daten' || x.art === 'ereignis'), `${wo}: Entscheidung unvollständig.`)
      x.zweige.forEach((z, i) => {
        pruefeSequenz(z, `${wo}, Ausgang ${i + 1}`)
        const zweig = z as unknown as Obj
        fordere(istText(zweig.bezeichnung) && istZahl(zweig.anteil) && (zweig.ende === null || istText(zweig.ende)), `${wo}, Ausgang ${i + 1}: Angaben fehlen.`)
        fordere(zweig.zurueckZu === null || istText(zweig.zurueckZu), `${wo}, Ausgang ${i + 1}: Rücksprung ungültig.`)
        fordere(
          zweig.ereignis === null || (istObj(zweig.ereignis) && istZahl(zweig.ereignis.dauerMin) && (zweig.ereignis.art === 'zeit' || zweig.ereignis.art === 'nachricht')),
          `${wo}, Ausgang ${i + 1}: Ereignis ungültig.`,
        )
      })
      return
    case 'oder':
      fordere(istText(x.frage) && Array.isArray(x.zweige) && (x.standard === null || istText(x.standard)), `${wo}: ODER-Verzweigung unvollständig.`)
      x.zweige.forEach((z, i) => {
        pruefeSequenz(z, `${wo}, Weg ${i + 1}`)
        const zweig = z as unknown as Obj
        fordere(istText(zweig.bezeichnung) && istZahl(zweig.anteil), `${wo}, Weg ${i + 1}: Angaben fehlen.`)
      })
      return
    case 'parallel':
      fordere(Array.isArray(x.zweige), `${wo}: Zweige fehlen.`)
      fordere(x.art === 'alle', `${wo}: unbekannte Art von „Gleichzeitig“.`)
      x.zweige.forEach((z, i) => pruefeSequenz(z, `${wo}, Zweig ${i + 1}`))
      return
    case 'teilprozess':
      fordere(istText(x.name), `${wo}: Abschnitt ohne Namensfeld.`)
      pruefeSequenz(x.koerper, `${wo}, Abschnitt`)
      return
    case 'wiederholung':
      fordere(istText(x.frage) && istZahl(x.anteilWiederholung) && (x.modus === 'anteil' || x.modus === 'ruecksprung'), `${wo}: Wiederholung unvollständig.`)
      fordere(x.zweck === undefined || x.zweck === 'nacharbeit' || x.zweck === 'menge', `${wo}: Zweck der Wiederholung ungültig.`)
      pruefeSequenz(x.koerper, `${wo}, Körper`)
      return
    case 'warten':
      fordere(istText(x.name) && istZahl(x.dauerMin) && (x.art === 'zeit' || x.art === 'nachricht') && istVerweis(x.von), `${wo}: Warten unvollständig.`)
      return
    default:
      throw new Formatfehler(`${wo}: unbekannter Baustein „${String(x.typ)}“.`)
  }
}

const istVerweis = (x: unknown) => x === undefined || x === null || istText(x)

function pruefeProzess(x: unknown, wo: string): asserts x is Prozess {
  fordere(istObj(x), `${wo} fehlt.`)
  // externe Teilnehmer gibt es seit Format 3; ältere Stände haben keine
  x.teilnehmer ??= []
  fordere(Array.isArray(x.teilnehmer) && x.teilnehmer.every((t) => istObj(t) && istText(t.id) && istText(t.name)), `${wo}: externe Teilnehmer ungültig.`)
  fordere(x.formatVersion === FORMAT_VERSION, `${wo}: Dateiformat ${String(x.formatVersion)} wird nicht unterstützt.`)
  fordere(istText(x.name) && istText(x.ergebnis) && istZahl(x.vorgaengeProTag) && istZahl(x.arbeitsstundenProTag), `${wo}: Grunddaten fehlen.`)
  fordere(istObj(x.ausloeser) && istText(x.ausloeser.text) && istVerweis(x.ausloeser.von), `${wo}: Auslöser fehlt.`)
  fordere(Array.isArray(x.rollen) && x.rollen.every((r) => istObj(r) && istText(r.id) && istText(r.name) && istZahl(r.stundensatz) && istZahl(r.personen) && istZahl(r.verfuegbarProzent)), `${wo}: Rollen ungültig.`)
  fordere(Array.isArray(x.medien) && x.medien.every((m) => istObj(m) && istText(m.id) && istText(m.name) && istText(m.art)), `${wo}: Systeme ungültig.`)
  pruefeSequenz(x.ablauf, `${wo}, Ablauf`)
  entferneFremdeAbsender(x as unknown as Prozess)
}

/**
 * Ein Absender („von“) gehört nur zu Nachrichten; ein Nachrichtenfluss darf nicht an
 * einem Zeit- oder Bedingungsereignis enden. Ältere Stände konnten ihn nach einem
 * Wechsel der Art behalten; er wird beim Laden entfernt.
 */
function entferneFremdeAbsender(p: Prozess): void {
  if (p.ausloeser.art !== 'nachricht') p.ausloeser.von = null
  const sequenz = (schritte: Block[]) => {
    for (const b of schritte) {
      if (b.typ === 'warten' && b.art !== 'nachricht') b.von = null
      if (b.typ === 'entscheidung') {
        for (const z of b.zweige) {
          if (z.ereignis && z.ereignis.art !== 'nachricht') z.ereignis.von = null
          sequenz(z.schritte)
        }
      }
      if (b.typ === 'parallel' || b.typ === 'oder') for (const z of b.zweige) sequenz(z.schritte)
      if (b.typ === 'wiederholung' || b.typ === 'teilprozess') sequenz(b.koerper.schritte)
    }
  }
  sequenz(p.ablauf.schritte)
}

/**
 * Format 1 → 2: Entscheidungen bekommen eine Art und Ausgänge die Felder für
 * Rücksprung und Ereignis, Wiederholungen einen Modus. Ändert die Daten an Ort und Stelle.
 */
function migriereVon1(prozess: unknown): void {
  if (!istObj(prozess)) return
  prozess.formatVersion = 2
  const besuche = (x: unknown) => {
    if (Array.isArray(x)) return x.forEach(besuche)
    if (!istObj(x)) return
    if (x.typ === 'entscheidung') {
      x.art ??= 'daten'
      if (Array.isArray(x.zweige)) for (const z of x.zweige) if (istObj(z)) Object.assign(z, { zurueckZu: z.zurueckZu ?? null, ereignis: z.ereignis ?? null })
    }
    if (x.typ === 'wiederholung') x.modus ??= 'anteil'
    for (const wert of Object.values(x)) if (typeof wert === 'object' && wert !== null) besuche(wert)
  }
  besuche(prozess.ablauf)
}

/**
 * Format 3 → 4: „Gleichzeitig“ bekommt eine Art; bisher gab es nur „alle“
 * (weiter, wenn alle Zweige fertig sind). Sonst ändert sich nichts. Ändert die
 * Daten an Ort und Stelle.
 */
function migriereVon3(prozess: unknown): void {
  if (!istObj(prozess)) return
  prozess.formatVersion = 4
  const besuche = (x: unknown) => {
    if (Array.isArray(x)) return x.forEach(besuche)
    if (!istObj(x)) return
    if (x.typ === 'parallel') x.art ??= 'alle'
    for (const wert of Object.values(x)) if (typeof wert === 'object' && wert !== null) besuche(wert)
  }
  besuche(prozess.ablauf)
}

/** Prüft geladene Daten und gibt sie als Projekt zurück; wirft `Formatfehler`. Ältere Formate werden umgestellt. */
export function leseProjekt(daten: unknown): Projekt {
  fordere(istObj(daten), 'Die Datei enthält kein Prozesslotse-Projekt.')
  if (daten.formatVersion === 1) {
    migriereVon1(daten.ist)
    if (daten.soll !== null) migriereVon1(daten.soll)
    daten.formatVersion = 2
  }
  if (daten.formatVersion === 2) {
    // Format 3 bringt nur neue Bausteine und Felder; bestehende Daten bleiben gültig.
    for (const p of [daten.ist, daten.soll]) if (istObj(p) && p.formatVersion === 2) p.formatVersion = 3
    daten.formatVersion = 3
  }
  if (daten.formatVersion === 3) {
    for (const p of [daten.ist, daten.soll]) if (istObj(p) && p.formatVersion === 3) migriereVon3(p)
    daten.formatVersion = 4
  }
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

/** Zur Wiederherstellung: zu welcher Datei das Projekt im Browserspeicher gehört und ob es ungespeicherte Änderungen hat. */
export interface DokumentInfo {
  pfad: string | null
  name: string | null
  ungespeichert: boolean
}

export function ladeDokumentInfo(): DokumentInfo | null {
  try {
    const text = globalThis.localStorage?.getItem(DOKUMENT_SCHLUESSEL)
    const d: unknown = text ? JSON.parse(text) : null
    if (istObj(d) && (d.pfad === null || istText(d.pfad)) && (d.name === null || istText(d.name)) && typeof d.ungespeichert === 'boolean') {
      return { pfad: d.pfad, name: d.name, ungespeichert: d.ungespeichert }
    }
  } catch {
    // ohne Angaben weiter
  }
  return null
}

export function speichereDokumentInfo(d: DokumentInfo): void {
  try {
    globalThis.localStorage?.setItem(DOKUMENT_SCHLUESSEL, JSON.stringify(d))
  } catch {
    // nicht kritisch
  }
}

/** Vergisst das zwischengespeicherte Projekt, z. B. wenn beim Schließen „Nicht speichern“ gewählt wurde. */
export function vergissImBrowser(): void {
  try {
    globalThis.localStorage?.removeItem(PROJEKT_SCHLUESSEL)
    globalThis.localStorage?.removeItem(DOKUMENT_SCHLUESSEL)
  } catch {
    // nicht kritisch
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
