import type { Layout, LayoutKnoten, Punkt, Rechteck } from '../bpmn/layout'

function ueberlappen(a: Rechteck, b: Rechteck): boolean {
  return a.x < b.x + b.breite - 1 && b.x < a.x + a.breite - 1 && a.y < b.y + b.hoehe - 1 && b.y < a.y + a.hoehe - 1
}

function segmentSchneidet(p: Punkt, q: Punkt, r: Rechteck): boolean {
  const x1 = Math.min(p.x, q.x)
  const x2 = Math.max(p.x, q.x)
  const y1 = Math.min(p.y, q.y)
  const y2 = Math.max(p.y, q.y)
  return x1 < r.x + r.breite - 1 && x2 > r.x + 1 && y1 < r.y + r.hoehe - 1 && y2 > r.y + 1
}

/**
 * Länge, auf der zwei Stücke übereinander liegen. Parallele Stücke mit weniger
 * als 4 px Abstand gelten als eine Linie.
 */
export function gemeinsameStrecke(p1: Punkt, q1: Punkt, p2: Punkt, q2: Punkt): number {
  const waagerecht = (p: Punkt, q: Punkt) => Math.abs(p.y - q.y) < 0.01 && Math.abs(p.x - q.x) > 0.01
  const senkrecht = (p: Punkt, q: Punkt) => Math.abs(p.x - q.x) < 0.01 && Math.abs(p.y - q.y) > 0.01
  if (waagerecht(p1, q1) && waagerecht(p2, q2) && Math.abs(p1.y - p2.y) < 4) {
    return Math.min(Math.max(p1.x, q1.x), Math.max(p2.x, q2.x)) - Math.max(Math.min(p1.x, q1.x), Math.min(p2.x, q2.x))
  }
  if (senkrecht(p1, q1) && senkrecht(p2, q2) && Math.abs(p1.x - p2.x) < 4) {
    return Math.min(Math.max(p1.y, q1.y), Math.max(p2.y, q2.y)) - Math.max(Math.min(p1.y, q1.y), Math.min(p2.y, q2.y))
  }
  return 0
}

/** Liegt der Punkt auf dem Umriss des Knotens (Rechteck, Raute oder Kreis)? */
export function aufRand(p: Punkt, k: LayoutKnoten): boolean {
  const cx = k.x + k.breite / 2
  const cy = k.y + k.hoehe / 2
  if (k.art === 'aufgabe') {
    const innenX = p.x > k.x - 0.5 && p.x < k.x + k.breite + 0.5
    const innenY = p.y > k.y - 0.5 && p.y < k.y + k.hoehe + 0.5
    return (innenY && (Math.abs(p.x - k.x) < 0.5 || Math.abs(p.x - k.x - k.breite) < 0.5)) || (innenX && (Math.abs(p.y - k.y) < 0.5 || Math.abs(p.y - k.y - k.hoehe) < 0.5))
  }
  if (k.art === 'xor' || k.art === 'und' || k.art === 'oder' || k.art === 'ereignisgateway') return Math.abs(Math.abs(p.x - cx) + Math.abs(p.y - cy) - k.breite / 2) < 0.5
  return Math.abs(Math.hypot(p.x - cx, p.y - cy) - k.breite / 2) < 0.5
}

/** Prüft die geometrischen Zusagen des Layouts und gibt Verstöße als Text zurück. */
export function geometrieFehler(l: Layout): string[] {
  const fehler: string[] = []
  const nachId = new Map(l.knoten.map((k) => [k.id, k]))
  for (let i = 0; i < l.knoten.length; i++) {
    for (let j = i + 1; j < l.knoten.length; j++) {
      if (ueberlappen(l.knoten[i], l.knoten[j])) fehler.push(`Überlappung ${l.knoten[i].id} / ${l.knoten[j].id}`)
    }
  }
  for (const k of l.knoten) {
    const bahn = l.bahnen.find((b) => b.schluessel === k.bahn)
    if (!bahn || k.y < bahn.y || k.y + k.hoehe > bahn.y + bahn.hoehe) fehler.push(`${k.id} liegt nicht in seiner Bahn`)
  }
  for (const e of l.kanten) {
    for (let i = 1; i < e.punkte.length; i++) {
      const p = e.punkte[i - 1]
      const q = e.punkte[i]
      if (Math.abs(p.x - q.x) > 0.01 && Math.abs(p.y - q.y) > 0.01) fehler.push(`${e.id} ist nicht rechtwinklig`)
      for (const k of l.knoten) {
        if (k.id === e.von || k.id === e.nach) continue
        if (segmentSchneidet(p, q, k)) fehler.push(`${e.id} (${e.von}→${e.nach}) läuft durch ${k.id}`)
      }
    }
    const von = nachId.get(e.von)
    const nach = nachId.get(e.nach)
    if (!von || !nach) {
      fehler.push(`${e.id} verweist ins Leere`)
      continue
    }
    // Jeder Fluss beginnt auf dem Rand seiner Quelle und endet auf dem Rand seines Ziels
    if (!aufRand(e.punkte[0], von)) fehler.push(`${e.id} beginnt nicht auf dem Rand von ${e.von}`)
    if (!aufRand(e.punkte[e.punkte.length - 1], nach)) fehler.push(`${e.id} endet nicht auf dem Rand von ${e.nach}`)
  }
  // Nachrichtenflüsse: rechtwinklig, durch keinen fremden Knoten, Ende auf dem Rand des Pools
  const poolNachId = new Map(l.pools.map((p) => [p.id, p]))
  for (const n of l.nachrichten) {
    for (let i = 1; i < n.punkte.length; i++) {
      const p = n.punkte[i - 1]
      const q = n.punkte[i]
      if (Math.abs(p.x - q.x) > 0.01 && Math.abs(p.y - q.y) > 0.01) fehler.push(`${n.id} ist nicht rechtwinklig`)
      for (const k of l.knoten) {
        if (k.id === n.von || k.id === n.nach) continue
        if (segmentSchneidet(p, q, k)) fehler.push(`${n.id} (${n.von}→${n.nach}) läuft durch ${k.id}`)
      }
    }
    const pool = poolNachId.get(n.von) ?? poolNachId.get(n.nach)
    const amPool = poolNachId.has(n.von) ? n.punkte[0] : n.punkte[n.punkte.length - 1]
    if (!pool || (Math.abs(amPool.y - pool.y) > 0.5 && Math.abs(amPool.y - (pool.y + pool.hoehe)) > 0.5)) fehler.push(`${n.id} endet nicht am Pool`)
    const knoten = nachId.get(poolNachId.has(n.von) ? n.nach : n.von)
    const amKnoten = poolNachId.has(n.von) ? n.punkte[n.punkte.length - 1] : n.punkte[0]
    if (!knoten || !aufRand(amKnoten, knoten)) fehler.push(`${n.id} beginnt bzw. endet nicht auf dem Rand seines Knotens`)
  }
  // Zwei Linien teilen sich nie eine Strecke: Sonst sähe ein Fluss aus wie einer mit zwei Enden.
  const linien = [...l.kanten.map((e) => ({ id: e.id, punkte: e.punkte })), ...l.nachrichten.map((n) => ({ id: n.id, punkte: n.punkte }))]
  for (let i = 0; i < linien.length; i++) {
    for (let j = i + 1; j < linien.length; j++) {
      const a = linien[i]
      const b = linien[j]
      let geteilt = false
      for (let s = 1; s < a.punkte.length && !geteilt; s++) {
        for (let t = 1; t < b.punkte.length && !geteilt; t++) {
          if (gemeinsameStrecke(a.punkte[s - 1], a.punkte[s], b.punkte[t - 1], b.punkte[t]) > 1) geteilt = true
        }
      }
      if (geteilt) fehler.push(`${a.id} und ${b.id} teilen sich eine Strecke`)
    }
  }
  // Jeder Anschlusspunkt an einem Knoten gehört genau einem Fluss
  const anschluesse = new Map<string, string>()
  const merke = (knoten: string, p: Punkt, linie: string) => {
    const schluessel = `${knoten}|${Math.round(p.x * 2)}|${Math.round(p.y * 2)}`
    const frueher = anschluesse.get(schluessel)
    if (frueher && frueher !== linie) fehler.push(`${frueher} und ${linie} schließen am selben Punkt an ${knoten} an`)
    anschluesse.set(schluessel, linie)
  }
  for (const e of l.kanten) {
    merke(e.von, e.punkte[0], e.id)
    merke(e.nach, e.punkte[e.punkte.length - 1], e.id)
  }
  for (const n of l.nachrichten) {
    if (nachId.has(n.von)) merke(n.von, n.punkte[0], n.id)
    if (nachId.has(n.nach)) merke(n.nach, n.punkte[n.punkte.length - 1], n.id)
  }
  // Beschriftungen liegen weder auf fremden Knoten noch auf anderen Beschriftungen
  const felder = [
    ...l.knoten.flatMap((k) => (k.beschriftung ? [{ id: k.id, r: k.beschriftung, eigen: k.id }] : [])),
    ...l.kanten.flatMap((e) => (e.beschriftung ? [{ id: e.id, r: e.beschriftung, eigen: '' }] : [])),
  ]
  for (const [i, f] of felder.entries()) {
    for (const k of l.knoten) if (k.id !== f.eigen && ueberlappen(f.r, k)) fehler.push(`Beschriftung von ${f.id} liegt auf ${k.id}`)
    for (const g of felder.slice(i + 1)) if (ueberlappen(f.r, g.r)) fehler.push(`Beschriftungen von ${f.id} und ${g.id} überlappen sich`)
  }
  return fehler
}

/** Beschriftungen, über die eine fremde Linie läuft (lesbar, aber unschön; soll selten sein). */
export function beschriftungenAufLinien(l: Layout): { gesamt: number; betroffen: string[] } {
  const linien = [...l.kanten.map((e) => ({ id: e.id, punkte: e.punkte })), ...l.nachrichten.map((n) => ({ id: n.id, punkte: n.punkte }))]
  const felder = [
    ...l.knoten.flatMap((k) => (k.beschriftung ? [{ id: k.id, r: k.beschriftung, eigene: l.kanten.filter((e) => e.von === k.id || e.nach === k.id).map((e) => e.id) }] : [])),
    ...l.kanten.flatMap((e) => (e.beschriftung ? [{ id: e.id, r: e.beschriftung, eigene: [e.id] }] : [])),
  ]
  const betroffen: string[] = []
  for (const f of felder) {
    for (const x of linien) {
      if (f.eigene.includes(x.id)) continue
      if (x.punkte.some((p, i) => i > 0 && segmentSchneidet(x.punkte[i - 1], p, f.r))) {
        betroffen.push(`${f.id} / ${x.id}`)
        break
      }
    }
  }
  return { gesamt: felder.length, betroffen }
}
