/**
 * Kapitel 4 der Verfahrensdokumentation: Ablaufbeschreibung aus dem
 * Prozessbaum (Spezifikation 6.6.1). Jede Aufgabe wird ein Unterkapitel
 * „4.k“; Verzweigungen erscheinen als Absatz mit Liste ihrer Ausgänge, und die
 * Aufgaben darin erben die Bedingung („Nur wenn: …“). Zeiten, Anteile und
 * Anzahlen erscheinen nicht.
 *
 * Ablaufsätze haben keine eigene Überschrift. Stünde einer sonst unter einer
 * Aufgabe aus einem anderen Zweig, nennt ein Anschluss seinen Zusammenhang
 * („Nach der Entscheidung …:“, „Wenn …:“, „In Zweig 2:“). Die Sätze zu einer
 * Wiederholung, einem Abschnitt und „für jedes Stück“ stehen als erste Zeilen im
 * Unterkapitel ihres ersten Schritts, wenn sie mit einer Aufgabe beginnen.
 * Unterbrechungen stehen als „Ausnahme: …“ bzw. „Nebenweg: …“ beim Schritt, den
 * sie unterbrechen; die Aufgaben ihres Ausnahmewegs folgen direkt darauf.
 *
 * Die Bausteinart wird erschöpfend geprüft: Kommt ein Baustein hinzu, meldet
 * TypeScript einen Fehler, statt dass er im Dokument still fehlt.
 */
import { bereichTitel, durchlaufe, findeBlock, gliedNebenlaeufig, teilnehmerName } from '../modell/operationen'
import {
  unerwartet,
  unterbrechungenVon,
  type Aufgabe,
  type Block,
  type EntscheidungsZweig,
  type Id,
  type Mehrfach,
  type OderZweig,
  type Parallel,
  type Sequenz,
  type Teilprozess,
  type Unterbrechbar,
  type Unterbrechung,
  type WarteArt,
  type Wiederholung,
} from '../modell/typen'
import { kontrollAngaben, liste, objektName, objekteVon, type Kontext } from './ableitung'
import { KONTROLLARTEN, NACHWEISE, textVon } from './standard'
import type { Abschnitt } from './typen'

/** Bedingung eines Zweigs: als Glied von „Nur wenn: …“ und als Nebensatz nach „wenn“. */
export interface Bedingung {
  text: string
  nebensatz: string
}

/** Kapitel 4 und die Bedingungen je Aufgabe (leer: die Aufgabe läuft in jedem Vorgang). */
export interface Ablauf {
  abschnitte: Abschnitt[]
  bedingungen: Map<Id, Bedingung[]>
}

function q(text: string, leer = 'offen'): string {
  return `„${text.trim() || leer}“`
}

/** „wenn „Betrag über 1.000 €?“ = „Ja“ und „Neukunde“ zutrifft“ */
export function wennText(bedingungen: Bedingung[]): string {
  return `wenn ${liste(bedingungen.map((b) => b.nebensatz))}`
}

function datenBedingung(frage: string, z: EntscheidungsZweig): Bedingung {
  const text = `${frage} = ${q(z.bezeichnung)}`
  return { text, nebensatz: text }
}

function ereignisBedingung(z: EntscheidungsZweig): Bedingung {
  return { text: `${q(z.bezeichnung)} tritt zuerst ein`, nebensatz: `${q(z.bezeichnung)} zuerst eintritt` }
}

function oderBedingung(z: OderZweig): Bedingung {
  return { text: `${q(z.bezeichnung)} trifft zu`, nebensatz: `${q(z.bezeichnung)} zutrifft` }
}

/** Nummern aller Aufgaben in einer Folge von Bausteinen, in Lesereihenfolge. */
function aufgabenNummern(k: Kontext, schritte: Block[]): string[] {
  const nrn: string[] = []
  for (const { block } of durchlaufe({ id: '', schritte })) if (block.typ === 'aufgabe') nrn.push(k.nummer.get(block.id) ?? '4.?')
  return nrn
}

/** „4.6 bis 4.7“, „4.5“ oder null ohne Aufgaben */
function bereich(k: Kontext, schritte: Block[]): string | null {
  const nrn = aufgabenNummern(k, schritte)
  if (nrn.length === 0) return null
  return nrn.length === 1 ? nrn[0] : `${nrn[0]} bis ${nrn[nrn.length - 1]}`
}

/** Baustein, mit dem es in einer Folge weitergeht (Wiederholung und Abschnitt werden dafür betreten). */
type Ziel = Exclude<Block, Wiederholung | Teilprozess>

/**
 * Baustein, mit dem es in einer Folge weitergeht. Wiederholung, Abschnitt und
 * Gleichzeitig (auch „weiter beim ersten“) werden betreten, weil ihr Inhalt
 * sicher beginnt; Entscheidungen nicht, weil die Aufgaben darin nur in einem
 * Zweig laufen. „In beliebiger Reihenfolge“ und „für jedes Stück“ sind selbst
 * das Ziel: Welcher Zweig zuerst kommt, ist offen, und Stücke gibt es nicht in
 * jedem Vorgang.
 */
function ersterBaustein(schritte: Block[]): Ziel | null {
  for (const b of schritte) {
    let innen: Sequenz[]
    switch (b.typ) {
      case 'wiederholung':
      case 'teilprozess':
        innen = [b.koerper]
        break
      case 'parallel':
        if (b.art === 'nacheinander') return b
        innen = b.zweige
        break
      default:
        return b
    }
    for (const s of innen) {
      const erster = ersterBaustein(s.schritte)
      if (erster) return erster
    }
  }
  return null
}

/** „den gleichzeitigen Zweigen“, „den Zweigen in beliebiger Reihenfolge“ */
function zweigeText(b: Parallel): string {
  const art = b.art
  switch (art) {
    case 'alle':
    case 'erster':
      return 'den gleichzeitigen Zweigen'
    case 'nacheinander':
      return 'den Zweigen in beliebiger Reihenfolge'
    default:
      return unerwartet(art)
  }
}

/** Name von „für jedes Stück“ in Sätzen */
function mehrfachName(b: Mehrfach): string {
  return q(b.name, 'Für jedes Stück')
}

/** „weiter mit 4.3“, „weiter mit der Entscheidung „…““, „zurück zu „…“ (Warten)“ */
function zielText(k: Kontext, b: Ziel, richtung: 'weiter' | 'zurueck'): string {
  const weiter = richtung === 'weiter'
  switch (b.typ) {
    case 'aufgabe':
      return `${weiter ? 'weiter mit' : 'zurück zu'} ${k.nummer.get(b.id) ?? '4.?'}`
    case 'entscheidung':
    case 'oder':
      return `${weiter ? 'weiter mit der' : 'zurück zur'} Entscheidung ${q(b.frage)}`
    case 'warten':
      return `${weiter ? 'weiter mit' : 'zurück zu'} ${q(b.name, 'ohne Namen')} (Warten)`
    case 'parallel': {
      const nrn = bereich(k, [b])
      return `${weiter ? 'weiter mit' : 'zurück zu'} ${zweigeText(b)}${nrn ? ` (${nrn})` : ''}`
    }
    case 'mehrfach': {
      const nrn = bereich(k, b.koerper.schritte)
      return `${weiter ? 'weiter mit' : 'zurück zu'} ${mehrfachName(b)}${nrn ? ` (${nrn})` : ''}`
    }
    default:
      return unerwartet(b)
  }
}

function zurueck(k: Kontext, zielId: Id): string {
  const ziel = findeBlock(k.p, zielId)?.block
  if (!ziel) return 'zurück zu einem früheren Schritt'
  const erster = ersterBaustein(ziel.typ === 'wiederholung' ? ziel.koerper.schritte : [ziel])
  return erster ? zielText(k, erster, 'zurueck') : `zurück zum Anfang von ${q(bereichTitel(ziel))}`
}

/** „ mit „Ergebnis““ oder leer; null ohne Ende */
function mitErgebnis(ende: string | null): string | null {
  return ende !== null ? (ende.trim() ? ` mit „${ende.trim()}“` : '') : null
}

/**
 * Was nach einem Ausgang einer Entscheidung geschieht. `sofort`: Die Entscheidung
 * liegt neben gleichzeitig laufenden Schritten; ein Ende bricht dort alles ab.
 */
function folge(k: Kontext, z: EntscheidungsZweig, sofort: boolean): string {
  const erster = ersterBaustein(z.schritte)
  const ende = mitErgebnis(z.ende)
  if (erster) {
    const weiter = zielText(k, erster, 'weiter')
    if (ende !== null) return sofort ? `${weiter}, danach endet der gesamte Vorgang sofort${ende}` : `${weiter}, danach endet der Vorgang${ende}`
    if (z.zurueckZu) return `${weiter}, danach ${zurueck(k, z.zurueckZu)}`
    return weiter
  }
  if (ende !== null) return sofort ? `Der gesamte Vorgang endet sofort${ende}` : `Der Vorgang endet${ende}`
  if (z.zurueckZu) return zurueck(k, z.zurueckZu)
  return 'weiter im Ablauf'
}

/** „Frist“, „Nachricht von Kunde“ oder „Nachricht“ */
function ereignisArt(k: Kontext, art: WarteArt, von: Id | null | undefined): string {
  if (art === 'zeit') return 'Frist'
  return von ? `Nachricht von ${teilnehmerName(k.p, von)}` : 'Nachricht'
}

function ereignisText(k: Kontext, z: EntscheidungsZweig): string {
  if (!z.ereignis) return 'Ereignis offen'
  return ereignisArt(k, z.ereignis.art, z.ereignis.von)
}

/** Wie die Sätze zu Unterbrechungen den unterbrochenen Schritt nennen. */
interface Wirt {
  /** Zusatz hinter „Ausnahme“ bzw. „Nebenweg“, z. B. „ im Abschnitt „Versand““ */
  zusatz: string
  /** „wird der Schritt abgebrochen“ */
  abbruch: string
  /** „läuft der Schritt weiter“ */
  weiterlauf: string
  /** „nach dem Schritt“ */
  danach: string
  /** für die Bedingung der Aufgaben im Ausnahmeweg: „während 4.3“ */
  waehrend: string
}

function wirt(k: Kontext, b: Unterbrechbar): Wirt {
  switch (b.typ) {
    case 'aufgabe':
      return { zusatz: '', abbruch: 'wird der Schritt abgebrochen', weiterlauf: 'läuft der Schritt weiter', danach: 'nach dem Schritt', waehrend: `während ${k.nummer.get(b.id) ?? '4.?'}` }
    case 'teilprozess': {
      const name = q(b.name, 'ohne Namen')
      return { zusatz: ` im Abschnitt ${name}`, abbruch: 'wird der Abschnitt abgebrochen', weiterlauf: 'läuft der Abschnitt weiter', danach: 'nach dem Abschnitt', waehrend: `während des Abschnitts ${name}` }
    }
    case 'mehrfach': {
      const name = mehrfachName(b)
      return { zusatz: ` bei ${name}`, abbruch: 'endet die Arbeit an allen Stücken', weiterlauf: 'läuft die Arbeit an den Stücken weiter', danach: 'nach der ganzen Liste', waehrend: `während ${name}` }
    }
    default:
      return unerwartet(b)
  }
}

/** Bedingung der Aufgaben im Ausnahmeweg: „„Kunde storniert“ tritt während 4.3 ein“ */
function ausnahmeBedingung(u: Unterbrechung, w: Wirt): Bedingung {
  return { text: `${q(u.bezeichnung)} tritt ${w.waehrend} ein`, nebensatz: `${q(u.bezeichnung)} ${w.waehrend} eintritt` }
}

/**
 * „Ausnahme: Tritt „Kunde storniert“ ein (Nachricht von Kunde), wird der Schritt
 * abgebrochen; weiter mit 4.4, danach endet der Vorgang mit „Storniert“.“ bzw.
 * „Nebenweg: Tritt „Rückfrage“ ein (Nachricht), läuft der Schritt weiter; daneben läuft 4.4.“
 * `sofort`: Der Schritt liegt neben gleichzeitig laufenden Schritten.
 */
function unterbrechungsSatz(k: Kontext, u: Unterbrechung, w: Wirt, sofort: boolean): string {
  const anfang = `Tritt ${q(u.bezeichnung)} ein (${ereignisArt(k, u.art, u.von)})`
  if (!u.unterbrechend) {
    const nrn = aufgabenNummern(k, u.schritte)
    const daneben = nrn.length === 0 ? 'daneben läuft ein Weg ohne Aufgaben' : nrn.length === 1 ? `daneben läuft ${nrn[0]}` : `daneben laufen ${nrn[0]} bis ${nrn[nrn.length - 1]}`
    return `Nebenweg${w.zusatz}: ${anfang}, ${w.weiterlauf}; ${daneben}.`
  }
  const erster = ersterBaustein(u.schritte)
  const ende = mitErgebnis(u.ende)
  let rest: string
  if (erster) {
    const weiter = zielText(k, erster, 'weiter')
    if (ende !== null) rest = `${weiter}, danach endet ${sofort ? 'der gesamte Vorgang sofort' : 'der Vorgang'}${ende}`
    else if (u.zurueckZu) rest = `${weiter}, danach ${zurueck(k, u.zurueckZu)}`
    else rest = `${weiter}, danach geht es ${w.danach} weiter`
  } else if (ende !== null) rest = `${sofort ? 'der gesamte Vorgang endet sofort' : 'der Vorgang endet'}${ende}`
  else if (u.zurueckZu) rest = zurueck(k, u.zurueckZu)
  else rest = `es geht ${w.danach} weiter`
  return `Ausnahme${w.zusatz}: ${anfang}, ${w.abbruch}; ${rest}.`
}

/** Beginnt die Folge mit einer Aufgabe (auch in einer Wiederholung, einem Abschnitt oder „für jedes Stück“ darin), steht ihr Unterkapitel vor jedem anderen Ablaufsatz. */
function beginntMitAufgabe(schritte: Block[]): boolean {
  const erster = schritte[0]
  if (!erster) return false
  if (erster.typ === 'wiederholung' || erster.typ === 'teilprozess' || erster.typ === 'mehrfach') return beginntMitAufgabe(erster.koerper.schritte)
  return erster.typ === 'aufgabe'
}

/** Liegt in der Folge eine Entscheidung oder ODER-Verzweigung, läuft nicht jeder Schritt darin sicher. */
function verzweigt(s: Sequenz): boolean {
  return [...durchlaufe(s)].some(({ block }) => block.typ === 'entscheidung' || block.typ === 'oder')
}

/**
 * Satz zu einer Wiederholung. Liegen Schritte des Körpers in einem Zweig, läuft
 * nur der Abschnitt sicher, nicht jeder Schritt darin. `imSchritt`: Der Satz
 * steht im Unterkapitel des ersten Schritts, sonst vor dem Körper.
 */
function wiederholungsSatz(k: Kontext, b: Wiederholung, imSchritt: boolean): string {
  const nrn = aufgabenNummern(k, b.koerper.schritte)
  const solange = `solange ${q(b.frage)} mit „Ja“ beantwortet wird.`
  if (nrn.length === 0) return `Wiederholung: Der folgende Abschnitt läuft mindestens einmal und erneut, ${solange}`
  const schritte = nrn.length === 1 ? nrn[0] : `${nrn[0]} bis ${nrn[nrn.length - 1]}`
  const abschnitt = `Abschnitt mit ${nrn.length === 1 ? 'Schritt' : 'den Schritten'} ${schritte} läuft mindestens einmal und erneut, ${solange}`
  if (!imSchritt) return `Wiederholung: Der folgende ${abschnitt}`
  if (verzweigt(b.koerper)) return `Wiederholung: Der ${abschnitt}`
  return `Wiederholung: ${schritte} ${nrn.length === 1 ? 'läuft' : 'laufen'} mindestens einmal und erneut, ${solange}`
}

/** „Abschnitt „Versand“ mit den Schritten 4.3 bis 4.6.“ */
function teilprozessSatz(k: Kontext, b: Teilprozess): string {
  const name = q(b.name, 'ohne Namen')
  const nrn = aufgabenNummern(k, b.koerper.schritte)
  if (nrn.length === 0) return `Abschnitt ${name} ohne Aufgaben.`
  return nrn.length === 1 ? `Abschnitt ${name} mit Schritt ${nrn[0]}.` : `Abschnitt ${name} mit den Schritten ${nrn[0]} bis ${nrn[nrn.length - 1]}.`
}

/**
 * Satz zu „für jedes Stück“, z. B. „„Für jede Position“: 4.6 bis 4.7 laufen
 * einmal je Stück der Liste, ein Stück nach dem anderen.“ Wie bei der
 * Wiederholung: Mit Verzweigung im Körper läuft nur der Teil sicher.
 */
function mehrfachSatz(k: Kontext, b: Mehrfach, imSchritt: boolean): string {
  const ausfuehrung = b.ausfuehrung
  let wie: string
  switch (ausfuehrung) {
    case 'nacheinander':
      wie = 'ein Stück nach dem anderen'
      break
    case 'gleichzeitig':
      wie = 'alle Stücke zur selben Zeit'
      break
    default:
      return unerwartet(ausfuehrung)
  }
  const je = `einmal je Stück der Liste, ${wie}.`
  const name = mehrfachName(b)
  const nrn = aufgabenNummern(k, b.koerper.schritte)
  if (nrn.length === 0) return `${name}: Der folgende Teil läuft ${je}`
  const schritte = nrn.length === 1 ? nrn[0] : `${nrn[0]} bis ${nrn[nrn.length - 1]}`
  const teil = `Teil mit ${nrn.length === 1 ? 'Schritt' : 'den Schritten'} ${schritte} läuft ${je}`
  if (!imSchritt) return `${name}: Der folgende ${teil}`
  if (verzweigt(b.koerper)) return `${name}: Der ${teil}`
  return `${name}: ${schritte} ${nrn.length === 1 ? 'läuft' : 'laufen'} ${je}`
}

/** Einleitung zu den Zweigen von Gleichzeitig nach seiner Art */
function parallelSatz(b: Parallel): string {
  const art = b.art
  switch (art) {
    case 'alle':
      return 'Die folgenden Zweige laufen gleichzeitig; weiter geht es, wenn alle fertig sind:'
    case 'erster':
      return 'Die folgenden Zweige laufen gleichzeitig; sobald der erste fertig ist, werden die übrigen abgebrochen, und es geht weiter:'
    case 'nacheinander':
      return 'Die folgenden Zweige werden in beliebiger Reihenfolge nacheinander erledigt:'
    default:
      return unerwartet(art)
  }
}

function aufgabe(k: Kontext, a: Aufgabe, bedingungen: Bedingung[], vorspann: string[], nachspann: string[], out: Abschnitt[]): void {
  const absatz = (text: string) => out.push({ art: 'absatz', text })
  out.push({ art: 'ueberschrift', ebene: 2, nummer: k.nummer.get(a.id) ?? '4.?', text: a.name.trim() || 'Unbenannter Schritt' })
  for (const zeile of vorspann) absatz(zeile)
  if (bedingungen.length > 0) absatz(`Nur wenn: ${bedingungen.map((b) => b.text).join(', ')}.`)
  const rolle = k.p.rollen.find((r) => r.id === a.rolleId)?.name.trim() || 'offen'
  const medium = (a.mediumId ? k.medien.get(a.mediumId)?.name.trim() : '') || 'offen'
  absatz(`Zuständig: ${rolle}. System: ${medium}.`)
  if (a.nachrichtVon) absatz(`Nachricht von ${teilnehmerName(k.p, a.nachrichtVon)}.`)
  const gelesen = objekteVon(k, a.id, 'liest')
  if (gelesen.length > 0) absatz(`Grundlage: ${gelesen.map((id) => objektName(k, id)).join(', ')}.`)
  const geschrieben = objekteVon(k, a.id, 'schreibt')
  if (geschrieben.length > 0) absatz(`Ergebnis: ${geschrieben.map((id) => objektName(k, id)).join(', ')}.`)
  if (a.uebertragung) {
    const quelle = a.uebertragung.quelleMediumId ? k.medien.get(a.uebertragung.quelleMediumId)?.name.trim() : ''
    absatz(`Medienbruch: Daten aus ${quelle || 'einem anderen Medium'} werden von Hand übertragen.`)
  }
  if (a.art === 'pruefung' || a.art === 'freigabe') {
    const angabe = kontrollAngaben(k.c, a.id)
    absatz(
      angabe
        ? `Kontrolle: ${textVon(KONTROLLARTEN, angabe.art, 'dok')}; geprüft wird: ${angabe.ziel.trim() || 'offen'}; Nachweis: ${textVon(NACHWEISE, angabe.nachweis, 'dok')}.`
        : `Kontrolle: ${a.art === 'pruefung' ? 'Prüfung' : 'Freigabe'}, Angaben offen.`,
    )
  }
  if (a.nachrichtAn) absatz(`Nachricht an ${teilnehmerName(k.p, a.nachrichtAn)}.`)
  for (const zeile of nachspann) absatz(zeile)
}

/** Kapitel 4 ohne Kapitelüberschrift und ohne das letzte Unterkapitel, dazu die Bedingungen je Aufgabe. */
export function ablaufBeschreibung(k: Kontext): Ablauf {
  const out: Abschnitt[] = []
  const bedingungen = new Map<Id, Bedingung[]>()
  /** Sätze zu Wiederholungen, Abschnitten und „für jedes Stück“, die als erste Zeilen in das Unterkapitel der nächsten Aufgabe gehören */
  let vorspann: string[] = []
  /** Ablaufsatz, mit Anschluss, falls er sonst unter einer Aufgabe aus einem anderen Zweig stünde */
  const satz = (anschluss: string | null, text: string) => out.push({ art: 'absatz', text: anschluss ? `${anschluss}: ${text}` : text })

  /** Die Kindsequenz `s` von `b` läuft neben anderem, wenn `b` es tut oder sie selbst ein Zweig von Gleichzeitig, ein ODER-Weg, Stücke zur selben Zeit oder ein Nebenweg ist. */
  const nebenIn = (b: Block, s: Sequenz, neben: boolean) => neben || gliedNebenlaeufig({ block: b, sequenz: s })

  /** Ein Satz je Unterbrechung des Schritts `b`. */
  const unterbrechungsSaetze = (b: Unterbrechbar, neben: boolean): string[] => {
    const w = wirt(k, b)
    return unterbrechungenVon(b).map((u) => unterbrechungsSatz(k, u, w, neben))
  }

  /**
   * Gibt den Anschluss zurück, den ein folgender Ablaufsatz braucht. `neben`: Die
   * Folge läuft neben anderen Teilen desselben Vorgangs; ein Ende bricht dort alles ab.
   */
  function sequenz(schritte: Block[], bed: Bedingung[], anschluss: string | null, neben: boolean): string | null {
    let naechster = anschluss
    for (const b of schritte) naechster = block(b, bed, naechster, neben)
    return naechster
  }

  /** Ausnahmewege der Unterbrechungen von `b`, direkt nach dem Schritt; true, wenn sie etwas ausgegeben haben. */
  function ausnahmewege(b: Unterbrechbar, bed: Bedingung[], neben: boolean): boolean {
    const w = wirt(k, b)
    const vorher = out.length
    for (const u of unterbrechungenVon(b)) {
      const bu = ausnahmeBedingung(u, w)
      sequenz(u.schritte, [...bed, bu], `Wenn ${bu.nebensatz}`, nebenIn(b, u, neben))
    }
    return out.length > vorher
  }

  /**
   * Rahmen mit eigenem Satz (Abschnitt, „für jedes Stück“): Satz und Unterbrechungen
   * stehen vor dem Körper oder, wenn er mit einer Aufgabe beginnt, als erste Zeilen ihres
   * Unterkapitels; die Ausnahmewege folgen auf den Körper.
   */
  function rahmen(b: Teilprozess | Mehrfach, text: (imSchritt: boolean) => string, bed: Bedingung[], anschluss: string | null, neben: boolean): void {
    const imSchritt = beginntMitAufgabe(b.koerper.schritte)
    const zeilen = unterbrechungsSaetze(b, neben)
    if (imSchritt) vorspann.push(text(true), ...zeilen)
    else {
      satz(anschluss, text(false))
      for (const zeile of zeilen) out.push({ art: 'absatz', text: zeile })
    }
    sequenz(b.koerper.schritte, bed, null, nebenIn(b, b.koerper, neben))
    ausnahmewege(b, bed, neben)
  }

  /** `anschluss`: für den eigenen Ablaufsatz; Rückgabe: für den nächsten Baustein derselben Folge. */
  function block(b: Block, bed: Bedingung[], anschluss: string | null, neben: boolean): string | null {
    switch (b.typ) {
      case 'aufgabe': {
        bedingungen.set(b.id, bed)
        aufgabe(k, b, bed, vorspann, unterbrechungsSaetze(b, neben), out)
        vorspann = []
        // Ausnahmewege folgen direkt auf ihre Aufgabe; ein Satz danach nennt die Aufgabe
        return ausnahmewege(b, bed, neben) ? `Nach Schritt ${k.nummer.get(b.id) ?? '4.?'}` : null
      }
      case 'entscheidung': {
        const frage = q(b.frage)
        if (b.art === 'ereignis') {
          satz(anschluss, `Es wird abgewartet, was zuerst eintritt (${frage}):`)
          out.push({ art: 'liste', punkte: b.zweige.map((z) => `${q(z.bezeichnung)} (${ereignisText(k, z)}): ${folge(k, z, neben)}`) })
        } else {
          satz(anschluss, `Entscheidung ${frage}:`)
          out.push({ art: 'liste', punkte: b.zweige.map((z) => `${q(z.bezeichnung)}: ${folge(k, z, neben)}`) })
        }
        const vorher = out.length
        for (const z of b.zweige) {
          const bz = b.art === 'ereignis' ? ereignisBedingung(z) : datenBedingung(frage, z)
          sequenz(z.schritte, [...bed, bz], `Wenn ${bz.nebensatz}`, nebenIn(b, z, neben))
        }
        return out.length > vorher ? `Nach der Entscheidung ${frage}` : null
      }
      case 'oder': {
        const frage = q(b.frage)
        satz(anschluss, `Je nach Fall laufen einer oder mehrere dieser Wege (${frage}):`)
        out.push({ art: 'liste', punkte: b.zweige.map((z) => `${q(z.bezeichnung)}: ${bereich(k, z.schritte) ?? 'ohne Aufgaben'}${z.id === b.standard ? ' (wenn keiner zutrifft)' : ''}`) })
        const vorher = out.length
        for (const z of b.zweige) {
          const bz = oderBedingung(z)
          sequenz(z.schritte, [...bed, bz], `Wenn ${bz.nebensatz}`, nebenIn(b, z, neben))
        }
        return out.length > vorher ? `Nach der Entscheidung ${frage}` : null
      }
      case 'parallel': {
        satz(anschluss, parallelSatz(b))
        out.push({ art: 'liste', punkte: b.zweige.map((z, i) => `Zweig ${i + 1}: ${bereich(k, z.schritte) ?? 'ohne Aufgaben'}`) })
        const vorher = out.length
        b.zweige.forEach((z, i) => sequenz(z.schritte, bed, `In Zweig ${i + 1}`, nebenIn(b, z, neben)))
        if (out.length === vorher) return null
        const nrn = bereich(k, [b])
        return `${b.art === 'nacheinander' ? 'Nach den Zweigen' : 'Nach den gleichzeitigen Zweigen'}${nrn ? ` (${nrn})` : ''}`
      }
      case 'wiederholung': {
        // Rücksprungbereich: kein eigener Absatz; was danach kommt, schließt an seinen letzten Baustein an
        if (b.modus !== 'anteil') return sequenz(b.koerper.schritte, bed, anschluss, neben)
        const imSchritt = beginntMitAufgabe(b.koerper.schritte)
        const text = wiederholungsSatz(k, b, imSchritt)
        if (imSchritt) vorspann.push(text)
        else satz(anschluss, text)
        sequenz(b.koerper.schritte, bed, null, neben)
        const nrn = bereich(k, b.koerper.schritte)
        return `Nach der Wiederholung${nrn ? ` (${nrn})` : ''}`
      }
      case 'warten': {
        const worauf = b.art === 'zeit' ? 'auf einen Zeitpunkt' : b.von ? `auf eine Nachricht von ${teilnehmerName(k.p, b.von)}` : 'auf eine Nachricht'
        satz(anschluss, `Warten: ${b.name.trim() || 'ohne Namen'} (${worauf}).`)
        return null
      }
      case 'teilprozess': {
        rahmen(b, () => teilprozessSatz(k, b), bed, anschluss, neben)
        const nrn = bereich(k, [b])
        return `Nach dem Abschnitt ${q(b.name, 'ohne Namen')}${nrn ? ` (${nrn})` : ''}`
      }
      case 'mehrfach': {
        rahmen(b, (imSchritt) => mehrfachSatz(k, b, imSchritt), bed, anschluss, neben)
        const nrn = bereich(k, [b])
        return `Nach ${mehrfachName(b)}${nrn ? ` (${nrn})` : ''}`
      }
      default:
        return unerwartet(b)
    }
  }

  sequenz(k.p.ablauf.schritte, [], null, false)
  // Folgt auf eine Wiederholung keine Aufgabe mehr (kann bei gültigen Bäumen nicht vorkommen), geht ihr Satz nicht verloren
  for (const zeile of vorspann) satz(null, zeile)
  return { abschnitte: out, bedingungen }
}

/** Abschnitte für Kapitel 4 ohne Kapitelüberschrift und ohne das letzte Unterkapitel. */
export function ablaufAbschnitte(k: Kontext): Abschnitt[] {
  return ablaufBeschreibung(k).abschnitte
}
