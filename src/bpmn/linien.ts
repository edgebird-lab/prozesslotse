/**
 * Linienführung für Sequenz- und Nachrichtenflüsse.
 *
 * Grundregel: Zwei Flüsse teilen sich nie eine Strecke und nie einen
 * Anschlusspunkt. Jeder Fluss ist eine eigene Linie von seinem Start bis zu
 * seinem Ziel; sonst sähe er aus wie ein Fluss mit zwei Enden.
 *
 * - Anschlüsse an Gateways: Die gerade Linie nimmt die seitliche Ecke. Die
 *   übrigen Zweige laufen senkrecht aus der oberen oder unteren Kante, der
 *   weiteste an der Ecke und die übrigen daneben, so dass sich ihre Winkel
 *   ineinander schachteln. Steht in der Spalte der Raute ein fremder Knoten im
 *   Weg, verlässt der Zweig die Raute waagerecht in eigener Höhe und wechselt
 *   in der Spaltenlücke die Höhe. Zusammenführungen spiegeln das; Rückflüsse
 *   kommen von unten.
 * - Spaltenlücken sind Kanäle: Jedes senkrechte Stück bekommt dort eine
 *   eigene Spur. Die Reihenfolge der Spuren wird so gewählt, dass sich
 *   möglichst wenige Linien kreuzen. Reicht die Lücke nicht, wird sie breiter.
 * - Rahmen: Der Fluss in einen Rahmen endet auf dessen linker Kante, der Fluss
 *   heraus beginnt auf der rechten, jeweils auf der Hauptlinie. Die Seitenkanten
 *   liegen in den Lücken neben der ersten und letzten inneren Spalte; dort
 *   bleiben alle Kanalspuren außerhalb des Rahmens.
 * - Lange parallele Strecken: Laufen zwei Flüsse lange nebeneinander, liegen
 *   sie weit genug auseinander, dass man sie auch verkleinert und im Druck als
 *   zwei Linien erkennt (`PARALLEL`).
 */
import type { LayoutKante, LayoutKnoten, Punkt, Spur } from './layout'

/** Abstand der Spuren in einer Lücke, Rand zu Knoten, Länge des Nachrichtenstummels, Abstand der Anschlüsse an einer Raute */
export const LINIE = { abstand: 10, rand: 6, stummel: 8, anschluss: 10 }

/**
 * Zwei Flüsse, die auf mehr als `laenge` Pixeln parallel laufen, liegen mindestens
 * `mindestens` Pixel auseinander; in den Lücken bekommen solche Spuren `kanal`.
 *
 * Begründung: „Einpassen“ verkleinert ein großes Diagramm (Beispiel Lieferdienst,
 * 4700 px breit) auf einem Notebook auf etwa 0,18. Dort werden 10 px Abstand zu
 * 1,8 Gerätepixeln, und zwei Linien verschmelzen zu einer (gemessen in der
 * Compliance-Abnahme, ebenso im Druck auf A4 mit 0,04 mm je px). 20 px werden zu
 * 3,6 Gerätepixeln mit mindestens zwei hellen Spalten dazwischen; 20 px ist auch
 * der größte Abstand, mit dem drei Senkrechte auf die untere Kante einer 50-px-Raute
 * passen. Kürzere Strecken als 100 px (verkleinert etwa 18 Gerätepixel) liest das
 * Auge als zwei Linien, weil beide Knicke nahe beieinander zu sehen sind; so bleiben
 * Fächer in benachbarte Bänder (110 px) und Stummel unter einem Schritt erlaubt.
 */
export const PARALLEL = { laenge: 100, mindestens: 20, kanal: 24 }

/**
 * Seitenkanten der Rahmen: `innen` Abstand vom belegten Bereich der ersten bzw.
 * letzten inneren Spalte, `aussen` zusätzlicher Abstand zu den Kanalspuren
 * (zu `LINIE.rand` dazu), `ebene` Versatz je Rahmen darin, der in derselben
 * Spalte beginnt bzw. endet (Ad-hoc-Rahmen mit eingebettetem Zweig).
 */
export const RAHMEN_RAND = { innen: 12, aussen: 2, ebene: 8 }

interface Arm {
  y: number
  /** −1: Die Linie läuft an diesem Ende nach links weiter, +1: nach rechts. */
  richtung: -1 | 1
}

interface Kanalstueck {
  /** Lücke hinter dieser Spalte (−1: vor der ersten Spalte) */
  luecke: number
  y1: number
  y2: number
  arme: Arm[]
  spur: number
  /** Abstand der Spur von der ersten Spur der Lücke */
  versatz: number
  /** Abstand der ersten von der letzten Spur der Lücke */
  breite: number
  /** Das Stück endet waagerecht an einem Stummel der Raute links (−1) bzw. rechts (+1) der Lücke */
  rauteLinks?: boolean
  rauteRechts?: boolean
}

type XWert = { spalte: number; dx: number } | { kanal: Kanalstueck }

interface Wegpunkt {
  x: XWert
  y: number
}

type AnschlussArt = 'ecke' | 'senkrecht' | 'stummel'

interface Anschluss {
  knoten: LayoutKnoten
  art: AnschlussArt
  /** +1: rechte Hälfte der Raute, −1: linke */
  hx: 1 | -1
  /** +1: untere Hälfte, −1: obere */
  hy: 1 | -1
  /** Senkrechter Abstand der Ebene, zu der der Fluss läuft (zum Sortieren) */
  abstand: number
  /** Waagerechter Abstand des Anschlusses von der Mitte der Raute (mit Vorzeichen) */
  dx: number
}

export interface NachrichtAuftrag {
  id: string
  knoten: LayoutKnoten
  /** y des Poolrands, an dem die Nachricht endet oder beginnt */
  poolRand: number
  oben: boolean
  richtung: 'an' | 'von'
  /** Versatz vom Mittelpunkt, wenn der Knoten Nachrichten in beide Richtungen hat */
  dx: number
  /** Über die Oberkante, auch zu einem Pool unten (Aufgaben mit Randereignissen auf der Unterkante) */
  ueberOben?: boolean
  /**
   * Nachricht zu einem Randereignis: Anschluss am Kreis (Spalte, Abstand von der
   * Spaltenmitte, Höhe), senkrecht hinunter bis `ebene`, waagerecht in die Lücke
   * `luecke` vor dem Schritt und dort zum Pool.
   */
  rand?: { spalte: number; dx: number; y: number; ebene: number; luecke: number }
}

/**
 * Fluss, der an einem Randereignis beginnt: Er läuft vom unteren Rand des Kreises
 * senkrecht bis zur Höhe des Ersatzknotens und von dort weiter wie aus einer
 * rechten Ecke. Der Ersatzknoten steht in der letzten Spalte des Schritts.
 */
export interface RandAbgang {
  knoten: LayoutKnoten
  /** waagerechter Abstand des Kreismittelpunkts von der Spaltenmitte */
  dx: number
  /** Unterkante des Kreises: Hier beginnt der Fluss */
  vonY: number
}

export interface LinienAuftrag {
  /** Knoten mit fertiger Höhe und Größe; x wird erst hier festgelegt. */
  knoten: LayoutKnoten[]
  kanten: LayoutKante[]
  nachrichten: NachrichtAuftrag[]
  spurMitte: (s: Spur) => number
  /** Belegte halbe Breite je Spalte (Knoten samt Beschriftung) */
  belegt: Map<number, number>
  maxSpalte: number
  /** Gleichmäßige Spaltenmitte ohne Verbreiterung */
  spalteMitte: (spalte: number) => number
  /** Erste freie x-Position links (hinter den Bahnköpfen) */
  linkerRand: number
  /** Ist die Spalte zwischen y1 und y2 frei von Knoten und ihren Beschriftungen (außer den genannten)? */
  spalteFrei: (spalte: number, y1: number, y2: number, ausser: string[]) => boolean
  /** Abstand von der Mitte der letzten Spalte bis zum rechten Poolrand */
  rechterRand: number
  /** Rahmen als Ziel eines Flusses: Ersatzknoten in der ersten inneren Spalte, Breite bis zur linken Kante */
  rahmenEin?: Map<string, LayoutKnoten>
  /** Rahmen als Quelle eines Flusses: Ersatzknoten in der letzten inneren Spalte, Breite bis zur rechten Kante */
  rahmenAus?: Map<string, LayoutKnoten>
  /** Randereignisse als Quelle eines Flusses (Abgang) */
  randAus?: Map<string, RandAbgang>
}

export interface Linien {
  /** Spaltenmitte nach dem Verbreitern voller Lücken */
  spalteMitte: (spalte: number) => number
  /** Zusätzliche Breite hinter der letzten Spalte */
  zusatzRechts: number
  kanten: Map<string, Punkt[]>
  nachrichten: Map<string, Punkt[]>
}

function istGatewayArt(art: LayoutKnoten['art']): boolean {
  return art === 'xor' || art === 'und' || art === 'oder' || art === 'ereignisgateway'
}

const istSplit = (k: LayoutKnoten) => istGatewayArt(k.art) && k.richtung === 'auf'
const istJoin = (k: LayoutKnoten) => istGatewayArt(k.art) && k.richtung === 'zu'
const mitteY = (k: LayoutKnoten) => k.y + k.hoehe / 2
const gleich = (a: number, b: number) => Math.abs(a - b) < 0.5

function randpunkt(a: Anschluss): { dx: number; y: number } {
  const w = a.knoten.breite / 2
  return { dx: a.dx, y: mitteY(a.knoten) + a.hy * (w - Math.abs(a.dx)) }
}

/**
 * Verteilt die Anschlüsse einer Rautenhälfte. Reihenfolge von der Gegenseite
 * zur Flussseite: Rückläufige (der flachste außen), Senkrechte (der weiteste
 * zuerst, er sitzt möglichst an der Ecke), Stummel (der tiefste zuerst). So
 * schachteln sich die Winkel, ohne sich zu kreuzen. `abstand` ist die Tiefe der
 * Ebene, zu der ein senkrechter Anschluss läuft. Benachbarte Senkrechte liegen
 * möglichst `PARALLEL.mindestens` auseinander, und sie müssen es, wenn sie
 * länger als `PARALLEL.laenge` nebeneinander laufen; benachbarte Stummel liegen
 * möglichst ebenso weit auseinander, die übrigen Abstände sind höchstens
 * `LINIE.anschluss`. Stummel bleiben 8 px unter der seitlichen Ecke, außer sie
 * ist frei (`eckeFrei`: kein Fluss nimmt die Ecke, die andere Hälfte hat keine
 * Stummel). `dicht`: alle Abstände höchstens `LINIE.anschluss` (Notlösung für
 * sehr große Fächer). Rückgabe: Versatz v je Anschluss, positiv in
 * Flussrichtung, oder null, wenn die Anschlüsse nicht auf die Kante passen.
 */
function verteileHaelfte(gegen: number, senkrecht: number, stummel: number, abstand: number[], w: number, eckeFrei: boolean, dicht = false): number[] | null {
  const n = gegen + senkrecht + stummel
  if (n === 0) return []
  // die weiteste Senkrechte an der Ecke; gibt es beide Richtungen, teilen sie sich die Ecke mit halbem Abstand
  const anker = gegen > 0 && senkrecht > 0 ? gegen - 0.5 : gegen > 0 && senkrecht === 0 ? gegen - 1 : gegen
  const grenzen = (i: number): [number, number] => (i >= gegen + senkrecht ? [3, eckeFrei ? w : w - 8] : [-(w - 4), w - 4])
  // Zwei Senkrechte nebeneinander laufen von der Kante (mindestens 4 px unter bzw. über der Mitte) bis zur flacheren Ebene parallel
  const senkrechtPaar = (i: number) => i < gegen + senkrecht
  const stummelPaar = (i: number) => i - 1 >= gegen + senkrecht
  const lang = (i: number) => senkrechtPaar(i) && Math.min(abstand[i - 1], abstand[i]) - 4 > PARALLEL.laenge
  // Stufen: alles weit; Senkrechte weit; nur lange Senkrechte weit; (dicht) nichts weit
  for (const stufe of dicht ? [3] : [0, 1, 2]) {
    for (let d = LINIE.anschluss; d >= 4; d -= 0.5) {
      const weit = (i: number) => stufe < 3 && ((senkrechtPaar(i) && (stufe < 2 || lang(i))) || (stummelPaar(i) && stufe === 0))
      const lage = [0]
      for (let i = 1; i < n; i++) lage.push(lage[i - 1] + (weit(i) ? PARALLEL.mindestens : d))
      const ankerLage = Number.isInteger(anker) ? lage[anker] : (lage[Math.floor(anker)] + lage[Math.ceil(anker)]) / 2
      const basis = lage.map((v) => v - ankerLage)
      let unten = -Infinity
      let oben = Infinity
      basis.forEach((v, i) => {
        const [lo, hi] = grenzen(i)
        unten = Math.max(unten, lo - v)
        oben = Math.min(oben, hi - v)
      })
      if (unten <= oben + 1e-9) {
        const schub = Math.min(Math.max(0, unten), oben)
        return basis.map((v) => v + schub)
      }
    }
  }
  return null
}

/** Sehr viele Anschlüsse: gleichmäßig über die ganze Kante */
function gleichmaessig(n: number, w: number): number[] {
  return Array.from({ length: n }, (_, i) => -(w - 3) + (i * 2 * (w - 3)) / Math.max(1, n - 1))
}

/**
 * Legt für jede Kante fest, wo sie an Quelle und Ziel anschließt, und verteilt
 * die Anschlüsse an Gateways auf getrennte Punkte.
 */
function bestimmeAnschluesse(kanten: LayoutKante[], quelle: (id: string) => LayoutKnoten, ziel: (id: string) => LayoutKnoten, spurMitte: (s: Spur) => number, spalteFrei: LinienAuftrag['spalteFrei']) {
  // Senkrecht aus der Raute nur, wenn die Spalte bis zur Ebene frei ist
  const frei = (k: LayoutKnoten, ebene: number) => spalteFrei(k.spalte, Math.min(ebene, mitteY(k)), Math.max(ebene, mitteY(k)), [k.id])
  const aus = new Map<string, Anschluss>()
  const ein = new Map<string, Anschluss>()
  const zaehleAus = new Map<string, number>()
  const zaehleEin = new Map<string, number>()
  for (const e of kanten) {
    if (e.rueck || e.sprung) continue
    zaehleAus.set(e.von, (zaehleAus.get(e.von) ?? 0) + 1)
    zaehleEin.set(e.nach, (zaehleEin.get(e.nach) ?? 0) + 1)
  }
  const ecke = (k: LayoutKnoten, hx: 1 | -1): Anschluss => ({ knoten: k, art: 'ecke', hx, hy: 1, abstand: 0, dx: 0 })
  const neu = (k: LayoutKnoten, art: AnschlussArt, hx: 1 | -1, ebene: number): Anschluss => ({
    knoten: k,
    art,
    hx,
    hy: ebene >= mitteY(k) ? 1 : -1,
    abstand: Math.abs(ebene - mitteY(k)),
    dx: 0,
  })

  // Wünsche nach einer Senkrechten aus der Raute. „sicher“: Sie bleibt in den Spuren des eigenen Blocks
  // (Zweige in derselben Bahn darunter, Rückflüsse zur Extraspur) und kann keiner fremden Linie begegnen.
  interface Wunsch {
    kante: string
    seite: 'aus' | 'ein'
    k: LayoutKnoten
    hx: 1 | -1
    ebene: number
    sicher: boolean
  }
  const wuensche: Wunsch[] = []
  for (const e of kanten) {
    const a = quelle(e.von)
    const z = ziel(e.nach)
    if (e.rueck) {
      const y = spurMitte(e.rueck)
      wuensche.push({ kante: e.id, seite: 'aus', k: a, hx: -1, ebene: y, sicher: true }, { kante: e.id, seite: 'ein', k: z, hx: 1, ebene: y, sicher: true })
      continue
    }
    if (e.sprung) {
      const y = spurMitte(e.sprung)
      // aus einer Raute (leerer Zweig): senkrecht hinunter und nach links, sonst waagerecht in die Lücke
      if (istSplit(a)) wuensche.push({ kante: e.id, seite: 'aus', k: a, hx: -1, ebene: y, sicher: false })
      else aus.set(e.id, ecke(a, 1))
      wuensche.push({ kante: e.id, seite: 'ein', k: z, hx: 1, ebene: y, sicher: true })
      continue
    }
    // Quelle: Verzweigung mit mehreren Ausgängen
    if (istSplit(a) && (zaehleAus.get(a.id) ?? 0) > 1) {
      const ebene = e.ueber ? spurMitte(e.ueber) : mitteY(z)
      const bahn = e.ueber ? e.ueber.bahn : z.bahn
      if (gleich(ebene, mitteY(a))) aus.set(e.id, ecke(a, 1))
      else wuensche.push({ kante: e.id, seite: 'aus', k: a, hx: 1, ebene, sicher: bahn === a.bahn && ebene > mitteY(a) })
    } else aus.set(e.id, ecke(a, 1))
    // Ziel: Zusammenführung mit mehreren Eingängen
    if (istJoin(z) && (zaehleEin.get(z.id) ?? 0) > 1) {
      const ebene = e.ueber ? spurMitte(e.ueber) : mitteY(a)
      const bahn = e.ueber ? e.ueber.bahn : a.bahn
      if (gleich(ebene, mitteY(z))) ein.set(e.id, ecke(z, -1))
      else wuensche.push({ kante: e.id, seite: 'ein', k: z, hx: -1, ebene, sicher: bahn === z.bahn && ebene > mitteY(z) })
    } else ein.set(e.id, ecke(z, -1))
  }
  // Belegte Senkrechte je Spalte: erst die sicheren, dann die übrigen, soweit Spalte und Strecke frei sind.
  // Sonst verlässt der Fluss die Raute waagerecht und wechselt die Höhe in der Lücke.
  const belegt = new Map<number, { id: string; y1: number; y2: number }[]>()
  for (const sicher of [true, false]) {
    for (const w of wuensche) {
      if (w.sicher !== sicher) continue
      const y1 = Math.min(w.ebene, mitteY(w.k))
      const y2 = Math.max(w.ebene, mitteY(w.k))
      const liste = belegt.get(w.k.spalte) ?? []
      const ziel = w.seite === 'aus' ? aus : ein
      if (sicher || (frei(w.k, w.ebene) && liste.every((b) => b.id === w.k.id || b.y2 + 10 <= y1 || b.y1 - 10 >= y2))) {
        ziel.set(w.kante, neu(w.k, 'senkrecht', w.hx, w.ebene))
        liste.push({ id: w.k.id, y1, y2 })
        belegt.set(w.k.spalte, liste)
      } else ziel.set(w.kante, neu(w.k, 'stummel', istSplit(w.k) ? 1 : -1, w.ebene))
    }
  }

  // Je Raute und Hälfte: Senkrechte von der Ecke aus (die weiteste an der Ecke), Stummel von der Seite her (der nächste an der Seite)
  const gruppen = new Map<string, Anschluss[]>()
  for (const a of [...aus.values(), ...ein.values()]) {
    if (a.art === 'ecke') continue
    const schluessel = `${a.knoten.id}|${a.hy}`
    const liste = gruppen.get(schluessel)
    if (liste) liste.push(a)
    else gruppen.set(schluessel, [a])
  }
  // Seitliche Ecke in Flussrichtung: frei, wenn kein Fluss sie nimmt
  const eckeBelegt = new Set<string>()
  for (const a of aus.values()) if (a.art === 'ecke' && istSplit(a.knoten)) eckeBelegt.add(a.knoten.id)
  for (const a of ein.values()) if (a.art === 'ecke' && istJoin(a.knoten)) eckeBelegt.add(a.knoten.id)
  for (const liste of gruppen.values()) {
    const k = liste[0].knoten
    const fluss = istSplit(k) ? 1 : -1
    // Die Ecke gehört beiden Hälften: Ein Stummel darf sie nur nehmen, wenn die andere Hälfte in Flussrichtung nichts hat.
    const andere = gruppen.get(`${k.id}|${-liste[0].hy}`) ?? []
    const eckeFrei = !eckeBelegt.has(k.id) && !andere.some((a) => a.art === 'stummel' || a.hx === fluss)
    const verteile = (dicht: boolean): boolean => {
      const gegen = liste.filter((a) => a.art === 'senkrecht' && a.hx !== fluss).sort((x, y) => x.abstand - y.abstand)
      const senkrecht = liste.filter((a) => a.art === 'senkrecht' && a.hx === fluss).sort((x, y) => y.abstand - x.abstand)
      const stummel = liste.filter((a) => a.art === 'stummel').sort((x, y) => y.abstand - x.abstand)
      const folge = [...gegen, ...senkrecht, ...stummel]
      const v = verteileHaelfte(gegen.length, senkrecht.length, stummel.length, folge.map((a) => a.abstand), k.breite / 2, eckeFrei, dicht) ?? (dicht ? gleichmaessig(folge.length, k.breite / 2) : null)
      if (v) folge.forEach((a, i) => (a.dx = fluss * v[i]))
      return !!v
    }
    // Passen die Senkrechten nicht mit Abstand auf die Kante, wechselt die flachste in Flussrichtung die Höhe in der Lücke.
    const vorher = liste.map((a) => a.art)
    let fertig = verteile(false)
    while (!fertig) {
      const flachste = liste.filter((a) => a.art === 'senkrecht' && a.hx === fluss).sort((x, y) => x.abstand - y.abstand)[0]
      if (!flachste) break
      flachste.art = 'stummel'
      fertig = verteile(false)
    }
    if (!fertig) {
      // Sehr große Fächer (mehr als etwa sechs Wege in eine Richtung) passen nicht mit Abstand auf eine 50-px-Raute:
      // dann dicht wie früher, ohne geteilte Strecke (Grenze, siehe README).
      liste.forEach((a, i) => (a.art = vorher[i]))
      verteile(true)
    }
  }
  return { aus, ein }
}

/**
 * Ordnet die senkrechten Stücke einer Lücke so auf Spuren, dass sich möglichst
 * wenige Linien kreuzen, und gibt den Abstand der ersten von der letzten Spur
 * zurück. Stücke, deren Höhenbereiche sich nicht berühren, dürfen dieselbe Spur
 * nutzen. Benachbarte Spuren liegen `LINIE.abstand` auseinander, außer zwei
 * Stücke darauf laufen länger als `PARALLEL.laenge` nebeneinander: dann
 * `PARALLEL.kanal`.
 */
function ordneKanal(liste: Kanalstueck[]): number {
  const n = liste.length
  if (n === 0) return 0
  // Stücke, die sich nahe kommen, bekommen getrennte Spuren; sonst sähen sie aus wie eine durchgehende Linie.
  const konflikt = (a: Kanalstueck, b: Kanalstueck) => a.y1 < b.y2 + 40 && b.y1 < a.y2 + 40
  const armKosten = (arm: Arm, s: Kanalstueck) => {
    if (arm.y > s.y1 + 0.5 && arm.y < s.y2 - 0.5) return 1
    // Ein Arm genau auf Höhe eines Endes liefe auf dem Arm des anderen Stücks: verboten
    if (Math.abs(arm.y - s.y1) <= 0.5 || Math.abs(arm.y - s.y2) <= 0.5) return 50
    return 0
  }
  // kosten[i][j]: Stück i liegt links von Stück j. Ein Stummel an einer Raute soll kurz bleiben: Kein fremdes Stück liegt zwischen ihm und der Raute.
  const kosten = liste.map((a, i) =>
    liste.map((b, j) => {
      if (i === j || !konflikt(a, b)) return 0
      let k = 0
      for (const arm of a.arme) if (arm.richtung === 1) k += armKosten(arm, b)
      for (const arm of b.arme) if (arm.richtung === -1) k += armKosten(arm, a)
      if (a.rauteRechts && !b.rauteRechts) k += 3
      if (b.rauteLinks && !a.rauteLinks) k += 3
      return k
    }),
  )
  // Zusammenhangskomponenten des Konfliktgraphen getrennt ordnen
  const gesehen = new Array<boolean>(n).fill(false)
  const reihenfolge: number[] = []
  for (let s = 0; s < n; s++) {
    if (gesehen[s]) continue
    const komponente: number[] = []
    const stapel = [s]
    gesehen[s] = true
    while (stapel.length > 0) {
      const i = stapel.pop()!
      komponente.push(i)
      for (let j = 0; j < n; j++) {
        if (!gesehen[j] && konflikt(liste[i], liste[j])) {
          gesehen[j] = true
          stapel.push(j)
        }
      }
    }
    komponente.sort((a, b) => a - b)
    reihenfolge.push(...besteReihenfolge(komponente, kosten))
  }
  // Spuren: jedes Stück rechts von allen früheren, mit denen es in Konflikt steht
  const spuren: number[] = new Array<number>(n).fill(0)
  const platziert: number[] = []
  let anzahl = 0
  for (const i of reihenfolge) {
    let spur = 0
    for (const j of platziert) if (konflikt(liste[i], liste[j])) spur = Math.max(spur, spuren[j] + 1)
    spuren[i] = spur
    platziert.push(i)
    anzahl = Math.max(anzahl, spur + 1)
  }
  // Lage der Spuren: jede so weit rechts von den früheren, wie es die Stücke darauf verlangen
  const parallel = (a: Kanalstueck, b: Kanalstueck) => Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1)
  const lage: number[] = new Array<number>(anzahl).fill(0)
  for (let spur = 1; spur < anzahl; spur++) {
    let x = lage[spur - 1] + LINIE.abstand
    for (let i = 0; i < n; i++) {
      if (spuren[i] !== spur) continue
      for (let j = 0; j < n; j++) {
        if (spuren[j] >= spur || !konflikt(liste[i], liste[j])) continue
        x = Math.max(x, lage[spuren[j]] + (parallel(liste[i], liste[j]) > PARALLEL.laenge ? PARALLEL.kanal : LINIE.abstand))
      }
    }
    lage[spur] = x
  }
  const breite = lage[anzahl - 1]
  liste.forEach((s, i) => {
    s.spur = spuren[i]
    s.versatz = lage[spuren[i]]
    s.breite = breite
  })
  return breite
}

/** Reihenfolge mit den wenigsten Kreuzungen: exakt bis zwölf Stücke, darüber schrittweise verbessert. */
function besteReihenfolge(ids: number[], kosten: number[][]): number[] {
  const m = ids.length
  if (m <= 1) return ids
  if (m <= 12) {
    const N = 1 << m
    const dp = new Float64Array(N).fill(Infinity)
    const wahl = new Int8Array(N)
    dp[0] = 0
    for (let S = 0; S < N; S++) {
      if (dp[S] === Infinity) continue
      for (let v = 0; v < m; v++) {
        if (S & (1 << v)) continue
        let c = dp[S]
        for (let u = 0; u < m; u++) if (S & (1 << u)) c += kosten[ids[u]][ids[v]]
        const T = S | (1 << v)
        if (c < dp[T] - 1e-9) {
          dp[T] = c
          wahl[T] = v
        }
      }
    }
    const folge: number[] = []
    let S = N - 1
    while (S) {
      const v = wahl[S]
      folge.push(ids[v])
      S &= ~(1 << v)
    }
    return folge.reverse()
  }
  const folge = [...ids]
  for (let besser = true; besser; ) {
    besser = false
    for (let i = 0; i + 1 < folge.length; i++) {
      const a = folge[i]
      const b = folge[i + 1]
      if (kosten[b][a] < kosten[a][b]) {
        folge[i] = b
        folge[i + 1] = a
        besser = true
      }
    }
  }
  return folge
}

/** Entfernt doppelte Punkte und Zwischenpunkte auf einer Geraden. */
function bereinige(punkte: Punkt[]): Punkt[] {
  const ohneDoppelte = punkte.filter((p, i) => i === 0 || !(gleich(p.x, punkte[i - 1].x) && gleich(p.y, punkte[i - 1].y)))
  return ohneDoppelte.filter((p, i, a) => {
    if (i === 0 || i === a.length - 1) return true
    const v = a[i - 1]
    const w = a[i + 1]
    return !((gleich(v.x, p.x) && gleich(p.x, w.x)) || (gleich(v.y, p.y) && gleich(p.y, w.y)))
  })
}

export function fuehreLinien(auftrag: LinienAuftrag): Linien {
  const { kanten, spurMitte } = auftrag
  const nach = new Map(auftrag.knoten.map((k) => [k.id, k]))
  const rahmenEin = auftrag.rahmenEin ?? new Map<string, LayoutKnoten>()
  const rahmenAus = auftrag.rahmenAus ?? new Map<string, LayoutKnoten>()
  const randAus = auftrag.randAus ?? new Map<string, RandAbgang>()
  const quelle = (id: string) => rahmenAus.get(id) ?? randAus.get(id)?.knoten ?? nach.get(id)!
  const ziel = (id: string) => rahmenEin.get(id) ?? nach.get(id)!
  const { aus, ein } = bestimmeAnschluesse(kanten, quelle, ziel, spurMitte, auftrag.spalteFrei)
  // Neben Rahmenkanten bleibt in der Lücke Platz: Kanalspuren liegen außerhalb des äußersten Rahmens.
  // Der Ersatzknoten reicht bis zur Kante; je Spalte zählt der Rahmen, dessen Kante am weitesten außen liegt.
  const kanteAbstand = (liste: Iterable<LayoutKnoten>): Map<number, number> => {
    const m = new Map<number, number>()
    for (const k of liste) m.set(k.spalte, Math.max(m.get(k.spalte) ?? 0, k.breite / 2 - (auftrag.belegt.get(k.spalte) ?? 0) + RAHMEN_RAND.aussen))
    return m
  }
  const kanteLinks = kanteAbstand(rahmenEin.values())
  const kanteRechts = kanteAbstand(rahmenAus.values())

  const kanaele = new Map<number, Kanalstueck[]>()
  const kanal = (luecke: number, ya: number, yb: number, arme: Arm[]): Kanalstueck => {
    const s: Kanalstueck = { luecke, y1: Math.min(ya, yb), y2: Math.max(ya, yb), arme, spur: 0, versatz: 0, breite: 0 }
    const liste = kanaele.get(luecke)
    if (liste) liste.push(s)
    else kanaele.set(luecke, [s])
    return s
  }
  const P = (k: LayoutKnoten, dx: number, y: number): Wegpunkt => ({ x: { spalte: k.spalte, dx }, y })
  const K = (s: Kanalstueck, y: number): Wegpunkt => ({ x: { kanal: s }, y })

  const wege = new Map<string, Wegpunkt[]>()
  for (const e of kanten) {
    const a = quelle(e.von)
    const z = ziel(e.nach)
    const sa = aus.get(e.id)!
    const sz = ein.get(e.id)!
    // Abgang von einem Randereignis: vom Kreis senkrecht hinunter (in der Spalte des Schritts, die in seinen Bändern frei ist), dann wie aus einer rechten Ecke
    const rand = randAus.get(e.von)
    const vorweg: Wegpunkt[] = rand ? [P(a, rand.dx, rand.vonY)] : []
    const eckeDx = rand ? rand.dx : a.breite / 2
    if (e.rueck) {
      // aus der unteren Kante der Frage hinunter zur Extraspur, zurück und von unten in den Eingang
      const y = spurMitte(e.rueck)
      const ra = randpunkt(sa)
      const rz = randpunkt(sz)
      wege.set(e.id, [P(a, ra.dx, ra.y), P(a, ra.dx, y), P(z, rz.dx, y), P(z, rz.dx, rz.y)])
      continue
    }
    if (e.sprung) {
      // nach rechts in die Lücke hinter der Quelle, hinunter zur eigenen Extraspur, zurück und von unten in den Anfang
      const y = spurMitte(e.sprung)
      const start = sa.art === 'ecke' ? { dx: eckeDx, y: mitteY(a) } : randpunkt(sa)
      const s = kanal(a.spalte, start.y, y, [
        { y: start.y, richtung: -1 },
        { y, richtung: -1 },
      ])
      const rz = randpunkt(sz)
      wege.set(e.id, [...vorweg, P(a, start.dx, start.y), K(s, start.y), K(s, y), P(z, rz.dx, y), P(z, rz.dx, rz.y)])
      continue
    }
    const weg: Wegpunkt[] = [...vorweg]
    let y: number
    if (sa.art === 'ecke') {
      y = mitteY(a)
      weg.push(P(a, eckeDx, y))
    } else {
      const r = randpunkt(sa)
      weg.push(P(a, r.dx, r.y))
      y = r.y
      if (sa.art === 'senkrecht') {
        y = e.ueber ? spurMitte(e.ueber) : mitteY(z)
        weg.push(P(a, r.dx, y))
      }
    }
    // Leerer Zweig auf eigener Spur: Höhenwechsel in der Lücke hinter der Quelle. Ebenso, wenn der erste
    // Baustein eines Zweigs (auch eines Ausnahmewegs) hinter einen Rahmen gerückt ist: Die Linie läuft dann im eigenen Band zu ihm.
    const weiterRechts = (istSplit(a) || !!rand) && sa.art !== 'senkrecht' && sz.art !== 'senkrecht' && z.spalte > a.spalte + 1
    const ebene = e.ueber ? spurMitte(e.ueber) : weiterRechts ? (sz.art === 'ecke' ? mitteY(z) : randpunkt(sz).y) : y
    // Ein Stummel an einer Raute beginnt bzw. endet waagerecht, nur wenige Pixel neben dem nächsten: Er bleibt kurz.
    const stummelAus = sa.art === 'stummel'
    if (!gleich(ebene, y)) {
      const s = kanal(a.spalte, y, ebene, [
        { y, richtung: -1 },
        { y: ebene, richtung: 1 },
      ])
      if (stummelAus) s.rauteLinks = true
      weg.push(K(s, y), K(s, ebene))
      y = ebene
    }
    if (sz.art === 'senkrecht') {
      const r = randpunkt(sz)
      weg.push(P(z, r.dx, y), P(z, r.dx, r.y))
    } else {
      const r = sz.art === 'ecke' ? { dx: -z.breite / 2, y: mitteY(z) } : randpunkt(sz)
      if (!gleich(r.y, y)) {
        // Höhenwechsel in der Lücke vor dem Ziel
        const s = kanal(z.spalte - 1, y, r.y, [
          { y, richtung: -1 },
          { y: r.y, richtung: 1 },
        ])
        if (sz.art === 'stummel') s.rauteRechts = true
        if (stummelAus && z.spalte - 1 === a.spalte) s.rauteLinks = true
        weg.push(K(s, y), K(s, r.y))
      }
      weg.push(P(z, r.dx, r.y))
    }
    wege.set(e.id, weg)
  }

  // Nachrichtenflüsse: kurzes Stück zum Pool hin, waagerecht in die Lücke (ausgehend rechts, eingehend links), dort senkrecht zum Pool
  const nachrichtWege = new Map<string, Wegpunkt[]>()
  for (const n of auftrag.nachrichten) {
    const k = n.knoten
    if (n.rand) {
      // zu einem Randereignis: vom Kreis hinunter zur eigenen Stufe, waagerecht in die Lücke vor dem Schritt, dort zum Pool
      const r = n.rand
      const s = kanal(r.luecke, r.ebene, n.poolRand, [{ y: r.ebene, richtung: 1 }])
      const am = (y: number): Wegpunkt => ({ x: { spalte: r.spalte, dx: r.dx }, y })
      const weg = [am(r.y), am(r.ebene), K(s, r.ebene), K(s, n.poolRand)]
      nachrichtWege.set(n.id, n.richtung === 'an' ? weg : weg.reverse())
      continue
    }
    const oben = n.oben || !!n.ueberOben
    const rand = oben ? k.y : k.y + k.hoehe
    const stummelY = oben ? rand - LINIE.stummel : rand + LINIE.stummel
    const luecke = n.richtung === 'an' ? k.spalte : k.spalte - 1
    const s = kanal(luecke, stummelY, n.poolRand, [{ y: stummelY, richtung: n.richtung === 'an' ? -1 : 1 }])
    const weg = [P(k, n.dx, rand), P(k, n.dx, stummelY), K(s, stummelY), K(s, n.poolRand)]
    nachrichtWege.set(n.id, n.richtung === 'an' ? weg : weg.reverse())
  }

  // Spuren je Lücke, volle Lücken verbreitern
  const breiten = new Map<number, number>()
  for (const [luecke, liste] of kanaele) breiten.set(luecke, ordneKanal(liste))
  // Senkrechte an Rauten reichen bis 21 px neben die Spaltenmitte; Kanalspuren bleiben mindestens PARALLEL.mindestens davon weg.
  const faecherRechts = new Map<number, number>()
  const faecherLinks = new Map<number, number>()
  for (const a of [...aus.values(), ...ein.values()]) {
    if (a.art !== 'senkrecht') continue
    const s = a.knoten.spalte
    faecherRechts.set(s, Math.max(faecherRechts.get(s) ?? -Infinity, a.dx + PARALLEL.mindestens - LINIE.rand))
    faecherLinks.set(s, Math.max(faecherLinks.get(s) ?? -Infinity, -a.dx + PARALLEL.mindestens - LINIE.rand))
  }
  const belegtRechts = (g: number) => Math.max(auftrag.belegt.get(g) ?? 0, faecherRechts.get(g) ?? 0)
  const belegtLinks = (g: number) => Math.max(auftrag.belegt.get(g) ?? 0, faecherLinks.get(g) ?? 0)
  const freiraum = (g: number, mitte: (c: number) => number): [number, number] => {
    const links = g < 0 ? auftrag.linkerRand : mitte(g) + belegtRechts(g) + (kanteRechts.get(g) ?? 0)
    const rechts = g >= auftrag.maxSpalte ? mitte(auftrag.maxSpalte) + auftrag.rechterRand : mitte(g + 1) - belegtLinks(g + 1) - (kanteLinks.get(g + 1) ?? 0)
    return [links + LINIE.rand, rechts - LINIE.rand]
  }
  // Stummel an einer Raute bleiben kurz: Liegen sie nur auf einer Seite der Lücke, rücken die Spuren an diese Seite.
  const seite = new Map<number, -1 | 0 | 1>()
  for (const [g, liste] of kanaele) {
    const links = liste.some((s) => s.rauteLinks)
    const rechts = liste.some((s) => s.rauteRechts)
    seite.set(g, links && !rechts ? -1 : rechts && !links ? 1 : 0)
  }
  const extra = new Map<number, number>()
  for (const [g, noetig] of breiten) {
    if (noetig <= 0) continue
    const [l, r] = freiraum(g, auftrag.spalteMitte)
    if (r - l < noetig) extra.set(g, noetig - (r - l))
  }
  const spalteMitte = (c: number): number => {
    let s = 0
    for (const [g, x] of extra) if (g < c) s += x
    return auftrag.spalteMitte(c) + s
  }
  const spurX = (s: Kanalstueck): number => {
    const [l, r] = freiraum(s.luecke, spalteMitte)
    const lage = seite.get(s.luecke) ?? 0
    return (lage < 0 ? l : lage > 0 ? r - s.breite : (l + r) / 2 - s.breite / 2) + s.versatz
  }
  const loese = (weg: Wegpunkt[]): Punkt[] => bereinige(weg.map((p) => ({ x: 'kanal' in p.x ? spurX(p.x.kanal) : spalteMitte(p.x.spalte) + p.x.dx, y: p.y })))

  return {
    spalteMitte,
    zusatzRechts: extra.get(auftrag.maxSpalte) ?? 0,
    kanten: new Map([...wege].map(([id, w]) => [id, loese(w)])),
    nachrichten: new Map([...nachrichtWege].map(([id, w]) => [id, loese(w)])),
  }
}
