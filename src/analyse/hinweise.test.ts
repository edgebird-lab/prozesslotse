import { describe, expect, it } from 'vitest'
import { beispielLieferdienst } from '../modell/beispiel'
import { aendereBlock } from '../modell/operationen'
import { findeSchwachstellen } from './hinweise'
import { berechneKennzahlen } from './kennzahlen'
import type { Prozess } from '../modell/typen'

function arten(p: Prozess): string[] {
  return findeSchwachstellen(p, berechneKennzahlen(p)).map((b) => b.schluessel.split(':')[0])
}

describe('Schwachstellen im Fallbeispiel', () => {
  it('findet Engpass, Medienbrüche, Liegezeit, Nacharbeit, Freigabe, Hin und Her und niedrige Flusseffizienz', () => {
    expect(arten(beispielLieferdienst()).sort()).toEqual(
      ['engpass', 'flusseffizienz', 'freigabe', 'liegezeit', 'medienbruch', 'medienbruch', 'medienbruch', 'nacharbeit', 'pingpong', 'pingpong'].sort(),
    )
  })

  it('meldet Überlastung als Fehler', () => {
    const p = beispielLieferdienst()
    const q = { ...p, rollen: p.rollen.map((r) => (r.id === 'rol_leitung' ? { ...r, verfuegbarProzent: 10 } : r)) }
    const befunde = findeSchwachstellen(q, berechneKennzahlen(q))
    expect(befunde[0]).toMatchObject({ schluessel: 'ueberlastet:rol_leitung', schwere: 'fehler' })
  })

  it('meldet keine Nacharbeit unter 10 %', () => {
    const p = aendereBlock(beispielLieferdienst(), 'wdh_kommission', (b) => (b.typ === 'wiederholung' ? { ...b, anteilWiederholung: 0.05 } : b))
    expect(arten(p)).not.toContain('nacharbeit')
  })
})
