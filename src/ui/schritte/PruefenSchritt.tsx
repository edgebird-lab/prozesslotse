import { WARTEFAKTOR_SCHWELLE } from '../../analyse/hinweise'
import type { Kennzahlen } from '../../analyse/kennzahlen'
import type { Simulationsergebnis } from '../../analyse/simulation'
import { blockTitel, durchlaufe } from '../../modell/operationen'
import type { Befund, Schwere } from '../../modell/pruefung'
import type { Prozess } from '../../modell/typen'
import { formatiereDauer, formatiereEuro, formatiereProzent, formatiereZahl } from '../../modell/zeit'
import { useAnalyse, useSimulation } from '../analyse'
import { vorzeichen } from '../hilfen'
import { SCHWERE_TEXT, zaehle } from '../befundtext'
import { useApp } from '../kontext'
import { Lernhinweis } from '../Lernhinweis'

export function StatusSymbol({ art }: { art: Schwere | 'gut' }) {
  if (art === 'warnung') {
    return (
      <svg className="status-symbol status-warnung" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M8 1.5 15 14H1z" fill="currentColor" />
        <path d="M8 6v4M8 12v.3" stroke="#0b0b0b" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (art === 'gut') {
    return (
      <svg className="status-symbol status-gut" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="currentColor" />
        <path d="m4.8 8.2 2.2 2.2 4.3-4.6" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg className={`status-symbol status-${art}`} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      {art === 'fehler' ? (
        <path d="M8 4.2v4.6M8 11.2v.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      ) : (
        <path d="M8 7.2v4.4M8 4.6v.3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Kennzahlkacheln

interface Delta {
  text: string
  /** true = besser, false = schlechter, null = unverändert */
  gut: boolean | null
}

function delta(vorher: number, nachher: number, format: (n: number) => string, kleinerIstBesser = true): Delta {
  const d = nachher - vorher
  if (Math.abs(d) < 1e-6 * Math.max(1, Math.abs(vorher))) return { text: 'unverändert', gut: null }
  return { text: vorzeichen(d, format(Math.abs(d))), gut: kleinerIstBesser ? d < 0 : d > 0 }
}

export function Kachel({ label, wert, zusatz, d, haupt }: { label: string; wert: string; zusatz?: string; d?: Delta; haupt?: boolean }) {
  return (
    <div className={`kachel${haupt ? ' kachel-haupt' : ''}`}>
      <div className="kachel-label">{label}</div>
      <div className="kachel-wert">{wert}</div>
      {d && (
        <div className={`kachel-delta${d.gut === null ? '' : d.gut ? ' delta-gut' : ' delta-schlecht'}`}>
          {d.gut !== null && <span aria-hidden="true">{d.gut ? '▼ ' : '▲ '}</span>}
          {d.text}
          {d.gut !== null && <span className="sr">{d.gut ? ' (besser)' : ' (schlechter)'}</span>}
          <span className="kachel-bezug"> ggü. Ist</span>
        </div>
      )}
      {zusatz && <div className="kachel-zusatz">{zusatz}</div>}
    </div>
  )
}

export function Kennzahlkacheln({ p, k, sim, vergleich }: { p: Prozess; k: Kennzahlen; sim: Simulationsergebnis; vergleich?: Kennzahlen | null }) {
  const std = p.arbeitsstundenProTag
  const v = vergleich ?? null
  const dauer = (n: number) => formatiereDauer(n, std)
  return (
    <div className="kacheln">
      <Kachel
        haupt
        label="Durchlaufzeit im Schnitt"
        wert={dauer(k.durchlaufzeitMin)}
        d={v ? delta(v.durchlaufzeitMin, k.durchlaufzeitMin, dauer) : undefined}
        zusatz={`90 % der Vorgänge sind nach ${dauer(sim.p90Min)} fertig (Simulation)`}
      />
      <Kachel
        label="Flusseffizienz"
        wert={formatiereProzent(k.flusseffizienz, 1)}
        d={v ? delta(v.flusseffizienz * 100, k.flusseffizienz * 100, (n) => `${formatiereZahl(n)} Pp.`, false) : undefined}
        zusatz={`davon gearbeitet: ${dauer(k.kritischeArbeitMin)}`}
      />
      <Kachel
        label="Kosten je Vorgang"
        wert={formatiereEuro(k.kostenProVorgang)}
        d={v ? delta(v.kostenProVorgang, k.kostenProVorgang, formatiereEuro) : undefined}
        zusatz={`${formatiereEuro(k.kostenProTag)} pro Arbeitstag`}
      />
      <Kachel
        label="Vorgänge in Arbeit"
        wert={k.stabil ? formatiereZahl(k.offeneVorgaenge, 0) : 'wächst'}
        d={v && v.stabil && k.stabil ? delta(v.offeneVorgaenge, k.offeneVorgaenge, (n) => formatiereZahl(n, 0)) : undefined}
        zusatz={k.stabil ? 'gleichzeitig, im Schnitt (Gesetz von Little)' : 'Eine Rolle ist überlastet; der Bestand wächst jeden Tag.'}
      />
      <Kachel
        label="Medienbrüche je Vorgang"
        wert={formatiereZahl(k.medienbrueche, 1)}
        d={v ? delta(v.medienbrueche, k.medienbrueche, (n) => formatiereZahl(n, 1)) : undefined}
        zusatz={`${dauer(k.uebertragungMin)} Abtippen`}
      />
      <Kachel
        label="Übergaben je Vorgang"
        wert={formatiereZahl(k.uebergaben, 1)}
        d={v ? delta(v.uebergaben, k.uebergaben, (n) => formatiereZahl(n, 1)) : undefined}
        zusatz={`${formatiereZahl(k.systemwechsel, 1)} Systemwechsel`}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Durchlaufzeit je Ergebnis

export function ErgebnisDauern({ p, k, sim }: { p: Prozess; k: Kennzahlen; sim: Simulationsergebnis }) {
  const zeilen = k.enden.filter((e) => e.anteil > 1e-6)
  if (zeilen.length < 2) return null
  const std = p.arbeitsstundenProTag
  return (
    <section aria-labelledby="ergebnisse-titel">
      <h3 id="ergebnisse-titel">Durchlaufzeit je Ergebnis</h3>
      <p className="leise">Der Schnitt oben mischt alle Ausgänge. Getrennt nach Ergebnis (Dauer aus der Simulation):</p>
      <div className="tabelle-wrap">
        <table className="bericht-tabelle">
          <thead>
            <tr>
              <th scope="col">Ergebnis</th>
              <th scope="col">Anteil</th>
              <th scope="col">Dauer im Schnitt</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((e) => {
              const s = sim.ergebnisse.find((x) => x.ergebnis === e.ergebnis && x.regulaer === e.regulaer)
              return (
                <tr key={`${e.regulaer}:${e.ergebnis}`}>
                  <th scope="row">
                    {e.ergebnis}
                    {e.regulaer ? '' : ' (vorzeitig)'}
                  </th>
                  <td>{formatiereProzent(e.anteil)}</td>
                  <td>{s ? formatiereDauer(s.mittelMin, std) : '–'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Wo die Zeit hingeht

interface Zeile {
  id: string
  name: string
  warten: number
  arbeit: number
}

export function Zeitverteilung({ p, k }: { p: Prozess; k: Kennzahlen }) {
  const std = p.arbeitsstundenProTag
  const zeilen: Zeile[] = []
  for (const { block } of durchlaufe(p.ablauf)) {
    if (block.typ === 'entscheidung' && block.art === 'ereignis') {
      // Wartezeit bis zum Ereignis eines Ausgangs
      for (const z of block.zweige) {
        const kz = k.schritte.get(z.id)
        if (kz && kz.beitragWartenMin > 0.01) zeilen.push({ id: z.id, name: `Warten auf „${z.bezeichnung}“`, warten: kz.beitragWartenMin, arbeit: 0 })
      }
      continue
    }
    const kz = k.schritte.get(block.id)
    if (!kz || (block.typ !== 'aufgabe' && block.typ !== 'warten')) continue
    if (kz.beitragWartenMin + kz.beitragArbeitMin <= 0.01) continue
    zeilen.push({ id: block.id, name: blockTitel(block), warten: kz.beitragWartenMin, arbeit: kz.beitragArbeitMin })
  }
  zeilen.sort((a, b) => b.warten + b.arbeit - (a.warten + a.arbeit))
  const MAX = 7
  const gezeigt = zeilen.slice(0, MAX)
  const rest = zeilen.slice(MAX)
  if (rest.length > 0) {
    gezeigt.push({
      id: '__rest__',
      name: `${rest.length} weitere Schritte`,
      warten: rest.reduce((s, z) => s + z.warten, 0),
      arbeit: rest.reduce((s, z) => s + z.arbeit, 0),
    })
  }
  const max = Math.max(1e-9, ...gezeigt.map((z) => z.warten + z.arbeit))
  const dauer = (n: number) => formatiereDauer(n, std)
  if (gezeigt.length === 0) return null

  return (
    <figure className="balkendiagramm" aria-labelledby="zeit-titel">
      <figcaption>
        <h3 id="zeit-titel">Wo die Zeit hingeht</h3>
        <p className="leise">Beitrag jedes Schritts zur Durchlaufzeit, im Schnitt je Vorgang</p>
      </figcaption>
      <div className="legende" aria-hidden="true">
        <span className="legende-eintrag">
          <span className="farbfeld farbe-liegen" /> Liegezeit
        </span>
        <span className="legende-eintrag">
          <span className="farbfeld farbe-arbeit" /> Bearbeitung
        </span>
      </div>
      <ol className="balkenliste">
        {gezeigt.map((z) => {
          const summe = z.warten + z.arbeit
          const anteil = k.durchlaufzeitMin > 0 ? summe / k.durchlaufzeitMin : 0
          const beschreibung = `${z.name}: ${dauer(summe)}, davon Liegezeit ${dauer(z.warten)} und Bearbeitung ${dauer(z.arbeit)}; ${formatiereProzent(anteil)} der Durchlaufzeit`
          return (
            <li key={z.id} className="balken-zeile" tabIndex={0} aria-label={beschreibung}>
              <span className="balken-name">{z.name}</span>
              <span className="balken-spur" aria-hidden="true">
                <span className="balken-stapel" style={{ width: `calc((100% - 92px) * ${summe / max})` }}>
                  {z.warten > 0 && <span className="balken-teil farbe-liegen" style={{ flexGrow: z.warten }} />}
                  {z.arbeit > 0 && <span className="balken-teil farbe-arbeit" style={{ flexGrow: z.arbeit }} />}
                </span>
                <span className="balken-wert">{dauer(summe)}</span>
              </span>
              <span className="balken-tipp" role="tooltip">
                <strong>{z.name}</strong>
                <span>Liegezeit {dauer(z.warten)}</span>
                <span>Bearbeitung {dauer(z.arbeit)}</span>
                <span>{formatiereProzent(anteil)} der Durchlaufzeit</span>
              </span>
            </li>
          )
        })}
      </ol>
      <details className="tabellenansicht">
        <summary>Als Tabelle anzeigen</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Schritt</th>
              <th scope="col">Liegezeit</th>
              <th scope="col">Bearbeitung</th>
              <th scope="col">Anteil</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z) => (
              <tr key={z.id}>
                <th scope="row">{z.name}</th>
                <td>{dauer(z.warten)}</td>
                <td>{dauer(z.arbeit)}</td>
                <td>{formatiereProzent(k.durchlaufzeitMin > 0 ? (z.warten + z.arbeit) / k.durchlaufzeitMin : 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

// ---------------------------------------------------------------------------
// Auslastung

export function Auslastung({ k }: { k: Kennzahlen }) {
  const rollen = k.rollen.filter((r) => r.stundenProTag > 0)
  if (rollen.length === 0) return null
  return (
    <section className="auslastung" aria-labelledby="auslastung-titel">
      <h3 id="auslastung-titel">Auslastung je Rolle</h3>
      <p className="leise">
        Benötigte Zeit pro Arbeitstag im Verhältnis zur verfügbaren Zeit. Die Markierung zeigt, ab wann Arbeit im Schnitt viermal so lange wartet, wie sie dauert: bei einer Person ab
        80 %, bei größeren Teams später (Warteschlangenmodell M/M/c).
      </p>
      <ul className="meterliste">
        {rollen.map((r) => {
          const zustand = r.auslastung > 1 ? 'kritisch' : r.wartefaktor >= WARTEFAKTOR_SCHWELLE ? 'warnung' : 'normal'
          const prozent = Number.isFinite(r.auslastung) ? Math.round(r.auslastung * 100) : 999
          return (
            <li key={r.rolle.id} className={`meter meter-${zustand}`}>
              <div className="meter-kopf">
                <span className="meter-name">{r.rolle.name || 'Unbenannte Rolle'}</span>
                <span className="meter-wert">{Number.isFinite(r.auslastung) ? formatiereProzent(r.auslastung) : 'keine Kapazität'}</span>
              </div>
              <div className="meter-spur" role="meter" aria-label={`Auslastung ${r.rolle.name}`} aria-valuemin={0} aria-valuemax={Math.max(100, prozent)} aria-valuenow={prozent}>
                <div className="meter-fuellung" style={{ width: `${Math.min(1, r.auslastung) * 100}%` }} />
                <span className="meter-schwelle" style={{ left: `${r.engpassSchwelle * 100}%` }} title={`Engpass ab etwa ${formatiereProzent(r.engpassSchwelle)}`} />
              </div>
              <div className="meter-fuss">
                <span>
                  {formatiereZahl(r.stundenProTag)} von {formatiereZahl(r.kapazitaetStundenProTag)} Std. pro Tag
                </span>
                {zustand !== 'normal' && (
                  <span className={`status status-${zustand === 'kritisch' ? 'fehler' : 'warnung'}`}>
                    <StatusSymbol art={zustand === 'kritisch' ? 'fehler' : 'warnung'} />
                    {zustand === 'kritisch' ? 'Überlastet' : 'Engpass'}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Befunde

export function Befundliste({ befunde, onZumSchritt }: { befunde: Befund[]; onZumSchritt?: (b: Befund) => void }) {
  if (befunde.length === 0) {
    return (
      <p className="status status-gut">
        <StatusSymbol art="gut" /> Keine Befunde. Das Modell ist vollständig, und es fällt keine Schwachstelle auf.
      </p>
    )
  }
  return (
    <ul className="befunde">
      {befunde.map((b) => (
        <li key={b.schluessel} className={`befund befund-${b.schwere}`}>
          <StatusSymbol art={b.schwere} />
          <div className="befund-text">
            <strong>
              <span className="sr">{SCHWERE_TEXT[b.schwere][0]}: </span>
              {b.titel}
            </strong>
            <p>{b.text}</p>
            {b.quelle && <small className="leise">Regel: {b.quelle}</small>}
          </div>
          {b.blockId && onZumSchritt && (
            <button type="button" className="knopf knopf-klein" onClick={() => onZumSchritt(b)}>
              Zum Schritt
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

export function PruefenSchritt() {
  const { z, p, dispatch } = useApp()
  const a = useAnalyse(p)
  const sim = useSimulation(p)
  const ist = useAnalyse(z.projekt.ist)
  const vergleich = z.ansicht === 'soll' && z.projekt.soll ? ist.kennzahlen : null

  return (
    <div className="schritt">
      <h2>4 · Prüfen{z.ansicht === 'soll' ? ' (Soll-Prozess)' : ''}</h2>
      <Lernhinweis thema="pruefen" />
      {p.ablauf.schritte.length === 0 ? (
        <p className="leer-hinweis">Noch kein Ablauf. Lege im Schritt „Ablauf“ die ersten Schritte an.</p>
      ) : (
        <>
          {a.hatFehler && (
            <p className="banner banner-fehler" role="alert">
              <StatusSymbol art="fehler" /> Das Modell enthält Fehler. Behebe sie zuerst, sonst sind die Zahlen nicht verlässlich.
            </p>
          )}
          <Kennzahlkacheln p={p} k={a.kennzahlen} sim={sim} vergleich={vergleich} />
          <ErgebnisDauern p={p} k={a.kennzahlen} sim={sim} />
          <Zeitverteilung p={p} k={a.kennzahlen} />
          <Auslastung k={a.kennzahlen} />
        </>
      )}
      <section aria-labelledby="befunde-titel">
        <h3 id="befunde-titel">Befunde</h3>
        <p className="leise">{zaehle(a.befunde)}</p>
        <Befundliste
          befunde={a.befunde}
          onZumSchritt={(b) => {
            dispatch({ typ: 'auswahl', auswahl: b.blockId ?? null })
            dispatch({ typ: 'schritt', schritt: 'ablauf' })
          }}
        />
      </section>
      <div className="schritt-fuss">
        <button type="button" className="knopf knopf-haupt" onClick={() => dispatch({ typ: 'schritt', schritt: 'verbessern' })}>
          Weiter: Verbessern
        </button>
      </div>
    </div>
  )
}
