/**
 * Laden, Bereinigen und Übernehmen der Compliance-Angaben (Spezifikation 4.4).
 * `validiereCompliance` prüft jede Datei streng: Unbekannte Werte lösen einen
 * `Formatfehler` mit Feldnamen aus, keinen Absturz.
 *
 * Hinweis zum Import: `src/modell/speicher.ts` ruft `validiereCompliance` in
 * `leseProjekt` auf, und diese Datei nutzt `leseProjekt` für eingefrorene
 * Prozesse. Beide verwenden die Importe nur in Funktionen; der Kreis ist
 * deshalb unschädlich.
 */
import { alleAufgaben } from '../modell/operationen'
import { Formatfehler, leseProjekt } from '../modell/speicher'
import type { Id, Prozess } from '../modell/typen'
import { istIsoDatum, istPlausiblesDatum } from './datum'
import {
  ABLAGEFORMEN,
  AUFBEWAHRUNGSARTEN,
  AV_VERTRAEGE,
  BELEGFORMEN,
  BESONDERE_KATEGORIEN,
  BETRIEBE,
  BETROFFENE,
  DATENKATEGORIEN,
  EINWEISUNGEN,
  FRIST_BEGINNE,
  GARANTIEN,
  GEWINNERMITTLUNGEN,
  KONTROLLARTEN,
  LOESCH_TURNUS,
  NACHWEISE,
  RECHTSFORMEN,
  RECHTSGRUNDLAGEN,
  RICHTUNGEN,
  SICHERUNGEN,
  STANDORTE,
  TOM_REIHENFOLGE,
  UNVERAENDERBARKEIT,
  ZEITEINHEITEN,
  type Eintrag,
} from './standard'
import { COMPLIANCE_VERSION, type ComplianceProjekt } from './typen'

type Obj = Record<string, unknown>

const istObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x)

function fehler(pfad: string, was: string): never {
  const e = new Formatfehler(`Compliance-Angaben: ‚${pfad}‘ ${was}.`)
  e.feld = pfad
  e.was = was
  throw e
}

function obj(x: unknown, pfad: string): Obj {
  if (!istObj(x)) fehler(pfad, 'fehlt oder ist kein Objekt')
  return x
}

function text(o: Obj, feld: string, pfad: string): void {
  if (typeof o[feld] !== 'string') fehler(`${pfad}.${feld}`, 'fehlt oder ist kein Text')
}

function texte(o: Obj, felder: string[], pfad: string): void {
  for (const f of felder) text(o, f, pfad)
}

function textListe(o: Obj, feld: string, pfad: string): void {
  const x = o[feld]
  if (!Array.isArray(x) || !x.every((s) => typeof s === 'string')) fehler(`${pfad}.${feld}`, 'ist keine Liste von Texten')
}

function wahrheit(o: Obj, feld: string, pfad: string, mitNull = false): void {
  const x = o[feld]
  if (!(typeof x === 'boolean' || (mitNull && x === null))) fehler(`${pfad}.${feld}`, mitNull ? 'ist weder ja, nein noch offen' : 'ist weder ja noch nein')
}

function datum(o: Obj, feld: string, pfad: string, mitNull = true): void {
  const x = o[feld]
  if (mitNull && x === null) return
  if (typeof x !== 'string' || !istIsoDatum(x)) fehler(`${pfad}.${feld}`, 'ist kein gültiges Datum')
  // Wie bei der Eingabe: Mit Jahren wie 9995 rechnen die Fristen fünfstellige Jahre aus, die sich nicht darstellen lassen
  if (!istPlausiblesDatum(x)) fehler(`${pfad}.${feld}`, 'liegt nicht zwischen 1900 und 2199')
}

function wert<T extends string>(o: Obj, feld: string, katalog: readonly Eintrag<T>[], pfad: string, mitNull = false): void {
  const x = o[feld]
  if (mitNull && x === null) return
  if (!katalog.some((k) => k.wert === x)) fehler(`${pfad}.${feld}`, `hat den unbekannten Wert „${String(x)}“`)
}

function werte<T extends string>(o: Obj, feld: string, katalog: readonly Eintrag<T>[], pfad: string): void {
  const x = o[feld]
  if (!Array.isArray(x)) fehler(`${pfad}.${feld}`, 'ist keine Liste')
  x.forEach((w, i) => {
    if (!katalog.some((k) => k.wert === w)) fehler(`${pfad}.${feld}.${i}`, `hat den unbekannten Wert „${String(w)}“`)
  })
}

function ganzzahl(o: Obj, feld: string, pfad: string, min: number, max: number, mitNull = false): void {
  const x = o[feld]
  if (mitNull && x === null) return
  if (typeof x !== 'number' || !Number.isInteger(x) || x < min || x > max) fehler(`${pfad}.${feld}`, `ist keine ganze Zahl von ${min} bis ${max === Infinity ? 'unbegrenzt' : max}`)
}

function liste(o: Obj, feld: string, pfad: string): unknown[] {
  const x = o[feld]
  if (!Array.isArray(x)) fehler(`${pfad}.${feld}`, 'ist keine Liste')
  return x
}

function pruefeKontakt(x: unknown, pfad: string): void {
  const k = obj(x, pfad)
  texte(k, ['name', 'telefon', 'email'], pfad)
  texte(obj(k.anschrift, `${pfad}.anschrift`), ['strasse', 'plz', 'ort'], `${pfad}.anschrift`)
}

function pruefeUnternehmen(x: unknown): void {
  const p = 'unternehmen'
  const u = obj(x, p)
  texte(u, ['name', 'telefon', 'email', 'internet', 'branche', 'geschaeftszweck', 'geschaeftsleitung', 'steuerberatung'], p)
  wert(u, 'rechtsform', RECHTSFORMEN, p, true)
  texte(obj(u.anschrift, `${p}.anschrift`), ['strasse', 'plz', 'ort'], `${p}.anschrift`)
  wert(u, 'gewinnermittlung', GEWINNERMITTLUNGEN, p, true)
  textListe(u, 'standorte', p)
  ganzzahl(u, 'personenMitDaten', p, 0, Infinity, true)
  if (u.datenschutzbeauftragter !== null) {
    pruefeKontakt(u.datenschutzbeauftragter, `${p}.datenschutzbeauftragter`)
    wahrheit(obj(u.datenschutzbeauftragter, `${p}.datenschutzbeauftragter`), 'extern', `${p}.datenschutzbeauftragter`)
  }
  if (u.gemeinsamVerantwortlicher !== null) pruefeKontakt(u.gemeinsamVerantwortlicher, `${p}.gemeinsamVerantwortlicher`)
  if (u.vertreter !== null) pruefeKontakt(u.vertreter, `${p}.vertreter`)
}

function pruefeVerarbeitung(x: unknown): void {
  const p = 'verarbeitung'
  const v = obj(x, p)
  texte(v, ['benennung', 'laufendeNummer', 'fachabteilung', 'ansprechpartner', 'telefon', 'email'], p)
  datum(v, 'eingefuehrtAm', p)
  textListe(v, 'zwecke', p)
}

/** Prüft eine Liste mit Einträgen, die eine eindeutige Id haben; liefert die Ids. */
function eindeutigeIds(eintraege: unknown[], pfad: string): Set<Id> {
  const ids = new Set<Id>()
  eintraege.forEach((e, i) => {
    const o = obj(e, `${pfad}.${i}`)
    text(o, 'id', `${pfad}.${i}`)
    if (ids.has(o.id as Id)) fehler(`${pfad}.${i}.id`, `kommt doppelt vor („${String(o.id)}“)`)
    ids.add(o.id as Id)
  })
  return ids
}

function pruefeFrist(x: unknown, pfad: string): void {
  const f = obj(x, pfad)
  ganzzahl(f, 'anzahl', pfad, 0, 100)
  wert(f, 'einheit', ZEITEINHEITEN, pfad)
  wert(f, 'beginn', FRIST_BEGINNE, pfad)
  text(f, 'ereignis', pfad)
}

function pruefeDatenobjekt(x: unknown, pfad: string, ablageorte: Set<Id>): void {
  const d = obj(x, pfad)
  wert(d, 'aufbewahrungsart', AUFBEWAHRUNGSARTEN, pfad)
  wert(d, 'form', BELEGFORMEN, pfad, true)
  wert(d, 'richtung', RICHTUNGEN, pfad, true)
  liste(d, 'ablageSpeicherIds', pfad).forEach((s, i) => {
    if (typeof s !== 'string' || !ablageorte.has(s)) fehler(`${pfad}.ablageSpeicherIds.${i}`, 'verweist auf einen unbekannten Ablageort')
  })
  wert(d, 'ablageform', ABLAGEFORMEN, pfad, true)
  wahrheit(d, 'originalVernichtet', pfad, true)
  ganzzahl(d, 'aufbewahrungJahre', pfad, 0, 30, true)
  wahrheit(d, 'personenbezogen', pfad, true)
  werte(d, 'betroffene', BETROFFENE, pfad)
  werte(d, 'datenkategorien', DATENKATEGORIEN, pfad)
  werte(d, 'besondereKategorien', BESONDERE_KATEGORIEN, pfad)
  wahrheit(d, 'strafrechtlich', pfad)
  werte(d, 'rechtsgrundlagen', RECHTSGRUNDLAGEN, pfad)
  text(d, 'berechtigtesInteresse', pfad)
  if (d.loeschfrist !== null) pruefeFrist(d.loeschfrist, `${pfad}.loeschfrist`)
  const empfaenger = liste(d, 'externeEmpfaenger', pfad)
  eindeutigeIds(empfaenger, `${pfad}.externeEmpfaenger`)
  empfaenger.forEach((e, i) => {
    const q = `${pfad}.externeEmpfaenger.${i}`
    const o = obj(e, q)
    texte(o, ['kategorie', 'name', 'drittland'], q)
    wert(o, 'standort', STANDORTE, q)
    wert(o, 'garantie', GARANTIEN, q, true)
  })
}

function pruefeSystem(x: unknown, pfad: string): void {
  const s = obj(x, pfad)
  texte(s, ['hersteller', 'version', 'dienstleister', 'drittland', 'sicherungIntervall', 'zugriffsschutz'], pfad)
  datum(s, 'seit', pfad)
  wert(s, 'betrieb', BETRIEBE, pfad, true)
  wert(s, 'standort', STANDORTE, pfad)
  wert(s, 'garantie', GARANTIEN, pfad, true)
  wahrheit(s, 'auftragsverarbeitung', pfad, true)
  wert(s, 'avVertrag', AV_VERTRAEGE, pfad)
  datum(s, 'avVertragVom', pfad)
  wert(s, 'unveraenderbarkeit', UNVERAENDERBARKEIT, pfad)
  wert(s, 'sicherung', SICHERUNGEN, pfad)
  datum(s, 'wiederherstellungGetestet', pfad)
}

const ABSCHNITT_ARTEN = ['ueberschrift', 'absatz', 'liste', 'tabelle', 'hinweis', 'diagramm']

function pruefeDokument(x: unknown, pfad: string, art: 'verfahrensdokumentation' | 'verarbeitungsverzeichnis'): void {
  const d = obj(x, pfad)
  if (d.art !== art) fehler(`${pfad}.art`, `muss „${art}“ sein, nicht „${String(d.art)}“`)
  texte(d, ['titel', 'untertitel', 'versionText'], pfad)
  datum(d, 'stand', pfad, false)
  datum(d, 'rechtsstand', pfad, false)
  liste(d, 'abschnitte', pfad).forEach((a, i) => {
    const q = `${pfad}.abschnitte.${i}`
    const o = obj(a, q)
    if (!ABSCHNITT_ARTEN.includes(o.art as string)) fehler(`${q}.art`, `hat den unbekannten Wert „${String(o.art)}“`)
    switch (o.art) {
      case 'ueberschrift':
        if (o.ebene !== 1 && o.ebene !== 2 && o.ebene !== 3) fehler(`${q}.ebene`, 'ist nicht 1, 2 oder 3')
        texte(o, ['nummer', 'text'], q)
        break
      case 'absatz':
      case 'hinweis':
        text(o, 'text', q)
        break
      case 'liste':
        textListe(o, 'punkte', q)
        break
      case 'tabelle':
        textListe(o, 'kopf', q)
        liste(o, 'zeilen', q).forEach((z, k) => {
          if (!Array.isArray(z) || !z.every((s) => typeof s === 'string')) fehler(`${q}.zeilen.${k}`, 'ist keine Liste von Texten')
        })
        break
    }
  })
}

/**
 * Eingefrorener Prozess einer Version: läuft durch `leseProjekt` wie ein Ist-Prozess,
 * damit jede Formatmigration auch für alte Versionen gilt. Ändert die Daten an Ort und Stelle.
 */
function pruefeEingefrorenenProzess(x: unknown, pfad: string): void {
  try {
    const formatVersion = istObj(x) ? x.formatVersion : undefined
    leseProjekt({ formatVersion, ist: x, soll: null, massnahmen: [], verworfen: [] })
  } catch (e) {
    if (e instanceof Formatfehler) fehler(pfad, `ist kein gültiger Prozess (${e.message.replace(/^Ist-Prozess[:,]?\s*/, '').replace(/\.$/, '')})`)
    throw e
  }
}

function pruefeVersionen(x: unknown[]): void {
  let letztesGueltigAb = ''
  const bezeichnungen = new Set<string>()
  x.forEach((v, i) => {
    const p = `versionen.${i}`
    const o = obj(v, p)
    if (o.nummer !== i + 1) fehler(`${p}.nummer`, `muss ${i + 1} sein`)
    texte(o, ['bezeichnung', 'freigegebenVon', 'aenderung', 'pruefsumme'], p)
    if (!(o.bezeichnung as string).trim()) fehler(`${p}.bezeichnung`, 'ist leer')
    if (bezeichnungen.has(o.bezeichnung as string)) fehler(`${p}.bezeichnung`, `kommt doppelt vor („${String(o.bezeichnung)}“)`)
    bezeichnungen.add(o.bezeichnung as string)
    datum(o, 'gueltigAb', p, false)
    datum(o, 'freigegebenAm', p, false)
    if ((o.gueltigAb as string) <= letztesGueltigAb) fehler(`${p}.gueltigAb`, 'liegt nicht nach dem der vorigen Version')
    letztesGueltigAb = o.gueltigAb as string
    textListe(o, 'geaenderteKapitel', p)
    // Kleinigkeit, still behoben: eine Prüfsumme in Großbuchstaben (z. B. von Hand übertragen) wird klein geschrieben
    if (/^[0-9a-f]{64}$/i.test(o.pruefsumme as string)) o.pruefsumme = (o.pruefsumme as string).toLowerCase()
    if (!/^[0-9a-f]{64}$/.test(o.pruefsumme as string)) fehler(`${p}.pruefsumme`, 'ist keine SHA-256-Prüfsumme')
    pruefeEingefrorenenProzess(o.prozess, `${p}.prozess`)
    pruefeDokument(o.verfahrensdoku, `${p}.verfahrensdoku`, 'verfahrensdokumentation')
    pruefeDokument(o.verzeichnis, `${p}.verzeichnis`, 'verarbeitungsverzeichnis')
  })
}

/** Prüft geladene Compliance-Angaben; wirft `Formatfehler` mit Feldnamen. Eingefrorene Prozesse werden dabei migriert. */
export function validiereCompliance(x: unknown): asserts x is ComplianceProjekt {
  if (!istObj(x)) throw new Formatfehler('Compliance-Angaben: kein gültiges Objekt.')
  if (x.version !== COMPLIANCE_VERSION) throw new Formatfehler(`Compliance-Angaben in Version ${String(x.version)} werden nicht unterstützt.`)
  pruefeUnternehmen(x.unternehmen)
  pruefeVerarbeitung(x.verarbeitung)

  const unterlagen = eindeutigeIds(liste(x, 'unterlagen', 'compliance'), 'unterlagen')
  liste(x, 'unterlagen', 'compliance').forEach((u, i) => text(obj(u, `unterlagen.${i}`), 'name', `unterlagen.${i}`))
  const ablageorte = eindeutigeIds(liste(x, 'ablageorte', 'compliance'), 'ablageorte')
  liste(x, 'ablageorte', 'compliance').forEach((a, i) => {
    const o = obj(a, `ablageorte.${i}`)
    text(o, 'name', `ablageorte.${i}`)
    if (o.mediumId !== null && typeof o.mediumId !== 'string') fehler(`ablageorte.${i}.mediumId`, 'ist weder ein Verweis noch leer')
  })
  liste(x, 'zugriffe', 'compliance').forEach((z, i) => {
    const p = `zugriffe.${i}`
    const o = obj(z, p)
    text(o, 'aufgabeId', p)
    if (typeof o.unterlageId !== 'string' || !unterlagen.has(o.unterlageId)) fehler(`${p}.unterlageId`, 'verweist auf eine unbekannte Unterlage')
    if (o.richtung !== 'liest' && o.richtung !== 'schreibt') fehler(`${p}.richtung`, `hat den unbekannten Wert „${String(o.richtung)}“`)
  })

  const datenobjekte = obj(x.datenobjekte, 'datenobjekte')
  for (const [id, d] of Object.entries(datenobjekte)) {
    if (!unterlagen.has(id)) fehler(`datenobjekte.${id}`, 'gehört zu keiner Unterlage')
    pruefeDatenobjekt(d, `datenobjekte.${id}`, ablageorte)
  }
  for (const [id, s] of Object.entries(obj(x.systeme, 'systeme'))) pruefeSystem(s, `systeme.${id}`)
  for (const [id, r] of Object.entries(obj(x.rollen, 'rollen'))) {
    const o = obj(r, `rollen.${id}`)
    wahrheit(o, 'extern', `rollen.${id}`)
    text(o, 'organisation', `rollen.${id}`)
  }
  for (const [id, k] of Object.entries(obj(x.kontrollen, 'kontrollen'))) {
    const o = obj(k, `kontrollen.${id}`)
    wert(o, 'art', KONTROLLARTEN, `kontrollen.${id}`)
    text(o, 'ziel', `kontrollen.${id}`)
    wert(o, 'nachweis', NACHWEISE, `kontrollen.${id}`)
  }
  const weitere = liste(x, 'weitereKontrollen', 'compliance')
  eindeutigeIds(weitere, 'weitereKontrollen')
  weitere.forEach((w, i) => {
    const p = `weitereKontrollen.${i}`
    const o = obj(w, p)
    texte(o, ['name', 'verantwortlich', 'haeufigkeit'], p)
    wert(o, 'art', KONTROLLARTEN, p)
    wahrheit(o, 'extern', p)
    wert(o, 'nachweis', NACHWEISE, p)
    if (o.bezugAufgabeId !== null && typeof o.bezugAufgabeId !== 'string') fehler(`${p}.bezugAufgabeId`, 'ist weder ein Verweis noch leer')
  })
  const einweisung = obj(x.einweisung, 'einweisung')
  wert(einweisung, 'turnus', EINWEISUNGEN, 'einweisung', true)
  wahrheit(einweisung, 'protokoll', 'einweisung')
  const loeschung = obj(x.loeschung, 'loeschung')
  texte(loeschung, ['freigabe', 'durchfuehrung'], 'loeschung')
  wert(loeschung, 'turnus', LOESCH_TURNUS, 'loeschung', true)
  text(x, 'begruendungLaengereAufbewahrung', 'compliance')
  const toms = obj(x.toms, 'toms')
  for (const b of TOM_REIHENFOLGE) {
    const t = obj(toms[b], `toms.${b}`)
    textListe(t, 'massnahmen', `toms.${b}`)
    text(t, 'nichtZutreffend', `toms.${b}`)
  }
  textListe(x, 'mitgeltend', 'compliance')
  pruefeVersionen(liste(x, 'versionen', 'compliance'))
  datum(x, 'zuletztGeprueft', 'compliance')
}

/**
 * Entfernt Angaben, deren Medium, Rolle oder Aufgabe im Ist-Prozess fehlt (4.4).
 * Ablageorte verlieren dann ihr System; Unterlagen und ihre Angaben bleiben.
 * Liefert dasselbe Objekt, wenn nichts zu tun ist.
 */
export function bereinigeCompliance(c: ComplianceProjekt, ist: Prozess): ComplianceProjekt {
  const medien = new Set(ist.medien.map((m) => m.id))
  const rollen = new Set(ist.rollen.map((r) => r.id))
  const aufgaben = new Set(alleAufgaben(ist).map((a) => a.id))
  let geaendert = false
  const filtere = <T>(r: Record<Id, T>, behalten: Set<Id>): Record<Id, T> => {
    const weg = Object.keys(r).filter((k) => !behalten.has(k))
    if (weg.length === 0) return r
    geaendert = true
    return Object.fromEntries(Object.entries(r).filter(([k]) => behalten.has(k)))
  }
  const systeme = filtere(c.systeme, medien)
  const rollenAngaben = filtere(c.rollen, rollen)
  const kontrollen = filtere(c.kontrollen, aufgaben)
  const zugriffe = c.zugriffe.every((z) => aufgaben.has(z.aufgabeId)) ? c.zugriffe : c.zugriffe.filter((z) => aufgaben.has(z.aufgabeId))
  const ablageorte = c.ablageorte.every((a) => a.mediumId === null || medien.has(a.mediumId))
    ? c.ablageorte
    : c.ablageorte.map((a) => (a.mediumId !== null && !medien.has(a.mediumId) ? { ...a, mediumId: null } : a))
  const weitereKontrollen = c.weitereKontrollen.every((w) => w.bezugAufgabeId === null || aufgaben.has(w.bezugAufgabeId))
    ? c.weitereKontrollen
    : c.weitereKontrollen.map((w) => (w.bezugAufgabeId !== null && !aufgaben.has(w.bezugAufgabeId) ? { ...w, bezugAufgabeId: null } : w))
  if (!geaendert && zugriffe === c.zugriffe && ablageorte === c.ablageorte && weitereKontrollen === c.weitereKontrollen) return c
  return { ...c, systeme, rollen: rollenAngaben, kontrollen, zugriffe, ablageorte, weitereKontrollen }
}

/** Übernimmt Firmenangaben und Schutzmaßnahmen aus einer anderen Projektdatei (6.10); alles andere bleibt. */
export function uebernimmFirmenangaben(ziel: ComplianceProjekt, quelle: ComplianceProjekt): ComplianceProjekt {
  return {
    ...ziel,
    unternehmen: structuredClone(quelle.unternehmen),
    toms: structuredClone(quelle.toms),
    einweisung: { ...quelle.einweisung },
    loeschung: { ...quelle.loeschung },
    begruendungLaengereAufbewahrung: quelle.begruendungLaengereAufbewahrung,
  }
}

/** JSON mit sortierten Objektschlüsseln und ohne Leerraum: gleicher Inhalt ergibt gleichen Text (Prüfsumme, 6.8). */
export function kanonischesJson(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map((e) => (e === undefined ? 'null' : kanonischesJson(e))).join(',')}]`
  if (istObj(x)) {
    const teile = Object.keys(x)
      .filter((k) => x[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${kanonischesJson(x[k])}`)
    return `{${teile.join(',')}}`
  }
  return JSON.stringify(x) ?? 'null'
}
