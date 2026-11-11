/**
 * Eingaben der Compliance-Doku. Wiederverwendet werden `Auswahl` und
 * `Schalter`; neu sind Felder mit fester Id (Ziel für „Beheben“), Chips als
 * Mehrfachauswahl, Datum, optionale Zahl und Ja/Nein/Weiß nicht.
 */
import { useId, useState, type ReactNode } from 'react'
import type { Eintrag } from '../../compliance/standard'
import { Auswahl } from '../Eingaben'
import { useApp } from '../kontext'
import { COMPLIANCE_LERNINHALTE, type ComplianceThema } from './lerninhalte'

/** Beschriftetes Feld; `id` ist fest, wenn „Beheben“ das Feld ansteuern soll. */
export function CFeld({ label, id, hilfe, children }: { label: ReactNode; id?: string; hilfe?: ReactNode; children: (id: string) => ReactNode }) {
  const eigene = useId()
  const feldId = id ?? eigene
  return (
    <div className="feld">
      <label htmlFor={feldId}>{label}</label>
      {children(feldId)}
      {hilfe && <p className="feld-hilfe">{hilfe}</p>}
    </div>
  )
}

export function TextFeld({
  label,
  wert,
  onAendern,
  id,
  hilfe,
  platzhalter,
  mehrzeilig,
  typ = 'text',
}: {
  label: ReactNode
  wert: string
  onAendern: (s: string) => void
  id?: string
  hilfe?: ReactNode
  platzhalter?: string
  mehrzeilig?: boolean
  typ?: 'text' | 'email' | 'tel' | 'url'
}) {
  return (
    <CFeld label={label} id={id} hilfe={hilfe}>
      {(fid) =>
        mehrzeilig ? (
          <textarea id={fid} rows={2} value={wert} placeholder={platzhalter} onChange={(e) => onAendern(e.target.value)} />
        ) : (
          <input id={fid} type="text" inputMode={typ} autoComplete="off" value={wert} placeholder={platzhalter} onChange={(e) => onAendern(e.target.value)} />
        )
      }
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

/** Ganze Zahl oder leer (null). */
export function OptionaleZahl({ wert, onAendern, id, ariaLabel, min = 0, max = 1_000_000, suffix }: { wert: number | null; onAendern: (n: number | null) => void; id?: string; ariaLabel?: string; min?: number; max?: number; suffix?: string }) {
  const [text, setText] = useState<string | null>(null)
  return (
    <span className="zahl">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        value={text ?? (wert === null ? '' : String(wert))}
        onFocus={() => setText(wert === null ? '' : String(wert))}
        onBlur={() => setText(null)}
        onChange={(e) => {
          setText(e.target.value)
          const t = e.target.value.trim()
          if (t === '') return onAendern(null)
          if (/^\d+$/.test(t)) onAendern(Math.min(max, Math.max(min, Number(t))))
        }}
      />
      {suffix && <span className="zahl-suffix">{suffix}</span>}
    </span>
  )
}

export function DatumEingabe({ wert, onAendern, id, ariaLabel }: { wert: string | null; onAendern: (d: string | null) => void; id?: string; ariaLabel?: string }) {
  return <input id={id} type="date" className="datum" aria-label={ariaLabel} value={wert ?? ''} onChange={(e) => onAendern(e.target.value || null)} />
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
export function KatalogAuswahl<T extends string>({ label, katalog, wert, onAendern, spalten }: { label: string; katalog: readonly Eintrag<T>[]; wert: T | null; onAendern: (w: T) => void; spalten?: number }) {
  return (
    <Auswahl<T | ''>
      label={label}
      wert={wert ?? ''}
      spalten={spalten}
      optionen={katalog.map((e) => ({ wert: e.wert, text: e.text, beschreibung: e.beschreibung }))}
      onAendern={(w) => w !== '' && onAendern(w)}
    />
  )
}

/** Auswahlliste aus einem Katalog; `null` erscheint als „bitte wählen“. */
export function KatalogListe<T extends string>({ label, katalog, wert, onAendern, id, leer = 'bitte wählen' }: { label: ReactNode; katalog: readonly Eintrag<T>[]; wert: T | null; onAendern: (w: T | null) => void; id?: string; leer?: string }) {
  return (
    <CFeld label={label} id={id}>
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
export function JaNeinOffen({ label, wert, onAendern, ohneOffen }: { label: string; wert: boolean | null; onAendern: (w: boolean | null) => void; ohneOffen?: boolean }) {
  const optionen: { wert: JaNein; text: string }[] = [
    { wert: 'ja', text: 'Ja' },
    { wert: 'nein', text: 'Nein' },
    ...(ohneOffen ? [] : [{ wert: 'offen' as const, text: 'Weiß nicht' }]),
  ]
  return (
    <Auswahl<JaNein | ''>
      label={label}
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
