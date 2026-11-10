import { BpmnModdle, type ModdleElement } from 'bpmn-moddle'
import { ergaenzeOderBereiche, type KnotenTyp, type TokenGraph, type TokenKnoten } from '../bpmn/tokenspiel'

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
}

/** Liest exportiertes BPMN mit bpmn-moddle und baut den Graphen für das Tokenspiel. */
export async function graphAusXml(xml: string): Promise<TokenGraph> {
  const { rootElement, warnings } = await BpmnModdle().fromXML(xml)
  if (warnings.length > 0) throw new Error(warnings.map((w) => w.message).join('; '))
  const prozess = (rootElement.rootElements ?? []).find((e) => e.$type === 'bpmn:Process')
  if (!prozess) throw new Error('kein Prozess im BPMN')
  const knoten = new Map<string, TokenKnoten>()
  const fluesse: ModdleElement[] = []
  for (const e of prozess.flowElements ?? []) {
    if (e.$type === 'bpmn:SequenceFlow') fluesse.push(e)
    else {
      const typ = TYP[e.$type]
      if (!typ) throw new Error(`unbekanntes Element ${e.$type}`)
      knoten.set(e.id, { id: e.id, typ, rein: [], raus: [] })
    }
  }
  const ziel = new Map<string, string>()
  for (const f of fluesse) {
    knoten.get(f.sourceRef!.id)!.raus.push(f.id)
    knoten.get(f.targetRef!.id)!.rein.push(f.id)
    ziel.set(f.id, f.targetRef!.id)
  }
  for (const e of prozess.flowElements ?? []) {
    const standard = (e as ModdleElement & { default?: { id: string } }).default
    if (standard) knoten.get(e.id)!.standard = standard.id
  }
  const g = { knoten: [...knoten.values()], ziel }
  ergaenzeOderBereiche(g)
  return g
}
