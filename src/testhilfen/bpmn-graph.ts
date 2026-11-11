import { BpmnModdle, type ModdleElement } from 'bpmn-moddle'
import type { KnotenTyp, TokenGraph, TokenKnoten } from '../bpmn/tokenspiel'

const TYP: Record<string, KnotenTyp> = {
  'bpmn:StartEvent': 'start',
  'bpmn:EndEvent': 'ende',
  'bpmn:ExclusiveGateway': 'xor',
  'bpmn:ParallelGateway': 'und',
  'bpmn:EventBasedGateway': 'ereignisgateway',
  'bpmn:InclusiveGateway': 'oder',
  'bpmn:Task': 'aktivitaet',
  'bpmn:UserTask': 'aktivitaet',
  'bpmn:ManualTask': 'aktivitaet',
  'bpmn:IntermediateCatchEvent': 'aktivitaet',
  'bpmn:SubProcess': 'rahmen',
  'bpmn:AdHocSubProcess': 'rahmen',
  'bpmn:BoundaryEvent': 'rand',
}

interface Element extends ModdleElement {
  flowElements?: Element[]
  eventDefinitions?: { $type: string; errorRef?: { id: string } }[]
  attachedToRef?: { id: string }
  cancelActivity?: boolean
  default?: { id: string }
  loopCharacteristics?: { $type: string; isSequential?: boolean; loopCardinality?: { body?: string } }
  ordering?: string
  gatewayDirection?: string
}

/**
 * Liest exportiertes BPMN mit bpmn-moddle und baut den Graphen für das
 * Tokenspiel. Teilprozesse werden rekursiv gelesen; jeder Knoten kennt seinen
 * Rahmen, Randereignisse ihren Wirt, Endereignisse ihre Art. Mehrfachinstanzen
 * tragen ihre Art (nacheinander oder gleichzeitig) und, falls angegeben, die
 * feste Anzahl (`loopCardinality`). ODER-Zusammenführungen kennen ihre
 * Verzweigung über die Kennungen des Exports (`…_auf`, `…_zu`). Ein Ad-hoc-Teilprozess (nur
 * `ordering="Sequential"`) kennt seine Aktivitäten: alle, die darin ohne
 * eingehenden Sequenzfluss stehen.
 */
export async function graphAusXml(xml: string): Promise<TokenGraph> {
  const { rootElement, warnings } = await BpmnModdle().fromXML(xml)
  if (warnings.length > 0) throw new Error(warnings.map((w) => w.message).join('; '))
  const prozess = (rootElement.rootElements ?? []).find((e) => e.$type === 'bpmn:Process') as Element | undefined
  if (!prozess) throw new Error('kein Prozess im BPMN')
  const knoten = new Map<string, TokenKnoten>()
  const fluesse: ModdleElement[] = []
  const lies = (behaelter: Element, rahmen: string | null) => {
    for (const e of behaelter.flowElements ?? []) {
      if (e.$type === 'bpmn:SequenceFlow') {
        fluesse.push(e)
        continue
      }
      const typ = TYP[e.$type]
      if (!typ) throw new Error(`unbekanntes Element ${e.$type}`)
      const k: TokenKnoten = { id: e.id, typ, rein: [], raus: [], rahmen }
      if (e.gatewayDirection === 'Diverging') k.richtung = 'auf'
      else if (e.gatewayDirection === 'Converging') k.richtung = 'zu'
      const definition = e.eventDefinitions?.[0]
      if (typ === 'ende') {
        k.endeArt = definition?.$type === 'bpmn:ErrorEventDefinition' ? 'fehler' : definition?.$type === 'bpmn:TerminateEventDefinition' ? 'terminierung' : 'normal'
        if (definition?.errorRef) k.fehler = definition.errorRef.id
      }
      const schleife = e.loopCharacteristics
      if (schleife?.$type === 'bpmn:MultiInstanceLoopCharacteristics') {
        const anzahl = schleife.loopCardinality?.body !== undefined ? Number(schleife.loopCardinality.body) : undefined
        k.mehrfach = { nacheinander: schleife.isSequential === true, ...(anzahl !== undefined && Number.isFinite(anzahl) ? { anzahl, streuung: 'fest' as const } : {}) }
      }
      if (typ === 'rand') {
        k.wirt = e.attachedToRef?.id
        k.unterbrechend = e.cancelActivity !== false
        k.randArt = definition?.$type === 'bpmn:ErrorEventDefinition' ? 'fehler' : definition?.$type === 'bpmn:TimerEventDefinition' ? 'zeit' : 'nachricht'
        if (definition?.errorRef) k.fehler = definition.errorRef.id
      }
      knoten.set(e.id, k)
      if (typ === 'rahmen') {
        if (e.$type === 'bpmn:AdHocSubProcess') {
          if (e.ordering !== 'Sequential') throw new Error(`Ad-hoc-Teilprozess ${e.id} ohne ordering="Sequential"`)
          adhoc.push(e)
        }
        lies(e, e.id)
      }
    }
  }
  const adhoc: Element[] = []
  lies(prozess, null)
  const ziel = new Map<string, string>()
  for (const f of fluesse) {
    knoten.get(f.sourceRef!.id)!.raus.push(f.id)
    knoten.get(f.targetRef!.id)!.rein.push(f.id)
    ziel.set(f.id, f.targetRef!.id)
  }
  // Aktivitäten eines Ad-hoc-Teilprozesses: alles darin ohne eingehenden Fluss (außer Randereignissen)
  for (const e of adhoc) {
    knoten.get(e.id)!.adhoc = (e.flowElements ?? []).filter((x) => x.$type !== 'bpmn:SequenceFlow' && x.$type !== 'bpmn:BoundaryEvent' && knoten.get(x.id)!.rein.length === 0).map((x) => x.id)
  }
  // ODER-Zusammenführung und ihre Verzweigung: Der Export nennt sie `…_auf` und `…_zu`
  for (const k of knoten.values()) {
    if (k.typ !== 'oder' || k.richtung !== 'zu' || !k.id.endsWith('_zu')) continue
    const auf = knoten.get(`${k.id.slice(0, -3)}_auf`)
    if (auf?.typ === 'oder') k.verzweigung = auf.id
  }
  const alle = (behaelter: Element): Element[] => (behaelter.flowElements ?? []).flatMap((e) => [e, ...alle(e)])
  for (const e of alle(prozess)) if (e.default) knoten.get(e.id)!.standard = e.default.id
  return { knoten: [...knoten.values()], ziel }
}
