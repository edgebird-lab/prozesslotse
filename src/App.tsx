import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { beispielMitCompliance } from './compliance/beispiel'
import { neuesProjekt } from './modell/bausteine'
import { beispielOnlineProjekt } from './modell/beispiel'
import { ladeAusBrowser, ladeDokumentInfo, ladeEinstellungen, loescheBrowserDaten, speichereDokumentInfo, speichereEinstellungen, speichereImBrowser } from './modell/speicher'
import type { Id, Prozess } from './modell/typen'
import { plattform, type MenueBefehl, type Zuletzt } from './plattform'
import { aktiverProzess, istGeaendert, reduziere, SCHRITTE, startZustand } from './zustand'
import { hauptElement, markierungen, useAnalyse, useBpmn } from './ui/analyse'
import { useDateiBefehle, type FremdesBpmn } from './ui/datei'
import type { DiagrammApi } from './ui/Diagramm'
import { DiagrammLazy as Diagramm } from './ui/DiagrammLazy'
import { Schalter } from './ui/Eingaben'
import { useFrage } from './ui/frage'
import { FrageDialog } from './ui/FrageDialog'
import { useVerzoegert } from './ui/hilfen'
import { AppKontext, useApp, type AppApi } from './ui/kontext'
import { AblaufSchritt } from './ui/schritte/AblaufSchritt'
import { BerichtSchritt } from './ui/schritte/BerichtSchritt'
import { BeteiligteSchritt } from './ui/schritte/BeteiligteSchritt'
import { DokumentierenSchritt } from './ui/schritte/DokumentierenSchritt'
import { useComplianceMarkierungen } from './ui/compliance/analyse'
import { PruefenSchritt } from './ui/schritte/PruefenSchritt'
import { RahmenSchritt } from './ui/schritte/RahmenSchritt'
import { VerbessernSchritt } from './ui/schritte/VerbessernSchritt'
import './styles.css'

const VERSION = '0.2.0'

function erstZustand() {
  const gespeichert = ladeAusBrowser()
  const info = gespeichert ? ladeDokumentInfo() : null
  const projekt = gespeichert ?? neuesProjekt()
  // Wiederhergestellt: zugehörige Datei merken; ungespeicherte Änderungen bleiben als „geändert“ markiert
  const dokument = info ? { pfad: info.pfad, name: info.name, gespeichert: info.ungespeichert ? null : projekt } : {}
  const z = startZustand(projekt, ladeEinstellungen().lernmodus, dokument)
  return projekt.ist.ablauf.schritte.length > 0 ? { ...z, schritt: 'ablauf' as const } : z
}

export default function App() {
  return (
    <FrageDialog>
      <Hauptfenster />
    </FrageDialog>
  )
}

function Hauptfenster() {
  const [z, dispatch] = useReducer(reduziere, undefined, erstZustand)
  const [hervorhebung, setHervorhebung] = useState<Id[]>([])
  const [meldung, setMeldung] = useState('')
  const [fremd, setFremd] = useState<FremdesBpmn | null>(null)
  const frage = useFrage()
  const dateiFeld = useRef<HTMLInputElement>(null)
  const meldungsZeit = useRef<number | undefined>(undefined)
  const p = aktiverProzess(z)
  const geaendert = istGeaendert(z)

  const melde = useCallback((text: string) => {
    setMeldung(text)
    window.clearTimeout(meldungsZeit.current)
    meldungsZeit.current = window.setTimeout(() => setMeldung(''), 6000)
  }, [])

  const datei = useDateiBefehle({ z, dispatch, melde, zeigeFremd: setFremd })
  const aendere = useCallback<AppApi['aendere']>((aenderung, optionen = {}) => dispatch({ typ: 'prozess', aenderung, zeit: Date.now(), ...optionen }), [])
  const aendereCompliance = useCallback<AppApi['aendereCompliance']>((aenderung, gruppe) => dispatch({ typ: 'compliance', aenderung, gruppe, zeit: Date.now() }), [])

  // Öffnen: im Programm der Dialog des Systems, im Browser das Dateifeld
  const oeffnen = useCallback(() => {
    if (plattform.desktop) void datei.oeffnen()
    else dateiFeld.current?.click()
  }, [datei])

  // Sofort speichern: Ein Projekt ist nur wenige Kilobyte groß, und ein verzögertes
  // Speichern ginge verloren, wenn der Tab direkt nach einer Änderung geschlossen wird.
  useEffect(() => {
    // Mit freigegebenen Versionen kann der Speicher des Browsers voll werden; die Kopfzeile meldet das bei jeder Änderung
    // (nach dem Zeichnen, damit die Meldung keinen zweiten Durchlauf im selben Effekt auslöst)
    if (!speichereImBrowser(z.projekt)) window.setTimeout(() => melde('Das Projekt passt nicht mehr in den Browser-Speicher. Bitte als Datei speichern.'))
    speichereDokumentInfo({ pfad: z.dokument.pfad, name: z.dokument.name, ungespeichert: geaendert })
  }, [z.projekt, z.dokument, geaendert, melde])

  useEffect(() => speichereEinstellungen({ lernmodus: z.lernmodus }), [z.lernmodus])

  // Fenstertitel; im Programm zeigt ein Punkt ungespeicherte Änderungen
  useEffect(() => {
    const name = fremd?.name ?? z.dokument.name ?? (z.projekt.ist.name || 'Unbenannter Prozess')
    const punkt = plattform.desktop && !fremd && geaendert ? '• ' : ''
    plattform.setzeTitel(`${punkt}${name} – Prozesslotse`)
  }, [z.dokument.name, z.projekt.ist.name, fremd, geaendert])

  // Programm: Startdatei (Doppelklick), weitere Dateien, Schließen, Menü
  const gestartet = useRef(false)
  useEffect(() => {
    if (!plattform.desktop || gestartet.current) return
    gestartet.current = true
    void plattform.startDatei().then((d) => d && datei.oeffneDatei(d))
  }, [datei])

  useEffect(() => plattform.beiDatei((d) => void datei.oeffneDatei(d)), [datei])
  useEffect(() => plattform.beimSchliessen(datei.darfSchliessen), [datei])

  const befehl = useCallback(
    (b: MenueBefehl) => {
      switch (b) {
        case 'neu':
          return void datei.neu()
        case 'oeffnen':
          return oeffnen()
        case 'speichern':
          return void datei.speichern()
        case 'speichernUnter':
          return void datei.speichernUnter()
        case 'bpmn':
          return void datei.exportiereBpmn()
        case 'drucken':
          return window.print()
        case 'pdf':
          dispatch({ typ: 'schritt', schritt: 'bericht' })
          return void plattform.alsPdf(`${z.projekt.ist.name || 'prozess'}.pdf`).then((ok) => ok && melde('PDF gespeichert.'))
        case 'rueckgaengig':
          return dispatch({ typ: 'rueckgaengig' })
        case 'wiederholen':
          return dispatch({ typ: 'wiederholen' })
        case 'lernmodus':
          return dispatch({ typ: 'lernmodus', an: !z.lernmodus })
        case 'beispielLieferdienst':
          return void datei.ladeBeispiel(beispielMitCompliance(), 'pruefen')
        case 'beispielOnline':
          return void datei.ladeBeispiel(beispielOnlineProjekt(), 'ablauf')
        case 'ueber':
          return void frage({
            titel: 'Prozesslotse',
            text: `Version ${VERSION}. Geschäftsprozesse geführt modellieren, als BPMN zeichnen, prüfen und verbessern. Läuft ohne Server; Projekte bleiben auf diesem Rechner.`,
            knoepfe: [{ wert: 'ok', text: 'Schließen', art: 'haupt' }],
            abbrechen: 'ok',
          })
      }
    },
    [datei, oeffnen, frage, melde, z.lernmodus, z.projekt.ist.name],
  )

  useEffect(() => plattform.beiMenue(befehl), [befehl])

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      const k = e.key.toLowerCase()
      // Dateibefehle gelten auch in Eingabefeldern
      if (k === 's') {
        e.preventDefault()
        return befehl(e.shiftKey ? 'speichernUnter' : 'speichern')
      }
      if (k === 'o' && !e.shiftKey) {
        e.preventDefault()
        return befehl('oeffnen')
      }
      if (k === 'n' && !e.shiftKey && plattform.desktop) {
        e.preventDefault()
        return befehl('neu')
      }
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]')) return
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
  }, [befehl])

  // Im Browser: Projekt- oder BPMN-Datei ins Fenster ziehen (im Programm meldet das der Rust-Teil)
  useEffect(() => {
    if (plattform.desktop) return
    const ueber = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
    }
    const ablegen = (e: DragEvent) => {
      const f = e.dataTransfer?.files[0]
      if (!f) return
      e.preventDefault()
      void f.text().then((inhalt) => datei.oeffneDatei({ pfad: null, name: f.name, inhalt }))
    }
    window.addEventListener('dragover', ueber)
    window.addEventListener('drop', ablegen)
    return () => {
      window.removeEventListener('dragover', ueber)
      window.removeEventListener('drop', ablegen)
    }
  }, [datei])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [z.schritt])

  const dateiGewaehlt = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) await datei.oeffneDatei({ pfad: null, name: f.name, inhalt: await f.text() })
  }

  const api = useMemo<AppApi>(() => ({ z, p, dispatch, aendere, aendereCompliance, setHervorhebung, datei, melde }), [z, p, aendere, aendereCompliance, datei, melde])

  const browserDatenLoeschen = useCallback(async () => {
    const ok = await frage({
      titel: 'Daten im Browser löschen?',
      text: 'Entfernt das Projekt, freigegebene Versionen und Einstellungen aus diesem Browser. Der Browser-Speicher ist unverschlüsselt; auf gemeinsam genutzten Rechnern sollte nichts darin bleiben. Wer das Projekt noch braucht, speichert es vorher als Datei.',
      knoepfe: [
        { wert: 'ja', text: 'Löschen', art: 'gefahr' },
        { wert: 'nein', text: 'Abbrechen' },
      ],
      abbrechen: 'nein',
    })
    if (ok !== 'ja') return
    loescheBrowserDaten()
    dispatch({ typ: 'laden', projekt: neuesProjekt() })
    melde('Daten im Browser gelöscht.')
  }, [frage, melde])

  return (
    <AppKontext.Provider value={api}>
      <div className="app">
        <a className="sprungmarke" href="#inhalt">
          Zum Inhalt springen
        </a>
        <Kopfzeile meldung={meldung} onOeffnen={oeffnen} befehl={befehl} onBrowserDatenLoeschen={() => void browserDatenLoeschen()} />
        <input
          ref={dateiFeld}
          type="file"
          accept=".prozesslotse,.json,.bpmn,application/json,application/xml,text/xml"
          hidden
          onChange={(e) => void dateiGewaehlt(e)}
        />
        {fremd ? (
          <FremdeAnsicht fremd={fremd} onSchliessen={() => setFremd(null)} />
        ) : (
          <>
            <Schrittleiste />
            {z.schritt === 'bericht' ? (
              <main id="inhalt" className="bericht-flaeche">
                <BerichtSchritt />
              </main>
            ) : (
              // Im Teilschritt „Dokumente“ nutzt der Inhalt die volle Breite; das Panel bleibt dasselbe, damit der Fokus erhalten bleibt
              <main id="inhalt" className={`arbeitsflaeche${z.schritt === 'dokumentieren' && z.teilschritt === 'dokumente' ? ' arbeitsflaeche-voll' : ''}`}>
                <section className="panel" aria-label="Assistent">
                  {z.schritt === 'rahmen' && <RahmenSchritt />}
                  {z.schritt === 'beteiligte' && <BeteiligteSchritt />}
                  {z.schritt === 'ablauf' && <AblaufSchritt />}
                  {z.schritt === 'pruefen' && <PruefenSchritt />}
                  {z.schritt === 'verbessern' && <VerbessernSchritt />}
                  {z.schritt === 'dokumentieren' && <DokumentierenSchritt />}
                </section>
                {!(z.schritt === 'dokumentieren' && z.teilschritt === 'dokumente') && <Buehne p={p} hervorhebung={hervorhebung} />}
              </main>
            )}
          </>
        )}
      </div>
    </AppKontext.Provider>
  )
}

function Kopfzeile({ meldung, onOeffnen, befehl, onBrowserDatenLoeschen }: { meldung: string; onOeffnen: () => void; befehl: (b: MenueBefehl) => void; onBrowserDatenLoeschen: () => void }) {
  const { z, dispatch, datei } = useApp()
  const menue = useRef<HTMLDetailsElement>(null)
  const [zuletzt, setZuletzt] = useState<Zuletzt[]>([])
  const schliesse = () => menue.current?.removeAttribute('open')
  const geaendert = plattform.desktop && istGeaendert(z)

  return (
    <header className="kopf">
      <div className="marke">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={28} height={28} />
        <span>Prozesslotse</span>
        {z.dokument.name && (
          <span className="dokument-name" title={z.dokument.pfad ?? undefined}>
            {z.dokument.name}
            {geaendert && <span aria-label=" (ungespeichert)"> •</span>}
          </span>
        )}
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
        <details
          className="menue"
          ref={menue}
          onToggle={(e) => {
            if ((e.currentTarget as HTMLDetailsElement).open && plattform.desktop) void plattform.zuletzt().then(setZuletzt)
          }}
        >
          <summary className="knopf knopf-klein">Projekt</summary>
          <div className="menue-liste">
            <MenuePunkt onClick={() => befehl('neu')} schliesse={schliesse} taste={plattform.desktop ? 'Strg+N' : undefined}>
              Neues Projekt
            </MenuePunkt>
            <MenuePunkt onClick={onOeffnen} schliesse={schliesse} taste="Strg+O">
              Datei öffnen …
            </MenuePunkt>
            {zuletzt.length > 0 && (
              <div className="menue-gruppe" role="group" aria-label="Zuletzt geöffnet">
                <p className="menue-ueberschrift">Zuletzt geöffnet</p>
                {zuletzt.map((d) => (
                  <MenuePunkt key={d.pfad} onClick={() => void datei.oeffneZuletzt(d.pfad)} schliesse={schliesse} titel={d.pfad}>
                    {d.name}
                  </MenuePunkt>
                ))}
              </div>
            )}
            {plattform.desktop ? (
              <>
                <MenuePunkt onClick={() => befehl('speichern')} schliesse={schliesse} taste="Strg+S">
                  Speichern
                </MenuePunkt>
                <MenuePunkt onClick={() => befehl('speichernUnter')} schliesse={schliesse} taste="Strg+Umschalt+S">
                  Speichern unter …
                </MenuePunkt>
              </>
            ) : (
              <MenuePunkt onClick={() => befehl('speichern')} schliesse={schliesse} taste="Strg+S">
                Als Datei speichern
              </MenuePunkt>
            )}
            <MenuePunkt onClick={() => befehl('bpmn')} schliesse={schliesse}>
              Als BPMN exportieren
            </MenuePunkt>
            {z.projekt.compliance && (
              <MenuePunkt onClick={() => void datei.exportiereBpmn(undefined, { ohneCompliance: true })} schliesse={schliesse}>
                Als BPMN ohne Compliance-Angaben exportieren
              </MenuePunkt>
            )}
            <MenuePunkt onClick={() => befehl('beispielLieferdienst')} schliesse={schliesse}>
              Beispiel „Lieferdienst“ laden
            </MenuePunkt>
            <MenuePunkt onClick={() => befehl('beispielOnline')} schliesse={schliesse}>
              Beispiel „Onlinebestellung“ laden
            </MenuePunkt>
            <MenuePunkt onClick={onBrowserDatenLoeschen} schliesse={schliesse}>
              Daten im Browser löschen …
            </MenuePunkt>
          </div>
        </details>
      </div>
    </header>
  )
}

function MenuePunkt({ children, onClick, schliesse, taste, titel }: { children: ReactNode; onClick: () => void; schliesse: () => void; taste?: string; titel?: string }) {
  return (
    <button
      type="button"
      title={titel}
      onClick={() => {
        schliesse()
        onClick()
      }}
    >
      <span>{children}</span>
      {taste && <kbd className="menue-taste">{taste}</kbd>}
    </button>
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

/** Fremde BPMN-Datei ohne eingebettetes Projekt: nur ansehen. */
function FremdeAnsicht({ fremd, onSchliessen }: { fremd: FremdesBpmn; onSchliessen: () => void }) {
  return (
    <main id="inhalt" className="fremd-flaeche">
      <div className="banner banner-hinweis fremd-banner">
        <p>
          <strong>{fremd.name}</strong> wurde nicht mit dem Prozesslotsen erstellt und enthält kein Projekt. Sie wird nur angezeigt; Kennzahlen und Vorschläge gibt es für eigene Projekte.
        </p>
        <button type="button" className="knopf knopf-haupt" onClick={onSchliessen}>
          Ansicht schließen
        </button>
      </div>
      <section className="buehne fremd-buehne" aria-label="Diagramm">
        <Diagramm xml={fremd.xml} beschriftung={`BPMN-Diagramm aus „${fremd.name}“`} />
        <p className="buehne-fuss leise klein">Ziehen zum Verschieben, Strg + Mausrad zum Zoomen.</p>
      </section>
    </main>
  )
}

function Buehne({ p, hervorhebung }: { p: Prozess; hervorhebung: Id[] }) {
  const { z, dispatch } = useApp()
  const diagramm = useRef<DiagrammApi>(null)
  const pDiagramm = useVerzoegert(p, 200)
  const bpmn = useBpmn(pDiagramm)
  const analyse = useAnalyse(pDiagramm)
  const zeigeBefunde = z.schritt === 'pruefen' || z.schritt === 'verbessern'
  const dokumentieren = z.schritt === 'dokumentieren'
  const complianceMarken = useComplianceMarkierungen(dokumentieren, z.projekt, bpmn)
  const marken = useMemo(() => (zeigeBefunde ? markierungen(analyse.befunde, bpmn) : complianceMarken), [zeigeBefunde, analyse, bpmn, complianceMarken])
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
      // Im Schritt „Dokumentieren“ filtert ein Klick die Angaben auf diese Aufgabe
      if (schritt !== 'ablauf' && schritt !== 'dokumentieren') dispatch({ typ: 'schritt', schritt: 'ablauf' })
    },
    [bpmn, schritt, dispatch],
  )

  return (
    <section className="buehne" aria-label="Diagramm">
      <div className="buehne-kopf">
        {z.projekt.soll && !dokumentieren ? (
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
        {/* Markierte Schritte liegen oft außerhalb des Anfangsausschnitts: der Knopf holt den ersten ins Bild */}
        {dokumentieren && marken && marken.size > 0 && (
          <button type="button" className="knopf knopf-klein" title="Lücken an Schritten im Diagramm zeigen" onClick={() => diagramm.current?.zeige([...marken.keys()])}>
            {marken.size} markiert – zeigen
          </button>
        )}
      </div>
      <Diagramm ref={diagramm} xml={bpmn.xml} markierungen={marken} ausgewaehlt={ausgewaehlt} onKlick={klick} beschriftung={`BPMN-Diagramm: ${p.name || 'Unbenannter Prozess'}`} />
      <p className="buehne-fuss leise klein">
        Ziehen zum Verschieben, Strg + Mausrad zum Zoomen. {dokumentieren ? 'Ein Klick auf einen Schritt zeigt nur seine Angaben.' : 'Ein Klick auf einen Schritt öffnet ihn zum Bearbeiten.'}
      </p>
    </section>
  )
}
