import { neueRolle, neuesMedium } from '../../modell/bausteine'
import { alleAufgaben, entferneMedium, entferneRolle } from '../../modell/operationen'
import { MEDIUM_ARTEN, type MediumArt } from '../../modell/typen'
import { ZahlEingabe } from '../Eingaben'
import { useApp } from '../kontext'
import { Lernhinweis } from '../Lernhinweis'

export function BeteiligteSchritt() {
  const { p, aendere, dispatch } = useApp()
  const aufgaben = alleAufgaben(p)

  return (
    <div className="schritt">
      <h2>2 · Wer ist beteiligt, womit wird gearbeitet?</h2>
      <Lernhinweis thema="beteiligte" />

      <section aria-labelledby="rollen-titel">
        <h3 id="rollen-titel">Rollen</h3>
        <p className="leise">Jede Rolle bekommt im Diagramm eine eigene Bahn. Kosten und Kapazität brauchen die Berechnungen.</p>
        {p.rollen.length === 0 && <p className="leer-hinweis">Noch keine Rolle. Lege an, wer im Prozess arbeitet, z. B. „Innendienst“.</p>}
        <div className="tabelle-wrap">
          <table className="eingabe-tabelle">
            {p.rollen.length > 0 && (
              <thead>
                <tr>
                  <th scope="col">Rolle</th>
                  <th scope="col">€ je Stunde</th>
                  <th scope="col">Personen</th>
                  <th scope="col">Zeit für den Prozess</th>
                  <th scope="col">
                    <span className="sr">Entfernen</span>
                  </th>
                </tr>
              </thead>
            )}
            <tbody>
              {p.rollen.map((r, i) => {
                const setze = (werte: Partial<typeof r>, feld: string) =>
                  aendere({ ...p, rollen: p.rollen.map((x) => (x.id === r.id ? { ...x, ...werte } : x)) }, { gruppe: `rolle:${r.id}:${feld}` })
                const anzahl = aufgaben.filter((a) => a.rolleId === r.id).length
                return (
                  <tr key={r.id}>
                    <td>
                      <input type="text" aria-label={`Name der Rolle ${i + 1}`} value={r.name} placeholder="z. B. Innendienst" onChange={(e) => setze({ name: e.target.value }, 'name')} />
                    </td>
                    <td>
                      <ZahlEingabe ariaLabel={`Stundensatz ${r.name}`} wert={r.stundensatz} min={0} suffix="€" onAendern={(n) => setze({ stundensatz: n }, 'satz')} />
                    </td>
                    <td>
                      <ZahlEingabe ariaLabel={`Personen ${r.name}`} wert={r.personen} min={0} onAendern={(n) => setze({ personen: n }, 'personen')} />
                    </td>
                    <td>
                      <ZahlEingabe ariaLabel={`Verfügbarer Anteil ${r.name}`} wert={r.verfuegbarProzent} min={0} max={100} suffix="%" onAendern={(n) => setze({ verfuegbarProzent: n }, 'anteil')} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="knopf-icon"
                        aria-label={`Rolle ${r.name || i + 1} entfernen`}
                        title="Entfernen"
                        onClick={() => {
                          if (anzahl > 0 && !window.confirm(`„${r.name}“ hat ${anzahl} Aufgaben. Diese haben danach keine Rolle mehr. Entfernen?`)) return
                          aendere(entferneRolle(p, r.id))
                        }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <button type="button" className="knopf" onClick={() => aendere({ ...p, rollen: [...p.rollen, neueRolle('')] })}>
          + Rolle
        </button>
      </section>

      <section aria-labelledby="medien-titel">
        <h3 id="medien-titel">Systeme und Arbeitsmittel</h3>
        <p className="leise">Papier und Telefon gelten als nicht digital. Wechsel zwischen Systemen zeigen, wo Daten abgetippt werden.</p>
        {p.medien.length === 0 && <p className="leer-hinweis">Noch kein System. Typisch sind Papier, Telefon, E-Mail, Excel und ein ERP-System.</p>}
        <div className="tabelle-wrap">
          <table className="eingabe-tabelle">
            {p.medien.length > 0 && (
              <thead>
                <tr>
                  <th scope="col">System</th>
                  <th scope="col">Art</th>
                  <th scope="col">
                    <span className="sr">Entfernen</span>
                  </th>
                </tr>
              </thead>
            )}
            <tbody>
              {p.medien.map((m, i) => (
                <tr key={m.id}>
                  <td>
                    <input
                      type="text"
                      aria-label={`Name des Systems ${i + 1}`}
                      value={m.name}
                      placeholder="z. B. Warenwirtschaft"
                      onChange={(e) => aendere({ ...p, medien: p.medien.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)) }, { gruppe: `medium:${m.id}` })}
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`Art von ${m.name || `System ${i + 1}`}`}
                      value={m.art}
                      onChange={(e) => aendere({ ...p, medien: p.medien.map((x) => (x.id === m.id ? { ...x, art: e.target.value as MediumArt } : x)) })}
                    >
                      {MEDIUM_ARTEN.map((a) => (
                        <option key={a.art} value={a.art}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button type="button" className="knopf-icon" aria-label={`System ${m.name || i + 1} entfernen`} title="Entfernen" onClick={() => aendere(entferneMedium(p, m.id))}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="knopfreihe">
          <button type="button" className="knopf" onClick={() => aendere({ ...p, medien: [...p.medien, neuesMedium('', 'fachanwendung')] })}>
            + System
          </button>
          {p.medien.length === 0 && (
            <button
              type="button"
              className="knopf knopf-leise"
              onClick={() =>
                aendere({
                  ...p,
                  medien: [neuesMedium('Papier', 'papier'), neuesMedium('Telefon', 'telefon'), neuesMedium('E-Mail', 'email'), neuesMedium('Excel', 'tabelle'), neuesMedium('ERP-System', 'erp')],
                })
              }
            >
              Typische Auswahl übernehmen
            </button>
          )}
        </div>
      </section>

      <div className="schritt-fuss">
        <button type="button" className="knopf knopf-haupt" onClick={() => dispatch({ typ: 'schritt', schritt: 'ablauf' })}>
          Weiter: Ablauf beschreiben
        </button>
      </div>
    </div>
  )
}
