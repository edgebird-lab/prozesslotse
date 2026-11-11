import { describe, expect, it } from 'vitest'
import { ausschnittSvg, DRUCK, planeAusschnitte, svgRahmen, uebersichtSvg, type AusschnittPlan, type Rechteck } from './druckausschnitte'

// Kopf eines SVG aus bpmn-js (saveSVG), Inhalt gekürzt
const svg = (b: number, h: number) =>
  `<?xml version="1.0" encoding="utf-8"?>\n<!-- created with bpmn-js / http://bpmn.io -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${b}" height="${h}" viewBox="-5 -105 ${b} ${h}" version="1.1"><g class="djs-group"><text style="font-size: 11px">Kunde bestellt</text></g></svg>`

/** Beispiel Lieferdienst: 4700 × 1220 px */
const LIEFERDIENST: Rechteck = { x: -5, y: -105, breite: 4700, hoehe: 1220 }

function pruefeAbdeckung(plan: AusschnittPlan, r: Rechteck) {
  const xs = [...new Set(plan.ausschnitte.map((a) => a.x))].sort((a, b) => a - b)
  const ys = [...new Set(plan.ausschnitte.map((a) => a.y))].sort((a, b) => a - b)
  expect(xs).toHaveLength(plan.spalten)
  expect(ys).toHaveLength(plan.zeilen)
  expect(plan.ausschnitte).toHaveLength(plan.spalten * plan.zeilen)
  const erster = plan.ausschnitte[0]
  const letzter = plan.ausschnitte[plan.ausschnitte.length - 1]
  expect(erster.x).toBeCloseTo(r.x)
  expect(erster.y).toBeCloseTo(r.y)
  expect(letzter.x + letzter.breite).toBeCloseTo(r.x + r.breite)
  expect(letzter.y + letzter.hoehe).toBeCloseTo(r.y + r.hoehe)
  for (const a of plan.ausschnitte) {
    // auf eine Seite passend und lesbar: 11-px-Schrift mindestens etwa 5 pt
    const [b, h] = plan.gedreht ? [a.hoehe, a.breite] : [a.breite, a.hoehe]
    expect(b * plan.massstab).toBeLessThanOrEqual(DRUCK.breite + 0.01)
    expect(h * plan.massstab).toBeLessThanOrEqual(DRUCK.hoehe + 0.01)
    expect(11 * plan.massstab * 0.75).toBeGreaterThanOrEqual(4.9)
  }
  // Nachbarn überlappen sich um genau DRUCK.ueberlappung
  for (let i = 1; i < xs.length; i++) {
    const links = plan.ausschnitte.find((a) => a.x === xs[i - 1])!
    expect(links.x + links.breite - xs[i]).toBeCloseTo(DRUCK.ueberlappung)
  }
  for (let i = 1; i < ys.length; i++) {
    const oben = plan.ausschnitte.find((a) => a.y === ys[i - 1])!
    expect(oben.y + oben.hoehe - ys[i]).toBeCloseTo(DRUCK.ueberlappung)
  }
  expect(plan.ausschnitte.map((a) => a.nr)).toEqual(plan.ausschnitte.map((_, i) => i + 1))
}

describe('Ausschnitte für den Druck der Anlage 9.1 (abnahme-1)', () => {
  it('liest Lage und Größe aus dem SVG von bpmn-js', () => {
    expect(svgRahmen(svg(4700, 1220))).toEqual(LIEFERDIENST)
    expect(svgRahmen('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBeNull()
  })

  it('braucht für ein kleines Diagramm keine Ausschnitte: die Übersicht ist lesbar', () => {
    expect(planeAusschnitte({ x: 0, y: 0, breite: 1000, hoehe: 400 })).toBeNull()
  })

  it('teilt das Beispiel in fünf hohe Ausschnitte mit voller Höhe: Schrift etwa 5,8 statt 1,2 pt', () => {
    const plan = planeAusschnitte(LIEFERDIENST)!
    expect(plan.gedreht).toBe(false)
    expect([plan.spalten, plan.zeilen]).toEqual([5, 1])
    expect(plan.massstab).toBeGreaterThan(0.69)
    pruefeAbdeckung(plan, LIEFERDIENST)
  })

  it('dreht flache, breite Diagramme quer, wenn das Seiten spart', () => {
    const r = { x: 0, y: 0, breite: 4700, hoehe: 900 }
    const plan = planeAusschnitte(r)!
    expect(plan.gedreht).toBe(true)
    expect([plan.spalten, plan.zeilen]).toEqual([4, 1])
    pruefeAbdeckung(plan, r)
  })

  it('teilt hohe Diagramme auch in Zeilen', () => {
    const r = { x: 10, y: 20, breite: 2600, hoehe: 3100 }
    const plan = planeAusschnitte(r)!
    expect(plan.zeilen).toBeGreaterThan(1)
    pruefeAbdeckung(plan, r)
  })

  it('setzt den Ausschnitt als Blickfeld des SVG; gedreht steht der Ablauf von unten nach oben', () => {
    const quelle = svg(4700, 1220)
    const a = { nr: 2, x: 927, y: -105, breite: 972, hoehe: 1220 }
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
