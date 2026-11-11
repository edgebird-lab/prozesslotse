/**
 * Großes Diagramm im Druck (Anlage 9.1): Auf Seitenbreite ist es unlesbar klein
 * (Beispiel: Maßstab 0,14, Schrift 1,2 pt). Nach der Übersicht folgen deshalb
 * Ausschnitte in lesbarem Maßstab, die sich überlappen. Jeder Ausschnitt ist ein
 * eigenes SVG mit passendem Blickfeld (viewBox); quer gestellte Ausschnitte sind
 * im SVG selbst gedreht. So sieht der Druck im Browser und im Windows-Programm
 * (WebView2 druckt immer A4 hoch) gleich aus.
 *
 * Die Schnittkanten liegen möglichst in Lücken zwischen den Formen (Aufgaben,
 * Ereignisse, Verzweigungen samt Beschriftung), so dass jede Form in mindestens
 * einem Ausschnitt ganz zu sehen ist. Ab dem zweiten Ausschnitt einer Zeile stehen
 * die Namen von Pools und Bahnen am linken Rand noch einmal.
 *
 * Maße in CSS-Pixeln (96 je Zoll), das Diagramm in den Koordinaten von bpmn-js.
 */

export interface Rechteck {
  x: number
  y: number
  breite: number
  hoehe: number
}

/** Was der Druck vom Diagramm wissen muss: Formen für die Schnittkanten, Pools und Bahnen für die Namen am Rand. */
export interface DruckForm extends Rechteck {
  /**
   * form: Aufgabe, Ereignis, Verzweigung … samt Beschriftung, die Beschriftung eines Flusses oder
   * der Name und die Markierung eines Rahmens; rahmen: aufgeklappter Teilprozess (Abschnitt,
   * „für jedes Stück“ …). Ein Rahmen ist oft breiter als ein Ausschnitt; Schnitte dürfen durch
   * ihn laufen wie durch eine Bahn, nur nicht durch seinen Namen oder seine Markierung.
   */
  art: 'form' | 'pool' | 'bahn' | 'rahmen'
  name: string
  /** Pool ohne Inhalt (externer Teilnehmer): kein Kopf am linken Rand, der Name steht in der Mitte */
  eingeklappt?: boolean
}

export interface Ausschnitt extends Rechteck {
  nr: number
  /** Breite des wiederholten Kopfs mit den Namen von Pools und Bahnen links vor dem Ausschnitt (Diagrammpixel); 0 ohne */
  kopf: number
  /**
   * Erste Spalte bei mehreren Zeilen: Der Kopf am Anfang des Diagramms ist zu sehen, seine
   * Namen aber womöglich nicht, weil sie in einer anderen Zeile stehen. Dann wird er an
   * dieser Stelle (x) mit den Namen der sichtbaren Teile neu gezeichnet.
   */
  kopfDarin?: number
  /** Rahmen in der Übersicht: der Teil, der zu diesem Ausschnitt gehört (ohne Überlappung) */
  rahmen: Rechteck
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
  /** Überlappung benachbarter Ausschnitte in Diagrammpixeln, mindestens; mehr, wenn sonst eine Form zerschnitten würde */
  ueberlappung: 40,
  /** Abstand der Schnittkante von einer Form, damit kein Rand und kein Buchstabe abgeschnitten wird */
  luft: 4,
  /** Breite eines Kopfs mit Pool- oder Bahnnamen wie bei bpmn-js */
  kopfbreite: 30,
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

/** Element aus der elementRegistry von bpmn-js, soweit der Druck es braucht */
interface BpmnElement {
  id: string
  type?: string
  x?: number
  y?: number
  width?: number
  height?: number
  waypoints?: unknown
  labelTarget?: { id: string; waypoints?: unknown }
  /** Teilprozess zugeklappt (bpmn-js setzt das beim Import) */
  collapsed?: boolean
  businessObject?: { name?: string; processRef?: unknown; loopCharacteristics?: unknown }
}

/** Größter Abstand, bei dem eine Beschriftung noch zu ihrer Form gehört (Diagrammpixel) */
const NAH = 30

/** Abstand zweier Rechtecke (0, wenn sie sich berühren oder überlappen) */
function abstand(a: Rechteck, b: Rechteck): number {
  const dx = Math.max(0, a.x - (b.x + b.breite), b.x - (a.x + a.breite))
  const dy = Math.max(0, a.y - (b.y + b.hoehe), b.y - (a.y + a.hoehe))
  return Math.hypot(dx, dy)
}

/** Arten aufgeklappter Teilprozesse; bpmn-js schreibt ihren Namen oben in die Mitte. */
const TEILPROZESSE = new Set(['bpmn:SubProcess', 'bpmn:AdHocSubProcess', 'bpmn:Transaction'])

/** Schrift von bpmn-js (12 px Arial), geschätzte Breite eines Zeichens und Höhe einer Zeile; Abstand des Namens zum Rand */
const RAHMEN_SCHRIFT = { zeichen: 6.6, zeile: 14.4, rand: 5 }
/** Halbe Breite und Höhe der Markierung in der Mitte der Unterkante (Mehrfachinstanz, Ad-hoc-Tilde) */
const MARKE = { halb: 18, hoehe: 20 }

/** Name eines aufgeklappten Teilprozesses: oben in der Mitte, bei Bedarf umbrochen (geschätzt wie bei bpmn-js) */
function rahmenName(r: Rechteck, name: string): Rechteck {
  const platz = Math.max(20, r.breite - 2 * RAHMEN_SCHRIFT.rand)
  const text = [...name].length * RAHMEN_SCHRIFT.zeichen
  const zeilen = Math.max(1, Math.ceil(text / platz))
  const breite = Math.min(platz, text) + 2 * RAHMEN_SCHRIFT.rand
  return { x: r.x + (r.breite - breite) / 2, y: r.y, breite, hoehe: zeilen * RAHMEN_SCHRIFT.zeile + 2 * RAHMEN_SCHRIFT.rand }
}

const vereinige = (a: Rechteck, b: Rechteck): Rechteck => {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, breite: Math.max(a.x + a.breite, b.x + b.breite) - x, hoehe: Math.max(a.y + a.hoehe, b.y + b.hoehe) - y }
}

/**
 * Formen, Pools und Bahnen aus den Elementen von bpmn-js. Die Beschriftung einer
 * Form (z. B. unter einem Ereignis) gehört zur Form; Beschriftungen von Flüssen
 * („Ja“, „Nein“) zählen als eigene Formen. Aufgeklappte Teilprozesse sind Rahmen;
 * ihr Name und ihre Markierung zählen als eigene Formen. Randereignisse sind
 * gewöhnliche Formen auf der Unterkante ihres Schritts.
 */
export function druckFormen(elemente: readonly unknown[]): DruckForm[] {
  const formen = new Map<string, DruckForm>()
  const beschriftungen: { ziel: string; r: Rechteck; fluss: boolean; id: string }[] = []
  for (const roh of elemente) {
    const e = roh as BpmnElement
    if (typeof e?.x !== 'number' || typeof e.y !== 'number' || typeof e.width !== 'number' || typeof e.height !== 'number' || e.waypoints) continue
    const r = { x: e.x, y: e.y, breite: e.width, hoehe: e.height }
    const name = (e.businessObject?.name ?? '').trim()
    if (e.type === 'label' && e.labelTarget) beschriftungen.push({ ziel: e.labelTarget.id, r, fluss: !!e.labelTarget.waypoints, id: e.id })
    else if (e.type === 'bpmn:Participant') formen.set(e.id, { ...r, art: 'pool', name, eingeklappt: !e.businessObject?.processRef })
    else if (e.type === 'bpmn:Lane') formen.set(e.id, { ...r, art: 'bahn', name })
    else if (e.type && TEILPROZESSE.has(e.type) && e.collapsed !== true) {
      // Rahmen: Schnitte dürfen hindurch, nicht aber durch Namen und Markierung
      formen.set(e.id, { ...r, art: 'rahmen', name })
      if (name) formen.set(`${e.id}#name`, { ...rahmenName(r, name), art: 'form', name })
      if (e.businessObject?.loopCharacteristics || e.type === 'bpmn:AdHocSubProcess')
        formen.set(`${e.id}#marke`, { x: r.x + r.breite / 2 - MARKE.halb, y: r.y + r.hoehe - MARKE.hoehe, breite: 2 * MARKE.halb, hoehe: MARKE.hoehe, art: 'form', name: '' })
    } else formen.set(e.id, { ...r, art: 'form', name })
  }
  for (const b of beschriftungen) {
    const ziel = formen.get(b.ziel)
    // Steht die Beschriftung weit weg (der Name eines Randereignisses an seinem Abgang), ist sie eine eigene Form
    if (!b.fluss && ziel?.art === 'form' && abstand(ziel, b.r) <= NAH) formen.set(b.ziel, { ...ziel, ...vereinige(ziel, b.r) })
    else formen.set(b.id, { ...b.r, art: 'form', name: '' })
  }
  return [...formen.values()]
}

/** Strecke [von, bis] entlang einer Achse */
type Strecke = [number, number]

/** Größte Stelle ≤ `bis`, an der keine Strecke durchschnitten wird (a < x < b); null, wenn es oberhalb von `ab` keine gibt. */
function freieStelle(strecken: readonly Strecke[], ab: number, bis: number): number | null {
  let x = bis
  for (;;) {
    const geschnitten = strecken.filter(([a, b]) => a < x && x < b)
    if (geschnitten.length === 0) return x
    x = Math.min(...geschnitten.map(([a]) => a))
    if (x <= ab) return null
  }
}

interface Fenster {
  von: number
  bis: number
  /** Kante zum nächsten Fenster für die Rahmen der Übersicht */
  grenze: number
}

/**
 * Teilt [start, ende] in Fenster, die höchstens `laenge(i)` lang sind und sich um
 * mindestens `ueberlappung` überlappen. Ein Fenster endet möglichst in einer Lücke
 * zwischen den Strecken der Formen; gibt es keine, beginnt das nächste Fenster vor
 * den durchschnittenen Formen, so dass sie dort ganz liegen.
 */
function teile(start: number, ende: number, strecken: readonly Strecke[], laenge: (i: number) => number, ueberlappung: number): Fenster[] {
  const fenster: Fenster[] = []
  let von = start
  for (let i = 0; ; i++) {
    const k = laenge(i)
    if (ende - von <= k + 1e-6 || i > 200) {
      fenster.push({ von, bis: ende, grenze: ende })
      return fenster
    }
    // Lücke in der zweiten Hälfte des Fensters, sonst die volle Länge
    const luecke = freieStelle(strecken, von + k / 2, von + k)
    const bis = luecke ?? von + k
    let naechstes = bis - ueberlappung
    let grenze = bis
    if (luecke === null) {
      // durchschnittene Formen, die ins nächste Fenster passen, liegen dort ganz
      const kNaechstes = laenge(i + 1)
      const geschnitten = strecken.filter(([a, b]) => a < bis && bis < b && a > von + k / 2 && b - a <= kNaechstes - ueberlappung)
      if (geschnitten.length > 0) naechstes = Math.min(naechstes, ...geschnitten.map(([a]) => a))
      grenze = naechstes
    }
    fenster.push({ von, bis, grenze })
    von = naechstes
  }
}

interface Vorlage {
  r: Rechteck
  strX: Strecke[]
  strY: Strecke[]
  /** Breite des wiederholten Kopfs ab der zweiten Spalte; 0 ohne Pools */
  kopf: number
  /** linker Rand der Pools, dort steht der Kopf im Diagramm */
  poolX: number
}

function vorlage(r: Rechteck, formen: readonly DruckForm[], d: typeof DRUCK): Vorlage {
  const eigentliche = formen.filter((f) => f.art === 'form')
  const strX = eigentliche.map((f): Strecke => [f.x - d.luft, f.x + f.breite + d.luft])
  const strY = eigentliche.map((f): Strecke => [f.y - d.luft, f.y + f.hoehe + d.luft])
  const mitBahnen = formen.some((f) => f.art === 'pool' && !f.eingeklappt) && formen.some((f) => f.art === 'bahn')
  const pools = formen.filter((f) => f.art === 'pool')
  const kopf = pools.length > 0 ? d.kopfbreite * (mitBahnen ? 2 : 1) : 0
  return { r, strX, strY, kopf, poolX: pools.length > 0 ? Math.min(...pools.map((p) => p.x)) : r.x }
}

function spaltenUndZeilen(v: Vorlage, d: typeof DRUCK, gedreht: boolean, massstab: number): { spalten: Fenster[]; zeilen: Fenster[] } {
  // Gedreht liegt die Breite des Diagramms entlang der Seitenhöhe
  const fx = (gedreht ? d.hoehe : d.breite) / massstab
  const fy = (gedreht ? d.breite : d.hoehe) / massstab
  // ab der zweiten Spalte steht der Kopf mit den Namen links vor dem Ausschnitt
  const spalten = teile(v.r.x, v.r.x + v.r.breite, v.strX, (i) => fx - (i > 0 ? v.kopf : 0), d.ueberlappung)
  const zeilen = teile(v.r.y, v.r.y + v.r.hoehe, v.strY, () => fy, d.ueberlappung)
  return { spalten, zeilen }
}

function variante(v: Vorlage, d: typeof DRUCK, gedreht: boolean): { plan: AusschnittPlan; seiten: number } {
  // So wenige Ausschnitte wie beim kleinsten lesbaren Maßstab, und dabei so groß wie möglich
  const knapp = spaltenUndZeilen(v, d, gedreht, d.mindestMassstab)
  const passt = (m: number) => {
    const t = spaltenUndZeilen(v, d, gedreht, m)
    return t.spalten.length <= knapp.spalten.length && t.zeilen.length <= knapp.zeilen.length
  }
  let massstab = d.mindestMassstab
  for (let m = d.hoechstMassstab; m > d.mindestMassstab; m = Math.round((m - 0.01) * 100) / 100) {
    if (passt(m)) {
      massstab = m
      break
    }
  }
  // genauer: bis auf 1/1000 an die Grenze heran, an der ein Ausschnitt mehr nötig würde
  let zuGross = Math.min(d.hoechstMassstab, massstab + 0.01)
  if (zuGross > massstab && !passt(zuGross))
    for (let i = 0; i < 10; i++) {
      const mitte = (massstab + zuGross) / 2
      if (passt(mitte)) massstab = mitte
      else zuGross = mitte
    }
  else massstab = zuGross
  const { spalten, zeilen } = spaltenUndZeilen(v, d, gedreht, massstab)
  const ausschnitte: Ausschnitt[] = []
  zeilen.forEach((z, zi) =>
    spalten.forEach((s, si) => {
      const rx = si === 0 ? v.r.x : spalten[si - 1].grenze
      const ry = zi === 0 ? v.r.y : zeilen[zi - 1].grenze
      ausschnitte.push({
        nr: ausschnitte.length + 1,
        x: s.von,
        y: z.von,
        breite: s.bis - s.von,
        hoehe: z.bis - z.von,
        kopf: si > 0 ? v.kopf : 0,
        ...(si === 0 && zeilen.length > 1 && v.kopf > 0 ? { kopfDarin: v.poolX } : {}),
        rahmen: { x: rx, y: ry, breite: s.grenze - rx, hoehe: z.grenze - ry },
      })
    }),
  )
  // niedrige Ausschnitte teilen sich eine Seite
  const hoechster = Math.max(...ausschnitte.map((a) => (gedreht ? a.breite + a.kopf : a.hoehe)))
  const jeSeite = Math.max(1, Math.floor(d.seite / (hoechster * massstab + d.unterschrift)))
  return { plan: { ausschnitte, spalten: spalten.length, zeilen: zeilen.length, massstab, gedreht }, seiten: Math.ceil(ausschnitte.length / jeSeite) }
}

/**
 * Ausschnitte für ein Diagramm, dessen Übersicht auf der Seite unlesbar klein wäre; sonst null.
 * Hoch oder quer, je nachdem, was weniger Seiten braucht; bei Gleichstand hoch (das Blatt bleibt, wie es ist).
 */
export function planeAusschnitte(r: Rechteck, formen: readonly DruckForm[] = [], d = DRUCK): AusschnittPlan | null {
  if (Math.min(d.breite / r.breite, d.hoehe / r.hoehe) >= d.mindestMassstab) return null
  const v = vorlage(r, formen, d)
  const [hoch, quer] = [variante(v, d, false), variante(v, d, true)]
  const besser = quer.seiten < hoch.seiten || (quer.seiten === hoch.seiten && quer.plan.ausschnitte.length < hoch.plan.ausschnitte.length)
  return (besser ? quer : hoch).plan
}

/** Liegt das Rechteck `f` ganz im Ausschnitt `a`? */
export function liegtGanzIn(f: Rechteck, a: Rechteck): boolean {
  return f.x >= a.x - 0.01 && f.y >= a.y - 0.01 && f.x + f.breite <= a.x + a.breite + 0.01 && f.y + f.hoehe <= a.y + a.hoehe + 0.01
}

const zahl = (n: number) => String(Math.round(n * 100) / 100)

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

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

/** Schrift der Namen wie bei bpmn-js; geschätzte mittlere Zeichenbreite von Arial in Geviert */
const SCHRIFT = { groesse: 12, kleinste: 8, zeichen: 0.56 }

/** Name senkrecht (von unten nach oben) in der Mitte eines Kopfstreifens; zu lange Namen werden kleiner, notfalls gekürzt. */
function senkrechterName(name: string, mx: number, y1: number, y2: number): string {
  const platz = y2 - y1 - 6
  if (!name || platz < SCHRIFT.kleinste * 1.5) return ''
  const breite = (t: string, g: number) => [...t].length * g * SCHRIFT.zeichen
  let text = name
  let groesse = SCHRIFT.groesse
  if (breite(text, groesse) > platz) groesse = Math.max(SCHRIFT.kleinste, (groesse * platz) / breite(text, groesse))
  if (breite(text, groesse) > platz) {
    const zeichen = [...text]
    while (zeichen.length > 1 && breite(`${zeichen.join('')}…`, groesse) > platz) zeichen.pop()
    text = `${zeichen.join('').trimEnd()}…`
  }
  const my = (y1 + y2) / 2
  return `<text x="${zahl(mx)}" y="${zahl(my)}" transform="rotate(-90 ${zahl(mx)} ${zahl(my)})" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-size="${zahl(groesse)}" fill="#22242a">${esc(text)}</text>`
}

/**
 * Kopf links vor dem Ausschnitt: die Namen der Pools (außen) und Bahnen (innen),
 * soweit sie im Ausschnitt liegen, angeordnet wie am Anfang des Diagramms. Leicht
 * grau hinterlegt, damit er nicht als Teil des Ablaufs gelesen wird.
 */
function kopfSvg(formen: readonly DruckForm[], x0: number, kopf: number, oben: number, unten: number, d: typeof DRUCK): string {
  const teile: string[] = [`<rect x="${zahl(x0)}" y="${zahl(oben)}" width="${zahl(kopf)}" height="${zahl(unten - oben)}" fill="#ffffff"/>`]
  const band = (f: DruckForm, bx: number, bb: number, nameX: number) => {
    const y1 = Math.max(f.y, oben)
    const y2 = Math.min(f.y + f.hoehe, unten)
    if (y2 - y1 < 1) return
    teile.push(`<rect x="${zahl(bx)}" y="${zahl(y1)}" width="${zahl(bb)}" height="${zahl(y2 - y1)}" fill="#f4f4f1" stroke="#22242a" stroke-width="1.5"/>`)
    teile.push(senkrechterName(f.name, nameX, y1, y2))
  }
  const poolBreite = Math.min(kopf, d.kopfbreite)
  // Pool ohne Inhalt über die ganze Breite des Kopfs, sonst außen der Pool und innen seine Bahnen
  for (const p of formen.filter((f) => f.art === 'pool')) band(p, x0, p.eingeklappt ? kopf : poolBreite, x0 + d.kopfbreite / 2)
  if (kopf > d.kopfbreite) for (const b of formen.filter((f) => f.art === 'bahn')) band(b, x0 + d.kopfbreite, kopf - d.kopfbreite, x0 + d.kopfbreite * 1.5)
  return `<g class="pl-koepfe">${teile.join('')}</g>`
}

/**
 * SVG eines Ausschnitts, mit dem Kopf der Pool- und Bahnnamen links davor (`a.kopf`);
 * gedreht um 90° gegen den Uhrzeigersinn: Zum Lesen das Blatt im Uhrzeigersinn drehen.
 */
export function ausschnittSvg(svg: string, a: Rechteck & { kopf?: number; kopfDarin?: number }, gedreht: boolean, formen: readonly DruckForm[] = [], d = DRUCK): string {
  const kopf = a.kopf ?? 0
  const feld = { x: a.x - kopf, y: a.y, breite: a.breite + kopf, hoehe: a.hoehe }
  let innen = mitBlickfeld(svg, feld)
  const breite = kopf > 0 ? kopf : vorlage(a, formen, d).kopf
  const x0 = kopf > 0 ? a.x - kopf : (a.kopfDarin ?? null)
  if (x0 !== null && breite > 0) {
    const ende = innen.lastIndexOf('</svg>')
    innen = `${innen.slice(0, ende)}${kopfSvg(formen, x0, breite, a.y, a.y + a.hoehe, d)}${innen.slice(ende)}`
  }
  if (!gedreht) return innen
  const b = zahl(feld.breite)
  const h = zahl(feld.hoehe)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${h}" height="${b}" viewBox="0 0 ${h} ${b}"><g transform="translate(0 ${b}) rotate(-90)">${innen}</g></svg>`
}

/** Übersicht mit nummerierten Rahmen der Ausschnitte; die Rahmen lassen die Überlappung weg, damit sich keine Linien doppeln. */
export function uebersichtSvg(svg: string, plan: AusschnittPlan, d = DRUCK): string {
  const r = svgRahmen(svg)
  const ende = svg.lastIndexOf('</svg>')
  if (!r || ende < 0) return svg
  // Druckpunkt → Diagrammpixel bei dem Maßstab, mit dem die Übersicht auf die Seite passt
  const pt = (n: number) => n / 0.75 / Math.min(d.breite / r.breite, d.hoehe / r.hoehe)
  const rahmen = plan.ausschnitte.map(
    ({ rahmen: q, nr }) =>
      `<rect x="${zahl(q.x)}" y="${zahl(q.y)}" width="${zahl(q.breite)}" height="${zahl(q.hoehe)}" fill="none" stroke="#1c5cab" stroke-width="${zahl(pt(1))}" stroke-dasharray="${zahl(pt(4))} ${zahl(pt(2))}"/>` +
      `<text x="${zahl(q.x + pt(3))}" y="${zahl(q.y + pt(13))}" font-family="Arial, sans-serif" font-size="${zahl(pt(10))}" font-weight="700" fill="#1c5cab" stroke="#fff" stroke-width="${zahl(pt(2.5))}" paint-order="stroke">${nr}</text>`,
  )
  return `${svg.slice(0, ende)}<g class="pl-ausschnitte">${rahmen.join('')}</g>${svg.slice(ende)}`
}
