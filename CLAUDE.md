# Prozesslotse – Hinweise für die Arbeit am Projekt

- Portfolio-Projekt von Robin (Wirtschaftsinformatik). Repo `edgebird-lab/prozesslotse` ist **privat**; öffentlich erst nach Robins ausdrücklicher Freigabe.
- Arbeitsplan mit Häkchen: Claude-Doc „Prozesslotse – Arbeitsplan“ (https://claude.ai/artifact/GUoEBaUuu66sU9TdpoaeNJ). Erledigte Schritte dort abhaken, Commits im Protokoll eintragen.
- Sprache: Oberfläche, Fachbegriffe im Code, Doku und Commit-Nachrichten auf Deutsch.
- Fachlogik in `src/modell`, `src/analyse`, `src/bpmn` ohne React und vollständig getestet; Oberfläche in `src/ui`.
- Vor jedem Commit: `npm run lint`, `npm test`, `npm run build`; bei Oberflächenänderungen zusätzlich `npm run e2e` (lokal mit Edge).
- Zahlen in der README zum Fallbeispiel sind durch Tests abgesichert (`src/analyse/regeln.test.ts`); bei Änderungen am Beispiel beide anpassen.
