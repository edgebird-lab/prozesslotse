// bpmn-moddle 10 liefert für den Haupteinstieg keine Typen mit; hier nur, was die Tests brauchen.
declare module 'bpmn-moddle' {
  export interface ModdleImport {
    rootElement: { $type: string }
    warnings: { message: string }[]
  }
  export interface Moddle {
    fromXML(xml: string, typName?: string): Promise<ModdleImport>
  }
  export function BpmnModdle(zusaetzlichePakete?: object, optionen?: object): Moddle
}
