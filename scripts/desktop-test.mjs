/**
 * Prüft das echte Windows-Programm (Debug-Build) ohne Installation:
 * Start, Speichern unter, Speichern, Zuletzt geöffnet, BPMN-Export, PDF in A4,
 * Öffnen per Dialog, zweiter Start mit Datei (Single-Instance) und die
 * Rückfrage beim Schließen. Dateidialoge beantwortet der Debug-Build über
 * Umgebungsvariablen; die Oberfläche steuert Playwright über die
 * Debug-Schnittstelle von WebView2.
 *
 * Vorher: npx tauri build --debug --no-bundle
 * Aufruf:  node scripts/desktop-test.mjs
 */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'

const EXE = resolve('src-tauri/target/debug/prozesslotse.exe')
const KENNUNG = 'de.olbricht-digital.prozesslotse'
const PORT = 9333
const ordner = mkdtempSync(join(tmpdir(), 'prozesslotse-desktop-'))
const datei = (name) => join(ordner, name)
const appDaten = [join(process.env.APPDATA, KENNUNG), join(process.env.LOCALAPPDATA, KENNUNG)]
const vorhanden = appDaten.filter((d) => existsSync(d))

function pruefe(bedingung, text) {
  if (!bedingung) throw new Error(`Fehlgeschlagen: ${text}`)
  console.log(`  ✓ ${text}`)
}

async function warte(bedingung, text, ms = 15000) {
  const ende = Date.now() + ms
  while (Date.now() < ende) {
    if (await bedingung()) return pruefe(true, text)
    await new Promise((r) => setTimeout(r, 200))
  }
  pruefe(false, text)
}

function starte(args = []) {
  return spawn(EXE, args, {
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`,
      PROZESSLOTSE_TEST_SPEICHERN_PROJEKT: datei('a.prozesslotse'),
      PROZESSLOTSE_TEST_SPEICHERN_BPMN: datei('a.bpmn'),
      PROZESSLOTSE_TEST_PDF: datei('bericht.pdf'),
      PROZESSLOTSE_TEST_OEFFNEN: datei('a.prozesslotse'),
    },
    stdio: 'ignore',
  })
}

async function verbinde() {
  const ende = Date.now() + 30000
  while (Date.now() < ende) {
    try {
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`)
      const kontext = browser.contexts()[0]
      const seite = kontext.pages()[0] ?? (await kontext.waitForEvent('page', { timeout: 10000 }))
      // Beim allerersten Start legt WebView2 erst sein Profil an; die Seite kommt dann etwas später
      await seite.waitForURL(/tauri\.localhost/, { timeout: 20000 })
      await seite.waitForLoadState('domcontentloaded')
      return { browser, seite }
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw new Error('Keine Verbindung zur WebView2')
}

const prozess = starte()
let browser
try {
  console.log(`Programm gestartet (PID ${prozess.pid}), Testordner ${ordner}`)
  const verbindung = await verbinde()
  browser = verbindung.browser
  const seite = verbindung.seite
  const titel = () => seite.title()

  // 1. Beispiel laden, „Speichern unter“ mit Strg+Umschalt+S
  await seite.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  await seite.keyboard.press('Control+Shift+S')
  await warte(() => existsSync(datei('a.prozesslotse')), 'Speichern unter schreibt die Projektdatei')
  await warte(async () => (await titel()) === 'a.prozesslotse – Prozesslotse', 'Fenstertitel zeigt den Dateinamen ohne Änderungspunkt')

  // 2. Ändern: Punkt im Titel, Strg+S speichert ohne Dialog an denselben Ort
  await seite.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Rahmen/ }).click()
  await seite.getByLabel(/Wie heißt der Prozess/).fill('Lieferdienst geändert')
  await warte(async () => (await titel()).startsWith('• a.prozesslotse'), 'Änderung zeigt den Punkt im Titel')
  await seite.keyboard.press('Control+s')
  await warte(() => readFileSync(datei('a.prozesslotse'), 'utf8').includes('Lieferdienst geändert'), 'Strg+S speichert an den bekannten Pfad')
  await warte(async () => !(await titel()).startsWith('•'), 'nach dem Speichern kein Änderungspunkt mehr')

  // 3. Zuletzt geöffnet
  await seite.getByText('Projekt', { exact: true }).click()
  await warte(async () => (await seite.getByRole('group', { name: 'Zuletzt geöffnet' }).getByRole('button', { name: 'a.prozesslotse' }).count()) === 1, '„Zuletzt geöffnet“ enthält die Datei')

  // 4. BPMN-Export mit eingebettetem Projekt
  await seite.getByRole('button', { name: 'Als BPMN exportieren' }).click()
  await warte(() => existsSync(datei('a.bpmn')) && readFileSync(datei('a.bpmn'), 'utf8').includes('prozesslotse/projekt'), 'BPMN-Export enthält das Projekt')

  // 5. PDF aus dem Bericht, A4
  await seite.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Bericht/ }).click()
  await seite.locator('.bericht .druck-bild').first().waitFor({ state: 'attached', timeout: 15000 })
  await seite.getByRole('button', { name: 'Als PDF speichern' }).click()
  await warte(() => existsSync(datei('bericht.pdf')) && readFileSync(datei('bericht.pdf')).subarray(0, 5).toString() === '%PDF-', 'PDF wird ohne Druckdialog geschrieben', 30000)
  const pdf = readFileSync(datei('bericht.pdf'), 'latin1')
  const box = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(pdf)
  pruefe(box && Math.abs(Number(box[1]) - 595.4) < 2 && Math.abs(Number(box[2]) - 841.7) < 2, `PDF-Seite ist A4 (${box?.[1]} × ${box?.[2]} pt)`)

  // 6. Zweiter Start mit einer Datei: landet im laufenden Programm
  const zweiter = starte([datei('a.bpmn')])
  await new Promise((r) => zweiter.on('exit', r))
  pruefe(true, 'zweiter Start beendet sich sofort')
  await warte(async () => (await seite.getByRole('status').textContent())?.includes('„a.bpmn“ geladen') ?? false, 'die BPMN-Datei öffnet sich im laufenden Programm als Projekt')

  // 7. Öffnen-Dialog (Strg+O)
  await seite.keyboard.press('Control+o')
  await warte(async () => (await titel()) === 'a.prozesslotse – Prozesslotse', 'Strg+O öffnet die Projektdatei')

  // 8. Schließen mit ungespeicherten Änderungen: erst abbrechen, dann verwerfen
  await seite.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Rahmen/ }).click()
  await seite.getByLabel(/Wie heißt der Prozess/).fill('Nicht gespeichert')
  execFileSync('taskkill', ['/PID', String(prozess.pid)])
  const dialog = seite.getByRole('dialog', { name: 'Änderungen speichern?' })
  await dialog.waitFor({ timeout: 10000 })
  pruefe(true, 'Schließen fragt nach ungespeicherten Änderungen')
  await dialog.getByRole('button', { name: 'Abbrechen' }).click()
  await new Promise((r) => setTimeout(r, 1000))
  pruefe(prozess.exitCode === null, 'Abbrechen lässt das Programm offen')
  execFileSync('taskkill', ['/PID', String(prozess.pid)])
  await dialog.waitFor({ timeout: 10000 })
  await dialog.getByRole('button', { name: 'Nicht speichern' }).click()
  await warte(() => prozess.exitCode !== null, '„Nicht speichern“ beendet das Programm')
  pruefe(!readFileSync(datei('a.prozesslotse'), 'utf8').includes('Nicht gespeichert'), 'die verworfene Änderung steht nicht in der Datei')
  console.log('Desktop-Test bestanden.')
} finally {
  await browser?.close().catch(() => {})
  if (prozess.exitCode === null) prozess.kill()
  await new Promise((r) => setTimeout(r, 1500))
  if (process.env.DESKTOP_TEST_BEHALTEN) console.log(`Testdateien bleiben in ${ordner}`)
  else rmSync(ordner, { recursive: true, force: true })
  // Programmdaten nur entfernen, wenn der Test sie angelegt hat
  for (const d of appDaten) if (!vorhanden.includes(d)) rmSync(d, { recursive: true, force: true })
}
