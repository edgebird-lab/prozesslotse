/**
 * Lückenprüfung der Compliance-Doku (Spezifikation 6.4 und 6.5): 38 Regeln.
 * Die App prüft nicht, ob die Angaben stimmen, sondern ob sie vollständig und
 * widerspruchsfrei sind. Befunde sind Hinweise zum Prüfen und Klären, keine
 * Rechtsauskunft. Fehler gibt es nur bei klaren Verstößen (B2, B6, B7).
 *
 * Erzeugt wird Regel für Regel in der Reihenfolge der Tabelle, innerhalb einer
 * Regel in der Reihenfolge der Objekte im Modell; danach stabil nach Schwere.
 */
import type { Schwere } from '../modell/pruefung'
import type { Aufgabe, Id, Prozess } from '../modell/typen'
import {
  ablageVon,
  ablageVonObjekt,
  angaben,
  aufzaehlung,
  digital,
  ersteller,
  hatPersonenbezug,
  kontext,
  kontrollAngaben,
  liste,
  mitDienstleister,
  objektName,
  objekteVon,
  systemAngaben,
  systemeImEinsatz,
  vorigeAufgabe,
  type Kontext,
} from './ableitung'
import { formatiereDatum, tageZwischen } from './datum'
import { aufbewahrungText, laengerAlsVorgeschrieben, mindestJahre } from './fristen'
import { BESONDERE_KATEGORIEN, istPflichtig, STRAFRECHTLICH_TEXT, TOM_BEREICHE } from './standard'
import type { ComplianceBefund, ComplianceProjekt, DatenobjektAngaben, IsoDatum, Teilschritt } from './typen'
import { geaenderteKapitel } from './versionen'

const ELEKTRONISCH = new Set(['bild', 'strukturiert', 'datensatz'])
const RANG: Record<Schwere, number> = { fehler: 0, warnung: 1, hinweis: 2 }

function jahre(n: number): string {
  return `${n} ${n === 1 ? 'Jahr' : 'Jahre'}`
}

function istKontrolle(a: Aufgabe): boolean {
  return a.art === 'pruefung' || a.art === 'freigabe'
}

/** Stabil nach Schwere sortiert: Fehler, Warnungen, Hinweise. */
export function sortiereComplianceBefunde(befunde: ComplianceBefund[]): ComplianceBefund[] {
  return [...befunde].sort((a, b) => RANG[a.schwere] - RANG[b.schwere])
}

/** Fehler und Warnungen eines Teilschritts; ohne sie gilt er als vollständig (6.10). */
export function offenePunkte(befunde: ComplianceBefund[], teilschritt: Teilschritt): number {
  return befunde.filter((b) => (teilschritt === 'luecken' || b.teilschritt === teilschritt) && b.schwere !== 'hinweis').length
}

export function pruefeCompliance(p: Prozess, c: ComplianceProjekt, heute: IsoDatum): ComplianceBefund[] {
  const k = kontext(p, c)
  const befunde: ComplianceBefund[] = []
  const add = (b: Omit<ComplianceBefund, 'schluessel'> & { id?: string }) => {
    const { id, ...rest } = b
    befunde.push({ schluessel: id ? `compliance:${b.regel}:${id}` : `compliance:${b.regel}`, ...rest })
  }
  const objekte = k.sicht.objekte.map((o) => ({ id: o.id, name: objektName(k, o.id), d: angaben(c, o.id) }))

  pruefeUnternehmen(c, add)
  pruefeBelege(k, objekte, add)
  pruefeDaten(c, objekte, add)
  pruefeSysteme(k, heute, add)
  pruefeKontrollen(k, objekte, add)
  for (const b of TOM_BEREICHE) {
    const t = c.toms[b.wert]
    if (t.massnahmen.length === 0 && !t.nichtZutreffend.trim()) {
      add({
        regel: 'T1',
        id: b.wert,
        teilschritt: 'tom',
        schwere: b.wert === 'pseudonymisierung' ? 'hinweis' : 'warnung',
        titel: 'Schutzmaßnahmen fehlen',
        text: `Für „${b.name}“ ist keine Maßnahme eingetragen. Maßnahme wählen oder begründen, warum der Bereich nicht zutrifft.`,
        quelle: 'Art. 32 Abs. 1 DSGVO; DSK-Hinweise Ziff. 6.7, 6.8',
        ziel: { art: 'tom', id: b.wert },
      })
    }
  }
  pruefeVersionen(p, c, heute, add)
  return sortiereComplianceBefunde(befunde)
}

type Add = (b: Omit<ComplianceBefund, 'schluessel'> & { id?: string }) => void
type Objekt = { id: Id; name: string; d: DatenobjektAngaben }

function pruefeUnternehmen(c: ComplianceProjekt, add: Add): void {
  const u = c.unternehmen
  const fehlt: string[] = []
  if (!u.name.trim()) fehlt.push('Name')
  if (!u.anschrift.strasse.trim()) fehlt.push('Straße')
  if (!u.anschrift.plz.trim()) fehlt.push('PLZ')
  if (!u.anschrift.ort.trim()) fehlt.push('Ort')
  if (!u.telefon.trim() && !u.email.trim()) fehlt.push('Telefon oder E-Mail')
  if (fehlt.length > 0) {
    add({
      regel: 'U1',
      teilschritt: 'unternehmen',
      schwere: 'warnung',
      titel: 'Angaben zum Verantwortlichen fehlen',
      text: `Für das Verzeichnis fehlen: ${fehlt.join(', ')}.`,
      quelle: 'Art. 30 Abs. 1 lit. a DSGVO',
      ziel: { art: 'unternehmen', id: fehlt[0] === 'Name' ? 'name' : fehlt[0] === 'Telefon oder E-Mail' ? 'telefon' : 'anschrift' },
    })
  }
  if (!u.geschaeftsleitung.trim()) {
    add({ regel: 'U2', teilschritt: 'unternehmen', schwere: 'hinweis', titel: 'Geschäftsleitung nicht angegeben', text: 'Wer gibt die Verfahrensdokumentation frei?', quelle: 'Muster BStBK/DStV, Kap. 1', ziel: { art: 'unternehmen', id: 'geschaeftsleitung' } })
  }
  if (u.personenMitDaten !== null && u.personenMitDaten >= 20 && u.datenschutzbeauftragter === null) {
    add({
      regel: 'U3',
      teilschritt: 'unternehmen',
      schwere: 'warnung',
      titel: 'Datenschutzbeauftragter fehlt',
      text: `${u.personenMitDaten} Personen arbeiten ständig mit personenbezogenen Daten. Ab 20 ist ein Datenschutzbeauftragter zu benennen.`,
      quelle: '§ 38 Abs. 1 BDSG',
      ziel: { art: 'unternehmen', id: 'datenschutzbeauftragter' },
    })
  }
  if (u.personenMitDaten === null) {
    add({
      regel: 'U4',
      teilschritt: 'unternehmen',
      schwere: 'hinweis',
      titel: 'Zahl der Personen fehlt',
      text: 'Wie viele Personen arbeiten ständig mit personenbezogenen Daten? Davon hängt ab, ob ein Datenschutzbeauftragter nötig ist.',
      quelle: '§ 38 Abs. 1 BDSG',
      ziel: { art: 'unternehmen', id: 'personen' },
    })
  }
}

function pruefeBelege(k: Kontext, objekte: Objekt[], add: Add): void {
  const { c } = k
  for (const o of objekte) {
    if (o.d.aufbewahrungsart === 'unklar') {
      add({
        regel: 'B1',
        id: o.id,
        teilschritt: 'belege',
        schwere: 'warnung',
        titel: 'Aufbewahrungsfrist fehlt',
        text: `Für „${o.name}“ ist keine Aufbewahrungsfrist festgelegt. Ordne die Unterlage ein; im Zweifel die Steuerberatung fragen.`,
        quelle: '§ 147 Abs. 1, 3 AO',
        ziel: { art: 'datenobjekt', id: o.id },
      })
    }
  }
  for (const o of objekte) {
    const min = mindestJahre(o.d.aufbewahrungsart)
    if (o.d.aufbewahrungJahre !== null && min !== null && o.d.aufbewahrungJahre < min) {
      add({
        regel: 'B2',
        id: o.id,
        teilschritt: 'fristen',
        schwere: 'fehler',
        titel: 'Frist kürzer als vorgeschrieben',
        text: `„${o.name}“ soll ${jahre(o.d.aufbewahrungJahre)} aufbewahrt werden, vorgeschrieben sind ${jahre(min)}.`,
        quelle: '§ 147 Abs. 3 AO',
        ziel: { art: 'frist', id: o.id },
      })
    }
  }
  // Ablage je Unterlage: welche Ablageorte gibt es, welche Systeme stehen dahinter?
  const ablage = new Map(
    objekte.map((o) => {
      const speicher = ablageVonObjekt(k, o.d)
      const medien = speicher.map((s) => (s.mediumId ? k.medien.get(s.mediumId) : undefined))
      return [o.id, { speicher, medien }] as const
    }),
  )
  for (const o of objekte) {
    if (istPflichtig(o.d.aufbewahrungsart) && ablage.get(o.id)!.speicher.length === 0) {
      add({
        regel: 'B3',
        id: o.id,
        teilschritt: 'belege',
        schwere: 'warnung',
        titel: 'Ablageort fehlt',
        text: `Wo wird „${o.name}“ aufbewahrt? Ohne Ablageort ist die Aufbewahrung nicht nachweisbar.`,
        quelle: '§ 147 Abs. 1 AO; GoBD Rz. 119',
        ziel: { art: 'datenobjekt', id: o.id },
      })
    }
  }
  const nurPostfach = (o: Objekt): boolean => {
    const { medien } = ablage.get(o.id)!
    return (
      istPflichtig(o.d.aufbewahrungsart) &&
      medien.length > 0 &&
      medien.every((m) => m?.art === 'email') &&
      medien.every((m) => systemAngaben(c, m!.id).unveraenderbarkeit !== 'revisionssicher')
    )
  }
  for (const o of objekte) {
    if (nurPostfach(o)) {
      const namen = [...new Set(ablage.get(o.id)!.medien.map((m) => m!.name.trim() || 'E-Mail'))]
      add({
        regel: 'B4',
        id: o.id,
        teilschritt: 'belege',
        schwere: 'warnung',
        titel: 'E-Mail-Postfach als einziges Archiv',
        text: `„${o.name}“ liegt nur ${namen.length === 1 ? 'im Postfach' : 'in den Postfächern'} ${aufzaehlung(namen)}. Dort kann jeder löschen oder verschieben; Unveränderbarkeit und Frist sind nicht gesichert. Archiv oder DMS ergänzen.`,
        quelle: 'GoBD Rz. 110, 119',
        ziel: { art: 'datenobjekt', id: o.id },
      })
    }
  }
  for (const o of objekte) {
    if (!istPflichtig(o.d.aufbewahrungsart) || !o.d.form || !ELEKTRONISCH.has(o.d.form) || nurPostfach(o)) continue
    const digitale = [...new Map(ablage.get(o.id)!.medien.filter((m) => m && digital(m)).map((m) => [m!.id, m!])).values()]
    if (digitale.length > 0 && digitale.every((m) => !['revisionssicher', 'protokolliert'].includes(systemAngaben(c, m.id).unveraenderbarkeit))) {
      add({
        regel: 'B5',
        id: o.id,
        teilschritt: 'systeme',
        schwere: 'warnung',
        titel: 'Ablage ohne Schutz vor Änderung',
        text: `„${o.name}“ liegt in ${aufzaehlung(digitale.map((m) => m.name.trim() || 'Unbenanntes System'))}, ohne dass Änderungen verhindert oder protokolliert werden. Eine einfache Dateiablage genügt dafür in der Regel nicht.`,
        quelle: 'GoBD Rz. 108–110',
        ziel: { art: 'system', id: digitale[0].id },
      })
    }
  }
  for (const o of objekte) {
    if (!istPflichtig(o.d.aufbewahrungsart) || !o.d.form || !ELEKTRONISCH.has(o.d.form)) continue
    const { medien } = ablage.get(o.id)!
    const nurPapier = medien.length > 0 && medien.every((m) => m !== undefined && !digital(m))
    if (o.d.ablageform !== 'ausdruck' && !nurPapier) continue
    // Ausnahme (GoBD Rz. 120): elektronisch erstellt und auf Papier versandt, nicht aus einem Fakturierungssystem
    const ausFakturierung = ersteller(k, o.id).some((a) => {
      const m = a.mediumId ? k.medien.get(a.mediumId) : undefined
      return m?.art === 'erp' || m?.art === 'fachanwendung'
    })
    const ausnahme = o.d.richtung === 'ausgang' && o.d.form !== 'strukturiert' && !ausFakturierung
    add({
      regel: 'B6',
      id: o.id,
      teilschritt: 'belege',
      schwere: ausnahme ? 'hinweis' : 'fehler',
      titel: 'Elektronisch erhalten, nur auf Papier aufbewahrt',
      text: ausnahme
        ? `„${o.name}“ wird nur auf Papier aufbewahrt. Nur zulässig, wenn „${o.name}“ auf Papier versandt und die Datei nicht aufbewahrt wird.`
        : `„${o.name}“ entsteht oder kommt elektronisch an und muss elektronisch aufbewahrt werden. Ein Ausdruck reicht nicht.`,
      quelle: 'GoBD Rz. 119, 120',
      ziel: { art: 'datenobjekt', id: o.id },
    })
  }
  for (const o of objekte) {
    if (!istPflichtig(o.d.aufbewahrungsart) || !o.d.form || !ELEKTRONISCH.has(o.d.form) || o.d.ablageform !== 'umgewandelt') continue
    const strukturiert = o.d.form === 'strukturiert'
    add({
      regel: 'B7',
      id: o.id,
      teilschritt: 'belege',
      schwere: strukturiert ? 'fehler' : 'hinweis',
      titel: 'Elektronisches Original nicht aufbewahrt',
      text: strukturiert
        ? `Bei „${o.name}“ muss der strukturierte Teil aufbewahrt werden, z. B. die XML-Datei. Nur ein PDF genügt nicht.`
        : `„${o.name}“ liegt nur umgewandelt vor. Prüfen, ob die Voraussetzungen der GoBD Rz. 135 erfüllt sind; sonst das Original zusätzlich aufbewahren.`,
      quelle: 'GoBD Rz. 119, 131, 135 (Fassung 14.07.2025)',
      ziel: { art: 'datenobjekt', id: o.id },
    })
  }
  // Verfahrensdokumentation zum Scannen: eine Angabe für alle gescannten Unterlagen (Frage in der Karte der Unterlage)
  const scanDoku = k.c.ersetzendesScannen.verfahrensdoku
  for (const o of objekte) {
    if (o.d.form !== 'papier' || o.d.ablageform !== 'scan' || o.d.originalVernichtet === false) continue
    if (o.d.originalVernichtet === null) {
      add({
        regel: 'B8',
        id: o.id,
        teilschritt: 'belege',
        schwere: 'hinweis',
        titel: 'Vernichtung nach dem Scannen offen',
        text: `Wird das Papier von „${o.name}“ nach dem Scannen vernichtet? Dann braucht es eine eigene Verfahrensdokumentation zum ersetzenden Scannen.`,
        quelle: 'GoBD Rz. 136',
        ziel: { art: 'datenobjekt', id: o.id },
      })
      continue
    }
    add({
      regel: 'B8',
      id: o.id,
      teilschritt: 'belege',
      schwere: scanDoku === true ? 'hinweis' : 'warnung',
      titel: scanDoku === true ? 'Ersetzendes Scannen dokumentieren' : scanDoku === false ? 'Verfahrensdokumentation zum Scannen fehlt' : 'Verfahrensdokumentation zum Scannen ungeklärt',
      text: `„${o.name}“ wird gescannt und das Papier vernichtet. Dafür braucht es eine eigene Verfahrensdokumentation, z. B. nach dem Muster von BStBK und DStV.${scanDoku === true ? '' : ' Liegt sie vor, wähle bei der Frage danach „Ja“.'}`,
      quelle: 'GoBD Rz. 136',
      ziel: { art: 'datenobjekt', id: o.id },
    })
  }
  for (const a of k.aufgaben) {
    if (!a.uebertragung) continue
    const ungeprueft = objekteVon(k, a.id, 'schreibt').filter((id) => {
      const art = angaben(c, id).aufbewahrungsart
      if (art !== 'buchungsbeleg' && art !== 'buecher') return false
      const gelesenVonKontrolle = k.aufgaben.some((x) => istKontrolle(x) && objekteVon(k, x.id, 'liest').includes(id))
      return !gelesenVonKontrolle && !c.weitereKontrollen.some((w) => w.bezugAufgabeId === a.id)
    })
    if (ungeprueft.length > 0) {
      add({
        regel: 'B9',
        id: a.id,
        teilschritt: 'kontrollen',
        schwere: 'hinweis',
        titel: 'Abtippen ohne Erfassungskontrolle',
        text: `In „${a.name.trim() || 'Unbenannter Schritt'}“ wird ${aufzaehlung(ungeprueft.map((id) => objektName(k, id)))} von Hand übertragen, und keine Kontrolle prüft das Ergebnis.`,
        quelle: 'GoBD Rz. 100',
        blockId: a.id,
        ziel: { art: 'kontrolle', id: 'weitere' },
      })
    }
  }
}

function pruefeDaten(c: ComplianceProjekt, objekte: Objekt[], add: Add): void {
  const personen = objekte.filter((o) => o.d.personenbezogen === true)
  for (const o of objekte) {
    if (o.d.personenbezogen === null) {
      add({
        regel: 'D1',
        id: o.id,
        teilschritt: 'belege',
        schwere: 'hinweis',
        titel: 'Personenbezug ungeklärt',
        text: `Enthält „${o.name}“ Angaben zu Personen, z. B. Name, Anschrift oder Telefonnummer?`,
        quelle: 'Art. 30 Abs. 1 lit. c DSGVO',
        ziel: { art: 'datenobjekt', id: o.id },
      })
    }
  }
  for (const o of personen) {
    const fehlt = [o.d.betroffene.length === 0 ? 'betroffene Personen' : '', o.d.datenkategorien.length === 0 ? 'Datenkategorien' : ''].filter(Boolean)
    if (fehlt.length > 0) {
      add({ regel: 'D2', id: o.id, teilschritt: 'belege', schwere: 'warnung', titel: 'Betroffene oder Datenarten fehlen', text: `Für „${o.name}“ fehlen ${liste(fehlt)}.`, quelle: 'Art. 30 Abs. 1 lit. c DSGVO', ziel: { art: 'datenobjekt', id: o.id } })
    }
  }
  for (const o of personen) {
    if (o.d.rechtsgrundlagen.length === 0) {
      add({ regel: 'D3', id: o.id, teilschritt: 'belege', schwere: 'warnung', titel: 'Rechtsgrundlage fehlt', text: `Auf welcher Grundlage werden die Daten in „${o.name}“ verarbeitet?`, quelle: 'Art. 6 Abs. 1 DSGVO', ziel: { art: 'datenobjekt', id: o.id } })
    }
  }
  for (const o of personen) {
    if (o.d.rechtsgrundlagen.includes('interesse') && !o.d.berechtigtesInteresse.trim()) {
      add({
        regel: 'D4',
        id: o.id,
        teilschritt: 'belege',
        schwere: 'hinweis',
        titel: 'Berechtigtes Interesse nicht benannt',
        text: `Welches berechtigte Interesse gilt für „${o.name}“? Interesse und Abwägung kurz festhalten.`,
        quelle: 'Art. 6 Abs. 1 lit. f DSGVO',
        ziel: { art: 'datenobjekt', id: o.id },
      })
    }
  }
  for (const o of personen) {
    const kategorien = [...BESONDERE_KATEGORIEN.filter((b) => o.d.besondereKategorien.includes(b.wert)).map((b) => b.dok ?? b.text), ...(o.d.strafrechtlich ? [STRAFRECHTLICH_TEXT] : [])]
    if (kategorien.length > 0) {
      add({
        regel: 'D5',
        id: o.id,
        teilschritt: 'belege',
        schwere: 'warnung',
        titel: 'Besonders geschützte Daten',
        text: `„${o.name}“ enthält ${liste(kategorien)}. Dafür gelten strengere Regeln; den Datenschutzbeauftragten oder eine fachkundige Person einbeziehen.`,
        quelle: 'Art. 9 Abs. 1, Art. 10 DSGVO',
        ziel: { art: 'datenobjekt', id: o.id },
      })
    }
  }
  for (const o of personen) {
    if (o.d.aufbewahrungsart === 'keine' && o.d.loeschfrist === null) {
      add({
        regel: 'D6',
        id: o.id,
        teilschritt: 'fristen',
        schwere: 'warnung',
        titel: 'Löschfrist fehlt',
        text: `„${o.name}“ enthält personenbezogene Daten ohne Aufbewahrungspflicht und ohne Löschfrist. Lege fest, wann gelöscht wird, z. B. 30 Tage nach Erledigung.`,
        quelle: 'Art. 5 Abs. 1 lit. e, Art. 30 Abs. 1 lit. f DSGVO; DSK-Hinweise',
        ziel: { art: 'frist', id: o.id },
      })
    }
  }
  if (!c.begruendungLaengereAufbewahrung.trim()) {
    for (const o of personen) {
      if (!laengerAlsVorgeschrieben(o.d)) continue
      const min = mindestJahre(o.d.aufbewahrungsart)
      const vorgeschrieben = min !== null ? jahre(min) : aufbewahrungText({ ...o.d, aufbewahrungJahre: null })
      add({
        regel: 'D7',
        id: o.id,
        teilschritt: 'fristen',
        schwere: 'warnung',
        titel: 'Längere Aufbewahrung ohne Grund',
        text: `„${o.name}“ wird ${jahre(o.d.aufbewahrungJahre!)} statt ${vorgeschrieben} aufbewahrt. Personenbezogene Daten nur so lange speichern wie nötig: Grund angeben.`,
        quelle: 'Art. 5 Abs. 1 lit. e DSGVO',
        ziel: { art: 'frist', id: o.id },
      })
    }
  }
  for (const o of personen) {
    for (const e of o.d.externeEmpfaenger) {
      const land = e.drittland.trim() || 'einem Drittland'
      const maengel: string[] = []
      if (e.standort === 'unbekannt') maengel.push('nicht bekannt, wo die Daten verarbeitet werden')
      if (e.standort === 'drittland' && (e.garantie === null || e.garantie === 'keine')) maengel.push(`keine Garantie für die Übermittlung nach ${land} eingetragen`)
      if (e.standort === 'drittland' && !e.name.trim()) maengel.push(`der Empfänger in ${land} nicht benannt`)
      if (maengel.length === 0) continue
      const wer = e.kategorie.trim() ? `„${e.kategorie.trim()}“` : e.name.trim() ? `„${e.name.trim()}“` : `einen Empfänger von „${o.name}“`
      add({
        regel: 'D8',
        id: e.id,
        teilschritt: 'belege',
        schwere: 'warnung',
        titel: 'Empfänger ohne gesicherten Standort',
        text: `Für ${wer} ist ${maengel.join(' und ')}.`,
        quelle: 'Art. 30 Abs. 1 lit. e, Art. 44–46 DSGVO; DSK-Hinweise Ziff. 6.5',
        ziel: { art: 'datenobjekt', id: o.id },
      })
    }
  }
  if (personen.length > 0 && !c.verarbeitung.zwecke.some((z) => z.trim())) {
    add({ regel: 'D9', teilschritt: 'belege', schwere: 'warnung', titel: 'Zweck fehlt', text: 'Wozu werden die Daten in diesem Prozess verarbeitet?', quelle: 'Art. 30 Abs. 1 lit. b DSGVO', ziel: { art: 'zwecke' } })
  }
}

function pruefeSysteme(k: Kontext, heute: IsoDatum, add: Add): void {
  const systeme = systemeImEinsatz(k).map((m) => ({ m, s: systemAngaben(k.c, m.id), name: m.name.trim() || 'Unbenanntes System' }))
  for (const { m, s, name } of systeme) {
    if (s.betrieb === null) {
      add({ regel: 'S1', id: m.id, teilschritt: 'systeme', schwere: 'hinweis', titel: 'Betrieb des Systems unklar', text: `Wo läuft „${name}“: auf eigenen Geräten, auf eigenem Server oder als Cloud-Dienst?`, quelle: 'Muster BStBK/DStV, Kap. 3.1', ziel: { art: 'system', id: m.id } })
    }
  }
  for (const { m, s, name } of systeme) {
    if (mitDienstleister(s) && hatPersonenbezug(k, m.id) && s.auftragsverarbeitung !== false && s.avVertrag !== 'ja') {
      add({
        regel: 'S2',
        id: m.id,
        teilschritt: 'systeme',
        schwere: 'warnung',
        titel: 'Dienstleister ohne AV-Vertrag',
        text: `${s.dienstleister.trim() || 'Der Anbieter'} verarbeitet in „${name}“ personenbezogene Daten. Dafür ist ein Vertrag zur Auftragsverarbeitung nötig.${s.auftragsverarbeitung === null ? ' Prüfe zuerst, ob im Auftrag verarbeitet wird.' : ''}`,
        quelle: 'Art. 28 Abs. 3 DSGVO',
        ziel: { art: 'system', id: m.id },
      })
    }
  }
  for (const { m, s, name } of systeme) {
    if (!mitDienstleister(s) || !hatPersonenbezug(k, m.id)) continue
    const ohneGarantie = s.standort === 'drittland' && (s.garantie === null || s.garantie === 'keine')
    if (s.standort !== 'unbekannt' && !ohneGarantie) continue
    add({
      regel: 'S3',
      id: m.id,
      teilschritt: 'systeme',
      schwere: 'warnung',
      titel: 'Speicherort unklar oder ohne Garantie',
      text:
        s.standort === 'unbekannt'
          ? `Wo verarbeitet „${name}“ die Daten? Liegt der Server im Drittland oder läuft der Mailversand darüber, ist das eine Übermittlung; Support von dort kann eine sein.`
          : `„${name}“ verarbeitet die Daten in ${s.drittland.trim() || 'einem Drittland'}, ohne dass eine Garantie für die Übermittlung eingetragen ist, z. B. Standardvertragsklauseln.`,
      quelle: 'Art. 44–46 DSGVO; DSK-Hinweise Ziff. 6.4',
      ziel: { art: 'system', id: m.id },
    })
  }
  for (const { m, s, name } of systeme) {
    if (!s.version.trim() || s.seit === null) {
      add({
        regel: 'S4',
        id: m.id,
        teilschritt: 'systeme',
        schwere: 'hinweis',
        titel: 'Programmversion fehlt',
        text: `Für „${name}“ fehlen Version oder Einsatzbeginn. Die Dokumentation muss zu den eingesetzten Programmversionen passen.`,
        quelle: 'GoBD Rz. 154; Muster BStBK/DStV, Kap. 3.1',
        ziel: { art: 'system', id: m.id },
      })
    }
  }
  for (const { m, s, name } of systeme) {
    const ablage = ablageVon(k, m.id)
    if (ablage.length > 0 && (s.sicherung === 'keine' || s.sicherung === 'unklar')) {
      add({
        regel: 'S5',
        id: m.id,
        teilschritt: 'systeme',
        schwere: 'warnung',
        titel: 'Datensicherung ungeklärt',
        text: `„${name}“ bewahrt ${aufzaehlung(ablage.map((id) => objektName(k, id)))} auf, eine Datensicherung ist ${s.sicherung === 'keine' ? 'nicht eingerichtet' : 'nicht bekannt'}.`,
        quelle: 'GoBD Rz. 103–106; Art. 32 Abs. 1 lit. c DSGVO',
        ziel: { art: 'system', id: m.id },
      })
    }
  }
  for (const { m, s, name } of systeme) {
    if (s.sicherung !== 'manuell' && s.sicherung !== 'automatisch') continue
    const getestet = s.wiederherstellungGetestet
    if (getestet !== null && tageZwischen(getestet, heute) <= 365) continue
    add({
      regel: 'S6',
      id: m.id,
      teilschritt: 'systeme',
      schwere: 'hinweis',
      titel: 'Rücksicherung nicht getestet',
      text: `Für „${name}“ wurde ${getestet === null ? 'noch nie' : `seit dem ${formatiereDatum(getestet)} nicht`} geprüft, ob sich die Sicherung zurückspielen lässt.`,
      quelle: 'Art. 32 Abs. 1 lit. c, d DSGVO',
      ziel: { art: 'system', id: m.id },
    })
  }
}

/** Vier-Augen-Prüfung (6.4): höchstens ein Befund je Freigabe, der schwerste. */
function vierAugen(k: Kontext, add: Add): void {
  const { p, c } = k
  for (const f of k.aufgaben) {
    const pruefungVierAugen = f.art === 'pruefung' && kontrollAngaben(c, f.id)?.art === 'vier_augen'
    if (f.art !== 'freigabe' && !pruefungVierAugen) continue
    if (f.rolleId === null) continue
    const gelesen = new Set(objekteVon(k, f.id, 'liest'))
    let erzeuger = k.aufgaben.filter((e) => e.id !== f.id && objekteVon(k, e.id, 'schreibt').some((id) => gelesen.has(id)))
    if (erzeuger.length === 0) {
      const vorige = vorigeAufgabe(p, f.id)
      erzeuger = vorige ? [vorige] : []
    }
    const rolle = p.rollen.find((r) => r.id === f.rolleId)
    const gleich = erzeuger.find((e) => e.rolleId === f.rolleId)
    if (!rolle || !gleich) continue
    const ausgleich = c.weitereKontrollen.find((w) => w.bezugAufgabeId === f.id)
    const fName = f.name.trim() || 'Unbenannter Schritt'
    const rName = rolle.name.trim() || 'Unbenannte Rolle'
    const tun = f.art === 'freigabe' ? 'gibt frei' : 'prüft'
    if (rolle.personen <= 1) {
      const satz = `„${fName}“ ${tun}, was „${rName}“ in „${gleich.name.trim() || 'Unbenannter Schritt'}“ erstellt hat, und die Rolle hat nur eine Person`
      add({
        regel: 'K1',
        id: f.id,
        teilschritt: 'kontrollen',
        schwere: ausgleich ? 'hinweis' : 'warnung',
        titel: 'Freigabe ohne Vier-Augen-Prinzip',
        text: ausgleich
          ? `${satz}; ausgeglichen durch „${ausgleich.name.trim() || 'weitere Kontrolle'}“.`
          : `${satz}. Freigabe einer anderen Person übertragen oder eine nachgelagerte Kontrolle eintragen, z. B. eine Stichprobe der Steuerberatung.`,
        quelle: 'GoBD Rz. 100; Muster BStBK/DStV, Kap. 3.2',
        blockId: f.id,
        ziel: { art: 'kontrolle', id: f.id },
      })
    } else {
      add({
        regel: 'K1',
        id: f.id,
        teilschritt: 'kontrollen',
        schwere: 'hinweis',
        titel: 'Vier-Augen-Prinzip nur organisatorisch',
        text: `Erstellen und ${f.art === 'freigabe' ? 'Freigeben' : 'Prüfen'} liegen bei „${rName}“. Festlegen, dass nie dieselbe Person ${f.art === 'freigabe' ? 'freigibt' : 'prüft'}, die erstellt hat; am sichersten über Berechtigungen im System.`,
        quelle: 'GoBD Rz. 100; Muster BStBK/DStV, Kap. 3.2',
        blockId: f.id,
        ziel: { art: 'kontrolle', id: f.id },
      })
    }
  }
}

function pruefeKontrollen(k: Kontext, objekte: Objekt[], add: Add): void {
  const { c } = k
  vierAugen(k, add)
  const kontrollAufgaben = k.aufgaben.filter(istKontrolle)
  const nachweisText = (name: string, nachweis: string) =>
    nachweis === 'keiner'
      ? `„${name}“ wird nicht nachgewiesen. Kontrollen sind einzurichten, auszuüben und zu protokollieren, z. B. mit Kürzel und Datum.`
      : `Wie wird „${name}“ nachgewiesen? Kontrollen sind einzurichten, auszuüben und zu protokollieren, z. B. mit Kürzel und Datum.`
  for (const a of kontrollAufgaben) {
    const angabe = kontrollAngaben(c, a.id)
    if (angabe && (angabe.nachweis === 'keiner' || angabe.nachweis === 'unklar')) {
      add({ regel: 'K2', id: a.id, teilschritt: 'kontrollen', schwere: 'hinweis', titel: 'Kontrolle ohne Nachweis', text: nachweisText(a.name.trim() || 'Unbenannter Schritt', angabe.nachweis), quelle: 'GoBD Rz. 100', blockId: a.id, ziel: { art: 'kontrolle', id: a.id } })
    }
  }
  for (const w of c.weitereKontrollen) {
    if (w.nachweis === 'keiner' || w.nachweis === 'unklar') {
      add({ regel: 'K2', id: w.id, teilschritt: 'kontrollen', schwere: 'hinweis', titel: 'Kontrolle ohne Nachweis', text: nachweisText(w.name.trim() || 'Weitere Kontrolle', w.nachweis), quelle: 'GoBD Rz. 100', ziel: { art: 'kontrolle', id: w.id } })
    }
  }
  for (const a of kontrollAufgaben) {
    if (!kontrollAngaben(c, a.id)) {
      add({ regel: 'K3', id: a.id, teilschritt: 'kontrollen', schwere: 'hinweis', titel: 'Kontrolle ohne Angaben', text: `Was prüft „${a.name.trim() || 'Unbenannter Schritt'}“, und wie wird es nachgewiesen?`, quelle: 'GoBD Rz. 102', blockId: a.id, ziel: { art: 'kontrolle', id: a.id } })
    }
  }
  const belege = objekte.some((o) => o.d.aufbewahrungsart === 'buchungsbeleg' || o.d.aufbewahrungsart === 'buecher')
  if (belege && kontrollAufgaben.length === 0 && c.weitereKontrollen.length === 0) {
    add({ regel: 'K4', teilschritt: 'kontrollen', schwere: 'hinweis', titel: 'Keine Kontrolle', text: 'Im Prozess entstehen Buchungsbelege, aber keine Kontrolle ist beschrieben.', quelle: 'GoBD Rz. 100–102', ziel: { art: 'kontrolle', id: 'weitere' } })
  }
  const mitAufgaben = new Set(k.aufgaben.map((a) => a.rolleId))
  const interne = k.p.rollen.filter((r) => mitAufgaben.has(r.id) && !(c.rollen[r.id]?.extern ?? false))
  const personen = interne.reduce((s, r) => s + r.personen, 0)
  if (interne.length > 0 && personen <= 1 && !c.weitereKontrollen.some((w) => w.extern)) {
    add({
      regel: 'K5',
      teilschritt: 'kontrollen',
      schwere: 'hinweis',
      titel: 'Ein-Personen-Betrieb ohne Ausgleich',
      text: 'Alle Schritte erledigt eine Person; Funktionstrennung ist nicht möglich. Ausgleich: regelmäßige Stichproben durch die Steuerberatung als weitere Kontrolle eintragen.',
      quelle: 'Muster BStBK/DStV, Kap. 3.2',
      ziel: { art: 'kontrolle', id: 'weitere' },
    })
  }
  if (c.einweisung.turnus === null) {
    add({ regel: 'K6', teilschritt: 'kontrollen', schwere: 'hinweis', titel: 'Einweisung nicht festgelegt', text: 'Wie werden Beteiligte in das Verfahren eingewiesen?', quelle: 'Muster BStBK/DStV, Kap. 2.5', ziel: { art: 'einweisung' } })
  } else if (c.einweisung.turnus === 'keine' && !(interne.length > 0 && personen <= 1)) {
    // „Keine“ ist eine Antwort; im Ein-Personen-Betrieb (Bedingung wie K5) ist niemand einzuweisen
    add({
      regel: 'K6',
      teilschritt: 'kontrollen',
      schwere: 'hinweis',
      titel: 'Keine Einweisung vorgesehen',
      text: 'Wer im Prozess mitarbeitet, sollte das Verfahren kennen. Wähle „Einmalig vor Beginn“, sobald jemand mitarbeitet.',
      quelle: 'Muster BStBK/DStV, Kap. 2.5',
      ziel: { art: 'einweisung' },
    })
  }
}

function pruefeVersionen(p: Prozess, c: ComplianceProjekt, heute: IsoDatum, add: Add): void {
  const letzte = c.versionen[c.versionen.length - 1]
  if (!letzte) {
    add({
      regel: 'V1',
      teilschritt: 'dokumente',
      schwere: 'hinweis',
      titel: 'Noch nicht freigegeben',
      text: 'Die Dokumente sind ein Entwurf. Erst eine Freigabe mit Gültig-ab-Datum macht sie zur gültigen Fassung.',
      quelle: 'Muster BStBK/DStV, Kap. 1; GoBD Rz. 154',
      ziel: { art: 'version' },
    })
    return
  }
  const kapitel = geaenderteKapitel(letzte, p, c)
  if (kapitel.length > 0) {
    add({
      regel: 'V2',
      teilschritt: 'dokumente',
      schwere: 'warnung',
      titel: 'Geändert seit der letzten Freigabe',
      text: `Seit Version ${letzte.bezeichnung} geändert: ${kapitel.join(', ')}. Neue Version freigeben, damit Dokumentation und Praxis übereinstimmen.`,
      quelle: 'GoBD Rz. 154',
      ziel: { art: 'version' },
    })
    return
  }
  const zuletzt = c.zuletztGeprueft !== null && c.zuletztGeprueft > letzte.freigegebenAm ? c.zuletztGeprueft : letzte.freigegebenAm
  const tage = tageZwischen(zuletzt, heute)
  if (tage > 365) {
    add({
      regel: 'V3',
      teilschritt: 'dokumente',
      schwere: 'hinweis',
      titel: 'Überprüfung fällig',
      text: `Die letzte Prüfung ist ${tage} Tage her. Einmal im Jahr prüfen, ob alles noch stimmt.`,
      quelle: 'Art. 32 Abs. 1 lit. d DSGVO; 365 Tage als Annahme',
      ziel: { art: 'version' },
    })
  }
}

/** Kurzer Text für Abzeichen im Diagramm. */
export const KURZ_REGEL: Record<string, string> = {
  B9: 'Abtippen',
  K1: 'Vier Augen',
  K2: 'Nachweis',
  K3: 'Kontrolle',
}
