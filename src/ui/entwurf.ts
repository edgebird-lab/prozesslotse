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
    case 'oder': {
      if (!b.frage.trim()) return 'Schreib zuerst, worum es geht, z. B. „Welche Unterlagen fehlen?“.'
      if (b.zweige.some((z) => z.id !== b.standard && !z.bezeichnung.trim())) return 'Jeder Weg braucht eine Bezeichnung.'
      const keiner = b.zweige.reduce((q, z) => (z.id === b.standard ? q : q * (1 - Math.min(1, Math.max(0, z.anteil)))), 1)
      return b.standard === null && keiner > 1e-6 ? 'Lege fest, was passiert, wenn keiner der Wege zutrifft.' : null
    }
    case 'parallel':
      return null
  }
}
