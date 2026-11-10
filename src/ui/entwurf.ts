import type { Block } from '../modell/typen'

/** Was fehlt, bevor ein neuer Baustein eingefügt werden kann; `null` wenn alles da ist. */
export function fehltNoch(b: Block): string | null {
  switch (b.typ) {
    case 'aufgabe':
      return b.name.trim() ? null : 'Gib der Aufgabe zuerst einen Namen.'
    case 'warten':
      return b.name.trim() ? null : 'Schreib zuerst, worauf gewartet wird.'
    case 'wiederholung':
      if (!b.frage.trim()) return 'Formuliere zuerst die Frage, die über die Wiederholung entscheidet.'
      return b.anteilWiederholung < 1 ? null : 'Der Anteil muss unter 100 % liegen, sonst endet die Wiederholung nie.'
    case 'entscheidung': {
      if (!b.frage.trim()) return 'Formuliere zuerst die Frage der Entscheidung.'
      const summe = b.zweige.reduce((s, z) => s + z.anteil, 0)
      if (Math.abs(summe - 1) > 1e-6) return 'Die Anteile der Ausgänge müssen zusammen 100 % ergeben.'
      return b.zweige.some((z) => !z.bezeichnung.trim()) ? 'Jeder Ausgang braucht eine Bezeichnung.' : null
    }
    case 'parallel':
      return null
  }
}
