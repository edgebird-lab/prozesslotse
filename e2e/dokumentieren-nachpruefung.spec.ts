import { expect, test, type Page } from '@playwright/test'

// Browsertests zur Nachprüfung vom 11.11.2026 (regression, sicht, erledigt), Uhr fest auf den 11.11.2026

const leiste = (page: Page) => page.getByRole('navigation', { name: 'Teilschritte' })
const teil = (page: Page, name: string) => leiste(page).getByRole('button', { name: new RegExp(`^${name}`) })
const schritt = (page: Page, name: string) => page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: new RegExp(name) })

async function start(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00'))
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
}

// ---------- regression, Mangel 2: Nachladen scheitert ----------

for (const [teilName, muster] of [
  ['„Dokumentieren“', /DokumentierenSchritt-[\w-]+\.js$/],
  ['die Lückenprüfung', /\/analyse-[\w-]+\.js$/],
  ['die Versionen', /\/versionen-[\w-]+\.js$/],
] as const) {
  test(`lädt ${teilName} nicht nach, bleibt die App bedienbar und bietet „Neu laden“ an`, async ({ page }) => {
    const fehler: string[] = []
    page.on('pageerror', (e) => fehler.push(e.message))
    await start(page)
    await page.route(muster, (r) => r.abort())
    await schritt(page, 'Dokumentieren').click()
    const meldung = page.getByRole('alert').filter({ hasText: 'ließ sich nicht laden' })
    await expect(meldung).toBeVisible()
    await expect(meldung).toContainText('Die anderen Schritte funktionieren weiter.')
    // die übrigen Schritte bleiben bedienbar
    await schritt(page, 'Ablauf').click()
    await expect(page.getByRole('region', { name: 'Assistent' })).toBeVisible()
    await expect(meldung).toBeHidden()
    await schritt(page, 'Dokumentieren').click()
    await expect(meldung).toBeVisible()
    expect(fehler).toEqual([])
    // „Neu laden“ holt die Teile neu; der Stand kommt aus dem Browser-Speicher
    await page.unroute(muster)
    await meldung.getByRole('button', { name: 'Neu laden' }).click()
    await page.waitForLoadState('load')
    await schritt(page, 'Dokumentieren').click()
    await expect(teil(page, 'Lücken')).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'ließ sich nicht laden' })).toHaveCount(0)
  })
}
