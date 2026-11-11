/**
 * Kapitel 4 der Verfahrensdokumentation: Ablaufbeschreibung aus dem
 * Prozessbaum (Spezifikation 6.6.1). Jede Aufgabe wird ein Unterkapitel
 * „4.k“; Verzweigungen erscheinen als Absatz mit Liste ihrer Ausgänge, und die
 * Aufgaben darin erben die Bedingung („Nur wenn: …“). Zeiten, Anteile und
 * Anzahlen erscheinen nicht.
 *
 * Ablaufsätze haben keine eigene Überschrift. Stünde einer sonst unter einer
 * Aufgabe aus einem anderen Zweig, nennt ein Anschluss seinen Zusammenhang
 * („Nach der Entscheidung …:“, „Wenn …:“, „In Zweig 2:“). Der Satz zu einer
 * Wiederholung steht als erste Zeile im Unterkapitel ihres ersten Schritts.
 *
 * Die Bausteinart wird erschöpfend geprüft: Kommt ein Baustein hinzu, meldet
 * TypeScript einen Fehler, statt dass er im Dokument still fehlt.
 */
import { bereichTitel, durchlaufe, findeBlock, teilnehmerName } from '../modell/operationen'
import type { Aufgabe, Block, EntscheidungsZweig, Id, OderZweig, Parallel, Wiederholung } from '../modell/typen'
import { kontrollAngaben, liste, objektName, objekteVon, type Kontext } from './ableitung'
import { KONTROLLARTEN, NACHWEISE, textVon } from './standard'
import type { Abschnitt } from './typen'

/** Felder aus Format 3, die der Code von `main` noch nicht kennt (docs/modellierung-v3.md); gelesen, falls vorhanden. */
type MitAbbruch = EntscheidungsZweig & { beendetAlles?: boolean }
type ParallelV3 = Parallel & { zusammenfuehrung?: 'alle' | 'erster'; ausfuehrung?: 'gleichzeitig' | 'nacheinander' }

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

type Ziel = Exclude<Block, Wiederholung | Parallel>

/**
 * Baustein, mit dem es in einer Folge weitergeht. Wiederholung und Gleichzeitig
 * werden betreten, weil ihr Inhalt sicher beginnt; Entscheidungen nicht, weil
 * die Aufgaben darin nur in einem Zweig laufen.
 */
function ersterBaustein(schritte: Block[]): Ziel | null {
  for (const b of schritte) {
    if (b.typ === 'wiederholung') {
      const erster = ersterBaustein(b.koerper.schritte)
      if (erster) return erster
    } else if (b.typ === 'parallel') {
      for (const z of b.zweige) {
        const erster = ersterBaustein(z.schritte)
        if (erster) return erster
      }
    } else return b
  }
  return null
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
  }
}

function zurueck(k: Kontext, zielId: Id): string {
  const ziel = findeBlock(k.p, zielId)?.block
  if (!ziel) return 'zurück zu einem früheren Schritt'
  const erster = ersterBaustein(ziel.typ === 'wiederholung' ? ziel.koerper.schritte : [ziel])
  return erster ? zielText(k, erster, 'zurueck') : `zurück zum Anfang von ${q(bereichTitel(ziel))}`
}

/** Was nach einem Ausgang einer Entscheidung geschieht. */
function folge(k: Kontext, z: MitAbbruch): string {
  const erster = ersterBaustein(z.schritte)
  const ende = z.ende !== null ? (z.ende.trim() ? ` mit „${z.ende.trim()}“` : '') : null
  if (erster) {
    const weiter = zielText(k, erster, 'weiter')
    if (ende !== null) return z.beendetAlles ? `${weiter}, danach endet der gesamte Vorgang sofort${ende}` : `${weiter}, danach endet der Vorgang${ende}`
    if (z.zurueckZu) return `${weiter}, danach ${zurueck(k, z.zurueckZu)}`
    return weiter
  }
  if (ende !== null) return z.beendetAlles ? `Der gesamte Vorgang endet sofort${ende}` : `Der Vorgang endet${ende}`
  if (z.zurueckZu) return zurueck(k, z.zurueckZu)
  return 'weiter im Ablauf'
}

function ereignisText(k: Kontext, z: EntscheidungsZweig): string {
  if (!z.ereignis) return 'Ereignis offen'
  if (z.ereignis.art === 'zeit') return 'Frist'
  return z.ereignis.von ? `Nachricht von ${teilnehmerName(k.p, z.ereignis.von)}` : 'Nachricht'
}

/** Beginnt die Folge mit einer Aufgabe (auch in einer Wiederholung darin), steht ihr Unterkapitel vor jedem anderen Ablaufsatz. */
function beginntMitAufgabe(schritte: Block[]): boolean {
  const erster = schritte[0]
  if (!erster) return false
  if (erster.typ === 'wiederholung') return beginntMitAufgabe(erster.koerper.schritte)
  return erster.typ === 'aufgabe'
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
  const verzweigt = [...durchlaufe(b.koerper)].some(({ block }) => block.typ === 'entscheidung' || block.typ === 'oder')
  const abschnitt = `Abschnitt mit ${nrn.length === 1 ? 'Schritt' : 'den Schritten'} ${schritte} läuft mindestens einmal und erneut, ${solange}`
  if (!imSchritt) return `Wiederholung: Der folgende ${abschnitt}`
  if (verzweigt) return `Wiederholung: Der ${abschnitt}`
  return `Wiederholung: ${schritte} ${nrn.length === 1 ? 'läuft' : 'laufen'} mindestens einmal und erneut, ${solange}`
}

function aufgabe(k: Kontext, a: Aufgabe, bedingungen: Bedingung[], vorspann: string[], out: Abschnitt[]): void {
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
}

/** Kapitel 4 ohne Kapitelüberschrift und ohne das letzte Unterkapitel, dazu die Bedingungen je Aufgabe. */
export function ablaufBeschreibung(k: Kontext): Ablauf {
  const out: Abschnitt[] = []
  const bedingungen = new Map<Id, Bedingung[]>()
  /** Sätze zu Wiederholungen, die als erste Zeilen in das Unterkapitel der nächsten Aufgabe gehören */
  let vorspann: string[] = []
  /** Ablaufsatz, mit Anschluss, falls er sonst unter einer Aufgabe aus einem anderen Zweig stünde */
  const satz = (anschluss: string | null, text: string) => out.push({ art: 'absatz', text: anschluss ? `${anschluss}: ${text}` : text })

  /** Gibt den Anschluss zurück, den ein folgender Ablaufsatz braucht. */
  function sequenz(schritte: Block[], bed: Bedingung[], anschluss: string | null): string | null {
    let naechster = anschluss
    for (const b of schritte) naechster = block(b, bed, naechster)
    return naechster
  }

  /** `anschluss`: für den eigenen Ablaufsatz; Rückgabe: für den nächsten Baustein derselben Folge. */
  function block(b: Block, bed: Bedingung[], anschluss: string | null): string | null {
    switch (b.typ) {
      case 'aufgabe':
        bedingungen.set(b.id, bed)
        aufgabe(k, b, bed, vorspann, out)
        vorspann = []
        return null
      case 'entscheidung': {
        const frage = q(b.frage)
        if (b.art === 'ereignis') {
          satz(anschluss, `Es wird abgewartet, was zuerst eintritt (${frage}):`)
          out.push({ art: 'liste', punkte: b.zweige.map((z) => `${q(z.bezeichnung)} (${ereignisText(k, z)}): ${folge(k, z)}`) })
        } else {
          satz(anschluss, `Entscheidung ${frage}:`)
          out.push({ art: 'liste', punkte: b.zweige.map((z) => `${q(z.bezeichnung)}: ${folge(k, z)}`) })
        }
        const vorher = out.length
        for (const z of b.zweige) {
          const bz = b.art === 'ereignis' ? ereignisBedingung(z) : datenBedingung(frage, z)
          sequenz(z.schritte, [...bed, bz], `Wenn ${bz.nebensatz}`)
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
          sequenz(z.schritte, [...bed, bz], `Wenn ${bz.nebensatz}`)
        }
        return out.length > vorher ? `Nach der Entscheidung ${frage}` : null
      }
      case 'parallel': {
        const par = b as ParallelV3
        satz(
          anschluss,
          par.ausfuehrung === 'nacheinander'
            ? 'Die folgenden Zweige werden in beliebiger Reihenfolge nacheinander erledigt:'
            : par.zusammenfuehrung === 'erster'
              ? 'Die folgenden Zweige laufen gleichzeitig; weiter geht es, sobald der erste fertig ist:'
              : 'Die folgenden Zweige laufen gleichzeitig; weiter geht es, wenn alle fertig sind:',
        )
        out.push({ art: 'liste', punkte: b.zweige.map((z, i) => `Zweig ${i + 1}: ${bereich(k, z.schritte) ?? 'ohne Aufgaben'}`) })
        const vorher = out.length
        b.zweige.forEach((z, i) => sequenz(z.schritte, bed, `In Zweig ${i + 1}`))
        if (out.length === vorher) return null
        const nrn = bereich(k, [b])
        return `${par.ausfuehrung === 'nacheinander' ? 'Nach den Zweigen' : 'Nach den gleichzeitigen Zweigen'}${nrn ? ` (${nrn})` : ''}`
      }
      case 'wiederholung': {
        // Rücksprungbereich: kein eigener Absatz; was danach kommt, schließt an seinen letzten Baustein an
        if (b.modus !== 'anteil') return sequenz(b.koerper.schritte, bed, anschluss)
        const imSchritt = beginntMitAufgabe(b.koerper.schritte)
        const text = wiederholungsSatz(k, b, imSchritt)
        if (imSchritt) vorspann.push(text)
        else satz(anschluss, text)
        sequenz(b.koerper.schritte, bed, null)
        const nrn = bereich(k, b.koerper.schritte)
        return `Nach der Wiederholung${nrn ? ` (${nrn})` : ''}`
      }
      case 'warten': {
        const worauf = b.art === 'zeit' ? 'auf einen Zeitpunkt' : b.von ? `auf eine Nachricht von ${teilnehmerName(k.p, b.von)}` : 'auf eine Nachricht'
        satz(anschluss, `Warten: ${b.name.trim() || 'ohne Namen'} (${worauf}).`)
        return null
      }
      default: {
        const unbekannt: never = b
        throw new Error(`Kein Satzbaustein für den Baustein „${(unbekannt as Block).typ}“`)
      }
    }
  }

  sequenz(k.p.ablauf.schritte, [], null)
  // Folgt auf eine Wiederholung keine Aufgabe mehr (kann bei gültigen Bäumen nicht vorkommen), geht ihr Satz nicht verloren
  for (const zeile of vorspann) satz(null, zeile)
  return { abschnitte: out, bedingungen }
}

/** Abschnitte für Kapitel 4 ohne Kapitelüberschrift und ohne das letzte Unterkapitel. */
export function ablaufAbschnitte(k: Kontext): Abschnitt[] {
  return ablaufBeschreibung(k).abschnitte
}
