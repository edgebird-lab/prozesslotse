/**
 * Warteschlangenmodell M/M/c (Erlang C): Wie lange wartet Arbeit im Schnitt,
 * bevor eine von c Personen frei ist? Annahme: Arbeit trifft zufällig ein,
 * Bearbeitungszeiten streuen exponentiell. Für geplante, gebündelte Arbeit ist
 * das eher zu pessimistisch; als Vergleich zwischen Rollen taugt es, weil es
 * die Teamgröße berücksichtigt (eine feste 85-%-Schwelle tut das nicht).
 */

/**
 * Ab dieser mittleren Wartezeit (Vielfaches der Bearbeitungszeit) gilt eine
 * Rolle als Engpass. Bei einer Person entspricht das 80 % Auslastung, der
 * üblichen Faustregel; Teams vertragen mehr (zwei Personen etwa 89 %, sechs
 * etwa 95 %), weil sich Schwankungen auf mehrere Schultern verteilen.
 */
export const WARTEFAKTOR_SCHWELLE = 4

/** Wahrscheinlichkeit, warten zu müssen (Erlang-C-Formel), für c Bedienende und Auslastung rho < 1. */
export function erlangC(c: number, rho: number): number {
  if (rho >= 1) return 1
  if (rho <= 0) return 0
  const a = c * rho // angebotene Last
  let summe = 0
  let term = 1 // a^k / k!
  for (let k = 0; k < c; k++) {
    summe += term
    term *= a / (k + 1)
  }
  // term ist jetzt a^c / c!
  const oben = term / (1 - rho)
  return oben / (summe + oben)
}

/** Mittlere Wartezeit als Vielfaches der Bearbeitungszeit: Wq / Ts = C / (c · (1 − rho)). */
export function wartefaktor(c: number, rho: number): number {
  if (rho >= 1) return Infinity
  if (rho <= 0) return 0
  return erlangC(c, rho) / (c * (1 - rho))
}

/** Auslastung, ab der die Wartezeit das `faktor`-Fache der Bearbeitung erreicht (Bisektion). */
export function engpassSchwelle(c: number, faktor: number): number {
  let unten = 0
  let oben = 0.9999
  for (let i = 0; i < 60; i++) {
    const mitte = (unten + oben) / 2
    if (wartefaktor(c, mitte) < faktor) unten = mitte
    else oben = mitte
  }
  return (unten + oben) / 2
}

/** Personen als ganze Zahl Bedienender, mindestens 1. */
export function bedienende(personen: number): number {
  return Math.max(1, Math.round(personen))
}
