import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react'
import { neueAufgabe, neueEntscheidung, neueParallel, neuesWarten, neueWiederholung } from '../../modell/bausteine'
import { abschnittFertig, beschreibeCursor, cursorNachEinfuegen } from '../../modell/fuehrung'
import { blockTitel, entferneBlock, ersetzeBlock, findeBlock, fuegeEin, kinderSequenzen, liegtInParallele, rolleName, verschiebeBlock } from '../../modell/operationen'
import type { Block, BlockTyp, Cursor, Prozess, Sequenz } from '../../modell/typen'
import { formatiereDauer, formatiereProzent } from '../../modell/zeit'
import { wirksamerCursor } from '../../zustand'
import { useApp } from '../kontext'
import type { LernThema } from '../lerninhalte'
import { Lernhinweis } from '../Lernhinweis'
import { Symbol, type SymbolArt } from '../Symbol'
import { fehltNoch } from '../entwurf'
import { symbolFuer } from '../symbolart'
import { BlockFormular } from './BlockFormulare'

const WAHL: { typ: BlockTyp; text: string; beschreibung: string; symbol: SymbolArt }[] = [
  { typ: 'aufgabe', text: 'Eine Aufgabe', beschreibung: 'Jemand erledigt etwas', symbol: 'aufgabe' },
  { typ: 'entscheidung', text: 'Eine Entscheidung', beschreibung: 'Je nach Fall geht es anders weiter', symbol: 'xor' },
  { typ: 'parallel', text: 'Mehreres gleichzeitig', beschreibung: 'Zweige laufen parallel', symbol: 'und' },
  { typ: 'wiederholung', text: 'Etwas wird wiederholt', beschreibung: 'z. B. Nacharbeit nach einer Prüfung', symbol: 'wiederholung' },
  { typ: 'warten', text: 'Warten', beschreibung: 'auf einen Termin oder eine Nachricht', symbol: 'warten-zeit' },
]

const TYPNAME: Record<BlockTyp, string> = {
  aufgabe: 'Aufgabe',
  entscheidung: 'Entscheidung',
  parallel: 'Gleichzeitig',
  wiederholung: 'Wiederholung',
  warten: 'Warten',
}

const LERNTHEMA: Record<BlockTyp, LernThema> = {
  aufgabe: 'aufgabe',
  entscheidung: 'entscheidung',
  parallel: 'parallel',
  wiederholung: 'wiederholung',
  warten: 'warten',
}

function neuerEntwurf(typ: BlockTyp, p: Prozess, vorgaenger: Block | null): Block {
  switch (typ) {
    case 'aufgabe': {
      const vorher = vorgaenger?.typ === 'aufgabe' ? vorgaenger : null
      return neueAufgabe({ rolleId: vorher?.rolleId ?? p.rollen[0]?.id ?? null, mediumId: vorher?.mediumId ?? p.medien[0]?.id ?? null })
    }
    case 'entscheidung':
      return neueEntscheidung()
    case 'parallel':
      return neueParallel(2)
    case 'wiederholung':
      return neueWiederholung()
    case 'warten':
      return neuesWarten()
  }
}

export function AblaufSchritt() {
  const { z, p } = useApp()
  const cursor = wirksamerCursor(z, p)
  const fund = z.auswahl ? findeBlock(p, z.auswahl) : null
  return (
    <div className="schritt">
      <h2>3 · Ablauf</h2>
      {z.ansicht === 'soll' && <p className="soll-hinweis">Du bearbeitest den Soll-Prozess.</p>}
      {fund ? <BlockBearbeiten key={fund.block.id} /> : <NaechsterSchritt key={`${cursor.sequenzId}:${cursor.index}`} cursor={cursor} />}
      <Gliederung cursor={cursor} />
    </div>
  )
}

function NaechsterSchritt({ cursor }: { cursor: Cursor }) {
  const { p, aendere, dispatch } = useApp()
  const ort = beschreibeCursor(p, cursor)
  const [entwurf, setEntwurf] = useState<Block | null>(null)
  const ersterKnopf = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!entwurf && document.activeElement === document.body) ersterKnopf.current?.focus({ preventScroll: true })
  }, [entwurf])

  const fertig = () => {
    const ziel = abschnittFertig(p, cursor)
    if (ziel === 'fertig') dispatch({ typ: 'schritt', schritt: 'pruefen' })
    else dispatch({ typ: 'cursor', cursor: ziel })
  }

  if (ort.unerreichbar) {
    return (
      <section className="karte karte-frage">
        <h3>Hier geht es nicht weiter</h3>
        <p>Alle Ausgänge der Entscheidung davor beenden den Prozess. Schritte an dieser Stelle würden nie erreicht.</p>
        <button type="button" className="knopf knopf-haupt" onClick={fertig}>
          {ort.weiterText}
        </button>
      </section>
    )
  }

  if (!entwurf) {
    return (
      <section className="karte karte-frage" aria-labelledby="frage-titel">
        <h3 id="frage-titel">Was passiert als Nächstes?</h3>
        <p className="ort">
          <span className="ort-marke" aria-hidden="true">
            ▸
          </span>{' '}
          {ort.bereich}, {ort.position}
        </p>
        <div className="wahl">
          {WAHL.map((w, i) => (
            <button key={w.typ} ref={i === 0 ? ersterKnopf : undefined} type="button" className="wahl-knopf" onClick={() => setEntwurf(neuerEntwurf(w.typ, p, ort.vorgaenger))}>
              <Symbol art={w.symbol} groesse={30} />
              <span>
                <strong>{w.text}</strong>
                <small>{w.beschreibung}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="knopfreihe">
          <button type="button" className="knopf" onClick={fertig}>
            {ort.weiterText} →
          </button>
        </div>
      </section>
    )
  }

  const fehlt = fehltNoch(entwurf)
  const hinzufuegen = (e: FormEvent) => {
    e.preventDefault()
    if (fehlt) return
    aendere((q) => fuegeEin(q, cursor.sequenzId, cursor.index, entwurf), { cursor: cursorNachEinfuegen(entwurf, cursor), auswahl: null })
  }
  return (
    <form className="karte karte-frage" onSubmit={hinzufuegen} aria-labelledby="entwurf-titel">
      <h3 id="entwurf-titel">
        <Symbol art={symbolFuer(entwurf, p)} groesse={26} /> Neu: {TYPNAME[entwurf.typ]}
      </h3>
      <p className="ort">
        {ort.bereich}, {ort.position}
      </p>
      <Lernhinweis thema={LERNTHEMA[entwurf.typ]} />
      <BlockFormular block={entwurf} onAendern={setEntwurf} kontext={{ vorgaenger: ort.vorgaenger, inParallele: ort.inParallele, neu: true }} />
      {fehlt && <p className="feld-hilfe">{fehlt}</p>}
      <div className="knopfreihe">
        <button type="submit" className="knopf knopf-haupt" disabled={fehlt !== null}>
          Hinzufügen
        </button>
        <button type="button" className="knopf knopf-leise" onClick={() => setEntwurf(null)}>
          Abbrechen
        </button>
      </div>
    </form>
  )
}

function BlockBearbeiten() {
  const { z, p, aendere, dispatch } = useApp()
  const fund = z.auswahl ? findeBlock(p, z.auswahl) : null
  if (!fund) return null
  const b = fund.block
  const vorgaenger = fund.index > 0 ? fund.sequenz.schritte[fund.index - 1] : null
  const kinder = kinderSequenzen(b)
  const anzahlInnen = kinder.reduce((s, k) => s + k.schritte.length, 0)
  const zweigName = (i: number) =>
    b.typ === 'entscheidung' ? `Ausgang „${b.zweige[i].bezeichnung || i + 1}“` : b.typ === 'parallel' ? `Zweig ${i + 1}` : 'Wiederholte Schritte'

  return (
    <section className="karte karte-bearbeiten" aria-labelledby="bearbeiten-titel">
      <h3 id="bearbeiten-titel">
        <Symbol art={symbolFuer(b, p)} groesse={26} /> {TYPNAME[b.typ]} bearbeiten
      </h3>
      <Lernhinweis thema={LERNTHEMA[b.typ]} />
      <BlockFormular
        block={b}
        onAendern={(neu) => aendere((q) => ersetzeBlock(q, neu), { gruppe: `block:${b.id}` })}
        kontext={{ vorgaenger, inParallele: liegtInParallele(fund.vorfahren), neu: false }}
      />
      {kinder.length > 0 && (
        <div className="kinder-links">
          <p className="leise">Schritte hinzufügen:</p>
          {kinder.map((k, i) => (
            <button key={k.id} type="button" className="knopf knopf-klein" onClick={() => dispatch({ typ: 'cursor', cursor: { sequenzId: k.id, index: k.schritte.length } })}>
              {zweigName(i)} ({k.schritte.length})
            </button>
          ))}
        </div>
      )}
      <div className="knopfreihe">
        <button type="button" className="knopf knopf-haupt" onClick={() => dispatch({ typ: 'auswahl', auswahl: null })}>
          Fertig
        </button>
        <button type="button" className="knopf" disabled={fund.index === 0} onClick={() => aendere((q) => verschiebeBlock(q, b.id, -1))}>
          ↑ Nach oben
        </button>
        <button type="button" className="knopf" disabled={fund.index === fund.sequenz.schritte.length - 1} onClick={() => aendere((q) => verschiebeBlock(q, b.id, 1))}>
          ↓ Nach unten
        </button>
        <button
          type="button"
          className="knopf knopf-gefahr"
          onClick={() => {
            if (anzahlInnen > 0 && !window.confirm(`„${blockTitel(b)}“ enthält ${anzahlInnen} weitere Schritte. Alles löschen?`)) return
            aendere((q) => entferneBlock(q, b.id), { auswahl: null })
          }}
        >
          Löschen
        </button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Gliederung

function Gliederung({ cursor }: { cursor: Cursor }) {
  const { p } = useApp()
  return (
    <nav className="gliederung" aria-label="Gliederung des Ablaufs">
      <h3>Gliederung</h3>
      <div className="gliederung-start">
        <Symbol art="start" groesse={18} /> {p.ausloeser.text || 'Start'}
      </div>
      <SequenzListe seq={p.ablauf} cursor={cursor} />
      <div className="gliederung-start">
        <Symbol art="ende" groesse={18} /> {p.ergebnis || 'Ende'}
      </div>
    </nav>
  )
}

function SequenzListe({ seq, cursor }: { seq: Sequenz; cursor: Cursor }) {
  return (
    <ol className="sequenz">
      <Einfuegepunkt sequenzId={seq.id} index={0} cursor={cursor} />
      {seq.schritte.map((b, i) => (
        <Fragment key={b.id}>
          <li className="sequenz-eintrag">
            <BlockEintrag b={b} cursor={cursor} />
          </li>
          <Einfuegepunkt sequenzId={seq.id} index={i + 1} cursor={cursor} />
        </Fragment>
      ))}
    </ol>
  )
}

function Einfuegepunkt({ sequenzId, index, cursor }: { sequenzId: string; index: number; cursor: Cursor }) {
  const { z, dispatch } = useApp()
  const aktiv = !z.auswahl && cursor.sequenzId === sequenzId && cursor.index === index
  if (aktiv) {
    return (
      <li className="einfuegen einfuegen-aktiv" aria-current="step">
        ▸ Hier geht es weiter
      </li>
    )
  }
  return (
    <li className="einfuegen">
      <button type="button" aria-label="Hier einfügen" title="Hier einfügen" onClick={() => dispatch({ typ: 'cursor', cursor: { sequenzId, index } })}>
        <span aria-hidden="true">+</span>
      </button>
    </li>
  )
}

function BlockEintrag({ b, cursor }: { b: Block; cursor: Cursor }) {
  const { z, p, dispatch } = useApp()
  const std = p.arbeitsstundenProTag
  let meta = ''
  if (b.typ === 'aufgabe') {
    meta = `${rolleName(p, b.rolleId)} · ${formatiereDauer(b.bearbeitungMin, std)}`
    if (b.liegezeitMin > 0) meta += ` · liegt ${formatiereDauer(b.liegezeitMin, std)}`
  } else if (b.typ === 'warten') meta = formatiereDauer(b.dauerMin, std)
  else if (b.typ === 'wiederholung') meta = `wiederholt in ${formatiereProzent(b.anteilWiederholung)}`
  const gewaehlt = z.auswahl === b.id
  return (
    <>
      <button type="button" className={`eintrag${gewaehlt ? ' eintrag-gewaehlt' : ''}`} aria-pressed={gewaehlt} onClick={() => dispatch({ typ: 'auswahl', auswahl: gewaehlt ? null : b.id })}>
        <Symbol art={symbolFuer(b, p)} groesse={22} />
        <span className="eintrag-text">
          <span className="eintrag-titel">{blockTitel(b)}</span>
          {meta && <span className="eintrag-meta">{meta}</span>}
        </span>
      </button>
      {b.typ === 'entscheidung' &&
        b.zweige.map((zw) => (
          <div key={zw.id} className="zweig">
            <div className="zweig-kopf">
              {zw.bezeichnung || 'Ausgang'} · {formatiereProzent(zw.anteil)}
              {zw.ende !== null && <span className="zweig-ende-marke"> · endet: „{zw.ende || 'Ende'}“</span>}
            </div>
            <SequenzListe seq={zw} cursor={cursor} />
          </div>
        ))}
      {b.typ === 'parallel' &&
        b.zweige.map((zw, i) => (
          <div key={zw.id} className="zweig">
            <div className="zweig-kopf">Zweig {i + 1}</div>
            <SequenzListe seq={zw} cursor={cursor} />
          </div>
        ))}
      {b.typ === 'wiederholung' && (
        <div className="zweig">
          <div className="zweig-kopf">wird wiederholt, wenn „{b.frage || '?'}“</div>
          <SequenzListe seq={b.koerper} cursor={cursor} />
        </div>
      )}
    </>
  )
}
