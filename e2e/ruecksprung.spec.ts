import { expect, test } from '@playwright/test'

// Der Fall aus der Rückmeldung: Fehler in den Bestelldaten → Kunde fragen →
// je nachdem, was zuerst passiert, zurück zur Erfassung oder Stornierung.
test('bildet die Onlinebestellung mit Rücksprung und Ereignis-Entscheidung über den Assistenten ab', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Wie heißt der Prozess?').fill('Onlinebestellung')
  await page.getByLabel('Was ist das Ergebnis, wenn alles normal läuft?').fill('Ware versendet')
  await page.getByRole('button', { name: 'Weiter: Wer ist beteiligt?' }).click()
  await page.getByRole('button', { name: '+ Rolle' }).click()
  await page.getByLabel('Name der Rolle 1').fill('Kundenservice')
  await page.getByRole('button', { name: 'Typische Auswahl übernehmen' }).click()
  await page.getByRole('button', { name: 'Weiter: Ablauf beschreiben' }).click()

  await page.getByRole('button', { name: /Eine Aufgabe/ }).click()
  await page.getByLabel('Was wird getan?').fill('Bestelldaten erfassen')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()

  await page.getByRole('button', { name: /Eine Entscheidung/ }).click()
  await page.getByLabel('Welche Frage wird entschieden?').fill('Daten korrekt?')
  await page.getByLabel('Anteil von „Ja“').fill('90')
  await page.getByLabel('Anteil von „Nein“').fill('10')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()

  // Ausgang „Ja“ bleibt leer, weiter in den Ausgang „Nein“
  await page.getByRole('button', { name: /Weiter im Ausgang „Nein“/ }).click()
  await page.getByRole('button', { name: /Eine Aufgabe/ }).click()
  await page.getByLabel('Was wird getan?').fill('Kunden um Korrektur bitten')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()

  // Was zuerst passiert: Korrektur → zurück zur Erfassung, Stornierung → Ende
  await page.getByRole('button', { name: /Eine Entscheidung/ }).click()
  await page.getByText('Davon, was zuerst passiert').click()
  await page.getByLabel('Worauf wird gewartet?').fill('Antwort des Kunden?')
  await page.getByLabel('Ereignis 1').fill('Korrektur erhalten')
  await page.getByLabel('Ereignis 2').fill('Stornierung erhalten')
  await page.getByLabel('Anteil von „Korrektur erhalten“').fill('70')
  await page.getByLabel('Anteil von „Stornierung erhalten“').fill('30')
  await page.getByLabel('Wie es nach „Korrektur erhalten“ weitergeht').selectOption({ label: 'zurück zu „Bestelldaten erfassen“' })
  await page.getByLabel('Wie es nach „Stornierung erhalten“ weitergeht').selectOption('ende')
  await page.getByLabel('Ergebnis, wenn „Stornierung erhalten“').fill('Bestellung storniert')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()

  // Gliederung zeigt Rücksprung und Bereich
  await expect(page.getByText('↩ zurück zu „Bestelldaten erfassen“')).toBeVisible()
  await expect(page.getByRole('button', { name: /Bereich mit Rücksprung ab „Bestelldaten erfassen“/ })).toBeVisible()

  // Diagramm: Ereignis-Gateway mit zwei Ereignissen und eine Zusammenführung vor der Erfassung
  await expect(page.locator('.djs-element[data-element-id$="_ereignis"]')).toHaveCount(2)
  await expect(page.locator('.djs-element[data-element-id$="_ein"]')).toHaveCount(1)

  // Prüfen: keine Fehler, der Rücksprung zählt mit
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Prüfen/ }).click()
  await expect(page.getByText(/^keine Fehler/)).toBeVisible()
  await expect(page.getByText('Durchlaufzeit im Schnitt')).toBeVisible()

  // Rücksprung wieder entfernen: der Bereich löst sich auf
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Ablauf/ }).click()
  await page.getByRole('button', { name: /^Antwort des Kunden\?/ }).click()
  await page.getByLabel('Wie es nach „Korrektur erhalten“ weitergeht').selectOption('weiter')
  await expect(page.getByRole('button', { name: /Bereich mit Rücksprung/ })).toHaveCount(0)
})

test('lädt das Beispiel Onlinebestellung ohne Fehler', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Beispiel „Onlinebestellung“/ }).click()
  await expect(page.getByRole('button', { name: /Bereich mit Rücksprung ab „Bestelldaten erfassen“/ })).toBeVisible()
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Prüfen/ }).click()
  await expect(page.getByText(/^keine Fehler/)).toBeVisible()
  await expect(page.getByText(/Warten auf „7 Tage ohne Antwort“/).first()).toBeVisible()
})
