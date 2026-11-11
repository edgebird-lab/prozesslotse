/**
 * Browser-Speicher mit getrennten Schlüsseln für Projekt und Versionen (Prüfung daten-0, daten-1,
 * daten-2, daten-7). Jeder „Tab“ ist eine eigene Instanz des Moduls über einem gemeinsamen Speicher.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { complianceLieferdienst } from '../compliance/beispiel'
import type { ComplianceProjekt } from '../compliance/typen'
import { freigeben } from '../compliance/versionen'
import { neuesProjekt } from './bausteine'
import { beispielLieferdienst, beispielProjekt } from './beispiel'
import { alsJson, leseProjektText } from './speicher'
import type { Projekt } from './typen'

const HEUTE = '2026-11-11'

/** localStorage-Attrappe; zählt wie Chromium Schlüssel und Wert in UTF-16-Einheiten, das Kontingent lässt sich später setzen. */
function speicher() {
  const daten = new Map<string, string>()
  const groesse = () => [...daten].reduce((s, [k, v]) => s + k.length + v.length, 0)
  const s = {
    daten,
    kontingent: Infinity,
    groesse,
    getItem: (k: string) => daten.get(k) ?? null,
    setItem: (k: string, v: string) => {
      const alt = daten.get(k)
      if (groesse() - (alt === undefined ? 0 : k.length + alt.length) + k.length + v.length > s.kontingent) throw new DOMException('voll', 'QuotaExceededError')
      daten.set(k, v)
    },
    removeItem: (k: string) => void daten.delete(k),
  }
  vi.stubGlobal('localStorage', s)
  return s
}

/** Ein Browser-Tab: eigene Modulinstanz, gemeinsamer Speicher. */
async function tab(): Promise<typeof import('./speicher')> {
  vi.resetModules()
  return await import('./speicher')
}

/** Projekt mit `anzahl` echten Versionen; `name` unterscheidet die Projekte. */
async function projektMitVersionen(name: string, anzahl = 1): Promise<Projekt> {
  const ist = { ...beispielLieferdienst(), name }
  const c0 = complianceLieferdienst()
  let c: ComplianceProjekt = { ...c0, unternehmen: { ...c0.unternehmen, name: `${name} GmbH` } }
  for (let i = 1; i <= anzahl; i++) {
    const v = await freigeben(ist, c, { bezeichnung: `${name}-${i}.0`, gueltigAb: `2026-11-${10 + i}`, freigegebenVon: 'Erika Mustermann', aenderung: i === 1 ? 'Erstfassung' : `Stand ${i}` }, HEUTE)
    c = { ...c, versionen: [...c.versionen, v] }
  }
  return { ...beispielProjekt(), ist, compliance: c }
}

/** Neues Projektobjekt mit geändertem Firmennamen; die Versionsliste bleibt dieselbe (wie beim Tippen). */
function getippt(p: Projekt, firma: string): Projekt {
  return { ...p, compliance: { ...p.compliance!, unternehmen: { ...p.compliance!.unternehmen, name: firma } } }
}

const bezeichnungen = (p: Projekt | null) => p?.compliance?.versionen.map((v) => v.bezeichnung)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Zwei Tabs im selben Browser (daten-1)', () => {
  it('Tab B legt ein neues Projekt an, Tab A tippt weiter: Die Version von A bleibt erhalten', async () => {
    speicher()
    const [a, b] = [await tab(), await tab()]
    const x = await projektMitVersionen('X')
    expect(a.speichereImBrowser(x)).toBe(true)
    b.speichereImBrowser(b.ladeAusBrowser()!)
    b.speichereImBrowser(neuesProjekt())
    expect(a.speichereImBrowser(getippt(x, 'X neu GmbH'))).toBe(true)
    const stand = (await tab()).ladeBrowserStand()
    expect(stand.problem).toBeNull()
    expect(stand.projekt!.compliance!.unternehmen.name).toBe('X neu GmbH')
    expect(bezeichnungen(stand.projekt)).toEqual(['X-1.0'])
  })

  it('Tab B öffnet ein anderes Projekt mit Versionen, Tab A tippt weiter: A bekommt keine fremden Versionen', async () => {
    speicher()
    const [a, b] = [await tab(), await tab()]
    const x = await projektMitVersionen('X')
    a.speichereImBrowser(x)
    b.speichereImBrowser(await projektMitVersionen('Z', 2))
    a.speichereImBrowser(getippt(x, 'X neu GmbH'))
    const geladen = (await tab()).ladeAusBrowser()!
    expect(geladen.ist.name).toBe('X')
    expect(bezeichnungen(geladen)).toEqual(['X-1.0'])
    expect(JSON.parse(alsJson(geladen)).compliance.versionen[0].prozess.name).toBe('X')
  })

  it('„Daten im Browser löschen“ in Tab A, danach tippt Tab B: B schreibt seine Versionen wieder mit', async () => {
    speicher()
    const [a, b] = [await tab(), await tab()]
    const x = await projektMitVersionen('X')
    b.speichereImBrowser(x)
    a.loescheBrowserDaten()
    b.speichereImBrowser(getippt(x, 'X neu GmbH'))
    expect(bezeichnungen((await tab()).ladeAusBrowser())).toEqual(['X-1.0'])
  })

  it('schreibt die Versionen beim Tippen nicht neu, solange der gespeicherte Stand passt', async () => {
    const s = speicher()
    const a = await tab()
    const x = await projektMitVersionen('X', 2)
    a.speichereImBrowser(x)
    const vorher = s.daten.get('prozesslotse:versionen')
    const setItem = vi.spyOn(s, 'setItem')
    a.speichereImBrowser(getippt(x, 'X neu GmbH'))
    expect(setItem.mock.calls.map(([k]) => k)).toEqual(['prozesslotse:projekt'])
    expect(s.daten.get('prozesslotse:versionen')).toBe(vorher)
  })
})

describe('Andere Programmfassung im selben Speicher (daten-7)', () => {
  it('Versionen im Projekt einer älteren Fassung gehen vor; der fremde Versionsschlüssel bleibt unverändert, bis entschieden ist', async () => {
    const s = speicher()
    ;(await tab()).speichereImBrowser(await projektMitVersionen('X'))
    // main 0.2.0 öffnet Y mit zwei Versionen und schreibt alles unter einen Schlüssel, ohne Merkmal
    s.setItem('prozesslotse:projekt', JSON.stringify(await projektMitVersionen('Y', 2)))
    const fremd = s.daten.get('prozesslotse:versionen')
    const app = await tab()
    const stand = app.ladeBrowserStand()
    expect(stand.projekt!.ist.name).toBe('Y')
    expect(bezeichnungen(stand.projekt)).toEqual(['Y-1.0', 'Y-2.0'])
    expect(stand.problem).toBe('Im Browser-Speicher lagen außerdem freigegebene Versionen, die nicht zu diesem Stand gehören.')
    expect(stand.geschuetzt).toBe(true)
    app.speichereImBrowser(stand.projekt!)
    expect(s.daten.get('prozesslotse:versionen')).toBe(fremd)
  })

  it('ein Projekt ohne Merkmal und ohne Versionen bekommt keine fremden Versionen', async () => {
    const s = speicher()
    ;(await tab()).speichereImBrowser(await projektMitVersionen('X'))
    s.setItem('prozesslotse:projekt', JSON.stringify({ ...beispielProjekt(), compliance: complianceLieferdienst() }))
    const stand = (await tab()).ladeBrowserStand()
    expect(bezeichnungen(stand.projekt)).toEqual([])
    expect(stand.geschuetzt).toBe(true)
  })

  it('das Merkmal gelangt nie in eine Datei', async () => {
    const s = speicher()
    ;(await tab()).speichereImBrowser(await projektMitVersionen('X'))
    // eine ältere Fassung hat das gespeicherte Projekt samt Merkmal als Datei gespeichert
    const text = s.daten.get('prozesslotse:projekt')!
    expect(text).toContain('"versionenMerkmal"')
    expect(alsJson(leseProjektText(text))).not.toContain('versionenMerkmal')
  })
})

describe('Voller Speicher (daten-0)', () => {
  it('passt beim Öffnen einer anderen Datei nur deren Versionen, nicht das Projekt: kein Mischstand nach dem Neustart', async () => {
    const s = speicher()
    const app = await tab()
    expect(app.speichereImBrowser(await projektMitVersionen('A'))).toBe(true)
    const b0 = await projektMitVersionen('B')
    const b: Projekt = { ...b0, compliance: { ...b0.compliance!, begruendungLaengereAufbewahrung: 'x'.repeat(40_000) } }
    s.kontingent = s.groesse() + 2_000
    expect(app.speichereImBrowser(b)).toBe(false)
    const stand = (await tab()).ladeBrowserStand()
    expect(stand.projekt!.ist.name).toBe('A')
    expect(bezeichnungen(stand.projekt)).toEqual([])
    expect(stand.problem).toContain('Die freigegebenen Versionen zu diesem Stand fehlen im Browser-Speicher oder passen nicht dazu.')
    // Die Versionen von B bleiben als Rohdaten erhalten
    expect(stand.geschuetzt).toBe(true)
    expect(JSON.parse((await tab()).browserRohdaten()!).versionen.versionen[0].bezeichnung).toBe('B-1.0')
  })

  it('passt eine neue Version nicht, bleibt das vorige Paar aus Projekt und Versionen stehen', async () => {
    const s = speicher()
    const app = await tab()
    const x = await projektMitVersionen('X', 2)
    const nurEine = { ...x, compliance: { ...x.compliance!, versionen: x.compliance!.versionen.slice(0, 1) } }
    expect(app.speichereImBrowser(nurEine)).toBe(true)
    s.kontingent = s.groesse() + 5_000
    expect(app.speichereImBrowser(x)).toBe(false)
    expect(app.speichereImBrowser(getippt(x, 'X nach Version 2'))).toBe(false)
    const stand = (await tab()).ladeBrowserStand()
    expect(stand.problem).toBeNull()
    expect(bezeichnungen(stand.projekt)).toEqual(['X-1.0'])
    expect(stand.projekt!.compliance!.unternehmen.name).toBe('X GmbH')
  })

  it('passen nicht einmal die Dateiangaben, werden die alten entfernt statt stehen gelassen', async () => {
    const s = speicher()
    const app = await tab()
    app.speichereDokumentInfo({ pfad: 'C:/a.prozesslotse', name: 'a.prozesslotse', ungespeichert: false })
    s.kontingent = 0
    app.speichereDokumentInfo({ pfad: null, name: null, ungespeichert: true, veraltet: true })
    expect(app.ladeDokumentInfo()).toBeNull()
    s.kontingent = Infinity
    app.speichereDokumentInfo({ pfad: null, name: null, ungespeichert: true, veraltet: true })
    expect(app.ladeDokumentInfo()).toEqual({ pfad: null, name: null, ungespeichert: true, veraltet: true })
  })
})

describe('Stand im Browser lässt sich nicht laden (daten-2)', () => {
  async function mitBeschaedigtemFeld() {
    const s = speicher()
    ;(await tab()).speichereImBrowser(await projektMitVersionen('X', 2))
    const roh = JSON.parse(s.daten.get('prozesslotse:projekt')!)
    roh.compliance.systeme.med_erp.seit = '01.03.2019'
    s.setItem('prozesslotse:projekt', JSON.stringify(roh))
    return { s, projekt: s.daten.get('prozesslotse:projekt'), versionen: s.daten.get('prozesslotse:versionen') }
  }

  it('meldet den Fehler, öffnet nur den Prozess und lässt die Rohdaten unverändert, bis entschieden ist', async () => {
    const { s, projekt, versionen } = await mitBeschaedigtemFeld()
    const app = await tab()
    const stand = app.ladeBrowserStand()
    expect(stand.problem).toBe('Die Compliance-Angaben im Browser-Speicher sind beschädigt (systeme.med_erp.seit: ist kein gültiges Datum). Geöffnet ist nur der Prozess.')
    expect(stand.geschuetzt).toBe(true)
    expect(stand.projekt!.ist.name).toBe('X')
    expect(stand.projekt!.compliance).toBeUndefined()
    // Der Start schreibt nichts: weder Projekt noch Versionen noch Dateiangaben
    expect(app.speichereImBrowser(neuesProjekt())).toBe(true)
    app.speichereDokumentInfo({ pfad: null, name: null, ungespeichert: false })
    app.vergissImBrowser()
    expect(s.daten.get('prozesslotse:projekt')).toBe(projekt)
    expect(s.daten.get('prozesslotse:versionen')).toBe(versionen)
    // Rohdaten zum Herunterladen
    const roh = JSON.parse(app.browserRohdaten()!)
    expect(roh.projekt.compliance.systeme.med_erp.seit).toBe('01.03.2019')
    expect(roh.versionen.versionen).toHaveLength(2)
    // Erst nach der Entscheidung wird wieder geschrieben
    app.verwirfBrowserRohdaten()
    expect(app.speichereImBrowser(stand.projekt!)).toBe(true)
    expect(JSON.parse(s.daten.get('prozesslotse:projekt')!).ist.name).toBe('X')
    expect(s.daten.has('prozesslotse:versionen')).toBe(false)
  })

  it('ein unlesbares Projekt: nichts wiederhergestellt, Rohdaten geschützt; „Daten im Browser löschen“ entfernt sie', async () => {
    const s = speicher()
    s.setItem('prozesslotse:projekt', '{"ist": kaputt')
    const app = await tab()
    const stand = app.ladeBrowserStand()
    expect(stand).toEqual({ projekt: null, problem: 'Der Stand im Browser-Speicher ließ sich nicht laden: Er ist kein gültiges JSON.', geschuetzt: true })
    app.speichereImBrowser(neuesProjekt())
    expect(s.daten.get('prozesslotse:projekt')).toBe('{"ist": kaputt')
    expect(JSON.parse(app.browserRohdaten()!).projekt).toBe('{"ist": kaputt')
    app.loescheBrowserDaten()
    expect([...s.daten.keys()]).toEqual([])
    expect(app.speichereImBrowser(neuesProjekt())).toBe(true)
    expect(s.daten.has('prozesslotse:projekt')).toBe(true)
  })

  it('ohne Problem ist nichts geschützt', async () => {
    speicher()
    ;(await tab()).speichereImBrowser(await projektMitVersionen('X'))
    expect((await tab()).ladeBrowserStand()).toMatchObject({ problem: null, geschuetzt: false })
  })
})
