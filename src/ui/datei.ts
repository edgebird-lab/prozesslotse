/**
 * Dateibefehle der Oberfläche: Neu, Öffnen, Speichern, Speichern unter,
 * BPMN-Export. Im Windows-Programm wird an den Pfad gespeichert und vor dem
 * Verwerfen ungespeicherter Änderungen gefragt; im Browser wird heruntergeladen.
 */
import { useCallback, useEffect, useMemo, useRef, type Dispatch } from 'react'
import { leseDatei } from '../bpmn/einbettung'
import { bpmnFuerExport } from '../bpmn/export'
import { neuerProzess, neuesProjekt } from '../modell/bausteine'
import { alsJson, vergissImBrowser } from '../modell/speicher'
import type { Projekt } from '../modell/typen'
import { plattform, type Datei, type DateiArt } from '../plattform'
import { istGeaendert, type Aktion, type Schritt, type Zustand } from '../zustand'
import { useFrage } from './frage'
import { dateiname } from './hilfen'

export interface FremdesBpmn {
  name: string
  xml: string
}

export interface DateiBefehle {
  /** Fragt bei ungespeicherten Änderungen nach; true heißt: weitermachen. */
  darfVerwerfen: () => Promise<boolean>
  neu: () => Promise<void>
  ladeBeispiel: (projekt: Projekt, schritt: Schritt) => Promise<void>
  /** Öffnen-Dialog des Programms (im Browser übernimmt das Dateifeld). */
  oeffnen: () => Promise<void>
  oeffneDatei: (d: Datei) => Promise<void>
  oeffneZuletzt: (pfad: string) => Promise<void>
  speichern: () => Promise<boolean>
  speichernUnter: () => Promise<boolean>
  exportiereBpmn: (ansicht?: 'ist' | 'soll') => Promise<void>
  exportiere: (name: string, inhalt: string, art: DateiArt) => Promise<void>
  /** Vor dem Schließen des Programms. */
  darfSchliessen: () => Promise<boolean>
}

interface Optionen {
  z: Zustand
  dispatch: Dispatch<Aktion>
  melde: (text: string) => void
  zeigeFremd: (f: FremdesBpmn) => void
}

function fehlertext(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function useDateiBefehle({ z, dispatch, melde, zeigeFremd }: Optionen): DateiBefehle {
  const frage = useFrage()
  // Befehle laufen asynchron (Dialoge); sie brauchen den Stand beim Ausführen, nicht beim Anlegen.
  const aktuell = useRef(z)
  useEffect(() => {
    aktuell.current = z
  }, [z])

  const speichernUnter = useCallback(async (): Promise<boolean> => {
    const zz = aktuell.current
    const vorschlag = zz.dokument.name && !zz.dokument.name.endsWith('.bpmn') ? zz.dokument.name : dateiname(zz.projekt.ist.name, '.prozesslotse')
    try {
      const r = await plattform.speichernUnter(vorschlag, alsJson(zz.projekt), 'projekt')
      if (!r) return false
      dispatch({ typ: 'gespeichert', projekt: zz.projekt, pfad: r.pfad, name: r.name })
      melde(`„${r.name}“ gespeichert.`)
      return true
    } catch (err) {
      melde(`Nicht gespeichert: ${fehlertext(err)}`)
      return false
    }
  }, [dispatch, melde])

  const speichern = useCallback(async (): Promise<boolean> => {
    const zz = aktuell.current
    const { pfad, name } = zz.dokument
    if (!plattform.desktop || !pfad || !name) return speichernUnter()
    try {
      await plattform.speichern(pfad, alsJson(zz.projekt))
      dispatch({ typ: 'gespeichert', projekt: zz.projekt, pfad, name })
      melde(`„${name}“ gespeichert.`)
      return true
    } catch (err) {
      melde(`Nicht gespeichert: ${fehlertext(err)}`)
      return false
    }
  }, [dispatch, melde, speichernUnter])

  /** „weiter“: nichts zu verlieren oder gespeichert; „verworfen“: Änderungen bewusst aufgegeben. */
  const entscheide = useCallback(async (): Promise<'weiter' | 'verworfen' | 'abbrechen'> => {
    const zz = aktuell.current
    if (!istGeaendert(zz)) return 'weiter'
    // Ein leeres neues Projekt geht ohne Rückfrage verloren
    if (!zz.dokument.name && zz.projekt.ist.ablauf.schritte.length === 0 && zz.projekt.soll === null) return 'weiter'
    const name = zz.dokument.name ?? (zz.projekt.ist.name || 'Unbenannter Prozess')
    const wahl = await frage({
      titel: 'Änderungen speichern?',
      text: plattform.desktop
        ? `Die Änderungen an „${name}“ sind noch nicht gespeichert.`
        : `Die Änderungen an „${name}“ sind noch nicht als Datei gespeichert. Ohne Datei gehen sie verloren.`,
      knoepfe: [
        { wert: 'speichern', text: plattform.desktop ? 'Speichern' : 'Als Datei speichern', art: 'haupt' },
        { wert: 'verwerfen', text: 'Nicht speichern', art: 'gefahr' },
        { wert: 'abbrechen', text: 'Abbrechen' },
      ],
      abbrechen: 'abbrechen',
    })
    if (wahl === 'speichern') return (await speichern()) ? 'weiter' : 'abbrechen'
    return wahl === 'verwerfen' ? 'verworfen' : 'abbrechen'
  }, [frage, speichern])

  const darfVerwerfen = useCallback(async () => (await entscheide()) !== 'abbrechen', [entscheide])

  const uebernimm = useCallback(
    (d: Datei) => {
      try {
        const g = leseDatei(d.inhalt)
        if (g.art === 'fremdesBpmn') {
          zeigeFremd({ name: d.name, xml: g.xml })
          melde(`„${d.name}“ enthält kein Prozesslotse-Projekt und wird nur angezeigt.`)
          return
        }
        // Aus einer BPMN-Datei geöffnet: Speichern legt eine neue Projektdatei an, statt das BPMN zu überschreiben.
        const ausBpmn = d.inhalt.trimStart().replace(/^﻿/, '').startsWith('<')
        dispatch({ typ: 'laden', projekt: g.projekt, schritt: 'ablauf', ansicht: g.ansicht, dokument: ausBpmn ? {} : { pfad: d.pfad, name: d.name } })
        melde(`„${d.name}“ geladen.`)
      } catch (err) {
        melde(`Datei nicht geladen: ${fehlertext(err)}`)
      }
    },
    [dispatch, melde, zeigeFremd],
  )

  const oeffneDatei = useCallback(
    async (d: Datei) => {
      if (await darfVerwerfen()) uebernimm(d)
    },
    [darfVerwerfen, uebernimm],
  )

  const oeffnen = useCallback(async () => {
    if (!(await darfVerwerfen())) return
    try {
      const d = await plattform.oeffnen()
      if (d) uebernimm(d)
    } catch (err) {
      melde(`Datei nicht geladen: ${fehlertext(err)}`)
    }
  }, [darfVerwerfen, uebernimm, melde])

  const oeffneZuletzt = useCallback(
    async (pfad: string) => {
      if (!(await darfVerwerfen())) return
      try {
        uebernimm(await plattform.oeffneZuletzt(pfad))
      } catch (err) {
        melde(`Datei nicht geladen: ${fehlertext(err)}`)
      }
    },
    [darfVerwerfen, uebernimm, melde],
  )

  const neu = useCallback(async () => {
    if (await darfVerwerfen()) dispatch({ typ: 'laden', projekt: neuesProjekt(neuerProzess()) })
  }, [darfVerwerfen, dispatch])

  const ladeBeispiel = useCallback(
    async (projekt: Projekt, schritt: Schritt) => {
      if (await darfVerwerfen()) dispatch({ typ: 'laden', projekt, schritt })
    },
    [darfVerwerfen, dispatch],
  )

  const exportiere = useCallback(
    async (name: string, inhalt: string, art: DateiArt) => {
      try {
        const r = await plattform.speichernUnter(name, inhalt, art)
        if (r && plattform.desktop) melde(`„${r.name}“ exportiert.`)
      } catch (err) {
        melde(`Nicht exportiert: ${fehlertext(err)}`)
      }
    },
    [melde],
  )

  const exportiereBpmn = useCallback(
    async (ansicht?: 'ist' | 'soll') => {
      const zz = aktuell.current
      const welche = ansicht ?? zz.ansicht
      const soll = welche === 'soll' && zz.projekt.soll !== null
      // Gibt es Ist und Soll, sagt der Dateiname, welcher Prozess drin ist
      const endung = soll ? '-soll.bpmn' : zz.projekt.soll ? '-ist.bpmn' : '.bpmn'
      await exportiere(dateiname(zz.projekt.ist.name, endung), bpmnFuerExport(zz.projekt, soll ? 'soll' : 'ist'), 'bpmn')
    },
    [exportiere],
  )

  const darfSchliessen = useCallback(async () => {
    const e = await entscheide()
    // „Nicht speichern“: verworfene Änderungen beim nächsten Start nicht wiederherstellen
    if (e === 'verworfen') vergissImBrowser()
    return e !== 'abbrechen'
  }, [entscheide])

  return useMemo(
    () => ({ darfVerwerfen, neu, ladeBeispiel, oeffnen, oeffneDatei, oeffneZuletzt, speichern, speichernUnter, exportiereBpmn, exportiere, darfSchliessen }),
    [darfVerwerfen, neu, ladeBeispiel, oeffnen, oeffneDatei, oeffneZuletzt, speichern, speichernUnter, exportiereBpmn, exportiere, darfSchliessen],
  )
}
