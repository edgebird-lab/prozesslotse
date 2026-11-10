import { expect, test } from '@playwright/test'

test('legt einen eigenen Prozess vollständig über den Assistenten an', async ({ page }) => {
  await page.goto('/')

  // 1 Rahmen
  await page.getByLabel('Wie heißt der Prozess?').fill('Urlaubsantrag')
  await page.getByLabel('Auslöser in Worten').fill('Mitarbeiter stellt Antrag')
  await page.getByLabel('Was ist das Ergebnis, wenn alles normal läuft?').fill('Urlaub genehmigt')
  await page.getByRole('button', { name: 'Weiter: Wer ist beteiligt?' }).click()

  // 2 Beteiligte
  await page.getByRole('button', { name: '+ Rolle' }).click()
  await page.getByLabel('Name der Rolle 1').fill('Mitarbeiter')
  await page.getByRole('button', { name: '+ Rolle' }).click()
  await page.getByLabel('Name der Rolle 2').fill('Teamleitung')
  await page.getByRole('button', { name: 'Typische Auswahl übernehmen' }).click()
  await expect(page.getByLabel('Name des Systems 5')).toHaveValue('ERP-System')
  await page.getByRole('button', { name: 'Weiter: Ablauf beschreiben' }).click()

  // 3 Ablauf: Aufgabe
  await expect(page.getByText('im Hauptablauf, am Anfang')).toBeVisible()
  await page.getByRole('button', { name: /Eine Aufgabe/ }).click()
  await expect(page.getByRole('button', { name: 'Hinzufügen' })).toBeDisabled()
  await page.getByLabel('Was wird getan?').fill('Antrag ausfüllen')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()

  // Entscheidung mit einem Ausgang, der den Prozess beendet
  await page.getByRole('button', { name: /Eine Entscheidung/ }).click()
  await page.getByLabel('Welche Frage wird entschieden?').fill('Antrag vollständig?')
  await page.getByLabel('Anteil von „Ja“').fill('80')
  await page.getByLabel('Anteil von „Nein“').fill('20')
  await page.getByLabel('Wie es nach „Nein“ weitergeht').selectOption('ende')
  await page.getByLabel('Ergebnis, wenn „Nein“').fill('Antrag zurückgewiesen')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()

  // Der Assistent führt in den ersten Ausgang …
  await expect(page.getByText('im Ausgang „Ja“ von „Antrag vollständig?“, am Anfang')).toBeVisible()
  await page.getByRole('button', { name: /Eine Aufgabe/ }).click()
  await page.getByLabel('Was wird getan?').fill('Antrag genehmigen')
  await page.getByLabel('Wer erledigt das?').selectOption({ label: 'Teamleitung' })
  await page.getByLabel('Wie lange liegt der Vorgang vorher?').fill('2')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()

  // … dann in den zweiten …
  await page.getByRole('button', { name: /Weiter im Ausgang „Nein“/ }).click()
  await page.getByRole('button', { name: /Eine Aufgabe/ }).click()
  await page.getByLabel('Was wird getan?').fill('Antrag zurückgeben')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()

  // … und zurück in den Hauptablauf
  await page.getByRole('button', { name: /Weiter nach „Antrag vollständig\?“/ }).click()
  await expect(page.getByText('im Hauptablauf, nach „Antrag vollständig?“')).toBeVisible()
  await page.getByRole('button', { name: /Ablauf fertig, weiter zum Prüfen/ }).click()

  // 4 Prüfen
  await expect(page.getByText('Durchlaufzeit im Schnitt')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Befunde' })).toBeVisible()
  await expect(page.locator('.djs-container svg text', { hasText: 'Antrag' }).first()).toBeVisible()
  await expect(page.locator('.djs-element[data-element-id$="_ende"]')).toHaveCount(1)

  // Gliederung: Schritt auswählen, umbenennen, rückgängig machen
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Ablauf/ }).click()
  await page.getByRole('button', { name: /Antrag ausfüllen/ }).click()
  await page.getByLabel('Was wird getan?').fill('Urlaubsantrag ausfüllen')
  await page.getByRole('button', { name: 'Fertig' }).click()
  await expect(page.getByRole('button', { name: /Urlaubsantrag ausfüllen/ })).toBeVisible()
  await page.getByRole('button', { name: /Rückgängig/ }).click()
  await expect(page.getByRole('button', { name: /^Antrag ausfüllen/ })).toBeVisible()

  // Der Stand bleibt nach dem Neuladen erhalten
  await page.reload()
  await expect(page.getByRole('button', { name: /Antrag genehmigen/ })).toBeVisible()
})

test('lässt sich per Tastatur bedienen', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Wie heißt der Prozess?').fill('Tastatur')
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Ablauf/ }).click()
  await page.getByRole('button', { name: /Eine Aufgabe/ }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Was wird getan?')).toBeFocused()
  await page.keyboard.type('Post öffnen')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: /Post öffnen/ })).toBeVisible()
  // Strg+Z außerhalb von Eingabefeldern macht rückgängig
  await page.locator('body').click({ position: { x: 5, y: 300 } })
  await page.keyboard.press('Control+z')
  await expect(page.getByRole('button', { name: /Post öffnen/ })).toHaveCount(0)
})

test('verschiebt und löscht Schritte über die Gliederung', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Ablauf/ }).click()
  const titel = page.locator('.gliederung > .sequenz > .sequenz-eintrag > .eintrag .eintrag-titel')
  await expect(titel.nth(0)).toHaveText('Bestellung telefonisch annehmen')
  await page.getByRole('button', { name: /^Bestellung telefonisch annehmen/ }).click()
  await page.getByRole('button', { name: '↓ Nach unten' }).click()
  await expect(titel.nth(0)).toHaveText('Bestellung in Warenwirtschaft erfassen')
  await expect(titel.nth(1)).toHaveText('Bestellung telefonisch annehmen')
  await page.getByRole('button', { name: 'Löschen' }).click()
  await expect(page.getByRole('button', { name: /^Bestellung telefonisch annehmen/ })).toHaveCount(0)
  await expect(titel.nth(0)).toHaveText('Bestellung in Warenwirtschaft erfassen')
})
