/**
 * Ableitungen aus Prozess und Compliance-Angaben (Spezifikation 6.3): wer eine
 * Unterlage erstellt und nutzt, welche Systeme im Einsatz sind und welche
 * Daten sie verarbeiten, Kapitelnummern der Aufgaben und die vorige Aufgabe.
 * Alles wird über einen `Kontext` berechnet, der Prozess, Angaben und
 * Datensicht einmal zusammenführt.
 */
import { alleAufgaben, durchlaufe, findeBlock } from '../modell/operationen'
import { istDigital, type Aufgabe, type Id, type Medium, type Prozess, type Rolle } from '../modell/typen'
import { datenSicht, type DatenSicht } from './quelle'
import { istPflichtig, standardDatenobjekt, standardRolle, standardSystem } from './standard'
import type { ComplianceProjekt, DatenobjektAngaben, KontrollAngaben, RollenAngaben, SystemAngaben } from './typen'

export function angaben(c: ComplianceProjekt, unterlageId: Id): DatenobjektAngaben {
  return c.datenobjekte[unterlageId] ?? standardDatenobjekt()
}

export function systemAngaben(c: ComplianceProjekt, mediumId: Id): SystemAngaben {
  return c.systeme[mediumId] ?? standardSystem()
}

export function rollenAngaben(c: ComplianceProjekt, rolleId: Id): RollenAngaben {
  return c.rollen[rolleId] ?? standardRolle()
}

/** Angaben zu einer Prüfung oder Freigabe; null, solange keine eingetragen sind. */
export function kontrollAngaben(c: ComplianceProjekt, aufgabeId: Id): KontrollAngaben | null {
  return c.kontrollen[aufgabeId] ?? null
}

/** Kapitelnummer „4.k“ je Aufgabe in Lesereihenfolge (Tiefensuche wie `durchlaufe`), k ab 1. */
export function nummern(p: Prozess): Map<Id, string> {
  const m = new Map<Id, string>()
  let k = 0
  for (const { block } of durchlaufe(p.ablauf)) if (block.typ === 'aufgabe') m.set(block.id, `4.${++k}`)
  return m
}

/**
 * Vorige Aufgabe: in der Sequenz von `aufgabeId` rückwärts die nächste Aufgabe.
 * Zusammengesetzte Bausteine werden übersprungen, nicht betreten; am Anfang
 * der Sequenz geht es im umgebenden Block weiter, rückwärts ab diesem Block.
 * Am Anfang des Ausnahmewegs einer Unterbrechung ist es die unterbrochene
 * Aufgabe selbst; vor einem Rahmen (Abschnitt, „für jedes Stück“) geht es wie
 * vor jedem anderen Baustein weiter.
 */
export function vorigeAufgabe(p: Prozess, aufgabeId: Id): Aufgabe | null {
  let ort = findeBlock(p, aufgabeId)
  while (ort) {
    for (let i = ort.index - 1; i >= 0; i--) {
      const b = ort.sequenz.schritte[i]
      if (b.typ === 'aufgabe') return b
    }
    const besitzer = ort.vorfahren[ort.vorfahren.length - 1]
    if (!besitzer) return null
    if (besitzer.typ === 'aufgabe') return besitzer
    ort = findeBlock(p, besitzer.id)
  }
  return null
}

/** Cloud-Dienst oder benannter Betreiber; auf eigenen Geräten zählt ein (ausgeblendeter) Name nicht. */
export function mitDienstleister(s: SystemAngaben): boolean {
  return s.betrieb === 'cloud' || (s.betrieb !== 'lokal' && s.dienstleister.trim() !== '')
}

export interface Kontext {
  p: Prozess
  c: ComplianceProjekt
  sicht: DatenSicht
  /** Aufgaben in Ablaufreihenfolge */
  aufgaben: Aufgabe[]
  /** Position jeder Aufgabe in der Ablaufreihenfolge */
  position: Map<Id, number>
  nummer: Map<Id, string>
  medien: Map<Id, Medium>
}

export function kontext(p: Prozess, c: ComplianceProjekt): Kontext {
  const aufgaben = alleAufgaben(p)
  return {
    p,
    c,
    sicht: datenSicht(p, c),
    aufgaben,
    position: new Map(aufgaben.map((a, i) => [a.id, i])),
    nummer: nummern(p),
    medien: new Map(p.medien.map((m) => [m.id, m])),
  }
}

function nachPosition(k: Kontext, ids: Iterable<Id>): Aufgabe[] {
  return [...new Set(ids)].filter((id) => k.position.has(id)).sort((a, b) => k.position.get(a)! - k.position.get(b)!).map((id) => k.aufgaben[k.position.get(id)!])
}

/** Aufgaben, die die Unterlage schreiben, in Ablaufreihenfolge. */
export function ersteller(k: Kontext, objektId: Id): Aufgabe[] {
  return nachPosition(k, k.sicht.zugriffe.filter((z) => z.zielId === objektId && z.richtung === 'schreibt').map((z) => z.aufgabeId))
}

/** Aufgaben, die die Unterlage lesen, in Ablaufreihenfolge. */
export function nutzer(k: Kontext, objektId: Id): Aufgabe[] {
  return nachPosition(k, k.sicht.zugriffe.filter((z) => z.zielId === objektId && z.richtung === 'liest').map((z) => z.aufgabeId))
}

export function entstehtIn(k: Kontext, objektId: Id): Aufgabe | null {
  return ersteller(k, objektId)[0] ?? null
}

/** Unterlagen, die eine Aufgabe liest bzw. schreibt, in Tabellenreihenfolge. */
export function objekteVon(k: Kontext, aufgabeId: Id, richtung: 'liest' | 'schreibt'): Id[] {
  const ids = new Set(k.sicht.zugriffe.filter((z) => z.aufgabeId === aufgabeId && z.richtung === richtung).map((z) => z.zielId))
  return k.sicht.objekte.filter((o) => ids.has(o.id)).map((o) => o.id)
}

export function objektName(k: Kontext, objektId: Id): string {
  return k.sicht.objekte.find((o) => o.id === objektId)?.name.trim() || 'Unbenannte Unterlage'
}

/** Rollen von Erstellern und Nutzern, eindeutig, in der Reihenfolge von `p.rollen`, getrennt nach intern und extern. */
export function rollenMitZugriff(k: Kontext, objektId: Id): { intern: Rolle[]; extern: Rolle[] } {
  const ids = new Set([...ersteller(k, objektId), ...nutzer(k, objektId)].map((a) => a.rolleId))
  const rollen = k.p.rollen.filter((r) => ids.has(r.id))
  return { intern: rollen.filter((r) => !rollenAngaben(k.c, r.id).extern), extern: rollen.filter((r) => rollenAngaben(k.c, r.id).extern) }
}

/** Ablageorte einer Unterlage, die es gibt (in Tabellenreihenfolge der Ablageorte). */
export function ablageVonObjekt(k: Kontext, d: DatenobjektAngaben): DatenSicht['speicher'] {
  return k.sicht.speicher.filter((s) => d.ablageSpeicherIds.includes(s.id))
}

export function digital(m: Medium): boolean {
  return istDigital(m.art)
}

/** Medium einer Aufgabe, Quelle einer Übertragung oder Medium eines Ablageorts, in dem eine Unterlage liegt. */
export function imEinsatz(k: Kontext, mediumId: Id): boolean {
  if (k.aufgaben.some((a) => a.mediumId === mediumId || a.uebertragung?.quelleMediumId === mediumId)) return true
  const genutzt = new Set(Object.values(k.c.datenobjekte).flatMap((d) => d.ablageSpeicherIds))
  return k.sicht.speicher.some((s) => s.mediumId === mediumId && genutzt.has(s.id))
}

/** Digitale Systeme im Einsatz, in der Reihenfolge von `p.medien`. */
export function systemeImEinsatz(k: Kontext): Medium[] {
  return k.p.medien.filter((m) => digital(m) && imEinsatz(k, m.id))
}

/** Unterlagen, die in einem Ablageort des Mediums liegen oder von einer Aufgabe mit diesem Medium gelesen oder geschrieben werden. */
export function datenImSystem(k: Kontext, mediumId: Id): Id[] {
  const speicher = new Set(k.sicht.speicher.filter((s) => s.mediumId === mediumId).map((s) => s.id))
  const aufgaben = new Set(k.aufgaben.filter((a) => a.mediumId === mediumId).map((a) => a.id))
  const zugriff = new Set(k.sicht.zugriffe.filter((z) => aufgaben.has(z.aufgabeId)).map((z) => z.zielId))
  return k.sicht.objekte.filter((o) => zugriff.has(o.id) || angaben(k.c, o.id).ablageSpeicherIds.some((s) => speicher.has(s))).map((o) => o.id)
}

export function hatPersonenbezug(k: Kontext, mediumId: Id): boolean {
  return datenImSystem(k, mediumId).some((id) => angaben(k.c, id).personenbezogen === true)
}

/** Aufbewahrungspflichtige Unterlagen, deren Ablage einen Ablageort dieses Mediums enthält. */
export function ablageVon(k: Kontext, mediumId: Id): Id[] {
  const speicher = new Set(k.sicht.speicher.filter((s) => s.mediumId === mediumId).map((s) => s.id))
  return k.sicht.objekte
    .filter((o) => {
      const d = angaben(k.c, o.id)
      return istPflichtig(d.aufbewahrungsart) && d.ablageSpeicherIds.some((s) => speicher.has(s))
    })
    .map((o) => o.id)
}

/** „4.2 Bestellung erfassen“ für Tabellen und Verweise. */
export function schrittText(k: Kontext, a: Aufgabe): string {
  return `${k.nummer.get(a.id) ?? '4.?'} ${a.name.trim() || 'Unbenannter Schritt'}`
}

/** Liste in Anführungszeichen: „A“, „B“ und „C“ */
export function aufzaehlung(namen: string[], und = 'und'): string {
  const q = namen.map((n) => `„${n}“`)
  if (q.length <= 1) return q.join('')
  return `${q.slice(0, -1).join(', ')} ${und} ${q[q.length - 1]}`
}

/** Liste ohne Anführungszeichen: A, B und C */
export function liste(teile: string[], und = 'und'): string {
  if (teile.length <= 1) return teile.join('')
  return `${teile.slice(0, -1).join(', ')} ${und} ${teile[teile.length - 1]}`
}
