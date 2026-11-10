/**
 * Schwachstellen, die sich aus den Kennzahlen ergeben. Anders als die
 * Prüfregeln des Modells sind das keine Fehler, sondern begründete Hinweise.
 */
import { bereichTitel, blockTitel, durchlaufe, folgtEntscheidung, freigabeQuote, mediumName, rolleName } from '../modell/operationen'
import { sortiereBefunde, type Befund } from '../modell/pruefung'
import type { Aufgabe, Id, Prozess } from '../modell/typen'
import { formatiereDauer, formatiereProzent, formatiereZahl } from '../modell/zeit'
import type { Kennzahlen } from './kennzahlen'
import { bedienende, WARTEFAKTOR_SCHWELLE } from './warteschlange'

export { WARTEFAKTOR_SCHWELLE }
/** Ab diesem Anteil an der Durchlaufzeit gilt eine Liegezeit als auffällig. */
export const LIEGEZEIT_SCHWELLE = 0.2
export const FLUSSEFFIZIENZ_SCHWELLE = 0.1
export const NACHARBEIT_SCHWELLE = 0.1
export const FREIGABE_SCHWELLE = 0.9
const PINGPONG_SCHWELLE = 0.05

function personenText(n: number, dativ = false): string {
  return n === 1 ? (dativ ? 'einer Person' : 'eine Person') : `${n} Personen`
}

export function findeSchwachstellen(p: Prozess, k: Kennzahlen): Befund[] {
  const befunde: Befund[] = []
  const add = (b: Befund) => befunde.push(b)
  const std = p.arbeitsstundenProTag
  const aufgaben = new Map<Id, Aufgabe>()

  for (const r of k.rollen) {
    if (r.stundenProTag <= 0) continue
    const name = r.rolle.name || 'Rolle'
    if (r.auslastung > 1) {
      add({
        schluessel: `ueberlastet:${r.rolle.id}`,
        schwere: 'fehler',
        titel: `${name} ist überlastet`,
        text: `Gebraucht werden ${formatiereZahl(r.stundenProTag)} Std. pro Tag, verfügbar sind ${formatiereZahl(r.kapazitaetStundenProTag)} Std. (${formatiereProzent(r.auslastung)}). Der Rückstau wächst jeden Tag.`,
        rolleId: r.rolle.id,
      })
    } else if (r.wartefaktor >= WARTEFAKTOR_SCHWELLE) {
      const team = personenText(bedienende(r.rolle.personen), true)
      const warten = Number.isFinite(r.wartefaktor)
        ? `Arbeit wartet hier im Schnitt ${formatiereZahl(r.wartefaktor, 1)}-mal so lange, bis jemand frei ist, wie sie dauert; jede Schwankung und jeder Ausfall erzeugt Rückstau.`
        : 'Ohne jeden Puffer staut sich jede Schwankung auf.'
      add({
        schluessel: `engpass:${r.rolle.id}`,
        schwere: 'warnung',
        titel: `Engpass: ${name}`,
        text: `Auslastung ${formatiereProzent(r.auslastung)} bei ${team}. ${warten} Bei dieser Teamgröße beginnt das ab etwa ${formatiereProzent(r.engpassSchwelle)} (Warteschlangenmodell M/M/c).`,
        rolleId: r.rolle.id,
      })
    }
  }

  for (const fund of durchlaufe(p.ablauf)) {
    const block = fund.block
    const kz = k.schritte.get(block.id)
    if (block.typ === 'aufgabe') {
      aufgaben.set(block.id, block)
      if (kz && k.durchlaufzeitMin > 0 && kz.beitragWartenMin / k.durchlaufzeitMin >= LIEGEZEIT_SCHWELLE) {
        add({
          schluessel: `liegezeit:${block.id}`,
          schwere: 'warnung',
          titel: 'Lange Liegezeit',
          text: `Vor „${blockTitel(block)}“ liegt der Vorgang ${formatiereDauer(block.liegezeitMin, std)}, das sind ${formatiereProzent(kz.beitragWartenMin / k.durchlaufzeitMin)} der Durchlaufzeit. Ursache klären: Stapelbearbeitung, Vertretung, feste Termine?`,
          blockId: block.id,
        })
      }
      if (block.uebertragung) {
        const quelle = block.uebertragung.quelleMediumId ? mediumName(p, block.uebertragung.quelleMediumId) : 'einem anderen Medium'
        const haeufigkeit = kz?.haeufigkeit ?? 0
        const imSchnitt =
          Math.abs(haeufigkeit - 1) > 0.01
            ? `, im Schnitt ${formatiereDauer(haeufigkeit * block.uebertragung.minuten, std)} pro Vorgang`
            : ''
        add({
          schluessel: `medienbruch:${block.id}`,
          schwere: 'warnung',
          titel: 'Medienbruch',
          text: `Bei „${blockTitel(block)}“ werden Daten aus ${quelle} von Hand in ${mediumName(p, block.mediumId)} übertragen: ${formatiereDauer(block.uebertragung.minuten, std)} je Ausführung${imSchnitt}. Abtippen kostet Zeit und erzeugt Fehler.`,
          blockId: block.id,
        })
      }
      if (block.art !== 'normal') {
        const kontrolle = block.art === 'freigabe' ? 'Freigabe' : 'Prüfung'
        const folge = folgtEntscheidung(p, fund)
        const ohneFolge = folge
          ? ''
          : ` Danach folgt keine Entscheidung: Was geschieht, wenn ${block.art === 'freigabe' ? 'nicht freigegeben wird' : 'die Prüfung einen Fehler findet'}?`
        const quote = block.art === 'freigabe' ? freigabeQuote(fund) : null
        if (quote && quote.quote >= FREIGABE_SCHWELLE) {
          add({
            schluessel: `freigabe:${block.id}`,
            schwere: 'hinweis',
            titel: 'Freigabe fast immer erteilt',
            text: `„${blockTitel(block)}“ wird in ${formatiereProzent(quote.quote)} der Fälle erteilt, kostet aber ${formatiereDauer(block.liegezeitMin + block.bearbeitungMin, std)} Durchlaufzeit je Ausführung.${ohneFolge} Lohnt sie sich, oder reicht eine Schwelle oder Stichprobe?`,
            blockId: block.id,
          })
        } else if (!folge) {
          add({
            schluessel: `ohnefolge:${block.id}`,
            schwere: 'hinweis',
            titel: `${kontrolle} ohne Folge`,
            text: `Nach „${blockTitel(block)}“ folgt keine Entscheidung. Was geschieht, wenn ${block.art === 'freigabe' ? 'nicht freigegeben wird' : 'die Prüfung einen Fehler findet'}? Ohne Folge ist die Kontrolle nur Aufwand: den Weg für den Fehlerfall ergänzen oder die Kontrolle streichen.`,
            blockId: block.id,
          })
        }
      }
    } else if (block.typ === 'warten') {
      if (kz && k.durchlaufzeitMin > 0 && kz.beitragWartenMin / k.durchlaufzeitMin >= LIEGEZEIT_SCHWELLE) {
        add({
          schluessel: `warten:${block.id}`,
          schwere: 'hinweis',
          titel: 'Lange Wartezeit',
          text: `„${blockTitel(block)}“ macht ${formatiereProzent(kz.beitragWartenMin / k.durchlaufzeitMin)} der Durchlaufzeit aus.`,
          blockId: block.id,
        })
      }
    } else if (block.typ === 'wiederholung') {
      // Anteil der Durchläufe, nach denen wiederholt wird; bei „anteil“ ohne die, die vorher enden
      const r = k.wiederholAnteil.get(block.id) ?? 0
      const ziel = block.koerper.schritte[0] ? bereichTitel(block.koerper.schritte[0]) : 'Anfang'
      const name = block.modus === 'ruecksprung' ? `ab „${ziel}“` : `bei „${block.frage || 'Wiederholung'}“`
      if (block.modus === 'ruecksprung' && r >= 0.999) {
        add({
          schluessel: `endlos:${block.id}`,
          schwere: 'fehler',
          titel: 'Endlosschleife',
          text: `Jeder Durchlauf springt zurück zu „${ziel}“; der Vorgang kommt nie weiter. Mindestens ein Ausgang muss weiterführen oder enden.`,
          blockId: block.id,
        })
      } else if (block.zweck !== 'menge' && r >= NACHARBEIT_SCHWELLE && r < 0.999) {
        add({
          schluessel: `nacharbeit:${block.id}`,
          schwere: 'hinweis',
          titel: block.modus === 'ruecksprung' ? 'Nacharbeit durch Rücksprung' : 'Nacharbeit',
          text: `Die Schritte ${name} werden in ${formatiereProzent(r)} der Durchläufe wiederholt und laufen im Schnitt ${formatiereZahl(1 / (1 - r), 2)}-mal. Fehler an der Quelle zu vermeiden spart Arbeit und Zeit.`,
          blockId: block.id,
        })
      }
    } else if (block.typ === 'entscheidung' && block.art === 'ereignis') {
      for (const zweig of block.zweige) {
        const kz = k.schritte.get(zweig.id)
        if (kz && k.durchlaufzeitMin > 0 && kz.beitragWartenMin / k.durchlaufzeitMin >= LIEGEZEIT_SCHWELLE) {
          add({
            schluessel: `warten:${zweig.id}`,
            schwere: 'hinweis',
            titel: 'Lange Wartezeit',
            text: `Das Warten auf „${zweig.bezeichnung}“ macht ${formatiereProzent(kz.beitragWartenMin / k.durchlaufzeitMin)} der Durchlaufzeit aus.`,
            blockId: block.id,
          })
        }
      }
    } else if (block.typ === 'parallel') {
      // Dieselbe Rolle in mehr Zweigen, als sie Personen hat: Sie kann nicht an zwei Stellen zugleich arbeiten.
      const zweigeJeRolle = new Map<Id, number>()
      for (const z of block.zweige) {
        const rollen = new Set<Id>()
        for (const { block: x } of durchlaufe(z)) if (x.typ === 'aufgabe' && x.rolleId) rollen.add(x.rolleId)
        for (const id of rollen) zweigeJeRolle.set(id, (zweigeJeRolle.get(id) ?? 0) + 1)
      }
      for (const [id, anzahl] of zweigeJeRolle) {
        const rolle = p.rollen.find((r) => r.id === id)
        if (!rolle || anzahl < 2 || anzahl <= bedienende(rolle.personen)) continue
        add({
          schluessel: `parallelrolle:${block.id}:${id}`,
          schwere: 'hinweis',
          titel: 'Gleichzeitig, aber dieselben Leute',
          text: `In ${anzahl} Zweigen von „Gleichzeitig“ arbeitet ${rolle.name || 'dieselbe Rolle'}, die Rolle hat aber nur ${personenText(bedienende(rolle.personen))}. Wer an zwei Stellen zugleich arbeiten müsste, arbeitet tatsächlich nacheinander; die berechnete Durchlaufzeit ist dann zu niedrig.`,
          blockId: block.id,
          rolleId: id,
        })
      }
    }
  }

  // Hin und Her: Rolle A → B → A rund um eine Aufgabe von B.
  const vor = new Map<Id, Map<Id | null, number>>()
  const nach = new Map<Id, Map<Id | null, number>>()
  for (const [paar, w] of k.paare) {
    const [von, zu] = paar.split('>')
    const a = aufgaben.get(von)
    const b = aufgaben.get(zu)
    if (!a || !b) continue
    const mv = vor.get(zu) ?? new Map<Id | null, number>()
    mv.set(a.rolleId, (mv.get(a.rolleId) ?? 0) + w)
    vor.set(zu, mv)
    const mn = nach.get(von) ?? new Map<Id | null, number>()
    mn.set(b.rolleId, (mn.get(b.rolleId) ?? 0) + w)
    nach.set(von, mn)
  }
  for (const [id, a] of aufgaben) {
    const davor = vor.get(id)
    const danach = nach.get(id)
    if (!davor || !danach) continue
    for (const [rolle, w] of davor) {
      if (rolle === null || rolle === a.rolleId) continue
      const zurueck = danach.get(rolle) ?? 0
      if (Math.min(w, zurueck) >= PINGPONG_SCHWELLE) {
        add({
          schluessel: `pingpong:${id}:${rolle}`,
          schwere: 'hinweis',
          titel: 'Hin und Her zwischen Rollen',
          text: `Der Vorgang geht von ${rolleName(p, rolle)} zu ${rolleName(p, a.rolleId)} („${blockTitel(a)}“) und gleich wieder zurück. Jede Übergabe kostet Liegezeit; kann eine Rolle beides erledigen oder der Schritt woanders hin?`,
          blockId: id,
        })
      }
    }
  }

  if (k.durchlaufzeitMin > 0 && k.flusseffizienz < FLUSSEFFIZIENZ_SCHWELLE) {
    add({
      schluessel: 'flusseffizienz',
      schwere: 'hinweis',
      titel: 'Niedrige Flusseffizienz',
      text: `Nur ${formatiereProzent(k.flusseffizienz, 1)} der Durchlaufzeit wird gearbeitet, den Rest liegt der Vorgang. Hebel sind die Liegezeiten, nicht schnelleres Arbeiten.`,
    })
  }

  return sortiereBefunde(befunde)
}
