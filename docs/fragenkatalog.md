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

**Externe Beteiligte** – „Mit wem außerhalb wird etwas ausgetauscht?“ Je Beteiligtem ein Name, z. B. Kunde, Lieferant, Bank (Schaltfläche „Kunde hinzufügen“ für den häufigsten Fall). Jeder wird im Diagramm ein eigener Pool. Wer was schickt oder bekommt, fragen danach die Bausteine.

## Schritt 3 – Ablauf

Der Assistent führt eine **Einfügeposition**: Er fragt immer an einer bestimmten Stelle „Was passiert als Nächstes?“ und zeigt, wo diese Stelle liegt (z. B. „im Ausgang ‚Nein‘ von ‚Ware vorrätig?‘, nach ‚Kunden anrufen‘“).

| Antwort | Folgefragen | Danach |
| --- | --- | --- |
| Eine Aufgabe | Name (Objekt + Verb) · Wer? (Rolle) · Womit? (System) · Wie lange dauert die Bearbeitung? · Wie lange liegt der Vorgang vorher? · Braucht dieser Schritt das Ergebnis des vorherigen? (nur wenn es einen gibt) · Werden Daten von Hand übertragen? Wenn ja: aus welchem System, wie viele Minuten davon? · Bei externen Beteiligten: Schickt der Schritt etwas an jemand Externen? Bekommt er etwas von jemand Externem? · Ist es eine Prüfung oder eine Freigabe? Bei Freigabe: Wie oft wird freigegeben? (Folgt direkt eine Entscheidung, gilt deren Ausgang, und die Frage entfällt.) | weiter hinter der Aufgabe |
| Eine Entscheidung | Wovon hängt ab, wie es weitergeht: von einer Prüfung oder Angabe, oder davon, was zuerst passiert? · Welche Frage wird entschieden bzw. worauf wird gewartet? · Welche Ausgänge gibt es (Bezeichnung, Anteil in %)? Bei „was zuerst passiert“ je Ausgang: Nachricht oder Frist, nach welcher Zeit im Schnitt? · Danach: weiter im Ablauf, Prozess endet (mit welchem Ergebnis?) oder zurück zu einem früheren Schritt (Auswahl aus den Schritten davor). Neben gleichzeitig laufenden Schritten (Zweige, ODER-Wege, Stücke zur selben Zeit) heißt das Ende „Prozess endet sofort; was gleichzeitig läuft, wird abgebrochen“, und Rücksprünge werden dort nicht angeboten; im Nebenweg einer Unterbrechung gibt es weder Ende noch Rücksprung | weiter im ersten Ausgang |
| Mehrere Wege möglich | Worum geht es? · Welche Wege kommen in Frage (Bezeichnung) und wie oft kommt jeder vor (Anteil in %)? · Was passiert, wenn keiner zutrifft: eigener Weg (mit Namen) oder trifft immer mindestens einer zu? Im zweiten Fall ergeben die Anteile zusammen mindestens 100 %; die Summe steht unter den Wegen. | weiter im ersten Weg |
| Mehrere Dinge unabhängig voneinander („gleichzeitig, in beliebiger Reihenfolge oder bis eins fertig ist“) | Wann geht es weiter? (wenn alle fertig sind, Vorgabe / sobald eins fertig ist, die anderen werden abgebrochen) · nur bei „alle fertig“: Wer erledigt die Zweige? (zur selben Zeit, Vorgabe / eine Person nacheinander, Reihenfolge egal) · Zweige (zwei, „+ Zweig“). Darunter die Abgrenzung: „Hängt es davon ab, was von außen zuerst passiert (Antwort, Frist)? Dann ist es eine Entscheidung „was zuerst passiert“.“ Bei „weiter beim ersten“ und „in beliebiger Reihenfolge“ nennt das Formular die Bahn des Rahmens; bei „weiter beim ersten“ steht je Zweig, wie oft er laut Rechnung zuerst fertig ist. Titel nach Art: „Gleichzeitig“, „Weiter beim ersten“, „In beliebiger Reihenfolge“ (je mit Zahl der Zweige). | weiter im ersten Zweig („in Zweig 1 von „Weiter beim ersten““); „Abschnitt fertig“ führt in den nächsten Zweig, nach dem letzten dahinter. „Prozess endet“ wird in jedem Zweig angeboten; in Zweigen von „alle fertig“ und „weiter beim ersten“ heißt es „Prozess endet sofort; was gleichzeitig läuft, wird abgebrochen“. Rücksprünge führen nie aus einem Zweig hinaus; in Zweigen von „alle fertig“ und „weiter beim ersten“ bietet das Formular keine an |
| Etwas wird wiederholt | Welche Frage entscheidet über die Wiederholung? · In wie viel Prozent der Durchläufe wird wiederholt? „Wozu wird wiederholt: Korrektur oder mehrere Durchgänge?“ erscheint nur noch bei Wiederholungen, die schon „mehrere Durchgänge“ tragen; sonst verweist ein Satz auf „Etwas für jedes Stück einer Liste“. | weiter im Körper der Wiederholung |
| Etwas für jedes Stück einer Liste | Wofür? (Pflicht, z. B. „Für jede Position“) · Wie viele hat ein einzelner Vorgang im Schnitt? (Zahl, Vorgabe 3; darunter live „Bei 20 Vorgängen am Tag sind das 60 am Tag.“) · Sind es immer etwa gleich viele? (ja, Vorgabe / nein, das schwankt stark) · Wie werden sie erledigt? (eine Person arbeitet sie der Reihe nach ab, Vorgabe / zur selben Zeit: mehrere Leute teilen sich die Liste, oder man wartet auf mehrere Antworten zugleich) · Wie lange liegt der Vorgang, bevor jemand mit dem ersten Stück anfängt? (Vorgabe 0). Das Formular sagt, ob die Aufgabe die Markierung trägt oder in welcher Bahn der Rahmen steht. | weiter je Stück („je Stück in „Für jede Position““); Aufgaben dort fragen „Wartezeit zwischen zwei Stücken“ (der Reihe nach, erster Schritt) bzw. „Wartezeit je Stück“ und zeigen „Liegezeit zählt einmal, Bearbeitung je Stück: 2,5 × 10 Min.“; „Abschnitt fertig“ führt dahinter |
| Warten | Worauf wird gewartet? · Auf einen Zeitpunkt oder auf eine Nachricht? · Wie lange im Schnitt? · Bei Nachricht und externen Beteiligten: Von wem kommt sie? | weiter hinter dem Warten |
| Ein Abschnitt mit Namen | Wie heißt der Abschnitt? (Pflicht, z. B. „Ware versenden“). Das Formular nennt die Bahn, in der der Abschnitt im Diagramm steht. | weiter im Abschnitt („im Abschnitt „Ware versenden““); „Abschnitt fertig“ führt dahinter |
| Dieser Abschnitt ist fertig | – | nächster Ausgang oder Zweig; nach dem letzten hinter den Baustein; im Hauptablauf zu „Prüfen“ |

**Unterbrechungen** – im Formular von Aufgabe, Abschnitt und „für jedes Stück“: „Kann während dieses Schritts etwas dazwischenkommen? (z. B. Kunde storniert, Frist läuft ab)“ mit dem Knopf „+ Unterbrechung“ (an einer Aufgabe höchstens drei). Je Unterbrechung:

| Frage | Antwort | Standard |
| --- | --- | --- |
| Was kommt dazwischen? | Text (Pflicht), z. B. „Kunde storniert“ | – |
| Eine Nachricht oder eine Frist? | Auswahl | Nachricht |
| Von wem? (nur Nachricht) | von innerhalb, ein externer Beteiligter oder „+ Neuer externer Beteiligter …“ | von innerhalb |
| Nach welcher Frist, gerechnet ab Eingang bei <Rolle>? (nur Frist) | Zeit, über 0 (Pflicht) | 1 Arbeitstag |
| Wird die Arbeit daran dann abgebrochen? | Ja / Nein, sie läuft weiter und zusätzlich passiert etwas | Ja |
| Wie oft kommt das vor? bzw. Wie oft wird sie überschritten? (abgebrochen) | Prozent der Ausführungen; darunter live „normal: 90 %“ und, wenn der Schritt öfter läuft, „bei Ø 2 Ausführungen je Vorgang etwa 19 % der Vorgänge“; zusammen höchstens 100 % (Pflicht) | 10 % |
| Wann kommt sie meist? (abgebrochen, Nachricht an einer Aufgabe) | bevor jemand anfängt / während der Arbeit / weiß nicht | während der Arbeit |
| Danach (abgebrochen) | weiter mit dem nächsten Schritt („X“ bleibt unerledigt) · „X“ noch einmal von vorn · zurück zu einem früheren Schritt · Prozess endet (mit welchem Ergebnis?), neben gleichzeitig laufenden Schritten „Prozess endet sofort; was gleichzeitig läuft, wird abgebrochen“; Rücksprünge nicht in nebenläufiger Umgebung | weiter |
| Wie oft im Schnitt je Ausführung? (läuft weiter) | Zahl ≥ 0, auch über 1 | 0,1 |

Nach „Hinzufügen“ einer neuen Aufgabe mit Unterbrechung steht die Einfügeposition im ersten Ausnahmeweg („im Ausnahmeweg „Kunde storniert“ von „Ware kommissionieren““, beim Nebenweg „im Nebenweg …“); „Abschnitt fertig“ führt hinter den Schritt. Bei bestehenden Schritten führt „Schritte nach „…““ in den Weg, „Gilt für die ganze Liste „…““ (nur in „für jedes Stück“) hängt die Unterbrechung an den Baustein, und „Gilt für mehrere Schritte …“ fasst den Schritt bis zu einem gewählten späteren zu einem Abschnitt mit der Unterbrechung zusammen (Fragen: bis einschließlich welchem Schritt? Wie heißt der Abschnitt?). In der Gliederung steht unter dem Schritt je Unterbrechung eine Zeile, z. B. „Kunde storniert · 10 % · bricht ab · danach endet „storniert““ oder „Kunde fragt nach · nebenher · 0,5-mal“, darunter ihr Weg.

Zeiten werden als Zahl mit Einheit (Minuten, Stunden, Arbeitstage) eingegeben. Eine Entscheidung beginnt mit „Ja“/„Nein“ zu je 50 %; ein Knopf verteilt die Anteile so, dass sie 100 % ergeben.

Jeder Schritt lässt sich später in der Gliederung auswählen, ändern, verschieben und löschen; Rückgängig und Wiederholen gelten für alle Änderungen. Bei jedem ausgewählten Schritt fasst „Ab hier zusammenfassen …“ ihn und die folgenden Schritte derselben Folge bis zu einem gewählten zu einem Abschnitt zusammen (Fragen: bis einschließlich welchem Schritt? Wie heißt der Abschnitt?). Angeboten werden nur Bereiche, aus denen kein Rücksprung hinausführt. Im Formular eines Abschnitts stellt „Abschnitt auflösen“ die Schritte zurück in die Folge.

## Schritt 6 – Dokumentieren

Acht Teilschritte sammeln die Angaben für Verfahrensdokumentation und Verzeichnis; die Fragen im Einzelnen stehen in der [Spezifikation, Abschnitt 5.3](compliance-spezifikation.md#53-fragen-je-teilschritt). Jede Antwort ist eine Auswahl, eine Zahl, ein Datum oder ein kurzer Text; Kundendaten werden nicht abgefragt, nur Arten von Daten.

| Teilschritt | Kernfragen |
| --- | --- |
| Unternehmen | Wie heißt das Unternehmen, wer leitet es und gibt die Dokumentation frei? Wie viele Personen arbeiten ständig mit personenbezogenen Daten? Ist ein Datenschutzbeauftragter benannt? |
| Belege und Daten | Wozu werden die Daten verarbeitet? Je Unterlage: Was ist sie (Buchungsbeleg, Geschäftsbrief …)? Wie kommt sie an, wo und in welcher Form wird sie aufbewahrt? Enthält sie Angaben zu Personen, zu wem, welche, warum zulässig, wer bekommt sie? |
| Systeme und Dienstleister | Je System: Hersteller, Version, seit wann? Wo läuft es, wer betreibt es, wo werden die Daten verarbeitet? Gibt es einen Vertrag zur Auftragsverarbeitung? Wie sind Unterlagen vor Änderung geschützt, wie wird gesichert? |
| Aufbewahrung und Löschung | Länger als vorgeschrieben aufbewahren, und warum? Wann werden Daten ohne Aufbewahrungspflicht gelöscht? Wer gibt die Löschung frei, wer führt sie durch, wie oft? |
| Kontrollen | Je Prüfung oder Freigabe: Art, was geprüft wird, Nachweis. Weitere Kontrollen außerhalb des Ablaufs. Wie werden Beteiligte eingewiesen? |
| Schutzmaßnahmen | Je Bereich nach Art. 32 DSGVO: welche Maßnahmen, oder warum trifft er nicht zu? |
| Lücken, Dokumente | keine Fragen: Befunde mit „Beheben“; Vorschau, Export und Freigabe |

## Warum diese Fragen

- **Bearbeitungs- und Liegezeit** trennen zeigt, wie viel der Durchlaufzeit tatsächlich gearbeitet wird (Flusseffizienz).
- **„Braucht dieser Schritt das Ergebnis des vorherigen?“** ist die einzige Frage zur Abhängigkeit. Mit ihr findet die Regel „gleichzeitig ausführen“ Schritte, die nicht aufeinander warten müssen.
- **Datenübertragung von Hand** macht Medienbrüche sichtbar und bewertbar.
- **Prüfung und Freigabe** kennzeichnen Kontrollen, die die Regeln „Nacharbeit senken“ und „Freigabe streichen“ betrachten. Prüfungen und Freigaben werden nie mit anderen Schritten zusammengelegt (Vier-Augen-Prinzip).
- **Anteile an Entscheidungen** und der Wiederholungsanteil bestimmen, wie oft jeder Schritt im Schnitt läuft.
- **„Zurück zu …“** bildet Korrekturschleifen ab, etwa: Daten fehlerhaft → Kunde fragen → bei Korrektur zurück zur Erfassung. Angeboten werden nur Schritte davor, und nie aus „Gleichzeitig“ heraus, damit keine Verklemmung entstehen kann.
- **„Prozess endet sofort“** heißt die Option „Prozess endet“ an Stellen, neben denen noch etwas anderes läuft (ein anderer Zweig, ein anderer Weg, ein anderes Stück): Wer dort „Prozess endet“ wählt, meint meist „alles stoppen“, etwa wenn bei der Prüfung der Unterlagen auffällt, dass der Antrag abgelehnt wird, während die Bonitätsprüfung noch läuft. Der Satz sagt das ausdrücklich, damit niemand ein Ende nur für den eigenen Zweig erwartet; das gibt es nur im Nebenweg, und dort ohne Ergebnis. Der Lernhinweis zeigt das Symbol (Terminierung) und erklärt den Blitz im Rahmen als Ausstieg. Kommt das oft vor, schlägt „Prüfen“ vor, die Prüfung vor die übrige Arbeit zu ziehen.
- **„Was zuerst passiert“** bildet Fälle ab, in denen nicht die Firma entscheidet, sondern ein Ereignis: Antwort des Kunden, Stornierung oder Ablauf einer Frist.
- **„Für jedes Stück einer Liste“** ist in KMU-Abläufen die häufigste Wiederholung: je Position, je Lieferant, je Beleg. Die Liegezeit wird einmal am Baustein gefragt, weil ein Vorgang meist einmal liegt und dann alle Stücke am Stück bearbeitet werden; je Stück zählt nur die Wartezeit dazwischen. „Zur selben Zeit“ ist ausdrücklich für mehrere Leute oder mehrere Antworten gedacht; arbeitet nur eine Person, ist es „der Reihe nach“, und ein Hinweis meldet zu kleine Teams.
- **Umwandlungen** alter Notlösungen bietet „Prüfen“ als Hinweis mit Knopf an: Mengenschleife → „für jedes Stück“ (gleiche Zahlen), „A / B / beides“ → ODER, Rolle „Kunde“ → zu den Beteiligten. Umgebaut wird nur auf Knopfdruck, und wenn dabei Schritte entfallen, erst nach Rückfrage.
- **Unterbrechungen** fragen nicht nach Minuten, sondern nach dem, was Nutzer kennen: bei einer Frist die Frist ab Eingang und wie oft sie überschritten wird, bei einer Nachricht, wann sie meist kommt. Der Anteil gilt je Ausführung; läuft der Schritt öfter, zeigt die Live-Anzeige, was das je Vorgang bedeutet. „Wird die Arbeit abgebrochen?“ trennt die beiden Bedeutungen eines Randereignisses: abbrechen mit „Danach“ oder nebenher mit eigenem Ende, damit nie etwas doppelt in den Ablauf zurückläuft.
- **„Mehrere Dinge unabhängig voneinander“** ist ein Knopf für drei Arten, weil Nutzer zuerst an die Dinge denken und erst danach daran, wie sie erledigt werden. „Wann geht es weiter?“ trennt „alle fertig“ von „weiter beim ersten“; „Wer erledigt die Zweige?“ trennt echte Gleichzeitigkeit von einer Person, die die Zweige in beliebiger Reihenfolge abarbeitet (dann addieren sich die Zeiten). Die Abgrenzung zur Entscheidung „was zuerst passiert“ steht darunter: Dort entscheidet ein Ereignis von außen, hier ist die Arbeit selbst gemeint.
- **Abschnitte** fassen Schritte zusammen, die zusammengehören, etwa für eine Frist über mehrere Schritte („Gilt für mehrere Schritte …“ bei einer Unterbrechung). Endet der Vorgang darin, zeigt das Diagramm den Ausstieg aus dem Rahmen. Weil ein Rahmen in einer Bahn steht, nennt das Formular die Bahn, und die Prüfung weist auf Abschnitte mit mehreren Rollen hin.
