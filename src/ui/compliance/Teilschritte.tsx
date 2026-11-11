import { hatAngaben } from '../../compliance/fortschritt'
import { offenePunkte } from '../../compliance/regeln'
import { TEILSCHRITTE } from '../../compliance/standard'
import type { ComplianceBefund } from '../../compliance/typen'
import { useApp } from '../kontext'
import { StatusSymbol } from '../schritte/PruefenSchritt'
import { useCompliance } from './analyse'

/** Grauer Kreis: noch nichts eingetragen, also auch nichts geprüft. */
function LeerSymbol() {
  return (
    <svg className="status-symbol status-leer" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

/**
 * Teilschritt-Leiste: die Zahl offener Punkte (Fehler und Warnungen); ohne sie ein Häkchen,
 * aber erst, wenn im Teilschritt etwas eingetragen ist, sonst ein grauer Kreis.
 */
export function Teilschritte({ befunde }: { befunde: ComplianceBefund[] }) {
  const { z, dispatch } = useApp()
  const { k } = useCompliance()
  return (
    <nav className="teilschritte" aria-label="Teilschritte">
      <ol>
        {TEILSCHRITTE.map((t) => {
          const offen = offenePunkte(befunde, t.id)
          return (
            <li key={t.id}>
              <button type="button" aria-current={z.teilschritt === t.id ? 'step' : undefined} onClick={() => dispatch({ typ: 'teilschritt', teilschritt: t.id })}>
                <span className="teilschritt-name">{t.name}</span>
                {offen > 0 ? (
                  <>
                    <span className="teilschritt-zahl" aria-hidden="true">
                      {offen}
                    </span>
                    <span className="sr">, {offen === 1 ? '1 offener Punkt' : `${offen} offene Punkte`}</span>
                  </>
                ) : hatAngaben(k, t.id) ? (
                  <>
                    <StatusSymbol art="gut" />
                    <span className="sr">, keine offenen Punkte</span>
                  </>
                ) : (
                  <>
                    <LeerSymbol />
                    <span className="sr">, noch nichts eingetragen</span>
                  </>
                )}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
