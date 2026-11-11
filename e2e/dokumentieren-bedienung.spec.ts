import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

// Browsertests zu Bedienung, Barrierefreiheit und Sprache im Schritt „Dokumentieren“, Uhr fest auf den 11.11.2026

const TEILSCHRITTE = ['Unternehmen', 'Belege und Daten', 'Systeme und Dienstleister', 'Aufbewahrung und Löschung', 'Kontrollen', 'Schutzmaßnahmen', 'Lücken', 'Dokumente']

const leiste = (page: Page) => page.getByRole('navigation', { name: 'Teilschritte' })

const teil = (page: Page, name: string) => leiste(page).getByRole('button', { name: new RegExp(`^${name}`) })

const schritt = (page: Page, name: string) => page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: new RegExp(name) })

async function start(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00'))
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  await schritt(page, 'Dokumentieren').click()
}

/** Liegt das Element ganz im Fenster? */
async function imBild(l: Locator): Promise<boolean> {
  return l.evaluate((e) => {
    const r = e.getBoundingClientRect()
    return r.top >= -1 && r.bottom <= window.innerHeight + 1
  })
}

/** Wo der Fokus steht; „BODY“ heißt verloren. */
async function fokus(page: Page): Promise<string> {
  return page.evaluate(() => document.activeElement?.tagName ?? 'BODY')
}

async function freigeben(page: Page) {
  await teil(page, 'Dokumente').click()
  await page.getByRole('button', { name: 'Version freigeben …' }).click()
  const dialog = page.getByRole('dialog', { name: 'Version freigeben' })
  await dialog.getByRole('button', { name: 'Freigeben', exact: true }).click()
  await expect(dialog).toBeHidden()
}

async function beheben(page: Page, name: RegExp) {
  await teil(page, 'Lücken').click()
  await page.getByRole('button', { name }).click()
}

test('„Weiter“ zeigt den Anfang des nächsten Teilschritts und setzt den Fokus auf seine Überschrift', async ({ page }) => {
  await start(page)
  for (const name of TEILSCHRITTE.slice(1)) {
    await page.getByRole('button', { name: `Weiter: ${name}` }).click()
    await expect(teil(page, name)).toHaveAttribute('aria-current', 'step')
    const ueberschrift = page.locator('.dokumentieren .teil h3').first()
    await expect(ueberschrift, name).toBeFocused()
    expect(await imBild(ueberschrift), name).toBe(true)
    expect(await imBild(teil(page, name)), name).toBe(true)
  }
  // Ein Klick in der Leiste lässt den Fokus dort
  await teil(page, 'Kontrollen').click()
  await expect(teil(page, 'Kontrollen')).toBeFocused()
})

test('„Beheben“ bringt die Frage ins Bild und setzt den Fokus auf ihr Feld', async ({ page }) => {
  await start(page)
  // B1: Einordnung der Bestellnotiz (Karte höher als das Fenster)
  await beheben(page, /^Beheben: Aufbewahrungsfrist fehlt/)
  const einordnung = page.getByRole('group', { name: 'Was ist „Bestellnotiz“?' })
  await expect(einordnung.getByRole('radio', { name: /^Weiß nicht/ })).toBeFocused()
  expect(await imBild(einordnung)).toBe(true)
  // Nach dem Mausklick kurz umrandet, auch ohne Fokusring
  await expect(einordnung).toHaveAttribute('data-sprungziel', '')

  // S2: Vertrag zur Auftragsverarbeitung
  await beheben(page, /^Beheben: Vertrag zur Auftragsverarbeitung fehlt/)
  const av = page.getByRole('group', { name: 'Gibt es einen Vertrag zur Auftragsverarbeitung?' })
  await expect(av.getByRole('radio', { name: 'Nein' })).toBeFocused()
  expect(await imBild(av)).toBe(true)

  // S4: Version des Systems
  await beheben(page, /^Beheben: Programmversion fehlt/)
  await expect(page.locator('#ziel-system-med_erp').getByLabel('Version', { exact: true })).toBeFocused()

  // D6: Löschfrist der Tourenliste
  await beheben(page, /^Beheben: Löschfrist fehlt/)
  await expect(page.getByRole('group', { name: 'Tourenliste' }).getByRole('button', { name: 'Löschfrist festlegen' })).toBeFocused()

  // K2: Nachweis der Kontrolle
  await beheben(page, /^Beheben: Kontrolle ohne Nachweis/)
  const nachweis = page.locator('#ziel-kontrolle-auf_kontrollieren').getByRole('group', { name: 'Wie wird die Kontrolle nachgewiesen?' })
  await expect(nachweis.getByRole('radio', { name: 'Kein Nachweis' })).toBeFocused()
  expect(await imBild(nachweis)).toBe(true)

  // T1: erste Maßnahme des Bereichs
  await beheben(page, /^Beheben: Schutzmaßnahmen fehlen/)
  await expect(page.getByRole('group', { name: 'Maßnahmen: Überprüfung' }).getByRole('checkbox').first()).toBeFocused()
})

test('„Beheben“ klappt eine Unterlage mit nur Hinweisen auf und führt zur offenen Frage', async ({ page }) => {
  await start(page)
  await teil(page, 'Belege und Daten').click()
  const neu = page.getByRole('form', { name: 'Neue Unterlage' })
  await neu.getByLabel('Name, z. B. „Ausgangsrechnung“').fill('Notiz')
  await neu.getByRole('button', { name: '+ Unterlage anlegen' }).click()
  await page.getByRole('region', { name: 'Notiz', exact: true }).locator('label', { hasText: /^Nicht aufbewahrungspflichtig/ }).click()

  await beheben(page, /^Beheben: Personenbezug ungeklärt/)
  const frage = page.getByRole('region', { name: 'Notiz', exact: true }).getByRole('group', { name: 'Enthält es Angaben zu Personen?' })
  await expect(frage.getByRole('radio', { name: 'Weiß nicht' })).toBeFocused()
  expect(await imBild(frage)).toBe(true)
})

test('Bühne: „1 markiert – zeigen“ holt den markierten Schritt ins Bild', async ({ page }) => {
  await start(page)
  const buehne = page.getByRole('region', { name: 'Diagramm' })
  const abzeichen = buehne.locator('.pl-abzeichen')
  await expect(abzeichen).toHaveCount(1)
  const imAusschnitt = () =>
    abzeichen.evaluate((a) => {
      const f = a.closest('.diagramm-flaeche')!.getBoundingClientRect()
      const r = a.getBoundingClientRect()
      return r.left >= f.left && r.right <= f.right && r.top >= f.top && r.bottom <= f.bottom
    })
  await buehne.getByRole('button', { name: '1 markiert – zeigen' }).click()
  await expect.poll(imAusschnitt).toBe(true)
  // lesbar: mindestens Originalgröße
  expect((await abzeichen.boundingBox())!.height).toBeGreaterThanOrEqual(16)
})

test('der Fokus bleibt nach Anlegen und Entfernen bei einem sinnvollen Element', async ({ page }) => {
  await start(page)

  // Neue Unterlage: Fokus auf die neue Karte
  await teil(page, 'Belege und Daten').click()
  const neu = page.getByRole('form', { name: 'Neue Unterlage' })
  await neu.getByLabel('Name, z. B. „Ausgangsrechnung“').fill('Gutschrift')
  await neu.getByRole('button', { name: '+ Unterlage anlegen' }).press('Enter')
  await expect(page.getByRole('region', { name: 'Gutschrift' })).toBeFocused()

  // Empfänger: anlegen führt in das Feld „Kategorie“, entfernen verliert den Fokus nicht
  const karte = page.locator('#ziel-datenobjekt-dob_bestellnotiz')
  await karte.getByRole('button', { name: '+ Empfänger' }).press('Enter')
  await expect(karte.getByRole('group', { name: 'Empfänger 1' }).getByRole('textbox', { name: 'Kategorie' })).toBeFocused()
  await karte.getByRole('button', { name: 'Empfänger entfernen' }).press('Enter')
  expect(await fokus(page)).not.toBe('BODY')

  // Ablageort anlegen: Fokus auf das neue, ausgewählte Kästchen
  await karte.getByText('+ Ablageort').click()
  // ohne Namen: Meldung am Feld statt gesperrtem Knopf
  await karte.getByRole('button', { name: 'Ablageort anlegen und auswählen' }).click()
  await expect(karte.getByRole('alert')).toHaveText('Gib dem Ablageort einen Namen, z. B. „Belegarchiv“.')
  await expect(karte.getByLabel('Name des Ablageorts')).toBeFocused()
  await karte.getByLabel('Name des Ablageorts').fill('Belegarchiv')
  await expect(karte.getByRole('alert')).toHaveCount(0)
  await karte.getByRole('button', { name: 'Ablageort anlegen und auswählen' }).press('Enter')
  const kaestchen = karte.getByRole('checkbox', { name: /^Belegarchiv/ })
  await expect(kaestchen).toBeChecked()
  await expect(kaestchen).toBeFocused()

  // Unterlage entfernen: Fokus auf die nächste Karte
  await karte.getByRole('button', { name: 'Unterlage Bestellnotiz entfernen' }).press('Enter')
  await page.getByRole('dialog', { name: 'Unterlage entfernen?' }).getByRole('button', { name: 'Entfernen' }).click()
  await expect(page.locator('#ziel-datenobjekt-dob_bestellung')).toBeFocused()

  // Löschfrist festlegen und entfernen
  await teil(page, 'Aufbewahrung und Löschung').click()
  const frist = page.getByRole('group', { name: 'Tourenliste' })
  await frist.getByRole('button', { name: 'Löschfrist festlegen' }).press('Enter')
  await expect(frist.getByLabel('Anzahl')).toBeFocused()
  await frist.getByRole('button', { name: 'Löschfrist entfernen' }).press('Enter')
  await expect(frist.getByRole('button', { name: 'Löschfrist festlegen' })).toBeFocused()

  // Weitere Kontrolle anlegen und entfernen
  await teil(page, 'Kontrollen').click()
  await page.getByRole('button', { name: '+ Weitere Kontrolle' }).press('Enter')
  const kontrolle = page.getByRole('group', { name: 'Weitere Kontrolle 1' })
  await expect(kontrolle.getByRole('textbox', { name: 'Name' })).toBeFocused()
  await kontrolle.getByRole('button', { name: 'Kontrolle entfernen' }).press('Enter')
  await expect(page.getByRole('heading', { name: 'Weitere Kontrollen' })).toBeFocused()

  // Eigene Maßnahme: der Knopf bleibt bedienbar, der Fokus bleibt erhalten
  await teil(page, 'Schutzmaßnahmen').click()
  const bereich = page.getByRole('region', { name: 'Überprüfung' })
  await bereich.getByRole('textbox', { name: 'Eigene Maßnahme für Überprüfung' }).fill('Jährliches Audit')
  await bereich.getByRole('button', { name: '+ Eigene Maßnahme' }).press('Enter')
  await expect(bereich.getByRole('checkbox', { name: 'Jährliches Audit' })).toBeChecked()
  expect(await fokus(page)).not.toBe('BODY')
  // ohne Text: Meldung am Feld statt gesperrtem Knopf
  await bereich.getByRole('button', { name: '+ Eigene Maßnahme' }).click()
  await expect(bereich.getByRole('alert')).toHaveText('Gib zuerst eine Maßnahme ein.')
  await expect(bereich.getByRole('textbox', { name: 'Eigene Maßnahme für Überprüfung' })).toBeFocused()

  // Alte Version ansehen und zurück: Fokus auf dem Reiter
  await freigeben(page)
  await page.getByRole('button', { name: 'Version 1.0 ansehen' }).click()
  await page.getByRole('button', { name: 'Zurück zum aktuellen Entwurf' }).press('Enter')
  await expect(page.getByRole('tab', { name: 'Verfahrensdokumentation' })).toBeFocused()
})

test('Unterlage ohne Namen: Meldung am Feld, Fokus im Namensfeld', async ({ page }) => {
  await start(page)
  await teil(page, 'Belege und Daten').click()
  const neu = page.getByRole('form', { name: 'Neue Unterlage' })
  await neu.getByRole('button', { name: '+ Unterlage anlegen' }).click()
  const meldung = neu.getByRole('alert')
  await expect(meldung).toHaveText('Gib der Unterlage einen Namen, z. B. „Ausgangsrechnung“.')
  expect(await imBild(meldung)).toBe(true)
  const name = neu.getByLabel('Name, z. B. „Ausgangsrechnung“')
  await expect(name).toBeFocused()
  await expect(name).toHaveAttribute('aria-invalid', 'true')
  // Mit Namen verschwindet die Meldung
  await name.fill('Angebot')
  await expect(meldung).toBeHidden()
})

test('ungültige Zahlen werden gemeldet statt still verworfen', async ({ page }) => {
  await start(page)
  const personen = page.getByLabel('Wie viele Personen arbeiten ständig mit personenbezogenen Daten am Computer?')
  await personen.fill('ca. 12')
  await expect(page.getByRole('alert').filter({ hasText: 'Bitte eine ganze Zahl eingeben, z. B. 12.' })).toBeVisible()
  await expect(personen).toHaveAttribute('aria-invalid', 'true')
  await page.keyboard.press('Tab')
  // Nach dem Verlassen bleiben Eingabe und Meldung stehen
  await expect(personen).toHaveValue('ca. 12')
  await expect(page.getByRole('alert').filter({ hasText: 'Bitte eine ganze Zahl eingeben' })).toBeVisible()
  await personen.fill('12')
  await expect(page.getByRole('alert').filter({ hasText: 'Bitte eine ganze Zahl eingeben' })).toHaveCount(0)
  await expect(personen).not.toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Bei 12 Personen verlangt § 38 Abs. 1 Satz 1 BDSG keinen Datenschutzbeauftragten.')).toBeVisible()

  await teil(page, 'Aufbewahrung und Löschung').click()
  const frist = page.getByLabel('Gewählte Frist für Ausgangsrechnung in Jahren, leer heißt gesetzlich')
  await frist.fill('40')
  await expect(page.getByRole('alert').filter({ hasText: 'Höchstens 30 Jahre.' })).toBeVisible()
  await expect(frist).toHaveAttribute('aria-invalid', 'true')
})

test('geänderte Kapitel stehen ausgeschrieben statt als „VD“ und „VVT“', async ({ page }) => {
  await start(page)
  await freigeben(page)
  await schritt(page, 'Ablauf').click()
  await page.getByRole('button', { name: /Rechnung freigeben/ }).first().click()
  await page.getByLabel('Was wird getan?').fill('Rechnung prüfen und freigeben')
  await schritt(page, 'Dokumentieren').click()
  await teil(page, 'Lücken').click()
  await expect(page.getByText('Seit Version 1.0 geändert: Verfahrensdokumentation 3.2, 3.3 und 4.')).toBeVisible()
  await teil(page, 'Dokumente').click()
  await expect(page.locator('.status-zeile')).toContainText('geändert seit der Freigabe: Verfahrensdokumentation 3.2, 3.3 und 4')
  await page.getByRole('button', { name: 'Version freigeben …' }).click()
  const dialog = page.getByRole('dialog', { name: 'Version freigeben' })
  await expect(dialog.getByLabel('Inhalt der Änderung')).toHaveValue('Geändert: Verfahrensdokumentation 3.2, 3.3 und 4')
  await dialog.getByLabel('Gültig ab').fill('2026-11-12')
  await dialog.getByRole('button', { name: 'Freigeben', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('region', { name: 'Versionen' }).getByRole('row').nth(2)).toContainText('Verfahrensdokumentation 3.2, 3.3 und 4')
  // Kapitel 7 nennt die eigenen Kapitel ohne Dokumentnamen
  await expect(page.getByRole('tabpanel').getByRole('row', { name: /^2\.0/ })).toContainText('3.2, 3.3 und 4')
  await expect(page.locator('#inhalt')).not.toContainText('VD 3')
})

test('Empfänger: keine Vorschläge, die schon Betroffene sind; Vorschläge mit Erklärung', async ({ page }) => {
  await start(page)
  await teil(page, 'Belege und Daten').click()
  const karte = page.locator('#ziel-datenobjekt-dob_bestellnotiz')
  await expect(karte.getByText('Wer nur seine eigenen Daten bekommt, etwa der Kunde seine Rechnung, ist kein Empfänger.')).toBeVisible()
  await expect(karte.getByRole('button', { name: '+ Kunde' })).toHaveCount(0)
  // Sind Kunden nicht betroffen, steht der Kunde als Vorschlag mit Erklärung bereit
  await karte.getByRole('group', { name: 'Wer ist betroffen?' }).getByRole('checkbox', { name: 'Kunden' }).uncheck()
  const vorschlaege = karte.getByRole('group', { name: 'Externe aus dem Ablauf – nur, wenn sie Daten anderer Personen bekommen:' })
  await expect(vorschlaege.getByRole('button', { name: '+ Kunde' })).toBeVisible()
})

test('nach einer Freigabe ohne schwere Barrieren (DOCX-Knopf der Versionsliste)', async ({ page }) => {
  await start(page)
  await freigeben(page)
  const ergebnis = await new AxeBuilder({ page }).exclude('.djs-container').analyze()
  const schwer = ergebnis.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(schwer.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  await expect(page.getByRole('button', { name: 'DOCX: Version 1.0, Verfahrensdokumentation als Word-Datei' })).toBeVisible()
})

test('„Schutzmaßnahmen“ ohne Sprung in der Überschriftenfolge', async ({ page }) => {
  await start(page)
  await teil(page, 'Schutzmaßnahmen').click()
  const ergebnis = await new AxeBuilder({ page }).exclude('.djs-container').withRules(['heading-order']).analyze()
  expect(ergebnis.violations.map((v) => v.nodes.map((n) => n.target.join(' ')).join(', '))).toEqual([])
})

test('Kontaktfelder stehen in benannten Gruppen', async ({ page }) => {
  await start(page)
  await page.getByRole('group', { name: 'Ist ein Datenschutzbeauftragter benannt?' }).locator('label', { hasText: 'Ja' }).click()
  const dsb = page.getByRole('group', { name: 'Kontakt: Datenschutzbeauftragter' })
  await expect(dsb.getByRole('textbox', { name: 'Straße und Hausnummer' })).toBeVisible()
  await expect(dsb.getByRole('textbox', { name: 'E-Mail' })).toBeVisible()
})

test('„Beheben“-Knöpfe nennen ihr Objekt', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00'))
  await page.goto('/')
  await page.getByRole('button', { name: /Beispiel „Onlinebestellung“/ }).click()
  await schritt(page, 'Dokumentieren').click()
  await teil(page, 'Lücken').click()
  const namen = await page.getByRole('button', { name: /^Beheben/ }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? e.textContent ?? ''))
  expect(namen.length).toBeGreaterThan(10)
  expect(new Set(namen).size, namen.join('\n')).toBe(namen.length)
  expect(namen).toContain('Beheben: Schutzmaßnahmen fehlen – Verschlüsselung')
})

test('Karten der Unterlagen: Umschalter nennen die Unterlage', async ({ page }) => {
  await start(page)
  await teil(page, 'Belege und Daten').click()
  const umschalter = page.locator('.karte-umschalter')
  const karten = await umschalter.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))
  expect(new Set(karten).size).toBe(karten.length)
  await expect(page.getByRole('button', { name: 'Angaben bearbeiten: Tourenliste' })).toBeVisible()
})

test('Texte erklären Fachbegriffe und Abkürzungen', async ({ page }) => {
  await start(page)
  await expect(page.locator('.dokumentieren > p.leise').first()).toHaveText(
    'Aus dem Ablauf entstehen zwei Dokumente: die Verfahrensdokumentation, die das Finanzamt nach den GoBD (Regeln für die elektronische Buchführung) erwartet, und das Verzeichnis von Verarbeitungstätigkeiten nach Art. 30 DSGVO. Beide beschreiben den Ist-Prozess.',
  )
  await expect(page.getByText('Bleibt das Feld leer, steht hier der Name des Prozesses.')).toBeVisible()
  await expect(page.getByText('Unabhängig von der Zahl kann ein Datenschutzbeauftragter nötig sein, etwa wenn')).toBeVisible()

  await teil(page, 'Belege und Daten').click()
  await expect(page.getByText('Die Nummer ist das Kapitel in der Verfahrensdokumentation.')).toBeVisible()

  await teil(page, 'Systeme und Dienstleister').click()
  await expect(page.getByText('z. B. ein Archiv im Dokumentenmanagementsystem (DMS) oder ein Ordner im Büro')).toBeVisible()
  const erp = page.locator('#ziel-system-med_erp')
  await expect(erp.getByText('Archiv, das Ändern und Löschen technisch verhindert')).toBeVisible()
  await erp.getByLabel('Wo werden die Daten verarbeitet?').selectOption({ label: 'Anderes Land (Drittland)' })
  await expect(erp.getByLabel('Absicherung der Übermittlung')).toBeVisible()
  await expect(erp.getByText('Steht im Vertrag zur Auftragsverarbeitung oder in den Datenschutzhinweisen des Anbieters; frag im Zweifel nach.')).toBeVisible()

  await teil(page, 'Aufbewahrung und Löschung').click()
  await expect(page.getByText('Das Muster der Bundessteuerberaterkammer und des Steuerberaterverbands (BStBK/DStV) empfiehlt')).toBeVisible()
  await expect(page.getByText('Ein Satz wie „wird gelöscht, wenn nicht mehr nötig“ genügt nicht; nenne eine Frist, z. B. 30 Tage nach Erledigung.')).toBeVisible()

  await teil(page, 'Schutzmaßnahmen').click()
  await expect(page.getByRole('region', { name: 'Pseudonymisierung' })).toContainText('Namen durch Nummern ersetzen, wo der Name nicht gebraucht wird.')
  await expect(page.getByRole('region', { name: 'Verschlüsselung' })).toContainText('https')

  await teil(page, 'Lücken').click()
  await expect(page.getByText('Warnung: Vertrag zur Auftragsverarbeitung fehlt')).toBeVisible()
})

test('Rückfrage zum Ablageort: Einzahl und ohne Sie-Form', async ({ page }) => {
  await start(page)
  await teil(page, 'Systeme und Dienstleister').click()
  await page.getByRole('button', { name: 'Ablageort Ordner Lieferscheine entfernen' }).click()
  await expect(page.getByRole('dialog', { name: 'Ablageort entfernen?' })).toContainText('„Ordner Lieferscheine“ ist Ablageort für 1 Unterlage. Bei ihr fällt dieser Ablageort weg.')
})

test('„Weiß nicht“ bei der Einordnung nennt die Folge statt den Rat zu wiederholen', async ({ page }) => {
  await start(page)
  await teil(page, 'Belege und Daten').click()
  const karte = page.locator('#ziel-datenobjekt-dob_bestellnotiz')
  await expect(karte.getByText('Solange das offen ist, meldet die Lückenprüfung „Aufbewahrungsfrist fehlt“.')).toBeVisible()
  await expect(karte.getByText(/Steuerberatung fragen/)).toHaveCount(1)
})

test('Ablageorte: keine Klammer, wenn System und Name gleich sind', async ({ page }) => {
  await start(page)
  await teil(page, 'Belege und Daten').click()
  const karte = page.locator('#ziel-datenobjekt-dob_bestellnotiz')
  await expect(karte.getByRole('checkbox', { name: 'Warenwirtschaft', exact: true })).toBeVisible()
  await expect(karte.getByRole('checkbox', { name: 'Ordner Lieferscheine (Papier)' })).toBeVisible()
  await expect(karte.getByText('Warenwirtschaft (Warenwirtschaft)')).toHaveCount(0)
})

test('„Dokumentieren“ lädt erst im Schritt; der Hauptteil bleibt unter 500 kB', async ({ page, request }) => {
  const skripte: string[] = []
  page.on('request', (r) => {
    if (r.resourceType() === 'script') skripte.push(new URL(r.url()).pathname)
  })
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00'))
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  await expect(page.getByRole('region', { name: 'Diagramm' }).locator('.djs-container')).toBeAttached()
  const lueckenpruefung = (u: string) => /\/(DokumentierenSchritt|analyse)-[\w-]+\.js$/.test(u)
  expect(skripte.filter(lueckenpruefung)).toEqual([])

  const haupt = await page.locator('script[type="module"]').getAttribute('src')
  const groesse = (await (await request.get(haupt!)).body()).length
  expect(groesse).toBeLessThan(500_000)

  // Im Schritt „Dokumentieren“ laden Schritt und Lückenprüfung nach; die Bühne zeigt dann die Markierung
  await schritt(page, 'Dokumentieren').click()
  await expect(leiste(page)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Diagramm' }).locator('.pl-abzeichen')).toHaveCount(1)
  expect(skripte.filter(lueckenpruefung).length).toBeGreaterThan(0)
})
