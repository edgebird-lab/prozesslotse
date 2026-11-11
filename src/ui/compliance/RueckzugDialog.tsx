import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { formatiereDatum } from '../../compliance/datum'
import type { DokuVersion } from '../../compliance/typen'
import { TextFeld } from './Eingaben'

/**
 * „Freigabe zurückziehen“ (Spezifikation 5.4): nur für die letzte wirksame
 * Version, solange sie noch nicht gilt. Der Grund ist Pflicht; die Version
 * bleibt als „zurückgezogen“ in der Liste und behält ihre Nummer.
 */
export function RueckzugDialog({ version, onZurueckziehen, onSchliessen }: { version: DokuVersion; onZurueckziehen: (grund: string) => void; onSchliessen: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titelId = useId()
  const grundId = useId()
  const [grund, setGrund] = useState('')
  const [meldung, setMeldung] = useState<string | null>(null)

  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
  }, [])

  const absenden = (ev: FormEvent) => {
    ev.preventDefault()
    if (!grund.trim()) {
      setMeldung('Bitte den Grund für den Rückzug angeben.')
      document.getElementById(grundId)?.focus()
      return
    }
    onZurueckziehen(grund)
  }

  return (
    <dialog
      ref={dialog}
      className="frage-dialog freigabe-dialog"
      aria-labelledby={titelId}
      onCancel={(ev) => {
        ev.preventDefault()
        onSchliessen()
      }}
    >
      <form className="felder" onSubmit={absenden}>
        <h2 id={titelId}>Freigabe zurückziehen</h2>
        <p>
          Version {version.bezeichnung} ist freigegeben, gilt aber erst ab dem {formatiereDatum(version.gueltigAb)}. Nach dem Rückzug bleibt sie mit Datum und Grund in der Liste und in der Änderungshistorie sichtbar, gilt aber
          nie. Ihre Nummer wird nicht wieder vergeben.
        </p>
        <TextFeld
          label="Grund"
          id={grundId}
          mehrzeilig
          wert={grund}
          platzhalter="z. B. Tippfehler bei „Gültig ab“"
          fehler={meldung}
          onAendern={(g) => {
            setGrund(g)
            setMeldung(null)
          }}
        />
        <div className="knopfreihe">
          <button type="submit" className="knopf knopf-gefahr">
            Zurückziehen
          </button>
          <button type="button" className="knopf" onClick={onSchliessen}>
            Abbrechen
          </button>
        </div>
      </form>
    </dialog>
  )
}
