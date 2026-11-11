import { useCallback, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { TEILSCHRITTE } from '../../compliance/standard'
import type { ComplianceBefund, Teilschritt } from '../../compliance/typen'
import type { Id } from '../../modell/typen'
import { useApp } from '../kontext'
import { useCompliance, zielElement } from '../compliance/analyse'
import { feldZiel, zeigeAnfang, zeigeFrage } from '../compliance/beheben'
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
  const { c, befunde } = useCompliance()
  const wurzel = useRef<HTMLDivElement>(null)
  // Karte, die „Beheben“ beim Wechsel zu „Belege und Daten“ geöffnet zeigt
  const [oeffnen, setOeffnen] = useState<Id | null>(null)
  const index = TEILSCHRITTE.findIndex((t) => t.id === z.teilschritt)
  const naechster = TEILSCHRITTE[index + 1]

  // Beide Sprünge zeichnen den neuen Teilschritt sofort (flushSync) und steuern dann an:
  // „Beheben“ die Frage zum Befund, „Weiter“ den Anfang des Teilschritts.
  const beheben = useCallback(
    (b: ComplianceBefund) => {
      const ziele = [feldZiel(b, c), zielElement(b)].filter((id): id is string => !!id)
      flushSync(() => {
        setOeffnen(b.ziel?.art === 'datenobjekt' ? (b.ziel.id ?? null) : null)
        dispatch({ typ: 'auswahl', auswahl: null })
        dispatch({ typ: 'teilschritt', teilschritt: b.teilschritt })
      })
      zeigeFrage(ziele)
      setOeffnen(null)
    },
    [c, dispatch],
  )

  const weiter = (id: Teilschritt) => {
    flushSync(() => dispatch({ typ: 'teilschritt', teilschritt: id }))
    zeigeAnfang(wurzel.current)
  }

  return (
    <div className="schritt dokumentieren" ref={wurzel}>
      <h2>6 · Dokumentieren</h2>
      <p className="leise">
        Aus dem Ablauf entstehen zwei Dokumente: die Verfahrensdokumentation, die das Finanzamt nach den GoBD (Regeln für die elektronische Buchführung) erwartet, und das Verzeichnis
        von Verarbeitungstätigkeiten nach Art. 30 DSGVO (kurz: Verarbeitungsverzeichnis). Beide beschreiben den Ist-Prozess.
      </p>
      <Teilschritte befunde={befunde} />
      <ComplianceLernhinweis thema={z.teilschritt} />
      {z.teilschritt === 'unternehmen' && <UnternehmenTeil />}
      {z.teilschritt === 'belege' && <BelegeTeil oeffnen={oeffnen} />}
      {z.teilschritt === 'systeme' && <SystemeTeil />}
      {z.teilschritt === 'fristen' && <FristenTeil />}
      {z.teilschritt === 'kontrollen' && <KontrollenTeil />}
      {z.teilschritt === 'tom' && <TomTeil />}
      {z.teilschritt === 'luecken' && <LueckenTeil onBeheben={beheben} />}
      {z.teilschritt === 'dokumente' && <DokumenteTeil />}
      <div className="schritt-fuss">
        {naechster ? (
          <button type="button" className="knopf knopf-haupt" onClick={() => weiter(naechster.id)}>
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
