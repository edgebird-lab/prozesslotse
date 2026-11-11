import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

// Zusammenführung von fix/druck-nach (recht-5, Anlage 9.1) mit der Nachprüfung (Prüfsumme gegen den Rohstand),
// Uhr fest auf den 11.11.2026

const leiste = (page: Page) => page.getByRole('navigation', { name: 'Teilschritte' })
const teil = (page: Page, name: string) => leiste(page).getByRole('button', { name: new RegExp(`^${name}`) })
const schritt = (page: Page, name: string) => page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: new RegExp(name) })
const versionen = (page: Page) => page.getByRole('region', { name: 'Versionen' })

async function start(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00'))
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  await schritt(page, 'Dokumentieren').click()
  await teil(page, 'Dokumente').click()
}

async function freigeben(page: Page, pruefung?: { von: string; am: string }) {
  await page.getByRole('button', { name: 'Version freigeben …' }).click()
  const dialog = page.getByRole('dialog', { name: 'Version freigeben' })
  if (pruefung) {
    await dialog.getByLabel('Fachlich geprüft von').fill(pruefung.von)
    await dialog.getByLabel('Geprüft am').fill(pruefung.am)
  }
  await dialog.getByRole('button', { name: 'Freigeben', exact: true }).click()
  await expect(dialog).toBeHidden()
}

/** Speichert das Projekt als Datei (Download) und liefert den Inhalt als JSON-Daten. */
async function alsDatei(page: Page): Promise<Record<string, any>> {
  await page.getByText('Projekt', { exact: true }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Als Datei speichern' }).click()])
  return JSON.parse(await readFile((await download.path())!, 'utf8'))
}

async function oeffne(page: Page, pfad: string) {
  await page.locator('input[type="file"][accept*="application/json"]').setInputFiles(pfad)
  await schritt(page, 'Dokumentieren').click()
  await teil(page, 'Dokumente').click()
}

/** wie kanonischesJson in src/compliance/speicher.ts: Schlüssel sortiert, ohne Leerraum */
function kanonisch(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map((e) => (e === undefined ? 'null' : kanonisch(e))).join(',')}]`
  if (x !== null && typeof x === 'object') {
    const o = x as Record<string, unknown>
    const teile = Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${kanonisch(o[k])}`)
    return `{${teile.join(',')}}`
  }
  return JSON.stringify(x) ?? 'null'
}

test('Freigabe mit „Fachlich geprüft von/am“: nach Speichern und Laden stimmt die Prüfsumme', async ({ page }, info) => {
  await start(page)
  await freigeben(page, { von: 'Steuerberatung Muster', am: '2026-11-10' })
  await expect(versionen(page).getByRole('row', { name: /^1\.0/ })).toContainText('Prüfsumme stimmt')

  const d = await alsDatei(page)
  expect(d.compliance.versionen[0].fachlichGeprueft).toEqual({ von: 'Steuerberatung Muster', am: '2026-11-10' })
  const pfad = info.outputPath('mit-pruefung.prozesslotse')
  await writeFile(pfad, JSON.stringify(d))
  await oeffne(page, pfad)

  await expect(page.getByRole('status')).not.toContainText('Prüfsumme stimmt nicht')
  await expect(page.locator('.status-zeile')).toHaveText('Gültige Version 1.0 seit 11.11.2026')
  const zeile = versionen(page).getByRole('row', { name: /^1\.0/ })
  await expect(zeile).toContainText('Prüfsumme stimmt')
  await expect(zeile).not.toContainText('stimmt nicht')
  await page.getByRole('button', { name: 'Version 1.0 ansehen' }).click()
  await expect(page.locator('.version-banner')).toContainText('Prüfsumme stimmt')
  await expect(page.locator('.version-banner')).not.toContainText('stimmt nicht')
  await expect(page.locator('.dokument-deckblatt')).toContainText('Fachlich geprüft von Steuerberatung Muster am 10.11.2026.')
})

test('Version mit eingefrorenem Prozess in Format 2: Prüfsumme stimmt, Anlage 9.1 im Druck mit Namenskopf, Speichern behält den Rohstand', async ({ page }, info) => {
  await start(page)
  await freigeben(page)
  const d = await alsDatei(page)
  // so, wie eine unter Format 2 eingefrorene Version aussähe: ohne externe Teilnehmer und ohne Verweise auf sie
  const v = d.compliance.versionen[0]
  const ohneVerweise = (x: unknown): void => {
    if (Array.isArray(x)) return x.forEach(ohneVerweise)
    if (x === null || typeof x !== 'object') return
    const o = x as Record<string, unknown>
    for (const k of ['nachrichtAn', 'nachrichtVon', 'von']) delete o[k]
    Object.values(o).forEach(ohneVerweise)
  }
  v.prozess.formatVersion = 2
  delete v.prozess.teilnehmer
  ohneVerweise(v.prozess.ablauf)
  ohneVerweise(v.prozess.ausloeser)
  v.pruefsumme = createHash('sha256')
    .update(kanonisch([v.prozess, v.verfahrensdoku, v.verzeichnis]), 'utf8')
    .digest('hex')
  const roh = JSON.stringify(v.prozess)
  const pfad = info.outputPath('format-2.prozesslotse')
  await writeFile(pfad, JSON.stringify(d))
  await oeffne(page, pfad)

  await expect(versionen(page).getByRole('row', { name: /^1\.0/ })).toContainText('Prüfsumme stimmt')
  await expect(page.getByRole('status')).not.toContainText('Prüfsumme stimmt nicht')
  await page.getByRole('button', { name: 'Version 1.0 ansehen' }).click()
  await expect(page.locator('.version-banner')).toContainText('Prüfsumme stimmt')
  // Anlage 9.1 zeichnet den eingefrorenen Ablauf (Bahnen ohne den Pool „Kunde“)
  const anlage = page.locator('.dokument-diagramm')
  await expect(anlage.locator('.djs-element.djs-shape').first()).toBeAttached()
  expect(await anlage.locator('.djs-element.djs-shape').count()).toBeGreaterThan(30)
  await page.emulateMedia({ media: 'print' })
  await page.setViewportSize({ width: 680, height: 900 })
  const ausschnitte = anlage.locator('.druck-ausschnitt')
  await expect.poll(() => ausschnitte.count()).toBeGreaterThan(1)
  const zweiter = await ausschnitte.nth(1).evaluate((el) => {
    const src = el.querySelector('img')!.getAttribute('src')!
    return { kopf: Number((el as HTMLElement).dataset.kopf), svg: decodeURIComponent(src.slice(src.indexOf(',') + 1)) }
  })
  expect(zweiter.kopf).toBeGreaterThan(0)
  const kopf = zweiter.svg.slice(zweiter.svg.indexOf('<g class="pl-koepfe">'))
  for (const n of ['Innendienst', 'Lager', 'Fahrer', 'Buchhaltung']) expect(kopf).toContain(`>${n}</text>`)
  expect(kopf).not.toContain('>Kunde</text>')
  await page.emulateMedia({ media: 'screen' })
  await page.setViewportSize({ width: 1440, height: 900 })

  // Erneut speichern: Der Rohstand geht unverändert hinaus, die Prüfsumme bleibt gültig
  const wieder = await alsDatei(page)
  expect(JSON.stringify(wieder.compliance.versionen[0].prozess)).toBe(roh)
  expect(wieder.compliance.versionen[0].pruefsumme).toBe(v.pruefsumme)
})
