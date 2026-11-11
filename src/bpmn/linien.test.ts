/**
 * Zeichenregeln für Linien: Jeder Fluss ist eine eigene Linie. Zwei Flüsse
 * teilen sich nie eine Strecke und nie einen Anschlusspunkt, sonst sähe ein
 * Fluss aus wie einer mit zwei Enden.
 */
import { describe, expect, it } from 'vitest'
import { neueAufgabe, neueEntscheidung, neuerProzess, neuerTeilnehmer, neuerZweig, neueRolle } from '../modell/bausteine'
import { beispielLieferdienst, beispielOnlinebestellung } from '../modell/beispiel'
import type { Prozess } from '../modell/typen'
import { beschriftungenAufLinien, geometrieFehler } from '../testhilfen/geometrie'
import { zufallsProzess } from '../testhilfen/zufallsprozess'
import { erzeugeBpmn } from './export'
import { MASSE } from './layout'

/** Eine Entscheidung mit fünf Wegen: einer geradeaus, zwei darunter in derselben Bahn, einer in die Bahn darüber, einer in die darunter. */
function fuenfWege(): Prozess {
  const vertrieb = neueRolle('Vertrieb')
  const lager = neueRolle('Lager')
  const versand = neueRolle('Versand')
  const auf = (name: string, r = lager) => neueAufgabe({ name, rolleId: r.id })
  return neuerProzess({
    name: 'Fünf Wege',
    rollen: [vertrieb, lager, versand],
    ablauf: {
      id: 'haupt',
      schritte: [
        auf('Auftrag prüfen'),
        neueEntscheidung({
          id: 'ent_fuenf',
          frage: 'Was ist zu tun?',
          zweige: [
            neuerZweig('Normal', 0.4, { schritte: [auf('Normal bearbeiten')] }),
            neuerZweig('Eilig', 0.2, { schritte: [auf('Eilig bearbeiten')] }),
            neuerZweig('Sperre', 0.1, { schritte: [auf('Sperre prüfen')] }),
            neuerZweig('Vertrieb fragen', 0.2, { schritte: [auf('Rückfrage stellen', vertrieb)] }),
            neuerZweig('Direkt versenden', 0.1, { schritte: [auf('Paket packen', versand)] }),
          ],
        }),
        auf('Abschließen'),
      ],
    },
  })
}

describe('Linienführung', () => {
  it('gibt jedem Weg einer Verzweigung eine eigene Linie und einen eigenen Anschluss', () => {
    const { layout } = erzeugeBpmn(fuenfWege())
    expect(geometrieFehler(layout)).toEqual([])
    const auf = layout.knoten.find((k) => k.id === 'ent_fuenf_auf')!
    const cx = auf.x + auf.breite / 2
    const cy = auf.y + auf.hoehe / 2
    const aus = layout.kanten.filter((e) => e.von === auf.id)
    expect(aus).toHaveLength(5)
    const start = (name: string) => aus.find((e) => e.name === name)!.punkte[0]
    // geradeaus an der rechten Ecke, der Weg nach oben an der oberen Ecke, der tiefste Weg an der unteren Ecke
    expect(start('Normal')).toEqual({ x: cx + auf.breite / 2, y: cy })
    expect(start('Vertrieb fragen')).toEqual({ x: cx, y: auf.y })
    expect(start('Direkt versenden')).toEqual({ x: cx, y: auf.y + auf.hoehe })
    // die übrigen Wege nach unten verlassen die untere rechte Kante weiter außen, je tiefer desto näher an der Ecke
    expect(start('Sperre').x).toBeGreaterThan(cx)
    expect(start('Eilig').x).toBeGreaterThan(start('Sperre').x)
    // die Frage rückt nach links oben, weil oben eine Linie austritt
    expect(auf.beschriftung!.x + auf.beschriftung!.breite).toBeLessThan(cx)
    expect(beschriftungenAufLinien(layout).betroffen).toEqual([])
  })

  it('führt die Wege an der Zusammenführung getrennt hinein', () => {
    const { layout } = erzeugeBpmn(fuenfWege())
    const zu = layout.knoten.find((k) => k.id === 'ent_fuenf_zu')!
    const enden = layout.kanten.filter((e) => e.nach === zu.id).map((e) => e.punkte[e.punkte.length - 1])
    expect(enden).toHaveLength(5)
    expect(new Set(enden.map((p) => `${p.x}|${p.y}`)).size).toBe(5)
  })

  it('hält die Beispiele frei von geteilten Strecken und Beschriftungen auf Linien', () => {
    for (const p of [beispielLieferdienst(), beispielOnlinebestellung()]) {
      const { layout } = erzeugeBpmn(p)
      expect(geometrieFehler(layout)).toEqual([])
      expect(beschriftungenAufLinien(layout).betroffen).toEqual([])
    }
  })

  it('hält 300 Zufallsprozesse frei von geteilten Strecken; Beschriftungen auf Linien bleiben selten', () => {
    const fehler: string[] = []
    let gesamt = 0
    let betroffen = 0
    for (let s = 1; s <= 300; s++) {
      const { layout } = erzeugeBpmn(zufallsProzess(s))
      for (const f of geometrieFehler(layout)) fehler.push(`Startwert ${s}: ${f}`)
      const b = beschriftungenAufLinien(layout)
      gesamt += b.gesamt
      betroffen += b.betroffen.length
    }
    expect(fehler.slice(0, 5)).toEqual([])
    expect(betroffen / gesamt).toBeLessThan(0.02)
  }, 60_000)

  it('verbreitert eine Lücke, wenn dort viele Linien laufen', () => {
    // Acht Aufgaben untereinander, jede bekommt eine Nachricht vom Kunden: acht Spuren in der Lücke vor ihnen
    const team = neueRolle('Team')
    const kunde = neuerTeilnehmer('Kunde')
    const zweige = Array.from({ length: 8 }, (_, i) => neuerZweig(`Fall ${i + 1}`, 1 / 8, { schritte: [neueAufgabe({ name: `Antwort ${i + 1}`, rolleId: team.id, nachrichtVon: kunde.id })] }))
    const p = neuerProzess({ name: 'Viele Nachrichten', rollen: [team], teilnehmer: [kunde], ablauf: { id: 'haupt', schritte: [neueEntscheidung({ frage: 'Welcher Fall?', zweige })] } })
    const { layout } = erzeugeBpmn(p)
    expect(geometrieFehler(layout)).toEqual([])
    const xs = [...new Set(layout.nachrichten.map((n) => Math.round(n.punkte[0].x)))].sort((a, b) => a - b)
    expect(xs).toHaveLength(8)
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(9)
    // die Lücke zwischen Verzweigung und Aufgaben ist breiter geworden als die übliche Spaltenbreite
    const auf = layout.knoten.find((k) => k.richtung === 'auf')!
    const aufgabe = layout.knoten.find((k) => k.art === 'aufgabe')!
    expect(aufgabe.x + aufgabe.breite / 2 - (auf.x + auf.breite / 2)).toBeGreaterThan(MASSE.spalte)
  })
})
