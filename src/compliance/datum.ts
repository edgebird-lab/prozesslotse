/**
 * Kalenderdaten als Text JJJJ-MM-TT (Spezifikation 6.1). Gerechnet wird mit
 * Tagesnummern in UTC, damit Sommerzeit und Zeitzone keine Rolle spielen.
 * Die Fachlogik bekommt `heute` immer als Parameter.
 */
import type { IsoDatum } from './typen'

const MUSTER = /^(\d{4})-(\d{2})-(\d{2})$/
const TAG_MS = 86_400_000

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

export function tageImMonat(jahr: number, monat: number): number {
  return new Date(Date.UTC(jahr, monat, 0)).getUTCDate()
}

/** Muster JJJJ-MM-TT und ein Tag, den es gibt (kein 30. Februar). */
export function istIsoDatum(s: string): boolean {
  const m = MUSTER.exec(s)
  if (!m) return false
  const [jahr, monat, tag] = [Number(m[1]), Number(m[2]), Number(m[3])]
  return monat >= 1 && monat <= 12 && tag >= 1 && tag <= tageImMonat(jahr, monat)
}

/** '2026-11-11' → „11.11.2026“ */
export function formatiereDatum(d: IsoDatum): string {
  const [jahr, monat, tag] = teile(d)
  return `${zweistellig(tag)}.${zweistellig(monat)}.${jahr}`
}

export function jahrVon(d: IsoDatum): number {
  return teile(d)[0]
}

function tagesnummer(d: IsoDatum): number {
  const [jahr, monat, tag] = teile(d)
  return Date.UTC(jahr, monat - 1, tag) / TAG_MS
}

function ausTagesnummer(n: number): IsoDatum {
  const d = new Date(n * TAG_MS)
  return alsIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
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
