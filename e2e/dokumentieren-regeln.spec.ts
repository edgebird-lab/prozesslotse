import { expect, test, type Page } from '@playwright/test'

// Browsertests zu den Funden des Pakets „Regeln und Lückenprüfung“, Uhr fest auf den 11.11.2026

const leiste = (page: Page) => page.getByRole('navigation', { name: 'Teilschritte' })
const teil = (page: Page, name: string) => leiste(page).getByRole('button', { name: new RegExp(`^${name}`) })
const schritt = (page: Page, name: string) => page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: new RegExp(name) })

async function start(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00'))
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  await schritt(page, 'Dokumentieren').click()
}

test('Ablage im Drittland: Warnung bis zur Bewilligung des Finanzamts, Kapitel 3.1 nennt sie (recht-1)', async ({ page }) => {
  await start(page)
  await teil(page, 'Systeme und Dienstleister').click()
  const wawi = page.locator('#ziel-system-med_erp')
  await expect(wawi.getByLabel('Bewilligung des Finanzamts vom')).toHaveCount(0)
  await wawi.getByLabel('Wo werden die Daten verarbeitet?').selectOption({ label: 'Anderes Land (Drittland)' })
  await wawi.getByLabel('Land', { exact: true }).fill('USA')
  await wawi.getByLabel('Garantie').selectOption({ label: 'Standardvertragsklauseln (Art. 46)' })

  await teil(page, 'Lücken').click()
  await expect(page.getByText('keine Fehler · 5 Warnungen · 3 Hinweise')).toBeVisible()
  await page.getByRole('button', { name: 'Beheben: Aufbewahrung im Drittland ohne Bewilligung' }).click()
  await expect(wawi).toBeFocused()
  await wawi.getByLabel('Bewilligung des Finanzamts vom').fill('2026-02-01')

  await teil(page, 'Lücken').click()
  await expect(page.getByText('keine Fehler · 4 Warnungen · 3 Hinweise')).toBeVisible()
  await teil(page, 'Dokumente').click()
  await expect(page.getByRole('tabpanel')).toContainText('„Warenwirtschaft“ bewahrt „Bestellung“ und „Ausgangsrechnung“ im Drittland (USA) auf. Bewilligung des Finanzamts nach § 146 Abs. 2b AO vom 01.02.2026.')
})
