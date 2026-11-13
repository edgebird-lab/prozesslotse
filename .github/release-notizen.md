Prozesslotse 0.3.0 bringt den Export im offenen Format Beratungsakte v1 und kleine Korrekturen.

## Herunterladen

- **Prozesslotse-Setup.exe**: Installer für Windows 10 und 11 (64 Bit), rund 1,5 MB. Dieselbe Datei liegt auch mit Versionsnummer im Namen bei.
- Installation nur für den angemeldeten Benutzer, ohne Admin-Rechte (nach `%LOCALAPPDATA%\Prozesslotse`). Eine vorhandene Version wird ersetzt; Projekte und Einstellungen bleiben erhalten. Die Microsoft Edge WebView2 Runtime ist unter Windows 11 schon vorhanden; fehlt sie, lädt der Installer sie nach.
- Der Installer ist noch nicht signiert. Windows SmartScreen kann deshalb nachfragen: „Weitere Informationen“ und dann „Trotzdem ausführen“.

## Neu seit 0.2.0

- **Für die Beratungsakte speichern**: Im Bericht schreibt ein Knopf das Ergebnis der Analyse als JSON-Datei im offenen Format Beratungsakte v1: Kennzahlen des Ist-Prozesses, Befunde mit Fundstelle, übernommene Maßnahmen, offene und verworfene Vorschläge mit ihrer Wirkung. Ein Dialog fragt nach Mandant und Mandantennummer und zeigt, was die Datei enthält. Die Datei ist unverschlüsselt.
- **Korrektur Dateiname**: Im Speichern-Dialog des Programms wird die Endung `.beratungsakte.json` nur ergänzt, wenn sie fehlt. Ein Punkt im Namen („Akte 2.0“) bleibt erhalten, aus „x.json“ wird „x.beratungsakte.json“.

## Hinweise

- Verfahrensdokumentation und Verzeichnis sind Vorlagen zur Prüfung durch Steuerberatung bzw. Datenschutzbeauftragten. Keine Rechts- oder Steuerberatung. Rechtsstand 11.11.2026.
- © 2026 Robin Olbricht – olbricht-digital. Alle Rechte vorbehalten. Das Programm darf kostenlos genutzt werden. Fremdbestandteile stehen unter ihren eigenen Lizenzen (siehe README, Abschnitt „Rechte“).
