/**
 * Speichern im Browser und als JSON-Datei. Beim Laden wird die Struktur
 * geprüft, damit eine beschädigte oder fremde Datei keinen Absturz auslöst.
 */
import { validiereCompliance } from '../compliance/speicher'
import { FORMAT_VERSION, type Block, type Projekt, type Prozess, type Sequenz } from './typen'

const PROJEKT_SCHLUESSEL = 'prozesslotse:projekt'
const EINSTELLUNGEN_SCHLUESSEL = 'prozesslotse:einstellungen'
const DOKUMENT_SCHLUESSEL = 'prozesslotse:dokument'
/** Freigegebene Versionen der Compliance-Doku liegen getrennt, damit nicht jeder Tastendruck sie neu schreibt. */
const VERSIONEN_SCHLUESSEL = 'prozesslotse:versionen'

export class Formatfehler extends Error {
  /** Feld, an dem die Prüfung scheiterte, z. B. „systeme.med_erp.seit“ (nur bei Compliance-Angaben gesetzt) */
  feld?: string
  /** Was an dem Feld nicht stimmt, z. B. „ist kein gültiges Datum“ */
  was?: string
}

/**
 * Nur der Compliance-Teil einer sonst gültigen Datei ist fehlerhaft. `ohneCompliance`
 * ist das geprüfte Projekt ohne diesen Teil; `detail` nennt Feld und Fehler für Meldungen.
 */
export class ComplianceFormatfehler extends Formatfehler {
  readonly detail: string
  readonly ohneCompliance: Projekt
  constructor(ursache: Formatfehler, ohneCompliance: Projekt) {
    super(ursache.message)
    this.feld = ursache.feld
    this.was = ursache.was
    this.detail = ursache.feld ? `${ursache.feld}: ${ursache.was}` : ursache.message.replace(/\.$/, '')
    this.ohneCompliance = ohneCompliance
  }
}

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
      x.zweige.forEach((z, i) => pruefeSequenz(z, `${wo}, Zweig ${i + 1}`))
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
  fordere(daten.formatVersion === FORMAT_VERSION, `Dateiformat ${String(daten.formatVersion)} wird nicht unterstützt.`)
  pruefeProzess(daten.ist, 'Ist-Prozess')
  if (daten.soll !== null) pruefeProzess(daten.soll, 'Soll-Prozess')
  fordere(Array.isArray(daten.massnahmen) && Array.isArray(daten.verworfen), 'Maßnahmenliste fehlt.')
  // optional; ältere Dateien haben keine Compliance-Angaben und laden unverändert
  if (daten.compliance !== undefined) {
    try {
      validiereCompliance(daten.compliance)
    } catch (e) {
      if (!(e instanceof Formatfehler)) throw e
      // Der Prozess ist gültig: Wer will, öffnet ihn ohne den fehlerhaften Teil
      const { compliance: _weg, ...ohne } = daten
      throw new ComplianceFormatfehler(e, ohne as unknown as Projekt)
    }
  }
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
    if (!text) return null
    const daten: unknown = JSON.parse(text)
    // Versionen der Compliance-Doku liegen unter eigenem Schlüssel und kommen vor der Prüfung wieder dazu
    const versionen = globalThis.localStorage?.getItem(VERSIONEN_SCHLUESSEL)
    if (versionen && istObj(daten) && istObj(daten.compliance)) daten.compliance.versionen = JSON.parse(versionen)
    return leseProjekt(daten)
  } catch {
    return null
  }
}

/** Zuletzt geschriebene Versionen (Referenz); nur eine neue Liste wird erneut geschrieben. */
let geschriebeneVersionen: unknown = undefined

export function speichereImBrowser(p: Projekt): boolean {
  try {
    const speicher = globalThis.localStorage
    if (!speicher) return true
    const versionen = p.compliance?.versionen ?? null
    if (versionen !== geschriebeneVersionen) {
      if (versionen && versionen.length > 0) speicher.setItem(VERSIONEN_SCHLUESSEL, JSON.stringify(versionen))
      else speicher.removeItem(VERSIONEN_SCHLUESSEL)
      geschriebeneVersionen = versionen
    }
    const ohneVersionen = p.compliance && p.compliance.versionen.length > 0 ? { ...p, compliance: { ...p.compliance, versionen: [] } } : p
    speicher.setItem(PROJEKT_SCHLUESSEL, JSON.stringify(ohneVersionen))
    return true
  } catch {
    return false
  }
}

/** „Daten im Browser löschen“: Projekt, Versionen, Dateiangaben und Einstellungen. */
export function loescheBrowserDaten(): void {
  for (const s of [PROJEKT_SCHLUESSEL, VERSIONEN_SCHLUESSEL, DOKUMENT_SCHLUESSEL, EINSTELLUNGEN_SCHLUESSEL]) {
    try {
      globalThis.localStorage?.removeItem(s)
    } catch {
      // nicht kritisch
    }
  }
  geschriebeneVersionen = undefined
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
    globalThis.localStorage?.removeItem(VERSIONEN_SCHLUESSEL)
    geschriebeneVersionen = undefined
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
