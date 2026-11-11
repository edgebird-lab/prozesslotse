/**
 * „Beheben“ in der Lückenliste: worauf sich ein Befund bezieht und welche
 * Frage ihn behebt. Der Knopf nennt das Objekt, damit sich gleichlautende
 * Knöpfe unterscheiden lassen (z. B. sechsmal „Schutzmaßnahmen fehlen“);
 * der Sprung bringt die Frage ins Bild und setzt den Fokus auf ihr Feld.
 */
import { angaben, objektName, systemAngaben, type Kontext } from '../../compliance/ableitung'
import { TOM_BEREICHE } from '../../compliance/standard'
import type { ComplianceBefund, ComplianceProjekt } from '../../compliance/typen'
import { zielElement } from './analyse'

/** Kennung des Objekts: aus dem Schlüssel „compliance:{Regel}:{id}“, sonst aus dem Ziel. */
export function befundObjekt(b: ComplianceBefund): string | null {
  const praefix = `compliance:${b.regel}:`
  if (b.schluessel.startsWith(praefix)) return b.schluessel.slice(praefix.length)
  return b.ziel?.id ?? null
}

/** Name des Objekts, z. B. „Verschlüsselung“, „Bestellnotiz“ oder „Warenwirtschaft“; null bei Befunden ohne eigenes Objekt. */
export function befundObjektName(b: ComplianceBefund, k: Kontext): string | null {
  const id = befundObjekt(b)
  if (!id) return null
  if (b.regel === 'V4') {
    const v = k.c.versionen.find((x) => String(x.nummer) === id)
    return v ? `Version ${v.bezeichnung}` : null
  }
  const tom = TOM_BEREICHE.find((t) => t.wert === id)
  if (tom) return tom.name
  if (k.sicht.objekte.some((o) => o.id === id)) return objektName(k, id)
  const medium = k.medien.get(id)
  if (medium) return medium.name.trim() || 'Unbenanntes System'
  const aufgabe = k.aufgaben.find((a) => a.id === id)
  if (aufgabe) return aufgabe.name.trim() || 'Unbenannter Schritt'
  const weitere = k.c.weitereKontrollen.find((w) => w.id === id)
  if (weitere) return weitere.name.trim() || 'Weitere Kontrolle'
  for (const d of Object.values(k.c.datenobjekte)) {
    const e = d.externeEmpfaenger.find((x) => x.id === id)
    if (e) return e.kategorie.trim() || e.name.trim() || 'Empfänger'
  }
  return null
}

/** Zugänglicher Name des Knopfs; beginnt mit dem sichtbaren Wort „Beheben“. */
export function behebenName(b: ComplianceBefund, k: Kontext): string {
  const name = befundObjektName(b, k)
  return `Beheben: ${b.titel}${name ? ` – ${name}` : ''}`
}

/**
 * Element-Id des Felds, dessen Frage den Befund behebt, z. B. „ziel-datenobjekt-{id}-art“
 * bei B1. Null, wenn das Ziel des Befunds selbst passt (z. B. das Feld „Zweck“ bei D9)
 * oder es keine einzelne Frage gibt (K1: Karte mit dem Vier-Augen-Status).
 */
export function feldZiel(b: ComplianceBefund, c: ComplianceProjekt): string | null {
  const ziel = zielElement(b)
  const id = b.ziel?.id
  if (!ziel) return null
  switch (b.regel) {
    case 'B1':
      return `${ziel}-art`
    case 'B3':
    case 'B4':
      return `${ziel}-ablage`
    case 'B6':
      return id && angaben(c, id).ablageform === 'ausdruck' ? `${ziel}-ablageform` : `${ziel}-ablage`
    case 'B7':
      return `${ziel}-ablageform`
    case 'B8':
      return `${ziel}-vernichtet`
    case 'B10':
      // ohne Unterlage: Namensfeld von „Neue Unterlage“
      return 'ziel-datenobjekt'
    case 'B11':
      // gewählte Frist der Unterlage (6 Jahre), das Ziel ist schon das Feld
      return ziel
    case 'D1':
      return `${ziel}-personen`
    case 'D2':
      return id && angaben(c, id).betroffene.length === 0 ? `${ziel}-betroffene` : `${ziel}-kategorien`
    case 'D3':
      return `${ziel}-grundlagen`
    case 'D4':
      return `${ziel}-interesse`
    case 'D5':
      // ohne Ausnahme nach Art. 9 Abs. 2 ist das die offene Frage; sonst die Kategorien
      return id && angaben(c, id).besondereKategorien.length > 0 && !angaben(c, id).ausnahmeArt9 ? `${ziel}-art9` : `${ziel}-besondere`
    case 'D7':
      return 'ziel-begruendung'
    case 'D8': {
      const e = id ? angaben(c, id).externeEmpfaenger.find((x) => x.id === befundObjekt(b)) : undefined
      if (!e) return null
      if (e.standort !== 'drittland') return `ziel-empfaenger-${e.id}-standort`
      return `ziel-empfaenger-${e.id}-${e.garantie === null || e.garantie === 'keine' ? 'garantie' : 'name'}`
    }
    case 'B5':
      return `${ziel}-unveraenderbar`
    case 'S1':
      return `${ziel}-betrieb`
    case 'S2':
      return id && systemAngaben(c, id).auftragsverarbeitung === null ? `${ziel}-av` : `${ziel}-avvertrag`
    case 'S3':
      return id && systemAngaben(c, id).standort === 'drittland' ? `${ziel}-garantie` : `${ziel}-standort`
    case 'S4':
      return id && systemAngaben(c, id).version.trim() ? `${ziel}-seit` : `${ziel}-version`
    case 'S5':
      return `${ziel}-sicherung`
    case 'S6':
      return `${ziel}-getestet`
    case 'S7':
      return id && systemAngaben(c, id).standort === 'drittland' ? `${ziel}-bewilligung` : `${ziel}-standort`
    case 'S8':
      return id && !systemAngaben(c, id).wiederfinden?.trim() ? `${ziel}-wiederfinden` : `${ziel}-datenzugriff`
    case 'S9':
      // „Eingeführt am“: das Ziel ist schon das Feld; sonst das erste Datum in der Zukunft, das der Befund nennt
      if (b.ziel?.art !== 'system') return null
      return b.text.includes('„Im Einsatz seit“') ? `${ziel}-seit` : b.text.includes('„Vertrag vom“') ? `${ziel}-avvom` : `${ziel}-bewilligung`
    case 'K2':
      return `${ziel}-nachweis`
    case 'K3':
      return `${ziel}-art`
    case 'K6':
      return `${ziel}-turnus`
    case 'T1':
      return `${ziel}-massnahmen`
    default:
      return null
  }
}

/** So lange bleibt die angesteuerte Frage umrandet. */
const MARKIERT_MS = 2500
let markierung: number | undefined

const BEDIENELEMENT = 'input:not([type="hidden"]), select, textarea, button, summary'

/** Was den Fokus bekommt: ein Bedienelement oder eine fokussierbare Karte selbst, sonst das erste Bedienelement darin, bei Optionsfeldern das gewählte. */
function fokusElement(el: HTMLElement): HTMLElement {
  if (el.matches(BEDIENELEMENT) || (el.tagName !== 'FIELDSET' && el.hasAttribute('tabindex'))) return el
  const erstes = el.querySelector<HTMLElement>(BEDIENELEMENT)
  if (!erstes) return el
  if (erstes instanceof HTMLInputElement && erstes.type === 'radio') {
    return el.querySelector<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(erstes.name)}"]:checked`) ?? erstes
  }
  return erstes
}

/**
 * Bringt die Frage zum ersten vorhandenen Ziel ins Bild und setzt den Fokus
 * auf ihr Feld. Zugeklappte Bereiche darum werden aufgeklappt. Höhere Fragen
 * als das Fenster beginnen oben, sonst stehen sie in der Mitte.
 */
export function zeigeFrage(ziele: string[]): boolean {
  const ziel = ziele.map((id) => document.getElementById(id)).find((e): e is HTMLElement => e !== null)
  if (!ziel) return false
  for (let d = ziel.closest('details'); d; d = d.parentElement?.closest('details') ?? null) d.open = true
  const feld = fokusElement(ziel)
  const frage = feld === ziel ? ziel : (feld.closest<HTMLElement>('fieldset, .feld') ?? feld)
  const hoch = frage.getBoundingClientRect().height > window.innerHeight * 0.8
  frage.scrollIntoView({ block: hoch ? 'start' : 'center' })
  feld.focus({ preventScroll: true })
  // Kurz sichtbar umranden: Nach einem Mausklick zeigt der Browser keinen Fokusring
  window.clearTimeout(markierung)
  for (const alt of document.querySelectorAll('[data-sprungziel]')) alt.removeAttribute('data-sprungziel')
  frage.setAttribute('data-sprungziel', '')
  markierung = window.setTimeout(() => frage.removeAttribute('data-sprungziel'), MARKIERT_MS)
  return true
}

/** „Weiter“: Teilschritt-Leiste oben ins Bild und Fokus auf die erste Überschrift des neuen Teilschritts. */
export function zeigeAnfang(schritt: HTMLElement | null): void {
  const leiste = schritt?.querySelector<HTMLElement>('nav.teilschritte')
  const ueberschrift = schritt?.querySelector<HTMLElement>('.teil h3')
  leiste?.scrollIntoView({ block: 'start' })
  if (!ueberschrift) return
  if (!ueberschrift.hasAttribute('tabindex')) ueberschrift.tabIndex = -1
  ueberschrift.focus({ preventScroll: true })
}
