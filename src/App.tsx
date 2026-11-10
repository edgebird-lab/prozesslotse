import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent } from 'react'
import { neuerProzess, neuesProjekt } from './modell/bausteine'
import { beispielOnlineProjekt, beispielProjekt } from './modell/beispiel'
import { alsJson, ladeAusBrowser, ladeEinstellungen, leseProjektText, speichereEinstellungen, speichereImBrowser } from './modell/speicher'
import type { Id, Prozess } from './modell/typen'
import { aktiverProzess, reduziere, SCHRITTE, startZustand } from './zustand'
import { hauptElement, markierungen, useAnalyse, useBpmn } from './ui/analyse'
import { DiagrammLazy as Diagramm } from './ui/DiagrammLazy'
import { Schalter } from './ui/Eingaben'
import { dateiname, ladeHerunter, useVerzoegert } from './ui/hilfen'
import { AppKontext, useApp, type AppApi } from './ui/kontext'
import { AblaufSchritt } from './ui/schritte/AblaufSchritt'
import { BerichtSchritt } from './ui/schritte/BerichtSchritt'
import { BeteiligteSchritt } from './ui/schritte/BeteiligteSchritt'
import { PruefenSchritt } from './ui/schritte/PruefenSchritt'
import { RahmenSchritt } from './ui/schritte/RahmenSchritt'
import { VerbessernSchritt } from './ui/schritte/VerbessernSchritt'
import './styles.css'

function erstZustand() {
  const gespeichert = ladeAusBrowser()
  const projekt = gespeichert ?? neuesProjekt()
  const z = startZustand(projekt, ladeEinstellungen().lernmodus)
  return projekt.ist.ablauf.schritte.length > 0 ? { ...z, schritt: 'ablauf' as const } : z
}

export default function App() {
  const [z, dispatch] = useReducer(reduziere, undefined, erstZustand)
  const [hervorhebung, setHervorhebung] = useState<Id[]>([])
  const p = aktiverProzess(z)

  const aendere = useCallback<AppApi['aendere']>((aenderung, optionen = {}) => dispatch({ typ: 'prozess', aenderung, zeit: Date.now(), ...optionen }), [])

  // Sofort speichern: Ein Projekt ist nur wenige Kilobyte groß, und ein verzögertes
  // Speichern ginge verloren, wenn der Tab direkt nach einer Änderung geschlossen wird.
  useEffect(() => {
    speichereImBrowser(z.projekt)
  }, [z.projekt])

  useEffect(() => speichereEinstellungen({ lernmodus: z.lernmodus }), [z.lernmodus])

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]')) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        dispatch({ typ: 'rueckgaengig' })
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault()
        dispatch({ typ: 'wiederholen' })
      }
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [z.schritt])

  const api = useMemo<AppApi>(() => ({ z, p, dispatch, aendere, setHervorhebung }), [z, p, aendere])

  return (
    <AppKontext.Provider value={api}>
      <div className="app">
        <a className="sprungmarke" href="#inhalt">
          Zum Inhalt springen
        </a>
        <Kopfzeile />
        <Schrittleiste />
        {z.schritt === 'bericht' ? (
          <main id="inhalt" className="bericht-flaeche">
            <BerichtSchritt />
          </main>
        ) : (
          <main id="inhalt" className="arbeitsflaeche">
            <section className="panel" aria-label="Assistent">
              {z.schritt === 'rahmen' && <RahmenSchritt />}
              {z.schritt === 'beteiligte' && <BeteiligteSchritt />}
              {z.schritt === 'ablauf' && <AblaufSchritt />}
              {z.schritt === 'pruefen' && <PruefenSchritt />}
              {z.schritt === 'verbessern' && <VerbessernSchritt />}
            </section>
            <Buehne p={p} hervorhebung={hervorhebung} />
          </main>
        )}
      </div>
    </AppKontext.Provider>
  )
}

function Kopfzeile() {
  const { z, dispatch } = useApp()
  const datei = useRef<HTMLInputElement>(null)
  const menue = useRef<HTMLDetailsElement>(null)
  const [meldung, setMeldung] = useState('')
  const schliesse = () => menue.current?.removeAttribute('open')
  const melde = (text: string) => {
    setMeldung(text)
    window.setTimeout(() => setMeldung(''), 5000)
  }
  const verwerfenOk = () => z.projekt.ist.ablauf.schritte.length === 0 || window.confirm('Das aktuelle Projekt wird ersetzt. Vorher als Datei speichern, wenn du es behalten willst. Fortfahren?')

  const oeffnen = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const projekt = leseProjektText(await f.text())
      dispatch({ typ: 'laden', projekt, schritt: 'ablauf' })
      melde(`„${f.name}“ geladen.`)
    } catch (err) {
      melde(`Datei nicht geladen: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <header className="kopf">
      <div className="marke">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={28} height={28} />
        <span>Prozesslotse</span>
      </div>
      <p className="meldung" role="status" aria-live="polite">
        {meldung}
      </p>
      <div className="kopf-aktionen">
        <button type="button" className="knopf knopf-klein" disabled={z.vergangenheit.length === 0} onClick={() => dispatch({ typ: 'rueckgaengig' })} title="Rückgängig (Strg+Z)">
          ↶ Rückgängig
        </button>
        <button type="button" className="knopf knopf-klein" disabled={z.zukunft.length === 0} onClick={() => dispatch({ typ: 'wiederholen' })} title="Wiederholen (Strg+Y)" aria-label="Wiederholen">
          ↷
        </button>
        <Schalter an={z.lernmodus} onAendern={(an) => dispatch({ typ: 'lernmodus', an })}>
          Lernmodus
        </Schalter>
        <details className="menue" ref={menue}>
          <summary className="knopf knopf-klein">Projekt</summary>
          <div className="menue-liste">
            <button
              type="button"
              onClick={() => {
                schliesse()
                if (verwerfenOk()) dispatch({ typ: 'laden', projekt: neuesProjekt(neuerProzess()) })
              }}
            >
              Neues Projekt
            </button>
            <button
              type="button"
              onClick={() => {
                schliesse()
                if (verwerfenOk()) dispatch({ typ: 'laden', projekt: beispielProjekt(), schritt: 'pruefen' })
              }}
            >
              Beispiel „Lieferdienst“ laden
            </button>
            <button
              type="button"
              onClick={() => {
                schliesse()
                if (verwerfenOk()) dispatch({ typ: 'laden', projekt: beispielOnlineProjekt(), schritt: 'ablauf' })
              }}
            >
              Beispiel „Onlinebestellung“ laden
            </button>
            <button
              type="button"
              onClick={() => {
                schliesse()
                datei.current?.click()
              }}
            >
              Datei öffnen …
            </button>
            <button
              type="button"
              onClick={() => {
                schliesse()
                ladeHerunter(dateiname(z.projekt.ist.name, '.prozesslotse.json'), alsJson(z.projekt), 'application/json')
              }}
            >
              Als Datei speichern
            </button>
          </div>
        </details>
        <input ref={datei} type="file" accept=".json,application/json" hidden onChange={(e) => void oeffnen(e)} />
      </div>
    </header>
  )
}

function Schrittleiste() {
  const { z, dispatch } = useApp()
  return (
    <nav className="schrittleiste" aria-label="Schritte">
      <ol>
        {SCHRITTE.map((s, i) => (
          <li key={s.id}>
            <button type="button" aria-current={z.schritt === s.id ? 'step' : undefined} onClick={() => dispatch({ typ: 'schritt', schritt: s.id })}>
              <span className="nummer" aria-hidden="true">
                {i + 1}
              </span>
              {s.name}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function Buehne({ p, hervorhebung }: { p: Prozess; hervorhebung: Id[] }) {
  const { z, dispatch } = useApp()
  const pDiagramm = useVerzoegert(p, 200)
  const bpmn = useBpmn(pDiagramm)
  const analyse = useAnalyse(pDiagramm)
  const zeigeBefunde = z.schritt === 'pruefen' || z.schritt === 'verbessern'
  const marken = useMemo(() => (zeigeBefunde ? markierungen(analyse.befunde, bpmn) : undefined), [zeigeBefunde, analyse, bpmn])
  const ausgewaehlt = useMemo(
    () => [z.auswahl, ...hervorhebung].filter((id): id is Id => !!id).map((id) => hauptElement(bpmn, id)).filter((e): e is string => !!e),
    [z.auswahl, hervorhebung, bpmn],
  )
  const schritt = z.schritt
  const klick = useCallback(
    (elementId: string) => {
      const blockId = bpmn.elementZuBlock.get(elementId)
      if (!blockId || schritt === 'verbessern') return
      dispatch({ typ: 'auswahl', auswahl: blockId })
      if (schritt !== 'ablauf') dispatch({ typ: 'schritt', schritt: 'ablauf' })
    },
    [bpmn, schritt, dispatch],
  )

  return (
    <section className="buehne" aria-label="Diagramm">
      <div className="buehne-kopf">
        {z.projekt.soll ? (
          <div className="umschalter" role="group" aria-label="Ansicht">
            <button type="button" aria-pressed={z.ansicht === 'ist'} onClick={() => dispatch({ typ: 'ansicht', ansicht: 'ist' })}>
              Ist
            </button>
            <button type="button" aria-pressed={z.ansicht === 'soll'} onClick={() => dispatch({ typ: 'ansicht', ansicht: 'soll' })}>
              Soll
            </button>
          </div>
        ) : (
          <span className="buehne-titel">Ist-Prozess</span>
        )}
        <span className="buehne-name">{p.name || 'Unbenannter Prozess'}</span>
        {zeigeBefunde && marken && marken.size > 0 && <span className="leise klein">Markiert: Schwachstellen und Fehler</span>}
      </div>
      <Diagramm xml={bpmn.xml} markierungen={marken} ausgewaehlt={ausgewaehlt} onKlick={klick} beschriftung={`BPMN-Diagramm: ${p.name || 'Unbenannter Prozess'}`} />
      <p className="buehne-fuss leise klein">Ziehen zum Verschieben, Strg + Mausrad zum Zoomen. Ein Klick auf einen Schritt öffnet ihn zum Bearbeiten.</p>
    </section>
  )
}
