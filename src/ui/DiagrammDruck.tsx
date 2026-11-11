import { useMemo } from 'react'
import { ausschnittSvg, planeAusschnitte, svgRahmen, uebersichtSvg, type DruckForm } from './druckausschnitte'

const bild = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
const zehntel = (n: number) => Math.round(n * 10) / 10
const KEINE: DruckForm[] = []

/**
 * Druckfassung eines großen Diagramms: Übersicht mit nummerierten Rahmen, danach
 * die Ausschnitte in lesbarem Maßstab, je mit „Ausschnitt n von m“. Die Schnitte
 * meiden die Formen; ab dem zweiten Ausschnitt einer Zeile stehen die Namen der
 * Pools und Bahnen links davor. Am Bildschirm ausgeblendet; die Druckregeln stehen
 * in styles.css.
 */
export function DiagrammDruck({ svg, formen = KEINE }: { svg: string; formen?: DruckForm[] }) {
  const { plan, uebersicht, bilder } = useMemo(() => {
    const rahmen = svgRahmen(svg)
    const plan = rahmen && planeAusschnitte(rahmen, formen)
    return { plan, uebersicht: bild(plan ? uebersichtSvg(svg, plan) : svg), bilder: plan ? plan.ausschnitte.map((a) => bild(ausschnittSvg(svg, a, plan.gedreht, formen))) : [] }
  }, [svg, formen])

  return (
    <>
      <img className="druck-bild" alt="" aria-hidden="true" src={uebersicht} />
      {plan?.ausschnitte.map((a, i) => {
        // samt Kopf mit den Namen links davor
        const [breite, hoehe] = plan.gedreht ? [a.hoehe, a.breite + a.kopf] : [a.breite + a.kopf, a.hoehe]
        return (
          <figure key={a.nr} className="druck-ausschnitt" data-x={zehntel(a.x)} data-y={zehntel(a.y)} data-breite={zehntel(a.breite)} data-hoehe={zehntel(a.hoehe)} data-kopf={zehntel(a.kopf)} data-gedreht={plan.gedreht ? 'ja' : 'nein'}>
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
