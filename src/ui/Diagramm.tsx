import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer'
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-js.css'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Markierung } from './analyse'

interface Box {
  x: number
  y: number
  width: number
  height: number
  inner?: { x: number; y: number; width: number; height: number }
}
interface Canvas {
  zoom(stufe?: number | 'fit-viewport', mitte?: 'auto'): number
  viewbox(box?: Box): Box
  addMarker(id: string, klasse: string): void
  removeMarker(id: string, klasse: string): void
  resized(): void
  scrollToElement(id: string, abstand?: number): void
}
interface Overlays {
  add(id: string, typ: string, overlay: { position: { top?: number; left?: number }; html: string }): string
  remove(filter: { type: string }): void
}
interface EventBus {
  on(ereignis: string, rueckruf: (e: { element: { id: string } }) => void): void
}
interface ElementRegistry {
  get(id: string): unknown
}

export interface DiagrammApi {
  svg(): Promise<string>
  einpassen(): void
}

export interface DiagrammProps {
  xml: string
  markierungen?: Map<string, Markierung>
  ausgewaehlt?: string[]
  onKlick?: (elementId: string) => void
  /** Beschriftung für Screenreader. */
  beschriftung: string
  klein?: boolean
  /** Immer das ganze Diagramm zeigen (z. B. im Bericht). */
  uebersicht?: boolean
}

const SYMBOL: Record<Markierung['art'], string> = {
  fehler: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M8 4.2v4.6M8 11.2v.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
  warnung: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 15 14H1z" fill="currentColor"/><path d="M8 6v4M8 12v.3" stroke="#0b0b0b" stroke-width="1.6" stroke-linecap="round"/></svg>',
  hinweis: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M8 7.2v4.4M8 4.6v.3" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Ganzes Diagramm zeigen; ist es dafür zu klein, lesbar vergrößert am Anfang beginnen. */
function zeigeAnfang(canvas: Canvas): void {
  const stufe = canvas.zoom('fit-viewport', 'auto')
  if (stufe >= 0.6) return
  canvas.zoom(0.75)
  const box = canvas.viewbox()
  if (box.inner) canvas.viewbox({ x: box.inner.x - 24, y: box.inner.y - 24, width: box.width, height: box.height })
}

export const Diagramm = forwardRef<DiagrammApi, DiagrammProps>(function Diagramm({ xml, markierungen, ausgewaehlt, onKlick, beschriftung, klein, uebersicht }, ref) {
  const behaelter = useRef<HTMLDivElement>(null)
  const viewer = useRef<NavigatedViewer | null>(null)
  const klick = useRef(onKlick)
  const benutzerZoom = useRef(false)
  const markiert = useRef<{ id: string; klasse: string }[]>([])
  const letzteAuswahl = useRef<string>('')
  const [importNr, setImportNr] = useState(0)
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    klick.current = onKlick
  }, [onKlick])

  useEffect(() => {
    const el = behaelter.current!
    const v = new NavigatedViewer({ container: el })
    viewer.current = v
    v.get<EventBus>('eventBus').on('element.click', (e) => klick.current?.(e.element.id))
    const merkeZoom = () => {
      benutzerZoom.current = true
    }
    el.addEventListener('wheel', merkeZoom, { passive: true })
    el.addEventListener('pointerdown', merkeZoom)
    const beobachter = new ResizeObserver(() => v.get<Canvas>('canvas').resized())
    beobachter.observe(el)
    return () => {
      beobachter.disconnect()
      el.removeEventListener('wheel', merkeZoom)
      el.removeEventListener('pointerdown', merkeZoom)
      v.destroy()
      viewer.current = null
    }
  }, [])

  useEffect(() => {
    const v = viewer.current
    if (!v) return
    let aktiv = true
    const canvas = v.get<Canvas>('canvas')
    const alteBox = benutzerZoom.current ? canvas.viewbox() : null
    v.importXML(xml)
      .then(() => {
        if (!aktiv) return
        setFehler(null)
        if (alteBox) canvas.viewbox(alteBox)
        else if (uebersicht) canvas.zoom('fit-viewport', 'auto')
        else zeigeAnfang(canvas)
        markiert.current = []
        setImportNr((n) => n + 1)
      })
      .catch((e: unknown) => {
        if (aktiv) setFehler(e instanceof Error ? e.message : String(e))
      })
    return () => {
      aktiv = false
    }
  }, [xml, uebersicht])

  useEffect(() => {
    const v = viewer.current
    if (!v || importNr === 0) return
    const canvas = v.get<Canvas>('canvas')
    const overlays = v.get<Overlays>('overlays')
    const registry = v.get<ElementRegistry>('elementRegistry')
    for (const m of markiert.current) if (registry.get(m.id)) canvas.removeMarker(m.id, m.klasse)
    overlays.remove({ type: 'pl' })
    const neu: { id: string; klasse: string }[] = []
    for (const [id, m] of markierungen ?? []) {
      if (!registry.get(id)) continue
      const klasse = `pl-${m.art}`
      canvas.addMarker(id, klasse)
      neu.push({ id, klasse })
      const mehr = m.anzahl > 1 ? ` <span class="pl-mehr">+${m.anzahl - 1}</span>` : ''
      overlays.add(id, 'pl', { position: { top: -13, left: -4 }, html: `<div class="pl-abzeichen pl-abzeichen-${m.art}">${SYMBOL[m.art]}<span>${esc(m.kurz)}</span>${mehr}</div>` })
    }
    const auswahl = (ausgewaehlt ?? []).filter((id) => registry.get(id))
    for (const id of auswahl) {
      canvas.addMarker(id, 'pl-auswahl')
      neu.push({ id, klasse: 'pl-auswahl' })
    }
    markiert.current = neu
    const schluessel = auswahl.join(',')
    if (schluessel && schluessel !== letzteAuswahl.current) canvas.scrollToElement(auswahl[0], 80)
    letzteAuswahl.current = schluessel
  }, [importNr, markierungen, ausgewaehlt])

  const einpassen = () => {
    benutzerZoom.current = false
    viewer.current?.get<Canvas>('canvas').zoom('fit-viewport', 'auto')
  }
  const zoome = (faktor: number) => {
    const canvas = viewer.current?.get<Canvas>('canvas')
    if (!canvas) return
    benutzerZoom.current = true
    canvas.zoom(canvas.zoom() * faktor, 'auto')
  }

  useImperativeHandle(ref, () => ({
    svg: async () => {
      const v = viewer.current
      if (!v) return ''
      const { svg } = await v.saveSVG()
      return svg
    },
    einpassen,
  }))

  return (
    <div className={`diagramm${klein ? ' diagramm-klein' : ''}`}>
      <div className="diagramm-werkzeuge">
        <button type="button" onClick={() => zoome(1.2)} aria-label="Vergrößern" title="Vergrößern">
          +
        </button>
        <button type="button" onClick={() => zoome(1 / 1.2)} aria-label="Verkleinern" title="Verkleinern">
          −
        </button>
        <button type="button" onClick={einpassen} title="Ganzes Diagramm zeigen">
          Einpassen
        </button>
      </div>
      <div ref={behaelter} className="diagramm-flaeche" role="figure" aria-label={beschriftung} />
      {fehler && (
        <p className="diagramm-fehler" role="alert">
          Das Diagramm konnte nicht gezeichnet werden: {fehler}
        </p>
      )}
    </div>
  )
})
