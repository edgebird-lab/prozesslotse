import { readFile, writeFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

// Browsertests zu Daten, Speichern und Versionen (Prüfung „daten“), Uhr fest auf den 11.11.2026

const schritt = (page: Page, name: string) => page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: new RegExp(name) })
const dateiFeld = (page: Page) => page.locator('input[type="file"][accept*="application/json"]')

async function start(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00'))
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
}

/** Speichert das Projekt als Datei (Download) und liefert den Inhalt als JSON-Daten. */
async function alsDatei(page: Page): Promise<Record<string, any>> {
  await page.getByText('Projekt', { exact: true }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Als Datei speichern' }).click()])
  return JSON.parse(await readFile((await download.path())!, 'utf8'))
}

test('öffnet aus einer Datei mit beschädigten Compliance-Angaben auf Wunsch nur den Prozess (daten-3)', async ({ page }, info) => {
  await start(page)
  const d = await alsDatei(page)
  d.compliance.systeme.med_erp.seit = '01.03.2019'
  const pfad = info.outputPath('beschaedigt.prozesslotse')
  await writeFile(pfad, JSON.stringify(d))

  await page.getByText('Projekt', { exact: true }).click()
  await page.getByRole('button', { name: 'Neues Projekt' }).click()
  await expect(page.getByText('Willkommen beim Prozesslotsen')).toBeVisible()

  // Abbrechen: nichts geladen, die Meldung nennt das Feld
  await dateiFeld(page).setInputFiles(pfad)
  const dialog = page.getByRole('dialog', { name: 'Compliance-Angaben beschädigt' })
  await expect(dialog).toContainText('Die Compliance-Angaben in „beschaedigt.prozesslotse“ sind beschädigt (systeme.med_erp.seit: ist kein gültiges Datum). Nur den Prozess öffnen?')
  await dialog.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(page.getByRole('status')).toContainText('Datei nicht geladen: Compliance-Angaben: ‚systeme.med_erp.seit‘ ist kein gültiges Datum.')
  await expect(page.getByText('Willkommen beim Prozesslotsen')).toBeVisible()

  // Nur den Prozess: neues, ungespeichertes Dokument ohne Dateinamen und ohne Compliance-Angaben
  await dateiFeld(page).setInputFiles(pfad)
  await dialog.getByRole('button', { name: 'Nur den Prozess öffnen' }).click()
  await expect(page.getByRole('status')).toContainText('Aus „beschaedigt.prozesslotse“ ist nur der Prozess geöffnet, als neues Dokument ohne Compliance-Angaben. Die Datei bleibt unverändert.')
  await expect(page.getByRole('button', { name: /Rechnung freigeben/ }).first()).toBeVisible()
  await expect(page.locator('.dokument-name')).toHaveCount(0)
  await schritt(page, 'Dokumentieren').click()
  await expect(page.getByLabel('Wie heißt das Unternehmen?')).toHaveValue('')
})
