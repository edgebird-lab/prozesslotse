# Compliance-Doku aus dem Prozessmodell

Spezifikation einer Erweiterung des Prozesslotsen · Stand 11.11.2026 · Grundlage: Prozesslotse 0.2.0 (Commit `915e957`: Windows-Programm mit Tauri 2, ODER-Verzweigung, externe Teilnehmer) und Arbeitsstand Dateiformat 3 (`docs/modellierung-v3.md`) · Status: Entwurf zur Abstimmung mit Robin, fachlich geprüft (Prüfvermerk am Ende)

Die Erweiterung erzeugt aus dem modellierten Ablauf die **GoBD-Verfahrensdokumentation** und das **Verzeichnis von Verarbeitungstätigkeiten** nach Art. 30 Abs. 1 DSGVO. Beide sind Vorlagen zur Prüfung durch Steuerberatung bzw. Datenschutzbeauftragten, keine Rechts- oder Steuerberatung.

## Vorab: Prüfung der Ausgangsidee

| Annahme in der Ideensammlung | Ergebnis der Prüfung | Folge für diese Spezifikation |
| --- | --- | --- |
| Gliederung „des Musters von BStBK und DStV“ | Das gemeinsame Muster gilt nur für das **ersetzende Scannen** (Version 2.1, Stand 27.02.2026). Das Muster zur Belegablage stammt von der AWV (Muster, Ziff. 0.3). | Die Gliederung der Kapitel 1–3 und 6–9 ist allgemein und wird übernommen, die Texte nicht (3.4). Kapitel 4 beschreibt den modellierten Ablauf statt des Scannens. Das Muster sieht solche Ergänzungen vor (Ziff. 0.1 [9]). |
| Aufbewahrung „nach BEG IV 8 Jahre“ (steht bei Idee 1, gilt hier ebenso) | Gilt für Buchungsbelege. Bücher und Organisationsunterlagen: 10 Jahre, Geschäftsbriefe und sonstige Unterlagen: 6 Jahre (§ 147 Abs. 3 AO). Das Muster empfiehlt einheitlich mindestens 10 Jahre (Ziff. 2.3 [2]). | Frist je Unterlagenart. Längere Aufbewahrung personenbezogener Daten braucht eine Begründung (Regel D7). |
| Aufwand „S“ | Zwei Dokumente, Versionen, 38 Prüfregeln, acht Teilschritte, DOCX-Export, eigene Tabellen für Unterlagen | rund 30 Arbeitstage (Abschnitt 11) |
| (nicht in der Idee) Das Prozessmodell wächst parallel auf Dateiformat 3 (`docs/modellierung-v3.md`). ODER und externe Teilnehmer sind umgesetzt (Commits `4f8ee69`, `915e957`); Teilprozess, für jede Position, Unterbrechung und Abbruch folgen. | Kapitel 4 muss alle Bausteine beschreiben können. Datenobjekte gehören nicht zu Format 3 und sind auch sonst nirgends spezifiziert oder geplant. | Satzbausteine für alle Bausteine aus Format 3 (6.6.1); externe Teilnehmer erscheinen in Kapitel 2.6 und als Vorschläge für Empfänger. Unterlagen und Ablageorte führt die Erweiterung selbst (4.1). |
| Angaben „über BPMN-`extensionElements`“ | Das ganze Projekt reist schon heute im BPMN-Export mit (`src/bpmn/einbettung.ts`). Damit stecken auch Compliance-Angaben und Versionen in jeder BPMN-Datei. | keine eigenen BPMN-Erweiterungen; BPMN-Export wahlweise ohne Compliance-Angaben (Abschnitt 8) |
| Lokales LLM zum Formulieren | Widerspricht „ohne KI“ und macht Ausgaben schwer testbar | feste Satzbausteine, kein LLM |
| Jährliche Erinnerung | Eine Web-App ohne Server kann nicht von sich aus erinnern. | Befund „Überprüfung fällig“ beim Öffnen (V3); Benachrichtigung erst im Windows-Programm, später |
| Medienbrüche als Lücke | meldet der Prozesslotse bereits | neu nur: „Beleg wird abgetippt, keine Kontrolle“ (B9) |

## 1. Ziel und Nutzer

In vielen Kleinbetrieben fehlen zwei Pflichtdokumente: die Verfahrensdokumentation nach GoBD (Rz. 151–155) und das Verzeichnis von Verarbeitungstätigkeiten nach Art. 30 Abs. 1 DSGVO. Die Erweiterung erzeugt beide aus dem Prozess, den der Nutzer im Prozesslotsen modelliert hat. Dazu fragt der Assistent nach Belegen und Daten, Systemen und Dienstleistern, Fristen, Kontrollen und Schutzmaßnahmen und meldet Lücken als Befunde. Ändert sich der Prozess, ändern sich die Dokumente mit; freigegebene Stände bleiben als Versionen mit Gültig-ab-Datum erhalten. Nutzer sind Inhaber und Büroleitungen von Betrieben mit 1 bis 20 Beschäftigten, Berater (Steuerkanzlei, Datenschutz, IT) und olbricht-digital als Dienstleister.

## 2. Umfang

### 2.1 Version 0.1 der Erweiterung (MVP)

1. Neuer Hauptschritt **„Dokumentieren“** zwischen „Verbessern“ und „Bericht“ mit acht Teilschritten: Unternehmen, Belege und Daten, Systeme und Dienstleister, Aufbewahrung und Löschung, Kontrollen, Schutzmaßnahmen, Lücken, Dokumente.
2. Ein Projekt beschreibt einen Prozess. Daraus entstehen eine Verfahrensdokumentation für diesen Prozess und ein Eintrag im Verzeichnis. Grundlage ist immer der **Ist-Prozess**.
3. **Unterlagen und Ablageorte** (fachlich Datenobjekte und Datenspeicher) mit „entsteht in“ und „genutzt in“ als eigene Tabellen in den Compliance-Angaben. Das BPMN-Diagramm zeigt sie im MVP nicht (4.1).
4. **Verfahrensdokumentation** in der Gliederung des Musters von BStBK und DStV (Version 2.1); Kapitel 4 entsteht aus dem Ablauf.
5. **Verzeichnis von Verarbeitungstätigkeiten** nach Art. 30 Abs. 1 lit. a–g im Aufbau des DSK-Musters, mit TOM-Übersicht in den sechs Bereichen nach Art. 32 Abs. 1 DSGVO.
6. **Lückenprüfung** mit 38 Regeln (Abschnitt 6.5) als Befunde im Stil von `pruefung.ts`, mit Sprung zur Ursache und Markierung im Diagramm.
7. **Fristberechnung:** gesetzliche Mindestfrist je Unterlagenart, Fristende, frühestes Vernichtungs- bzw. Löschdatum.
8. **Versionen:** Eine Freigabe friert beide Dokumente ein (gültig ab, freigegeben am und von, Änderung, geänderte Kapitel, SHA-256-Prüfsumme). Befunde, wenn sich seit der Freigabe etwas geändert hat oder sie älter als 365 Tage ist.
9. **Export** als DOCX (Bibliothek `docx`) und über die Druckansicht als PDF. Jede Ausgabe trägt den Hinweis „Vorlage zur Prüfung …“, nicht freigegebene Stände zusätzlich „Entwurf“.
10. BPMN-Export wahlweise ohne Compliance-Angaben, zur Weitergabe an Dritte.
11. Firmenangaben und Schutzmaßnahmen aus einer anderen Projektdatei übernehmen.
12. Hinweis im Schritt „Verbessern“, wenn ein Vorschlag eine dokumentierte Kontrolle streicht.
13. Versionen getrennt im Browser-Speicher ablegen; Meldung, wenn der Speicher voll ist; Menüpunkt „Daten im Browser löschen“.
14. Fallbeispiel „Lieferdienst“ mit Compliance-Angaben als Testdaten und Vorführung.

### 2.2 Ausdrücklich später

- Firmenmappe: mehrere Prozesse zu einer Gesamtdokumentation und einem Gesamtverzeichnis zusammenführen.
- Verfahrensdokumentation für den Soll-Prozess als Entwurf vor der Umsetzung.
- Eigener Baustein „ersetzendes Scannen“ (Kapitel 4 und 5 des Musters) statt Verweis.
- Diagramm als Bild in der DOCX-Datei (im MVP nur in der Druckansicht).
- Datenobjekte und Datenspeicher im BPMN-Diagramm (`dataObjectReference`, `dataStoreReference`, 3.7) als eigene Erweiterung des Prozessmodells. Dann wandern die Tabellen aus 4.1 per Migration ins Modell, und Compliance-Angaben können als `<bpmn:documentation>` an den Datenobjekten erscheinen.
- Verzeichnis für Auftragsverarbeiter (Art. 30 Abs. 2), Datenschutz-Folgenabschätzung, Informationspflichten (Art. 13, 14).
- Sonderfälle: Kassenführung (§ 146a AO), Zollunterlagen (§ 147 Abs. 1 Nr. 4a AO), Lohnbuchhaltung.
- Erinnerung als Windows-Benachrichtigung (Tauri).

### 2.3 Abgrenzung

Die App archiviert keine Belege und ist kein Archivsystem. Sie prüft nicht, ob die Angaben stimmen, sondern ob sie vollständig und widerspruchsfrei sind. Sie verspricht keine „GoBD-Konformität“.

## 3. Fachliche Grundlagen

### 3.1 Quellen und Stand

| Quelle | Stand | Was die App daraus nutzt |
| --- | --- | --- |
| GoBD, BMF-Schreiben vom 28.11.2019 (BStBl I S. 1269), geändert am 11.03.2024 (BStBl I S. 374) und am 14.07.2025 (GZ IV D 2 - S 0316/00128/005/088) | Fassung vom 14.07.2025, anzuwenden ab 14.07.2025 (Rz. 185); Volltext im Amtlichen AO-Handbuch 2026, Anhang 33 | Rz. 100–102 IKS, 103–106 Datensicherheit, 107–111 Unveränderbarkeit, 119–121, 131, 135 elektronische Aufbewahrung, 136 Scannen, 151–155 Verfahrensdokumentation |
| § 147 AO | abgerufen 10.11.2026 | Unterlagenarten (Abs. 1), Fristen und Ablaufhemmung (Abs. 3), Fristbeginn (Abs. 4) |
| Muster-Verfahrensdokumentation zum ersetzenden Scannen, BStBK und DStV | Version 2.1, Stand 27.02.2026 | Gliederung, Freigabe- und Versionsangaben (Kap. 1), 13 Ordnungsmäßigkeitskriterien (2.3), Hard- und Software mit „seit“ und Version (3.1), Zuständigkeiten (3.2), IKS (3.3), Änderungshistorie (7) |
| DSGVO, Verordnung (EU) 2016/679 (EUR-Lex, CELEX 32016R0679) | abgerufen 11.11.2026 | Art. 5 Abs. 1 lit. e, Art. 6 Abs. 1, Art. 9 Abs. 1, Art. 10, Art. 17 Abs. 3 lit. b, Art. 28 Abs. 3, Art. 30, Art. 32 Abs. 1, Art. 44–46 |
| DSK: Hinweise zum Verzeichnis von Verarbeitungstätigkeiten | Februar 2018 | Ausnahme nach Art. 30 Abs. 5 greift selten (Ziff. 5); Rechtsgrundlage als sinnvolle Zusatzangabe (Ziff. 1); interne Empfänger als Rollen (Ziff. 6.4); Aussage zu Drittländern immer (Ziff. 6.4); Empfänger im Drittland konkret benennen (Ziff. 6.5); präzise Löschfristen (Ziff. 6.6); TOM in sechs Bereichen (Ziff. 6.7, 6.8) |
| DSK: Muster Verzeichnis Verantwortlicher | Februar 2018 | Aufbau: Vorblatt, je Tätigkeit Zwecke, Betroffene, Datenkategorien, Empfänger, Drittland, Löschfristen, TOM, Unterschrift |
| § 38 BDSG | abgerufen 11.11.2026 | Datenschutzbeauftragter ab in der Regel 20 Personen, die ständig mit automatisierter Verarbeitung beschäftigt sind |
| BPMN 2.0, Schema in `bpmn-moddle` 10.3.1 (lokal geprüft) | – | nur für später (2.2): `dataObjectReference`, `dataStoreReference`, `dataInputAssociation`, `dataOutputAssociation`, `dataState` |

Die App hält den Rechtsstand als Konstante `RECHTSSTAND = '2026-11-11'` und druckt ihn in jedes Dokument.

### 3.2 Aufbewahrungsfristen

| Unterlagen | § 147 Abs. 1 AO | Frist | Wert in der App |
| --- | --- | --- | --- |
| Bücher, Aufzeichnungen, Inventare, Jahresabschlüsse, Lageberichte, Eröffnungsbilanz, Arbeitsanweisungen und Organisationsunterlagen (auch diese Verfahrensdokumentation) | Nr. 1 | 10 Jahre | `buecher` |
| Buchungsbelege, Rechnungen (auch § 14b UStG) | Nr. 4 | 8 Jahre | `buchungsbeleg` |
| empfangene Handels- oder Geschäftsbriefe, Wiedergaben abgesandter | Nr. 2, 3 | 6 Jahre | `geschaeftsbrief` |
| sonstige steuerlich bedeutsame Unterlagen | Nr. 5 | 6 Jahre | `sonstige` |
| Lieferscheine, die keine Buchungsbelege sind | Abs. 3 | bis Erhalt (empfangen) bzw. Versand (abgesandt) der Rechnung | `lieferschein` |

- **Fristbeginn:** Schluss des Kalenderjahres, in dem die Unterlage entstanden, empfangen oder abgesandt wurde (§ 147 Abs. 4 AO). Bei Büchern zählt die letzte Eintragung, bei Inventar und Abschlüssen die Aufstellung. Beispiel: Jahresabschluss 2025, aufgestellt 2026, Frist beginnt am 31.12.2026.
- **Ablaufhemmung:** Die Frist läuft nicht ab, solange die Unterlagen für Steuern mit offener Festsetzungsfrist von Bedeutung sind (§ 147 Abs. 3 AO). Die App rechnet sie nicht aus, sondern weist im Dokument darauf hin.
- **Verfahrensdokumentation selbst:** Organisationsunterlage, also 10 Jahre. Sie läuft nicht ab, solange Unterlagen aufbewahrt werden, zu deren Verständnis sie nötig ist (GoBD Rz. 154).
- **Elektronisch entstanden oder eingegangen:** in dieser Form aufbewahren, nicht nur ausgedruckt (GoBD Rz. 119); Eingänge im Eingangsformat (Rz. 131). Eine Umwandlung ist nur unter den Voraussetzungen der Rz. 135 zulässig. Bei E-Rechnungen genügt der strukturierte Teil (Rz. 119, 131 i. d. F. vom 14.07.2025).
- **Ausnahme Papierversand:** Elektronisch erstellte, auf Papier versandte Handels- und Geschäftsbriefe dürfen nur auf Papier aufbewahrt werden. Das gilt nicht, wenn die Datei tatsächlich aufbewahrt wird oder ein Fakturierungssystem sie erzeugt hat (Rz. 119, 120).
- **E-Mails:** mit Beleg- oder Geschäftsbrieffunktion aufbewahrungspflichtig; als reines Transportmittel nicht (GoBD Rz. 121).
- **Unveränderbarkeit:** Ablage in einem Dateisystem genügt regelmäßig nicht ohne zusätzliche Maßnahmen (GoBD Rz. 110).
- **Datenschutz:** Für personenbezogene Daten in aufbewahrungspflichtigen Unterlagen gilt das Ende der Aufbewahrung als Löschfrist. Bis dahin tritt das Recht auf Löschung zurück (Art. 17 Abs. 3 lit. b DSGVO). Die Daten dienen dann nur noch der Aufbewahrung; der Zugriff wird entsprechend eingeschränkt. Für alle anderen personenbezogenen Daten braucht es eine eigene, konkrete Löschfrist (Art. 5 Abs. 1 lit. e DSGVO).

### 3.3 Anforderungen an die Verfahrensdokumentation (GoBD Rz. 151–155)

- Übersichtlich gegliedert; Inhalt, Aufbau, Ablauf und Ergebnisse vollständig und schlüssig; für sachverständige Dritte in angemessener Zeit nachprüfbar (Rz. 151).
- Rz. 151 verlangt die Dokumentation **für jedes DV-System**. Die App dokumentiert je Prozess und führt dessen Systeme in Kapitel 3.1. Die Abdeckung aller Systeme eines Betriebs leistet erst die Firmenmappe (2.2); der Hinweis A.0 sagt das.
- Beschreibt den gewollten Prozess von der Entstehung über Verarbeitung und Speicherung bis zur Reproduktion (Rz. 152).
- Besteht in der Regel aus allgemeiner Beschreibung, Anwenderdokumentation, technischer Systemdokumentation und Betriebsdokumentation (Rz. 153). Zuordnung in der App: allgemeine Beschreibung = Kapitel 2, Anwenderdokumentation = Kapitel 4, technische Systemdokumentation = Kapitel 3.1, Betriebsdokumentation = Kapitel 3.2–3.4.
- Muss der Praxis voll entsprechen, auch bei Programmversionen (Programmidentität). Änderungen werden versioniert, mit nachvollziehbarer Änderungshistorie (Rz. 154).
- Die Beschreibung des IKS (Rz. 102) und der Datensicherung (Rz. 106) gehört dazu.
- Ein Mangel ist kein formeller Mangel mit sachlichem Gewicht, solange die Nachvollziehbarkeit nicht leidet (Rz. 155).

### 3.4 Gliederung des Musters und Umsetzung

| Kapitel im Muster 2.1 | In der App |
| --- | --- |
| 0 Hinweise zur Muster-Verfahrensdokumentation | entfällt; ersetzt durch den Hinweis „Vorlage zur Prüfung“ auf dem Deckblatt |
| 1 Vorbemerkungen zur Verfahrensdokumentation | übernommen: Genehmigung, Freigabe, Version, gültig ab, ersetzte Version |
| 2 Zielsetzung und Überblick (2.1–2.6) | übernommen, gefüllt aus Prozess und Angaben |
| 3 Organisation und Sicherheit des IT-gestützten Verfahrens (3.1–3.4) | übernommen, gefüllt aus Systemen, Rollen, Kontrollen |
| 4 Verfahren und Maßnahmen zum zentralen Scannen | **4 Verfahren und Maßnahmen: {Prozessname}**, erzeugt aus dem Ablauf |
| 5 Verfahren und Maßnahmen zum mobilen Scannen | **5 Ersetzendes Scannen**: Verweis auf eigene Dokumentation oder „Entfällt“ |
| 6 Mitgeltende Unterlagen | übernommen |
| 7 Änderungshistorie | übernommen, aus den Versionen |
| 8 Glossar | übernommen, eigene Begriffe |
| 9 Anlage | 9.1 Ablaufdiagramm, 9.2 Nachweis der Einweisung |

Übernommen werden nur Gliederung und Kapitelnamen; Kapitel 2.5 heißt angepasst „Einweisung in das Verfahren“. Alle Texte sind eigene Formulierungen (offene Frage 4). Textbausteine bilden keine Sätze des Musters nach, auch nicht in leicht geänderter Form. Schritt 3.5 prüft das per Abgleich mit dem Mustertext.

### 3.5 Verzeichnis von Verarbeitungstätigkeiten

| Art. 30 Abs. 1 | Inhalt | Abschnitt im Dokument | Datenquelle |
| --- | --- | --- | --- |
| lit. a | Name und Kontaktdaten des Verantwortlichen, ggf. gemeinsam Verantwortlicher, Vertreter, Datenschutzbeauftragter | A | `Unternehmen` |
| lit. b | Zwecke | B | `Verarbeitungstaetigkeit.zwecke` |
| lit. c | Kategorien betroffener Personen und personenbezogener Daten | B | Vereinigung über alle personenbezogenen Datenobjekte |
| lit. d | Kategorien von Empfängern, auch in Drittländern | B | interne Rollen mit Zugriff; extern: externe Rollen mit Zugriff, Dienstleister, externe Empfänger |
| lit. e | Übermittlungen in Drittländer mit Garantien | B | Standort und Garantie von Systemen und Empfängern |
| lit. f | vorgesehene Löschfristen, wenn möglich | B | Aufbewahrungsfrist bzw. Löschfrist je Datenobjekt |
| lit. g | allgemeine Beschreibung der TOM nach Art. 32 Abs. 1, wenn möglich | C | `toms` |
| – | Rechtsgrundlage (freiwillig, laut DSK sinnvoll) | B | `rechtsgrundlagen` |

Hinweise der DSK, die die App umsetzt: Die Ausnahme nach Art. 30 Abs. 5 greift selten, weil fast jede Verarbeitung nicht nur gelegentlich erfolgt. Ein allgemeiner Verweis auf Aufbewahrungspflichten genügt nicht; Löschfristen sind präzise anzugeben. Zu Drittländern gehört immer eine Aussage, auch „findet nicht statt“. Liegt der Server im Drittland oder läuft der Mailversand darüber, ist das eine Übermittlung; Support aus dem Drittland kann eine sein (Ziff. 6.4). Empfänger im Drittland sind keine Kategorie, sondern konkret zu benennen (Ziff. 6.5). Die TOM-Beschreibung ist trotz „wenn möglich“ der Regelfall.

### 3.6 Technische und organisatorische Maßnahmen

Art. 32 Abs. 1 DSGVO nennt Pseudonymisierung und Verschlüsselung, Vertraulichkeit, Integrität, Verfügbarkeit und Belastbarkeit, rasche Wiederherstellung sowie ein Verfahren zur regelmäßigen Überprüfung. Die DSK ordnet daraus sechs Bereiche (Ziff. 6.8). Die App übernimmt diese Bereiche als `TomBereich` und bietet je Bereich Vorschläge in eigenen Worten an (Abschnitt 4.3).

### 3.7 BPMN-Elemente für später

Im Schema von `bpmn-moddle` 10.3.1 sind `DataObjectReference` und `DataStoreReference` Flusselemente mit Verweis auf `DataObject` bzw. `DataStore`. Aufgaben verbinden sich über `DataInputAssociation` (liest) und `DataOutputAssociation` (schreibt). `ItemAwareElement.dataState` trägt einen Zustand wie „geprüft“. Das MVP schreibt nichts davon ins BPMN. Die Tabellen aus 4.1 sind so geschnitten, dass sie später 1:1 auf diese Elemente passen.

## 4. Datenmodell

Die Compliance-Angaben liegen in einem eigenen Objekt `Projekt.compliance`. Angaben zu Unterlagen, Systemen, Rollen und Kontrollen stehen in Tabellen, die über eine Id zugreifen. Die Typen des Prozessmodells bleiben dadurch unverändert. Rückgängig und Wiederherstellen gelten, weil `compliance` Teil des Projekts ist.

### 4.1 Unterlagen, Ablageorte und Zugriffe

Eine Erweiterung „Datenobjekte und Datenspeicher“ des Prozessmodells gibt es nicht, auch keine Spezifikation dafür (Stand Commit `915e957`). Das MVP führt die nötigen Tabellen deshalb selbst in `compliance`. Sie sind so geschnitten, dass eine spätere Modellerweiterung sie per Migration übernehmen kann (2.2, 3.7).

| Tabelle | Bedeutung | später im BPMN | Nutzung in der Compliance-Doku |
| --- | --- | --- | --- |
| `Unterlage` (`id`, `name`) | Datenobjekt: Unterlage oder Datensatz, z. B. „Ausgangsrechnung“ | `dataObjectReference` | Belegliste, Verzeichnis, Schlüssel der Angaben |
| `Ablageort` (`id`, `name`, `mediumId`) | Datenspeicher, z. B. „Belegarchiv“; `mediumId` ist das System (`Medium.id`), Papierordner gehören zum Medium „Papier“ | `dataStoreReference` | Ablage, Unveränderbarkeit, Sicherung, Dienstleister, AV-Vertrag |
| `Zugriff` (`aufgabeId`, `unterlageId`, `richtung`) | welcher Schritt eine Unterlage liest oder schreibt | `dataInputAssociation`, `dataOutputAssociation` | „entsteht in“, Zuständigkeiten, Empfänger, Vier-Augen-Prüfung |

- Operationen in `src/compliance/unterlagen.ts`: Unterlage und Ablageort anlegen, umbenennen, löschen; Zugriff setzen und lösen. Neue Ids über `neueId` aus `src/modell/bausteine.ts` (Präfixe `unt`, `abl`).
- Ids sind stabil; Umbenennen ändert nichts an den Angaben.
- Löschen einer Unterlage entfernt ihre Angaben und Zugriffe im selben Rückgängig-Schritt. Löschen eines Ablageorts entfernt ihn aus der Ablage aller Unterlagen.
- Ein Zugriff ist eindeutig je Aufgabe, Unterlage und Richtung.

`dataState` braucht das MVP nicht. Aus Dateiformat 3 nutzt die Compliance-Doku zusätzlich `Prozess.teilnehmer` (externe Pools wie Kunde oder Lieferant), `nachrichtAn` und `nachrichtVon` an Aufgaben sowie `von` an Warten, Zweig-Ereignis und Auslöser. Nur der Adapter kennt die Herkunft der Tabellen:

```ts
// src/compliance/quelle.ts
export interface DatenSicht {
  /** Reihenfolge wie in der Tabelle */
  objekte: { id: Id; name: string }[]
  speicher: { id: Id; name: string; mediumId: Id | null }[]
  /** nur Zugriffe auf Aufgaben, die im Ist-Prozess vorkommen */
  zugriffe: { aufgabeId: Id; zielId: Id; richtung: 'liest' | 'schreibt' }[]
}
export function datenSicht(p: Prozess, c: ComplianceProjekt): DatenSicht
```

### 4.2 Typen der Compliance-Doku

```ts
// src/compliance/typen.ts
import type { Befund } from '../modell/pruefung'
import type { Id, Prozess } from '../modell/typen'

/** Kalenderdatum JJJJ-MM-TT, ohne Uhrzeit und Zeitzone. */
export type IsoDatum = string

export const COMPLIANCE_VERSION = 1

// ---------- Unternehmen und Verarbeitungstätigkeit ----------

/** 'ek' = eingetragener Kaufmann; 'einzelunternehmen' = ohne Eintragung (Kleingewerbe, freier Beruf) */
export type Rechtsform = 'einzelunternehmen' | 'ek' | 'gbr' | 'partg' | 'ohg' | 'kg' | 'gmbh' | 'ug' | 'gmbh_co_kg' | 'eg' | 'ev' | 'sonstige'

export interface Anschrift {
  strasse: string
  plz: string
  ort: string
}

export interface Kontakt {
  name: string
  anschrift: Anschrift
  telefon: string
  email: string
}

export interface Unternehmen {
  name: string
  rechtsform: Rechtsform | null
  anschrift: Anschrift
  telefon: string
  email: string
  internet: string
  branche: string
  geschaeftszweck: string
  gewinnermittlung: 'bilanz' | 'euer' | null
  /** Inhaber oder Geschäftsführung; genehmigt und gibt die Verfahrensdokumentation frei. */
  geschaeftsleitung: string
  standorte: string[]
  /** Personen, die in der Regel ständig mit automatisierter Verarbeitung personenbezogener Daten beschäftigt sind (§ 38 Abs. 1 BDSG). */
  personenMitDaten: number | null
  datenschutzbeauftragter: (Kontakt & { extern: boolean }) | null
  gemeinsamVerantwortlicher: Kontakt | null
  vertreter: Kontakt | null
  steuerberatung: string
}

export interface Verarbeitungstaetigkeit {
  /** Name im Verzeichnis; leer = Prozessname */
  benennung: string
  /** z. B. „1“ */
  laufendeNummer: string
  eingefuehrtAm: IsoDatum | null
  fachabteilung: string
  ansprechpartner: string
  telefon: string
  email: string
  /** Art. 30 Abs. 1 lit. b */
  zwecke: string[]
}

// ---------- Unterlagen und Ablageorte (4.1) ----------

export interface Unterlage {
  id: Id
  /** z. B. „Ausgangsrechnung“ */
  name: string
}

export interface Ablageort {
  id: Id
  /** z. B. „Belegarchiv“, „Ordner Lieferscheine“ */
  name: string
  /** System (Medium.id); null = noch nicht zugeordnet */
  mediumId: Id | null
}

export interface Zugriff {
  aufgabeId: Id
  unterlageId: Id
  richtung: 'liest' | 'schreibt'
}

// ---------- Belege und Daten (je Unterlage) ----------

/** Einordnung nach § 147 Abs. 1 AO; bestimmt die gesetzliche Mindestfrist. */
export type Aufbewahrungsart = 'buecher' | 'buchungsbeleg' | 'geschaeftsbrief' | 'sonstige' | 'lieferschein' | 'keine' | 'unklar'
export type Belegform = 'papier' | 'bild' | 'strukturiert' | 'datensatz'
export type Richtung = 'eingang' | 'ausgang' | 'intern'
export type Ablageform = 'original' | 'scan' | 'ausdruck' | 'umgewandelt'

export type Betroffene = 'kunden' | 'interessenten' | 'lieferanten' | 'beschaeftigte' | 'bewerber' | 'patienten' | 'sonstige'
export type Datenkategorie = 'identifikation' | 'kontakt' | 'vertrag' | 'zahlung' | 'bank' | 'korrespondenz' | 'personal' | 'nutzung' | 'sonstige'
/** Art. 9 Abs. 1 DSGVO */
export type BesondereKategorie = 'herkunft' | 'politik' | 'religion' | 'gewerkschaft' | 'genetik' | 'biometrie' | 'gesundheit' | 'sexualleben'
/** Art. 6 Abs. 1 lit. a bis f DSGVO, in dieser Reihenfolge */
export type Rechtsgrundlage = 'einwilligung' | 'vertrag' | 'rechtspflicht' | 'lebenswichtig' | 'oeffentlich' | 'interesse'

export type Standort = 'deutschland' | 'eu_ewr' | 'drittland' | 'unbekannt'
export type Garantie = 'angemessenheitsbeschluss' | 'standardvertragsklauseln' | 'andere' | 'keine'

export interface Empfaenger {
  id: Id
  /** z. B. „Steuerberatung“, „Paketdienst“ */
  kategorie: string
  /** konkreter Empfänger, z. B. „Kanzlei Beispiel“; Pflicht bei Standort „drittland“ (DSK-Hinweise Ziff. 6.5) */
  name: string
  standort: Standort
  /** nur bei Standort „drittland“ */
  drittland: string
  garantie: Garantie | null
}

export type Zeiteinheit = 'tage' | 'monate' | 'jahre'
export type FristBeginn = 'entstehung' | 'jahresende' | 'ereignis'

export interface Frist {
  /** ganze Zahl von 0 bis 100 */
  anzahl: number
  einheit: Zeiteinheit
  beginn: FristBeginn
  /** nur bei beginn = 'ereignis', z. B. „Ende der Kundenbeziehung“ */
  ereignis: string
}

export interface DatenobjektAngaben {
  aufbewahrungsart: Aufbewahrungsart
  form: Belegform | null
  richtung: Richtung | null
  /** Ablageorte (Ablageort.id), in denen aufbewahrt wird */
  ablageSpeicherIds: Id[]
  ablageform: Ablageform | null
  /** nur bei Papier mit Scan: wird das Original danach vernichtet? */
  originalVernichtet: boolean | null
  /** gewählte Aufbewahrung in ganzen Jahren ab Schluss des Kalenderjahres; null = gesetzliche Mindestfrist */
  aufbewahrungJahre: number | null
  personenbezogen: boolean | null
  betroffene: Betroffene[]
  datenkategorien: Datenkategorie[]
  besondereKategorien: BesondereKategorie[]
  /** Daten über strafrechtliche Verurteilungen und Straftaten (Art. 10 DSGVO) */
  strafrechtlich: boolean
  rechtsgrundlagen: Rechtsgrundlage[]
  /** bei lit. f: welches Interesse */
  berechtigtesInteresse: string
  /** nur für personenbezogene Daten ohne steuerliche Aufbewahrungspflicht */
  loeschfrist: Frist | null
  externeEmpfaenger: Empfaenger[]
}

// ---------- Systeme und Rollen ----------

export type Betrieb = 'lokal' | 'eigener_server' | 'cloud'
export type Unveraenderbarkeit = 'revisionssicher' | 'protokolliert' | 'keine' | 'unklar'
export type Sicherung = 'keine' | 'manuell' | 'automatisch' | 'anbieter' | 'unklar'

/** nur für digitale Medien (istDigital(medium.art)) */
export interface SystemAngaben {
  hersteller: string
  version: string
  seit: IsoDatum | null
  betrieb: Betrieb | null
  dienstleister: string
  standort: Standort
  drittland: string
  garantie: Garantie | null
  /** Verarbeitet der Dienstleister personenbezogene Daten im Auftrag? null = unklar */
  auftragsverarbeitung: boolean | null
  avVertrag: 'ja' | 'nein' | 'unklar'
  avVertragVom: IsoDatum | null
  unveraenderbarkeit: Unveraenderbarkeit
  sicherung: Sicherung
  /** z. B. „täglich“ */
  sicherungIntervall: string
  wiederherstellungGetestet: IsoDatum | null
  /** Kurzbeschreibung, z. B. „eigenes Konto je Person, Zwei-Faktor-Anmeldung“ */
  zugriffsschutz: string
}

export interface RollenAngaben {
  extern: boolean
  /** bei externen Rollen, z. B. „Kanzlei Beispiel“ */
  organisation: string
}

// ---------- Kontrollen ----------

export type KontrollArt = 'vier_augen' | 'plausibilitaet' | 'abstimmung' | 'stichprobe' | 'berechtigung' | 'sonstige'
export type Nachweis = 'system' | 'abzeichnen' | 'keiner' | 'unklar'

/** Angaben zu einer Aufgabe der Art „Prüfung“ oder „Freigabe“ */
export interface KontrollAngaben {
  art: KontrollArt
  /** z. B. „Rechnung sachlich und rechnerisch richtig“ */
  ziel: string
  nachweis: Nachweis
}

/** Kontrolle außerhalb des Ablaufs, z. B. monatliche Stichprobe durch die Steuerberatung */
export interface WeitereKontrolle {
  id: Id
  name: string
  art: KontrollArt
  verantwortlich: string
  extern: boolean
  /** z. B. „monatlich, 10 Belege“ */
  haeufigkeit: string
  nachweis: Nachweis
  /** Aufgabe, die diese Kontrolle absichert */
  bezugAufgabeId: Id | null
}

export interface Einweisung {
  turnus: 'einmalig' | 'jaehrlich' | 'keine' | null
  protokoll: boolean
}

export interface Loeschorganisation {
  /** wer Vernichtung und Löschung nach Fristablauf freigibt */
  freigabe: string
  /** wer sie durchführt */
  durchfuehrung: string
  turnus: 'jaehrlich' | 'halbjaehrlich' | 'keiner' | null
}

// ---------- Schutzmaßnahmen ----------

/** Bereiche nach DSK-Hinweisen Ziff. 6.8, in dieser Reihenfolge */
export type TomBereich = 'pseudonymisierung' | 'verschluesselung' | 'vertraulichkeit' | 'verfuegbarkeit' | 'wiederherstellung' | 'ueberpruefung'

export interface TomAngaben {
  massnahmen: string[]
  /** Begründung, falls der Bereich nicht zutrifft; leer = trifft zu */
  nichtZutreffend: string
}

// ---------- Dokumente und Versionen ----------

export type Abschnitt =
  | { art: 'ueberschrift'; ebene: 1 | 2 | 3; nummer: string; text: string }
  | { art: 'absatz'; text: string }
  | { art: 'liste'; punkte: string[] }
  | { art: 'tabelle'; kopf: string[]; zeilen: string[][] }
  | { art: 'hinweis'; text: string }
  /** Platzhalter: Druckansicht zeigt das BPMN-Diagramm, DOCX einen Verweis */
  | { art: 'diagramm' }

export interface Dokument {
  art: 'verfahrensdokumentation' | 'verarbeitungsverzeichnis'
  titel: string
  untertitel: string
  /** „1.0“ oder „Entwurf“ */
  versionText: string
  stand: IsoDatum
  rechtsstand: IsoDatum
  abschnitte: Abschnitt[]
}

export interface DokuVersion {
  /** 1, 2, 3 … fortlaufend */
  nummer: number
  /** z. B. „1.0“; eindeutig */
  bezeichnung: string
  gueltigAb: IsoDatum
  freigegebenAm: IsoDatum
  freigegebenVon: string
  aenderung: string
  /** automatisch, z. B. ['VD 3.2', 'VD 4', 'VVT B'] */
  geaenderteKapitel: string[]
  /** Ist-Prozess bei der Freigabe, für Diagramm und Vergleich */
  prozess: Prozess
  verfahrensdoku: Dokument
  verzeichnis: Dokument
  /** SHA-256 als Hex (64 Zeichen) über kanonisches JSON von [verfahrensdoku, verzeichnis] (6.8) */
  pruefsumme: string
}

// ---------- Gesamt ----------

export interface ComplianceProjekt {
  version: typeof COMPLIANCE_VERSION
  unternehmen: Unternehmen
  verarbeitung: Verarbeitungstaetigkeit
  unterlagen: Unterlage[]
  ablageorte: Ablageort[]
  zugriffe: Zugriff[]
  /** Schlüssel: Unterlage.id */
  datenobjekte: Record<Id, DatenobjektAngaben>
  /** Schlüssel: Medium.id */
  systeme: Record<Id, SystemAngaben>
  /** Schlüssel: Rolle.id */
  rollen: Record<Id, RollenAngaben>
  /** Schlüssel: Aufgabe.id einer Prüfung oder Freigabe */
  kontrollen: Record<Id, KontrollAngaben>
  weitereKontrollen: WeitereKontrolle[]
  einweisung: Einweisung
  loeschung: Loeschorganisation
  /** gilt für alle Unterlagen, die länger als gesetzlich aufbewahrt werden */
  begruendungLaengereAufbewahrung: string
  toms: Record<TomBereich, TomAngaben>
  /** zusätzliche mitgeltende Unterlagen, z. B. „Berechtigungskonzept“ */
  mitgeltend: string[]
  versionen: DokuVersion[]
  /** „Geprüft, keine Änderung“ ohne neue Version */
  zuletztGeprueft: IsoDatum | null
}

// ---------- Befunde und Oberfläche ----------

export type Teilschritt = 'unternehmen' | 'belege' | 'systeme' | 'fristen' | 'kontrollen' | 'tom' | 'luecken' | 'dokumente'

export interface ComplianceBefund extends Befund {
  /** z. B. 'B4' */
  regel: string
  teilschritt: Exclude<Teilschritt, 'luecken'>
  /** Objekt, zu dem „Beheben“ springt; blockId (aus Befund) markiert Aufgaben im Diagramm */
  ziel?: { art: 'unternehmen' | 'datenobjekt' | 'system' | 'kontrolle' | 'tom' | 'version'; id?: string }
}
```

Erweiterung bestehender Typen:

```ts
// src/modell/typen.ts
export interface Projekt {
  // … bisherige Felder …
  /** fehlt bei Projekten ohne Compliance-Angaben */
  compliance?: ComplianceProjekt
}

// src/zustand.ts
export type Schritt = 'rahmen' | 'beteiligte' | 'ablauf' | 'pruefen' | 'verbessern' | 'dokumentieren' | 'bericht'
// Zustand: neues Feld teilschritt: Teilschritt (nicht rückgängig machbar), Standard 'unternehmen'
// neue Aktionen:
//   | { typ: 'compliance'; aenderung: (c: ComplianceProjekt) => ComplianceProjekt; gruppe?: string; zeit: number }
//   | { typ: 'teilschritt'; teilschritt: Teilschritt }
```

### 4.3 Standardwerte und Kataloge (`standard.ts`)

- Fehlt ein Eintrag in `datenobjekte`, `systeme`, `rollen` oder `kontrollen`, gilt der Standardwert. Geschrieben wird erst bei der ersten Änderung.
- `neueCompliance()`: alle Texte leer, Listen leer, `null` wo erlaubt, `einweisung = { turnus: null, protokoll: false }`, `loeschung = { freigabe: '', durchfuehrung: '', turnus: null }`, je TOM-Bereich `{ massnahmen: [], nichtZutreffend: '' }`, `verarbeitung.laufendeNummer = '1'`.
- `DatenobjektAngaben`: `aufbewahrungsart 'unklar'`, sonst `null`, leere Listen, `strafrechtlich false`.
- `SystemAngaben`: `standort 'unbekannt'`, `avVertrag 'unklar'`, `unveraenderbarkeit 'unklar'`, `sicherung 'unklar'`, sonst leer bzw. `null`.
- `RollenAngaben`: `{ extern: false, organisation: '' }`.

| Katalog | Werte und Texte in der Oberfläche |
| --- | --- |
| Rechtsform | Einzelunternehmen (ohne Handelsregister) · Eingetragener Kaufmann (e. K.) · GbR · Partnerschaftsgesellschaft · OHG · KG · GmbH · UG (haftungsbeschränkt) · GmbH & Co. KG · eG · e. V. · Sonstige |
| Aufbewahrungsart | `buecher` „Buch, Aufzeichnung oder Organisationsunterlage“ (z. B. Kassenbuch, Journal, Inventar), 10 Jahre · `buchungsbeleg` „Buchungsbeleg“ (Rechnung, Quittung, Kontoauszug, Gutschrift), 8 Jahre · `geschaeftsbrief` „Handels- oder Geschäftsbrief“ (Angebot, Auftragsbestätigung, schriftliche Bestellung), 6 Jahre · `sonstige` „Sonstige steuerlich bedeutsame Unterlage“, 6 Jahre · `lieferschein` „Lieferschein ohne Buchungsfunktion“ · `keine` „Nicht aufbewahrungspflichtig“ (interne Notiz, E-Mail nur als Transportmittel) · `unklar` „Weiß nicht“ |
| Belegform | `papier` „Auf Papier“ · `bild` „Als PDF oder Bild, z. B. per E-Mail“ · `strukturiert` „Als E-Rechnung (XRechnung, ZUGFeRD)“ · `datensatz` „Als Datensatz in einem Programm“ |
| Richtung | `eingang` „Kommt von außen“ · `ausgang` „Geht nach außen“ · `intern` „Bleibt intern“ |
| Ablageform | `original` „Im Original“ · `scan` „Als Scan des Papiers“ · `ausdruck` „Als Ausdruck“ · `umgewandelt` „Umgewandelt, z. B. PDF statt XML“ |
| Betroffene | Kunden · Interessenten · Lieferanten und Dienstleister · Beschäftigte · Bewerber · Patienten · Sonstige |
| Datenkategorie | `identifikation` „Name, Kundennummer“ · `kontakt` „Anschrift, Telefon, E-Mail“ · `vertrag` „Vertrags- und Bestelldaten“ · `zahlung` „Rechnungs- und Zahlungsdaten“ · `bank` „Bankverbindung“ · `korrespondenz` „Korrespondenz“ · `personal` „Personaldaten“ · `nutzung` „Nutzungs- und Protokolldaten“ · `sonstige` |
| Besondere Kategorie | Herkunft · politische Meinungen · religiöse oder weltanschauliche Überzeugungen · Gewerkschaft · genetische Daten · biometrische Daten zur Identifizierung · Gesundheit · Sexualleben oder sexuelle Orientierung |
| Rechtsgrundlage | `einwilligung` „Einwilligung (Art. 6 Abs. 1 lit. a)“ · `vertrag` „Für einen Vertrag oder eine Anfrage der Person nötig (lit. b)“ · `rechtspflicht` „Gesetzliche Pflicht, z. B. Aufbewahrung (lit. c)“ · `lebenswichtig` (lit. d) · `oeffentlich` (lit. e) · `interesse` „Berechtigtes Interesse (lit. f)“ |
| Standort | Deutschland · EU oder EWR · Anderes Land (Drittland) · Weiß nicht |
| Garantie | Angemessenheitsbeschluss (Art. 45) · Standardvertragsklauseln (Art. 46) · andere Garantie · keine |
| Unveränderbarkeit | „Revisionssicheres Archiv“ (Beschreibung „Archiv, das Ändern und Löschen technisch verhindert“) · „Änderungen werden protokolliert“ · „Keine, z. B. einfache Dateiablage“ · „Weiß nicht“ |
| Sicherung | Keine · Von Hand · Automatisch · Durch den Anbieter · Weiß nicht |
| Kontrollart | „Vier-Augen-Prinzip“ · „Plausibilität und Vollständigkeit“ · „Abstimmung, z. B. Bank mit Buchhaltung“ · „Stichprobe“ · „Berechtigung im System“ · „Sonstige“ (angelehnt an GoBD Rz. 100) |
| Nachweis | „Im System protokolliert“ · „Abgezeichnet mit Datum und Kürzel“ · „Kein Nachweis“ · „Weiß nicht“ |

TOM-Vorschläge je Bereich (eigene Kurzformulierungen, angelehnt an DSK Ziff. 6.8):

| Bereich | Vorschläge |
| --- | --- |
| Pseudonymisierung | Auswertungen mit Kundennummer statt Name · Testdaten ohne echte Namen |
| Verschlüsselung | Laufwerke von Laptops und PCs verschlüsselt · Webzugriffe und E-Mail-Versand über TLS · Datensicherungen verschlüsselt · Smartphones mit Gerätesperre und Verschlüsselung |
| Vertraulichkeit und Integrität | eigenes Benutzerkonto je Person, keine geteilten Passwörter · Zugriff nur, wenn für die Aufgabe nötig (Rechtekonzept) · Zwei-Faktor-Anmeldung bei Cloud-Diensten · Bildschirmsperre bei Inaktivität · Updates und Virenschutz automatisch · Papierunterlagen in abschließbarem Schrank oder Raum · Beschäftigte auf Vertraulichkeit verpflichtet · Datenträger und Papier datenschutzgerecht vernichtet |
| Verfügbarkeit und Belastbarkeit | tägliche automatische Datensicherung · Sicherung an einem zweiten Ort oder offline · unterbrechungsfreie Stromversorgung für den Server · zugesicherte Verfügbarkeit im Vertrag mit dem Anbieter |
| Wiederherstellung | Rücksicherung mindestens jährlich getestet · Notfallplan mit Ansprechpartnern und Reihenfolge des Wiederanlaufs |
| Überprüfung | jährliche Überprüfung der Maßnahmen und dieser Dokumentation · Sicherheitsvorfälle werden erfasst und ausgewertet · Dienstleister vor Beauftragung geprüft |

### 4.4 Speichern, Laden, Bereinigen

- `compliance` ist optional. Ältere Dateien laden unverändert; `compliance` bleibt dann `undefined`. Version 0.2.0 lädt Dateien mit `compliance` und behält das Feld beim Speichern, weil `leseProjekt` unbekannte Felder nicht entfernt.
- `FORMAT_VERSION` ist schon 3 (Modellierung v3). Die Compliance-Doku braucht keinen eigenen Sprung, prüft aber `compliance.version === 1`.
- `validiereCompliance(x)` in `src/compliance/speicher.ts` prüft beim Laden: Typen aller Felder, Werte aus den Katalogen, Datumsfelder als gültiges `JJJJ-MM-TT` oder `null`, Zahlen endlich und ganzzahlig (`personenMitDaten` ≥ 0, `aufbewahrungJahre` 0–30, `Frist.anzahl` 0–100). Ids in `unterlagen` und `ablageorte` sind eindeutig; `zugriffe`, `datenobjekte` und `ablageSpeicherIds` verweisen auf vorhandene Einträge. Fehler werfen `Formatfehler` mit Feldnamen, z. B. „Compliance-Angaben: ‚systeme.med_erp.seit‘ ist kein gültiges Datum.“
- Versionen: `nummer` aufsteigend ab 1, `gueltigAb` streng aufsteigend, Dokumente mit gültigen Abschnittsarten. Der eingefrorene `prozess` durchläuft dieselbe Migration und Strukturprüfung wie `ist` (private Funktion `pruefeProzess` in `src/modell/speicher.ts`, dafür exportieren). Damit gilt jede künftige Formatmigration auch für alte Versionen.
- `bereinigeCompliance(c, ist)`: entfernt Einträge in `systeme`, `rollen`, `kontrollen` und `zugriffe`, deren Medium, Rolle oder Aufgabe im Ist-Prozess fehlt. `Ablageort.mediumId` wird dann `null`; Unterlagen und ihre Angaben bleiben. Der Reducer ruft sie nach jeder Aktion auf, die den Ist-Prozess ändert (`prozess`, `projekt`), im selben Rückgängig-Schritt. Änderungen am Soll-Prozess bereinigen nichts.
- Ein Eintrag in `kontrollen` bleibt erhalten, wenn die Aufgabe nur ihre Art wechselt; die Generatoren lesen ihn dann nicht.

## 5. Oberfläche und Ablauf

### 5.1 Einordnung

- Schrittleiste: Rahmen · Beteiligte · Ablauf · Prüfen · Verbessern · **Dokumentieren** · Bericht.
- Links das Panel mit einer Teilschritt-Leiste (`<nav aria-label="Teilschritte">`), rechts die Bühne mit dem Ist-Diagramm. Im Teilschritt „Dokumente“ nutzt der Inhalt die volle Breite wie der Bericht.
- Beim Wechsel in „Dokumentieren“ schaltet die Ansicht auf Ist; der Ist-Soll-Umschalter ist dort ausgeblendet. Ein Satz erklärt: „Aus dem Ablauf entstehen zwei Dokumente: die Verfahrensdokumentation, die das Finanzamt nach den GoBD (Regeln für die elektronische Buchführung) erwartet, und das Verzeichnis von Verarbeitungstätigkeiten nach Art. 30 DSGVO. Beide beschreiben den Ist-Prozess.“
- Jeder Teilschritt zeigt in der Leiste ein Häkchen, wenn es dort keinen Fehler und keine Warnung gibt, sonst die Zahl offener Punkte. Beispiel für Screenreader: „Belege und Daten, 2 offene Punkte“.
- Ein Klick auf eine Aufgabe im Diagramm filtert im aktiven Teilschritt auf diese Aufgabe (Belege, Kontrollen).
- Sind Schritte markiert, steht im Bühnenkopf der Knopf „{n} markiert – zeigen“. Er holt den ersten markierten Schritt (links, dann oben) mindestens in Originalgröße in die Mitte; markierte Schritte liegen oft außerhalb des Anfangsausschnitts.
- Jeder Teilschritt hat einen Lernhinweis mit Quelle (eigene Liste `COMPLIANCE_LERNINHALTE`, Darstellung wie `Lernhinweis`, ohne BPMN-Symbol).
- Alle Änderungen laufen über die Aktion `compliance` mit `gruppe` je Feld, damit Tippen ein Rückgängig-Schritt bleibt.
- Für Eingaben werden `Feld`, `Auswahl`, `ZahlEingabe` und `Schalter` wiederverwendet. Neu sind `Chips` (Mehrfachauswahl als Gruppe von Kontrollkästchen) und `DatumEingabe` (`<input type="date">`).

### 5.2 Die Teilschritte

| Teilschritt | Fragt | Zeigt |
| --- | --- | --- |
| 1 Unternehmen | Firmen- und Kontaktdaten, Geschäftsleitung, Datenschutzbeauftragter, Angaben zur Verarbeitungstätigkeit | ob nach § 38 Abs. 1 Satz 1 BDSG ein Datenschutzbeauftragter nötig ist; fester Hinweis auf die anderen Auslöser (Art. 37 Abs. 1 lit. b, c DSGVO, § 38 Abs. 1 Satz 2 BDSG), die die App nicht prüft |
| 2 Belege und Daten | je Datenobjekt: Einordnung, Form, Ablage, Personenbezug, Kategorien, Rechtsgrundlage, Empfänger; Zwecke der Verarbeitung | wo es entsteht und genutzt wird, gesetzliche Mindestfrist mit Beispieldatum |
| 3 Systeme und Dienstleister | je digitalem System: Hersteller, Version, Betrieb, Dienstleister, Standort, AV-Vertrag, Unveränderbarkeit, Sicherung | welche Unterlagen das System verarbeitet oder aufbewahrt |
| 4 Aufbewahrung und Löschung | Fristen, längere Aufbewahrung mit Begründung, Löschfristen, Löschorganisation | Tabelle aller Unterlagen mit Frist und frühestem Löschdatum |
| 5 Kontrollen | je Prüfung oder Freigabe: Art, Ziel, Nachweis; weitere Kontrollen; Einweisung | Vier-Augen-Status je Freigabe |
| 6 Schutzmaßnahmen | je TOM-Bereich: Maßnahmen oder Begründung „trifft nicht zu“ | Vorschläge je Bereich |
| 7 Lücken | – | alle Befunde nach Teilschritt gruppiert, mit „Beheben“ |
| 8 Dokumente | Freigabe-Dialog | Vorschau beider Dokumente, Export, Versionsliste |

### 5.3 Fragen je Teilschritt

**1 Unternehmen**

| Frage | Antwort | Standard | Verwendet in |
| --- | --- | --- | --- |
| Wie heißt das Unternehmen? | Text | – | VD 2.2.1, VVT A |
| Rechtsform | Auswahl (12 Werte) | – | VD 2.2.1 |
| Anschrift | Straße, PLZ, Ort | – | VD 2.2.1, VVT A |
| Telefon, E-Mail, Internet | Text | – | VVT A |
| Branche, Geschäftszweck | Text | – | VD 2.2.1 |
| Wie wird der Gewinn ermittelt? | Bilanz · Einnahmen-Überschuss-Rechnung | – | VD 2.2.1 |
| Wer leitet das Unternehmen und gibt die Dokumentation frei? | Name | – | VD 1, Freigabe |
| An welchen Standorten wird gearbeitet? | Liste | – | VD 2.2.3 |
| Wie viele Personen arbeiten ständig mit personenbezogenen Daten am Computer? | Zahl | – | Regel U3 |
| Ist ein Datenschutzbeauftragter benannt? | Nein · Ja (Name, Anschrift, Telefon, E-Mail, intern oder extern) | Nein | VVT A |
| Gemeinsam Verantwortlicher, Vertreter (aufklappbar „selten nötig“) | Kontakt | – | VVT A |
| Steuerberatung | Text | – | VD 2.6, 6 |
| Verarbeitungstätigkeit: Benennung, laufende Nummer, eingeführt am, Fachabteilung, Ansprechpartner mit Telefon und E-Mail | Text, Datum | Benennung = Prozessname, Nummer „1“ | VVT B |

Knopf „Aus anderer Projektdatei übernehmen …“: lädt eine `.prozesslotse`- oder `.json`-Datei und übernimmt `unternehmen`, `toms`, `einweisung`, `loeschung` und `begruendungLaengereAufbewahrung`. Vorher fragt ein Bestätigungsdialog.

**2 Belege und Daten**

Oben steht „Wozu werden die Daten in diesem Prozess verarbeitet?“ (Liste der Zwecke). Darunter folgt eine Karte je Datenobjekt in der Reihenfolge der ersten schreibenden Aufgabe. Der Kopf zeigt „entsteht in 4.2 Bestellung in Warenwirtschaft erfassen (Innendienst)“. Die Fragen erscheinen nacheinander:

| Frage | Antwort |
| --- | --- |
| Was ist „{Name}“? | Aufbewahrungsart mit Beispielen und Frist; Hinweis „Im Zweifel die Steuerberatung fragen“ als Beschreibung von „Weiß nicht“; ist das gewählt, nennt die Zeile darunter die Folge: „Solange das offen ist, meldet die Lückenprüfung „Aufbewahrungsfrist fehlt“.“ |
| Wie kommt es an oder entsteht es? | Belegform; dazu Richtung |
| Wo wird es aufbewahrt? | Mehrfachauswahl der Ablageorte; „+ Ablageort“ legt einen Ablageort mit System an |
| In welcher Form? | Ablageform; bei Papier mit Scan: „Wird das Papier danach vernichtet?“ |
| Enthält es Angaben zu Personen? | Ja · Nein · Weiß nicht |
| Wer ist betroffen? Welche Daten? | Chips Betroffene, Chips Datenkategorien, aufklappbar besondere Kategorien und Art. 10 |
| Warum dürfen die Daten verarbeitet werden? | Chips Rechtsgrundlage; bei lit. f Textfeld „Welches Interesse?“ |
| Wer bekommt die Daten außerhalb des Unternehmens? | Liste: Kategorie, Name, Standort, bei Drittland Land und Garantie. Bei Drittland ist der Name Pflicht. Hinweis „Wer nur seine eigenen Daten bekommt, etwa der Kunde seine Rechnung, ist kein Empfänger.“ Externe Teilnehmer des Prozesses (Format 3) stehen als Vorschlag bereit, eingeleitet mit „Externe aus dem Ablauf – nur, wenn sie Daten anderer Personen bekommen:“; nicht vorgeschlagen wird, wer zu einer angehakten Gruppe der Betroffenen gehört (Kunde ↔ Kunden, `empfaengerVorschlaege`). Die Auswahl der Garantie heißt „Absicherung der Übermittlung“ und sagt, wo sie steht. |

Leerer Zustand: „Noch keine Belege oder Daten. Lege an, welche Unterlagen im Prozess entstehen.“

- Das Formular fragt den Namen, „In welchem Schritt entsteht es?“ (Auswahl der Aufgaben) und „In welchen Schritten wird es genutzt?“.
- Angelegt wird über die Operationen aus `unterlagen.ts` (4.1).
- Ein fester Hinweis bittet, keine echten Kundendaten einzutragen.

**3 Systeme und Dienstleister**

Eine Karte je digitalem Medium, das im Prozess vorkommt. Papier und Telefon erscheinen nur als Liste ihrer Ablageorte ohne Fragen.

| Frage | Antwort | Nur wenn |
| --- | --- | --- |
| Hersteller, Version, im Einsatz seit | Text, Text, Datum | – |
| Wo läuft das System? | Auf eigenen Geräten · Auf eigenem Server · Als Cloud-Dienst | – |
| Wer betreibt es? | Name des Dienstleisters | Server oder Cloud |
| Wo werden die Daten verarbeitet? | Standort; bei Drittland Land und Garantie | Dienstleister oder Cloud |
| Verarbeitet der Anbieter personenbezogene Daten in Ihrem Auftrag? | Ja · Nein · Weiß nicht | Dienstleister oder Cloud und Personenbezug |
| Gibt es einen Vertrag zur Auftragsverarbeitung? | Ja (Datum) · Nein · Weiß nicht | Auftragsverarbeitung nicht „Nein“ |
| Wie sind aufbewahrte Unterlagen vor Änderung geschützt? | Unveränderbarkeit | System ist Ablage einer aufbewahrungspflichtigen Unterlage |
| Wie werden die Daten gesichert? | Sicherung, Intervall, „Rücksicherung zuletzt getestet am“ | – |
| Zugriffsschutz | Kurztext | – |

Die Karte zeigt: „Verarbeitet: Bestellung, Ausgangsrechnung · Bewahrt auf: Ausgangsrechnung“.

**4 Aufbewahrung und Löschung**

- Tabelle aller Datenobjekte: Unterlage · Einordnung · gesetzliche Frist · gewählte Frist (Zahl in Jahren, leer = gesetzlich) · frühestes Löschdatum für das laufende Jahr.
- Knopf „Alle aufbewahrungspflichtigen Unterlagen einheitlich 10 Jahre“ mit Erklärung: Das Muster der BStBK/DStV empfiehlt das; bei personenbezogenen Daten ist eine Begründung nötig. Das Feld „Begründung für die längere Aufbewahrung“ erscheint, sobald eine gewählte Frist über der gesetzlichen liegt.
- Für personenbezogene Daten ohne Aufbewahrungspflicht: Löschfrist mit Zahl, Einheit (Tage, Monate, Jahre) und Beginn (ab Entstehung bzw. Eingang · ab Ende des Kalenderjahres · nach einem Ereignis mit Text).
- Löschorganisation: „Wer gibt die Löschung nach Fristablauf frei?“, „Wer führt sie durch?“, „Wie oft wird gelöscht?“ (jährlich · halbjährlich · kein fester Turnus).

**5 Kontrollen**

- Je Aufgabe der Art Prüfung oder Freigabe: Kontrollart, „Was wird geprüft?“, Nachweis. Daneben der Vier-Augen-Status, z. B. „Erstellt: Buchhaltung · Freigabe: Niederlassungsleitung · andere Rolle“.
- „+ Weitere Kontrolle“ für Kontrollen außerhalb des Ablaufs: Name, Art, verantwortlich, extern ja oder nein, Häufigkeit, Nachweis, „sichert ab: Aufgabe …“ (optional).
- Einweisung: „Wie werden Beteiligte eingewiesen?“ (einmalig vor Beginn · vor Beginn und jährlich · keine) und „Wird die Einweisung schriftlich festgehalten?“.
- Ohne Prüfung oder Freigabe im Ablauf erklärt ein Hinweis, wie man im Schritt „Ablauf“ eine Aufgabe als Prüfung oder Freigabe kennzeichnet.

**6 Schutzmaßnahmen**

Überschrift „Schutzmaßnahmen“ (Ebene 3), darunter sechs Abschnitte (Ebene 4) in der Reihenfolge von `TomBereich`. Jeder hat einen Satz, was der Bereich meint (z. B. Pseudonymisierung: „Namen durch Nummern ersetzen, wo der Name nicht gebraucht wird.“), Kontrollkästchen für die Vorschläge, „+ Eigene Maßnahme“ und das Feld „Trifft nicht zu, weil …“.

**7 Lücken**

- Zählerzeile wie im Schritt „Prüfen“ (`zaehle`), dann Befunde nach Teilschritt gruppiert und nach Schwere sortiert.
- Je Befund: Symbol, Titel, Text, Quelle in kleiner Schrift, Knopf „Beheben“. Er wechselt in den Teilschritt, bringt die Frage ins Bild, die den Befund behebt, und setzt den Fokus auf ihr Feld (`feldZiel`, Element-Id `ziel-{art}-{id}-{frage}`, z. B. `ziel-datenobjekt-{id}-art` bei B1; bei einer Auswahl auf die gewählte Option). Gibt es keine einzelne Frage (K1), gilt das Ziel selbst (`ziel-{art}-{id}`). Die Karte einer Unterlage ist dann offen, zugeklappte Bereiche um das Feld klappen auf. Fragen, die höher als das Fenster sind, beginnen oben, sonst stehen sie in der Mitte. Die Frage ist danach kurz umrandet (`data-sprungziel`), weil der Browser nach einem Mausklick keinen Fokusring zeigt.
- „Weiter: …“ führt an den Anfang des nächsten Teilschritts: Die Teilschritt-Leiste steht oben im Bild, der Fokus auf der ersten Überschrift des Teilschritts. Jeder Teilschritt beginnt mit einer Überschrift der Ebene 3 („Lücken“ und „Dokumente“ eigens dafür). Ein Klick in der Leiste lässt den Fokus dort.
- Befunde mit `blockId` werden im Diagramm markiert (`markierungen`).

### 5.4 Teilschritt „Dokumente“

- Statuszeile: „Entwurf, nicht freigegeben“ oder „Gültige Version 1.0 seit 11.11.2026“; bei Regel V2 zusätzlich „geändert seit der Freigabe: Verfahrensdokumentation 3.2 und 4“ (Kapitel ausgeschrieben mit `kapitelText`, 6.8).
- Hinweisband (`role="note"`): „Vorlage zur Prüfung durch Steuerberatung bzw. Datenschutzbeauftragten. Keine Rechts- oder Steuerberatung. Rechtsstand 11.11.2026.“ Zweiter Satz: „Die Dokumente nennen Schutzmaßnahmen und Lücken. Vertraulich behandeln.“
- Umschalter (`role="tablist"`): Verfahrensdokumentation · Verarbeitungsverzeichnis.
- Knöpfe: „Drucken oder als PDF speichern“ (Hauptknopf), „Als Word-Datei (DOCX)“, „Version freigeben …“, „Geprüft, keine Änderung“ (nur mit Versionen und ohne V2; setzt `zuletztGeprueft`).
- Vorschau: `DokumentAnsicht` rendert das gewählte Dokument als HTML. Beim Ansehen einer alten Version führt „Zurück zum aktuellen Entwurf“ zurück.
- Versionsliste mit den Spalten Version, gültig ab, gültig bis, freigegeben am und von, geänderte Kapitel, aufbewahren bis, Prüfsumme (12 Zeichen). Je Zeile die Knöpfe „Ansehen“ und „DOCX“.
- Versionen lassen sich nicht ändern oder löschen.

**Freigabe-Dialog** (`<dialog>` mit `aria-labelledby`):

| Feld | Standard | Prüfung |
| --- | --- | --- |
| Bezeichnung | „{nummer}.0“ | nicht leer, eindeutig |
| Gültig ab | heute | gültiges Datum, später als `gueltigAb` der letzten Version |
| Freigegeben von | `unternehmen.geschaeftsleitung` | nicht leer |
| Inhalt der Änderung | Version 1: „Erstfassung“; sonst „Geändert: {Kapitelliste}“ | ab Version 2 nicht leer |
| Freigegeben am | heute, nicht änderbar | – |

Gibt es Befunde der Schwere Fehler, erscheint „Es gibt {n} Fehler.“ mit dem Kontrollkästchen „Trotzdem freigeben“. „Freigeben“ berechnet die Prüfsumme asynchron und schickt dann eine Aktion `compliance`.

### 5.5 Barrierefreiheit und Darstellung

- Jedes Eingabefeld ist beschriftet; Chips sind Kontrollkästchen in einem `fieldset` mit `legend`.
- Teilschritte, Tabs und Dialog sind per Tastatur bedienbar; der Dialog hält den Fokus und schließt mit Escape.
- Hell- und Dunkelmodus nutzen die bestehenden Farbvariablen; der Druck ist immer hell (bestehende Druckregeln).
- axe meldet in keinem Teilschritt schwere oder kritische Befunde, hell wie dunkel.
- Wiederholte Knöpfe nennen ihr Objekt im zugänglichen Namen; er beginnt mit dem sichtbaren Text (WCAG 2.5.3), z. B. „Beheben: Schutzmaßnahmen fehlen – Verschlüsselung“, „Angaben bearbeiten: Tourenliste“, „DOCX: Version 1.0, Verfahrensdokumentation als Word-Datei“.
- Wiederholte Kontaktfelder (Datenschutzbeauftragter, gemeinsam Verantwortlicher, Vertreter) stehen in einem `fieldset` mit Legende „Kontakt: {wer}“ (für Screenreader).
- Der Fokus fällt nie auf die Seite zurück: Nach dem Anlegen steht er im ersten Feld des neuen Eintrags (Empfänger, weitere Kontrolle, Löschfrist: „Anzahl“), bei einer neuen Unterlage auf ihrer Karte, bei einem neuen Ablageort auf seinem Kästchen. Nach dem Entfernen steht er auf dem nächsten Eintrag, sonst auf der Überschrift des Abschnitts; nach „Löschfrist entfernen“ auf „Löschfrist festlegen“, nach „Zurück zum aktuellen Entwurf“ auf dem gewählten Reiter.
- Knöpfe zum Anlegen werden nicht gesperrt. Fehlt eine Angabe, steht die Meldung am Feld (`role="alert"`, `aria-invalid`, `aria-describedby`), und der Fokus geht ins Feld, z. B. „Gib der Unterlage einen Namen, z. B. „Ausgangsrechnung“.“
- Zahlenfelder (`OptionaleZahl`) übernehmen nur ganze Zahlen im erlaubten Bereich. Alles andere bleibt sichtbar im Feld stehen, mit „Bitte eine ganze Zahl eingeben, z. B. 12.“ oder „Höchstens 30 Jahre.“, bis es korrigiert ist; gespeichert bleibt der letzte gültige Wert.

## 6. Regeln, Berechnungen und Prüfungen

### 6.1 Datum

- `IsoDatum` ist ein lokales Kalenderdatum. `heute` entsteht in der Oberfläche aus `getFullYear`, `getMonth` und `getDate`, nie aus `toISOString()` (UTC-Verschiebung um Mitternacht).
- Alle Funktionen der Fachlogik bekommen `heute` als Parameter.
- `istIsoDatum(s)`: Muster `^\d{4}-\d{2}-\d{2}$` und existierender Tag.
- `formatiereDatum('2026-11-11')` ergibt „11.11.2026“.
- Addieren mit Monatsende-Kappung: `addiereMonate(d, n)` setzt den Tag auf `min(Tag, Tage im Zielmonat)`. `addiereJahre(d, n) = addiereMonate(d, 12·n)`. `addiereTage` zählt Kalendertage.
- `tageZwischen(a, b)` = Kalendertage von a nach b.

### 6.2 Fristen

```text
PFLICHTIG = { buecher, buchungsbeleg, geschaeftsbrief, sonstige, lieferschein }

mindestJahre(art):  buecher → 10 | buchungsbeleg → 8 | geschaeftsbrief → 6 | sonstige → 6 | sonst → null
wirksameJahre(d):   d.aufbewahrungJahre ?? mindestJahre(d.aufbewahrungsart)

aufbewahrungBis(jahr, n) = "{jahr + n}-12-31"
vernichtungAb(jahr, n)   = "{jahr + n + 1}-01-01"

fristEnde(start, f):
  f.beginn = 'ereignis'   → null
  basis = f.beginn = 'jahresende' ? "{Jahr(start)}-12-31" : start
  f.einheit = 'tage'      → addiereTage(basis, f.anzahl)
  f.einheit = 'monate'    → addiereMonate(basis, f.anzahl)
  f.einheit = 'jahre'     → addiereJahre(basis, f.anzahl)
```

Texte:

| Funktion | Ergebnis |
| --- | --- |
| `aufbewahrungText(d)` bei `wirksameJahre` ≠ null | „{n} Jahre ab Ende des Kalenderjahres der Entstehung“; bei `buecher`: „… der letzten Eintragung bzw. Aufstellung“ |
| `aufbewahrungText(d)` bei Lieferschein ohne gewählte Jahre | Eingang: „bis zum Erhalt der Rechnung“ · Ausgang: „bis zum Versand der Rechnung“ · sonst: „bis zum Erhalt bzw. Versand der Rechnung“ |
| `aufbewahrungText(d)` bei `keine` bzw. `unklar` | „–“ bzw. „offen“ |
| `fristText(f)` | „{anzahl} {Tag/Tage, Monat/Monate, Jahr/Jahre} “ + „ab Entstehung bzw. Eingang“, „ab Ende des Kalenderjahres der Entstehung“ oder „nach „{ereignis}““ |
| `beispielBis(d, bezugsjahr)` | „bis {formatiereDatum(aufbewahrungBis(bezugsjahr, n))}“ oder „–“ |
| `loeschText(d)` (Verzeichnis) | PFLICHTIG außer Lieferschein: „nach Ablauf der Aufbewahrung: {aufbewahrungText} (§ 147 AO)“ · Lieferschein: „{aufbewahrungText} (§ 147 Abs. 3 AO)“ · `keine`: `fristText(loeschfrist)` oder „offen“ · `unklar`: „offen“ |

Versionen:

- `gueltigBis(v_i) = gueltigAb(v_{i+1}) − 1 Tag`; die letzte Version hat `null` („laufend“).
- `aufbewahrenBis(v) = "{Jahr(gueltigBis) + 10}-12-31"`; ohne `gueltigBis` der Text „10 Jahre nach Ende der Gültigkeit“. Die Oberfläche schreibt „mindestens bis“, weil die Frist nicht abläuft, solange Unterlagen aus der Gültigkeit noch aufbewahrt werden (GoBD Rz. 154).

### 6.3 Ableitungen (`ableitung.ts`)

| Funktion | Definition |
| --- | --- |
| `angaben(c, id)` | Eintrag aus `c.datenobjekte` oder Standardwert; gleich für Systeme, Rollen |
| `ersteller(sicht, objektId)` | Aufgaben mit Zugriff `schreibt` auf das Objekt, in Ablaufreihenfolge |
| `nutzer(sicht, objektId)` | Aufgaben mit Zugriff `liest` |
| `entstehtIn(objekt)` | erste Aufgabe aus `ersteller`, sonst `null` |
| `rollenMitZugriff(objekt)` | Rollen von Erstellern und Nutzern, eindeutig, Reihenfolge wie `p.rollen`; getrennt nach `RollenAngaben.extern` in interne und externe |
| `digital(medium)` | `istDigital(medium.art)` (Papier und Telefon nicht digital) |
| `imEinsatz(medium)` | Medium einer Aufgabe, Quelle einer Übertragung oder Medium eines Ablageorts, in dem eine Unterlage liegt |
| `datenImSystem(medium)` | Datenobjekte, die in einem Speicher dieses Mediums abgelegt sind oder von einer Aufgabe mit diesem Medium gelesen oder geschrieben werden |
| `hatPersonenbezug(medium)` | ein Objekt aus `datenImSystem` hat `personenbezogen = true` |
| `ablageVon(medium)` | Datenobjekte mit Art in PFLICHTIG, deren Ablage einen Speicher dieses Mediums enthält |
| `mitDienstleister(s)` | `s.betrieb = 'cloud'` oder `s.dienstleister.trim() ≠ ''` |
| `nummern(p)` | Nummer „4.k“ je Aufgabe in Tiefensuche über den Ablauf (wie `durchlaufe`), k ab 1. Aufgaben in Rahmen (ODER, für jede Position, Teilprozess) zählen in Baumreihenfolge mit; Aufgaben eines Ausnahmewegs (Unterbrechung) folgen direkt auf ihre Aufgabe bzw. ihren Teilprozess. |
| `vorigeAufgabe(p, a)` | in der Sequenz von `a` rückwärts die nächste Aufgabe; zusammengesetzte Bausteine werden übersprungen, nicht betreten; am Anfang der Sequenz geht es im umgebenden Block weiter, rückwärts ab diesem Block; sonst `null` |

### 6.4 Vier-Augen-Prüfung (Regel K1)

Für jede Aufgabe F mit `art = 'freigabe'` oder mit `art = 'pruefung'` und Kontrollart `vier_augen`:

1. `Objekte` = Datenobjekte, die F liest.
2. `Erzeuger` = Aufgaben ≠ F, die ein Objekt aus `Objekte` schreiben. Ist die Menge leer, gilt `[vorigeAufgabe(p, F)]`; ist auch die `null`, gibt es keinen Befund.
3. Für jeden Erzeuger E mit `E.rolleId = F.rolleId ≠ null` und Rolle R:
   - `R.personen ≤ 1` → **Warnung** „Freigabe ohne Vier-Augen-Prinzip“: „„{F}“ gibt frei, was „{R}“ in „{E}“ erstellt hat, und die Rolle hat nur eine Person. Freigabe einer anderen Person übertragen oder eine nachgelagerte Kontrolle eintragen, z. B. eine Stichprobe der Steuerberatung.“
   - `R.personen > 1` → **Hinweis** „Vier-Augen-Prinzip nur organisatorisch“: „Erstellen und Freigeben liegen bei „{R}“. Festlegen, dass nie dieselbe Person freigibt, die erstellt hat; am sichersten über Berechtigungen im System.“
   - Gibt es eine weitere Kontrolle mit `bezugAufgabeId = F.id`, wird die Warnung zum Hinweis mit dem Zusatz „ausgeglichen durch „{Kontrolle}““.
4. Höchstens ein Befund je F: der schwerste. Schlüssel `compliance:K1:{F.id}`, `blockId = F.id`.

### 6.5 Lückenprüfung

`pruefeCompliance(p, c, heute)` liefert `ComplianceBefund[]`. Erzeugt wird Regel für Regel in der Reihenfolge der Tabelle, innerhalb einer Regel in der Reihenfolge der Objekte im Modell. Danach sortiert `sortiereBefunde` stabil nach Schwere. Schlüssel: `compliance:{Regel}` oder `compliance:{Regel}:{Id}`. Geprüft werden nur Unterlagen aus `datenSicht(ist, c)`.

| Nr. | Titel | Schwere | Bedingung | Text (Kern) | Quelle | Teilschritt |
| --- | --- | --- | --- | --- | --- | --- |
| U1 | Angaben zum Verantwortlichen fehlen | Warnung | Name, Straße, PLZ oder Ort leer, oder Telefon und E-Mail beide leer | „Für das Verzeichnis fehlen: {Liste}.“ | Art. 30 Abs. 1 lit. a DSGVO | unternehmen |
| U2 | Geschäftsleitung nicht angegeben | Hinweis | `geschaeftsleitung` leer | „Wer gibt die Verfahrensdokumentation frei?“ | Muster BStBK/DStV, Kap. 1 | unternehmen |
| U3 | Datenschutzbeauftragter fehlt | Warnung | `personenMitDaten ≥ 20` und kein Datenschutzbeauftragter | „{n} Personen arbeiten ständig mit personenbezogenen Daten. Ab 20 ist ein Datenschutzbeauftragter zu benennen.“ | § 38 Abs. 1 BDSG | unternehmen |
| U4 | Zahl der Personen fehlt | Hinweis | `personenMitDaten = null` | „Wie viele Personen arbeiten ständig mit personenbezogenen Daten? Davon hängt ab, ob ein Datenschutzbeauftragter nötig ist.“ | § 38 Abs. 1 BDSG | unternehmen |
| B1 | Aufbewahrungsfrist fehlt | Warnung | Art `unklar` | „Für „{d}“ ist keine Aufbewahrungsfrist festgelegt. Ordne die Unterlage ein; im Zweifel die Steuerberatung fragen.“ | § 147 Abs. 1, 3 AO | belege |
| B2 | Frist kürzer als vorgeschrieben | Fehler | `aufbewahrungJahre ≠ null`, `mindestJahre ≠ null`, `aufbewahrungJahre < mindestJahre` | „„{d}“ soll {x} Jahre aufbewahrt werden, vorgeschrieben sind {y} Jahre.“ | § 147 Abs. 3 AO | fristen |
| B3 | Ablageort fehlt | Warnung | Art in PFLICHTIG, keine gültige Speicher-Id in der Ablage | „Wo wird „{d}“ aufbewahrt? Ohne Ablageort ist die Aufbewahrung nicht nachweisbar.“ | § 147 Abs. 1 AO; GoBD Rz. 119 | belege |
| B4 | E-Mail-Postfach als einziges Archiv | Warnung | Art in PFLICHTIG, Ablage nicht leer, jeder Ablage-Speicher gehört zu einem Medium der Art `email`, keines davon `revisionssicher` | „„{d}“ liegt nur im Postfach „{System}“. Dort kann jeder löschen oder verschieben; Unveränderbarkeit und Frist sind nicht gesichert. Archiv oder Dokumentenmanagementsystem (DMS) ergänzen.“ | GoBD Rz. 110, 119 | belege |
| B5 | Ablage ohne Schutz vor Änderung | Warnung | Art in PFLICHTIG, Form `bild`, `strukturiert` oder `datensatz`, B4 trifft nicht zu, mindestens ein digitaler Ablage-Speicher und keiner davon mit `revisionssicher` oder `protokolliert` | „„{d}“ liegt in {Systeme}, ohne dass Änderungen verhindert oder protokolliert werden. Eine einfache Dateiablage genügt dafür in der Regel nicht.“ | GoBD Rz. 108–110 | systeme |
| B6 | Elektronisch erhalten, nur auf Papier aufbewahrt | Fehler; Hinweis bei Richtung `ausgang`, Form nicht `strukturiert` und erzeugender Aufgabe ohne Medium der Art `erp` oder `fachanwendung` | Art in PFLICHTIG, Form `bild`, `strukturiert` oder `datensatz`, und Ablageform `ausdruck` oder alle Ablage-Speicher nicht digital | „„{d}“ entsteht oder kommt elektronisch an und muss elektronisch aufbewahrt werden. Ein Ausdruck reicht nicht.“ Hinweis: „Nur zulässig, wenn „{d}“ auf Papier versandt und die Datei nicht aufbewahrt wird.“ | GoBD Rz. 119, 120 | belege |
| B7 | Elektronisches Original nicht aufbewahrt | Fehler bei Form `strukturiert`, sonst Hinweis | Art in PFLICHTIG, Form `bild`, `strukturiert` oder `datensatz`, Ablageform `umgewandelt` | `strukturiert`: „Bei „{d}“ muss der strukturierte Teil aufbewahrt werden, z. B. die XML-Datei. Nur ein PDF genügt nicht.“ Sonst: „„{d}“ liegt nur umgewandelt vor. Prüfen, ob die Voraussetzungen der GoBD Rz. 135 erfüllt sind; sonst das Original zusätzlich aufbewahren.“ | GoBD Rz. 119, 131, 135 (Fassung 14.07.2025) | belege |
| B8 | Ersetzendes Scannen dokumentieren | Hinweis | Form `papier`, Ablageform `scan`, `originalVernichtet = true` | „„{d}“ wird gescannt und das Papier vernichtet. Dafür braucht es eine eigene Verfahrensbeschreibung, z. B. nach dem Muster von BStBK und DStV.“ | GoBD Rz. 136 | belege |
| B9 | Abtippen ohne Erfassungskontrolle | Hinweis | Aufgabe A mit Übertragung schreibt ein Objekt d mit Art `buchungsbeleg` oder `buecher`; keine Prüfung oder Freigabe liest d; keine weitere Kontrolle mit `bezugAufgabeId = A.id` | „In „{A}“ wird „{d}“ von Hand übertragen, und keine Kontrolle prüft das Ergebnis.“ | GoBD Rz. 100 | kontrollen |
| D1 | Personenbezug ungeklärt | Hinweis | `personenbezogen = null` | „Enthält „{d}“ Angaben zu Personen, z. B. Name, Anschrift oder Telefonnummer?“ | Art. 30 Abs. 1 lit. c DSGVO | belege |
| D2 | Betroffene oder Datenarten fehlen | Warnung | personenbezogen und (Betroffene leer oder Datenkategorien leer) | „Für „{d}“ fehlen {betroffene Personen / Datenkategorien}.“ | Art. 30 Abs. 1 lit. c DSGVO | belege |
| D3 | Rechtsgrundlage fehlt | Warnung | personenbezogen und keine Rechtsgrundlage | „Auf welcher Grundlage werden die Daten in „{d}“ verarbeitet?“ | Art. 6 Abs. 1 DSGVO | belege |
| D4 | Berechtigtes Interesse nicht benannt | Hinweis | `interesse` gewählt und Text leer | „Welches berechtigte Interesse gilt für „{d}“? Interesse und Abwägung kurz festhalten.“ | Art. 6 Abs. 1 lit. f DSGVO | belege |
| D5 | Besonders geschützte Daten | Warnung | besondere Kategorien nicht leer oder `strafrechtlich` | „„{d}“ enthält {Kategorien}. Dafür gelten strengere Regeln; den Datenschutzbeauftragten oder eine fachkundige Person einbeziehen.“ | Art. 9 Abs. 1, Art. 10 DSGVO | belege |
| D6 | Löschfrist fehlt | Warnung | personenbezogen, Art `keine`, `loeschfrist = null` | „„{d}“ enthält personenbezogene Daten ohne Aufbewahrungspflicht und ohne Löschfrist. Lege fest, wann gelöscht wird, z. B. 30 Tage nach Erledigung.“ | Art. 5 Abs. 1 lit. e, Art. 30 Abs. 1 lit. f DSGVO; DSK-Hinweise | fristen |
| D7 | Längere Aufbewahrung ohne Grund | Warnung | personenbezogen, `aufbewahrungJahre > mindestJahre` (bei Lieferschein zählt jede gewählte Frist als länger), Begründung leer | „„{d}“ wird {x} statt {y} Jahre aufbewahrt. Personenbezogene Daten nur so lange speichern wie nötig: Grund angeben.“ | Art. 5 Abs. 1 lit. e DSGVO | fristen |
| D8 | Empfänger ohne gesicherten Standort | Warnung | ein externer Empfänger mit Standort `unbekannt`, oder `drittland` und (Garantie `null` oder `keine` oder Name leer) | „Für „{Kategorie}“ ist {nicht bekannt, wo die Daten verarbeitet werden / keine Garantie für die Übermittlung nach {Land} eingetragen / der Empfänger in {Land} nicht benannt}.“ | Art. 30 Abs. 1 lit. e, Art. 44–46 DSGVO; DSK-Hinweise Ziff. 6.5 | belege |
| D9 | Zweck fehlt | Warnung | ein Objekt personenbezogen, kein nicht leerer Zweck | „Wozu werden die Daten in diesem Prozess verarbeitet?“ | Art. 30 Abs. 1 lit. b DSGVO | belege |
| S1 | Betrieb des Systems unklar | Hinweis | digital, im Einsatz, `betrieb = null` | „Wo läuft „{s}“: auf eigenen Geräten, auf eigenem Server oder als Cloud-Dienst?“ | Muster, Kap. 3.1 | systeme |
| S2 | Vertrag zur Auftragsverarbeitung fehlt | Warnung | `mitDienstleister`, `hatPersonenbezug`, `auftragsverarbeitung ≠ false`, `avVertrag ≠ 'ja'` | „{Dienstleister} verarbeitet in „{s}“ personenbezogene Daten. Dafür ist ein Vertrag zur Auftragsverarbeitung nötig.“ Bei `auftragsverarbeitung = null` zusätzlich: „Prüfe zuerst, ob im Auftrag verarbeitet wird.“ | Art. 28 Abs. 3 DSGVO | systeme |
| S3 | Speicherort unklar oder ohne Garantie | Warnung | `mitDienstleister`, `hatPersonenbezug`, Standort `unbekannt` oder (`drittland` und Garantie `null` oder `keine`) | „Wo verarbeitet „{s}“ die Daten? Liegt der Server im Drittland oder läuft der Mailversand darüber, ist das eine Übermittlung; Support von dort kann eine sein.“ | Art. 44–46 DSGVO; DSK-Hinweise Ziff. 6.4 | systeme |
| S4 | Programmversion fehlt | Hinweis | digital, im Einsatz, Version leer oder `seit = null` | „Für „{s}“ fehlen Version oder Einsatzbeginn. Die Dokumentation muss zu den eingesetzten Programmversionen passen.“ | GoBD Rz. 154; Muster 3.1 | systeme |
| S5 | Datensicherung ungeklärt | Warnung | digital, `ablageVon` nicht leer, Sicherung `keine` oder `unklar` | „„{s}“ bewahrt {Liste} auf, eine Datensicherung ist {nicht eingerichtet / nicht bekannt}.“ | GoBD Rz. 103–106; Art. 32 Abs. 1 lit. c DSGVO | systeme |
| S6 | Rücksicherung nicht getestet | Hinweis | Sicherung `manuell` oder `automatisch` und (`wiederherstellungGetestet = null` oder `tageZwischen(getestet, heute) > 365`) | „Für „{s}“ wurde {noch nie / seit {Datum} nicht} geprüft, ob sich die Sicherung zurückspielen lässt.“ | Art. 32 Abs. 1 lit. c, d DSGVO | systeme |
| K1 | Freigabe ohne Vier-Augen-Prinzip | Warnung oder Hinweis | Abschnitt 6.4 | Abschnitt 6.4 | GoBD Rz. 100; Muster 3.2 | kontrollen |
| K2 | Kontrolle ohne Nachweis | Hinweis | Nachweis `keiner` oder `unklar` (Aufgabe oder weitere Kontrolle) | „„{k}“ wird nicht nachgewiesen. Kontrollen sind einzurichten, auszuüben und zu protokollieren, z. B. mit Kürzel und Datum.“ | GoBD Rz. 100 | kontrollen |
| K3 | Kontrolle ohne Angaben | Hinweis | Aufgabe der Art Prüfung oder Freigabe ohne Eintrag in `kontrollen` | „Was prüft „{A}“, und wie wird es nachgewiesen?“ | GoBD Rz. 102 | kontrollen |
| K4 | Keine Kontrolle | Hinweis | ein Objekt der Art `buchungsbeleg` oder `buecher`, keine Prüfung oder Freigabe im Ablauf, keine weitere Kontrolle | „Im Prozess entstehen Buchungsbelege, aber keine Kontrolle ist beschrieben.“ | GoBD Rz. 100–102 | kontrollen |
| K5 | Ein-Personen-Betrieb ohne Ausgleich | Hinweis | Summe `personen` aller internen Rollen mit Aufgaben ≤ 1 und keine weitere Kontrolle mit `extern = true` | „Alle Schritte erledigt eine Person; Funktionstrennung ist nicht möglich. Ausgleich: regelmäßige Stichproben durch die Steuerberatung als weitere Kontrolle eintragen.“ | Muster 3.2 | kontrollen |
| K6 | Einweisung nicht festgelegt | Hinweis | Turnus `null` oder `keine` | „Wie werden Beteiligte in das Verfahren eingewiesen?“ | Muster 2.5 | kontrollen |
| T1 | Schutzmaßnahmen fehlen | Warnung; Bereich Pseudonymisierung: Hinweis | je Bereich: keine Maßnahme und `nichtZutreffend` leer | „Für „{Bereich}“ ist keine Maßnahme eingetragen. Maßnahme wählen oder begründen, warum der Bereich nicht zutrifft.“ | Art. 32 Abs. 1 DSGVO; DSK Ziff. 6.7, 6.8 | tom |
| V1 | Noch nicht freigegeben | Hinweis | keine Version | „Die Dokumente sind ein Entwurf. Erst eine Freigabe mit Gültig-ab-Datum macht sie zur gültigen Fassung.“ | Muster Kap. 1; GoBD Rz. 154 | dokumente |
| V2 | Geändert seit der letzten Freigabe | Warnung | `geaenderteKapitel` gegenüber der letzten Version nicht leer (6.8) | „Seit Version {x} geändert: {Kapitel}. Neue Version freigeben, damit Dokumentation und Praxis übereinstimmen.“ | GoBD Rz. 154 | dokumente |
| V3 | Überprüfung fällig | Hinweis | Versionen vorhanden, V2 trifft nicht zu, `tageZwischen(max(letzte freigegebenAm, zuletztGeprueft), heute) > 365` | „Die letzte Prüfung ist {n} Tage her. Einmal im Jahr prüfen, ob alles noch stimmt.“ | Art. 32 Abs. 1 lit. d DSGVO; 365 Tage als Annahme | dokumente |

Zusammen 38 Regeln. Fehler gibt es nur bei klaren Verstößen (B2, B6, B7). Platzhalter: `{d}` Datenobjekt, `{s}` System, `{A}` Aufgabe, `{k}` Kontrolle.

### 6.6 Verfahrensdokumentation erzeugen

`erzeugeVerfahrensdoku(projekt, kontext)` mit `kontext = { version: DokuVersion-Kopf | null, historie: DokuVersion[], bezugsjahr: number, heute: IsoDatum }` ist eine reine Funktion. Gleiche Eingabe ergibt gleiches Dokument. Leere Werte erscheinen als „–“, offene Pflichtangaben als „offen“.

| Kapitel | Inhalt | Daten aus |
| --- | --- | --- |
| Deckblatt | Titel „Verfahrensdokumentation“, Untertitel „{Prozess} · {Unternehmen}“, „Version {x} · gültig ab {Datum}“ oder „Entwurf · Stand {Datum}“, Hinweis A.0 | Prozess, Unternehmen, Version |
| Gliederung | Kapitelliste ohne Seitenzahlen | Dokument |
| 1 Vorbemerkungen zur Verfahrensdokumentation | Textbaustein A.1 | Unternehmen, Version, Historie |
| 2 Zielsetzung und Überblick | – | – |
| 2.1 Zielsetzung und Anwendungsbereich | „Die Dokumentation gilt für den Prozess „{Name}“. Er beginnt mit: {Auslöser}.“ (mit `ausloeser.von`: „… (Nachricht von {Teilnehmer})“) „Er endet regulär mit: {Ergebnis}.“ + Beschreibung + „Betroffene Unterlagen: siehe 2.4.“ | Prozess |
| 2.2 Unternehmen und organisatorisches Umfeld | – | – |
| 2.2.1 Unternehmensportrait | Tabelle: Name, Sitz, Rechtsform, Branche, Geschäftszweck, Gewinnermittlung | Unternehmen |
| 2.2.2 Aufbau- und Ablauforganisation | Tabelle Rolle · Personen · intern oder extern (Organisation) + „Den Ablauf zeigt das Diagramm in Kapitel 9.1.“ | Rollen |
| 2.2.3 Einsatzorte | Standorte als Liste; Papierablagen (Ablageorte mit Medium Papier) | Unternehmen, Ablageorte |
| 2.3 Rechtliche Grundlagen und Ordnungsmäßigkeitskriterien | Textbaustein A.2, Fristentabelle aus 3.2, Kriterientabelle A.3; bei längerer Aufbewahrung: „Länger als vorgeschrieben werden aufbewahrt: {Liste}. Grund: {Begründung}.“ | fest, Angaben |
| 2.4 Relevante Dokumente | Tabelle Unterlage · Einordnung · Form · Entsteht in · Ablage · Aufbewahrung · Beispiel {Bezugsjahr}; Zeilen nach Nummer von `entstehtIn`, Objekte ohne Ersteller am Ende nach Name | Datenobjekte |
| 2.5 Einweisung in das Verfahren | einmalig: „Wer mitarbeitet, wird vor Beginn eingewiesen.“ · jährlich: „… vor Beginn und danach jährlich eingewiesen.“ · keine bzw. null: „Eine Einweisung ist nicht festgelegt.“ · Protokoll: „Die Einweisung wird schriftlich festgehalten (Kapitel 9.2).“ | Einweisung |
| 2.6 Abgrenzung der Bearbeitungsbereiche | externe Rollen, Dienstleister und externe Teilnehmer (Format 3) als Liste, sonst „Alle Schritte finden im Unternehmen statt.“; dazu „Mit externen Stellen ist diese Dokumentation abzustimmen.“ | Rollen, Systeme, Teilnehmer |
| 3 Organisation und Sicherheit des IT-gestützten Verfahrens | – | – |
| 3.1 Eingesetzte Hard- und Software | Tabelle System · Art · Hersteller · Version · im Einsatz seit · Betrieb · Dienstleister und Standort; Satz „Bei einem Systemwechsel bleibt die Lesbarkeit der aufbewahrten Unterlagen gesichert; der Wechsel steht in Kapitel 7.“ | digitale Medien im Einsatz, Reihenfolge wie `p.medien` |
| 3.2 Zuständigkeiten | Tabelle Schritt (4.k Name) · Rolle · System; zwei Zeilen „Freigabe der Löschung nach Fristablauf“ und „Durchführung der Löschung“ | Aufgaben, Löschorganisation |
| 3.3 Organisation und Internes Kontrollsystem | Textbaustein A.4; Tabelle Kontrolle · Art · Wer · Was geprüft wird · Nachweis · Häufigkeit (Aufgaben: „bei jedem Vorgang“) | Kontrollen |
| 3.4 Datenschutz und Datensicherheit | Textbaustein A.5; Tabelle System · Schutz vor Änderung · Datensicherung · Intervall · Rücksicherung getestet („ja“ oder „nein“). Das Datum des letzten Tests steht nicht im Dokument, sonst löst jeder neue Test V2 aus; es dient nur Regel S6. | Systeme |
| 4 Verfahren und Maßnahmen: {Prozess} | Ablaufbeschreibung 6.6.1; letztes Unterkapitel „4.{n+1} Aufbewahrung, Vernichtung und Löschung“ | Prozessbaum, Angaben |
| 5 Ersetzendes Scannen | mit B8-Objekten: „Für {Liste} gilt das ersetzende Scannen. Es ist in einer eigenen Verfahrensdokumentation beschrieben (Kapitel 6), z. B. nach dem Muster von BStBK und DStV.“ · sonst: „Entfällt: Papierunterlagen werden nicht gescannt und anschließend vernichtet.“ | Datenobjekte |
| 6 Mitgeltende Unterlagen | Liste: „Verzeichnis von Verarbeitungstätigkeiten, gleiche Version“, „BPMN-Datei des Ist-Prozesses“, je System mit AV-Vertrag „Vertrag zur Auftragsverarbeitung mit {Dienstleister} vom {Datum}“, Einträge aus `mitgeltend` | Systeme, Angaben |
| 7 Änderungshistorie | Satz „Jede frühere Fassung bleibt samt Zeitraum, in dem sie galt, gespeichert, mindestens bis zum Datum in der Spalte „aufbewahren bis“.“; Tabelle Version · gültig ab · gültig bis · freigegeben am · von · geänderte Kapitel · Inhalt · Prüfsumme (12 Zeichen; die eigene Zeile „–“) | Historie |
| 8 Glossar | Tabelle aus A.6 | fest |
| 9 Anlage | 9.1 Ablaufdiagramm (Abschnitt `diagramm`); 9.2 Nachweis der Einweisung nur bei Protokoll: Tabelle Datum · Name · Rolle · Unterschrift mit 8 leeren Zeilen | Prozess |

#### 6.6.1 Ablaufbeschreibung (Kapitel 4)

Rekursiver Gang durch den Baum mit einer Liste der Bedingungen. Zuerst werden alle Nummern berechnet (`nummern(p)`), damit Verweise nach vorn möglich sind.

| Baustein | Ausgabe |
| --- | --- |
| Aufgabe | Überschrift Ebene 2 „4.k {Name}“ (leer: „Unbenannter Schritt“). Absätze: „Nur wenn: {Bedingungen}.“ (falls vorhanden) · „Zuständig: {Rolle}. System: {Medium}.“ · „Grundlage: {gelesene Objekte}.“ · „Ergebnis: {geschriebene Objekte}.“ · bei Übertragung: „Medienbruch: Daten aus {Quelle} werden von Hand übertragen.“ · bei Prüfung oder Freigabe: „Kontrolle: {Kontrollart}; geprüft wird: {Ziel}; Nachweis: {Nachweis}.“ bzw. „Kontrolle: {Prüfung/Freigabe}, Angaben offen.“ |
| Entscheidung, Art `daten` | Absatz „Entscheidung „{Frage}“:“ und Liste je Ausgang „„{Bezeichnung}“: {Folge}“. Danach die Zweige; ihre Aufgaben erben die Bedingung „„{Frage}“ = „{Bezeichnung}““. |
| Entscheidung, Art `ereignis` | Absatz „Es wird abgewartet, was zuerst eintritt („{Frage}“):“ und Liste „„{Bezeichnung}“ ({Nachricht / Nachricht von {Teilnehmer} / Frist}): {Folge}“. Bedingung der Zweige: „„{Bezeichnung}“ tritt zuerst ein“. |
| Folge eines Ausgangs | Zweig mit Aufgaben: „weiter mit {Nummer der ersten}“, ergänzt um „, danach endet der Vorgang mit „{Ende}““ oder „, danach zurück zu {Ziel}“. Zweig ohne Aufgaben: „Der Vorgang endet mit „{Ende}““, „zurück zu {Ziel}“ oder „weiter im Ablauf“. |
| Ziel eines Rücksprungs | Nummer der ersten Aufgabe im Körper des Rücksprungbereichs; ohne Aufgabe „zum Anfang von „{bereichTitel}““ |
| Gleichzeitig | Absatz „Die folgenden Zweige laufen gleichzeitig; weiter geht es, wenn alle fertig sind:“ und Liste „Zweig {i}: {erste} bis {letzte}“ bzw. „Zweig {i}: {Nummer}“ oder „ohne Aufgaben“ |
| Wiederholung, Modus `anteil` | vor dem Körper: „Die Schritte {erste} bis {letzte} laufen mindestens einmal und werden wiederholt, solange gilt: „{Frage}“.“ |
| Wiederholung, Modus `ruecksprung` | kein eigener Absatz |
| Warten | Absatz „Warten: {Name} ({auf einen Zeitpunkt / auf eine Nachricht / auf eine Nachricht von {Teilnehmer}}).“ |
| Aufgabe mit `nachrichtAn` / `nachrichtVon` (Format 3) | zusätzlicher Absatz „Nachricht an {Teilnehmer}.“ bzw. „Nachricht von {Teilnehmer}.“ |
| ODER (Format 3) | Absatz „Je nach Fall laufen einer oder mehrere dieser Wege („{Frage}“):“ und Liste „„{Bezeichnung}“: {erste} bis {letzte}“; Standardzweig mit Zusatz „(wenn keiner zutrifft)“. Bedingung der Zweige: „„{Bezeichnung}“ trifft zu“. |
| Für jede Position (Format 3) | Absatz „Die Schritte {erste} bis {letzte} laufen für jedes Element von „{Name}“, {nacheinander / gleichzeitig}.“ |
| Teilprozess (Format 3) | Absatz „Teilprozess „{Name}“: Schritte {erste} bis {letzte}.“ |
| Unterbrechung (Format 3) | im Abschnitt der Aufgabe: „Ausnahme: Tritt „{Bezeichnung}“ ein ({Nachricht / Frist}), wird der Schritt abgebrochen“ bzw. „…, läuft nebenher“, dann „: {erste} bis {letzte}“ und ggf. „; danach endet der Vorgang mit „{Ende}““. Bedingung der Aufgaben im Ausnahmeweg: „Ausnahme „{Bezeichnung}““. |
| Ausgang mit `beendetAlles` (Format 3) | Folge endet mit „, danach endet der gesamte Vorgang sofort mit „{Ende}““ |
| Gleichzeitig mit `zusammenfuehrung = 'erster'` bzw. `ausfuehrung = 'nacheinander'` (Format 3) | Einleitung „… weiter geht es, sobald der erste fertig ist:“ bzw. „Die folgenden Zweige werden in beliebiger Reihenfolge nacheinander erledigt:“ |

Zeiten, Anteile und Anzahlen erscheinen nicht; sie sind für die Dokumentation unerheblich. Kommt ein Baustein aus Format 3 erst nach dieser Erweiterung hinzu, braucht er hier einen Satzbaustein und einen Test.

Letztes Unterkapitel „4.{n+1} Aufbewahrung, Vernichtung und Löschung“: je Objekt mit Art in PFLICHTIG der Satz „„{d}“: aufbewahren {aufbewahrungText}; Ablage: {Speicher}.“ Dazu: „Vor Ablauf der Frist wird nichts vernichtet oder gelöscht. Die Löschung gibt {freigabe} frei, durchgeführt wird sie von {durchfuehrung}, {jährlich/halbjährlich/ohne festen Turnus}.“ Leere Angaben erscheinen als „offen“.

### 6.7 Verzeichnis erzeugen

`erzeugeVerzeichnis(projekt, kontext)` folgt dem DSK-Muster. Aggregierte Listen sind eindeutig und in Katalogreihenfolge.

| Abschnitt | Inhalt |
| --- | --- |
| Deckblatt | „Verzeichnis von Verarbeitungstätigkeiten“, „Verantwortlicher nach Art. 30 Abs. 1 DSGVO · {Unternehmen}“, Version oder Entwurf, Hinweis A.0 (Fassung für Datenschutz) |
| A Angaben zum Verantwortlichen | Tabelle Name, Anschrift, Telefon, E-Mail, Internet; gemeinsam Verantwortlicher und Vertreter nur wenn vorhanden; Datenschutzbeauftragter oder „nicht benannt“ |
| B Verarbeitungstätigkeit {Nr.}: {Benennung} | Tabelle Benennung · laufende Nummer · eingeführt am · letzte Änderung (`gueltigAb` der Version bzw. „Entwurf“) · Fachabteilung · Ansprechpartner · Telefon · E-Mail |
| B.1 Zwecke (lit. b) | Liste |
| B.2 Rechtsgrundlagen | Liste „Art. 6 Abs. 1 lit. {x} DSGVO: {Text}“, bei lit. f mit Interesse |
| B.3 Betroffene Personen und Daten (lit. c) | Listen Betroffene und Datenkategorien; besondere Kategorien und Art. 10 nur wenn vorhanden; Tabelle je personenbezogenem Objekt: Unterlage · Betroffene · Daten · Rechtsgrundlage · Löschung |
| B.4 Empfänger (lit. d) | intern: interne Rollen mit Zugriff; extern: externe Rollen mit Zugriff („{Organisation} ({Rolle})“), Dienstleister personenbezogener Systeme („{Name} (Auftragsverarbeiter, „{System}“)“ bzw. ohne Zusatz), dann externe Empfänger nach Kategorie |
| B.5 Übermittlung in Drittländer (lit. e) | ohne Drittland: „Eine Übermittlung in Drittländer findet nicht statt und ist nicht geplant.“; sonst Tabelle konkreter Empfänger (Name bzw. Dienstleister) · Land · Garantie |
| B.6 Löschfristen (lit. f) | Tabelle Unterlage · Frist (`loeschText`) |
| B.7 Technische und organisatorische Maßnahmen (lit. g) | „Siehe Abschnitt C.“ |
| C Technische und organisatorische Maßnahmen (Art. 32 Abs. 1) | sechs Unterabschnitte; je Bereich Liste der Maßnahmen, „Trifft nicht zu: {Begründung}“ oder „Keine Maßnahme eingetragen.“ |
| D Änderungen | Tabelle Version · gültig ab · Änderung |
| Schluss | Zeile „Ort, Datum · Unterschrift des Verantwortlichen“ |

### 6.8 Versionen, geänderte Kapitel, Prüfsumme

- **Kapitelschlüssel:** Nummer der nächsten Überschrift der Ebene 1 oder 2; Ebene 3 zählt zu ihrer Ebene 2. Ausnahme: alles in Kapitel 4 zählt zu „4“, weil sich sonst Nummern verschieben. Ausgenommen vom Vergleich sind Deckblatt, Gliederung und Kapitel 7 sowie im Verzeichnis Abschnitt D. Kapitel 1 wird verglichen, damit ein Wechsel der Geschäftsleitung V2 auslöst; seine Versionsangaben sind beim Vergleich gleich, weil der Kontext von v gilt. Präfixe: „VD “ und „VVT “. Sie sind nur Schlüssel: Oberfläche, Befund V2, Vorgabe im Freigabe-Dialog und Kapitel 7 schreiben sie mit `kapitelText` aus („Verfahrensdokumentation 3.2, 3.3 und 4; Verzeichnis B.1“, in Kapitel 7 ohne den Namen des eigenen Dokuments).
- **Vergleich:** `geaenderteKapitel(v, projekt)` erzeugt beide Dokumente neu, und zwar mit dem Kontext von v: `version = v`, Historie bis v, `bezugsjahr = Jahr(v.gueltigAb)`, `heute = v.freigegebenAm`. Dann vergleicht es je Schlüssel die JSON-Darstellung der Abschnitte mit dem eingefrorenen Stand. So zählen nur fachliche Änderungen.
- **Freigabe:** `freigeben(projekt, eingaben, heute): Promise<DokuVersion>` prüft die Eingaben (5.4). Es friert `prozess` (tiefe Kopie), beide Dokumente und `geaenderteKapitel` ein. Die Prüfsumme entsteht mit `crypto.subtle.digest('SHA-256', …)` über kanonisches JSON von `[verfahrensdoku, verzeichnis]`: Objektschlüssel sortiert, ohne Leerraum, UTF-8. So ändern Laden, Prüfen und Speichern die Prüfsumme nie. Gespeichert wird sie als Hex.
- Die Prüfsumme erkennt Beschädigungen und ordnet Ausdrucke einer Version zu. Sie schützt nicht vor gezielter Änderung; so steht es auch in der App.
- Nach einem App-Update mit geänderten Textbausteinen kann V2 erscheinen. Der Befund nennt die Kapitel; eine neue Freigabe löst ihn.

### 6.9 Feste Textbausteine (eigene Formulierungen)

- **A.0 Hinweis:** „Vorlage, erstellt mit dem Prozesslotsen am {Stand}. Rechtsstand {Rechtsstand}. Vor Verwendung von der Steuerberatung prüfen lassen. Beschreibt nur den Prozess „{Prozess}“ und die Systeme darin, nicht alle Systeme des Betriebs. Gliederung angelehnt an die Muster-Verfahrensdokumentation zum ersetzenden Scannen von BStBK und DStV (Version 2.1, Stand 27.02.2026); Texte eigene Formulierungen.“ Im Verzeichnis: „… vom Datenschutzbeauftragten oder einer fachkundigen Person prüfen lassen. Aufbau angelehnt an das Muster der Datenschutzkonferenz (Februar 2018).“
- **A.1 Kapitel 1:** „Gegenstand dieser Dokumentation ist der Prozess „{Prozess}“ bei {Unternehmen}. Inhalt und jede Änderung bedürfen der Zustimmung von {Name} (Geschäftsleitung).“ Freigegeben: „Version {x}, freigegeben von {von} am {am}. Sie gilt für das Verfahren, wie es seit dem {gültig ab} angewandt wird.“ Entwurf: „Entwurf, noch nicht freigegeben.“ Mit Vorgänger: „Vorgängerversion: {y}. Was sich geändert hat, zeigt Kapitel 7.“ Immer: „Aufbau nach GoBD Rz. 153: allgemeine Beschreibung in Kapitel 2, Anwenderdokumentation in Kapitel 4, technische Systemdokumentation in Kapitel 3.1, Betriebsdokumentation in Kapitel 3.2 bis 3.4.“
- **A.2 Kapitel 2.3:** „Maßgeblich sind die Abgabenordnung (§§ 145 bis 147 AO), § 14b UStG und die GoBD (BMF-Schreiben vom 28.11.2019 in der Fassung vom 14.07.2025). Für Kaufleute gelten zusätzlich §§ 238, 239 und 257 HGB.“ Fristenregel: „Die Frist beginnt mit dem Ende des Kalenderjahres, in dem die Unterlage entstanden, eingegangen oder abgesandt wurde; bei Büchern zählt die letzte Eintragung. Sie läuft nicht ab, solange die Unterlagen für Steuern mit noch offener Festsetzungsfrist von Bedeutung sind (§ 147 Abs. 3 und 4 AO).“
- **A.3 Ordnungsmäßigkeitskriterien:** Tabelle mit den Spalten Nr., Anforderung, Bedeutung. Die 13 Anforderungen und ihre Reihenfolge folgen dem Muster (Ziff. 2.3 [10]), die Erklärungen sind eigene Kurzfassungen:

  | Nr. | Anforderung | Bedeutung |
  | --- | --- | --- |
  | 1 | Nachvollziehbarkeit und Nachprüfbarkeit | Jeder Vorgang lässt sich von der Entstehung bis zur Buchung und zurück verfolgen. |
  | 2 | Einzelaufzeichnung | Jeder Vorgang wird einzeln aufgezeichnet. |
  | 3 | Vollständigkeit | Jeder Vorgang ist erfasst, keiner fehlt. |
  | 4 | Richtigkeit | Belege stimmen mit dem tatsächlichen Geschehen überein. |
  | 5 | Lesbarkeit | Unterlagen lassen sich jederzeit lesbar machen; die Wiedergabe entspricht dem Original. |
  | 6 | Maschinelle Auswertbarkeit | Daten lassen sich elektronisch durchsuchen und auswerten. |
  | 7 | Zeitgerechte Belegsicherung | Belege sind kurz nach Entstehen oder Eingang erfasst und vor Verlust geschützt. |
  | 8 | Ordnung | Jede Unterlage hat einen festen Platz und ist schnell wiederzufinden. |
  | 9 | Unveränderbarkeit | Erfasstes wird nicht ohne Kenntlichmachung geändert oder gelöscht. |
  | 10 | Verfügbarkeit | Unterlagen sind bis zum Fristende vorhanden und abrufbar. |
  | 11 | Integrität | Inhalte bleiben vollständig und unverfälscht. |
  | 12 | Authentizität | Herkunft und Urheber einer Unterlage stehen eindeutig fest. |
  | 13 | Vertraulichkeit | Nur Berechtigte können lesen oder ändern. |
- **A.4 Kapitel 3.3:** „Nur eingewiesene Personen arbeiten in den Schritten aus Kapitel 4, und zwar stets so, wie dort beschrieben. Für jede Kontrolle ist festgelegt, wer sie ausübt und wie sie belegt wird (GoBD Rz. 100). Weicht die Praxis von dieser Beschreibung ab, erfährt es die Geschäftsleitung; Anlass und Maßnahme werden schriftlich festgehalten.“
- **A.5 Kapitel 3.4:** „Zugriff auf die Unterlagen haben nur berechtigte Personen, vom Entstehen bis zur Vernichtung. Wann vernichtet und gelöscht wird, regelt das letzte Unterkapitel von Kapitel 4. Die Schutzmaßnahmen im Einzelnen nennt das Verzeichnis von Verarbeitungstätigkeiten in Abschnitt C.“
- **A.6 Glossar:** zehn Begriffe, je ein Satz mit Fundstelle. Begriffe: Aufbewahrungsfrist, Auftragsverarbeiter, Beleg, E-Rechnung, Geschäftsbrief, GoBD, Internes Kontrollsystem, Unveränderbarkeit, Verfahrensdokumentation, Vier-Augen-Prinzip. Beispiel: „Unveränderbarkeit: Einmal erfasste Informationen dürfen nicht ohne Kenntlichmachung geändert oder gelöscht werden (§ 146 Abs. 4 AO, GoBD Rz. 107 ff.).“

### 6.10 Weitere Funktionen

- `uebernimmFirmenangaben(ziel, quelle)`: kopiert `unternehmen`, `toms`, `einweisung`, `loeschung`, `begruendungLaengereAufbewahrung`; alles andere bleibt.
- `gestricheneKontrollen(projekt, kandidat: Prozess): Id[]`: Ids aus `kontrollen`, deren Aufgabe im Ist existiert, im Kandidaten aber nicht. Betroffen ist heute die Regel `freigabe` aus `src/analyse/regeln.ts` (Vorschlag „Freigabe „…“ streichen“). Im Schritt „Verbessern“ zeigt ein Vorschlag dann: „„{Aufgabe}“ ist in der Verfahrensdokumentation als Kontrolle eingetragen. Wird sie gestrichen, braucht es einen Ersatz, z. B. eine Stichprobe.“
- Fortschritt je Teilschritt: vollständig, wenn kein Befund der Schwere Fehler oder Warnung mit diesem Teilschritt existiert.

## 7. Technik

### 7.1 Stack und Bibliotheken

Stack wie im Prozesslotsen: React 19, TypeScript 7, Vite 8, Vitest 5, Playwright 1.65 mit axe 4.14, oxlint, GitHub Actions. Neu ist ein Paket mit zwei Abhängigkeiten. Geprüft mit `npm view` am 11.11.2026, bei der Durchsicht wiederholt:

| Paket | Version | Lizenz | Zweck | Einbindung |
| --- | --- | --- | --- | --- |
| `docx` | 9.15.3 | MIT | DOCX erzeugen: `Packer.toBlob` im Browser, `Packer.toArrayBuffer` im Programm und in Tests | `dependencies`, exakt gepinnt (`"docx": "9.15.3"`), nur per dynamischem Import in `src/compliance/docx.ts` |
| `fflate` | 0.8.3 | MIT | Abhängigkeit von `docx`; in Tests DOCX entpacken (`unzipSync`) | zusätzlich `devDependencies` |
| `nanoid` | 6.0.2 | MIT | Abhängigkeit von `docx` | transitiv |

- `docx` erscheint etwa alle vier Tage neu; 9.15.3 stammt vom 06.11.2026. Deshalb exakt pinnen und nur bewusst aktualisieren, mit Lockfile und `npm audit`.
- `docx` 9.15.3 packt mit `zipSync` aus `fflate`, also ohne Web Worker und ohne `eval`. Das passt zur CSP des Windows-Programms; Phase 0 bestätigt es.
- `docx` 9.15.3 führt `@types/node ^26.6.2` als Laufzeitabhängigkeit, das Projekt nutzt `@types/node` 24. Die Typdatei von `docx` enthält `/// <reference types="node" />` und zieht Node-Typen in die App. `skipLibCheck` hilft nur bei Fehlern in `.d.ts`-Dateien; Phase 0 bestätigt einen fehlerfreien Build.
- Die SHA-256-Prüfsumme nutzt die Web Crypto API, keine Bibliothek. `crypto.subtle` gibt es nur im sicheren Kontext (HTTPS, `localhost`, Node 24 in Tests); Phase 0 prüft das im Windows-Programm.

### 7.2 Ordnerstruktur

```text
src/compliance/            Fachlogik ohne React, vollständig getestet
  typen.ts                 Typen (4.2)
  standard.ts              Standardwerte, Kataloge, Texte, TOM-Vorschläge, RECHTSSTAND
  unterlagen.ts            Unterlagen, Ablageorte, Zugriffe: Operationen (4.1)
  quelle.ts                Adapter datenSicht (heute aus compliance, später aus dem Modell)
  datum.ts                 ISO-Datum: prüfen, formatieren, addieren
  fristen.ts               Mindestfrist, Fristende, Texte
  ableitung.ts             Ersteller, Nutzer, Systeme mit Daten, vorigeAufgabe
  regeln.ts                pruefeCompliance: Lückenprüfung (38 Regeln)
  dokument.ts              Kapitelschlüssel, Vergleich
  ablauftext.ts            Kapitel 4 aus dem Baum
  verfahrensdoku.ts        Generator Verfahrensdokumentation
  verzeichnis.ts           Generator Verzeichnis
  versionen.ts             Freigabe, gültig bis, aufbewahren bis, Prüfsumme
  docx.ts                  Dokument → DOCX (lädt docx dynamisch)
  speicher.ts              validiereCompliance, bereinigeCompliance, uebernimmFirmenangaben, kanonischesJson
  beispiel.ts              Testdaten Lieferdienst (9.1), beispielMitCompliance()
  *.test.ts
src/ui/schritte/DokumentierenSchritt.tsx
src/ui/compliance/
  Teilschritte.tsx         Navigation mit Status
  UnternehmenTeil.tsx  BelegeTeil.tsx  SystemeTeil.tsx  FristenTeil.tsx
  KontrollenTeil.tsx   TomTeil.tsx     LueckenTeil.tsx  DokumenteTeil.tsx
  DokumentAnsicht.tsx      Dokument → HTML (Vorschau und Druck)
  FreigabeDialog.tsx
  Chips.tsx  DatumEingabe.tsx
  lerninhalte.ts
  nachladen.ts             Bühnenmarkierungen: lädt die Lückenprüfung erst im Schritt „Dokumentieren“
e2e/dokumentieren.spec.ts
```

Außerdem ändern sich:

- `src/modell/typen.ts`: Feld `compliance`
- `src/modell/speicher.ts`: Prüfung beim Laden, Migration eingefrorener Prozesse, getrennte Ablage der Versionen, Meldung bei vollem Speicher
- `src/zustand.ts`: Schritt, Teilschritt, Aktionen, Bereinigung
- `src/ui/kontext.ts`: `aendereCompliance`
- `src/App.tsx`: Schritt (per `lazy` nachgeladen), Menüpunkt „Daten im Browser löschen“; Menü „Beispiel Lieferdienst“ lädt `beispielMitCompliance()`
- `src/ui/schritte/VerbessernSchritt.tsx`: Hinweis aus 6.10
- `src/bpmn/export.ts`: Option „ohne Compliance-Angaben“ für `bpmnFuerExport`
- `src/plattform/typen.ts`, `browser.ts`, `desktop.ts` und `src-tauri/src/lib.rs`: Speichern von Bytes (7.5)
- `src/styles.css`: Teilschritte, Dokumentansicht, Druck

`src/modell/beispiel.ts` bleibt unverändert, damit die Fachlogik in `src/modell` nicht von `src/compliance` abhängt.

Der Schritt „Dokumentieren“ mit Lückenprüfung und Generatoren bildet eigene Teile, die erst im Schritt laden (wie `DiagrammLazy` und `docx`). Im Hauptteil bleiben nur Typen, Standardwerte, Speichern und Laden; er bleibt so unter der Warnschwelle von 500 kB.

### 7.3 Speicherung

- Das Projekt mit `compliance` liegt wie bisher im `localStorage` (Schlüssel `prozesslotse:projekt`) und in der Projektdatei.
- Versionen enthalten Prozess und beide Dokumente. Ziel: unter 150 KB je Version beim Lieferdienst; Phase 3 misst das.
- `App.tsx` schreibt das ganze Projekt bei jeder Änderung sofort in den `localStorage`, auch im Windows-Programm (WebView2). Mit Versionen würde jeder Tastendruck Hunderte KB schreiben. Deshalb liegen die Versionen unter einem eigenen Schlüssel `prozesslotse:versionen`. `speichereImBrowser` schreibt ihn nur, wenn sich das Array `versionen` geändert hat (Referenzvergleich). `ladeAusBrowser` setzt beides wieder zusammen.
- `speichereImBrowser` liefert schon `false` bei einem Fehler. Neu: Die Kopfzeile meldet dann „Das Projekt passt nicht mehr in den Browser-Speicher. Bitte als Datei speichern.“
- Menüpunkt „Daten im Browser löschen“ entfernt Projekt, Versionen und Einstellungen nach Bestätigung.
- Im Windows-Programm liest der Rust-Teil Dateien bis 20 MB (`MAX_GROESSE` in `src-tauri/src/lib.rs`). Das reicht für rund 100 Versionen; die README nennt die Grenze.

### 7.4 Export

**DOCX** (`erzeugeDocx(dokument, optionen): Promise<Uint8Array>` über `Packer.toArrayBuffer`; der Browser verpackt die Bytes in einen Blob, das Programm schreibt sie direkt):

| Dokumentmodell | Word |
| --- | --- |
| Deckblatt | Titel, Untertitel, Versionszeile, Hinweis A.0 grau hinterlegt, Seitenumbruch |
| Gliederung | Liste der Kapitel ohne Seitenzahlen, Seitenumbruch |
| `ueberschrift` 1–3 | Formatvorlagen Überschrift 1–3, damit Navigation und Inhaltsverzeichnis in Word funktionieren |
| `absatz`, `liste` | Standardabsatz, Aufzählung |
| `tabelle` | Tabelle über die volle Breite, Kopfzeile wiederholt sich auf jeder Seite |
| `hinweis` | Absatz grau hinterlegt |
| `diagramm` | Absatz „Das Ablaufdiagramm liegt als BPMN-Datei bei und ist in der Druckfassung enthalten.“ |
| Seite | A4 hoch (11 906 × 16 838 Twips), Ränder 2 cm (1 134 Twips) |
| Fußzeile | „Vorlage – vor Verwendung prüfen lassen · {Titel} · {Version} · Seite X von Y“ |

Dateinamen über `dateiname(ist.name, …)`: `-verfahrensdokumentation-entwurf.docx` bzw. `-verfahrensdokumentation-v1-0.docx`, ebenso `-verarbeitungsverzeichnis-…`. MIME-Typ `application/vnd.openxmlformats-officedocument.wordprocessingml.document`. Im Web lädt `ladeHerunter(name, blob)` die Datei herunter.

**PDF** über die Druckansicht:

- „Drucken oder als PDF speichern“ druckt das gewählte Dokument mit `window.print()`.
- Druckregeln: Kapitel der Ebene 1 beginnen auf neuer Seite; Tabellenzeilen werden nicht geteilt; Tabellenköpfe wiederholen sich; Teilschritt-Leiste, Knöpfe und Bühne sind ausgeblendet.
- Eine Fußzeile mit `position: fixed` trägt den Hinweis auf jeder Seite. Ein unterer Seitenrand in `@page` hält Platz frei, damit sie keinen Text verdeckt. Edge prüft das in Phase 6.
- Kapitel 9.1 zeigt das Diagramm über `DiagrammLazy` (`klein`, `uebersicht`), bei alten Versionen aus `version.prozess`.
- Während des Drucks setzt die App `document.title` auf den Dateinamen ohne Endung, damit „Als PDF speichern“ ihn vorschlägt.

### 7.5 Windows-Programm (Tauri 2)

Das Programm ist seit Commit `90aaba0` umgesetzt (`src-tauri`, `src/plattform`). Die Erweiterung braucht nur einen neuen Rust-Befehl für Bytes.

- Heute speichert `Plattform.speichernUnter(vorschlag, inhalt: string, art)` nur Text; `DateiArt` kennt `projekt`, `bpmn`, `svg`. Rust schreibt über `schreibe(p, &str)` mit Hilfsdatei und Umbenennen.
- Neu: `DateiArt` `docx` und `Plattform.speichereBytes(vorschlag: string, bytes: Uint8Array, art: 'docx'): Promise<{ pfad: string | null; name: string } | null>`. Im Browser ist das ein Download über `ladeHerunter`.
- Rust-Befehl `speichern_unter_bytes(request: tauri::ipc::Request)` liest Rohdaten über `InvokeBody::Raw`, ohne JSON und ohne Base64. Aufruf: `invoke('speichern_unter_bytes', bytes, { headers: { vorschlag: encodeURIComponent(name), art: 'docx' } })`. Kopfwerte sind nur ASCII, deshalb kodiert.
- Der Befehl nutzt denselben Dialog mit Filter „Word-Dokument (*.docx)“ und dasselbe atomare Schreiben (`schreibe` für `&[u8]` verallgemeinern). Den Pfad trägt er wie `speichern_unter` in `Freigaben` ein. Im Debug-Build beantwortet `PROZESSLOTSE_TEST_SPEICHERN_DOCX` den Dialog, wie bei den anderen Dateiarten.
- PDF läuft über das vorhandene `Plattform.alsPdf(vorschlag)` (Befehl `als_pdf`, WebView2 `PrintToPdf`, A4, Rand 15 mm) bei geöffneter Dokumentansicht. Es nutzt die Druck-CSS der Seite.
- CSP des Programms: `script-src 'self'`, ohne `unsafe-eval`, ohne eigenes `worker-src`. `docx` braucht beides nicht (7.1); Phase 0 bestätigt es.
- Die Dateizuordnung ändert sich nicht: Compliance-Angaben stecken in der `.prozesslotse`-Datei und im eingebetteten Projekt des BPMN-Exports. Ausnahme ist der Export ohne Compliance-Angaben (Abschnitt 8).

## 8. Sicherheit und Datenschutz

- **Lokal:** Alles läuft im Browser bzw. im Programm, ohne Server, Telemetrie, CDN oder externe Schriften.
- **Datensparsam:** Gefragt werden Kategorien, keine Kundendaten. Personenbezogen sind nur Kontaktdaten von Verantwortlichem, Datenschutzbeauftragtem und Ansprechpartner (Pflicht nach Art. 30 Abs. 1 lit. a) sowie Namen von Geschäftsleitung, Freigebenden und Verantwortlichen einer Kontrolle. Ein Hinweis im Teilschritt „Belege und Daten“ bittet, keine echten Kundendaten einzutragen.
- **Vertraulich:** Die Angaben beschreiben Schwachstellen, etwa fehlende Sicherung oder fehlende Zwei-Faktor-Anmeldung. Hinweisband und README raten, Projektdatei und Ausgaben vertraulich zu behandeln.
- **BPMN-Export:** Das eingebettete Projekt enthält heute alles, also auch Compliance-Angaben und Versionen. Wer das BPMN an Dritte gibt, gibt diese mit. Der Export bekommt deshalb die Option „ohne Compliance-Angaben“. Dann fehlt `compliance` nur in der Datei, das Projekt in der App bleibt unverändert.
- **Browser-Speicher:** `localStorage` ist unverschlüsselt. Die App weist im Menüpunkt „Daten im Browser löschen“ auf gemeinsam genutzte Rechner hin.
- **Laden:** `validiereCompliance` prüft jede Datei streng (4.4). Unbekannte Werte lösen einen `Formatfehler` aus, keinen Absturz.
- **Ausgabe:** React maskiert alle Texte, kein `dangerouslySetInnerHTML`. `docx` erzeugt XML mit Maskierung. Der BPMN-Export maskiert wie bisher mit `esc`.
- **Integrität:** Die Prüfsumme erkennt Beschädigung, nicht Manipulation; der Text in der App sagt das.
- **Rechtlicher Rahmen:** Hinweis A.0 auf Deckblatt, Fußzeile und Hinweisband; „Entwurf“ bis zur Freigabe; Rechtsstand in jedem Dokument; nirgends „GoBD-konform“, „DSGVO-konform“ oder „rechtssicher“ (Test in 9.6). Befunde sind als Hinweise formuliert („prüfen“, „klären“), nicht als Rechtsauskunft. Die README nennt Grenzen und schließt eine Gewähr für Vollständigkeit aus.
- **Abhängigkeiten:** ein neues Paket (`docx`, exakt gepinnt) mit zwei Abhängigkeiten, alle MIT, im Lockfile festgehalten. Lizenzen stehen in der README.
- **Windows-Programm:** Dateibefehle nur für vom Nutzer gewählte Pfade (wie `speichern_unter`), CSP unverändert.

## 9. Tests

### 9.1 Testdaten

`src/compliance/beispiel.ts` erweitert das bestehende Fallbeispiel „Lieferdienst“ (`beispielLieferdienst`) um `compliance`. Seit Commit `915e957` enthält das Beispiel den Teilnehmer „Kunde“ (`tln_kunde`); an den Befunden ändert das nichts. Alle Angaben sind erfunden; Firmen und Personen sind Platzhalter. Die Daten gehören zum Repo und stehen unter dessen Lizenz (noch nicht festgelegt). Texte aus Gesetzen und Mustern werden nicht kopiert. Die Kennzahlen der README bleiben unverändert, weil Datenobjekte nicht in die Berechnungen eingehen.

**Unternehmen und Organisation:**

| Feld | Wert |
| --- | --- |
| Name, Rechtsform | Lieferdienst Muster GmbH, GmbH |
| Anschrift | Musterstraße 1, 12345 Musterstadt |
| Telefon, E-Mail | 01234 5678, info@lieferdienst.example |
| Geschäftsleitung | Erika Mustermann |
| `personenMitDaten`, Datenschutzbeauftragter | 8, keiner |
| Steuerberatung | Kanzlei Beispiel |
| Einweisung | jährlich, mit Protokoll |
| Löschorganisation | Freigabe Erika Mustermann, Durchführung Buchhaltung, jährlich |
| Zweck der Verarbeitung | „Bestellungen annehmen, ausliefern und abrechnen“ |

**Ablageorte** (`compliance.ablageorte`, feste Test-Ids): `dsp_warenwirtschaft` „Warenwirtschaft“ (Medium `med_erp`), `dsp_ordner` „Ordner Lieferscheine“ (Medium `med_papier`).

**Unterlagen und Zugriffe** (`compliance.unterlagen`, `compliance.zugriffe`, `compliance.datenobjekte`):

| Id | Name | Art | Form | Richtung | Ablage | Personenbezug | Betroffene, Daten | Rechtsgrundlage | Schreibt | Liest |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dob_bestellnotiz` | Bestellnotiz | unklar | papier | intern | – | ja | Kunden; kontakt, vertrag | vertrag | auf_annehmen | auf_erfassen |
| `dob_bestellung` | Bestellung | sonstige | datensatz | eingang | Warenwirtschaft, original | ja | Kunden; kontakt, vertrag | vertrag, rechtspflicht | auf_erfassen | auf_kommissionieren, auf_tour, auf_rechnung |
| `dob_lieferschein` | Lieferschein | lieferschein | papier | ausgang | Ordner Lieferscheine, original | ja | Kunden; kontakt, vertrag | vertrag | auf_kommissionieren, auf_quittieren | auf_ausliefern, auf_abgeben, auf_bestaetigen |
| `dob_tourenliste` | Tourenliste | keine | datensatz | intern | – | ja | Kunden; kontakt | vertrag | auf_tour | auf_ausliefern |
| `dob_rechnung` | Ausgangsrechnung | buchungsbeleg | bild | ausgang | Warenwirtschaft, original | ja | Kunden; kontakt, vertrag, zahlung | vertrag, rechtspflicht | auf_rechnung | auf_freigeben, auf_versenden |

Alle ohne gewählte Jahre und ohne Löschfrist. `dob_rechnung` hat den externen Empfänger „Steuerberatung“, Name „Kanzlei Beispiel“, Deutschland.

**Systeme:**

| Medium | Hersteller | Version | seit | Betrieb | Dienstleister | Standort | AV | Unveränderbarkeit | Sicherung |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `med_erp` Warenwirtschaft | WaWi-Cloud (Beispielanbieter) | – | – | cloud | WaWi-Cloud (Beispielanbieter) | eu_ewr | Auftragsverarbeitung ja, Vertrag nein | protokolliert | anbieter |
| `med_excel` Excel-Tourenliste | Microsoft | Microsoft 365 | 2023-01-01 | lokal | – | – | – | unklar | automatisch, täglich, getestet 2026-06-30 |

**Kontrollen:** `auf_kontrollieren`: Plausibilität, „Ware vollständig und richtig“, Nachweis keiner. `auf_freigeben`: Vier-Augen-Prinzip, „Rechnung sachlich und rechnerisch richtig“, Nachweis System. Keine weiteren Kontrollen.

**TOM:** Pseudonymisierung „trifft nicht zu: keine Auswertungen, die Pseudonyme brauchen“. Verschlüsselung: TLS. Vertraulichkeit: eigenes Benutzerkonto je Person, Papierunterlagen abschließbar. Verfügbarkeit: tägliche automatische Sicherung. Wiederherstellung: Rücksicherung jährlich getestet. Überprüfung: leer.

**Versionen:** keine. Testdatum `heute = '2026-11-11'`.

### 9.2 Datum und Fristen

| Aufruf | Erwartung |
| --- | --- |
| `mindestJahre` für buecher, buchungsbeleg, geschaeftsbrief, sonstige | 10, 8, 6, 6 |
| `mindestJahre` für lieferschein, keine, unklar | `null` |
| `aufbewahrungBis(2026, 8)` / `vernichtungAb(2026, 8)` | `'2034-12-31'` / `'2035-01-01'` |
| `fristEnde('2026-03-15', 6 Monate ab Entstehung)` | `'2026-09-15'` |
| `fristEnde('2026-08-31', 6 Monate ab Entstehung)` | `'2027-02-28'` |
| `fristEnde('2028-02-29', 1 Jahr ab Entstehung)` | `'2029-02-28'` |
| `fristEnde('2026-03-15', 3 Jahre ab Jahresende)` | `'2029-12-31'` |
| `fristEnde('2026-03-15', 6 Monate ab Jahresende)` | `'2027-06-30'` |
| `fristEnde('2026-12-31', 30 Tage ab Entstehung)` | `'2027-01-30'` |
| `fristEnde(…, Beginn Ereignis)` | `null` |
| `fristText({ 8, jahre, jahresende })` / `({ 1, jahre, entstehung })` | „8 Jahre ab Ende des Kalenderjahres der Entstehung“ / „1 Jahr ab Entstehung bzw. Eingang“ |
| `aufbewahrungText` Lieferschein, Richtung Ausgang | „bis zum Versand der Rechnung“ |
| `aufbewahrungText` Art `buecher` | „10 Jahre ab Ende des Kalenderjahres der letzten Eintragung bzw. Aufstellung“ |
| `aufbewahrenBis` mit `gueltigBis = '2027-03-31'` | `'2037-12-31'` |
| `istIsoDatum('2026-02-30')` / `formatiereDatum('2026-11-11')` | `false` / „11.11.2026“ |

### 9.3 Vier-Augen-Prüfung

| Fall | Aufbau (Abwandlung von 9.1) | Erwartung |
| --- | --- | --- |
| a | unverändert: Buchhaltung erstellt, Niederlassungsleitung gibt frei | kein K1 |
| b | `auf_freigeben` mit Rolle Buchhaltung (1 Person) | K1 Warnung, `blockId` `auf_freigeben` |
| c | wie b, Buchhaltung mit 2 Personen | K1 Hinweis |
| d | wie b, plus weitere Kontrolle „Stichprobe Steuerberatung“ mit `bezugAufgabeId = 'auf_freigeben'` | K1 Hinweis mit „ausgeglichen durch“ |
| e | Zugriffe von `auf_freigeben` entfernt, Rolle Buchhaltung | K1 Warnung (Rückfall `vorigeAufgabe` = `auf_rechnung`) |
| f | Freigabe ohne Zugriffe als erster Schritt des Ablaufs | kein K1 |
| g | `auf_kontrollieren` (Prüfung, Lager wie Ersteller, Kontrollart Plausibilität) | kein K1 |

### 9.4 Regeln einzeln

- Je Regel ein positiver Fall (Schlüssel und Schwere stimmen) und ein negativer Fall (kein Befund). Die Fälle entstehen als kleine Abwandlung von 9.1 über eine Testhilfe `mitAngaben(beispiel, aenderung)`.
- Grenzfälle mit eigenem Test:

| Fall | Erwartung |
| --- | --- |
| Postfach als `revisionssicher` eingetragen | weder B4 noch B5 |
| Ablage in zwei Systemen, eines `protokolliert` | kein B5 |
| Form `papier`, Ablageform `ausdruck` | kein B6 |
| Form `bild`, Richtung `ausgang`, Ablage nur Papier, erzeugt mit Medium `tabelle` / `erp` | B6 Hinweis / B6 Fehler |
| Form `bild`, Ablageform `umgewandelt` / Form `strukturiert`, `umgewandelt` | B7 Hinweis / B7 Fehler |
| Empfänger im Drittland mit Standardvertragsklauseln, ohne Name / mit Name | D8 / kein D8 |
| Lieferschein mit gewählten 2 Jahren, personenbezogen, ohne Begründung | D7 |
| neue Aufgabe einer Rolle „Steuerberatung“ (`extern = true`, Organisation „Kanzlei Beispiel“) liest `dob_rechnung` | Verzeichnis B.4 nennt „Kanzlei Beispiel (Steuerberatung)“ extern, nicht intern |
| Art `unklar`, personenbezogen, ohne Löschfrist | B1, aber kein D6 |
| `aufbewahrungJahre` = Mindestfrist / 10 statt 8 mit Begründung | kein D7 / kein D7 |
| `auftragsverarbeitung = false` | kein S2 |
| Rücksicherung vor genau 365 / 366 Tagen getestet | kein S6 / S6 |
| letzte Prüfung vor 365 / 366 Tagen | kein V3 / V3 |
| TOM Pseudonymisierung leer / Verschlüsselung leer | T1 Hinweis / T1 Warnung |
| `personenMitDaten` 19 / 20 ohne Datenschutzbeauftragten | kein U3 / U3 |

### 9.5 Gesamttest Testdaten

`pruefeCompliance(ist, compliance, '2026-11-11')` liefert für die Testdaten aus 9.1 genau 7 Befunde in dieser Reihenfolge: 4 Warnungen, 3 Hinweise, 0 Fehler.

| Nr. | Schlüssel | Schwere |
| --- | --- | --- |
| 1 | `compliance:B1:dob_bestellnotiz` | Warnung |
| 2 | `compliance:D6:dob_tourenliste` | Warnung |
| 3 | `compliance:S2:med_erp` | Warnung |
| 4 | `compliance:T1:ueberpruefung` | Warnung |
| 5 | `compliance:S4:med_erp` | Hinweis |
| 6 | `compliance:K2:auf_kontrollieren` | Hinweis |
| 7 | `compliance:V1` | Hinweis |

### 9.6 Generatoren

| Test | Erwartung |
| --- | --- |
| Überschriften Ebene 1 der Verfahrensdokumentation (9.1) | „1 Vorbemerkungen zur Verfahrensdokumentation“, „2 Zielsetzung und Überblick“, „3 Organisation und Sicherheit des IT-gestützten Verfahrens“, „4 Verfahren und Maßnahmen: Bestellung bis Rechnung (Lieferdienst)“, „5 Ersetzendes Scannen“, „6 Mitgeltende Unterlagen“, „7 Änderungshistorie“, „8 Glossar“, „9 Anlage“ |
| Kapitel 4 Lieferdienst | Unterkapitel 4.1 bis 4.18 in Aufgabenreihenfolge, 4.19 „Aufbewahrung, Vernichtung und Löschung“ |
| 4.5 „Bestellung stornieren“ | Absatz „Nur wenn: „Ware vorrätig?“ = „Nein“, „Ersatz angenommen?“ = „Nein“.“ |
| Entscheidung „Ersatz angenommen?“ | Listenpunkt „„Nein“: weiter mit 4.5, danach endet der Vorgang mit „Bestellung storniert““ |
| Wiederholung Kommissionieren | Absatz „Die Schritte 4.6 bis 4.7 laufen mindestens einmal und werden wiederholt, solange gilt: „Fehler gefunden?“.“ |
| Kapitel 2.1 Lieferdienst | „Er beginnt mit: Kunde bestellt telefonisch (Nachricht von Kunde).“ |
| Kapitel 3.1 und 3.3 Lieferdienst | 3.1 mit 2 Zeilen (Excel-Tourenliste, Warenwirtschaft), Betrieb „Als Cloud-Dienst“ bei Warenwirtschaft; 3.3 mit 2 Zeilen (Kommissionierung kontrollieren, Rechnung freigeben) |
| Kapitel 2.4 | 5 Zeilen: Bestellnotiz, Bestellung, Lieferschein, Tourenliste, Ausgangsrechnung; Ausgangsrechnung „bis 31.12.2034“, Bestellung „bis 31.12.2032“ (Bezugsjahr 2026) |
| Kapitel 5 | „Entfällt: …“ |
| Entwurf | `versionText` „Entwurf“, Hinweis A.0 vorhanden |
| Onlinebestellung (ohne Compliance) | 4.1 bis 4.8; „„Korrektur erhalten“ (Nachricht von Kunde): zurück zu 4.1“; „Zweig 1: 4.5“ und „Zweig 2: 4.6 bis 4.7“ |
| 300 Zufallsprozesse (`testhilfen/zufallsprozess.ts`, mit allen Bausteinen aus Format 3) | kein Absturz; Anzahl Unterkapitel in Kapitel 4 = Anzahl Aufgaben + 1; jede genannte Nummer „4.k“ existiert |
| je Baustein aus Format 3 ein kleiner Prozess | Satzbaustein aus 6.6.1 erscheint wörtlich |
| Verzeichnis (9.1) | Betroffene „Kunden“; Datenkategorien kontakt, vertrag, zahlung; Rechtsgrundlagen lit. b und lit. c; interne Empfänger alle 6 Rollen in Modellreihenfolge; extern „WaWi-Cloud (Beispielanbieter) (Auftragsverarbeiter, „Warenwirtschaft“)“ und „Steuerberatung“; Drittland-Satz „findet nicht statt und ist nicht geplant“; Abschnitt C mit 6 Bereichen, Überprüfung „Keine Maßnahme eingetragen.“ |
| Determinismus | zweimal erzeugt ergibt gleiches JSON |
| Keine Versprechen | kein erzeugter Text in beiden Dokumenten (Lieferdienst, 300 Zufallsprozesse) enthält „konform“, „rechtssicher“ oder „garantiert“ |
| Hinweis A.0 und Rechtsstand | in beiden Dokumenten vorhanden, auch in eingefrorenen Versionen |

Ändern sich die Beispiele durch Format 3 (z. B. Kunde als Teilnehmer), werden die erwarteten Texte mit angepasst; Aufbau und Anzahl der Tests bleiben.

### 9.7 Versionen

| Test | Erwartung |
| --- | --- |
| `freigeben(9.1, { '1.0', gültig ab '2026-11-11', von 'Erika Mustermann' }, '2026-11-11')` | Nummer 1, `geaenderteKapitel` leer, Prüfsumme 64 Hex-Zeichen; zweiter Aufruf gleiche Prüfsumme |
| Version speichern, laden, Schlüssel der Dokumente in anderer Reihenfolge | Prüfsumme neu berechnet gleich der gespeicherten |
| zweite Freigabe mit gültig ab `'2026-11-11'` | Fehler „Gültig ab muss nach dem 11.11.2026 liegen.“ |
| nach Freigabe „Rechnung freigeben“ in „Rechnung prüfen und freigeben“ umbenennen | `geaenderteKapitel` = `['VD 3.2', 'VD 3.3', 'VD 4']`, Verzeichnis unverändert; Befund V2 |
| Version 2 gültig ab `'2027-04-01'` | Version 1: gültig bis `'2027-03-31'`, aufbewahren bis `'2037-12-31'` |
| Bezeichnung doppelt | Fehler „Die Bezeichnung 1.0 gibt es schon.“ |

### 9.8 DOCX

- Die Datei ist ein ZIP mit `word/document.xml`. Er enthält „Verfahrensdokumentation“, „4 Verfahren und Maßnahmen“ und „Vorlage“.
- Eine Fußzeile (`word/footer*.xml`) enthält „Vorlage“; die Seitengröße ist `w:w="11906"` und `w:h="16838"`.
- Die Tabelle aus Kapitel 2.4 hat 6 Zeilen (Kopf und 5).
- Ein leerer Prozess erzeugt eine gültige Datei ohne Absturz.
- Abnahme von Hand: Robin öffnet beide Dateien in Word; Überschriften erscheinen im Navigationsbereich.

### 9.9 Speichern und Zustand

| Test | Erwartung |
| --- | --- |
| Datei ohne `compliance` | lädt, `compliance` bleibt `undefined` |
| `compliance.version = 2` | Formatfehler „Compliance-Angaben in Version 2 werden nicht unterstützt.“ |
| `systeme.med_erp.seit = '2026-13-01'` | Formatfehler mit Feldnamen |
| unbekannter Katalogwert | Formatfehler |
| Unterlage löschen | Eintrag in `compliance.datenobjekte` und ihre Zugriffe entfernt; Rückgängig stellt beides wieder her |
| Aufgabe `auf_rechnung` im Ist löschen | Zugriffe auf sie entfernt, Unterlage „Ausgangsrechnung“ bleibt; Rückgängig stellt alles wieder her |
| Medium `med_papier` im Ist löschen | `dsp_ordner.mediumId` wird `null` |
| Zugriff auf eine unbekannte Unterlage in der Datei | Formatfehler mit Feldnamen |
| Datei mit Version, deren `prozess` ein älteres Format hat (von Hand erzeugte Testdatei, Format 2) | lädt, eingefrorener Prozess ist migriert |
| Änderung am Soll-Prozess | `compliance` unverändert |
| `localStorage.setItem` wirft | Meldung in der Kopfzeile |
| Tippen in einem Feld bei 3 Versionen | Schlüssel `prozesslotse:versionen` wird nicht neu geschrieben |
| `uebernimmFirmenangaben` | 5 Felder übernommen, Unterlagen und Versionen unverändert |
| `gestricheneKontrollen(9.1, Ergebnis der Regel `freigabe`, Vorschlag „Freigabe „Rechnung freigeben“ streichen“)` | `['auf_freigeben']` |
| `bpmnFuerExport` mit Option „ohne Compliance-Angaben“ | eingebettetes Projekt ohne `compliance`; Projekt in der App unverändert |

### 9.10 Browsertests (Playwright, Uhr fest auf 11.11.2026)

1. Beispiel „Lieferdienst“ laden, „Dokumentieren“ → „Lücken“: Zählerzeile „keine Fehler · 4 Warnungen · 3 Hinweise“ (Format von `zaehle`).
2. „Beheben“ bei B1 öffnet „Belege und Daten“ mit Fokus auf der Frage „Was ist „Bestellnotiz“?“ (Option „Weiß nicht“). „Nicht aufbewahrungspflichtig“ und eine Löschfrist von 30 Tagen ab Entstehung wählen: „keine Fehler · 3 Warnungen · 3 Hinweise“.
3. Version freigeben: Liste zeigt „1.0 · gültig ab 11.11.2026“. Im Schritt „Ablauf“ eine Aufgabe umbenennen: „Lücken“ zeigt V2 mit „Seit Version 1.0 geändert“.
4. „Als Word-Datei“: Download mit Namen `…-verfahrensdokumentation-v1-0.docx`, größer als 5 KB.
5. Druckansicht (`emulateMedia print`): Hinweis sichtbar, Teilschritt-Leiste unsichtbar.
6. axe in allen acht Teilschritten und im Freigabe-Dialog, hell und dunkel, sowie nach einer Freigabe (Versionsliste): keine schweren oder kritischen Befunde.
7. Tastatur: Teilschritte, Chips und Dialog vollständig ohne Maus bedienbar.
8. „Verbessern“: Vorschlag „Freigabe „Rechnung freigeben“ streichen“ zeigt den Hinweis auf die dokumentierte Kontrolle.
9. Bedienung (`e2e/dokumentieren-bedienung.spec.ts`): „Weiter“ zeigt den Anfang des nächsten Teilschritts, „Beheben“ die Frage zum Befund; der Fokus bleibt nach Anlegen und Entfernen bei einem sinnvollen Element; fehlende Namen und ungültige Zahlen werden am Feld gemeldet; „1 markiert – zeigen“ holt den markierten Schritt ins Bild.

### 9.11 Fachliche Abnahme

Die Ausgabe des Beispiels geht als PDF an eine Steuerberatung und, falls möglich, an einen Datenschutzbeauftragten. Rückmeldungen werden als Liste gesammelt und in Phase 7 eingearbeitet.

## 10. Risiken und offene Fragen

### 10.1 Risiken

| Risiko | Folge | Gegenmaßnahme |
| --- | --- | --- |
| Nutzer halten die Vorlage für geprüft und rechtssicher | falsche Sicherheit, Haftungsfragen | Hinweis auf jeder Ausgabe, „Entwurf“ bis zur Freigabe, keine Konformitätsversprechen, Befunde statt Häkchen |
| Rechtsstand veraltet (GoBD, AO, DSGVO) | falsche Fristen oder Texte | `RECHTSSTAND` in jedem Dokument, Fristen zentral in `standard.ts`, jährliche Durchsicht im Arbeitsplan |
| Datenobjekte kommen später doch ins Prozessmodell | doppelte Datenhaltung, Migration nötig | Tabellen aus 4.1 passen 1:1 auf BPMN-Datenobjekte; nur `quelle.ts` und eine Migration ändern sich |
| Format 3 wächst parallel weiter (während der Durchsicht kam Commit `915e957` hinzu) | neue Bausteine ohne Satzbaustein in Kapitel 4, geänderte Feldnamen | Abgleich in Phase 0; Zufallsprozesse mit allen Bausteinen im Test; ein unbekannter Baustein lässt den Test scheitern statt still zu fehlen |
| GoBD Rz. 151 verlangt die Dokumentation je DV-System, die App liefert sie je Prozess | Prüfer vermissen Systeme außerhalb des Prozesses | Hinweis A.0; Firmenmappe (2.2) |
| BPMN-Export trägt Compliance-Angaben samt Schwachstellen nach außen | Datenabfluss an Dritte | Export „ohne Compliance-Angaben“, Hinweis im Hinweisband |
| Sofortiges Speichern im `localStorage` wird mit Versionen langsam | träge Eingabe, voller Speicher | Versionen unter eigenem Schlüssel, nur bei Änderung geschrieben (7.3) |
| `docx` erscheint fast wöchentlich neu, eine Version könnte fehlerhaft oder kompromittiert sein | defekte Dateien, Lieferkettenrisiko | exakt pinnen, Lockfile, Updates nur bewusst mit `npm audit` und Tests aus 9.8 |
| Nutzungsrechte am Muster der BStBK/DStV unklar | Änderungsbedarf nach Veröffentlichung | nur Gliederung und Kapitelnamen, eigene Texte; offene Frage 4 |
| Satzbausteine lesen sich holprig | geringe Akzeptanz | Muster ohne Beugung („Zuständig: …“), Testleser in Phase 7 |
| Versionen füllen den Browser-Speicher | Datenverlust | Meldung bei Speicherfehler, Größe messen, Datei speichern |
| `docx` scheitert an der Tauri-CSP oder bläht das Bündel auf | kein DOCX im Programm | Test in Phase 0, dynamischer Import, Rückfall nur PDF |
| Ein Projekt beschreibt nur einen Prozess | Firmenangaben mehrfach pflegen, Widersprüche | Übernahme aus anderer Datei; Firmenmappe später |
| Kommerzielle Nutzung durch olbricht-digital berührt StBerG oder RDG | rechtliches Risiko | offene Frage 6, vor dem Angebot klären |
| Umfang wächst (Scannen, DSFA, Firmenmappe) | Termin rutscht | Liste „Später“, Phasen mit prüfbarem Ergebnis |

### 10.2 Offene Fragen für Robin

1. Heißt der neue Schritt „Dokumentieren“ oder „Compliance“?
2. Welche Fristenpolitik gilt als Standard: gesetzliche Mindestfristen (Vorschlag) oder einheitlich 10 Jahre wie im Muster?
3. Reicht zum Start eine Dokumentation je Prozess, oder wird früh eine Firmenmappe über mehrere Prozesse gebraucht?
4. Sollen nur Gliederung und Kapitelnamen des Musters übernommen werden (Vorschlag), oder fragst du bei der BStBK nach den Nutzungsrechten am Text?
5. Wer liest die Ausgabe fachlich gegen: eine Steuerberatung, ein Datenschutzbeauftragter aus deinem Umfeld?
6. Darf olbricht-digital Kunden beim Erstellen helfen (StBerG, RDG, Haftung)? Das sollte eine Steuerberatung oder ein Anwalt klären.
7. Soll das Diagramm als Bild in die DOCX-Datei (rund 1 Arbeitstag mehr), oder reichen Verweis und PDF?
8. Soll die Dokumentation auch für den Soll-Prozess als Entwurf erzeugt werden können?
9. Reicht der Befund „Überprüfung fällig“ beim Öffnen, oder soll das Windows-Programm später benachrichtigen?
10. Welcher echte Prozess dient als erster Praxistest, z. B. Ausgangsrechnungen bei olbricht-digital?
11. Sollen Unterlagen und Ablageorte zunächst nur in den Compliance-Angaben stehen (Vorschlag, im Plan enthalten)? Oder sollen sie vorher als Datenobjekte ins BPMN-Diagramm (eigene Spezifikation, grob geschätzt 4 bis 6 Arbeitstage mehr)?
12. Sollen Compliance-Angaben im BPMN-Export standardmäßig mitreisen (verlustfrei, Vorschlag) oder standardmäßig fehlen (sicherer bei Weitergabe)?

## 11. Arbeitsschritte zum Abhaken

Jeder Schritt dauert etwa einen halben bis einen Arbeitstag und endet mit einem prüfbaren Ergebnis. Vor jedem Commit gelten die Regeln aus `CLAUDE.md` (Lint, Tests, Build, bei Oberfläche Browsertests).

**Phase 0 – Klären und vorbereiten (1,5 Tage)**

- [ ] 0.1 Offene Fragen 1 bis 4, 11 und 12 mit Robin klären. Ergebnis: Antworten stehen in Abschnitt 10.2.
- [ ] 0.2 Mit dem aktuellen Stand von Format 3 abgleichen (ab Commit `915e957`). Ergebnis: Feldnamen in 4.1 und 6.6.1 stimmen; Satzbausteine für neu hinzugekommene Bausteine sind hier nachgetragen.
- [ ] 0.3 `docx` erproben: DOCX mit Überschrift, Tabelle und Fußzeile im Browser und im Windows-Programm (`npm run desktop:test`) erzeugen; dort auch `isSecureContext` und `crypto.subtle` prüfen. Ergebnis: Datei öffnet in Word, keine CSP-Meldung, `npm run build` ohne Typfehler, Chunk-Größe notiert.

**Phase 1 – Datenmodell, Speichern, Testdaten (4,5 Tage)**

- [ ] 1.1 `typen.ts` und `standard.ts` mit Katalogen, Texten und Standardwerten anlegen. Ergebnis: `npm run typecheck` grün.
- [ ] 1.2 Unterlagen, Ablageorte und Zugriffe: Operationen in `unterlagen.ts`, Adapter `quelle.ts` (4.1). Ergebnis: Tests für Anlegen, Umbenennen, Löschen, Zugriffe und `datenSicht` (Lieferdienst, leerer Prozess) grün.
- [ ] 1.3 `validiereCompliance` beim Laden einbauen, eingefrorene Prozesse migrieren. Ergebnis: Tests aus 9.9 zum Laden grün.
- [ ] 1.4 Reducer-Aktionen `compliance` und `teilschritt`, Bereinigung verwaister Einträge. Ergebnis: Tests in `zustand.test.ts` grün, inklusive Rückgängig.
- [ ] 1.5 Testdaten aus 9.1 in `src/compliance/beispiel.ts`. Ergebnis: Beispiel lädt, `regeln.test.ts` unverändert grün.
- [ ] 1.6 Versionen unter eigenem Schlüssel speichern, Meldung bei vollem Browser-Speicher, Menüpunkt „Daten im Browser löschen“. Ergebnis: Unit-Tests mit werfender Speicher-Attrappe und „Tippen schreibt Versionen nicht neu“ grün.

**Phase 2 – Fristen und Lückenprüfung (4 Tage)**

- [ ] 2.1 `datum.ts` und `fristen.ts`. Ergebnis: alle Fälle aus 9.2 grün.
- [ ] 2.2 `ableitung.ts` mit `vorigeAufgabe` und `nummern`. Ergebnis: Tests grün, `nummern` liefert 4.1 bis 4.18 für den Lieferdienst.
- [ ] 2.3 Regeln U1–U4 und B1–B9. Ergebnis: je Regel ein positiver und ein negativer Test grün, B6 und B7 mit beiden Schweregraden.
- [ ] 2.4 Regeln D1–D9. Ergebnis: Tests und Grenzfälle aus 9.4 grün.
- [ ] 2.5 Regeln S1–S6. Ergebnis: Tests und Grenzfälle grün.
- [ ] 2.6 Regeln K1–K6 und T1. Ergebnis: Fälle a bis g aus 9.3 grün.
- [ ] 2.7 Regeln V1–V3 und Gesamttest. Ergebnis: Testdaten liefern genau die 7 Befunde aus 9.5.

**Phase 3 – Dokumente erzeugen (5 Tage)**

- [ ] 3.1 `dokument.ts`: Kapitelschlüssel und Vergleich. Ergebnis: Tests mit kleinen Beispieldokumenten grün.
- [ ] 3.2 Verfahrensdokumentation: Deckblatt, Gliederung, Kapitel 1 bis 3. Ergebnis: Tests für Überschriften und Tabellen aus 9.6 grün.
- [ ] 3.3 `ablauftext.ts` für Aufgabe, Entscheidung, Gleichzeitig, Wiederholung und Warten. Ergebnis: Lieferdienst und Onlinebestellung grün.
- [ ] 3.4 Satzbausteine für die Bausteine aus Format 3, soweit umgesetzt. Ergebnis: je Baustein ein Test grün, 300 Zufallsprozesse grün.
- [ ] 3.5 Kapitel 5 bis 9 und Textbausteine. Ergebnis: Tests für Kapitel 5, Entwurf, Glossar und „Keine Versprechen“ grün. Ein Vergleich der Bausteine mit dem Mustertext (lokale Kopie außerhalb des Repos) findet keine gemeinsame Wortfolge über 8 Wörter.
- [ ] 3.6 Verzeichnis A bis D. Ergebnis: Test „Verzeichnis (9.1)“ grün.
- [ ] 3.7 `versionen.ts`: Freigabe, gültig bis, aufbewahren bis, Prüfsumme, geänderte Kapitel. Ergebnis: Tests aus 9.7 grün, Größe je Version gemessen.

**Phase 4 – Assistent, Teil 1 (4 Tage)**

- [ ] 4.1 Schritt „Dokumentieren“, Teilschritt-Leiste mit Status, Lernhinweise. Ergebnis: per Tastatur bedienbar, axe ohne schwere Befunde.
- [ ] 4.2 Teilschritt „Unternehmen“ mit Übernahme aus anderer Projektdatei. Ergebnis: U1–U4 verschwinden nach dem Ausfüllen.
- [ ] 4.3 „Belege und Daten“: Einordnung, Form, Ablage, Anlegen von Unterlagen und Ablageorten. Ergebnis: B1 und B3 lassen sich in der Oberfläche beheben.
- [ ] 4.4 „Belege und Daten“: Personenbezug, Kategorien, Rechtsgrundlage, Empfänger, Zwecke. Ergebnis: D1–D5, D8 und D9 lassen sich beheben.
- [ ] 4.5 „Systeme und Dienstleister“. Ergebnis: S1–S6 lassen sich beheben, Karten zeigen die Daten im System.

**Phase 5 – Assistent, Teil 2 (2,5 Tage)**

- [ ] 5.1 „Aufbewahrung und Löschung“. Ergebnis: Tabelle zeigt Fristen und Löschdaten; B2, D6, D7 lassen sich beheben.
- [ ] 5.2 „Kontrollen“ mit weiteren Kontrollen, Einweisung und Vier-Augen-Status. Ergebnis: K1–K6 lassen sich beheben.
- [ ] 5.3 „Schutzmaßnahmen“. Ergebnis: Vorschläge wählbar, T1 lässt sich beheben.
- [ ] 5.4 „Lücken“ mit „Beheben“ und Markierungen im Diagramm. Ergebnis: Browsertests 1 und 2 aus 9.10 grün.

**Phase 6 – Ausgabe, Freigabe, Verzahnung (4 Tage)**

- [ ] 6.1 `DokumentAnsicht` für beide Dokumente. Ergebnis: Vorschau entspricht dem Dokumentmodell, Tabellen mit Kopfzellen.
- [ ] 6.2 Druck und PDF. Ergebnis: in Edge geprüft: A4, Umbrüche, Fußzeile auf jeder Seite, Diagramm in 9.1.
- [ ] 6.3 DOCX-Export. Ergebnis: Tests aus 9.8 grün, Datei öffnet in Word.
- [ ] 6.4 Freigabe-Dialog, Versionsliste, „Geprüft, keine Änderung“. Ergebnis: Browsertest 3 grün.
- [ ] 6.5 Hinweis in „Verbessern“ bei gestrichener Kontrolle. Ergebnis: Unit-Test und Browsertest 8 grün.
- [ ] 6.6 BPMN-Export wahlweise ohne Compliance-Angaben. Ergebnis: Unit-Test aus 9.9 grün, Hinweis beim Export sichtbar.

**Phase 7 – Browsertests, Doku, Abnahme (3 Tage)**

- [ ] 7.1 Browsertests 4 bis 7 aus 9.10. Ergebnis: `npm run e2e` grün, hell und dunkel.
- [ ] 7.2 README, `docs/datenmodell.md` und `docs/fragenkatalog.md` ergänzen, Bild „Dokumente“ erzeugen. Ergebnis: Doku beschreibt Schritt, Regeln und Grenzen.
- [ ] 7.3 Ausgabe des Beispiels an Steuerberatung und Datenschutz zur Durchsicht geben. Ergebnis: Liste der Rückmeldungen.
- [ ] 7.4 Rückmeldungen einarbeiten. Ergebnis: Liste abgearbeitet; neue Version nach Robins Freigabe.

**Phase 8 – Windows-Programm (1,5 Tage)**

- [ ] 8.1 `Plattform.speichereBytes` und Rust-Befehl `speichern_unter_bytes` (Rohdaten, 7.5), Filter „Word-Dokument (*.docx)“. Ergebnis: Rust-Test für das Schreiben von Bytes grün, DOCX aus dem Programm öffnet in Word.
- [ ] 8.2 PDF der Compliance-Dokumente über das vorhandene `alsPdf`. Ergebnis: A4-PDF mit Fußzeile ohne Druckdialog.
- [ ] 8.3 Programmtest `scripts/desktop-test.mjs` erweitern: Beispiel laden, freigeben, DOCX und PDF speichern (Dialog über `PROZESSLOTSE_TEST_SPEICHERN_DOCX` bzw. `PROZESSLOTSE_TEST_PDF`), Datei neu öffnen. Den Installer prüft nur die CI (`installer-test.ps1`), nie Robins Rechner. Ergebnis: `npm run desktop:test` grün ohne Admin-Rechte, Versionen und Angaben bleiben erhalten, CI-Lauf grün.

| Phase | Arbeitstage |
| --- | --- |
| 0 Klären und vorbereiten | 1,5 |
| 1 Datenmodell, Speichern, Testdaten | 4,5 |
| 2 Fristen und Lückenprüfung | 4 |
| 3 Dokumente erzeugen | 5 |
| 4 Assistent, Teil 1 | 4 |
| 5 Assistent, Teil 2 | 2,5 |
| 6 Ausgabe, Freigabe, Verzahnung | 4 |
| 7 Browsertests, Doku, Abnahme | 3 |
| 8 Windows-Programm | 1,5 |
| **Summe** | **30** |

## 12. Quellen

Geöffnet und ausgewertet am 10. bzw. 11.11.2026:

1. § 147 AO, Ordnungsvorschriften für die Aufbewahrung von Unterlagen: https://www.gesetze-im-internet.de/ao_1977/__147.html
2. BStBK und DStV: Muster-Verfahrensdokumentation zum ersetzenden Scannen, Version 2.1, Stand 27.02.2026 (der Dateiname nennt noch v2.0 von 2019, der Inhalt ist Version 2.1): https://www.bstbk.de/downloads/bstbk/steuerrecht-und-rechnungslegung/fachinfos/BStBK_Muster-VerfD-ersetzendes-Scannen_v2.0-2019-11-29.pdf
3. BMF-Schreiben vom 14.07.2025, GoBD, 2. Änderung: https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Weitere_Steuerthemen/Abgabenordnung/2025-07-14-GoBD-2-aenderung.pdf?__blob=publicationFile
4. Amtliches AO-Handbuch 2026, Anhang 33: GoBD (Volltext in der Fassung vom 14.07.2025): https://ao.bundesfinanzministerium.de/ao/2026/Anhaenge/BMF-Schreiben-und-gleichlautende-Laendererlasse/Anhang-33/inhalt.html
5. Verordnung (EU) 2016/679 (DSGVO), deutscher Text auf EUR-Lex: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32016R0679
6. Datenschutzkonferenz: Hinweise zum Verzeichnis von Verarbeitungstätigkeiten, Art. 30 DS-GVO (Februar 2018): https://www.datenschutzkonferenz-online.de/media/ah/201802_ah_verzeichnis_verarbeitungstaetigkeiten.pdf
7. Datenschutzkonferenz: Muster Verzeichnis von Verarbeitungstätigkeiten, Verantwortlicher (Februar 2018): https://www.datenschutzkonferenz-online.de/media/ah/201802_ah_muster_verantwortliche.pdf
8. § 38 BDSG, Datenschutzbeauftragte nichtöffentlicher Stellen: https://www.gesetze-im-internet.de/bdsg_2018/__38.html
9. Tauri 2: Calling Rust from the Frontend (Rohdaten über `tauri::ipc::Request`, `InvokeBody::Raw`): https://v2.tauri.app/develop/calling-rust/

Bei der Durchsicht am 10./11.11.2026 erneut geöffnet und gegengelesen: Nr. 1, 2, 3, 4, 6, 7 und 9. Nr. 5 und 8 wurden nicht erneut geöffnet.

Ohne Webseite geprüft: `npm view` für `docx`, `fflate` und `nanoid` (Version, Lizenz, Abhängigkeiten); Paketinhalt von `docx` 9.15.3 per `npm pack` (`zipSync`, `Packer.toArrayBuffer`, Verweis auf Node-Typen); BPMN-Schema in `node_modules/bpmn-moddle` 10.3.1; Quelltext des Prozesslotsen bis Commit `915e957`, darin `src-tauri`, `src/plattform`, `src/bpmn/einbettung.ts`, `src/App.tsx`.

## Prüfvermerk (2026-11-10)

Durchsicht durch einen zweiten Agenten in der Nacht zum 11.11.2026, gegen den Code bis Commit `915e957`. Gegengelesen wurden die Quellen 1, 2, 3, 4, 6, 7 und 9 aus Abschnitt 12. Bibliotheken sind mit `npm view` und `npm pack` geprüft.

**Bestätigt**

- Fristen 10, 8 und 6 Jahre, Lieferschein-Regel, Fristbeginn und Ablaufhemmung (§ 147 Abs. 1, 3, 4 AO).
- GoBD in der Fassung vom 14.07.2025: Datum, GZ und Rz. 185 stimmen. Rz. 100, 102, 106, 110, 119, 121, 131, 136 und 151–155 sagen, was die Spezifikation ihnen zuschreibt.
- Muster der BStBK und des DStV: Version 2.1 vom 27.02.2026, Gliederung, 13 Kriterien (Ziff. 2.3 [10]), Empfehlung von 10 Jahren (Ziff. 2.3 [2]), Ergänzungsklausel (Ziff. 0.1 [9]), AWV-Muster zur Belegablage (Ziff. 0.3).
- DSK: sechs TOM-Bereiche (Ziff. 6.8), Aussage zu Drittländern, präzise Löschfristen, Ausnahme nach Art. 30 Abs. 5 selten; Aufbau des DSK-Musters.
- `docx` 9.15.3, `fflate` 0.8.3, `nanoid` 6.0.2, alle MIT.
- Von Hand nachgerechnet: die 7 Befunde aus 9.5, die Datumsfälle aus 9.2, 18 bzw. 8 Aufgaben in den Beispielen, die Kapitelnummern in 9.6 und die Fälle a bis g in 9.3.

**Geändert**

1. **Fehlende Grundlage:** Die Erweiterung „Datenobjekte und Datenspeicher“ gibt es weder als Code noch als Spezifikation. Unterlagen, Ablageorte und Zugriffe sind jetzt eigene Tabellen in `compliance` (4.1, 4.2), mit Operationen, Prüfung, Bereinigung, Tests und Schritt 1.2.
2. **Code-Stand:** Grundlage ist 0.2.0 bis Commit `915e957`. Windows-Programm, ODER und externe Teilnehmer existieren schon. 7.5 beschreibt jetzt die echte Plattform-Schnittstelle und einen Befehl `speichern_unter_bytes` mit Rohdaten.
3. **Speicherung:** Das Programm schreibt bei jeder Änderung in den `localStorage`, auch unter Windows. Versionen liegen deshalb unter einem eigenen Schlüssel (7.3). Die 20-MB-Grenze des Rust-Teils ist genannt.
4. **Datenschutz:** Der BPMN-Export trägt alle Compliance-Angaben nach außen. Neu sind die Option „ohne Compliance-Angaben“ (MVP 10, Abschnitt 8, Schritt 6.6) und ein Hinweis auf Vertraulichkeit.
5. **DSGVO:** Empfänger im Drittland sind konkret zu benennen (Feld `name`, Regel D8). Support aus dem Drittland „kann“ eine Übermittlung sein, nicht „ist“ (3.5, S3). Externe Rollen stehen im Verzeichnis unter extern (B.4). Weitere DSB-Auslöser sind als Hinweis genannt.
6. **GoBD:** Fristbeginn nach § 147 Abs. 4 AO präzisiert. B6 kennt die Ausnahme für auf Papier versandte Briefe (Rz. 119, 120), B7 die Umwandlung nach Rz. 135. D7 ist für Lieferscheine definiert. Versionen werden „mindestens bis“ aufbewahrt. Rz. 151 (je DV-System) steht als Hinweis und Risiko drin.
7. **Urheberrecht:** A.1, A.4, A.5 und der Satz in Kapitel 7 lagen sehr nah am Mustertext und sind neu formuliert. Die 13 Kriterien stehen in der Reihenfolge des Musters. Schritt 3.5 gleicht die Bausteine mit dem Mustertext ab.
8. **Versionen:** Prüfsumme über kanonisches JSON. Eingefrorene Prozesse laufen durch die Formatmigration. Kapitel 1 wird verglichen. Das Datum des Rücksicherungstests steht nicht mehr im Dokument, damit nicht jeder Test V2 auslöst.
9. **Technik:** `docx` wird exakt gepinnt, weil es etwa alle vier Tage erscheint. `zipSync` ohne Worker ist bestätigt. Node-Typen und `crypto.subtle` im sicheren Kontext sind Prüfpunkte in Phase 0.
10. **Kleinere Fehler:** Die Regel im Schritt „Verbessern“ heißt `freigabe` („Freigabe … streichen“), nicht „Kontrolle reduzieren“. Rechtsformen um e. K. und PartG ergänzt. Erwartete Texte in 9.6 und 9.10 an Teilnehmer und V2-Text angepasst. Verweis in 3.6 korrigiert.
11. **Plan:** Schritt 8.3 verstieß gegen `CLAUDE.md` (Installer nie auf Robins Rechner) und läuft jetzt über `npm run desktop:test` und die CI. Neu sind die Schritte 1.2 und 6.6 sowie Tests in 9.4, 9.6, 9.7 und 9.9. Summe 30 statt 28,5 Arbeitstage.

**Offen**

- Neue offene Fragen 11 (Datenobjekte im BPMN) und 12 (Standard beim BPMN-Export).
- DSGVO-Text und § 38 BDSG wurden nicht erneut geöffnet.
- Das Muster enthält keinen Hinweis zu Nutzungsrechten (Frage 4). Nur Gliederung und Kapitelnamen zu übernehmen, lässt ein kleines Restrisiko.
- StBerG und RDG für ein Angebot von olbricht-digital bleiben ungeklärt (Frage 6).
- Ob CSP, `crypto.subtle` und die Node-Typen von `docx` im Programm passen, zeigt erst Phase 0.
- Format 3 ändert sich weiter. Die Satzbausteine für Teilprozess, für jede Position, Unterbrechung und Abbruch sind noch nicht gegen Code geprüft.
- Die 30 Arbeitstage sind eine Schätzung ohne Puffer.
