/**
 * Kalenderdaten als Text JJJJ-MM-TT (Spezifikation 6.1). Gerechnet wird mit
 * Tagesnummern im gregorianischen Kalender, ohne `Date`: So spielen weder
 * Sommerzeit und Zeitzone noch die Sonderbehandlung der Jahre 0 bis 99 eine
 * Rolle. Die Fachlogik bekommt `heute` immer als Parameter.
 */
import type { IsoDatum } from './typen'

const MUSTER = /^(\d{4})-(\d{2})-(\d{2})$/
const MONATSTAGE = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function teile(d: IsoDatum): [number, number, number] {
  const m = MUSTER.exec(d)
  if (!m) throw new Error(`Kein Datum: ${d}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function zweistellig(n: number): string {
  return String(n).padStart(2, '0')
}

function alsIso(jahr: number, monat: number, tag: number): IsoDatum {
  return `${String(jahr).padStart(4, '0')}-${zweistellig(monat)}-${zweistellig(tag)}`
}

function schaltjahr(jahr: number): boolean {
  return (jahr % 4 === 0 && jahr % 100 !== 0) || jahr % 400 === 0
}

export function tageImMonat(jahr: number, monat: number): number {
  return monat === 2 && schaltjahr(jahr) ? 29 : MONATSTAGE[monat - 1]
}

/** Muster JJJJ-MM-TT und ein Tag, den es gibt (kein 30. Februar). */
export function istIsoDatum(s: string): boolean {
  const m = MUSTER.exec(s)
  if (!m) return false
  const [jahr, monat, tag] = [Number(m[1]), Number(m[2]), Number(m[3])]
  return monat >= 1 && monat <= 12 && tag >= 1 && tag <= tageImMonat(jahr, monat)
}

/** Für Eingaben in der Oberfläche: gültig und zwischen 1900 und 2199 (fängt Tippfehler im Jahr ab). */
export function istPlausiblesDatum(s: string): boolean {
  if (!istIsoDatum(s)) return false
  const jahr = Number(s.slice(0, 4))
  return jahr >= 1900 && jahr <= 2199
}

/** '2026-11-11' → „11.11.2026“ */
export function formatiereDatum(d: IsoDatum): string {
  const [jahr, monat, tag] = teile(d)
  return `${zweistellig(tag)}.${zweistellig(monat)}.${jahr}`
}

export function jahrVon(d: IsoDatum): number {
  return teile(d)[0]
}

/** Tage seit dem 01.01.1970 (Verfahren „days from civil“ nach H. Hinnant). */
function tagesnummer(d: IsoDatum): number {
  const [j, monat, tag] = teile(d)
  const jahr = monat <= 2 ? j - 1 : j
  const aera = Math.floor(jahr / 400)
  const jahrInAera = jahr - aera * 400
  const tagImJahr = Math.floor((153 * ((monat + 9) % 12) + 2) / 5) + tag - 1
  const tagInAera = jahrInAera * 365 + Math.floor(jahrInAera / 4) - Math.floor(jahrInAera / 100) + tagImJahr
  return aera * 146097 + tagInAera - 719468
}

function ausTagesnummer(n: number): IsoDatum {
  const z = n + 719468
  const aera = Math.floor(z / 146097)
  const tagInAera = z - aera * 146097
  const jahrInAera = Math.floor((tagInAera - Math.floor(tagInAera / 1460) + Math.floor(tagInAera / 36524) - Math.floor(tagInAera / 146096)) / 365)
  const tagImJahr = tagInAera - (365 * jahrInAera + Math.floor(jahrInAera / 4) - Math.floor(jahrInAera / 100))
  const mp = Math.floor((5 * tagImJahr + 2) / 153)
  const tag = tagImJahr - Math.floor((153 * mp + 2) / 5) + 1
  const monat = mp < 10 ? mp + 3 : mp - 9
  const jahr = jahrInAera + aera * 400 + (monat <= 2 ? 1 : 0)
  return alsIso(jahr, monat, tag)
}

/** Kalendertage addieren (auch negativ). */
export function addiereTage(d: IsoDatum, n: number): IsoDatum {
  return ausTagesnummer(tagesnummer(d) + n)
}

/** Monate addieren; der Tag wird auf das Monatsende gekappt (31.08. + 6 Monate = 28.02.). */
export function addiereMonate(d: IsoDatum, n: number): IsoDatum {
  const [jahr, monat, tag] = teile(d)
  const gesamt = jahr * 12 + (monat - 1) + n
  const zielJahr = Math.floor(gesamt / 12)
  const zielMonat = gesamt - zielJahr * 12 + 1
  return alsIso(zielJahr, zielMonat, Math.min(tag, tageImMonat(zielJahr, zielMonat)))
}

export function addiereJahre(d: IsoDatum, n: number): IsoDatum {
  return addiereMonate(d, 12 * n)
}

/** Kalendertage von a nach b (positiv, wenn b später liegt). */
export function tageZwischen(a: IsoDatum, b: IsoDatum): number {
  return tagesnummer(b) - tagesnummer(a)
}

/** Heutiges Datum in der Zeitzone des Rechners; nie über toISOString (UTC-Verschiebung um Mitternacht). */
export function heuteIso(jetzt: Date = new Date()): IsoDatum {
  return alsIso(jetzt.getFullYear(), jetzt.getMonth() + 1, jetzt.getDate())
}
