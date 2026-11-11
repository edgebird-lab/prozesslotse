import { expect, test, type Page } from '@playwright/test'

// Browsertests zur Durchsicht vom 11.11.2026, Paket „Ablauftext und Kapiteltexte“; Uhr fest auf den 11.11.2026

const leiste = (page: Page) => page.getByRole('navigation', { name: 'Teilschritte' })
const teil = (page: Page, name: string) => leiste(page).getByRole('button', { name: new RegExp(`^${name}`) })
const schritt = (page: Page, name: string) => page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: new RegExp(name) })
const vorschau = (page: Page) => page.locator('#dokument-vorschau')

async function start(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00'))
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  await schritt(page, 'Dokumentieren').click()
}

test('Einweisung „Keine“: kein Schalter fürs Protokoll, Dokument und Befund ohne Widerspruch (logik-8, bedienung-18)', async ({ page }) => {
  await start(page)
  await teil(page, 'Kontrollen').click()
  const einweisung = page.getByRole('region', { name: 'Einweisung' })
  const schalter = einweisung.getByRole('switch', { name: 'Die Einweisung wird schriftlich festgehalten' })
  // Beispiel: jährlich, mit Protokoll
  await expect(schalter).toBeChecked()

  await einweisung.locator('label', { hasText: 'Keine' }).click()
  await expect(einweisung.getByRole('radio', { name: 'Keine', exact: true })).toBeChecked()
  await expect(schalter).toHaveCount(0)

  await teil(page, 'Lücken').click()
  await expect(page.getByRole('button', { name: 'Beheben: Keine Einweisung vorgesehen' })).toBeVisible()
  await expect(page.getByText('Wähle „Einmalig vor Beginn“, sobald jemand mitarbeitet.')).toBeVisible()

  await teil(page, 'Dokumente').click()
  await expect(vorschau(page).getByText('Eine Einweisung ist nicht vorgesehen.')).toBeVisible()
  await expect(vorschau(page).getByText('Die Einweisung wird schriftlich festgehalten (Kapitel 9.2).')).toHaveCount(0)
  await expect(vorschau(page).getByText('Nachweis der Einweisung')).toHaveCount(0)
  await expect(vorschau(page).getByText(/^In den Schritten aus Kapitel 4 wird stets so gearbeitet/)).toBeVisible()

  // Zurück auf eine Einweisung: Schalter wieder da, der gespeicherte Wert gilt wieder
  await teil(page, 'Kontrollen').click()
  await einweisung.locator('label', { hasText: 'Einmalig vor Beginn' }).click()
  await expect(schalter).toBeChecked()
})
