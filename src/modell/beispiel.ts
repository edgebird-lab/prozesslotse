/**
 * Fallbeispiel: ein Lieferdienst von der telefonischen Bestellung bis zur
 * Rechnung (Order-to-Cash ohne Zahlungseingang). Die Zahlen sind ausgedacht,
 * aber plausibel, und enthalten typische Schwachstellen: Medienbrüche,
 * Liegezeiten, Nacharbeit, eine Freigabe ohne erkennbaren Nutzen und einen
 * Engpass bei der Leitung.
 */
import { neuesProjekt } from './bausteine'
import { FORMAT_VERSION, type Aufgabe, type Projekt, type Prozess } from './typen'

const STD = 60
const TAG = 8 * STD

function aufgabe(id: string, name: string, rolleId: string, mediumId: string, bearbeitungMin: number, liegezeitMin: number, werte: Partial<Aufgabe> = {}): Aufgabe {
  return {
    typ: 'aufgabe',
    id,
    name,
    rolleId,
    mediumId,
    bearbeitungMin,
    liegezeitMin,
    art: 'normal',
    freigabeQuote: 0.9,
    brauchtVorgaenger: true,
    uebertragung: null,
    ...werte,
  }
}

export function beispielLieferdienst(): Prozess {
  return {
    formatVersion: FORMAT_VERSION,
    id: 'pro_lieferdienst',
    name: 'Bestellung bis Rechnung (Lieferdienst)',
    beschreibung:
      'Ein regionaler Lieferdienst nimmt Bestellungen telefonisch an, liefert am Folgetag aus und stellt danach die Rechnung.',
    ausloeser: { art: 'nachricht', text: 'Kunde bestellt telefonisch' },
    ergebnis: 'Ware zugestellt und berechnet',
    vorgaengeProTag: 120,
    arbeitsstundenProTag: 8,
    rollen: [
      { id: 'rol_innendienst', name: 'Innendienst', stundensatz: 38, personen: 4, verfuegbarProzent: 100 },
      { id: 'rol_lager', name: 'Lager', stundensatz: 34, personen: 5, verfuegbarProzent: 100 },
      { id: 'rol_disposition', name: 'Disposition', stundensatz: 45, personen: 1, verfuegbarProzent: 100 },
      { id: 'rol_fahrer', name: 'Fahrer', stundensatz: 32, personen: 6, verfuegbarProzent: 100 },
      { id: 'rol_buchhaltung', name: 'Buchhaltung', stundensatz: 48, personen: 1, verfuegbarProzent: 60 },
      { id: 'rol_leitung', name: 'Niederlassungsleitung', stundensatz: 65, personen: 1, verfuegbarProzent: 25 },
    ],
    medien: [
      { id: 'med_papier', name: 'Papier', art: 'papier' },
      { id: 'med_telefon', name: 'Telefon', art: 'telefon' },
      { id: 'med_excel', name: 'Excel-Tourenliste', art: 'tabelle' },
      { id: 'med_erp', name: 'Warenwirtschaft', art: 'erp' },
    ],
    ablauf: {
      id: 'haupt',
      schritte: [
        aufgabe('auf_annehmen', 'Bestellung telefonisch annehmen', 'rol_innendienst', 'med_papier', 6, 0, { brauchtVorgaenger: null }),
        aufgabe('auf_erfassen', 'Bestellung in Warenwirtschaft erfassen', 'rol_innendienst', 'med_erp', 4, 90, {
          uebertragung: { quelleMediumId: 'med_papier', minuten: 3 },
        }),
        {
          typ: 'entscheidung',
          id: 'ent_vorrat',
          frage: 'Ware vorrätig?',
          zweige: [
            { id: 'zw_vorrat_ja', bezeichnung: 'Ja', anteil: 0.92, ende: null, schritte: [] },
            {
              id: 'zw_vorrat_nein',
              bezeichnung: 'Nein',
              anteil: 0.08,
              ende: null,
              schritte: [
                aufgabe('auf_ersatz', 'Kunden anrufen und Ersatz anbieten', 'rol_innendienst', 'med_telefon', 5, 60),
                {
                  typ: 'entscheidung',
                  id: 'ent_ersatz',
                  frage: 'Ersatz angenommen?',
                  zweige: [
                    {
                      id: 'zw_ersatz_ja',
                      bezeichnung: 'Ja',
                      anteil: 0.7,
                      ende: null,
                      schritte: [aufgabe('auf_aendern', 'Bestellung ändern', 'rol_innendienst', 'med_erp', 3, 0)],
                    },
                    {
                      id: 'zw_ersatz_nein',
                      bezeichnung: 'Nein',
                      anteil: 0.3,
                      ende: 'Bestellung storniert',
                      schritte: [aufgabe('auf_stornieren', 'Bestellung stornieren', 'rol_innendienst', 'med_erp', 2, 0)],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          typ: 'wiederholung',
          id: 'wdh_kommission',
          frage: 'Fehler gefunden?',
          anteilWiederholung: 0.2,
          koerper: {
            id: 'seq_kommission',
            schritte: [
              aufgabe('auf_kommissionieren', 'Ware kommissionieren', 'rol_lager', 'med_papier', 8, 120, { brauchtVorgaenger: null }),
              aufgabe('auf_kontrollieren', 'Kommissionierung kontrollieren', 'rol_lager', 'med_papier', 2, 15, { art: 'pruefung' }),
            ],
          },
        },
        aufgabe('auf_tour', 'Tour planen', 'rol_disposition', 'med_excel', 1.5, 4 * STD, {
          brauchtVorgaenger: false,
          uebertragung: { quelleMediumId: 'med_erp', minuten: 1 },
        }),
        aufgabe('auf_verladen', 'Ware verladen', 'rol_lager', 'med_papier', 3, TAG),
        aufgabe('auf_ausliefern', 'Ware ausliefern', 'rol_fahrer', 'med_papier', 12, 3 * STD),
        {
          typ: 'entscheidung',
          id: 'ent_angetroffen',
          frage: 'Kunde angetroffen?',
          zweige: [
            {
              id: 'zw_angetroffen_ja',
              bezeichnung: 'Ja',
              anteil: 0.9,
              ende: null,
              schritte: [aufgabe('auf_quittieren', 'Empfang quittieren lassen', 'rol_fahrer', 'med_papier', 2, 0)],
            },
            {
              id: 'zw_angetroffen_nein',
              bezeichnung: 'Nein',
              anteil: 0.1,
              ende: null,
              schritte: [
                aufgabe('auf_benachrichtigen', 'Benachrichtigung hinterlassen', 'rol_fahrer', 'med_papier', 1, 0),
                { typ: 'warten', id: 'wrt_termin', name: 'Neuen Liefertermin abwarten', art: 'nachricht', dauerMin: TAG },
                aufgabe('auf_erneut', 'Ware erneut zustellen', 'rol_fahrer', 'med_papier', 12, 2 * STD),
              ],
            },
          ],
        },
        aufgabe('auf_abgeben', 'Lieferscheine abgeben', 'rol_fahrer', 'med_papier', 1, 5 * STD),
        aufgabe('auf_bestaetigen', 'Zustellung im System bestätigen', 'rol_disposition', 'med_erp', 1.5, 4 * STD, {
          uebertragung: { quelleMediumId: 'med_papier', minuten: 1 },
        }),
        aufgabe('auf_rechnung', 'Rechnung erstellen', 'rol_buchhaltung', 'med_erp', 1.5, TAG),
        aufgabe('auf_freigeben', 'Rechnung freigeben', 'rol_leitung', 'med_erp', 1, 2 * TAG, { art: 'freigabe', freigabeQuote: 0.98 }),
        aufgabe('auf_versenden', 'Rechnung versenden', 'rol_buchhaltung', 'med_erp', 0.5, STD),
      ],
    },
  }
}

export function beispielProjekt(): Projekt {
  return neuesProjekt(beispielLieferdienst())
}
