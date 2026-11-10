import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react'
import { useBestaetigen } from '../frage'
import { neueAufgabe, neueEntscheidung, neueParallel, neuesWarten, neueWiederholung } from '../../modell/bausteine'
import { abschnittFertig, beschreibeCursor, cursorNachEinfuegen } from '../../modell/fuehrung'
import {
  aendereBlock,
  bereichTitel,
  blockTitel,
  durchlaufe,
  entferneBlock,
  entferneRuecksprung,
  ersetzeBlock,
  findeBlock,
  findeSequenz,
  fuegeEin,
  kinderSequenzen,
  liegtInParallele,
  normalisiere,
  rolleName,
  ruecksprungZiele,
  setzeRuecksprung,
  verschiebeBlock,
} from '../../modell/operationen'
import type { Block, BlockTyp, Cursor, Id, Prozess, Sequenz } from '../../modell/typen'
import { formatiereDauer, formatiereProzent } from '../../modell/zeit'
import { wirksamerCursor } from '../../zustand'
import { useApp } from '../kontext'
import type { LernThema } from '../lerninhalte'
import { Lernhinweis } from '../Lernhinweis'
import { Symbol, type SymbolArt } from '../Symbol'
import { fehltNoch } from '../entwurf'
import { symbolFuer } from '../symbolart'
import { BlockFormular, ZweckWahl, type Danach } from './BlockFormulare'

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

function lernthema(b: Block): LernThema {
  if (b.typ === 'entscheidung') return b.art === 'ereignis' ? 'ereignis' : 'entscheidung'
  if (b.typ === 'wiederholung') return b.modus === 'ruecksprung' ? 'ruecksprung' : 'wiederholung'
  return b.typ
}

function typname(b: Block): string {
  if (b.typ === 'entscheidung' && b.art === 'ereignis') return 'Ereignis-Entscheidung'
  if (b.typ === 'wiederholung' && b.modus === 'ruecksprung') return 'Bereich mit Rücksprung'
  return TYPNAME[b.typ]
}

/** Ändert, wie es nach einem Ausgang einer bestehenden Entscheidung weitergeht; Rücksprünge verändern die Struktur. */
function setzeDanach(q: Prozess, entscheidungId: Id, zweigId: Id, danach: Danach): Prozess {
  const ent = findeBlock(q, entscheidungId)?.block
  const zweig = ent?.typ === 'entscheidung' ? ent.zweige.find((z) => z.id === zweigId) : undefined
  if (!zweig) return q
  if (danach.art === 'zurueck' && zweig.zurueckZu === danach.zielId) return q
  let r = zweig.zurueckZu !== null ? entferneRuecksprung(q, entscheidungId, zweigId) : q
  const setzeEnde = (ende: string | null) =>
    aendereBlock(r, entscheidungId, (b) => (b.typ === 'entscheidung' ? { ...b, zweige: b.zweige.map((z) => (z.id === zweigId ? { ...z, ende } : z)) } : b))
  if (danach.art === 'ende') r = setzeEnde(zweig.ende ?? '')
  else if (danach.art === 'weiter') r = setzeEnde(null)
  else r = setzeRuecksprung(setzeEnde(null), entscheidungId, zweigId, danach.zielId)
  return r
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
        <p>Kein Ausgang der Entscheidung davor führt hierher: Alle beenden den Prozess oder springen zurück. Schritte an dieser Stelle würden nie erreicht.</p>
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
    aendere(
      (q) => {
        if (entwurf.typ !== 'entscheidung') return fuegeEin(q, cursor.sequenzId, cursor.index, entwurf)
        // Rücksprungziele sind im Entwurf Block-Kennungen; der Bereich entsteht erst nach dem Einfügen.
        const ohneZiele = { ...entwurf, zweige: entwurf.zweige.map((z) => ({ ...z, zurueckZu: null })) }
        let r = fuegeEin(q, cursor.sequenzId, cursor.index, ohneZiele)
        for (const z of entwurf.zweige) if (z.zurueckZu) r = setzeRuecksprung(r, entwurf.id, z.id, z.zurueckZu)
        return r
      },
      { cursor: cursorNachEinfuegen(entwurf, cursor), auswahl: null },
    )
  }
  return (
    <form className="karte karte-frage" onSubmit={hinzufuegen} aria-labelledby="entwurf-titel">
      <h3 id="entwurf-titel">
        <Symbol art={symbolFuer(entwurf, p)} groesse={26} /> Neu: {typname(entwurf)}
      </h3>
      <p className="ort">
        {ort.bereich}, {ort.position}
      </p>
      <Lernhinweis thema={lernthema(entwurf)} />
      <BlockFormular
        block={entwurf}
        onAendern={setEntwurf}
        kontext={{
          vorgaenger: ort.vorgaenger,
          nachfolger: findeSequenz(p, cursor.sequenzId)?.sequenz.schritte[cursor.index] ?? null,
          inParallele: ort.inParallele,
          neu: true,
          ziele: ruecksprungZiele(p, cursor.sequenzId, cursor.index, false),
        }}
      />
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
  const bestaetige = useBestaetigen()
  const fund = z.auswahl ? findeBlock(p, z.auswahl) : null
  if (!fund) return null
  const b = fund.block
  const vorgaenger = fund.index > 0 ? fund.sequenz.schritte[fund.index - 1] : null
  const kinder = kinderSequenzen(b)
  const anzahlInnen = kinder.reduce((s, k) => s + k.schritte.length, 0)
  const zweigName = (i: number) =>
    b.typ === 'entscheidung' ? `Ausgang „${b.zweige[i].bezeichnung || i + 1}“` : b.typ === 'parallel' ? `Zweig ${i + 1}` : 'Wiederholte Schritte'

  if (b.typ === 'wiederholung' && b.modus === 'ruecksprung') return <BereichBearbeiten bereichId={b.id} />

  return (
    <section className="karte karte-bearbeiten" aria-labelledby="bearbeiten-titel">
      <h3 id="bearbeiten-titel">
        <Symbol art={symbolFuer(b, p)} groesse={26} /> {typname(b)} bearbeiten
      </h3>
      <Lernhinweis thema={lernthema(b)} />
      <BlockFormular
        block={b}
        onAendern={(neu) => aendere((q) => normalisiere(ersetzeBlock(q, neu)), { gruppe: `block:${b.id}` })}
        kontext={{
          vorgaenger,
          nachfolger: fund.sequenz.schritte[fund.index + 1] ?? null,
          inParallele: liegtInParallele(fund.vorfahren),
          neu: false,
          ziele: b.typ === 'entscheidung' ? ruecksprungZiele(p, fund.sequenz.id, fund.index, true) : undefined,
          setzeDanach: (zweigId, danach) => aendere((q) => setzeDanach(q, b.id, zweigId, danach)),
        }}
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
          onClick={async () => {
            if (anzahlInnen > 0 && !(await bestaetige('Mit allen Schritten löschen?', `„${blockTitel(b)}“ enthält ${anzahlInnen} weitere Schritte. Sie werden mit gelöscht.`, 'Alles löschen'))) return
            aendere((q) => entferneBlock(q, b.id), { auswahl: null })
          }}
        >
          Löschen
        </button>
      </div>
    </section>
  )
}

/** Ein Rücksprungbereich hat keine eigenen Angaben; er zeigt, welche Ausgänge hierher zurückführen. */
function BereichBearbeiten({ bereichId }: { bereichId: Id }) {
  const { p, aendere, dispatch } = useApp()
  const bereich = findeBlock(p, bereichId)?.block
  if (bereich?.typ !== 'wiederholung') return null
  const quellen: { ent: string; zweig: string; entId: Id; zweigId: Id }[] = []
  for (const { block } of durchlaufe(bereich.koerper)) {
    if (block.typ !== 'entscheidung') continue
    for (const z of block.zweige) if (z.zurueckZu === bereichId) quellen.push({ ent: blockTitel(block), zweig: z.bezeichnung || 'Ausgang', entId: block.id, zweigId: z.id })
  }
  const start = bereich.koerper.schritte[0] ? bereichTitel(bereich.koerper.schritte[0]) : 'Anfang'
  return (
    <section className="karte karte-bearbeiten" aria-labelledby="bearbeiten-titel">
      <h3 id="bearbeiten-titel">
        <Symbol art="ruecksprung" groesse={26} /> Bereich mit Rücksprung
      </h3>
      <Lernhinweis thema="ruecksprung" />
      <p>
        Die Schritte ab „{start}“ laufen erneut, wenn einer dieser Ausgänge gewählt wird. Ändern lässt sich das in der jeweiligen Entscheidung unter „Danach“.
      </p>
      <ZweckWahl w={bereich} onAendern={(neu) => aendere((q) => ersetzeBlock(q, neu), { gruppe: `block:${bereich.id}` })} />
      <ul className="quellen">
        {quellen.map((q) => (
          <li key={q.zweigId}>
            <button type="button" className="knopf knopf-klein" onClick={() => dispatch({ typ: 'auswahl', auswahl: q.entId })}>
              „{q.ent}“ → „{q.zweig}“
            </button>
          </li>
        ))}
      </ul>
      <div className="knopfreihe">
        <button type="button" className="knopf knopf-haupt" onClick={() => dispatch({ typ: 'auswahl', auswahl: null })}>
          Fertig
        </button>
        <button
          type="button"
          className="knopf knopf-gefahr"
          onClick={() => aendere((q) => quellen.reduce((r, x) => entferneRuecksprung(r, x.entId, x.zweigId), q), { auswahl: null })}
        >
          Rücksprünge entfernen
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
  else if (b.typ === 'wiederholung' && b.modus === 'anteil') meta = `wiederholt in ${formatiereProzent(b.anteilWiederholung)}`
  else if (b.typ === 'entscheidung' && b.art === 'ereignis') meta = 'je nachdem, was zuerst passiert'
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
              {b.art === 'ereignis' && zw.ereignis && <span> · nach Ø {formatiereDauer(zw.ereignis.dauerMin, std)}</span>}
              {zw.ende !== null && <span className="zweig-ende-marke"> · endet: „{zw.ende || 'Ende'}“</span>}
              {zw.zurueckZu !== null && <span className="zweig-ende-marke"> · ↩ zurück zu „{zielTitel(p, zw.zurueckZu)}“</span>}
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
          <div className="zweig-kopf">{b.modus === 'ruecksprung' ? 'läuft erneut, wenn ein Ausgang hierher zurückspringt' : `wird wiederholt, wenn „${b.frage || '?'}“`}</div>
          <SequenzListe seq={b.koerper} cursor={cursor} />
        </div>
      )}
    </>
  )
}

function zielTitel(p: Prozess, bereichId: Id): string {
  const b = findeBlock(p, bereichId)?.block
  if (!b) return '?'
  return b.typ === 'wiederholung' && b.koerper.schritte[0] ? bereichTitel(b.koerper.schritte[0]) : bereichTitel(b)
}
