import { describe, expect, it } from 'vitest'
import { COMPLIANCE_LERNINHALTE } from './lerninhalte'

describe('Lernhinweise der Compliance-Doku', () => {
  it('„Aufbewahren und Löschen“: Das Recht auf Löschung tritt bis zum Ende der Frist zurück, nicht bis zu ihrem Beginn', () => {
    const { text } = COMPLIANCE_LERNINHALTE.fristen
    expect(text).not.toContain('Bis dahin')
    expect(text).toContain('Die Frist beginnt mit dem Ende des Jahres, in dem die Unterlage entstanden ist. Bis die Frist abgelaufen ist, tritt das Recht auf Löschung zurück.')
  })
})
