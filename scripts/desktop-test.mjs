/**
 * Prüft das echte Windows-Programm (Debug-Build) ohne Installation:
 * Start, Speichern unter, Speichern, Zuletzt geöffnet, BPMN-Export, PDF in A4,
 * Öffnen per Dialog, zweiter Start mit Datei (Single-Instance) und die
 * Rückfrage beim Schließen. Danach die Compliance-Doku: Freigabe, Word-Datei
 * als Rohdaten, PDF der Verfahrensdokumentation, Projekt speichern, Neustart
 * und Öffnen. Über alle Starts: sicherer Kontext, Web Crypto und keine Meldung
 * zur Content Security Policy. Dateidialoge beantwortet der Debug-Build über
 * Umgebungsvariablen; die Oberfläche steuert Playwright über die
 * Debug-Schnittstelle von WebView2.
 *
 * Vorher: npx tauri build --debug --no-bundle
 * Aufruf:  node scripts/desktop-test.mjs
 * PROZESSLOTSE_EXE wählt eine andere exe (z. B. bei gemeinsamem CARGO_TARGET_DIR),
 * DESKTOP_TEST_BEHALTEN=1 lässt die erzeugten Dateien liegen.
 */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { strFromU8, unzipSync } from 'fflate'

const EXE = resolve(process.env.PROZESSLOTSE_EXE ?? 'src-tauri/target/debug/prozesslotse.exe')
if (!existsSync(EXE)) throw new Error(`${EXE} fehlt. Vorher: npx tauri build --debug --no-bundle`)
const KENNUNG = 'de.olbricht-digital.prozesslotse'
const PORT = 9333
const ordner = mkdtempSync(join(tmpdir(), 'prozesslotse-desktop-'))
const datei = (name) => join(ordner, name)
const appDaten = [join(process.env.APPDATA, KENNUNG), join(process.env.LOCALAPPDATA, KENNUNG)]
const vorhanden = appDaten.filter((d) => existsSync(d))

/** Antworten auf die Dateidialoge (nur im Debug-Build ausgewertet) */
const DIALOGE = {
  PROZESSLOTSE_TEST_SPEICHERN_PROJEKT: datei('a.prozesslotse'),
  PROZESSLOTSE_TEST_SPEICHERN_BPMN: datei('a.bpmn'),
  PROZESSLOTSE_TEST_PDF: datei('bericht.pdf'),
  PROZESSLOTSE_TEST_OEFFNEN: datei('a.prozesslotse'),
}
const DIALOGE_COMPLIANCE = {
  PROZESSLOTSE_TEST_SPEICHERN_PROJEKT: datei('compliance.prozesslotse'),
  // ohne Endung und mit Umlaut: Das Programm ergänzt „.docx“
  PROZESSLOTSE_TEST_SPEICHERN_DOCX: datei('Verfahrensdokumentation Prüfung'),
  PROZESSLOTSE_TEST_PDF: datei('verfahrensdokumentation.pdf'),
  PROZESSLOTSE_TEST_OEFFNEN: datei('compliance.prozesslotse'),
  // Nähme der Befehl eine unbekannte Art an, landete sie hier statt in einem echten Dialog
  PROZESSLOTSE_TEST_SPEICHERN_EXE: datei('falsch.exe'),
}

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

function starte(args = [], dialoge = DIALOGE) {
  return spawn(EXE, args, {
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`,
      ...dialoge,
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

/** Meldungen zur Content Security Policy aus allen Starts */
const csp = []

/** Sammelt CSP-Meldungen der Konsole, auch die vor dem Verbinden: Log.enable liefert sie nach. */
async function beobachteCsp(seite) {
  const merke = (text) => /Content.Security.Policy/i.test(text) && csp.push(text)
  seite.on('console', (m) => merke(m.text()))
  const cdp = await seite.context().newCDPSession(seite)
  cdp.on('Log.entryAdded', ({ entry }) => merke(entry.text))
  await cdp.send('Log.enable')
  await seite.evaluate(() => document.addEventListener('securitypolicyviolation', (e) => console.error(`Content Security Policy: ${e.violatedDirective} ${e.blockedURI}`)))
}

async function portFrei() {
  try {
    await fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(1000) })
    return false
  } catch {
    return true
  }
}

let prozess = starte()
let browser
let seite
const titel = () => seite.title()
const meldung = async () => (await seite.locator('p.meldung').textContent()) ?? ''
const schritte = () => seite.getByRole('navigation', { name: 'Schritte' })
const teilschritte = () => seite.getByRole('navigation', { name: 'Teilschritte' })

/** Leeres Projekt mit Willkommen, auch wenn ein früherer Lauf etwas im Browser-Speicher des Programms hinterlassen hat. */
async function willkommen() {
  const knopf = seite.getByRole('button', { name: /Mit dem Beispiel/ })
  await schritte().waitFor({ timeout: 15000 })
  if (await knopf.isVisible()) return
  await seite.keyboard.press('Control+n')
  const frage = seite.getByRole('dialog', { name: 'Änderungen speichern?' })
  await knopf.or(frage).first().waitFor({ timeout: 10000 })
  if (await frage.isVisible()) await frage.getByRole('button', { name: 'Nicht speichern' }).click()
  await knopf.waitFor({ timeout: 10000 })
}

/** Neuer Programmstart, sobald die WebView2 des vorigen weg ist (sonst verbände sich Playwright mit ihr). */
async function neuerStart(dialoge) {
  await browser?.close().catch(() => {})
  const ende = Date.now() + 20000
  while (!(await portFrei())) {
    if (Date.now() > ende) throw new Error(`Port ${PORT} ist noch belegt`)
    await new Promise((r) => setTimeout(r, 300))
  }
  prozess = starte([], dialoge)
  console.log(`Programm neu gestartet (PID ${prozess.pid})`)
  ;({ browser, seite } = await verbinde())
  await beobachteCsp(seite)
}

try {
  console.log(`Programm gestartet (PID ${prozess.pid}), Testordner ${ordner}`)
  ;({ browser, seite } = await verbinde())
  await beobachteCsp(seite)

  // 1. Beispiel laden, „Speichern unter“ mit Strg+Umschalt+S
  await willkommen()
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

  // 9. Compliance-Doku: neuer Start mit eigenen Dialogantworten
  await neuerStart(DIALOGE_COMPLIANCE)
  const umgebung = await seite.evaluate(() => ({ herkunft: location.origin, sicher: window.isSecureContext, subtle: typeof globalThis.crypto?.subtle?.digest === 'function' }))
  pruefe(umgebung.sicher, `sicherer Kontext (isSecureContext) unter ${umgebung.herkunft}`)
  pruefe(umgebung.subtle, 'crypto.subtle steht bereit (Prüfsumme der Freigabe)')
  // Gegenprobe: Ein eingeschleustes Inline-Skript muss die CSP blockieren, und die Beobachtung muss es melden
  const bisher = csp.length
  await seite.evaluate(() => {
    const s = document.createElement('script')
    s.textContent = 'window.__gegenprobe = 1'
    document.head.append(s)
  })
  await warte(async () => csp.length > bisher, 'Gegenprobe: die CSP blockiert ein eingeschleustes Inline-Skript, die Beobachtung meldet es')
  pruefe((await seite.evaluate(() => window.__gegenprobe)) === undefined, 'Gegenprobe: das Inline-Skript lief nicht')
  // Dieselbe Meldung kommt über bis zu drei Wege (Log, Konsole, Ereignis); alle abwarten, dann zählt sie nicht mit
  await new Promise((r) => setTimeout(r, 1000))
  csp.splice(bisher)

  await willkommen()
  await seite.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  await schritte().getByRole('button', { name: /Dokumentieren/ }).click()
  await teilschritte().getByRole('button', { name: /^Dokumente/ }).click()
  await seite.getByText('Entwurf, nicht freigegeben').waitFor({ timeout: 10000 })

  // 10. speichern_unter_bytes lehnt falsche Anfragen ab, bevor ein Dialog aufgeht
  const docxDatei = datei('Verfahrensdokumentation Prüfung.docx')
  const antworten = await seite.evaluate(async () => {
    const rufe = (daten, headers) =>
      window.__TAURI_INTERNALS__.invoke('speichern_unter_bytes', daten, { headers }).then(
        (r) => `angenommen: ${JSON.stringify(r)}`,
        (e) => String(e),
      )
    const bytes = new Uint8Array([80, 75, 3, 4, 0])
    return {
      art: await rufe(bytes, { vorschlag: 'a.exe', art: 'exe' }),
      ohneName: await rufe(bytes, { art: 'docx' }),
      kodierung: await rufe(bytes, { vorschlag: '%E4%FC.docx', art: 'docx' }),
      json: await rufe({ inhalt: [80, 75, 3, 4] }, { vorschlag: 'a.docx', art: 'docx' }),
      leer: await rufe(new Uint8Array(0), { vorschlag: 'a.docx', art: 'docx' }),
    }
  })
  pruefe(antworten.art.includes('Unbekannte Dateiart: exe'), `unbekannte Dateiart abgelehnt („${antworten.art}“)`)
  pruefe(antworten.ohneName.includes('„vorschlag“ fehlt'), `fehlender Kopfwert abgelehnt („${antworten.ohneName}“)`)
  pruefe(antworten.kodierung.includes('falsch kodiert'), `falsch kodierter Kopfwert abgelehnt („${antworten.kodierung}“)`)
  pruefe(antworten.json.includes('Rohdaten'), `JSON statt Rohdaten abgelehnt („${antworten.json}“)`)
  pruefe(antworten.leer.includes('leer'), `leere Datei abgelehnt („${antworten.leer}“)`)
  pruefe(!existsSync(docxDatei) && !existsSync(datei('falsch.exe')), 'abgelehnte Anfragen schreiben nichts')

  // 11. Version freigeben (die Prüfsumme rechnet crypto.subtle)
  await seite.getByRole('button', { name: 'Version freigeben …' }).click()
  const freigabe = seite.getByRole('dialog', { name: 'Version freigeben' })
  await freigabe.getByRole('button', { name: 'Freigeben', exact: true }).click()
  await freigabe.waitFor({ state: 'hidden', timeout: 10000 })
  await warte(async () => (await meldung()).includes('Version 1.0 freigegeben'), 'Version 1.0 freigegeben')

  // 12. Word-Datei: Bytes als Rohdaten, Dialog über PROZESSLOTSE_TEST_SPEICHERN_DOCX
  await seite.getByRole('button', { name: 'Als Word-Datei (DOCX)' }).click()
  await warte(async () => (await meldung()).includes('„Verfahrensdokumentation Prüfung.docx“ gespeichert'), 'Word-Datei gespeichert, Endung ergänzt, Meldung nennt den Dateinamen')
  const docx = readFileSync(docxDatei)
  pruefe(docx.subarray(0, 4).toString('latin1') === 'PK\x03\x04', `Word-Datei ist ein ZIP-Paket (${docx.length} Bytes)`)
  const teile = unzipSync(new Uint8Array(docx))
  pruefe('word/document.xml' in teile && '[Content_Types].xml' in teile, 'das Paket enthält word/document.xml und [Content_Types].xml')
  const xml = strFromU8(teile['word/document.xml'])
  pruefe(xml.includes('Bestellung bis Rechnung (Lieferdienst)'), 'word/document.xml enthält den Prozessnamen')
  pruefe(xml.includes('Version 1.0 · gültig ab'), 'word/document.xml nennt die freigegebene Version')

  // 13. PDF der Verfahrensdokumentation über alsPdf, erst wenn das Diagramm in 9.1 als Bild bereitsteht
  await seite.locator('.dokument-diagramm .druck-bild').waitFor({ state: 'attached', timeout: 15000 })
  await seite.getByRole('button', { name: 'Als PDF speichern' }).click()
  await warte(async () => (await meldung()).includes('PDF gespeichert'), 'PDF der Verfahrensdokumentation ohne Druckdialog geschrieben', 60000)
  const vdPdf = readFileSync(datei('verfahrensdokumentation.pdf'), 'latin1')
  pruefe(vdPdf.startsWith('%PDF-'), 'die PDF-Datei beginnt mit %PDF')
  const seiten = (vdPdf.match(/\/Type\s*\/Page\b/g) ?? []).length
  pruefe(seiten > 1, `das PDF hat mehrere Seiten (${seiten})`)
  const boxen = [...vdPdf.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)]
  pruefe(boxen.length > 0 && boxen.every(([, b, h]) => Math.abs(Number(b) - 595.4) < 2 && Math.abs(Number(h) - 841.7) < 2), `alle Seiten in A4 (${boxen.length} Seitenformate)`)

  // 14. Projekt mit Version speichern, dann schließen: ohne Änderungen keine Rückfrage
  await seite.keyboard.press('Control+Shift+S')
  await warte(async () => (await titel()) === 'compliance.prozesslotse – Prozesslotse', 'Speichern unter schreibt das Projekt mit der Version')
  const gespeichert = JSON.parse(readFileSync(datei('compliance.prozesslotse'), 'utf8'))
  pruefe(gespeichert.compliance?.versionen?.length === 1 && gespeichert.compliance.versionen[0].bezeichnung === '1.0', 'die Projektdatei enthält Version 1.0')
  execFileSync('taskkill', ['/PID', String(prozess.pid)])
  await warte(() => prozess.exitCode !== null, 'gespeichertes Projekt: das Programm schließt ohne Rückfrage')

  // 15. Neustart, leeres Projekt, dann die Datei öffnen: Versionen und Angaben stammen aus der Datei
  await neuerStart(DIALOGE_COMPLIANCE)
  await seite.keyboard.press('Control+n')
  await warte(async () => (await titel()).includes('Unbenannter Prozess'), 'Strg+N: leeres Projekt, nichts aus dem Browser-Speicher')
  await seite.keyboard.press('Control+o')
  await warte(async () => (await titel()) === 'compliance.prozesslotse – Prozesslotse', 'Strg+O öffnet die Projektdatei nach dem Neustart')
  await schritte().getByRole('button', { name: /Dokumentieren/ }).click()
  await teilschritte().getByRole('button', { name: /^Dokumente/ }).click()
  const versionen = seite.getByRole('region', { name: 'Versionen' })
  await warte(async () => (await versionen.getByRole('row').count()) === 2 && ((await versionen.getByRole('row').nth(1).textContent()) ?? '').includes('1.0'), 'die Versionsliste zeigt Version 1.0')
  pruefe(await seite.getByText(/Gültige Version 1\.0 seit/).isVisible(), 'Version 1.0 gilt')
  await teilschritte().getByRole('button', { name: /^Unternehmen/ }).click()
  pruefe((await seite.getByLabel('Wie heißt das Unternehmen?').inputValue()) === 'Lieferdienst Muster GmbH', 'die Compliance-Angaben sind noch da (Unternehmen)')
  // Zum Schluss ein leeres Projekt, damit der nächste Lauf wieder mit dem Willkommen beginnt
  await seite.keyboard.press('Control+n')
  await seite.getByRole('button', { name: /Mit dem Beispiel/ }).waitFor({ timeout: 10000 })
  execFileSync('taskkill', ['/PID', String(prozess.pid)])
  await warte(() => prozess.exitCode !== null, 'das Programm schließt ohne Rückfrage')

  pruefe(csp.length === 0, `keine Meldung zur Content Security Policy in der Konsole (drei Starts)${csp.length ? `: ${csp.join(' | ')}` : ''}`)
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
