/**
 * Breite von Text in Calibri, der Schrift der Word-Datei. `docx.ts` wählt damit
 * Spaltenbreiten nach dem Inhalt. Zeichenbreiten in 1/1000 Geviert aus
 * calibri.ttf und calibrib.ttf (Windows 11); unbekannte Zeichen zählen breit.
 */
const ZEICHEN = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ÄÖÜäöüß§€°–—„“”‚‘’…·\u00a0×'
const NORMAL = [226, 326, 401, 498, 507, 715, 682, 221, 303, 303, 498, 498, 250, 306, 252, 386, 507, 507, 507, 507, 507, 507, 507, 507, 507, 507, 268, 268, 498, 498, 498, 463, 894, 579, 544, 533, 615, 488, 459, 631, 623, 252, 319, 520, 420, 855, 646, 662, 517, 673, 543, 459, 487, 642, 567, 890, 519, 487, 468, 307, 386, 307, 498, 498, 291, 479, 525, 423, 525, 498, 305, 471, 525, 229, 239, 455, 229, 799, 525, 527, 525, 525, 349, 391, 335, 525, 452, 715, 433, 453, 395, 314, 460, 314, 498, 579, 662, 642, 479, 527, 525, 527, 498, 507, 339, 498, 905, 418, 418, 418, 250, 250, 250, 690, 252, 226, 498]
const FETT = [226, 326, 438, 498, 507, 729, 705, 233, 312, 312, 498, 498, 258, 306, 267, 430, 507, 507, 507, 507, 507, 507, 507, 507, 507, 507, 276, 276, 498, 498, 498, 463, 898, 606, 561, 529, 630, 488, 459, 637, 631, 267, 331, 547, 423, 874, 659, 676, 532, 686, 563, 473, 495, 653, 591, 906, 551, 520, 478, 325, 430, 325, 498, 498, 300, 494, 537, 418, 537, 503, 316, 474, 537, 246, 255, 480, 246, 813, 537, 538, 537, 537, 355, 399, 347, 537, 473, 745, 459, 474, 397, 344, 475, 344, 498, 606, 676, 653, 494, 538, 537, 555, 498, 507, 342, 498, 905, 435, 435, 435, 258, 258, 258, 711, 268, 226, 498]
const UNBEKANNT = 900

const tabelle = (breiten: number[]) => new Map([...ZEICHEN].map((z, i) => [z, breiten[i]]))
const BREITEN = { normal: tabelle(NORMAL), fett: tabelle(FETT) }

/** Breite in Punkt bei der Schriftgröße `pt`. */
export function textBreite(text: string, pt: number, fett = false): number {
  const t = fett ? BREITEN.fett : BREITEN.normal
  let summe = 0
  for (const z of text) summe += t.get(z) ?? UNBEKANNT
  return (summe * pt) / 1000
}
