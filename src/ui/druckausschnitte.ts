/**
 * Großes Diagramm im Druck (Anlage 9.1): Auf Seitenbreite ist es unlesbar klein
 * (Beispiel: Maßstab 0,14, Schrift 1,2 pt). Nach der Übersicht folgen deshalb
 * Ausschnitte in lesbarem Maßstab, die sich überlappen. Jeder Ausschnitt ist ein
 * eigenes SVG mit passendem Blickfeld (viewBox); quer gestellte Ausschnitte sind
 * im SVG selbst gedreht. So sieht der Druck im Browser und im Windows-Programm
 * (WebView2 druckt immer A4 hoch) gleich aus.
 *
 * Maße in CSS-Pixeln (96 je Zoll), das Diagramm in den Koordinaten von bpmn-js.
 */

export interface Rechteck {
  x: number
  y: number
  breite: number
  hoehe: number
}

export interface Ausschnitt extends Rechteck {
  nr: number
}

export interface AusschnittPlan {
  /** zeilenweise von links oben */
  ausschnitte: Ausschnitt[]
  spalten: number
  zeilen: number
  /** Druckpixel je Diagrammpixel */
  massstab: number
  /** quer: im SVG um 90° gedreht, der Ablauf läuft auf der Hochformatseite von unten nach oben */
  gedreht: boolean
}

export const DRUCK = {
  /** Satzbreite A4 hoch mit 15 mm Rand: 180 mm */
  breite: 680,
  /** größte Bildhöhe: 238 mm, darüber steht „Ausschnitt n von m“ */
  hoehe: 900,
  /** Seitenhöhe ohne Ränder (oben 15 mm, unten 18 mm für die Fußzeile): 264 mm */
  seite: 997,
  /** Zeile „Ausschnitt n von m“ samt Abständen */
  unterschrift: 40,
  /** Überlappung benachbarter Ausschnitte in Diagrammpixeln */
  ueberlappung: 40,
  /** 11-px-Beschriftungen von bpmn-js werden so etwa 5 pt groß (11 × 0,6 × 0,75) */
  mindestMassstab: 0.6,
  /** nicht größer als nötig: 11 px werden höchstens 6,6 pt */
  hoechstMassstab: 0.8,
}

/** Lage und Größe des Diagramms aus dem viewBox des SVG (saveSVG von bpmn-js) */
export function svgRahmen(svg: string): Rechteck | null {
  const kopf = /<svg[\s>][^>]*/.exec(svg)?.[0] ?? ''
  const werte = /\sviewBox="([^"]*)"/.exec(kopf)?.[1].trim().split(/[\s,]+/).map(Number)
  if (!werte || werte.length !== 4 || !werte.every(Number.isFinite) || werte[2] <= 0 || werte[3] <= 0) return null
  return { x: werte[0], y: werte[1], breite: werte[2], hoehe: werte[3] }
}

function variante(r: Rechteck, d: typeof DRUCK, gedreht: boolean): { plan: AusschnittPlan; seiten: number } {
  // Gedreht liegt die Breite des Diagramms entlang der Seitenhöhe
  const fx = gedreht ? d.hoehe : d.breite
  const fy = gedreht ? d.breite : d.hoehe
  const o = d.ueberlappung
  const anzahl = (laenge: number, flaeche: number) => Math.max(1, Math.ceil((laenge - o) / (flaeche / d.mindestMassstab - o) - 1e-9))
  const spalten = anzahl(r.breite, fx)
  const zeilen = anzahl(r.hoehe, fy)
  // gleich große Ausschnitte; der Maßstab wächst, bis einer die Fläche füllt
  const kb = (r.breite - o) / spalten + o
  const kh = (r.hoehe - o) / zeilen + o
  const massstab = Math.min(fx / kb, fy / kh, d.hoechstMassstab)
  const ausschnitte: Ausschnitt[] = []
  for (let z = 0; z < zeilen; z++) for (let s = 0; s < spalten; s++) ausschnitte.push({ nr: ausschnitte.length + 1, x: r.x + s * (kb - o), y: r.y + z * (kh - o), breite: kb, hoehe: kh })
  // niedrige Ausschnitte teilen sich eine Seite
  const jeSeite = Math.max(1, Math.floor(d.seite / ((gedreht ? kb : kh) * massstab + d.unterschrift)))
  return { plan: { ausschnitte, spalten, zeilen, massstab, gedreht }, seiten: Math.ceil(ausschnitte.length / jeSeite) }
}

/**
 * Ausschnitte für ein Diagramm, dessen Übersicht auf der Seite unlesbar klein wäre; sonst null.
 * Hoch oder quer, je nachdem, was weniger Seiten braucht; bei Gleichstand hoch (das Blatt bleibt, wie es ist).
 */
export function planeAusschnitte(r: Rechteck, d = DRUCK): AusschnittPlan | null {
  if (Math.min(d.breite / r.breite, d.hoehe / r.hoehe) >= d.mindestMassstab) return null
  const [hoch, quer] = [variante(r, d, false), variante(r, d, true)]
  const besser = quer.seiten < hoch.seiten || (quer.seiten === hoch.seiten && quer.plan.ausschnitte.length < hoch.plan.ausschnitte.length)
  return (besser ? quer : hoch).plan
}

const zahl = (n: number) => String(Math.round(n * 100) / 100)

/** Wurzelelement ab „<svg“ (ohne XML-Kopf und Doctype) mit neuen Maßen und Blickfeld */
function mitBlickfeld(svg: string, r: Rechteck): string {
  const start = svg.search(/<svg[\s>]/)
  const ende = svg.indexOf('>', start)
  let kopf = svg.slice(start, ende)
  const setze = (name: string, wert: string) => {
    const attr = new RegExp(`(\\s${name}=)"[^"]*"`)
    kopf = attr.test(kopf) ? kopf.replace(attr, `$1"${wert}"`) : `${kopf} ${name}="${wert}"`
  }
  setze('width', zahl(r.breite))
  setze('height', zahl(r.hoehe))
  setze('viewBox', `${zahl(r.x)} ${zahl(r.y)} ${zahl(r.breite)} ${zahl(r.hoehe)}`)
  return (kopf + svg.slice(ende)).trimEnd()
}

/** SVG eines Ausschnitts; gedreht um 90° gegen den Uhrzeigersinn: Zum Lesen das Blatt im Uhrzeigersinn drehen. */
export function ausschnittSvg(svg: string, a: Rechteck, gedreht: boolean): string {
  const innen = mitBlickfeld(svg, a)
  if (!gedreht) return innen
  const b = zahl(a.breite)
  const h = zahl(a.hoehe)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${h}" height="${b}" viewBox="0 0 ${h} ${b}"><g transform="translate(0 ${b}) rotate(-90)">${innen}</g></svg>`
}

/** Übersicht mit nummerierten Rahmen der Ausschnitte; die Rahmen lassen die Überlappung weg, damit sich keine Linien doppeln. */
export function uebersichtSvg(svg: string, plan: AusschnittPlan, d = DRUCK): string {
  const r = svgRahmen(svg)
  const ende = svg.lastIndexOf('</svg>')
  if (!r || ende < 0) return svg
  // Druckpunkt → Diagrammpixel bei dem Maßstab, mit dem die Übersicht auf die Seite passt
  const pt = (n: number) => n / 0.75 / Math.min(d.breite / r.breite, d.hoehe / r.hoehe)
  const halb = d.ueberlappung / 2
  const rahmen = plan.ausschnitte.map((a) => {
    const x1 = a.x > r.x + 0.5 ? a.x + halb : a.x
    const y1 = a.y > r.y + 0.5 ? a.y + halb : a.y
    const x2 = a.x + a.breite < r.x + r.breite - 0.5 ? a.x + a.breite - halb : a.x + a.breite
    const y2 = a.y + a.hoehe < r.y + r.hoehe - 0.5 ? a.y + a.hoehe - halb : a.y + a.hoehe
    return (
      `<rect x="${zahl(x1)}" y="${zahl(y1)}" width="${zahl(x2 - x1)}" height="${zahl(y2 - y1)}" fill="none" stroke="#1c5cab" stroke-width="${zahl(pt(1))}" stroke-dasharray="${zahl(pt(4))} ${zahl(pt(2))}"/>` +
      `<text x="${zahl(x1 + pt(3))}" y="${zahl(y1 + pt(13))}" font-family="Arial, sans-serif" font-size="${zahl(pt(10))}" font-weight="700" fill="#1c5cab" stroke="#fff" stroke-width="${zahl(pt(2.5))}" paint-order="stroke">${a.nr}</text>`
    )
  })
  return `${svg.slice(0, ende)}<g class="pl-ausschnitte">${rahmen.join('')}</g>${svg.slice(ende)}`
}
