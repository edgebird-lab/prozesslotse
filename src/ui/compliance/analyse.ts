/**
 * Lückenprüfung für die Oberfläche: einmal je Stand berechnet und von
 * Teilschritt-Leiste, Lücken und Diagramm gemeinsam genutzt.
 */
import { useMemo } from 'react'
import { entstehtIn, kontext, objekteVon, vorigeAufgabe, type Kontext } from '../../compliance/ableitung'
import { heuteIso } from '../../compliance/datum'
import { KURZ_REGEL, pruefeCompliance, pruefsummenBefunde, sortiereComplianceBefunde } from '../../compliance/regeln'
import { neueCompliance } from '../../compliance/standard'
import type { ComplianceBefund, ComplianceProjekt, IsoDatum } from '../../compliance/typen'
import type { BpmnErgebnis } from '../../bpmn/export'
import type { Schwere } from '../../modell/pruefung'
import type { Aufgabe, Id, Projekt, Prozess } from '../../modell/typen'
import { formatiereZahl } from '../../modell/zeit'
import { hauptElement, type Markierung } from '../analyse'
import { useApp } from '../kontext'
import { usePruefsummen } from './pruefsummen'

/** Leere Angaben für Projekte ohne Compliance-Angaben; wird nie verändert. */
const LEER: ComplianceProjekt = neueCompliance()

export function angabenVon(projekt: Projekt): ComplianceProjekt {
  return projekt.compliance ?? LEER
}

let letzte: { ist: Prozess; c: ComplianceProjekt; heute: IsoDatum; befunde: ComplianceBefund[] } | null = null

/** Befunde zu diesem Stand; derselbe Stand wird nur einmal geprüft. */
export function complianceBefunde(ist: Prozess, c: ComplianceProjekt, heute: IsoDatum): ComplianceBefund[] {
  if (letzte && letzte.ist === ist && letzte.c === c && letzte.heute === heute) return letzte.befunde
  const befunde = pruefeCompliance(ist, c, heute)
  letzte = { ist, c, heute, befunde }
  return befunde
}

export interface ComplianceApi {
  c: ComplianceProjekt
  ist: Prozess
  heute: IsoDatum
  befunde: ComplianceBefund[]
  k: Kontext
  /** Ändert die Angaben; gleiche Gruppe kurz hintereinander ergibt einen Rückgängig-Schritt. */
  aendere: (f: (c: ComplianceProjekt) => ComplianceProjekt, gruppe?: string) => void
}

export function useCompliance(): ComplianceApi {
  const { z, aendereCompliance } = useApp()
  const c = angabenVon(z.projekt)
  const ist = z.projekt.ist
  const heute = heuteIso()
  // V4: Versionen, deren Prüfsumme nach dem Laden nicht stimmt (Nachprüfung „sicht“, Mangel 6)
  const pruefsummeVon = usePruefsummen(c.versionen)
  const falsch = c.versionen
    .filter((v) => pruefsummeVon(v) === 'falsch')
    .map((v) => v.nummer)
    .join(',')
  const befunde = useMemo(() => {
    const basis = complianceBefunde(ist, c, heute)
    if (!falsch) return basis
    const nummern = new Set(falsch.split(','))
    return sortiereComplianceBefunde([...basis, ...pruefsummenBefunde(c.versionen.filter((v) => nummern.has(String(v.nummer))))])
  }, [ist, c, heute, falsch])
  const k = useMemo(() => kontext(ist, c), [ist, c])
  return { c, ist, heute, befunde, k, aendere: aendereCompliance }
}

const RANG = { fehler: 0, warnung: 1, hinweis: 2 } as const

/**
 * Abzeichen im Diagramm für Befunde, die an einer Aufgabe hängen. Befunde zu einer Unterlage
 * (Ziel „datenobjekt“ oder „frist“) stehen als Hinweis „Unterlage“ an der Aufgabe, in der sie
 * entsteht (abnahme-5); `entstehtIn` liefert diese Aufgabe. Die Befunde selbst bleiben, wie sie sind.
 */
export function complianceMarkierungen(befunde: ComplianceBefund[], bpmn: BpmnErgebnis, entstehtInAufgabe: (unterlageId: Id) => Id | null = () => null): Map<string, Markierung> {
  const ergebnis = new Map<string, Markierung>()
  const markiere = (blockId: Id, art: Schwere, kurz: string) => {
    const e = hauptElement(bpmn, blockId)
    if (!e) return
    const alt = ergebnis.get(e)
    if (!alt) ergebnis.set(e, { art, kurz, anzahl: 1 })
    else if (RANG[art] < RANG[alt.art]) ergebnis.set(e, { art, kurz, anzahl: alt.anzahl + 1 })
    else alt.anzahl += 1
  }
  for (const b of befunde) {
    if (b.blockId) markiere(b.blockId, b.schwere, KURZ_REGEL[b.regel] ?? 'Prüfen')
    else if ((b.ziel?.art === 'datenobjekt' || b.ziel?.art === 'frist') && b.ziel.id) {
      const aufgabe = entstehtInAufgabe(b.ziel.id)
      if (aufgabe) markiere(aufgabe, 'hinweis', 'Unterlage')
    }
  }
  return ergebnis
}

/** Markierungen für die Bühne im Schritt „Dokumentieren“ (lädt nach, siehe `nachladen.ts`). */
export function markierungenFuer(ist: Prozess, compliance: ComplianceProjekt | undefined, heute: IsoDatum, bpmn: BpmnErgebnis): Map<string, Markierung> {
  const c = compliance ?? LEER
  const k = kontext(ist, c)
  return complianceMarkierungen(complianceBefunde(ist, c, heute), bpmn, (id) => entstehtIn(k, id)?.id ?? null)
}

/** Gefiltert nach einer Aufgabe, die im Diagramm angeklickt wurde */
export function useAufgabenFilter(k: Kontext): { aufgabe: Aufgabe | null; aufheben: () => void } {
  const { z, dispatch } = useApp()
  const aufgabe = z.auswahl ? (k.aufgaben.find((a) => a.id === z.auswahl) ?? null) : null
  return { aufgabe, aufheben: () => dispatch({ typ: 'auswahl', auswahl: null }) }
}

/** Vier-Augen-Status wie in Regel K1: Wer erstellt, wer kontrolliert, gleiche oder andere Rolle? */
export function vierAugenStatus(k: Kontext, f: Aufgabe): string {
  const gelesen = new Set(objekteVon(k, f.id, 'liest'))
  let erzeuger = k.aufgaben.filter((e) => e.id !== f.id && objekteVon(k, e.id, 'schreibt').some((id) => gelesen.has(id)))
  if (erzeuger.length === 0) {
    const vorige = vorigeAufgabe(k.p, f.id)
    erzeuger = vorige ? [vorige] : []
  }
  const rolle = (id: string | null) => k.p.rollen.find((r) => r.id === id)
  const erstellt = [...new Set(erzeuger.map((e) => rolle(e.rolleId)?.name.trim() || 'ohne Rolle'))].join(', ') || '–'
  const eigene = rolle(f.rolleId)
  const was = f.art === 'freigabe' ? 'Freigabe' : 'Prüfung'
  const gleich = f.rolleId !== null && erzeuger.some((e) => e.rolleId === f.rolleId)
  const urteil = erzeuger.length === 0 ? 'kein Ersteller bekannt' : gleich ? `dieselbe Rolle (${formatiereZahl(eigene?.personen ?? 0, 1)} ${eigene?.personen === 1 ? 'Person' : 'Personen'})` : 'andere Rolle'
  return `Erstellt: ${erstellt} · ${was}: ${eigene?.name.trim() || 'ohne Rolle'} · ${urteil}`
}

/** Element, auf das „Beheben“ den Fokus setzt. */
export function zielElement(b: ComplianceBefund): string | null {
  if (!b.ziel) return null
  return `ziel-${b.ziel.art}${b.ziel.id ? `-${b.ziel.id}` : ''}`
}
