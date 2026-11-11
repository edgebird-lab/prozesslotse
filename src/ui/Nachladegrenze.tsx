/**
 * Teile, die erst bei Bedarf nachladen („Dokumentieren“ samt Lückenprüfung und
 * Versionen), können fehlen: Verbindung weg oder inzwischen eine neue Fassung auf
 * dem Server mit anderen Dateinamen. Statt einer leeren Seite erscheint dann eine
 * Meldung mit „Neu laden“; die übrigen Schritte bleiben bedienbar.
 */
import { Component, type ReactNode } from 'react'

/** Meldung an der Stelle des fehlenden Teils. Neu laden holt alle Teile neu; React merkt sich einen gescheiterten Import sonst. */
export function Nachladefehler({ was }: { was: string }) {
  return (
    <div className="banner banner-fehler nachladefehler" role="alert">
      <p>
        „{was}“ ließ sich nicht laden. Vielleicht ist die Verbindung unterbrochen, oder es gibt inzwischen eine neue Fassung der App. Die anderen Schritte funktionieren weiter.
      </p>
      <button type="button" className="knopf" onClick={() => window.location.reload()}>
        Neu laden
      </button>
    </div>
  )
}

/** Fehlergrenze um einen nachgeladenen Teil (`lazy` mit `Suspense`). */
export class Nachladegrenze extends Component<{ was: string; children: ReactNode }, { gescheitert: boolean }> {
  state = { gescheitert: false }

  static getDerivedStateFromError(): { gescheitert: boolean } {
    return { gescheitert: true }
  }

  render() {
    return this.state.gescheitert ? <Nachladefehler was={this.props.was} /> : this.props.children
  }
}
