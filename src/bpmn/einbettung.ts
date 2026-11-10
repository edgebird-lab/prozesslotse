/**
 * Das Projekt reist im exportierten BPMN mit: als Erweiterung im Prozess-Element
 * (BPMN 2.0 erlaubt eigene Elemente in extensionElements, andere Werkzeuge
 * ignorieren sie). So öffnet sich eine selbst exportierte BPMN-Datei wieder
 * verlustfrei; fremde BPMN-Dateien zeigt die Oberfläche nur an.
 */
import { Formatfehler, leseProjekt, leseProjektText } from '../modell/speicher'
import type { Projekt } from '../modell/typen'

export const PROJEKT_NS = 'https://olbricht-digital.de/prozesslotse/projekt'

export type ProjektAnsicht = 'ist' | 'soll'

export interface Einbettung {
  projekt: Projekt
  ansicht: ProjektAnsicht
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function unescXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
}

/** Erweiterungselement für das Prozess-Element, eingerückt für den Export. */
export function einbettungXml(e: Einbettung, einzug: string): string {
  return (
    `${einzug}<bpmn:extensionElements>\n` +
    `${einzug}  <pl:projekt xmlns:pl="${PROJEKT_NS}" ansicht="${e.ansicht}" formatVersion="${e.projekt.ist.formatVersion}">${escXml(JSON.stringify(e.projekt))}</pl:projekt>\n` +
    `${einzug}</bpmn:extensionElements>\n`
  )
}

/**
 * Liest ein eingebettetes Projekt aus BPMN-XML. null, wenn keins enthalten ist;
 * Formatfehler, wenn es beschädigt ist. Andere Werkzeuge können den Präfix
 * beim Speichern umbenennen, deshalb wird er über den Namensraum gesucht.
 */
export function projektAusBpmn(xml: string): Einbettung | null {
  const ns = PROJEKT_NS.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  const praefixe = new Set([...xml.matchAll(new RegExp(`xmlns:([\\w.-]+)="${ns}"`, 'g'))].map((m) => m[1]))
  for (const p of praefixe) {
    const m = new RegExp(`<${p}:projekt\\b([^>]*)>([\\s\\S]*?)</${p}:projekt>`).exec(xml)
    if (!m) continue
    const roh = m[2].trim()
    const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(roh)
    const text = cdata ? cdata[1] : unescXml(roh)
    let daten: unknown
    try {
      daten = JSON.parse(text)
    } catch {
      throw new Formatfehler('Das eingebettete Projekt in der BPMN-Datei ist beschädigt.')
    }
    const projekt = leseProjekt(daten)
    const ansicht: ProjektAnsicht = /\bansicht="soll"/.test(m[1]) && projekt.soll ? 'soll' : 'ist'
    return { projekt, ansicht }
  }
  return null
}

export type GeleseneDatei = ({ art: 'projekt' } & Einbettung) | { art: 'fremdesBpmn'; xml: string }

/** Erkennt am Inhalt, ob eine Projektdatei (JSON) oder eine BPMN-Datei vorliegt. */
export function leseDatei(text: string): GeleseneDatei {
  const inhalt = text.replace(/^﻿/, '')
  if (inhalt.trimStart().startsWith('<')) {
    if (!/<([\w.-]+:)?definitions\b/.test(inhalt)) throw new Formatfehler('Die Datei ist weder ein Prozesslotse-Projekt noch ein BPMN-Diagramm.')
    const eingebettet = projektAusBpmn(inhalt)
    return eingebettet ? { art: 'projekt', ...eingebettet } : { art: 'fremdesBpmn', xml: inhalt }
  }
  return { art: 'projekt', projekt: leseProjektText(inhalt), ansicht: 'ist' }
}
