import { expect, test, type Locator, type Page } from '@playwright/test'

// Browsertests zur Durchsicht vom 11.11.2026, Paket „Ablauftext und Kapiteltexte“; Uhr fest auf den 11.11.2026

const leiste = (page: Page) => page.getByRole('navigation', { name: 'Teilschritte' })
const teil = (page: Page, name: string) => leiste(page).getByRole('button', { name: new RegExp(`^${name}`) })
const schritt = (page: Page, name: string) => page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: new RegExp(name) })
const vorschau = (page: Page) => page.locator('#dokument-vorschau')

/** Klappt eine Karte auf, falls sie zu ist (Karten ohne Fehler oder Warnung starten zugeklappt) */
async function aufklappen(karte: Locator) {
  await expect(karte.getByRole('button', { name: /^Angaben (bearbeiten|zuklappen)$/ })).toBeVisible()
  const knopf = karte.getByRole('button', { name: 'Angaben bearbeiten' })
  if (await knopf.isVisible()) await knopf.click()
}

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

test('Ersetzendes Scannen: offene Vernichtung und eigene Verfahrensdokumentation werden erfragt (recht-2, recht-9)', async ({ page }) => {
  await start(page)
  await teil(page, 'Belege und Daten').click()
  const karte = page.getByRole('region', { name: 'Lieferschein' })
  await aufklappen(karte)
  await karte.locator('label', { hasText: 'Als Scan des Papiers' }).click()
  const vernichtet = karte.getByRole('group', { name: 'Wird das Papier nach dem Scannen vernichtet?' })
  await expect(vernichtet.getByRole('radio', { name: 'Weiß nicht' })).toBeChecked()
  const doku = karte.getByRole('group', { name: 'Gibt es eine eigene Verfahrensdokumentation zum ersetzenden Scannen?' })
  await expect(doku).toHaveCount(0)

  // Vernichtung offen: Hinweis statt „Entfällt“
  await teil(page, 'Lücken').click()
  await expect(page.getByRole('button', { name: 'Beheben: Vernichtung nach dem Scannen offen' })).toBeVisible()
  await teil(page, 'Dokumente').click()
  await expect(vorschau(page).getByText('Ob die Papierbelege von „Lieferschein“ nach dem Scannen vernichtet werden, ist offen.')).toBeVisible()
  await expect(vorschau(page).getByText(/^Entfällt: Papierunterlagen/)).toHaveCount(0)

  // Papier wird vernichtet: Frage nach der Verfahrensdokumentation, ohne Antwort eine Warnung
  await teil(page, 'Belege und Daten').click()
  await aufklappen(karte)
  await vernichtet.locator('label', { hasText: 'Ja' }).click()
  await expect(doku.getByRole('radio', { name: 'Weiß nicht' })).toBeChecked()
  await teil(page, 'Lücken').click()
  await expect(page.getByRole('button', { name: 'Beheben: Verfahrensdokumentation zum Scannen ungeklärt' })).toBeVisible()
  await teil(page, 'Dokumente').click()
  await expect(vorschau(page).getByText('Für „Lieferschein“ gilt das ersetzende Scannen. Dafür ist eine eigene Verfahrensdokumentation nötig (GoBD Rz. 136); offen.')).toBeVisible()

  // Es gibt sie: Verweis in Kapitel 5, Eintrag mit Stand in Kapitel 6
  await teil(page, 'Belege und Daten').click()
  await aufklappen(karte)
  await doku.locator('label', { hasText: 'Ja' }).click()
  await karte.getByLabel('Stand der Verfahrensdokumentation zum Scannen').fill('2026-03-01')
  await teil(page, 'Dokumente').click()
  await expect(vorschau(page).getByText('Für „Lieferschein“ gilt das ersetzende Scannen. Es ist in einer eigenen Verfahrensdokumentation beschrieben (Kapitel 6).')).toBeVisible()
  await expect(vorschau(page).getByText('Verfahrensdokumentation zum ersetzenden Scannen, Stand 01.03.2026')).toBeVisible()
})
