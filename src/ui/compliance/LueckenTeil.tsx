import { TEILSCHRITTE } from '../../compliance/standard'
import type { ComplianceBefund } from '../../compliance/typen'
import { SCHWERE_TEXT, zaehle } from '../befundtext'
import { StatusSymbol } from '../schritte/PruefenSchritt'
import { useCompliance } from './analyse'
import { behebenName } from './beheben'

export function LueckenTeil({ onBeheben }: { onBeheben: (b: ComplianceBefund) => void }) {
  const { befunde, k } = useCompliance()
  const gruppen = TEILSCHRITTE.filter((t) => t.id !== 'luecken')
    .map((t) => ({ t, liste: befunde.filter((b) => b.teilschritt === t.id) }))
    .filter((g) => g.liste.length > 0)

  return (
    <div className="teil">
      <h3>Lücken</h3>
      <p className="zaehler">{zaehle(befunde)}</p>
      {befunde.length === 0 && (
        <p className="status status-gut">
          <StatusSymbol art="gut" /> Keine Lücken gefunden. Die Prüfung findet keine fehlenden oder widersprüchlichen Angaben; ob sie stimmen, prüft die App nicht.
        </p>
      )}
      {gruppen.map(({ t, liste }) => (
        <section key={t.id} aria-labelledby={`luecken-${t.id}`}>
          <h4 id={`luecken-${t.id}`}>{t.name}</h4>
          <ul className="befunde">
            {liste.map((b) => (
              <li key={b.schluessel} className={`befund befund-${b.schwere}`}>
                <StatusSymbol art={b.schwere} />
                <div className="befund-text">
                  <strong>
                    <span className="sr">{SCHWERE_TEXT[b.schwere][0]}: </span>
                    {b.titel}
                  </strong>
                  <p>{b.text}</p>
                  {b.quelle && <small className="leise">Quelle: {b.quelle}</small>}
                </div>
                <button type="button" className="knopf knopf-klein" aria-label={behebenName(b, k)} onClick={() => onBeheben(b)}>
                  Beheben
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
