/**
 * Erzeugt BPMN 2.0 XML mit Diagramm-Informationen (DI). Die Datei lässt sich
 * in bpmn.io, Camunda Modeler oder Signavio öffnen. Zeiten, Anteile und
 * Medienbrüche stehen als Dokumentation an den Elementen.
 */
import { findeBlock, mediumName, rolleName } from '../modell/operationen'
import { istDigital, type Id, type Projekt, type Prozess } from '../modell/typen'
import { einbettungXml, type Einbettung } from './einbettung'
import { formatiereDauer, formatiereProzent } from '../modell/zeit'
import { berechneLayout, xmlId, type Layout, type LayoutKante, type LayoutKnoten, type Rechteck } from './layout'

export interface BpmnErgebnis {
  xml: string
  layout: Layout
  /** BPMN-Element → Baustein im Modell (für Klicks im Diagramm). */
  elementZuBlock: Map<string, Id>
  /** Baustein → alle seine BPMN-Elemente (für Markierungen). */
  blockZuElementen: Map<Id, string[]>
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function attrName(name: string): string {
  return name ? ` name="${esc(name)}"` : ''
}

function doku(text: string, einzug: string): string {
  return text ? `${einzug}<bpmn:documentation>${esc(text)}</bpmn:documentation>\n` : ''
}

function zahl(n: number): string {
  return String(Math.round(n * 10) / 10)
}

function bounds(r: Rechteck, einzug: string): string {
  return `${einzug}<dc:Bounds x="${zahl(r.x)}" y="${zahl(r.y)}" width="${zahl(r.breite)}" height="${zahl(r.hoehe)}" />\n`
}

function aufgabenTyp(p: Prozess, k: LayoutKnoten): string {
  const medium = p.medien.find((m) => m.id === k.aufgabe?.mediumId)
  if (!medium) return 'bpmn:task'
  return istDigital(medium.art) ? 'bpmn:userTask' : 'bpmn:manualTask'
}

function aufgabenDoku(p: Prozess, k: LayoutKnoten): string {
  const a = k.aufgabe
  if (!a) return ''
  const std = p.arbeitsstundenProTag
  const teile = [
    `Rolle: ${rolleName(p, a.rolleId)}`,
    `System: ${mediumName(p, a.mediumId)}`,
    `Bearbeitung: ${formatiereDauer(a.bearbeitungMin, std)}`,
    `Liegezeit davor: ${formatiereDauer(a.liegezeitMin, std)}`,
  ]
  if (a.uebertragung) {
    const quelle = a.uebertragung.quelleMediumId ? mediumName(p, a.uebertragung.quelleMediumId) : 'anderem Medium'
    teile.push(`Medienbruch: Daten aus ${quelle} von Hand übertragen (${formatiereDauer(a.uebertragung.minuten, std)})`)
  }
  if (a.art === 'pruefung') teile.push('Prüfung')
  if (a.art === 'freigabe') teile.push(`Freigabe, erteilt in ${formatiereProzent(a.freigabeQuote)} der Fälle`)
  if (a.brauchtVorgaenger === false) teile.push('Braucht das Ergebnis des vorherigen Schritts nicht')
  return teile.join(' · ')
}

const EREIGNIS_DEFINITION: Record<string, string> = {
  nachricht: 'bpmn:messageEventDefinition',
  zeit: 'bpmn:timerEventDefinition',
  bedingung: 'bpmn:conditionalEventDefinition',
}

function knotenXml(p: Prozess, k: LayoutKnoten, rein: string[], raus: string[], blockDoku: Map<string, string>, standardFluss: Map<string, string>): string {
  const e = '    '
  const flussRefs = rein.map((id) => `${e}  <bpmn:incoming>${id}</bpmn:incoming>\n`).join('') + raus.map((id) => `${e}  <bpmn:outgoing>${id}</bpmn:outgoing>\n`).join('')
  const definition = (art: string | null | undefined) => {
    if (!art || !EREIGNIS_DEFINITION[art]) return ''
    const tag = EREIGNIS_DEFINITION[art]
    if (art === 'bedingung') {
      return `${e}  <${tag} id="${k.id}_def"><bpmn:condition xsi:type="bpmn:tFormalExpression" /></${tag}>\n`
    }
    return `${e}  <${tag} id="${k.id}_def" />\n`
  }
  switch (k.art) {
    case 'start':
      return `${e}<bpmn:startEvent id="${k.id}"${attrName(k.name)}>\n${flussRefs}${definition(k.ereignis)}${e}</bpmn:startEvent>\n`
    case 'ende':
      return `${e}<bpmn:endEvent id="${k.id}"${attrName(k.name)}>\n${flussRefs}${e}</bpmn:endEvent>\n`
    case 'warten':
      return `${e}<bpmn:intermediateCatchEvent id="${k.id}"${attrName(k.name)}>\n${doku(blockDoku.get(k.id) ?? '', `${e}  `)}${flussRefs}${definition(k.ereignis)}${e}</bpmn:intermediateCatchEvent>\n`
    case 'aufgabe': {
      const typ = aufgabenTyp(p, k)
      return `${e}<${typ} id="${k.id}"${attrName(k.name)}>\n${doku(aufgabenDoku(p, k), `${e}  `)}${flussRefs}${e}</${typ}>\n`
    }
    case 'xor':
    case 'und': {
      const typ = k.art === 'xor' ? 'bpmn:exclusiveGateway' : 'bpmn:parallelGateway'
      const richtung = k.richtung === 'auf' ? 'Diverging' : 'Converging'
      return `${e}<${typ} id="${k.id}"${attrName(k.name)} gatewayDirection="${richtung}">\n${flussRefs}${e}</${typ}>\n`
    }
    case 'oder': {
      // Inklusives Gateway: einer, mehrere oder alle Wege; der Standardfluss läuft, wenn keiner zutrifft.
      const richtung = k.richtung === 'auf' ? 'Diverging' : 'Converging'
      const standard = standardFluss.get(k.id)
      return `${e}<bpmn:inclusiveGateway id="${k.id}"${attrName(k.name)} gatewayDirection="${richtung}"${standard ? ` default="${standard}"` : ''}>\n${flussRefs}${e}</bpmn:inclusiveGateway>\n`
    }
    case 'ereignisgateway':
      // Es geht dort weiter, wo zuerst ein Ereignis eintritt (Workflow-Pattern „Deferred Choice“).
      return `${e}<bpmn:eventBasedGateway id="${k.id}"${attrName(k.name)} gatewayDirection="Diverging" instantiate="false" eventGatewayType="Exclusive">\n${flussRefs}${e}</bpmn:eventBasedGateway>\n`
  }
}

function kanteXml(k: LayoutKante): string {
  const e = '    '
  if (!k.doku) return `${e}<bpmn:sequenceFlow id="${k.id}"${attrName(k.name)} sourceRef="${k.von}" targetRef="${k.nach}" />\n`
  return `${e}<bpmn:sequenceFlow id="${k.id}"${attrName(k.name)} sourceRef="${k.von}" targetRef="${k.nach}">\n${doku(k.doku, `${e}  `)}${e}</bpmn:sequenceFlow>\n`
}

/** Erzeugt BPMN-XML mit DI. Mit `einbettung` reist das ganze Projekt im Prozess-Element mit (für Exporte). */
export function erzeugeBpmn(p: Prozess, einbettung?: Einbettung): BpmnErgebnis {
  const layout = berechneLayout(p)
  const rein = new Map<string, string[]>()
  const raus = new Map<string, string[]>()
  const standardFluss = new Map<string, string>()
  for (const k of layout.kanten) {
    raus.set(k.von, [...(raus.get(k.von) ?? []), k.id])
    rein.set(k.nach, [...(rein.get(k.nach) ?? []), k.id])
    if (k.standard) standardFluss.set(k.von, k.id)
  }

  const elementZuBlock = new Map<string, Id>()
  const blockZuElementen = new Map<Id, string[]>()
  const blockDoku = new Map<string, string>()
  for (const k of layout.knoten) {
    if (!k.blockId) continue
    elementZuBlock.set(k.id, k.blockId)
    blockZuElementen.set(k.blockId, [...(blockZuElementen.get(k.blockId) ?? []), k.id])
    if (k.art === 'warten') blockDoku.set(k.id, `Wartezeit im Schnitt: ${formatiereDauer(warteDauer(p, k.blockId), p.arbeitsstundenProTag)}`)
  }

  const prozessDoku = [p.beschreibung, `Vorgänge pro Arbeitstag: ${p.vorgaengeProTag}`, `Arbeitstag: ${p.arbeitsstundenProTag} Std.`].filter(Boolean).join(' · ')

  let x = ''
  x += '<?xml version="1.0" encoding="UTF-8"?>\n'
  x +=
    '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" ' +
    'xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definitionen" targetNamespace="https://olbricht-digital.de/prozesslotse" ' +
    'exporter="Prozesslotse" exporterVersion="0.1.0">\n'
  x += '  <bpmn:collaboration id="Kollaboration">\n'
  x += `    <bpmn:participant id="Teilnehmer"${attrName(p.name || 'Prozess')} processRef="Prozess" />\n`
  x += '  </bpmn:collaboration>\n'
  x += `  <bpmn:process id="Prozess"${attrName(p.name)} isExecutable="false">\n`
  x += doku(prozessDoku, '    ')
  if (einbettung) x += einbettungXml(einbettung, '    ')
  x += '    <bpmn:laneSet id="Bahnen">\n'
  for (const b of layout.bahnen) {
    x += `      <bpmn:lane id="${bahnId(b.schluessel)}"${attrName(b.name)}>\n`
    for (const k of layout.knoten) if (k.bahn === b.schluessel) x += `        <bpmn:flowNodeRef>${k.id}</bpmn:flowNodeRef>\n`
    x += '      </bpmn:lane>\n'
  }
  x += '    </bpmn:laneSet>\n'
  for (const k of layout.knoten) x += knotenXml(p, k, rein.get(k.id) ?? [], raus.get(k.id) ?? [], blockDoku, standardFluss)
  for (const k of layout.kanten) x += kanteXml(k)
  x += '  </bpmn:process>\n'

  x += '  <bpmndi:BPMNDiagram id="Diagramm">\n'
  x += '    <bpmndi:BPMNPlane id="Ebene" bpmnElement="Kollaboration">\n'
  x += '      <bpmndi:BPMNShape id="Teilnehmer_di" bpmnElement="Teilnehmer" isHorizontal="true">\n'
  x += bounds(layout.pool, '        ')
  x += '      </bpmndi:BPMNShape>\n'
  for (const b of layout.bahnen) {
    x += `      <bpmndi:BPMNShape id="${bahnId(b.schluessel)}_di" bpmnElement="${bahnId(b.schluessel)}" isHorizontal="true">\n`
    x += bounds(b, '        ')
    x += '      </bpmndi:BPMNShape>\n'
  }
  for (const k of layout.knoten) {
    const marker = k.art === 'xor' ? ' isMarkerVisible="true"' : ''
    x += `      <bpmndi:BPMNShape id="${k.id}_di" bpmnElement="${k.id}"${marker}>\n`
    x += bounds(k, '        ')
    if (k.beschriftung) x += `        <bpmndi:BPMNLabel>\n${bounds(k.beschriftung, '          ')}        </bpmndi:BPMNLabel>\n`
    x += '      </bpmndi:BPMNShape>\n'
  }
  for (const k of layout.kanten) {
    x += `      <bpmndi:BPMNEdge id="${k.id}_di" bpmnElement="${k.id}">\n`
    for (const pt of k.punkte) x += `        <di:waypoint x="${zahl(pt.x)}" y="${zahl(pt.y)}" />\n`
    if (k.beschriftung) x += `        <bpmndi:BPMNLabel>\n${bounds(k.beschriftung, '          ')}        </bpmndi:BPMNLabel>\n`
    x += '      </bpmndi:BPMNEdge>\n'
  }
  x += '    </bpmndi:BPMNPlane>\n'
  x += '  </bpmndi:BPMNDiagram>\n'
  x += '</bpmn:definitions>\n'

  return { xml: x, layout, elementZuBlock, blockZuElementen }
}

function bahnId(schluessel: string): string {
  return xmlId(`Bahn_${schluessel}`)
}

function warteDauer(p: Prozess, blockId: Id): number {
  const b = findeBlock(p, blockId)?.block
  return b?.typ === 'warten' ? b.dauerMin : 0
}

/** BPMN-Datei für den Export: Diagramm des gewählten Prozesses, ganzes Projekt eingebettet. */
export function bpmnFuerExport(projekt: Projekt, ansicht: 'ist' | 'soll'): string {
  const soll = ansicht === 'soll' && projekt.soll !== null
  return erzeugeBpmn(soll && projekt.soll ? projekt.soll : projekt.ist, { projekt, ansicht: soll ? 'soll' : 'ist' }).xml
}
