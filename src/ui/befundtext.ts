import type { Befund, Schwere } from '../modell/pruefung'

export const SCHWERE_TEXT: Record<Schwere, [string, string]> = {
  fehler: ['Fehler', 'Fehler'],
  warnung: ['Warnung', 'Warnungen'],
  hinweis: ['Hinweis', 'Hinweise'],
}

export function zaehle(befunde: Befund[]): string {
  const teile = (['fehler', 'warnung', 'hinweis'] as Schwere[]).map((s) => {
    const n = befunde.filter((b) => b.schwere === s).length
    return `${n === 0 ? 'keine' : n} ${SCHWERE_TEXT[s][n === 1 ? 0 : 1]}`
  })
  return teile.join(' · ')
}
