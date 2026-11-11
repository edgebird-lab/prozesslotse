import { useRef } from 'react'
import { mitgeltendeUnterlagen, setzeMitgeltendeUnterlagen } from '../../compliance/mitgeltend'
import { neueMitgeltendeUnterlage } from '../../compliance/standard'
import type { MitgeltendeUnterlage } from '../../compliance/typen'
import { Kreuz } from '../Symbol'
import { useCompliance } from './analyse'

/** Mitgeltende Unterlagen mit Ablageort für Kapitel 6 der Verfahrensdokumentation (Teilschritt „Dokumente“). */
export function MitgeltendeListe() {
  const { c, aendere } = useCompliance()
  const liste = mitgeltendeUnterlagen(c)
  const neuKnopf = useRef<HTMLButtonElement>(null)

  // Immer vom aktuellen Stand aus ändern; ältere Einträge ohne Ablageort gehen dabei in die neue Liste über
  const aendereEintrag = (id: string, werte: Partial<MitgeltendeUnterlage>, feld: string) =>
    aendere((x) => setzeMitgeltendeUnterlagen(x, mitgeltendeUnterlagen(x).map((m) => (m.id === id ? { ...m, ...werte } : m))), `mitgeltend.${id}.${feld}`)
  // Der Fokus folgt der Änderung: in das neue Namensfeld bzw. nach dem Entfernen auf „+ Mitgeltende Unterlage“
  const neu = () => {
    const m = neueMitgeltendeUnterlage()
    aendere((x) => setzeMitgeltendeUnterlagen(x, [...mitgeltendeUnterlagen(x), m]))
    requestAnimationFrame(() => document.getElementById(`mitgeltend-${m.id}`)?.focus())
  }
  const entferne = (id: string) => {
    aendere((x) => setzeMitgeltendeUnterlagen(x, mitgeltendeUnterlagen(x).filter((m) => m.id !== id)))
    requestAnimationFrame(() => neuKnopf.current?.focus())
  }

  return (
    <section aria-labelledby="mitgeltend-titel" className="felder mitgeltende">
      <h3 id="mitgeltend-titel">Mitgeltende Unterlagen</h3>
      <p className="leise">Weitere Unterlagen, die zur Verfahrensdokumentation gehören, etwa ein Berechtigungskonzept oder Arbeitsanweisungen. Sie stehen in Kapitel 6.</p>
      {liste.length > 0 && (
        <div className="tabelle-wrap">
          <table className="eingabe-tabelle">
            <thead>
              <tr>
                <th scope="col">Unterlage</th>
                <th scope="col">Ablageort</th>
                <th scope="col">
                  <span className="sr">Entfernen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {liste.map((m, i) => (
                <tr key={m.id}>
                  <td>
                    <input
                      id={`mitgeltend-${m.id}`}
                      type="text"
                      autoComplete="off"
                      aria-label={`Name der mitgeltenden Unterlage ${i + 1}`}
                      placeholder="z. B. Berechtigungskonzept"
                      value={m.name}
                      onChange={(e) => aendereEintrag(m.id, { name: e.target.value }, 'name')}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      autoComplete="off"
                      aria-label={`Ablageort der mitgeltenden Unterlage ${i + 1}`}
                      placeholder="z. B. Ordner Organisation, Büro"
                      value={m.ablageort}
                      onChange={(e) => aendereEintrag(m.id, { ablageort: e.target.value }, 'ablageort')}
                    />
                  </td>
                  <td>
                    <button type="button" className="knopf-icon" aria-label={`Mitgeltende Unterlage ${m.name.trim() || i + 1} entfernen`} title="Entfernen" onClick={() => entferne(m.id)}>
                      <Kreuz />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="knopfreihe">
        <button type="button" ref={neuKnopf} className="knopf knopf-klein" onClick={neu}>
          + Mitgeltende Unterlage
        </button>
      </div>
    </section>
  )
}
