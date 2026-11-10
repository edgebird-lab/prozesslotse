import { zufallMitStartwert } from '../analyse/simulation'
import { neueAufgabe, neueEntscheidung, neueParallel, neuerProzess, neueRolle, neuerZweig, neuesMedium, neuesWarten, neueWiederholung } from '../modell/bausteine'
import { durchlaufe, findeBlock, liegtInParallele, ruecksprungZiele, setzeRuecksprung } from '../modell/operationen'
import type { Block, Prozess, Sequenz } from '../modell/typen'

/**
 * Zufällige, gültige Prozesse für Belastungstests: verschachtelte
 * Entscheidungen (auch ereignisbasiert), Gleichzeitig, Wiederholungen, Warten,
 * vorzeitige Enden und Rücksprünge, die über `setzeRuecksprung` entstehen wie
 * in der Oberfläche.
 */
export function zufallsProzess(startwert: number, optionen: { auchUngueltig?: boolean } = {}): Prozess {
  // auchUngueltig: jeder Ausgang darf enden oder zurückspringen, also auch alle; dann entstehen unerreichbare Schritte und Endlosschleifen
  const frei = optionen.auchUngueltig ?? false
  const zufall = zufallMitStartwert(startwert)
  const wahl = <T,>(liste: T[]): T => liste[Math.floor(zufall() * liste.length)]
  const rollen = [neueRolle('A'), neueRolle('B'), neueRolle('C')]
  const medien = [neuesMedium('Papier', 'papier'), neuesMedium('ERP', 'erp')]
  let nr = 0
  const aufgabe = () => neueAufgabe({ name: `Schritt ${++nr} erledigen`, rolleId: wahl(rollen).id, mediumId: wahl(medien).id, bearbeitungMin: 5, liegezeitMin: 10 })

  function sequenz(tiefe: number, inParallel: boolean, mindestens = 0): Block[] {
    const anzahl = Math.max(mindestens, Math.floor(zufall() * 4))
    return Array.from({ length: anzahl }, () => block(tiefe, inParallel))
  }
  function block(tiefe: number, inParallel: boolean): Block {
    const r = zufall()
    if (tiefe >= 3 || r < 0.45) return aufgabe()
    if (r < 0.52) return neuesWarten({ name: 'Warten', dauerMin: 30 })
    if (r < 0.75) {
      const ereignisse = zufall() < 0.3
      const n = 2 + Math.floor(zufall() * 2)
      const zweige = Array.from({ length: n }, (_, i) =>
        neuerZweig(`Fall ${i + 1}`, 1 / n, {
          schritte: sequenz(tiefe + 1, inParallel),
          ende: !inParallel && (frei || i > 0) && zufall() < 0.3 ? `Ende ${i}` : null,
          ereignis: ereignisse ? { art: zufall() < 0.5 ? 'nachricht' : 'zeit', dauerMin: 60 } : null,
        }),
      )
      return neueEntscheidung({ frage: 'Welcher Fall?', art: ereignisse ? 'ereignis' : 'daten', zweige })
    }
    if (r < 0.9) {
      const par = neueParallel(2 + Math.floor(zufall() * 2))
      par.zweige = par.zweige.map((z: Sequenz) => ({ ...z, schritte: sequenz(tiefe + 1, true, 1) }))
      return par
    }
    return neueWiederholung({ frage: 'Nochmal?', koerper: { id: `k${++nr}`, schritte: sequenz(tiefe + 1, inParallel, 1) } })
  }

  let p = neuerProzess({ name: `Zufall ${startwert}`, rollen, medien, ablauf: { id: 'haupt', schritte: sequenz(0, false, 1) } })

  // Rücksprünge wie in der Oberfläche setzen: nie im ersten Ausgang (der führt weiter), nie aus „Gleichzeitig“ heraus
  const kandidaten: string[] = []
  for (const { block: b, vorfahren } of durchlaufe(p.ablauf)) {
    if (b.typ === 'entscheidung' && !liegtInParallele(vorfahren)) kandidaten.push(b.id)
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
  return p
}
