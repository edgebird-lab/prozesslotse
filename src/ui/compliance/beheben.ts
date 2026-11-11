/**
 * „Beheben“ in der Lückenliste: worauf sich ein Befund bezieht. Der Knopf
 * nennt das Objekt, damit sich gleichlautende Knöpfe unterscheiden lassen
 * (z. B. sechsmal „Schutzmaßnahmen fehlen“).
 */
import { objektName, type Kontext } from '../../compliance/ableitung'
import { TOM_BEREICHE } from '../../compliance/standard'
import type { ComplianceBefund } from '../../compliance/typen'

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
