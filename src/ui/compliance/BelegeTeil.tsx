import { useId, useState, type FocusEvent } from 'react'
import { angaben, ersteller, nutzer, schrittText, type Kontext } from '../../compliance/ableitung'
import { jahrVon } from '../../compliance/datum'
import { aufbewahrungText, beispielBis, wirksameJahre } from '../../compliance/fristen'
import {
  ABLAGEFORMEN,
  AUFBEWAHRUNGSARTEN,
  AUSNAHMEN_ART9,
  BELEGFORMEN,
  BESONDERE_KATEGORIEN,
  BETROFFENE,
  DATENKATEGORIEN,
  GARANTIEN,
  istPflichtig,
  neuerEmpfaenger,
  RECHTSGRUNDLAGEN,
  RICHTUNGEN,
  STANDORTE,
  textVon,
  type Eintrag,
} from '../../compliance/standard'
import type { DatenobjektAngaben, Empfaenger, ErsetzendesScannen } from '../../compliance/typen'
import { benenneUnterlageUm, legeAblageortAn, legeUnterlageAn, loescheUnterlage, setzeZugriffe } from '../../compliance/unterlagen'
import { unterlagenNachEntstehung } from '../../compliance/verfahrensdoku'
import { neueId } from '../../modell/bausteine'
import type { Aufgabe, Id } from '../../modell/typen'
import { Schalter } from '../Eingaben'
import { useBestaetigen } from '../frage'
import { useApp } from '../kontext'
import { Kreuz } from '../Symbol'
import { useAufgabenFilter, useCompliance } from './analyse'
import { CFeld, Chips, DatumFeld, JaNeinOffen, KatalogAuswahl, KatalogListe, TextFeld, ZeilenFeld } from './Eingaben'

function rolleVon(k: Kontext, a: Aufgabe): string {
  return k.p.rollen.find((r) => r.id === a.rolleId)?.name.trim() || 'ohne Rolle'
}

function schritteText(k: Kontext, aufgaben: Aufgabe[]): string {
  return aufgaben.map((a) => `${schrittText(k, a)} (${rolleVon(k, a)})`).join(', ') || '–'
}

/** Aufgaben als Optionen für Chips */
function aufgabenOptionen(k: Kontext): Eintrag<Id>[] {
  return k.aufgaben.map((a) => ({ wert: a.id, text: schrittText(k, a) }))
}

export function FilterHinweis({ k, aufgabe, aufheben, was }: { k: Kontext; aufgabe: Aufgabe; aufheben: () => void; was: string }) {
  return (
    <p className="filter-hinweis" role="status">
      <span>
        {was} von „{schrittText(k, aufgabe)}“
      </span>
      <button type="button" className="knopf knopf-klein" onClick={aufheben}>
        Alle zeigen
      </button>
    </p>
  )
}

export function BelegeTeil() {
  const { c, k, befunde, aendere } = useCompliance()
  const filter = useAufgabenFilter(k)
  // Offen sind anfangs die Karten mit Fehlern oder Warnungen; die übrigen zeigen nur eine Zusammenfassung
  const [offen, setOffen] = useState<ReadonlySet<Id>>(() => new Set(befunde.flatMap((b) => (b.ziel?.art === 'datenobjekt' && b.ziel.id && b.schwere !== 'hinweis' ? [b.ziel.id] : []))))
  const oeffne = (id: Id, an = true) =>
    setOffen((alt) => {
      const neu = new Set(alt)
      if (an) neu.add(id)
      else neu.delete(id)
      return neu
    })
  const alle = unterlagenNachEntstehung(k)
  const gezeigt = filter.aufgabe ? alle.filter((o) => k.sicht.zugriffe.some((z) => z.zielId === o.id && z.aufgabeId === filter.aufgabe!.id)) : alle

  return (
    <div className="teil">
      <section aria-labelledby="zwecke-titel" className="felder">
        <h3 id="zwecke-titel">Zweck der Verarbeitung</h3>
        <ZeilenFeld
          id="ziel-zwecke"
          label="Wozu werden die Daten in diesem Prozess verarbeitet?"
          platzhalter="z. B. Bestellungen annehmen, ausliefern und abrechnen"
          werte={c.verarbeitung.zwecke}
          onAendern={(zwecke) => aendere((x) => ({ ...x, verarbeitung: { ...x.verarbeitung, zwecke } }), 'verarbeitung.zwecke')}
        />
      </section>

      <section aria-labelledby="belege-titel" className="felder">
        <h3 id="belege-titel">Belege und Daten</h3>
        <p className="hinweis-band" role="note">
          Bitte nur Arten von Unterlagen und Daten eintragen, keine echten Kundendaten.
        </p>
        {filter.aufgabe && <FilterHinweis k={k} aufgabe={filter.aufgabe} aufheben={filter.aufheben} was="Unterlagen" />}
        {alle.length === 0 && <p className="leer-hinweis">Noch keine Belege oder Daten. Lege an, welche Unterlagen im Prozess entstehen.</p>}
        {gezeigt.map((o) => (
          <UnterlageKarte key={o.id} id={o.id} name={o.name} offen={offen.has(o.id)} onOffen={(an) => oeffne(o.id, an)} />
        ))}
        <NeueUnterlage onAngelegt={(id) => oeffne(id)} />
      </section>
    </div>
  )
}

function NeueUnterlage({ onAngelegt }: { onAngelegt: (id: Id) => void }) {
  const { k, aendere } = useCompliance()
  const { melde } = useApp()
  const [name, setName] = useState('')
  const [entstehtIn, setEntstehtIn] = useState<Id>('')
  const [genutztIn, setGenutztIn] = useState<Id[]>([])
  const nameId = useId()
  const anlegen = () => {
    const n = name.trim()
    if (!n) return melde('Bitte einen Namen für die Unterlage eingeben.')
    const id = neueId('unt')
    aendere((x) => legeUnterlageAn(x, n, { id, entstehtIn: entstehtIn || null, genutztIn }).compliance)
    onAngelegt(id)
    setName('')
    setEntstehtIn('')
    setGenutztIn([])
    melde(`„${n}“ angelegt.`)
  }
  return (
    <form
      className="karte neue-unterlage felder"
      aria-labelledby={`${nameId}-titel`}
      onSubmit={(e) => {
        e.preventDefault()
        anlegen()
      }}
    >
      <h4 id={`${nameId}-titel`}>Neue Unterlage</h4>
      {/* Ziel von „Beheben“ bei Regel B10 (keine Unterlage angelegt) */}
      <TextFeld id="ziel-datenobjekt" label="Name, z. B. „Ausgangsrechnung“" wert={name} onAendern={setName} />
      <CFeld label="In welchem Schritt entsteht es?">
        {(id) => (
          <select id={id} value={entstehtIn} onChange={(e) => setEntstehtIn(e.target.value)}>
            <option value="">kommt von außen oder noch offen</option>
            {k.aufgaben.map((a) => (
              <option key={a.id} value={a.id}>
                {schrittText(k, a)}
              </option>
            ))}
          </select>
        )}
      </CFeld>
      {k.aufgaben.length > 0 && (
        <details className="aufklapp">
          <summary>In welchen Schritten wird es genutzt?</summary>
          <Chips legende="Genutzt in" optionen={aufgabenOptionen(k)} werte={genutztIn} onAendern={setGenutztIn} />
        </details>
      )}
      <div className="knopfreihe">
        <button type="submit" className="knopf">
          + Unterlage anlegen
        </button>
      </div>
    </form>
  )
}

/** Kurzfassung für eine eingeklappte Karte */
function zusammenfassung(d: DatenobjektAngaben): string {
  const teile = [
    // „offen“ allein sagt nicht, was offen ist; Kapitel 2.4 hat dafür die Spalte „Einordnung“
    d.aufbewahrungsart === 'unklar' ? 'Einordnung offen' : textVon(AUFBEWAHRUNGSARTEN, d.aufbewahrungsart, 'dok'),
    d.form ? textVon(BELEGFORMEN, d.form, 'dok') : 'Form offen',
    d.personenbezogen === true ? 'personenbezogen' : d.personenbezogen === false ? 'ohne Personenbezug' : 'Personenbezug offen',
  ]
  return teile.filter(Boolean).join(' · ')
}

function UnterlageKarte({ id, name, offen, onOffen }: { id: Id; name: string; offen: boolean; onOffen: (an: boolean) => void }) {
  const { c, k, ist, heute, aendere } = useCompliance()
  const bestaetige = useBestaetigen()
  const d = angaben(c, id)
  const titelId = `unterlage-${id}-titel`
  const setze = (werte: Partial<DatenobjektAngaben>, feld: string) =>
    aendere((x) => ({ ...x, datenobjekte: { ...x.datenobjekte, [id]: { ...angaben(x, id), ...werte } } }), `datenobjekt.${id}.${feld}`)
  const erst = ersteller(k, id)
  const nutz = nutzer(k, id)
  const jahre = wirksameJahre(d)
  const koerperId = `unterlage-${id}-angaben`
  // „Beheben“ setzt den Fokus auf die Karte: dann aufklappen
  const fokus = (e: FocusEvent) => {
    if (e.target === e.currentTarget && !offen) onOffen(true)
  }

  return (
    <section className="karte unterlage felder" id={`ziel-datenobjekt-${id}`} tabIndex={-1} aria-labelledby={titelId} onFocus={fokus}>
      <div className="teil-kopf">
        <h4 id={titelId}>{name}</h4>
        <button
          type="button"
          className="knopf-icon"
          aria-label={`Unterlage ${name} entfernen`}
          title="Entfernen"
          onClick={async () => {
            if (await bestaetige('Unterlage entfernen?', `„${name}“ und alle Angaben dazu werden entfernt. Rückgängig ist möglich.`, 'Entfernen')) aendere((x) => loescheUnterlage(x, id))
          }}
        >
          <Kreuz />
        </button>
      </div>
      <p className="leise klein">
        {zusammenfassung(d)} · entsteht in {schritteText(k, erst)} · genutzt in {schritteText(k, nutz)}
      </p>
      <button type="button" className="knopf knopf-klein karte-umschalter" aria-expanded={offen} aria-controls={koerperId} onClick={() => onOffen(!offen)}>
        {offen ? 'Angaben zuklappen' : 'Angaben bearbeiten'}
      </button>
      {offen && (
        <div id={koerperId} className="felder">
          <TextFeld label="Name der Unterlage" wert={name} onAendern={(n) => aendere((x) => benenneUnterlageUm(x, id, n), `unterlage.${id}.name`)} />
          {k.aufgaben.length > 0 && (
            <details className="aufklapp">
              <summary>Schritte zuordnen</summary>
              <Chips legende="Erstellt in" optionen={aufgabenOptionen(k)} werte={erst.map((a) => a.id)} onAendern={(ids) => aendere((x) => setzeZugriffe(x, id, 'schreibt', ids))} />
              <Chips legende="Genutzt in" optionen={aufgabenOptionen(k)} werte={nutz.map((a) => a.id)} onAendern={(ids) => aendere((x) => setzeZugriffe(x, id, 'liest', ids))} />
            </details>
          )}

          <KatalogAuswahl label={`Was ist „${name}“?`} katalog={AUFBEWAHRUNGSARTEN} wert={d.aufbewahrungsart} spalten={2} onAendern={(aufbewahrungsart) => setze({ aufbewahrungsart }, 'art')} />
          <p className="feld-hilfe">
            {istPflichtig(d.aufbewahrungsart)
              ? `Aufbewahrung: ${aufbewahrungText(d)}${jahre !== null ? `; aus ${jahrVon(heute)} also ${beispielBis(d, jahrVon(heute))}` : ''}.`
              : d.aufbewahrungsart === 'keine'
                ? 'Keine steuerliche Aufbewahrungspflicht; andere Gesetze können eigene Fristen vorschreiben. Enthält es Angaben zu Personen, braucht es eine Löschfrist (Teilschritt „Aufbewahrung und Löschung“).'
                : 'Im Zweifel die Steuerberatung fragen.'}
          </p>
          <KatalogAuswahl label="Wie kommt es an oder entsteht es?" katalog={BELEGFORMEN} wert={d.form} spalten={2} onAendern={(form) => setze({ form }, 'form')} />
          <KatalogAuswahl label="Woher kommt es, wohin geht es?" katalog={RICHTUNGEN} wert={d.richtung} spalten={3} onAendern={(richtung) => setze({ richtung }, 'richtung')} />
          <Ablage id={id} d={d} setze={setze} />
          <KatalogAuswahl label="In welcher Form wird es aufbewahrt?" katalog={ABLAGEFORMEN} wert={d.ablageform} spalten={2} onAendern={(ablageform) => setze({ ablageform }, 'ablageform')} />
          {d.form === 'papier' && d.ablageform === 'scan' && (
            <JaNeinOffen label="Wird das Papier nach dem Scannen vernichtet?" wert={d.originalVernichtet} onAendern={(originalVernichtet) => setze({ originalVernichtet }, 'vernichtet')} />
          )}
          {d.form === 'papier' && d.ablageform === 'scan' && d.originalVernichtet === true && <ScanVerfahrensdoku />}

          <JaNeinOffen label="Enthält es Angaben zu Personen?" wert={d.personenbezogen} onAendern={(personenbezogen) => setze({ personenbezogen }, 'personen')} />
          {d.personenbezogen === true && (
            <div className="eingerueckt felder">
              <Chips legende="Wer ist betroffen?" optionen={BETROFFENE} werte={d.betroffene} onAendern={(betroffene) => setze({ betroffene }, 'betroffene')} />
              <Chips legende="Welche Daten?" optionen={DATENKATEGORIEN} werte={d.datenkategorien} onAendern={(datenkategorien) => setze({ datenkategorien }, 'kategorien')} />
              <details className="aufklapp">
                <summary>
                  Besonders geschützte Daten (Art. 9 und 10 DSGVO){d.besondereKategorien.length > 0 || d.strafrechtlich ? ': angegeben' : ''}
                </summary>
                <Chips legende="Besondere Kategorien" optionen={BESONDERE_KATEGORIEN} werte={d.besondereKategorien} onAendern={(besondereKategorien) => setze({ besondereKategorien }, 'besondere')} />
                <Schalter an={d.strafrechtlich} onAendern={(strafrechtlich) => setze({ strafrechtlich }, 'straf')}>
                  Daten über strafrechtliche Verurteilungen und Straftaten
                </Schalter>
              </details>
              <Chips legende="Warum dürfen die Daten verarbeitet werden?" optionen={RECHTSGRUNDLAGEN} werte={d.rechtsgrundlagen} onAendern={(rechtsgrundlagen) => setze({ rechtsgrundlagen }, 'grundlagen')} />
              {d.rechtsgrundlagen.includes('interesse') && (
                <TextFeld label="Welches Interesse?" mehrzeilig wert={d.berechtigtesInteresse} onAendern={(berechtigtesInteresse) => setze({ berechtigtesInteresse }, 'interesse')} />
              )}
              {d.besondereKategorien.length > 0 && (
                <>
                  <KatalogListe label="Welche Ausnahme nach Art. 9 Abs. 2 DSGVO gilt?" katalog={AUSNAHMEN_ART9} wert={d.ausnahmeArt9 ?? null} leer="offen" onAendern={(ausnahmeArt9) => setze({ ausnahmeArt9 }, 'art9')} />
                  <p className="feld-hilfe">
                    Besonders geschützte Daten sind nur mit einer dieser Ausnahmen erlaubt, zusätzlich zur Rechtsgrundlage oben. Ob daneben eine Vorschrift des BDSG gilt, etwa für Daten von Beschäftigten, klärst du mit
                    dem Datenschutzbeauftragten oder einer fachkundigen Person.
                  </p>
                </>
              )}
              <EmpfaengerListe d={d} setze={setze} teilnehmer={ist.teilnehmer.map((t) => t.name.trim()).filter(Boolean)} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** Eine Angabe für alle Unterlagen, die gescannt und danach vernichtet werden; Kapitel 5 und 6 und B8 hängen daran. */
function ScanVerfahrensdoku() {
  const { c, aendere } = useCompliance()
  const s = c.ersetzendesScannen
  const setze = (werte: Partial<ErsetzendesScannen>, feld: string) => aendere((x) => ({ ...x, ersetzendesScannen: { ...x.ersetzendesScannen, ...werte } }), `scannen.${feld}`)
  return (
    <div className="eingerueckt felder">
      <JaNeinOffen label="Gibt es eine eigene Verfahrensdokumentation zum ersetzenden Scannen?" wert={s.verfahrensdoku} onAendern={(verfahrensdoku) => setze({ verfahrensdoku }, 'doku')} />
      {s.verfahrensdoku === true && <DatumFeld label="Stand der Verfahrensdokumentation zum Scannen" wert={s.stand} onAendern={(stand) => setze({ stand }, 'stand')} />}
      <p className="feld-hilfe">Die Antwort gilt für alle Unterlagen, die gescannt und danach vernichtet werden.</p>
    </div>
  )
}

function Ablage({ id, d, setze }: { id: Id; d: DatenobjektAngaben; setze: (w: Partial<DatenobjektAngaben>, feld: string) => void }) {
  const { c, ist, aendere } = useCompliance()
  const [name, setName] = useState('')
  const [medium, setMedium] = useState<Id>('')
  const optionen: Eintrag<Id>[] = c.ablageorte.map((a) => ({ wert: a.id, text: `${a.name.trim() || 'Unbenannter Ablageort'} (${ist.medien.find((m) => m.id === a.mediumId)?.name.trim() || 'ohne System'})` }))
  const anlegen = () => {
    const n = name.trim()
    if (!n) return
    aendere((x) => {
      const { compliance, id: neu } = legeAblageortAn(x, n, medium || null)
      const alt = angaben(compliance, id)
      return { ...compliance, datenobjekte: { ...compliance.datenobjekte, [id]: { ...alt, ablageSpeicherIds: [...alt.ablageSpeicherIds, neu] } } }
    })
    setName('')
    setMedium('')
  }
  return (
    <div className="felder">
      {optionen.length > 0 ? (
        <Chips legende="Wo wird es aufbewahrt?" optionen={optionen} werte={d.ablageSpeicherIds} onAendern={(ablageSpeicherIds) => setze({ ablageSpeicherIds }, 'ablage')} />
      ) : (
        <p className="feld-hilfe">Noch kein Ablageort. Lege unten an, wo aufbewahrt wird, z. B. „Belegarchiv“ im DMS oder „Ordner Rechnungen“ auf Papier.</p>
      )}
      <details className="aufklapp">
        <summary>+ Ablageort</summary>
        <div className="feldreihe">
          <TextFeld label="Name des Ablageorts" platzhalter="z. B. Belegarchiv" wert={name} onAendern={setName} />
          <CFeld label="System">
            {(fid) => (
              <select id={fid} value={medium} onChange={(e) => setMedium(e.target.value)}>
                <option value="">noch offen</option>
                {ist.medien.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name.trim() || 'Unbenanntes System'}
                  </option>
                ))}
              </select>
            )}
          </CFeld>
        </div>
        <button type="button" className="knopf knopf-klein" onClick={anlegen} disabled={!name.trim()}>
          Ablageort anlegen und auswählen
        </button>
      </details>
    </div>
  )
}

function EmpfaengerListe({ d, setze, teilnehmer }: { d: DatenobjektAngaben; setze: (w: Partial<DatenobjektAngaben>, feld: string) => void; teilnehmer: string[] }) {
  const aendereEmpfaenger = (e: Empfaenger, werte: Partial<Empfaenger>, feld: string) =>
    setze({ externeEmpfaenger: d.externeEmpfaenger.map((x) => (x.id === e.id ? { ...x, ...werte } : x)) }, `empfaenger.${e.id}.${feld}`)
  const vorschlaege = teilnehmer.filter((t) => !d.externeEmpfaenger.some((e) => e.kategorie === t))
  return (
    <div className="felder">
      <p className="feld-titel">Wer bekommt die Daten außerhalb des Unternehmens?</p>
      {d.externeEmpfaenger.map((e, i) => (
        <fieldset key={e.id} className="empfaenger eingerueckt">
          <legend>Empfänger {i + 1}</legend>
          <div className="feldreihe">
            <TextFeld label="Kategorie" platzhalter="z. B. Steuerberatung" wert={e.kategorie} onAendern={(kategorie) => aendereEmpfaenger(e, { kategorie }, 'kategorie')} />
            <TextFeld label="Name" platzhalter="z. B. Kanzlei Beispiel" wert={e.name} onAendern={(name) => aendereEmpfaenger(e, { name }, 'name')} />
          </div>
          <KatalogListe label="Wo werden die Daten verarbeitet?" katalog={STANDORTE} wert={e.standort} onAendern={(standort) => standort && aendereEmpfaenger(e, { standort }, 'standort')} />
          {e.standort === 'drittland' && (
            <div className="feldreihe">
              <TextFeld label="Land" wert={e.drittland} onAendern={(drittland) => aendereEmpfaenger(e, { drittland }, 'land')} />
              <KatalogListe label="Garantie" katalog={GARANTIEN} wert={e.garantie} onAendern={(garantie) => aendereEmpfaenger(e, { garantie }, 'garantie')} />
            </div>
          )}
          <button type="button" className="knopf knopf-klein knopf-leise" onClick={() => setze({ externeEmpfaenger: d.externeEmpfaenger.filter((x) => x.id !== e.id) }, 'empfaenger')}>
            Empfänger entfernen
          </button>
        </fieldset>
      ))}
      <div className="knopfreihe">
        <button type="button" className="knopf knopf-klein" onClick={() => setze({ externeEmpfaenger: [...d.externeEmpfaenger, neuerEmpfaenger()] }, 'empfaenger')}>
          + Empfänger
        </button>
        {vorschlaege.map((t) => (
          <button key={t} type="button" className="knopf knopf-klein knopf-leise" onClick={() => setze({ externeEmpfaenger: [...d.externeEmpfaenger, neuerEmpfaenger({ kategorie: t })] }, 'empfaenger')}>
            + {t}
          </button>
        ))}
      </div>
      {vorschlaege.length > 0 && <p className="feld-hilfe">Die betroffene Person selbst, etwa der Kunde bei seinen eigenen Daten, ist kein Empfänger.</p>}
    </div>
  )
}
