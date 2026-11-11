import { angaben } from '../../compliance/ableitung'
import { formatiereDatum, jahrVon } from '../../compliance/datum'
import { fristEnde, laengerAlsVorgeschrieben, mindestJahre, vernichtungAb, wirksameJahre } from '../../compliance/fristen'
import { AUFBEWAHRUNGSARTEN, FRIST_BEGINNE, istPflichtig, LOESCH_TURNUS, neueFrist, textVon, ZEITEINHEITEN } from '../../compliance/standard'
import type { DatenobjektAngaben, Frist, IsoDatum } from '../../compliance/typen'
import { unterlagenNachEntstehung } from '../../compliance/verfahrensdoku'
import type { Id } from '../../modell/typen'
import { ZahlEingabe } from '../Eingaben'
import { useCompliance } from './analyse'
import { CFeld, KatalogAuswahl, KatalogListe, OptionaleZahl, TextFeld } from './Eingaben'

function gesetzlich(d: DatenobjektAngaben): string {
  const n = mindestJahre(d.aufbewahrungsart)
  if (n !== null) return `${n} Jahre`
  if (d.aufbewahrungsart === 'lieferschein') return 'bis zur Rechnung'
  return d.aufbewahrungsart === 'keine' ? 'keine' : 'offen'
}

/** Frühestes Löschdatum für eine Unterlage, die heute entsteht. */
function fruehestens(d: DatenobjektAngaben, heute: IsoDatum): string {
  const n = wirksameJahre(d)
  if (n !== null) return formatiereDatum(vernichtungAb(jahrVon(heute), n))
  if (d.aufbewahrungsart === 'lieferschein') return 'nach der Rechnung'
  if (d.aufbewahrungsart === 'keine' && d.loeschfrist) {
    const ende = fristEnde(heute, d.loeschfrist)
    return ende ? formatiereDatum(ende) : `nach „${d.loeschfrist.ereignis.trim() || 'Ereignis'}“`
  }
  return 'offen'
}

export function FristenTeil() {
  const { c, k, heute, aendere } = useCompliance()
  const objekte = unterlagenNachEntstehung(k)
  const setze = (id: Id, werte: Partial<DatenobjektAngaben>, feld: string) => aendere((x) => ({ ...x, datenobjekte: { ...x.datenobjekte, [id]: { ...angaben(x, id), ...werte } } }), `datenobjekt.${id}.${feld}`)
  const setzeFrist = (id: Id, f: Frist | null, feld: string) => setze(id, { loeschfrist: f }, `frist.${feld}`)
  const pflichtig = objekte.filter((o) => istPflichtig(o.d.aufbewahrungsart))
  const loeschen = objekte.filter((o) => o.d.aufbewahrungsart === 'keine' && o.d.personenbezogen === true)
  const laenger = objekte.some((o) => laengerAlsVorgeschrieben(o.d))
  const l = c.loeschung

  return (
    <div className="teil">
      <section aria-labelledby="fristen-titel" className="felder">
        <h3 id="fristen-titel">Aufbewahrung</h3>
        {objekte.length === 0 ? (
          <p className="leer-hinweis">Noch keine Unterlagen. Lege sie im Teilschritt „Belege und Daten“ an.</p>
        ) : (
          <div className="tabelle-wrap">
            <table className="eingabe-tabelle fristen-tabelle">
              <thead>
                <tr>
                  <th scope="col">Unterlage</th>
                  <th scope="col">Einordnung</th>
                  <th scope="col">Gesetzlich</th>
                  <th scope="col">Gewählt (Jahre)</th>
                  <th scope="col">Frühestens löschen bei Entstehung {jahrVon(heute)}</th>
                </tr>
              </thead>
              <tbody>
                {objekte.map((o) => (
                  <tr key={o.id}>
                    <th scope="row">{o.name}</th>
                    <td>{textVon(AUFBEWAHRUNGSARTEN, o.d.aufbewahrungsart, 'dok')}</td>
                    <td>{gesetzlich(o.d)}</td>
                    <td>
                      {istPflichtig(o.d.aufbewahrungsart) ? (
                        <OptionaleZahl id={`ziel-frist-${o.id}`} ariaLabel={`Gewählte Frist für ${o.name} in Jahren, leer heißt gesetzlich`} wert={o.d.aufbewahrungJahre} max={30} onAendern={(aufbewahrungJahre) => setze(o.id, { aufbewahrungJahre }, 'jahre')} />
                      ) : (
                        '–'
                      )}
                    </td>
                    <td>{fruehestens(o.d, heute)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pflichtig.length > 0 && (
          <div className="felder">
            <div className="knopfreihe">
              <button
                type="button"
                className="knopf"
                onClick={() =>
                  aendere((x) => {
                    const datenobjekte = { ...x.datenobjekte }
                    for (const u of x.unterlagen) {
                      const d = angaben(x, u.id)
                      if (istPflichtig(d.aufbewahrungsart) && (wirksameJahre(d) ?? 0) < 10) datenobjekte[u.id] = { ...d, aufbewahrungJahre: 10 }
                    }
                    return { ...x, datenobjekte }
                  })
                }
              >
                Alle aufbewahrungspflichtigen Unterlagen einheitlich 10 Jahre
              </button>
            </div>
            <p className="feld-hilfe">Das Muster von BStBK und DStV empfiehlt einheitlich mindestens 10 Jahre. Werden dabei personenbezogene Daten länger aufbewahrt als vorgeschrieben, braucht es eine Begründung.</p>
          </div>
        )}
        {laenger && (
          <TextFeld
            id="ziel-begruendung"
            label="Begründung für die längere Aufbewahrung"
            mehrzeilig
            wert={c.begruendungLaengereAufbewahrung}
            onAendern={(begruendungLaengereAufbewahrung) => aendere((x) => ({ ...x, begruendungLaengereAufbewahrung }), 'begruendung')}
          />
        )}
      </section>

      <section aria-labelledby="loeschfristen-titel" className="felder">
        <h3 id="loeschfristen-titel">Löschfristen</h3>
        <p className="leise">Für personenbezogene Daten ohne Aufbewahrungspflicht. Ein allgemeiner Verweis genügt nicht; die Frist muss konkret sein.</p>
        {loeschen.length === 0 && <p className="leer-hinweis">Keine personenbezogenen Unterlagen ohne Aufbewahrungspflicht.</p>}
        {loeschen.map((o) => {
          const f = o.d.loeschfrist
          return (
            <fieldset key={o.id} className="karte felder" id={`ziel-frist-${o.id}`} tabIndex={-1}>
              <legend>{o.name}</legend>
              {f === null ? (
                <button type="button" className="knopf knopf-klein" onClick={() => setzeFrist(o.id, neueFrist(), 'neu')}>
                  Löschfrist festlegen
                </button>
              ) : (
                <>
                  <div className="feldreihe">
                    <CFeld label="Anzahl">{(id) => <ZahlEingabe id={id} wert={f.anzahl} min={0} max={100} nachkomma={0} onAendern={(n) => setzeFrist(o.id, { ...f, anzahl: Math.round(n) }, 'anzahl')} />}</CFeld>
                    <KatalogListe label="Einheit" katalog={ZEITEINHEITEN} wert={f.einheit} onAendern={(einheit) => einheit && setzeFrist(o.id, { ...f, einheit }, 'einheit')} />
                  </div>
                  <KatalogAuswahl label="Ab wann?" katalog={FRIST_BEGINNE} wert={f.beginn} spalten={3} onAendern={(beginn) => setzeFrist(o.id, { ...f, beginn }, 'beginn')} />
                  {f.beginn === 'ereignis' && <TextFeld label="Nach welchem Ereignis?" platzhalter="z. B. Ende der Kundenbeziehung" wert={f.ereignis} onAendern={(ereignis) => setzeFrist(o.id, { ...f, ereignis }, 'ereignis')} />}
                  <button type="button" className="knopf knopf-klein knopf-leise" onClick={() => setzeFrist(o.id, null, 'weg')}>
                    Löschfrist entfernen
                  </button>
                </>
              )}
            </fieldset>
          )
        })}
      </section>

      <section aria-labelledby="loeschung-titel" className="felder">
        <h3 id="loeschung-titel">Löschorganisation</h3>
        <div className="feldreihe">
          <TextFeld label="Wer gibt die Löschung nach Fristablauf frei?" wert={l.freigabe} onAendern={(freigabe) => aendere((x) => ({ ...x, loeschung: { ...x.loeschung, freigabe } }), 'loeschung.freigabe')} />
          <TextFeld label="Wer führt sie durch?" wert={l.durchfuehrung} onAendern={(durchfuehrung) => aendere((x) => ({ ...x, loeschung: { ...x.loeschung, durchfuehrung } }), 'loeschung.durchfuehrung')} />
        </div>
        <KatalogAuswahl label="Wie oft wird gelöscht?" katalog={LOESCH_TURNUS} wert={l.turnus} spalten={3} onAendern={(turnus) => aendere((x) => ({ ...x, loeschung: { ...x.loeschung, turnus } }), 'loeschung.turnus')} />
      </section>
    </div>
  )
}
