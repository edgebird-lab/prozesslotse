/**
 * Fokus nach Anlegen und Entfernen: Er bleibt bei einem sinnvollen Element,
 * statt mit einem verschwundenen Knopf auf <body> zu fallen. Aufrufer zeichnen
 * die Änderung vorher mit flushSync, damit das neue Element schon da ist.
 */

/** Setzt den Fokus auf das Element; was nicht bedienbar ist (z. B. eine Überschrift), bekommt dafür tabIndex −1. */
export function fokussiere(el: HTMLElement | null | undefined): void {
  if (!el) return
  if (!el.matches('input, select, textarea, button, a[href], summary, [tabindex]')) el.tabIndex = -1
  el.focus()
}

/** Nächster, sonst vorheriger Geschwister-Eintrag, der zur Auswahl passt (Ersatz für einen entfernten Eintrag). */
export function nachbar(el: Element | null | undefined, auswahl: string): HTMLElement | null {
  if (!el) return null
  for (let n = el.nextElementSibling; n; n = n.nextElementSibling) if (n instanceof HTMLElement && n.matches(auswahl)) return n
  for (let n = el.previousElementSibling; n; n = n.previousElementSibling) if (n instanceof HTMLElement && n.matches(auswahl)) return n
  return null
}

/** Erstes Eingabefeld im Element, z. B. „Name“ eines neuen Eintrags. */
export function erstesFeld(el: Element | null | undefined): HTMLElement | null {
  return el?.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea') ?? null
}
