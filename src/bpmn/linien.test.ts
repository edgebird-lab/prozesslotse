/**
 * Zeichenregeln für Linien: Jeder Fluss ist eine eigene Linie. Zwei Flüsse
 * teilen sich nie eine Strecke und nie einen Anschlusspunkt, sonst sähe ein
 * Fluss aus wie einer mit zwei Enden.
 */
import { describe, expect, it } from 'vitest'
import { neueAufgabe, neueEntscheidung, neueParallel, neuerProzess, neuerTeilnehmer, neuerZweig, neueRolle } from '../modell/bausteine'
import { beispielLieferdienst, beispielOnlinebestellung } from '../modell/beispiel'
import type { Prozess } from '../modell/typen'
import { beschriftungenAufLinien, geometrieFehler, langeParallelen, nebeneinander } from '../testhilfen/geometrie'
import { zufallsProzess } from '../testhilfen/zufallsprozess'
import { erzeugeBpmn } from './export'
import { MASSE, type Layout } from './layout'
import { PARALLEL } from './linien'

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
    // geradeaus an der rechten Ecke, der Weg nach oben an der oberen Ecke
    expect(start('Normal')).toEqual({ x: cx + auf.breite / 2, y: cy })
    expect(start('Vertrieb fragen')).toEqual({ x: cx, y: auf.y })
    // die drei Wege nach unten laufen lange parallel: 20 px auseinander über die ganze untere Kante, der tiefste links außen
    const unten = ['Direkt versenden', 'Sperre', 'Eilig'].map((n) => start(n).x)
    expect(unten[1] - unten[0]).toBeCloseTo(PARALLEL.mindestens, 6)
    expect(unten[2] - unten[1]).toBeCloseTo(PARALLEL.mindestens, 6)
    expect(unten[0]).toBeGreaterThanOrEqual(auf.x)
    expect(unten[2]).toBeLessThanOrEqual(auf.x + auf.breite)
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
    // Acht Aufgaben untereinander (zwei Entscheidungen mit je vier Fällen nebeneinander), jede bekommt eine Nachricht vom
    // Kunden: acht Spuren in der Lücke vor ihnen; wo zwei lange nebeneinander zum Pool laufen, 24 px auseinander (geometrieFehler).
    const team = neueRolle('Team')
    const kunde = neuerTeilnehmer('Kunde')
    const faelle = (von: number) => Array.from({ length: 4 }, (_, i) => neuerZweig(`Fall ${von + i}`, 1 / 4, { schritte: [neueAufgabe({ name: `Antwort ${von + i}`, rolleId: team.id, nachrichtVon: kunde.id })] }))
    const par = neueParallel(2)
    par.zweige[0].schritte = [neueEntscheidung({ frage: 'Welcher Fall?', zweige: faelle(1) })]
    par.zweige[1].schritte = [neueEntscheidung({ frage: 'Welcher Fall?', zweige: faelle(5) })]
    const p = neuerProzess({ name: 'Viele Nachrichten', rollen: [team], teilnehmer: [kunde], ablauf: { id: 'haupt', schritte: [par] } })
    const { layout } = erzeugeBpmn(p)
    expect(geometrieFehler(layout)).toEqual([])
    const xs = [...new Set(layout.nachrichten.map((n) => Math.round(n.punkte[0].x)))].sort((a, b) => a - b)
    expect(xs).toHaveLength(8)
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(9)
    // die Lücke zwischen Verzweigung und Aufgaben ist breiter geworden als die übliche Spaltenbreite
    const auf = layout.knoten.find((k) => k.art === 'xor' && k.richtung === 'auf')!
    const aufgabe = layout.knoten.find((k) => k.art === 'aufgabe')!
    expect(aufgabe.x + aufgabe.breite / 2 - (auf.x + auf.breite / 2)).toBeGreaterThan(MASSE.spalte)
  })

  it('trennt lange parallele Strecken: Nachrichten im Beispiel Lieferdienst und der Fächer im Beispiel Onlinebestellung', () => {
    // Befund aus der Compliance-Abnahme: Beide Nachrichten liefen 777 px senkrecht mit 10 px Abstand und verschmolzen beim Einpassen zu einer Linie.
    const { layout } = erzeugeBpmn(beispielLieferdienst())
    const senkrechtes = (n: { punkte: { x: number; y: number }[] }) => {
      const stuecke = n.punkte.slice(1).map((q, i) => [n.punkte[i], q] as const).filter(([a, b]) => Math.abs(a.x - b.x) < 0.01)
      return stuecke.sort((a, b) => Math.abs(b[1].y - b[0].y) - Math.abs(a[1].y - a[0].y))[0]
    }
    const hin = layout.nachrichten.find((n) => n.von === 'auf_benachrichtigen')!
    const zurueck = layout.nachrichten.find((n) => n.nach === 'wrt_termin')!
    const [a, b] = [senkrechtes(hin), senkrechtes(zurueck)]
    expect(Math.min(Math.abs(a[0].y - a[1].y), Math.abs(b[0].y - b[1].y))).toBeGreaterThan(700)
    expect(Math.abs(a[0].x - b[0].x)).toBeGreaterThanOrEqual(PARALLEL.kanal)
    expect(langeParallelen(layout)).toEqual([])
    // Gleichzeitig: Die beiden Wege nach unten (Lager, Buchhaltung) liefen 475 px mit 10 px Abstand; jetzt 20 px auf der unteren Kante
    const online = erzeugeBpmn(beispielOnlinebestellung()).layout
    const und = online.knoten.find((k) => k.art === 'und' && k.richtung === 'auf')!
    const xs = online.kanten.filter((e) => e.von === und.id && e.punkte[0].y > und.y + und.hoehe / 2).map((e) => e.punkte[0].x)
    expect(xs).toHaveLength(2)
    expect(Math.abs(xs[0] - xs[1])).toBeCloseTo(PARALLEL.mindestens, 6)
    expect(langeParallelen(online)).toEqual([])
  })

  it('meldet zwei Flüsse, die lange dicht nebeneinander laufen, und lässt kurze Stücke zu', () => {
    const linie = (id: string, x: number, y2: number) => ({ id, von: 'a', nach: 'b', punkte: [{ x, y: 0 }, { x, y: y2 }] })
    const mit = (kanten: ReturnType<typeof linie>[]) => ({ kanten, nachrichten: [] }) as unknown as Layout
    expect(langeParallelen(mit([linie('A', 0, 777), linie('B', 10, 777)]))).toEqual(['A und B laufen 777 px mit nur 10 px Abstand nebeneinander'])
    // 20 px Abstand oder höchstens 100 px nebeneinander sind erlaubt
    expect(langeParallelen(mit([linie('A', 0, 777), linie('B', 20, 777)]))).toEqual([])
    expect(langeParallelen(mit([linie('A', 0, 100), linie('B', 10, 300)]))).toEqual([])
    expect(nebeneinander({ x: 0, y: 5 }, { x: 200, y: 5 }, { x: 150, y: 13 }, { x: 50, y: 13 })).toEqual({ abstand: 8, laenge: 100 })
  })

  it('Grenze: mehr als sechs Wege in eine Richtung passen nicht mit Abstand auf eine Raute; sie liegen dann dicht, aber nie auf einer Strecke', () => {
    const team = neueRolle('Team')
    const zweige = Array.from({ length: 8 }, (_, i) => neuerZweig(`Fall ${i + 1}`, 1 / 8, { schritte: [neueAufgabe({ name: `Antwort ${i + 1}`, rolleId: team.id })] }))
    const p = neuerProzess({ name: 'Acht Fälle', rollen: [team], ablauf: { id: 'haupt', schritte: [neueEntscheidung({ id: 'ent_acht', frage: 'Welcher Fall?', zweige })] } })
    const { layout } = erzeugeBpmn(p)
    const fehler = geometrieFehler(layout)
    expect(fehler.filter((f) => !f.includes('nebeneinander'))).toEqual([])
    // Nur die Wege aus der Verzweigung bzw. in die Zusammenführung liegen dicht
    const amFaecher = new Set(layout.kanten.filter((e) => e.von === 'ent_acht_auf' || e.nach === 'ent_acht_zu').map((e) => e.id))
    const paare = langeParallelen(layout).map((f) => f.split(' laufen')[0].split(' und '))
    expect(paare.length).toBeGreaterThan(0)
    for (const [x, y] of paare) expect(amFaecher.has(x) && amFaecher.has(y)).toBe(true)
  })
})
