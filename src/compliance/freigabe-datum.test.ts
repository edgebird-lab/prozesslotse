/**
 * „Gültig ab“ einer Freigabe und Rückzug einer Freigabe, die noch nicht gilt
 * (Prüfung daten-5, logik-2, bedienung-4).
 */
import { describe, expect, it } from 'vitest'
import { beispielLieferdienst } from '../modell/beispiel'
import { aendereBlock } from '../modell/operationen'
import { alsJson, leseProjekt, leseProjektText } from '../modell/speicher'
import { reduziere, startZustand } from '../zustand'
import { beispielMitCompliance, complianceLieferdienst } from './beispiel'
import { gueltigBisIn } from './fristen'
import { pruefeCompliance } from './regeln'
import type { ComplianceProjekt, DokuVersion, IsoDatum } from './typen'
import { freigeben, FreigabeFehler, kannZurueckziehen, letzteWirksame, pruefeFreigabe, pruefeRueckzug, rueckfrageGueltigAb, vorgabeGueltigAb, zieheZurueck, type FreigabeEingaben } from './versionen'

const HEUTE = '2026-11-11'
const eingaben = (x: Partial<FreigabeEingaben> = {}): FreigabeEingaben => ({ bezeichnung: '1.0', gueltigAb: HEUTE, freigegebenVon: 'Erika Mustermann', aenderung: 'Erstfassung', ...x })

async function mit(c: ComplianceProjekt, x: Partial<FreigabeEingaben>, heute: IsoDatum = HEUTE): Promise<ComplianceProjekt> {
  const v = await freigeben(beispielLieferdienst(), c, eingaben(x), heute)
  return { ...c, versionen: [...c.versionen, v] }
}

describe('Gültig ab (logik-2, daten-5)', () => {
  it('lehnt ein Datum mehr als ein Jahr nach dem Freigabetag ab, etwa einen Tippfehler im Jahrhundert', async () => {
    const c = complianceLieferdienst()
    await expect(freigeben(beispielLieferdienst(), c, eingaben({ gueltigAb: '2126-11-11' }), HEUTE)).rejects.toThrow('Gültig ab darf höchstens ein Jahr nach dem Freigabetag liegen, also spätestens am 11.11.2027.')
    await expect(freigeben(beispielLieferdienst(), c, eingaben({ gueltigAb: '2027-11-12' }), HEUTE)).rejects.toThrow(FreigabeFehler)
    expect(pruefeFreigabe(c, eingaben({ gueltigAb: '2027-11-11' }), HEUTE)).toBeNull()
  })

  it('fragt bei mehr als 30 Tagen nach dem Freigabetag nach', () => {
    expect(rueckfrageGueltigAb(eingaben({ gueltigAb: '2026-12-11' }), HEUTE)).toBeNull()
    expect(rueckfrageGueltigAb(eingaben({ gueltigAb: '2026-12-12' }), HEUTE)).toBe('Version 1.0 soll erst ab dem 12.12.2026 gelten, 31 Tage nach dem Freigabetag. Stimmt das Datum?')
  })

  it('erlaubt ein Datum in der Vergangenheit, aber nur nach dem der letzten wirksamen Version', async () => {
    const c = await mit(complianceLieferdienst(), { gueltigAb: '2024-01-01' })
    expect(c.versionen[0].gueltigAb).toBe('2024-01-01')
    expect(pruefeFreigabe(c, eingaben({ bezeichnung: '2.0', gueltigAb: '2023-12-31', aenderung: 'x' }), HEUTE)).toBe('Gültig ab muss nach dem 01.01.2024 liegen.')
    expect(pruefeFreigabe(c, eingaben({ bezeichnung: '2.0', gueltigAb: '2025-06-01', aenderung: 'x' }), HEUTE)).toBeNull()
  })
})

describe('Vorgabe für „Gültig ab“ im Dialog (bedienung-4)', () => {
  it('ist immer ein zulässiges Datum', async () => {
    const leer = complianceLieferdienst()
    expect(vorgabeGueltigAb(leer, HEUTE)).toBe(HEUTE)
    // zweite Freigabe am selben Tag: der Tag danach
    const heuteGueltig = await mit(leer, {})
    expect(vorgabeGueltigAb(heuteGueltig, HEUTE)).toBe('2026-11-12')
    // Version im Voraus freigegeben
    const imVoraus = await mit(leer, { gueltigAb: '2027-01-01' })
    expect(vorgabeGueltigAb(imVoraus, HEUTE)).toBe('2027-01-02')
    // letzte Version gilt schon länger: heute
    const frueher = await mit(leer, { gueltigAb: '2026-10-01' }, '2026-10-01')
    expect(vorgabeGueltigAb(frueher, HEUTE)).toBe(HEUTE)
    for (const c of [leer, heuteGueltig, imVoraus, frueher]) {
      expect(pruefeFreigabe(c, eingaben({ bezeichnung: 'neu', gueltigAb: vorgabeGueltigAb(c, HEUTE), aenderung: 'Neue Fassung' }), HEUTE)).toBeNull()
    }
  })
})

describe('Freigabe zurückziehen (daten-5)', () => {
  async function vertippt(): Promise<ComplianceProjekt> {
    const c = await mit(complianceLieferdienst(), {})
    return await mit(c, { bezeichnung: '2.0', gueltigAb: '2027-11-10', aenderung: 'Neue Fassung' })
  }

  it('nur die letzte wirksame Version, solange sie noch nicht gilt, und nur mit Grund', async () => {
    const c = await vertippt()
    const [v1, v2] = c.versionen
    expect(kannZurueckziehen(c, v2, HEUTE)).toBe(true)
    expect(kannZurueckziehen(c, v1, HEUTE)).toBe(false)
    expect(pruefeRueckzug(c, 1, 'Grund', HEUTE)).toBe('Zurückziehen lässt sich nur die Freigabe der letzten Version, die noch gilt oder gelten soll.')
    expect(pruefeRueckzug(c, 2, ' ', HEUTE)).toBe('Bitte den Grund für den Rückzug angeben.')
    // am Tag, ab dem sie gilt, ist es zu spät
    expect(pruefeRueckzug(c, 2, 'Grund', '2027-11-10')).toBe('Version 2.0 gilt seit dem 10.11.2027; eine Version, die in Kraft ist, lässt sich nicht zurückziehen. Gib stattdessen eine neue Version frei.')
    expect(() => zieheZurueck(c, 1, 'Grund', HEUTE)).toThrow(FreigabeFehler)
  })

  it('die zurückgezogene Version bleibt sichtbar, zählt aber nicht mehr; Nummern werden nicht wiederverwendet', async () => {
    const c = zieheZurueck(await vertippt(), 2, 'Tippfehler im Jahr', HEUTE)
    const v2 = c.versionen[1]
    expect(v2.zurueckgezogen).toEqual({ am: HEUTE, grund: 'Tippfehler im Jahr' })
    expect(letzteWirksame(c.versionen)?.bezeichnung).toBe('1.0')
    // Version 1.0 läuft wieder ohne Ende; die zurückgezogene hat keine Gültigkeit
    expect(gueltigBisIn(c.versionen, 0)).toBeNull()
    expect(gueltigBisIn(c.versionen, 1)).toBeNull()
    // Berichtigung: Gültig ab nach dem der Version 1.0, nicht nach dem vertippten
    expect(vorgabeGueltigAb(c, HEUTE)).toBe('2026-11-12')
    expect(pruefeFreigabe(c, eingaben({ bezeichnung: '2.0', gueltigAb: '2026-11-12', aenderung: 'x' }), HEUTE)).toBe('Die Bezeichnung 2.0 gibt es schon.')
    const berichtigt = await mit(c, { bezeichnung: '3.0', gueltigAb: '2026-11-12', aenderung: 'Datum berichtigt' })
    const v3 = berichtigt.versionen[2]
    expect(v3.nummer).toBe(3)
    expect(gueltigBisIn(berichtigt.versionen, 0)).toBe('2026-11-11')
    // Kapitel 1 nennt die Version, die galt, als Vorgänger; Kapitel 7 zeigt den Rückzug
    const text = JSON.stringify(v3.verfahrensdoku.abschnitte)
    expect(text).toContain('Vorgängerversion: 1.0.')
    const historie = v3.verfahrensdoku.abschnitte.find((a) => a.art === 'tabelle' && a.kopf[0] === 'Version')
    expect(historie && historie.art === 'tabelle' ? historie.zeilen[1].slice(0, 7) : []).toEqual([
      '2.0',
      '10.11.2027',
      'zurückgezogen am 11.11.2026',
      '11.11.2026, Erika Mustermann',
      '–',
      'Neue Fassung; zurückgezogen: Tippfehler im Jahr',
      'mit der Änderungshistorie',
    ])
    expect(JSON.stringify(v3.verzeichnis.abschnitte)).toContain('Neue Fassung; zurückgezogen am 11.11.2026: Tippfehler im Jahr')
  })

  it('zieht man die einzige Version zurück, gilt der Stand wieder als Entwurf (V1)', async () => {
    const c = zieheZurueck(await mit(complianceLieferdienst(), { gueltigAb: '2027-01-01' }), 1, 'falsches Datum', HEUTE)
    expect(pruefeCompliance(beispielLieferdienst(), c, HEUTE).map((b) => b.regel)).toContain('V1')
    expect(vorgabeGueltigAb(c, HEUTE)).toBe(HEUTE)
    // ohne wirksame Version ist die nächste Freigabe die Erstfassung: Inhalt der Änderung ist keine Pflicht
    expect(pruefeFreigabe(c, eingaben({ bezeichnung: '2.0', aenderung: '' }), HEUTE)).toBeNull()
  })

  it('V2 vergleicht mit der Version, die gilt, nicht mit der zurückgezogenen', async () => {
    const c0 = await mit(complianceLieferdienst(), {})
    const p = aendereBlock(beispielLieferdienst(), 'auf_freigeben', (b) => (b.typ === 'aufgabe' ? { ...b, name: 'Rechnung prüfen und freigeben' } : b))
    // Version 2.0 enthält die Änderung, wird aber zurückgezogen
    const v2: DokuVersion = await freigeben(p, c0, eingaben({ bezeichnung: '2.0', gueltigAb: '2027-01-01', aenderung: 'umbenannt' }), HEUTE)
    const c = zieheZurueck({ ...c0, versionen: [...c0.versionen, v2] }, 2, 'zu früh freigegeben', HEUTE)
    expect(pruefeCompliance(p, c, HEUTE).find((b) => b.regel === 'V2')?.text).toBe('Seit Version 1.0 geändert: Verfahrensdokumentation 3.2, 3.3 und 4. Neue Version freigeben, damit Dokumentation und Praxis übereinstimmen.')
  })

  it('der Rückzug lässt sich wie eine Freigabe nicht rückgängig machen', async () => {
    const c = await vertippt()
    const z0 = startZustand({ ...beispielMitCompliance(), compliance: c }, true)
    const z1 = reduziere(z0, { typ: 'compliance', aenderung: (x) => ({ ...x, mitgeltend: ['Berechtigungskonzept'] }), zeit: 1 })
    expect(z1.vergangenheit).toHaveLength(1)
    const z2 = reduziere(z1, { typ: 'compliance', aenderung: (x) => zieheZurueck(x, 2, 'Tippfehler', HEUTE), zeit: 2 })
    expect(z2.vergangenheit).toHaveLength(0)
    expect(reduziere(z2, { typ: 'rueckgaengig' }).projekt.compliance!.versionen[1].zurueckgezogen).toBeDefined()
  })

  it('Laden: zurückgezogene Versionen zählen für die Reihenfolge nicht; der Rückzug muss vor „gültig ab“ liegen', async () => {
    const c = zieheZurueck(await vertippt(), 2, 'Tippfehler', HEUTE)
    const mitDrei = await mit(c, { bezeichnung: '3.0', gueltigAb: '2026-11-12', aenderung: 'berichtigt' })
    const d = JSON.parse(alsJson({ ...beispielMitCompliance(), compliance: mitDrei }))
    expect(leseProjektText(JSON.stringify(d)).compliance!.versionen.map((v) => v.zurueckgezogen?.grund ?? '')).toEqual(['', 'Tippfehler', ''])
    // ohne den Vermerk passt die Reihenfolge nicht
    const ohne = structuredClone(d)
    delete ohne.compliance.versionen[1].zurueckgezogen
    expect(() => leseProjekt(ohne)).toThrow('‚versionen.2.gueltigAb‘ liegt nicht nach dem der vorigen Version')
    const spaet = structuredClone(d)
    spaet.compliance.versionen[1].zurueckgezogen.am = '2027-11-10'
    expect(() => leseProjekt(spaet)).toThrow('‚versionen.1.zurueckgezogen.am‘ liegt nicht vor „gültig ab“')
    const ohneGrund = structuredClone(d)
    ohneGrund.compliance.versionen[1].zurueckgezogen.grund = ' '
    expect(() => leseProjekt(ohneGrund)).toThrow('‚versionen.1.zurueckgezogen.grund‘ ist leer')
  })
})
