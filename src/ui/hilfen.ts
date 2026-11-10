import { useEffect, useState } from 'react'

/** Bietet Text oder eine Datei zum Herunterladen an. */
export function ladeHerunter(dateiname: string, inhalt: string | Blob, typ = 'text/plain'): void {
  const blob = inhalt instanceof Blob ? inhalt : new Blob([inhalt], { type: `${typ};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = dateiname
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Dateiname aus einem Prozessnamen: „Bestellung bis Rechnung“ → „bestellung-bis-rechnung“. */
export function dateiname(name: string, rest: string): string {
  const basis =
    name
      .toLocaleLowerCase('de-DE')
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'prozess'
  return `${basis}${rest}`
}

/** Liefert den Wert erst, wenn er sich `ms` Millisekunden nicht geändert hat. */
export function useVerzoegert<T>(wert: T, ms: number): T {
  const [verzoegert, setVerzoegert] = useState(wert)
  useEffect(() => {
    const t = setTimeout(() => setVerzoegert(wert), ms)
    return () => clearTimeout(t)
  }, [wert, ms])
  return verzoegert
}

export function vorzeichen(n: number, text: string): string {
  if (Math.abs(n) < 1e-9) return text.replace(/^[-−]/, '')
  return n > 0 ? `+${text.replace(/^[-−]/, '')}` : `−${text.replace(/^[-−]/, '')}`
}
