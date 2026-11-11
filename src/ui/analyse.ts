import { useMemo } from 'react'
import { findeSchwachstellen } from '../analyse/hinweise'
import { berechneKennzahlen, type Kennzahlen } from '../analyse/kennzahlen'
import { simuliere, type Simulationsergebnis } from '../analyse/simulation'
import { erzeugeBpmn, type BpmnErgebnis } from '../bpmn/export'
import { hatFehler, pruefeProzess, sortiereBefunde, type Befund, type Schwere } from '../modell/pruefung'
import type { Id, Prozess } from '../modell/typen'

export interface Analyse {
  kennzahlen: Kennzahlen
  modellBefunde: Befund[]
  schwachstellen: Befund[]
  befunde: Befund[]
  hatFehler: boolean
}

export function analysiere(p: Prozess): Analyse {
  const kennzahlen = berechneKennzahlen(p)
  const modellBefunde = pruefeProzess(p)
  const schwachstellen = findeSchwachstellen(p, kennzahlen)
  return {
    kennzahlen,
    modellBefunde,
    schwachstellen,
    befunde: sortiereBefunde([...modellBefunde, ...schwachstellen]),
    hatFehler: hatFehler(modellBefunde),
  }
}

export function useAnalyse(p: Prozess): Analyse {
  return useMemo(() => analysiere(p), [p])
}

export function useSimulation(p: Prozess): Simulationsergebnis {
  return useMemo(() => simuliere(p, 4000), [p])
}

export function useBpmn(p: Prozess): BpmnErgebnis {
  return useMemo(() => erzeugeBpmn(p), [p])
}

// ---------------------------------------------------------------------------
// Markierungen im Diagramm

export interface Markierung {
  art: Schwere
  kurz: string
  /** Wie viele Befunde an diesem Element hängen. */
  anzahl: number
}

const KURZ: Record<string, string> = {
  medienbruch: 'Medienbruch',
  liegezeit: 'Liegezeit',
  warten: 'Wartezeit',
  engpass: 'Engpass',
  ueberlastet: 'Überlastet',
  freigabe: 'Freigabe',
  nacharbeit: 'Nacharbeit',
  pingpong: 'Hin und Her',
  summe: 'Anteile ≠ 100 %',
  endlos: 'Endlosschleife',
  verklemmung: 'Verklemmung',
  unerreichbar: 'Unerreichbar',
  leer: 'Leer',
  rolle: 'Keine Rolle',
  name: 'Ohne Namen',
  zeit: 'Ohne Zeit',
  rueckziel: 'Rücksprung ins Leere',
  rahmenrueck: 'Rücksprung aus Rahmen',
  abbruch: 'Ende neben Gleichzeitigem',
  anzahl: 'Anzahl ungültig',
  nie: 'Läuft nie',
  viele: 'Sehr viele Stücke',
  doppelt: 'Endet und springt',
  ereignis: 'Ereignis fehlt',
}

/** Befunde, die im Diagramm ein Abzeichen bekommen (Benennungshinweise nicht). */
function zeigen(b: Befund): boolean {
  const art = b.schluessel.split(':')[0]
  return b.schwere !== 'hinweis' || ['freigabe', 'nacharbeit', 'pingpong'].includes(art)
}

/** Das sichtbarste BPMN-Element eines Bausteins: Aufgabe, Verzweigung oder Frage der Wiederholung. */
export function hauptElement(bpmn: BpmnErgebnis, blockId: Id): string | null {
  const elemente = bpmn.blockZuElementen.get(blockId) ?? []
  return elemente.find((e) => e.endsWith('_auf') || e.endsWith('_frage')) ?? elemente[0] ?? null
}

const RANG: Record<Schwere, number> = { fehler: 0, warnung: 1, hinweis: 2 }

export function markierungen(befunde: Befund[], bpmn: BpmnErgebnis): Map<string, Markierung> {
  const ergebnis = new Map<string, Markierung>()
  const merke = (elementId: string, b: Befund) => {
    const kurz = KURZ[b.schluessel.split(':')[0]] ?? 'Prüfen'
    const alt = ergebnis.get(elementId)
    if (!alt) ergebnis.set(elementId, { art: b.schwere, kurz, anzahl: 1 })
    else if (RANG[b.schwere] < RANG[alt.art]) ergebnis.set(elementId, { art: b.schwere, kurz, anzahl: alt.anzahl + 1 })
    else alt.anzahl += 1
  }
  for (const b of befunde) {
    if (!zeigen(b)) continue
    if (b.blockId) {
      const e = hauptElement(bpmn, b.blockId)
      if (e) merke(e, b)
    } else if (b.rolleId) {
      for (const k of bpmn.layout.knoten) if (k.aufgabe?.rolleId === b.rolleId) merke(k.id, b)
    }
  }
  return ergebnis
}
