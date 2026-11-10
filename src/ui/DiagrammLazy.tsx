import { forwardRef, lazy, Suspense } from 'react'
import type { DiagrammApi, DiagrammProps } from './Diagramm'

// bpmn-js ist groß; als eigener Teil geladen erscheint die Oberfläche schneller.
const Diagramm = lazy(() => import('./Diagramm').then((m) => ({ default: m.Diagramm })))

export const DiagrammLazy = forwardRef<DiagrammApi, DiagrammProps>(function DiagrammLazy(props, ref) {
  return (
    <Suspense fallback={<div className={`diagramm-laden${props.klein ? ' diagramm-klein' : ''}`}>Diagramm wird geladen …</div>}>
      <Diagramm ref={ref} {...props} />
    </Suspense>
  )
})
