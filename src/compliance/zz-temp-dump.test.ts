// TEMPORÄR, nicht einchecken: schreibt DOCX-Dateien für die Prüfung mit Word
import { writeFileSync } from 'node:fs'
import { strFromU8, unzipSync } from 'fflate'
import { it } from 'vitest'
import { beispielLieferdienst } from '../modell/beispiel'
import { complianceLieferdienst } from './beispiel'
import { erzeugeDocx } from './docx'
import { entwurfsKontext, erzeugeDokumente, freigeben, versionsKontext } from './versionen'

const ZIEL = process.env.DOCX_ZIEL ?? 'C:/Users/Robin/AppData/Local/Temp/claude/2827d1680c0a081d/20159d77-8dab-4ce3-8759-1692f787eb67/scratchpad/compliance-fix/druck/docx-vorher'

it('schreibt Prüfdateien', async () => {
  const p = beispielLieferdienst()
  const c = complianceLieferdienst()
  const e = erzeugeDokumente(p, c, entwurfsKontext(c, '2026-11-11'))
  writeFileSync(`${ZIEL}/a-entwurf-verfahrensdoku.docx`, await erzeugeDocx(e.verfahrensdoku))
  writeFileSync(`${ZIEL}/a-entwurf-verzeichnis.docx`, await erzeugeDocx(e.verzeichnis))
  // zwei Versionen: Kapitel 7 mit gültig bis, aufbewahren bis und Prüfsumme
  const v1 = await freigeben(p, c, { bezeichnung: '1.0', gueltigAb: '2026-11-11', freigegebenVon: 'Erika Mustermann', aenderung: 'Erstfassung' }, '2026-11-11')
  const c1 = { ...c, versionen: [v1] }
  const v2 = await freigeben(p, c1, { bezeichnung: '2.0', gueltigAb: '2027-01-01', freigegebenVon: 'Erika Mustermann', aenderung: 'Jährliche Durchsicht' }, '2026-12-15')
  const c2 = { ...c1, versionen: [v1, v2] }
  const d2 = erzeugeDokumente(p, c2, versionsKontext(v2, c2.versionen))
  writeFileSync(`${ZIEL}/b-v2-verfahrensdoku.docx`, await erzeugeDocx(d2.verfahrensdoku))
  // lange Systemnamen in 3.1
  const lang = { ...p, medien: p.medien.map((m) => (m.id === 'med_erp' ? { ...m, name: 'Warenwirtschaftssystem' } : m.id === 'med_excel' ? { ...m, name: 'Buchhaltungssoftware', art: 'fachanwendung' as const } : m)) }
  const d3 = erzeugeDokumente(lang, c, entwurfsKontext(c, '2026-11-11'))
  writeFileSync(`${ZIEL}/c-langname-verfahrensdoku.docx`, await erzeugeDocx(d3.verfahrensdoku))
  const extrem = { ...p, medien: p.medien.map((m) => (m.id === 'med_erp' ? { ...m, name: 'Warenwirtschaftsverwaltungsprogrammsystem' } : m)) }
  const c4 = { ...c, systeme: { ...c.systeme, med_erp: { ...c.systeme.med_erp, hersteller: 'Großhandelssoftwareentwicklungsgesellschaft' } } }
  writeFileSync(`${ZIEL}/d-ueberlang-verfahrensdoku.docx`, await erzeugeDocx(erzeugeDokumente(extrem, c4, entwurfsKontext(c, '2026-11-11')).verfahrensdoku))
  const teile = unzipSync(await erzeugeDocx(e.verfahrensdoku))
  writeFileSync(`${ZIEL}/styles.xml`, strFromU8(teile['word/styles.xml']))
  writeFileSync(`${ZIEL}/settings.xml`, strFromU8(teile['word/settings.xml']))
  writeFileSync(`${ZIEL}/core.xml`, strFromU8(teile['docProps/core.xml']))
})
