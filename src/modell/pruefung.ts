/**
 * Prüfregeln für das Modell selbst: fehlende Angaben, widersprüchliche Werte
 * und Benennung nach den Seven Process Modeling Guidelines (7PMG,
 * Mendling, Reijers, van der Aalst 2010).
 */
import { anzahlBloecke, ausgaengeBlock, ausgaengeSequenz, blockTitel, durchlaufe, istNebenlaeufig, kannWeiterlaufen, liegtInParallele, nachrichtenVerweise, oderWahrscheinlichkeiten } from './operationen'
import type { Block, Id, Prozess } from './typen'

export type Schwere = 'fehler' | 'warnung' | 'hinweis'

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

  for (const { block: b, vorfahren } of durchlaufe(p.ablauf)) {
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
          if (z.ende !== null && liegtInParallele([...vorfahren, b])) {
            add({ schluessel: `verklemmung:${z.id}`, schwere: 'fehler', titel: 'Verklemmung', text: `Der Ausgang „${z.bezeichnung}“ beendet den Prozess innerhalb von „Gleichzeitig“ oder einer ODER-Verzweigung. Die Zusammenführung würde dann ewig auf diesen Zweig warten.`, blockId: b.id })
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
          if (z.zurueckZu !== null) {
            const t = vorfahren.findIndex((v) => v.id === z.zurueckZu && v.typ === 'wiederholung' && v.modus === 'ruecksprung')
            if (t < 0) {
              add({ schluessel: `rueckziel:${z.id}`, schwere: 'fehler', titel: 'Rücksprung ins Leere', text: `Der Ausgang „${z.bezeichnung}“ springt zu einem Schritt zurück, der nicht vor dieser Entscheidung liegt.`, blockId: b.id })
            } else if (vorfahren.slice(t + 1).some(istNebenlaeufig)) {
              add({ schluessel: `verklemmung:${z.id}`, schwere: 'fehler', titel: 'Verklemmung', text: `Der Ausgang „${z.bezeichnung}“ springt aus „Gleichzeitig“ oder einer ODER-Verzweigung heraus zurück. Die Zusammenführung würde dann ewig auf diesen Zweig warten.`, blockId: b.id })
            }
          }
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
        const keiner = andere.reduce((q, z) => q * (1 - Math.min(1, Math.max(0, z.anteil))), 1)
        if (b.standard === null && keiner > TOLERANZ) {
          add({
            schluessel: `keiner:${b.id}`,
            schwere: 'fehler',
            titel: 'Manchmal trifft kein Weg zu',
            text: `Bei „${titel}“ trifft in ${Math.round(keiner * 1000) / 10} % der Fälle keiner der Wege zu. Einen Weg „wenn keiner zutrifft“ festlegen oder die Anteile prüfen.`,
            blockId: b.id,
          })
        }
        if (andere.length >= 2 && andere.every((z) => z.anteil >= 1 - TOLERANZ)) {
          add({ schluessel: `immer-alle:${b.id}`, schwere: 'hinweis', titel: 'Alle Wege laufen immer', text: `Bei „${titel}“ laufen alle Wege in jedem Fall. Das ist „Mehreres gleichzeitig“.`, blockId: b.id })
        } else if (b.standard === null && andere.length >= 2 && Math.abs(andere.reduce((s, z) => s + z.anteil, 0) - 1) < TOLERANZ) {
          // Typischer Bedienfehler: Anteile wie bei einer Entscheidung auf 100 % verteilt
          add({
            schluessel: `wie-entweder:${b.id}`,
            schwere: 'hinweis',
            titel: 'Schließen sich die Wege aus?',
            text: `Die Anteile von „${titel}“ ergeben zusammen genau 100 %. Kommt immer nur einer der Wege vor, ist es eine Entscheidung (Entweder-oder). Bei ODER gibt jeder Anteil an, wie oft dieser Weg vorkommt, unabhängig von den anderen.`,
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
        if (b.zweige.length < 2) {
          add({ schluessel: `zweige:${b.id}`, schwere: 'fehler', titel: 'Zu wenige Zweige', text: '„Gleichzeitig“ braucht mindestens zwei Zweige.', blockId: b.id })
        }
        b.zweige.forEach((z, i) => {
          if (z.schritte.length === 0) {
            add({ schluessel: `leer:${z.id}`, schwere: 'fehler', titel: 'Leerer Zweig', text: `Zweig ${i + 1} von „Gleichzeitig“ hat keine Schritte.`, blockId: b.id })
          }
        })
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
        pruefeSequenzen([b.koerper.schritte])
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
    }
  }

  function pruefeSequenzen(listen: Block[][]) {
    for (const schritte of listen) pruefeSequenz(schritte)
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
  }
  const verweise = nachrichtenVerweise(p)
  const teilnehmerIds = new Set(p.teilnehmer.map((t) => t.id))
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

/** Gibt es Fehler, die Berechnungen unzuverlässig machen? */
export function hatFehler(befunde: Befund[]): boolean {
  return befunde.some((b) => b.schwere === 'fehler')
}
