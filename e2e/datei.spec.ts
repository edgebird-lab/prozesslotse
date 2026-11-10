import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

/** Kleines BPMN aus einem anderen Werkzeug, ohne eingebettetes Projekt. */
const FREMD = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="D" targetNamespace="http://example.com">
  <bpmn:process id="P" isExecutable="false">
    <bpmn:startEvent id="S" name="Antrag da"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="T" name="Antrag fremd prüfen"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:task>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="DI"><bpmndi:BPMNPlane id="PL" bpmnElement="P">
    <bpmndi:BPMNShape id="S_di" bpmnElement="S"><dc:Bounds x="100" y="100" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="T_di" bpmnElement="T"><dc:Bounds x="200" y="78" width="100" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="E_di" bpmnElement="E"><dc:Bounds x="360" y="100" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="F1_di" bpmnElement="F1"><di:waypoint x="136" y="118" /><di:waypoint x="200" y="118" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="F2_di" bpmnElement="F2"><di:waypoint x="300" y="118" /><di:waypoint x="360" y="118" /></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

test('öffnet eine exportierte BPMN-Datei wieder als Projekt', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Bericht/ }).click()
  const [bpmn] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'BPMN-Datei' }).first().click()])
  expect(bpmn.suggestedFilename()).toMatch(/\.bpmn$/)
  const pfad = (await bpmn.path())!
  expect(await readFile(pfad, 'utf8')).toContain('prozesslotse/projekt')

  // Neues Projekt ohne Rückfrage: Das Beispiel wurde nicht verändert
  await page.getByText('Projekt', { exact: true }).click()
  await page.getByRole('button', { name: /Neues Projekt/ }).click()
  await expect(page.getByText('Willkommen beim Prozesslotsen')).toBeVisible()

  await page.locator('input[type="file"]').setInputFiles(pfad)
  await expect(page.getByRole('status')).toContainText('geladen')
  await expect(page.getByRole('button', { name: /Bestellung telefonisch annehmen/ })).toBeVisible()
})

test('zeigt fremde BPMN-Dateien nur an', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles({ name: 'fremd.bpmn', mimeType: 'application/xml', buffer: Buffer.from(FREMD) })
  await expect(page.getByText('wurde nicht mit dem Prozesslotsen erstellt')).toBeVisible()
  await expect(page.getByRole('figure', { name: /fremd\.bpmn/ })).toBeVisible()
  await expect(page.locator('.djs-element').filter({ hasText: 'Antrag fremd prüfen' })).toHaveCount(1)
  await page.getByRole('button', { name: 'Ansicht schließen' }).click()
  await expect(page.getByText('Willkommen beim Prozesslotsen')).toBeVisible()
})

test('fragt vor dem Verwerfen ungespeicherter Änderungen nach', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  await page.getByRole('navigation', { name: 'Schritte' }).getByRole('button', { name: /Rahmen/ }).click()
  await page.getByLabel(/Wie heißt der Prozess/).fill('Geänderter Lieferdienst')

  await page.getByText('Projekt', { exact: true }).click()
  await page.getByRole('button', { name: /Neues Projekt/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Änderungen speichern?' })
  await expect(dialog).toBeVisible()
  // Abbrechen hat den Fokus und lässt alles, wie es ist
  await expect(dialog.getByRole('button', { name: 'Abbrechen' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByLabel(/Wie heißt der Prozess/)).toHaveValue('Geänderter Lieferdienst')

  // „Als Datei speichern“ lädt das Projekt herunter und macht dann weiter
  await page.getByText('Projekt', { exact: true }).click()
  await page.getByRole('button', { name: /Neues Projekt/ }).click()
  const [datei] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Als Datei speichern' }).click()])
  expect(datei.suggestedFilename()).toBe('geaenderter-lieferdienst.prozesslotse')
  await expect(page.getByText('Willkommen beim Prozesslotsen')).toBeVisible()
})

test('Strg+S speichert das Projekt als Datei', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Mit dem Beispiel/ }).click()
  const [datei] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')])
  expect(datei.suggestedFilename()).toMatch(/\.prozesslotse$/)
  await expect(page.getByRole('status')).toContainText('gespeichert')
})
