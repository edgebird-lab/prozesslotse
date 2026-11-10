import type { Block, Prozess } from '../modell/typen'
import type { SymbolArt } from './Symbol'

/** Passendes BPMN-Symbol für einen Baustein. */
export function symbolFuer(b: Block, p: Prozess): SymbolArt {
  switch (b.typ) {
    case 'aufgabe': {
      const m = p.medien.find((x) => x.id === b.mediumId)
      if (!m) return 'aufgabe'
      return m.art === 'papier' || m.art === 'telefon' ? 'manuell' : 'benutzer'
    }
    case 'entscheidung':
      return b.art === 'ereignis' ? 'ereignisgateway' : 'xor'
    case 'parallel':
      return 'und'
    case 'oder':
      return 'oder'
    case 'wiederholung':
      return b.modus === 'ruecksprung' ? 'ruecksprung' : 'wiederholung'
    case 'warten':
      return b.art === 'zeit' ? 'warten-zeit' : 'warten-nachricht'
  }
}
