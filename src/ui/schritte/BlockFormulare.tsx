import { useState } from 'react'
import { neueRolle, neuesMedium, neueSequenz, neuerZweig } from '../../modell/bausteine'
import { blockTitel } from '../../modell/operationen'
import { istObjektVerbName } from '../../modell/pruefung'
import { MEDIUM_ARTEN, type Aufgabe, type Block, type Entscheidung, type Id, type MediumArt, type Parallel, type Warten, type Wiederholung } from '../../modell/typen'
import { formatiereProzent } from '../../modell/zeit'
import { Auswahl, Feld, ProzentEingabe, ZeitEingabe } from '../Eingaben'
import { useApp } from '../kontext'
import { Kreuz, Symbol } from '../Symbol'

export interface FormularKontext {
  vorgaenger: Block | null
  inParallele: boolean
  neu: boolean
}

interface Props<B extends Block> {
  block: B
  onAendern: (b: B) => void
  kontext: FormularKontext
}

export function BlockFormular({ block, onAendern, kontext }: Props<Block>) {
  switch (block.typ) {
    case 'aufgabe':
      return <AufgabeFormular block={block} onAendern={onAendern} kontext={kontext} />
    case 'entscheidung':
      return <EntscheidungFormular block={block} onAendern={onAendern} kontext={kontext} />
    case 'parallel':
      return <ParallelFormular block={block} onAendern={onAendern} kontext={kontext} />
    case 'wiederholung':
      return <WiederholungFormular block={block} onAendern={onAendern} kontext={kontext} />
    case 'warten':
      return <WartenFormular block={block} onAendern={onAendern} kontext={kontext} />
  }
}

// ---------------------------------------------------------------------------
// Auswahl von Rolle und System, mit Anlegen direkt im Formular

function RolleWahl({ wert, onAendern, label }: { wert: Id | null; onAendern: (id: Id) => void; label: string }) {
  const { p, aendere } = useApp()
  const [neu, setNeu] = useState<string | null>(null)
  const anlegen = () => {
    if (!neu?.trim()) return
    const rolle = neueRolle(neu.trim())
    aendere((q) => ({ ...q, rollen: [...q.rollen, rolle] }))
    onAendern(rolle.id)
    setNeu(null)
  }
  return (
    <Feld label={label}>
      {(id) =>
        neu === null ? (
          <select
            id={id}
            value={wert ?? ''}
            onChange={(e) => {
              if (e.target.value === '__neu__') setNeu('')
              else onAendern(e.target.value)
            }}
          >
            {wert === null && <option value="">Bitte wählen</option>}
            {p.rollen.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name || 'Unbenannte Rolle'}
              </option>
            ))}
            <option value="__neu__">+ Neue Rolle …</option>
          </select>
        ) : (
          <span className="inline-anlegen">
            <input
              id={id}
              type="text"
              autoFocus
              value={neu}
              placeholder="Name der Rolle"
              onChange={(e) => setNeu(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  anlegen()
                }
                if (e.key === 'Escape') setNeu(null)
              }}
            />
            <button type="button" className="knopf" onClick={anlegen}>
              Anlegen
            </button>
            <button type="button" className="knopf knopf-leise" onClick={() => setNeu(null)}>
              Abbrechen
            </button>
          </span>
        )
      }
    </Feld>
  )
}

function MediumWahl({ wert, onAendern, label, hilfe }: { wert: Id | null; onAendern: (id: Id) => void; label: string; hilfe?: string }) {
  const { p, aendere } = useApp()
  const [neu, setNeu] = useState<{ name: string; art: MediumArt } | null>(null)
  const anlegen = () => {
    if (!neu?.name.trim()) return
    const m = neuesMedium(neu.name.trim(), neu.art)
    aendere((q) => ({ ...q, medien: [...q.medien, m] }))
    onAendern(m.id)
    setNeu(null)
  }
  return (
    <Feld label={label} hilfe={hilfe}>
      {(id) =>
        neu === null ? (
          <select
            id={id}
            value={wert ?? ''}
            onChange={(e) => {
              if (e.target.value === '__neu__') setNeu({ name: '', art: 'fachanwendung' })
              else onAendern(e.target.value)
            }}
          >
            {wert === null && <option value="">Bitte wählen</option>}
            {p.medien.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || 'Unbenanntes System'}
              </option>
            ))}
            <option value="__neu__">+ Neues System …</option>
          </select>
        ) : (
          <span className="inline-anlegen">
            <input
              id={id}
              type="text"
              autoFocus
              value={neu.name}
              placeholder="z. B. Warenwirtschaft"
              onChange={(e) => setNeu({ ...neu, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  anlegen()
                }
                if (e.key === 'Escape') setNeu(null)
              }}
            />
            <select aria-label="Art des Systems" value={neu.art} onChange={(e) => setNeu({ ...neu, art: e.target.value as MediumArt })}>
              {MEDIUM_ARTEN.map((a) => (
                <option key={a.art} value={a.art}>
                  {a.name}
                </option>
              ))}
            </select>
            <button type="button" className="knopf" onClick={anlegen}>
              Anlegen
            </button>
          </span>
        )
      }
    </Feld>
  )
}

// ---------------------------------------------------------------------------

function AufgabeFormular({ block: a, onAendern, kontext }: Props<Aufgabe>) {
  const { p } = useApp()
  const std = p.arbeitsstundenProTag
  const setze = (w: Partial<Aufgabe>) => onAendern({ ...a, ...w })
  const tipp = a.name.trim() && !istObjektVerbName(a.name) ? 'Tipp: Objekt und Verb lesen sich am klarsten, z. B. „Rechnung prüfen“.' : 'Objekt und Verb, z. B. „Bestellung erfassen“.'
  const andereQuelle = p.medien.find((m) => m.id !== a.mediumId)?.id ?? null

  return (
    <>
      <Feld label="Was wird getan?" hilfe={tipp}>
        {(id) => <input id={id} type="text" autoFocus={kontext.neu} value={a.name} placeholder="z. B. Bestellung erfassen" onChange={(e) => setze({ name: e.target.value })} />}
      </Feld>
      <div className="feldreihe">
        <RolleWahl label="Wer erledigt das?" wert={a.rolleId} onAendern={(rolleId) => setze({ rolleId })} />
        <MediumWahl label="Womit?" wert={a.mediumId} onAendern={(mediumId) => setze({ mediumId })} />
      </div>
      <div className="feldreihe">
        <Feld label="Wie lange dauert die Bearbeitung?" hilfe="Reine Arbeitszeit im Schnitt.">
          {(id) => <ZeitEingabe id={id} wert={a.bearbeitungMin} stundenProTag={std} onAendern={(m) => setze({ bearbeitungMin: m })} />}
        </Feld>
        <Feld label="Wie lange liegt der Vorgang vorher?" hilfe="Wartezeit, bis jemand damit anfängt.">
          {(id) => <ZeitEingabe id={id} wert={a.liegezeitMin} stundenProTag={std} onAendern={(m) => setze({ liegezeitMin: m })} />}
        </Feld>
      </div>

      {kontext.vorgaenger && (
        <Auswahl
          label={`Braucht dieser Schritt das Ergebnis von „${blockTitel(kontext.vorgaenger)}“?`}
          wert={a.brauchtVorgaenger === null ? 'offen' : a.brauchtVorgaenger ? 'ja' : 'nein'}
          spalten={3}
          optionen={[
            { wert: 'ja', text: 'Ja' },
            { wert: 'nein', text: 'Nein' },
            { wert: 'offen', text: 'Weiß nicht' },
          ]}
          onAendern={(w) => setze({ brauchtVorgaenger: w === 'offen' ? null : w === 'ja' })}
        />
      )}

      <Auswahl
        label="Werden dafür Daten von Hand übertragen (abtippen, kopieren)?"
        wert={a.uebertragung ? 'ja' : 'nein'}
        spalten={2}
        optionen={[
          { wert: 'nein', text: 'Nein' },
          { wert: 'ja', text: 'Ja' },
        ]}
        onAendern={(w) => setze({ uebertragung: w === 'ja' ? { quelleMediumId: andereQuelle, minuten: Math.min(2, a.bearbeitungMin) } : null })}
      />
      {a.uebertragung && (
        <div className="feldreihe eingerueckt">
          <MediumWahl
            label="Woher kommen die Daten?"
            wert={a.uebertragung.quelleMediumId}
            onAendern={(quelleMediumId) => setze({ uebertragung: { ...a.uebertragung!, quelleMediumId } })}
          />
          <Feld label="Wie viel der Bearbeitungszeit entfällt darauf?">
            {(id) => <ZeitEingabe id={id} wert={a.uebertragung!.minuten} stundenProTag={std} onAendern={(minuten) => setze({ uebertragung: { ...a.uebertragung!, minuten } })} />}
          </Feld>
        </div>
      )}

      <Auswahl
        label="Art des Schritts"
        wert={a.art}
        spalten={3}
        optionen={[
          { wert: 'normal', text: 'Normale Aufgabe' },
          { wert: 'pruefung', text: 'Prüfung', beschreibung: 'Kontrolle' },
          { wert: 'freigabe', text: 'Freigabe', beschreibung: 'Genehmigung' },
        ]}
        onAendern={(art) => setze({ art })}
      />
      {a.art === 'freigabe' && (
        <Feld label="In wie viel Prozent der Fälle wird freigegeben?">
          {(id) => <ProzentEingabe id={id} anteil={a.freigabeQuote} onAendern={(freigabeQuote) => setze({ freigabeQuote })} />}
        </Feld>
      )}
    </>
  )
}

function EntscheidungFormular({ block: e, onAendern, kontext }: Props<Entscheidung>) {
  const summe = e.zweige.reduce((s, z) => s + z.anteil, 0)
  const passt = Math.abs(summe - 1) < 1e-6
  const setzeZweig = (id: Id, w: Partial<Entscheidung['zweige'][number]>) => onAendern({ ...e, zweige: e.zweige.map((z) => (z.id === id ? { ...z, ...w } : z)) })
  const verteile = () => {
    const n = e.zweige.length
    onAendern({ ...e, zweige: e.zweige.map((z) => ({ ...z, anteil: summe > 0 ? z.anteil / summe : 1 / n })) })
  }
  return (
    <>
      <Feld label="Welche Frage wird entschieden?" hilfe="Als Frage mit Fragezeichen, z. B. „Ware vorrätig?“.">
        {(id) => <input id={id} type="text" autoFocus={kontext.neu} value={e.frage} placeholder="z. B. Ware vorrätig?" onChange={(ev) => onAendern({ ...e, frage: ev.target.value })} />}
      </Feld>
      <fieldset className="zweige">
        <legend>Welche Ausgänge gibt es, und wie oft kommen sie vor?</legend>
        {e.zweige.map((z, i) => (
          <div key={z.id} className="zweig-zeile">
            <input type="text" aria-label={`Antwort ${i + 1}`} value={z.bezeichnung} placeholder={`Antwort ${i + 1}`} onChange={(ev) => setzeZweig(z.id, { bezeichnung: ev.target.value })} />
            <ProzentEingabe ariaLabel={`Anteil von „${z.bezeichnung || `Antwort ${i + 1}`}“`} anteil={z.anteil} onAendern={(anteil) => setzeZweig(z.id, { anteil })} />
            {!kontext.inParallele && (
              <label className="kontroll">
                <input type="checkbox" checked={z.ende !== null} onChange={(ev) => setzeZweig(z.id, { ende: ev.target.checked ? '' : null })} />
                endet den Prozess
              </label>
            )}
            {e.zweige.length > 2 && (
              <button
                type="button"
                className="knopf-icon"
                aria-label={`Ausgang „${z.bezeichnung || i + 1}“ entfernen`}
                title="Ausgang entfernen"
                onClick={() => {
                  if (z.schritte.length > 0 && !window.confirm(`Der Ausgang „${z.bezeichnung}“ enthält ${z.schritte.length} Schritte. Mit entfernen?`)) return
                  onAendern({ ...e, zweige: e.zweige.filter((x) => x.id !== z.id) })
                }}
              >
                <Kreuz />
              </button>
            )}
            {z.ende !== null && (
              <input
                type="text"
                className="zweig-ende"
                aria-label={`Ergebnis, wenn „${z.bezeichnung}“`}
                value={z.ende}
                placeholder="Mit welchem Ergebnis? z. B. Bestellung storniert"
                onChange={(ev) => setzeZweig(z.id, { ende: ev.target.value })}
              />
            )}
          </div>
        ))}
        <div className={`summe${passt ? '' : ' summe-falsch'}`} aria-live="polite">
          Zusammen: {formatiereProzent(summe, 1)}
          {!passt && (
            <button type="button" className="knopf knopf-klein" onClick={verteile}>
              Auf 100 % verteilen
            </button>
          )}
        </div>
        <button type="button" className="knopf knopf-leise" onClick={() => onAendern({ ...e, zweige: [...e.zweige, neuerZweig('', 0)] })}>
          + Ausgang
        </button>
      </fieldset>
    </>
  )
}

function ParallelFormular({ block: b, onAendern }: Props<Parallel>) {
  return (
    <fieldset className="zweige">
      <legend>Zweige, die gleichzeitig laufen</legend>
      {b.zweige.map((z, i) => (
        <div key={z.id} className="zweig-zeile">
          <Symbol art="und" groesse={20} />
          <span>Zweig {i + 1}</span>
          <span className="leise">{z.schritte.length === 1 ? '1 Schritt' : `${z.schritte.length} Schritte`}</span>
          {b.zweige.length > 2 && (
            <button
              type="button"
              className="knopf-icon"
              aria-label={`Zweig ${i + 1} entfernen`}
              title="Zweig entfernen"
              onClick={() => {
                if (z.schritte.length > 0 && !window.confirm(`Zweig ${i + 1} enthält ${z.schritte.length} Schritte. Mit entfernen?`)) return
                onAendern({ ...b, zweige: b.zweige.filter((x) => x.id !== z.id) })
              }}
            >
              <Kreuz />
            </button>
          )}
        </div>
      ))}
      <button type="button" className="knopf knopf-leise" onClick={() => onAendern({ ...b, zweige: [...b.zweige, neueSequenz()] })}>
        + Zweig
      </button>
    </fieldset>
  )
}

function WiederholungFormular({ block: w, onAendern, kontext }: Props<Wiederholung>) {
  const mal = w.anteilWiederholung < 1 ? 1 / (1 - w.anteilWiederholung) : Infinity
  return (
    <>
      <Feld label="Welche Frage entscheidet nach jedem Durchlauf, ob wiederholt wird?" hilfe="„Ja“ heißt: noch einmal. Z. B. „Nacharbeit nötig?“">
        {(id) => <input id={id} type="text" autoFocus={kontext.neu} value={w.frage} onChange={(e) => onAendern({ ...w, frage: e.target.value })} />}
      </Feld>
      <Feld
        label="In wie viel Prozent der Durchläufe wird wiederholt?"
        hilfe={Number.isFinite(mal) ? `Die Schritte laufen dann im Schnitt ${mal.toLocaleString('de-DE', { maximumFractionDigits: 2 })}-mal.` : 'Bei 100 % endet die Wiederholung nie.'}
      >
        {(id) => <ProzentEingabe id={id} anteil={w.anteilWiederholung} max={99} onAendern={(anteilWiederholung) => onAendern({ ...w, anteilWiederholung })} />}
      </Feld>
    </>
  )
}

function WartenFormular({ block: w, onAendern, kontext }: Props<Warten>) {
  const { p } = useApp()
  return (
    <>
      <Feld label="Worauf wird gewartet?" hilfe="z. B. „Lieferung abwarten“ oder „Bis zum nächsten Morgen warten“.">
        {(id) => <input id={id} type="text" autoFocus={kontext.neu} value={w.name} onChange={(e) => onAendern({ ...w, name: e.target.value })} />}
      </Feld>
      <Auswahl
        label="Art"
        wert={w.art}
        spalten={2}
        optionen={[
          { wert: 'zeit', text: 'Auf einen Zeitpunkt', symbol: <Symbol art="warten-zeit" groesse={24} /> },
          { wert: 'nachricht', text: 'Auf eine Nachricht', symbol: <Symbol art="warten-nachricht" groesse={24} /> },
        ]}
        onAendern={(art) => onAendern({ ...w, art })}
      />
      <Feld label="Wie lange im Schnitt?">{(id) => <ZeitEingabe id={id} wert={w.dauerMin} stundenProTag={p.arbeitsstundenProTag} onAendern={(dauerMin) => onAendern({ ...w, dauerMin })} />}</Feld>
    </>
  )
}
