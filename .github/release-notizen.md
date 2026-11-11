Prozesslotse 0.2.0 ist die erste öffentliche Version: Geschäftsprozesse über geführte Fragen modellieren, als BPMN 2.0 zeichnen, mit Kennzahlen prüfen, mit begründeten Vorschlägen verbessern und daraus die Verfahrensdokumentation nach GoBD und das Verzeichnis von Verarbeitungstätigkeiten nach Art. 30 DSGVO erzeugen. Ohne KI, ohne Server, ohne Konto.

## Herunterladen

- **Prozesslotse-Setup.exe**: Installer für Windows 10 und 11 (64 Bit), rund 1,5 MB. Dieselbe Datei liegt auch mit Versionsnummer im Namen bei.
- Installation nur für den angemeldeten Benutzer, ohne Admin-Rechte (nach `%LOCALAPPDATA%\Prozesslotse`). Die Microsoft Edge WebView2 Runtime ist unter Windows 11 schon vorhanden; fehlt sie, lädt der Installer sie nach.
- Der Installer ist noch nicht signiert. Windows SmartScreen kann deshalb nachfragen: „Weitere Informationen“ und dann „Trotzdem ausführen“.

## Neu seit 0.1.0

- **Windows-Programm** (Tauri 2): `.prozesslotse`-Projekte per Doppelklick öffnen, auch im schon laufenden Programm; Speichern unter, „Zuletzt geöffnet“, Rückfrage bei ungespeicherten Änderungen, PDF in A4 ohne Druckdialog; `.bpmn`-Dateien unter „Öffnen mit“, ohne andere Programme zu verdrängen.
- **Mehr Bausteine im Assistenten**: Mehrere Wege (ODER), Abschnitte mit Namen (Teilprozesse), „für jedes Stück einer Liste“ (Mehrfachinstanz), Unterbrechungen durch Nachricht oder Frist (Randereignisse), „weiter beim ersten“, „in beliebiger Reihenfolge“ (Ad-hoc-Teilprozess), Prozessende neben gleichzeitig laufenden Schritten, Rücksprünge und Entscheidungen nach dem, was zuerst passiert.
- **Externe Beteiligte** wie der Kunde als eigene Pools mit Nachrichtenflüssen.
- **Saubere Linienführung**: keine zwei Flüsse auf derselben Strecke oder am selben Anschluss, lange parallele Linien mindestens 20 px auseinander.
- **Kennzahlen**: Engpass nach dem Warteschlangenmodell M/M/c, Durchlaufzeit je Ergebnis, Knock-out-Reihenfolge als sechste Verbesserungsregel.
- **Compliance-Doku**: Verfahrensdokumentation (GoBD) und Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO) aus dem Ist-Prozess, mit Lückenprüfung (44 Regeln mit Quelle und „Beheben“), Freigabe mit Versionen und SHA-256-Prüfsumme, Export als Word-Datei und PDF.
- Projektdateien aus älteren Versionen öffnen sich weiter; sie werden dabei auf das neue Dateiformat umgestellt.

## Hinweise

- Verfahrensdokumentation und Verzeichnis sind Vorlagen zur Prüfung durch Steuerberatung bzw. Datenschutzbeauftragten. Keine Rechts- oder Steuerberatung. Rechtsstand 11.11.2026.
- © 2026 Robin Olbricht – olbricht-digital. Alle Rechte vorbehalten. Das Programm darf kostenlos genutzt werden. Fremdbestandteile stehen unter ihren eigenen Lizenzen (siehe README, Abschnitt „Rechte“).
