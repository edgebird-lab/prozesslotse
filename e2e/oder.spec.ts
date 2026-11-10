import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('legt eine ODER-Verzweigung über den Assistenten an', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Wie heißt der Prozess?').fill('Kreditantrag')
  await page.getByRole('button', { name: 'Weiter: Wer ist beteiligt?' }).click()
  await page.getByRole('button', { name: '+ Rolle' }).click()
  await page.getByLabel('Name der Rolle 1').fill('Sachbearbeitung')
  await page.getByRole('button', { name: 'Weiter: Ablauf beschreiben' }).click()

  await page.getByRole('button', { name: /Mehrere Wege möglich/ }).click()
  await expect(page.getByRole('button', { name: 'Hinzufügen' })).toBeDisabled()
  await page.getByLabel('Worum geht es?').fill('Welche Unterlagen fehlen?')
  await page.getByLabel('Weg 1', { exact: true }).fill('Gehaltsnachweis')
  await page.getByLabel('Anteil von „Gehaltsnachweis“').fill('30')
  await page.getByLabel('Weg 2', { exact: true }).fill('Ausweis')
  await page.getByLabel('Anteil von „Ausweis“').fill('20')
  // 70 % · 80 % der Fälle: keiner der beiden Wege
  await expect(page.getByText('kommt in 56 % der Fälle vor')).toBeVisible()
  await page.getByLabel('Wie heißt dieser Weg?').fill('Nichts fehlt')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()

  // Der Assistent führt nacheinander durch die Wege
  await expect(page.getByText('im Weg „Gehaltsnachweis“ von „Welche Unterlagen fehlen?“, am Anfang')).toBeVisible()
  await page.getByRole('button', { name: /Eine Aufgabe/ }).click()
  await page.getByLabel('Was wird getan?').fill('Gehaltsnachweis anfordern')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await page.getByRole('button', { name: /Weiter im Weg „Ausweis“/ }).click()
  await page.getByRole('button', { name: /Eine Aufgabe/ }).click()
  await page.getByLabel('Was wird getan?').fill('Ausweiskopie anfordern')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await page.getByRole('button', { name: /Weiter im Weg „Nichts fehlt“/ }).click()
  await page.getByRole('button', { name: /Weiter nach „Welche Unterlagen fehlen\?“/ }).click()
  await expect(page.getByText('im Hauptablauf, nach „Welche Unterlagen fehlen?“')).toBeVisible()

  // Im Diagramm: Verzweigung und Zusammenführung
  await expect(page.locator('.djs-element[data-element-id$="_auf"]')).toHaveCount(1)
  await expect(page.locator('.djs-element[data-element-id$="_zu"]')).toHaveCount(1)

  // BPMN-Export enthält das inklusive Gateway mit Standardfluss
  await page.getByText('Projekt', { exact: true }).click()
  const [bpmn] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Als BPMN exportieren' }).click()])
  const xml = await readFile((await bpmn.path())!, 'utf8')
  expect(xml).toMatch(/<bpmn:inclusiveGateway id="[^"]+_auf" name="Welche Unterlagen fehlen\?" gatewayDirection="Diverging" default="Fluss_\d+">/)

  // Prüfen: keine Fehler im Modell
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Prüfen/ }).click()
  await expect(page.getByText(/^keine Fehler/)).toBeVisible()
})
