import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

async function rahmenUndRolle(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByLabel('Wie heißt der Prozess?').fill('Kommissionierung')
  await page.getByLabel('Was ist das Ergebnis, wenn alles normal läuft?').fill('Ware bereit')
  await page.getByRole('button', { name: 'Weiter: Wer ist beteiligt?' }).click()
  await page.getByRole('button', { name: '+ Rolle' }).click()
  await page.getByLabel('Name der Rolle 1').fill('Lager')
  await page.getByRole('button', { name: 'Weiter: Ablauf beschreiben' }).click()
}

async function aufgabe(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: /Eine Aufgabe/ }).click()
  await page.getByLabel('Was wird getan?').fill(name)
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
}

test('legt „für jede Position“ über den Assistenten an', async ({ page }) => {
  await rahmenUndRolle(page)
  await aufgabe(page, 'Auftrag erfassen')

  // Bausteinwahl und Fragen: Wofür ist Pflicht, die Anzahl zeigt live, was das am Tag bedeutet
  await page.getByRole('button', { name: /Etwas für jedes Stück einer Liste/ }).click()
  await expect(page.getByRole('button', { name: 'Hinzufügen' })).toBeDisabled()
  await page.getByLabel('Wofür?').fill('Für jede Position')
  await page.getByLabel('Wie viele hat ein einzelner Vorgang im Schnitt?').fill('2,5')
  await expect(page.getByText('Bei 20 Vorgängen am Tag sind das 50 am Tag.')).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Ja' })).toBeChecked()
  await expect(page.getByRole('radio', { name: /Eine Person arbeitet sie der Reihe nach ab/ })).toBeChecked()
  await page.getByLabel('Wie lange liegt der Vorgang, bevor jemand mit dem ersten Stück anfängt?').fill('60')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()

  // Danach steht die Einfügeposition im Körper; neue Aufgaben fragen nach der Wartezeit zwischen zwei Stücken
  await expect(page.getByText('je Stück in „Für jede Position“, am Anfang')).toBeVisible()
  await page.getByRole('button', { name: /Eine Aufgabe/ }).click()
  await expect(page.getByLabel('Wartezeit zwischen zwei Stücken')).toBeVisible()
  await expect(page.getByText('Liegezeit zählt einmal, Bearbeitung je Stück: 2,5 × 5 Min.')).toBeVisible()
  await page.getByLabel('Was wird getan?').fill('Position kommissionieren')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await page.getByRole('button', { name: /Weiter nach „Für jede Position“/ }).click()
  await expect(page.getByText('im Hauptablauf, nach „Für jede Position“')).toBeVisible()

  // Gliederung: Name, Anzahl, Ausführung und Liegezeit, darunter die Schritte je Stück
  const eintrag = page.getByRole('button', { name: /Für jede Position\s*Ø 2,5 · nacheinander · liegt 1 Std\./ })
  await expect(eintrag).toBeVisible()
  await expect(page.getByText('je Stück', { exact: true })).toBeVisible()

  // BPMN-Export: Mehrfachinstanz an der einzelnen Aufgabe, ohne Anzahl (2,5 ist keine gültige Anzahl)
  await page.getByText('Projekt', { exact: true }).click()
  const [bpmn] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Als BPMN exportieren' }).click()])
  const xml = await readFile((await bpmn.path())!, 'utf8')
  expect(xml).toContain('<bpmn:multiInstanceLoopCharacteristics isSequential="true" />')
  expect(xml).toContain('Für jede Position: im Schnitt 2,5 Stück je Vorgang, immer etwa gleich viele, der Reihe nach; Liegezeit vor dem ersten Stück 1 Std.')

  // Zur selben Zeit: Die Markierung wechselt, die Prüfung weist auf die eine Person im Lager hin
  await eintrag.click()
  await expect(page.getByRole('heading', { name: /Für jedes Stück bearbeiten/ })).toBeVisible()
  await expect(page.getByText('Im Diagramm trägt die Aufgabe „Position kommissionieren“ die Markierung für mehrere Stücke.')).toBeVisible()
  await page.locator('label', { hasText: 'Zur selben Zeit' }).click()
  await expect(page.getByRole('radio', { name: /Zur selben Zeit/ })).toBeChecked()
  await expect(page.getByRole('button', { name: /Für jede Position\s*Ø 2,5 · gleichzeitig/ })).toBeVisible()
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Prüfen/ }).click()
  await expect(page.getByText(/^keine Fehler/)).toBeVisible()
  await expect(page.getByText('Gleichzeitig, aber zu wenig Leute')).toBeVisible()
  await expect(page.getByText('Vor dem ersten Stück von „Für jede Position“').first()).toBeVisible()
})

test('wandelt eine Mengenschleife aus einer älteren Datei auf Wunsch um, mit denselben Zahlen', async ({ page }) => {
  const lager = { id: 'rol_lager', name: 'Lager', stundensatz: 45, personen: 1, verfuegbarProzent: 100 }
  const aufgabe = (id: string, name: string, bearbeitungMin: number) => ({
    typ: 'aufgabe',
    id,
    name,
    rolleId: lager.id,
    mediumId: null,
    bearbeitungMin,
    liegezeitMin: 10,
    art: 'normal',
    freigabeQuote: 0.9,
    brauchtVorgaenger: null,
    uebertragung: null,
  })
  const schleife = { typ: 'wiederholung', id: 'wdh_pos', modus: 'anteil', zweck: 'menge', frage: 'Weitere Position?', anteilWiederholung: 0.6, koerper: { id: 'k_pos', schritte: [aufgabe('auf_pos', 'Position erfassen', 4)] } }
  const ist = {
    formatVersion: 4,
    id: 'pro_alt',
    name: 'Auftrag erfassen',
    beschreibung: '',
    ausloeser: { art: 'manuell', text: 'Auftrag liegt vor' },
    ergebnis: 'Auftrag erfasst',
    vorgaengeProTag: 20,
    arbeitsstundenProTag: 8,
    rollen: [lager],
    medien: [],
    teilnehmer: [],
    ablauf: { id: 'haupt', schritte: [aufgabe('auf_kopf', 'Kopfdaten erfassen', 5), schleife] },
  }
  const projekt = { formatVersion: 4, ist, soll: null, massnahmen: [], verworfen: [] }
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles({ name: 'alt.prozesslotse', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(projekt)) })
  await expect(page.getByRole('status')).toContainText('geladen')

  // Die Wiederholung zeigt „Mehrere Durchgänge“ nur, weil es schon gesetzt ist, und verweist auf den neuen Baustein
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Ablauf/ }).click()
  await page.getByRole('button', { name: /Wiederholung: Weitere Position\?/ }).click()
  await expect(page.getByRole('radio', { name: /Mehrere Durchgänge/ })).toBeChecked()
  await expect(page.getByText(/bildet der Baustein „Etwas für jedes Stück einer Liste“ besser ab/)).toBeVisible()

  // Prüfen: Hinweis mit Knopf; die Durchlaufzeit bleibt beim Umwandeln gleich
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Prüfen/ }).click()
  const hinweis = page.locator('.befund', { hasText: 'Als „für jedes Stück“ abbilden?' })
  await expect(hinweis).toBeVisible()
  const kachel = page.locator('.kachel-haupt .kachel-wert')
  const vorher = await kachel.textContent()
  await hinweis.getByRole('button', { name: 'Umwandeln' }).click()
  await expect(page.locator('.befund', { hasText: 'Als „für jedes Stück“ abbilden?' })).toHaveCount(0)
  await expect(kachel).toHaveText(vorher!)

  // Im Ablauf steht jetzt „für jedes Stück“: 2,5 Stücke im Schnitt, schwankend, der Reihe nach
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Ablauf/ }).click()
  await expect(page.getByRole('button', { name: /Weitere Position\s*Ø 2,5 · nacheinander · schwankt/ })).toBeVisible()
  // Neue Wiederholungen bieten „Mehrere Durchgänge“ nicht mehr an
  await page.getByRole('button', { name: 'Fertig', exact: true }).click()
  await page.getByRole('button', { name: /Etwas wird wiederholt/ }).click()
  await expect(page.getByRole('radio', { name: /Mehrere Durchgänge/ })).toHaveCount(0)
  await expect(page.getByText('Für mehrere gleiche Durchgänge, z. B. je Position, gibt es den Baustein „Etwas für jedes Stück einer Liste“.')).toBeVisible()
})
