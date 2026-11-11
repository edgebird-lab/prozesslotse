/**
 * Testdaten (Spezifikation 9.1): das Fallbeispiel „Lieferdienst“ mit
 * Compliance-Angaben. Alle Angaben sind erfunden; Firmen und Personen sind
 * Platzhalter. Branche, Geschäftszweck, Gewinnermittlung und Standort sind
 * über 9.1 hinaus ergänzt, damit die Vorführung vollständige Dokumente zeigt;
 * an den Befunden ändern sie nichts.
 */
import { beispielProjekt } from '../modell/beispiel'
import type { Projekt } from '../modell/typen'
import { neueCompliance, standardDatenobjekt, standardSystem } from './standard'
import type { ComplianceProjekt, DatenobjektAngaben, SystemAngaben } from './typen'

function objekt(werte: Partial<DatenobjektAngaben>): DatenobjektAngaben {
  return { ...standardDatenobjekt(), personenbezogen: true, betroffene: ['kunden'], ...werte }
}

function system(werte: Partial<SystemAngaben>): SystemAngaben {
  return { ...standardSystem(), ...werte }
}

export function complianceLieferdienst(): ComplianceProjekt {
  const c = neueCompliance()
  return {
    ...c,
    unternehmen: {
      ...c.unternehmen,
      name: 'Lieferdienst Muster GmbH',
      rechtsform: 'gmbh',
      anschrift: { strasse: 'Musterstraße 1', plz: '12345', ort: 'Musterstadt' },
      telefon: '01234 5678',
      email: 'info@lieferdienst.example',
      branche: 'Lebensmittel-Lieferdienst',
      geschaeftszweck: 'Lieferung von Lebensmitteln an Kunden in der Region',
      gewinnermittlung: 'bilanz',
      geschaeftsleitung: 'Erika Mustermann',
      standorte: ['Musterstadt, Lager und Büro'],
      personenMitDaten: 8,
      steuerberatung: 'Kanzlei Beispiel',
    },
    verarbeitung: { ...c.verarbeitung, zwecke: ['Bestellungen annehmen, ausliefern und abrechnen'] },
    ablageorte: [
      { id: 'dsp_warenwirtschaft', name: 'Warenwirtschaft', mediumId: 'med_erp' },
      { id: 'dsp_ordner', name: 'Ordner Lieferscheine', mediumId: 'med_papier' },
    ],
    unterlagen: [
      { id: 'dob_bestellnotiz', name: 'Bestellnotiz' },
      { id: 'dob_bestellung', name: 'Bestellung' },
      { id: 'dob_lieferschein', name: 'Lieferschein' },
      { id: 'dob_tourenliste', name: 'Tourenliste' },
      { id: 'dob_rechnung', name: 'Ausgangsrechnung' },
    ],
    zugriffe: [
      { aufgabeId: 'auf_annehmen', unterlageId: 'dob_bestellnotiz', richtung: 'schreibt' },
      { aufgabeId: 'auf_erfassen', unterlageId: 'dob_bestellnotiz', richtung: 'liest' },
      { aufgabeId: 'auf_erfassen', unterlageId: 'dob_bestellung', richtung: 'schreibt' },
      { aufgabeId: 'auf_kommissionieren', unterlageId: 'dob_bestellung', richtung: 'liest' },
      { aufgabeId: 'auf_tour', unterlageId: 'dob_bestellung', richtung: 'liest' },
      { aufgabeId: 'auf_rechnung', unterlageId: 'dob_bestellung', richtung: 'liest' },
      { aufgabeId: 'auf_kommissionieren', unterlageId: 'dob_lieferschein', richtung: 'schreibt' },
      { aufgabeId: 'auf_quittieren', unterlageId: 'dob_lieferschein', richtung: 'schreibt' },
      { aufgabeId: 'auf_ausliefern', unterlageId: 'dob_lieferschein', richtung: 'liest' },
      { aufgabeId: 'auf_abgeben', unterlageId: 'dob_lieferschein', richtung: 'liest' },
      { aufgabeId: 'auf_bestaetigen', unterlageId: 'dob_lieferschein', richtung: 'liest' },
      { aufgabeId: 'auf_tour', unterlageId: 'dob_tourenliste', richtung: 'schreibt' },
      { aufgabeId: 'auf_ausliefern', unterlageId: 'dob_tourenliste', richtung: 'liest' },
      { aufgabeId: 'auf_rechnung', unterlageId: 'dob_rechnung', richtung: 'schreibt' },
      { aufgabeId: 'auf_freigeben', unterlageId: 'dob_rechnung', richtung: 'liest' },
      { aufgabeId: 'auf_versenden', unterlageId: 'dob_rechnung', richtung: 'liest' },
    ],
    datenobjekte: {
      dob_bestellnotiz: objekt({ aufbewahrungsart: 'unklar', form: 'papier', richtung: 'intern', datenkategorien: ['kontakt', 'vertrag'], rechtsgrundlagen: ['vertrag'] }),
      dob_bestellung: objekt({
        aufbewahrungsart: 'sonstige',
        form: 'datensatz',
        richtung: 'eingang',
        ablageSpeicherIds: ['dsp_warenwirtschaft'],
        ablageform: 'original',
        datenkategorien: ['kontakt', 'vertrag'],
        rechtsgrundlagen: ['vertrag', 'rechtspflicht'],
      }),
      // Die GmbH ist Kaufmann: Der quittierte Lieferschein wird als möglicher Handelsbrief 6 Jahre aufbewahrt (§ 257 HGB)
      dob_lieferschein: objekt({
        aufbewahrungsart: 'lieferschein',
        form: 'papier',
        richtung: 'ausgang',
        ablageSpeicherIds: ['dsp_ordner'],
        ablageform: 'original',
        aufbewahrungJahre: 6,
        datenkategorien: ['kontakt', 'vertrag'],
        rechtsgrundlagen: ['vertrag'],
      }),
      dob_tourenliste: objekt({ aufbewahrungsart: 'keine', form: 'datensatz', richtung: 'intern', datenkategorien: ['kontakt'], rechtsgrundlagen: ['vertrag'] }),
      dob_rechnung: objekt({
        aufbewahrungsart: 'buchungsbeleg',
        form: 'bild',
        richtung: 'ausgang',
        ablageSpeicherIds: ['dsp_warenwirtschaft'],
        ablageform: 'original',
        datenkategorien: ['kontakt', 'vertrag', 'zahlung'],
        rechtsgrundlagen: ['vertrag', 'rechtspflicht'],
        externeEmpfaenger: [{ id: 'emp_steuerberatung', kategorie: 'Steuerberatung', name: 'Kanzlei Beispiel', standort: 'deutschland', drittland: '', garantie: null }],
      }),
    },
    systeme: {
      med_erp: system({
        hersteller: 'WaWi-Cloud (Beispielanbieter)',
        betrieb: 'cloud',
        dienstleister: 'WaWi-Cloud (Beispielanbieter)',
        standort: 'eu_ewr',
        auftragsverarbeitung: true,
        avVertrag: 'nein',
        unveraenderbarkeit: 'protokolliert',
        sicherung: 'anbieter',
        zugriffsschutz: 'eigenes Konto je Person, Rechte nach Rolle',
        wiederfinden: 'Suche nach Rechnungs-, Bestell- oder Kundennummer',
        datenzugriff: 'Export aller Rechnungen und Buchungsdaten als CSV und PDF; bei Vertragsende Gesamtexport nach Vertrag',
      }),
      // Kaufversion im lokalen Betrieb: kein Dienstleister, Version eindeutig (GoBD Rz. 154)
      med_excel: system({
        hersteller: 'Microsoft',
        version: 'Excel 2024 (Kaufversion)',
        seit: '2025-01-01',
        betrieb: 'lokal',
        sicherung: 'automatisch',
        sicherungIntervall: 'täglich',
        wiederherstellungGetestet: '2026-06-30',
        zugriffsschutz: 'eigenes Windows-Konto, Ordner nur für die Disposition',
      }),
    },
    kontrollen: {
      auf_kontrollieren: { art: 'plausibilitaet', ziel: 'Ware vollständig und richtig', nachweis: 'keiner' },
      auf_freigeben: { art: 'vier_augen', ziel: 'Rechnung sachlich und rechnerisch richtig', nachweis: 'system' },
    },
    einweisung: { turnus: 'jaehrlich', protokoll: true },
    loeschung: { freigabe: 'Erika Mustermann', durchfuehrung: 'Buchhaltung', turnus: 'jaehrlich' },
    toms: {
      pseudonymisierung: { massnahmen: [], nichtZutreffend: 'Keine Auswertungen, die Pseudonyme brauchen' },
      verschluesselung: { massnahmen: ['Webzugriffe und E-Mail-Versand über TLS'], nichtZutreffend: '' },
      vertraulichkeit: { massnahmen: ['Eigenes Benutzerkonto je Person, keine geteilten Passwörter', 'Papierunterlagen in abschließbarem Schrank oder Raum'], nichtZutreffend: '' },
      verfuegbarkeit: { massnahmen: ['Tägliche automatische Datensicherung'], nichtZutreffend: '' },
      wiederherstellung: { massnahmen: ['Rücksicherung mindestens jährlich getestet'], nichtZutreffend: '' },
      ueberpruefung: { massnahmen: [], nichtZutreffend: '' },
    },
  }
}

/** Beispiel „Lieferdienst“ samt Compliance-Angaben; die Kennzahlen bleiben die des Beispiels. */
export function beispielMitCompliance(): Projekt {
  return { ...beispielProjekt(), compliance: complianceLieferdienst() }
}
