import { useRef, useState, type RefObject } from 'react'
import { alsJson } from '../../modell/speicher'
import { formatiereDauer, formatiereEuro, formatiereProzent, formatiereZahl } from '../../modell/zeit'
import { useAnalyse, useBpmn, useSimulation } from '../analyse'
import type { DiagrammApi } from '../Diagramm'
import { DiagrammLazy as Diagramm } from '../DiagrammLazy'
import { dateiname, ladeHerunter, vorzeichen } from '../hilfen'
import { useApp } from '../kontext'
import { zaehle } from '../befundtext'
import { StatusSymbol } from './PruefenSchritt'

interface Zeile {
  name: string
  ist: number
  soll: number
  format: (n: number) => string
  /** Format der Veränderung, falls abweichend (z. B. Prozentpunkte) */
  deltaFormat?: (n: number) => string
  /** true, wenn kleinere Werte besser sind */
  kleinerBesser: boolean
}

export function BerichtSchritt() {
  const { z } = useApp()
  const { projekt } = z
  const ist = projekt.ist
  const soll = projekt.soll
  const aIst = useAnalyse(ist)
  const aSoll = useAnalyse(soll ?? ist)
  const simIst = useSimulation(ist)
  const simSoll = useSimulation(soll ?? ist)
  const bpmnIst = useBpmn(ist)
  const bpmnSoll = useBpmn(soll ?? ist)
  const refIst = useRef<DiagrammApi>(null)
  const refSoll = useRef<DiagrammApi>(null)
  const [heute] = useState(() => new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }))
  const std = ist.arbeitsstundenProTag
  const dauer = (n: number) => formatiereDauer(n, std)
  const kI = aIst.kennzahlen
  const kS = aSoll.kennzahlen

  const zeilen: Zeile[] = [
    { name: 'Durchlaufzeit im Schnitt', ist: kI.durchlaufzeitMin, soll: kS.durchlaufzeitMin, format: dauer, kleinerBesser: true },
    { name: '90 % fertig nach (Simulation)', ist: simIst.p90Min, soll: simSoll.p90Min, format: dauer, kleinerBesser: true },
    { name: 'Flusseffizienz', ist: kI.flusseffizienz, soll: kS.flusseffizienz, format: (n) => formatiereProzent(n, 1), deltaFormat: (n) => `${formatiereZahl(n * 100, 1)} Pp.`, kleinerBesser: false },
    { name: 'Arbeitszeit je Vorgang', ist: kI.arbeitszeitMin, soll: kS.arbeitszeitMin, format: dauer, kleinerBesser: true },
    { name: 'Kosten je Vorgang', ist: kI.kostenProVorgang, soll: kS.kostenProVorgang, format: formatiereEuro, kleinerBesser: true },
    { name: 'Kosten pro Arbeitstag', ist: kI.kostenProTag, soll: kS.kostenProTag, format: formatiereEuro, kleinerBesser: true },
    { name: 'Offene Vorgänge (Little)', ist: kI.offeneVorgaenge, soll: kS.offeneVorgaenge, format: (n) => formatiereZahl(n, 0), kleinerBesser: true },
    { name: 'Medienbrüche je Vorgang', ist: kI.medienbrueche, soll: kS.medienbrueche, format: (n) => formatiereZahl(n, 1), kleinerBesser: true },
    { name: 'Übergaben je Vorgang', ist: kI.uebergaben, soll: kS.uebergaben, format: (n) => formatiereZahl(n, 1), kleinerBesser: true },
    { name: 'Höchste Auslastung einer Rolle', ist: kI.engpass?.auslastung ?? 0, soll: kS.engpass?.auslastung ?? 0, format: (n) => formatiereProzent(n), deltaFormat: (n) => `${formatiereZahl(n * 100, 0)} Pp.`, kleinerBesser: true },
  ]

  const svgSpeichern = async (ref: RefObject<DiagrammApi | null>, endung: string) => {
    const svg = await ref.current?.svg()
    if (svg) ladeHerunter(dateiname(ist.name, endung), svg, 'image/svg+xml')
  }

  return (
    <article className="bericht">
      <header className="bericht-kopf">
        <p className="leise">Prozessbericht · {heute}</p>
        <h2>{ist.name || 'Unbenannter Prozess'}</h2>
        {ist.beschreibung && <p>{ist.beschreibung}</p>}
        <p className="leise">
          {formatiereZahl(ist.vorgaengeProTag, 0)} Vorgänge pro Arbeitstag · Arbeitstag mit {formatiereZahl(std)} Stunden · {ist.rollen.length} Rollen
        </p>
      </header>

      <div className="bericht-aktionen knopfreihe">
        <button type="button" className="knopf knopf-haupt" onClick={() => window.print()}>
          Drucken oder als PDF speichern
        </button>
        <button type="button" className="knopf" onClick={() => ladeHerunter(dateiname(ist.name, '.prozesslotse.json'), alsJson(projekt), 'application/json')}>
          Projekt als Datei speichern
        </button>
      </div>

      <section aria-labelledby="bericht-kennzahlen">
        <h3 id="bericht-kennzahlen">Kennzahlen{soll ? ': Ist und Soll' : ''}</h3>
        <div className="tabelle-wrap">
          <table className="bericht-tabelle">
            <thead>
              <tr>
                <th scope="col">Kennzahl</th>
                <th scope="col">Ist</th>
                {soll && <th scope="col">Soll</th>}
                {soll && <th scope="col">Veränderung</th>}
              </tr>
            </thead>
            <tbody>
              {zeilen.map((r) => {
                const d = r.soll - r.ist
                const gleich = Math.abs(d) < 1e-6 * Math.max(1, Math.abs(r.ist))
                const besser = r.kleinerBesser ? d < 0 : d > 0
                return (
                  <tr key={r.name}>
                    <th scope="row">{r.name}</th>
                    <td>{r.format(r.ist)}</td>
                    {soll && <td>{r.format(r.soll)}</td>}
                    {soll && (
                      <td className={gleich ? 'leise' : besser ? 'delta-gut' : 'delta-schlecht'}>
                        {gleich ? 'unverändert' : vorzeichen(d, (r.deltaFormat ?? r.format)(Math.abs(d)))}
                        {!gleich && <span className="sr">{besser ? ' (besser)' : ' (schlechter)'}</span>}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="leise klein">
          Werte sind Erwartungswerte je Vorgang aus den geschätzten Zeiten und Anteilen. Bei „Gleichzeitig“ zählt der Zweig mit der längsten erwarteten Dauer; der 90-%-Wert stammt aus
          einer Simulation mit 4.000 Durchläufen.
        </p>
      </section>

      <section aria-labelledby="bericht-massnahmen">
        <h3 id="bericht-massnahmen">Maßnahmen</h3>
        {projekt.massnahmen.length === 0 ? (
          <p className="leer-hinweis">Noch keine Maßnahme übernommen. Vorschläge gibt es im Schritt „Verbessern“.</p>
        ) : (
          <ol className="bericht-massnahmen">
            {projekt.massnahmen.map((m) => (
              <li key={m.schluessel}>
                <strong>{m.titel}</strong>
                <p>{m.begruendung}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="bericht-befunde">
        <h3 id="bericht-befunde">Befunde im Ist-Prozess</h3>
        <p className="leise">{zaehle(aIst.befunde)}</p>
        <ul className="befunde befunde-kompakt">
          {aIst.befunde
            .filter((b) => b.schwere !== 'hinweis' || ['freigabe', 'nacharbeit', 'pingpong', 'flusseffizienz'].includes(b.schluessel.split(':')[0]))
            .map((b) => (
              <li key={b.schluessel} className={`befund befund-${b.schwere}`}>
                <StatusSymbol art={b.schwere} />
                <div className="befund-text">
                  <strong>{b.titel}</strong>
                  <p>{b.text}</p>
                </div>
              </li>
            ))}
        </ul>
      </section>

      <section className="bericht-diagramm" aria-labelledby="bericht-ist">
        <div className="bericht-diagramm-kopf">
          <h3 id="bericht-ist">Ist-Prozess</h3>
          <div className="knopfreihe">
            <button type="button" className="knopf knopf-klein" onClick={() => ladeHerunter(dateiname(ist.name, '-ist.bpmn'), bpmnIst.xml, 'application/xml')}>
              BPMN-Datei
            </button>
            <button type="button" className="knopf knopf-klein" onClick={() => void svgSpeichern(refIst, '-ist.svg')}>
              SVG-Bild
            </button>
          </div>
        </div>
        <Diagramm ref={refIst} xml={bpmnIst.xml} klein uebersicht beschriftung={`BPMN-Diagramm des Ist-Prozesses ${ist.name}`} />
      </section>

      {soll && (
        <section className="bericht-diagramm" aria-labelledby="bericht-soll">
          <div className="bericht-diagramm-kopf">
            <h3 id="bericht-soll">Soll-Prozess</h3>
            <div className="knopfreihe">
              <button type="button" className="knopf knopf-klein" onClick={() => ladeHerunter(dateiname(ist.name, '-soll.bpmn'), bpmnSoll.xml, 'application/xml')}>
                BPMN-Datei
              </button>
              <button type="button" className="knopf knopf-klein" onClick={() => void svgSpeichern(refSoll, '-soll.svg')}>
                SVG-Bild
              </button>
            </div>
          </div>
          <Diagramm ref={refSoll} xml={bpmnSoll.xml} klein uebersicht beschriftung={`BPMN-Diagramm des Soll-Prozesses ${ist.name}`} />
        </section>
      )}

      <section aria-labelledby="bericht-methode">
        <h3 id="bericht-methode">Methode</h3>
        <ul className="methode">
          <li>Der Prozess ist blockstrukturiert modelliert; Verklemmungen und unerreichbare Schritte sind dadurch ausgeschlossen.</li>
          <li>Häufigkeiten folgen aus den Anteilen der Entscheidungen; eine Wiederholung mit Anteil p läuft im Schnitt 1 / (1 − p)-mal.</li>
          <li>Flusseffizienz = Bearbeitungszeit auf dem zeitbestimmenden Pfad / Durchlaufzeit. Offene Vorgänge = Vorgänge pro Tag × Durchlaufzeit in Tagen (Gesetz von Little).</li>
          <li>Vorschläge folgen Redesign-Heuristiken; ihre Wirkung ist durch Neuberechnung des umgeformten Prozesses ermittelt. Annahmen stehen bei der jeweiligen Maßnahme.</li>
        </ul>
      </section>
    </article>
  )
}
