/**
 * Export im offenen Format Beratungsakte v1 (Kopie der Bibliothek in
 * src/beratungsakte). Die Akte fasst zusammen, was der Bericht zeigt; gerechnet
 * wird hier nichts Neues, nur mit denselben Funktionen wie in der Oberfläche.
 *
 * - Kennzahlen: die Zeilen der Kennzahlentabelle im Bericht, Werte des
 *   Ist-Prozesses; gibt es einen Soll-Prozess, steht dessen Wert im Namensraum.
 * - Befunde: die Befunde im Ist-Prozess, wie sie der Bericht zeigt (Prüfregeln
 *   und Schwachstellen, siehe `imBericht`).
 * - Maßnahmen: übernommene Maßnahmen, die noch offenen und die verworfenen
 *   Vorschläge aus dem Schritt „Verbessern“ mit ihrer berechneten Wirkung.
 *
 * Abbildung der Stufen:
 *
 * | Prozesslotse            | Beratungsakte |
 * | ----------------------- | ------------- |
 * | Befund `fehler`         | `hoch`        |
 * | Befund `warnung`        | `mittel`      |
 * | Befund `hinweis`        | `hinweis`     |
 * | Maßnahme übernommen     | Priorität `hoch` |
 * | Vorschlag (offen)       | Priorität `mittel` |
 * | Vorschlag verworfen     | Priorität `niedrig` |
 *
 * Der Stand jeder Maßnahme steht maschinenlesbar im Namensraum (`status`:
 * `uebernommen`, `vorschlag` oder `verworfen`). Verworfene Vorschläge bleiben
 * in der Akte, damit nachvollziehbar ist, was geprüft und bewusst nicht
 * umgesetzt wurde. Der Aufwand ist „nicht geschätzt“; die App kennt nur die Wirkung. Eine Maßnahme
 * antwortet auf einen Befund, wenn er einen der Schritte betrifft, die sie
 * umbaut, und von einer Art ist, die sie behebt (`BEHEBT`).
 */
import { erzeugeBeratungsakte, zeitpunktMitVersatz, type Befund as AkteBefund, type Beratungsakte, type Kennzahl, type Massnahme as AkteMassnahme, type Schwere as AkteSchwere } from '../beratungsakte/beratungsakte'
import { blockTitel, findeBlock } from '../modell/operationen'
import { pruefeProzess, sortiereBefunde, type Befund, type Schwere } from '../modell/pruefung'
import type { Projekt, Prozess } from '../modell/typen'
import { VERSION } from '../version'
import { imBericht, findeSchwachstellen } from './hinweise'
import { berechneKennzahlen, type Kennzahlen } from './kennzahlen'
import { bewerteVorschlaege, type RegelId, type Wirkung } from './regeln'
import { BERICHT_LAEUFE, simuliere } from './simulation'

export const APP_KENNUNG = 'prozesslotse'

export const SCHWERE_IN_AKTE: Record<Schwere, AkteSchwere> = {
  fehler: 'hoch',
  warnung: 'mittel',
  hinweis: 'hinweis',
}

/**
 * Welche Befunde (Art = Teil des Schlüssels vor dem ersten „:“) eine Regel an
 * ihren Schritten behebt. Wer eine Freigabe streicht, beseitigt auch ihre
 * Liegezeit und das Hin und Her zur freigebenden Rolle; Gleichzeitig ausführen
 * und Knock-out verkürzen den Ablauf, beheben aber keinen einzelnen Befund.
 */
export const BEHEBT: Record<RegelId, string[]> = {
  freigabe: ['freigabe', 'liegezeit', 'pingpong'],
  medienbruch: ['medienbruch'],
  zusammenlegen: ['liegezeit'],
  nacharbeit: ['nacharbeit'],
  parallelisieren: [],
  knockout: [],
}

export interface AkteAngaben {
  projekt: Projekt
  mandant: { name: string; kennung?: string }
  jetzt: Date
  /** Name der gespeicherten Projektdatei, falls es eine gibt. */
  quelldatei?: string | null
}

/** Vorbelegung für den Mandanten: der Name des Unternehmens aus der Compliance-Doku. */
export function mandantAusProjekt(projekt: Projekt): string {
  return projekt.compliance?.unternehmen.name.trim() ?? ''
}

const runde = (n: number, stellen = 2) => Math.round(n * 10 ** stellen) / 10 ** stellen

/** Kennungen in der Akte: nur ASCII-Buchstaben, Ziffern und `. _ : -`, höchstens 64 Zeichen, je Liste eindeutig. */
function kennungen() {
  const vergeben = new Set<string>()
  return (schluessel: string): string => {
    const basis = schluessel.replace(/[^A-Za-z0-9._:-]/g, '_').slice(0, 60) || 'eintrag'
    let k = basis
    for (let i = 2; vergeben.has(k); i++) k = `${basis}-${i}`
    vergeben.add(k)
    return k
  }
}

function kennzahlen(ist: Kennzahlen, p90Ist: number, soll: { k: Kennzahlen; p90: number } | null): Kennzahl[] {
  const zeile = (kennung: string, name: string, einheit: string, wert: (k: Kennzahlen, p90: number) => number | string): Kennzahl => {
    // Unendliche Werte (z. B. bei Fehlern im Modell) zeigt der Bericht nicht als Zahl; JSON kennt sie nicht.
    const endlich = (w: number | string) => (typeof w === 'number' && !Number.isFinite(w) ? 'nicht berechenbar' : w)
    const k: Kennzahl = { kennung, name, wert: endlich(wert(ist, p90Ist)), einheit }
    if (soll) k.erweiterungen = { [APP_KENNUNG]: { soll: endlich(wert(soll.k, soll.p90)) } }
    return k
  }
  return [
    zeile('durchlaufzeit', 'Durchlaufzeit im Schnitt', 'min', (k) => runde(k.durchlaufzeitMin)),
    zeile('durchlaufzeit-p90', '90 % fertig nach (Simulation)', 'min', (_, p90) => runde(p90)),
    zeile('flusseffizienz', 'Flusseffizienz', '%', (k) => runde(k.flusseffizienz * 100)),
    zeile('arbeitszeit', 'Arbeitszeit je Vorgang', 'min', (k) => runde(k.arbeitszeitMin)),
    zeile('kosten-je-vorgang', 'Kosten je Vorgang', '€', (k) => runde(k.kostenProVorgang)),
    zeile('kosten-pro-tag', 'Kosten pro Arbeitstag', '€', (k) => runde(k.kostenProTag)),
    zeile('vorgaenge-in-arbeit', 'Vorgänge in Arbeit (Little)', 'Anzahl', (k) => (k.stabil ? runde(k.offeneVorgaenge) : 'wächst (Überlast)')),
    zeile('medienbrueche', 'Medienbrüche je Vorgang', 'Anzahl', (k) => runde(k.medienbrueche)),
    zeile('uebergaben', 'Übergaben je Vorgang', 'Anzahl', (k) => runde(k.uebergaben)),
    zeile('hoechste-auslastung', 'Höchste Auslastung einer Rolle', '%', (k) => runde((k.engpass?.auslastung ?? 0) * 100)),
  ]
}

function fundstelle(p: Prozess, b: Befund): string {
  const block = b.blockId ? findeBlock(p, b.blockId)?.block : undefined
  if (block) return `Schritt „${blockTitel(block)}“`
  const rolle = b.rolleId ? p.rollen.find((r) => r.id === b.rolleId) : undefined
  if (rolle) return `Rolle „${rolle.name || 'Unbenannte Rolle'}“`
  return 'Gesamter Prozess'
}

function satz(titel: string, text: string): string {
  return /[.?!]$/.test(titel) ? `${titel} ${text}` : `${titel}. ${text}`
}

function wirkungGerundet(w: Wirkung): Wirkung {
  return {
    durchlaufzeitMin: runde(w.durchlaufzeitMin),
    kostenProVorgang: runde(w.kostenProVorgang),
    arbeitszeitMin: runde(w.arbeitszeitMin),
    medienbrueche: runde(w.medienbrueche),
    uebergaben: runde(w.uebergaben),
  }
}

/** Baut die Akte aus dem Projekt. Wirft, wenn der Mandant fehlt. */
export function beratungsakteAusProjekt({ projekt, mandant, jetzt, quelldatei }: AkteAngaben): Beratungsakte {
  if (!mandant.name.trim()) throw new Error('Bitte den Mandanten angeben.')
  const ist = projekt.ist
  const soll = projekt.soll

  const kIst = berechneKennzahlen(ist)
  const vergleich = soll ? { k: berechneKennzahlen(soll), p90: simuliere(soll, BERICHT_LAEUFE).p90Min } : null

  // Befunde wie im Bericht: Prüfregeln und Schwachstellen des Ist-Prozesses
  const appBefunde = sortiereBefunde([...pruefeProzess(ist), ...findeSchwachstellen(ist, kIst)]).filter(imBericht)
  const befundKennung = kennungen()
  const befunde: AkteBefund[] = appBefunde.map((b) => ({
    kennung: befundKennung(b.schluessel),
    schwere: SCHWERE_IN_AKTE[b.schwere],
    text: satz(b.titel, b.text),
    fundstelle: fundstelle(ist, b),
    erweiterungen: { [APP_KENNUNG]: { schwere: b.schwere, ...(b.quelle ? { quelle: b.quelle } : {}) } },
  }))
  const bezuege = (regel: string, blockIds: string[]) =>
    befunde
      .filter((_, i) => {
        const b = appBefunde[i]
        return b.blockId !== undefined && blockIds.includes(b.blockId) && (BEHEBT[regel as RegelId] ?? []).includes(b.schluessel.split(':')[0])
      })
      .map((b) => b.kennung)

  const massnahmeKennung = kennungen()
  const uebernommen: AkteMassnahme[] = projekt.massnahmen.map((m) => {
    const [regel, ...blockIds] = m.schluessel.split(':')
    return {
      kennung: massnahmeKennung(m.schluessel),
      text: satz(m.titel, m.begruendung),
      prioritaet: 'hoch',
      aufwand: 'nicht geschätzt',
      befunde: bezuege(regel, blockIds),
      erweiterungen: { [APP_KENNUNG]: { status: 'uebernommen', regel } },
    }
  })
  // Offene Vorschläge wie im Schritt „Verbessern“, danach die verworfenen (gleiche Bewertung, nur nicht ausgeblendet)
  const verworfen = new Set(projekt.verworfen)
  const vorschlaege = bewerteVorschlaege(soll ?? ist)
  const sortiert = [...vorschlaege.filter((v) => !verworfen.has(v.schluessel)), ...vorschlaege.filter((v) => verworfen.has(v.schluessel))]
  const offen: AkteMassnahme[] = sortiert.map((v) => {
    const istVerworfen = verworfen.has(v.schluessel)
    return {
      kennung: massnahmeKennung(v.schluessel),
      text: satz(v.titel, v.annahme ? `${v.begruendung} ${v.annahme}` : v.begruendung) + (istVerworfen ? ' (Vorschlag verworfen)' : ''),
      prioritaet: istVerworfen ? 'niedrig' : 'mittel',
      aufwand: 'nicht geschätzt',
      befunde: bezuege(v.regel, v.blockIds),
      erweiterungen: { [APP_KENNUNG]: { status: istVerworfen ? 'verworfen' : 'vorschlag', regel: v.regel, wirkung: wirkungGerundet(v.wirkung) } },
    }
  })

  return erzeugeBeratungsakte({
    app: { kennung: APP_KENNUNG, name: 'Prozesslotse', version: VERSION },
    mandant: { name: mandant.name.trim(), kennung: mandant.kennung?.trim() || undefined },
    analyse: { art: 'prozessanalyse', titel: ist.name.trim() || 'Unbenannter Prozess', stand: zeitpunktMitVersatz(jetzt).slice(0, 10), quelldatei: quelldatei ?? undefined },
    kennzahlen: kennzahlen(kIst, simuliere(ist, BERICHT_LAEUFE).p90Min, vergleich),
    befunde,
    massnahmen: [...uebernommen, ...offen],
    erweiterungen: { [APP_KENNUNG]: { vorgaengeProTag: ist.vorgaengeProTag, arbeitsstundenProTag: ist.arbeitsstundenProTag, sollProzess: soll !== null } },
    erzeugtAm: jetzt,
  })
}
