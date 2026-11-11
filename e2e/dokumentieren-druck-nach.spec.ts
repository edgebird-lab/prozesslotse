import { strFromU8, unzipSync } from 'fflate'
import { readFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from '@playwright/test'

// Nachbesserung Druck (Sichtprüfung vom 11.11.2026 und recht-5), Uhr fest auf den 11.11.2026

const leiste = (page: Page) => page.getByRole('navigation', { name: 'Teilschritte' })
const teil = (page: Page, name: string) => leiste(page).getByRole('button', { name: new RegExp(`^${name}`) })
const schritt = (page: Page, name: string) => page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: new RegExp(name) })

async function start(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00'))
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  await schritt(page, 'Dokumentieren').click()
  await expect(leiste(page)).toBeVisible()
  await teil(page, 'Dokumente').click()
}

const ROT = { light: 'rgb(180, 44, 44)', dark: 'rgb(230, 103, 103)' }

/** Meldung rot, direkt unter dem Feld in seiner Gruppe, das Feld als ungültig markiert und rot umrandet */
async function pruefeMeldungAmFeld(feld: Locator, meldung: Locator, rot: string) {
  await expect(meldung).toBeVisible()
  await expect(feld).toHaveAttribute('aria-invalid', 'true')
  const id = await meldung.getAttribute('id')
  expect(id).toBeTruthy()
  await expect(feld).toHaveAttribute('aria-describedby', id!)
  const lage = await meldung.evaluate((m, f) => {
    const gruppe = m.closest('.feld')
    const feldRect = (f as HTMLElement).getBoundingClientRect()
    const r = m.getBoundingClientRect()
    return { gleicheGruppe: !!gruppe && gruppe.contains(f as HTMLElement), abstand: r.top - feldRect.bottom, links: r.left - feldRect.left, farbe: getComputedStyle(m).color, rahmen: getComputedStyle(f as HTMLElement).borderTopColor }
  }, await feld.elementHandle())
  expect(lage.gleicheGruppe).toBe(true)
  // direkt unter dem Feld
  expect(lage.abstand).toBeGreaterThanOrEqual(0)
  expect(lage.abstand).toBeLessThan(12)
  expect(Math.abs(lage.links)).toBeLessThan(2)
  expect(lage.farbe).toBe(rot)
  expect(lage.rahmen).toBe(rot)
}

for (const schema of ['light', 'dark'] as const) {
  test(`Dialoge: Fehlermeldungen rot direkt am Feld, Feld markiert (${schema === 'light' ? 'hell' : 'dunkel'}, Sichtprüfung Mangel 2)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: schema })
    await start(page)
    await page.getByRole('button', { name: 'Version freigeben …' }).click()
    const dialog = page.getByRole('dialog', { name: 'Version freigeben' })
    const datum = dialog.getByLabel('Gültig ab')
    const freigeben = dialog.getByRole('button', { name: 'Freigeben', exact: true })

    // Gültig ab: mehr als ein Jahr nach dem Freigabetag
    await datum.fill('2126-11-11')
    await freigeben.click()
    const meldung = dialog.getByRole('alert')
    await expect(meldung).toHaveText('Gültig ab darf höchstens ein Jahr nach dem Freigabetag liegen, also spätestens am 11.11.2027.')
    await pruefeMeldungAmFeld(datum, meldung, ROT[schema])
    await expect(datum).toBeFocused()
    // Ändern nimmt die Meldung weg
    await datum.fill('2026-11-11')
    await expect(meldung).toHaveCount(0)
    await expect(datum).not.toHaveAttribute('aria-invalid', 'true')

    // fachliche Prüfung: Datum ohne Namen, die Meldung steht am Namensfeld
    await dialog.getByLabel('Geprüft am').fill('2026-11-10')
    await freigeben.click()
    await expect(meldung).toHaveText('Bitte angeben, wer fachlich geprüft hat, oder das Datum leeren.')
    await pruefeMeldungAmFeld(dialog.getByLabel('Fachlich geprüft von'), meldung, ROT[schema])
    await dialog.getByRole('button', { name: 'Abbrechen' }).click()

    // Rückzug: Grund fehlt
    await page.getByRole('button', { name: 'Version freigeben …' }).click()
    await datum.fill('2026-12-01')
    await freigeben.click()
    await expect(dialog).toBeHidden()
    await page.getByRole('region', { name: 'Versionen' }).getByRole('button', { name: 'Freigabe von Version 1.0 zurückziehen …' }).click()
    const rueckzug = page.getByRole('dialog', { name: 'Freigabe zurückziehen' })
    await rueckzug.getByRole('button', { name: 'Zurückziehen' }).click()
    await expect(rueckzug.getByRole('alert')).toHaveText('Bitte den Grund für den Rückzug angeben.')
    await pruefeMeldungAmFeld(rueckzug.getByLabel('Grund'), rueckzug.getByRole('alert'), ROT[schema])
  })
}

test('Vorlagenhinweis nur im Entwurf; die freigegebene Fassung nennt Version, Freigabetag und fachliche Prüfung (recht-5)', async ({ page }) => {
  await start(page)
  // Fußzeile im Druck: Regel für das Randfeld der Seite (@page, @bottom-center)
  const fussRegel = () => page.evaluate(() => [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').find((t) => t.includes('@bottom-center')) ?? '')
  const fuss = { toContain: (text: string) => expect.poll(fussRegel).toContain(text), notToContain: (text: string) => expect.poll(fussRegel).not.toContain(text) }
  const deckblatt = page.locator('.dokument-deckblatt')
  await fuss.toContain('content: "Vorlage – vor Verwendung prüfen lassen · Verfahrensdokumentation · Entwurf · Seite " counter(page)')
  await expect(deckblatt.locator('.dokument-hinweis')).toContainText('Vor Verwendung von der Steuerberatung prüfen lassen.')

  await page.getByRole('button', { name: 'Version freigeben …' }).click()
  const dialog = page.getByRole('dialog', { name: 'Version freigeben' })
  await dialog.getByLabel('Fachlich geprüft von').fill('Steuerberatung Muster')
  await dialog.getByLabel('Geprüft am').fill('2026-11-10')
  await dialog.getByRole('button', { name: 'Freigeben', exact: true }).click()
  await expect(dialog).toBeHidden()

  // Ohne Änderung zeigt die Vorschau die freigegebene Fassung; der Druck nutzt dieselbe Regel
  await fuss.toContain('content: "Verfahrensdokumentation · Version 1.0 · freigegeben am 11.11.2026 · Seite " counter(page)')
  await fuss.notToContain('Vorlage')
  await expect(deckblatt).toContainText('Fachlich geprüft von Steuerberatung Muster am 10.11.2026.')
  await expect(deckblatt.locator('.dokument-hinweis')).toContainText(
    'Aus einer Vorlage mit dem Prozesslotsen erstellt; die Verantwortung für den Inhalt liegt beim Unternehmen. Eine Prüfung durch die Steuerberatung wird empfohlen.',
  )
  await expect(deckblatt).not.toContainText('Vor Verwendung')
  await expect(page.getByRole('tabpanel').getByRole('row', { name: /^1\.0/ })).toContainText('fachlich geprüft von Steuerberatung Muster am 10.11.2026')

  await page.getByRole('tab', { name: 'Verarbeitungsverzeichnis' }).click()
  await fuss.toContain('content: "Verzeichnis von Verarbeitungstätigkeiten · Version 1.0 · freigegeben am 11.11.2026 · Seite "')
  await expect(deckblatt.locator('.dokument-hinweis')).toContainText('Eine Prüfung durch den Datenschutzbeauftragten oder eine fachkundige Person wird empfohlen.')

  // DOCX: gleiche Fußzeile und gleiches Deckblatt
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Als Word-Datei (DOCX)' }).click()])
  const dateien = unzipSync(new Uint8Array(await readFile((await download.path())!)))
  const fussXml = Object.keys(dateien)
    .filter((n) => /^word\/footer\d*\.xml$/.test(n))
    .map((n) => strFromU8(dateien[n]))
    .join('')
  expect(fussXml).toContain('Verzeichnis von Verarbeitungstätigkeiten · Version 1.0 · freigegeben am 11.11.2026 · Seite ')
  expect(fussXml).not.toContain('Vorlage')
  expect(strFromU8(dateien['word/document.xml'])).toContain('Fachlich geprüft von Steuerberatung Muster am 10.11.2026.')
})

test('Seitensatz im Druck: neue Seite nur vor großen Kapiteln, 9.2 und Absätze nicht geteilt, „z. B.“ und „E-Mail“ zusammen (Sichtprüfung Mängel 3 und 7)', async ({ page }) => {
  await start(page)
  await page.emulateMedia({ media: 'print' })
  const umbrueche = () =>
    page.locator('.dokument-h1').evaluateAll((hs) => hs.filter((h) => getComputedStyle(h).breakBefore === 'page').map((h) => (h.textContent ?? '').split(/\s/)[0]))
  expect(await umbrueche()).toEqual(['2', '3', '4', '9'])

  // 9.2 Nachweis der Einweisung: das Formular bleibt auf einer Seite
  const formular = page.locator('.tabelle-wrap', { hasText: 'Unterschrift' })
  await expect(formular).toHaveCSS('break-inside', 'avoid')
  // Absätze: keine einzelne Zeile am Seitenende oder -anfang (Edge beachtet widows hier nicht, deshalb ungeteilt)
  const absatz = page.locator('.dokument p', { hasText: 'Für Kaufleute gelten zusätzlich' })
  await expect(absatz).toHaveCSS('break-inside', 'avoid')
  await expect(absatz).toHaveCSS('widows', '2')
  await expect(absatz).toHaveCSS('orphans', '2')

  const vd = await page.locator('.dokument').evaluate((d) => d.textContent ?? '')
  expect(vd).toContain('z. B.')
  expect(vd).not.toMatch(/z\. B\./)

  await page.emulateMedia({ media: 'screen' })
  await page.getByRole('tab', { name: 'Verarbeitungsverzeichnis' }).click()
  await page.emulateMedia({ media: 'print' })
  expect(await umbrueche()).toEqual(['B', 'C'])
  const vvt = await page.locator('.dokument').evaluate((d) => d.textContent ?? '')
  expect(vvt).toContain('E‑Mail')
  expect(vvt).not.toContain('E-Mail')
})

test('Anlage 9.1: jede Form ganz in einem Ausschnitt, Pool- und Bahnnamen am linken Rand jedes Ausschnitts (Sichtprüfung Mangel 1)', async ({ page }) => {
  await start(page)
  const anlage = page.locator('.dokument-diagramm')
  // Formen samt Beschriftung, wie bpmn-js sie zeichnet (Diagrammkoordinaten); Pools und Bahnen zählen nicht
  await expect(anlage.locator('.djs-element.djs-shape').first()).toBeAttached()
  const formen = await anlage.locator('.djs-element.djs-shape[data-element-id]').evaluateAll((els) => {
    const m = new Map<string, { x1: number; y1: number; x2: number; y2: number }>()
    for (const el of els as SVGGElement[]) {
      const id = el.getAttribute('data-element-id')!
      const basis = id.replace(/_label$/, '')
      if (basis === 'Teilnehmer' || /^(Pool|Bahn)_/.test(basis)) continue
      const sicht = el.querySelector('.djs-visual') as SVGGraphicsElement | null
      const t = el.transform.baseVal.consolidate()?.matrix
      if (!sicht || !t) continue
      const b = sicht.getBBox()
      if (b.width === 0 && b.height === 0) continue
      const r = { x1: b.x + t.e, y1: b.y + t.f, x2: b.x + t.e + b.width, y2: b.y + t.f + b.height }
      const alt = m.get(basis)
      m.set(basis, alt ? { x1: Math.min(alt.x1, r.x1), y1: Math.min(alt.y1, r.y1), x2: Math.max(alt.x2, r.x2), y2: Math.max(alt.y2, r.y2) } : r)
    }
    return [...m.entries()].map(([id, r]) => ({ id, ...r }))
  })
  expect(formen.length).toBeGreaterThan(30)

  await page.emulateMedia({ media: 'print' })
  await page.setViewportSize({ width: 680, height: 900 })
  const ausschnitte = anlage.locator('.druck-ausschnitt')
  const m = await ausschnitte.count()
  expect(m).toBeGreaterThan(1)
  const masse = await ausschnitte.evaluateAll((els) =>
    els.map((el) => {
      const d = (el as HTMLElement).dataset
      const src = el.querySelector('img')!.getAttribute('src')!
      return { x: Number(d.x), y: Number(d.y), breite: Number(d.breite), hoehe: Number(d.hoehe), kopf: Number(d.kopf), svg: decodeURIComponent(src.slice(src.indexOf(',') + 1)) }
    }),
  )
  for (const f of formen) {
    const ganz = masse.some((a) => f.x1 >= a.x - 0.2 && f.x2 <= a.x + a.breite + 0.2 && f.y1 >= a.y - 0.2 && f.y2 <= a.y + a.hoehe + 0.2)
    expect(ganz, `${f.id} (${Math.round(f.x1)}–${Math.round(f.x2)})`).toBe(true)
  }

  const namen = ['Bestellung bis Rechnung (Lieferdienst)', 'Kunde', 'Innendienst', 'Lager', 'Disposition', 'Fahrer', 'Buchhaltung', 'Niederlassungsleitung']
  expect(masse[0].kopf).toBe(0)
  for (const [i, a] of masse.entries()) {
    if (i === 0) continue
    expect(a.kopf, `Ausschnitt ${i + 1}`).toBe(60)
    const kopf = a.svg.slice(a.svg.indexOf('<g class="pl-koepfe">'))
    expect(kopf.length, `Ausschnitt ${i + 1}`).toBeLessThan(a.svg.length)
    for (const n of namen) expect(kopf, `Ausschnitt ${i + 1}: ${n}`).toContain(`>${n}</text>`)
  }
})
