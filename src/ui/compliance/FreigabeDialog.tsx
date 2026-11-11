import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { formatiereDatum } from '../../compliance/datum'
import type { ComplianceProjekt, DokuVersion, IsoDatum } from '../../compliance/typen'
import {
  freigabeFehler,
  freigeben,
  fruehestesGueltigAb,
  letzteWirksame,
  naechsteBezeichnung,
  rueckfrageGueltigAb,
  spaetestesGueltigAb,
  vorgabeGueltigAb,
  type FreigabeEingaben,
  type FreigabeFeld,
} from '../../compliance/versionen'
import type { Prozess } from '../../modell/typen'
import { useFrage } from '../frage'
import { CFeld, DatumEingabe, TextFeld } from './Eingaben'

/** Geänderte Kapitel ausgeschrieben, z. B. „Verfahrensdokumentation 3.2, 4; Verarbeitungsverzeichnis B.1“. */
function kapitelText(kapitel: string[]): string {
  const vd = kapitel.filter((k) => k.startsWith('VD ')).map((k) => k.slice(3))
  const vvt = kapitel.filter((k) => k.startsWith('VVT ')).map((k) => k.slice(4))
  const sonst = kapitel.filter((k) => !k.startsWith('VD ') && !k.startsWith('VVT '))
  return [vd.length > 0 ? `Verfahrensdokumentation ${vd.join(', ')}` : '', vvt.length > 0 ? `Verarbeitungsverzeichnis ${vvt.join(', ')}` : '', ...sonst].filter(Boolean).join('; ')
}

/**
 * Freigabe einer neuen Version (Spezifikation 5.4). Der Dialog hält den Fokus
 * und schließt mit Escape. „Freigeben“ rechnet die Prüfsumme und meldet die
 * fertige Version zurück. Die Vorgaben bestehen die eigene Prüfung; liegt
 * „Gültig ab“ mehr als 30 Tage nach dem Freigabetag, fragt der Dialog nach.
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
  const feldId = useId()
  const frage = useFrage()
  // zurückgezogene Freigaben zählen nicht: Ohne wirksame Version ist es die Erstfassung
  const letzte = letzteWirksame(c.versionen)
  const [e, setE] = useState<FreigabeEingaben>(() => ({
    bezeichnung: naechsteBezeichnung(c),
    gueltigAb: vorgabeGueltigAb(c, heute),
    freigegebenVon: c.unternehmen.geschaeftsleitung,
    aenderung: letzte ? '' : 'Erstfassung',
  }))
  const [trotzdem, setTrotzdem] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
  }, [])

  const id = (feld: FreigabeFeld) => `${feldId}-${feld}`
  const fokus = (feld: FreigabeFeld) => document.getElementById(id(feld))?.focus()

  const absenden = async (ev: FormEvent) => {
    ev.preventDefault()
    const f = freigabeFehler(c, e, heute)
    const problem = f?.text ?? (fehler > 0 && !trotzdem ? 'Bitte „Trotzdem freigeben“ bestätigen oder die Fehler zuerst beheben.' : null)
    if (problem) {
      setMeldung(problem)
      if (f) fokus(f.feld)
      return
    }
    const rueckfrage = rueckfrageGueltigAb(e, heute)
    if (rueckfrage) {
      const wahl = await frage({
        titel: '„Gültig ab“ prüfen',
        text: rueckfrage,
        knoepfe: [
          { wert: 'ja', text: 'Ja, freigeben', art: 'haupt' },
          { wert: 'nein', text: 'Datum ändern' },
        ],
        abbrechen: 'nein',
      })
      if (wahl !== 'ja') return fokus('gueltigAb')
    }
    setLaeuft(true)
    try {
      onFreigegeben(await freigeben(ist, c, e, heute))
    } catch (err) {
      setMeldung(err instanceof Error ? err.message : String(err))
      setLaeuft(false)
    }
  }

  const frueh = fruehestesGueltigAb(c)
  const spaet = spaetestesGueltigAb(heute)
  const datumHilfe =
    letzte && frueh
      ? frueh > spaet
        ? `Version ${letzte.bezeichnung} gilt erst ab dem ${formatiereDatum(letzte.gueltigAb)}. Ziehe ihre Freigabe zurück, um ein früheres Datum freizugeben.`
        : `Frühestens ${formatiereDatum(frueh)}, spätestens ${formatiereDatum(spaet)}.${letzte.gueltigAb > heute ? ` Soll Version ${letzte.bezeichnung} nie gelten, ziehe ihre Freigabe zurück.` : ''}`
      : `Spätestens ${formatiereDatum(spaet)}. Ein früheres Datum ist möglich, wenn das Verfahren schon so angewandt wird.`

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
        <p className="leise">
          Die Freigabe friert beide Dokumente und den Ist-Prozess ein. Freigegebene Versionen lassen sich nicht mehr ändern oder löschen; auch „Rückgängig“ nimmt eine Freigabe nicht zurück. Solange eine Version noch nicht gilt,
          lässt sich ihre Freigabe mit Begründung zurückziehen.
        </p>
        <div className="feldreihe">
          <TextFeld label="Bezeichnung" id={id('bezeichnung')} wert={e.bezeichnung} onAendern={(bezeichnung) => setE({ ...e, bezeichnung })} />
          <CFeld label="Gültig ab" id={id('gueltigAb')} hilfe={datumHilfe}>
            {(fid) => <DatumEingabe id={fid} wert={e.gueltigAb} onAendern={(d) => setE({ ...e, gueltigAb: d ?? '' })} />}
          </CFeld>
        </div>
        <TextFeld label="Freigegeben von" id={id('freigegebenVon')} wert={e.freigegebenVon} onAendern={(freigegebenVon) => setE({ ...e, freigegebenVon })} />
        <TextFeld
          label="Inhalt der Änderung"
          id={id('aenderung')}
          mehrzeilig
          wert={e.aenderung}
          platzhalter={letzte ? 'z. B. Rechnung wird jetzt zusätzlich von der Buchhaltung geprüft' : undefined}
          hilfe={
            letzte
              ? geaendert.length > 0
                ? `Geänderte Kapitel: ${kapitelText(geaendert)} (werden automatisch eingetragen)`
                : `Seit Version ${letzte.bezeichnung} hat sich kein Kapitel geändert.`
              : undefined
          }
          onAendern={(aenderung) => setE({ ...e, aenderung })}
        />
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
