import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

// Zusammenführung von compliance mit der Modellierung (Format 4): „Dokumentieren“ mit Aufgaben in einem
// Abschnitt und einer Unterbrechung. Die Datei ist das Beispiel „Lieferdienst“ mit Compliance-Angaben;
// „Ware kommissionieren“ und „Kommissionierung kontrollieren“ bilden den Abschnitt „Ware bereitstellen“,
// „Ware ausliefern“ hat die Unterbrechung „Kunde storniert“ mit dem Schritt „Storno buchen“. Uhr fest auf den 11.11.2026.

const DATEI = fileURLToPath(new URL('./daten/lieferdienst-abschnitt.prozesslotse', import.meta.url))

const leiste = (page: Page) => page.getByRole('navigation', { name: 'Teilschritte' })
const teil = (page: Page, name: string) => leiste(page).getByRole('button', { name: new RegExp(`^${name}`) })
const schritt = (page: Page, name: string) => page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: new RegExp(name) })

async function start(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00'))
  await page.goto('/')
  await page.locator('input[type="file"][accept*="application/json"]').setInputFiles(DATEI)
  await expect(page.getByRole('status')).toContainText('geladen')
  await schritt(page, 'Dokumentieren').click()
  await expect(leiste(page)).toBeVisible()
}

test('Markierungen und „Beheben“ an einer Aufgabe im Abschnitt, Kapitel 4 mit Abschnitt und Unterbrechung', async ({ page }) => {
  await start(page)
  // Bühne: dieselben drei Markierungen wie ohne Abschnitt, die Kontrolle im Abschnitt trägt ihre
  const buehne = page.getByRole('region', { name: 'Diagramm' })
  await expect(buehne.locator('.pl-abzeichen')).toHaveCount(3)
  await expect(buehne.locator('.djs-overlays[data-container-id="auf_kontrollieren"] .pl-abzeichen')).toHaveCount(1)
  await expect(buehne.locator('.djs-element[data-element-id="tp_bereitstellen"]')).toHaveCount(1)

  // „Beheben“ springt zur Frage nach dem Nachweis der Kontrolle im Abschnitt
  await teil(page, 'Lücken').click()
  await page.getByRole('button', { name: /^Beheben: Kontrolle ohne Nachweis – Kommissionierung kontrollieren/ }).click()
  await expect(teil(page, 'Kontrollen')).toHaveAttribute('aria-current', 'step')
  const nachweis = page.locator('#ziel-kontrolle-auf_kontrollieren').getByRole('group', { name: 'Wie wird die Kontrolle nachgewiesen?' })
  await expect(nachweis.getByRole('radio', { name: 'Kein Nachweis' })).toBeFocused()

  // Kapitel 4: Abschnitt als erste Zeile seines ersten Schritts, die Unterbrechung beim unterbrochenen Schritt,
  // ihr Ausnahmeweg direkt dahinter
  await teil(page, 'Dokumente').click()
  const dokument = page.locator('.dokument')
  await expect(dokument).toContainText('Abschnitt „Ware bereitstellen“ mit den Schritten 4.6 bis 4.7.')
  await expect(dokument).toContainText('Ausnahme: Tritt „Kunde storniert“ ein (Nachricht von Kunde), wird der Schritt abgebrochen; weiter mit 4.11, danach endet der Vorgang mit „Lieferung storniert“.')
  await expect(dokument).toContainText('4.11 Storno buchen')
  await expect(dokument).toContainText('Nur wenn: „Kunde storniert“ tritt während 4.10 ein.')
})

test('Anlage 9.1 mit Abschnitt und Randereignis: jede Form und der Name des Abschnitts ganz in einem Ausschnitt', async ({ page }) => {
  await start(page)
  await teil(page, 'Dokumente').click()
  const anlage = page.locator('.dokument-diagramm')
  await expect(anlage.locator('.djs-element.djs-shape').first()).toBeAttached()
  // Formen samt Beschriftung wie bpmn-js sie zeichnet; von einem Rahmen (Teilprozess mit Inhalt) zählt nur sein Name
  const formen = await anlage.locator('.djs-element.djs-shape[data-element-id]').evaluateAll((els) => {
    const m = new Map<string, { x1: number; y1: number; x2: number; y2: number; rahmen: boolean }>()
    for (const el of els as SVGGElement[]) {
      const id = el.getAttribute('data-element-id')!
      const basis = id.replace(/_label$/, '')
      if (basis === 'Teilnehmer' || /^(Pool|Bahn)_/.test(basis)) continue
      const sicht = el.querySelector('.djs-visual') as SVGGraphicsElement | null
      const t = el.transform.baseVal.consolidate()?.matrix
      if (!sicht || !t) continue
      const rahmen = !!el.parentElement?.querySelector(':scope > .djs-children > .djs-group')
      const b = (rahmen ? (sicht.querySelector('text') as SVGGraphicsElement | null) : sicht)?.getBBox()
      if (!b || (b.width === 0 && b.height === 0)) continue
      const r = { x1: b.x + t.e, y1: b.y + t.f, x2: b.x + t.e + b.width, y2: b.y + t.f + b.height, rahmen }
      const alt = m.get(basis)
      m.set(basis, alt ? { ...r, x1: Math.min(alt.x1, r.x1), y1: Math.min(alt.y1, r.y1), x2: Math.max(alt.x2, r.x2), y2: Math.max(alt.y2, r.y2) } : r)
    }
    return [...m.entries()].map(([id, r]) => ({ id, ...r }))
  })
  expect(formen.filter((f) => f.rahmen).map((f) => f.id)).toEqual(['tp_bereitstellen'])
  expect(formen.length).toBeGreaterThan(35)

  await page.emulateMedia({ media: 'print' })
  await page.setViewportSize({ width: 680, height: 900 })
  const ausschnitte = anlage.locator('.druck-ausschnitt')
  expect(await ausschnitte.count()).toBeGreaterThan(1)
  const masse = await ausschnitte.evaluateAll((els) => els.map((el) => ({ x: Number((el as HTMLElement).dataset.x), y: Number((el as HTMLElement).dataset.y), breite: Number((el as HTMLElement).dataset.breite), hoehe: Number((el as HTMLElement).dataset.hoehe) })))
  for (const f of formen) {
    const ganz = masse.some((a) => f.x1 >= a.x - 0.2 && f.x2 <= a.x + a.breite + 0.2 && f.y1 >= a.y - 0.2 && f.y2 <= a.y + a.hoehe + 0.2)
    expect(ganz, `${f.id} (${Math.round(f.x1)}–${Math.round(f.x2)})`).toBe(true)
  }
})
