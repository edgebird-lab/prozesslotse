# Prozesslotse

Geschäftsprozesse über geführte Fragen modellieren, als BPMN-2.0-Diagramm zeichnen, mit Kennzahlen prüfen und mit begründeten Vorschlägen verbessern. Läuft komplett im Browser, ohne KI und ohne Server.

![Schritt „Prüfen“: Kennzahlen links, Diagramm mit markierten Schwachstellen rechts](docs/bilder/pruefen.png)

## Was es kann

- **Geführter Assistent statt Zeichenwerkzeug.** Der Ablauf entsteht aus Antworten auf „Was passiert als Nächstes?“ und fünf Bausteinen: Aufgabe, Entscheidung, Gleichzeitig, Wiederholung, Warten. Der Assistent führt nacheinander durch jeden Zweig einer Verzweigung.
- **Rückfragen und Korrekturschleifen.** Jeder Ausgang einer Entscheidung führt weiter, beendet den Prozess oder springt zu einem früheren Schritt zurück. Eine Entscheidung kann auch davon abhängen, was zuerst passiert (Antwort des Kunden, Stornierung, Ablauf einer Frist), in BPMN ein ereignisbasiertes Gateway.
- **Korrekt durch die Bauweise.** Jede Verzweigung wird automatisch wieder zusammengeführt, Rücksprünge werden zu sauberen Bereichen (blockstrukturiertes Modell). Verklemmungen und unerreichbare Schritte können so nicht entstehen. Prüfregeln melden den Rest: Anteile ungleich 100 %, Endlosschleifen, fehlende Angaben und Benennungen gegen die 7PMG-Richtlinien. Ein Tokenspiel nach den Ausführungsregeln von BPMN prüft zusätzlich jedes exportierte Diagramm in den Tests.
- **Normgerechtes BPMN 2.0** mit einer Bahn je Rolle, Benutzer- und manuellen Aufgaben, Ereignissen und Diagramm-Informationen (DI). Die Datei öffnet sich in bpmn.io, Camunda Modeler oder Signavio.
- **Kennzahlen mit nachvollziehbaren Formeln:** Durchlaufzeit, Flusseffizienz, Kosten je Vorgang, Auslastung je Rolle mit Engpass, offene Vorgänge nach dem Gesetz von Little, Medienbrüche und Übergaben. Eine Monte-Carlo-Simulation liefert zusätzlich den 90-%-Wert der Durchlaufzeit.
- **Schwachstellen im Diagramm:** Medienbruch, Engpass, lange Liegezeit, Nacharbeit, Freigabe ohne erkennbaren Nutzen und Hin und Her zwischen Rollen werden am betroffenen Element markiert.
- **Vorschläge mit berechneter Wirkung.** Fünf Regeln formen eine Kopie des Prozesses um, die Wirkung kommt aus denselben Formeln wie die Kennzahlen. Übernommene Vorschläge ergeben den Soll-Prozess.
- **Bericht** mit Ist-Soll-Vergleich, Maßnahmen, Befunden und beiden Diagrammen. Export als BPMN, SVG und JSON, Druck als PDF.
- **Lernmodus:** Zu jeder Auswahl erklärt ein Hinweis das passende BPMN-Element.

| Ablauf beschreiben | Verbessern |
| --- | --- |
| ![Assistent mit Einfügeposition im Ausgang „Nein“ und Gliederung](docs/bilder/ablauf.png) | ![Vorschlag mit berechneter Wirkung, betroffene Schritte im Soll-Diagramm hervorgehoben](docs/bilder/verbessern.png) |

## Fallbeispiel

Ein regionaler Lieferdienst, von der telefonischen Bestellung bis zur Rechnung, mit 120 Vorgängen am Tag und 6 Rollen. Das Werkzeug findet:

- 6,7 Arbeitstage Durchlaufzeit, davon nur 1,5 % Bearbeitung
- einen Engpass bei der Niederlassungsleitung (98 % Auslastung) durch eine Freigabe, die in 98 % der Fälle erteilt wird
- drei Medienbrüche, Nacharbeit beim Kommissionieren, zweimal Hin und Her zwischen Rollen

Zwei Vorschläge (Freigabe streichen, Tourenplanung parallel zur Kommissionierung) senken die Durchlaufzeit auf 4,4 Arbeitstage.

Ein zweites Beispiel, **Onlinebestellung**, zeigt eine Korrekturschleife: Sind die Bestelldaten fehlerhaft, wird der Kunde gefragt. Kommt seine Korrektur, geht es zurück zur Erfassung; storniert er oder läuft die Frist von 7 Tagen ab, endet der Vorgang.

## Formeln

| Kennzahl | Berechnung |
| --- | --- |
| Häufigkeit eines Schritts | Produkt der Anteile auf dem Weg dorthin; eine Wiederholung mit Anteil p läuft 1 / (1 − p)-mal |
| Durchlaufzeit | hintereinander addiert, Entscheidung gewichtet gemittelt, Gleichzeitig: Zweig mit der längsten erwarteten Dauer, Wiederholung: Körper × 1 / (1 − p) |
| Flusseffizienz | Bearbeitungszeit auf dem zeitbestimmenden Pfad / Durchlaufzeit |
| Kosten je Vorgang | Σ Häufigkeit × Bearbeitungszeit × Stundensatz der Rolle |
| Auslastung | Vorgänge pro Tag × Arbeitszeit der Rolle je Vorgang / (Personen × Arbeitsstunden × verfügbarer Anteil) |
| Offene Vorgänge | Vorgänge pro Tag × Durchlaufzeit in Arbeitstagen (Gesetz von Little) |
| Medienbrüche, Übergaben | erwartete Anzahl manueller Übertragungen bzw. Rollenwechsel zwischen aufeinanderfolgenden Aufgaben |

Wiederholungen werden geschlossen gelöst, nicht ausgerollt. Ein Ausgang, der den Prozess vorzeitig beendet, geht mit seiner Wahrscheinlichkeit in alle Werte ein.

## Verbesserungsregeln

| Regel | Erkennt | Umformung |
| --- | --- | --- |
| Gleichzeitig ausführen | Schritt braucht das Ergebnis des vorherigen nicht, andere Rolle | beide Schritte in „Gleichzeitig“ |
| Medienbruch beseitigen | Daten werden von Hand übertragen | Übertragung und ihre Minuten entfallen |
| Zusammenlegen | zwei Schritte derselben Rolle mit Liegezeit dazwischen | ein Schritt, Liegezeit und Abtippen entfallen |
| Nacharbeit senken | Wiederholung in mindestens 15 % der Durchläufe | Anteil halbiert (als Annahme gekennzeichnet) |
| Kontrolle reduzieren | Freigabe wird in mindestens 90 % der Fälle erteilt | Freigabe entfällt (als Annahme gekennzeichnet) |

Prüfungen und Freigaben werden nie mit anderen Schritten zusammengelegt (Vier-Augen-Prinzip).

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `src/modell` | Datenmodell, Operationen, Prüfregeln, Führung durch den Ablauf, Speichern, Fallbeispiel |
| `src/analyse` | Kennzahlen, Simulation, Schwachstellen, Verbesserungsregeln |
| `src/bpmn` | eigenes Layout mit Bahnen und Spuren, BPMN-XML mit DI |
| `src/ui` | React-Oberfläche: Assistent, Diagramm (bpmn-js), Prüfen, Verbessern, Bericht |
| `e2e` | Browsertests mit Playwright und axe |
| `docs` | [Datenmodell](docs/datenmodell.md), [Fragenkatalog](docs/fragenkatalog.md) |

Die Fachlogik kennt kein React und ist vollständig getestet. bpmn-js dient nur der Anzeige; Layout und BPMN-Export sind selbst geschrieben.

**Technik:** React 19, TypeScript 7, Vite 8, bpmn-js 18, Vitest, Playwright, GitHub Actions.

## Qualität

- 75 Unit-Tests, darunter von Hand nachgerechnete Kennzahlen und ein Belastungstest mit 300 zufällig erzeugten, verschachtelten Prozessen (mit Rücksprüngen und Ereignis-Entscheidungen): keine Überlappung, keine Kante durch fremde Elemente, Schema-Prüfung mit bpmn-moddle.
- Tokenspiel nach den Ausführungsregeln von BPMN 2.0: Für beide Beispiele und alle 300 Zufallsprozesse ist das exportierte Diagramm sound (keine Verklemmung, jeder Vorgang kann enden, kein toter Schritt), und die Häufigkeiten aus dem Tokenspiel stimmen mit den Formeln überein.
- 11 Browsertests: Prozess vollständig über den Assistenten anlegen, Korrekturschleife mit Rücksprung, Tastaturbedienung, Vorschlag übernehmen, Exporte, Datei öffnen.
- Barrierefreiheit: axe meldet in keinem Schritt schwere Befunde, weder hell noch dunkel; jedes Eingabefeld ist beschriftet.
- Bei jedem Push laufen Lint, Unit-Tests, Build und Browsertests.

## Entwickeln

```bash
npm install
npm run dev       # Entwicklungsserver
npm test          # Unit-Tests (Vitest)
npm run e2e       # Browsertests (lokal mit Edge, in der CI mit Chrome)
npm run build     # Typprüfung und Produktions-Build
```

`node scripts/readme-bilder.mjs` erzeugt die Bilder dieser README neu (bei laufendem `npx vite preview --port 4173`).

## Grenzen

- Zeiten und Anteile sind Schätzungen; alle Werte sind Erwartungswerte. Wartezeiten durch Überlast werden nicht simuliert, sondern als Engpass gemeldet.
- Bei „Gleichzeitig“ nimmt die Formel den Zweig mit der längsten erwarteten Dauer; die Simulation rechnet hier genau.
- Noch nicht abbildbar: Nachrichten zwischen Organisationen, Fristen und Eskalationen, Unterprozesse.

## Lizenz

Noch nicht festgelegt. bpmn-js steht unter der bpmn.io-Lizenz, die das bpmn.io-Logo im angezeigten Diagramm vorschreibt.
