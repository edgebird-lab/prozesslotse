/**
 * Verbesserungsregeln. Jede Regel erkennt ein Muster im Prozess und liefert
 * eine Umformung. Die Wirkung wird nicht geschätzt, sondern berechnet: Der
 * umgeformte Prozess läuft durch dieselben Kennzahlen wie der alte.
 *
 * Die Regeln folgen bekannten Heuristiken der Prozessverbesserung
 * (u. a. Reijers & Limam Mansar 2005: Parallelisierung, Zusammenlegen von
 * Aufgaben, Kontrollen reduzieren, Integration statt Medienbruch).
 */
import { blockTitel, durchlaufe, ersetzeBereich, aendereBlock, entferneBlock, kinderSequenzen, mediumName, rolleName } from '../modell/operationen'
import { istDigital, type Aufgabe, type Block, type Id, type Prozess, type Sequenz } from '../modell/typen'
import { formatiereDauer, formatiereProzent } from '../modell/zeit'
import { berechneKennzahlen, type Kennzahlen } from './kennzahlen'

export type RegelId = 'parallelisieren' | 'medienbruch' | 'zusammenlegen' | 'nacharbeit' | 'freigabe'

export interface Vorschlag {
  schluessel: string
  regel: RegelId
  titel: string
  begruendung: string
  /** Annahme, auf der die berechnete Wirkung beruht, falls nötig. */
  annahme: string | null
  blockIds: Id[]
  anwenden: (p: Prozess) => Prozess
}

export interface Wirkung {
  durchlaufzeitMin: number
  kostenProVorgang: number
  arbeitszeitMin: number
  medienbrueche: number
  uebergaben: number
}

export interface BewerteterVorschlag extends Vorschlag {
  nachher: Kennzahlen
  /** Differenz nachher minus vorher; negativ heißt besser. */
  wirkung: Wirkung
}

export const NACHARBEIT_REGEL_SCHWELLE = 0.15
export const FREIGABE_REGEL_SCHWELLE = 0.9

function rollenIn(b: Block): Set<Id | null> {
  const rollen = new Set<Id | null>()
  const sammle = (x: Block) => {
    if (x.typ === 'aufgabe') rollen.add(x.rolleId)
    for (const s of kinderSequenzen(x)) s.schritte.forEach(sammle)
  }
  sammle(b)
  return rollen
}

function kannEnden(b: Block): boolean {
  if (b.typ === 'entscheidung' && b.zweige.some((z) => z.ende !== null)) return true
  return kinderSequenzen(b).some((s) => s.schritte.some(kannEnden))
}

function alleSequenzen(p: Prozess): Sequenz[] {
  const liste: Sequenz[] = [p.ablauf]
  for (const { block } of durchlaufe(p.ablauf)) liste.push(...kinderSequenzen(block))
  return liste
}

function erstesWort(s: string): string {
  return s.trim().split(/\s+/)[0] ?? ''
}

/** „Rechnung erstellen“ + „Rechnung versenden“ → „Rechnung erstellen und versenden“. */
export function verbindeNamen(a: string, b: string): string {
  const wa = erstesWort(a)
  if (wa && wa === erstesWort(b)) return `${a.trim()} und ${b.trim().slice(wa.length).trim()}`
  return `${a.trim()} und ${b.trim()}`
}

export function findeVorschlaege(p: Prozess): Vorschlag[] {
  const vorschlaege: Vorschlag[] = []
  const std = p.arbeitsstundenProTag
  const medium = (id: Id | null) => p.medien.find((m) => m.id === id)

  for (const seq of alleSequenzen(p)) {
    seq.schritte.forEach((b, i) => {
      const a = i > 0 ? seq.schritte[i - 1] : null

      // 1. Gleichzeitig ausführen
      if (a && b.typ === 'aufgabe' && b.brauchtVorgaenger === false && b.rolleId !== null && !rollenIn(a).has(b.rolleId) && !kannEnden(a)) {
        const parId = `par_${b.id}`
        vorschlaege.push({
          schluessel: `parallelisieren:${a.id}:${b.id}`,
          regel: 'parallelisieren',
          titel: `„${blockTitel(b)}“ gleichzeitig mit „${blockTitel(a)}“ erledigen`,
          begruendung: `„${blockTitel(b)}“ braucht das Ergebnis des vorherigen Schritts nicht. ${rolleName(p, b.rolleId)} kann sofort beginnen, statt zu warten, bis „${blockTitel(a)}“ fertig ist.`,
          annahme: null,
          blockIds: [a.id, b.id],
          anwenden: (q) =>
            ersetzeBereichFuer(q, seq.id, a.id, 2, [
              {
                typ: 'parallel',
                id: parId,
                zweige: [
                  { id: `${parId}_a`, schritte: [a] },
                  { id: `${parId}_b`, schritte: [{ ...b, brauchtVorgaenger: null }] },
                ],
              },
            ]),
        })
      }

      // 3. Zusammenlegen
      if (
        a?.typ === 'aufgabe' &&
        b.typ === 'aufgabe' &&
        a.rolleId !== null &&
        a.rolleId === b.rolleId &&
        b.liegezeitMin > 0 &&
        a.art === 'normal' &&
        b.art === 'normal'
      ) {
        const abtippenEntfaellt = b.uebertragung !== null && b.uebertragung.quelleMediumId === a.mediumId
        const mb = medium(b.mediumId)
        const zusammen: Aufgabe = {
          ...a,
          name: verbindeNamen(a.name, b.name),
          mediumId: mb && istDigital(mb.art) ? b.mediumId : a.mediumId,
          bearbeitungMin: a.bearbeitungMin + b.bearbeitungMin - (abtippenEntfaellt ? b.uebertragung!.minuten : 0),
          uebertragung: a.uebertragung ?? (abtippenEntfaellt ? null : b.uebertragung),
        }
        vorschlaege.push({
          schluessel: `zusammenlegen:${a.id}:${b.id}`,
          regel: 'zusammenlegen',
          titel: `„${blockTitel(a)}“ und „${blockTitel(b)}“ zusammenlegen`,
          begruendung:
            `Beide Schritte erledigt ${rolleName(p, a.rolleId)}. In einem Zug entfällt die Liegezeit von ${formatiereDauer(b.liegezeitMin, std)} dazwischen` +
            (abtippenEntfaellt ? `, und die Daten aus „${mediumName(p, a.mediumId)}“ müssen nicht mehr abgetippt werden.` : '.'),
          annahme: null,
          blockIds: [a.id, b.id],
          anwenden: (q) => ersetzeBereichFuer(q, seq.id, a.id, 2, [zusammen]),
        })
      }

      if (b.typ === 'aufgabe') {
        // 2. Medienbruch beseitigen
        if (b.uebertragung) {
          const quelle = medium(b.uebertragung.quelleMediumId)
          const ziel = mediumName(p, b.mediumId)
          const abhilfe =
            quelle && !istDigital(quelle.art)
              ? 'Die Daten gleich dort digital erfassen, wo sie entstehen (z. B. Formular auf Tablet oder Eingabe direkt im System)'
              : 'Eine Schnittstelle oder ein Import zwischen den Systemen'
          const minuten = b.uebertragung.minuten
          vorschlaege.push({
            schluessel: `medienbruch:${b.id}`,
            regel: 'medienbruch',
            titel: `Medienbruch bei „${blockTitel(b)}“ beseitigen`,
            begruendung: `Daten aus „${quelle?.name ?? 'einem anderen Medium'}“ werden von Hand in „${ziel}“ übertragen. ${abhilfe} spart ${formatiereDauer(minuten, std)} je Ausführung und vermeidet Tippfehler.`,
            annahme: null,
            blockIds: [b.id],
            anwenden: (q) =>
              aendereBlock(q, b.id, (x) => (x.typ === 'aufgabe' ? { ...x, uebertragung: null, bearbeitungMin: Math.max(0, x.bearbeitungMin - minuten) } : x)),
          })
        }

        // 5. Freigabe streichen
        if (b.art === 'freigabe' && b.freigabeQuote >= FREIGABE_REGEL_SCHWELLE) {
          vorschlaege.push({
            schluessel: `freigabe:${b.id}`,
            regel: 'freigabe',
            titel: `Freigabe „${blockTitel(b)}“ streichen`,
            begruendung: `Sie wird in ${formatiereProzent(b.freigabeQuote)} der Fälle erteilt, kostet aber ${formatiereDauer(b.liegezeitMin + b.bearbeitungMin, std)} Durchlaufzeit je Ausführung. Alternativ nur ab einem Betrag oder stichprobenartig freigeben.`,
            annahme: 'Angenommen wird, dass die Kontrolle ohne Nachteil entfallen kann, weil Fehler selten sind und später auffallen.',
            blockIds: [b.id],
            anwenden: (q) => entferneBlock(q, b.id),
          })
        }
      }

      // 4. Nacharbeit senken
      if (b.typ === 'wiederholung' && b.anteilWiederholung >= NACHARBEIT_REGEL_SCHWELLE && b.anteilWiederholung < 1) {
        const neu = b.anteilWiederholung / 2
        vorschlaege.push({
          schluessel: `nacharbeit:${b.id}`,
          regel: 'nacharbeit',
          titel: `Nacharbeit bei „${b.frage || 'Wiederholung'}“ halbieren`,
          begruendung: `In ${formatiereProzent(b.anteilWiederholung)} der Durchläufe wird wiederholt. Klare Vorgaben, Checklisten oder eine Prüfung direkt dort, wo der Fehler entsteht, senken die Quote.`,
          annahme: `Angenommen wird, dass die Wiederholungsquote von ${formatiereProzent(b.anteilWiederholung)} auf ${formatiereProzent(neu)} sinkt.`,
          blockIds: [b.id],
          anwenden: (q) => aendereBlock(q, b.id, (x) => (x.typ === 'wiederholung' ? { ...x, anteilWiederholung: neu } : x)),
        })
      }
    })
  }
  return vorschlaege
}

/** Ersetzt ab dem Block `startId` in der Sequenz `sequenzId` eine Anzahl Schritte. */
function ersetzeBereichFuer(q: Prozess, sequenzId: Id, startId: Id, anzahl: number, neu: Block[]): Prozess {
  const seq = alleSequenzen(q).find((s) => s.id === sequenzId)
  const start = seq?.schritte.findIndex((b) => b.id === startId) ?? -1
  return start < 0 ? q : ersetzeBereich(q, sequenzId, start, anzahl, neu)
}

function differenz(vorher: Kennzahlen, nachher: Kennzahlen): Wirkung {
  return {
    durchlaufzeitMin: nachher.durchlaufzeitMin - vorher.durchlaufzeitMin,
    kostenProVorgang: nachher.kostenProVorgang - vorher.kostenProVorgang,
    arbeitszeitMin: nachher.arbeitszeitMin - vorher.arbeitszeitMin,
    medienbrueche: nachher.medienbrueche - vorher.medienbrueche,
    uebergaben: nachher.uebergaben - vorher.uebergaben,
  }
}

function bringtEtwas(w: Wirkung): boolean {
  return w.durchlaufzeitMin < -0.01 || w.kostenProVorgang < -0.001 || w.medienbrueche < -1e-6 || w.uebergaben < -1e-6
}

/**
 * Bewertet alle Vorschläge für einen Prozess, lässt verworfene und wirkungslose
 * weg und sortiert nach gesparter Durchlaufzeit, dann nach gesparten Kosten.
 */
export function bewerteVorschlaege(p: Prozess, verworfen: Iterable<string> = []): BewerteterVorschlag[] {
  const aus = new Set(verworfen)
  const vorher = berechneKennzahlen(p)
  return findeVorschlaege(p)
    .filter((v) => !aus.has(v.schluessel))
    .map((v) => {
      const nachher = berechneKennzahlen(v.anwenden(p))
      return { ...v, nachher, wirkung: differenz(vorher, nachher) }
    })
    .filter((v) => bringtEtwas(v.wirkung))
    .sort((a, b) => a.wirkung.durchlaufzeitMin - b.wirkung.durchlaufzeitMin || a.wirkung.kostenProVorgang - b.wirkung.kostenProVorgang)
}
