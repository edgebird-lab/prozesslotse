import { beispielMitCompliance } from '../../compliance/beispiel'
import { beispielOnlineProjekt } from '../../modell/beispiel'
import type { AusloeserArt } from '../../modell/typen'
import { Auswahl, Feld, ZahlEingabe } from '../Eingaben'
import { useApp } from '../kontext'
import { Lernhinweis } from '../Lernhinweis'
import { Symbol } from '../Symbol'

const AUSLOESER: { wert: AusloeserArt; text: string; beschreibung: string; symbol: 'start-nachricht' | 'start-zeit' | 'start-bedingung' | 'start' }[] = [
  { wert: 'nachricht', text: 'Nachricht', beschreibung: 'Anruf, E-Mail, Auftrag', symbol: 'start-nachricht' },
  { wert: 'zeit', text: 'Zeitpunkt', beschreibung: 'z. B. jeden Morgen', symbol: 'start-zeit' },
  { wert: 'bedingung', text: 'Bedingung', beschreibung: 'z. B. Bestand zu niedrig', symbol: 'start-bedingung' },
  { wert: 'manuell', text: 'Von Hand', beschreibung: 'jemand startet ihn', symbol: 'start' },
]

export function RahmenSchritt() {
  const { z, p, aendere, dispatch, datei } = useApp()
  const leer = !p.name && p.ablauf.schritte.length === 0 && p.rollen.length === 0 && !z.projekt.soll
  const setze = (werte: Partial<typeof p>, feld: string) => aendere({ ...p, ...werte }, { gruppe: `rahmen:${feld}` })

  return (
    <div className="schritt">
      {leer && (
        <section className="willkommen">
          <h2>Willkommen beim Prozesslotsen</h2>
          <p>
            Du beschreibst einen Ablauf mit einfachen Fragen. Daraus entsteht ein BPMN-Diagramm, das Werkzeug rechnet Durchlaufzeit, Kosten und Auslastung aus, zeigt
            Schwachstellen und schlägt Verbesserungen mit ihrer Wirkung vor.
          </p>
          <div className="knopfreihe">
            <button type="button" className="knopf knopf-haupt" onClick={() => void datei.ladeBeispiel(beispielMitCompliance(), 'pruefen')}>
              Mit dem Beispiel „Lieferdienst“ starten
            </button>
            <button type="button" className="knopf" onClick={() => void datei.ladeBeispiel(beispielOnlineProjekt(), 'ablauf')}>
              Beispiel „Onlinebestellung“ mit Rücksprung
            </button>
            <span className="oder">oder unten den eigenen Prozess anlegen</span>
          </div>
        </section>
      )}

      <h2>1 · Worum geht es?</h2>
      <Lernhinweis thema="rahmen" />

      <Feld label="Wie heißt der Prozess?" hilfe="Am besten von wo bis wo, z. B. „Bestellung bis Rechnung“.">
        {(id) => <input id={id} type="text" value={p.name} onChange={(e) => setze({ name: e.target.value }, 'name')} placeholder="z. B. Bestellung bis Rechnung" />}
      </Feld>
      <Feld label="Kurze Beschreibung (optional)">
        {(id) => <textarea id={id} rows={2} value={p.beschreibung} onChange={(e) => setze({ beschreibung: e.target.value }, 'beschreibung')} />}
      </Feld>

      <Auswahl
        label="Was löst den Prozess aus?"
        wert={p.ausloeser.art}
        spalten={2}
        optionen={AUSLOESER.map((a) => ({ wert: a.wert, text: a.text, beschreibung: a.beschreibung, symbol: <Symbol art={a.symbol} groesse={26} /> }))}
        onAendern={(art) => setze({ ausloeser: { ...p.ausloeser, art, von: art === 'nachricht' ? p.ausloeser.von : null } }, 'ausloeser-art')}
      />
      {p.ausloeser.art === 'nachricht' && p.teilnehmer.length > 0 && (
        <Feld label="Von wem kommt die Nachricht?">
          {(id) => (
            <select id={id} value={p.ausloeser.von ?? ''} onChange={(e) => setze({ ausloeser: { ...p.ausloeser, von: e.target.value || null } }, 'ausloeser-von')}>
              <option value="">Von innerhalb</option>
              {p.teilnehmer.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name || 'Unbenannt'}
                </option>
              ))}
            </select>
          )}
        </Feld>
      )}
      <Feld label="Auslöser in Worten">
        {(id) => (
          <input id={id} type="text" value={p.ausloeser.text} onChange={(e) => setze({ ausloeser: { ...p.ausloeser, text: e.target.value } }, 'ausloeser')} placeholder="z. B. Kunde bestellt telefonisch" />
        )}
      </Feld>
      <Feld label="Was ist das Ergebnis, wenn alles normal läuft?">
        {(id) => <input id={id} type="text" value={p.ergebnis} onChange={(e) => setze({ ergebnis: e.target.value }, 'ergebnis')} placeholder="z. B. Ware zugestellt" />}
      </Feld>

      <div className="feldreihe">
        <Feld label="Neue Vorgänge pro Arbeitstag" hilfe="Grundlage für Auslastung und Tageskosten.">
          {(id) => <ZahlEingabe id={id} wert={p.vorgaengeProTag} min={0} onAendern={(n) => setze({ vorgaengeProTag: n }, 'vorgaenge')} />}
        </Feld>
        <Feld label="Stunden pro Arbeitstag">
          {(id) => <ZahlEingabe id={id} wert={p.arbeitsstundenProTag} min={1} max={24} onAendern={(n) => setze({ arbeitsstundenProTag: n }, 'stunden')} />}
        </Feld>
      </div>

      <div className="schritt-fuss">
        <button type="button" className="knopf knopf-haupt" onClick={() => dispatch({ typ: 'schritt', schritt: 'beteiligte' })}>
          Weiter: Wer ist beteiligt?
        </button>
      </div>
    </div>
  )
}
