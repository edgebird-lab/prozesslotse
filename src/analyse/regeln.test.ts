import { describe, expect, it } from 'vitest'
import { beispielLieferdienst } from '../modell/beispiel'
import { findeBlock } from '../modell/operationen'
import { pruefeProzess } from '../modell/pruefung'
import { berechneKennzahlen } from './kennzahlen'
import { bewerteVorschlaege, findeVorschlaege, verbindeNamen } from './regeln'

describe('Verbesserungsregeln', () => {
  it('findet im Fallbeispiel sieben Vorschläge aus fünf Regeln', () => {
    const schluessel = findeVorschlaege(beispielLieferdienst()).map((v) => v.schluessel)
    expect(schluessel.sort()).toEqual(
      [
        'freigabe:auf_freigeben',
        'medienbruch:auf_bestaetigen',
        'medienbruch:auf_erfassen',
        'medienbruch:auf_tour',
        'nacharbeit:wdh_kommission',
        'parallelisieren:wdh_kommission:auf_tour',
        'zusammenlegen:auf_annehmen:auf_erfassen',
      ].sort(),
    )
  })

  it('erzeugt nur gültige Modelle', () => {
    const p = beispielLieferdienst()
    for (const v of findeVorschlaege(p)) {
      expect(pruefeProzess(v.anwenden(p)).filter((b) => b.schwere === 'fehler'), v.schluessel).toEqual([])
    }
  })

  it('rechnet die Wirkung der Freigabe-Regel exakt', () => {
    const p = beispielLieferdienst()
    const v = bewerteVorschlaege(p).find((x) => x.regel === 'freigabe')!
    // 2 Arbeitstage Liegezeit + 1 Min. Bearbeitung, erreicht in 97,6 % der Fälle
    expect(v.wirkung.durchlaufzeitMin).toBeCloseTo(-(960 + 1) * 0.976, 6)
    expect(v.wirkung.kostenProVorgang).toBeCloseTo(-(1 / 60) * 65 * 0.976, 6)
    // die Freigabe ist der größte Hebel und steht vorn
    expect(bewerteVorschlaege(p)[0].regel).toBe('freigabe')
  })

  it('verkürzt durch Parallelisieren um die kürzere der beiden Dauern', () => {
    const p = beispielLieferdienst()
    const v = bewerteVorschlaege(p).find((x) => x.regel === 'parallelisieren')!
    const q = v.anwenden(p)
    expect(findeBlock(q, 'par_auf_tour')?.block.typ).toBe('parallel')
    // Kommissionieren mit Kontrolle: (128 + 17) / (1 − 0,2) = 181,25 Min.; Tour planen: 241,5 Min.
    // exakt mit Erwartungswert des Maximums: Kommissionieren dauert 145 Min. je Durchlauf, im Schnitt 1,25 Durchläufe;
    // E[max(145·N, 241,5)] = 0,8 · 241,5 + (181,25 − 0,8 · 145) = 258,45 statt 241,5 bei der alten Näherung
    expect(v.wirkung.durchlaufzeitMin).toBeCloseTo(-(181.25 + 241.5 - 258.45) * 0.976, 1)
    expect(v.wirkung.kostenProVorgang).toBeCloseTo(0, 10)
  })

  it('legt Schritte zusammen und spart dabei auch das Abtippen', () => {
    const p = beispielLieferdienst()
    const v = findeVorschlaege(p).find((x) => x.regel === 'zusammenlegen')!
    const q = v.anwenden(p)
    const neu = findeBlock(q, 'auf_annehmen')?.block
    expect(neu).toMatchObject({ name: 'Bestellung telefonisch annehmen und in Warenwirtschaft erfassen', bearbeitungMin: 7, mediumId: 'med_erp', uebertragung: null })
    expect(findeBlock(q, 'auf_erfassen')).toBeNull()
    const k = berechneKennzahlen(q)
    expect(k.medienbrueche).toBeCloseTo(0.976 * 2, 6)
  })

  it('bietet nach dem Streichen der Freigabe neu das Zusammenlegen der Rechnungsschritte an', () => {
    const p = beispielLieferdienst()
    const q = findeVorschlaege(p).find((x) => x.regel === 'freigabe')!.anwenden(p)
    const neu = findeVorschlaege(q).map((v) => v.schluessel)
    expect(neu).toContain('zusammenlegen:auf_rechnung:auf_versenden')
    const z = findeVorschlaege(q).find((v) => v.schluessel === 'zusammenlegen:auf_rechnung:auf_versenden')!
    expect(findeBlock(z.anwenden(q), 'auf_rechnung')?.block).toMatchObject({ name: 'Rechnung erstellen und versenden' })
  })

  it('lässt verworfene Vorschläge weg', () => {
    const p = beispielLieferdienst()
    const alle = bewerteVorschlaege(p)
    const ohne = bewerteVorschlaege(p, ['freigabe:auf_freigeben'])
    expect(ohne).toHaveLength(alle.length - 1)
  })

  it('senkt im Fallbeispiel mit zwei Vorschlägen die Durchlaufzeit von 6,7 auf 4,5 Arbeitstage (wie in der README)', () => {
    const p = beispielLieferdienst()
    const tag = 8 * 60
    expect(berechneKennzahlen(p).durchlaufzeitMin / tag).toBeCloseTo(6.74, 2)
    const q = bewerteVorschlaege(p)[0].anwenden(p) // Freigabe streichen
    const r = bewerteVorschlaege(q)[0].anwenden(q) // Tour planen parallel zur Kommissionierung
    expect(findeBlock(r, 'par_auf_tour')?.block.typ).toBe('parallel')
    expect(berechneKennzahlen(r).durchlaufzeitMin / tag).toBeCloseTo(4.45, 2)
  })

  it('verbindet Namen mit gemeinsamem Objekt', () => {
    expect(verbindeNamen('Rechnung erstellen', 'Rechnung versenden')).toBe('Rechnung erstellen und versenden')
    expect(verbindeNamen('Ware prüfen', 'Lieferschein drucken')).toBe('Ware prüfen und Lieferschein drucken')
  })
})
