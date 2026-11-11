/**
 * Erzeugt BPMN 2.0 XML mit Diagramm-Informationen (DI). Die Datei lässt sich
 * in bpmn.io, Camunda Modeler oder Signavio öffnen. Zeiten, Anteile und
 * Medienbrüche stehen als Dokumentation an den Elementen.
 *
 * Abschnitte werden aufgeklappte Teilprozesse (`subProcess` mit eigenem Start
 * und Ende, im DI `isExpanded`); ihr Inhalt steht als `flowElements` darin, im
 * Bahnensatz steht nur der Teilprozess selbst. Endet der Vorgang in einem
 * Abschnitt, steht dort ein Fehler-Ende mit einem `bpmn:error` je Ergebnis; ein
 * Fehler-Randereignis am äußersten Abschnitt fängt es und führt zum Ende mit
 * diesem Ergebnis.
 *
 * „Für jedes Stück“ wird eine Mehrfachinstanz (`multiInstanceLoopCharacteristics`,
 * `isSequential` = nacheinander): an der Aufgabe, wenn der Körper eine einzelne
 * Aufgabe ist, sonst an einem aufgeklappten Teilprozess. `loopCardinality`
 * steht nur bei fester, ganzzahliger Anzahl im XML; Mittel, Streuung und
 * Liegezeit stehen in der Dokumentation.
 *
 * Unterbrechungen werden Randereignisse (`boundaryEvent` mit Zeit- oder
 * Nachrichtendefinition) an der Aufgabe oder am Teilprozess; `cancelActivity`
 * ist false für Nebenwege. Anteil, Frist und Zeitpunkt stehen in der
 * Dokumentation, eine Nachricht von außen kommt als Nachrichtenfluss vom Pool.
 * Ein Nebenweg endet in einem eigenen Endereignis ohne Namen.
 */
import { anzahlVerteilung } from '../modell/anzahl'
import { findeBlock, mediumName, rolleName } from '../modell/operationen'
import { istDigital, type Id, type Mehrfach, type Projekt, type Prozess } from '../modell/typen'
import { einbettungXml, type Einbettung } from './einbettung'
import { formatiereDauer, formatiereProzent, formatiereZahl } from '../modell/zeit'
import { berechneLayout, xmlId, type Layout, type LayoutKante, type LayoutKnoten, type LayoutRahmen, type MehrfachMarke, type Rechteck } from './layout'

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
  const mf = k.mehrfachBlock ? findeBlock(p, k.mehrfachBlock)?.block : undefined
  if (mf?.typ === 'mehrfach') teile.push(mehrfachDoku(p, mf))
  return teile.join(' · ')
}

/** Dokumentation einer Mehrfachinstanz: wofür, wie viele Stücke, wie sie erledigt werden, Liegezeit vor dem ersten. */
export function mehrfachDoku(p: Prozess, b: Mehrfach): string {
  const wie = b.streuung === 'fest' ? 'immer etwa gleich viele' : 'die Zahl schwankt stark'
  const ausfuehrung = b.ausfuehrung === 'nacheinander' ? 'der Reihe nach' : 'zur selben Zeit'
  return `${b.name || 'Für jedes Stück'}: im Schnitt ${formatiereZahl(b.anzahl, 2)} Stück je Vorgang, ${wie}, ${ausfuehrung}; Liegezeit vor dem ersten Stück ${formatiereDauer(b.liegezeitMin, p.arbeitsstundenProTag)}`
}

/** Markierung der Mehrfachinstanz; die Anzahl nur, wenn sie fest und ganzzahlig ist (ein Mittel wie 2,5 ist keine gültige Anzahl). */
function mehrfachXml(m: MehrfachMarke | undefined, e: string): string {
  if (!m) return ''
  const v = anzahlVerteilung(m.anzahl, 'fest')
  if (m.streuung !== 'fest' || v.rest > 0) return `${e}<bpmn:multiInstanceLoopCharacteristics isSequential="${m.nacheinander}" />\n`
  return `${e}<bpmn:multiInstanceLoopCharacteristics isSequential="${m.nacheinander}">\n${e}  <bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">${v.k0}</bpmn:loopCardinality>\n${e}</bpmn:multiInstanceLoopCharacteristics>\n`
}

const EREIGNIS_DEFINITION: Record<string, string> = {
  nachricht: 'bpmn:messageEventDefinition',
  zeit: 'bpmn:timerEventDefinition',
  bedingung: 'bpmn:conditionalEventDefinition',
}

function knotenXml(p: Prozess, k: LayoutKnoten, rein: string[], raus: string[], blockDoku: Map<string, string>, standardFluss: Map<string, string>, e: string): string {
  const flussRefs = rein.map((id) => `${e}  <bpmn:incoming>${id}</bpmn:incoming>\n`).join('') + raus.map((id) => `${e}  <bpmn:outgoing>${id}</bpmn:outgoing>\n`).join('')
  const fehlerDefinition = k.fehler ? `${e}  <bpmn:errorEventDefinition id="${k.id}_def" errorRef="${k.fehler}" />\n` : ''
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
      // Im Abschnitt ein Fehler-Ende: Es steigt zum Randereignis des äußersten Abschnitts auf.
      return `${e}<bpmn:endEvent id="${k.id}"${attrName(k.name)}>\n${flussRefs}${fehlerDefinition}${e}</bpmn:endEvent>\n`
    case 'rand':
      // Randereignis: Fehler (Ausstieg aus dem Abschnitt), Frist oder Nachricht; unterbrechend oder nebenher (cancelActivity="false")
      return `${e}<bpmn:boundaryEvent id="${k.id}"${attrName(k.name)} attachedToRef="${k.wirt}" cancelActivity="${k.unterbrechend !== false}">\n${doku(k.doku ?? '', `${e}  `)}${flussRefs}${k.fehler ? fehlerDefinition : definition(k.ereignis)}${e}</bpmn:boundaryEvent>\n`
    case 'warten':
      return `${e}<bpmn:intermediateCatchEvent id="${k.id}"${attrName(k.name)}>\n${doku(blockDoku.get(k.id) ?? '', `${e}  `)}${flussRefs}${definition(k.ereignis)}${e}</bpmn:intermediateCatchEvent>\n`
    case 'aufgabe': {
      const typ = aufgabenTyp(p, k)
      return `${e}<${typ} id="${k.id}"${attrName(k.name)}>\n${doku(aufgabenDoku(p, k), `${e}  `)}${flussRefs}${mehrfachXml(k.mehrfach, `${e}  `)}${e}</${typ}>\n`
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

function kanteXml(k: LayoutKante, e: string): string {
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
  // Der Rahmen zuerst: Er ist das sichtbarste Element eines Abschnitts.
  for (const r of layout.rahmen) {
    elementZuBlock.set(r.id, r.blockId)
    blockZuElementen.set(r.blockId, [...(blockZuElementen.get(r.blockId) ?? []), r.id])
  }
  for (const k of layout.knoten) {
    if (!k.blockId) continue
    elementZuBlock.set(k.id, k.blockId)
    blockZuElementen.set(k.blockId, [...(blockZuElementen.get(k.blockId) ?? []), k.id])
    // Die Aufgabe mit Markierung steht auch für ihren Baustein „für jedes Stück“.
    if (k.mehrfachBlock) blockZuElementen.set(k.mehrfachBlock, [...(blockZuElementen.get(k.mehrfachBlock) ?? []), k.id])
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
  // Externe Teilnehmer als Pools ohne Inhalt (Black Box); sichtbar sind nur ihre Nachrichten.
  for (const pl of layout.pools) x += `    <bpmn:participant id="${pl.id}"${attrName(pl.name)} />\n`
  for (const n of layout.nachrichten) x += `    <bpmn:messageFlow id="${n.id}" sourceRef="${n.von}" targetRef="${n.nach}" />\n`
  x += '  </bpmn:collaboration>\n'
  x += `  <bpmn:process id="Prozess"${attrName(p.name)} isExecutable="false">\n`
  x += doku(prozessDoku, '    ')
  if (einbettung) x += einbettungXml(einbettung, '    ')
  x += '    <bpmn:laneSet id="Bahnen">\n'
  for (const b of layout.bahnen) {
    x += `      <bpmn:lane id="${bahnId(b.schluessel)}"${attrName(b.name)}>\n`
    // Nur Elemente der Prozessebene; der Inhalt eines Abschnitts gehört zu dessen Teilprozess.
    for (const r of layout.rahmen) if (r.eltern === null && r.bahn === b.schluessel) x += `        <bpmn:flowNodeRef>${r.id}</bpmn:flowNodeRef>\n`
    for (const k of layout.knoten) if ((k.rahmen ?? null) === null && k.bahn === b.schluessel) x += `        <bpmn:flowNodeRef>${k.id}</bpmn:flowNodeRef>\n`
    x += '      </bpmn:lane>\n'
  }
  x += '    </bpmn:laneSet>\n'
  // Flüsse gehören zur Ebene ihrer Quelle
  const rahmenNach = new Map(layout.rahmen.map((r) => [r.id, r]))
  const knotenNach = new Map(layout.knoten.map((k) => [k.id, k]))
  const ebeneVon = (id: string): string | null => (rahmenNach.has(id) ? rahmenNach.get(id)!.eltern : (knotenNach.get(id)?.rahmen ?? null))
  const ebene = (rahmen: string | null, e: string): string => {
    let s = ''
    for (const r of layout.rahmen) if (r.eltern === rahmen) s += rahmenXml(r, e)
    for (const k of layout.knoten) if ((k.rahmen ?? null) === rahmen) s += knotenXml(p, k, rein.get(k.id) ?? [], raus.get(k.id) ?? [], blockDoku, standardFluss, e)
    for (const k of layout.kanten) if (ebeneVon(k.von) === rahmen) s += kanteXml(k, e)
    return s
  }
  const rahmenXml = (r: LayoutRahmen, e: string): string => {
    const flussRefs = (rein.get(r.id) ?? []).map((id) => `${e}  <bpmn:incoming>${id}</bpmn:incoming>\n`).join('') + (raus.get(r.id) ?? []).map((id) => `${e}  <bpmn:outgoing>${id}</bpmn:outgoing>\n`).join('')
    const mf = r.mehrfach ? findeBlock(p, r.blockId)?.block : undefined
    const text = mf?.typ === 'mehrfach' ? doku(mehrfachDoku(p, mf), `${e}  `) : ''
    return `${e}<bpmn:subProcess id="${r.id}"${attrName(r.name)}>\n${text}${flussRefs}${mehrfachXml(r.mehrfach, `${e}  `)}${ebene(r.id, `${e}  `)}${e}</bpmn:subProcess>\n`
  }
  x += ebene(null, '    ')
  x += '  </bpmn:process>\n'
  // Je Ergebnis, mit dem der Vorgang in einem Abschnitt endet, ein Fehler mit diesem Code
  for (const f of layout.fehler) x += `  <bpmn:error id="${f.id}"${attrName(f.name)} errorCode="${esc(f.name)}" />\n`

  x += '  <bpmndi:BPMNDiagram id="Diagramm">\n'
  x += '    <bpmndi:BPMNPlane id="Ebene" bpmnElement="Kollaboration">\n'
  x += '      <bpmndi:BPMNShape id="Teilnehmer_di" bpmnElement="Teilnehmer" isHorizontal="true">\n'
  x += bounds(layout.pool, '        ')
  x += '      </bpmndi:BPMNShape>\n'
  for (const pl of layout.pools) {
    x += `      <bpmndi:BPMNShape id="${pl.id}_di" bpmnElement="${pl.id}" isHorizontal="true">\n`
    x += bounds(pl, '        ')
    x += '      </bpmndi:BPMNShape>\n'
  }
  for (const b of layout.bahnen) {
    x += `      <bpmndi:BPMNShape id="${bahnId(b.schluessel)}_di" bpmnElement="${bahnId(b.schluessel)}" isHorizontal="true">\n`
    x += bounds(b, '        ')
    x += '      </bpmndi:BPMNShape>\n'
  }
  // Aufgeklappte Teilprozesse; ihr Inhalt liegt auf derselben Ebene des Diagramms
  for (const r of layout.rahmen) {
    x += `      <bpmndi:BPMNShape id="${r.id}_di" bpmnElement="${r.id}" isExpanded="true">\n`
    x += bounds(r, '        ')
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
  for (const n of layout.nachrichten) {
    x += `      <bpmndi:BPMNEdge id="${n.id}_di" bpmnElement="${n.id}">\n`
    for (const pt of n.punkte) x += `        <di:waypoint x="${zahl(pt.x)}" y="${zahl(pt.y)}" />\n`
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
