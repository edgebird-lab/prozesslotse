/**
 * Schwachstellen, die sich aus den Kennzahlen ergeben. Anders als die
 * Prüfregeln des Modells sind das keine Fehler, sondern begründete Hinweise.
 */
import { blockTitel, durchlaufe, mediumName, rolleName } from '../modell/operationen'
import { sortiereBefunde, type Befund } from '../modell/pruefung'
import type { Aufgabe, Id, Prozess } from '../modell/typen'
import { formatiereDauer, formatiereProzent, formatiereZahl } from '../modell/zeit'
import type { Kennzahlen } from './kennzahlen'

/** Ab dieser Auslastung staut sich Arbeit spürbar (Faustregel der Warteschlangentheorie). */
export const ENGPASS_SCHWELLE = 0.85
/** Ab diesem Anteil an der Durchlaufzeit gilt eine Liegezeit als auffällig. */
export const LIEGEZEIT_SCHWELLE = 0.2
export const FLUSSEFFIZIENZ_SCHWELLE = 0.1
export const NACHARBEIT_SCHWELLE = 0.1
export const FREIGABE_SCHWELLE = 0.9
const PINGPONG_SCHWELLE = 0.05

export function findeSchwachstellen(p: Prozess, k: Kennzahlen): Befund[] {
  const befunde: Befund[] = []
  const add = (b: Befund) => befunde.push(b)
  const std = p.arbeitsstundenProTag
  const aufgaben = new Map<Id, Aufgabe>()

  for (const r of k.rollen) {
    if (r.stundenProTag <= 0) continue
    if (r.auslastung > 1) {
      add({
        schluessel: `ueberlastet:${r.rolle.id}`,
        schwere: 'fehler',
        titel: `${r.rolle.name || 'Rolle'} ist überlastet`,
        text: `Gebraucht werden ${formatiereZahl(r.stundenProTag)} Std. pro Tag, verfügbar sind ${formatiereZahl(r.kapazitaetStundenProTag)} Std. (${formatiereProzent(r.auslastung)}). Der Rückstau wächst jeden Tag.`,
        rolleId: r.rolle.id,
      })
    } else if (r.auslastung >= ENGPASS_SCHWELLE) {
      add({
        schluessel: `engpass:${r.rolle.id}`,
        schwere: 'warnung',
        titel: `Engpass: ${r.rolle.name || 'Rolle'}`,
        text: `Auslastung ${formatiereProzent(r.auslastung)}. Ab etwa ${formatiereProzent(ENGPASS_SCHWELLE)} steigen Wartezeiten stark an, weil jede Schwankung sofort Rückstau erzeugt.`,
        rolleId: r.rolle.id,
      })
    }
  }

  for (const { block } of durchlaufe(p.ablauf)) {
    const kz = k.schritte.get(block.id)
    if (block.typ === 'aufgabe') {
      aufgaben.set(block.id, block)
      if (kz && k.durchlaufzeitMin > 0 && kz.beitragWartenMin / k.durchlaufzeitMin >= LIEGEZEIT_SCHWELLE) {
        add({
          schluessel: `liegezeit:${block.id}`,
          schwere: 'warnung',
          titel: 'Lange Liegezeit',
          text: `Vor „${blockTitel(block)}“ liegt der Vorgang ${formatiereDauer(block.liegezeitMin, std)}. Das sind ${formatiereProzent(kz.beitragWartenMin / k.durchlaufzeitMin)} der Durchlaufzeit. Ursache klären: Stapelbearbeitung, Vertretung, feste Termine?`,
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
      if (block.art === 'freigabe' && block.freigabeQuote >= FREIGABE_SCHWELLE) {
        add({
          schluessel: `freigabe:${block.id}`,
          schwere: 'hinweis',
          titel: 'Freigabe fast immer erteilt',
          text: `„${blockTitel(block)}“ wird in ${formatiereProzent(block.freigabeQuote)} der Fälle erteilt, kostet aber ${formatiereDauer(block.liegezeitMin + block.bearbeitungMin, std)} Durchlaufzeit je Ausführung. Lohnt sie sich, oder reicht eine Schwelle oder Stichprobe?`,
          blockId: block.id,
        })
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
    } else if (block.typ === 'wiederholung' && block.anteilWiederholung >= NACHARBEIT_SCHWELLE && block.anteilWiederholung < 1) {
      const mal = 1 / (1 - block.anteilWiederholung)
      add({
        schluessel: `nacharbeit:${block.id}`,
        schwere: 'hinweis',
        titel: 'Nacharbeit',
        text: `Bei „${block.frage || 'Wiederholung'}“ wird in ${formatiereProzent(block.anteilWiederholung)} der Durchläufe wiederholt; die Schritte laufen im Schnitt ${formatiereZahl(mal, 2)}-mal. Fehler an der Quelle zu vermeiden spart Arbeit und Zeit.`,
        blockId: block.id,
      })
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
