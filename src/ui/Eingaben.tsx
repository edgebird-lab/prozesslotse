import { useId, useState, type ReactNode } from 'react'
import { ausMinuten, inMinuten, passendeEinheit, ZEITEINHEITEN, type Zeiteinheit } from '../modell/zeit'

/** Beschriftetes Feld; `kinder` bekommt die Kennung für das Eingabeelement. */
export function Feld({ label, hilfe, fehler, children }: { label: ReactNode; hilfe?: ReactNode; fehler?: string | null; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className={`feld${fehler ? ' feld-fehler' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hilfe && <p className="feld-hilfe">{hilfe}</p>}
      {fehler && (
        <p className="feld-meldung" role="alert">
          {fehler}
        </p>
      )}
    </div>
  )
}

function alsText(n: number, nachkomma: number): string {
  if (!Number.isFinite(n)) return ''
  const f = 10 ** nachkomma
  return String(Math.round(n * f) / f).replace('.', ',')
}

function lies(text: string): number | null {
  let sauber = text.replace(/\s/g, '')
  // „1.234,5“ → Punkt ist Tausendertrenner; „1.5“ ohne Komma → Punkt ist Dezimalzeichen
  if (sauber.includes(',')) sauber = sauber.replace(/\./g, '').replace(',', '.')
  if (sauber === '' || sauber === '-') return null
  const n = Number(sauber)
  return Number.isFinite(n) ? n : null
}

/** Zahlenfeld, das deutsche Kommazahlen versteht und beim Tippen nicht springt. */
export function ZahlEingabe({
  wert,
  onAendern,
  id,
  min,
  max,
  nachkomma = 2,
  suffix,
  ariaLabel,
  breit,
}: {
  wert: number
  onAendern: (n: number) => void
  id?: string
  min?: number
  max?: number
  nachkomma?: number
  suffix?: string
  ariaLabel?: string
  breit?: boolean
}) {
  // Beim Tippen zählt der eigene Text, sonst der formatierte Wert
  const [text, setText] = useState('')
  const [fokus, setFokus] = useState(false)
  const begrenze = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))
  return (
    <span className={`zahl${breit ? ' zahl-breit' : ''}`}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={fokus ? text : alsText(wert, nachkomma)}
        aria-label={ariaLabel}
        onFocus={() => {
          setText(alsText(wert, nachkomma))
          setFokus(true)
        }}
        onBlur={() => setFokus(false)}
        onChange={(e) => {
          setText(e.target.value)
          const n = lies(e.target.value)
          if (n !== null) onAendern(begrenze(n))
        }}
      />
      {suffix && <span className="zahl-suffix">{suffix}</span>}
    </span>
  )
}

/** Zeit als Zahl mit Einheit; gespeichert wird immer in Minuten. */
export function ZeitEingabe({ wert, onAendern, stundenProTag, id, ariaLabel }: { wert: number; onAendern: (minuten: number) => void; stundenProTag: number; id?: string; ariaLabel?: string }) {
  const [einheit, setEinheit] = useState<Zeiteinheit>(() => passendeEinheit(wert, stundenProTag))
  const einheitId = useId()
  return (
    <span className="zeit">
      <ZahlEingabe id={id} ariaLabel={ariaLabel} wert={ausMinuten(wert, einheit, stundenProTag)} min={0} onAendern={(n) => onAendern(inMinuten(n, einheit, stundenProTag))} />
      <select
        id={einheitId}
        aria-label="Einheit"
        value={einheit}
        onChange={(e) => {
          const neu = e.target.value as Zeiteinheit
          onAendern(inMinuten(ausMinuten(wert, einheit, stundenProTag), neu, stundenProTag))
          setEinheit(neu)
        }}
      >
        {ZEITEINHEITEN.map((z) => (
          <option key={z.einheit} value={z.einheit}>
            {z.name}
          </option>
        ))}
      </select>
    </span>
  )
}

/** Prozent als Zahl 0–100, gespeichert als Anteil 0–1. */
export function ProzentEingabe({ anteil, onAendern, id, ariaLabel, max = 100 }: { anteil: number; onAendern: (anteil: number) => void; id?: string; ariaLabel?: string; max?: number }) {
  return <ZahlEingabe id={id} ariaLabel={ariaLabel} wert={anteil * 100} min={0} max={max} nachkomma={1} suffix="%" onAendern={(n) => onAendern(n / 100)} />
}

export interface Option<T extends string> {
  wert: T
  text: string
  symbol?: ReactNode
  beschreibung?: string
}

/** Auswahl als Gruppe von Knöpfen (Radiogruppe). */
export function Auswahl<T extends string>({ label, wert, optionen, onAendern, spalten }: { label: string; wert: T; optionen: Option<T>[]; onAendern: (w: T) => void; spalten?: number }) {
  const name = useId()
  return (
    <fieldset className="auswahl" style={spalten ? { gridTemplateColumns: `repeat(${spalten}, minmax(0, 1fr))` } : undefined}>
      <legend>{label}</legend>
      {optionen.map((o) => (
        <label key={o.wert} className={`auswahl-option${wert === o.wert ? ' an' : ''}`}>
          <input type="radio" name={name} value={o.wert} checked={wert === o.wert} onChange={() => onAendern(o.wert)} />
          {o.symbol}
          <span>
            {o.text}
            {o.beschreibung && <small>{o.beschreibung}</small>}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

export function Schalter({ an, onAendern, children }: { an: boolean; onAendern: (an: boolean) => void; children: ReactNode }) {
  return (
    <label className="schalter">
      <input type="checkbox" role="switch" checked={an} onChange={(e) => onAendern(e.target.checked)} />
      <span className="schalter-spur" aria-hidden="true" />
      <span>{children}</span>
    </label>
  )
}
