import { expect, test, type Page } from '@playwright/test'

// Browsertests zu Druck und Darstellung der Compliance-Doku, Uhr fest auf den 11.11.2026

const leiste = (page: Page) => page.getByRole('navigation', { name: 'Teilschritte' })
const teil = (page: Page, name: string) => leiste(page).getByRole('button', { name: new RegExp(`^${name}`) })
const schritt = (page: Page, name: string) => page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: new RegExp(name) })

async function start(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00'))
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  await schritt(page, 'Dokumentieren').click()
}

/** Zahl der Bildpunkte, in denen sich zwei gleich große Bildschirmfotos deutlich unterscheiden (im Browser ausgewertet). */
async function unterschied(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(
    async ([x, y]) => {
      const pixel = async (b64: string) => {
        const bild = new Image()
        bild.src = `data:image/png;base64,${b64}`
        await bild.decode()
        const leinwand = document.createElement('canvas')
        leinwand.width = bild.naturalWidth
        leinwand.height = bild.naturalHeight
        const g = leinwand.getContext('2d')!
        g.drawImage(bild, 0, 0)
        return g.getImageData(0, 0, leinwand.width, leinwand.height).data
      }
      const [p, q] = await Promise.all([pixel(x), pixel(y)])
      let n = 0
      for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]) > 60) n++
      return n
    },
    [a.toString('base64'), b.toString('base64')],
  )
}

test('Anlage 9.1: im Druck nach der Übersicht lesbare Ausschnitte mit Überlappung (abnahme-1)', async ({ page }) => {
  await start(page)
  await teil(page, 'Dokumente').click()
  const anlage = page.locator('.dokument-diagramm')
  await expect(anlage.locator('.druck-bild')).toHaveCount(1)
  await expect(anlage).toContainText('Das Diagramm in Originalgröße enthält die BPMN-Datei des Ist-Prozesses (Kapitel 6).')
  const ausschnitte = anlage.locator('.druck-ausschnitt')
  // am Bildschirm nur das bedienbare Diagramm
  await expect(ausschnitte.first()).toBeHidden()

  // Satzbreite im Druck: A4 mit 15 mm Rand = 180 mm ≈ 680 px
  await page.emulateMedia({ media: 'print' })
  await page.setViewportSize({ width: 680, height: 900 })
  await expect(anlage.locator('.druck-bild')).toBeVisible()
  const m = await ausschnitte.count()
  expect(m).toBeGreaterThan(1)
  for (let i = 0; i < m; i++) await expect(ausschnitte.nth(i)).toContainText(`Ausschnitt ${i + 1} von ${m}`)

  const masse = await ausschnitte.evaluateAll((els) =>
    els.map((el) => {
      const r = el.querySelector('img')!.getBoundingClientRect()
      const d = (el as HTMLElement).dataset
      return { x: Number(d.x), y: Number(d.y), breite: Number(d.breite), hoehe: Number(d.hoehe), gedreht: d.gedreht === 'ja', bildBreite: r.width, bildHoehe: r.height }
    }),
  )
  for (const a of masse) {
    // Maßstab: Druckpixel je Diagrammpixel; 11-px-Beschriftungen von bpmn-js werden so mindestens etwa 5 pt groß
    const massstab = (a.gedreht ? a.bildHoehe : a.bildBreite) / a.breite
    expect(11 * massstab * 0.75).toBeGreaterThanOrEqual(4.9)
    // passt auf eine Seite (180 × 264 mm abzüglich Unterschrift)
    expect(a.bildBreite).toBeLessThanOrEqual(681)
    expect(a.bildHoehe).toBeLessThanOrEqual(910)
  }
  // Nachbarn in einer Zeile überlappen sich um etwa 40 px, nichts fällt zwischen zwei Ausschnitte
  for (let i = 1; i < masse.length; i++) {
    if (masse[i].y !== masse[i - 1].y) continue
    const ueberlappung = masse[i - 1].x + masse[i - 1].breite - masse[i].x
    expect(ueberlappung).toBeGreaterThanOrEqual(30)
    expect(ueberlappung).toBeLessThanOrEqual(50)
  }
})

for (const breite of [1440, 1280, 1024]) {
  test(`Aufbewahrung: die Fristentabelle passt bei ${breite} px ins Panel, das Löschdatum ist ganz zu sehen (abnahme-2, bedienung-6)`, async ({ page }) => {
    await page.setViewportSize({ width: breite, height: 900 })
    await start(page)
    // eine Unterlage mit langem Namen aus einem Wort
    await teil(page, 'Belege und Daten').click()
    const neu = page.getByRole('form', { name: 'Neue Unterlage' })
    await neu.getByLabel('Name, z. B. „Ausgangsrechnung“').fill('Lieferantenrechnungseingangsbuch')
    await neu.getByRole('button', { name: '+ Unterlage anlegen' }).click()
    await expect(page.getByRole('region', { name: 'Lieferantenrechnungseingangsbuch' })).toBeVisible()

    await teil(page, 'Aufbewahrung und Löschung').click()
    const tabelle = page.locator('.fristen-tabelle')
    await expect(tabelle).toContainText('01.01.2033')
    const { hulle, rechts, daten } = await tabelle.evaluate((t) => {
      const w = t.parentElement!
      const zeile = (td: Element) => {
        const r = document.createRange()
        r.selectNodeContents(td)
        return { text: td.textContent ?? '', zeilen: new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size, rechts: r.getBoundingClientRect().right }
      }
      return {
        hulle: { client: w.clientWidth, scroll: w.scrollWidth, rechts: w.getBoundingClientRect().right },
        rechts: Math.max(...[...t.querySelectorAll('th, td')].map((z) => z.getBoundingClientRect().right)),
        daten: [...t.querySelectorAll('tbody td:last-child')].map(zeile).filter((z) => /^\d{2}\.\d{2}\.\d{4}$/.test(z.text)),
      }
    })
    expect(hulle.scroll).toBeLessThanOrEqual(hulle.client)
    expect(rechts).toBeLessThanOrEqual(hulle.rechts + 0.5)
    expect(daten.length).toBeGreaterThan(1)
    for (const d of daten) {
      expect(d.zeilen, d.text).toBe(1)
      expect(d.rechts, d.text).toBeLessThanOrEqual(hulle.rechts)
    }
  })
}

for (const breite of [1440, 1024]) {
  test(`Teilschritt-Leiste: Knöpfe einer Zeile sind gleich hoch bei ${breite} px (abnahme-7)`, async ({ page }) => {
    await page.setViewportSize({ width: breite, height: 900 })
    await start(page)
    const knoepfe = await leiste(page)
      .getByRole('button')
      .evaluateAll((bs) => bs.map((b) => ({ oben: Math.round(b.parentElement!.getBoundingClientRect().top), hoehe: b.getBoundingClientRect().height, zelle: b.parentElement!.getBoundingClientRect().height })))
    const zeilen = new Map<number, number[]>()
    for (const k of knoepfe) zeilen.set(k.oben, [...(zeilen.get(k.oben) ?? []), k.hoehe])
    // mindestens eine Zeile mit zweizeiligem Namen, sonst prüft der Test nichts
    expect(Math.max(...knoepfe.map((k) => k.hoehe)) - Math.min(...knoepfe.map((k) => k.hoehe))).toBeGreaterThan(5)
    for (const [oben, hoehen] of zeilen) expect(Math.max(...hoehen) - Math.min(...hoehen), `Zeile bei ${oben} px`).toBeLessThan(1)
    for (const k of knoepfe) expect(k.zelle - k.hoehe).toBeLessThan(1)
  })
}

for (const breite of [1440, 1024]) {
  test(`Benennung: der Platzhalter mit dem Prozessnamen ist bei ${breite} px ganz zu lesen (abnahme-10)`, async ({ page }) => {
    await page.setViewportSize({ width: breite, height: 900 })
    await start(page)
    const feld = page.getByLabel('Benennung')
    await expect(feld).toHaveAttribute('placeholder', 'Bestellung bis Rechnung (Lieferdienst)')
    const { text, innen } = await feld.evaluate((el: HTMLInputElement) => {
      const cs = getComputedStyle(el)
      const g = document.createElement('canvas').getContext('2d')!
      g.font = cs.font
      return { text: g.measureText(el.placeholder).width, innen: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) }
    })
    expect(text).toBeLessThanOrEqual(innen)
  })
}

for (const schema of ['light', 'dark'] as const) {
  test(`Reiter der Dokumente: der Fokusring ist zu sehen (${schema === 'light' ? 'hell' : 'dunkel'}, bedienung-11)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: schema })
    await start(page)
    await teil(page, 'Dokumente').click()
    const reiter = page.getByRole('tablist', { name: 'Dokument' })
    const box = (await reiter.boundingBox())!
    const ausschnitt = { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 }
    // Ohne Fokus und mit Tastaturfokus auf dem gewählten Reiter vergleichen
    await page.getByRole('button', { name: 'Version freigeben …' }).focus()
    await page.mouse.move(0, 0)
    const ohne = await page.screenshot({ clip: ausschnitt, animations: 'disabled' })
    // Tab führt über die Versionsliste zum gewählten Reiter
    for (let i = 0; i < 6 && !(await page.getByRole('tab', { name: 'Verfahrensdokumentation' }).evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
    await expect(page.getByRole('tab', { name: 'Verfahrensdokumentation' })).toBeFocused()
    const mit = await page.screenshot({ clip: ausschnitt, animations: 'disabled' })
    // Ein voller Ring um den Reiter (etwa 200 × 35 px) ändert mehrere hundert Bildpunkte, ein abgeschnittener nur eine Kante
    expect(await unterschied(page, ohne, mit)).toBeGreaterThan(400)
  })
}

for (const breite of [390, 360]) {
  test(`schmales Fenster (${breite} px): „Aufbewahrung und Löschung“ und „Dokumente“ ohne waagrechtes Scrollen (bedienung-26)`, async ({ page }) => {
    await page.setViewportSize({ width: breite, height: 800 })
    await start(page)
    for (const name of ['Aufbewahrung und Löschung', 'Dokumente']) {
      await teil(page, name).click()
      await expect(teil(page, name)).toHaveAttribute('aria-current', 'step')
      await page.waitForTimeout(200)
      expect(await page.evaluate(() => document.documentElement.scrollWidth), name).toBeLessThanOrEqual(breite)
    }
  })
}

test('Dokumente: Paragrafenzeichen und Abkürzungen bleiben mit der Zahl in einer Zeile (recht-18)', async ({ page }) => {
  await start(page)
  await teil(page, 'Dokumente').click()
  for (const reiter of ['Verfahrensdokumentation', 'Verarbeitungsverzeichnis']) {
    await page.getByRole('tab', { name: reiter }).click()
    const text = await page.locator('.dokument').evaluate((d) => d.textContent ?? '')
    expect(text, reiter).toMatch(/§\u00a0\d/)
    expect(text.match(/(?:§§?|\b(?:Abs|Nr|Art|Rz|lit|Ziff)\.) [\dA-Za-z]/g), reiter).toBeNull()
  }
})
