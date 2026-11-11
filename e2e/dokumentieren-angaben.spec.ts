import { expect, test, type Page } from '@playwright/test'

// Browsertests zu den neuen Angaben (Prüfung vom 11.11.2026, Paket „Angaben“), Uhr fest auf den 11.11.2026

const leiste = (page: Page) => page.getByRole('navigation', { name: 'Teilschritte' })
const teil = (page: Page, name: string) => leiste(page).getByRole('button', { name: new RegExp(`^${name}`) })
const schritt = (page: Page, name: string) => page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: new RegExp(name) })

async function start(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00'))
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  await schritt(page, 'Dokumentieren').click()
}

async function verzeichnis(page: Page) {
  await teil(page, 'Dokumente').click()
  await page.getByRole('tab', { name: 'Verarbeitungsverzeichnis' }).click()
  return page.getByRole('tabpanel')
}

test('logik-1: eine Rolle wird unter „Unternehmen“ extern und steht im Verzeichnis unter B.4 extern, nicht intern', async ({ page }) => {
  await start(page)
  const zeile = page.getByRole('region', { name: 'Rollen im Ablauf' }).getByRole('row', { name: /Buchhaltung/ })
  await zeile.locator('label.schalter').click()
  await expect(zeile.getByRole('switch', { name: 'Buchhaltung: extern' })).toBeChecked()
  await zeile.getByRole('textbox', { name: 'Organisation von Buchhaltung' }).fill('Kanzlei Beispiel')

  const vorschau = await verzeichnis(page)
  const b4 = vorschau.locator('h5', { hasText: 'B.4 Empfänger' })
  await expect(b4.locator('xpath=following-sibling::ul[1]')).not.toContainText('Buchhaltung')
  await expect(b4.locator('xpath=following-sibling::ul[2]')).toContainText('Kanzlei Beispiel (Buchhaltung)')

  // Verfahrensdokumentation 2.2.2: intern oder extern
  await page.getByRole('tab', { name: 'Verfahrensdokumentation' }).click()
  await expect(vorschau.getByRole('row', { name: /^Buchhaltung 1/ })).toContainText('extern (Kanzlei Beispiel)')
})

test('recht-4: Wiederfinden und Datenzugriff je System mit Ablage, leer als Hinweis, ausgefüllt in Kapitel 3.5', async ({ page }) => {
  await start(page)
  await teil(page, 'Systeme und Dienstleister').click()
  const karte = page.getByRole('region', { name: 'Warenwirtschaft' })
  const wiederfinden = karte.getByLabel('Wie findet man eine Unterlage wieder?')
  await expect(wiederfinden).toHaveValue('Suche nach Rechnungs-, Bestell- oder Kundennummer')
  // Die Excel-Tourenliste bewahrt nichts auf: keine Frage
  await expect(page.getByRole('region', { name: 'Excel-Tourenliste' }).getByLabel('Wie findet man eine Unterlage wieder?')).toHaveCount(0)

  await wiederfinden.fill('')
  await teil(page, 'Lücken').click()
  await expect(page.getByText('keine Fehler · 4 Warnungen · 4 Hinweise')).toBeVisible()
  await expect(page.getByText('Für „Warenwirtschaft“ ist offen, wie eine Unterlage wiedergefunden wird.')).toBeVisible()

  await teil(page, 'Systeme und Dienstleister').click()
  await wiederfinden.fill('Suche nach Rechnungsnummer')
  await karte.getByLabel(/Wie bekommt die Finanzverwaltung bei einer Außenprüfung Zugriff/).fill('Export als CSV über die Oberfläche')
  await teil(page, 'Dokumente').click()
  const vorschau = page.getByRole('tabpanel')
  await expect(vorschau.locator('h5', { hasText: '3.5 Wiederfinden, Lesbarmachung und Datenzugriff' })).toBeVisible()
  const zeile = vorschau.getByRole('row', { name: /^Warenwirtschaft Bestellung, Ausgangsrechnung/ })
  await expect(zeile).toContainText('Suche nach Rechnungsnummer')
  await expect(zeile).toContainText('Export als CSV über die Oberfläche')
})

test('recht-7: die Ausnahme nach Art. 9 Abs. 2 DSGVO lässt sich wählen, steht in B.2 und macht D5 zum Hinweis', async ({ page }) => {
  await start(page)
  await teil(page, 'Belege und Daten').click()
  const karte = page.locator('#ziel-datenobjekt-dob_tourenliste')
  await karte.getByRole('button', { name: 'Angaben bearbeiten' }).click()
  await karte.getByText('Besonders geschützte Daten (Art. 9 und 10 DSGVO)').click()
  await karte.getByRole('checkbox', { name: 'Gesundheitsdaten' }).check()
  const ausnahme = karte.getByLabel('Welche Ausnahme nach Art. 9 Abs. 2 DSGVO gilt?')
  await expect(ausnahme).toHaveValue('')

  await teil(page, 'Lücken').click()
  await expect(page.getByText('keine Fehler · 5 Warnungen · 3 Hinweise')).toBeVisible()
  await expect(page.getByText(/Gib an, welche Ausnahme nach Art\. 9 Abs\. 2 DSGVO die Verarbeitung erlaubt/)).toBeVisible()

  await teil(page, 'Belege und Daten').click()
  await ausnahme.selectOption({ label: 'Ausdrückliche Einwilligung (lit. a)' })
  await teil(page, 'Lücken').click()
  await expect(page.getByText('keine Fehler · 4 Warnungen · 4 Hinweise')).toBeVisible()

  const vorschau = await verzeichnis(page)
  await expect(vorschau).toContainText('Art. 9 Abs. 2 lit. a DSGVO: ausdrückliche Einwilligung der Person (für Tourenliste)')
  await expect(vorschau.getByRole('row', { name: /^Tourenliste Kunden/ })).toContainText('Gesundheitsdaten (Art. 9 DSGVO)')
})

test('recht-3: der Zugriffsschutz je System steht in Kapitel 3.4 und im Verzeichnis unter C.3', async ({ page }) => {
  await start(page)
  await teil(page, 'Systeme und Dienstleister').click()
  await page.getByRole('region', { name: 'Warenwirtschaft' }).getByLabel('Zugriffsschutz', { exact: true }).fill('Konto je Person mit Zwei-Faktor-Anmeldung')
  await teil(page, 'Dokumente').click()
  await expect(page.getByRole('tabpanel').getByRole('cell', { name: 'Konto je Person mit Zwei-Faktor-Anmeldung', exact: true })).toBeVisible()
  const vorschau = await verzeichnis(page)
  await expect(vorschau.getByText('Warenwirtschaft: Konto je Person mit Zwei-Faktor-Anmeldung')).toBeVisible()
})

test('logik-18: mitgeltende Unterlagen lassen sich unter „Dokumente“ eintragen und stehen mit Ablageort in Kapitel 6', async ({ page }) => {
  await start(page)
  await teil(page, 'Dokumente').click()
  const bereich = page.getByRole('region', { name: 'Mitgeltende Unterlagen' })
  await bereich.getByRole('button', { name: '+ Mitgeltende Unterlage' }).click()
  const name = bereich.getByLabel('Name der mitgeltenden Unterlage 1')
  await expect(name).toBeFocused()
  await name.fill('Berechtigungskonzept')
  await bereich.getByLabel('Ablageort der mitgeltenden Unterlage 1').fill('Ordner Organisation, Büro')
  const vorschau = page.getByRole('tabpanel')
  await expect(vorschau.getByText('Berechtigungskonzept (Ablage: Ordner Organisation, Büro)')).toBeVisible()

  await bereich.getByRole('button', { name: 'Mitgeltende Unterlage Berechtigungskonzept entfernen' }).click()
  await expect(bereich.getByRole('button', { name: '+ Mitgeltende Unterlage' })).toBeFocused()
  await expect(vorschau).not.toContainText('Berechtigungskonzept')
})
