import { useState } from 'react'
import { useBestaetigen } from '../frage'
import { neuerOderZweig, neueRolle, neuerTeilnehmer, neuesMedium, neueSequenz, neueUnterbrechung, neuerZweig } from '../../modell/bausteine'
import { alsMarkierteAufgabe, blockTitel, freigabeAusgang, rolleName } from '../../modell/operationen'
import { istObjektVerbName } from '../../modell/pruefung'
import type { RuecksprungZiel } from '../../modell/operationen'
import {
  MEDIUM_ARTEN,
  unerwartet,
  type Aufgabe,
  type Block,
  type Entscheidung,
  type EntscheidungsZweig,
  type Id,
  type MediumArt,
  type Mehrfach,
  type NachrichtZeitpunkt,
  type Oder,
  type OderZweig,
  type Parallel,
  type Teilprozess,
  type Unterbrechbar,
  type Unterbrechung,
  type Warten,
  type Wiederholung,
} from '../../modell/typen'
import { formatiereDauer, formatiereProzent, formatiereZahl } from '../../modell/zeit'
import { zuerstFertig } from '../../analyse/verteilung'
import { Auswahl, Feld, ProzentEingabe, ZahlEingabe, ZeitEingabe } from '../Eingaben'
import { useApp } from '../kontext'
import { Lernhinweis } from '../Lernhinweis'
import { Kreuz, Symbol, type SymbolArt } from '../Symbol'

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
  /** Nur Rahmen (Abschnitt, für jedes Stück): Name der Bahn, in der er im Diagramm steht (null, solange er keine Aufgabe enthält) */
  rahmenBahn?: string | null
  /** Innerster Baustein „für jedes Stück“, in dessen Körper der Schritt liegt (für die Fragen zur Wartezeit) */
  mehrfach?: Mehrfach | null
  /** Steht der Schritt als erster direkt in diesem Körper? */
  ersterImKoerper?: boolean
  /** Nur bestehender Abschnitt: löst ihn auf, seine Schritte stehen danach wieder in der Folge */
  loeseAuf?: () => void
  /** Unterbrechungen: Ziele für „zurück zu …“ (ohne den Schritt selbst) */
  unterbrechungZiele?: RuecksprungZiel[]
  /** Unterbrechungen: Ziel für „noch einmal von vorn“ (der Schritt selbst oder der Bereich, der mit ihm beginnt) */
  vonVornZiel?: Id | null
  /** Ändert, wie es nach einer Unterbrechung weitergeht; bei bestehenden Schritten ändert ein Rücksprung die Struktur. */
  setzeUnterbrechungDanach?: (unterbrechungId: Id, danach: Danach) => void
  /** Wie oft der Schritt je Vorgang läuft, falls bekannt (für „bei Ø 2 Ausführungen …“) */
  haeufigkeit?: number
  /** Setzt die Einfügeposition in den Ausnahmeweg (bestehende Schritte) */
  oeffneWeg?: (unterbrechungId: Id) => void
  /** „Gilt für die ganze Liste“: hängt die Unterbrechung an den umgebenden Baustein „für jedes Stück“ */
  fuerListe?: { name: string; anwenden: (unterbrechungId: Id) => void }
  /** „Gilt für mehrere Schritte“: mögliche letzte Schritte des neuen Abschnitts und das Zusammenfassen */
  fuerMehrere?: { bis: { index: number; titel: string }[]; anwenden: (unterbrechungId: Id, bis: number, name: string) => void }
}

/** Setzt die Unterbrechungen eines Schritts; ohne Unterbrechungen fällt das Feld weg. */
function mitUnterbrechungen<B extends Unterbrechbar>(b: B, liste: Unterbrechung[]): B {
  if (liste.length > 0) return { ...b, unterbrechungen: liste }
  const { unterbrechungen: _weg, ...ohne } = b
  return ohne as B
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
    case 'teilprozess':
      return <TeilprozessFormular block={block} onAendern={onAendern} kontext={kontext} />
    case 'mehrfach':
      return <MehrfachFormular block={block} onAendern={onAendern} kontext={kontext} />
    default:
      return unerwartet(block)
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
  // In „für jedes Stück“ zählt die Liegezeit vor dem ersten Stück einmal am Baustein; hier geht es um die Wartezeit je Stück.
  const mf = kontext.mehrfach ?? null
  const liegeLabel = mf ? (mf.ausfuehrung === 'nacheinander' && kontext.ersterImKoerper ? 'Wartezeit zwischen zwei Stücken' : 'Wartezeit je Stück') : 'Wie lange liegt der Vorgang vorher?'
  const liegeHilfe = mf ? `Bis jemand mit dem ersten Stück anfängt, zählt bei „${blockTitel(mf)}“ einmal.` : 'Wartezeit, bis jemand damit anfängt.'
  const bearbeitungHilfe = mf ? `Je Stück. Liegezeit zählt einmal, Bearbeitung je Stück: ${formatiereZahl(mf.anzahl, 1)} × ${formatiereDauer(a.bearbeitungMin, std)}.` : 'Reine Arbeitszeit im Schnitt.'

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
        <Feld label="Wie lange dauert die Bearbeitung?" hilfe={bearbeitungHilfe}>
          {(id) => <ZeitEingabe id={id} wert={a.bearbeitungMin} stundenProTag={std} onAendern={(m) => setze({ bearbeitungMin: m })} />}
        </Feld>
        <Feld label={liegeLabel} hilfe={liegeHilfe}>
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
      <UnterbrechungenFeld schritt={a} onAendern={(liste) => onAendern(mitUnterbrechungen(a, liste))} kontext={kontext} />
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

/**
 * Mehrere Dinge unabhängig voneinander: „Wann geht es weiter?“ (alle fertig
 * oder beim ersten) und nur bei „alle“ „Wer erledigt die Zweige?“ (zur selben
 * Zeit oder eine Person nacheinander). Daraus folgt die Art.
 */
function ParallelFormular({ block: b, onAendern, kontext }: Props<Parallel>) {
  const bestaetige = useBestaetigen()
  const weiter = b.art === 'erster' ? 'erster' : 'alle'
  const wer = b.art === 'nacheinander' ? 'nacheinander' : 'gleichzeitig'
  const bahn = kontext.rahmenBahn
  // Wie oft jeder Zweig zuerst fertig ist, sobald alle Zweige Schritte haben
  const zuerst = b.art === 'erster' && b.zweige.length >= 2 && b.zweige.every((z) => z.schritte.length > 0) ? zuerstFertig(b) : null
  const legende = b.art === 'alle' ? 'Zweige, die gleichzeitig laufen' : b.art === 'erster' ? 'Zweige, die gleichzeitig laufen, bis einer fertig ist' : 'Zweige, die eine Person nacheinander erledigt'
  const symbol: SymbolArt = b.art === 'alle' ? 'und' : b.art === 'erster' ? 'erster' : 'adhoc'
  return (
    <>
      <Auswahl
        label="Wann geht es weiter?"
        wert={weiter}
        spalten={2}
        optionen={[
          { wert: 'alle', text: 'Wenn alle fertig sind' },
          { wert: 'erster', text: 'Sobald eins fertig ist', beschreibung: 'die anderen werden abgebrochen' },
        ]}
        onAendern={(w) => onAendern({ ...b, art: w === 'erster' ? 'erster' : wer === 'nacheinander' ? 'nacheinander' : 'alle' })}
      />
      {weiter === 'alle' && (
        <Auswahl
          label="Wer erledigt die Zweige?"
          wert={wer}
          spalten={2}
          optionen={[
            { wert: 'gleichzeitig', text: 'Zur selben Zeit', beschreibung: 'mehrere Leute oder Stellen arbeiten daran', symbol: <Symbol art="und" groesse={24} /> },
            { wert: 'nacheinander', text: 'Eine Person nacheinander, Reihenfolge egal', symbol: <Symbol art="adhoc" groesse={24} /> },
          ]}
          onAendern={(w) => onAendern({ ...b, art: w === 'nacheinander' ? 'nacheinander' : 'alle' })}
        />
      )}
      <p className="feld-hilfe">Hängt es davon ab, was von außen zuerst passiert (Antwort, Frist)? Dann ist es eine Entscheidung „was zuerst passiert“.</p>
      {b.art !== 'alle' && (
        <p className="feld-hilfe">
          {bahn
            ? `Im Diagramm stehen alle Zweige in einem Rahmen in der Bahn „${bahn}“; Schritte anderer Rollen tragen die Rolle in Klammern.`
            : 'Im Diagramm stehen alle Zweige in einem Rahmen in einer Bahn, der Rolle mit den meisten Schritten darin; Schritte anderer Rollen tragen die Rolle in Klammern.'}
          {b.art === 'nacheinander' && ' Gerechnet wird in der Reihenfolge der Liste.'}
        </p>
      )}
      <ParallelZweige b={b} onAendern={onAendern} legende={legende} symbol={symbol} zuerst={zuerst} bestaetige={bestaetige} />
    </>
  )
}

function ParallelZweige({ b, onAendern, legende, symbol, zuerst, bestaetige }: { b: Parallel; onAendern: (b: Parallel) => void; legende: string; symbol: SymbolArt; zuerst: number[] | null; bestaetige: ReturnType<typeof useBestaetigen> }) {
  return (
    <fieldset className="zweige">
      <legend>{legende}</legend>
      {b.zweige.map((z, i) => (
        <div key={z.id} className="zweig-zeile">
          <Symbol art={symbol} groesse={20} />
          <span>Zweig {i + 1}</span>
          <span className="leise">
            {z.schritte.length === 1 ? '1 Schritt' : `${z.schritte.length} Schritte`}
            {zuerst && ` · zuerst fertig in ${formatiereProzent(zuerst[i])} der Fälle`}
          </span>
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

/**
 * Wozu wiederholt wird; nur Nacharbeit gilt als Schwachstelle. „Mehrere
 * Durchgänge“ gibt es nur noch für Wiederholungen, die es schon tragen; für
 * neue verweist der Hinweis auf „Etwas für jedes Stück einer Liste“.
 */
export function ZweckWahl({ w, onAendern }: { w: Wiederholung; onAendern: (w: Wiederholung) => void }) {
  if (w.zweck !== 'menge') {
    return <p className="feld-hilfe">Für mehrere gleiche Durchgänge, z. B. je Position, gibt es den Baustein „Etwas für jedes Stück einer Liste“.</p>
  }
  return (
    <>
      <Auswahl
        label="Wozu wird wiederholt?"
        wert={w.zweck}
        spalten={2}
        optionen={[
          { wert: 'nacharbeit', text: 'Korrektur', beschreibung: 'Fehler beheben, Nacharbeit' },
          { wert: 'menge', text: 'Mehrere Durchgänge', beschreibung: 'z. B. je Position, gewollt' },
        ]}
        onAendern={(zweck) => onAendern({ ...w, zweck })}
      />
      <p className="feld-hilfe">Mehrere gleiche Durchgänge bildet der Baustein „Etwas für jedes Stück einer Liste“ besser ab. Unter „Prüfen“ lässt sich diese Wiederholung umwandeln; die Zahlen bleiben gleich.</p>
    </>
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

function TeilprozessFormular({ block: t, onAendern, kontext }: Props<Teilprozess>) {
  const bahn = kontext.rahmenBahn
  return (
    <>
      <Feld label="Wie heißt der Abschnitt?" hilfe="Was darin erledigt wird, z. B. „Ware versenden“. Der Name steht im Diagramm oben im Rahmen.">
        {(id) => <input id={id} type="text" autoFocus={kontext.neu} value={t.name} placeholder="z. B. Ware versenden" onChange={(e) => onAendern({ ...t, name: e.target.value })} />}
      </Feld>
      <p className="feld-hilfe">
        {bahn
          ? `Im Diagramm stehen alle Schritte dieses Abschnitts in der Bahn „${bahn}“; Schritte anderer Rollen tragen die Rolle in Klammern.`
          : 'Im Diagramm steht der Abschnitt mit allen Schritten in einer Bahn, der Rolle mit den meisten Schritten darin; Schritte anderer Rollen tragen die Rolle in Klammern.'}
      </p>
      {kontext.loeseAuf && (
        <div className="knopfreihe">
          <button type="button" className="knopf knopf-leise" onClick={kontext.loeseAuf}>
            Abschnitt auflösen
          </button>
          <span className="leise">Die Schritte bleiben, nur der Rahmen fällt weg.</span>
        </div>
      )}
      <UnterbrechungenFeld schritt={t} onAendern={(liste) => onAendern(mitUnterbrechungen(t, liste))} kontext={kontext} />
    </>
  )
}

function MehrfachFormular({ block: m, onAendern, kontext }: Props<Mehrfach>) {
  const { p } = useApp()
  const std = p.arbeitsstundenProTag
  const setze = (w: Partial<Mehrfach>) => onAendern({ ...m, ...w })
  const einzeln = alsMarkierteAufgabe(m)
  const bahn = kontext.rahmenBahn
  return (
    <>
      <Feld label="Wofür?" hilfe="Was ist das einzelne Stück? Z. B. „Für jede Position“, „Für jeden Lieferanten“, „Für jeden Beleg“.">
        {(id) => <input id={id} type="text" autoFocus={kontext.neu} value={m.name} placeholder="z. B. Für jede Position" onChange={(e) => setze({ name: e.target.value })} />}
      </Feld>
      <Feld
        label="Wie viele hat ein einzelner Vorgang im Schnitt?"
        hilfe={p.vorgaengeProTag > 0 ? `Bei ${formatiereZahl(p.vorgaengeProTag, 1)} Vorgängen am Tag sind das ${formatiereZahl(p.vorgaengeProTag * m.anzahl, 1)} am Tag.` : undefined}
      >
        {(id) => <ZahlEingabe id={id} wert={m.anzahl} min={0} max={1000} onAendern={(anzahl) => setze({ anzahl })} />}
      </Feld>
      <Auswahl
        label="Sind es immer etwa gleich viele?"
        wert={m.streuung}
        spalten={2}
        optionen={[
          { wert: 'fest', text: 'Ja' },
          { wert: 'schwankt', text: 'Nein, das schwankt stark', beschreibung: 'mal eins, mal viele' },
        ]}
        onAendern={(streuung) => setze({ streuung })}
      />
      <Auswahl
        label="Wie werden sie erledigt?"
        wert={m.ausfuehrung}
        spalten={2}
        optionen={[
          { wert: 'nacheinander', text: 'Eine Person arbeitet sie der Reihe nach ab', symbol: <Symbol art="mehrfach" groesse={24} /> },
          {
            wert: 'gleichzeitig',
            text: 'Zur selben Zeit',
            beschreibung: 'Mehrere Leute teilen sich die Liste, oder man wartet auf mehrere Antworten zugleich',
            symbol: <Symbol art="mehrfach-gleichzeitig" groesse={24} />,
          },
        ]}
        onAendern={(ausfuehrung) => setze({ ausfuehrung })}
      />
      <Feld label="Wie lange liegt der Vorgang, bevor jemand mit dem ersten Stück anfängt?" hilfe="Zählt einmal je Vorgang, nicht je Stück.">
        {(id) => <ZeitEingabe id={id} wert={m.liegezeitMin} stundenProTag={std} onAendern={(liegezeitMin) => setze({ liegezeitMin })} />}
      </Feld>
      <p className="feld-hilfe">
        {einzeln
          ? `Im Diagramm trägt die Aufgabe „${einzeln.name || 'ohne Namen'}“ die Markierung für mehrere Stücke.`
          : bahn
            ? `Im Diagramm stehen die Schritte je Stück in einem Rahmen in der Bahn „${bahn}“; Schritte anderer Rollen tragen die Rolle in Klammern.`
            : 'Im Diagramm stehen die Schritte je Stück in einem Rahmen mit Markierung, in der Bahn der Rolle mit den meisten Schritten darin. Ist es nur eine Aufgabe, trägt sie die Markierung selbst.'}
      </p>
      <UnterbrechungenFeld schritt={m} onAendern={(liste) => onAendern(mitUnterbrechungen(m, liste))} kontext={kontext} />
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

// ---------------------------------------------------------------------------
// Unterbrechungen (Randereignisse) an Aufgabe, Abschnitt und „für jedes Stück“

/** „Kann während dieses Schritts etwas dazwischenkommen?“ mit einer Zeile je Unterbrechung und „normal: …“ darunter. */
function UnterbrechungenFeld({ schritt, onAendern, kontext }: { schritt: Unterbrechbar; onAendern: (liste: Unterbrechung[]) => void; kontext: FormularKontext }) {
  const { p } = useApp()
  const liste = schritt.unterbrechungen ?? []
  const summe = liste.filter((u) => u.unterbrechend).reduce((s, u) => s + u.anteil, 0)
  const voll = schritt.typ === 'aufgabe' && liste.length >= 3
  return (
    <fieldset className="zweige unterbrechungen">
      <legend>Kann während dieses Schritts etwas dazwischenkommen?</legend>
      {liste.length === 0 ? <p className="feld-hilfe">z. B. Kunde storniert, Frist läuft ab. Im Diagramm wird daraus ein Ereignis am Rand des Schritts mit einem eigenen Weg.</p> : <Lernhinweis thema="unterbrechung" />}
      {liste.map((u, i) => (
        <UnterbrechungZeile
          key={u.id}
          u={u}
          nr={i + 1}
          schritt={schritt}
          kontext={kontext}
          onAendern={(neu) => onAendern(liste.map((x) => (x.id === u.id ? neu : x)))}
          onEntfernen={() => onAendern(liste.filter((x) => x.id !== u.id))}
        />
      ))}
      {liste.some((u) => u.unterbrechend) && (
        <p className={`summe${summe > 1 + 1e-6 ? ' summe-falsch' : ''}`} role="status">
          {summe > 1 + 1e-6 ? `Zusammen ${formatiereProzent(summe, 1)}: Die Unterbrechungen schließen sich aus, zusammen sind es höchstens 100 %.` : `normal: ${formatiereProzent(Math.max(0, 1 - summe), 1)}`}
        </p>
      )}
      <button type="button" className="knopf knopf-leise" disabled={voll} onClick={() => onAendern([...liste, neueUnterbrechung({ fristMin: 60 * p.arbeitsstundenProTag })])}>
        + Unterbrechung
      </button>
      {voll && <p className="feld-hilfe">An einer Aufgabe haben im Diagramm höchstens drei Unterbrechungen Platz. Für mehr die Schritte zu einem Abschnitt zusammenfassen.</p>}
    </fieldset>
  )
}

function danachVonUnterbrechung(u: Unterbrechung): string {
  if (u.ende !== null) return 'ende'
  if (u.zurueckZu !== null) return `zurueck:${u.zurueckZu}`
  return 'weiter'
}

/** Eine Unterbrechung: was, Nachricht oder Frist, bricht ab oder nebenher, wie oft, wann, danach. */
function UnterbrechungZeile({ u, nr, schritt, kontext, onAendern, onEntfernen }: { u: Unterbrechung; nr: number; schritt: Unterbrechbar; kontext: FormularKontext; onAendern: (u: Unterbrechung) => void; onEntfernen: () => void }) {
  const { p } = useApp()
  const bestaetige = useBestaetigen()
  const [mehrere, setMehrere] = useState(false)
  const std = p.arbeitsstundenProTag
  const setze = (w: Partial<Unterbrechung>) => onAendern({ ...u, ...w })
  const name = u.bezeichnung.trim() || `Unterbrechung ${nr}`
  const titel = blockTitel(schritt)
  const eingang = schritt.typ === 'aufgabe' ? `bei ${rolleName(p, schritt.rolleId)}` : `bei „${titel}“`
  const h = kontext.haeufigkeit
  const q = Math.min(1, Math.max(0, u.anteil))
  const jeVorgang = h !== undefined && h > 1.05 ? ` Bei Ø ${formatiereZahl(h, 1)} Ausführungen je Vorgang etwa ${formatiereProzent(1 - (1 - q) ** h)} der Vorgänge.` : ''
  const ziele = kontext.unterbrechungZiele ?? []
  const danach = (wert: string) => {
    const d: Danach = wert === 'ende' ? { art: 'ende' } : wert.startsWith('zurueck:') ? { art: 'zurueck', zielId: wert.slice(8) } : { art: 'weiter' }
    if (kontext.setzeUnterbrechungDanach) return kontext.setzeUnterbrechungDanach(u.id, d)
    setze({ ende: d.art === 'ende' ? (u.ende ?? '') : null, zurueckZu: d.art === 'zurueck' ? d.zielId : null })
  }
  const zielBekannt = u.zurueckZu === null || u.zurueckZu === kontext.vonVornZiel || ziele.some((t) => t.id === u.zurueckZu)
  return (
    <div className="zweig-block unterbrechung">
      <div className="zweig-zeile">
        <Symbol art={u.unterbrechend ? 'unterbrechung' : 'unterbrechung-neben'} groesse={22} />
        <input type="text" aria-label={`Was kommt dazwischen? (Unterbrechung ${nr})`} value={u.bezeichnung} placeholder="Was kommt dazwischen? z. B. Kunde storniert" onChange={(e) => setze({ bezeichnung: e.target.value })} />
        <button
          type="button"
          className="knopf-icon"
          aria-label={`Unterbrechung „${name}“ entfernen`}
          title="Unterbrechung entfernen"
          onClick={async () => {
            if (u.schritte.length > 0 && !(await bestaetige('Unterbrechung entfernen?', `Der Weg nach „${name}“ enthält ${u.schritte.length} Schritte. Sie werden mit entfernt.`, 'Mit Schritten entfernen'))) return
            onEntfernen()
          }}
        >
          <Kreuz />
        </button>
      </div>
      <div className="eingerueckt">
        <Auswahl
          label="Eine Nachricht oder eine Frist?"
          wert={u.art}
          spalten={2}
          optionen={[
            { wert: 'nachricht', text: 'Eine Nachricht kommt', beschreibung: 'z. B. Storno, Rückfrage', symbol: <Symbol art="warten-nachricht" groesse={22} /> },
            { wert: 'zeit', text: 'Eine Frist läuft ab', symbol: <Symbol art="warten-zeit" groesse={22} /> },
          ]}
          onAendern={(art) => setze({ art, von: art === 'nachricht' ? u.von : null })}
        />
        {u.art === 'nachricht' ? (
          <AbsenderWahl wert={u.von} onAendern={(von) => setze({ von })} />
        ) : (
          <Feld label={`Nach welcher Frist, gerechnet ab Eingang ${eingang}?`} hilfe="Ab dem Moment, in dem der Vorgang dort ankommt, Liegezeit eingeschlossen.">
            {(id) => <ZeitEingabe id={id} wert={u.fristMin} stundenProTag={std} onAendern={(fristMin) => setze({ fristMin })} />}
          </Feld>
        )}
        <Auswahl
          label="Wird die Arbeit daran dann abgebrochen?"
          wert={u.unterbrechend ? 'ja' : 'nein'}
          spalten={2}
          optionen={[
            { wert: 'ja', text: 'Ja', beschreibung: 'danach geht es auf dem neuen Weg weiter' },
            { wert: 'nein', text: 'Nein, sie läuft weiter', beschreibung: 'und zusätzlich passiert etwas' },
          ]}
          onAendern={(w) => {
            const unterbrechend = w === 'ja'
            if (unterbrechend === u.unterbrechend) return
            // Ein Nebenweg hat kein „Danach“ (ein Rücksprungbereich ohne Rücksprung löst sich beim Speichern auf); ein Anteil ist höchstens 100 %
            setze({ unterbrechend, ende: null, zurueckZu: null, anteil: unterbrechend ? Math.min(1, u.anteil) : u.anteil })
          }}
        />
        {u.unterbrechend ? (
          <>
            <Feld label={u.art === 'zeit' ? 'Wie oft wird sie überschritten? (in % der Ausführungen)' : 'Wie oft kommt das vor? (in % der Ausführungen)'} hilfe={`Je Ausführung von „${titel}“.${jeVorgang}`}>
              {(id) => <ProzentEingabe id={id} anteil={u.anteil} onAendern={(anteil) => setze({ anteil })} />}
            </Feld>
            {u.art === 'nachricht' && schritt.typ === 'aufgabe' && (
              <Auswahl
                label="Wann kommt sie meist?"
                wert={u.zeitpunkt}
                spalten={3}
                optionen={[
                  { wert: 'vorher' as NachrichtZeitpunkt, text: 'Bevor jemand anfängt' },
                  { wert: 'waehrend' as NachrichtZeitpunkt, text: 'Während der Arbeit' },
                  { wert: 'unbekannt' as NachrichtZeitpunkt, text: 'Weiß nicht' },
                ]}
                onAendern={(zeitpunkt) => setze({ zeitpunkt })}
              />
            )}
            <div className="zweig-zeile">
              <label className="danach">
                <span className="leise">Danach:</span>
                <select aria-label={`Wie es nach „${name}“ weitergeht`} value={danachVonUnterbrechung(u)} onChange={(e) => danach(e.target.value)}>
                  <option value="weiter">weiter mit dem nächsten Schritt („{titel}“ bleibt unerledigt)</option>
                  {!kontext.inParallele && kontext.vonVornZiel && <option value={`zurueck:${kontext.vonVornZiel}`}>„{titel}“ noch einmal von vorn</option>}
                  {!kontext.inParallele &&
                    ziele.map((t) => (
                      <option key={t.id} value={`zurueck:${t.id}`}>
                        zurück zu „{t.titel}“
                      </option>
                    ))}
                  {!kontext.inParallele && <option value="ende">Prozess endet</option>}
                  {!zielBekannt && <option value={`zurueck:${u.zurueckZu}`}>zurück (Ziel nicht mehr gültig)</option>}
                </select>
              </label>
              {u.ende !== null && (
                <input type="text" className="zweig-ende" aria-label={`Ergebnis, wenn „${name}“`} value={u.ende} placeholder="Mit welchem Ergebnis? z. B. Bestellung storniert" onChange={(e) => setze({ ende: e.target.value })} />
              )}
            </div>
          </>
        ) : (
          <Feld label="Wie oft im Schnitt je Ausführung?" hilfe={`Auch mehr als einmal, z. B. 1,5. Der Nebenweg läuft neben „${titel}“ her, endet für sich und verlängert den Vorgang nicht.`}>
            {(id) => <ZahlEingabe id={id} wert={u.anteil} min={0} max={100} onAendern={(anteil) => setze({ anteil })} />}
          </Feld>
        )}
        {(kontext.oeffneWeg || kontext.fuerListe || kontext.fuerMehrere) && (
          <div className="knopfreihe">
            {kontext.oeffneWeg && (
              <button type="button" className="knopf knopf-klein" onClick={() => kontext.oeffneWeg!(u.id)}>
                Schritte {u.unterbrechend ? 'nach' : 'im Nebenweg'} „{name}“ ({u.schritte.length})
              </button>
            )}
            {kontext.fuerListe && (
              <button type="button" className="knopf knopf-klein" onClick={() => kontext.fuerListe!.anwenden(u.id)}>
                Gilt für die ganze Liste „{kontext.fuerListe.name}“
              </button>
            )}
            {kontext.fuerMehrere && kontext.fuerMehrere.bis.length > 0 && (
              <button type="button" className="knopf knopf-klein" aria-expanded={mehrere} onClick={() => setMehrere((x) => !x)}>
                Gilt für mehrere Schritte …
              </button>
            )}
          </div>
        )}
        {mehrere && kontext.fuerMehrere && <FuerMehrere u={u} name={name} fuerMehrere={kontext.fuerMehrere} onFertig={() => setMehrere(false)} />}
      </div>
    </div>
  )
}

/** „Gilt für mehrere Schritte“: bis zu welchem Schritt, und wie heißt der neue Abschnitt? */
function FuerMehrere({ u, name, fuerMehrere, onFertig }: { u: Unterbrechung; name: string; fuerMehrere: NonNullable<FormularKontext['fuerMehrere']>; onFertig: () => void }) {
  const [bis, setBis] = useState(fuerMehrere.bis[0]?.index ?? 0)
  const [abschnitt, setAbschnitt] = useState('')
  return (
    <div className="eingerueckt" role="group" aria-label={`„${name}“ für mehrere Schritte`}>
      <p className="feld-hilfe">Die Schritte werden zu einem Abschnitt zusammengefasst; „{name}“ gilt dann für den ganzen Abschnitt.</p>
      <div className="feldreihe">
        <Feld label="Bis einschließlich">
          {(id) => (
            <select id={id} value={bis} onChange={(e) => setBis(Number(e.target.value))}>
              {fuerMehrere.bis.map((x) => (
                <option key={x.index} value={x.index}>
                  {x.titel}
                </option>
              ))}
            </select>
          )}
        </Feld>
        <Feld label="Wie heißt der Abschnitt?" hilfe="z. B. „Ware bereitstellen“">
          {(id) => <input id={id} type="text" value={abschnitt} placeholder="z. B. Ware bereitstellen" onChange={(e) => setAbschnitt(e.target.value)} />}
        </Feld>
      </div>
      <div className="knopfreihe">
        <button
          type="button"
          className="knopf knopf-haupt"
          disabled={!abschnitt.trim()}
          onClick={() => {
            fuerMehrere.anwenden(u.id, bis, abschnitt.trim())
            onFertig()
          }}
        >
          Zusammenfassen
        </button>
        <button type="button" className="knopf knopf-leise" onClick={onFertig}>
          Abbrechen
        </button>
      </div>
    </div>
  )
}

/** Absender einer Nachricht: von innerhalb oder ein externer Beteiligter, auch neu angelegt. */
function AbsenderWahl({ wert, onAendern }: { wert: Id | null; onAendern: (id: Id | null) => void }) {
  const { p, aendere } = useApp()
  const [neu, setNeu] = useState<string | null>(null)
  const anlegen = () => {
    if (!neu?.trim()) return
    const t = neuerTeilnehmer(neu.trim())
    aendere((q) => ({ ...q, teilnehmer: [...q.teilnehmer, t] }))
    onAendern(t.id)
    setNeu(null)
  }
  return (
    <Feld label="Von wem?" hilfe="Ein externer Beteiligter bekommt im Diagramm einen eigenen Pool; seine Nachricht läuft zum Ereignis am Schritt.">
      {(id) =>
        neu === null ? (
          <select
            id={id}
            value={wert ?? ''}
            onChange={(e) => {
              if (e.target.value === '__neu__') setNeu('')
              else onAendern(e.target.value || null)
            }}
          >
            <option value="">von innerhalb (kein externer Beteiligter)</option>
            {p.teilnehmer.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name || 'Unbenannt'}
              </option>
            ))}
            <option value="__neu__">+ Neuer externer Beteiligter …</option>
          </select>
        ) : (
          <span className="inline-anlegen">
            <input
              id={id}
              type="text"
              autoFocus
              value={neu}
              placeholder="z. B. Kunde"
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
