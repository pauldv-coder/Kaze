/* Tipos mínimos de `bpmn-moddle` (el paquete no trae declaraciones). Solo lo que usan las
   pruebas: leer un XML BPMN 2.0 y recorrer los elementos del modelo resultante. */
declare module 'bpmn-moddle' {
  /** Un elemento del metamodelo BPMN (`bpmn:Process`, `bpmn:SequenceFlow`…). */
  export interface ModdleElement {
    $type: string
    id?: string
    name?: string
    rootElements?: ModdleElement[]
    flowElements?: ModdleElement[]
    messageFlows?: ModdleElement[]
    sourceRef?: ModdleElement
    targetRef?: ModdleElement
    [propiedad: string]: unknown
  }

  export interface AdvertenciaLectura {
    message: string
    element?: ModdleElement
    property?: unknown
    value?: unknown
    error?: Error
  }

  export interface ResultadoLectura {
    rootElement: ModdleElement
    references: unknown[]
    warnings: AdvertenciaLectura[]
    elementsById: Record<string, ModdleElement>
  }

  export default class BpmnModdle {
    constructor(paquetes?: Record<string, unknown>, opciones?: Record<string, unknown>)
    fromXML(xml: string, tipoRaiz?: string | Record<string, unknown>, opciones?: Record<string, unknown>): Promise<ResultadoLectura>
    toXML(elemento: ModdleElement, opciones?: Record<string, unknown>): Promise<{ xml: string }>
  }
}
