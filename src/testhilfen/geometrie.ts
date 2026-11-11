import { hatMarke, MASSE, RAHMEN, type Layout, type LayoutKnoten, type LayoutRahmen, type Punkt, type Rechteck } from '../bpmn/layout'
import { PARALLEL } from '../bpmn/linien'

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

/** Liegt `innen` ganz in `aussen`, mit mindestens `abstand` Pixeln zu jeder Kante? */
function liegtGanzIn(innen: Rechteck, aussen: Rechteck, abstand: number): boolean {
  return innen.x >= aussen.x + abstand - 0.5 && innen.x + innen.breite <= aussen.x + aussen.breite - abstand + 0.5 && innen.y >= aussen.y + abstand - 0.5 && innen.y + innen.hoehe <= aussen.y + aussen.hoehe - abstand + 0.5
}

/** Die vier Kanten eines Rechtecks als Linienstücke */
function kanten(r: Rechteck): [Punkt, Punkt][] {
  const a = { x: r.x, y: r.y }
  const b = { x: r.x + r.breite, y: r.y }
  const c = { x: r.x + r.breite, y: r.y + r.hoehe }
  const d = { x: r.x, y: r.y + r.hoehe }
  return [
    [a, b],
    [b, c],
    [c, d],
    [d, a],
  ]
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

/**
 * Zwei gleich gerichtete Stücke: Abstand quer zur Richtung und Länge, auf der sie
 * nebeneinander laufen (null bei verschiedener Richtung oder ohne Überdeckung).
 */
export function nebeneinander(p1: Punkt, q1: Punkt, p2: Punkt, q2: Punkt): { abstand: number; laenge: number } | null {
  const waagerecht = (p: Punkt, q: Punkt) => Math.abs(p.y - q.y) < 0.01 && Math.abs(p.x - q.x) > 0.01
  const senkrecht = (p: Punkt, q: Punkt) => Math.abs(p.x - q.x) < 0.01 && Math.abs(p.y - q.y) > 0.01
  let ergebnis: { abstand: number; laenge: number } | null = null
  if (waagerecht(p1, q1) && waagerecht(p2, q2)) ergebnis = { abstand: Math.abs(p1.y - p2.y), laenge: Math.min(Math.max(p1.x, q1.x), Math.max(p2.x, q2.x)) - Math.max(Math.min(p1.x, q1.x), Math.min(p2.x, q2.x)) }
  if (senkrecht(p1, q1) && senkrecht(p2, q2)) ergebnis = { abstand: Math.abs(p1.x - p2.x), laenge: Math.min(Math.max(p1.y, q1.y), Math.max(p2.y, q2.y)) - Math.max(Math.min(p1.y, q1.y), Math.min(p2.y, q2.y)) }
  return ergebnis && ergebnis.laenge > 0 ? ergebnis : null
}

/**
 * Lange, dichte Parallelen: Zwei Flüsse, die länger als `PARALLEL.laenge` mit
 * weniger als `PARALLEL.mindestens` Abstand nebeneinander laufen. Verkleinert
 * („Einpassen“, Druck) sähen sie aus wie eine Linie (Begründung bei `PARALLEL`).
 */
export function langeParallelen(l: Layout): string[] {
  const linien = [...l.kanten.map((e) => ({ id: e.id, punkte: e.punkte })), ...l.nachrichten.map((n) => ({ id: n.id, punkte: n.punkte }))]
  const fehler: string[] = []
  for (let i = 0; i < linien.length; i++) {
    for (let j = i + 1; j < linien.length; j++) {
      const a = linien[i].punkte
      const b = linien[j].punkte
      let schlimmste: { abstand: number; laenge: number } | null = null
      for (let s = 1; s < a.length; s++) {
        for (let t = 1; t < b.length; t++) {
          const n = nebeneinander(a[s - 1], a[s], b[t - 1], b[t])
          if (n && n.abstand < PARALLEL.mindestens - 0.01 && n.laenge > PARALLEL.laenge && (!schlimmste || n.laenge > schlimmste.laenge)) schlimmste = n
        }
      }
      if (schlimmste) fehler.push(`${linien[i].id} und ${linien[j].id} laufen ${Math.round(schlimmste.laenge)} px mit nur ${Math.round(schlimmste.abstand * 10) / 10} px Abstand nebeneinander`)
    }
  }
  return fehler
}

/** Liegt der Punkt auf dem Umriss des Knotens (Rechteck, Raute oder Kreis) bzw. des Rahmens? */
export function aufRand(p: Punkt, k: LayoutKnoten | LayoutRahmen): boolean {
  const cx = k.x + k.breite / 2
  const cy = k.y + k.hoehe / 2
  if ('spalteVon' in k || k.art === 'aufgabe') {
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
  const rahmenNach = new Map(l.rahmen.map((r) => [r.id, r]))
  const form = (id: string): LayoutKnoten | LayoutRahmen | undefined => nachId.get(id) ?? rahmenNach.get(id)
  /** Rahmen über einer Ebene, von innen nach außen */
  const ueber = (ebene: string | null): string[] => {
    const liste: string[] = []
    for (let x = ebene; x; x = rahmenNach.get(x)?.eltern ?? null) liste.push(x)
    return liste
  }
  // Ebene eines Flusses: die seiner Quelle (ein Rahmen als Quelle liegt in seinem Elternrahmen)
  const ebeneVon = (id: string): string | null => (rahmenNach.has(id) ? rahmenNach.get(id)!.eltern : (nachId.get(id)?.rahmen ?? null))

  for (let i = 0; i < l.knoten.length; i++) {
    for (let j = i + 1; j < l.knoten.length; j++) {
      const a = l.knoten[i]
      const b = l.knoten[j]
      // Ein Randereignis sitzt auf dem Rand seiner Aufgabe (geprüft unten)
      if ((a.art === 'rand' && a.wirt === b.id) || (b.art === 'rand' && b.wirt === a.id)) continue
      if (ueberlappen(a, b)) fehler.push(`Überlappung ${a.id} / ${b.id}`)
    }
  }
  for (const k of [...l.knoten, ...l.rahmen]) {
    const bahn = l.bahnen.find((b) => b.schluessel === k.bahn)
    if (!bahn || k.y < bahn.y || k.y + k.hoehe > bahn.y + bahn.hoehe) fehler.push(`${k.id} liegt nicht in seiner Bahn`)
  }

  // Rahmen überlappen nur verschachtelt: ineinander (passend zur Elternkette) oder getrennt
  for (let i = 0; i < l.rahmen.length; i++) {
    for (let j = i + 1; j < l.rahmen.length; j++) {
      const a = l.rahmen[i]
      const b = l.rahmen[j]
      if (!ueberlappen(a, b)) continue
      const aInB = ueber(a.eltern).includes(b.id)
      const bInA = ueber(b.eltern).includes(a.id)
      if (!(aInB && liegtGanzIn(a, b, 6)) && !(bInA && liegtGanzIn(b, a, 6))) fehler.push(`Rahmen ${a.id} und ${b.id} überlappen, ohne ineinander zu liegen`)
    }
  }
  // Ein Knoten liegt ganz in seinem innersten Rahmen, mit Abstand zur Kante, und berührt keinen fremden Rahmen
  for (const k of l.knoten) {
    const eigene = ueber(k.rahmen ?? null)
    const innerster = eigene[0] ? rahmenNach.get(eigene[0]) : undefined
    if (innerster && !liegtGanzIn(k, innerster, 6)) fehler.push(`${k.id} liegt nicht mit Abstand in seinem Rahmen ${innerster.id}`)
    for (const r of l.rahmen) {
      if (eigene.includes(r.id) || (k.art === 'rand' && k.wirt === r.id)) continue
      if (ueberlappen(k, r)) fehler.push(`${k.id} berührt den fremden Rahmen ${r.id}`)
    }
  }
  // Ein Randereignis sitzt auf der Unterkante seines Wirts (Rahmen oder Aufgabe), ganz innerhalb von dessen Breite;
  // sein Fluss beginnt unten am Kreis, führt senkrecht hinunter und läuft nicht durch den Wirt.
  for (const k of l.knoten) {
    if (k.art !== 'rand') continue
    const aufgabe = k.wirt ? nachId.get(k.wirt) : undefined
    const w = (k.wirt ? rahmenNach.get(k.wirt) : undefined) ?? (aufgabe?.art === 'aufgabe' ? aufgabe : undefined)
    const cy = k.y + k.hoehe / 2
    if (!w) {
      fehler.push(`Randereignis ${k.id} ohne Wirt`)
      continue
    }
    if (Math.abs(cy - (w.y + w.hoehe)) > 0.5 || k.x < w.x - 0.5 || k.x + k.breite > w.x + w.breite + 0.5) fehler.push(`Randereignis ${k.id} sitzt nicht auf der Unterkante von ${w.id}`)
    // Die Mitte der Unterkante eines Mehrfach- oder Ad-hoc-Rahmens gehört der Markierung
    else if ('spalteVon' in w && hatMarke(w) && k.x < w.x + w.breite / 2 + RAHMEN.markeHalb - 0.5 && k.x + k.breite > w.x + w.breite / 2 - RAHMEN.markeHalb + 0.5) fehler.push(`Randereignis ${k.id} verdeckt die Markierung von ${w.id}`)
    else if (!('spalteVon' in w) && w.mehrfach && k.x < w.x + w.breite / 2 + RAHMEN.markeHalb - 0.5 && k.x + k.breite > w.x + w.breite / 2 - RAHMEN.markeHalb + 0.5) fehler.push(`Randereignis ${k.id} verdeckt die Mehrfach-Markierung von ${w.id}`)
    for (const e of l.kanten) {
      if (e.von !== k.id || e.punkte.length < 2) continue
      const [p0, p1] = e.punkte
      if (Math.abs(p0.x - (k.x + k.breite / 2)) > 0.5 || Math.abs(p0.y - (k.y + k.hoehe)) > 0.5 || Math.abs(p1.x - p0.x) > 0.01 || p1.y <= p0.y) fehler.push(`${e.id} verlässt das Randereignis ${k.id} nicht senkrecht nach unten`)
      if (e.punkte.some((p, i) => i > 0 && segmentSchneidet(e.punkte[i - 1], p, w))) fehler.push(`${e.id} läuft durch ${w.id}, an dem sein Randereignis sitzt`)
    }
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
    const von = form(e.von)
    const nach = form(e.nach)
    if (!von || !nach) {
      fehler.push(`${e.id} verweist ins Leere`)
      continue
    }
    // Jeder Fluss beginnt auf dem Rand seiner Quelle und endet auf dem Rand seines Ziels
    if (!aufRand(e.punkte[0], von)) fehler.push(`${e.id} beginnt nicht auf dem Rand von ${e.von}`)
    if (!aufRand(e.punkte[e.punkte.length - 1], nach)) fehler.push(`${e.id} endet nicht auf dem Rand von ${e.nach}`)
    // Kein Sequenzfluss quert eine Rahmengrenze: innen bleibt innen, außen berührt das Innere nicht
    const ebene = ueber(ebeneVon(e.von))
    for (const r of l.rahmen) {
      if (ebene.includes(r.id)) {
        if (e.punkte.some((p) => p.x < r.x + 0.5 || p.x > r.x + r.breite - 0.5 || p.y < r.y + 0.5 || p.y > r.y + r.hoehe - 0.5)) fehler.push(`${e.id} verlässt seinen Rahmen ${r.id}`)
      } else if (e.punkte.some((p, i) => i > 0 && segmentSchneidet(e.punkte[i - 1], p, r))) fehler.push(`${e.id} (${e.von}→${e.nach}) quert die Grenze von ${r.id}`)
    }
  }
  // Ad-hoc-Rahmen („in beliebiger Reihenfolge“): Darin läuft kein Sequenzfluss, seine Aktivitäten stehen untereinander ab
  // seiner ersten Spalte, und Ein- und Austritt liegen auf der Höhe der ersten.
  for (const r of l.rahmen) {
    if (r.art === 'adhoc') {
      for (const e of l.kanten) if (ebeneVon(e.von) === r.id) fehler.push(`${e.id} ist ein Sequenzfluss im Ad-hoc-Rahmen ${r.id}`)
      const aktivitaeten = (r.aktivitaeten ?? []).map((id) => form(id))
      if (aktivitaeten.some((a) => !a)) fehler.push(`Ad-hoc-Rahmen ${r.id} nennt eine unbekannte Aktivität`)
      const formen = aktivitaeten.filter((a): a is LayoutKnoten | LayoutRahmen => !!a)
      for (let i = 1; i < formen.length; i++) if (formen[i].y < formen[i - 1].y + formen[i - 1].hoehe) fehler.push(`Aktivitäten im Ad-hoc-Rahmen ${r.id} stehen nicht untereinander`)
      if (formen.some((a) => a.x > r.x + MASSE.spalte / 2)) fehler.push(`Aktivitäten im Ad-hoc-Rahmen ${r.id} beginnen nicht in seiner ersten Spalte`)
      const erste = formen[0]
      if (erste && (r.anschlussY < erste.y - 0.5 || r.anschlussY > erste.y + erste.hoehe + 0.5)) fehler.push(`Ein- und Austritt von ${r.id} liegen nicht auf der Höhe der ersten Aktivität`)
    }
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
  // Zwei Flüsse laufen nie lange dicht nebeneinander, sonst verschmelzen sie verkleinert zu einer Linie
  fehler.push(...langeParallelen(l))
  // Keine Linie läuft auf einer Rahmenkante (senkrecht queren dürfen Nachrichtenflüsse)
  for (const a of linien) {
    for (const r of l.rahmen) {
      const liegtAuf = kanten(r).some(([k1, k2]) => a.punkte.some((p, i) => i > 0 && gemeinsameStrecke(a.punkte[i - 1], p, k1, k2) > 1))
      if (liegtAuf) fehler.push(`${a.id} läuft auf einer Kante von ${r.id}`)
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
  // Beschriftungen (auch die Namen der Rahmen) liegen weder auf fremden Knoten noch auf anderen Beschriftungen
  const felder = [
    ...l.knoten.flatMap((k) => (k.beschriftung ? [{ id: k.id, r: k.beschriftung, eigen: k.id }] : [])),
    ...l.kanten.flatMap((e) => (e.beschriftung ? [{ id: e.id, r: e.beschriftung, eigen: '' }] : [])),
    ...l.rahmen.flatMap((r) => (r.beschriftung ? [{ id: r.id, r: r.beschriftung, eigen: '' }] : [])),
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
    ...l.rahmen.flatMap((r) => (r.beschriftung ? [{ id: r.id, r: r.beschriftung, eigene: [] as string[] }] : [])),
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
