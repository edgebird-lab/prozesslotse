import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Export „Für die Beratungsakte speichern“ im Bericht (Format Beratungsakte v1)

const schritt = (page: Page, name: string) => page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: new RegExp(name) }).click()

function heute(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function pruefeAxe(page: Page) {
  const ergebnis = await new AxeBuilder({ page }).exclude('.djs-container').analyze()
  const schwer = ergebnis.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(schwer.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)).toEqual([])
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
})

test('Dialog: Vorbelegung, Pflichtfeld, Abbrechen, Escape und Fokus; Speichern lädt die Akte herunter', async ({ page }) => {
  await schritt(page, 'Verbessern')
  await expect(page.locator('.vorschlag')).toHaveCount(7)
  const vorschlaege = await page.locator('.vorschlag').count()
  await schritt(page, 'Bericht')
  await expect(page.locator('section[aria-labelledby="bericht-befunde"] li')).toHaveCount(11)
  const befunde = await page.locator('section[aria-labelledby="bericht-befunde"] li').count()
  const kennzahlen = await page.locator('.bericht-tabelle tbody th').allTextContents()

  const knopf = page.getByRole('button', { name: 'Für die Beratungsakte speichern' })
  const dialog = page.getByRole('dialog', { name: 'Für die Beratungsakte speichern' })
  const mandant = dialog.getByRole('textbox', { name: 'Mandant', exact: true })

  // Escape schließt, Fokus zurück auf den Knopf
  await knopf.click()
  await expect(dialog).toBeVisible()
  await expect(mandant).toBeFocused()
  await expect(mandant).toHaveValue('Lieferdienst Muster GmbH')
  await expect(dialog).toContainText('Enthält: 10 Kennzahlen, 11 Befunde, 7 Maßnahmen')
  await expect(dialog).toContainText('Die Datei ist unverschlüsselt und enthält Daten des Mandanten.')
  await expect(dialog).toContainText(`Lieferdienst-Muster-GmbH-prozesslotse-${heute()}.beratungsakte.json`)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(knopf).toBeFocused()

  // Abbrechen ebenso
  await knopf.click()
  await dialog.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(dialog).toBeHidden()
  await expect(knopf).toBeFocused()

  // Pflichtfeld: ohne Mandant kein Download, Meldung am Feld
  await knopf.click()
  await mandant.fill('  ')
  let heruntergeladen = false
  page.on('download', () => (heruntergeladen = true))
  await dialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Bitte den Mandanten angeben.')
  await expect(mandant).toHaveAttribute('aria-invalid', 'true')
  await expect(mandant).toBeFocused()
  expect(heruntergeladen).toBe(false)

  // Mandant mit Umlauten und Nummer: Dateiname folgt sofort
  await mandant.fill('Bäckerei Groß & Söhne GbR')
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await dialog.getByRole('textbox', { name: 'Mandantennummer (optional)' }).fill('K-0815')
  const dateiname = `Bäckerei-Groß-&-Söhne-GbR-prozesslotse-${heute()}.beratungsakte.json`
  await expect(dialog).toContainText(dateiname)
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Speichern' }).click()])
  await expect(dialog).toBeHidden()
  await expect(knopf).toBeFocused()
  expect(download.suggestedFilename()).toBe(dateiname)

  const text = await readFile((await download.path())!, 'utf8')
  expect(text.charCodeAt(0)).not.toBe(0xfeff)
  const akte = JSON.parse(text)
  expect(akte.format).toBe('beratungsakte')
  expect(akte.formatVersion).toBe('1.0')
  expect(akte.erzeugtVon.app).toBe('prozesslotse')
  expect(akte.mandant).toEqual({ name: 'Bäckerei Groß & Söhne GbR', kennung: 'K-0815' })
  expect(akte.analyse).toMatchObject({ art: 'prozessanalyse', titel: 'Bestellung bis Rechnung (Lieferdienst)', stand: heute() })
  expect(akte.kennzahlen.map((k: { name: string }) => k.name)).toEqual(kennzahlen)
  expect(akte.befunde).toHaveLength(befunde)
  expect(akte.massnahmen).toHaveLength(vorschlaege)
})

test('übernommene Maßnahmen stehen mit hoher Priorität in der Akte', async ({ page }) => {
  await schritt(page, 'Verbessern')
  await page.locator('.vorschlag').first().getByRole('button', { name: 'Übernehmen' }).click()
  await expect(page.locator('.vorschlag').first()).not.toContainText('Freigabe „Rechnung freigeben“')
  // Auf dem Soll-Prozess kommt ein neuer Vorschlag hinzu (Rechnungsschritte zusammenlegen)
  const offen = await page.locator('.vorschlag').count()
  await schritt(page, 'Bericht')
  await expect(page.locator('.bericht-massnahmen li')).toHaveCount(1)
  await page.getByRole('button', { name: 'Für die Beratungsakte speichern' }).click()
  const dialog = page.getByRole('dialog', { name: 'Für die Beratungsakte speichern' })
  await expect(dialog).toContainText(`${1 + offen} Maßnahmen`)
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Speichern' }).click()])
  const akte = JSON.parse(await readFile((await download.path())!, 'utf8'))
  expect(akte.massnahmen[0]).toMatchObject({ kennung: 'freigabe:auf_freigeben', prioritaet: 'hoch', erweiterungen: { prozesslotse: { status: 'uebernommen' } } })
  expect(akte.massnahmen).toHaveLength(1 + offen)
  expect(akte.massnahmen.slice(1).every((m: { prioritaet: string }) => m.prioritaet === 'mittel')).toBe(true)
  expect(akte.erweiterungen.prozesslotse.sollProzess).toBe(true)
})

for (const schema of ['light', 'dark'] as const) {
  test(`Knopf und Dialog ohne schwere Barrieren (${schema === 'light' ? 'hell' : 'dunkel'})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: schema })
    await schritt(page, 'Bericht')
    const knopf = page.getByRole('button', { name: 'Für die Beratungsakte speichern' })
    await expect(knopf).toBeVisible()
    await pruefeAxe(page)
    // Bildschirmfotos nur auf Wunsch: BERATUNGSAKTE_BILDER=<Ordner>
    const bilder = process.env.BERATUNGSAKTE_BILDER
    const art = schema === 'light' ? 'hell' : 'dunkel'
    if (bilder) {
      const kopf = (await page.locator('.bericht-kopf').boundingBox())!
      const reihe = (await page.locator('.bericht-aktionen').boundingBox())!
      const x = Math.max(0, kopf.x - 16)
      await page.screenshot({ path: join(bilder, `prozesslotse-knopf-${art}.png`), clip: { x, y: Math.max(0, kopf.y - 16), width: Math.max(kopf.width, reihe.width) + 32, height: reihe.y + reihe.height - kopf.y + 32 } })
    }
    await knopf.click()
    const dialog = page.getByRole('dialog', { name: 'Für die Beratungsakte speichern' })
    await expect(dialog).toBeVisible()
    await pruefeAxe(page)
    if (bilder) await page.screenshot({ path: join(bilder, `prozesslotse-dialog-${art}.png`) })
    // auch mit Meldung am Feld
    await dialog.getByRole('textbox', { name: 'Mandant', exact: true }).fill('')
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog.getByRole('alert')).toBeVisible()
    await pruefeAxe(page)
    if (bilder) await dialog.screenshot({ path: join(bilder, `prozesslotse-dialog-meldung-${art}.png`) })
  })
}
