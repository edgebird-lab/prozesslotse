/**
 * Prüfregeln für das Modell selbst: fehlende Angaben, widersprüchliche Werte
 * und Benennung nach den Seven Process Modeling Guidelines (7PMG,
 * Mendling, Reijers, van der Aalst 2010).
 */
import {
  alsMarkierteAufgabe,
  anzahlBloecke,
  ausgaengeBlock,
  ausgaengeSequenz,
  beidesAlsOder,
  beidesAusgang,
  blockTitel,
  durchlaufe,
  gliedNebenlaeufig,
  gliedRahmen,
  heisstBeides,
  istMengenschleife,
  istRahmen,
  kannWeiterlaufen,
  mengenschleifeAlsMehrfach,
  nachrichtenVerweise,
  oderWahrscheinlichkeiten,
  parallelName,
  rahmenInhalt,
  rahmenRolle,
  rahmenUeber,
  unterbrechungVon,
  wirktExtern,
  type Glied,
  type Rahmenbaustein,
} from './operationen'
import { MAX_ANZAHL } from './anzahl'
import { unerwartet, type Block, type Id, type Parallel, type Prozess, type Unterbrechbar, type Unterbrechung } from './typen'
import { formatiereDauer, formatiereProzent, formatiereZahl } from './zeit'
import { ersterAusgang, erwartungGesamt, verteilungBlock, verteilungSequenz, type Verteilung } from '../analyse/verteilung'

export type Schwere = 'fehler' | 'warnung' | 'hinweis'

/** Umbau, den ein Hinweis anbietet; nichts wird still umgebaut. */
export interface Umwandlung {
  /** Beschriftung des Knopfs, z. B. „Umwandeln“ */
  knopf: string
  /** Rückfrage vor dem Umwandeln, wenn dabei Schritte entfallen */
  rueckfrage?: string
  anwenden: (p: Prozess) => Prozess
}

export interface Befund {
  /** Stabiler Schlüssel, z. B. zum Ausblenden oder als React-Key. */
  schluessel: string
  schwere: Schwere
  titel: string
  text: string
  blockId?: Id
  rolleId?: Id
  /** Herkunft der Regel, z. B. „7PMG G6“. */
  quelle?: string
  /** Der Hinweis bietet einen Umbau an (Knopf „Umwandeln“). */
  umwandlung?: Umwandlung
  /** Der Hinweis führt zu einem Schritt des Assistenten, z. B. zu den Beteiligten. */
  oeffne?: 'beteiligte'
}

const RANG: Record<Schwere, number> = { fehler: 0, warnung: 1, hinweis: 2 }

export function sortiereBefunde(befunde: Befund[]): Befund[] {
  return [...befunde].sort((a, b) => RANG[a.schwere] - RANG[b.schwere])
}

/** Objekt + Verb im Infinitiv am Ende, z. B. „Rechnung prüfen“. */
export function istObjektVerbName(name: string): boolean {
  const woerter = name.trim().split(/\s+/).filter(Boolean)
  if (woerter.length < 2) return false
  const letztes = woerter[woerter.length - 1].replace(/[^\p{L}]/gu, '')
  return letztes.length > 1 && letztes[0] === letztes[0].toLocaleLowerCase('de-DE') && letztes.endsWith('n')
}

const TOLERANZ = 1e-6

/** Wo eine nebenläufige Umgebung liegt, für Texte: „in „Gleichzeitig““, „in einem ODER-Weg“, „bei Stücken, die zur selben Zeit laufen“. */
function nebenlaeufigText(kette: Glied[]): string {
  const g = kette.filter(gliedNebenlaeufig).pop()
  if (g?.block.typ === 'oder') return 'in einem Weg einer ODER-Verzweigung'
  if (g?.block.typ === 'mehrfach' && gliedRahmen(g)) return `in „${blockTitel(g.block)}“, wo die Stücke zur selben Zeit laufen`
  if (g?.block.typ === 'parallel') return `in einem Zweig von „${parallelName(g.block)}“`
  return 'in einem Zweig von „Gleichzeitig“'
}

/**
 * Führt ein Ende an dieser Stelle zur Verklemmung? Im BPMN wird ein Ende in
 * einem Rahmen zum Fehler-Ende, das der äußerste Rahmen fängt; dann wartet nur
 * ein „Gleichzeitig“ außerhalb dieses Rahmens ewig auf den beendeten Zweig.
 * Eine ODER-Zusammenführung wartet nach der Regel der Norm nicht auf einen Weg,
 * der beendet ist, und ein Nebenweg endet ohnehin für sich. In diesen Fällen
 * müsste der Rest abgebrochen werden; die Rechnung dafür folgt erst mit dem
 * Abbruch in nebenläufiger Umgebung.
 */
function endeVerklemmt(kette: Glied[]): boolean {
  const aeusserster = kette.findIndex(gliedRahmen)
  return kette.slice(0, aeusserster < 0 ? kette.length : aeusserster).some((g) => g.block.typ === 'parallel' && gliedNebenlaeufig(g))
}

/** Ist das Glied ein Nebenweg (nicht unterbrechender Ausnahmeweg)? Er endet für sich. */
function gliedNebenweg(g: Glied): boolean {
  const u = unterbrechungVon(g.block, g.sequenz.id)
  return u !== null && !u.unterbrechend
}

/** Text für einen Rücksprung, der eine nebenläufige Umgebung verlässt. */
function rueckVerklemmtText(wer: string, kette: Glied[]): string {
  const g = kette.filter(gliedNebenlaeufig).pop()
  if (g?.block.typ === 'mehrfach') return `${wer} springt aus „${blockTitel(g.block)}“ heraus zurück, wo die Stücke zur selben Zeit laufen. Weiter geht es erst, wenn alle Stücke fertig sind; das wäre dann nie der Fall.`
  return `${wer} springt aus „Gleichzeitig“ oder einer ODER-Verzweigung heraus zurück. Die Zusammenführung würde dann ewig auf diesen Zweig warten.`
}

export function pruefeProzess(p: Prozess): Befund[] {
  const befunde: Befund[] = []
  const add = (b: Befund) => befunde.push(b)
  const rollenIds = new Set(p.rollen.map((r) => r.id))
  const medienIds = new Set(p.medien.map((m) => m.id))
  const benutzteRollen = new Set<Id>()
  const benutzteMedien = new Set<Id>()

  if (!p.name.trim()) {
    add({ schluessel: 'prozess:name', schwere: 'hinweis', titel: 'Prozess ohne Namen', text: 'Gib dem Prozess einen Namen, damit Diagramm und Bericht beschriftet sind.' })
  }
  if (p.arbeitsstundenProTag <= 0 || p.arbeitsstundenProTag > 24) {
    add({ schluessel: 'prozess:arbeitsstunden', schwere: 'fehler', titel: 'Arbeitsstunden pro Tag ungültig', text: 'Ein Arbeitstag muss zwischen 0 und 24 Stunden haben.' })
  }
  if (p.vorgaengeProTag <= 0) {
    add({ schluessel: 'prozess:vorgaenge', schwere: 'warnung', titel: 'Keine Fallzahl', text: 'Ohne Vorgänge pro Tag lassen sich Auslastung und Tageskosten nicht berechnen.' })
  }
  if (p.ablauf.schritte.length === 0) {
    add({ schluessel: 'prozess:leer', schwere: 'hinweis', titel: 'Noch keine Schritte', text: 'Lege im Schritt „Ablauf“ die erste Aufgabe an.' })
  }

  pruefeSequenz(p.ablauf.schritte)

  function pruefeSequenz(schritte: Block[]) {
    // Rekursiv: führt aus einem Block kein Weg normal weiter (auch über verschachtelte Entscheidungen,
    // Wiederholungen und Rücksprungbereiche), wird alles dahinter nie erreicht.
    const i = schritte.findIndex((b, k) => k < schritte.length - 1 && !kannWeiterlaufen(b))
    if (i >= 0) {
      const b = schritte[i]
      add({
        schluessel: `unerreichbar:${b.id}`,
        schwere: 'fehler',
        titel: 'Unerreichbare Schritte',
        text: `Hinter „${blockTitel(b)}“ geht es nie normal weiter: Alle Wege darin beenden den Prozess oder springen zurück. Die ${schritte.length - 1 - i} folgenden Schritte werden nie erreicht.`,
        blockId: schritte[i + 1].id,
      })
    }
  }

  for (const { block: b, vorfahren, kette } of durchlaufe(p.ablauf)) {
    switch (b.typ) {
      case 'aufgabe': {
        if (!b.name.trim()) {
          add({ schluessel: `name:${b.id}`, schwere: 'warnung', titel: 'Aufgabe ohne Namen', text: 'Benenne die Aufgabe mit Objekt und Verb, z. B. „Rechnung prüfen“.', blockId: b.id })
        } else if (!istObjektVerbName(b.name)) {
          add({ schluessel: `benennung:${b.id}`, schwere: 'hinweis', titel: 'Benennung prüfen', text: `„${b.name}“: Aufgaben lesen sich am klarsten als Objekt und Verb, z. B. „Rechnung prüfen“.`, blockId: b.id, quelle: '7PMG G6' })
        }
        if (b.rolleId === null || !rollenIds.has(b.rolleId)) {
          add({ schluessel: `rolle:${b.id}`, schwere: 'warnung', titel: 'Keine Rolle', text: `Wer erledigt „${blockTitel(b)}“? Ohne Rolle fehlen Kosten und Auslastung.`, blockId: b.id })
        } else benutzteRollen.add(b.rolleId)
        if (b.mediumId === null || !medienIds.has(b.mediumId)) {
          add({ schluessel: `medium:${b.id}`, schwere: 'hinweis', titel: 'Kein System angegeben', text: `Womit wird „${blockTitel(b)}“ erledigt? Das braucht die Prüfung auf Medienbrüche.`, blockId: b.id })
        } else benutzteMedien.add(b.mediumId)
        if (b.uebertragung?.quelleMediumId && medienIds.has(b.uebertragung.quelleMediumId)) benutzteMedien.add(b.uebertragung.quelleMediumId)
        if (b.bearbeitungMin <= 0) {
          add({ schluessel: `zeit:${b.id}`, schwere: 'warnung', titel: 'Keine Bearbeitungszeit', text: `„${blockTitel(b)}“ hat keine Bearbeitungszeit. Schätze, wie lange der Schritt im Schnitt dauert.`, blockId: b.id })
        }
        if (b.liegezeitMin < 0) {
          add({ schluessel: `liegezeit:${b.id}`, schwere: 'fehler', titel: 'Negative Liegezeit', text: `„${blockTitel(b)}“ hat eine negative Liegezeit.`, blockId: b.id })
        }
        if (b.uebertragung && b.uebertragung.minuten > b.bearbeitungMin) {
          add({ schluessel: `uebertragung:${b.id}`, schwere: 'warnung', titel: 'Übertragung länger als Bearbeitung', text: `Bei „${blockTitel(b)}“ ist die Zeit fürs Übertragen größer als die ganze Bearbeitungszeit.`, blockId: b.id })
        }
        if (b.art === 'freigabe' && (b.freigabeQuote < 0 || b.freigabeQuote > 1)) {
          add({ schluessel: `freigabe:${b.id}`, schwere: 'fehler', titel: 'Freigabequote ungültig', text: 'Die Freigabequote muss zwischen 0 und 100 % liegen.', blockId: b.id })
        }
        pruefeUnterbrechungen(b, vorfahren, kette)
        break
      }
      case 'entscheidung': {
        if (!b.frage.trim()) {
          add({ schluessel: `frage:${b.id}`, schwere: 'warnung', titel: 'Entscheidung ohne Frage', text: 'Formuliere die Entscheidung als Frage, z. B. „Ware vorrätig?“.', blockId: b.id })
        } else if (!b.frage.trim().endsWith('?')) {
          add({ schluessel: `fragezeichen:${b.id}`, schwere: 'hinweis', titel: 'Entscheidung als Frage formulieren', text: `„${b.frage}“ liest sich im Diagramm klarer als Frage mit Fragezeichen.`, blockId: b.id, quelle: '7PMG G6' })
        }
        if (b.zweige.length < 2) {
          add({ schluessel: `zweige:${b.id}`, schwere: 'fehler', titel: 'Zu wenige Ausgänge', text: `„${blockTitel(b)}“ braucht mindestens zwei Ausgänge.`, blockId: b.id })
        }
        if (b.zweige.length > 3) {
          add({ schluessel: `viele-zweige:${b.id}`, schwere: 'hinweis', titel: 'Viele Ausgänge', text: `„${blockTitel(b)}“ hat ${b.zweige.length} Ausgänge. Mehr als drei machen Diagramme schwer lesbar; lässt sich die Frage aufteilen?`, blockId: b.id, quelle: '7PMG G2' })
        }
        const summe = b.zweige.reduce((s, z) => s + z.anteil, 0)
        if (b.zweige.length >= 2 && Math.abs(summe - 1) > TOLERANZ) {
          add({ schluessel: `summe:${b.id}`, schwere: 'fehler', titel: 'Anteile ergeben nicht 100 %', text: `Die Ausgänge von „${blockTitel(b)}“ ergeben zusammen ${Math.round(summe * 1000) / 10} %.`, blockId: b.id })
        }
        b.zweige.forEach((z, i) => {
          if (z.anteil < 0 || z.anteil > 1) {
            add({ schluessel: `anteil:${z.id}`, schwere: 'fehler', titel: 'Anteil ungültig', text: `Ausgang ${i + 1} von „${blockTitel(b)}“ hat einen Anteil außerhalb von 0 bis 100 %.`, blockId: b.id })
          }
          if (!z.bezeichnung.trim()) {
            add({ schluessel: `bezeichnung:${z.id}`, schwere: 'warnung', titel: 'Ausgang ohne Bezeichnung', text: `Ausgang ${i + 1} von „${blockTitel(b)}“ braucht eine Antwort, z. B. „Ja“ oder „Nein“.`, blockId: b.id })
          }
          if (z.ende !== null && kette.some(gliedNebenweg)) {
            add(nebenwegEnde(`Der Ausgang „${z.bezeichnung}“`, b.id, z.id))
          } else if (z.ende !== null && endeVerklemmt(kette)) {
            add({
              schluessel: `verklemmung:${z.id}`,
              schwere: 'fehler',
              titel: 'Verklemmung',
              text: `Der Ausgang „${z.bezeichnung}“ beendet den Prozess innerhalb von „Gleichzeitig“${rahmenUeber(kette).length > 0 ? ' (der Rahmen darum liegt selbst in einem seiner Zweige)' : ''}. Die Zusammenführung würde dann ewig auf diesen Zweig warten.`,
              blockId: b.id,
            })
          } else if (z.ende !== null && kette.some(gliedNebenlaeufig)) {
            const wo = nebenlaeufigText(kette)
            add({
              schluessel: `abbruch:${z.id}`,
              schwere: 'fehler',
              titel: 'Ende neben gleichzeitig laufenden Schritten',
              text: `Der Ausgang „${z.bezeichnung}“ beendet den Prozess ${wo}. Was daneben noch läuft, müsste dann abgebrochen werden; das rechnet der Prozesslotse noch nicht.${kette.some((g) => gliedNebenlaeufig(g) && g.block.typ === 'mehrfach') ? ' Werden die Stücke der Reihe nach erledigt, darf ein Ausgang den Prozess beenden.' : kette.some((g) => gliedNebenlaeufig(g) && g.block.typ === 'parallel') ? ' Lass den Ausgang weiterlaufen, oder lass eine Person die Zweige nacheinander erledigen (in beliebiger Reihenfolge); dort darf ein Zweig den Prozess beenden.' : ' Lass den Ausgang weiterlaufen.'}`,
              blockId: b.id,
            })
          }
          if ((z.ende !== null || z.zurueckZu !== null) && z.schritte.length > 0 && !ausgaengeSequenz(z.schritte).has('weiter')) {
            add({
              schluessel: `totesende:${z.id}`,
              // Ein nie erreichtes Ende stünde ohne Zufluss im Diagramm; ein nie genommener Rücksprung erzeugt keine Kante.
              schwere: z.ende !== null ? 'fehler' : 'warnung',
              titel: z.ende !== null ? 'Ende wird nie erreicht' : 'Rücksprung wird nie erreicht',
              text: `Im Ausgang „${z.bezeichnung || i + 1}“ geht es vor dem ${z.ende !== null ? `Ende „${z.ende}“` : 'Rücksprung'} nie normal weiter; ${z.ende !== null ? 'dieses Ende' : 'dieser Rücksprung'} kommt nie vor.`,
              blockId: b.id,
            })
          }
          if (z.ende !== null && z.zurueckZu !== null) {
            add({ schluessel: `doppelt:${z.id}`, schwere: 'fehler', titel: 'Ausgang endet und springt zurück', text: `Der Ausgang „${z.bezeichnung}“ kann nicht zugleich den Prozess beenden und zurückspringen.`, blockId: b.id })
          }
          if (z.zurueckZu !== null) pruefeRuecksprung(`Der Ausgang „${z.bezeichnung}“`, 'dieser Entscheidung', z.zurueckZu, z.id, b.id, vorfahren, kette)
          if (b.art === 'ereignis') {
            if (!z.ereignis) {
              add({ schluessel: `ereignis:${z.id}`, schwere: 'fehler', titel: 'Ereignis fehlt', text: `Der Ausgang „${z.bezeichnung || i + 1}“ einer Ereignis-Entscheidung braucht ein Ereignis (Nachricht oder Zeitpunkt).`, blockId: b.id })
            } else if (z.ereignis.dauerMin <= 0) {
              add({ schluessel: `ereignisdauer:${z.id}`, schwere: 'hinweis', titel: 'Wartezeit ist 0', text: `Bis „${z.bezeichnung}“ eintritt, vergeht laut Modell keine Zeit.`, blockId: b.id })
            }
          }
        })
        // Zwei Ausgänge ohne eigene Schritte, die beide normal weiterführen, unterscheiden sich im Ablauf nicht.
        const ohneUnterschied = b.zweige.filter((z) => z.schritte.length === 0 && z.ende === null && z.zurueckZu === null)
        if (b.art === 'daten' && ohneUnterschied.length >= 2) {
          add({
            schluessel: `gleiche-ausgaenge:${b.id}`,
            schwere: 'hinweis',
            titel: 'Ausgänge ohne Unterschied',
            text: `Die Ausgänge ${ohneUnterschied.map((z, i) => `„${z.bezeichnung || i + 1}“`).join(' und ')} von „${blockTitel(b)}“ führen ohne eigene Schritte weiter. Für den Ablauf macht die Antwort dann keinen Unterschied: Ausgänge zusammenfassen oder die fehlenden Schritte ergänzen.`,
            blockId: b.id,
          })
        }
        const beide = b.art === 'daten' ? b.zweige.find((z) => heisstBeides(z.bezeichnung)) : undefined
        if (beide) {
          const umwandelbar = beidesAusgang(b)
          const wege = b.zweige.filter((z) => z.id !== beide.id)
          add({
            schluessel: `alsoder:${b.id}`,
            schwere: 'hinweis',
            titel: 'Als ODER abbilden?',
            text:
              `Der Ausgang „${beide.bezeichnung}“ von „${blockTitel(b)}“ steht für mehrere Fälle zugleich. Dafür gibt es „Mehrere Wege möglich“ (ODER): Jeder Weg hat seinen eigenen Anteil, und mehrere können zugleich laufen.` +
              (umwandelbar
                ? ` Beim Umwandeln werden ${wege.map((z) => `„${z.bezeichnung}“ (dann ${formatiereProzent(Math.min(1, z.anteil + beide.anteil))})`).join(' und ')} zu Wegen, von denen immer mindestens einer zutrifft; beide laufen weiterhin in ${formatiereProzent(beide.anteil)} der Fälle.${beide.schritte.length > 0 ? ` ${beide.schritte.length === 1 ? 'Der Schritt' : `Die ${beide.schritte.length} Schritte`} im Ausgang „${beide.bezeichnung}“ ${beide.schritte.length === 1 ? 'entfällt' : 'entfallen'} dabei, denn dort laufen dann beide Wege.` : ''}`
                : ''),
            blockId: b.id,
            ...(umwandelbar
              ? {
                  umwandlung: {
                    knopf: 'Umwandeln',
                    rueckfrage: beide.schritte.length > 0 ? `Die Schritte im Ausgang „${beide.bezeichnung}“ entfallen; an ihrer Stelle laufen die Wege ${wege.map((z) => `„${z.bezeichnung}“`).join(' und ')} gemeinsam.` : undefined,
                    anwenden: (q: Prozess) => beidesAlsOder(q, b.id),
                  },
                }
              : {}),
          })
        }
        pruefeSequenzen(b.zweige.map((z) => z.schritte))
        break
      }
      case 'oder': {
        const titel = blockTitel(b)
        if (!b.frage.trim()) {
          add({ schluessel: `frage:${b.id}`, schwere: 'warnung', titel: 'ODER-Verzweigung ohne Frage', text: 'Worum geht es, z. B. „Welche Unterlagen fehlen?“', blockId: b.id })
        }
        if (b.zweige.length < 2) {
          add({ schluessel: `zweige:${b.id}`, schwere: 'fehler', titel: 'Zu wenige Wege', text: `„${titel}“ braucht mindestens zwei Wege.`, blockId: b.id })
        }
        if (b.standard !== null && !b.zweige.some((z) => z.id === b.standard)) {
          add({ schluessel: `standard:${b.id}`, schwere: 'fehler', titel: 'Weg „wenn keiner zutrifft“ fehlt', text: `Der Weg für den Fall, dass keiner zutrifft, gehört nicht mehr zu „${titel}“.`, blockId: b.id })
        }
        const andere = b.zweige.filter((z) => z.id !== b.standard)
        andere.forEach((z, i) => {
          if (z.anteil < 0 || z.anteil > 1) {
            add({ schluessel: `anteil:${z.id}`, schwere: 'fehler', titel: 'Anteil ungültig', text: `Weg ${i + 1} von „${titel}“ hat einen Anteil außerhalb von 0 bis 100 %.`, blockId: b.id })
          }
          if (!z.bezeichnung.trim()) {
            add({ schluessel: `bezeichnung:${z.id}`, schwere: 'warnung', titel: 'Weg ohne Bezeichnung', text: `Weg ${i + 1} von „${titel}“ braucht eine Bezeichnung, z. B. „Gutachten fehlt“.`, blockId: b.id })
          }
          if (z.schritte.length === 0) {
            add({ schluessel: `leer:${z.id}`, schwere: 'warnung', titel: 'Weg ohne Schritte', text: `Im Weg „${z.bezeichnung || i + 1}“ von „${titel}“ passiert nichts. Schritte ergänzen oder den Weg entfernen.`, blockId: b.id })
          }
        })
        const wahrscheinlich = oderWahrscheinlichkeiten(b)
        const summe = andere.reduce((s, z) => s + z.anteil, 0)
        if (b.standard === null && andere.length >= 1 && summe < 1 - TOLERANZ) {
          add({
            schluessel: `keiner:${b.id}`,
            schwere: 'fehler',
            titel: 'Manchmal trifft kein Weg zu',
            text: `Bei „${titel}“ ergeben die Anteile zusammen nur ${Math.round(summe * 1000) / 10} %. Wenn immer mindestens einer der Wege zutrifft, sind es zusammen mindestens 100 %. Sonst einen Weg „wenn keiner zutrifft“ festlegen.`,
            blockId: b.id,
          })
        }
        if (andere.length >= 2 && andere.every((z) => z.anteil >= 1 - TOLERANZ)) {
          add({ schluessel: `immer-alle:${b.id}`, schwere: 'hinweis', titel: 'Alle Wege laufen immer', text: `Bei „${titel}“ laufen alle Wege in jedem Fall. Das ist „Gleichzeitig“ (Knopf „Mehrere Dinge unabhängig voneinander“).`, blockId: b.id })
        } else if (b.standard === null && andere.length >= 2 && Math.abs(andere.reduce((s, z) => s + z.anteil, 0) - 1) < TOLERANZ) {
          // Typischer Bedienfehler: Anteile wie bei einer Entscheidung auf 100 % verteilt
          add({
            schluessel: `wie-entweder:${b.id}`,
            schwere: 'hinweis',
            titel: 'Schließen sich die Wege aus?',
            text: `Die Anteile von „${titel}“ ergeben zusammen genau 100 %. Kommt immer nur einer der Wege vor, ist es eine Entscheidung (Entweder-oder). Bei ODER gibt jeder Anteil an, wie oft dieser Weg vorkommt; weil mehrere zugleich laufen können, sind es zusammen meist mehr als 100 %.`,
            blockId: b.id,
          })
        }
        if (b.standard !== null && wahrscheinlich[b.zweige.findIndex((z) => z.id === b.standard)] < TOLERANZ && b.zweige.some((z) => z.id === b.standard)) {
          add({ schluessel: `standard-nie:${b.id}`, schwere: 'hinweis', titel: 'Weg „wenn keiner zutrifft“ kommt nie vor', text: `Bei „${titel}“ trifft immer mindestens ein anderer Weg zu; der Weg für „keiner“ wird nie genommen.`, blockId: b.id })
        }
        pruefeSequenzen(b.zweige.map((z) => z.schritte))
        break
      }
      case 'parallel': {
        const name = parallelName(b)
        if (b.zweige.length < 2) {
          add({ schluessel: `zweige:${b.id}`, schwere: 'fehler', titel: 'Zu wenige Zweige', text: `„${name}“ braucht mindestens zwei Zweige.`, blockId: b.id })
        }
        b.zweige.forEach((z, i) => {
          if (z.schritte.length === 0) {
            add({ schluessel: `leer:${z.id}`, schwere: 'fehler', titel: 'Leerer Zweig', text: `Zweig ${i + 1} von „${name}“ hat keine Schritte.`, blockId: b.id })
          }
        })
        const art = b.art
        switch (art) {
          case 'alle':
            break
          case 'erster':
            pruefeErster(b)
            break
          case 'nacheinander':
            pruefeNacheinander(b)
            break
          default:
            unerwartet(art)
        }
        // Rahmen: alle Schritte in einer Bahn, der äußerste Rahmen bestimmt sie
        if (istRahmen(b) && rahmenUeber(kette).length === 0) rahmenBahn(b)
        pruefeSequenzen(b.zweige.map((z) => z.schritte))
        break
      }
      case 'wiederholung': {
        if (b.koerper.schritte.length === 0) {
          add({ schluessel: `leer:${b.id}`, schwere: 'fehler', titel: 'Leere Wiederholung', text: 'Lege fest, welche Schritte wiederholt werden.', blockId: b.id })
        }
        if (b.modus === 'ruecksprung') {
          // Wiederholt wird über Ausgänge mit Rücksprung; führt gar kein Weg heraus, ist es eine Endlosschleife.
          if (ausgaengeBlock(b).size === 0) {
            add({ schluessel: `ausweglos:${b.id}`, schwere: 'fehler', titel: 'Endlosschleife', text: `Aus „${blockTitel(b)}“ führt kein Weg heraus: Jeder Ausgang darin springt zurück.`, blockId: b.id })
          }
          pruefeSequenzen([b.koerper.schritte])
          break
        }
        if (b.koerper.schritte.length > 0 && !ausgaengeSequenz(b.koerper.schritte).has('weiter')) {
          add({ schluessel: `fragelos:${b.id}`, schwere: 'fehler', titel: 'Frage wird nie erreicht', text: `Jeder Durchlauf von „${blockTitel(b)}“ endet oder springt vorher heraus; die Frage am Ende wird nie gestellt.`, blockId: b.id })
        }
        if (b.anteilWiederholung >= 1) {
          add({ schluessel: `endlos:${b.id}`, schwere: 'fehler', titel: 'Endlosschleife', text: `„${blockTitel(b)}“ wird immer wiederholt und endet nie. Der Anteil muss unter 100 % liegen.`, blockId: b.id })
        } else if (b.anteilWiederholung > 0.9) {
          add({ schluessel: `fast-endlos:${b.id}`, schwere: 'warnung', titel: 'Sehr häufige Wiederholung', text: `„${blockTitel(b)}“ wird in ${Math.round(b.anteilWiederholung * 100)} % der Durchläufe wiederholt, im Schnitt ${Math.round(1 / (1 - b.anteilWiederholung))}-mal.`, blockId: b.id })
        } else if (b.anteilWiederholung < 0) {
          add({ schluessel: `anteil:${b.id}`, schwere: 'fehler', titel: 'Anteil ungültig', text: 'Der Anteil der Wiederholungen darf nicht negativ sein.', blockId: b.id })
        }
        if (!b.frage.trim()) {
          add({ schluessel: `frage:${b.id}`, schwere: 'warnung', titel: 'Wiederholung ohne Frage', text: 'Unter welcher Bedingung wird wiederholt, z. B. „Nacharbeit nötig?“', blockId: b.id })
        }
        if (istMengenschleife(b)) {
          add({
            schluessel: `alsmehrfach:${b.id}`,
            schwere: 'hinweis',
            titel: 'Als „für jedes Stück“ abbilden?',
            text: `„${blockTitel(b)}“ steht für mehrere gleiche Durchgänge, im Schnitt ${formatiereZahl(1 / (1 - b.anteilWiederholung), 2)}. Dafür gibt es den Baustein „Etwas für jedes Stück einer Liste“: Im Diagramm trägt er eine Markierung statt einer Schleife, und alle Zahlen bleiben gleich (im Schnitt ${formatiereZahl(1 / (1 - b.anteilWiederholung), 2)} Stücke, schwankend, der Reihe nach).`,
            blockId: b.id,
            umwandlung: { knopf: 'Umwandeln', anwenden: (q) => mengenschleifeAlsMehrfach(q, b.id) },
          })
        }
        pruefeSequenzen([b.koerper.schritte])
        break
      }
      case 'teilprozess': {
        const titel = blockTitel(b)
        if (b.koerper.schritte.length === 0) {
          add({ schluessel: `leer:${b.id}`, schwere: 'fehler', titel: 'Leerer Abschnitt', text: `Im Abschnitt „${titel}“ steht noch kein Schritt. Schritte ergänzen oder den Abschnitt löschen.`, blockId: b.id })
        }
        if (!b.name.trim()) {
          add({ schluessel: `name:${b.id}`, schwere: 'warnung', titel: 'Abschnitt ohne Namen', text: 'Gib dem Abschnitt einen Namen, z. B. „Ware versenden“; er steht im Diagramm oben im Rahmen.', blockId: b.id })
        }
        if (rahmenUeber(kette).length === 0) rahmenBahn(b)
        pruefeSequenzen([b.koerper.schritte])
        pruefeUnterbrechungen(b, vorfahren, kette)
        break
      }
      case 'mehrfach': {
        const titel = blockTitel(b)
        if (b.koerper.schritte.length === 0) {
          add({ schluessel: `leer:${b.id}`, schwere: 'fehler', titel: 'Keine Schritte je Stück', text: `Für „${titel}“ steht noch kein Schritt fest, der je Stück erledigt wird. Schritte ergänzen oder den Baustein löschen.`, blockId: b.id })
        }
        if (!b.name.trim()) {
          add({ schluessel: `name:${b.id}`, schwere: 'warnung', titel: '„Für jedes Stück“ ohne Namen', text: 'Wofür gilt es, z. B. „Für jede Position“ oder „Für jeden Lieferanten“?', blockId: b.id })
        }
        if (!Number.isFinite(b.anzahl) || b.anzahl < 0) {
          add({ schluessel: `anzahl:${b.id}`, schwere: 'fehler', titel: 'Anzahl ungültig', text: `Die Zahl der Stücke je Vorgang bei „${titel}“ darf nicht negativ sein.`, blockId: b.id })
        } else if (b.streuung === 'schwankt' && b.anzahl < 1) {
          add({
            schluessel: `anzahl:${b.id}`,
            schwere: 'fehler',
            titel: 'Anzahl zu klein',
            text: `Wenn die Zahl schwankt, hat jeder Vorgang mindestens ein Stück; im Schnitt sind es also mindestens 1. Bei weniger als einem Stück im Schnitt „immer etwa gleich viele“ wählen.`,
            blockId: b.id,
          })
        } else if (b.anzahl === 0 && b.koerper.schritte.length > 0) {
          // Im BPMN liefen die Schritte darin nie (Mehrfachinstanz mit 0 Instanzen): ein toter Teil des Diagramms.
          add({ schluessel: `nie:${b.id}`, schwere: 'fehler', titel: 'Läuft nie', text: `„${titel}“ hat im Schnitt 0 Stücke; die Schritte darin laufen nie. Anzahl angeben oder den Baustein löschen.`, blockId: b.id })
        } else if (b.streuung === 'fest' && b.anzahl < 1) {
          add({
            schluessel: `selten:${b.id}`,
            schwere: 'hinweis',
            titel: 'Läuft nicht in jedem Vorgang',
            text: `Mit im Schnitt ${formatiereZahl(b.anzahl, 2)} Stücken läuft „${titel}“ in ${formatiereProzent(1 - b.anzahl)} der Vorgänge gar nicht.`,
            blockId: b.id,
          })
        }
        if (b.anzahl > MAX_ANZAHL) {
          add({
            schluessel: `viele:${b.id}`,
            schwere: 'warnung',
            titel: 'Sehr viele Stücke',
            text: `„${titel}“ hat im Schnitt ${formatiereZahl(b.anzahl, 0)} Stücke je Vorgang. Gerechnet wird mit höchstens ${formatiereZahl(MAX_ANZAHL, 0)}; so viele Stücke lohnt es sich meist, als eigenen Prozess oder als Stapel zu beschreiben.`,
            blockId: b.id,
          })
        }
        if (b.liegezeitMin < 0) {
          add({ schluessel: `liegezeit:${b.id}`, schwere: 'fehler', titel: 'Negative Liegezeit', text: `„${titel}“ hat eine negative Liegezeit.`, blockId: b.id })
        }
        if (rahmenUeber(kette).length === 0 && !alsMarkierteAufgabe(b)) rahmenBahn(b)
        pruefeSequenzen([b.koerper.schritte])
        pruefeUnterbrechungen(b, vorfahren, kette)
        break
      }
      case 'warten': {
        if (!b.name.trim()) {
          add({ schluessel: `name:${b.id}`, schwere: 'warnung', titel: 'Warten ohne Namen', text: 'Worauf wird gewartet, z. B. „Lieferung abwarten“?', blockId: b.id })
        }
        if (b.dauerMin <= 0) {
          add({ schluessel: `dauer:${b.id}`, schwere: 'hinweis', titel: 'Wartezeit ist 0', text: `„${blockTitel(b)}“ hat keine Dauer und verlängert die Durchlaufzeit nicht.`, blockId: b.id })
        }
        break
      }
      default:
        unerwartet(b)
    }
  }

  function pruefeSequenzen(listen: Block[][]) {
    for (const schritte of listen) pruefeSequenz(schritte)
  }

  /** Rücksprung eines Ausgangs oder einer Unterbrechung: ins Leere, aus einem Rahmen hinaus oder aus einer nebenläufigen Umgebung heraus. */
  function pruefeRuecksprung(wer: string, vorWas: string, ziel: Id, ausgangId: Id, blockId: Id, vorfahren: Block[], kette: Glied[]) {
    const t = vorfahren.findIndex((v) => v.id === ziel && v.typ === 'wiederholung' && v.modus === 'ruecksprung')
    if (t < 0) {
      add({ schluessel: `rueckziel:${ausgangId}`, schwere: 'fehler', titel: 'Rücksprung ins Leere', text: `${wer} springt zu einem Schritt zurück, der nicht vor ${vorWas} liegt.`, blockId })
      return
    }
    // Im BPMN entfällt ein Rückfluss über die Grenze; der Rahmen endet dann an dieser Stelle.
    const rahmen = kette.slice(t + 1).find(gliedRahmen)?.block
    if (rahmen) {
      add({
        schluessel: `rahmenrueck:${ausgangId}`,
        schwere: 'fehler',
        titel: rahmen.typ === 'teilprozess' ? 'Rücksprung aus einem Abschnitt' : rahmen.typ === 'parallel' ? `Rücksprung aus „${parallelName(rahmen)}“` : `Rücksprung aus „${blockTitel(rahmen)}“`,
        text:
          rahmen.typ === 'mehrfach'
            ? `${wer} springt aus „${blockTitel(rahmen)}“ hinaus zurück. Was je Stück läuft, hat einen eigenen Anfang und ein eigenes Ende; zurück geht es nur zu Schritten, die ebenfalls je Stück laufen.`
            : rahmen.typ === 'parallel'
              ? `${wer} springt aus einem Zweig von „${parallelName(rahmen)}“ hinaus zurück. Im Diagramm ist das ein Rahmen, in dem jeder Zweig für sich läuft; zurück geht es nur zu Schritten im selben Zweig.`
              : `${wer} springt aus dem Abschnitt „${blockTitel(rahmen)}“ hinaus zurück. Ein Abschnitt hat einen eigenen Start und ein eigenes Ende; zurück geht es nur zu Schritten im selben Abschnitt.`,
        blockId,
      })
    } else if (kette.slice(t + 1).some(gliedNebenweg)) {
      // Im BPMN liefe der Nebenweg zurück in den Ablauf, und alles danach liefe doppelt.
      add(nebenwegEnde(wer, blockId, ausgangId))
    } else if (kette.slice(t + 1).some(gliedNebenlaeufig)) {
      add({ schluessel: `verklemmung:${ausgangId}`, schwere: 'fehler', titel: 'Verklemmung', text: rueckVerklemmtText(wer, kette.slice(t + 1)), blockId })
    }
  }

  /**
   * Unterbrechungen eines Schritts: Anteile (unterbrechend zusammen höchstens
   * 100 %, Nebenweg je Ausführung ≥ 0), Frist, höchstens drei an einer Aufgabe,
   * „Danach“ wie bei Ausgängen von Entscheidungen; ein Nebenweg endet für sich.
   */
  function pruefeUnterbrechungen(b: Unterbrechbar, vorfahren: Block[], kette: Glied[]) {
    const liste = b.unterbrechungen ?? []
    if (liste.length === 0) return
    const titel = blockTitel(b)
    const std = p.arbeitsstundenProTag
    const unterbrechend = liste.filter((u) => u.unterbrechend)
    const summe = unterbrechend.reduce((s, u) => s + u.anteil, 0)
    if (summe > 1 + TOLERANZ) {
      add({
        schluessel: `usumme:${b.id}`,
        schwere: 'fehler',
        titel: 'Unterbrechungen über 100 %',
        text: `„${titel}“ wird laut den Angaben in ${formatiereProzent(summe, 1)} der Ausführungen unterbrochen. Die Unterbrechungen schließen sich aus: Zusammen sind es höchstens 100 %, der Rest endet normal.`,
        blockId: b.id,
      })
    } else if (unterbrechend.length > 0 && summe >= 1 - TOLERANZ) {
      add({ schluessel: `unormal:${b.id}`, schwere: 'hinweis', titel: 'Schritt endet nie normal', text: `Die Unterbrechungen von „${titel}“ ergeben zusammen 100 %: Der Schritt wird immer abgebrochen und endet nie normal.`, blockId: b.id })
    }
    if (b.typ === 'aufgabe' && liste.length > 3) {
      add({
        schluessel: `uviele:${b.id}`,
        schwere: 'fehler',
        titel: 'Mehr als drei Unterbrechungen',
        text: `An „${titel}“ hängen ${liste.length} Unterbrechungen; an einer Aufgabe haben im Diagramm höchstens drei Platz. Fasse den Schritt zu einem Abschnitt zusammen und trag die Unterbrechungen dort ein, oder lege ähnliche zusammen.`,
        blockId: b.id,
      })
    }
    if (kette.some((g) => g.block.typ === 'wiederholung' || (g.block.typ === 'mehrfach' && gliedRahmen(g)))) {
      add({ schluessel: `umehrmals:${b.id}`, schwere: 'hinweis', titel: 'Anteil je Ausführung', text: `„${titel}“ kann je Vorgang mehrmals laufen. Die Angaben zu den Unterbrechungen gelten je Ausführung des Schritts, nicht je Vorgang.`, blockId: b.id })
    }
    liste.forEach((u, i) => {
      const name = u.bezeichnung.trim() || `Unterbrechung ${i + 1}`
      const wer = `„${name}“ an „${titel}“`
      if (!u.bezeichnung.trim()) {
        add({ schluessel: `ubezeichnung:${u.id}`, schwere: 'warnung', titel: 'Unterbrechung ohne Bezeichnung', text: `Was kommt bei „${titel}“ dazwischen, z. B. „Kunde storniert“ oder „Frist abgelaufen“?`, blockId: b.id })
      }
      if (u.unterbrechend) {
        if (!(u.anteil >= 0 && u.anteil <= 1)) add({ schluessel: `uanteil:${u.id}`, schwere: 'fehler', titel: 'Anteil ungültig', text: `${wer} hat einen Anteil außerhalb von 0 bis 100 %.`, blockId: b.id })
        else if (u.anteil <= 0) add({ schluessel: `unie:${u.id}`, schwere: 'hinweis', titel: 'Unterbrechung kommt nie vor', text: `${wer} hat den Anteil 0 % und kommt nie vor. Anteil angeben oder die Unterbrechung entfernen.`, blockId: b.id })
      } else {
        if (!(u.anteil >= 0)) add({ schluessel: `uanteil:${u.id}`, schwere: 'fehler', titel: 'Anzahl ungültig', text: `Wie oft ${wer} je Ausführung vorkommt, darf nicht negativ sein.`, blockId: b.id })
        if (u.schritte.length === 0) add({ schluessel: `uleer:${u.id}`, schwere: 'warnung', titel: 'Nebenweg ohne Schritte', text: `Im Nebenweg ${wer} passiert nichts. Schritte ergänzen oder die Unterbrechung entfernen.`, blockId: b.id })
        if (u.ende !== null || u.zurueckZu !== null) add(nebenwegEnde(`Der Nebenweg ${wer}`, b.id, u.id))
      }
      if (u.art === 'zeit') {
        if (!(u.fristMin > 0)) add({ schluessel: `ufrist:${u.id}`, schwere: 'fehler', titel: 'Frist fehlt', text: `Die Frist von ${wer} muss über 0 liegen.`, blockId: b.id })
        else if (u.unterbrechend) pruefeFrist(b, u, wer, std)
      }
      if (u.ende !== null && u.zurueckZu !== null) {
        add({ schluessel: `doppelt:${u.id}`, schwere: 'fehler', titel: 'Endet und springt zurück', text: `Nach ${wer} kann der Prozess nicht zugleich enden und zurückspringen.`, blockId: b.id })
      }
      pruefeSequenzen([u.schritte])
      if (!u.unterbrechend) return
      // Der Ausnahmeweg liegt neben dem Schritt: in derselben Umgebung, bei einem Rahmen außerhalb von ihm
      const weg: Glied[] = [...kette, { block: b, sequenz: u }]
      if (u.ende !== null) {
        if (weg.some(gliedNebenweg)) add(nebenwegEnde(`Nach ${wer}`, b.id, u.id))
        else if (endeVerklemmt(weg)) {
          add({ schluessel: `verklemmung:${u.id}`, schwere: 'fehler', titel: 'Verklemmung', text: `Nach ${wer} endet der Prozess innerhalb von „Gleichzeitig“. Die Zusammenführung würde dann ewig auf diesen Zweig warten.`, blockId: b.id })
        } else if (weg.some(gliedNebenlaeufig)) {
          add({
            schluessel: `abbruch:${u.id}`,
            schwere: 'fehler',
            titel: 'Ende neben gleichzeitig laufenden Schritten',
            text: `Nach ${wer} endet der Prozess ${nebenlaeufigText(weg)}. Was daneben noch läuft, müsste dann abgebrochen werden; das rechnet der Prozesslotse noch nicht. Lass es danach weitergehen.`,
            blockId: b.id,
          })
        }
      }
      if (u.zurueckZu !== null) pruefeRuecksprung(`Nach ${wer} geht es zurück; der Rücksprung`, `oder an „${titel}“`, u.zurueckZu, u.id, b.id, [...vorfahren, b], weg)
      if ((u.ende !== null || u.zurueckZu !== null) && u.schritte.length > 0 && !ausgaengeSequenz(u.schritte).has('weiter')) {
        add({
          schluessel: `totesende:${u.id}`,
          schwere: u.ende !== null ? 'fehler' : 'warnung',
          titel: u.ende !== null ? 'Ende wird nie erreicht' : 'Rücksprung wird nie erreicht',
          text: `Im Ausnahmeweg ${wer} geht es vor dem ${u.ende !== null ? `Ende „${u.ende}“` : 'Rücksprung'} nie normal weiter; ${u.ende !== null ? 'dieses Ende' : 'dieser Rücksprung'} kommt nie vor.`,
          blockId: b.id,
        })
      }
    })
  }

  /**
   * Frist einer Unterbrechung: An einer Aufgabe kürzer als Liegezeit und
   * Bearbeitung, würde sie immer überschritten. An einem Rahmen zeigen die
   * Zeiten darin, wie oft der Durchlauf länger dauert als die Frist; ist das
   * deutlich öfter als angegeben, eine Warnung (gerechnet wird mit der Angabe).
   */
  function pruefeFrist(b: Unterbrechbar, u: Unterbrechung, wer: string, std: number) {
    if (b.typ === 'aufgabe') {
      const dauer = b.liegezeitMin + b.bearbeitungMin
      if (u.fristMin < dauer - TOLERANZ) {
        add({
          schluessel: `ufristkurz:${u.id}`,
          schwere: 'warnung',
          titel: 'Frist kürzer als der Schritt',
          text: `Die Frist von ${wer} (${formatiereDauer(u.fristMin, std)}) ist kürzer als Liegezeit und Bearbeitung zusammen (${formatiereDauer(dauer, std)}). Laut den Zeiten würde sie in jedem Fall überschritten, angegeben sind ${formatiereProzent(u.anteil)}.`,
          blockId: b.id,
        })
      }
      return
    }
    const v = verteilungBlock({ ...b, unterbrechungen: undefined }, 'gesamt')
    const laenger = [v.weiter, ...v.rueck.values(), ...v.ende.values()].reduce((s, d) => s + masseUeber(d, u.fristMin), 0)
    if (laenger > u.anteil + 0.005) {
      add({
        schluessel: `ufristrahmen:${u.id}`,
        schwere: 'warnung',
        titel: 'Frist laut den Zeiten öfter überschritten',
        text: `Laut den Zeiten in „${blockTitel(b)}“ dauern ${formatiereProzent(laenger)} der Fälle länger als die Frist von ${formatiereDauer(u.fristMin, std)}, angegeben sind ${formatiereProzent(u.anteil)}. Gerechnet wird mit der Angabe.`,
        blockId: b.id,
      })
    }
  }

  /** Alle Schritte eines Rahmens stehen in einer Bahn; der äußerste Rahmen bestimmt sie. Arbeiten darin mehrere Rollen, ein Hinweis. */
  function rahmenBahn(b: Rahmenbaustein) {
    const gueltig = (r: Id | null) => (r !== null && rollenIds.has(r) ? r : null)
    const rollen = new Set<Id | null>()
    for (const s of rahmenInhalt(b)) for (const { block: x } of durchlaufe(s)) if (x.typ === 'aufgabe') rollen.add(gueltig(x.rolleId))
    if (rollen.size < 2) return
    const bahn = rahmenRolle(b, gueltig)
    const bahnName = bahn ? p.rollen.find((r) => r.id === bahn)?.name || 'Unbenannte Rolle' : 'Ohne Rolle'
    add({
      schluessel: `rahmenbahn:${b.id}`,
      schwere: 'hinweis',
      titel: b.typ === 'mehrfach' ? 'Mehrere Rollen je Stück' : b.typ === 'parallel' ? `Mehrere Rollen in „${parallelName(b)}“` : 'Mehrere Rollen in einem Abschnitt',
      text: `Im Diagramm stehen alle Schritte von „${blockTitel(b)}“ in ${b.typ === 'teilprozess' ? '' : 'einem Rahmen in '}der Bahn „${bahnName}“; Schritte anderer Rollen tragen die Rolle in Klammern.`,
      blockId: b.id,
    })
  }

  /**
   * „Weiter beim ersten“: Mit festen Zeiten je Schritt gewinnt meist derselbe
   * Zweig. Dauert der Block laut Rechnung so lange wie der im Schnitt schnellste
   * Zweig, zeigt sie keinen Zeitgewinn; der liegt in den Fällen, die länger dauern als sonst.
   */
  function pruefeErster(b: Parallel) {
    if (b.zweige.length < 2 || b.zweige.some((z) => z.schritte.length === 0)) return
    const block = erwartungGesamt(ersterAusgang(b, 'gesamt').teile)
    const schnellster = Math.min(...b.zweige.map((z) => erwartungGesamt(verteilungSequenz(z.schritte, 'gesamt'))))
    if (block < schnellster - 1e-6) return
    add({
      schluessel: `erstergleich:${b.id}`,
      schwere: 'hinweis',
      titel: 'Kein Zeitgewinn in der Rechnung',
      text: `„${blockTitel(b)}“ dauert laut Rechnung so lange wie der im Schnitt schnellste Zweig (${formatiereDauer(block, p.arbeitsstundenProTag)}). Die Rechnung kennt nur Durchschnittszeiten und zeigt hier keinen Zeitgewinn. Der Gewinn liegt in den Fällen, in denen ein Zweig länger dauert als sonst.`,
      blockId: b.id,
    })
  }

  /**
   * „In beliebiger Reihenfolge“ rechnet in der Reihenfolge der Liste. Kann ein
   * Zweig den Vorgang beenden, laufen die Zweige dahinter laut Rechnung seltener
   * (Hinweis); beendet er ihn immer, laufen sie laut Rechnung nie (Warnung).
   */
  function pruefeNacheinander(b: Parallel) {
    const vorn = b.zweige.slice(0, -1)
    const nie = vorn.findIndex((z) => z.schritte.length > 0 && !ausgaengeSequenz(z.schritte).has('weiter'))
    if (nie >= 0) {
      add({
        schluessel: `adhocende:${b.zweige[nie].id}`,
        schwere: 'warnung',
        titel: 'Zweige danach laufen laut Rechnung nie',
        text: `Zweig ${nie + 1} von „${parallelName(b)}“ beendet den Vorgang immer. Gerechnet wird in der Reihenfolge der Liste, die Zweige dahinter laufen laut Rechnung also nie. Stell diesen Zweig ans Ende.`,
        blockId: b.id,
      })
      return
    }
    const verlaesst = vorn.findIndex((z) => [...ausgaengeSequenz(z.schritte)].some((a) => a !== 'weiter'))
    if (verlaesst >= 0) {
      add({
        schluessel: `adhocreihe:${b.id}`,
        schwere: 'hinweis',
        titel: 'Reihenfolge zählt für die Rechnung',
        text: `Zweig ${verlaesst + 1} von „${parallelName(b)}“ kann den Vorgang beenden. Die Zweige laufen in beliebiger Reihenfolge, gerechnet wird aber in der Reihenfolge der Liste: Die Zweige dahinter laufen laut Rechnung seltener. Ordne die Zweige so, wie sie meist erledigt werden.`,
        blockId: b.id,
      })
    }
  }

  for (const r of p.rollen) {
    if (!r.name.trim()) {
      add({ schluessel: `rollenname:${r.id}`, schwere: 'warnung', titel: 'Rolle ohne Namen', text: 'Jede Rolle braucht einen Namen, sonst ist die Bahn im Diagramm leer.', rolleId: r.id })
    }
    if (!benutzteRollen.has(r.id)) {
      add({ schluessel: `rolle-unbenutzt:${r.id}`, schwere: 'hinweis', titel: 'Rolle ohne Aufgaben', text: `„${r.name || 'Unbenannte Rolle'}“ hat keine Aufgaben.`, rolleId: r.id })
    } else if (r.personen <= 0 || r.verfuegbarProzent <= 0) {
      add({ schluessel: `kapazitaet:${r.id}`, schwere: 'fehler', titel: 'Keine Kapazität', text: `„${r.name}“ hat Aufgaben, aber keine verfügbare Arbeitszeit.`, rolleId: r.id })
    }
    if (r.stundensatz <= 0 && benutzteRollen.has(r.id)) {
      add({ schluessel: `satz:${r.id}`, schwere: 'hinweis', titel: 'Kein Stundensatz', text: `Für „${r.name}“ ist kein Stundensatz hinterlegt; die Kosten werden mit 0 € gerechnet.`, rolleId: r.id })
    }
    if (benutzteRollen.has(r.id) && wirktExtern(r.name)) {
      add({
        schluessel: `alsextern:${r.id}`,
        schwere: 'hinweis',
        titel: `„${r.name.trim()}“ als externen Beteiligten führen?`,
        text: `„${r.name.trim()}“ gehört meist nicht zu eurer Organisation. Als externer Beteiligter bekommt er einen eigenen Pool, und was er schickt oder bekommt, wird zu Nachrichten statt zu Aufgaben in einer eigenen Bahn. Lege ihn bei den Beteiligten an und ändere dann die Schritte dieser Rolle; sie bleiben, bis du sie änderst.`,
        rolleId: r.id,
        oeffne: 'beteiligte',
      })
    }
  }
  const verweise = nachrichtenVerweise(p)
  const teilnehmerIds = new Set(p.teilnehmer.map((t) => t.id))
  if (p.teilnehmer.length >= 3) {
    add({
      schluessel: 'viele-teilnehmer',
      schwere: 'hinweis',
      titel: 'Viele externe Beteiligte',
      text: `Der Prozess tauscht mit ${p.teilnehmer.length} externen Beteiligten Nachrichten aus. Ab drei Pools wird das Diagramm schnell unübersichtlich; lassen sich welche zusammenfassen, z. B. „Lieferanten“?`,
    })
  }
  for (const t of p.teilnehmer) {
    if (!t.name.trim()) {
      add({ schluessel: `teilnehmername:${t.id}`, schwere: 'warnung', titel: 'Externer Beteiligter ohne Namen', text: 'Jeder externe Beteiligte braucht einen Namen, z. B. „Kunde“; er steht auf seinem Pool.' })
    }
    if (!verweise.some((v) => v.teilnehmerId === t.id)) {
      add({ schluessel: `teilnehmer-unbenutzt:${t.id}`, schwere: 'hinweis', titel: 'Keine Nachrichten', text: `Mit „${t.name || 'Unbenannt'}“ werden keine Nachrichten ausgetauscht. Bei den Schritten angeben, wer etwas schickt oder bekommt.` })
    }
  }
  for (const v of verweise) {
    if (!teilnehmerIds.has(v.teilnehmerId)) {
      add({ schluessel: `teilnehmer-fehlt:${v.ort}`, schwere: 'warnung', titel: 'Unbekannter Absender oder Empfänger', text: 'Eine Nachricht verweist auf einen externen Beteiligten, den es nicht mehr gibt.', blockId: v.ort === 'start' ? undefined : v.ort })
    }
  }

  for (const m of p.medien) {
    if (!benutzteMedien.has(m.id)) {
      add({ schluessel: `medium-unbenutzt:${m.id}`, schwere: 'hinweis', titel: 'System wird nicht genutzt', text: `„${m.name || 'Unbenanntes System'}“ kommt in keinem Schritt vor.` })
    }
  }

  const groesse = anzahlBloecke(p)
  if (groesse > 50) {
    add({ schluessel: 'prozess:groesse', schwere: 'hinweis', titel: 'Großes Modell', text: `Das Modell hat ${groesse} Bausteine. Ab etwa 50 Elementen lohnt es sich, Teile als eigenen Prozess zu modellieren.`, quelle: '7PMG G7' })
  }

  return sortiereBefunde(befunde)
}

/** Ein Nebenweg endet für sich: „Prozess endet“ und Rücksprünge sind dort nicht möglich. */
function nebenwegEnde(wer: string, blockId: Id, id: Id): Befund {
  return {
    schluessel: `nebenende:${id}`,
    schwere: 'fehler',
    titel: 'Ende oder Rücksprung im Nebenweg',
    text: `${wer} beendet den Prozess oder springt zurück, liegt aber in einem Nebenweg. Ein Nebenweg läuft neben dem Schritt her und endet für sich, ohne Ergebnis; zurück in den Ablauf liefe danach alles doppelt. Soll der Schritt abgebrochen werden, wähle „Wird die Arbeit daran abgebrochen? – ja“.`,
    blockId,
  }
}

/** Masse einer Verteilung mit Werten über t */
function masseUeber(v: Verteilung, t: number): number {
  return v.wert.reduce((s, w, i) => (w > t + 1e-9 ? s + v.masse[i] : s), 0)
}

/** Gibt es Fehler, die Berechnungen unzuverlässig machen? */
export function hatFehler(befunde: Befund[]): boolean {
  return befunde.some((b) => b.schwere === 'fehler')
}
