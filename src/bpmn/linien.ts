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
 */
import type { LayoutKante, LayoutKnoten, Punkt, Spur } from './layout'

/** Abstand der Spuren in einer Lücke, Rand zu Knoten, Länge des Nachrichtenstummels, Abstand der Anschlüsse an einer Raute */
export const LINIE = { abstand: 10, rand: 6, stummel: 8, anschluss: 10 }

/**
 * Seitenkanten der Rahmen: `innen` Abstand vom belegten Bereich der ersten bzw.
 * letzten inneren Spalte, `aussen` zusätzlicher Abstand zu den Kanalspuren
 * (zu `LINIE.rand` dazu).
 */
export const RAHMEN_RAND = { innen: 12, aussen: 2 }

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
  anzahl: number
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
 * schachteln sich die Winkel, ohne sich zu kreuzen. Rückgabe: Versatz v je
 * Anschluss, positiv in Flussrichtung.
 */
function verteileHaelfte(gegen: number, senkrecht: number, stummel: number, w: number): number[] {
  const n = gegen + senkrecht + stummel
  if (n === 0) return []
  // die weiteste Senkrechte an der Ecke; gibt es beide Richtungen, teilen sie sich die Ecke mit halbem Abstand
  const anker = gegen > 0 && senkrecht > 0 ? gegen - 0.5 : gegen > 0 && senkrecht === 0 ? gegen - 1 : gegen
  const grenzen = (i: number): [number, number] => (i >= gegen + senkrecht ? [3, w - 8] : [-(w - 4), w - 4])
  for (let d = LINIE.anschluss; d >= 4; d -= 0.5) {
    const basis = Array.from({ length: n }, (_, i) => (i - anker) * d)
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
  // sehr viele Anschlüsse: gleichmäßig über die ganze Kante
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
  for (const liste of gruppen.values()) {
    const k = liste[0].knoten
    const fluss = istSplit(k) ? 1 : -1
    const gegen = liste.filter((a) => a.art === 'senkrecht' && a.hx !== fluss).sort((x, y) => x.abstand - y.abstand)
    const senkrecht = liste.filter((a) => a.art === 'senkrecht' && a.hx === fluss).sort((x, y) => y.abstand - x.abstand)
    const stummel = liste.filter((a) => a.art === 'stummel').sort((x, y) => y.abstand - x.abstand)
    const v = verteileHaelfte(gegen.length, senkrecht.length, stummel.length, k.breite / 2)
    ;[...gegen, ...senkrecht, ...stummel].forEach((a, i) => (a.dx = fluss * v[i]))
  }
  return { aus, ein }
}

/**
 * Ordnet die senkrechten Stücke einer Lücke so auf Spuren, dass sich möglichst
 * wenige Linien kreuzen, und gibt die Zahl der Spuren zurück. Stücke, deren
 * Höhenbereiche sich nicht berühren, dürfen dieselbe Spur nutzen.
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
  // kosten[i][j]: Stück i liegt links von Stück j
  const kosten = liste.map((a, i) =>
    liste.map((b, j) => {
      if (i === j || !konflikt(a, b)) return 0
      let k = 0
      for (const arm of a.arme) if (arm.richtung === 1) k += armKosten(arm, b)
      for (const arm of b.arme) if (arm.richtung === -1) k += armKosten(arm, a)
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
  liste.forEach((s, i) => {
    s.spur = spuren[i]
    s.anzahl = anzahl
  })
  return anzahl
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
  const quelle = (id: string) => rahmenAus.get(id) ?? nach.get(id)!
  const ziel = (id: string) => rahmenEin.get(id) ?? nach.get(id)!
  const { aus, ein } = bestimmeAnschluesse(kanten, quelle, ziel, spurMitte, auftrag.spalteFrei)
  // Neben Rahmenkanten bleibt in der Lücke Platz: Kanalspuren liegen außerhalb des Rahmens.
  const kanteLinks = new Set([...rahmenEin.values()].map((k) => k.spalte))
  const kanteRechts = new Set([...rahmenAus.values()].map((k) => k.spalte))
  const randRahmen = RAHMEN_RAND.innen + RAHMEN_RAND.aussen

  const kanaele = new Map<number, Kanalstueck[]>()
  const kanal = (luecke: number, ya: number, yb: number, arme: Arm[]): Kanalstueck => {
    const s: Kanalstueck = { luecke, y1: Math.min(ya, yb), y2: Math.max(ya, yb), arme, spur: 0, anzahl: 1 }
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
      const start = sa.art === 'ecke' ? { dx: a.breite / 2, y: mitteY(a) } : randpunkt(sa)
      const s = kanal(a.spalte, start.y, y, [
        { y: start.y, richtung: -1 },
        { y, richtung: -1 },
      ])
      const rz = randpunkt(sz)
      wege.set(e.id, [P(a, start.dx, start.y), K(s, start.y), K(s, y), P(z, rz.dx, y), P(z, rz.dx, rz.y)])
      continue
    }
    const weg: Wegpunkt[] = []
    let y: number
    if (sa.art === 'ecke') {
      y = mitteY(a)
      weg.push(P(a, a.breite / 2, y))
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
    // Baustein eines Zweigs hinter einen Rahmen gerückt ist: Die Linie läuft dann im eigenen Band zu ihm.
    const weiterRechts = istSplit(a) && sa.art !== 'senkrecht' && sz.art !== 'senkrecht' && z.spalte > a.spalte + 1
    const ebene = e.ueber ? spurMitte(e.ueber) : weiterRechts ? (sz.art === 'ecke' ? mitteY(z) : randpunkt(sz).y) : y
    if (!gleich(ebene, y)) {
      const s = kanal(a.spalte, y, ebene, [
        { y, richtung: -1 },
        { y: ebene, richtung: 1 },
      ])
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
    const rand = n.oben ? k.y : k.y + k.hoehe
    const stummelY = n.oben ? rand - LINIE.stummel : rand + LINIE.stummel
    const luecke = n.richtung === 'an' ? k.spalte : k.spalte - 1
    const s = kanal(luecke, stummelY, n.poolRand, [{ y: stummelY, richtung: n.richtung === 'an' ? -1 : 1 }])
    const weg = [P(k, n.dx, rand), P(k, n.dx, stummelY), K(s, stummelY), K(s, n.poolRand)]
    nachrichtWege.set(n.id, n.richtung === 'an' ? weg : weg.reverse())
  }

  // Spuren je Lücke, volle Lücken verbreitern
  const anzahl = new Map<number, number>()
  for (const [luecke, liste] of kanaele) anzahl.set(luecke, ordneKanal(liste))
  const freiraum = (g: number, mitte: (c: number) => number): [number, number] => {
    const links = g < 0 ? auftrag.linkerRand : mitte(g) + (auftrag.belegt.get(g) ?? 0) + (kanteRechts.has(g) ? randRahmen : 0)
    const rechts = g >= auftrag.maxSpalte ? mitte(auftrag.maxSpalte) + auftrag.rechterRand : mitte(g + 1) - (auftrag.belegt.get(g + 1) ?? 0) - (kanteLinks.has(g + 1) ? randRahmen : 0)
    return [links + LINIE.rand, rechts - LINIE.rand]
  }
  const extra = new Map<number, number>()
  for (const [g, n] of anzahl) {
    if (n < 2) continue
    const [l, r] = freiraum(g, auftrag.spalteMitte)
    const noetig = (n - 1) * LINIE.abstand
    if (r - l < noetig) extra.set(g, noetig - (r - l))
  }
  const spalteMitte = (c: number): number => {
    let s = 0
    for (const [g, x] of extra) if (g < c) s += x
    return auftrag.spalteMitte(c) + s
  }
  const spurX = (s: Kanalstueck): number => {
    const [l, r] = freiraum(s.luecke, spalteMitte)
    const mitte = (l + r) / 2
    if (s.anzahl <= 1) return mitte
    const abstand = Math.min(LINIE.abstand, (r - l) / (s.anzahl - 1))
    return mitte + (s.spur - (s.anzahl - 1) / 2) * abstand
  }
  const loese = (weg: Wegpunkt[]): Punkt[] => bereinige(weg.map((p) => ({ x: 'kanal' in p.x ? spurX(p.x.kanal) : spalteMitte(p.x.spalte) + p.x.dx, y: p.y })))

  return {
    spalteMitte,
    zusatzRechts: extra.get(auftrag.maxSpalte) ?? 0,
    kanten: new Map([...wege].map(([id, w]) => [id, loese(w)])),
    nachrichten: new Map([...nachrichtWege].map(([id, w]) => [id, loese(w)])),
  }
}
