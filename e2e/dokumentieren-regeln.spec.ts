import { expect, test, type Page } from '@playwright/test'

// Browsertests zu den Funden des Pakets „Regeln und Lückenprüfung“, Uhr fest auf den 11.11.2026

const TEILSCHRITTE = ['Unternehmen', 'Belege und Daten', 'Systeme und Dienstleister', 'Aufbewahrung und Löschung', 'Kontrollen', 'Schutzmaßnahmen', 'Lücken', 'Dokumente']

const leiste = (page: Page) => page.getByRole('navigation', { name: 'Teilschritte' })
const teil = (page: Page, name: string) => leiste(page).getByRole('button', { name: new RegExp(`^${name}`) })
const schritt = (page: Page, name: string) => page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: new RegExp(name) })
/** Name eines Teilschritts samt Zustand für Screenreader, z. B. „Kontrollen, keine offenen Punkte“ */
const zustand = (name: string, was: string) => new RegExp(`^${name}\\s*, ${was}$`)

async function start(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00'))
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  await schritt(page, 'Dokumentieren').click()
}

test('Teilschritte ohne Angaben bleiben neutral; „Beheben“ bei fehlenden Unterlagen führt zum Formular (bedienung-1)', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00'))
  await page.goto('/')
  await schritt(page, 'Ablauf').click()
  await page.getByRole('button', { name: /Eine Aufgabe/ }).click()
  await page.getByLabel('Was wird getan?').fill('Rechnung schreiben')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await schritt(page, 'Dokumentieren').click()

  for (const name of ['Systeme und Dienstleister', 'Aufbewahrung und Löschung', 'Kontrollen', 'Dokumente']) await expect(teil(page, name)).toHaveAccessibleName(zustand(name, 'noch nichts eingetragen'))
  await expect(teil(page, 'Belege und Daten')).toHaveAccessibleName(zustand('Belege und Daten', '1 offener Punkt'))
  await expect(leiste(page).locator('.status-gut')).toHaveCount(0)
  await expect(leiste(page).locator('.status-leer')).toHaveCount(4)

  await teil(page, 'Lücken').click()
  await expect(page.getByText('Für den Ablauf ist noch keine Unterlage angelegt.')).toBeVisible()
  await page.getByRole('button', { name: 'Beheben: Keine Unterlagen angelegt' }).click()
  await expect(teil(page, 'Belege und Daten')).toHaveAttribute('aria-current', 'step')
  const name = page.getByLabel('Name, z. B. „Ausgangsrechnung“')
  await expect(name).toBeFocused()
  await name.fill('Rechnung')
  await page.getByRole('button', { name: '+ Unterlage anlegen' }).click()
  await teil(page, 'Lücken').click()
  await expect(page.getByText('Keine Unterlagen angelegt')).toHaveCount(0)
})

test('ein Häkchen heißt „keine offenen Punkte“; ohne Befunde verspricht „Lücken“ keine Vollständigkeit (bedienung-1)', async ({ page }) => {
  await start(page)
  await expect(teil(page, 'Unternehmen')).toHaveAccessibleName(zustand('Unternehmen', 'keine offenen Punkte'))
  await expect(teil(page, 'Dokumente')).toHaveAccessibleName(zustand('Dokumente', 'noch nichts eingetragen'))

  // die sieben Befunde des Beispiels beheben
  await teil(page, 'Belege und Daten').click()
  await page.locator('#ziel-datenobjekt-dob_bestellnotiz').getByText('Nicht aufbewahrungspflichtig').click()
  await teil(page, 'Aufbewahrung und Löschung').click()
  for (const unterlage of ['Bestellnotiz', 'Tourenliste']) await page.getByRole('group', { name: unterlage }).getByRole('button', { name: 'Löschfrist festlegen' }).click()
  await teil(page, 'Systeme und Dienstleister').click()
  const wawi = page.locator('#ziel-system-med_erp')
  await wawi.getByLabel('Version', { exact: true }).fill('7.1')
  await wawi.getByLabel('Im Einsatz seit').fill('2024-01-01')
  await wawi.getByRole('group', { name: 'Gibt es einen Vertrag zur Auftragsverarbeitung?' }).getByText('Ja', { exact: true }).click()
  await wawi.getByLabel('Vertrag vom').fill('2025-01-15')
  await teil(page, 'Kontrollen').click()
  await page.locator('#ziel-kontrolle-auf_kontrollieren').getByText('Abgezeichnet mit Datum und Kürzel').click()
  await teil(page, 'Schutzmaßnahmen').click()
  await page.getByRole('checkbox', { name: 'Jährliche Überprüfung der Maßnahmen und dieser Dokumentation' }).check()
  await teil(page, 'Dokumente').click()
  await page.getByRole('button', { name: 'Version freigeben …' }).click()
  const dialog = page.getByRole('dialog', { name: 'Version freigeben' })
  await dialog.getByRole('button', { name: 'Freigeben', exact: true }).click()
  await expect(dialog).toBeHidden()

  await teil(page, 'Lücken').click()
  await expect(page.getByText('Keine Lücken gefunden. Die Prüfung findet keine fehlenden oder widersprüchlichen Angaben; ob sie stimmen, prüft die App nicht.')).toBeVisible()
  await expect(page.getByText('vollständig und widerspruchsfrei')).toHaveCount(0)
  for (const name of TEILSCHRITTE) await expect(teil(page, name)).toHaveAccessibleName(zustand(name, 'keine offenen Punkte'))
})

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
