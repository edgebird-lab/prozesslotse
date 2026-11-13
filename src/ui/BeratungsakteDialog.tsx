import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { beratungsakteAusProjekt, mandantAusProjekt } from '../analyse/beratungsakte'
import { dateinameBeratungsakte, type Beratungsakte } from '../beratungsakte/beratungsakte'
import type { Projekt } from '../modell/typen'
import { CFeld, TextFeld } from './compliance/Eingaben'

const anzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`

/**
 * „Für die Beratungsakte speichern“: fragt nach dem Mandanten und zeigt, was
 * die Datei enthält. Gespeichert wird erst mit „Speichern“ (Aufrufer).
 */
export function BeratungsakteDialog({
  projekt,
  quelldatei,
  onSpeichern,
  onSchliessen,
}: {
  projekt: Projekt
  quelldatei: string | null
  onSpeichern: (akte: Beratungsakte) => void
  onSchliessen: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titelId = useId()
  const mandantId = useId()
  const [jetzt] = useState(() => new Date())
  const [mandant, setMandant] = useState(() => mandantAusProjekt(projekt))
  const [kennung, setKennung] = useState('')
  const [meldung, setMeldung] = useState<string | null>(null)
  // Inhalt hängt nicht vom Mandanten ab; einmal rechnen, nicht bei jedem Tastendruck
  const vorschau = useMemo(() => beratungsakteAusProjekt({ projekt, mandant: { name: 'Mandant' }, jetzt, quelldatei }), [projekt, jetzt, quelldatei])
  const dateiname = dateinameBeratungsakte({ ...vorschau, mandant: { name: mandant } })

  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
    document.getElementById(mandantId)?.focus()
  }, [mandantId])

  const absenden = (ev: FormEvent) => {
    ev.preventDefault()
    if (!mandant.trim()) {
      setMeldung('Bitte den Mandanten angeben.')
      document.getElementById(mandantId)?.focus()
      return
    }
    try {
      onSpeichern(beratungsakteAusProjekt({ projekt, mandant: { name: mandant, kennung }, jetzt, quelldatei }))
    } catch (err) {
      setMeldung(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <dialog
      ref={dialog}
      className="frage-dialog akte-dialog"
      aria-labelledby={titelId}
      onCancel={(ev) => {
        ev.preventDefault()
        onSchliessen()
      }}
    >
      <form className="felder" onSubmit={absenden} noValidate>
        <h2 id={titelId}>Für die Beratungsakte speichern</h2>
        <p>Kennzahlen, Befunde und Maßnahmen dieses Berichts als Datei im offenen Format Beratungsakte v1 (JSON).</p>
        <CFeld label="Mandant" id={mandantId} fehler={meldung}>
          {(fid) => (
            <input
              id={fid}
              type="text"
              autoComplete="off"
              required
              aria-required="true"
              value={mandant}
              onChange={(e) => {
                setMandant(e.target.value)
                setMeldung(null)
              }}
              {...(meldung ? { 'aria-invalid': true, 'aria-describedby': `${fid}-meldung` } : {})}
            />
          )}
        </CFeld>
        <TextFeld label="Mandantennummer (optional)" wert={kennung} onAendern={setKennung} />
        <p className="akte-inhalt">
          Enthält: {anzahl(vorschau.kennzahlen.length, 'Kennzahl', 'Kennzahlen')}, {anzahl(vorschau.befunde.length, 'Befund', 'Befunde')},{' '}
          {anzahl(vorschau.massnahmen.length, 'Maßnahme', 'Maßnahmen')}
          <span className="akte-datei">Datei: {dateiname}</span>
        </p>
        <div className="knopfreihe">
          <button type="submit" className="knopf knopf-haupt">
            Speichern
          </button>
          <button type="button" className="knopf" onClick={onSchliessen}>
            Abbrechen
          </button>
        </div>
      </form>
    </dialog>
  )
}
