# Prozesslotse

Geschäftsprozesse über geführte Fragen modellieren, als BPMN-2.0-Diagramm zeichnen, mit Kennzahlen prüfen und mit begründeten Vorschlägen verbessern. Läuft als Windows-Programm oder im Browser, ohne KI und ohne Server.

![Schritt „Prüfen“: Kennzahlen links, Diagramm mit markierten Schwachstellen rechts](docs/bilder/pruefen.png)

## Was es kann

- **Geführter Assistent statt Zeichenwerkzeug.** Der Ablauf entsteht aus Antworten auf „Was passiert als Nächstes?“ und sechs Bausteinen: Aufgabe, Entscheidung, Mehrere Wege (ODER), Gleichzeitig, Wiederholung, Warten. Der Assistent führt nacheinander durch jeden Zweig einer Verzweigung.
- **Rückfragen und Korrekturschleifen.** Jeder Ausgang einer Entscheidung führt weiter, beendet den Prozess oder springt zu einem früheren Schritt zurück. Eine Entscheidung kann auch davon abhängen, was zuerst passiert (Antwort des Kunden, Stornierung, Ablauf einer Frist), in BPMN ein ereignisbasiertes Gateway.
- **Korrekt durch Bauweise und Prüfung.** Jede Verzweigung wird automatisch wieder zusammengeführt, Rücksprünge werden zu sauberen Bereichen (blockstrukturiertes Modell). Was die Bauweise allein nicht verhindert, etwa ein Prozessende innerhalb von „Gleichzeitig“ oder eine Entscheidung, deren Ausgänge alle zurückspringen, melden die Prüfregeln als Fehler. Dazu kommen Anteile ungleich 100 %, fehlende Angaben und Benennungen gegen die 7PMG-Richtlinien. Ein Tokenspiel nach den Ausführungsregeln von BPMN bestätigt in den Tests: Meldet die Prüfung keinen Fehler, ist das exportierte Diagramm sound.
- **Normgerechtes BPMN 2.0** mit einer Bahn je Rolle, Benutzer- und manuellen Aufgaben, Ereignissen und Diagramm-Informationen (DI). Die Datei öffnet sich in bpmn.io, Camunda Modeler oder Signavio.
- **Kennzahlen mit nachvollziehbaren Formeln:** Durchlaufzeit, Flusseffizienz, Kosten je Vorgang, Auslastung je Rolle mit Engpass nach dem Warteschlangenmodell M/M/c (die Schwelle hängt von der Teamgröße ab), Vorgänge in Arbeit nach dem Gesetz von Little, Medienbrüche und Übergaben. Eine Monte-Carlo-Simulation liefert zusätzlich den 90-%-Wert der Durchlaufzeit und die Durchlaufzeit je Ergebnis (z. B. versendet, storniert, verfallen).
- **Schwachstellen im Diagramm:** Medienbruch, Engpass, lange Liegezeit, Nacharbeit, Freigabe ohne erkennbaren Nutzen, Kontrolle ohne Folge, dieselbe Person in parallelen Zweigen und Hin und Her zwischen Rollen werden am betroffenen Element markiert. Wiederholungen tragen einen Zweck: Nur Korrekturen zählen als Nacharbeit, gewollte Durchgänge („je Position“) nicht.
- **Vorschläge mit berechneter Wirkung.** Sechs Regeln formen eine Kopie des Prozesses um, die Wirkung kommt aus denselben Formeln wie die Kennzahlen. Übernommene Vorschläge ergeben den Soll-Prozess.
- **Bericht** mit Ist-Soll-Vergleich, Maßnahmen, Befunden und beiden Diagrammen. Export als BPMN, SVG und Projektdatei, Druck als PDF.
- **Compliance-Doku:** Aus dem Ist-Prozess entstehen die Verfahrensdokumentation nach GoBD und das Verzeichnis von Verarbeitungstätigkeiten nach Art. 30 DSGVO, mit Lückenprüfung, freigegebenen Versionen und Export als Word-Datei und PDF ([Abschnitt unten](#compliance-doku)).
- **Windows-Programm (Tauri 2):** Installer mit 1,3 MB, pro Benutzer und ohne Admin-Rechte. Projekte sind `.prozesslotse`-Dateien; ein Doppelklick öffnet sie, auch im schon laufenden Programm. Speichern, Speichern unter, „Zuletzt geöffnet“, Rückfrage bei ungespeicherten Änderungen und PDF in A4 ohne Druckdialog. Exportiertes BPMN enthält das ganze Projekt und öffnet sich wieder verlustfrei; fremde BPMN-Dateien werden angezeigt.
- **Lernmodus:** Zu jeder Auswahl erklärt ein Hinweis das passende BPMN-Element.

| Ablauf beschreiben | Verbessern |
| --- | --- |
| ![Assistent mit Einfügeposition im Ausgang „Nein“ und Gliederung](docs/bilder/ablauf.png) | ![Vorschlag mit berechneter Wirkung, betroffene Schritte im Soll-Diagramm hervorgehoben](docs/bilder/verbessern.png) |

## Fallbeispiel

Ein regionaler Lieferdienst, von der telefonischen Bestellung bis zur Rechnung, mit 120 Vorgängen am Tag und 6 Rollen. Das Werkzeug findet:

- 6,7 Arbeitstage Durchlaufzeit, davon nur 1,5 % Bearbeitung
- einen Engpass bei der Niederlassungsleitung (98 % Auslastung) durch eine Freigabe, die in 98 % der Fälle erteilt wird, und einen bei der Buchhaltung (81 %, eine Person)
- drei Medienbrüche, Nacharbeit beim Kommissionieren, zweimal Hin und Her zwischen Rollen

Zwei Vorschläge (Freigabe streichen, Tourenplanung parallel zur Kommissionierung) senken die Durchlaufzeit auf 4,5 Arbeitstage.

Ein zweites Beispiel, **Onlinebestellung**, zeigt eine Korrekturschleife: Sind die Bestelldaten fehlerhaft, wird der Kunde gefragt. Kommt seine Korrektur, geht es zurück zur Erfassung; storniert er oder läuft die Frist von 7 Tagen ab, endet der Vorgang.

## Formeln

| Kennzahl | Berechnung |
| --- | --- |
| Häufigkeit eines Schritts | Produkt der Anteile auf dem Weg dorthin; eine Wiederholung, die in r der Durchläufe wiederholt, läuft 1 / (1 − r)-mal |
| Durchlaufzeit | hintereinander addiert, Entscheidung gewichtet gemittelt, Gleichzeitig: Erwartungswert des Maximums der Zweigdauern (aus deren Verteilungen), Wiederholung: Körper × 1 / (1 − r) |
| Flusseffizienz | theoretische Durchlaufzeit (gleiche Rechnung, nur Bearbeitungszeiten) / Durchlaufzeit |
| Kosten je Vorgang | Σ Häufigkeit × Bearbeitungszeit × Stundensatz der Rolle |
| Auslastung | Vorgänge pro Tag × Arbeitszeit der Rolle je Vorgang / (Personen × Arbeitsstunden × verfügbarer Anteil) |
| Engpass | mittlere Wartezeit nach M/M/c (Erlang C) mindestens viermal so lang wie die Bearbeitung: bei einer Person ab 80 % Auslastung, bei zwei ab 89 %, bei sechs ab etwa 95 % |
| Vorgänge in Arbeit | Vorgänge pro Tag × Durchlaufzeit in Arbeitstagen (Gesetz von Little); bei Überlast nicht angegeben, weil der Bestand dann wächst |
| Medienbrüche, Übergaben | erwartete Anzahl manueller Übertragungen bzw. Rollenwechsel zwischen aufeinanderfolgenden Aufgaben |

Wiederholungen werden geschlossen gelöst, nicht ausgerollt. Ein Ausgang, der den Prozess vorzeitig beendet, geht mit seiner Wahrscheinlichkeit in alle Werte ein.

## Verbesserungsregeln

| Regel | Erkennt | Umformung |
| --- | --- | --- |
| Gleichzeitig ausführen | Schritt braucht das Ergebnis des vorherigen nicht, andere Rolle | beide Schritte in „Gleichzeitig“ |
| Medienbruch beseitigen | Daten werden von Hand übertragen | Übertragung und ihre Minuten entfallen |
| Zusammenlegen | zwei Schritte derselben Rolle mit Liegezeit dazwischen | ein Schritt, Liegezeit und Abtippen entfallen |
| Nacharbeit senken | Korrektur-Wiederholung in mindestens 15 % der Durchläufe | Anteil halbiert (als Annahme gekennzeichnet) |
| Kontrolle reduzieren | Freigabe wird in mindestens 90 % der Fälle erteilt | Freigabe entfällt, eine direkt folgende Entscheidung darüber mit (als Annahme gekennzeichnet) |
| Knock-out-Reihenfolge | mehrere Prüfungen hintereinander, die jeweils Fälle aussortieren | aufsteigend nach Dauer / Ausfallquote sortiert, so dass die schnelle, oft aussortierende Prüfung zuerst kommt (Unabhängigkeit als Annahme) |

Prüfungen und Freigaben werden nie mit anderen Schritten zusammengelegt (Vier-Augen-Prinzip).

## Compliance-Doku

![Teilschritt „Dokumente“: Hinweis, Freigabe und Vorschau der Verfahrensdokumentation](docs/bilder/dokumente.png)

Der Schritt „Dokumentieren“ erzeugt aus dem Ist-Prozess zwei Dokumente, die in kleinen Betrieben oft fehlen:

- die **Verfahrensdokumentation** nach GoBD Rz. 151–155 in der Gliederung der Muster-Verfahrensdokumentation von BStBK und DStV (Version 2.1). Kapitel 4 beschreibt den modellierten Ablauf Schritt für Schritt: Bedingungen, Zuständigkeit, System, Unterlagen, Medienbrüche, Kontrollen und Nachrichten an Externe;
- das **Verzeichnis von Verarbeitungstätigkeiten** nach Art. 30 Abs. 1 DSGVO im Aufbau des Musters der Datenschutzkonferenz, mit den technischen und organisatorischen Maßnahmen in sechs Bereichen.

| Teilschritt | Fragt nach |
| --- | --- |
| Unternehmen | Verantwortlicher, Geschäftsleitung, Datenschutzbeauftragter (§ 38 BDSG), Verarbeitungstätigkeit; Übernahme aus einer anderen Projektdatei |
| Belege und Daten | je Unterlage: Einordnung nach § 147 AO, Form, Ablage, Personenbezug, Rechtsgrundlage, Empfänger; Zweck der Verarbeitung |
| Systeme und Dienstleister | Version, Betrieb, Standort, Vertrag zur Auftragsverarbeitung, Schutz vor Änderung, Datensicherung |
| Aufbewahrung und Löschung | gesetzliche und gewählte Frist, frühestes Löschdatum, Löschfristen, wer löscht |
| Kontrollen | Prüfungen und Freigaben mit Vier-Augen-Status, weitere Kontrollen, Einweisung |
| Schutzmaßnahmen | sechs Bereiche nach Art. 32 Abs. 1 DSGVO mit Vorschlägen |
| Lücken | 38 Regeln mit Quelle und „Beheben“, z. B. Frist kürzer als vorgeschrieben, E-Mail-Postfach als einziges Archiv, Freigabe ohne Vier-Augen-Prinzip, Dienstleister ohne AV-Vertrag |
| Dokumente | Vorschau, Druck als PDF, Word-Datei, Freigabe und Versionsliste |

- **Fristen** nach § 147 AO: Bücher und Organisationsunterlagen 10 Jahre, Buchungsbelege 8, Geschäftsbriefe und sonstige Unterlagen 6, jeweils ab Ende des Kalenderjahres; Lieferscheine ohne Buchungsfunktion bis zur Rechnung.
- **Versionen:** Eine Freigabe friert Ist-Prozess und beide Dokumente ein, mit Gültig-ab-Datum, Freigabe, geänderten Kapiteln und SHA-256-Prüfsumme über kanonisches JSON. Ändert sich danach etwas Fachliches, nennt die Lückenprüfung die betroffenen Kapitel; nach 365 Tagen erinnert sie an die Überprüfung.
- **Vertraulich behandeln:** Die Angaben beschreiben Schwachstellen wie eine fehlende Datensicherung. Projektdatei und Ausgaben gehören nicht an Dritte; die BPMN-Datei lässt sich ohne Compliance-Angaben exportieren, und „Daten im Browser löschen“ leert den Browser-Speicher.
- **Keine Rechts- oder Steuerberatung:** Beide Dokumente sind Vorlagen zur Prüfung durch Steuerberatung bzw. Datenschutzbeauftragten, keine Rechts- oder Steuerberatung. Die App prüft, ob die Angaben vollständig und widerspruchsfrei sind, nicht, ob sie stimmen.

Spezifikation, Annahmen und Stand: [compliance-spezifikation.md](docs/compliance-spezifikation.md), [compliance-entscheidungen.md](docs/compliance-entscheidungen.md), [compliance-stand.md](docs/compliance-stand.md).

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `src/modell` | Datenmodell, Operationen, Prüfregeln, Führung durch den Ablauf, Speichern, Fallbeispiel |
| `src/analyse` | Kennzahlen, Simulation, Schwachstellen, Verbesserungsregeln |
| `src/compliance` | Compliance-Doku: Angaben, Fristen, Lückenprüfung, Verfahrensdokumentation, Verzeichnis, Versionen, DOCX |
| `src/bpmn` | eigenes Layout mit Bahnen und Spuren, BPMN-XML mit DI |
| `src/ui` | React-Oberfläche: Assistent, Diagramm (bpmn-js), Prüfen, Verbessern, Bericht |
| `src/plattform` | Öffnen, Speichern und Fenster: im Browser per Download, im Programm über den Rust-Teil |
| `src-tauri` | Windows-Programm: Dateibefehle nur für vom Benutzer gewählte Pfade, Menü, PDF über WebView2, Installer |
| `e2e` | Browsertests mit Playwright und axe |
| `docs` | [Datenmodell](docs/datenmodell.md), [Fragenkatalog](docs/fragenkatalog.md) |

Die Fachlogik kennt kein React und ist vollständig getestet. bpmn-js dient nur der Anzeige; Layout und BPMN-Export sind selbst geschrieben.

**Technik:** React 19, TypeScript 7, Vite 8, bpmn-js 18, Tauri 2 (Rust), Vitest, Playwright, GitHub Actions.

## Qualität

- 102 Unit-Tests und 3 Rust-Tests, darunter von Hand nachgerechnete Kennzahlen und ein Belastungstest mit 300 zufällig erzeugten, verschachtelten Prozessen (mit Rücksprüngen und Ereignis-Entscheidungen): keine Überlappung, keine Kante durch fremde Elemente, Schema-Prüfung mit bpmn-moddle.
- Tokenspiel nach den Ausführungsregeln von BPMN 2.0: Für beide Beispiele und alle 300 Zufallsprozesse ist das exportierte Diagramm sound (keine Verklemmung, jeder Vorgang kann enden, kein toter Schritt), und die Häufigkeiten aus dem Tokenspiel stimmen mit den Formeln überein.
- 15 Browsertests: Prozess vollständig über den Assistenten anlegen, Korrekturschleife mit Rücksprung, Tastaturbedienung, Vorschlag übernehmen, Exporte, Datei öffnen, BPMN wieder öffnen, Rückfrage bei ungespeicherten Änderungen.
- Desktop-Test am echten Programm (`npm run desktop:test`): 16 Prüfungen von Speichern unter bis zur Rückfrage beim Schließen, PDF-Seite in A4.
- Installer-Test in der CI auf Windows: still installieren, Dateizuordnungen prüfen (`.bpmn` nur unter „Öffnen mit“), still deinstallieren.
- Barrierefreiheit: axe meldet in keinem Schritt schwere Befunde, weder hell noch dunkel; jedes Eingabefeld ist beschriftet.
- Bei jedem Push laufen Lint, Unit-Tests, Build und Browsertests.
- Compliance-Doku: 38 Regeln mit Positiv- und Negativfall, von Hand nachgerechnete Fristen (Monatsende, Schaltjahr, 365 und 366 Tage), die Testdaten liefern genau die erwarteten 7 Befunde; 300 Zufallsprozesse erzeugen Dokumente ohne Absturz und ohne Konformitätsversprechen; DOCX wird entpackt und geprüft. 14 Browsertests decken Lücken und „Beheben“, Freigabe, Word-Datei, Druck, Tastatur und axe hell und dunkel ab.

## Entwickeln

```bash
npm install
npm run dev       # Entwicklungsserver
npm test          # Unit-Tests (Vitest)
npm run e2e       # Browsertests (lokal mit Edge, in der CI mit Chrome)
npm run build     # Typprüfung und Produktions-Build

# Windows-Programm (braucht Rust und die VS Build Tools)
npm run desktop                        # Programm mit Entwicklungsserver
npm run desktop:build                  # Programm und Installer (src-tauri/target/release/bundle/nsis)
npx tauri build --debug --no-bundle    # Debug-Build für den Desktop-Test
npm run desktop:test                   # Desktop-Test gegen den Debug-Build
```

`node scripts/readme-bilder.mjs` erzeugt die Bilder dieser README neu (bei laufendem `npx vite preview --port 4173`).

## Grenzen

- Zeiten und Anteile sind Schätzungen; alle Werte sind Erwartungswerte.
- Die Simulation würfelt die Wege (Entscheidungen, Wiederholungen), nicht die Zeiten je Schritt. Der 90-%-Wert ist deshalb eher zu niedrig.
- Wartezeiten durch Auslastung gehen nicht in die Durchlaufzeit ein; dafür stehen die geschätzten Liegezeiten. Das Warteschlangenmodell bewertet nur, ab wann eine Rolle zum Engpass wird. Es nimmt zufällig eintreffende Arbeit an und ist für geplante, gebündelte Arbeit eher zu vorsichtig.
- Bei „Gleichzeitig“ gelten die Zweige als unabhängig. Arbeitet dieselbe Person in mehreren Zweigen, ist die berechnete Dauer zu niedrig; ein Hinweis meldet das.
- Rücksprünge führen nur zu früheren Schritten derselben oder einer umgebenden Ebene, nie aus „Gleichzeitig“ heraus.
- Noch nicht abbildbar (in Arbeit, siehe [Modellierung, Format 3](docs/modellierung-v3.md)): Mehrfachinstanzen („für jede Position“, nur als Wiederholung angenähert), Abbruch und Eskalation über Randereignisse, Unterprozesse, Nachrichten zwischen Organisationen (Pools).

- Compliance-Doku: je Projekt ein Prozess; eine Gesamtdokumentation aller Systeme eines Betriebs (GoBD Rz. 151) entsteht erst mit einer Firmenmappe. Die Ablaufhemmung (§ 147 Abs. 3 AO) wird nicht berechnet, nur genannt. Ersetzendes Scannen, Kassenführung und Lohn sind nicht abgedeckt. Rechtsstand 11.11.2026; keine Gewähr für Vollständigkeit.

## Lizenz

Noch nicht festgelegt. bpmn-js steht unter der bpmn.io-Lizenz, die das bpmn.io-Logo im angezeigten Diagramm vorschreibt. Die Word-Datei erzeugt `docx` (MIT) mit `fflate` und `nanoid` (beide MIT).
