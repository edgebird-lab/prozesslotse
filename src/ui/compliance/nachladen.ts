/**
 * Lückenprüfung und Generatoren sind groß und werden nur im Schritt
 * „Dokumentieren“ gebraucht. Sie laden erst dort (eigener Teil, wie der
 * Schritt selbst), damit der Hauptteil klein bleibt und die Oberfläche
 * schneller erscheint.
 */
import { useEffect, useMemo, useState } from 'react'
import type { BpmnErgebnis } from '../../bpmn/export'
import { heuteIso } from '../../compliance/datum'
import type { Projekt } from '../../modell/typen'
import type { Markierung } from '../analyse'

type Analyse = typeof import('./analyse')

/** Markierungen für die Bühne im Schritt „Dokumentieren“; sonst und bis die Prüfung geladen ist undefined. */
export function useComplianceMarkierungen(aktiv: boolean, projekt: Projekt, bpmn: BpmnErgebnis): Map<string, Markierung> | undefined {
  const [analyse, setAnalyse] = useState<Analyse | null>(null)
  useEffect(() => {
    if (!aktiv || analyse) return
    let gilt = true
    void import('./analyse').then((m) => gilt && setAnalyse(m))
    return () => {
      gilt = false
    }
  }, [aktiv, analyse])
  const { ist, compliance } = projekt
  const heute = heuteIso()
  return useMemo(() => (aktiv && analyse ? analyse.markierungenFuer(ist, compliance, heute, bpmn) : undefined), [aktiv, analyse, ist, compliance, heute, bpmn])
}
