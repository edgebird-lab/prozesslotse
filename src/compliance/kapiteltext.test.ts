import { describe, expect, it } from 'vitest'
import { kapitelText } from './dokument'

describe('kapitelText: geänderte Kapitel zum Lesen', () => {
  it('schreibt die Dokumente aus statt „VD“ und „VVT“', () => {
    expect(kapitelText(['VD 3.2', 'VD 3.3', 'VD 4'])).toBe('Verfahrensdokumentation 3.2, 3.3 und 4')
    expect(kapitelText(['VVT B.1'])).toBe('Verzeichnis B.1')
    expect(kapitelText(['VD 1', 'VVT B.1', 'VVT B.3'])).toBe('Verfahrensdokumentation 1; Verzeichnis B.1 und B.3')
  })

  it('lässt den Namen des eigenen Dokuments weg', () => {
    expect(kapitelText(['VD 3.2', 'VD 4', 'VVT B.1'], 'verfahrensdokumentation')).toBe('3.2 und 4; Verzeichnis B.1')
  })

  it('ohne Kapitel leer; unbekannte Schlüssel bleiben stehen', () => {
    expect(kapitelText([])).toBe('')
    expect(kapitelText(['Anhang'])).toBe('Anhang')
  })
})
