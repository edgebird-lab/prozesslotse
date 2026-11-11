/**
 * Eingaben der Compliance-Doku. Wiederverwendet werden `Auswahl` und
 * `Schalter`; neu sind Felder mit fester Id (Ziel für „Beheben“), Chips als
 * Mehrfachauswahl, Datum, optionale Zahl und Ja/Nein/Weiß nicht.
 */
import { useId, useState, type ReactNode } from 'react'
import { istPlausiblesDatum } from '../../compliance/datum'
import type { Eintrag } from '../../compliance/standard'
import { Auswahl } from '../Eingaben'
import { useApp } from '../kontext'
import { COMPLIANCE_LERNINHALTE, type ComplianceThema } from './lerninhalte'

/** Id der Meldung unter einem Feld (für aria-describedby). */
const meldungId = (feldId: string) => `${feldId}-meldung`

/** Meldung direkt am Feld; Screenreader lesen sie sofort vor. */
export function FeldMeldung({ feldId, text }: { feldId: string; text: string | null | undefined }) {
  if (!text) return null
  return (
    <p className="feld-meldung" role="alert" id={meldungId(feldId)}>
      {text}
    </p>
  )
}

/** Beschriftetes Feld; `id` ist fest, wenn „Beheben“ das Feld ansteuern soll. `fehler` steht als Meldung unter dem Feld. */
export function CFeld({ label, id, hilfe, fehler, children }: { label: ReactNode; id?: string; hilfe?: ReactNode; fehler?: string | null; children: (id: string) => ReactNode }) {
  const eigene = useId()
  const feldId = id ?? eigene
  return (
    <div className={`feld${fehler ? ' feld-fehler' : ''}`}>
      <label htmlFor={feldId}>{label}</label>
      {children(feldId)}
      {hilfe && <p className="feld-hilfe">{hilfe}</p>}
      <FeldMeldung feldId={feldId} text={fehler} />
    </div>
  )
}

export function TextFeld({
  label,
  wert,
  onAendern,
  id,
  hilfe,
  fehler,
  platzhalter,
  mehrzeilig,
  typ = 'text',
}: {
  label: ReactNode
  wert: string
  onAendern: (s: string) => void
  id?: string
  hilfe?: ReactNode
  /** Meldung am Feld; das Feld gilt dann als ungültig (aria-invalid). */
  fehler?: string | null
  platzhalter?: string
  mehrzeilig?: boolean
  typ?: 'text' | 'email' | 'tel' | 'url'
}) {
  return (
    <CFeld label={label} id={id} hilfe={hilfe} fehler={fehler}>
      {(fid) => {
        const pruefung = fehler ? { 'aria-invalid': true, 'aria-describedby': meldungId(fid) } : {}
        return mehrzeilig ? (
          <textarea id={fid} rows={2} value={wert} placeholder={platzhalter} onChange={(e) => onAendern(e.target.value)} {...pruefung} />
        ) : (
          <input id={fid} type="text" inputMode={typ} autoComplete="off" value={wert} placeholder={platzhalter} onChange={(e) => onAendern(e.target.value)} {...pruefung} />
        )
      }}
    </CFeld>
  )
}

/** Liste als Text, ein Eintrag je Zeile; leere Zeilen bleiben beim Tippen stehen und zählen später nicht. */
export function ZeilenFeld({ label, werte, onAendern, id, hilfe, platzhalter }: { label: ReactNode; werte: string[]; onAendern: (w: string[]) => void; id?: string; hilfe?: ReactNode; platzhalter?: string }) {
  return (
    <CFeld label={label} id={id} hilfe={hilfe ?? 'Ein Eintrag je Zeile.'}>
      {(fid) => <textarea id={fid} rows={Math.max(2, werte.length + 1)} value={werte.join('\n')} placeholder={platzhalter} onChange={(e) => onAendern(e.target.value.split('\n'))} />}
    </CFeld>
  )
}

/** Was an einer Eingabe für `OptionaleZahl` nicht stimmt; null, wenn sie gilt. */
function zahlFehler(text: string, min: number, max: number, einheit?: string): string | null {
  const t = text.trim()
  if (t === '') return null
  if (!/^\d+$/.test(t)) return 'Bitte eine ganze Zahl eingeben, z. B. 12.'
  const n = Number(t)
  const mit = (z: number) => (einheit ? `${z} ${einheit}` : String(z))
  if (n > max) return `Höchstens ${mit(max)}.`
  if (n < min) return `Mindestens ${mit(min)}.`
  return null
}

/**
 * Ganze Zahl oder leer (null). Ungültiges (Text, zu groß, zu klein) wird nicht übernommen,
 * sondern bleibt mit einer Meldung am Feld stehen, bis es korrigiert ist.
 */
export function OptionaleZahl({
  wert,
  onAendern,
  id,
  ariaLabel,
  min = 0,
  max = 1_000_000,
  suffix,
  einheit,
}: {
  wert: number | null
  onAendern: (n: number | null) => void
  id?: string
  ariaLabel?: string
  min?: number
  max?: number
  suffix?: string
  /** Einheit für die Meldung, z. B. „Jahre“ in „Höchstens 30 Jahre.“ */
  einheit?: string
}) {
  const [text, setText] = useState<string | null>(null)
  const eigene = useId()
  const feldId = id ?? eigene
  const fehler = text === null ? null : zahlFehler(text, min, max, einheit)
  return (
    <>
      <span className="zahl">
        <input
          id={feldId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={ariaLabel}
          aria-invalid={fehler ? true : undefined}
          aria-describedby={fehler ? meldungId(feldId) : undefined}
          value={text ?? (wert === null ? '' : String(wert))}
          onFocus={() => setText((t) => t ?? (wert === null ? '' : String(wert)))}
          // Gültiges zeigt danach den gespeicherten Wert; Ungültiges bleibt mit der Meldung stehen
          onBlur={() => setText((t) => (t !== null && zahlFehler(t, min, max, einheit) ? t : null))}
          onChange={(e) => {
            setText(e.target.value)
            const t = e.target.value.trim()
            if (t === '') return onAendern(null)
            if (!zahlFehler(t, min, max, einheit)) onAendern(Number(t))
          }}
        />
        {suffix && <span className="zahl-suffix">{suffix}</span>}
      </span>
      <FeldMeldung feldId={feldId} text={fehler} />
    </>
  )
}

/**
 * Datum; übernommen werden nur gültige Daten zwischen 1900 und 2199. Beim Tippen des Jahres entstehen
 * Zwischenstände (z. B. 0002) oder fünfstellige Jahre; sie bleiben in der Eingabe und gelangen nicht in die Angaben.
 */
export function DatumEingabe({ wert, onAendern, id, ariaLabel }: { wert: string | null; onAendern: (d: string | null) => void; id?: string; ariaLabel?: string }) {
  const [text, setText] = useState<string | null>(null)
  return (
    <input
      id={id}
      type="date"
      className="datum"
      min="1900-01-01"
      max="2199-12-31"
      aria-label={ariaLabel}
      value={text ?? wert ?? ''}
      onFocus={() => setText(wert ?? '')}
      onBlur={() => setText(null)}
      onChange={(e) => {
        const d = e.target.value
        setText(d)
        if (d === '') onAendern(null)
        else if (istPlausiblesDatum(d)) onAendern(d)
      }}
    />
  )
}

export function DatumFeld({ label, wert, onAendern, id }: { label: ReactNode; wert: string | null; onAendern: (d: string | null) => void; id?: string }) {
  return <CFeld label={label} id={id}>{(fid) => <DatumEingabe id={fid} wert={wert} onAendern={onAendern} />}</CFeld>
}

/** Mehrfachauswahl als Gruppe von Kontrollkästchen; die Werte bleiben in Katalogreihenfolge. */
export function Chips<T extends string>({ legende, optionen, werte, onAendern, id }: { legende: ReactNode; optionen: readonly Eintrag<T>[]; werte: readonly T[]; onAendern: (w: T[]) => void; id?: string }) {
  return (
    <fieldset className="chips-auswahl" id={id}>
      <legend>{legende}</legend>
      <div className="chips-liste">
        {optionen.map((o) => {
          const an = werte.includes(o.wert)
          return (
            <label key={o.wert} className={`chip-option${an ? ' an' : ''}`}>
              <input
                type="checkbox"
                value={o.wert}
                checked={an}
                onChange={(e) => {
                  const neu = new Set(werte)
                  if (e.target.checked) neu.add(o.wert)
                  else neu.delete(o.wert)
                  onAendern(optionen.filter((x) => neu.has(x.wert)).map((x) => x.wert))
                }}
              />
              <span>{o.text}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Einfachauswahl aus einem Katalog als Knopfgruppe; `null` = noch nichts gewählt. */
export function KatalogAuswahl<T extends string>({ label, katalog, wert, onAendern, spalten, id }: { label: string; katalog: readonly Eintrag<T>[]; wert: T | null; onAendern: (w: T) => void; spalten?: number; id?: string }) {
  return (
    <Auswahl<T | ''>
      label={label}
      id={id}
      wert={wert ?? ''}
      spalten={spalten}
      optionen={katalog.map((e) => ({ wert: e.wert, text: e.text, beschreibung: e.beschreibung }))}
      onAendern={(w) => w !== '' && onAendern(w)}
    />
  )
}

/** Auswahlliste aus einem Katalog; `null` erscheint als „bitte wählen“. */
export function KatalogListe<T extends string>({
  label,
  katalog,
  wert,
  onAendern,
  id,
  hilfe,
  leer = 'bitte wählen',
}: {
  label: ReactNode
  katalog: readonly Eintrag<T>[]
  wert: T | null
  onAendern: (w: T | null) => void
  id?: string
  hilfe?: ReactNode
  leer?: string
}) {
  return (
    <CFeld label={label} id={id} hilfe={hilfe}>
      {(fid) => (
        <select id={fid} value={wert ?? ''} onChange={(e) => onAendern(e.target.value === '' ? null : (e.target.value as T))}>
          <option value="">{leer}</option>
          {katalog.map((e) => (
            <option key={e.wert} value={e.wert}>
              {e.text}
            </option>
          ))}
        </select>
      )}
    </CFeld>
  )
}

type JaNein = 'ja' | 'nein' | 'offen'

/** Ja · Nein · Weiß nicht für Angaben, die auch offen sein dürfen. */
export function JaNeinOffen({ label, wert, onAendern, ohneOffen, id }: { label: string; wert: boolean | null; onAendern: (w: boolean | null) => void; ohneOffen?: boolean; id?: string }) {
  const optionen: { wert: JaNein; text: string }[] = [
    { wert: 'ja', text: 'Ja' },
    { wert: 'nein', text: 'Nein' },
    ...(ohneOffen ? [] : [{ wert: 'offen' as const, text: 'Weiß nicht' }]),
  ]
  return (
    <Auswahl<JaNein | ''>
      label={label}
      id={id}
      spalten={optionen.length}
      wert={wert === true ? 'ja' : wert === false ? 'nein' : ohneOffen ? '' : 'offen'}
      optionen={optionen}
      onAendern={(w) => onAendern(w === 'ja' ? true : w === 'nein' ? false : null)}
    />
  )
}

/** Erklärung mit Quelle; erscheint nur im Lernmodus (wie `Lernhinweis`, ohne BPMN-Symbol). */
export function ComplianceLernhinweis({ thema }: { thema: ComplianceThema }) {
  const { z } = useApp()
  if (!z.lernmodus) return null
  const inhalt = COMPLIANCE_LERNINHALTE[thema]
  return (
    <aside className="lernhinweis lernhinweis-ohne-symbol" aria-label={`Lernhinweis: ${inhalt.titel}`}>
      <div>
        <p className="lernhinweis-kopf">
          <strong>{inhalt.titel}</strong> <span>· Quelle: {inhalt.quelle}</span>
        </p>
        <p>{inhalt.text}</p>
      </div>
    </aside>
  )
}
