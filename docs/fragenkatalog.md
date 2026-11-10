# Fragenkatalog des Assistenten

Der Assistent stellt nur Fragen mit Auswahl, Zahl oder kurzem Text. Aus den Antworten entsteht das Modell aus [datenmodell.md](datenmodell.md); das Diagramm wächst dabei sichtbar mit. Im Lernmodus steht zu jeder Auswahl das BPMN-Symbol mit einer kurzen Erklärung.

## Schritt 1 – Rahmen

| Frage | Antwort | Standard |
| --- | --- | --- |
| Wie heißt der Prozess? | Text | – |
| Was löst ihn aus? | Auswahl: eine Nachricht kommt an · ein Zeitpunkt ist erreicht · eine Bedingung tritt ein · jemand startet ihn von Hand; dazu ein kurzer Text | Nachricht |
| Was ist das Ergebnis, wenn alles normal läuft? | Text, z. B. „Ware zugestellt“ | – |
| Wie viele neue Vorgänge gibt es pro Arbeitstag? | Zahl | 20 |
| Wie viele Stunden hat ein Arbeitstag? | Zahl | 8 |

## Schritt 2 – Beteiligte

**Rollen** – „Wer arbeitet in diesem Prozess mit?“ Je Rolle:

| Frage | Antwort | Standard |
| --- | --- | --- |
| Name der Rolle | Text, z. B. „Innendienst“ | – |
| Was kostet eine Stunde? | Euro, Vollkosten | 45 |
| Wie viele Personen arbeiten in der Rolle? | Zahl, auch 0,5 | 1 |
| Welcher Anteil ihrer Zeit steht für diesen Prozess zur Verfügung? | Prozent | 100 |

**Systeme** – „Womit wird gearbeitet?“ Je System ein Name und eine Art: Papier, Telefon, E-Mail, Tabelle, Fachanwendung, ERP-System, Sonstiges. Papier und Telefon gelten als nicht digital; Aufgaben damit werden als manuelle Aufgabe gezeichnet.

## Schritt 3 – Ablauf

Der Assistent führt eine **Einfügeposition**: Er fragt immer an einer bestimmten Stelle „Was passiert als Nächstes?“ und zeigt, wo diese Stelle liegt (z. B. „im Ausgang ‚Nein‘ von ‚Ware vorrätig?‘, nach ‚Kunden anrufen‘“).

| Antwort | Folgefragen | Danach |
| --- | --- | --- |
| Eine Aufgabe | Name (Objekt + Verb) · Wer? (Rolle) · Womit? (System) · Wie lange dauert die Bearbeitung? · Wie lange liegt der Vorgang vorher? · Braucht dieser Schritt das Ergebnis des vorherigen? (nur wenn es einen gibt) · Werden Daten von Hand übertragen? Wenn ja: aus welchem System, wie viele Minuten davon? · Ist es eine Prüfung oder eine Freigabe? Bei Freigabe: Wie oft wird freigegeben? (Folgt direkt eine Entscheidung, gilt deren Ausgang, und die Frage entfällt.) | weiter hinter der Aufgabe |
| Eine Entscheidung | Wovon hängt ab, wie es weitergeht: von einer Prüfung oder Angabe, oder davon, was zuerst passiert? · Welche Frage wird entschieden bzw. worauf wird gewartet? · Welche Ausgänge gibt es (Bezeichnung, Anteil in %)? Bei „was zuerst passiert“ je Ausgang: Nachricht oder Frist, nach welcher Zeit im Schnitt? · Danach: weiter im Ablauf, Prozess endet (mit welchem Ergebnis?) oder zurück zu einem früheren Schritt (Auswahl aus den Schritten davor) | weiter im ersten Ausgang |
| Mehrere Wege möglich | Worum geht es? · Welche Wege kommen in Frage (Bezeichnung) und wie oft kommt jeder vor, unabhängig von den anderen (Anteil in %)? · Was passiert, wenn keiner zutrifft: eigener Weg (mit Namen) oder trifft immer mindestens einer zu? | weiter im ersten Weg |
| Mehrere Dinge gleichzeitig | Wie viele Zweige? | weiter im ersten Zweig |
| Etwas wird wiederholt | Wozu wird wiederholt: Korrektur oder mehrere Durchgänge? · Welche Frage entscheidet über die Wiederholung? · In wie viel Prozent der Durchläufe wird wiederholt? | weiter im Körper der Wiederholung |
| Warten | Worauf wird gewartet? · Auf einen Zeitpunkt oder auf eine Nachricht? · Wie lange im Schnitt? | weiter hinter dem Warten |
| Dieser Abschnitt ist fertig | – | nächster Ausgang oder Zweig; nach dem letzten hinter den Baustein; im Hauptablauf zu „Prüfen“ |

Zeiten werden als Zahl mit Einheit (Minuten, Stunden, Arbeitstage) eingegeben. Eine Entscheidung beginnt mit „Ja“/„Nein“ zu je 50 %; ein Knopf verteilt die Anteile so, dass sie 100 % ergeben.

Jeder Schritt lässt sich später in der Gliederung auswählen, ändern, verschieben und löschen; Rückgängig und Wiederholen gelten für alle Änderungen.

## Warum diese Fragen

- **Bearbeitungs- und Liegezeit** trennen zeigt, wie viel der Durchlaufzeit tatsächlich gearbeitet wird (Flusseffizienz).
- **„Braucht dieser Schritt das Ergebnis des vorherigen?“** ist die einzige Frage zur Abhängigkeit. Mit ihr findet die Regel „gleichzeitig ausführen“ Schritte, die nicht aufeinander warten müssen.
- **Datenübertragung von Hand** macht Medienbrüche sichtbar und bewertbar.
- **Prüfung und Freigabe** kennzeichnen Kontrollen, die die Regeln „Nacharbeit senken“ und „Freigabe streichen“ betrachten. Prüfungen und Freigaben werden nie mit anderen Schritten zusammengelegt (Vier-Augen-Prinzip).
- **Anteile an Entscheidungen** und der Wiederholungsanteil bestimmen, wie oft jeder Schritt im Schnitt läuft.
- **„Zurück zu …“** bildet Korrekturschleifen ab, etwa: Daten fehlerhaft → Kunde fragen → bei Korrektur zurück zur Erfassung. Angeboten werden nur Schritte davor, und nie aus „Gleichzeitig“ heraus, damit keine Verklemmung entstehen kann.
- **„Was zuerst passiert“** bildet Fälle ab, in denen nicht die Firma entscheidet, sondern ein Ereignis: Antwort des Kunden, Stornierung oder Ablauf einer Frist.
