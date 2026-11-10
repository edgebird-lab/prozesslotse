import type { Layout, Rechteck } from '../bpmn/layout'

function ueberlappen(a: Rechteck, b: Rechteck): boolean {
  return a.x < b.x + b.breite - 1 && b.x < a.x + a.breite - 1 && a.y < b.y + b.hoehe - 1 && b.y < a.y + a.hoehe - 1
}

function segmentSchneidet(p: { x: number; y: number }, q: { x: number; y: number }, r: Rechteck): boolean {
  const x1 = Math.min(p.x, q.x)
  const x2 = Math.max(p.x, q.x)
  const y1 = Math.min(p.y, q.y)
  const y2 = Math.max(p.y, q.y)
  return x1 < r.x + r.breite - 1 && x2 > r.x + 1 && y1 < r.y + r.hoehe - 1 && y2 > r.y + 1
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
    if (!nachId.has(e.von) || !nachId.has(e.nach)) fehler.push(`${e.id} verweist ins Leere`)
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
  }
  return fehler
}
