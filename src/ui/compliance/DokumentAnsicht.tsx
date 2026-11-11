import { useId, type ReactNode } from 'react'
import { gliederung } from '../../compliance/dokument'
import type { Abschnitt, Dokument } from '../../compliance/typen'
import type { Prozess } from '../../modell/typen'
import { useBpmn } from '../analyse'
import { DiagrammLazy as Diagramm } from '../DiagrammLazy'

/**
 * Dokument → HTML für Vorschau und Druck. React maskiert alle Texte;
 * Kapitel der Ebene 1 beginnen im Druck auf einer neuen Seite.
 */
export function DokumentAnsicht({ dokument, prozess }: { dokument: Dokument; prozess: Prozess }) {
  const titelId = useId()
  const bpmn = useBpmn(prozess)
  const erste = dokument.abschnitte.findIndex((a) => a.art === 'ueberschrift')
  const deckblatt = erste < 0 ? dokument.abschnitte : dokument.abschnitte.slice(0, erste)
  const inhalt = erste < 0 ? [] : dokument.abschnitte.slice(erste)

  const abschnitt = (a: Abschnitt, i: number): ReactNode => {
    switch (a.art) {
      case 'ueberschrift': {
        const text = `${a.nummer} ${a.text}`
        if (a.ebene === 1) return <h4 key={i} className="dokument-h1">{text}</h4>
        if (a.ebene === 2) return <h5 key={i} className="dokument-h2">{text}</h5>
        return <h6 key={i} className="dokument-h3">{text}</h6>
      }
      case 'absatz':
        return <p key={i}>{a.text}</p>
      case 'hinweis':
        return (
          <p key={i} className="dokument-hinweis">
            {a.text}
          </p>
        )
      case 'liste':
        return (
          <ul key={i}>
            {a.punkte.map((p, j) => (
              <li key={j}>{p}</li>
            ))}
          </ul>
        )
      case 'tabelle':
        return (
          <div key={i} className="tabelle-wrap">
            <table className="dokument-tabelle">
              <thead>
                <tr>
                  {a.kopf.map((k, j) => (
                    <th key={j} scope="col">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.zeilen.map((z, j) => (
                  <tr key={j} className={z.every((t) => !t) ? 'leerzeile' : undefined}>
                    {z.map((t, l) => (
                      <td key={l}>{t}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case 'diagramm':
        return (
          <div key={i} className="dokument-diagramm">
            <Diagramm xml={bpmn.xml} klein uebersicht druckbild beschriftung={`Ablaufdiagramm: ${prozess.name || 'Unbenannter Prozess'}`} />
          </div>
        )
    }
  }

  return (
    <article className="dokument" aria-labelledby={titelId}>
      <header className="dokument-deckblatt">
        <h3 id={titelId} className="dokument-titel">
          {dokument.titel}
        </h3>
        <p className="dokument-untertitel">{dokument.untertitel}</p>
        {deckblatt.map(abschnitt)}
      </header>
      <nav className="dokument-gliederung" aria-label={`Gliederung: ${dokument.titel}`}>
        <p className="gliederung-titel">Gliederung</p>
        <ol>
          {gliederung(dokument).map((g) => (
            <li key={g.nummer} className={g.ebene === 2 ? 'gliederung-2' : undefined}>
              {g.nummer} {g.text}
            </li>
          ))}
        </ol>
      </nav>
      {inhalt.map(abschnitt)}
    </article>
  )
}
