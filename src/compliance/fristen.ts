/**
 * Aufbewahrungs- und Löschfristen (Spezifikation 3.2 und 6.2).
 *
 * Gesetzliche Mindestfristen nach § 147 Abs. 3 AO: Bücher und
 * Organisationsunterlagen 10 Jahre, Buchungsbelege 8 Jahre, Geschäftsbriefe und
 * sonstige Unterlagen 6 Jahre. Die Frist beginnt mit dem Schluss des
 * Kalenderjahres, in dem die Unterlage entstanden, empfangen oder abgesandt
 * wurde (§ 147 Abs. 4 AO). Die Ablaufhemmung (offene Festsetzungsfrist) rechnet
 * die App nicht aus; die Dokumente weisen darauf hin.
 */
import { addiereJahre, addiereMonate, addiereTage, formatiereDatum, jahrVon } from './datum'
import { AUFBEWAHRUNGSARTEN, istPflichtig, ZEITEINHEITEN } from './standard'
import { LIEFERSCHEIN_HGB } from './textbausteine'
import type { Aufbewahrungsart, DatenobjektAngaben, Frist, IsoDatum, Rechtsform, Unternehmen, VersionKopf } from './typen'

/** Frist für Handelsbriefe nach § 257 Abs. 4 HGB */
export const HANDELSBRIEF_JAHRE = 6

/** Rechtsformen, die stets Kaufleute sind: eingetragener Kaufmann, Handelsgesellschaften, Genossenschaft. */
const KAUFLEUTE: ReadonlySet<Rechtsform> = new Set<Rechtsform>(['ek', 'ohg', 'kg', 'gmbh', 'ug', 'gmbh_co_kg', 'eg'])

/** Kaufmann im Sinne des HGB: nach der Rechtsform oder, als Annahme, bei Gewinnermittlung durch Bilanz. */
export function istKaufmann(u: Pick<Unternehmen, 'rechtsform' | 'gewinnermittlung'>): boolean {
  return (u.rechtsform !== null && KAUFLEUTE.has(u.rechtsform)) || u.gewinnermittlung === 'bilanz'
}

/**
 * Lieferschein eines Kaufmanns ohne gewählte Frist von mindestens 6 Jahren: Ist er ein Handelsbrief,
 * verlangt § 257 HGB 6 Jahre, auch wenn die AO nur „bis zur Rechnung“ verlangt (Hinweis B11).
 */
export function lieferscheinHgb(d: DatenobjektAngaben, kaufmann: boolean): boolean {
  return kaufmann && d.aufbewahrungsart === 'lieferschein' && (d.aufbewahrungJahre === null || d.aufbewahrungJahre < HANDELSBRIEF_JAHRE)
}

/** Gesetzliche Mindestfrist in Jahren; null bei Lieferschein, nicht pflichtig oder unklar. */
export function mindestJahre(art: Aufbewahrungsart): number | null {
  return AUFBEWAHRUNGSARTEN.find((a) => a.wert === art)?.jahre ?? null
}

/** Gewählte Frist oder, wenn keine gewählt ist, die gesetzliche Mindestfrist; nur bei aufbewahrungspflichtigen Unterlagen. */
export function wirksameJahre(d: DatenobjektAngaben): number | null {
  // Nach einem Wechsel auf „keine“ oder „unklar“ bleibt eine früher gewählte Zahl stehen; sie gilt dann nicht mehr
  if (!istPflichtig(d.aufbewahrungsart)) return null
  return d.aufbewahrungJahre ?? mindestJahre(d.aufbewahrungsart)
}

/** Letzter Tag der Aufbewahrung für eine Unterlage aus `jahr` bei `n` Jahren. */
export function aufbewahrungBis(jahr: number, n: number): IsoDatum {
  return `${String(jahr + n).padStart(4, '0')}-12-31`
}

/** Frühester Tag, an dem vernichtet oder gelöscht werden darf. */
export function vernichtungAb(jahr: number, n: number): IsoDatum {
  return `${String(jahr + n + 1).padStart(4, '0')}-01-01`
}

/** Ende einer Löschfrist ab `start` (Entstehung bzw. Eingang); null, wenn sie an einem Ereignis hängt. */
export function fristEnde(start: IsoDatum, f: Frist): IsoDatum | null {
  if (f.beginn === 'ereignis') return null
  const basis = f.beginn === 'jahresende' ? `${String(jahrVon(start)).padStart(4, '0')}-12-31` : start
  switch (f.einheit) {
    case 'tage':
      return addiereTage(basis, f.anzahl)
    case 'monate':
      return addiereMonate(basis, f.anzahl)
    case 'jahre':
      return addiereJahre(basis, f.anzahl)
  }
}

function jahreText(n: number): string {
  return `${n} ${n === 1 ? 'Jahr' : 'Jahre'}`
}

/** Wie lange aufbewahrt wird, als Text für Dokumente und Oberfläche. */
export function aufbewahrungText(d: DatenobjektAngaben): string {
  const n = wirksameJahre(d)
  if (n !== null) {
    const bezug = d.aufbewahrungsart === 'buecher' ? 'der letzten Eintragung bzw. Aufstellung' : 'der Entstehung'
    return `${jahreText(n)} ab Ende des Kalenderjahres ${bezug}`
  }
  if (d.aufbewahrungsart === 'lieferschein') {
    if (d.richtung === 'eingang') return 'bis zum Erhalt der Rechnung'
    if (d.richtung === 'ausgang') return 'bis zum Versand der Rechnung'
    return 'bis zum Erhalt bzw. Versand der Rechnung'
  }
  return d.aufbewahrungsart === 'keine' ? '–' : 'offen'
}

/** Löschfrist als Text, z. B. „30 Tage ab Entstehung bzw. Eingang“. */
export function fristText(f: Frist): string {
  const einheit = ZEITEINHEITEN.find((e) => e.wert === f.einheit)
  const menge = `${f.anzahl} ${f.anzahl === 1 ? einheit?.eins : einheit?.viele}`
  switch (f.beginn) {
    case 'entstehung':
      return `${menge} ab Entstehung bzw. Eingang`
    case 'jahresende':
      return `${menge} ab Ende des Kalenderjahres der Entstehung`
    case 'ereignis':
      return `${menge} nach „${f.ereignis.trim() || 'offen'}“`
  }
}

/** Fristende für eine Unterlage aus dem Bezugsjahr, z. B. „bis 31.12.2034“. */
export function beispielBis(d: DatenobjektAngaben, bezugsjahr: number): string {
  const n = wirksameJahre(d)
  return n === null ? '–' : `bis ${formatiereDatum(aufbewahrungBis(bezugsjahr, n))}`
}

/**
 * Löschfrist im Verzeichnis (Art. 30 Abs. 1 lit. f DSGVO): bei pflichtigen Unterlagen das Ende der Aufbewahrung.
 * Beim Lieferschein trägt § 147 Abs. 3 AO nur „bis zur Rechnung“; eine gewählte Frist steht ohne diese Fundstelle.
 */
export function loeschText(d: DatenobjektAngaben, kaufmann = false): string {
  if (d.aufbewahrungsart === 'lieferschein') {
    const hgb = lieferscheinHgb(d, kaufmann) ? `; ${LIEFERSCHEIN_HGB}` : ''
    return d.aufbewahrungJahre === null ? `${aufbewahrungText(d)} (§ 147 Abs. 3 AO)${hgb}` : `nach Ablauf der Aufbewahrung: ${aufbewahrungText(d)}${hgb}`
  }
  if (istPflichtig(d.aufbewahrungsart)) return `nach Ablauf der Aufbewahrung: ${aufbewahrungText(d)} (§ 147 AO)`
  if (d.aufbewahrungsart === 'keine') return d.loeschfrist ? fristText(d.loeschfrist) : 'offen'
  return 'offen'
}

/**
 * Wird länger aufbewahrt als vorgeschrieben? Beim Lieferschein zählt jede gewählte Frist als länger (Regel D7),
 * bei Kaufleuten erst eine über 6 Jahren, weil er als Handelsbrief so lange aufzubewahren sein kann (§ 257 HGB).
 */
export function laengerAlsVorgeschrieben(d: DatenobjektAngaben, kaufmann = false): boolean {
  if (d.aufbewahrungJahre === null) return false
  if (d.aufbewahrungsart === 'lieferschein') return !kaufmann || d.aufbewahrungJahre > HANDELSBRIEF_JAHRE
  const min = mindestJahre(d.aufbewahrungsart)
  return min !== null && d.aufbewahrungJahre > min
}

// ---------- Fristen der Dokumentation selbst (Spezifikation 6.2, Versionen) ----------

/**
 * Gültig bis: Tag vor dem Gültig-ab der nächsten Version, deren Freigabe nicht zurückgezogen ist;
 * null bei der letzten („laufend“) und bei einer zurückgezogenen Version, die nie galt.
 */
export function gueltigBisIn(versionen: Pick<VersionKopf, 'gueltigAb' | 'zurueckgezogen'>[], i: number): IsoDatum | null {
  if (versionen[i]?.zurueckgezogen) return null
  const naechste = versionen.slice(i + 1).find((v) => !v.zurueckgezogen)
  return naechste ? addiereTage(naechste.gueltigAb, -1) : null
}

/**
 * Aufbewahren bis: Ende des zehnten Kalenderjahres nach dem Ende der Gültigkeit
 * (Organisationsunterlage, § 147 Abs. 1 Nr. 1 AO). Die Frist läuft nicht ab,
 * solange Unterlagen aus der Gültigkeit aufbewahrt werden (GoBD Rz. 154).
 */
export function aufbewahrenBis(gueltigBis: IsoDatum | null): IsoDatum | null {
  return gueltigBis === null ? null : aufbewahrungBis(jahrVon(gueltigBis), 10)
}

export function aufbewahrenBisText(gueltigBis: IsoDatum | null): string {
  const bis = aufbewahrenBis(gueltigBis)
  return bis ? `mindestens bis ${formatiereDatum(bis)}` : '10 Jahre nach Ende der Gültigkeit'
}
