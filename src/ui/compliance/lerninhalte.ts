import type { Teilschritt } from '../../compliance/typen'

export type ComplianceThema = Teilschritt

export interface ComplianceLerninhalt {
  titel: string
  quelle: string
  text: string
}

/** Erklärungen je Teilschritt in eigenen Worten, mit Fundstelle. */
export const COMPLIANCE_LERNINHALTE: Record<ComplianceThema, ComplianceLerninhalt> = {
  unternehmen: {
    titel: 'Wer verantwortlich ist',
    quelle: 'Art. 30 Abs. 1 lit. a DSGVO; § 38 BDSG',
    text: 'Das Verzeichnis nennt den Verantwortlichen mit Anschrift und Kontakt, die Verfahrensdokumentation die Geschäftsleitung, die sie freigibt. Ein Datenschutzbeauftragter ist nötig, wenn in der Regel mindestens 20 Personen ständig mit personenbezogenen Daten am Computer arbeiten. Es gibt weitere Auslöser, etwa wenn besonders geschützte Daten zum Kern des Geschäfts gehören.',
  },
  belege: {
    titel: 'Belege und Daten',
    quelle: '§ 147 AO; § 31 Abs. 1 UStDV; Art. 30 Abs. 1 lit. b und c DSGVO',
    text: 'Jede Unterlage, die im Prozess entsteht oder genutzt wird, gehört hierher. Ihre Einordnung bestimmt die Aufbewahrungsfrist: Buchungsbelege 8 Jahre, Bücher und Organisationsunterlagen 10, Geschäftsbriefe 6. Verweist die Rechnung auf einen Lieferschein, etwa für das Lieferdatum, gehört er zur Rechnung und ist wie sie aufzubewahren. Enthält eine Unterlage Angaben zu Personen, gehört sie ins Verzeichnis von Verarbeitungstätigkeiten.',
  },
  systeme: {
    titel: 'Systeme und Dienstleister',
    quelle: 'GoBD Rz. 103–110 und 151; Art. 28 DSGVO',
    text: 'Jedes Programm, in dem Belege entstehen oder liegen, gehört mit Version und Einsatzbeginn in die Dokumentation. Aufbewahrte Unterlagen müssen vor unbemerkter Änderung geschützt und gesichert sein. Verarbeitet ein Dienstleister personenbezogene Daten im Auftrag, braucht es einen Vertrag zur Auftragsverarbeitung.',
  },
  fristen: {
    titel: 'Aufbewahren und Löschen',
    quelle: '§ 147 Abs. 3 und 4 AO; Art. 5 Abs. 1 lit. e, Art. 17 Abs. 3 DSGVO',
    text: 'Die Frist beginnt mit dem Ende des Jahres, in dem die Unterlage entstanden ist. Bis die Frist abgelaufen ist, tritt das Recht auf Löschung zurück. Personenbezogene Daten ohne Aufbewahrungspflicht brauchen eine eigene Löschfrist; wer länger aufbewahrt als vorgeschrieben, braucht dafür einen Grund.',
  },
  kontrollen: {
    titel: 'Internes Kontrollsystem',
    quelle: 'GoBD Rz. 100–102',
    text: 'Das interne Kontrollsystem beschreibt, wer was prüft und wie die Prüfung belegt wird. Eine Freigabe hilft nur, wenn eine andere Person freigibt als die, die erstellt hat (Vier-Augen-Prinzip). In sehr kleinen Betrieben gleicht eine regelmäßige Stichprobe von außen das aus.',
  },
  tom: {
    titel: 'Technische und organisatorische Maßnahmen',
    quelle: 'Art. 32 Abs. 1 DSGVO; DSK-Hinweise Ziff. 6.8',
    text: 'Schutzmaßnahmen halten Daten vertraulich, unverfälscht und verfügbar. Das Verzeichnis beschreibt sie in sechs Bereichen; trifft ein Bereich nicht zu, steht dort der Grund.',
  },
  luecken: {
    titel: 'Was die Prüfung meldet',
    quelle: 'Lückenprüfung des Prozesslotsen',
    text: 'Die Prüfung meldet, was fehlt oder sich widerspricht, nicht, ob die Angaben stimmen. Fehler sind klare Verstöße, Warnungen fehlende Pflichtangaben, Hinweise Empfehlungen. Im Zweifel entscheidet die Steuerberatung oder der Datenschutzbeauftragte.',
  },
  dokumente: {
    titel: 'Freigabe und Versionen',
    quelle: 'GoBD Rz. 151–155; Muster BStBK/DStV, Kap. 1 und 7',
    text: 'Erst die Freigabe mit Gültig-ab-Datum macht den Entwurf zur gültigen Fassung. Ändert sich der Prozess, braucht es eine neue Version; frühere Versionen bleiben mit ihrem Gültigkeitszeitraum mindestens zehn Jahre erhalten.',
  },
}
