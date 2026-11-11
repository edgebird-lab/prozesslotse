import { readFile, writeFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

// Browsertests zu Daten, Speichern und Versionen (Prüfung „daten“), Uhr fest auf den 11.11.2026

const schritt = (page: Page, name: string) => page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: new RegExp(name) })
const dateiFeld = (page: Page) => page.locator('input[type="file"][accept*="application/json"]')

async function start(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00'))
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
}

/** Speichert das Projekt als Datei (Download) und liefert den Inhalt als JSON-Daten. */
async function alsDatei(page: Page): Promise<Record<string, any>> {
  await page.getByText('Projekt', { exact: true }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Als Datei speichern' }).click()])
  return JSON.parse(await readFile((await download.path())!, 'utf8'))
}

test('öffnet aus einer Datei mit beschädigten Compliance-Angaben auf Wunsch nur den Prozess (daten-3)', async ({ page }, info) => {
  await start(page)
  const d = await alsDatei(page)
  d.compliance.systeme.med_erp.seit = '01.03.2019'
  const pfad = info.outputPath('beschaedigt.prozesslotse')
  await writeFile(pfad, JSON.stringify(d))

  await page.getByText('Projekt', { exact: true }).click()
  await page.getByRole('button', { name: 'Neues Projekt' }).click()
  await expect(page.getByText('Willkommen beim Prozesslotsen')).toBeVisible()

  // Abbrechen: nichts geladen, die Meldung nennt das Feld
  await dateiFeld(page).setInputFiles(pfad)
  const dialog = page.getByRole('dialog', { name: 'Compliance-Angaben beschädigt' })
  await expect(dialog).toContainText('Die Compliance-Angaben in „beschaedigt.prozesslotse“ sind beschädigt (systeme.med_erp.seit: ist kein gültiges Datum). Nur den Prozess öffnen?')
  await dialog.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(page.getByRole('status')).toContainText('Datei nicht geladen: Compliance-Angaben: ‚systeme.med_erp.seit‘ ist kein gültiges Datum.')
  await expect(page.getByText('Willkommen beim Prozesslotsen')).toBeVisible()

  // Nur den Prozess: neues, ungespeichertes Dokument ohne Dateinamen und ohne Compliance-Angaben
  await dateiFeld(page).setInputFiles(pfad)
  await dialog.getByRole('button', { name: 'Nur den Prozess öffnen' }).click()
  await expect(page.getByRole('status')).toContainText('Aus „beschaedigt.prozesslotse“ ist nur der Prozess geöffnet, als neues Dokument ohne Compliance-Angaben. Die Datei bleibt unverändert.')
  await expect(page.getByRole('button', { name: /Rechnung freigeben/ }).first()).toBeVisible()
  await expect(page.locator('.dokument-name')).toHaveCount(0)
  await schritt(page, 'Dokumentieren').click()
  await expect(page.getByLabel('Wie heißt das Unternehmen?')).toHaveValue('')
})

const teil = (page: Page, name: string) => page.getByRole('navigation', { name: 'Teilschritte' }).getByRole('button', { name: new RegExp(`^${name}`) })
const hinweis = (page: Page) => page.getByRole('region', { name: 'Browser-Speicher' })

/** Gibt im Teilschritt „Dokumente“ eine Version frei; leere Angaben bleiben bei der Vorgabe des Dialogs. */
async function freigeben(page: Page, angaben: { bezeichnung?: string; gueltigAb?: string; aenderung?: string } = {}) {
  await page.getByRole('button', { name: 'Version freigeben …' }).click()
  const dialog = page.getByRole('dialog', { name: 'Version freigeben' })
  if (angaben.bezeichnung) await dialog.getByLabel('Bezeichnung').fill(angaben.bezeichnung)
  if (angaben.gueltigAb) await dialog.getByLabel('Gültig ab').fill(angaben.gueltigAb)
  if (angaben.aenderung) await dialog.getByLabel('Inhalt der Änderung').fill(angaben.aenderung)
  await dialog.getByRole('button', { name: 'Freigeben', exact: true }).click()
  await expect(dialog).toBeHidden()
}

/** Ab `window.versionenVoll` passen keine Versionen mehr in den Browser-Speicher (wie bei vollem Kontingent). */
async function versionenPassenNichtMehr(page: Page) {
  await page.addInitScript(() => {
    const setze = Storage.prototype.setItem
    Storage.prototype.setItem = function (schluessel: string, wert: string) {
      if (schluessel === 'prozesslotse:versionen' && (window as unknown as { versionenVoll?: boolean }).versionenVoll) throw new DOMException('Speicher voll', 'QuotaExceededError')
      return setze.call(this, schluessel, wert)
    }
  })
}

test('voller Browser-Speicher: Der Neustart zeigt den älteren Stand nicht als gespeicherte Datei (daten-0)', async ({ page }) => {
  await versionenPassenNichtMehr(page)
  await start(page)
  await schritt(page, 'Dokumentieren').click()
  await teil(page, 'Dokumente').click()
  await freigeben(page)
  await page.evaluate(() => {
    ;(window as unknown as { versionenVoll?: boolean }).versionenVoll = true
  })
  await freigeben(page, { bezeichnung: '2.0', gueltigAb: '2026-11-12', aenderung: 'Freigabe von Hand ergänzt' })
  await expect(page.getByRole('status')).toContainText('Das Projekt passt nicht mehr in den Browser-Speicher. Bitte als Datei speichern.')
  // Der Meldung folgen: als Datei speichern; die Datei enthält beide Versionen
  const d = await alsDatei(page)
  expect(d.compliance.versionen.map((v: { bezeichnung: string }) => v.bezeichnung)).toEqual(['1.0', '2.0'])
  await expect(page.locator('.dokument-name')).toContainText('bestellung-bis-rechnung-lieferdienst.prozesslotse')

  await page.reload()
  await expect(hinweis(page)).toContainText('Der Browser-Speicher war zuletzt voll. Wiederhergestellt ist deshalb ein älterer Stand als neues, ungespeichertes Dokument')
  // nicht unter dem Namen der Datei und nicht als unverändert
  await expect(page.locator('.dokument-name')).toHaveCount(0)
  await schritt(page, 'Dokumentieren').click()
  await teil(page, 'Dokumente').click()
  const zeilen = page.getByRole('region', { name: 'Versionen' }).getByRole('row')
  await expect(zeilen).toHaveCount(2)
  await expect(zeilen.nth(1)).toContainText('1.0')
  await hinweis(page).getByRole('button', { name: 'Schließen' }).click()
  await expect(hinweis(page)).toHaveCount(0)
})

test('voller Browser-Speicher: Schließen des Tabs fragt bei ungespeicherten Änderungen nach (daten-0)', async ({ page }) => {
  await versionenPassenNichtMehr(page)
  await start(page)
  await schritt(page, 'Dokumentieren').click()
  await teil(page, 'Dokumente').click()
  await page.evaluate(() => {
    ;(window as unknown as { versionenVoll?: boolean }).versionenVoll = true
  })
  await freigeben(page)
  await expect(page.getByRole('status')).toContainText('Das Projekt passt nicht mehr in den Browser-Speicher.')
  const dialog = page.waitForEvent('dialog')
  await page.close({ runBeforeUnload: true })
  const d = await dialog
  expect(d.type()).toBe('beforeunload')
  await d.accept()
})

test('lässt sich der Stand im Browser nicht laden, bleiben die Rohdaten erhalten, bis entschieden ist (daten-2)', async ({ page }) => {
  await start(page)
  // Ein Feld im gespeicherten Projekt beschädigen, z. B. von einer anderen Fassung oder von Hand
  const roh = await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('prozesslotse:projekt')!)
    p.compliance.systeme.med_erp.seit = '01.03.2019'
    localStorage.setItem('prozesslotse:projekt', JSON.stringify(p))
    return localStorage.getItem('prozesslotse:projekt')
  })
  await page.reload()
  await expect(hinweis(page)).toContainText('Die Compliance-Angaben im Browser-Speicher sind beschädigt (systeme.med_erp.seit: ist kein gültiges Datum). Geöffnet ist nur der Prozess. Die Rohdaten bleiben unverändert im Browser, bis du entscheidest.')
  // Der Prozess ist da, die Compliance-Angaben nicht; der Speicher bleibt auch nach einer Änderung unverändert
  await expect(page.getByRole('button', { name: /Rechnung freigeben/ }).first()).toBeVisible()
  await schritt(page, 'Dokumentieren').click()
  await page.getByLabel('Wie heißt das Unternehmen?').fill('Neu GmbH')
  expect(await page.evaluate(() => localStorage.getItem('prozesslotse:projekt'))).toBe(roh)

  const [download] = await Promise.all([page.waitForEvent('download'), hinweis(page).getByRole('button', { name: 'Rohdaten herunterladen' }).click()])
  expect(download.suggestedFilename()).toBe('prozesslotse-rohdaten-2026-11-11.json')
  expect(JSON.parse(await readFile((await download.path())!, 'utf8')).projekt.compliance.systeme.med_erp.seit).toBe('01.03.2019')

  await hinweis(page).getByRole('button', { name: 'Rohdaten verwerfen …' }).click()
  await page.getByRole('dialog', { name: 'Rohdaten verwerfen?' }).getByRole('button', { name: 'Verwerfen' }).click()
  await expect(hinweis(page)).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('prozesslotse:projekt') ?? '{}').compliance?.unternehmen?.name)).toBe('Neu GmbH')
})

test('rechnet die Prüfsummen nach dem Laden nach und zeigt eine veränderte Version deutlich (daten-4, logik-19)', async ({ page }, info) => {
  await start(page)
  await schritt(page, 'Dokumentieren').click()
  await teil(page, 'Dokumente').click()
  await freigeben(page)
  const zeile = page.getByRole('region', { name: 'Versionen' }).getByRole('row').nth(1)
  await expect(zeile).toContainText('Prüfsumme stimmt')
  // Den eingefrorenen Prozess (Diagramm der Anlage) in der Datei verändern
  const d = await alsDatei(page)
  d.compliance.versionen[0].prozess.ablauf.schritte.pop()
  const pfad = info.outputPath('veraendert.prozesslotse')
  await writeFile(pfad, JSON.stringify(d))
  await dateiFeld(page).setInputFiles(pfad)
  await expect(page.getByRole('status')).toContainText('Prüfsumme stimmt nicht – Version 1.0 wurde verändert oder ist beschädigt.')
  await schritt(page, 'Dokumentieren').click()
  await teil(page, 'Dokumente').click()
  await expect(zeile).toContainText('Prüfsumme stimmt nicht – Version wurde verändert oder ist beschädigt')
  await zeile.getByRole('button', { name: 'Version 1.0 ansehen' }).click()
  await expect(page.locator('.version-banner')).toContainText('Prüfsumme stimmt nicht – Version wurde verändert oder ist beschädigt')
})

test('zweite Freigabe am selben Tag: Die Vorgaben bestehen die eigene Prüfung, der Inhalt der Änderung ist Pflicht (bedienung-4, bedienung-19)', async ({ page }) => {
  await start(page)
  await schritt(page, 'Dokumentieren').click()
  await teil(page, 'Dokumente').click()
  await freigeben(page)
  await schritt(page, 'Ablauf').click()
  await page.getByRole('button', { name: /Rechnung freigeben/ }).first().click()
  await page.getByLabel('Was wird getan?').fill('Rechnung prüfen und freigeben')
  await schritt(page, 'Dokumentieren').click()
  await teil(page, 'Dokumente').click()

  await page.getByRole('button', { name: 'Version freigeben …' }).click()
  const dialog = page.getByRole('dialog', { name: 'Version freigeben' })
  await expect(dialog.getByLabel('Gültig ab')).toHaveValue('2026-11-12')
  await expect(dialog).toContainText('Frühestens 12.11.2026, spätestens 11.11.2027.')
  const inhalt = dialog.getByLabel('Inhalt der Änderung')
  await expect(inhalt).toHaveValue('')
  await expect(inhalt).toHaveAttribute('placeholder', 'z. B. Rechnung wird jetzt zusätzlich von der Buchhaltung geprüft')
  await expect(dialog).toContainText('Geänderte Kapitel: Verfahrensdokumentation 3.2, 3.3 und 4 (werden automatisch eingetragen)')
  await dialog.getByRole('button', { name: 'Freigeben', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Bitte den Inhalt der Änderung beschreiben.')
  await expect(inhalt).toBeFocused()
  await inhalt.fill('Rechnung wird jetzt zusätzlich von der Buchhaltung geprüft')
  await dialog.getByRole('button', { name: 'Freigeben', exact: true }).click()
  await expect(dialog).toBeHidden()

  const zeile = page.getByRole('region', { name: 'Versionen' }).getByRole('row').nth(2)
  await expect(zeile).toContainText('2.0')
  await expect(zeile).toContainText('12.11.2026')
  await expect(zeile).toContainText('3.3')
  // Kapitel 7: Inhalt fachlich, die Kapitel stehen in ihrer eigenen Spalte
  const kapitel7 = page.getByRole('tabpanel').getByRole('row', { name: /^2\.0/ })
  await expect(kapitel7).toContainText('Rechnung wird jetzt zusätzlich von der Buchhaltung geprüft')
  await expect(kapitel7).not.toContainText('Geändert:')
})

test('vertipptes „Gültig ab“: Grenze ein Jahr, Rückfrage ab 30 Tagen, Freigabe zurückziehen und berichtigen (daten-5, logik-2)', async ({ page }) => {
  await start(page)
  await schritt(page, 'Dokumentieren').click()
  await teil(page, 'Dokumente').click()
  await page.getByRole('button', { name: 'Version freigeben …' }).click()
  const dialog = page.getByRole('dialog', { name: 'Version freigeben' })
  const datum = dialog.getByLabel('Gültig ab')
  const freigabeKnopf = dialog.getByRole('button', { name: 'Freigeben', exact: true })

  // mehr als ein Jahr nach dem Freigabetag: Fehler, Fokus im Feld
  await datum.fill('2126-11-11')
  await freigabeKnopf.click()
  await expect(dialog.getByRole('alert')).toHaveText('Gültig ab darf höchstens ein Jahr nach dem Freigabetag liegen, also spätestens am 11.11.2027.')
  await expect(datum).toBeFocused()

  // mehr als 30 Tage: Rückfrage; „Datum ändern“ führt zurück ins Feld
  await datum.fill('2027-11-10')
  await freigabeKnopf.click()
  const rueckfrage = page.getByRole('dialog', { name: '„Gültig ab“ prüfen' })
  await expect(rueckfrage).toContainText('Version 1.0 soll erst ab dem 10.11.2027 gelten, 364 Tage nach dem Freigabetag. Stimmt das Datum?')
  await rueckfrage.getByRole('button', { name: 'Datum ändern' }).click()
  await expect(datum).toBeFocused()
  await freigabeKnopf.click()
  await rueckfrage.getByRole('button', { name: 'Ja, freigeben' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Version 1.0 gilt ab 10.11.2027')).toBeVisible()

  // Zurückziehen, solange die Version noch nicht gilt; der Grund ist Pflicht
  const versionen = page.getByRole('region', { name: 'Versionen' })
  await versionen.getByRole('button', { name: 'Freigabe von Version 1.0 zurückziehen …' }).click()
  const rueckzug = page.getByRole('dialog', { name: 'Freigabe zurückziehen' })
  await rueckzug.getByRole('button', { name: 'Zurückziehen' }).click()
  await expect(rueckzug.getByRole('alert')).toHaveText('Bitte den Grund für den Rückzug angeben.')
  await rueckzug.getByLabel('Grund').fill('Tippfehler im Jahr')
  await rueckzug.getByRole('button', { name: 'Zurückziehen' }).click()
  await expect(rueckzug).toBeHidden()
  await expect(versionen.getByRole('row').nth(1)).toContainText('zurückgezogen am 11.11.2026: Tippfehler im Jahr')
  await expect(page.getByText('Entwurf, nicht freigegeben')).toBeVisible()
  await expect(page.getByRole('button', { name: /Rückgängig/ })).toBeDisabled()
  // Beim Ansehen nennt das Banner den Rückzug statt „gültig ab“
  await versionen.getByRole('button', { name: 'Version 1.0 ansehen' }).click()
  const banner = page.locator('.version-banner')
  await expect(banner).toContainText('Version 1.0, Freigabe zurückgezogen am 11.11.2026: Tippfehler im Jahr (galt nie), freigegeben am 11.11.2026')
  await expect(banner).not.toContainText('gültig ab')
  await banner.getByRole('button', { name: 'Zurück zum aktuellen Entwurf' }).click()

  // Berichtigen: Vorgabe heute, neue Nummer, wieder Erstfassung
  await page.getByRole('button', { name: 'Version freigeben …' }).click()
  await expect(datum).toHaveValue('2026-11-11')
  await expect(dialog.getByLabel('Bezeichnung')).toHaveValue('2.0')
  await expect(dialog.getByLabel('Inhalt der Änderung')).toHaveValue('Erstfassung')
  await freigabeKnopf.click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Gültige Version 2.0 seit 11.11.2026')).toBeVisible()
  await expect(versionen.getByRole('row')).toHaveCount(3)
  await expect(versionen.getByRole('button', { name: /zurückziehen/ })).toHaveCount(0)
})
