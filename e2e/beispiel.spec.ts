import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
})

test('zeigt Kennzahlen und markiert Schwachstellen im Diagramm', async ({ page }) => {
  await expect(page.getByText('6,7 Arbeitstage')).toBeVisible()
  await expect(page.getByText('Engpass: Niederlassungsleitung')).toBeVisible()
  await expect(page.locator('.pl-abzeichen', { hasText: 'Medienbruch' })).toHaveCount(3)
  await expect(page.getByRole('meter', { name: 'Auslastung Niederlassungsleitung' })).toHaveAttribute('aria-valuenow', '98')
})

test('übernimmt einen Vorschlag und exportiert den Bericht', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Verbessern/ }).click()
  const erster = page.locator('.vorschlag').first()
  await expect(erster).toContainText('Freigabe „Rechnung freigeben“ streichen')
  await erster.getByRole('button', { name: 'Übernehmen' }).click()
  await expect(page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: 'Soll' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.vorschlag').first()).not.toContainText('Freigabe „Rechnung freigeben“')
  await expect(page.getByText('„Rechnung erstellen“ und „Rechnung versenden“ zusammenlegen')).toBeVisible()

  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Bericht/ }).click()
  await expect(page.getByRole('columnheader', { name: 'Soll' })).toBeVisible()
  await expect(page.getByRole('row', { name: /Durchlaufzeit im Schnitt/ })).toContainText('−2 Arbeitstage')

  const [bpmn] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'BPMN-Datei' }).first().click()])
  expect(bpmn.suggestedFilename()).toBe('bestellung-bis-rechnung-lieferdienst-ist.bpmn')
  const xml = await readFile((await bpmn.path())!, 'utf8')
  expect(xml).toContain('<bpmn:definitions')

  const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Projekt als Datei speichern' }).click()])
  const projekt = JSON.parse(await readFile((await json.path())!, 'utf8'))
  expect(projekt.formatVersion).toBe(2)
  expect(projekt.massnahmen).toHaveLength(1)

  const [svg] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'SVG-Bild' }).first().click()])
  expect(await readFile((await svg.path())!, 'utf8')).toContain('<svg')
})

test('öffnet eine gespeicherte Projektdatei und meldet kaputte Dateien', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Bericht/ }).click()
  const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Projekt als Datei speichern' }).click()])
  const pfad = (await json.path())!

  page.on('dialog', (d) => void d.accept())
  await page.getByText('Projekt', { exact: true }).click()
  await page.getByRole('button', { name: 'Neues Projekt' }).click()
  await expect(page.getByText('Willkommen beim Prozesslotsen')).toBeVisible()

  await page.locator('input[type="file"]').setInputFiles(pfad)
  await expect(page.getByRole('status')).toContainText('geladen')
  await expect(page.getByRole('button', { name: /Bestellung telefonisch annehmen/ })).toBeVisible()

  await page.locator('input[type="file"]').setInputFiles({ name: 'kaputt.json', mimeType: 'application/json', buffer: Buffer.from('{"formatVersion": 7}') })
  await expect(page.getByRole('status')).toContainText('Dateiformat 7 wird nicht unterstützt')
})
