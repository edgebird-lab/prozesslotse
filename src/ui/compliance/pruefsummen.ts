/**
 * Nachrechnen der Prüfsummen freigegebener Versionen (Spezifikation 6.8): nach dem
 * Laden asynchron, einmal je Version. Die Versionsliste zeigt das Ergebnis je
 * Version; eine veränderte oder beschädigte Version meldet zusätzlich die Kopfzeile.
 */
import { useEffect, useRef, useState } from 'react'
import type { DokuVersion } from '../../compliance/typen'

/** „unbekannt“: Nachrechnen nicht möglich (z. B. ohne Web Crypto); das ist kein Befund. */
export type PruefsummenStand = 'stimmt' | 'falsch' | 'offen' | 'unbekannt'

const ergebnisse = new WeakMap<DokuVersion, Promise<boolean>>()

/** Ergebnis je Version; Versionen sind unveränderlich, also wird jede nur einmal gerechnet. */
function pruefeVersion(v: DokuVersion): Promise<boolean> {
  let ergebnis = ergebnisse.get(v)
  if (!ergebnis) {
    // Versionen samt Generatoren laden erst hier: Die Kopfzeile nutzt das Modul, der Hauptteil bleibt klein (abnahme-11)
    ergebnis = import('../../compliance/versionen').then((m) => m.pruefsummeStimmt(v))
    ergebnisse.set(v, ergebnis)
  }
  return ergebnis
}

export const PRUEFSUMME_TEXT: Record<PruefsummenStand, string> = {
  stimmt: 'Prüfsumme stimmt',
  falsch: 'Prüfsumme stimmt nicht – Version wurde verändert oder ist beschädigt',
  offen: 'Prüfsumme wird nachgerechnet …',
  unbekannt: 'Prüfsumme nicht nachgerechnet',
}

/** Stand der Prüfsumme je Version. */
export function usePruefsummen(versionen: DokuVersion[]): (v: DokuVersion) => PruefsummenStand {
  const [stand, setStand] = useState<ReadonlyMap<DokuVersion, boolean | null>>(() => new Map())
  useEffect(() => {
    let aktiv = true
    const setze = (v: DokuVersion, ok: boolean | null) => aktiv && setStand((s) => (s.get(v) === ok ? s : new Map(s).set(v, ok)))
    for (const v of versionen)
      pruefeVersion(v).then(
        (ok) => setze(v, ok),
        () => setze(v, null),
      )
    return () => {
      aktiv = false
    }
  }, [versionen])
  return (v) => {
    const ok = stand.get(v)
    return ok === undefined ? 'offen' : ok === null ? 'unbekannt' : ok ? 'stimmt' : 'falsch'
  }
}

/** Meldet nach dem Laden in der Kopfzeile, wenn eine Version nicht mehr zu ihrer Prüfsumme passt; jede Version nur einmal. */
export function useMeldeFalschePruefsummen(versionen: DokuVersion[] | undefined, melde: (text: string) => void): void {
  const gemeldet = useRef(new WeakSet<DokuVersion>())
  useEffect(() => {
    if (!versionen || versionen.length === 0) return
    let aktiv = true
    void Promise.all(versionen.map((v) => pruefeVersion(v).then((ok) => (ok ? null : v), () => null))).then((ergebnis) => {
      const falsch = ergebnis.filter((v): v is DokuVersion => v !== null && !gemeldet.current.has(v))
      if (!aktiv || falsch.length === 0) return
      for (const v of falsch) gemeldet.current.add(v)
      melde(
        falsch.length === 1
          ? `Prüfsumme stimmt nicht – Version ${falsch[0].bezeichnung} wurde verändert oder ist beschädigt.`
          : `Prüfsumme stimmt nicht – die Versionen ${falsch.map((v) => v.bezeichnung).join(', ')} wurden verändert oder sind beschädigt.`,
      )
    })
    return () => {
      aktiv = false
    }
  }, [versionen, melde])
}
