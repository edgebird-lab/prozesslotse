/**
 * Dokumentmodell: Kapitelschlüssel und Vergleich zweier Stände (Spezifikation 6.8).
 *
 * Jeder Abschnitt gehört zur letzten Überschrift der Ebene 1 oder 2;
 * Überschriften der Ebene 3 zählen zu ihrer Ebene 2. Kapitel, deren Nummern
 * sich sonst ständig verschieben würden (Kapitel 4 der Verfahrensdokumentation),
 * werden als Ganzes verglichen. Was vor der ersten Überschrift steht, ist das
 * Deckblatt.
 */
import { kanonischesJson } from './speicher'
import type { Abschnitt, Dokument, DokumentArt } from './typen'

export const DECKBLATT = 'Deckblatt'

interface Regeln {
  praefix: string
  /** Kapitel der Ebene 1, die als Ganzes zählen */
  ganz: ReadonlySet<string>
  /** Schlüssel, die beim Vergleich nicht zählen */
  ausgenommen: ReadonlySet<string>
}

const REGELN: Record<DokumentArt, Regeln> = {
  verfahrensdokumentation: { praefix: 'VD ', ganz: new Set(['4']), ausgenommen: new Set([DECKBLATT, '7']) },
  verarbeitungsverzeichnis: { praefix: 'VVT ', ganz: new Set(), ausgenommen: new Set([DECKBLATT, 'D']) },
}

/** Schlüssel je Abschnitt, gleich lang wie `abschnitte`. */
export function kapitelSchluessel(abschnitte: Abschnitt[], ganz: ReadonlySet<string> = new Set()): string[] {
  let ebene1: string | null = null
  let aktuell = DECKBLATT
  return abschnitte.map((a) => {
    if (a.art === 'ueberschrift') {
      if (a.ebene === 1) {
        ebene1 = a.nummer
        aktuell = a.nummer
      } else if (a.ebene === 2) {
        aktuell = ebene1 !== null && ganz.has(ebene1) ? ebene1 : a.nummer
      }
    }
    return aktuell
  })
}

/** Abschnitte je Kapitelschlüssel, in der Reihenfolge des Dokuments. */
export function kapitel(d: Dokument): Map<string, Abschnitt[]> {
  const schluessel = kapitelSchluessel(d.abschnitte, REGELN[d.art].ganz)
  const m = new Map<string, Abschnitt[]>()
  d.abschnitte.forEach((a, i) => {
    const k = schluessel[i]
    const liste = m.get(k)
    if (liste) liste.push(a)
    else m.set(k, [a])
  })
  return m
}

/**
 * Kapitel, die sich zwischen `alt` und `neu` unterscheiden, mit Präfix („VD 3.2“).
 * Reihenfolge: wie im neuen Dokument, danach Kapitel, die es nur im alten gab.
 */
export function geaenderteKapitelIn(alt: Dokument, neu: Dokument): string[] {
  const regeln = REGELN[neu.art]
  const a = kapitel(alt)
  const n = kapitel(neu)
  const schluessel = [...n.keys(), ...[...a.keys()].filter((k) => !n.has(k))]
  // kanonisch: Die Reihenfolge der Schlüssel in einer gespeicherten Datei zählt nicht als Änderung
  return schluessel.filter((k) => !regeln.ausgenommen.has(k) && kanonischesJson(a.get(k) ?? null) !== kanonischesJson(n.get(k) ?? null)).map((k) => `${regeln.praefix}${k}`)
}

/** Gliederung für Druck und DOCX: Überschriften der Ebenen 1 und 2. */
export function gliederung(d: Dokument): { ebene: 1 | 2; nummer: string; text: string }[] {
  return d.abschnitte.flatMap((a) => (a.art === 'ueberschrift' && a.ebene <= 2 ? [{ ebene: a.ebene as 1 | 2, nummer: a.nummer, text: a.text }] : []))
}
