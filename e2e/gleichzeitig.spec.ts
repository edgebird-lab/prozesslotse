import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

async function rahmenUndRolle(page: Page, name: string, ergebnis: string, rolle: string): Promise<void> {
  await page.goto('/')
  await page.getByLabel('Wie heißt der Prozess?').fill(name)
  await page.getByLabel('Was ist das Ergebnis, wenn alles normal läuft?').fill(ergebnis)
  await page.getByRole('button', { name: 'Weiter: Wer ist beteiligt?' }).click()
  await page.getByRole('button', { name: '+ Rolle' }).click()
  await page.getByLabel('Name der Rolle 1').fill(rolle)
  await page.getByRole('button', { name: 'Weiter: Ablauf beschreiben' }).click()
}

async function aufgabe(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: /Eine Aufgabe/ }).click()
  await page.getByLabel('Was wird getan?').fill(name)
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
}

async function exportiereBpmn(page: Page): Promise<string> {
  await page.getByText('Projekt', { exact: true }).click()
  const [bpmn] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Als BPMN exportieren' }).click()])
  return readFile((await bpmn.path())!, 'utf8')
}

test('legt „weiter beim ersten“ über den Assistenten an', async ({ page }) => {
  await rahmenUndRolle(page, 'Angebote einholen', 'Bestellung ausgelöst', 'Einkauf')
  await aufgabe(page, 'Bedarf erfassen')

  // Ein Knopf für alle Arten; Vorgabe: weiter, wenn alle fertig sind, zur selben Zeit
  await page.getByRole('button', { name: /Mehrere Dinge unabhängig voneinander/ }).click()
  await expect(page.getByRole('heading', { name: 'Neu: Gleichzeitig' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Wenn alle fertig sind' })).toBeChecked()
  await expect(page.getByRole('radio', { name: /Zur selben Zeit/ })).toBeChecked()
  await expect(page.getByText('Hängt es davon ab, was von außen zuerst passiert (Antwort, Frist)? Dann ist es eine Entscheidung „was zuerst passiert“.')).toBeVisible()

  // „Sobald eins fertig ist“: Titel und Lernhinweis wechseln, die zweite Frage entfällt, der Satz zur Bahn erscheint
  await page.locator('label', { hasText: 'Sobald eins fertig ist' }).click()
  await expect(page.getByRole('heading', { name: 'Neu: Weiter beim ersten' })).toBeVisible()
  await expect(page.getByText('Wer erledigt die Zweige?')).toHaveCount(0)
  await expect(page.getByText(/Im Diagramm stehen alle Zweige in einem Rahmen in einer Bahn/)).toBeVisible()
  await page.getByRole('button', { name: 'Hinzufügen' }).click()

  // Zweig für Zweig, dann dahinter weiter
  await expect(page.getByText('in Zweig 1 von „Weiter beim ersten“, am Anfang')).toBeVisible()
  await aufgabe(page, 'Angebot A einholen')
  await page.getByRole('button', { name: /Weiter in Zweig 2 von „Weiter beim ersten“/ }).click()
  await aufgabe(page, 'Angebot B einholen')
  await page.getByRole('button', { name: /Weiter nach „Weiter beim ersten \(2 Zweige\)“/ }).click()
  await expect(page.getByText('im Hauptablauf, nach „Weiter beim ersten (2 Zweige)“')).toBeVisible()
  await aufgabe(page, 'Bestellung auslösen')

  // Gliederung und Formular: Beide Zweige dauern gleich lang, bei Gleichstand gewinnt der erste
  const eintrag = page.getByRole('button', { name: /Weiter beim ersten \(2 Zweige\)\s*die übrigen werden abgebrochen/ })
  await expect(eintrag).toBeVisible()
  await eintrag.click()
  await expect(page.getByRole('heading', { name: /Weiter beim ersten bearbeiten/ })).toBeVisible()
  await expect(page.getByText('Im Diagramm stehen alle Zweige in einem Rahmen in der Bahn „Einkauf“; Schritte anderer Rollen tragen die Rolle in Klammern.')).toBeVisible()
  await expect(page.getByText('1 Schritt · zuerst fertig in 100 % der Fälle')).toBeVisible()

  // Diagramm: Rahmen mit Namen und zwei Terminierungen
  await expect(page.locator('.djs-container svg text', { hasText: 'Weiter beim ersten' }).first()).toBeVisible()

  // BPMN-Export: Teilprozess, paralleles Gateway, Terminierung je Zweig
  const xml = await exportiereBpmn(page)
  expect(xml).toMatch(/<bpmn:subProcess id="par_[a-z0-9]+" name="Weiter beim ersten">/)
  expect(xml.match(/<bpmn:terminateEventDefinition/g)).toHaveLength(2)

  // Prüfen: keine Fehler; ohne Streuung zeigt die Rechnung keinen Zeitgewinn
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Prüfen/ }).click()
  await expect(page.getByText(/^keine Fehler/)).toBeVisible()
  await expect(page.getByText('Kein Zeitgewinn in der Rechnung')).toBeVisible()
})

test('legt „in beliebiger Reihenfolge“ mit einem Ende in einem Zweig an', async ({ page }) => {
  await rahmenUndRolle(page, 'Antrag bearbeiten', 'Bescheid verschickt', 'Sachbearbeitung')
  await aufgabe(page, 'Antrag annehmen')

  // „Wer erledigt die Zweige?“ – eine Person nacheinander
  await page.getByRole('button', { name: /Mehrere Dinge unabhängig voneinander/ }).click()
  await page.locator('label', { hasText: 'Eine Person nacheinander, Reihenfolge egal' }).click()
  await expect(page.getByRole('heading', { name: 'Neu: In beliebiger Reihenfolge' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Wenn alle fertig sind' })).toBeChecked()
  await expect(page.getByText(/Gerechnet wird in der Reihenfolge der Liste\./)).toBeVisible()
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await expect(page.getByText('in Zweig 1 von „In beliebiger Reihenfolge“, am Anfang')).toBeVisible()

  // Zweig 1: Prüfen, und wenn unvollständig, endet der Vorgang (in diesen Zweigen erlaubt)
  await aufgabe(page, 'Unterlagen prüfen')
  await page.getByRole('button', { name: /Eine Entscheidung/ }).click()
  await page.getByLabel('Welche Frage wird entschieden?').fill('Vollständig?')
  await page.getByLabel('Anteil von „Ja“').fill('80')
  await page.getByLabel('Anteil von „Nein“').fill('20')
  await page.getByLabel('Wie es nach „Nein“ weitergeht').selectOption('ende')
  await page.getByLabel('Ergebnis, wenn „Nein“').fill('abgelehnt')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await page.getByRole('button', { name: /Weiter im Ausgang „Nein“/ }).click()
  await page.getByRole('button', { name: /Weiter nach „Vollständig\?“/ }).click()
  await page.getByRole('button', { name: /Weiter in Zweig 2 von „In beliebiger Reihenfolge“/ }).click()
  await aufgabe(page, 'Akte anlegen')
  await page.getByRole('button', { name: /Weiter nach „In beliebiger Reihenfolge \(2 Zweige\)“/ }).click()
  await aufgabe(page, 'Bescheid schicken')
  await expect(page.getByRole('button', { name: /In beliebiger Reihenfolge \(2 Zweige\)\s*eine Person, Reihenfolge egal/ })).toBeVisible()

  // Diagramm: Ad-hoc-Rahmen, der mehrschrittige Zweig als „Zweig 1“, das Fehler-Randereignis am Rahmen
  await expect(page.locator('.djs-container svg text', { hasText: 'Zweig 1' }).first()).toBeVisible()
  await expect(page.locator('.djs-element[data-element-id$="_fehler_1"]')).toHaveCount(1)

  // BPMN-Export: Ad-hoc-Teilprozess, eine Aktivität nach der anderen, fertig, wenn alle erledigt sind
  const xml = await exportiereBpmn(page)
  expect(xml).toMatch(/<bpmn:adHocSubProcess id="par_[a-z0-9]+" name="In beliebiger Reihenfolge" ordering="Sequential">/)
  expect(xml).toContain('<bpmn:completionCondition xsi:type="bpmn:tFormalExpression">alle Zweige erledigt</bpmn:completionCondition>')
  expect(xml).toMatch(/<bpmn:subProcess id="seq_[a-z0-9]+" name="Zweig 1">/)

  // Prüfen: keine Fehler; die Reihenfolge der Liste zählt für die Rechnung
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Prüfen/ }).click()
  await expect(page.getByText(/^keine Fehler/)).toBeVisible()
  await expect(page.getByText('Reihenfolge zählt für die Rechnung')).toBeVisible()
})
