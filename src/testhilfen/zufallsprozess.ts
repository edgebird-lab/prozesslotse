import { zufallMitStartwert } from '../analyse/simulation'
import {
  neueAufgabe,
  neueEntscheidung,
  neueOder,
  neueParallel,
  neuerOderZweig,
  neuerProzess,
  neueRolle,
  neuerTeilnehmer,
  neuerZweig,
  neuesMedium,
  neuesWarten,
  neueWiederholung,
  neuerMehrfach,
  neuerTeilprozess,
  neueUnterbrechung,
} from '../modell/bausteine'
import { aendereUnterbrechungen, durchlaufe, findeBlock, nebenlaeufig, ruecksprungZiele, setzeRuecksprung } from '../modell/operationen'
import { istUnterbrechbar, type Block, type NachrichtZeitpunkt, type Prozess, type Rolle, type Sequenz, type Teilnehmer, type Unterbrechung } from '../modell/typen'

/**
 * Zufällige, gültige Prozesse für Belastungstests: verschachtelte
 * Entscheidungen (auch ereignisbasiert), Gleichzeitig, ODER, Wiederholungen,
 * Warten, Abschnitte (auch verschachtelt und mit Enden darin), „für jedes
 * Stück“ (fest und schwankend, nacheinander mit Enden darin und gleichzeitig,
 * als Aufgabe mit Markierung und als Rahmen), Unterbrechungen an Aufgaben und
 * Rahmen (Zeit oder Nachricht, unterbrechend mit „weiter“, Ende oder
 * Rücksprung, oder als Nebenweg), vorzeitige Enden und Rücksprünge, die über
 * `setzeRuecksprung` entstehen wie in der Oberfläche.
 */
export function zufallsProzess(startwert: number, optionen: { auchUngueltig?: boolean } = {}): Prozess {
  // auchUngueltig: jeder Ausgang darf enden oder zurückspringen, also auch alle; dann entstehen unerreichbare Schritte und Endlosschleifen
  const frei = optionen.auchUngueltig ?? false
  const zufall = zufallMitStartwert(startwert)
  const wahl = <T,>(liste: T[]): T => liste[Math.floor(zufall() * liste.length)]
  const rollen = [neueRolle('A'), neueRolle('B'), neueRolle('C')]
  // ein externer Kunde; manche Aufgaben, Wartezeiten und Ereignisse tauschen Nachrichten mit ihm aus
  const kunde = neuerTeilnehmer('Kunde')
  const nachricht = () => (zufall() < 0.15 ? kunde.id : null)
  const medien = [neuesMedium('Papier', 'papier'), neuesMedium('ERP', 'erp')]
  let nr = 0
  const aufgabe = () =>
    neueAufgabe({ name: `Schritt ${++nr} erledigen`, rolleId: wahl(rollen).id, mediumId: wahl(medien).id, bearbeitungMin: 5, liegezeitMin: 10, nachrichtAn: nachricht(), nachrichtVon: nachricht() })

  function sequenz(tiefe: number, inParallel: boolean, mindestens = 0): Block[] {
    const anzahl = Math.max(mindestens, Math.floor(zufall() * 4))
    return Array.from({ length: anzahl }, () => block(tiefe, inParallel))
  }
  function block(tiefe: number, inParallel: boolean): Block {
    const r = zufall()
    if (tiefe >= 3 || r < 0.45) return aufgabe()
    if (r < 0.485) return neuesWarten({ name: 'Warten', dauerMin: 30, art: 'nachricht', von: nachricht() })
    if (r < 0.52) {
      // Für jedes Stück: oft eine einzelne Aufgabe (Markierung an der Aufgabe), sonst ein Rahmen. Gleichzeitig ist der Körper
      // nebenläufig, also ohne Enden. Ungültig: ein leerer Körper oder 0 Stücke.
      const n = ++nr
      const gleichzeitig = zufall() < 0.4
      const schwankt = zufall() < 0.4
      const anzahl = frei && zufall() < 0.1 ? 0 : schwankt ? wahl([1.5, 2.5, 4]) : wahl([0.5, 1, 2, 2.5, 3])
      const einzeln = zufall() < 0.35
      const schritte = einzeln ? [aufgabe()] : sequenz(tiefe + 1, inParallel || gleichzeitig, frei && zufall() < 0.1 ? 0 : 1)
      // nacheinander darf ein Stück den Vorgang beenden: Fehler-Ende im Rahmen, gefangen am äußersten Rahmen
      if (!einzeln && !gleichzeitig && !inParallel && zufall() < 0.5) {
        schritte.push(neueEntscheidung({ frage: 'Stück in Ordnung?', zweige: [neuerZweig('Ja', 0.9), neuerZweig('Nein', 0.1, { ende: `Stück ${n} abgelehnt` })] }))
      }
      return neuerMehrfach({
        name: `Für jedes Stück ${n}`,
        anzahl,
        streuung: schwankt ? 'schwankt' : 'fest',
        ausfuehrung: gleichzeitig ? 'gleichzeitig' : 'nacheinander',
        liegezeitMin: wahl([0, 0, 30]),
        koerper: { id: `mk${n}`, schritte },
      })
    }
    if (r < 0.75) {
      const ereignisse = zufall() < 0.3
      const n = 2 + Math.floor(zufall() * 2)
      const zweige = Array.from({ length: n }, (_, i) =>
        neuerZweig(`Fall ${i + 1}`, 1 / n, {
          schritte: sequenz(tiefe + 1, inParallel),
          ende: !inParallel && (frei || i > 0) && zufall() < 0.3 ? `Ende ${i}` : null,
          ereignis: ereignisse ? (zufall() < 0.5 ? { art: 'nachricht', dauerMin: 60, von: nachricht() } : { art: 'zeit', dauerMin: 60 }) : null,
        }),
      )
      return neueEntscheidung({ frage: 'Welcher Fall?', art: ereignisse ? 'ereignis' : 'daten', zweige })
    }
    if (r < 0.84) {
      const par = neueParallel(2 + Math.floor(zufall() * 2))
      par.zweige = par.zweige.map((z: Sequenz) => ({ ...z, schritte: sequenz(tiefe + 1, true, 1) }))
      return par
    }
    if (r < 0.92 && tiefe <= 1) {
      // ODER: zwei bis drei Wege mit eigenen Anteilen; entweder ein Standardweg oder ein Weg, der immer läuft.
      // Nur in den oberen Ebenen: Jede ODER-Verzweigung vervielfacht die Zustände des Tokenspiels.
      const n = 2 + Math.floor(zufall() * 2)
      const zweige = Array.from({ length: n }, (_, i) => neuerOderZweig(`Weg ${i + 1}`, 0.2 + 0.6 * zufall(), { schritte: sequenz(tiefe + 1, true, 1) }))
      if (zufall() < 0.5) {
        const keiner = neuerOderZweig('Keiner davon', 0, { schritte: sequenz(tiefe + 1, true) })
        return neueOder({ frage: 'Welche Wege?', zweige: [...zweige, keiner], standard: keiner.id })
      }
      // „mindestens einer“: Anteile zusammen über 100 %
      const summe = zweige.reduce((s, z) => s + z.anteil, 0)
      const faktor = summe < 1.15 ? 1.15 / summe : 1
      return neueOder({ frage: 'Welche Wege?', zweige: zweige.map((z) => ({ ...z, anteil: Math.min(0.95, z.anteil * faktor) })), standard: null })
    }
    if (r >= 0.92 && r < 0.97 && tiefe <= 2) {
      // Abschnitt (aufgeklappter Teilprozess); Enden darin kommen aus den Entscheidungen, wie sonst auch nicht in nebenläufiger Umgebung.
      // Ungültig: ein leerer Abschnitt
      const n = ++nr
      return neuerTeilprozess({ name: `Abschnitt ${n}`, koerper: { id: `tk${n}`, schritte: sequenz(tiefe + 1, inParallel, frei && zufall() < 0.1 ? 0 : 1) } })
    }
    return neueWiederholung({ frage: 'Nochmal?', koerper: { id: `k${++nr}`, schritte: sequenz(tiefe + 1, inParallel, 1) } })
  }

  let p = neuerProzess({
    name: `Zufall ${startwert}`,
    rollen,
    medien,
    teilnehmer: [kunde],
    ausloeser: { art: 'nachricht', text: 'Anfrage kommt an', von: kunde.id },
    ablauf: { id: 'haupt', schritte: sequenz(0, false, 1) },
  })

  // Rücksprünge wie in der Oberfläche setzen: nie im ersten Ausgang (der führt weiter), nie aus „Gleichzeitig“ heraus
  const kandidaten: string[] = []
  for (const { block: b, kette } of durchlaufe(p.ablauf)) {
    if (b.typ === 'entscheidung' && !nebenlaeufig(kette)) kandidaten.push(b.id)
  }
  for (const id of kandidaten) {
    if (zufall() >= 0.4) continue
    const ort = findeBlock(p, id)
    if (!ort || ort.block.typ !== 'entscheidung') continue
    const zweige = ort.block.zweige.slice(frei ? 0 : 1).filter((z) => z.ende === null)
    if (zweige.length === 0) continue
    const ziele = ruecksprungZiele(p, ort.sequenz.id, ort.index, true)
    if (ziele.length === 0) continue
    p = setzeRuecksprung(p, id, wahl(zweige).id, wahl(ziele).id)
    if (frei && zufall() < 0.3) {
      // noch einen zweiten Ausgang derselben Entscheidung zurückspringen lassen
      const neu = findeBlock(p, id)
      if (neu?.block.typ === 'entscheidung') {
        const rest = neu.block.zweige.filter((z) => z.ende === null && z.zurueckZu === null)
        const ziele2 = ruecksprungZiele(p, neu.sequenz.id, neu.index, true)
        if (rest.length > 0 && ziele2.length > 0) p = setzeRuecksprung(p, id, wahl(rest).id, wahl(ziele2).id)
      }
    }
  }
  // Unterbrechungen aus einem eigenen Zufallsstrom: Der übrige Prozess bleibt für jeden Startwert, wie er war.
  return mitUnterbrechungen(p, zufallMitStartwert(startwert * 7919 + 17), rollen, kunde, frei)
}

/**
 * Hängt an einen Teil der Aufgaben, Abschnitte und „für jedes Stück“ in den
 * oberen Ebenen Unterbrechungen: Zeit oder Nachricht (auch vom Kunden),
 * unterbrechend mit „weiter“, Ende (nicht in nebenläufiger Umgebung) oder
 * Rücksprung, oder als Nebenweg. Ausnahmewege haben null bis zwei Schritte.
 * Mit `frei` entstehen auch ungültige: Anteile über 100 %, ein Ende im Nebenweg
 * oder neben gleichzeitig laufenden Schritten, ein Nebenweg ohne Schritte.
 */
function mitUnterbrechungen(p: Prozess, zufall: () => number, rollen: Rolle[], kunde: Teilnehmer, frei: boolean): Prozess {
  const wahl = <T,>(liste: T[]): T => liste[Math.floor(zufall() * liste.length)]
  let nr = 0
  const aufgabe = () => neueAufgabe({ name: `Ausnahme ${++nr} erledigen`, rolleId: wahl(rollen).id, bearbeitungMin: wahl([5, 10, 20]), liegezeitMin: wahl([0, 15]) })
  const zeitpunkte: NachrichtZeitpunkt[] = ['vorher', 'waehrend', 'unbekannt']
  const rueckWunsch: [string, string][] = []
  const kandidaten = [...durchlaufe(p.ablauf)].filter(({ block, kette }) => istUnterbrechbar(block) && kette.length <= 2 && zufall() < (block.typ === 'aufgabe' ? 0.12 : 0.35))
  for (const { block, kette } of kandidaten) {
    const neben = nebenlaeufig(kette)
    const anzahl = 1 + Math.floor(zufall() * (block.typ === 'aufgabe' ? 3 : 2))
    let summe = 0
    const liste: Unterbrechung[] = Array.from({ length: anzahl }, (_, i) => {
      const unterbrechend = zufall() < 0.7
      const art = zufall() < 0.5 ? 'nachricht' : 'zeit'
      const schritte = Array.from({ length: Math.floor(zufall() * (unterbrechend ? 3 : 2)) + (unterbrechend ? 0 : frei && zufall() < 0.2 ? 0 : 1) }, () => aufgabe() as Block)
      if (unterbrechend && schritte.length > 0 && zufall() < 0.2) {
        // ein Ausnahmeweg mit Entscheidung; im ungültigen Fall auch neben gleichzeitig laufenden Schritten mit Ende
        const endet = (!neben || frei) && zufall() < 0.5
        schritte.push(neueEntscheidung({ frage: 'Geklärt?', zweige: [neuerZweig('Ja', 0.8), neuerZweig('Nein', 0.2, endet ? { ende: `Ausnahme ${nr} offen` } : { schritte: [aufgabe()] })] }))
      }
      const anteil = unterbrechend ? (frei && zufall() < 0.15 ? 0.6 : wahl([0.05, 0.1, 0.2, 0.3])) : wahl([0.3, 0.5, 1, 1.5, 2.5])
      if (unterbrechend) summe += anteil
      const danach = zufall()
      const ende = unterbrechend && (!neben || frei) && danach < 0.3 ? `Unterbrochen ${nr}` : !unterbrechend && frei && danach < 0.1 ? `Nebenweg ${nr} endet` : null
      const u = neueUnterbrechung({
        bezeichnung: `Ereignis ${nr}.${i + 1}`,
        art,
        von: art === 'nachricht' && zufall() < 0.4 ? kunde.id : null,
        unterbrechend,
        anteil: unterbrechend && !frei && summe > 0.9 ? 0.01 : anteil,
        fristMin: wahl([30, 120, 480, 2400]),
        zeitpunkt: wahl(zeitpunkte),
        ende,
        schritte,
      })
      if (unterbrechend && !neben && ende === null && danach > 0.75) rueckWunsch.push([block.id, u.id])
      return u
    })
    p = aendereUnterbrechungen(p, block.id, () => liste)
  }
  // Rücksprünge wie in der Oberfläche: zum Schritt selbst („noch einmal von vorn“) oder davor
  for (const [blockId, uId] of rueckWunsch) {
    const ort = findeBlock(p, blockId)
    if (!ort) continue
    const ziele = ruecksprungZiele(p, ort.sequenz.id, ort.index, true)
    if (ziele.length > 0) p = setzeRuecksprung(p, blockId, uId, wahl(ziele).id)
  }
  return p
}
