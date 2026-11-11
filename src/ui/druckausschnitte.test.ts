import { describe, expect, it } from 'vitest'
import { berechneLayout } from '../bpmn/layout'
import { beispielLieferdienst, beispielOnlinebestellung } from '../modell/beispiel'
import { zufallsProzess } from '../testhilfen/zufallsprozess'
import type { Prozess } from '../modell/typen'
import { ausschnittSvg, DRUCK, druckFormen, liegtGanzIn, planeAusschnitte, svgRahmen, uebersichtSvg, type AusschnittPlan, type DruckForm, type Rechteck } from './druckausschnitte'

// Kopf eines SVG aus bpmn-js (saveSVG), Inhalt gekürzt
const svg = (b: number, h: number, x = -5, y = -105) =>
  `<?xml version="1.0" encoding="utf-8"?>\n<!-- created with bpmn-js / http://bpmn.io -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${b}" height="${h}" viewBox="${x} ${y} ${b} ${h}" version="1.1"><g class="djs-group"><text style="font-size: 11px">Kunde bestellt</text></g></svg>`

/** Beispiel Lieferdienst ohne Formen: 4700 × 1220 px */
const LIEFERDIENST: Rechteck = { x: -5, y: -105, breite: 4700, hoehe: 1220 }

const vereinige = (a: Rechteck, b: Rechteck): Rechteck => {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, breite: Math.max(a.x + a.breite, b.x + b.breite) - x, hoehe: Math.max(a.y + a.hoehe, b.y + b.hoehe) - y }
}

/** Formen wie aus bpmn-js, hier aus dem Layout des Prozesslotsen (dieselben Koordinaten wie im BPMN-Export); dazu die Fläche wie bei saveSVG */
function ausLayout(p: Prozess): { r: Rechteck; formen: DruckForm[] } {
  const l = berechneLayout(p)
  const formen: DruckForm[] = [
    { ...l.pool, art: 'pool', name: p.name, eingeklappt: false },
    ...l.pools.map((pl): DruckForm => ({ x: pl.x, y: pl.y, breite: pl.breite, hoehe: pl.hoehe, art: 'pool', name: pl.name, eingeklappt: true })),
    ...l.bahnen.map((b): DruckForm => ({ x: b.x, y: b.y, breite: b.breite, hoehe: b.hoehe, art: 'bahn', name: b.name })),
    ...l.knoten.map((k): DruckForm => ({ ...(k.beschriftung ? vereinige(k, k.beschriftung) : { x: k.x, y: k.y, breite: k.breite, hoehe: k.hoehe }), art: 'form', name: k.name })),
    ...l.kanten.flatMap((k): DruckForm[] => (k.beschriftung ? [{ ...k.beschriftung, art: 'form', name: k.name }] : [])),
  ]
  const alles = formen.reduce<Rechteck>((a, f) => vereinige(a, f), formen[0])
  return { r: { x: alles.x - 1, y: alles.y - 1, breite: alles.breite + 2, hoehe: alles.hoehe + 2 }, formen }
}

/** Jede Form liegt in mindestens einem Ausschnitt ganz; Nummern, Maße und Rand stimmen. */
function pruefePlan(plan: AusschnittPlan, r: Rechteck, formen: readonly DruckForm[] = []) {
  expect(plan.ausschnitte).toHaveLength(plan.spalten * plan.zeilen)
  expect(plan.ausschnitte.map((a) => a.nr)).toEqual(plan.ausschnitte.map((_, i) => i + 1))
  const erster = plan.ausschnitte[0]
  const letzter = plan.ausschnitte[plan.ausschnitte.length - 1]
  expect(erster.x).toBeCloseTo(r.x)
  expect(erster.y).toBeCloseTo(r.y)
  expect(letzter.x + letzter.breite).toBeCloseTo(r.x + r.breite)
  expect(letzter.y + letzter.hoehe).toBeCloseTo(r.y + r.hoehe)
  for (const a of plan.ausschnitte) {
    // auf eine Seite passend, samt Kopf mit den Namen, und lesbar: 11-px-Schrift mindestens etwa 5 pt
    const [b, h] = plan.gedreht ? [a.hoehe, a.breite + a.kopf] : [a.breite + a.kopf, a.hoehe]
    expect(b * plan.massstab).toBeLessThanOrEqual(DRUCK.breite + 0.01)
    expect(h * plan.massstab).toBeLessThanOrEqual(DRUCK.hoehe + 0.01)
    expect(11 * plan.massstab * 0.75).toBeGreaterThanOrEqual(4.9)
  }
  // Nachbarn überlappen sich um mindestens DRUCK.ueberlappung; nichts fällt zwischen zwei Ausschnitte
  for (let i = 1; i < plan.ausschnitte.length; i++) {
    const [links, a] = [plan.ausschnitte[i - 1], plan.ausschnitte[i]]
    if (a.y === links.y) expect(links.x + links.breite - a.x).toBeGreaterThanOrEqual(DRUCK.ueberlappung - 0.01)
  }
  for (const f of formen.filter((f) => f.art === 'form')) expect(plan.ausschnitte.some((a) => liegtGanzIn(f, a)), `${f.name || 'Beschriftung'} bei x ${f.x}, y ${f.y}`).toBe(true)
}

describe('Ausschnitte für den Druck der Anlage 9.1 (abnahme-1)', () => {
  it('liest Lage und Größe aus dem SVG von bpmn-js', () => {
    expect(svgRahmen(svg(4700, 1220))).toEqual(LIEFERDIENST)
    expect(svgRahmen('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBeNull()
  })

  it('braucht für ein kleines Diagramm keine Ausschnitte: die Übersicht ist lesbar', () => {
    expect(planeAusschnitte({ x: 0, y: 0, breite: 1000, hoehe: 400 })).toBeNull()
  })

  it('teilt ein breites Diagramm in hohe Ausschnitte mit voller Höhe: Schrift etwa 5,8 statt 1,2 pt', () => {
    const plan = planeAusschnitte(LIEFERDIENST)!
    expect(plan.gedreht).toBe(false)
    expect([plan.spalten, plan.zeilen]).toEqual([5, 1])
    expect(plan.massstab).toBeGreaterThan(0.69)
    pruefePlan(plan, LIEFERDIENST)
  })

  it('dreht flache, breite Diagramme quer, wenn das Seiten spart', () => {
    const r = { x: 0, y: 0, breite: 4700, hoehe: 900 }
    const plan = planeAusschnitte(r)!
    expect(plan.gedreht).toBe(true)
    expect([plan.spalten, plan.zeilen]).toEqual([4, 1])
    pruefePlan(plan, r)
  })

  it('teilt hohe Diagramme auch in Zeilen', () => {
    const r = { x: 10, y: 20, breite: 2600, hoehe: 3100 }
    const plan = planeAusschnitte(r)!
    expect(plan.zeilen).toBeGreaterThan(1)
    pruefePlan(plan, r)
  })

  it('setzt den Ausschnitt als Blickfeld des SVG; gedreht steht der Ablauf von unten nach oben', () => {
    const quelle = svg(4700, 1220)
    const a = { x: 927, y: -105, breite: 972, hoehe: 1220 }
    const gerade = ausschnittSvg(quelle, a, false)
    expect(gerade).toMatch(/^<svg [^>]*viewBox="927 -105 972 1220"/)
    expect(gerade).toMatch(/^<svg [^>]*width="972" height="1220"/)
    expect(gerade).toContain('Kunde bestellt')
    expect(gerade).not.toContain('<!DOCTYPE')

    const quer = ausschnittSvg(quelle, a, true)
    expect(quer).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="1220" height="972" viewBox="0 0 1220 972"><g transform="translate\(0 972\) rotate\(-90\)"><svg /)
    expect(quer).toContain('viewBox="927 -105 972 1220"')
    expect(quer.endsWith('</svg></g></svg>')).toBe(true)
  })

  it('zeichnet die Ausschnitte nummeriert in die Übersicht', () => {
    const plan = planeAusschnitte(LIEFERDIENST)!
    const ueber = uebersichtSvg(svg(4700, 1220), plan)
    expect(ueber).toContain('Kunde bestellt')
    expect(ueber.match(/<rect /g)).toHaveLength(5)
    for (let n = 1; n <= 5; n++) expect(ueber).toContain(`>${n}</text>`)
    expect(ueber.trimEnd().endsWith('</g></svg>')).toBe(true)
  })
})

describe('Schnittkanten zwischen den Formen und Namen am Rand (Sichtprüfung, Mangel 1)', () => {
  const lieferdienst = ausLayout(beispielLieferdienst())

  it('Lieferdienst: jede Form liegt samt Beschriftung in mindestens einem Ausschnitt ganz', () => {
    const { r, formen } = lieferdienst
    expect(formen.filter((f) => f.art === 'form').length).toBeGreaterThan(30)
    const plan = planeAusschnitte(r, formen)!
    pruefePlan(plan, r, formen)
    // vorher lagen „Ware kommissionieren“ und „Lieferscheine abgeben“ auf einer Grenze
    for (const name of ['Ware kommissionieren', 'Lieferscheine abgeben']) {
      const f = formen.find((x) => x.name === name)!
      expect(plan.ausschnitte.some((a) => liegtGanzIn(f, a)), name).toBe(true)
    }
    // ohne die Formen (feste Überlappung) wären Formen zerschnitten worden
    const ohne = planeAusschnitte(r)!
    expect(formen.filter((f) => f.art === 'form').every((f) => ohne.ausschnitte.some((a) => liegtGanzIn(f, a)))).toBe(false)
  })

  it('Rahmen der Übersicht laufen durch Lücken, nicht durch Formen', () => {
    const { r, formen } = lieferdienst
    const plan = planeAusschnitte(r, formen)!
    for (const a of plan.ausschnitte.slice(1)) {
      const kante = a.rahmen.x
      const durch = formen.filter((f) => f.art === 'form' && f.x < kante && kante < f.x + f.breite)
      expect(durch.map((f) => f.name), `Rahmen ${a.nr}`).toEqual([])
    }
  })

  it('wiederholt ab dem zweiten Ausschnitt die Namen von Pools und Bahnen am linken Rand', () => {
    const { r, formen } = lieferdienst
    const plan = planeAusschnitte(r, formen)!
    const quelle = svg(r.breite, r.hoehe, r.x, r.y)
    expect(plan.ausschnitte[0].kopf).toBe(0)
    expect(ausschnittSvg(quelle, plan.ausschnitte[0], plan.gedreht, formen)).not.toContain('pl-koepfe')
    const namen = formen.filter((f) => f.art === 'bahn' || f.art === 'pool').map((f) => f.name)
    expect(namen).toEqual(expect.arrayContaining(['Bestellung bis Rechnung (Lieferdienst)', 'Kunde', 'Innendienst', 'Lager', 'Fahrer', 'Niederlassungsleitung']))
    for (const a of plan.ausschnitte.slice(1)) {
      // Pool außen, Bahnen innen: zwei Köpfe zu je 30 px
      expect(a.kopf).toBe(2 * DRUCK.kopfbreite)
      const bild = ausschnittSvg(quelle, a, plan.gedreht, formen)
      expect(bild).toContain(`viewBox="${Math.round((a.x - a.kopf) * 100) / 100} `)
      const kopf = bild.slice(bild.indexOf('<g class="pl-koepfe">'))
      for (const n of namen) expect(kopf, `Ausschnitt ${a.nr}`).toContain(`>${n}</text>`)
    }
  })

  it('kürzt zu lange Namen, statt über den Kopf hinauszuschreiben', () => {
    const formen: DruckForm[] = [
      { x: 0, y: 0, breite: 4000, hoehe: 60, art: 'pool', name: 'Ein sehr langer Name eines Teilnehmers, der nicht passt', eingeklappt: true },
      { x: 0, y: 100, breite: 4000, hoehe: 500, art: 'pool', name: 'Prozess' },
      { x: 30, y: 100, breite: 3970, hoehe: 500, art: 'bahn', name: 'Buchhaltung & Controlling' },
    ]
    const r = { x: -1, y: -1, breite: 4002, hoehe: 602 }
    const plan = planeAusschnitte(r, formen)!
    const bild = ausschnittSvg(svg(4002, 602, -1, -1), plan.ausschnitte[1], plan.gedreht, formen)
    expect(bild).toContain('>Buchhaltung &amp; Controlling</text>')
    expect(bild).toMatch(/>Ein sehr[^<]*…<\/text>/)
  })

  it('erste Spalte bei mehreren Zeilen: der Kopf zeigt die Namen der sichtbaren Bahnen', () => {
    const formen: DruckForm[] = [
      { x: 0, y: 0, breite: 2600, hoehe: 3000, art: 'pool', name: 'Prozess' },
      ...Array.from({ length: 10 }, (_, i): DruckForm => ({ x: 30, y: i * 300, breite: 2570, hoehe: 300, art: 'bahn', name: `Rolle ${i + 1}` })),
    ]
    const r = { x: -1, y: -1, breite: 2602, hoehe: 3002 }
    const plan = planeAusschnitte(r, formen)!
    expect(plan.zeilen).toBeGreaterThan(1)
    const unten = plan.ausschnitte.filter((a) => a.x === r.x).at(-1)!
    expect(unten.y).toBeGreaterThan(1500)
    expect(unten.kopfDarin).toBe(0)
    const bild = ausschnittSvg(svg(2602, 3002, -1, -1), unten, plan.gedreht, formen)
    expect(bild).toContain('>Rolle 10</text>')
    expect(bild).not.toContain('>Rolle 1</text>')
  })

  it('zweites Beispiel (Onlinebestellung): jede Form ganz in einem Ausschnitt', () => {
    const { r, formen } = ausLayout(beispielOnlinebestellung())
    const plan = planeAusschnitte(r, formen)
    if (plan) pruefePlan(plan, r, formen)
  })

  it('auch ohne Lücke (Formen dicht an dicht) liegt jede Form ganz in einem Ausschnitt', () => {
    // überlappende Kette: Keine Stelle ist frei, die Schnitte weichen auf größere Überlappung aus
    const formen: DruckForm[] = Array.from({ length: 60 }, (_, i) => ({ x: i * 80, y: 100 + (i % 3) * 120, breite: 120, hoehe: 80, art: 'form' as const, name: `F${i}` }))
    const r = { x: -5, y: 0, breite: 60 * 80 + 50, hoehe: 600 }
    pruefePlan(planeAusschnitte(r, formen)!, r, formen)
  })

  it('zufällige Diagramme: jede Form ganz in einem Ausschnitt, jeder Ausschnitt passt auf die Seite', () => {
    let saat = 7
    const zufall = () => (saat = (saat * 16807) % 2147483647) / 2147483647
    for (let lauf = 0; lauf < 40; lauf++) {
      const breite = 1500 + zufall() * 6000
      const hoehe = 300 + zufall() * 3500
      const formen: DruckForm[] = Array.from({ length: 10 + Math.floor(zufall() * 60) }, (_, i) => {
        const b = 36 + zufall() * 120
        const h = 36 + zufall() * 90
        return { x: zufall() * (breite - b), y: zufall() * (hoehe - h), breite: b, hoehe: h, art: 'form' as const, name: `F${i}` }
      })
      const r = { x: 0, y: 0, breite, hoehe }
      const plan = planeAusschnitte(r, formen)
      if (plan) pruefePlan(plan, r, formen)
    }
  })

  it('übernimmt Formen, Pools und Bahnen aus bpmn-js; die Beschriftung gehört zu ihrer Form', () => {
    const elemente = [
      { id: 'Kollaboration', type: 'bpmn:Collaboration' },
      { id: 'Teilnehmer', type: 'bpmn:Participant', x: 0, y: 0, width: 1000, height: 400, businessObject: { name: 'Prozess', processRef: {} } },
      { id: 'Pool_Kunde', type: 'bpmn:Participant', x: 0, y: -100, width: 1000, height: 60, businessObject: { name: 'Kunde' } },
      { id: 'Bahn_A', type: 'bpmn:Lane', x: 30, y: 0, width: 970, height: 400, businessObject: { name: 'Innendienst' } },
      { id: 'Start', type: 'bpmn:StartEvent', x: 100, y: 100, width: 36, height: 36, businessObject: { name: 'Kunde bestellt telefonisch' } },
      { id: 'Start_label', type: 'label', x: 73, y: 143, width: 90, height: 27, labelTarget: { id: 'Start' } },
      { id: 'Fluss', type: 'bpmn:SequenceFlow', waypoints: [{ x: 136, y: 118 }, { x: 200, y: 118 }], businessObject: { name: 'Ja' } },
      { id: 'Fluss_label', type: 'label', x: 150, y: 100, width: 20, height: 14, labelTarget: { id: 'Fluss', waypoints: [] } },
    ]
    expect(druckFormen(elemente)).toEqual([
      { x: 0, y: 0, breite: 1000, hoehe: 400, art: 'pool', name: 'Prozess', eingeklappt: false },
      { x: 0, y: -100, breite: 1000, hoehe: 60, art: 'pool', name: 'Kunde', eingeklappt: true },
      { x: 30, y: 0, breite: 970, hoehe: 400, art: 'bahn', name: 'Innendienst' },
      { x: 73, y: 100, breite: 90, hoehe: 70, art: 'form', name: 'Kunde bestellt telefonisch' },
      { x: 150, y: 100, breite: 20, hoehe: 14, art: 'form', name: '' },
    ])
  })
})

describe('Anlage 9.1 mit Rahmen und Randereignissen (Format 4)', () => {
  /** Elemente, wie bpmn-js sie nach dem Import liefert, aus dem Layout des Prozesslotsen (gleiche Koordinaten wie im BPMN-Export) */
  function bpmnElemente(p: Prozess): { r: Rechteck; elemente: unknown[] } {
    const l = berechneLayout(p)
    const form = (id: string, type: string, x: Rechteck, werte: Record<string, unknown> = {}) => ({ id, type, x: x.x, y: x.y, width: x.breite, height: x.hoehe, ...werte })
    const elemente: unknown[] = [
      form('Teilnehmer', 'bpmn:Participant', l.pool, { businessObject: { name: p.name, processRef: {} } }),
      ...l.pools.map((pl) => form(pl.id, 'bpmn:Participant', pl, { businessObject: { name: pl.name } })),
      ...l.bahnen.map((b) => form(`Bahn_${b.schluessel}`, 'bpmn:Lane', b, { businessObject: { name: b.name } })),
      ...l.rahmen.map((ra) => form(ra.id, ra.art === 'adhoc' ? 'bpmn:AdHocSubProcess' : 'bpmn:SubProcess', ra, { collapsed: false, businessObject: { name: ra.name, ...(ra.mehrfach ? { loopCharacteristics: {} } : {}) } })),
      ...l.knoten.map((k) => form(k.id, k.art === 'rand' ? 'bpmn:BoundaryEvent' : 'bpmn:Task', k, { businessObject: { name: k.name } })),
      ...l.knoten.flatMap((k) => (k.beschriftung ? [form(`${k.id}_label`, 'label', k.beschriftung, { labelTarget: { id: k.id } })] : [])),
      ...l.kanten.flatMap((k) => (k.beschriftung ? [form(`${k.id}_label`, 'label', k.beschriftung, { labelTarget: { id: k.id, waypoints: [] } })] : [])),
    ]
    const alle = elemente as { x: number; y: number; width: number; height: number }[]
    const x1 = Math.min(...alle.map((e) => e.x))
    const y1 = Math.min(...alle.map((e) => e.y))
    const x2 = Math.max(...alle.map((e) => e.x + e.width))
    const y2 = Math.max(...alle.map((e) => e.y + e.height))
    return { r: { x: x1 - 1, y: y1 - 1, breite: x2 - x1 + 2, hoehe: y2 - y1 + 2 }, elemente }
  }

  it('ein aufgeklappter Teilprozess ist ein Rahmen; Name und Markierung zählen als Formen', () => {
    const elemente = [
      { id: 'tp_1', type: 'bpmn:SubProcess', x: 100, y: 50, width: 1200, height: 300, collapsed: false, businessObject: { name: 'Für jede Position', loopCharacteristics: {} } },
      { id: 'tp_2', type: 'bpmn:AdHocSubProcess', x: 100, y: 400, width: 300, height: 200, collapsed: false, businessObject: { name: '' } },
      { id: 'tp_3', type: 'bpmn:SubProcess', x: 500, y: 400, width: 100, height: 80, collapsed: true, businessObject: { name: 'Zu' } },
    ]
    const formen = druckFormen(elemente)
    expect(formen.filter((f) => f.art === 'rahmen').map((f) => f.name)).toEqual(['Für jede Position', ''])
    const name = formen.find((f) => f.art === 'form' && f.name === 'Für jede Position')!
    // oben in der Mitte, so breit wie der Text
    expect(name.y).toBe(50)
    expect(name.x + name.breite / 2).toBeCloseTo(700)
    expect(name.breite).toBeLessThan(150)
    // Markierungen in der Mitte der Unterkante: Mehrfachinstanz und Ad-hoc-Tilde
    const marken = formen.filter((f) => f.art === 'form' && f.name === '' && f.breite === 36)
    expect(marken.map((m) => [m.x + 18, m.y + m.hoehe])).toEqual([
      [700, 350],
      [250, 600],
    ])
    // zugeklappt: eine gewöhnliche Form
    expect(formen.find((f) => f.name === 'Zu')?.art).toBe('form')
  })

  it('der Name eines Randereignisses an seinem Abgang weit unten ist eine eigene Form', () => {
    const elemente = [
      { id: 'Rand', type: 'bpmn:BoundaryEvent', x: 300, y: 182, width: 36, height: 36, businessObject: { name: 'Kunde storniert' } },
      { id: 'Rand_label', type: 'label', x: 345, y: 900, width: 90, height: 27, labelTarget: { id: 'Rand' } },
      { id: 'Start', type: 'bpmn:StartEvent', x: 100, y: 100, width: 36, height: 36, businessObject: { name: 'Start' } },
      { id: 'Start_label', type: 'label', x: 90, y: 143, width: 56, height: 14, labelTarget: { id: 'Start' } },
    ]
    expect(druckFormen(elemente)).toEqual([
      { x: 300, y: 182, breite: 36, hoehe: 36, art: 'form', name: 'Kunde storniert' },
      { x: 90, y: 100, breite: 56, hoehe: 57, art: 'form', name: 'Start' },
      { x: 345, y: 900, breite: 90, hoehe: 27, art: 'form', name: '' },
    ])
  })

  it('Zufallsprozesse mit Rahmen: jede Form, jeder Rahmenname und jedes Randereignis liegt ganz in einem Ausschnitt; Schnitte laufen durch Rahmen', () => {
    let geprueft = 0
    let durchRahmen = 0
    for (let s = 1; s <= 300; s++) {
      const p = zufallsProzess(s)
      const { r, elemente } = bpmnElemente(p)
      const formen = druckFormen(elemente)
      const rahmen = formen.filter((f) => f.art === 'rahmen')
      if (rahmen.length === 0) continue
      const plan = planeAusschnitte(r, formen)
      if (!plan) continue
      geprueft++
      pruefePlan(plan, r, formen)
      // Randereignisse sind gewöhnliche Formen
      expect(formen.filter((f) => f.art === 'form').length).toBeGreaterThanOrEqual(berechneLayout(p).knoten.length)
      durchRahmen += plan.ausschnitte.slice(1).filter((a) => rahmen.some((f) => f.x < a.rahmen.x && a.rahmen.x < f.x + f.breite)).length
    }
    expect(geprueft).toBeGreaterThan(50)
    // Wären Rahmen Formen, müsste jeder Schnitt um sie herum; so laufen viele hindurch
    expect(durchRahmen).toBeGreaterThan(20)
  }, 60_000)
})
