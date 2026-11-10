import { LERNINHALTE, type LernThema } from './lerninhalte'
import { Symbol } from './Symbol'
import { useApp } from './kontext'

/** Erklärung mit BPMN-Symbol; erscheint nur im Lernmodus. */
export function Lernhinweis({ thema }: { thema: LernThema }) {
  const { z } = useApp()
  if (!z.lernmodus) return null
  const inhalt = LERNINHALTE[thema]
  return (
    <aside className="lernhinweis" aria-label={`Lernhinweis: ${inhalt.titel}`}>
      <Symbol art={inhalt.symbol} groesse={36} />
      <div>
        <p className="lernhinweis-kopf">
          <strong>{inhalt.titel}</strong> <span>· in BPMN: {inhalt.bpmn}</span>
        </p>
        <p>{inhalt.text}</p>
      </div>
    </aside>
  )
}
