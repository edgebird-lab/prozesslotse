import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { formatiereDatum } from '../../compliance/datum'
import { docxEndung, erzeugeDocx } from '../../compliance/docx'
import { aufbewahrenBisText, gueltigBisIn } from '../../compliance/fristen'
import { RECHTSSTAND } from '../../compliance/standard'
import { FUSSZEILE_VORLAGE, hinweisband } from '../../compliance/textbausteine'
import type { Dokument, DokumentArt, DokuVersion } from '../../compliance/typen'
import { entwurfsKontext, erzeugeDokumente, geaenderteKapitel } from '../../compliance/versionen'
import { plattform } from '../../plattform'
import { dateiname } from '../hilfen'
import { useApp } from '../kontext'
import { useCompliance } from './analyse'
import { DokumentAnsicht } from './DokumentAnsicht'
import { FreigabeDialog } from './FreigabeDialog'
import { MitgeltendeListe } from './MitgeltendeListe'

const REITER: { art: DokumentArt; name: string }[] = [
  { art: 'verfahrensdokumentation', name: 'Verfahrensdokumentation' },
  { art: 'verarbeitungsverzeichnis', name: 'Verarbeitungsverzeichnis' },
]

/** Fußzeile auf jeder gedruckten Seite: CSS-Randfeld der Seite, damit sie keinen Text verdeckt. */
function druckFuss(d: Dokument): string {
  const text = `${FUSSZEILE_VORLAGE} · ${d.titel} · ${d.versionText === 'Entwurf' ? 'Entwurf' : `Version ${d.versionText}`} · Seite `.replace(/["\\]/g, '\\$&')
  return `@media print { @page { margin-bottom: 18mm; @bottom-center { content: "${text}" counter(page) " von " counter(pages); font: 8pt system-ui, sans-serif; color: #52514e; } } }`
}

export function DokumenteTeil() {
  const { c, ist, heute, befunde, aendere } = useCompliance()
  const { melde, datei } = useApp()
  const [art, setArt] = useState<DokumentArt>('verfahrensdokumentation')
  const [ansicht, setAnsicht] = useState<number | null>(null)
  const [freigabe, setFreigabe] = useState(false)
  const reiter = useRef<(HTMLButtonElement | null)[]>([])
  const freigabeKnopf = useRef<HTMLButtonElement>(null)
  // Nach dem Dialog zurück auf den Knopf, der ihn geöffnet hat
  const schliesseFreigabe = () => {
    setFreigabe(false)
    requestAnimationFrame(() => freigabeKnopf.current?.focus())
  }
  const entwurf = useMemo(() => erzeugeDokumente(ist, c, entwurfsKontext(c, heute)), [ist, c, heute])
  const letzte = c.versionen[c.versionen.length - 1] ?? null
  const geaendert = useMemo(() => (letzte ? geaenderteKapitel(letzte, ist, c) : []), [letzte, ist, c])
  // Ohne Änderung seit der letzten Freigabe zeigt die Vorschau die freigegebene Version, sonst den Entwurf
  const version = ansicht !== null ? (c.versionen.find((v) => v.nummer === ansicht) ?? null) : letzte && geaendert.length === 0 ? letzte : null
  const dokumente = version ?? entwurf
  const dokument = art === 'verfahrensdokumentation' ? dokumente.verfahrensdoku : dokumente.verzeichnis
  const gueltig = [...c.versionen].reverse().find((v) => v.gueltigAb <= heute) ?? null
  const fehler = befunde.filter((b) => b.schwere === 'fehler').length

  // Nach dem Drucken den Fenstertitel zurücksetzen
  const alterTitel = useRef<string | null>(null)
  useEffect(() => {
    const zurueck = () => {
      if (alterTitel.current !== null) document.title = alterTitel.current
      alterTitel.current = null
    }
    window.addEventListener('afterprint', zurueck)
    return () => window.removeEventListener('afterprint', zurueck)
  }, [])

  /** Dateiname des Dokuments ohne Endung, z. B. „…-verfahrensdokumentation-v1-0“ */
  const basis = (d: Dokument) => dateiname(ist.name, docxEndung(d).replace(/\.docx$/, ''))

  const drucken = () => {
    alterTitel.current = document.title
    // „Als PDF speichern“ schlägt den Fenstertitel als Dateinamen vor
    document.title = basis(dokument)
    window.print()
  }

  // Nur im Programm: PDF ohne Druckdialog (WebView2, A4); es gilt dieselbe Druck-CSS wie beim Drucken
  const pdf = () =>
    void plattform
      .alsPdf(`${basis(dokument)}.pdf`)
      .then((ok) => ok && melde('PDF gespeichert.'))
      .catch((err: unknown) => melde(`PDF nicht gespeichert: ${err instanceof Error ? err.message : String(err)}`))

  const docx = async (d: Dokument) => {
    let bytes: Uint8Array
    try {
      bytes = await erzeugeDocx(d)
    } catch (err) {
      return melde(`Word-Datei nicht erstellt: ${err instanceof Error ? err.message : String(err)}`)
    }
    try {
      // Browser: Download; Programm: Speichern-Dialog, die Bytes gehen als Rohdaten an den Rust-Teil
      const r = await plattform.speichereBytes(`${basis(d)}.docx`, bytes, 'docx')
      if (r && plattform.desktop) melde(`„${r.name}“ gespeichert.`)
    } catch (err) {
      melde(`Word-Datei nicht gespeichert: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const tasten = (e: KeyboardEvent, i: number) => {
    const ziel = e.key === 'ArrowRight' ? (i + 1) % REITER.length : e.key === 'ArrowLeft' ? (i + REITER.length - 1) % REITER.length : e.key === 'Home' ? 0 : e.key === 'End' ? REITER.length - 1 : -1
    if (ziel < 0) return
    e.preventDefault()
    setArt(REITER[ziel].art)
    reiter.current[ziel]?.focus()
  }

  return (
    <div className="teil dokumente">
      <style>{druckFuss(dokument)}</style>
      <p className="status-zeile">
        {letzte === null
          ? 'Entwurf, nicht freigegeben'
          : gueltig
            ? `Gültige Version ${gueltig.bezeichnung} seit ${formatiereDatum(gueltig.gueltigAb)}`
            : `Version ${letzte.bezeichnung} gilt ab ${formatiereDatum(letzte.gueltigAb)}`}
        {letzte && gueltig && letzte !== gueltig && ` · Version ${letzte.bezeichnung} gilt ab ${formatiereDatum(letzte.gueltigAb)}`}
        {geaendert.length > 0 && ` · geändert seit der Freigabe: ${geaendert.join(', ')}`}
      </p>
      <p className="hinweis-band" role="note">
        {hinweisband(RECHTSSTAND)} Die Dokumente nennen Schutzmaßnahmen und Lücken. Vertraulich behandeln.
      </p>

      <div className="knopfreihe dokumente-aktionen">
        <button type="button" className="knopf knopf-haupt" onClick={drucken}>
          {plattform.desktop ? 'Drucken' : 'Drucken oder als PDF speichern'}
        </button>
        {plattform.desktop && (
          <button type="button" className="knopf" onClick={pdf}>
            Als PDF speichern
          </button>
        )}
        <button type="button" className="knopf" onClick={() => void docx(dokument)}>
          Als Word-Datei (DOCX)
        </button>
        <button type="button" className="knopf" onClick={() => void datei.exportiereBpmn('ist', { ohneCompliance: true })}>
          BPMN-Datei ohne Compliance-Angaben
        </button>
        <button type="button" className="knopf" id="ziel-version" ref={freigabeKnopf} onClick={() => setFreigabe(true)}>
          Version freigeben …
        </button>
        {letzte && geaendert.length === 0 && (
          <button
            type="button"
            className="knopf knopf-leise"
            onClick={() => {
              aendere((x) => ({ ...x, zuletztGeprueft: heute }))
              melde(`Als geprüft vermerkt am ${formatiereDatum(heute)}.`)
            }}
          >
            Geprüft, keine Änderung
          </button>
        )}
      </div>

      <Versionsliste versionen={c.versionen} ansicht={ansicht} onAnsehen={setAnsicht} onDocx={(v) => void docx(art === 'verfahrensdokumentation' ? v.verfahrensdoku : v.verzeichnis)} art={art} />

      <MitgeltendeListe />

      <div className="reiter" role="tablist" aria-label="Dokument">
        {REITER.map((r, i) => (
          <button
            key={r.art}
            ref={(el) => {
              reiter.current[i] = el
            }}
            type="button"
            role="tab"
            id={`reiter-${r.art}`}
            aria-selected={art === r.art}
            aria-controls="dokument-vorschau"
            tabIndex={art === r.art ? 0 : -1}
            onClick={() => setArt(r.art)}
            onKeyDown={(e) => tasten(e, i)}
          >
            {r.name}
          </button>
        ))}
      </div>

      {version && ansicht !== null && (
        <div className="banner banner-hinweis version-banner">
          <p>
            Version {version.bezeichnung}, gültig ab {formatiereDatum(version.gueltigAb)}, freigegeben am {formatiereDatum(version.freigegebenAm)} von {version.freigegebenVon} · Prüfsumme{' '}
            <code>{version.pruefsumme.slice(0, 12)}</code>
          </p>
          <button type="button" className="knopf knopf-klein" onClick={() => setAnsicht(null)}>
            Zurück zum aktuellen Entwurf
          </button>
        </div>
      )}

      <p className="leise klein vorschau-zeile">
        Vorschau: {version ? `Version ${version.bezeichnung}, freigegeben am ${formatiereDatum(version.freigegebenAm)}` : 'Entwurf mit dem aktuellen Stand'}
      </p>
      <div id="dokument-vorschau" role="tabpanel" aria-labelledby={`reiter-${art}`} className="dokument-bereich">
        <DokumentAnsicht dokument={dokument} prozess={version ? version.prozess : ist} />
      </div>

      {freigabe && (
        <FreigabeDialog
          c={c}
          ist={ist}
          heute={heute}
          fehler={fehler}
          geaendert={geaendert}
          onSchliessen={schliesseFreigabe}
          onFreigegeben={(v) => {
            schliesseFreigabe()
            setAnsicht(null)
            aendere((x) => (x.versionen.length === v.nummer - 1 ? { ...x, versionen: [...x.versionen, v] } : x))
            melde(`Version ${v.bezeichnung} freigegeben, gültig ab ${formatiereDatum(v.gueltigAb)}.`)
          }}
        />
      )}
    </div>
  )
}

function Versionsliste({ versionen, ansicht, onAnsehen, onDocx, art }: { versionen: DokuVersion[]; ansicht: number | null; onAnsehen: (n: number) => void; onDocx: (v: DokuVersion) => void; art: DokumentArt }) {
  return (
    <section aria-labelledby="versionen-titel" className="versionsliste">
      <h3 id="versionen-titel">Versionen</h3>
      {versionen.length === 0 ? (
        <p className="leer-hinweis">Noch keine Version freigegeben.</p>
      ) : (
        <div className="tabelle-wrap">
          <table className="bericht-tabelle">
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">gültig ab</th>
                <th scope="col">gültig bis</th>
                <th scope="col">freigegeben</th>
                <th scope="col">geänderte Kapitel</th>
                <th scope="col">aufbewahren</th>
                <th scope="col">Prüfsumme</th>
                <th scope="col">
                  <span className="sr">Aktionen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {versionen.map((v, i) => {
                const bis = gueltigBisIn(versionen, i)
                return (
                  <tr key={v.nummer} aria-current={ansicht === v.nummer ? 'true' : undefined}>
                    <th scope="row">{v.bezeichnung}</th>
                    <td>{formatiereDatum(v.gueltigAb)}</td>
                    <td>{bis ? formatiereDatum(bis) : 'laufend'}</td>
                    <td>
                      {formatiereDatum(v.freigegebenAm)}, {v.freigegebenVon}
                    </td>
                    <td>{v.geaenderteKapitel.join(', ') || '–'}</td>
                    <td>{aufbewahrenBisText(bis)}</td>
                    <td>
                      <code>{v.pruefsumme.slice(0, 12)}</code>
                    </td>
                    <td>
                      <div className="knopfreihe">
                        <button type="button" className="knopf knopf-klein" aria-label={`Version ${v.bezeichnung} ansehen`} onClick={() => onAnsehen(v.nummer)}>
                          Ansehen
                        </button>
                        <button type="button" className="knopf knopf-klein" aria-label={`Version ${v.bezeichnung} als Word-Datei (${art === 'verfahrensdokumentation' ? 'Verfahrensdokumentation' : 'Verarbeitungsverzeichnis'})`} onClick={() => onDocx(v)}>
                          DOCX
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="leise klein">Die Prüfsumme (SHA-256) erkennt Beschädigungen und ordnet Ausdrucke einer Version zu. Vor gezielter Änderung schützt sie nicht.</p>
    </section>
  )
}
