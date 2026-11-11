import { strFromU8, unzipSync } from 'fflate'
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

// Nachbesserung Druck (Sichtprüfung vom 11.11.2026 und recht-5), Uhr fest auf den 11.11.2026

const leiste = (page: Page) => page.getByRole('navigation', { name: 'Teilschritte' })
const teil = (page: Page, name: string) => leiste(page).getByRole('button', { name: new RegExp(`^${name}`) })
const schritt = (page: Page, name: string) => page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: new RegExp(name) })

async function start(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00'))
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  await schritt(page, 'Dokumentieren').click()
  await expect(leiste(page)).toBeVisible()
  await teil(page, 'Dokumente').click()
}

test('Vorlagenhinweis nur im Entwurf; die freigegebene Fassung nennt Version, Freigabetag und fachliche Prüfung (recht-5)', async ({ page }) => {
  await start(page)
  // Fußzeile im Druck: Regel für das Randfeld der Seite (@page, @bottom-center)
  const fussRegel = () => page.evaluate(() => [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').find((t) => t.includes('@bottom-center')) ?? '')
  const fuss = { toContain: (text: string) => expect.poll(fussRegel).toContain(text), notToContain: (text: string) => expect.poll(fussRegel).not.toContain(text) }
  const deckblatt = page.locator('.dokument-deckblatt')
  await fuss.toContain('content: "Vorlage – vor Verwendung prüfen lassen · Verfahrensdokumentation · Entwurf · Seite " counter(page)')
  await expect(deckblatt.locator('.dokument-hinweis')).toContainText('Vor Verwendung von der Steuerberatung prüfen lassen.')

  await page.getByRole('button', { name: 'Version freigeben …' }).click()
  const dialog = page.getByRole('dialog', { name: 'Version freigeben' })
  await dialog.getByLabel('Fachlich geprüft von').fill('Steuerberatung Muster')
  await dialog.getByLabel('Geprüft am').fill('2026-11-10')
  await dialog.getByRole('button', { name: 'Freigeben', exact: true }).click()
  await expect(dialog).toBeHidden()

  // Ohne Änderung zeigt die Vorschau die freigegebene Fassung; der Druck nutzt dieselbe Regel
  await fuss.toContain('content: "Verfahrensdokumentation · Version 1.0 · freigegeben am 11.11.2026 · Seite " counter(page)')
  await fuss.notToContain('Vorlage')
  await expect(deckblatt).toContainText('Fachlich geprüft von Steuerberatung Muster am 10.11.2026.')
  await expect(deckblatt.locator('.dokument-hinweis')).toContainText(
    'Aus einer Vorlage mit dem Prozesslotsen erstellt; die Verantwortung für den Inhalt liegt beim Unternehmen. Eine Prüfung durch die Steuerberatung wird empfohlen.',
  )
  await expect(deckblatt).not.toContainText('Vor Verwendung')
  await expect(page.getByRole('tabpanel').getByRole('row', { name: /^1\.0/ })).toContainText('fachlich geprüft von Steuerberatung Muster am 10.11.2026')

  await page.getByRole('tab', { name: 'Verarbeitungsverzeichnis' }).click()
  await fuss.toContain('content: "Verzeichnis von Verarbeitungstätigkeiten · Version 1.0 · freigegeben am 11.11.2026 · Seite "')
  await expect(deckblatt.locator('.dokument-hinweis')).toContainText('Eine Prüfung durch den Datenschutzbeauftragten oder eine fachkundige Person wird empfohlen.')

  // DOCX: gleiche Fußzeile und gleiches Deckblatt
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Als Word-Datei (DOCX)' }).click()])
  const dateien = unzipSync(new Uint8Array(await readFile((await download.path())!)))
  const fussXml = Object.keys(dateien)
    .filter((n) => /^word\/footer\d*\.xml$/.test(n))
    .map((n) => strFromU8(dateien[n]))
    .join('')
  expect(fussXml).toContain('Verzeichnis von Verarbeitungstätigkeiten · Version 1.0 · freigegeben am 11.11.2026 · Seite ')
  expect(fussXml).not.toContain('Vorlage')
  expect(strFromU8(dateien['word/document.xml'])).toContain('Fachlich geprüft von Steuerberatung Muster am 10.11.2026.')
})
