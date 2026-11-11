import { useCallback, useEffect, useRef } from 'react'
import { TEILSCHRITTE } from '../../compliance/standard'
import type { ComplianceBefund } from '../../compliance/typen'
import { useApp } from '../kontext'
import { useCompliance, zielElement } from '../compliance/analyse'
import { BelegeTeil } from '../compliance/BelegeTeil'
import { DokumenteTeil } from '../compliance/DokumenteTeil'
import { ComplianceLernhinweis } from '../compliance/Eingaben'
import { FristenTeil } from '../compliance/FristenTeil'
import { KontrollenTeil } from '../compliance/KontrollenTeil'
import { LueckenTeil } from '../compliance/LueckenTeil'
import { SystemeTeil } from '../compliance/SystemeTeil'
import { Teilschritte } from '../compliance/Teilschritte'
import { TomTeil } from '../compliance/TomTeil'
import { UnternehmenTeil } from '../compliance/UnternehmenTeil'

/**
 * Schritt „Dokumentieren“: Angaben für Verfahrensdokumentation und Verzeichnis
 * in acht Teilschritten, Lückenprüfung, Dokumente und Versionen.
 */
export function DokumentierenSchritt() {
  const { z, dispatch } = useApp()
  const { befunde } = useCompliance()
  const fokus = useRef<string | null>(null)
  const index = TEILSCHRITTE.findIndex((t) => t.id === z.teilschritt)
  const naechster = TEILSCHRITTE[index + 1]

  // „Beheben“: nach dem Wechsel des Teilschritts das Ziel ansteuern
  useEffect(() => {
    const id = fokus.current
    if (!id) return
    fokus.current = null
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ block: 'center' })
    el.focus({ preventScroll: true })
  }, [z.teilschritt])

  const beheben = useCallback(
    (b: ComplianceBefund) => {
      fokus.current = zielElement(b)
      dispatch({ typ: 'auswahl', auswahl: null })
      dispatch({ typ: 'teilschritt', teilschritt: b.teilschritt })
    },
    [dispatch],
  )

  return (
    <div className="schritt dokumentieren">
      <h2>6 · Dokumentieren</h2>
      <p className="leise">
        Aus dem Ablauf entstehen zwei Dokumente: die Verfahrensdokumentation, die das Finanzamt nach den GoBD (Regeln für die elektronische Buchführung) erwartet, und das Verzeichnis
        von Verarbeitungstätigkeiten nach Art. 30 DSGVO. Beide beschreiben den Ist-Prozess.
      </p>
      <Teilschritte befunde={befunde} />
      <ComplianceLernhinweis thema={z.teilschritt} />
      {z.teilschritt === 'unternehmen' && <UnternehmenTeil />}
      {z.teilschritt === 'belege' && <BelegeTeil />}
      {z.teilschritt === 'systeme' && <SystemeTeil />}
      {z.teilschritt === 'fristen' && <FristenTeil />}
      {z.teilschritt === 'kontrollen' && <KontrollenTeil />}
      {z.teilschritt === 'tom' && <TomTeil />}
      {z.teilschritt === 'luecken' && <LueckenTeil onBeheben={beheben} />}
      {z.teilschritt === 'dokumente' && <DokumenteTeil />}
      <div className="schritt-fuss">
        {naechster ? (
          <button type="button" className="knopf knopf-haupt" onClick={() => dispatch({ typ: 'teilschritt', teilschritt: naechster.id })}>
            Weiter: {naechster.name}
          </button>
        ) : (
          <button type="button" className="knopf knopf-haupt" onClick={() => dispatch({ typ: 'schritt', schritt: 'bericht' })}>
            Weiter: Bericht
          </button>
        )}
      </div>
    </div>
  )
}
