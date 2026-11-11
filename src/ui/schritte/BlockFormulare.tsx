import { useState } from 'react'
import { useBestaetigen } from '../frage'
import { neuerOderZweig, neueRolle, neuesMedium, neueSequenz, neuerZweig } from '../../modell/bausteine'
import { blockTitel, freigabeAusgang } from '../../modell/operationen'
import { istObjektVerbName } from '../../modell/pruefung'
import type { RuecksprungZiel } from '../../modell/operationen'
import { MEDIUM_ARTEN, type Aufgabe, type Block, type Entscheidung, type EntscheidungsZweig, type Id, type MediumArt, type Oder, type OderZweig, type Parallel, type Warten, type Wiederholung } from '../../modell/typen'
import { formatiereProzent } from '../../modell/zeit'
import { Auswahl, Feld, ProzentEingabe, ZeitEingabe } from '../Eingaben'
import { useApp } from '../kontext'
import { Kreuz, Symbol } from '../Symbol'

/** Wie es nach einem Ausgang weitergeht. */
export type Danach = { art: 'weiter' } | { art: 'ende' } | { art: 'zurueck'; zielId: Id }

export interface FormularKontext {
  vorgaenger: Block | null
  /** Block direkt danach, falls bekannt (z. B. die Entscheidung nach einer Freigabe) */
  nachfolger?: Block | null
  inParallele: boolean
  neu: boolean
  /** Mögliche Ziele für „zurück zu …“ */
  ziele?: RuecksprungZiel[]
  /**
   * Ändert, wie es nach einem Ausgang weitergeht. Bei bestehenden Entscheidungen
   * verändert ein Rücksprung die Struktur; das übernimmt der Aufrufer. Ohne
   * Rückruf (neuer Entwurf) merkt sich das Formular das Ziel im Ausgang.
   */
  setzeDanach?: (zweigId: Id, danach: Danach) => void
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
    case 'oder':
      return <OderFormular block={block} onAendern={onAendern} kontext={kontext} />
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
  // Folgt eine Entscheidung, bestimmt deren „freigegeben“-Ausgang die Quote (siehe freigabeQuote).
  const naechste = kontext.nachfolger?.typ === 'entscheidung' ? kontext.nachfolger : null
  const ausgang = naechste ? freigabeAusgang(naechste) : null
  const folge = naechste && ausgang ? { entscheidung: naechste, ausgang } : null

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
      <div className="feldreihe">
        <TeilnehmerWahl label="Schickt der Schritt etwas an jemand Externen?" keinText="Nein" wert={a.nachrichtAn} onAendern={(nachrichtAn) => setze({ nachrichtAn })} />
        <TeilnehmerWahl
          label="Bekommt der Schritt etwas von jemand Externem?"
          hilfe="z. B. Unterlagen, die bei der Bearbeitung eingehen. Wartet der Ablauf nur auf eine Antwort, ohne dabei etwas zu tun, nimm stattdessen den Baustein „Warten“."
          keinText="Nein"
          wert={a.nachrichtVon}
          onAendern={(nachrichtVon) => setze({ nachrichtVon })}
        />
      </div>
      {a.art === 'freigabe' && (folge ? (
        <p className="feld-hilfe">
          Wie oft freigegeben wird, ergibt sich aus der folgenden Entscheidung „{blockTitel(folge.entscheidung)}“: Ausgang „{folge.ausgang.bezeichnung}“ mit{' '}
          {formatiereProzent(folge.ausgang.anteil)}.
        </p>
      ) : (
        <Feld label="In wie viel Prozent der Fälle wird freigegeben?" hilfe="Was bei einer Ablehnung passiert, zeigt eine Entscheidung direkt danach.">
          {(id) => <ProzentEingabe id={id} anteil={a.freigabeQuote} onAendern={(freigabeQuote) => setze({ freigabeQuote })} />}
        </Feld>
      ))}
    </>
  )
}

function danachVon(z: EntscheidungsZweig): string {
  if (z.ende !== null) return 'ende'
  if (z.zurueckZu !== null) return `zurueck:${z.zurueckZu}`
  return 'weiter'
}

function EntscheidungFormular({ block: e, onAendern, kontext }: Props<Entscheidung>) {
  const { p } = useApp()
  const bestaetige = useBestaetigen()
  const summe = e.zweige.reduce((s, z) => s + z.anteil, 0)
  const passt = Math.abs(summe - 1) < 1e-6
  const ereignisse = e.art === 'ereignis'
  const setzeZweig = (id: Id, w: Partial<EntscheidungsZweig>) => onAendern({ ...e, zweige: e.zweige.map((z) => (z.id === id ? { ...z, ...w } : z)) })
  const verteile = () => {
    const n = e.zweige.length
    onAendern({ ...e, zweige: e.zweige.map((z) => ({ ...z, anteil: summe > 0 ? z.anteil / summe : 1 / n })) })
  }
  const danach = (z: EntscheidungsZweig, wert: string) => {
    const d: Danach = wert === 'ende' ? { art: 'ende' } : wert.startsWith('zurueck:') ? { art: 'zurueck', zielId: wert.slice(8) } : { art: 'weiter' }
    if (kontext.setzeDanach) return kontext.setzeDanach(z.id, d)
    setzeZweig(z.id, { ende: d.art === 'ende' ? (z.ende ?? '') : null, zurueckZu: d.art === 'zurueck' ? d.zielId : null })
  }
  const ziele = kontext.ziele ?? []
  return (
    <>
      <Auswahl
        label="Wovon hängt ab, wie es weitergeht?"
        wert={e.art}
        spalten={2}
        optionen={[
          { wert: 'daten', text: 'Von einer Prüfung oder Angabe', beschreibung: 'z. B. „Ware vorrätig?“', symbol: <Symbol art="xor" groesse={24} /> },
          { wert: 'ereignis', text: 'Davon, was zuerst passiert', beschreibung: 'z. B. Antwort oder Frist', symbol: <Symbol art="ereignisgateway" groesse={24} /> },
        ]}
        onAendern={(art) =>
          onAendern({
            ...e,
            art,
            zweige: e.zweige.map((z) => ({ ...z, ereignis: art === 'ereignis' ? (z.ereignis ?? { art: 'nachricht', dauerMin: 60 * p.arbeitsstundenProTag }) : null })),
          })
        }
      />
      <Feld
        label={ereignisse ? 'Worauf wird gewartet?' : 'Welche Frage wird entschieden?'}
        hilfe={ereignisse ? 'z. B. „Antwort des Kunden?“' : 'Als Frage mit Fragezeichen, z. B. „Ware vorrätig?“.'}
      >
        {(id) => (
          <input
            id={id}
            type="text"
            autoFocus={kontext.neu}
            value={e.frage}
            placeholder={ereignisse ? 'z. B. Antwort des Kunden?' : 'z. B. Ware vorrätig?'}
            onChange={(ev) => onAendern({ ...e, frage: ev.target.value })}
          />
        )}
      </Feld>
      <fieldset className="zweige">
        <legend>{ereignisse ? 'Was kann zuerst passieren, und wie oft?' : 'Welche Ausgänge gibt es, und wie oft kommen sie vor?'}</legend>
        {e.zweige.map((z, i) => {
          const name = z.bezeichnung || (ereignisse ? `Ereignis ${i + 1}` : `Antwort ${i + 1}`)
          return (
            <div key={z.id} className="zweig-block">
              <div className="zweig-zeile">
                <input
                  type="text"
                  aria-label={ereignisse ? `Ereignis ${i + 1}` : `Antwort ${i + 1}`}
                  value={z.bezeichnung}
                  placeholder={ereignisse ? 'z. B. Korrektur erhalten' : `Antwort ${i + 1}`}
                  onChange={(ev) => setzeZweig(z.id, { bezeichnung: ev.target.value })}
                />
                <ProzentEingabe ariaLabel={`Anteil von „${name}“`} anteil={z.anteil} onAendern={(anteil) => setzeZweig(z.id, { anteil })} />
                {e.zweige.length > 2 && (
                  <button
                    type="button"
                    className="knopf-icon"
                    aria-label={`Ausgang „${name}“ entfernen`}
                    title="Ausgang entfernen"
                    onClick={async () => {
                      if (z.schritte.length > 0 && !(await bestaetige('Ausgang entfernen?', `Der Ausgang „${name}“ enthält ${z.schritte.length} Schritte. Sie werden mit entfernt.`, 'Mit Schritten entfernen'))) return
                      onAendern({ ...e, zweige: e.zweige.filter((x) => x.id !== z.id) })
                    }}
                  >
                    <Kreuz />
                  </button>
                )}
              </div>
              {ereignisse && z.ereignis && (
                <div className="zweig-zeile zweig-unter">
                  <select
                    aria-label={`Art von „${name}“`}
                    value={z.ereignis.art}
                    onChange={(ev) => {
                      const art = ev.target.value as 'zeit' | 'nachricht'
                      // Ein Absender gehört nur zu einer Nachricht
                      setzeZweig(z.id, { ereignis: { ...z.ereignis!, art, von: art === 'nachricht' ? z.ereignis!.von : null } })
                    }}
                  >
                    <option value="nachricht">Eine Nachricht kommt an</option>
                    <option value="zeit">Eine Frist läuft ab</option>
                  </select>
                  {z.ereignis.art === 'nachricht' && p.teilnehmer.length > 0 && (
                    <select aria-label={`Absender von „${name}“`} value={z.ereignis.von ?? ''} onChange={(ev) => setzeZweig(z.id, { ereignis: { ...z.ereignis!, von: ev.target.value || null } })}>
                      <option value="">von innerhalb</option>
                      {p.teilnehmer.map((t) => (
                        <option key={t.id} value={t.id}>
                          von {t.name || 'Unbenannt'}
                        </option>
                      ))}
                    </select>
                  )}
                  <span className="leise">nach im Schnitt</span>
                  <ZeitEingabe
                    ariaLabel={`Wartezeit bis „${name}“`}
                    wert={z.ereignis.dauerMin}
                    stundenProTag={p.arbeitsstundenProTag}
                    onAendern={(dauerMin) => setzeZweig(z.id, { ereignis: { ...z.ereignis!, dauerMin } })}
                  />
                </div>
              )}
              <div className="zweig-zeile zweig-unter">
                <label className="danach">
                  <span className="leise">Danach:</span>
                  <select aria-label={`Wie es nach „${name}“ weitergeht`} value={danachVon(z)} onChange={(ev) => danach(z, ev.target.value)}>
                    <option value="weiter">weiter im Ablauf</option>
                    {!kontext.inParallele && <option value="ende">Prozess endet</option>}
                    {!kontext.inParallele &&
                      ziele.map((t) => (
                        <option key={t.id} value={`zurueck:${t.id}`}>
                          zurück zu „{t.titel}“
                        </option>
                      ))}
                    {z.zurueckZu !== null && !ziele.some((t) => t.id === z.zurueckZu) && <option value={`zurueck:${z.zurueckZu}`}>zurück (Ziel nicht mehr gültig)</option>}
                  </select>
                </label>
                {z.ende !== null && (
                  <input
                    type="text"
                    className="zweig-ende"
                    aria-label={`Ergebnis, wenn „${name}“`}
                    value={z.ende}
                    placeholder="Mit welchem Ergebnis? z. B. Bestellung storniert"
                    onChange={(ev) => setzeZweig(z.id, { ende: ev.target.value })}
                  />
                )}
              </div>
            </div>
          )
        })}
        <div className={`summe${passt ? '' : ' summe-falsch'}`} aria-live="polite">
          Zusammen: {formatiereProzent(summe, 1)}
          {!passt && (
            <button type="button" className="knopf knopf-klein" onClick={verteile}>
              Auf 100 % verteilen
            </button>
          )}
        </div>
        <button
          type="button"
          className="knopf knopf-leise"
          onClick={() => onAendern({ ...e, zweige: [...e.zweige, neuerZweig('', 0, { ereignis: ereignisse ? { art: 'nachricht', dauerMin: 60 * p.arbeitsstundenProTag } : null })] })}
        >
          + Ausgang
        </button>
      </fieldset>
    </>
  )
}

function OderFormular({ block: o, onAendern, kontext }: Props<Oder>) {
  const bestaetige = useBestaetigen()
  const setzeZweig = (id: Id, w: Partial<OderZweig>) => onAendern({ ...o, zweige: o.zweige.map((z) => (z.id === id ? { ...z, ...w } : z)) })
  const andere = o.zweige.filter((z) => z.id !== o.standard)
  const standard = o.zweige.find((z) => z.id === o.standard) ?? null
  const keiner = andere.reduce((q, z) => q * (1 - Math.min(1, Math.max(0, z.anteil))), 1)
  const summeAndere = andere.reduce((s, z) => s + z.anteil, 0)
  const entferne = async (z: OderZweig, name: string) => {
    if (z.schritte.length > 0 && !(await bestaetige('Weg entfernen?', `Der Weg „${name}“ enthält ${z.schritte.length} Schritte. Sie werden mit entfernt.`, 'Mit Schritten entfernen'))) return
    onAendern({ ...o, zweige: o.zweige.filter((x) => x.id !== z.id), standard: o.standard === z.id ? null : o.standard })
  }
  return (
    <>
      <Feld label="Worum geht es?" hilfe="z. B. „Welche Unterlagen fehlen?“ oder „Wer muss zustimmen?“">
        {(id) => (
          <input id={id} type="text" autoFocus={kontext.neu} value={o.frage} placeholder="z. B. Welche Unterlagen fehlen?" onChange={(ev) => onAendern({ ...o, frage: ev.target.value })} />
        )}
      </Feld>
      <fieldset className="zweige">
        <legend>Welche Wege kommen in Frage, und wie oft kommt jeder vor?</legend>
        <p className="feld-hilfe">
          Jeder Anteil gilt für sich: 30 % heißt, in 30 von 100 Fällen läuft dieser Weg, egal was mit den anderen ist. Weil mehrere Wege zugleich laufen können, dürfen es zusammen
          mehr als 100 % sein.
        </p>
        {andere.map((z, i) => {
          const name = z.bezeichnung || `Weg ${i + 1}`
          return (
            <div key={z.id} className="zweig-zeile">
              <input type="text" aria-label={`Weg ${i + 1}`} value={z.bezeichnung} placeholder="z. B. Gehaltsnachweis fehlt" onChange={(ev) => setzeZweig(z.id, { bezeichnung: ev.target.value })} />
              <ProzentEingabe ariaLabel={`Anteil von „${name}“`} anteil={z.anteil} onAendern={(anteil) => setzeZweig(z.id, { anteil })} />
              {andere.length > 2 && (
                <button type="button" className="knopf-icon" aria-label={`Weg „${name}“ entfernen`} title="Weg entfernen" onClick={() => void entferne(z, name)}>
                  <Kreuz />
                </button>
              )}
            </div>
          )
        })}
        <button type="button" className="knopf knopf-leise" onClick={() => onAendern({ ...o, zweige: [...andere, neuerOderZweig('', 0.5), ...(standard ? [standard] : [])] })}>
          + Weg
        </button>
      </fieldset>
      <Auswahl
        label="Was passiert, wenn keiner dieser Wege zutrifft?"
        wert={standard ? 'standard' : 'nie'}
        spalten={2}
        optionen={[
          { wert: 'standard', text: 'Dafür gibt es einen eigenen Weg', beschreibung: `kommt in ${formatiereProzent(keiner)} der Fälle vor` },
          { wert: 'nie', text: 'Mindestens einer trifft immer zu' },
        ]}
        onAendern={async (w) => {
          if (w === 'standard' && !standard) {
            const neu = neuerOderZweig('Keiner davon', 0)
            onAendern({ ...o, zweige: [...o.zweige, neu], standard: neu.id })
          } else if (w === 'nie' && standard) {
            if (standard.schritte.length > 0 && !(await bestaetige('Weg entfernen?', `Der Weg „${standard.bezeichnung || 'Keiner davon'}“ enthält ${standard.schritte.length} Schritte. Sie werden mit entfernt.`, 'Mit Schritten entfernen'))) return
            onAendern({ ...o, zweige: o.zweige.filter((z) => z.id !== standard.id), standard: null })
          }
        }}
      />
      {standard && (
        <Feld label="Wie heißt dieser Weg?" hilfe="Er läuft nur, wenn keiner der anderen zutrifft; im Diagramm mit Querstrich.">
          {(id) => <input id={id} type="text" value={standard.bezeichnung} placeholder="z. B. Nichts fehlt" onChange={(ev) => setzeZweig(standard.id, { bezeichnung: ev.target.value })} />}
        </Feld>
      )}
      {!standard && (
        <p className={`summe${summeAndere < 1 - 1e-6 ? ' summe-falsch' : ''}`} role="status">
          Zusammen: {formatiereProzent(summeAndere, 1)}
          {summeAndere < 1 - 1e-6
            ? '. Wenn immer mindestens einer zutrifft, sind es mindestens 100 %.'
            : Math.abs(summeAndere - 1) < 1e-6
              ? '. Genau 100 %: Dann läuft immer nur einer, das ist eine Entscheidung (Entweder-oder).'
              : `. Mehrere Wege zugleich in etwa ${formatiereProzent(Math.min(1, summeAndere - 1))} der Fälle oder mehr.`}
        </p>
      )}
    </>
  )
}

function ParallelFormular({ block: b, onAendern }: Props<Parallel>) {
  const bestaetige = useBestaetigen()
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
              onClick={async () => {
                if (z.schritte.length > 0 && !(await bestaetige('Zweig entfernen?', `Zweig ${i + 1} enthält ${z.schritte.length} Schritte. Sie werden mit entfernt.`, 'Mit Schritten entfernen'))) return
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

/** Auswahl, wozu wiederholt wird; nur Nacharbeit gilt als Schwachstelle. */
export function ZweckWahl({ w, onAendern }: { w: Wiederholung; onAendern: (w: Wiederholung) => void }) {
  return (
    <Auswahl
      label="Wozu wird wiederholt?"
      wert={w.zweck ?? 'nacharbeit'}
      spalten={2}
      optionen={[
        { wert: 'nacharbeit', text: 'Korrektur', beschreibung: 'Fehler beheben, Nacharbeit' },
        { wert: 'menge', text: 'Mehrere Durchgänge', beschreibung: 'z. B. je Position, gewollt' },
      ]}
      onAendern={(zweck) => onAendern({ ...w, zweck })}
    />
  )
}

/** Auswahl eines externen Teilnehmers für eine Nachricht; erscheint nur, wenn es externe Beteiligte gibt. */
function TeilnehmerWahl({ label, hilfe, wert, onAendern, keinText }: { label: string; hilfe?: string; wert: Id | null | undefined; onAendern: (id: Id | null) => void; keinText: string }) {
  const { p } = useApp()
  if (p.teilnehmer.length === 0) return null
  return (
    <Feld label={label} hilfe={hilfe}>
      {(id) => (
        <select id={id} value={wert ?? ''} onChange={(e) => onAendern(e.target.value || null)}>
          <option value="">{keinText}</option>
          {p.teilnehmer.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name || 'Unbenannt'}
            </option>
          ))}
        </select>
      )}
    </Feld>
  )
}

function WiederholungFormular({ block: w, onAendern, kontext }: Props<Wiederholung>) {
  const mal = w.anteilWiederholung < 1 ? 1 / (1 - w.anteilWiederholung) : Infinity
  return (
    <>
      <ZweckWahl w={w} onAendern={onAendern} />
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
        onAendern={(art) => onAendern({ ...w, art, von: art === 'nachricht' ? w.von : null })}
      />
      <Feld label="Wie lange im Schnitt?">{(id) => <ZeitEingabe id={id} wert={w.dauerMin} stundenProTag={p.arbeitsstundenProTag} onAendern={(dauerMin) => onAendern({ ...w, dauerMin })} />}</Feld>
      {w.art === 'nachricht' && <TeilnehmerWahl label="Von wem kommt die Nachricht?" keinText="Von innerhalb (kein externer Beteiligter)" wert={w.von} onAendern={(von) => onAendern({ ...w, von })} />}
    </>
  )
}
