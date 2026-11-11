import { useMemo } from 'react'
import { useBestaetigen } from '../frage'
import { bewerteVorschlaege, type BewerteterVorschlag, type Wirkung } from '../../analyse/regeln'
import { gestricheneKontrollen } from '../../compliance/verzahnung'
import { alleAufgaben } from '../../modell/operationen'
import type { Prozess } from '../../modell/typen'
import { formatiereDauer, formatiereEuro, formatiereZahl } from '../../modell/zeit'
import { useAnalyse } from '../analyse'
import { vorzeichen } from '../hilfen'
import { useApp } from '../kontext'
import { Lernhinweis } from '../Lernhinweis'

const REGELNAME: Record<BewerteterVorschlag['regel'], string> = {
  parallelisieren: 'Gleichzeitig ausführen',
  medienbruch: 'Medienbruch beseitigen',
  zusammenlegen: 'Zusammenlegen',
  nacharbeit: 'Nacharbeit senken',
  freigabe: 'Kontrolle reduzieren',
  knockout: 'Knock-out-Reihenfolge',
}

function anzahl(n: number, eins: string, viele: string): string {
  const text = formatiereZahl(Math.abs(n), 1)
  return `${vorzeichen(n, text)} ${text === '1' ? eins : viele}`
}

function WirkungsChips({ w, std }: { w: Wirkung; std: number }) {
  const chips: { text: string; gut: boolean }[] = []
  if (Math.abs(w.durchlaufzeitMin) > 0.01) chips.push({ text: `${vorzeichen(w.durchlaufzeitMin, formatiereDauer(Math.abs(w.durchlaufzeitMin), std))} Durchlaufzeit`, gut: w.durchlaufzeitMin < 0 })
  if (Math.abs(w.kostenProVorgang) > 0.005) chips.push({ text: `${vorzeichen(w.kostenProVorgang, formatiereEuro(Math.abs(w.kostenProVorgang)))} je Vorgang`, gut: w.kostenProVorgang < 0 })
  if (Math.abs(w.medienbrueche) > 0.005) chips.push({ text: anzahl(w.medienbrueche, 'Medienbruch', 'Medienbrüche'), gut: w.medienbrueche < 0 })
  if (Math.abs(w.uebergaben) > 0.005) chips.push({ text: anzahl(w.uebergaben, 'Übergabe', 'Übergaben'), gut: w.uebergaben < 0 })
  return (
    <ul className="chips" aria-label="Berechnete Wirkung">
      {chips.map((c) => (
        <li key={c.text} className={`chip ${c.gut ? 'chip-gut' : 'chip-schlecht'}`}>
          {c.text}
        </li>
      ))}
    </ul>
  )
}

export function VerbessernSchritt() {
  const { z, dispatch, setHervorhebung } = useApp()
  const bestaetige = useBestaetigen()
  const { projekt } = z
  const basis: Prozess = projekt.soll ?? projekt.ist
  const vorschlaege = useMemo(() => bewerteVorschlaege(basis, projekt.verworfen), [basis, projekt.verworfen])
  // Streicht ein Vorschlag eine Kontrolle, die in der Verfahrensdokumentation steht, braucht es einen Ersatz
  const gestrichen = useMemo(() => {
    const namen = new Map(alleAufgaben(projekt.ist).map((a) => [a.id, a.name]))
    return new Map(vorschlaege.map((v) => [v.schluessel, gestricheneKontrollen(projekt, v.anwenden(basis), basis).map((id) => namen.get(id) || 'Unbenannter Schritt')]))
  }, [vorschlaege, projekt, basis])
  const ist = useAnalyse(projekt.ist).kennzahlen
  const soll = useAnalyse(basis).kennzahlen
  const std = basis.arbeitsstundenProTag

  const uebernehmen = (v: BewerteterVorschlag) => {
    setHervorhebung([])
    dispatch({
      typ: 'projekt',
      zeit: Date.now(),
      ansicht: 'soll',
      projekt: {
        ...projekt,
        soll: v.anwenden(basis),
        massnahmen: [...projekt.massnahmen, { schluessel: v.schluessel, titel: v.titel, begruendung: v.annahme ? `${v.begruendung} ${v.annahme}` : v.begruendung }],
      },
    })
  }
  const verwerfen = (v: BewerteterVorschlag) => {
    setHervorhebung([])
    dispatch({ typ: 'projekt', zeit: Date.now(), projekt: { ...projekt, verworfen: [...projekt.verworfen, v.schluessel] } })
  }

  return (
    <div className="schritt">
      <h2>5 · Verbessern</h2>
      <Lernhinweis thema="verbessern" />
      <p>
        Der Soll-Prozess entsteht aus dem Ist-Prozess. Übernimm Vorschläge oder bearbeite den Soll-Prozess direkt im Schritt „Ablauf“. Jede Wirkung ist mit denselben Formeln
        berechnet wie die Kennzahlen.
      </p>

      {projekt.soll && (
        <div className="vergleich" aria-label="Ist und Soll im Vergleich">
          <div>
            <span className="leise">Durchlaufzeit</span>
            <strong>
              {formatiereDauer(ist.durchlaufzeitMin, std)} → {formatiereDauer(soll.durchlaufzeitMin, std)}
            </strong>
          </div>
          <div>
            <span className="leise">Kosten je Vorgang</span>
            <strong>
              {formatiereEuro(ist.kostenProVorgang)} → {formatiereEuro(soll.kostenProVorgang)}
            </strong>
          </div>
          <div>
            <span className="leise">Medienbrüche</span>
            <strong>
              {formatiereZahl(ist.medienbrueche, 1)} → {formatiereZahl(soll.medienbrueche, 1)}
            </strong>
          </div>
        </div>
      )}

      <section aria-labelledby="vorschlaege-titel">
        <h3 id="vorschlaege-titel">Vorschläge {vorschlaege.length > 0 && <span className="zahl-marke">{vorschlaege.length}</span>}</h3>
        {vorschlaege.length === 0 && (
          <p className="leer-hinweis">
            {basis.ablauf.schritte.length === 0
              ? 'Noch kein Ablauf, also auch nichts zu verbessern.'
              : 'Keine weiteren Vorschläge. Die Regeln finden nichts mehr, oder alle Vorschläge sind übernommen oder verworfen.'}
          </p>
        )}
        <ol className="vorschlaege">
          {vorschlaege.map((v) => (
            <li
              key={v.schluessel}
              className="karte vorschlag"
              onMouseEnter={() => setHervorhebung(v.blockIds)}
              onMouseLeave={() => setHervorhebung([])}
              onFocus={() => setHervorhebung(v.blockIds)}
              onBlur={() => setHervorhebung([])}
            >
              <p className="vorschlag-regel">{REGELNAME[v.regel]}</p>
              <h4>{v.titel}</h4>
              <p>{v.begruendung}</p>
              {v.annahme && (
                <p className="annahme">
                  <strong>Annahme:</strong> {v.annahme.replace(/^Angenommen wird, dass /, '')}
                </p>
              )}
              {(gestrichen.get(v.schluessel) ?? []).map((name) => (
                <p key={name} className="annahme kontroll-hinweis" role="note">
                  „{name}“ ist in der Verfahrensdokumentation als Kontrolle eingetragen. Wird sie gestrichen, braucht es einen Ersatz, z. B. eine Stichprobe.
                </p>
              ))}
              <WirkungsChips w={v.wirkung} std={std} />
              <div className="knopfreihe">
                <button type="button" className="knopf knopf-haupt" onClick={() => uebernehmen(v)}>
                  Übernehmen
                </button>
                <button type="button" className="knopf knopf-leise" onClick={() => verwerfen(v)}>
                  Verwerfen
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {projekt.massnahmen.length > 0 && (
        <section aria-labelledby="massnahmen-titel">
          <h3 id="massnahmen-titel">Übernommen</h3>
          <ol className="massnahmen">
            {projekt.massnahmen.map((m) => (
              <li key={m.schluessel}>{m.titel}</li>
            ))}
          </ol>
        </section>
      )}

      <div className="knopfreihe">
        {projekt.soll && (
          <button
            type="button"
            className="knopf"
            onClick={() => {
              dispatch({ typ: 'ansicht', ansicht: 'soll' })
              dispatch({ typ: 'schritt', schritt: 'ablauf' })
            }}
          >
            Soll-Prozess bearbeiten
          </button>
        )}
        {!projekt.soll && (
          <button type="button" className="knopf" onClick={() => dispatch({ typ: 'projekt', zeit: Date.now(), ansicht: 'soll', projekt: { ...projekt, soll: structuredClone(projekt.ist) } })}>
            Soll-Prozess ohne Vorschlag anlegen
          </button>
        )}
        {projekt.verworfen.length > 0 && (
          <button type="button" className="knopf knopf-leise" onClick={() => dispatch({ typ: 'projekt', zeit: Date.now(), projekt: { ...projekt, verworfen: [] } })}>
            Verworfene wieder zeigen ({projekt.verworfen.length})
          </button>
        )}
        {projekt.soll && (
          <button
            type="button"
            className="knopf knopf-gefahr"
            onClick={async () => {
              if (!(await bestaetige('Soll zurücksetzen?', 'Der Soll-Prozess und alle übernommenen Maßnahmen werden verworfen.', 'Verwerfen'))) return
              dispatch({ typ: 'projekt', zeit: Date.now(), ansicht: 'ist', projekt: { ...projekt, soll: null, massnahmen: [], verworfen: [] } })
            }}
          >
            Soll zurücksetzen
          </button>
        )}
      </div>

      <div className="schritt-fuss">
        <button type="button" className="knopf knopf-haupt" onClick={() => dispatch({ typ: 'schritt', schritt: 'dokumentieren' })}>
          Weiter: Dokumentieren
        </button>
      </div>
    </div>
  )
}
