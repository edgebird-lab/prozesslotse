import { xmlId, type Layout } from '../bpmn/layout'
import type { Zeitangaben } from '../bpmn/tokenspiel'
import { durchlaufe, kinderSequenzen, unterbrechungsZeit } from '../modell/operationen'
import { istUnterbrechbar, type Prozess, type Sequenz } from '../modell/typen'

/**
 * Zeiten für die Zählung im Tokenspiel, aus dem Modell zu den Elementen des
 * Layouts: Dauer je Aktivität (Liegezeit und Bearbeitung, Warten, Ereignis eines
 * Ausgangs), Liegezeit von „für jedes Stück“, Zeitpunkt der Unterbrechungen und
 * die Stelle jedes Endes im Modell (Lesereihenfolge; bei gleicher Zeit gewinnt
 * wie in der Rechnung der frühere Zweig).
 */
export function tokenZeiten(p: Prozess, layout: Layout): Zeitangaben {
  const dauer = new Map<string, number>()
  const liegen = new Map<string, number>()
  const rand = new Map<string, number | null>()
  const rang = new Map<string, number>()

  // Lesereihenfolge: jede Sequenz vor ihren Schritten, jeder Schritt vor seinen Kindsequenzen
  const nummer = new Map<string, number>()
  let nr = 0
  const sequenz = (s: Sequenz) => {
    nummer.set(xmlId(s.id), nr++)
    for (const b of s.schritte) {
      nummer.set(xmlId(b.id), nr++)
      for (const k of kinderSequenzen(b)) sequenz(k)
    }
  }
  sequenz(p.ablauf)

  const ereignisDauer = new Map<string, number>()
  const wartenDauer = new Map<string, number>()
  const mehrfachLiegen = new Map<string, number>()
  for (const { block } of durchlaufe(p.ablauf)) {
    if (block.typ === 'warten') wartenDauer.set(xmlId(block.id), block.dauerMin)
    if (block.typ === 'entscheidung' && block.art === 'ereignis') for (const z of block.zweige) if (z.ereignis) ereignisDauer.set(xmlId(`${z.id}_ereignis`), z.ereignis.dauerMin)
    if (block.typ === 'mehrfach') mehrfachLiegen.set(block.id, block.liegezeitMin)
    if (istUnterbrechbar(block)) for (const u of block.unterbrechungen ?? []) if (u.unterbrechend) rand.set(xmlId(`${u.id}_rand`), unterbrechungsZeit(block, u))
  }

  for (const k of layout.knoten) {
    if (k.art === 'aufgabe' && k.aufgabe) {
      dauer.set(k.id, k.aufgabe.liegezeitMin + k.aufgabe.bearbeitungMin)
      if (k.mehrfachBlock) liegen.set(k.id, mehrfachLiegen.get(k.mehrfachBlock) ?? 0)
    } else if (k.art === 'warten') dauer.set(k.id, ereignisDauer.get(k.id) ?? wartenDauer.get(k.id) ?? 0)
    else if (k.art === 'ende') {
      const fehler = /^(.*)_fehler_\d+_ende$/.exec(k.id)
      const quelle = fehler ? fehler[1] : k.id.endsWith('_ende') ? k.id.slice(0, -'_ende'.length) : null
      const x = quelle !== null ? nummer.get(quelle) : undefined
      if (x !== undefined) rang.set(k.id, x)
    }
  }
  for (const r of layout.rahmen) if (r.mehrfach) liegen.set(r.id, mehrfachLiegen.get(r.blockId) ?? 0)
  return { dauer, liegen, rand, rang }
}
