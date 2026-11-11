import { readFile } from 'node:fs/promises'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

async function rahmenUndRolle(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByLabel('Wie heißt der Prozess?').fill('Kommissionierung')
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

async function exportiere(page: Page): Promise<string> {
  await page.getByText('Projekt', { exact: true }).click()
  const [bpmn] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Als BPMN exportieren' }).click()])
  return readFile((await bpmn.path())!, 'utf8')
}

test('legt eine Unterbrechung und einen Nebenweg über den Assistenten an', async ({ page }) => {
  test.setTimeout(60_000)
  await rahmenUndRolle(page)
  await aufgabe(page, 'Auftrag erfassen')

  // Aufgabe mit Unterbrechung: Die Bezeichnung ist Pflicht, „normal“ zeigt den Rest
  await page.getByRole('button', { name: /Eine Aufgabe/ }).click()
  await page.getByLabel('Was wird getan?').fill('Ware kommissionieren')
  await expect(page.getByText('Kann während dieses Schritts etwas dazwischenkommen?')).toBeVisible()
  await page.getByRole('button', { name: '+ Unterbrechung' }).click()
  await expect(page.getByRole('button', { name: 'Hinzufügen' })).toBeDisabled()
  await expect(page.getByText('Jede Unterbrechung braucht eine Bezeichnung, z. B. „Kunde storniert“.')).toBeVisible()
  await page.getByLabel('Was kommt dazwischen? (Unterbrechung 1)').fill('Kunde storniert')
  // Absender neu anlegen: ein externer Beteiligter
  await page.getByLabel('Von wem?').selectOption('__neu__')
  await page.getByLabel('Von wem?').fill('Kunde')
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByLabel('Wie oft kommt das vor? (in % der Ausführungen)').fill('10')
  await expect(page.getByText('normal: 90 %')).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Während der Arbeit' })).toBeChecked()
  await page.getByLabel('Wie es nach „Kunde storniert“ weitergeht').selectOption('ende')
  await page.getByLabel('Ergebnis, wenn „Kunde storniert“').fill('storniert')
  // keine schweren Barrieren im Formular
  const axe = await new AxeBuilder({ page }).exclude('.djs-container').analyze()
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
  await page.getByRole('button', { name: 'Hinzufügen' }).click()

  // Danach steht die Einfügeposition im Ausnahmeweg; „fertig“ führt hinter den Schritt
  await expect(page.getByText('im Ausnahmeweg „Kunde storniert“ von „Ware kommissionieren“, am Anfang')).toBeVisible()
  await aufgabe(page, 'Storno buchen')
  await page.getByRole('button', { name: /Weiter nach „Ware kommissionieren“/ }).click()
  await expect(page.getByText('im Hauptablauf, nach „Ware kommissionieren“')).toBeVisible()
  await aufgabe(page, 'Ware versenden')

  // Gliederung: eine Zeile je Unterbrechung, darunter ihr Weg
  await expect(page.getByText('Kunde storniert · 10 % · bricht ab · danach endet „storniert“')).toBeVisible()
  await expect(page.getByRole('button', { name: /Ware kommissionieren\s*Lager · 5 Min\. · 1 Unterbrechung/ })).toBeVisible()

  // Nebenweg an der bestehenden Aufgabe: läuft nebenher, auch öfter als einmal
  await page.getByRole('button', { name: /Ware kommissionieren\s*Lager/ }).click()
  await page.getByRole('button', { name: '+ Unterbrechung' }).click()
  await page.getByLabel('Was kommt dazwischen? (Unterbrechung 2)').fill('Kunde fragt nach')
  await page.locator('label', { hasText: 'Nein, sie läuft weiter' }).last().click()
  await page.getByLabel('Wie oft im Schnitt je Ausführung?').fill('0,5')
  await expect(page.getByText('Kunde fragt nach · nebenher · 0,5-mal')).toBeVisible()
  await page.getByRole('button', { name: 'Schritte im Nebenweg „Kunde fragt nach“ (0)' }).click()
  await expect(page.getByText('im Nebenweg „Kunde fragt nach“ von „Ware kommissionieren“, am Anfang')).toBeVisible()
  await aufgabe(page, 'Auskunft geben')

  // BPMN: Randereignisse an der Aufgabe, unterbrechend und nebenher, Nachricht vom Pool des Kunden
  const xml = await exportiere(page)
  expect(xml).toMatch(/<bpmn:boundaryEvent id="[^"]+" name="Kunde storniert" attachedToRef="[^"]+" cancelActivity="true">/)
  expect(xml).toMatch(/<bpmn:boundaryEvent id="[^"]+" name="Kunde fragt nach" attachedToRef="[^"]+" cancelActivity="false">/)
  expect(xml).toContain('Kommt in 10 % der Ausführungen, meist während der Arbeit; bricht die Arbeit ab; danach endet der Vorgang („storniert“)')
  expect(xml).toMatch(/<bpmn:messageFlow id="[^"]+" sourceRef="Pool_tln_[^"]+" targetRef="ub_[^"]+_rand" \/>/)

  // Prüfen: keine Fehler; das Ergebnis „storniert“ steht bei den Enden
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Prüfen/ }).click()
  await expect(page.getByText(/^keine Fehler/)).toBeVisible()
  await expect(page.getByText('storniert', { exact: true }).first()).toBeVisible()
})

test('fasst eine Frist über mehrere Schritte zu einem Abschnitt zusammen und lässt ihn von vorn beginnen', async ({ page }) => {
  test.setTimeout(60_000)
  await rahmenUndRolle(page)
  await aufgabe(page, 'Ware entnehmen')
  await aufgabe(page, 'Ware verpacken')
  await aufgabe(page, 'Ware verladen')

  // Frist an „Ware entnehmen“, dann „gilt für mehrere Schritte“ bis „Ware verladen“
  await page.getByRole('button', { name: /Ware entnehmen\s*Lager/ }).click()
  await page.getByRole('button', { name: '+ Unterbrechung' }).click()
  await page.getByLabel('Was kommt dazwischen? (Unterbrechung 1)').fill('Frist abgelaufen')
  await page.locator('label', { hasText: 'Eine Frist läuft ab' }).click()
  await expect(page.getByLabel('Nach welcher Frist, gerechnet ab Eingang bei Lager?')).toBeVisible()
  await page.getByLabel('Wie oft wird sie überschritten? (in % der Ausführungen)').fill('20')
  await page.getByRole('button', { name: 'Gilt für mehrere Schritte …' }).click()
  await page.getByLabel('Bis einschließlich').last().selectOption({ label: 'Ware verladen' })
  await page.getByLabel('Wie heißt der Abschnitt?').fill('Ware bereitstellen')
  await page.getByRole('button', { name: 'Zusammenfassen', exact: true }).click()

  // Der neue Abschnitt ist gewählt und trägt die Frist
  await expect(page.getByRole('heading', { name: /Abschnitt bearbeiten/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Ware bereitstellen\s*Abschnitt · 1 Unterbrechung/ })).toBeVisible()
  await expect(page.getByLabel('Nach welcher Frist, gerechnet ab Eingang bei „Ware bereitstellen“?')).toBeVisible()

  // Danach noch einmal von vorn: Ein Rücksprungbereich entsteht um den Abschnitt
  await page.getByLabel('Wie es nach „Frist abgelaufen“ weitergeht').selectOption({ label: '„Ware bereitstellen“ noch einmal von vorn' })
  await expect(page.getByText(/Frist abgelaufen · Frist 1 Arbeitstag · 20 % · bricht ab · danach zurück zu „Ware bereitstellen“/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Bereich mit Rücksprung ab „Ware bereitstellen“/ })).toBeVisible()

  // BPMN: Zeit-Randereignis am Teilprozess
  const xml = await exportiere(page)
  expect(xml).toMatch(/<bpmn:boundaryEvent id="[^"]+" name="Frist abgelaufen" attachedToRef="tp_[^"]+" cancelActivity="true">/)
  expect(xml).toContain('<bpmn:timerEventDefinition')
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Prüfen/ }).click()
  await expect(page.getByText(/^keine Fehler/)).toBeVisible()
})
