import { offenePunkte } from '../../compliance/regeln'
import { TEILSCHRITTE } from '../../compliance/standard'
import type { ComplianceBefund } from '../../compliance/typen'
import { useApp } from '../kontext'
import { StatusSymbol } from '../schritte/PruefenSchritt'

/** Teilschritt-Leiste: Häkchen ohne Fehler und Warnungen, sonst die Zahl offener Punkte. */
export function Teilschritte({ befunde }: { befunde: ComplianceBefund[] }) {
  const { z, dispatch } = useApp()
  return (
    <nav className="teilschritte" aria-label="Teilschritte">
      <ol>
        {TEILSCHRITTE.map((t) => {
          const offen = offenePunkte(befunde, t.id)
          return (
            <li key={t.id}>
              <button type="button" aria-current={z.teilschritt === t.id ? 'step' : undefined} onClick={() => dispatch({ typ: 'teilschritt', teilschritt: t.id })}>
                <span className="teilschritt-name">{t.name}</span>
                {offen === 0 ? (
                  <>
                    <StatusSymbol art="gut" />
                    <span className="sr">, vollständig</span>
                  </>
                ) : (
                  <>
                    <span className="teilschritt-zahl" aria-hidden="true">
                      {offen}
                    </span>
                    <span className="sr">, {offen === 1 ? '1 offener Punkt' : `${offen} offene Punkte`}</span>
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
