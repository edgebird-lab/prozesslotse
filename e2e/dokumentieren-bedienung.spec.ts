import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Browsertests zu Bedienung, Barrierefreiheit und Sprache im Schritt „Dokumentieren“, Uhr fest auf den 11.11.2026

const leiste = (page: Page) => page.getByRole('navigation', { name: 'Teilschritte' })

const teil = (page: Page, name: string) => leiste(page).getByRole('button', { name: new RegExp(`^${name}`) })

const schritt = (page: Page, name: string) => page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: new RegExp(name) })

async function start(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00'))
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  await schritt(page, 'Dokumentieren').click()
}

async function freigeben(page: Page) {
  await teil(page, 'Dokumente').click()
  await page.getByRole('button', { name: 'Version freigeben …' }).click()
  const dialog = page.getByRole('dialog', { name: 'Version freigeben' })
  await dialog.getByRole('button', { name: 'Freigeben', exact: true }).click()
  await expect(dialog).toBeHidden()
}

test('geänderte Kapitel stehen ausgeschrieben statt als „VD“ und „VVT“', async ({ page }) => {
  await start(page)
  await freigeben(page)
  await schritt(page, 'Ablauf').click()
  await page.getByRole('button', { name: /Rechnung freigeben/ }).first().click()
  await page.getByLabel('Was wird getan?').fill('Rechnung prüfen und freigeben')
  await schritt(page, 'Dokumentieren').click()
  await teil(page, 'Lücken').click()
  await expect(page.getByText('Seit Version 1.0 geändert: Verfahrensdokumentation 3.2, 3.3 und 4.')).toBeVisible()
  await teil(page, 'Dokumente').click()
  await expect(page.locator('.status-zeile')).toContainText('geändert seit der Freigabe: Verfahrensdokumentation 3.2, 3.3 und 4')
  await page.getByRole('button', { name: 'Version freigeben …' }).click()
  const dialog = page.getByRole('dialog', { name: 'Version freigeben' })
  await expect(dialog.getByLabel('Inhalt der Änderung')).toHaveValue('Geändert: Verfahrensdokumentation 3.2, 3.3 und 4')
  await dialog.getByLabel('Gültig ab').fill('2026-11-12')
  await dialog.getByRole('button', { name: 'Freigeben', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('region', { name: 'Versionen' }).getByRole('row').nth(2)).toContainText('Verfahrensdokumentation 3.2, 3.3 und 4')
  // Kapitel 7 nennt die eigenen Kapitel ohne Dokumentnamen
  await expect(page.getByRole('tabpanel').getByRole('row', { name: /^2\.0/ })).toContainText('3.2, 3.3 und 4')
  await expect(page.locator('#inhalt')).not.toContainText('VD 3')
})

test('Empfänger: keine Vorschläge, die schon Betroffene sind; Vorschläge mit Erklärung', async ({ page }) => {
  await start(page)
  await teil(page, 'Belege und Daten').click()
  const karte = page.locator('#ziel-datenobjekt-dob_bestellnotiz')
  await expect(karte.getByText('Wer nur seine eigenen Daten bekommt, etwa der Kunde seine Rechnung, ist kein Empfänger.')).toBeVisible()
  await expect(karte.getByRole('button', { name: '+ Kunde' })).toHaveCount(0)
  // Sind Kunden nicht betroffen, steht der Kunde als Vorschlag mit Erklärung bereit
  await karte.getByRole('group', { name: 'Wer ist betroffen?' }).getByRole('checkbox', { name: 'Kunden' }).uncheck()
  const vorschlaege = karte.getByRole('group', { name: 'Externe aus dem Ablauf – nur, wenn sie Daten anderer Personen bekommen:' })
  await expect(vorschlaege.getByRole('button', { name: '+ Kunde' })).toBeVisible()
})

test('„Schutzmaßnahmen“ ohne Sprung in der Überschriftenfolge', async ({ page }) => {
  await start(page)
  await teil(page, 'Schutzmaßnahmen').click()
  const ergebnis = await new AxeBuilder({ page }).exclude('.djs-container').withRules(['heading-order']).analyze()
  expect(ergebnis.violations.map((v) => v.nodes.map((n) => n.target.join(' ')).join(', '))).toEqual([])
})

test('Texte erklären Fachbegriffe und Abkürzungen', async ({ page }) => {
  await start(page)
  await expect(page.locator('.dokumentieren > p.leise').first()).toHaveText(
    'Aus dem Ablauf entstehen zwei Dokumente: die Verfahrensdokumentation, die das Finanzamt nach den GoBD (Regeln für die elektronische Buchführung) erwartet, und das Verzeichnis von Verarbeitungstätigkeiten nach Art. 30 DSGVO. Beide beschreiben den Ist-Prozess.',
  )
  await expect(page.getByText('Bleibt das Feld leer, steht hier der Name des Prozesses.')).toBeVisible()
  await expect(page.getByText('Unabhängig von der Zahl kann ein Datenschutzbeauftragter nötig sein, etwa wenn')).toBeVisible()

  await teil(page, 'Belege und Daten').click()
  await expect(page.getByText('Die Nummer ist das Kapitel in der Verfahrensdokumentation.')).toBeVisible()

  await teil(page, 'Systeme und Dienstleister').click()
  await expect(page.getByText('z. B. ein Archiv im Dokumentenmanagementsystem (DMS) oder ein Ordner im Büro')).toBeVisible()
  const erp = page.locator('#ziel-system-med_erp')
  await expect(erp.getByText('Archiv, das Ändern und Löschen technisch verhindert')).toBeVisible()
  await erp.getByLabel('Wo werden die Daten verarbeitet?').selectOption({ label: 'Anderes Land (Drittland)' })
  await expect(erp.getByLabel('Absicherung der Übermittlung')).toBeVisible()
  await expect(erp.getByText('Steht im Vertrag zur Auftragsverarbeitung oder in den Datenschutzhinweisen des Anbieters; frag im Zweifel nach.')).toBeVisible()

  await teil(page, 'Aufbewahrung und Löschung').click()
  await expect(page.getByText('Das Muster der Bundessteuerberaterkammer und des Steuerberaterverbands (BStBK/DStV) empfiehlt')).toBeVisible()
  await expect(page.getByText('Ein Satz wie „wird gelöscht, wenn nicht mehr nötig“ genügt nicht; nenne eine Frist, z. B. 30 Tage nach Erledigung.')).toBeVisible()

  await teil(page, 'Schutzmaßnahmen').click()
  await expect(page.getByRole('region', { name: 'Pseudonymisierung' })).toContainText('Namen durch Nummern ersetzen, wo der Name nicht gebraucht wird.')
  await expect(page.getByRole('region', { name: 'Verschlüsselung' })).toContainText('https')

  await teil(page, 'Lücken').click()
  await expect(page.getByText('Warnung: Vertrag zur Auftragsverarbeitung fehlt')).toBeVisible()
})

test('Rückfrage zum Ablageort: Einzahl und ohne Sie-Form', async ({ page }) => {
  await start(page)
  await teil(page, 'Systeme und Dienstleister').click()
  await page.getByRole('button', { name: 'Ablageort Ordner Lieferscheine entfernen' }).click()
  await expect(page.getByRole('dialog', { name: 'Ablageort entfernen?' })).toContainText('„Ordner Lieferscheine“ ist Ablageort für 1 Unterlage. Bei ihr fällt dieser Ablageort weg.')
})

test('„Weiß nicht“ bei der Einordnung nennt die Folge statt den Rat zu wiederholen', async ({ page }) => {
  await start(page)
  await teil(page, 'Belege und Daten').click()
  const karte = page.locator('#ziel-datenobjekt-dob_bestellnotiz')
  await expect(karte.getByText('Solange das offen ist, meldet die Lückenprüfung „Aufbewahrungsfrist fehlt“.')).toBeVisible()
  await expect(karte.getByText(/Steuerberatung fragen/)).toHaveCount(1)
})

test('Ablageorte: keine Klammer, wenn System und Name gleich sind', async ({ page }) => {
  await start(page)
  await teil(page, 'Belege und Daten').click()
  const karte = page.locator('#ziel-datenobjekt-dob_bestellnotiz')
  await expect(karte.getByRole('checkbox', { name: 'Warenwirtschaft', exact: true })).toBeVisible()
  await expect(karte.getByRole('checkbox', { name: 'Ordner Lieferscheine (Papier)' })).toBeVisible()
  await expect(karte.getByText('Warenwirtschaft (Warenwirtschaft)')).toHaveCount(0)
})
