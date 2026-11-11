import { describe, expect, it } from 'vitest'
import { neueAufgabe, neueEntscheidung, neueParallel, neuerProzess, neueRolle, neuerRuecksprungBereich, neuerZweig, neueWiederholung } from './bausteine'
import { beispielLieferdienst } from './beispiel'
import { aendereBlock, fuegeEin } from './operationen'
import { istObjektVerbName, pruefeProzess } from './pruefung'
import type { Prozess } from './typen'

function schluessel(p: Prozess, schwere?: string): string[] {
  return pruefeProzess(p)
    .filter((b) => !schwere || b.schwere === schwere)
    .map((b) => b.schluessel.split(':')[0])
}

describe('Prüfregeln', () => {
  it('findet im Fallbeispiel nichts zu beanstanden', () => {
    expect(pruefeProzess(beispielLieferdienst())).toEqual([])
  })

  it('erkennt Anteile, die nicht 100 % ergeben', () => {
    const p = aendereBlock(beispielLieferdienst(), 'ent_vorrat', (b) =>
      b.typ === 'entscheidung' ? { ...b, zweige: b.zweige.map((z) => ({ ...z, anteil: 0.4 })) } : b,
    )
    expect(schluessel(p, 'fehler')).toContain('summe')
  })

  it('erkennt Endlosschleifen', () => {
    const p = aendereBlock(beispielLieferdienst(), 'wdh_kommission', (b) => (b.typ === 'wiederholung' ? { ...b, anteilWiederholung: 1 } : b))
    expect(schluessel(p, 'fehler')).toContain('endlos')
  })

  it('erkennt unerreichbare Schritte nach einer Entscheidung, deren Ausgänge alle enden', () => {
    const rolle = neueRolle('Team')
    const ent = neueEntscheidung({
      frage: 'Antrag vollständig?',
      zweige: [neuerZweig('Ja', 0.5, { ende: 'Angenommen' }), neuerZweig('Nein', 0.5, { ende: 'Abgelehnt' })],
    })
    const danach = neueAufgabe({ name: 'Akte schließen', rolleId: rolle.id })
    const p = fuegeEin(neuerProzess({ name: 'Antrag', rollen: [rolle] }), 'haupt', 0, ent, danach)
    const fehler = pruefeProzess(p).filter((b) => b.schwere === 'fehler')
    expect(fehler.map((b) => b.schluessel)).toEqual([`unerreichbar:${ent.id}`])
    expect(fehler[0].blockId).toBe(danach.id)
  })

  it('erlaubt ein Ende innerhalb von „Gleichzeitig“; ein Rücksprung aus einem Zweig heraus bleibt eine Verklemmung', () => {
    const par = neueParallel()
    const ent = neueEntscheidung({ frage: 'Teil fehlt?', zweige: [neuerZweig('Ja', 0.1, { ende: 'Abbruch' }), neuerZweig('Nein', 0.9)] })
    par.zweige[0].schritte.push(ent)
    par.zweige[1].schritte.push(neueAufgabe({ name: 'Teil bestellen' }))
    const p = fuegeEin(neuerProzess({ name: 'Montage' }), 'haupt', 0, par)
    expect(schluessel(p, 'fehler')).toEqual([])
    // Rücksprung aus dem Zweig zu einem Schritt davor (nur in von Hand gebauten Dateien möglich)
    const erfassen = neueAufgabe({ name: 'Auftrag erfassen' })
    const zurueck = { ...ent, zweige: [ent.zweige[0], ent.zweige[1]] }
    const bereich = neuerRuecksprungBereich([erfassen, { ...par, zweige: [{ ...par.zweige[0], schritte: [zurueck] }, par.zweige[1]] }])
    zurueck.zweige[0] = { ...ent.zweige[0], ende: null, zurueckZu: bereich.id }
    const q = fuegeEin(neuerProzess({ name: 'Montage' }), 'haupt', 0, bereich)
    expect(schluessel(q, 'fehler')).toContain('verklemmung')
  })

  it('meldet leere Zweige und leere Wiederholungen als Fehler', () => {
    const p = fuegeEin(neuerProzess({ name: 'Leer' }), 'haupt', 0, neueParallel(), neueWiederholung())
    expect(schluessel(p, 'fehler')).toEqual(['leer', 'leer', 'leer'])
  })

  it('meldet ungenutzte Rollen als Hinweis', () => {
    const p = beispielLieferdienst()
    const q = { ...p, rollen: [...p.rollen, neueRolle('Vertrieb')] }
    expect(schluessel(q, 'hinweis')).toEqual(['rolle-unbenutzt'])
  })

  it('prüft die Benennung nach Objekt und Verb (7PMG G6)', () => {
    expect(istObjektVerbName('Rechnung prüfen')).toBe(true)
    expect(istObjektVerbName('Bestellung in Warenwirtschaft erfassen')).toBe(true)
    expect(istObjektVerbName('Rechnungsprüfung')).toBe(false)
    expect(istObjektVerbName('Lieferschein')).toBe(false)
    expect(istObjektVerbName('Prüfung Lieferschein')).toBe(false)
  })
})
