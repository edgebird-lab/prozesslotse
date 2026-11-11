/**
 * Stand der Teilschritte für die Leiste (Spezifikation 5.1 und 6.10): Offene
 * Punkte zählt `offenePunkte`. Ein Häkchen gibt es erst, wenn im Teilschritt
 * etwas eingetragen ist; vorher bleibt er neutral, auch ohne offene Punkte.
 * Sonst stünde bei „Belege und Daten“ ein Häkchen, bevor es eine Unterlage gibt.
 */
import { systemeImEinsatz, type Kontext } from './ableitung'
import { mitgeltendeUnterlagen } from './mitgeltend'
import { TOM_REIHENFOLGE } from './standard'
import type { Teilschritt } from './typen'

const gefuellt = (texte: string[]) => texte.some((t) => t.trim() !== '')

function unternehmen(k: Kontext): boolean {
  const { c } = k
  const u = c.unternehmen
  const v = c.verarbeitung
  // „Rollen im Ablauf“: nur Rollen, die es im Ablauf noch gibt; „intern“ ohne Organisation ist die Vorgabe
  const rollen = k.p.rollen.some((r) => {
    const ra = c.rollen[r.id]
    return ra !== undefined && (ra.extern || ra.organisation.trim() !== '')
  })
  // Die laufende Nummer ist mit „1“ vorbelegt und zählt nicht; die Zwecke fragt „Belege und Daten“
  return (
    gefuellt([u.name, u.anschrift.strasse, u.anschrift.plz, u.anschrift.ort, u.telefon, u.email, u.internet, u.branche, u.geschaeftszweck, u.geschaeftsleitung, u.steuerberatung, ...u.standorte]) ||
    gefuellt([v.benennung, v.fachabteilung, v.ansprechpartner, v.telefon, v.email]) ||
    [u.rechtsform, u.gewinnermittlung, u.personenMitDaten, u.datenschutzbeauftragter, u.gemeinsamVerantwortlicher, u.vertreter, v.eingefuehrtAm].some((x) => x !== null) ||
    rollen
  )
}

/** Ist im Teilschritt schon etwas eingetragen, das er abfragt? */
export function hatAngaben(k: Kontext, t: Teilschritt): boolean {
  const { c } = k
  switch (t) {
    case 'unternehmen':
      return unternehmen(k)
    case 'belege':
      // Ausnahme nach Art. 9 Abs. 2 steht in der Unterlage selbst und zählt mit ihr
      return k.sicht.objekte.length > 0 || gefuellt(c.verarbeitung.zwecke) || c.ersetzendesScannen.verfahrensdoku !== null || c.ersetzendesScannen.stand !== null
    case 'systeme':
      // Zugriffsschutz, Wiederfinden, Datenzugriff und Bewilligung stehen in den Angaben zum System und zählen mit ihnen
      return systemeImEinsatz(k).some((m) => c.systeme[m.id] !== undefined)
    case 'fristen': {
      const l = c.loeschung
      const objekte = k.sicht.objekte.map((o) => c.datenobjekte[o.id]).filter((d) => d !== undefined)
      return objekte.some((d) => d.aufbewahrungJahre !== null || d.loeschfrist !== null) || gefuellt([c.begruendungLaengereAufbewahrung, l.freigabe, l.durchfuehrung]) || l.turnus !== null
    }
    case 'kontrollen':
      return k.aufgaben.some((a) => c.kontrollen[a.id] !== undefined) || c.weitereKontrollen.length > 0 || c.einweisung.turnus !== null || c.einweisung.protokoll
    case 'tom':
      return TOM_REIHENFOLGE.some((b) => gefuellt([...c.toms[b].massnahmen, c.toms[b].nichtZutreffend]))
    case 'luecken':
      // Die Lücken fassen alles zusammen: leer nur, solange nirgends etwas eingetragen ist
      return (['unternehmen', 'belege', 'systeme', 'fristen', 'kontrollen', 'tom'] as const).some((x) => hatAngaben(k, x))
    case 'dokumente':
      return c.versionen.length > 0 || mitgeltendeUnterlagen(c).some((m) => gefuellt([m.name, m.ablageort]))
  }
}
