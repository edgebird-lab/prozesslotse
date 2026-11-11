import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/** Prüft die Seite mit axe; das bpmn-js-Diagramm (Fremdbibliothek, als Bild beschriftet) bleibt außen vor. */
async function pruefe(page: Page) {
  const ergebnis = await new AxeBuilder({ page }).exclude('.djs-container').analyze()
  const schwer = ergebnis.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(schwer.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)).toEqual([])
}

const SCHRITTE = ['Rahmen', 'Beteiligte', 'Ablauf', 'Prüfen', 'Verbessern', 'Bericht']

for (const schema of ['light', 'dark'] as const) {
  test(`alle Schritte ohne schwere Barrieren (${schema === 'light' ? 'hell' : 'dunkel'})`, async ({ page }) => {
    // sieben Seiten mit axe: braucht neben den übrigen, parallel laufenden Tests mehr als die üblichen 30 Sekunden
    test.setTimeout(60_000)
    await page.emulateMedia({ colorScheme: schema })
    await page.goto('/')
    await pruefe(page)
    await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
    for (const name of SCHRITTE) {
      await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: new RegExp(name) }).click()
      await page.waitForTimeout(300)
      await pruefe(page)
    }
  })
}

test('jedes Eingabefeld hat eine Beschriftung', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  for (const name of ['Rahmen', 'Beteiligte', 'Ablauf']) {
    await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: new RegExp(name) }).click()
    if (name === 'Ablauf') await page.getByRole('button', { name: /Bestellung in Warenwirtschaft erfassen/ }).click()
    const ohne = await page.locator('input:not([type="hidden"]):not([hidden]), select, textarea').evaluateAll((els) =>
      els
        .filter((e) => !(e as HTMLInputElement).labels?.length && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby'))
        .map((e) => e.outerHTML.slice(0, 80)),
    )
    expect(ohne).toEqual([])
  }
})
