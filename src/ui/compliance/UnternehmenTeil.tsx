import { useRef, type ChangeEvent } from 'react'
import { leseDatei } from '../../bpmn/einbettung'
import { rollenAngaben } from '../../compliance/ableitung'
import { uebernimmFirmenangaben } from '../../compliance/speicher'
import { GEWINNERMITTLUNGEN, leererKontakt, RECHTSFORMEN } from '../../compliance/standard'
import type { Anschrift, Kontakt, RollenAngaben, Unternehmen, Verarbeitungstaetigkeit } from '../../compliance/typen'
import { Auswahl, Schalter } from '../Eingaben'
import { useBestaetigen } from '../frage'
import { useApp } from '../kontext'
import { useCompliance } from './analyse'
import { CFeld, DatumFeld, JaNeinOffen, KatalogAuswahl, KatalogListe, OptionaleZahl, TextFeld, ZeilenFeld } from './Eingaben'

function KontaktFelder({ kontakt, onAendern, wer }: { kontakt: Kontakt; onAendern: (k: Kontakt, feld: string) => void; wer: string }) {
  const anschrift = (werte: Partial<Anschrift>, feld: string) => onAendern({ ...kontakt, anschrift: { ...kontakt.anschrift, ...werte } }, feld)
  return (
    <div className="eingerueckt felder">
      <TextFeld label={`Name (${wer})`} wert={kontakt.name} onAendern={(name) => onAendern({ ...kontakt, name }, 'name')} />
      <TextFeld label="Straße und Hausnummer" wert={kontakt.anschrift.strasse} onAendern={(strasse) => anschrift({ strasse }, 'strasse')} />
      <div className="feldreihe">
        <TextFeld label="PLZ" wert={kontakt.anschrift.plz} onAendern={(plz) => anschrift({ plz }, 'plz')} />
        <TextFeld label="Ort" wert={kontakt.anschrift.ort} onAendern={(ort) => anschrift({ ort }, 'ort')} />
      </div>
      <div className="feldreihe">
        <TextFeld label="Telefon" typ="tel" wert={kontakt.telefon} onAendern={(telefon) => onAendern({ ...kontakt, telefon }, 'telefon')} />
        <TextFeld label="E-Mail" typ="email" wert={kontakt.email} onAendern={(email) => onAendern({ ...kontakt, email }, 'email')} />
      </div>
    </div>
  )
}

export function UnternehmenTeil() {
  const { c, ist, aendere } = useCompliance()
  const { melde } = useApp()
  const bestaetige = useBestaetigen()
  const datei = useRef<HTMLInputElement>(null)
  const u = c.unternehmen
  const v = c.verarbeitung
  const setze = (werte: Partial<Unternehmen>, feld: string) => aendere((x) => ({ ...x, unternehmen: { ...x.unternehmen, ...werte } }), `unternehmen.${feld}`)
  const setzeAnschrift = (werte: Partial<Anschrift>, feld: string) => aendere((x) => ({ ...x, unternehmen: { ...x.unternehmen, anschrift: { ...x.unternehmen.anschrift, ...werte } } }), `unternehmen.anschrift.${feld}`)
  const setzeV = (werte: Partial<Verarbeitungstaetigkeit>, feld: string) => aendere((x) => ({ ...x, verarbeitung: { ...x.verarbeitung, ...werte } }), `verarbeitung.${feld}`)
  const setzeRolle = (id: string, werte: Partial<RollenAngaben>, feld: string) => aendere((x) => ({ ...x, rollen: { ...x.rollen, [id]: { ...rollenAngaben(x, id), ...werte } } }), `rolle.${id}.${feld}`)

  const uebernehmen = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const gelesen = leseDatei(await f.text())
      const quelle = gelesen.art === 'projekt' ? gelesen.projekt.compliance : undefined
      if (!quelle) return melde(`„${f.name}“ enthält keine Compliance-Angaben.`)
      const ok = await bestaetige(
        'Firmenangaben übernehmen?',
        `Aus „${f.name}“ werden Unternehmen, Schutzmaßnahmen, Einweisung, Löschorganisation und die Begründung längerer Aufbewahrung übernommen. Die bisherigen Angaben dazu werden ersetzt; Unterlagen, Systeme und Versionen bleiben.`,
        'Übernehmen',
      )
      if (!ok) return
      aendere((x) => uebernimmFirmenangaben(x, quelle))
      melde('Firmenangaben übernommen.')
    } catch (err) {
      melde(`Nicht übernommen: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const n = u.personenMitDaten
  return (
    <div className="teil">
      <section aria-labelledby="unternehmen-titel" className="felder">
        <div className="teil-kopf">
          <h3 id="unternehmen-titel">Unternehmen</h3>
          <button type="button" className="knopf knopf-klein" onClick={() => datei.current?.click()}>
            Aus anderer Projektdatei übernehmen …
          </button>
          <input ref={datei} type="file" accept=".prozesslotse,.json,.bpmn" hidden aria-hidden="true" tabIndex={-1} onChange={(e) => void uebernehmen(e)} />
        </div>
        <TextFeld id="ziel-unternehmen-name" label="Wie heißt das Unternehmen?" wert={u.name} onAendern={(name) => setze({ name }, 'name')} />
        <KatalogListe label="Rechtsform" katalog={RECHTSFORMEN} wert={u.rechtsform} onAendern={(rechtsform) => setze({ rechtsform }, 'rechtsform')} />
        <TextFeld id="ziel-unternehmen-anschrift" label="Straße und Hausnummer" wert={u.anschrift.strasse} onAendern={(strasse) => setzeAnschrift({ strasse }, 'strasse')} />
        <div className="feldreihe">
          <TextFeld label="PLZ" wert={u.anschrift.plz} onAendern={(plz) => setzeAnschrift({ plz }, 'plz')} />
          <TextFeld label="Ort" wert={u.anschrift.ort} onAendern={(ort) => setzeAnschrift({ ort }, 'ort')} />
        </div>
        <div className="feldreihe">
          <TextFeld id="ziel-unternehmen-telefon" label="Telefon" typ="tel" wert={u.telefon} onAendern={(telefon) => setze({ telefon }, 'telefon')} />
          <TextFeld label="E-Mail" typ="email" wert={u.email} onAendern={(email) => setze({ email }, 'email')} />
        </div>
        <TextFeld label="Internet" typ="url" wert={u.internet} onAendern={(internet) => setze({ internet }, 'internet')} />
        <div className="feldreihe">
          <TextFeld label="Branche" wert={u.branche} onAendern={(branche) => setze({ branche }, 'branche')} />
          <TextFeld label="Steuerberatung" wert={u.steuerberatung} platzhalter="z. B. Kanzlei Beispiel" onAendern={(steuerberatung) => setze({ steuerberatung }, 'steuerberatung')} />
        </div>
        <TextFeld label="Geschäftszweck" mehrzeilig wert={u.geschaeftszweck} onAendern={(geschaeftszweck) => setze({ geschaeftszweck }, 'zweck')} />
        <KatalogAuswahl label="Wie wird der Gewinn ermittelt?" katalog={GEWINNERMITTLUNGEN} wert={u.gewinnermittlung} spalten={2} onAendern={(gewinnermittlung) => setze({ gewinnermittlung }, 'gewinn')} />
        <TextFeld
          id="ziel-unternehmen-geschaeftsleitung"
          label="Wer leitet das Unternehmen und gibt die Dokumentation frei?"
          wert={u.geschaeftsleitung}
          onAendern={(geschaeftsleitung) => setze({ geschaeftsleitung }, 'leitung')}
        />
        <ZeilenFeld label="An welchen Standorten wird gearbeitet?" werte={u.standorte} onAendern={(standorte) => setze({ standorte }, 'standorte')} />
      </section>

      <section aria-labelledby="rollen-titel" className="felder">
        <h3 id="rollen-titel">Rollen im Ablauf</h3>
        <p className="leise">Gehört eine Rolle zu einer anderen Organisation, etwa eine Kanzlei, die die Buchhaltung erledigt, ist sie extern. Externe Rollen stehen im Verzeichnis bei den externen Empfängern.</p>
        {ist.rollen.length === 0 ? (
          <p className="leer-hinweis">Noch keine Rollen. Rollen legst du im Schritt „Beteiligte“ an.</p>
        ) : (
          <div className="tabelle-wrap">
            <table className="eingabe-tabelle">
              <thead>
                <tr>
                  <th scope="col">Rolle</th>
                  <th scope="col">Extern</th>
                  <th scope="col">Organisation</th>
                </tr>
              </thead>
              <tbody>
                {ist.rollen.map((r) => {
                  const ra = rollenAngaben(c, r.id)
                  const name = r.name.trim() || 'Unbenannte Rolle'
                  return (
                    <tr key={r.id}>
                      <th scope="row">{name}</th>
                      <td>
                        <Schalter an={ra.extern} onAendern={(extern) => setzeRolle(r.id, { extern }, 'extern')}>
                          <span className="sr">{name}: </span>extern
                        </Schalter>
                      </td>
                      <td>
                        {ra.extern ? (
                          <input
                            type="text"
                            autoComplete="off"
                            aria-label={`Organisation von ${name}`}
                            placeholder="z. B. Kanzlei Beispiel"
                            value={ra.organisation}
                            onChange={(e) => setzeRolle(r.id, { organisation: e.target.value }, 'organisation')}
                          />
                        ) : (
                          '–'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="datenschutz-titel" className="felder">
        <h3 id="datenschutz-titel">Datenschutz</h3>
        <CFeld id="ziel-unternehmen-personen" label="Wie viele Personen arbeiten ständig mit personenbezogenen Daten am Computer?">
          {(id) => <OptionaleZahl id={id} wert={n} onAendern={(personenMitDaten) => setze({ personenMitDaten }, 'personen')} />}
        </CFeld>
        {n !== null && (
          <p className="status-zeile" role="status">
            {n >= 20
              ? `Bei ${n} Personen ist nach § 38 Abs. 1 Satz 1 BDSG ein Datenschutzbeauftragter zu benennen.`
              : `Bei ${n} ${n === 1 ? 'Person' : 'Personen'} verlangt § 38 Abs. 1 Satz 1 BDSG keinen Datenschutzbeauftragten.`}
          </p>
        )}
        <p className="feld-hilfe">
          Unabhängig von der Zahl kann einer nötig sein, etwa wenn besonders geschützte Daten zum Kern des Geschäfts gehören (Art. 37 Abs. 1 lit. b, c DSGVO) oder eine
          Datenschutz-Folgenabschätzung nötig ist (§ 38 Abs. 1 Satz 2 BDSG). Das prüft die App nicht.
        </p>
        <div id="ziel-unternehmen-datenschutzbeauftragter" tabIndex={-1}>
          <JaNeinOffen
            label="Ist ein Datenschutzbeauftragter benannt?"
            ohneOffen
            wert={u.datenschutzbeauftragter !== null}
            onAendern={(ja) => setze({ datenschutzbeauftragter: ja ? (u.datenschutzbeauftragter ?? { ...leererKontakt(), extern: false }) : null }, 'dsb')}
          />
        </div>
        {u.datenschutzbeauftragter && (
          <>
            <KontaktFelder wer="Datenschutzbeauftragter" kontakt={u.datenschutzbeauftragter} onAendern={(k, feld) => setze({ datenschutzbeauftragter: { ...k, extern: u.datenschutzbeauftragter!.extern } }, `dsb.${feld}`)} />
            <Auswahl<'intern' | 'extern'>
              label="Intern oder extern?"
              spalten={2}
              wert={u.datenschutzbeauftragter.extern ? 'extern' : 'intern'}
              optionen={[
                { wert: 'intern', text: 'Beschäftigt im Unternehmen' },
                { wert: 'extern', text: 'Externer Dienstleister' },
              ]}
              onAendern={(w) => setze({ datenschutzbeauftragter: { ...u.datenschutzbeauftragter!, extern: w === 'extern' } }, 'dsb.extern')}
            />
          </>
        )}
        <details className="aufklapp">
          <summary>Gemeinsam Verantwortlicher und Vertreter (selten nötig)</summary>
          <Schalter an={u.gemeinsamVerantwortlicher !== null} onAendern={(an) => setze({ gemeinsamVerantwortlicher: an ? leererKontakt() : null }, 'gemeinsam')}>
            Es gibt einen gemeinsam Verantwortlichen (Art. 26 DSGVO)
          </Schalter>
          {u.gemeinsamVerantwortlicher && <KontaktFelder wer="gemeinsam Verantwortlicher" kontakt={u.gemeinsamVerantwortlicher} onAendern={(k, feld) => setze({ gemeinsamVerantwortlicher: k }, `gemeinsam.${feld}`)} />}
          <Schalter an={u.vertreter !== null} onAendern={(an) => setze({ vertreter: an ? leererKontakt() : null }, 'vertreter')}>
            Es gibt einen Vertreter in der EU (Art. 27 DSGVO)
          </Schalter>
          {u.vertreter && <KontaktFelder wer="Vertreter" kontakt={u.vertreter} onAendern={(k, feld) => setze({ vertreter: k }, `vertreter.${feld}`)} />}
        </details>
      </section>

      <section aria-labelledby="verarbeitung-titel" className="felder">
        <h3 id="verarbeitung-titel">Verarbeitungstätigkeit im Verzeichnis</h3>
        <p className="leise">Dieser Prozess ist ein Eintrag im Verzeichnis von Verarbeitungstätigkeiten.</p>
        {/* volle Breite: Der Platzhalter zeigt den Prozessnamen, der bei leerem Feld im Verzeichnis steht */}
        <TextFeld label="Benennung" wert={v.benennung} platzhalter={ist.name || 'Name des Prozesses'} hilfe="Leer: Name des Prozesses" onAendern={(benennung) => setzeV({ benennung }, 'benennung')} />
        <div className="feldreihe">
          <TextFeld label="Laufende Nummer" wert={v.laufendeNummer} onAendern={(laufendeNummer) => setzeV({ laufendeNummer }, 'nummer')} />
          <DatumFeld label="Eingeführt am" wert={v.eingefuehrtAm} onAendern={(eingefuehrtAm) => setzeV({ eingefuehrtAm }, 'eingefuehrt')} />
        </div>
        <div className="feldreihe">
          <TextFeld label="Fachabteilung" wert={v.fachabteilung} onAendern={(fachabteilung) => setzeV({ fachabteilung }, 'abteilung')} />
          <TextFeld label="Ansprechpartner" wert={v.ansprechpartner} onAendern={(ansprechpartner) => setzeV({ ansprechpartner }, 'ansprechpartner')} />
        </div>
        <div className="feldreihe">
          <TextFeld label="Telefon des Ansprechpartners" typ="tel" wert={v.telefon} onAendern={(telefon) => setzeV({ telefon }, 'telefon')} />
          <TextFeld label="E-Mail des Ansprechpartners" typ="email" wert={v.email} onAendern={(email) => setzeV({ email }, 'email')} />
        </div>
      </section>
    </div>
  )
}
