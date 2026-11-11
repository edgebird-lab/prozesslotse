import { strFromU8, unzipSync } from 'fflate'
import { readFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from '@playwright/test'

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

const ROT = { light: 'rgb(180, 44, 44)', dark: 'rgb(230, 103, 103)' }

/** Meldung rot, direkt unter dem Feld in seiner Gruppe, das Feld als ungültig markiert und rot umrandet */
async function pruefeMeldungAmFeld(feld: Locator, meldung: Locator, rot: string) {
  await expect(meldung).toBeVisible()
  await expect(feld).toHaveAttribute('aria-invalid', 'true')
  const id = await meldung.getAttribute('id')
  expect(id).toBeTruthy()
  await expect(feld).toHaveAttribute('aria-describedby', id!)
  const lage = await meldung.evaluate((m, f) => {
    const gruppe = m.closest('.feld')
    const feldRect = (f as HTMLElement).getBoundingClientRect()
    const r = m.getBoundingClientRect()
    return { gleicheGruppe: !!gruppe && gruppe.contains(f as HTMLElement), abstand: r.top - feldRect.bottom, links: r.left - feldRect.left, farbe: getComputedStyle(m).color, rahmen: getComputedStyle(f as HTMLElement).borderTopColor }
  }, await feld.elementHandle())
  expect(lage.gleicheGruppe).toBe(true)
  // direkt unter dem Feld
  expect(lage.abstand).toBeGreaterThanOrEqual(0)
  expect(lage.abstand).toBeLessThan(12)
  expect(Math.abs(lage.links)).toBeLessThan(2)
  expect(lage.farbe).toBe(rot)
  expect(lage.rahmen).toBe(rot)
}

for (const schema of ['light', 'dark'] as const) {
  test(`Dialoge: Fehlermeldungen rot direkt am Feld, Feld markiert (${schema === 'light' ? 'hell' : 'dunkel'}, Sichtprüfung Mangel 2)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: schema })
    await start(page)
    await page.getByRole('button', { name: 'Version freigeben …' }).click()
    const dialog = page.getByRole('dialog', { name: 'Version freigeben' })
    const datum = dialog.getByLabel('Gültig ab')
    const freigeben = dialog.getByRole('button', { name: 'Freigeben', exact: true })

    // Gültig ab: mehr als ein Jahr nach dem Freigabetag
    await datum.fill('2126-11-11')
    await freigeben.click()
    const meldung = dialog.getByRole('alert')
    await expect(meldung).toHaveText('Gültig ab darf höchstens ein Jahr nach dem Freigabetag liegen, also spätestens am 11.11.2027.')
    await pruefeMeldungAmFeld(datum, meldung, ROT[schema])
    await expect(datum).toBeFocused()
    // Ändern nimmt die Meldung weg
    await datum.fill('2026-11-11')
    await expect(meldung).toHaveCount(0)
    await expect(datum).not.toHaveAttribute('aria-invalid', 'true')

    // fachliche Prüfung: Datum ohne Namen, die Meldung steht am Namensfeld
    await dialog.getByLabel('Geprüft am').fill('2026-11-10')
    await freigeben.click()
    await expect(meldung).toHaveText('Bitte angeben, wer fachlich geprüft hat, oder das Datum leeren.')
    await pruefeMeldungAmFeld(dialog.getByLabel('Fachlich geprüft von'), meldung, ROT[schema])
    await dialog.getByRole('button', { name: 'Abbrechen' }).click()

    // Rückzug: Grund fehlt
    await page.getByRole('button', { name: 'Version freigeben …' }).click()
    await datum.fill('2026-12-01')
    await freigeben.click()
    await expect(dialog).toBeHidden()
    await page.getByRole('region', { name: 'Versionen' }).getByRole('button', { name: 'Freigabe von Version 1.0 zurückziehen …' }).click()
    const rueckzug = page.getByRole('dialog', { name: 'Freigabe zurückziehen' })
    await rueckzug.getByRole('button', { name: 'Zurückziehen' }).click()
    await expect(rueckzug.getByRole('alert')).toHaveText('Bitte den Grund für den Rückzug angeben.')
    await pruefeMeldungAmFeld(rueckzug.getByLabel('Grund'), rueckzug.getByRole('alert'), ROT[schema])
  })
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
