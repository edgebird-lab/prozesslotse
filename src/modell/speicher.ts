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
/** Merkmal der gespeicherten Versionen; klein, damit jedes Speichern es billig mit dem tatsächlichen Stand vergleichen kann. */
const MERKMAL_SCHLUESSEL = 'prozesslotse:versionen-merkmal'
/** Feld im gespeicherten Projekt: Merkmal der Versionen, die zu ihm gehören ('' = keine). Gehört nie in eine Datei. */
const MERKMAL_FELD = 'versionenMerkmal'

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

/** Unterbrechungen eines Schritts (seit Format 4, optional): je ein Ausnahmeweg mit Art, Anteil, Frist und „Danach“. */
function pruefeUnterbrechungen(x: Obj, wo: string): void {
  if (x.unterbrechungen === undefined) return
  fordere(Array.isArray(x.unterbrechungen), `${wo}: Unterbrechungen ungültig.`)
  x.unterbrechungen.forEach((u, i) => {
    const hier = `${wo}, Unterbrechung ${i + 1}`
    pruefeSequenz(u, hier)
    const v = u as unknown as Obj
    fordere(istText(v.bezeichnung) && (v.art === 'zeit' || v.art === 'nachricht') && typeof v.unterbrechend === 'boolean' && istZahl(v.anteil) && istZahl(v.fristMin), `${hier}: Angaben fehlen.`)
    fordere(v.zeitpunkt === 'vorher' || v.zeitpunkt === 'waehrend' || v.zeitpunkt === 'unbekannt', `${hier}: unbekannter Zeitpunkt.`)
    fordere((v.von === null || istText(v.von)) && (v.ende === null || istText(v.ende)) && (v.zurueckZu === null || istText(v.zurueckZu)), `${hier}: Verweis ungültig.`)
  })
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
      pruefeUnterbrechungen(x, wo)
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
      fordere(x.art === 'alle' || x.art === 'erster' || x.art === 'nacheinander', `${wo}: unbekannte Art von „Gleichzeitig“.`)
      x.zweige.forEach((z, i) => pruefeSequenz(z, `${wo}, Zweig ${i + 1}`))
      return
    case 'teilprozess':
      fordere(istText(x.name), `${wo}: Abschnitt ohne Namensfeld.`)
      pruefeSequenz(x.koerper, `${wo}, Abschnitt`)
      pruefeUnterbrechungen(x, wo)
      return
    case 'mehrfach':
      fordere(istText(x.name) && istZahl(x.anzahl) && istZahl(x.liegezeitMin), `${wo}: „Für jedes Stück“ unvollständig.`)
      fordere(x.streuung === 'fest' || x.streuung === 'schwankt', `${wo}: unbekannte Streuung der Anzahl.`)
      fordere(x.ausfuehrung === 'nacheinander' || x.ausfuehrung === 'gleichzeitig', `${wo}: unbekannte Ausführung von „Für jedes Stück“.`)
      pruefeSequenz(x.koerper, `${wo}, je Stück`)
      pruefeUnterbrechungen(x, wo)
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
 * Wechsel der Art behalten; er wird beim Laden entfernt, auch bei Unterbrechungen.
 */
function entferneFremdeAbsender(p: Prozess): void {
  if (p.ausloeser.art !== 'nachricht') p.ausloeser.von = null
  const sequenz = (schritte: Block[]) => {
    for (const b of schritte) {
      if (b.typ === 'aufgabe' || b.typ === 'teilprozess' || b.typ === 'mehrfach') {
        for (const u of b.unterbrechungen ?? []) {
          if (u.art !== 'nachricht') u.von = null
          sequenz(u.schritte)
        }
      }
      if (b.typ === 'warten' && b.art !== 'nachricht') b.von = null
      if (b.typ === 'entscheidung') {
        for (const z of b.zweige) {
          if (z.ereignis && z.ereignis.art !== 'nachricht') z.ereignis.von = null
          sequenz(z.schritte)
        }
      }
      if (b.typ === 'parallel' || b.typ === 'oder') for (const z of b.zweige) sequenz(z.schritte)
      if (b.typ === 'wiederholung' || b.typ === 'teilprozess' || b.typ === 'mehrfach') sequenz(b.koerper.schritte)
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
  // gehört nur in den Browser-Speicher; eine andere Programmfassung kann es mit in eine Datei geschrieben haben
  delete daten[MERKMAL_FELD]
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

// ---------- Browser-Speicher ----------
// Kann in privaten Fenstern fehlen oder blockiert sein. Er gehört allen Tabs derselben Herkunft
// und im Windows-Programm allen installierten Fassungen (gemeinsamer WebView2-Datenordner).
// Projekt und Versionen liegen unter getrennten Schlüsseln; ein Merkmal im Projekt bindet sie
// aneinander, damit nie Versionen eines anderen Stands am Projekt hängen.

function browserSpeicher(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** Kurzer Streuwert (cyrb53) über einen Text. */
function streuwert(s: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

const merkmale = new WeakMap<object, string>()

/** Merkmal einer Versionsliste (Anzahl und Streuwert des Inhalts); Listen sind unveränderlich, also je Liste einmal berechnet. */
function merkmalVon(versionen: readonly unknown[]): string {
  let m = merkmale.get(versionen)
  if (m === undefined) {
    m = `${versionen.length}-${streuwert(JSON.stringify(versionen))}`
    merkmale.set(versionen, m)
  }
  return m
}

/**
 * Ließ sich der gespeicherte Stand nicht vollständig übernehmen, bleiben seine Rohdaten unverändert,
 * bis der Nutzer entscheidet (`verwirfBrowserRohdaten`, `loescheBrowserDaten`); bis dahin schreibt
 * dieser Tab nichts in den Browser-Speicher.
 */
let rohdatenGeschuetzt = false

/** Was beim Start aus dem Browser-Speicher wiederhergestellt wird. */
export interface BrowserStand {
  /** Projekt; bei beschädigten Compliance-Angaben nur der Prozess. null: nichts Verwendbares gespeichert */
  projekt: Projekt | null
  /** Was nicht übernommen werden konnte; null, wenn alles passt */
  problem: string | null
  /** Die Rohdaten bleiben unverändert im Speicher, bis der Nutzer entscheidet */
  geschuetzt: boolean
}

/** Gespeicherte Versionen mit dem Merkmal, unter dem sie geschrieben wurden; null bei unlesbarem oder altem Inhalt. */
function leseVersionen(text: string): { merkmal: string; versionen: unknown[] } | null {
  try {
    const d: unknown = JSON.parse(text)
    if (istObj(d) && istText(d.merkmal) && Array.isArray(d.versionen)) return { merkmal: d.merkmal, versionen: d.versionen }
  } catch {
    // unlesbar: gehört zu keinem Projekt
  }
  return null
}

/**
 * Stellt den Stand aus dem Browser-Speicher wieder her. Versionen kommen nur dazu, wenn ihr Merkmal
 * zu dem im Projekt passt. Was nicht passt oder sich nicht laden lässt, wird nicht verworfen: Die
 * Rohdaten bleiben stehen (`geschuetzt`), und `problem` sagt, was fehlt.
 */
export function ladeBrowserStand(): BrowserStand {
  const leer: BrowserStand = { projekt: null, problem: null, geschuetzt: false }
  let projektText: string | null
  let versionenText: string | null
  try {
    const speicher = browserSpeicher()
    projektText = speicher?.getItem(PROJEKT_SCHLUESSEL) ?? null
    versionenText = speicher?.getItem(VERSIONEN_SCHLUESSEL) ?? null
  } catch {
    return leer
  }
  const schuetze = (projekt: Projekt | null, problem: string): BrowserStand => {
    rohdatenGeschuetzt = true
    return { projekt, problem, geschuetzt: true }
  }
  if (!projektText) return versionenText ? schuetze(null, 'Im Browser-Speicher lagen freigegebene Versionen ohne das zugehörige Projekt.') : leer
  let daten: unknown
  try {
    daten = JSON.parse(projektText)
  } catch {
    return schuetze(null, 'Der Stand im Browser-Speicher ließ sich nicht laden: Er ist kein gültiges JSON.')
  }
  // Ohne Merkmal stammt das Projekt aus einer anderen Fassung des Programms; seine Versionen stehen dann, falls es welche hat, im Projekt selbst
  const erwartet = istObj(daten) && istText(daten[MERKMAL_FELD]) ? daten[MERKMAL_FELD] : ''
  const gespeichert = versionenText === null ? null : leseVersionen(versionenText)
  let problem: string | null = null
  let geschuetzt = false
  if (erwartet) {
    if (gespeichert?.merkmal === erwartet && istObj(daten) && istObj(daten.compliance)) daten.compliance.versionen = gespeichert.versionen
    else {
      problem = 'Die freigegebenen Versionen zu diesem Stand fehlen im Browser-Speicher oder passen nicht dazu. Geöffnet ist der Stand ohne Versionen; öffne am besten die zuletzt gespeicherte Projektdatei.'
      geschuetzt = versionenText !== null
    }
  } else if (versionenText !== null) {
    problem = 'Im Browser-Speicher lagen außerdem freigegebene Versionen, die nicht zu diesem Stand gehören.'
    geschuetzt = true
  }
  try {
    const projekt = leseProjekt(daten)
    if (geschuetzt) rohdatenGeschuetzt = true
    return { projekt, problem, geschuetzt }
  } catch (e) {
    if (e instanceof ComplianceFormatfehler) return schuetze(e.ohneCompliance, `Die Compliance-Angaben im Browser-Speicher sind beschädigt (${e.detail}). Geöffnet ist nur der Prozess.`)
    return schuetze(null, `Der Stand im Browser-Speicher ließ sich nicht laden: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/** Wiederhergestelltes Projekt oder null; was nicht übernommen werden konnte, sagt `ladeBrowserStand`. */
export function ladeAusBrowser(): Projekt | null {
  return ladeBrowserStand().projekt
}

/**
 * Schreibt das Projekt in den Browser-Speicher; false, wenn es nicht hineinpasst. Die Versionen
 * werden nur geschrieben, wenn das gespeicherte Merkmal nicht zu ihnen passt. Verglichen wird mit
 * dem tatsächlich gespeicherten Merkmal, nicht mit dem zuletzt selbst geschriebenen: Ein anderer
 * Tab kann die Versionen inzwischen ersetzt oder entfernt haben. Passen die Versionen nicht hinein,
 * bleibt das vorige Paar aus Projekt und Versionen unverändert stehen.
 */
export function speichereImBrowser(p: Projekt): boolean {
  if (rohdatenGeschuetzt) return true
  const speicher = browserSpeicher()
  if (!speicher) return true
  try {
    const versionen = p.compliance?.versionen ?? []
    const merkmal = versionen.length > 0 ? merkmalVon(versionen) : ''
    if ((speicher.getItem(MERKMAL_SCHLUESSEL) ?? '') !== merkmal) {
      // Während des Schreibens gilt kein Merkmal; erst danach verweist das Projekt auf die neuen Versionen
      speicher.removeItem(MERKMAL_SCHLUESSEL)
      if (merkmal) {
        speicher.setItem(VERSIONEN_SCHLUESSEL, `{"merkmal":"${merkmal}","versionen":${JSON.stringify(versionen)}}`)
        speicher.setItem(MERKMAL_SCHLUESSEL, merkmal)
      } else speicher.removeItem(VERSIONEN_SCHLUESSEL)
    }
    const ohneVersionen = p.compliance && versionen.length > 0 ? { ...p, compliance: { ...p.compliance, versionen: [] } } : p
    speicher.setItem(PROJEKT_SCHLUESSEL, JSON.stringify({ ...ohneVersionen, [MERKMAL_FELD]: merkmal }))
    return true
  } catch {
    return false
  }
}

function entferne(schluessel: string[]): void {
  for (const s of schluessel) {
    try {
      browserSpeicher()?.removeItem(s)
    } catch {
      // nicht kritisch
    }
  }
}

/** „Daten im Browser löschen“: Projekt, Versionen, Dateiangaben und Einstellungen, auch nicht geladene Rohdaten. */
export function loescheBrowserDaten(): void {
  entferne([PROJEKT_SCHLUESSEL, VERSIONEN_SCHLUESSEL, MERKMAL_SCHLUESSEL, DOKUMENT_SCHLUESSEL, EINSTELLUNGEN_SCHLUESSEL])
  rohdatenGeschuetzt = false
}

/** Rohdaten, die sich nicht laden ließen, als JSON zum Herunterladen; null, wenn keine da sind. */
export function browserRohdaten(): string | null {
  try {
    const speicher = browserSpeicher()
    const projekt = speicher?.getItem(PROJEKT_SCHLUESSEL) ?? null
    const versionen = speicher?.getItem(VERSIONEN_SCHLUESSEL) ?? null
    if (projekt === null && versionen === null) return null
    const wert = (t: string | null): unknown => {
      try {
        return t === null ? null : JSON.parse(t)
      } catch {
        return t
      }
    }
    const hinweis = 'Rohdaten aus dem Browser-Speicher des Prozesslotsen; nicht geladen, weil sie fehlerhaft sind oder nicht zusammenpassen.'
    return JSON.stringify({ hinweis, projekt: wert(projekt), versionen: wert(versionen) }, null, 2)
  } catch {
    return null
  }
}

/** Der Nutzer hat entschieden: nicht geladene Rohdaten verwerfen; danach wird der aktuelle Stand wieder gesichert. */
export function verwirfBrowserRohdaten(): void {
  entferne([PROJEKT_SCHLUESSEL, VERSIONEN_SCHLUESSEL, MERKMAL_SCHLUESSEL, DOKUMENT_SCHLUESSEL])
  rohdatenGeschuetzt = false
}

/** Zur Wiederherstellung: zu welcher Datei das Projekt im Browserspeicher gehört und ob es ungespeicherte Änderungen hat. */
export interface DokumentInfo {
  pfad: string | null
  name: string | null
  ungespeichert: boolean
  /** Der Stand im Browser ist älter als der zuletzt bearbeitete, weil er nicht mehr hineinpasste. */
  veraltet?: boolean
}

export function ladeDokumentInfo(): DokumentInfo | null {
  try {
    const text = browserSpeicher()?.getItem(DOKUMENT_SCHLUESSEL)
    const d: unknown = text ? JSON.parse(text) : null
    if (istObj(d) && (d.pfad === null || istText(d.pfad)) && (d.name === null || istText(d.name)) && typeof d.ungespeichert === 'boolean') {
      return { pfad: d.pfad, name: d.name, ungespeichert: d.ungespeichert, ...(d.veraltet === true ? { veraltet: true } : {}) }
    }
  } catch {
    // ohne Angaben weiter
  }
  return null
}

export function speichereDokumentInfo(d: DokumentInfo): void {
  if (rohdatenGeschuetzt) return
  try {
    browserSpeicher()?.setItem(DOKUMENT_SCHLUESSEL, JSON.stringify(d))
  } catch {
    // Passt nicht einmal das: lieber ohne Angaben als mit denen eines anderen Stands
    entferne([DOKUMENT_SCHLUESSEL])
  }
}

/** Vergisst das zwischengespeicherte Projekt, z. B. wenn beim Schließen „Nicht speichern“ gewählt wurde. Nicht geladene Rohdaten bleiben. */
export function vergissImBrowser(): void {
  if (rohdatenGeschuetzt) return
  entferne([PROJEKT_SCHLUESSEL, DOKUMENT_SCHLUESSEL, VERSIONEN_SCHLUESSEL, MERKMAL_SCHLUESSEL])
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
