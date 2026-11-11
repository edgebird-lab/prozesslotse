/**
 * Kapitel 4 der Verfahrensdokumentation: Ablaufbeschreibung aus dem
 * Prozessbaum (Spezifikation 6.6.1). Jede Aufgabe wird ein Unterkapitel
 * „4.k“; Verzweigungen erscheinen als Absatz mit Liste ihrer Ausgänge, und die
 * Aufgaben darin erben die Bedingung („Nur wenn: …“). Zeiten, Anteile und
 * Anzahlen erscheinen nicht.
 *
 * Die Bausteinart wird erschöpfend geprüft: Kommt ein Baustein hinzu, meldet
 * TypeScript einen Fehler, statt dass er im Dokument still fehlt.
 */
import { bereichTitel, durchlaufe, findeBlock, teilnehmerName } from '../modell/operationen'
import type { Aufgabe, Block, EntscheidungsZweig, Id, Parallel } from '../modell/typen'
import { kontrollAngaben, objektName, objekteVon, type Kontext } from './ableitung'
import { KONTROLLARTEN, NACHWEISE, textVon } from './standard'
import type { Abschnitt } from './typen'

/** Felder aus Format 3, die der Code von `main` noch nicht kennt (docs/modellierung-v3.md); gelesen, falls vorhanden. */
type MitAbbruch = EntscheidungsZweig & { beendetAlles?: boolean }
type ParallelV3 = Parallel & { zusammenfuehrung?: 'alle' | 'erster'; ausfuehrung?: 'gleichzeitig' | 'nacheinander' }

function q(text: string, leer = 'offen'): string {
  return `„${text.trim() || leer}“`
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

function zurueck(k: Kontext, zielId: Id): string {
  const ziel = findeBlock(k.p, zielId)?.block
  if (!ziel) return 'zurück zu einem früheren Schritt'
  const nrn = ziel.typ === 'wiederholung' ? aufgabenNummern(k, ziel.koerper.schritte) : aufgabenNummern(k, [ziel])
  return nrn.length > 0 ? `zurück zu ${nrn[0]}` : `zurück zum Anfang von ${q(bereichTitel(ziel))}`
}

/** Was nach einem Ausgang einer Entscheidung geschieht. */
function folge(k: Kontext, z: MitAbbruch): string {
  const erste = aufgabenNummern(k, z.schritte)[0]
  const ende = z.ende !== null ? (z.ende.trim() ? ` mit „${z.ende.trim()}“` : '') : null
  if (erste) {
    if (ende !== null) return z.beendetAlles ? `weiter mit ${erste}, danach endet der gesamte Vorgang sofort${ende}` : `weiter mit ${erste}, danach endet der Vorgang${ende}`
    if (z.zurueckZu) return `weiter mit ${erste}, danach ${zurueck(k, z.zurueckZu)}`
    return `weiter mit ${erste}`
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

function aufgabe(k: Kontext, a: Aufgabe, bedingungen: string[], out: Abschnitt[]): void {
  const absatz = (text: string) => out.push({ art: 'absatz', text })
  out.push({ art: 'ueberschrift', ebene: 2, nummer: k.nummer.get(a.id) ?? '4.?', text: a.name.trim() || 'Unbenannter Schritt' })
  if (bedingungen.length > 0) absatz(`Nur wenn: ${bedingungen.join(', ')}.`)
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

/** Abschnitte für Kapitel 4 ohne Kapitelüberschrift und ohne das letzte Unterkapitel. */
export function ablaufAbschnitte(k: Kontext): Abschnitt[] {
  const out: Abschnitt[] = []
  const absatz = (text: string) => out.push({ art: 'absatz', text })
  const sequenz = (schritte: Block[], bedingungen: string[]) => schritte.forEach((b) => block(b, bedingungen))

  function block(b: Block, bed: string[]): void {
    switch (b.typ) {
      case 'aufgabe':
        aufgabe(k, b, bed, out)
        return
      case 'entscheidung': {
        const frage = b.frage.trim() || 'offen'
        if (b.art === 'ereignis') {
          absatz(`Es wird abgewartet, was zuerst eintritt („${frage}“):`)
          out.push({ art: 'liste', punkte: b.zweige.map((z) => `${q(z.bezeichnung)} (${ereignisText(k, z)}): ${folge(k, z)}`) })
          for (const z of b.zweige) sequenz(z.schritte, [...bed, `${q(z.bezeichnung)} tritt zuerst ein`])
        } else {
          absatz(`Entscheidung „${frage}“:`)
          out.push({ art: 'liste', punkte: b.zweige.map((z) => `${q(z.bezeichnung)}: ${folge(k, z)}`) })
          for (const z of b.zweige) sequenz(z.schritte, [...bed, `„${frage}“ = ${q(z.bezeichnung)}`])
        }
        return
      }
      case 'oder': {
        absatz(`Je nach Fall laufen einer oder mehrere dieser Wege („${b.frage.trim() || 'offen'}“):`)
        out.push({ art: 'liste', punkte: b.zweige.map((z) => `${q(z.bezeichnung)}: ${bereich(k, z.schritte) ?? 'ohne Aufgaben'}${z.id === b.standard ? ' (wenn keiner zutrifft)' : ''}`) })
        for (const z of b.zweige) sequenz(z.schritte, [...bed, `${q(z.bezeichnung)} trifft zu`])
        return
      }
      case 'parallel': {
        const par = b as ParallelV3
        absatz(
          par.ausfuehrung === 'nacheinander'
            ? 'Die folgenden Zweige werden in beliebiger Reihenfolge nacheinander erledigt:'
            : par.zusammenfuehrung === 'erster'
              ? 'Die folgenden Zweige laufen gleichzeitig; weiter geht es, sobald der erste fertig ist:'
              : 'Die folgenden Zweige laufen gleichzeitig; weiter geht es, wenn alle fertig sind:',
        )
        out.push({ art: 'liste', punkte: b.zweige.map((z, i) => `Zweig ${i + 1}: ${bereich(k, z.schritte) ?? 'ohne Aufgaben'}`) })
        for (const z of b.zweige) sequenz(z.schritte, bed)
        return
      }
      case 'wiederholung': {
        if (b.modus === 'anteil') {
          const nrn = aufgabenNummern(k, b.koerper.schritte)
          const solange = `solange gilt: „${b.frage.trim() || 'offen'}“.`
          absatz(
            nrn.length > 1
              ? `Die Schritte ${nrn[0]} bis ${nrn[nrn.length - 1]} laufen mindestens einmal und werden wiederholt, ${solange}`
              : nrn.length === 1
                ? `Der Schritt ${nrn[0]} läuft mindestens einmal und wird wiederholt, ${solange}`
                : `Der folgende Abschnitt läuft mindestens einmal und wird wiederholt, ${solange}`,
          )
        }
        sequenz(b.koerper.schritte, bed)
        return
      }
      case 'warten': {
        const worauf = b.art === 'zeit' ? 'auf einen Zeitpunkt' : b.von ? `auf eine Nachricht von ${teilnehmerName(k.p, b.von)}` : 'auf eine Nachricht'
        absatz(`Warten: ${b.name.trim() || 'ohne Namen'} (${worauf}).`)
        return
      }
      default: {
        const unbekannt: never = b
        throw new Error(`Kein Satzbaustein für den Baustein „${(unbekannt as Block).typ}“`)
      }
    }
  }

  sequenz(k.p.ablauf.schritte, [])
  return out
}
