import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

async function rahmenUndRolle(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByLabel('Wie heißt der Prozess?').fill('Versand')
  await page.getByLabel('Was ist das Ergebnis, wenn alles normal läuft?').fill('Ware versendet')
  await page.getByRole('button', { name: 'Weiter: Wer ist beteiligt?' }).click()
  await page.getByRole('button', { name: '+ Rolle' }).click()
  await page.getByLabel('Name der Rolle 1').fill('Lager')
  await page.getByRole('button', { name: 'Weiter: Ablauf beschreiben' }).click()
}

async function aufgabe(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: /Eine Aufgabe/ }).click()
  await page.getByLabel('Was wird getan?').fill(name)
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
}

test('legt einen Abschnitt mit einem Ende darin über den Assistenten an', async ({ page }) => {
  await rahmenUndRolle(page)

  // Abschnitt anlegen: Der Name ist Pflicht, danach steht die Einfügeposition im Abschnitt
  await page.getByRole('button', { name: /Ein Abschnitt mit Namen/ }).click()
  await expect(page.getByRole('button', { name: 'Hinzufügen' })).toBeDisabled()
  await expect(page.getByText(/steht der Abschnitt mit allen Schritten in einer Bahn/)).toBeVisible()
  await page.getByLabel('Wie heißt der Abschnitt?').fill('Ware bereitstellen')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await expect(page.getByText('im Abschnitt „Ware bereitstellen“, am Anfang')).toBeVisible()

  await aufgabe(page, 'Ware kommissionieren')
  await page.getByRole('button', { name: /Eine Entscheidung/ }).click()
  await page.getByLabel('Welche Frage wird entschieden?').fill('Lieferbar?')
  await page.getByLabel('Anteil von „Ja“').fill('90')
  await page.getByLabel('Anteil von „Nein“').fill('10')
  await page.getByLabel('Wie es nach „Nein“ weitergeht').selectOption('ende')
  await page.getByLabel('Ergebnis, wenn „Nein“').fill('nicht lieferbar')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()

  // „Ja“ bleibt leer, „Nein“ endet; dann zurück in den Abschnitt und dahinter weiter
  await page.getByRole('button', { name: /Weiter im Ausgang „Nein“/ }).click()
  await page.getByRole('button', { name: /Weiter nach „Lieferbar\?“/ }).click()
  await expect(page.getByText('im Abschnitt „Ware bereitstellen“, nach „Lieferbar?“')).toBeVisible()
  await page.getByRole('button', { name: /Weiter nach „Ware bereitstellen“/ }).click()
  await expect(page.getByText('im Hauptablauf, nach „Ware bereitstellen“')).toBeVisible()
  await aufgabe(page, 'Ware verpacken')

  // Gliederung: der Abschnitt mit seinen Schritten
  await expect(page.getByRole('button', { name: /Ware bereitstellen\s*Abschnitt/ })).toBeVisible()
  await expect(page.getByText('Schritte im Abschnitt')).toBeVisible()

  // Diagramm: aufgeklappter Teilprozess mit Fehler-Randereignis und Ende „nicht lieferbar“
  await expect(page.locator('.djs-element[data-element-id$="_fehler_1"]')).toHaveCount(1)
  await expect(page.locator('.djs-container svg text', { hasText: 'Ware bereitstellen' }).first()).toBeVisible()

  // Das Formular nennt die Bahn des Abschnitts
  await page.getByRole('button', { name: /Ware bereitstellen\s*Abschnitt/ }).click()
  await expect(page.getByText('Im Diagramm stehen alle Schritte dieses Abschnitts in der Bahn „Lager“')).toBeVisible()

  // BPMN-Export: subProcess, Fehler, Randereignis
  await page.getByText('Projekt', { exact: true }).click()
  const [bpmn] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Als BPMN exportieren' }).click()])
  const xml = await readFile((await bpmn.path())!, 'utf8')
  expect(xml).toMatch(/<bpmn:subProcess id="tp_[a-z0-9]+" name="Ware bereitstellen">/)
  expect(xml).toContain('isExpanded="true"')
  expect(xml).toMatch(/<bpmn:boundaryEvent id="tp_[a-z0-9]+_fehler_1" attachedToRef="tp_[a-z0-9]+" cancelActivity="true">/)
  expect(xml).toContain('<bpmn:error id="Fehler_1" name="nicht lieferbar" errorCode="nicht lieferbar" />')

  // Prüfen: keine Fehler, das Ende im Abschnitt zählt mit
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Prüfen/ }).click()
  await expect(page.getByText(/^keine Fehler/)).toBeVisible()
})

test('fasst Schritte zu einem Abschnitt zusammen und löst ihn wieder auf', async ({ page }) => {
  await rahmenUndRolle(page)
  await aufgabe(page, 'Auftrag erfassen')
  await aufgabe(page, 'Ware kommissionieren')
  await aufgabe(page, 'Ware verpacken')

  await page.getByRole('button', { name: /^Ware kommissionieren/ }).click()
  await page.getByRole('button', { name: 'Ab hier zusammenfassen …' }).click()
  await page.getByLabel('Bis einschließlich').selectOption({ label: 'Ware verpacken' })
  await page.getByLabel('Wie heißt der Abschnitt?').fill('Ware versenden')
  await page.getByRole('button', { name: 'Zusammenfassen', exact: true }).click()

  // Der neue Abschnitt ist ausgewählt und enthält beide Schritte
  await expect(page.getByRole('heading', { name: /Abschnitt bearbeiten/ })).toBeVisible()
  await expect(page.getByLabel('Wie heißt der Abschnitt?')).toHaveValue('Ware versenden')
  await expect(page.getByRole('button', { name: 'Schritte im Abschnitt (2)' })).toBeVisible()
  await expect(page.getByText('Schritte im Abschnitt', { exact: true })).toBeVisible()

  // Auflösen stellt die Schritte zurück in die Folge
  await page.getByRole('button', { name: 'Abschnitt auflösen' }).click()
  await expect(page.getByText('Schritte im Abschnitt', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Ware kommissionieren/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Ware verpacken/ })).toBeVisible()
})
