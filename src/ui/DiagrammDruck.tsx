import { useMemo } from 'react'
import { ausschnittSvg, planeAusschnitte, svgRahmen, uebersichtSvg } from './druckausschnitte'

const bild = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
const zehntel = (n: number) => Math.round(n * 10) / 10

/**
 * Druckfassung eines großen Diagramms: Übersicht mit nummerierten Rahmen, danach
 * die Ausschnitte in lesbarem Maßstab, je mit „Ausschnitt n von m“. Am Bildschirm
 * ausgeblendet; die Druckregeln stehen in styles.css.
 */
export function DiagrammDruck({ svg }: { svg: string }) {
  const { plan, uebersicht, bilder } = useMemo(() => {
    const rahmen = svgRahmen(svg)
    const plan = rahmen && planeAusschnitte(rahmen)
    return { plan, uebersicht: bild(plan ? uebersichtSvg(svg, plan) : svg), bilder: plan ? plan.ausschnitte.map((a) => bild(ausschnittSvg(svg, a, plan.gedreht))) : [] }
  }, [svg])

  return (
    <>
      <img className="druck-bild" alt="" aria-hidden="true" src={uebersicht} />
      {plan?.ausschnitte.map((a, i) => {
        const [breite, hoehe] = plan.gedreht ? [a.hoehe, a.breite] : [a.breite, a.hoehe]
        return (
          <figure key={a.nr} className="druck-ausschnitt" data-x={zehntel(a.x)} data-y={zehntel(a.y)} data-breite={zehntel(a.breite)} data-hoehe={zehntel(a.hoehe)} data-gedreht={plan.gedreht ? 'ja' : 'nein'}>
            <figcaption>
              Ausschnitt {a.nr} von {plan.ausschnitte.length}
              {plan.gedreht && ' (quer)'}
            </figcaption>
            <img alt="" aria-hidden="true" src={bilder[i]} width={Math.floor(breite * plan.massstab)} height={Math.floor(hoehe * plan.massstab)} />
          </figure>
        )
      })}
    </>
  )
}
