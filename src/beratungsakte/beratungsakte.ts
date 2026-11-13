// Kopie der Bibliothek beratungsakte 1.0.1 (Format Beratungsakte v1).
// Nicht in dieser App ändern: Änderungen gehören in die Bibliothek und werden neu eingebunden.
/**
 * Beratungsakte v1: erzeugen, lesen und prüfen.
 *
 * Ohne Abhängigkeiten, ohne Zugriff auf Dateien oder Browser. Die Prüfung liest
 * das JSON-Schema (`schema.ts`, Kopie von `schema/beratungsakte-v1.schema.json`)
 * selbst aus; sie kennt genau die Schlüsselwörter, die das Schema verwendet.
 * Darüber hinaus prüft sie, was ein Schema nicht ausdrücken kann: eindeutige
 * Kennungen und Bezüge von Maßnahmen auf vorhandene Befunde.
 */
import { SCHEMA } from './schema.ts'

export const BIBLIOTHEK_VERSION = '1.0.1'
export const FORMAT = 'beratungsakte'
export const FORMAT_VERSION = '1.0'
const HAUPTVERSION = 1
const UNTERVERSION = 0

export type Schwere = 'kritisch' | 'hoch' | 'mittel' | 'niedrig' | 'hinweis'
export type Prioritaet = 'hoch' | 'mittel' | 'niedrig'
export type Bewertung = 'gut' | 'mittel' | 'schlecht' | 'neutral'
/** Je App ein Namensraum: Schlüssel = App-Kennung, Inhalt frei. */
export type Erweiterungen = Record<string, Record<string, unknown>>

export interface Kennzahl {
  kennung?: string
  name: string
  wert: number | string
  einheit: string
  bewertung?: Bewertung
  erweiterungen?: Erweiterungen
}

export interface Befund {
  kennung: string
  schwere: Schwere
  text: string
  fundstelle: string
  erweiterungen?: Erweiterungen
}

export interface Massnahme {
  kennung: string
  text: string
  prioritaet: Prioritaet
  aufwand: string
  /** Kennungen der Befunde, auf die die Maßnahme antwortet (darf leer sein). */
  befunde: string[]
  /** Datum JJJJ-MM-TT, z. B. für Pflichten mit Frist. */
  frist?: string
  erweiterungen?: Erweiterungen
}

export interface Anhang {
  name: string
  /** Relativer Pfad oder URI; die Datei selbst steckt nicht in der Akte. */
  verweis: string
  medientyp?: string
}

export interface Beratungsakte {
  format: typeof FORMAT
  formatVersion: string
  erzeugtVon: { app: string; name: string; version: string }
  erzeugtAm: string
  mandant: { name: string; kennung?: string }
  analyse: { art: string; titel: string; stand: string; quelldatei?: string }
  kennzahlen: Kennzahl[]
  befunde: Befund[]
  massnahmen: Massnahme[]
  anhaenge?: Anhang[]
  erweiterungen?: Erweiterungen
}

export interface Meldung {
  /** Maschinenlesbare Art, z. B. `schema`, `neuere-hauptversion`, `doppelte-kennung`. */
  code: string
  /** Ort in der Datei, z. B. `befunde[2].schwere`; leer für die ganze Datei. */
  pfad: string
  text: string
}

export interface Pruefergebnis {
  gueltig: boolean
  fehler: Meldung[]
  hinweise: Meldung[]
  /** Formatversion aus der Datei, falls lesbar. */
  formatVersion?: string
}

export type Leseergebnis =
  | { ok: true; akte: Beratungsakte; hinweise: Meldung[] }
  | { ok: false; fehler: Meldung[]; hinweise: Meldung[] }

// ---------------------------------------------------------------- erzeugen

export interface AkteEingabe {
  app: { kennung: string; name: string; version: string }
  mandant: { name: string; kennung?: string }
  analyse: { art: string; titel: string; stand: string; quelldatei?: string }
  kennzahlen?: Kennzahl[]
  befunde?: Befund[]
  massnahmen?: Massnahme[]
  anhaenge?: Anhang[]
  erweiterungen?: Erweiterungen
  /** Zeitpunkt der Erzeugung; ohne Angabe jetzt. */
  erzeugtAm?: Date
}

/**
 * Baut eine Beratungsakte und prüft sie. Wirft einen Fehler mit allen
 * Befunden der Prüfung, wenn die Eingabe kein gültiges Dokument ergibt:
 * Eine App soll nie eine ungültige Akte speichern.
 */
export function erzeugeBeratungsakte(eingabe: AkteEingabe): Beratungsakte {
  const akte: Beratungsakte = {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    erzeugtVon: { app: eingabe.app.kennung, name: eingabe.app.name, version: eingabe.app.version },
    erzeugtAm: zeitpunktMitVersatz(eingabe.erzeugtAm ?? new Date()),
    mandant: ohneLeere({ name: eingabe.mandant.name.trim(), kennung: leerZuUndefiniert(eingabe.mandant.kennung) }),
    analyse: ohneLeere({ ...eingabe.analyse, quelldatei: leerZuUndefiniert(eingabe.analyse.quelldatei) }),
    kennzahlen: eingabe.kennzahlen ?? [],
    befunde: eingabe.befunde ?? [],
    massnahmen: eingabe.massnahmen ?? [],
  }
  if (eingabe.anhaenge && eingabe.anhaenge.length > 0) akte.anhaenge = eingabe.anhaenge
  if (eingabe.erweiterungen && Object.keys(eingabe.erweiterungen).length > 0) akte.erweiterungen = eingabe.erweiterungen

  for (const [i, k] of akte.kennzahlen.entries()) {
    if (typeof k.wert === 'number' && !Number.isFinite(k.wert)) {
      throw new Error(`Beratungsakte ungültig: kennzahlen[${i}].wert ist keine endliche Zahl (${k.wert}).`)
    }
  }
  const ergebnis = pruefeBeratungsakte(akte)
  if (!ergebnis.gueltig) {
    throw new Error('Beratungsakte ungültig:\n' + ergebnis.fehler.map(meldungAlsText).join('\n'))
  }
  return akte
}

/** JSON mit zwei Leerzeichen Einzug und Zeilenende; als UTF-8 ohne BOM speichern. */
export function serialisiereBeratungsakte(akte: Beratungsakte): string {
  return JSON.stringify(akte, null, 2) + '\n'
}

/** `<Mandant>-<App>-<Datum>.beratungsakte.json`, Datum aus `erzeugtAm` (Ortszeit des Erzeugers). */
export function dateinameBeratungsakte(akte: Pick<Beratungsakte, 'mandant' | 'erzeugtVon' | 'erzeugtAm'>): string {
  return `${dateinamenTeil(akte.mandant.name)}-${akte.erzeugtVon.app}-${akte.erzeugtAm.slice(0, 10)}.beratungsakte.json`
}

/** Macht aus einem Namen einen sicheren Teil eines Windows-Dateinamens; Umlaute bleiben. */
export function dateinamenTeil(name: string): string {
  const teil = name
    .normalize('NFC')
    .replace(/\s+/g, '-')
    .replace(/[<>:"/\\|?*]/g, '')
    .split('')
    .filter((z) => z.charCodeAt(0) > 0x1f && z.charCodeAt(0) !== 0x7f) // Steuerzeichen, ohne Regex (Lint no-control-regex)
    .join('')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 60)
    .replace(/[-.]+$/g, '')
  return teil === '' ? 'Mandant' : teil
}

/** ISO 8601 mit Versatz der Ortszeit, z. B. `2026-11-13T09:30:00+01:00`. */
export function zeitpunktMitVersatz(d: Date): string {
  const zwei = (n: number) => String(n).padStart(2, '0')
  const versatz = -d.getTimezoneOffset()
  const vz = versatz >= 0 ? '+' : '-'
  const v = Math.abs(versatz)
  return (
    `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}` +
    `T${zwei(d.getHours())}:${zwei(d.getMinutes())}:${zwei(d.getSeconds())}` +
    `${vz}${zwei(Math.floor(v / 60))}:${zwei(v % 60)}`
  )
}

// ---------------------------------------------------------------- lesen

/** Liest den Text einer `.beratungsakte.json` (BOM wird überlesen) und prüft ihn. */
export function leseBeratungsakte(text: string): Leseergebnis {
  let daten: unknown
  try {
    daten = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
  } catch (e) {
    const grund = e instanceof Error ? e.message : String(e)
    return { ok: false, fehler: [{ code: 'json', pfad: '', text: `Die Datei ist kein gültiges JSON (${grund}).` }], hinweise: [] }
  }
  const ergebnis = pruefeBeratungsakte(daten)
  if (!ergebnis.gueltig) return { ok: false, fehler: ergebnis.fehler, hinweise: ergebnis.hinweise }
  return { ok: true, akte: daten as Beratungsakte, hinweise: ergebnis.hinweise }
}

// ---------------------------------------------------------------- prüfen

/**
 * Prüft beliebige Daten gegen Beratungsakte v1.
 *
 * - Fremde Formatkennung oder neuere Hauptversion (2.0 …): ungültig, mit
 *   verständlicher Meldung; der Rest wird dann nicht geprüft.
 * - Neuere Unterversion (1.1 …): gültig, wenn alles Bekannte stimmt;
 *   unbekannte Felder werden als Hinweis gemeldet und ignoriert.
 * - Inhalte in `erweiterungen` sind frei und werden nicht bewertet.
 */
export function pruefeBeratungsakte(daten: unknown): Pruefergebnis {
  const fehler: Meldung[] = []
  const hinweise: Meldung[] = []
  const fertig = (formatVersion?: string): Pruefergebnis => ({ gueltig: fehler.length === 0, fehler, hinweise, formatVersion })

  if (!istObjekt(daten)) {
    fehler.push({ code: 'kein-objekt', pfad: '', text: 'Die Datei enthält kein JSON-Objekt und ist keine Beratungsakte.' })
    return fertig()
  }
  if (daten.format !== FORMAT) {
    const gefunden = daten.format === undefined ? 'fehlt' : `lautet ${JSON.stringify(daten.format)}`
    fehler.push({ code: 'falsches-format', pfad: 'format', text: `Keine Beratungsakte: Die Formatkennung ${gefunden}, erwartet "${FORMAT}".` })
    return fertig()
  }
  const version = daten.formatVersion
  const teile = typeof version === 'string' ? /^(\d+)\.(\d+)$/.exec(version) : null
  if (!teile) {
    fehler.push({ code: 'version-unlesbar', pfad: 'formatVersion', text: `Die Formatversion ${JSON.stringify(version ?? null)} ist unlesbar; erwartet z. B. "${FORMAT_VERSION}".` })
    return fertig()
  }
  const haupt = Number(teile[1])
  const unter = Number(teile[2])
  if (haupt > HAUPTVERSION) {
    fehler.push({
      code: 'neuere-hauptversion',
      pfad: 'formatVersion',
      text: `Die Datei hat Formatversion ${version}. Dieses Programm liest Beratungsakten bis Version ${HAUPTVERSION}.x und kann sie nicht sicher lesen. Bitte das Programm aktualisieren.`,
    })
    return fertig(version as string)
  }
  if (haupt < HAUPTVERSION) {
    fehler.push({ code: 'aeltere-hauptversion', pfad: 'formatVersion', text: `Die Formatversion ${version} gibt es nicht; die erste Version ist ${FORMAT_VERSION}.` })
    return fertig(version as string)
  }
  const nachsichtig = unter > UNTERVERSION
  if (nachsichtig) {
    hinweise.push({
      code: 'neuere-unterversion',
      pfad: 'formatVersion',
      text: `Die Datei hat Formatversion ${version}, dieses Programm kennt ${FORMAT_VERSION}. Sie ist lesbar; Felder, die erst später dazugekommen sind, werden ignoriert.`,
    })
  }

  pruefeGegenSchema(daten, SCHEMA as unknown as Schema, '', { fehler, hinweise, nachsichtig })
  if (fehler.length === 0) pruefeBezuege(daten as unknown as Beratungsakte, fehler)
  return fertig(version as string)
}

export function meldungAlsText(m: Meldung): string {
  return m.pfad ? `${m.pfad}: ${m.text}` : m.text
}

function pruefeBezuege(akte: Beratungsakte, fehler: Meldung[]): void {
  const eindeutig = (liste: { kennung?: string }[], name: string) => {
    const gesehen = new Set<string>()
    liste.forEach((e, i) => {
      if (e.kennung === undefined) return
      if (gesehen.has(e.kennung)) {
        fehler.push({ code: 'doppelte-kennung', pfad: `${name}[${i}].kennung`, text: `Die Kennung "${e.kennung}" kommt in ${name} mehrfach vor.` })
      }
      gesehen.add(e.kennung)
    })
    return gesehen
  }
  eindeutig(akte.kennzahlen, 'kennzahlen')
  const befunde = eindeutig(akte.befunde, 'befunde')
  eindeutig(akte.massnahmen, 'massnahmen')
  akte.massnahmen.forEach((m, i) => {
    m.befunde.forEach((b, j) => {
      if (!befunde.has(b)) {
        fehler.push({ code: 'unbekannter-befund', pfad: `massnahmen[${i}].befunde[${j}]`, text: `Die Maßnahme "${m.kennung}" verweist auf den Befund "${b}", den es in der Akte nicht gibt.` })
      }
    })
  })
}

// ------------------------------------------- Schema-Auswertung (Teilmenge)

/** Die Schlüsselwörter aus JSON Schema 2020-12, die das Schema verwendet. */
export const BEKANNTE_SCHLUESSELWOERTER = [
  '$schema', '$id', '$ref', '$defs', 'title', 'description',
  'type', 'const', 'enum', 'required', 'properties', 'additionalProperties', 'propertyNames',
  'items', 'minLength', 'pattern', 'format',
] as const

interface Schema {
  $ref?: string
  type?: string | string[]
  const?: unknown
  enum?: unknown[]
  required?: string[]
  properties?: Record<string, Schema>
  additionalProperties?: boolean | Schema
  propertyNames?: Schema
  items?: Schema
  minLength?: number
  pattern?: string
  format?: string
  $defs?: Record<string, Schema>
}

interface Kontext {
  fehler: Meldung[]
  hinweise: Meldung[]
  /** Neuere Unterversion: unbekannte Felder nur melden, nicht ablehnen. */
  nachsichtig: boolean
}

const MUSTER = new Map<string, RegExp>()
function muster(quelle: string): RegExp {
  let r = MUSTER.get(quelle)
  if (!r) {
    r = new RegExp(quelle, 'u')
    MUSTER.set(quelle, r)
  }
  return r
}

function aufloesen(s: Schema): Schema {
  if (!s.$ref) return s
  const name = s.$ref.replace(/^#\/\$defs\//, '')
  const ziel = (SCHEMA as unknown as Schema).$defs?.[name]
  if (!ziel) throw new Error(`Schema-Verweis ${s.$ref} unbekannt`)
  return aufloesen(ziel)
}

function pfadPlus(pfad: string, schluessel: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(schluessel) ? (pfad ? `${pfad}.${schluessel}` : schluessel) : `${pfad}[${JSON.stringify(schluessel)}]`
}

function typVon(w: unknown): string {
  if (w === null) return 'null'
  if (Array.isArray(w)) return 'array'
  if (typeof w === 'number') return Number.isInteger(w) ? 'integer' : 'number'
  return typeof w
}

const TYPNAMEN: Record<string, string> = {
  object: 'ein Objekt', array: 'eine Liste', string: 'ein Text', number: 'eine Zahl', integer: 'eine ganze Zahl', boolean: 'ein Wahrheitswert', null: 'null',
}

function passtTyp(w: unknown, typ: string): boolean {
  const t = typVon(w)
  return t === typ || (typ === 'number' && t === 'integer')
}

/** Verständliche Form zu den Mustern der benannten Definitionen. */
const FORM: Record<string, string> = {
  appKennung: 'Kleinbuchstaben, Ziffern und Bindestrich, beginnend mit einem Buchstaben, höchstens 40 Zeichen',
  kennung: 'Buchstaben, Ziffern und . _ : -, beginnend mit Buchstabe oder Ziffer, höchstens 64 Zeichen',
  datum: 'Datum JJJJ-MM-TT',
}

function pruefeGegenSchema(wert: unknown, roh: Schema, pfad: string, k: Kontext): void {
  const s = aufloesen(roh)
  const form = roh.$ref ? FORM[roh.$ref.replace(/^#\/\$defs\//, '')] : undefined
  const ort = pfad || 'Datei'
  const fehler = (text: string) => k.fehler.push({ code: 'schema', pfad, text })

  if (s.const !== undefined && wert !== s.const) {
    fehler(`muss ${JSON.stringify(s.const)} sein.`)
    return
  }
  if (s.enum && !s.enum.includes(wert)) {
    fehler(`${JSON.stringify(wert)} ist nicht erlaubt; erlaubt sind ${s.enum.map((e) => JSON.stringify(e)).join(', ')}.`)
    return
  }
  if (s.type) {
    const typen = Array.isArray(s.type) ? s.type : [s.type]
    if (!typen.some((t) => passtTyp(wert, t))) {
      fehler(`muss ${typen.map((t) => TYPNAMEN[t] ?? t).join(' oder ')} sein, ist aber ${TYPNAMEN[typVon(wert)] ?? typVon(wert)}.`)
      return
    }
  }
  if (typeof wert === 'string') {
    if (s.minLength !== undefined && [...wert].length < s.minLength) fehler('darf nicht leer sein.')
    else if (s.pattern !== undefined && !muster(s.pattern).test(wert)) {
      fehler(
        s.pattern === '\\S'
          ? 'darf nicht nur aus Leerzeichen bestehen.'
          : s.format === 'date-time'
            ? `${JSON.stringify(kuerze(wert))} ist kein gültiger Zeitpunkt (ISO 8601 mit Zeitzone, z. B. 2026-11-13T09:30:00+01:00).`
            : `${JSON.stringify(kuerze(wert))} hat nicht die erwartete Form${form ? ` (${form})` : ''}.`,
      )
    } else if (s.format === 'date' && !istDatum(wert)) fehler(`${JSON.stringify(wert)} ist kein gültiges Datum (JJJJ-MM-TT).`)
    else if (s.format === 'date-time' && !istZeitpunkt(wert)) fehler(`${JSON.stringify(wert)} ist kein gültiger Zeitpunkt (ISO 8601 mit Zeitzone).`)
  }
  if (Array.isArray(wert) && s.items) {
    for (let i = 0; i < wert.length; i++) pruefeGegenSchema(wert[i], s.items, `${pfad}[${i}]`, k)
  }
  if (istObjekt(wert)) {
    for (const pflicht of s.required ?? []) {
      if (!(pflicht in wert)) k.fehler.push({ code: 'schema', pfad: pfadPlus(pfad, pflicht), text: `fehlt (Pflichtfeld in ${ort}).` })
    }
    for (const [schluessel, inhalt] of Object.entries(wert)) {
      const unterPfad = pfadPlus(pfad, schluessel)
      if (s.propertyNames) {
        const vorher = k.fehler.length
        pruefeGegenSchema(schluessel, s.propertyNames, unterPfad, k)
        if (k.fehler.length > vorher) {
          k.fehler.splice(vorher)
          k.fehler.push({ code: 'schema', pfad: unterPfad, text: `"${kuerze(schluessel)}" ist kein gültiger Name für einen Namensraum (Kleinbuchstaben, Ziffern, Bindestrich).` })
          continue
        }
      }
      const eigen = s.properties?.[schluessel]
      if (eigen) pruefeGegenSchema(inhalt, eigen, unterPfad, k)
      else if (s.additionalProperties === false) {
        if (k.nachsichtig) k.hinweise.push({ code: 'unbekanntes-feld', pfad: unterPfad, text: 'unbekanntes Feld aus einer neueren Formatversion, wird ignoriert.' })
        else k.fehler.push({ code: 'schema', pfad: unterPfad, text: `ist in Formatversion ${FORMAT_VERSION} nicht vorgesehen. Eigene Angaben gehören unter "erweiterungen".` })
      } else if (typeof s.additionalProperties === 'object') pruefeGegenSchema(inhalt, s.additionalProperties, unterPfad, k)
    }
  }
}

function kuerze(t: string): string {
  return t.length > 40 ? t.slice(0, 37) + '…' : t
}

function istObjekt(w: unknown): w is Record<string, unknown> {
  return typeof w === 'object' && w !== null && !Array.isArray(w)
}

function istDatum(t: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (!m) return false
  const [j, mo, ta] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (mo < 1 || mo > 12 || ta < 1) return false
  const schalt = (j % 4 === 0 && j % 100 !== 0) || j % 400 === 0
  const tage = [31, schalt ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1]
  return ta <= tage
}

function istZeitpunkt(t: string): boolean {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|z|[+-](\d{2}):(\d{2}))$/.exec(t)
  if (!m || !istDatum(m[1])) return false
  const [h, mi, se] = [Number(m[2]), Number(m[3]), Number(m[4])]
  if (h > 23 || mi > 59 || se > 59) return false
  if (m[7] !== undefined && (Number(m[7]) > 23 || Number(m[8]) > 59)) return false
  return true
}

function leerZuUndefiniert(t: string | undefined): string | undefined {
  const w = t?.trim()
  return w ? w : undefined
}

function ohneLeere<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, w]) => w !== undefined)) as T
}
