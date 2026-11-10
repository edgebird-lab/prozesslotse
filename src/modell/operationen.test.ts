import { describe, expect, it } from 'vitest'
import { neueAufgabe, neueEntscheidung, neueParallel, neuerProzess } from './bausteine'
import { beispielLieferdienst } from './beispiel'
import {
  alleAufgaben,
  entferneBlock,
  entferneMedium,
  entferneRolle,
  ersetzeBereich,
  findeBlock,
  findeSequenz,
  fuegeEin,
  verschiebeBlock,
} from './operationen'

describe('Operationen auf dem Prozessbaum', () => {
  it('fügt in einen verschachtelten Zweig ein, ohne das Original zu verändern', () => {
    const p = beispielLieferdienst()
    const vorher = JSON.stringify(p)
    const neu = neueAufgabe({ name: 'Lagerbestand prüfen' })
    const q = fuegeEin(p, 'zw_vorrat_nein', 0, neu)

    expect(JSON.stringify(p)).toBe(vorher)
    const zweig = findeSequenz(q, 'zw_vorrat_nein')
    expect(zweig?.sequenz.schritte[0].id).toBe(neu.id)
    expect(zweig?.besitzer?.id).toBe('ent_vorrat')
  })

  it('findet Blöcke samt Vorfahren', () => {
    const p = beispielLieferdienst()
    const f = findeBlock(p, 'auf_aendern')
    expect(f?.vorfahren.map((b) => b.id)).toEqual(['ent_vorrat', 'ent_ersatz'])
    expect(f?.sequenz.id).toBe('zw_ersatz_ja')
    expect(findeBlock(p, 'gibt_es_nicht')).toBeNull()
  })

  it('entfernt verschachtelte Blöcke', () => {
    const p = entferneBlock(beispielLieferdienst(), 'auf_kontrollieren')
    expect(findeBlock(p, 'auf_kontrollieren')).toBeNull()
    expect(findeSequenz(p, 'seq_kommission')?.sequenz.schritte).toHaveLength(1)
  })

  it('verschiebt innerhalb der Sequenz und bleibt an den Rändern stehen', () => {
    const p = beispielLieferdienst()
    const q = verschiebeBlock(p, 'auf_erfassen', -1)
    expect(q.ablauf.schritte.slice(0, 2).map((b) => b.id)).toEqual(['auf_erfassen', 'auf_annehmen'])
    const r = verschiebeBlock(q, 'auf_erfassen', -1)
    expect(r.ablauf.schritte[0].id).toBe('auf_erfassen')
  })

  it('ersetzt einen Bereich durch neue Blöcke', () => {
    const p = neuerProzess()
    const a = neueAufgabe({ name: 'A erledigen' })
    const b = neueAufgabe({ name: 'B erledigen' })
    const c = neueAufgabe({ name: 'C erledigen' })
    const q = fuegeEin(p, 'haupt', 0, a, b, c)
    const par = neueParallel()
    const r = ersetzeBereich(q, 'haupt', 1, 2, [par])
    expect(r.ablauf.schritte.map((x) => x.id)).toEqual([a.id, par.id])
  })

  it('leert Verweise auf entfernte Rollen und Systeme', () => {
    const p = beispielLieferdienst()
    const ohneRolle = entferneRolle(p, 'rol_disposition')
    expect(ohneRolle.rollen.some((r) => r.id === 'rol_disposition')).toBe(false)
    expect(alleAufgaben(ohneRolle).filter((a) => a.rolleId === null).map((a) => a.id)).toEqual(['auf_tour', 'auf_bestaetigen'])

    const ohnePapier = entferneMedium(p, 'med_papier')
    const erfassen = findeBlock(ohnePapier, 'auf_erfassen')?.block
    expect(erfassen?.typ === 'aufgabe' && erfassen.uebertragung?.quelleMediumId).toBeNull()
    expect(alleAufgaben(ohnePapier).some((a) => a.mediumId === 'med_papier')).toBe(false)
  })

  it('legt neue Entscheidungen mit zwei Ausgängen zu je 50 % an', () => {
    const e = neueEntscheidung()
    expect(e.zweige.map((z) => z.anteil)).toEqual([0.5, 0.5])
  })
})
