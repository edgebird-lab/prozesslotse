import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('verbindet Schritte über Nachrichten mit dem Kunden-Pool', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Wie heißt der Prozess?').fill('Reklamation')
  await page.getByRole('button', { name: 'Weiter: Wer ist beteiligt?' }).click()
  await page.getByRole('button', { name: '+ Rolle' }).click()
  await page.getByLabel('Name der Rolle 1').fill('Kundendienst')
  await page.getByRole('button', { name: 'Kunde hinzufügen' }).click()
  await expect(page.getByLabel('Name des externen Beteiligten 1')).toHaveValue('Kunde')
  await page.getByRole('button', { name: 'Weiter: Ablauf beschreiben' }).click()

  await page.getByRole('button', { name: /Eine Aufgabe/ }).click()
  await page.getByLabel('Was wird getan?').fill('Reklamation prüfen')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await page.getByRole('button', { name: /Eine Aufgabe/ }).click()
  await page.getByLabel('Was wird getan?').fill('Gutschrift senden')
  await page.getByLabel('Schickt der Schritt etwas an jemand Externen?').selectOption({ label: 'Kunde' })
  await page.getByRole('button', { name: 'Hinzufügen' }).click()

  // Im Diagramm: Pool „Kunde“ und ein Nachrichtenfluss
  await expect(page.locator('.djs-element[data-element-id^="Pool_tln_"]')).toHaveCount(1)
  await expect(page.locator('.djs-element[data-element-id^="Nachricht_"]')).toHaveCount(1)

  // BPMN-Export: Kollaboration mit Pool und Nachrichtenfluss
  await page.getByText('Projekt', { exact: true }).click()
  const [bpmn] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Als BPMN exportieren' }).click()])
  const xml = await readFile((await bpmn.path())!, 'utf8')
  expect(xml).toMatch(/<bpmn:participant id="Pool_tln_[a-z0-9]+" name="Kunde" \/>/)
  expect(xml).toMatch(/<bpmn:messageFlow id="Nachricht_1" sourceRef="auf_[a-z0-9]+" targetRef="Pool_tln_[a-z0-9]+" \/>/)

  // Prüfen zeigt die Kontakte mit dem Kunden
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Prüfen/ }).click()
  await expect(page.getByText('Kontakte mit „Kunde“')).toBeVisible()
})
