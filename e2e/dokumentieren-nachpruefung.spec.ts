import { readFile, writeFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from '@playwright/test'

// Browsertests zur Nachprüfung vom 11.11.2026 (regression, sicht, erledigt), Uhr fest auf den 11.11.2026

const leiste = (page: Page) => page.getByRole('navigation', { name: 'Teilschritte' })
const teil = (page: Page, name: string) => leiste(page).getByRole('button', { name: new RegExp(`^${name}`) })
const schritt = (page: Page, name: string) => page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: new RegExp(name) })

async function start(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00'))
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
}

async function freigeben(page: Page) {
  await teil(page, 'Dokumente').click()
  await page.getByRole('button', { name: 'Version freigeben …' }).click()
  const dialog = page.getByRole('dialog', { name: 'Version freigeben' })
  await dialog.getByRole('button', { name: 'Freigeben', exact: true }).click()
  await expect(dialog).toBeHidden()
}

/** Speichert das Projekt als Datei (Download) und liefert den Inhalt als JSON-Daten. */
async function alsDatei(page: Page): Promise<Record<string, any>> {
  await page.getByText('Projekt', { exact: true }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Als Datei speichern' }).click()])
  return JSON.parse(await readFile((await download.path())!, 'utf8'))
}

/** Oberkante der ersten Textzeile je Zelle */
function textOben(zeile: Locator): Promise<number[]> {
  return zeile.evaluate((tr) =>
    [...tr.children].map((zelle) => {
      const r = document.createRange()
      r.selectNodeContents(zelle)
      return Math.round(r.getClientRects()[0]?.top ?? zelle.getBoundingClientRect().top)
    }),
  )
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

// ---------- sicht, Mängel 4 bis 6 ----------

test('sicht 4: Versionsliste: alle Zellen einer Zeile beginnen oben, auch die Zelle „Version“', async ({ page }) => {
  await start(page)
  await schritt(page, 'Dokumentieren').click()
  await freigeben(page)
  const zeile = page.getByRole('region', { name: 'Versionen' }).getByRole('row').nth(1)
  await expect(zeile).toContainText('Prüfsumme stimmt')
  // ohne Prüfsumme (kleinere Schrift im Code) und Knöpfe (eigener Innenabstand)
  const oben = (await textOben(zeile)).slice(0, -2)
  expect(Math.max(...oben) - Math.min(...oben), `Oberkanten: ${oben.join(', ')}`).toBeLessThanOrEqual(2)
  await expect(zeile.getByRole('rowheader')).toHaveCSS('vertical-align', 'top')
})

test('sicht 5: „Rollen im Ablauf“: feste Aufteilung, normale Zellschrift, Spalte Organisation reserviert, „extern“ nur einmal', async ({ page }) => {
  await start(page)
  await schritt(page, 'Dokumentieren').click()
  const rollen = page.getByRole('region', { name: 'Rollen im Ablauf' })
  const tabelle = rollen.getByRole('table')
  const breiten = () => tabelle.locator('thead th').evaluateAll((ths) => ths.map((t) => Math.round(t.getBoundingClientRect().width)))
  await expect(tabelle.locator('thead th')).toHaveCount(3)
  const vorher = await breiten()
  const zeile = rollen.getByRole('row', { name: /Buchhaltung/ })
  await zeile.locator('label.schalter').click()
  await expect(zeile.getByRole('switch', { name: 'Buchhaltung: extern' })).toBeChecked()
  const feld = zeile.getByRole('textbox', { name: 'Organisation von Buchhaltung' })
  await feld.fill('Steuerkanzlei Beispiel & Partner mbB')
  // Die Spalten springen beim Umschalten nicht
  expect(await breiten()).toEqual(vorher)
  // Der lange Name passt ganz ins Feld
  expect(await feld.evaluate((e: HTMLInputElement) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(0)
  // Rollennamen in normaler Zellschrift wie der Text darüber
  const rolle = zeile.getByRole('rowheader')
  await expect(rolle).toHaveCSS('font-weight', '400')
  const text = await rollen.locator('p.leise').first().evaluate((e) => getComputedStyle(e.parentElement!).fontSize)
  await expect(rolle).toHaveCSS('font-size', text)
  // „extern“ steht sichtbar nur im Spaltenkopf; der Schalter nennt es für Screenreader
  const sichtbar = await zeile.evaluate((tr) => {
    const kopie = tr.cloneNode(true) as HTMLElement
    kopie.querySelectorAll('.sr').forEach((e) => e.remove())
    return kopie.textContent ?? ''
  })
  expect(sichtbar).not.toMatch(/extern/i)
})

test('sicht 6: bei falscher Prüfsumme warnen Zustandszeile, Lücken und Teilschritt', async ({ page }, info) => {
  await start(page)
  await schritt(page, 'Dokumentieren').click()
  await freigeben(page)
  await expect(page.locator('.status-zeile')).toHaveText('Gültige Version 1.0 seit 11.11.2026')
  await expect(teil(page, 'Dokumente')).toHaveAccessibleName(/keine offenen Punkte/)
  // Einen Absatz der Version in der Datei verändern
  const d = await alsDatei(page)
  const abschnitte = d.compliance.versionen[0].verfahrensdoku.abschnitte
  abschnitte[abschnitte.findIndex((a: { art: string }) => a.art === 'absatz')].text = 'Nachträglich geändert.'
  const pfad = info.outputPath('veraendert.prozesslotse')
  await writeFile(pfad, JSON.stringify(d))
  await page.locator('input[type="file"][accept*="application/json"]').setInputFiles(pfad)
  await expect(page.getByRole('status')).toContainText('Prüfsumme stimmt nicht – Version 1.0 wurde verändert oder ist beschädigt.')
  await schritt(page, 'Dokumentieren').click()
  await teil(page, 'Dokumente').click()
  await expect(page.locator('.status-zeile')).toHaveText('Gültige Version 1.0 seit 11.11.2026 – Prüfsumme stimmt nicht')
  // Warnsymbol (Zahl offener Punkte) statt Häkchen am Teilschritt
  await expect(teil(page, 'Dokumente')).toHaveAccessibleName(/1 offener Punkt/)
  await expect(teil(page, 'Dokumente').locator('.teilschritt-zahl')).toHaveText('1')
  await teil(page, 'Lücken').click()
  const befund = page.locator('.befunde li').filter({ hasText: 'Prüfsumme stimmt nicht' })
  await expect(befund).toHaveCount(1)
  await expect(befund).toContainText('Version 1.0 passt nicht mehr zu ihrer Prüfsumme')
  await expect(befund.getByRole('button', { name: 'Beheben: Prüfsumme stimmt nicht – Version 1.0' })).toBeVisible()
})

// ---------- erledigt, Restfunde ----------

test('bedienung-6: Die Auswahl „Nachweis“ einer weiteren Kontrolle zeigt ihren Text ganz', async ({ page }) => {
  await start(page)
  await schritt(page, 'Dokumentieren').click()
  await teil(page, 'Kontrollen').click()
  await page.getByRole('button', { name: '+ Weitere Kontrolle' }).click()
  const karte = page.getByRole('group', { name: 'Weitere Kontrolle 1' })
  const auswahl = karte.getByLabel('Nachweis')
  await auswahl.selectOption({ label: 'Abgezeichnet mit Datum und Kürzel' })
  const mass = await auswahl.evaluate((s: HTMLSelectElement) => {
    const st = getComputedStyle(s)
    const ctx = document.createElement('canvas').getContext('2d')!
    ctx.font = st.font
    return { text: Math.ceil(ctx.measureText(s.selectedOptions[0].text).width), innen: Math.floor(s.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight)) }
  })
  // rund 24 px braucht der Pfeil der Auswahl
  expect(mass.text + 24, JSON.stringify(mass)).toBeLessThanOrEqual(mass.innen)
})
