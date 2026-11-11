// Erzeugt die Bildschirmfotos für die README in docs/bilder.
// Aufruf: npm run build && npx vite preview --port 4173 & node scripts/readme-bilder.mjs
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const ziel = 'docs/bilder'
await mkdir(ziel, { recursive: true })
const browser = await chromium.launch({ channel: process.env.CI ? 'chrome' : 'msedge' })
const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, colorScheme: 'light' })
const schritt = (name) => page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name }).click()

await page.goto(process.env.ADRESSE ?? 'http://localhost:4173/')
await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
await page.waitForTimeout(1500)
await page.screenshot({ path: `${ziel}/pruefen.png` })

await schritt(/Ablauf/)
await page.getByRole('button', { name: /^Kunden anrufen und Ersatz anbieten/ }).click()
await page.getByRole('button', { name: 'Fertig' }).click()
await page.getByRole('button', { name: 'Hier einfügen' }).nth(4).click()
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(1200)
await page.screenshot({ path: `${ziel}/ablauf.png` })

await schritt(/Verbessern/)
await page.getByRole('button', { name: 'Übernehmen' }).first().click()
await page.waitForTimeout(800)
await page.mouse.move(5, 5)
await page.locator('.vorschlag').first().hover()
await page.waitForTimeout(1200)
await page.screenshot({ path: `${ziel}/verbessern.png` })

await schritt(/Bericht/)
await page.waitForTimeout(2500)
await page.screenshot({ path: `${ziel}/bericht.png`, clip: { x: 0, y: 0, width: 1440, height: 1100 }, fullPage: true })

await dokumente()

await browser.close()
console.log('Bilder in', ziel)

/** Compliance-Doku: Teilschritt „Dokumente“ mit Vorschau der Verfahrensdokumentation (neue Seite mit leerem Speicher, sonst stellt die App den Stand von oben wieder her) */
async function dokumente() {
  const seite = await browser.newPage({ viewport: { width: 1440, height: 860 }, colorScheme: 'light' })
  await seite.goto(process.env.ADRESSE ?? 'http://localhost:4173/')
  await seite.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  await seite.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Dokumentieren/ }).click()
  await seite.getByRole('navigation', { name: 'Teilschritte' }).getByRole('button', { name: /^Dokumente/ }).click()
  await seite.waitForTimeout(800)
  await seite.screenshot({ path: `${ziel}/dokumente.png` })
}
