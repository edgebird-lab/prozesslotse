import { useState } from 'react'
import { TOM_BEREICHE } from '../../compliance/standard'
import type { TomAngaben, TomBereich } from '../../compliance/typen'
import { useCompliance } from './analyse'
import { Chips, FeldMeldung, TextFeld } from './Eingaben'

/** Was jeder Bereich meint (Art. 32 Abs. 1 DSGVO in eigenen Worten); nur in der Oberfläche. */
const ERKLAERUNG: Record<TomBereich, string> = {
  pseudonymisierung: 'Namen durch Nummern ersetzen, wo der Name nicht gebraucht wird.',
  verschluesselung: 'Daten so speichern und übertragen, dass Unbefugte sie nicht lesen können, z. B. auf verschlüsselten Laptops und über https-Verbindungen (TLS).',
  vertraulichkeit: 'Nur Befugte sehen die Daten, und niemand ändert sie unbemerkt.',
  verfuegbarkeit: 'Die Daten sind da, wenn sie gebraucht werden, und die Systeme halten Störungen und Last stand.',
  wiederherstellung: 'Nach einem Ausfall lassen sich Daten und Zugang rasch wiederherstellen.',
  ueberpruefung: 'Die Maßnahmen werden regelmäßig geprüft, bewertet und verbessert.',
}

export function TomTeil() {
  return (
    <div className="teil">
      <h3>Schutzmaßnahmen</h3>
      <p className="leise">Je Bereich mindestens eine Maßnahme wählen oder begründen, warum er nicht zutrifft. Die Vorschläge sind Beispiele; eigene Maßnahmen lassen sich ergänzen.</p>
      {TOM_BEREICHE.map((b) => (
        <TomBereichKarte key={b.wert} wert={b.wert} name={b.name} vorschlaege={b.vorschlaege} />
      ))}
    </div>
  )
}

function TomBereichKarte({ wert, name, vorschlaege }: { wert: TomBereich; name: string; vorschlaege: string[] }) {
  const { c, aendere } = useCompliance()
  const [eigene, setEigene] = useState('')
  const t = c.toms[wert]
  const titelId = `tom-${wert}-titel`
  const setze = (werte: Partial<TomAngaben>, feld: string) => aendere((x) => ({ ...x, toms: { ...x.toms, [wert]: { ...x.toms[wert], ...werte } } }), `tom.${wert}.${feld}`)
  const optionen = [...vorschlaege, ...t.massnahmen.filter((m) => !vorschlaege.includes(m))].map((m) => ({ wert: m, text: m }))
  // Der Knopf bleibt bedienbar (ein gesperrter Knopf verliert den Fokus); was fehlt, meldet das Feld
  const [fehler, setFehler] = useState<string | null>(null)
  const feldId = `tom-${wert}-eigene`
  const ergaenzen = () => {
    const m = eigene.trim()
    const problem = !m ? 'Gib zuerst eine Maßnahme ein.' : t.massnahmen.includes(m) ? `„${m}“ ist schon gewählt.` : null
    if (problem) {
      setFehler(problem)
      document.getElementById(feldId)?.focus()
      return
    }
    setze({ massnahmen: [...t.massnahmen, m] }, 'eigene')
    setEigene('')
    setFehler(null)
  }
  return (
    <section className="karte felder" id={`ziel-tom-${wert}`} tabIndex={-1} aria-labelledby={titelId}>
      <h4 id={titelId}>{name}</h4>
      <p className="leise klein">{ERKLAERUNG[wert]}</p>
      <Chips id={`ziel-tom-${wert}-massnahmen`} legende={`Maßnahmen: ${name}`} optionen={optionen} werte={t.massnahmen} onAendern={(massnahmen) => setze({ massnahmen }, 'massnahmen')} />
      <form
        className="inline-anlegen"
        onSubmit={(e) => {
          e.preventDefault()
          ergaenzen()
        }}
      >
        <input
          id={feldId}
          type="text"
          aria-label={`Eigene Maßnahme für ${name}`}
          aria-invalid={fehler ? true : undefined}
          aria-describedby={fehler ? `${feldId}-meldung` : undefined}
          placeholder="Eigene Maßnahme"
          value={eigene}
          onChange={(e) => {
            setEigene(e.target.value)
            setFehler(null)
          }}
        />
        <button type="submit" className="knopf knopf-klein">
          + Eigene Maßnahme
        </button>
      </form>
      <FeldMeldung feldId={feldId} text={fehler} />
      <TextFeld label="Trifft nicht zu, weil …" wert={t.nichtZutreffend} onAendern={(nichtZutreffend) => setze({ nichtZutreffend }, 'nicht')} />
    </section>
  )
}
