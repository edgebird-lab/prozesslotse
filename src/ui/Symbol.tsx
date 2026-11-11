import type { ReactNode } from 'react'

/** Kleine BPMN-Symbole für Auswahl, Gliederung und Lernmodus. */
export type SymbolArt =
  | 'aufgabe'
  | 'manuell'
  | 'benutzer'
  | 'xor'
  | 'und'
  | 'oder'
  | 'wiederholung'
  | 'warten-zeit'
  | 'warten-nachricht'
  | 'start'
  | 'start-nachricht'
  | 'start-zeit'
  | 'start-bedingung'
  | 'ende'
  | 'ende-terminierung'
  | 'bahn'
  | 'kennzahl'
  | 'verbessern'
  | 'ereignisgateway'
  | 'ruecksprung'
  | 'teilprozess'
  | 'mehrfach'
  | 'mehrfach-gleichzeitig'
  | 'unterbrechung'
  | 'unterbrechung-neben'
  | 'erster'
  | 'adhoc'

export function Symbol({ art, groesse = 28 }: { art: SymbolArt; groesse?: number }) {
  return (
    <svg className="symbol" width={groesse} height={groesse} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {inhalt(art)}
    </svg>
  )
}

/** Kreuz für Entfernen-Knöpfe (statt Textzeichen, das je nach Schriftglättung farbig wirkt). */
export function Kreuz() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

const strich = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

function raute(innen: ReactNode) {
  return (
    <>
      <path d="M16 3 29 16 16 29 3 16Z" {...strich} />
      {innen}
    </>
  )
}

function brief(cx: number, cy: number) {
  return (
    <>
      <rect x={cx - 5} y={cy - 3.5} width="10" height="7" rx="0.8" {...strich} strokeWidth={1.3} />
      <path d={`M${cx - 5} ${cy - 3.2} ${cx} ${cy + 0.6} ${cx + 5} ${cy - 3.2}`} {...strich} strokeWidth={1.3} />
    </>
  )
}

function uhr(cx: number, cy: number) {
  return (
    <>
      <circle cx={cx} cy={cy} r="5.2" {...strich} strokeWidth={1.3} />
      <path d={`M${cx} ${cy - 3.4}V${cy}l2.4 1.6`} {...strich} strokeWidth={1.3} />
    </>
  )
}

function inhalt(art: SymbolArt) {
  switch (art) {
    case 'aufgabe':
      return <rect x="3" y="7" width="26" height="18" rx="4" {...strich} />
    case 'manuell':
      return (
        <>
          <rect x="3" y="7" width="26" height="18" rx="4" {...strich} />
          <path d="M7.5 15.5h5M7.5 13h6.5M8.5 18h4" {...strich} strokeWidth={1.2} />
        </>
      )
    case 'benutzer':
      return (
        <>
          <rect x="3" y="7" width="26" height="18" rx="4" {...strich} />
          <circle cx="10" cy="12.6" r="2" {...strich} strokeWidth={1.2} />
          <path d="M6.6 19c.6-2.4 2-3.4 3.4-3.4s2.8 1 3.4 3.4" {...strich} strokeWidth={1.2} />
        </>
      )
    case 'xor':
      return raute(<path d="M12 12 20 20M20 12 12 20" {...strich} strokeWidth={2} />)
    case 'und':
      return raute(<path d="M16 10.5v11M10.5 16h11" {...strich} strokeWidth={2} />)
    case 'oder':
      return raute(<circle cx="16" cy="16" r="5.2" {...strich} strokeWidth={2} />)
    case 'wiederholung':
      return (
        <>
          <path d="M9 4 15 10 9 16 3 10Z" {...strich} />
          <path d="M7 8 11 12M11 8 7 12" {...strich} strokeWidth={1.4} />
          <path d="M15 10h7a5 5 0 0 1 0 10H9" {...strich} />
          <path d="M12 17 9 20l3 3" {...strich} />
        </>
      )
    case 'warten-zeit':
      return (
        <>
          <circle cx="16" cy="16" r="12" {...strich} />
          <circle cx="16" cy="16" r="9.6" {...strich} />
          {uhr(16, 16)}
        </>
      )
    case 'warten-nachricht':
      return (
        <>
          <circle cx="16" cy="16" r="12" {...strich} />
          <circle cx="16" cy="16" r="9.6" {...strich} />
          {brief(16, 16)}
        </>
      )
    case 'start':
      return <circle cx="16" cy="16" r="12" {...strich} />
    case 'start-nachricht':
      return (
        <>
          <circle cx="16" cy="16" r="12" {...strich} />
          {brief(16, 16)}
        </>
      )
    case 'start-zeit':
      return (
        <>
          <circle cx="16" cy="16" r="12" {...strich} />
          {uhr(16, 16)}
        </>
      )
    case 'start-bedingung':
      return (
        <>
          <circle cx="16" cy="16" r="12" {...strich} />
          <rect x="11.5" y="10" width="9" height="12" rx="0.8" {...strich} strokeWidth={1.3} />
          <path d="M13.5 13.5h5M13.5 16h5M13.5 18.5h5" {...strich} strokeWidth={1.2} />
        </>
      )
    case 'ende':
      return <circle cx="16" cy="16" r="11" {...strich} strokeWidth={3.4} />
    case 'ende-terminierung':
      // Terminierung: dicker Kreis mit gefülltem Punkt
      return (
        <>
          <circle cx="16" cy="16" r="11" {...strich} strokeWidth={3.4} />
          <circle cx="16" cy="16" r="6" fill="currentColor" />
        </>
      )
    case 'ereignisgateway':
      return raute(
        <>
          <circle cx="16" cy="16" r="6.4" {...strich} strokeWidth={1.2} />
          <circle cx="16" cy="16" r="5" {...strich} strokeWidth={1.2} />
          <path d="M16 12.8 19 15l-1.1 3.4h-3.8L13 15Z" {...strich} strokeWidth={1.1} />
        </>,
      )
    case 'teilprozess':
      // Rahmen mit Namenszeile, darin Start und Ende
      return (
        <>
          <rect x="2.5" y="5.5" width="27" height="21" rx="3.5" {...strich} />
          <path d="M11 10h10" {...strich} strokeWidth={1.2} />
          <circle cx="9" cy="18" r="2.6" {...strich} strokeWidth={1.2} />
          <path d="M11.6 18h7.8" {...strich} strokeWidth={1.2} />
          <circle cx="22" cy="18" r="2.6" {...strich} strokeWidth={2.2} />
        </>
      )
    case 'mehrfach':
      // Aufgabe mit drei waagerechten Strichen unten in der Mitte: je Stück, der Reihe nach
      return (
        <>
          <rect x="3" y="5" width="26" height="22" rx="4" {...strich} />
          <path d="M12.5 15.5h7M12.5 18.5h7M12.5 21.5h7" {...strich} strokeWidth={1.5} />
        </>
      )
    case 'mehrfach-gleichzeitig':
      // drei senkrechte Striche: alle Stücke zur selben Zeit
      return (
        <>
          <rect x="3" y="5" width="26" height="22" rx="4" {...strich} />
          <path d="M13 15v7M16 15v7M19 15v7" {...strich} strokeWidth={1.5} />
        </>
      )
    case 'unterbrechung':
    case 'unterbrechung-neben': {
      // Aufgabe mit Doppelkreis auf der Unterkante: durchgezogen bricht ab, gestrichelt läuft nebenher
      const linie = art === 'unterbrechung-neben' ? { strokeDasharray: '2.2 1.6' } : {}
      return (
        <>
          <path d="M14.5 22H7a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4h18a4 4 0 0 1 4 4v10a4 4 0 0 1-2.2 3.6" {...strich} />
          <circle cx="20" cy="22" r="5.6" {...strich} strokeWidth={1.4} {...linie} />
          <circle cx="20" cy="22" r="3.8" {...strich} strokeWidth={1.1} {...linie} />
        </>
      )
    }
    case 'erster':
      // Rahmen: Raute mit Plus, zwei Zweige, jeder endet in einer Terminierung (dicker Kreis mit Punkt)
      return (
        <>
          <rect x="2.5" y="4.5" width="27" height="23" rx="3.5" {...strich} />
          <path d="M8.5 12 12.5 16 8.5 20 4.5 16Z" {...strich} strokeWidth={1.3} />
          <path d="M10.5 14 13.5 10.5H20M10.5 18 13.5 21.5H20" {...strich} strokeWidth={1.2} />
          <circle cx="23" cy="10.5" r="2.6" {...strich} strokeWidth={1.8} />
          <circle cx="23" cy="10.5" r="1" fill="currentColor" />
          <circle cx="23" cy="21.5" r="2.6" {...strich} strokeWidth={1.8} />
          <circle cx="23" cy="21.5" r="1" fill="currentColor" />
        </>
      )
    case 'adhoc':
      // Rahmen mit Tilde unten in der Mitte, darin Aufgaben ohne Pfeile
      return (
        <>
          <rect x="2.5" y="4.5" width="27" height="23" rx="3.5" {...strich} />
          <rect x="6.5" y="8" width="11" height="5" rx="1.2" {...strich} strokeWidth={1.2} />
          <rect x="11.5" y="14.5" width="13" height="5" rx="1.2" {...strich} strokeWidth={1.2} />
          <path d="M12.5 24c1.2-1.6 2.4-1.6 3.5 0s2.3 1.6 3.5 0" {...strich} strokeWidth={1.4} />
        </>
      )
    case 'ruecksprung':
      return (
        <>
          <path d="M25 9H11a6 6 0 0 0 0 12h14" {...strich} />
          <path d="M14 5 10 9l4 4" {...strich} />
          <path d="M22 18l3 3-3 3" {...strich} />
        </>
      )
    case 'kennzahl':
      return (
        <>
          <path d="M5 27h22" {...strich} />
          <rect x="7" y="16" width="4.5" height="9" rx="1" {...strich} />
          <rect x="14" y="9" width="4.5" height="16" rx="1" {...strich} />
          <rect x="21" y="13" width="4.5" height="12" rx="1" {...strich} />
        </>
      )
    case 'verbessern':
      return (
        <>
          <path d="M5 9 13 17l5-5 9 9" {...strich} />
          <path d="M20 21h7v-7" {...strich} />
        </>
      )
    case 'bahn':
      return (
        <>
          <rect x="3" y="6" width="26" height="20" rx="2" {...strich} />
          <path d="M8 6v20M8 16h21" {...strich} />
        </>
      )
  }
}
