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

const teil = (page: Page, name: string) => page.getByRole('navigation', { name: 'Teilschritte' }).getByRole('button', { name: new RegExp(`^${name}`) })
const hinweis = (page: Page) => page.getByRole('region', { name: 'Browser-Speicher' })

/** Gibt im Teilschritt „Dokumente“ eine Version frei; leere Angaben bleiben bei der Vorgabe des Dialogs. */
async function freigeben(page: Page, angaben: { bezeichnung?: string; gueltigAb?: string; aenderung?: string } = {}) {
  await page.getByRole('button', { name: 'Version freigeben …' }).click()
  const dialog = page.getByRole('dialog', { name: 'Version freigeben' })
  if (angaben.bezeichnung) await dialog.getByLabel('Bezeichnung').fill(angaben.bezeichnung)
  if (angaben.gueltigAb) await dialog.getByLabel('Gültig ab').fill(angaben.gueltigAb)
  if (angaben.aenderung) await dialog.getByLabel('Inhalt der Änderung').fill(angaben.aenderung)
  await dialog.getByRole('button', { name: 'Freigeben', exact: true }).click()
  await expect(dialog).toBeHidden()
}

/** Ab `window.versionenVoll` passen keine Versionen mehr in den Browser-Speicher (wie bei vollem Kontingent). */
async function versionenPassenNichtMehr(page: Page) {
  await page.addInitScript(() => {
    const setze = Storage.prototype.setItem
    Storage.prototype.setItem = function (schluessel: string, wert: string) {
      if (schluessel === 'prozesslotse:versionen' && (window as unknown as { versionenVoll?: boolean }).versionenVoll) throw new DOMException('Speicher voll', 'QuotaExceededError')
      return setze.call(this, schluessel, wert)
    }
  })
}

test('voller Browser-Speicher: Der Neustart zeigt den älteren Stand nicht als gespeicherte Datei (daten-0)', async ({ page }) => {
  await versionenPassenNichtMehr(page)
  await start(page)
  await schritt(page, 'Dokumentieren').click()
  await teil(page, 'Dokumente').click()
  await freigeben(page)
  await page.evaluate(() => {
    ;(window as unknown as { versionenVoll?: boolean }).versionenVoll = true
  })
  await freigeben(page, { bezeichnung: '2.0', gueltigAb: '2026-11-12', aenderung: 'Freigabe von Hand ergänzt' })
  await expect(page.getByRole('status')).toContainText('Das Projekt passt nicht mehr in den Browser-Speicher. Bitte als Datei speichern.')
  // Der Meldung folgen: als Datei speichern; die Datei enthält beide Versionen
  const d = await alsDatei(page)
  expect(d.compliance.versionen.map((v: { bezeichnung: string }) => v.bezeichnung)).toEqual(['1.0', '2.0'])
  await expect(page.locator('.dokument-name')).toContainText('bestellung-bis-rechnung-lieferdienst.prozesslotse')

  await page.reload()
  await expect(hinweis(page)).toContainText('Der Browser-Speicher war zuletzt voll. Wiederhergestellt ist deshalb ein älterer Stand als neues, ungespeichertes Dokument')
  // nicht unter dem Namen der Datei und nicht als unverändert
  await expect(page.locator('.dokument-name')).toHaveCount(0)
  await schritt(page, 'Dokumentieren').click()
  await teil(page, 'Dokumente').click()
  const zeilen = page.getByRole('region', { name: 'Versionen' }).getByRole('row')
  await expect(zeilen).toHaveCount(2)
  await expect(zeilen.nth(1)).toContainText('1.0')
  await hinweis(page).getByRole('button', { name: 'Schließen' }).click()
  await expect(hinweis(page)).toHaveCount(0)
})

test('voller Browser-Speicher: Schließen des Tabs fragt bei ungespeicherten Änderungen nach (daten-0)', async ({ page }) => {
  await versionenPassenNichtMehr(page)
  await start(page)
  await schritt(page, 'Dokumentieren').click()
  await teil(page, 'Dokumente').click()
  await page.evaluate(() => {
    ;(window as unknown as { versionenVoll?: boolean }).versionenVoll = true
  })
  await freigeben(page)
  await expect(page.getByRole('status')).toContainText('Das Projekt passt nicht mehr in den Browser-Speicher.')
  const dialog = page.waitForEvent('dialog')
  await page.close({ runBeforeUnload: true })
  const d = await dialog
  expect(d.type()).toBe('beforeunload')
  await d.accept()
})

test('lässt sich der Stand im Browser nicht laden, bleiben die Rohdaten erhalten, bis entschieden ist (daten-2)', async ({ page }) => {
  await start(page)
  // Ein Feld im gespeicherten Projekt beschädigen, z. B. von einer anderen Fassung oder von Hand
  const roh = await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('prozesslotse:projekt')!)
    p.compliance.systeme.med_erp.seit = '01.03.2019'
    localStorage.setItem('prozesslotse:projekt', JSON.stringify(p))
    return localStorage.getItem('prozesslotse:projekt')
  })
  await page.reload()
  await expect(hinweis(page)).toContainText('Die Compliance-Angaben im Browser-Speicher sind beschädigt (systeme.med_erp.seit: ist kein gültiges Datum). Geöffnet ist nur der Prozess. Die Rohdaten bleiben unverändert im Browser, bis du entscheidest.')
  // Der Prozess ist da, die Compliance-Angaben nicht; der Speicher bleibt auch nach einer Änderung unverändert
  await expect(page.getByRole('button', { name: /Rechnung freigeben/ }).first()).toBeVisible()
  await schritt(page, 'Dokumentieren').click()
  await page.getByLabel('Wie heißt das Unternehmen?').fill('Neu GmbH')
  expect(await page.evaluate(() => localStorage.getItem('prozesslotse:projekt'))).toBe(roh)

  const [download] = await Promise.all([page.waitForEvent('download'), hinweis(page).getByRole('button', { name: 'Rohdaten herunterladen' }).click()])
  expect(download.suggestedFilename()).toBe('prozesslotse-rohdaten-2026-11-11.json')
  expect(JSON.parse(await readFile((await download.path())!, 'utf8')).projekt.compliance.systeme.med_erp.seit).toBe('01.03.2019')

  await hinweis(page).getByRole('button', { name: 'Rohdaten verwerfen …' }).click()
  await page.getByRole('dialog', { name: 'Rohdaten verwerfen?' }).getByRole('button', { name: 'Verwerfen' }).click()
  await expect(hinweis(page)).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('prozesslotse:projekt') ?? '{}').compliance?.unternehmen?.name)).toBe('Neu GmbH')
})
