import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

async function aufgabe(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: /Eine Aufgabe/ }).click()
  await page.getByLabel('Was wird getan?').fill(name)
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
}

test('beendet den Prozess in einem Zweig von „Gleichzeitig“ und bricht den anderen Zweig ab', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Wie heißt der Prozess?').fill('Antrag prüfen')
  await page.getByLabel('Was ist das Ergebnis, wenn alles normal läuft?').fill('Bescheid verschickt')
  await page.getByRole('button', { name: 'Weiter: Wer ist beteiligt?' }).click()
  await page.getByRole('button', { name: '+ Rolle' }).click()
  await page.getByLabel('Name der Rolle 1').fill('Sachbearbeitung')
  await page.getByRole('button', { name: 'Weiter: Ablauf beschreiben' }).click()

  await page.getByRole('button', { name: /Mehrere Dinge unabhängig voneinander/ }).click()
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await expect(page.getByText('in Zweig 1 von „Gleichzeitig“, am Anfang')).toBeVisible()
  await aufgabe(page, 'Unterlagen prüfen')

  // In einem Zweig von „Gleichzeitig“ darf ein Ausgang den Prozess beenden; der Text sagt, dass der Rest abgebrochen wird
  await page.getByRole('button', { name: /Eine Entscheidung/ }).click()
  await page.getByLabel('Welche Frage wird entschieden?').fill('Vollständig?')
  await page.getByLabel('Anteil von „Ja“').fill('80')
  await page.getByLabel('Anteil von „Nein“').fill('20')
  const danach = page.getByLabel('Wie es nach „Nein“ weitergeht')
  await expect(danach.locator('option[value="ende"]')).toHaveText('Prozess endet sofort; was gleichzeitig läuft, wird abgebrochen')
  await danach.selectOption('ende')
  await page.getByLabel('Ergebnis, wenn „Nein“').fill('abgelehnt')
  await expect(page.getByRole('complementary', { name: 'Lernhinweis: Prozess endet sofort' })).toBeVisible()
  await page.getByRole('button', { name: 'Hinzufügen' }).click()

  await page.getByRole('button', { name: /Weiter im Ausgang „Nein“/ }).click()
  await page.getByRole('button', { name: /Weiter nach „Vollständig\?“/ }).click()
  await page.getByRole('button', { name: /Weiter in Zweig 2 von „Gleichzeitig“/ }).click()
  await aufgabe(page, 'Bonität prüfen')
  await page.getByRole('button', { name: /Weiter nach „Gleichzeitig \(2 Zweige\)“/ }).click()
  await aufgabe(page, 'Bescheid schreiben')

  // Gliederung: „endet sofort“
  await expect(page.getByText(/endet sofort: „abgelehnt“/)).toBeVisible()

  // BPMN-Export: Terminierung mit dem Ergebnis auf der Prozessebene, die Zusammenführung bleibt
  await page.getByText('Projekt', { exact: true }).click()
  const [bpmn] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Als BPMN exportieren' }).click()])
  const xml = await readFile((await bpmn.path())!, 'utf8')
  expect(xml).toMatch(/<bpmn:endEvent id="[^"]+" name="abgelehnt">(?:(?!<\/bpmn:endEvent>)[\s\S])*<bpmn:terminateEventDefinition/)
  expect(xml).toMatch(/<bpmn:parallelGateway id="[^"]+_zu" gatewayDirection="Converging">/)

  // Prüfen: keine Fehler; 20 % enden vorzeitig mit „abgelehnt“
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Prüfen/ }).click()
  await expect(page.getByText(/^keine Fehler/)).toBeVisible()
  const ergebnisse = page.getByRole('region', { name: 'Durchlaufzeit je Ergebnis' })
  await expect(ergebnisse.getByRole('row', { name: /abgelehnt \(vorzeitig\)\s*20 %/ })).toBeVisible()
  await expect(ergebnisse.getByRole('row', { name: /Bescheid verschickt\s*80 %/ })).toBeVisible()
})
