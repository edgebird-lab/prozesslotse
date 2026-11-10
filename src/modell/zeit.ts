/** Umrechnen und Anzeigen von Zeiten. Intern rechnet alles in Minuten Arbeitszeit. */

export type Zeiteinheit = 'min' | 'std' | 'tag'

export const ZEITEINHEITEN: { einheit: Zeiteinheit; name: string }[] = [
  { einheit: 'min', name: 'Minuten' },
  { einheit: 'std', name: 'Stunden' },
  { einheit: 'tag', name: 'Arbeitstage' },
]

export function minutenJe(einheit: Zeiteinheit, stundenProTag: number): number {
  switch (einheit) {
    case 'min':
      return 1
    case 'std':
      return 60
    case 'tag':
      return 60 * stundenProTag
  }
}

export function inMinuten(wert: number, einheit: Zeiteinheit, stundenProTag: number): number {
  return wert * minutenJe(einheit, stundenProTag)
}

export function ausMinuten(minuten: number, einheit: Zeiteinheit, stundenProTag: number): number {
  return minuten / minutenJe(einheit, stundenProTag)
}

function istVielfaches(wert: number, von: number): boolean {
  const q = wert / von
  return Math.abs(q - Math.round(q)) < 1e-9
}

/** Die größte Einheit, in der sich der Wert in Vierteln schreiben lässt (1,25 Std., 2,5 Arbeitstage). */
export function passendeEinheit(minuten: number, stundenProTag: number): Zeiteinheit {
  const tag = 60 * stundenProTag
  if (minuten >= tag && istVielfaches(minuten, tag / 4)) return 'tag'
  if (minuten >= 60 && istVielfaches(minuten, 15)) return 'std'
  return 'min'
}

const zahl1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })
const zahl0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })
const zahl2 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })
const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

export function formatiereZahl(wert: number, stellen: 0 | 1 | 2 = 1): string {
  const f = stellen === 0 ? zahl0 : stellen === 1 ? zahl1 : zahl2
  const faktor = 10 ** stellen
  const gerundet = Math.round(wert * faktor) / faktor
  return f.format(gerundet === 0 ? 0 : gerundet) // vermeidet „-0“
}

export function formatiereEuro(wert: number): string {
  return euro.format(wert)
}

export function formatiereProzent(anteil: number, stellen: 0 | 1 = 0): string {
  return `${formatiereZahl(anteil * 100, stellen)} %`
}

/** Lesbare Dauer: „45 Min.“, „2,5 Std.“, „1,3 Arbeitstage“. */
export function formatiereDauer(minuten: number, stundenProTag: number): string {
  const tag = 60 * stundenProTag
  if (Math.abs(minuten) < 60) return `${formatiereZahl(minuten, Math.abs(minuten) < 10 ? 1 : 0)} Min.`
  if (Math.abs(minuten) < tag) return `${formatiereZahl(minuten / 60)} Std.`
  const tage = minuten / tag
  return `${formatiereZahl(tage)} ${Math.abs(Math.round(tage * 10) / 10) === 1 ? 'Arbeitstag' : 'Arbeitstage'}`
}
