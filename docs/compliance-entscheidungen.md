# Compliance-Doku: Entscheidungen und Annahmen

Stand 11.11.2026 (ergänzt um die Durchsicht vom 11.11.2026) · gehört zu [`compliance-spezifikation.md`](compliance-spezifikation.md) (Abschnitt 10.2 und Phase 0)

Robin hat die offenen Fragen noch nicht beantwortet. Damit die Umsetzung weitergehen kann, gilt jeweils der Vorschlag der Spezifikation. Jede Zeile ist eine **Annahme, bis Robin entscheidet**; wo eine andere Antwort Arbeit nach sich zieht, steht das dabei.

## Offene Fragen aus 10.2

| Nr. | Frage | Annahme, bis Robin entscheidet | Folge einer anderen Antwort |
| --- | --- | --- | --- |
| 1 | Heißt der neue Schritt „Dokumentieren“ oder „Compliance“? | „Dokumentieren“ | Umbenennen in `SCHRITTE` (`src/zustand.ts`), Überschrift, Browsertests |
| 2 | Fristenpolitik: gesetzliche Mindestfristen oder einheitlich 10 Jahre? | gesetzliche Mindestfristen als Standard; der Knopf „Alle aufbewahrungspflichtigen Unterlagen einheitlich 10 Jahre“ setzt die längere Frist auf Wunsch | Standardwert in `standard.ts`; bei 10 Jahren als Standard wird bei personenbezogenen Daten sofort eine Begründung fällig (D7) |
| 3 | Eine Dokumentation je Prozess oder früh eine Firmenmappe? | je Prozess; Firmenmappe später (2.2) | eigene Spezifikation |
| 4 | Nur Gliederung und Kapitelnamen des Musters übernehmen? | ja, nur Gliederung und Kapitelnamen; alle Texte eigene Formulierungen | keine |
| 7 | Diagramm als Bild in die DOCX-Datei? | nein: DOCX verweist auf die BPMN-Datei, die Druckfassung (PDF) enthält das Diagramm | etwa 1 Arbeitstag |
| 8 | Dokumentation auch für den Soll-Prozess? | nein, immer der Ist-Prozess | Kontext und Generatoren um die Ansicht erweitern |
| 9 | Reicht „Überprüfung fällig“ beim Öffnen? | ja (Regel V3); Benachrichtigung im Windows-Programm später | Tauri-Benachrichtigung |
| 11 | Unterlagen und Ablageorte zunächst nur in den Compliance-Angaben? | ja, eigene Tabellen in `compliance` (4.1); `quelle.ts` ist der einzige Adapter | später Migration ins Prozessmodell |
| 12 | Compliance-Angaben im BPMN-Export standardmäßig mitschicken? | ja (verlustfrei); beim Export gibt es die Wahl „ohne Compliance-Angaben“ für die Weitergabe an Dritte | Standard der Wahl umdrehen |

Die Fragen 5, 6 und 10 (Gegenleser, StBerG/RDG, erster Praxistest) betreffen nicht den Code und bleiben offen.

## Abgleich mit Format 3 (Schritt 0.2)

Stand des Codes beim Start der Erweiterung: Commit `0139e53` auf `main`.

| Baustein aus `docs/modellierung-v3.md` | im Code | Satzbaustein in Kapitel 4 |
| --- | --- | --- |
| Externe Teilnehmer (`teilnehmer`, `nachrichtAn`, `nachrichtVon`, `von`) | ja | ja (Auslöser, Aufgabe, Warten, Ereignis-Entscheidung) |
| ODER-Verzweigung (`oder`, `standard`) | ja | ja |
| Für jede Position (`mehrfach`) | nein | fehlt, beim Zusammenführen ergänzen |
| Teilprozess (`teilprozess`) | nein | fehlt, beim Zusammenführen ergänzen |
| Unterbrechung (`unterbrechungen`) | nein | fehlt, beim Zusammenführen ergänzen |
| Abbruch (`beendetAlles`) | nein | vorbereitet: wird gelesen, falls vorhanden |
| Weiter beim ersten / beliebige Reihenfolge (`zusammenfuehrung`, `ausfuehrung`) | nein | vorbereitet: wird gelesen, falls vorhanden |

Feldnamen in 4.1 stimmen mit dem Code überein. Die Ablaufbeschreibung (`src/compliance/ablauftext.ts`) prüft die Bausteinart erschöpfend: Kommt beim Zusammenführen mit `main` ein neuer Baustein hinzu, meldet TypeScript einen Fehler, statt dass der Baustein im Dokument still fehlt. Die Nummerierung (`nummern`) folgt `durchlaufe` und zählt Aufgaben in neuen Rahmenbausteinen automatisch mit, sobald `kinderSequenzen` sie kennt.

## Technische Annahmen

- **Prüfung beim Laden:** `leseProjekt` ruft `validiereCompliance` auf, wenn `compliance` vorhanden ist. Dafür importiert `src/modell/speicher.ts` aus `src/compliance/speicher.ts` und umgekehrt (`Formatfehler`, `leseProjekt`). Beide nutzen die Importe nur in Funktionen, nicht beim Laden des Moduls; der Kreis ist deshalb unschädlich.
- **Eingefrorene Prozesse:** `validiereCompliance` schickt eine Kopie des Prozesses einer Version durch `leseProjekt` (als Projekt mit nur einem Ist-Prozess). So gilt jede Formatmigration aus `main` automatisch auch für alte Versionen, ohne dass die Migration doppelt geschrieben wird. Der Rohstand in der Version bleibt unverändert, weil die Prüfsumme über ihn gerechnet ist (seit der Nachprüfung vom 11.11.2026, siehe unten).
- **Gliederung:** Sie wird beim Darstellen aus den Überschriften gebildet und nicht im Dokument gespeichert.
- **Kapitel 7:** Die Tabelle hat zusätzlich die Spalte „aufbewahren bis“, weil der Satz darüber auf sie verweist; „freigegeben am“ und „von“ stehen in einer Spalte.
- **Kapitel 4.{n+1}:** Neben den aufbewahrungspflichtigen Unterlagen nennt es auch personenbezogene Unterlagen ohne Aufbewahrungspflicht mit ihrer Löschfrist, weil das Kapitel „Löschung“ im Titel trägt.
- **Teilschritt:** gehört wie Schritt und Ansicht nicht zum Rückgängig-Verlauf.
- **Erprobung von `docx` (0.3):** im Browser und in Node (Tests); im Windows-Programm erst mit Phase 8.

## Auslegungen bei der Umsetzung

Wo die Spezifikation offen war oder ein Detail nicht passte, gilt Folgendes. Auch das sind Annahmen, bis Robin entscheidet.

| Stelle | Auslegung | Grund |
| --- | --- | --- |
| D4, D5, D8 | nur für Unterlagen mit Personenbezug „Ja“ (wie D2, D3, D6, D7) | Die Felder erscheinen nur dann; ausgeblendete Altangaben sollen keine Befunde auslösen. |
| B6 | „alle Ablage-Speicher nicht digital“ verlangt mindestens einen Ablageort mit bekanntem System | Ohne Ablage gilt B3; ein Ablageort ohne System ist nicht „auf Papier“. |
| B6, Ausnahme | ohne erzeugende Aufgabe zählt die Unterlage als nicht aus einem Fakturierungssystem | Nur dann kann die Ausnahme der Rz. 120 greifen; es bleibt ein Hinweis. |
| S1–S6 | nur für digitale Systeme im Einsatz | Für Papier und Telefon gibt es keine Systemfragen (5.3). |
| S3, K2 | eigener Text für „Drittland ohne Garantie“ bzw. Nachweis „Weiß nicht“ | Der Text aus 6.5 passt nur auf „Standort unbekannt“ bzw. „kein Nachweis“. |
| K5 | nur, wenn es interne Rollen mit Aufgaben gibt | Sonst meldete ein leerer Prozess einen Ein-Personen-Betrieb. |
| B9 | ein Befund je Aufgabe, die Unterlagen werden aufgezählt | eindeutiger Schlüssel `compliance:B9:{Aufgabe}` |
| Kapitel 2.6 | die Steuerberatung aus den Unternehmensangaben steht bei den externen Stellen | 5.3 nennt „VD 2.6“ als Verwendung. |
| Kapitel 6 | mit ersetzendem Scannen kommt „Verfahrensdokumentation zum ersetzenden Scannen“ dazu | Kapitel 5 verweist auf Kapitel 6. |
| Verzeichnis B.5 | Zusatz „Ort der Verarbeitung offen bei: …“, wenn ein Standort unbekannt ist | Sonst stünde dort ungeprüft „findet nicht statt“. |
| Deckblatt | Versionszeile als Absatz vor der ersten Überschrift (zählt zum Deckblatt) | Das Dokumentmodell kennt kein eigenes Feld dafür; der Vergleich übergeht das Deckblatt. |
| Druck | Fußzeile als Randfeld der Seite (`@page { @bottom-center }`) statt `position: fixed` | verdeckt keinen Text; mit Edge geprüft: auf jeder Seite, mit „Seite X von Y“ |
| Vorschau „Dokumente“ | ohne Änderung seit der letzten Freigabe zeigt sie die freigegebene Version, sonst den Entwurf | Ein inhaltsgleicher „Entwurf“ nach der Freigabe würde verwirren; Word-Datei und Druck tragen so die Versionsnummer. |
| Belege und Daten | Karten sind eingeklappt; offen sind anfangs die mit Fehlern oder Warnungen, „Beheben“ klappt auf | Mit allen Fragen offen war die Seite beim Beispiel über 10 000 Pixel lang. |
| Teilschritt-Leiste | ohne Nummern, nur Name und Status | Die Namen passen sonst nicht in drei Spalten. |
| Klick ins Diagramm | wählt die Aufgabe aus und filtert; beim Wechsel in „Dokumentieren“ wird eine alte Auswahl gelöscht | Sonst griffe ein Filter aus dem Schritt „Ablauf“ unerwartet. |
| „Verbessern“ | „Weiter“ führt jetzt zu „Dokumentieren“ statt zum Bericht | neue Reihenfolge der Schritte |
| BPMN-Export | Menüpunkt „Als BPMN ohne Compliance-Angaben exportieren“ und Knopf im Teilschritt „Dokumente“; nach dem normalen Export ein Hinweis in der Kopfzeile | keine zusätzliche Rückfrage bei jedem Export (Frage 12) |
| Speicher voll | Meldung in der Kopfzeile bei jeder Änderung, solange das Speichern scheitert | Die bestehende Meldezeile verschwindet nach 6 Sekunden. |
| Dienstleister | zählt nur bei Betrieb „Cloud“ oder „eigener Server“ (`mitDienstleister`); ein ausgeblendeter Name bei „Auf eigenen Geräten“ zählt nicht | wie bei D4, D5, D8: ausgeblendete Altangaben lösen keine Befunde und keinen Dokumenttext aus |
| Gewählte Frist | gilt nur bei aufbewahrungspflichtigen Unterlagen; nach einem Wechsel auf „keine“ oder „unklar“ bleibt die Zahl gespeichert, wird aber nicht mehr gewertet | sonst widersprächen sich Kapitel 2.4 und Verzeichnis B.6 |
| Datumseingaben | übernommen werden nur gültige Daten zwischen 1900 und 2199; Zwischenstände beim Tippen bleiben in der Eingabe | Chromium lässt im Jahresfeld bis zu sechs Ziffern zu |
| Rückgängig | eine Freigabe leert den Rückgängig-Verlauf | Versionen dürfen weder geändert noch gelöscht werden (5.4) |
| Kapitelvergleich | über kanonisches JSON | Eine Datei mit anders sortierten Schlüsseln ist keine fachliche Änderung. |

## Durchsicht vom 11.11.2026

Robin hat die Behebung der 82 bestätigten Funde freigegeben („Arbeite autonom und entscheide so, wie du es mir empfehlen würdest“). Wo ein Fund eine Auslegung brauchte, galt die folgende Entscheidung. Jede Zeile **gilt, bis Robin entscheidet**. Die Funde selbst und wo sie erledigt sind: [`compliance-stand.md`](compliance-stand.md), Abschnitt „Durchsicht vom 11.11.2026“.

### Entschieden für Robin

| Fund | Entscheidung (gilt, bis Robin entscheidet) |
| --- | --- |
| recht-5 | **Entscheidung vom 11.11.2026 (Claude im Auftrag von Robin), Umsetzung durch einen Nachfolger:** Nur Entwürfe tragen „Vorlage – vor Verwendung prüfen lassen“. Freigegebene Fassungen tragen in der Fußzeile Version, Freigabedatum und Seitenzahl, auf dem Deckblatt den Satz „aus einer Vorlage erstellt, Verantwortung für den Inhalt beim Unternehmen, Prüfung durch Steuerberatung bzw. Datenschutz empfohlen“ und optional „fachlich geprüft von … am …“ aus dem Freigabe-Dialog. Bis zur Umsetzung trägt jede Fassung den Vorlagenhinweis wie spezifiziert. |
| abnahme-4 | Der Abstand paralleler Nachrichtenflüsse (zwei Linien 10 px nebeneinander) wird in `main` bei der Linienführung behandelt, nicht auf `compliance`. |
| daten-3 | Die strenge Prüfung beim Laden bleibt. Scheitert nur der Compliance-Teil, fragt die App „Die Compliance-Angaben in „{Datei}“ sind beschädigt ({Feld}: {Fehler}). Nur den Prozess öffnen?“; „Ja“ öffnet den Prozess ohne Compliance-Teil als neues, ungespeichertes Dokument ohne Pfad. Eine Prüfsumme in Großbuchstaben wird still klein geschrieben (einzige stille Korrektur). |
| daten-4, logik-19 | Prüfsummen werden nach dem Laden asynchron nachgerechnet und je Version angezeigt; der eingefrorene Prozess gehört mit in die Prüfsumme (`[prozess, verfahrensdoku, verzeichnis]`). Echte Freigaben gab es noch nicht, ein Übergang ist nicht nötig. |
| daten-5, logik-2, bedienung-4 | „Gültig ab“ darf in der Vergangenheit liegen (bestehende Praxis dokumentieren), muss aber nach dem der letzten wirksamen Version liegen; mehr als 30 Tage nach dem Freigabetag Rückfrage, mehr als ein Jahr Fehler. Die Vorgabe ist immer zulässig. „Freigabe zurückziehen“ für die letzte Version, solange ihr „Gültig ab“ in der Zukunft liegt, mit Pflicht-Begründung; sie bleibt als „zurückgezogen“ sichtbar, Nummern werden nicht wiederverwendet. |
| bedienung-19 | „Inhalt der Änderung“ ab Version 2 leer mit Platzhalter und Pflicht; die geänderten Kapitel stehen ausgeschrieben daneben und in ihrer eigenen Spalte. Version 1 bleibt „Erstfassung“. |
| daten-0, -1, -2, -7, -9, logik-7 | Nie gehen still Daten verloren, und nie gilt ein falscher Stand als gespeichert: Versionen sind über ein Merkmal an das Projekt im Browser gebunden, nicht übernehmbare Rohdaten bleiben bis zur Entscheidung liegen, ein veralteter Stand öffnet als neues Dokument; Datumsfelder beim Laden zwischen 1900 und 2199. |
| abnahme-1 | Anlage 9.1 im Druck: Übersicht auf einer Seite, danach Ausschnitte in lesbarem Maßstab mit 40 px Überlappung und „Ausschnitt n von m“, dazu der Satz, dass die BPMN-Datei das Diagramm in Originalgröße enthält. Flache, breite Diagramme stehen quer; gedreht wird das Bild selbst, damit Browser-Druck und Windows-Programm gleich aussehen. |
| recht-8, recht-17 | DOCX: Tabellen in 9 pt mit Spaltenbreiten nach Inhalt, kein Umbruch mitten in Daten und Prüfsummen; Sprache de-DE. |
| abnahme-3, recht-12, logik-17 | Der Satz zur Wiederholung steht als erste Zeile im Unterkapitel des ersten Schritts der Wiederholung und behauptet nicht, dass bedingte Schritte mindestens einmal laufen. |
| logik-16 | Kapitel 3.3 nennt bei Kontrollen in Zweigen „wenn {Bedingung} (siehe 4.k)“ statt „bei jedem Vorgang“. |
| logik-8, bedienung-18 | K6 bei Einweisung „Keine“: Titel „Keine Einweisung vorgesehen“, Text „Wer im Prozess mitarbeitet, sollte das Verfahren kennen. Wähle „Einmalig vor Beginn“, sobald jemand mitarbeitet.“; im Ein-Personen-Betrieb entfällt K6. Kapitel 2.5 „Eine Einweisung ist nicht vorgesehen.“, der Schalter „schriftlich festgehalten“ ist bei „Keine“ ausgeblendet. |
| recht-4 | Je System mit Ablage zwei Fragen (Wiederfinden, Datenzugriff bei Außenprüfung auch nach Vertragsende oder Systemwechsel), daraus Kapitel 3.5; leere Angaben „offen“ mit Hinweis S8. |
| recht-7 | Bei besonderen Kategorien Auswahl der Ausnahme nach Art. 9 Abs. 2 lit. a bis j (oder „offen“), Ausgabe in B.2 und B.3; ohne Ausnahme warnt D5. Nationale Grundlagen (BDSG) nur als Hinweis „mit dem Datenschutz klären“. |
| logik-18, recht-3 | Zugriffsschutz je System in Kapitel 3.4 (Spalte) und Verzeichnis C.3; mitgeltende Unterlagen mit Name und Ablageort im Teilschritt „Dokumente“. |
| logik-1 | Teilschritt „Unternehmen“, Abschnitt „Rollen im Ablauf“ mit Schalter „extern“ und Feld „Organisation“. |
| recht-0 | Kaufleute (e. K., OHG, KG, GmbH, UG, GmbH & Co. KG, eG oder Gewinnermittlung „Bilanz“): beim Lieferschein ohne Buchungsfunktion „handelsrechtlich ggf. 6 Jahre, falls Handelsbrief (§ 257 HGB); mit Steuerberatung klären“ und Hinweis B11; D7 erst über 6 Jahren. |
| recht-20 | Satz unter der Fristentabelle: gilt nicht für Kredit-, Versicherungs- und Wertpapierinstitute (Art. 97 § 19a Abs. 3 EGAO, § 257 Abs. 4 HGB). |
| recht-19 | Beispiel mit „Excel 2024 (Kaufversion)“ im lokalen Betrieb statt Microsoft 365; damit es bei 7 Befunden bleibt, bewahrt die Beispiel-GmbH den Lieferschein 6 Jahre auf. |
| logik-13 | Die Ausnahme „elektronisch erstellt, auf Papier versandt“ gilt nur für Handels- und Geschäftsbriefe und Buchungsbelege (GoBD Rz. 120); Lieferscheine zählen bei B6 als Handelsbriefe. |
| recht-1 | Neue Regel S7: Aufbewahrungspflichtige Unterlagen bei einem Dienstleister im Drittland brauchen eine Bewilligung des Finanzamts (§ 146 Abs. 2b AO, § 14b Abs. 5 UStG); Feld „Bewilligung des Finanzamts vom“; bei unbekanntem Standort ein Hinweis. EWR-Staaten außerhalb der EU erkennt S7 nicht, weil der Katalog nur „EU oder EWR“ kennt. |
| bedienung-1 | Leere Teilschritte neutral (grauer Kreis, „, noch nichts eingetragen“), Häkchen erst mit Angaben; „, keine offenen Punkte“ statt „, vollständig“; „Lücken“ ohne Versprechen. Neue Warnregel B10 „Keine Unterlagen angelegt“. |
| Regelnummern | Neue Regeln bekommen die nächste freie Nummer ihrer Reihe: B10 und S7 (regeln), B11 und S8 (angaben); zusammen 42 Regeln. |
| bedienung-0, bedienung-2 | „Weiter“ springt an den Anfang des nächsten Teilschritts (Überschrift fokussiert); „Beheben“ bringt die Frage ins Bild und setzt den Fokus auf ihr Feld. |
| bedienung-7 | Kapitelkürzel ausgeschrieben („Verfahrensdokumentation 3.2 und 4; Verzeichnis B.3“), überall mit `kapitelText` aus `dokument.ts`. |
| bedienung-9 | Empfänger-Vorschläge mit Erklärung und ohne Vorschläge, die einer angehakten Betroffenengruppe entsprechen; Hinweis „Wer nur seine eigenen Daten bekommt, etwa der Kunde seine Rechnung, ist kein Empfänger.“ |
| abnahme-5 | Im Bühnenkopf „{n} markiert – zeigen“. |
| abnahme-11 | „Dokumentieren“ samt Lückenprüfung und Generatoren per Lazy-Import nachgeladen; kurz „Dokumentieren wird geladen …“. |

### Annahmen der Pakete

| Paket | Annahme (gilt, bis Robin entscheidet) |
| --- | --- |
| daten | Die Meldung `role="alert"` steht am Feld, ohne `aria-describedby` (der Fokus springt ins Feld). |
| daten | Ist eine Version schon ein Jahr im Voraus freigegeben, gibt es kein zulässiges „Gültig ab“ mehr; der Hinweis rät zum Zurückziehen. |
| daten | Druck und DOCX einer zurückgezogenen Version zeigen das eingefrorene Dokument ohne Rückzugsvermerk; nur das Banner beim Ansehen nennt ihn. |
| daten | Ein Rückzug ändert die Prüfsumme nicht (Metadaten außerhalb des eingefrorenen Inhalts). |
| angaben | Neue Empfänger starten mit Standort „Weiß nicht“ (löst D8 aus, bis gewählt). |
| angaben | Lieferschein mit gewählter Frist: Die Löschfrist nennt § 147 Abs. 3 AO nicht mehr. |
| angaben | Neue Felder sind optional, `COMPLIANCE_VERSION` und `FORMAT_VERSION` bleiben; sind sie vorhanden, prüft `validiereCompliance` sie streng. |
| texte | Stilpunkte aus recht-23, bedienung-22 und recht-11 b/c umgesetzt, obwohl Gegenprüfer sie teils für spezifiziert hielten (billige Satzumbauten). |
| texte | Leerer Firmenname: eigener Satz mit „offen“ statt „[offen: Name des Unternehmens]“; Turnus „Kein fester Turnus“ als „Turnus: kein fester.“; Frist 0 als „bei Entstehung bzw. Eingang“ bzw. „mit Ende des Kalenderjahres der Entstehung“. |
| texte | „Rassische und ethnische Herkunft“ (Wortlaut Art. 9 Abs. 1 DSGVO), auch in D5. |
| texte | „Revisionssicheres Archiv“ heißt im Dokument „Archiv mit Schutz vor Änderung und Löschung“; in der Oberfläche bleibt der Begriff, mit Erklärung. |
| texte | Ältere Dateien ohne `ersetzendesScannen` laden mit „Weiß nicht“. Neue Sätze gegen den Mustertext BStBK/DStV geprüft: keiner teilt 4 Wörter in Folge. |
| regeln | ~~„Besondere Kategorien“, Reiter „Verarbeitungsverzeichnis“, „es“ in den Fragen und „Datenobjekt“ im Lernhinweis bleiben;~~ „heikle Daten“ heißt „besonders geschützte Daten“. Der Rest ist mit der Nachprüfung (bedienung-17, siehe unten) geändert. |
| regeln | Quelle von B10: GoBD Rz. 151, 152; Art. 30 Abs. 1 lit. c DSGVO. |
| regeln | Das Fristende bleibt der letzte Tag der Frist; „Frühestens löschen“ ist Fristende plus ein Tag, bei Aufbewahrung und Löschfrist gleich. |
| druck | Ausschnitte nur, wenn die Übersicht kleiner als Maßstab 0,6 wäre; Ausschnitte im Maßstab 0,6 bis 0,8 (Lieferdienst: 5 Ausschnitte, Schrift 5,75 bis 6,3 pt). |
| druck | Satz zur BPMN-Datei und geschützte Leerzeichen nur bei der Ausgabe (Ansicht, Druck, DOCX), nicht im Dokumenttext: Prüfsumme und Versionsvergleich bleiben unberührt. |
| druck | Word-Silbentrennung nur, wenn ein Wort sonst nicht in seine Spalte passt (trennt dann auch Fließtext). |
| bedienung | Kein Link „Zurück zu den Lücken“; nach „Beheben“ ist die Frage 2,5 s umrandet (`data-sprungziel`). |
| bedienung | Ungültige Zahlen werden nicht gekappt; gespeichert bleibt der letzte gültige Wert, die Meldung steht am Feld. |
| bedienung | ~~Nur der Knopf „{n} markiert – zeigen“ im Bühnenkopf; Unterlagen-Befunde markieren nicht die erzeugende Aufgabe.~~ Ersetzt durch die Nachprüfung (abnahme-5, siehe unten). |
| bedienung | TLS ist im Erklärungssatz erklärt; der Maßnahmentext heißt weiter so (gespeicherte Texte). |

### Beim Zusammenführen entschieden

| Stelle | Auslegung (gilt, bis Robin entscheidet) |
| --- | --- |
| B8 und Kapitel 5 | Beide Pakete gelten: „Vernichtung offen“ und die erfragte eigene Verfahrensdokumentation (texte) sowie der Satz zu Jahresabschlüssen und Eröffnungsbilanz (regeln). In Kapitel 5 steht „Ausgenommen sind Jahresabschlüsse …“ direkt nach „… gilt das ersetzende Scannen“, im Befund vor „Liegt sie vor, wähle …“. |
| Freigabe-Dialog | „Inhalt der Änderung“ bleibt ab Version 2 leer (bedienung-19 aus daten) statt mit „Geändert: …“ vorbelegt (bedienung); die ausgeschriebenen Kapitel stehen darunter. |
| Feld „Benennung“ | volle Breite (druck) mit der Hilfe aus bedienung „Bleibt das Feld leer, steht hier der Name des Prozesses.“ |
| Neue Unterlage | Das Namensfeld behält `id="ziel-datenobjekt"` (Ziel von B10) und bekommt die Meldung am Feld (bedienung). |
| Revisionssicheres Archiv | Katalogeintrag mit Erklärung für die Oberfläche (bedienung) und eigenem Dokumenttext (texte). |
| Speichergrenzen | nach dem Zusammenführen neu gemessen: Version 1 rund 35 000 Zeichen, je Version rund 215 mehr; Browser-Speicher voll bei rund 105 Versionen (Paket daten vor dem Zusammenführen: 115), Projektdatei 20 MiB bei rund 185. |
| Prüfsummen-Meldung | Die Kopfzeile lädt `versionen.ts` erst, wenn Versionen da sind; sonst wäre der Hauptteil 508 statt 463 kB. |
| `hatAngaben` | Rollen im Ablauf (extern oder Organisation) zählen bei „Unternehmen“, mitgeltende Unterlagen bei „Dokumente“, die Antwort zum ersetzenden Scannen bei „Belege und Daten“; Zugriffsschutz, Wiederfinden, Datenzugriff, Bewilligung und Art.-9-Ausnahme zählen schon mit den Angaben ihres Systems bzw. ihrer Unterlage. |
| „Beheben“ | B10 Namensfeld von „Neue Unterlage“, B11 gewählte Frist, S7 Bewilligung bzw. Standort, S8 Wiederfinden bzw. Datenzugriff, D5 ohne Ausnahme deren Auswahl. |

## Nachprüfung vom 11.11.2026

Die Nachbesserung nach der Nachprüfung (Stand und Funde: [`compliance-stand.md`](compliance-stand.md), Abschnitt „Nachprüfung vom 11.11.2026“) hat diese Annahmen getroffen. Jede Zeile **gilt, bis Robin entscheidet**.

| Stelle | Annahme (gilt, bis Robin entscheidet) |
| --- | --- |
| Prüfsumme (regression 1) | Der eingefrorene Prozess wird als Rohstand bewahrt: nachgerechnet wird über den Stand vor jeder Migration, Speichern schreibt ihn unverändert zurück. Anzeige und Vergleich nutzen eine migrierte Kopie (`eingefrorenerProzess`, je Rohstand einmal berechnet). Lässt sich die Kopie nicht bilden (nur bei einer Version aus dieser Sitzung denkbar), zeigt die App den Rohstand. Die strenge Prüfung des eingefrorenen Prozesses beim Laden bleibt. |
| Nachladen (regression 2) | Die Meldung steht im Panel: „„Dokumentieren“ ließ sich nicht laden. Vielleicht ist die Verbindung unterbrochen, oder es gibt inzwischen eine neue Fassung der App. Die anderen Schritte funktionieren weiter.“ „Neu laden“ lädt die ganze Seite, weil React einen gescheiterten Import behält; der Stand kommt aus dem Browser-Speicher (passt er dort nicht mehr hinein, fragt der Browser bei ungespeicherten Änderungen vorher). Die Bühne bleibt dann ohne Markierungen, die Kopfzeile meldet bei fehlenden Versionen nichts („Prüfsumme nicht nachgerechnet“). Die Fehlergrenze gilt nur für „Dokumentieren“, nicht für das ebenfalls nachgeladene Diagramm. |
| V4 (sicht 6) | Eine falsche Prüfsumme ist eine eigene Regel V4 „Prüfsumme stimmt nicht“ (Warnung, Teilschritt „Dokumente“, Quelle GoBD Rz. 154) und zählt in der Regelzahl mit. Sie gilt für jede Version, auch eine zurückgezogene. Text: „Version {x} passt nicht mehr zu ihrer Prüfsumme: Sie wurde außerhalb der App verändert oder ist beschädigt. Öffne eine unveränderte Projektdatei, etwa aus einer Sicherung.“ Weil sich eine beschädigte Version nicht reparieren lässt, bleibt der Befund, bis eine unveränderte Datei geöffnet ist. „Beheben“ springt auf „Version freigeben …“. |
| Rollen im Ablauf (sicht 5) | Spalten 32 % · 4 rem · Rest; „Extern“ steht sichtbar nur im Spaltenkopf, der Schalter heißt für Screenreader weiter „{Rolle}: extern“. |
| bedienung-6 | Statt des kürzeren Texts „Abgezeichnet (Datum, Kürzel)“ stehen „Nachweis“ und „Sichert ab“ in voller Breite untereinander: Der kürzere Text hätte mit dem Pfeil der Auswahl auch nicht ganz gepasst, und der Katalogtext bleibt wie in Dokumenten und Spezifikation. |
| bedienung-17 | Im Formular „Neue Unterlage“ heißt es „In welchem Schritt entsteht die Unterlage?“ und passend „In welchen Schritten wird sie genutzt?“. Die Fragen in der Karte einer Unterlage („Wie kommt es an oder entsteht es?“, „Enthält es Angaben zu Personen?“) bleiben, weil der Kartenkopf die Unterlage nennt. |
| abnahme-5 | Befunde mit Ziel „datenobjekt“ oder „frist“ und ohne eigenen Schritt erscheinen als Hinweis-Abzeichen „Unterlage“ an der ersten Aufgabe, die die Unterlage erstellt, auch wenn der Befund eine Warnung ist (das Problem liegt bei der Unterlage, nicht beim Schritt). Ohne erstellende Aufgabe kein Abzeichen. Der Knopf „{n} markiert – zeigen“ zählt Elemente, nicht Befunde. |
| S9 (logik-9) | Eine Regel S9 „Datum in der Zukunft“ (Hinweis) in der S-Reihe, auch für „Eingeführt am“ der Verarbeitungstätigkeit (dann Teilschritt „Unternehmen“). Geprüft wird nur, was die Oberfläche gerade fragt: „Vertrag vom“ nur bei Vertrag „Ja“, „Bewilligung des Finanzamts vom“ nur bei Aufbewahrung im Drittland. Ein Befund je System nennt alle betroffenen Angaben; „Beheben“ springt auf die erste. Quelle: „Plausibilitätsprüfung der App“, weil keine Vorschrift ein Datum in der Zukunft verbietet. „Heute“ selbst zählt nicht als Zukunft. |
