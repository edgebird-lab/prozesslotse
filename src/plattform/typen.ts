/**
 * Was die Oberfläche vom Betriebssystem braucht: Dateien öffnen und speichern,
 * Fenstertitel, Schließen abfangen, Menübefehle. Im Browser gibt es davon nur
 * einen Teil (Herunterladen statt Speichern); im Windows-Programm (Tauri)
 * erledigt das der Rust-Teil.
 */

/** Eine geöffnete Datei. Im Browser gibt es keinen Pfad. */
export interface Datei {
  pfad: string | null
  name: string
  inhalt: string
}

export interface Zuletzt {
  pfad: string
  name: string
}

export type DateiArt = 'projekt' | 'bpmn' | 'svg' | 'docx'

/** Befehle aus dem Programmmenü. */
export type MenueBefehl =
  | 'neu'
  | 'oeffnen'
  | 'speichern'
  | 'speichernUnter'
  | 'bpmn'
  | 'drucken'
  | 'pdf'
  | 'rueckgaengig'
  | 'wiederholen'
  | 'lernmodus'
  | 'beispielLieferdienst'
  | 'beispielOnline'
  | 'ueber'

export interface Plattform {
  /** true im Windows-Programm */
  readonly desktop: boolean
  /** Öffnen-Dialog; null bei Abbruch. Nur im Programm, im Browser öffnet die Oberfläche selbst. */
  oeffnen(): Promise<Datei | null>
  /** Datei, mit der das Programm gestartet wurde (Doppelklick im Explorer). */
  startDatei(): Promise<Datei | null>
  /** Speichert an einen Pfad, der schon geöffnet oder gewählt wurde (nur im Programm). */
  speichern(pfad: string, inhalt: string): Promise<void>
  /** Fragt nach Ort und Namen; im Browser ein Download. null bei Abbruch. */
  speichernUnter(vorschlag: string, inhalt: string, art: DateiArt): Promise<{ pfad: string | null; name: string } | null>
  /** Wie `speichernUnter`, aber für Binärdateien (Word). Im Programm gehen die Bytes als Rohdaten an den Rust-Teil, ohne JSON und ohne Base64. */
  speichereBytes(vorschlag: string, bytes: Uint8Array, art: 'docx'): Promise<{ pfad: string | null; name: string } | null>
  /** Zuletzt geöffnete Dateien, neueste zuerst. */
  zuletzt(): Promise<Zuletzt[]>
  oeffneZuletzt(pfad: string): Promise<Datei>
  setzeTitel(titel: string): void
  /** Weitere Datei soll geöffnet werden (Doppelklick bei laufendem Programm, ins Fenster gezogen). */
  beiDatei(f: (d: Datei) => void): () => void
  /** Vor dem Schließen: `darf` entscheidet, ob das Fenster zugeht. */
  beimSchliessen(darf: () => Promise<boolean>): () => void
  beiMenue(f: (befehl: MenueBefehl) => void): () => void
  /** Bericht als PDF ohne Druckdialog; false, wenn das hier nicht geht oder abgebrochen wurde. */
  alsPdf(vorschlag: string): Promise<boolean>
}
