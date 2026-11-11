import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { strFromU8, unzipSync } from 'fflate'

// Browsertests der Compliance-Doku (Spezifikation 9.10), Uhr fest auf den 11.11.2026

const TEILSCHRITTE = ['Unternehmen', 'Belege und Daten', 'Systeme und Dienstleister', 'Aufbewahrung und Löschung', 'Kontrollen', 'Schutzmaßnahmen', 'Lücken', 'Dokumente']

const leiste = (page: Page) => page.getByRole('navigation', { name: 'Teilschritte' })
const teil = (page: Page, name: string) => leiste(page).getByRole('button', { name: new RegExp(`^${name}`) })
const schritt = (page: Page, name: string) => page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: new RegExp(name) })

async function start(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00'))
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  await schritt(page, 'Dokumentieren').click()
}

/** axe ohne das bpmn-js-Diagramm (Fremdbibliothek, als Bild beschriftet); schwere und kritische Befunde zählen */
async function pruefeBarrieren(page: Page) {
  const ergebnis = await new AxeBuilder({ page }).exclude('.djs-container').analyze()
  const schwer = ergebnis.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(schwer.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)).toEqual([])
}

async function ohneBeschriftung(page: Page): Promise<string[]> {
  return page.locator('input:not([type="hidden"]):not([hidden]), select, textarea').evaluateAll((els) =>
    els.filter((e) => !(e as HTMLInputElement).labels?.length && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')).map((e) => e.outerHTML.slice(0, 80)),
  )
}

test('zeigt die Lücken des Beispiels, „Beheben“ führt zur Unterlage (9.10, 1 und 2)', async ({ page }) => {
  await start(page)
  await teil(page, 'Lücken').click()
  await expect(page.getByText('keine Fehler · 4 Warnungen · 3 Hinweise')).toBeVisible()

  await page.getByRole('button', { name: 'Beheben: Aufbewahrungsfrist fehlt' }).click()
  await expect(teil(page, 'Belege und Daten')).toHaveAttribute('aria-current', 'step')
  const karte = page.locator('#ziel-datenobjekt-dob_bestellnotiz')
  await expect(karte).toBeFocused()
  await karte.getByText('Nicht aufbewahrungspflichtig').click()

  await teil(page, 'Aufbewahrung und Löschung').click()
  const frist = page.getByRole('group', { name: 'Bestellnotiz' })
  await frist.getByRole('button', { name: 'Löschfrist festlegen' }).click()
  await expect(frist.getByLabel('Anzahl')).toHaveValue('30')
  await expect(frist.getByRole('radio', { name: 'Ab Entstehung bzw. Eingang' })).toBeChecked()

  await teil(page, 'Lücken').click()
  await expect(page.getByText('keine Fehler · 3 Warnungen · 3 Hinweise')).toBeVisible()
  // Rückgängig nimmt die Löschfrist wieder zurück
  await page.getByRole('button', { name: /Rückgängig/ }).click()
  await expect(page.getByText('keine Fehler · 4 Warnungen · 3 Hinweise')).toBeVisible()
})

test('legt eine Unterlage an, ordnet sie ein und legt sie ab', async ({ page }) => {
  await start(page)
  await teil(page, 'Belege und Daten').click()
  const neu = page.getByRole('form', { name: 'Neue Unterlage' })
  await neu.getByLabel('Name, z. B. „Ausgangsrechnung“').fill('Gutschrift')
  await neu.getByLabel('In welchem Schritt entsteht es?').selectOption({ label: '4.16 Rechnung erstellen' })
  await neu.getByRole('button', { name: '+ Unterlage anlegen' }).click()

  const karte = page.getByRole('region', { name: 'Gutschrift' })
  await expect(karte).toContainText('entsteht in 4.16 Rechnung erstellen (Buchhaltung)')
  await karte.locator('label', { hasText: 'Buchungsbeleg' }).click()
  await expect(karte.getByRole('radio', { name: /^Buchungsbeleg/ })).toBeChecked()
  await karte.getByRole('checkbox', { name: 'Warenwirtschaft (Warenwirtschaft)' }).check()

  await teil(page, 'Lücken').click()
  // neu: nur „Personenbezug ungeklärt“ als Hinweis
  await expect(page.getByText('keine Fehler · 4 Warnungen · 4 Hinweise')).toBeVisible()
  await expect(page.getByText('Enthält „Gutschrift“ Angaben zu Personen')).toBeVisible()
})

test('gibt eine Version frei; nach einer Änderung im Ablauf meldet „Lücken“ die geänderten Kapitel (9.10, 3 und 4)', async ({ page }) => {
  await start(page)
  await teil(page, 'Dokumente').click()
  await expect(page.getByText('Entwurf, nicht freigegeben')).toBeVisible()
  await page.getByRole('button', { name: 'Version freigeben …' }).click()
  const dialog = page.getByRole('dialog', { name: 'Version freigeben' })
  await expect(dialog.getByLabel('Freigegeben von')).toHaveValue('Erika Mustermann')
  await expect(dialog.getByLabel('Inhalt der Änderung')).toHaveValue('Erstfassung')
  await dialog.getByRole('button', { name: 'Freigeben', exact: true }).click()
  await expect(dialog).toBeHidden()

  const versionen = page.getByRole('region', { name: 'Versionen' })
  await expect(versionen.getByRole('row').nth(1)).toContainText('1.0')
  await expect(versionen.getByRole('row').nth(1)).toContainText('11.11.2026')
  await expect(page.getByText('Gültige Version 1.0 seit 11.11.2026')).toBeVisible()

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Als Word-Datei (DOCX)' }).click()])
  expect(download.suggestedFilename()).toBe('bestellung-bis-rechnung-lieferdienst-verfahrensdokumentation-v1-0.docx')
  const bytes = new Uint8Array(await readFile((await download.path())!))
  expect(bytes.length).toBeGreaterThan(5000)
  expect(strFromU8(unzipSync(bytes)['word/document.xml'])).toContain('Version 1.0 · gültig ab 11.11.2026')

  await schritt(page, 'Ablauf').click()
  await page.getByRole('button', { name: /Rechnung freigeben/ }).first().click()
  await page.getByLabel('Was wird getan?').fill('Rechnung prüfen und freigeben')
  await schritt(page, 'Dokumentieren').click()
  await teil(page, 'Lücken').click()
  await expect(page.getByText('Seit Version 1.0 geändert: VD 3.2, VD 3.3, VD 4.')).toBeVisible()

  // Die Version bleibt nach dem Neuladen erhalten (eigener Schlüssel im Browser-Speicher)
  await page.reload()
  await schritt(page, 'Dokumentieren').click()
  await teil(page, 'Dokumente').click()
  await expect(page.getByRole('region', { name: 'Versionen' }).getByRole('row').nth(1)).toContainText('1.0')
})

test('druckt nur das Dokument mit dem Hinweis (9.10, 5)', async ({ page }) => {
  await start(page)
  await teil(page, 'Dokumente').click()
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.dokument-hinweis').first()).toBeVisible()
  await expect(page.locator('.dokument-hinweis').first()).toContainText('Vorlage, erstellt mit dem Prozesslotsen')
  await expect(leiste(page)).toBeHidden()
  await expect(page.getByRole('button', { name: 'Version freigeben …' })).toBeHidden()
})

for (const schema of ['light', 'dark'] as const) {
  test(`alle Teilschritte und der Freigabe-Dialog ohne schwere Barrieren (${schema === 'light' ? 'hell' : 'dunkel'}, 9.10, 6)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: schema })
    await start(page)
    for (const name of TEILSCHRITTE) {
      await teil(page, name).click()
      await page.waitForTimeout(300)
      await pruefeBarrieren(page)
      expect(await ohneBeschriftung(page), name).toEqual([])
    }
    await page.getByRole('button', { name: 'Version freigeben …' }).click()
    await expect(page.getByRole('dialog', { name: 'Version freigeben' })).toBeVisible()
    await pruefeBarrieren(page)
  })
}

test('lässt sich per Tastatur bedienen (9.10, 7)', async ({ page }) => {
  await start(page)
  // Teilschritte
  await teil(page, 'Unternehmen').focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(teil(page, 'Belege und Daten')).toHaveAttribute('aria-current', 'step')
  await expect(teil(page, 'Belege und Daten')).toBeFocused()

  // Chips sind Kontrollkästchen
  const chip = page.locator('#ziel-datenobjekt-dob_bestellnotiz').getByRole('checkbox', { name: 'Lieferanten und Dienstleister' })
  await chip.focus()
  await page.keyboard.press('Space')
  await expect(chip).toBeChecked()

  // Reiter wechseln mit den Pfeiltasten
  await teil(page, 'Dokumente').focus()
  await page.keyboard.press('Enter')
  await page.getByRole('tab', { name: 'Verfahrensdokumentation' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Verarbeitungsverzeichnis' })).toBeFocused()
  await expect(page.getByRole('tab', { name: 'Verarbeitungsverzeichnis' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel')).toContainText('Angaben zum Verantwortlichen')

  // Dialog: öffnen, ausfüllen, mit Escape schließen; der Fokus kehrt zurück
  const knopf = page.getByRole('button', { name: 'Version freigeben …' })
  await knopf.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Version freigeben' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Bezeichnung')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByLabel('Gültig ab')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(knopf).toBeFocused()

  // und mit der Tastatur freigeben
  await page.keyboard.press('Enter')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Freigeben', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Gültige Version 1.0 seit 11.11.2026')).toBeVisible()
})

test('„Verbessern“ weist auf die dokumentierte Kontrolle hin (9.10, 8)', async ({ page }) => {
  await start(page)
  await schritt(page, 'Verbessern').click()
  const vorschlag = page.locator('.vorschlag', { hasText: 'Freigabe „Rechnung freigeben“ streichen' })
  await expect(vorschlag.getByRole('note')).toContainText('„Rechnung freigeben“ ist in der Verfahrensdokumentation als Kontrolle eingetragen. Wird sie gestrichen, braucht es einen Ersatz')
  // andere Vorschläge streichen keine Kontrolle
  await expect(page.locator('.vorschlag', { hasText: 'zusammenlegen' }).getByRole('note')).toHaveCount(0)
})

test('exportiert BPMN wahlweise ohne Compliance-Angaben (6.6)', async ({ page }) => {
  await start(page)
  await teil(page, 'Dokumente').click()
  const [ohne] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'BPMN-Datei ohne Compliance-Angaben' }).click()])
  const xmlOhne = await readFile((await ohne.path())!, 'utf8')
  expect(xmlOhne).toContain('prozesslotse/projekt')
  expect(xmlOhne).not.toContain('Lieferdienst Muster GmbH')

  await page.getByText('Projekt', { exact: true }).click()
  const [mit] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Als BPMN exportieren' }).click()])
  expect(await readFile((await mit.path())!, 'utf8')).toContain('Lieferdienst Muster GmbH')
  await expect(page.getByRole('status')).toContainText('enthält auch die Compliance-Angaben')
})

test('meldet einen vollen Browser-Speicher (9.9)', async ({ page }) => {
  await page.addInitScript(() => {
    const setze = Storage.prototype.setItem
    Storage.prototype.setItem = function (schluessel: string, wert: string) {
      if (schluessel === 'prozesslotse:projekt' && (window as unknown as { voll?: boolean }).voll) throw new DOMException('Speicher voll', 'QuotaExceededError')
      return setze.call(this, schluessel, wert)
    }
  })
  await page.goto('/')
  await page.evaluate(() => {
    ;(window as unknown as { voll?: boolean }).voll = true
  })
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  await expect(page.getByRole('status')).toContainText('Das Projekt passt nicht mehr in den Browser-Speicher. Bitte als Datei speichern.')
})

test('löscht die Daten im Browser nach Rückfrage (1.6)', async ({ page }) => {
  await start(page)
  await page.getByText('Projekt', { exact: true }).click()
  await page.getByRole('button', { name: 'Daten im Browser löschen …' }).click()
  const dialog = page.getByRole('dialog', { name: 'Daten im Browser löschen?' })
  await expect(dialog).toContainText('gemeinsam genutzten Rechnern')
  await dialog.getByRole('button', { name: 'Löschen' }).click()
  await expect(page.getByText('Willkommen beim Prozesslotsen')).toBeVisible()
  const gespeichert = await page.evaluate(() => ({ schluessel: Object.keys(localStorage), projekt: localStorage.getItem('prozesslotse:projekt') }))
  expect(gespeichert.schluessel).not.toContain('prozesslotse:versionen')
  expect(gespeichert.projekt ?? '').not.toContain('Lieferdienst')
})

test('übernimmt Firmenangaben und Schutzmaßnahmen aus einer anderen Projektdatei (4.2)', async ({ page }) => {
  await start(page)
  await page.getByText('Projekt', { exact: true }).click()
  const [datei] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Als Datei speichern' }).click()])
  const pfad = (await datei.path())!

  await page.getByText('Projekt', { exact: true }).click()
  await page.getByRole('button', { name: 'Neues Projekt' }).click()
  await expect(page.getByText('Willkommen beim Prozesslotsen')).toBeVisible()
  await schritt(page, 'Dokumentieren').click()
  await expect(page.getByLabel('Wie heißt das Unternehmen?')).toHaveValue('')

  await page.locator('input[type="file"][accept=".prozesslotse,.json,.bpmn"]').setInputFiles(pfad)
  const dialog = page.getByRole('dialog', { name: 'Firmenangaben übernehmen?' })
  await dialog.getByRole('button', { name: 'Übernehmen' }).click()
  await expect(page.getByLabel('Wie heißt das Unternehmen?')).toHaveValue('Lieferdienst Muster GmbH')
  await teil(page, 'Schutzmaßnahmen').click()
  await expect(page.getByRole('checkbox', { name: 'Webzugriffe und E-Mail-Versand über TLS' })).toBeChecked()
  // Unterlagen gehören zum Prozess und werden nicht übernommen
  await teil(page, 'Belege und Daten').click()
  await expect(page.getByText('Noch keine Belege oder Daten.')).toBeVisible()
})

test('filtert nach einem Klick ins Diagramm auf diesen Schritt (5.1)', async ({ page }) => {
  await start(page)
  await teil(page, 'Kontrollen').click()
  await expect(page.locator('#ziel-kontrolle-auf_kontrollieren')).toBeVisible()
  // Der Schritt liegt außerhalb des sichtbaren Ausschnitts; der Klick geht direkt an das Element
  await page.locator('.djs-element', { hasText: 'Rechnung freigeben' }).first().locator('.djs-hit').first().dispatchEvent('click')
  await expect(page.getByText('Kontrolle von „4.17 Rechnung freigeben“')).toBeVisible()
  await expect(page.locator('#ziel-kontrolle-auf_kontrollieren')).toHaveCount(0)
  await expect(page.locator('#ziel-kontrolle-auf_freigeben')).toContainText('Erstellt: Buchhaltung · Freigabe: Niederlassungsleitung · andere Rolle')
  // Der Schritt bleibt „Dokumentieren“
  await expect(schritt(page, 'Dokumentieren')).toHaveAttribute('aria-current', 'step')
  await page.getByRole('button', { name: 'Alle zeigen' }).click()
  await expect(page.locator('#ziel-kontrolle-auf_kontrollieren')).toBeVisible()
})

test('übernimmt ein Datum und zeigt es im Verzeichnis', async ({ page }) => {
  await start(page)
  await page.getByLabel('Eingeführt am').fill('2024-03-01')
  await teil(page, 'Belege und Daten').click()
  await teil(page, 'Unternehmen').click()
  await expect(page.getByLabel('Eingeführt am')).toHaveValue('2024-03-01')
  await teil(page, 'Dokumente').click()
  await page.getByRole('tab', { name: 'Verarbeitungsverzeichnis' }).click()
  await expect(page.getByRole('tabpanel').getByRole('row', { name: /Eingeführt am/ })).toContainText('01.03.2024')
})
