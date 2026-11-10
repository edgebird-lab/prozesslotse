/** Standardfehler des Mittelwerts einer Stichprobe. */
export function standardfehler(werte: ArrayLike<number>): number {
  const n = werte.length
  if (n < 2) return 0
  let summe = 0
  for (let i = 0; i < n; i++) summe += werte[i]
  const mittel = summe / n
  let quadrate = 0
  for (let i = 0; i < n; i++) quadrate += (werte[i] - mittel) ** 2
  return Math.sqrt(quadrate / (n - 1) / n)
}
