import { ablageVon, datenImSystem, digital, hatPersonenbezug, mitDienstleister, objektName, systemAngaben, systemeImEinsatz } from '../../compliance/ableitung'
import { AV_VERTRAEGE, BETRIEBE, GARANTIEN, SICHERUNGEN, STANDORTE, UNVERAENDERBARKEIT } from '../../compliance/standard'
import type { SystemAngaben } from '../../compliance/typen'
import { aendereAblageort, loescheAblageort } from '../../compliance/unterlagen'
import { MEDIUM_ARTEN, type Medium } from '../../modell/typen'
import { useBestaetigen } from '../frage'
import { Kreuz } from '../Symbol'
import { useCompliance } from './analyse'
import { CFeld, DatumEingabe, DatumFeld, JaNeinOffen, KatalogAuswahl, KatalogListe, TextFeld } from './Eingaben'

export function SystemeTeil() {
  const { c, k, ist, aendere } = useCompliance()
  const bestaetige = useBestaetigen()
  const systeme = systemeImEinsatz(k)
  const ohneTechnik = ist.medien.filter((m) => !digital(m))
  const genutzt = (ablageortId: string) => k.sicht.objekte.filter((o) => (c.datenobjekte[o.id]?.ablageSpeicherIds ?? []).includes(ablageortId)).length

  return (
    <div className="teil">
      <section aria-labelledby="systeme-titel" className="felder">
        <h3 id="systeme-titel">Systeme und Dienstleister</h3>
        {systeme.length === 0 && (
          <p className="leer-hinweis">Im Prozess wird kein digitales System genutzt. Systeme legst du im Schritt „Beteiligte“ an und ordnest sie im Schritt „Ablauf“ den Aufgaben zu.</p>
        )}
        {systeme.map((m) => (
          <SystemKarte key={m.id} m={m} />
        ))}
      </section>

      <section aria-labelledby="ablageorte-titel" className="felder">
        <h3 id="ablageorte-titel">Ablageorte</h3>
        <p className="leise">Wo Unterlagen aufbewahrt werden, z. B. ein Archiv im Dokumentenmanagementsystem (DMS) oder ein Ordner im Büro. Angelegt werden sie bei den Belegen.</p>
        {c.ablageorte.length === 0 ? (
          <p className="leer-hinweis">Noch kein Ablageort.</p>
        ) : (
          <div className="tabelle-wrap">
            <table className="eingabe-tabelle">
              <thead>
                <tr>
                  <th scope="col">Ablageort</th>
                  <th scope="col">System</th>
                  <th scope="col">Unterlagen</th>
                  <th scope="col">
                    <span className="sr">Entfernen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {c.ablageorte.map((a, i) => (
                  <tr key={a.id}>
                    <td>
                      <input type="text" aria-label={`Name des Ablageorts ${i + 1}`} value={a.name} onChange={(e) => aendere((x) => aendereAblageort(x, a.id, { name: e.target.value }), `ablageort.${a.id}.name`)} />
                    </td>
                    <td>
                      <select aria-label={`System von ${a.name || `Ablageort ${i + 1}`}`} value={a.mediumId ?? ''} onChange={(e) => aendere((x) => aendereAblageort(x, a.id, { mediumId: e.target.value || null }))}>
                        <option value="">noch offen</option>
                        {ist.medien.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name.trim() || 'Unbenanntes System'}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{genutzt(a.id)}</td>
                    <td>
                      <button
                        type="button"
                        className="knopf-icon"
                        aria-label={`Ablageort ${a.name || i + 1} entfernen`}
                        title="Entfernen"
                        onClick={async () => {
                          const n = genutzt(a.id)
                          const name = a.name.trim() || 'Unbenannter Ablageort'
                          const text = n === 1 ? `„${name}“ ist Ablageort für 1 Unterlage. Bei ihr fällt dieser Ablageort weg.` : `„${name}“ ist Ablageort für ${n} Unterlagen. Bei ihnen fällt dieser Ablageort weg.`
                          if (n > 0 && !(await bestaetige('Ablageort entfernen?', text, 'Entfernen'))) return
                          aendere((x) => loescheAblageort(x, a.id))
                        }}
                      >
                        <Kreuz />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {ohneTechnik.length > 0 && (
        <section aria-labelledby="papier-titel" className="felder">
          <h3 id="papier-titel">Papier und Telefon</h3>
          <ul className="liste-schlicht">
            {ohneTechnik.map((m) => {
              const orte = c.ablageorte.filter((a) => a.mediumId === m.id).map((a) => a.name.trim() || 'Unbenannter Ablageort')
              return (
                <li key={m.id}>
                  <strong>{m.name.trim() || 'Unbenannt'}</strong>: {orte.length > 0 ? `Ablage in ${orte.join(', ')}` : 'keine Ablage'}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function SystemKarte({ m }: { m: Medium }) {
  const { c, k, aendere } = useCompliance()
  const s = systemAngaben(c, m.id)
  const name = m.name.trim() || 'Unbenanntes System'
  const setze = (werte: Partial<SystemAngaben>, feld: string) => aendere((x) => ({ ...x, systeme: { ...x.systeme, [m.id]: { ...systemAngaben(x, m.id), ...werte } } }), `system.${m.id}.${feld}`)
  const daten = datenImSystem(k, m.id).map((id) => objektName(k, id))
  const ablage = ablageVon(k, m.id).map((id) => objektName(k, id))
  const personen = hatPersonenbezug(k, m.id)
  const titelId = `system-${m.id}-titel`
  // Sprungziele für „Beheben“: die Karte und je Frage ein Feld
  const ziel = `ziel-system-${m.id}`

  return (
    <section className="karte felder" id={ziel} tabIndex={-1} aria-labelledby={titelId}>
      <div className="teil-kopf">
        <h4 id={titelId}>{name}</h4>
        <span className="leise klein">{MEDIUM_ARTEN.find((a) => a.art === m.art)?.name}</span>
      </div>
      <p className="leise klein">
        Verarbeitet: {daten.join(', ') || '–'} · Bewahrt auf: {ablage.join(', ') || '–'}
      </p>
      <div className="feldreihe">
        <TextFeld label="Hersteller" wert={s.hersteller} onAendern={(hersteller) => setze({ hersteller }, 'hersteller')} />
        <TextFeld id={`${ziel}-version`} label="Version" wert={s.version} onAendern={(version) => setze({ version }, 'version')} />
      </div>
      <DatumFeld id={`${ziel}-seit`} label="Im Einsatz seit" wert={s.seit} onAendern={(seit) => setze({ seit }, 'seit')} />
      <KatalogAuswahl id={`${ziel}-betrieb`} label="Wo läuft das System?" katalog={BETRIEBE} wert={s.betrieb} spalten={3} onAendern={(betrieb) => setze({ betrieb }, 'betrieb')} />
      {(s.betrieb === 'cloud' || s.betrieb === 'eigener_server') && (
        <TextFeld label="Wer betreibt es?" platzhalter="Name des Dienstleisters" wert={s.dienstleister} onAendern={(dienstleister) => setze({ dienstleister }, 'dienstleister')} />
      )}
      {mitDienstleister(s) && (
        <>
          <KatalogListe id={`${ziel}-standort`} label="Wo werden die Daten verarbeitet?" katalog={STANDORTE} wert={s.standort} onAendern={(standort) => standort && setze({ standort }, 'standort')} />
          {s.standort === 'drittland' && (
            <div className="feldreihe">
              <TextFeld label="Land" wert={s.drittland} onAendern={(drittland) => setze({ drittland }, 'drittland')} />
              <KatalogListe
                id={`${ziel}-garantie`}
                label="Absicherung der Übermittlung"
                hilfe="Steht im Vertrag zur Auftragsverarbeitung oder in den Datenschutzhinweisen des Anbieters; frag im Zweifel nach."
                katalog={GARANTIEN}
                wert={s.garantie}
                onAendern={(garantie) => setze({ garantie }, 'garantie')}
              />
            </div>
          )}
          {s.standort === 'drittland' && ablage.length > 0 && (
            <CFeld id={`${ziel}-bewilligung`} label="Bewilligung des Finanzamts vom" hilfe="Nötig, weil hier aufbewahrungspflichtige Unterlagen außerhalb der EU liegen (§ 146 Abs. 2b AO, § 14b Abs. 5 UStG).">
              {(fid) => <DatumEingabe id={fid} wert={s.bewilligungVom ?? null} onAendern={(bewilligungVom) => setze({ bewilligungVom }, 'bewilligung')} />}
            </CFeld>
          )}
          {personen && (
            <>
              <JaNeinOffen id={`${ziel}-av`} label="Verarbeitet der Anbieter personenbezogene Daten im Auftrag des Unternehmens?" wert={s.auftragsverarbeitung} onAendern={(auftragsverarbeitung) => setze({ auftragsverarbeitung }, 'av')} />
              {s.auftragsverarbeitung !== false && (
                <>
                  <KatalogAuswahl id={`${ziel}-avvertrag`} label="Gibt es einen Vertrag zur Auftragsverarbeitung?" katalog={AV_VERTRAEGE} wert={s.avVertrag} spalten={3} onAendern={(avVertrag) => setze({ avVertrag }, 'avVertrag')} />
                  {s.avVertrag === 'ja' && <DatumFeld id={`${ziel}-avvom`} label="Vertrag vom" wert={s.avVertragVom} onAendern={(avVertragVom) => setze({ avVertragVom }, 'avVom')} />}
                </>
              )}
            </>
          )}
        </>
      )}
      {ablage.length > 0 && (
        <KatalogAuswahl id={`${ziel}-unveraenderbar`} label="Wie sind aufbewahrte Unterlagen vor Änderung geschützt?" katalog={UNVERAENDERBARKEIT} wert={s.unveraenderbarkeit} spalten={2} onAendern={(unveraenderbarkeit) => setze({ unveraenderbarkeit }, 'unveraenderbar')} />
      )}
      {ablage.length > 0 && (
        <>
          <TextFeld
            id={`${ziel}-wiederfinden`}
            label="Wie findet man eine Unterlage wieder?"
            platzhalter="z. B. Suche nach Rechnungs- oder Kundennummer"
            hilfe="Ordnungsmerkmal, über das jede aufbewahrte Unterlage eindeutig zu finden ist."
            wert={s.wiederfinden ?? ''}
            onAendern={(wiederfinden) => setze({ wiederfinden }, 'wiederfinden')}
          />
          <TextFeld
            id={`${ziel}-datenzugriff`}
            label="Wie bekommt die Finanzverwaltung bei einer Außenprüfung Zugriff auf die Daten, auch nach Vertragsende oder Systemwechsel?"
            mehrzeilig
            platzhalter="z. B. Export aller Belege und Buchungsdaten als CSV und PDF"
            hilfe="Etwa Einsicht im System, Auswertung nach Vorgaben der Prüfer oder Übergabe in einem maschinell auswertbaren Format (§ 147 Abs. 6 AO)."
            wert={s.datenzugriff ?? ''}
            onAendern={(datenzugriff) => setze({ datenzugriff }, 'datenzugriff')}
          />
        </>
      )}
      <KatalogAuswahl id={`${ziel}-sicherung`} label="Wie werden die Daten gesichert?" katalog={SICHERUNGEN} wert={s.sicherung} spalten={3} onAendern={(sicherung) => setze({ sicherung }, 'sicherung')} />
      {(s.sicherung === 'manuell' || s.sicherung === 'automatisch' || s.sicherung === 'anbieter') && (
        <div className="feldreihe">
          <TextFeld label="Wie oft?" platzhalter="z. B. täglich" wert={s.sicherungIntervall} onAendern={(sicherungIntervall) => setze({ sicherungIntervall }, 'intervall')} />
          <DatumFeld id={`${ziel}-getestet`} label="Rücksicherung zuletzt getestet am" wert={s.wiederherstellungGetestet} onAendern={(wiederherstellungGetestet) => setze({ wiederherstellungGetestet }, 'getestet')} />
        </div>
      )}
      <TextFeld label="Zugriffsschutz" platzhalter="z. B. eigenes Konto je Person, Zwei-Faktor-Anmeldung" wert={s.zugriffsschutz} onAendern={(zugriffsschutz) => setze({ zugriffsschutz }, 'zugriff')} />
    </section>
  )
}
