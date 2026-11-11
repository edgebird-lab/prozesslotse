import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { formatiereDatum } from '../../compliance/datum'
import { kapitelText } from '../../compliance/dokument'
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
import { CFeld, DatumEingabe, FeldMeldung, TextFeld } from './Eingaben'

/**
 * Freigabe einer neuen Version (Spezifikation 5.4). Der Dialog hält den Fokus
 * und schließt mit Escape. „Freigeben“ rechnet die Prüfsumme und meldet die
 * fertige Version zurück. Die Vorgaben bestehen die eigene Prüfung; liegt
 * „Gültig ab“ mehr als 30 Tage nach dem Freigabetag, fragt der Dialog nach.
 * Fehlermeldungen stehen rot direkt am betroffenen Feld (aria-invalid).
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
  /** Meldung am betroffenen Feld; „trotzdem“ am Kontrollkästchen, ohne Feld (Fehler beim Freigeben) unten über den Knöpfen */
  const [meldung, setMeldung] = useState<{ feld: FreigabeFeld | 'trotzdem' | null; text: string } | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const meldungAm = (feld: FreigabeFeld | 'trotzdem' | null) => (meldung?.feld === feld ? meldung.text : null)
  // Eine Änderung am betroffenen Feld nimmt seine Meldung weg
  const aendere = (x: Partial<FreigabeEingaben>) => {
    setE({ ...e, ...x })
    if (meldung?.feld && meldung.feld in x) setMeldung(null)
  }

  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
  }, [])

  const id = (feld: FreigabeFeld) => `${feldId}-${feld}`
  const fokus = (feld: FreigabeFeld) => document.getElementById(id(feld))?.focus()
  const trotzdemId = `${feldId}-trotzdem`

  const absenden = async (ev: FormEvent) => {
    ev.preventDefault()
    const f = freigabeFehler(c, e, heute)
    if (f) {
      setMeldung(f)
      fokus(f.feld)
      return
    }
    if (fehler > 0 && !trotzdem) {
      setMeldung({ feld: 'trotzdem', text: 'Bitte „Trotzdem freigeben“ bestätigen oder die Fehler zuerst beheben.' })
      document.getElementById(trotzdemId)?.focus()
      return
    }
    setMeldung(null)
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
      setMeldung({ feld: null, text: err instanceof Error ? err.message : String(err) })
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
          <TextFeld label="Bezeichnung" id={id('bezeichnung')} wert={e.bezeichnung} fehler={meldungAm('bezeichnung')} onAendern={(bezeichnung) => aendere({ bezeichnung })} />
          <CFeld label="Gültig ab" id={id('gueltigAb')}>
            {(fid) => (
              <>
                <DatumEingabe id={fid} wert={e.gueltigAb} ungueltig={!!meldungAm('gueltigAb')} onAendern={(d) => aendere({ gueltigAb: d ?? '' })} />
                {/* die Meldung direkt unter dem Feld, die Hilfe zu Frühestens und Spätestens darunter */}
                <FeldMeldung feldId={fid} text={meldungAm('gueltigAb')} />
                <p className="feld-hilfe">{datumHilfe}</p>
              </>
            )}
          </CFeld>
        </div>
        <TextFeld label="Freigegeben von" id={id('freigegebenVon')} wert={e.freigegebenVon} fehler={meldungAm('freigegebenVon')} onAendern={(freigegebenVon) => aendere({ freigegebenVon })} />
        <TextFeld
          label="Inhalt der Änderung"
          id={id('aenderung')}
          mehrzeilig
          wert={e.aenderung}
          fehler={meldungAm('aenderung')}
          platzhalter={letzte ? 'z. B. Rechnung wird jetzt zusätzlich von der Buchhaltung geprüft' : undefined}
          hilfe={
            letzte
              ? geaendert.length > 0
                ? `Geänderte Kapitel: ${kapitelText(geaendert)} (werden automatisch eingetragen)`
                : `Seit Version ${letzte.bezeichnung} hat sich kein Kapitel geändert.`
              : undefined
          }
          onAendern={(aenderung) => aendere({ aenderung })}
        />
        <div className="feldreihe">
          <TextFeld
            label="Fachlich geprüft von"
            id={id('geprueftVon')}
            wert={e.geprueftVon ?? ''}
            platzhalter="z. B. Steuerberatung Muster"
            fehler={meldungAm('geprueftVon')}
            onAendern={(geprueftVon) => aendere({ geprueftVon })}
          />
          <CFeld label="Geprüft am" id={id('geprueftAm')} fehler={meldungAm('geprueftAm')}>
            {(fid) => <DatumEingabe id={fid} wert={e.geprueftAm ?? null} ungueltig={!!meldungAm('geprueftAm')} onAendern={(geprueftAm) => aendere({ geprueftAm })} />}
          </CFeld>
        </div>
        <p className="feld-hilfe">Optional. Wer die Fassung vor der Freigabe fachlich geprüft hat, steht auf dem Deckblatt und in der Änderungshistorie.</p>
        <p>
          Freigegeben am: <strong>{formatiereDatum(heute)}</strong>
        </p>
        {fehler > 0 && (
          <div className="banner banner-fehler">
            <p>{fehler === 1 ? 'Es gibt 1 Fehler.' : `Es gibt ${fehler} Fehler.`} Eine Freigabe ist trotzdem möglich; die Dokumente nennen dann Angaben, die nicht stimmen können.</p>
            <label className="kontrollkaestchen">
              <input
                id={trotzdemId}
                type="checkbox"
                checked={trotzdem}
                aria-invalid={meldungAm('trotzdem') ? true : undefined}
                aria-describedby={meldungAm('trotzdem') ? `${trotzdemId}-meldung` : undefined}
                onChange={(ev) => {
                  setTrotzdem(ev.target.checked)
                  if (meldung?.feld === 'trotzdem') setMeldung(null)
                }}
              />{' '}
              Trotzdem freigeben
            </label>
            <FeldMeldung feldId={trotzdemId} text={meldungAm('trotzdem')} />
          </div>
        )}
        {meldung && meldung.feld === null && (
          <p className="feld-meldung" role="alert">
            {meldung.text}
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
