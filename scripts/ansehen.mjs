// Rundgang durch die App mit Bildschirmfotos (Entwicklungswerkzeug).
// Aufruf: npm run build && npx vite preview --port 4173 & node scripts/ansehen.mjs <zielordner>
// Nutzt das installierte Edge (lokal) bzw. Chrome (CI); lädt keinen Browser herunter.
import { chromium } from '@playwright/test'

const ziel = process.argv[2] ?? 'bilder'
const adresse = process.env.ADRESSE ?? 'http://localhost:4173/'
const browser = await chromium.launch({ channel: process.env.CI ? 'chrome' : 'msedge' })
const meldungen = []

async function seite(optionen = {}) {
  const kontext = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...optionen })
  const page = await kontext.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') meldungen.push(`${m.type()}: ${m.text()}`)
  })
  page.on('pageerror', (e) => meldungen.push(`pageerror: ${e.message}`))
  await page.goto(adresse)
  return page
}
const foto = (page, name, ganz = false) => page.screenshot({ path: `${ziel}/${name}.png`, fullPage: ganz })
const schritt = (page, name) => page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name }).click()

// Hell, Desktop
const page = await seite()
await page.waitForTimeout(600)
await foto(page, '01-start')
await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
await page.waitForTimeout(1500)
await foto(page, '02-pruefen')
await page.getByRole('button', { name: 'Zum Schritt' }).first().click()
await page.waitForTimeout(1200)
await foto(page, '03-bearbeiten')
await page.getByRole('button', { name: 'Fertig' }).click()
await page.getByRole('button', { name: /Eine Aufgabe/ }).click()
await page.waitForTimeout(800)
await foto(page, '04-neue-aufgabe')
await page.getByRole('button', { name: 'Abbrechen' }).click()
await schritt(page, /Verbessern/)
await page.waitForTimeout(1200)
await page.getByRole('button', { name: 'Übernehmen' }).first().click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Übernehmen' }).first().click()
await page.waitForTimeout(1500)
await foto(page, '05-verbessern-soll')
await schritt(page, /Bericht/)
await page.waitForTimeout(2500)
await foto(page, '06-bericht', true)

// Dunkel
const dunkel = await seite({ colorScheme: 'dark' })
await dunkel.getByRole('button', { name: /Mit dem Beispiel/ }).click()
await dunkel.waitForTimeout(1500)
await foto(dunkel, '07-dunkel-pruefen')

// Handy
const handy = await seite({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
await handy.waitForTimeout(600)
await foto(handy, '08-handy-start')
await handy.getByRole('button', { name: /Mit dem Beispiel/ }).click()
await handy.waitForTimeout(1500)
await foto(handy, '09-handy-pruefen', true)

console.log(meldungen.join('\n') || 'keine Konsolenfehler')
await browser.close()
