import { flushSync } from 'react-dom'
import { kontrollAngaben, schrittText } from '../../compliance/ableitung'
import { EINWEISUNGEN, KONTROLLARTEN, NACHWEISE, neueKontrollAngaben, neueWeitereKontrolle } from '../../compliance/standard'
import type { KontrollAngaben, WeitereKontrolle } from '../../compliance/typen'
import type { Aufgabe } from '../../modell/typen'
import { Schalter } from '../Eingaben'
import { useApp } from '../kontext'
import { useAufgabenFilter, useCompliance, vierAugenStatus } from './analyse'
import { FilterHinweis } from './BelegeTeil'
import { CFeld, KatalogAuswahl, KatalogListe, TextFeld } from './Eingaben'
import { erstesFeld, fokussiere, nachbar } from './fokus'

export function KontrollenTeil() {
  const { c, k, aendere } = useCompliance()
  const { dispatch } = useApp()
  const filter = useAufgabenFilter(k)
  const alle = k.aufgaben.filter((a) => a.art === 'pruefung' || a.art === 'freigabe')
  const gezeigt = filter.aufgabe ? alle.filter((a) => a.id === filter.aufgabe!.id) : alle
  const setzeWeitere = (w: WeitereKontrolle, werte: Partial<WeitereKontrolle>, feld: string) =>
    aendere((x) => ({ ...x, weitereKontrollen: x.weitereKontrollen.map((y) => (y.id === w.id ? { ...y, ...werte } : y)) }), `weitere.${w.id}.${feld}`)

  return (
    <div className="teil">
      <section aria-labelledby="kontrollen-titel" className="felder">
        <h3 id="kontrollen-titel">Kontrollen im Ablauf</h3>
        {filter.aufgabe && <FilterHinweis k={k} aufgabe={filter.aufgabe} aufheben={filter.aufheben} was="Kontrolle" />}
        {alle.length === 0 && (
          <p className="leer-hinweis">
            Im Ablauf ist keine Aufgabe als Prüfung oder Freigabe gekennzeichnet. Im Schritt „Ablauf“ wählst du dafür bei einer Aufgabe unter „Art des Schritts“ die Prüfung oder
            Freigabe.{' '}
            <button type="button" className="knopf-link" onClick={() => dispatch({ typ: 'schritt', schritt: 'ablauf' })}>
              Zum Ablauf
            </button>
          </p>
        )}
        {filter.aufgabe && gezeigt.length === 0 && <p className="leer-hinweis">Dieser Schritt ist keine Prüfung oder Freigabe.</p>}
        {gezeigt.map((a) => (
          <KontrollKarte key={a.id} a={a} angabe={kontrollAngaben(c, a.id)} />
        ))}
      </section>

      <section aria-labelledby="weitere-titel" className="felder">
        <h3 id="weitere-titel">Weitere Kontrollen</h3>
        <p className="leise">Kontrollen außerhalb des Ablaufs, z. B. eine monatliche Stichprobe durch die Steuerberatung.</p>
        {c.weitereKontrollen.map((w, i) => (
          <fieldset key={w.id} className="karte felder" id={`ziel-kontrolle-${w.id}`} tabIndex={-1}>
            <legend>Weitere Kontrolle {i + 1}</legend>
            <div className="feldreihe">
              <TextFeld label="Name" platzhalter="z. B. Stichprobe Steuerberatung" wert={w.name} onAendern={(name) => setzeWeitere(w, { name }, 'name')} />
              <KatalogListe label="Art" katalog={KONTROLLARTEN} wert={w.art} onAendern={(art) => art && setzeWeitere(w, { art }, 'art')} />
            </div>
            <div className="feldreihe">
              <TextFeld label="Verantwortlich" wert={w.verantwortlich} onAendern={(verantwortlich) => setzeWeitere(w, { verantwortlich }, 'verantwortlich')} />
              <TextFeld label="Häufigkeit" platzhalter="z. B. monatlich, 10 Belege" wert={w.haeufigkeit} onAendern={(haeufigkeit) => setzeWeitere(w, { haeufigkeit }, 'haeufigkeit')} />
            </div>
            <Schalter an={w.extern} onAendern={(extern) => setzeWeitere(w, { extern }, 'extern')}>
              Externe Stelle, z. B. Steuerberatung
            </Schalter>
            <div className="feldreihe">
              <KatalogListe id={`ziel-kontrolle-${w.id}-nachweis`} label="Nachweis" katalog={NACHWEISE} wert={w.nachweis} onAendern={(nachweis) => nachweis && setzeWeitere(w, { nachweis }, 'nachweis')} />
              <CFeld label="Sichert ab">
                {(id) => (
                  <select id={id} value={w.bezugAufgabeId ?? ''} onChange={(e) => setzeWeitere(w, { bezugAufgabeId: e.target.value || null }, 'bezug')}>
                    <option value="">keinen bestimmten Schritt</option>
                    {k.aufgaben.map((a) => (
                      <option key={a.id} value={a.id}>
                        {schrittText(k, a)}
                      </option>
                    ))}
                  </select>
                )}
              </CFeld>
            </div>
            <button
              type="button"
              className="knopf knopf-klein knopf-leise"
              onClick={(e) => {
                // Danach auf die nächste Kontrolle, sonst die Überschrift des Abschnitts
                const ersatz = nachbar(e.currentTarget.closest('fieldset'), 'fieldset.karte') ?? document.getElementById('weitere-titel')
                flushSync(() => aendere((x) => ({ ...x, weitereKontrollen: x.weitereKontrollen.filter((y) => y.id !== w.id) })))
                fokussiere(ersatz)
              }}
            >
              Kontrolle entfernen
            </button>
          </fieldset>
        ))}
        <div className="knopfreihe">
          <button
            type="button"
            id="ziel-kontrolle-weitere"
            className="knopf"
            onClick={() => {
              // Die neue Kontrolle steht über dem Knopf: Fokus in ihr Feld „Name“
              const neu = neueWeitereKontrolle()
              flushSync(() => aendere((x) => ({ ...x, weitereKontrollen: [...x.weitereKontrollen, neu] })))
              fokussiere(erstesFeld(document.getElementById(`ziel-kontrolle-${neu.id}`)))
            }}
          >
            + Weitere Kontrolle
          </button>
        </div>
      </section>

      <section aria-labelledby="einweisung-titel" className="felder" id="ziel-einweisung" tabIndex={-1}>
        <h3 id="einweisung-titel">Einweisung</h3>
        <KatalogAuswahl id="ziel-einweisung-turnus" label="Wie werden Beteiligte eingewiesen?" katalog={EINWEISUNGEN} wert={c.einweisung.turnus} spalten={3} onAendern={(turnus) => aendere((x) => ({ ...x, einweisung: { ...x.einweisung, turnus } }))} />
        <Schalter an={c.einweisung.protokoll} onAendern={(protokoll) => aendere((x) => ({ ...x, einweisung: { ...x.einweisung, protokoll } }))}>
          Die Einweisung wird schriftlich festgehalten
        </Schalter>
      </section>
    </div>
  )
}

function KontrollKarte({ a, angabe }: { a: Aufgabe; angabe: KontrollAngaben | null }) {
  const { k, aendere } = useCompliance()
  const titelId = `kontrolle-${a.id}-titel`
  const setze = (werte: Partial<KontrollAngaben>, feld: string) =>
    aendere((x) => ({ ...x, kontrollen: { ...x.kontrollen, [a.id]: { ...(x.kontrollen[a.id] ?? neueKontrollAngaben(a.art === 'freigabe' ? 'vier_augen' : 'plausibilitaet')), ...werte } } }), `kontrolle.${a.id}.${feld}`)
  return (
    <section className="karte felder" id={`ziel-kontrolle-${a.id}`} tabIndex={-1} aria-labelledby={titelId}>
      <div className="teil-kopf">
        <h4 id={titelId}>{schrittText(k, a)}</h4>
        <span className="leise klein">{a.art === 'freigabe' ? 'Freigabe' : 'Prüfung'}</span>
      </div>
      <p className="leise klein">{vierAugenStatus(k, a)}</p>
      {!angabe && <p className="feld-hilfe">Noch keine Angaben zu dieser Kontrolle.</p>}
      <KatalogAuswahl id={`ziel-kontrolle-${a.id}-art`} label="Art der Kontrolle" katalog={KONTROLLARTEN} wert={angabe?.art ?? null} spalten={2} onAendern={(art) => setze({ art }, 'art')} />
      <TextFeld label="Was wird geprüft?" platzhalter="z. B. Rechnung sachlich und rechnerisch richtig" wert={angabe?.ziel ?? ''} onAendern={(ziel) => setze({ ziel }, 'ziel')} />
      <KatalogAuswahl id={`ziel-kontrolle-${a.id}-nachweis`} label="Wie wird die Kontrolle nachgewiesen?" katalog={NACHWEISE} wert={angabe?.nachweis ?? null} spalten={2} onAendern={(nachweis) => setze({ nachweis }, 'nachweis')} />
    </section>
  )
}
