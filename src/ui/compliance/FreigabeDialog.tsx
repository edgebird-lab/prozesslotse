import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { formatiereDatum } from '../../compliance/datum'
import type { ComplianceProjekt, DokuVersion, IsoDatum } from '../../compliance/typen'
import { freigeben, naechsteBezeichnung, pruefeFreigabe, type FreigabeEingaben } from '../../compliance/versionen'
import type { Prozess } from '../../modell/typen'
import { CFeld, DatumEingabe, TextFeld } from './Eingaben'

/**
 * Freigabe einer neuen Version (Spezifikation 5.4). Der Dialog hält den Fokus
 * und schließt mit Escape. „Freigeben“ rechnet die Prüfsumme und meldet die
 * fertige Version zurück.
 */
export function FreigabeDialog({
  c,
  ist,
  heute,
  fehler,
  geaendert,
  onFreigegeben,
  onSchliessen,
}: {
  c: ComplianceProjekt
  ist: Prozess
  heute: IsoDatum
  /** Zahl der Befunde der Schwere Fehler */
  fehler: number
  /** Kapitel, die sich seit der letzten Version geändert haben */
  geaendert: string[]
  onFreigegeben: (v: DokuVersion) => void
  onSchliessen: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titelId = useId()
  const erste = c.versionen.length === 0
  const [e, setE] = useState<FreigabeEingaben>(() => ({
    bezeichnung: naechsteBezeichnung(c),
    gueltigAb: heute,
    freigegebenVon: c.unternehmen.geschaeftsleitung,
    aenderung: erste ? 'Erstfassung' : geaendert.length > 0 ? `Geändert: ${geaendert.join(', ')}` : '',
  }))
  const [trotzdem, setTrotzdem] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
  }, [])

  const absenden = async (ev: FormEvent) => {
    ev.preventDefault()
    const problem = pruefeFreigabe(c, e) ?? (fehler > 0 && !trotzdem ? 'Bitte „Trotzdem freigeben“ bestätigen oder die Fehler zuerst beheben.' : null)
    if (problem) return setMeldung(problem)
    setLaeuft(true)
    try {
      onFreigegeben(await freigeben(ist, c, e, heute))
    } catch (err) {
      setMeldung(err instanceof Error ? err.message : String(err))
      setLaeuft(false)
    }
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
      <form className="felder" onSubmit={(ev) => void absenden(ev)}>
        <h2 id={titelId}>Version freigeben</h2>
        <p className="leise">Die Freigabe friert beide Dokumente und den Ist-Prozess ein. Freigegebene Versionen lassen sich nicht mehr ändern oder löschen; auch „Rückgängig“ nimmt eine Freigabe nicht zurück.</p>
        <div className="feldreihe">
          <TextFeld label="Bezeichnung" wert={e.bezeichnung} onAendern={(bezeichnung) => setE({ ...e, bezeichnung })} />
          <CFeld label="Gültig ab">{(id) => <DatumEingabe id={id} wert={e.gueltigAb} onAendern={(d) => setE({ ...e, gueltigAb: d ?? '' })} />}</CFeld>
        </div>
        <TextFeld label="Freigegeben von" wert={e.freigegebenVon} onAendern={(freigegebenVon) => setE({ ...e, freigegebenVon })} />
        <TextFeld label="Inhalt der Änderung" mehrzeilig wert={e.aenderung} onAendern={(aenderung) => setE({ ...e, aenderung })} />
        <p>
          Freigegeben am: <strong>{formatiereDatum(heute)}</strong>
        </p>
        {fehler > 0 && (
          <div className="banner banner-fehler">
            <p>{fehler === 1 ? 'Es gibt 1 Fehler.' : `Es gibt ${fehler} Fehler.`} Eine Freigabe ist trotzdem möglich; die Dokumente nennen dann Angaben, die nicht stimmen können.</p>
            <label className="kontrollkaestchen">
              <input type="checkbox" checked={trotzdem} onChange={(ev) => setTrotzdem(ev.target.checked)} /> Trotzdem freigeben
            </label>
          </div>
        )}
        {meldung && (
          <p className="feld-meldung" role="alert">
            {meldung}
          </p>
        )}
        <div className="knopfreihe">
          <button type="submit" className="knopf knopf-haupt" disabled={laeuft}>
            Freigeben
          </button>
          <button type="button" className="knopf" onClick={onSchliessen}>
            Abbrechen
          </button>
        </div>
      </form>
    </dialog>
  )
}
