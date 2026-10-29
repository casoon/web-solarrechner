# Solarrechner · CASOON

Wirtschaftlichkeitsrechner für Photovoltaik in Deutschland, gebaut als Demonstration von [Chartlet](https://github.com/casoon/chartlet), [Open Grid](https://github.com/casoon/opengrid) und [Lightweight PDF](https://github.com/casoon/lightweight-pdf) mit Astro und Svelte. Der Rechner vergleicht Balkonkraftwerk, reguläre Photovoltaik und dieselbe Anlage mit Speicher. Die Ergebnisse dienen einem überschlägigen Varianten- und Amortisationsvergleich.

Live: [solarrechner.casoon.de](https://solarrechner.casoon.de). [So rechnet der Solarrechner](https://solarrechner.casoon.de/de/rechenweg/) geht den Rechenweg an einem Beispiel durch, die [Projektseite](https://solarrechner.casoon.de/de/about/) nennt Quellen und Grenzen.

## Funktionsumfang

- Zwölf anpassbare Vorlagen: kleiner Steckersolar-Einstieg, angewinkelte Balkonmodule, Steckersolar im Homeoffice, Reihenhaus ohne Akku, tagsüber anwesendes Paar, Bungalow mit Flachdach, vierköpfige Familie, Pendlerauto am Abend, PV-Überschussladen, Familienhaus mit Auto/Wärmepumpe, großes Haus mit zwei Autos/Wärmepumpe und Altbau mit Elektro-Nachrüstung/Kredit. Die Auswahl setzt das Verbrauchs-/Anlagen-/Kostenprofil und die Neigung der Montageart; Standort, Himmelsrichtung, Inbetriebnahme, eigener Strompreis und Lastspitzen-Annahme bleiben erhalten.
- Kostenstufen „Günstig“, „Orientierung“ und „Aufwendig“; automatische Anpassung an Anlagen-/Speichergröße oder bewusste Neuschätzung per Knopfdruck. Eigene Basis-/Speicherpreise deaktivieren die Größenautomatik und werden bei weiteren Größenänderungen erhalten. Zusatzarbeiten mit eigenen Eurobudgets: Montageservice, Gerüst, Schrankanpassung oder neuer Schrank, Überspannungsschutz, SLS, zusätzlicher Stromkreis und Erdung. Ein neuer Komplettschrank bündelt SLS/Überspannungsschutz. Montage-Eigenleistung entfernt nur den gewählten Arbeitslohn, nicht Material oder Elektroprüfung.

- PLZ-/Ortssuche aus lokal ausgelieferten GeoNames-Daten; manuelle Koordinaten, Neigung mit Montage-Voreinstellungen (Balkon: Geländer 90°, angewinkelt 60°, aufgeständert 35°; Dach: Flachdach 15°, Schrägdach 35°), Ausrichtung und Schattenannahme.
- Standortabhängige PVGIS-Erträge: stündliches Wetterjahr 2023, auf langjährige Monatsmittel (SARAH3 2005–2023) normiert. Berlin als sofort verfügbare öffentliche Referenz für 15°, 35°, 60° und 90° Neigung (Süd); andere Orte und Winkel nach bestätigtem Abruf.
- Synthetische Haushaltsprofile mit drei Lastspitzen-Annahmen (gleichmäßig als Obergrenze, typisch, vorsichtig): Ein Teil des Haushaltsverbrauchs fällt als kurze Spitzen an, die PV und Speicher nur bis zu ihrer Leistung decken. Null/ein/zwei Elektroautos mit Abendladen oder PV-Überschussladen (ab 1,4 kW, Rest ab 17 Uhr) und optionale Wärmepumpe. Ein gemeinsamer Zähler; beide Autos verwenden dasselbe Fahr-/Ladeprofil.
- Optionale zweite Dachfläche mit eigener Neigung und Ausrichtung (zum Beispiel Ost-West): beide PVGIS-Profile werden je Stunde nach Modulleistung gewichtet, Kosten und Regeln gelten für die Summe an einem Wechselrichter.
- Stündliche Energie- und Speicherbilanz mit Verlusten, Standby, AC-Leistungsgrenzen und Abregelung. Vereinfachte AC-Kopplung; kein exaktes DC-BKW-Speichermodell.
- Vollständige Kostenblöcke, laufende Kosten, Ersatzgeräte, Alterung, Speicherersatz nach Jahr oder Vollzyklen, Wechselrichterkappung getrennt von der Exportabregelung, Speichermehrnutzen mit Vergleich typischer Speichergrößen, Projekt-Cashflows, Kapitalwert, interner Zinsfuß und Annuitätendarlehen mit Gebühren/Restschuld.
- Einstellungen als JSON speichern, laden und als Link teilen (`src/lib/solar/settings.ts`). Das Format trägt eine Version; fehlende Felder nehmen die aktuellen Standardwerte, unbekannte werden ignoriert, Dateien einer neueren Version abgelehnt. Der Link legt die komprimierten Einstellungen in den Adressanker `#einstellungen=…`, der nie an einen Server geht. Ergebnisse sind nicht Teil der Einstellungen: Beim Laden rechnet der Rechner neu.
- Chartlet-Diagramme: Energiefluss (Sankey), Stromrechnung (Wasserfall), typischer Tag, Stromherkunft pro Monat, Deckungs-Heatmap nach Monat und Uhrzeit, Amortisation und Strompreis-Szenarien. Open-Grid-Monats-/Jahrestabellen sowie lokale PDF-Berichte mit Lightweight PDF 0.3.1. PDF-Berichte halten Ergebnisvergleich, Kosten, Energie-/Finanztabellen, Annahmen und Quellen fest. HTML-Tabellen bleiben bei fehlendem WASM verfügbar.

Das Regelszenario wird nach Inbetriebnahmedatum gewählt. Veröffentlicht sind derzeit die Sätze für 01.08.–31.12.2026 (Prüfstand 29.10.2026). Das bisherige EEG kann ausdrücklich als unbestätigte Fortführung ab 2027 gerechnet werden. Der EEG-2027-Regierungsentwurf (BT-Drs. 21/7867) ist separat und als nicht beschlossen gekennzeichnet: Übergangszahlung zunächst 5,2 ct/kWh, Ende des 36. Folgemonats; Leistungsgrenzen nach Inbetriebnahmejahr und halbjährliche Degression ab August 2027. Danach bzw. optional sofort Direktvermarktung, Bonus für Anlagen unter 25 kW bis Ende des 48. Folgemonats der ersten Direktvermarktung; ab 25 kW vereinfachte Marktprämie aus einem angenommenen jährlichen Marktwert. Preise und fixe/variable Vermarktungsentgelte bleiben veränderbare Annahmen. Das zusätzliche Nullerlös-Szenario ist keine Rechtsprognose.

Im Entwurf gilt das 50-%-Exportlimit dauerhaft; im bisherigen Szenario 60 % bis zur als betriebsbereit angenommenen Mess-/Steuertechnik, dann 100 %. Die stündliche Energiebilanz wird mit dem jeweiligen Limit neu gerechnet. Zusätzliche Einbaukosten werden einmal und laufende Mess-/Steuerkosten ab dem gewählten Betriebsjahr angesetzt; bereits enthaltene Leistungen sind auf 0 zu setzen. Einbau im ersten Jahr ist Teil von Investition und Finanzierung, späterer Einbau Teil des entsprechenden Zahlungsstroms. Marktstart setzt im Modell betriebsbereite Technik voraus; zwischen auslaufendem Übergang und späterer Technik kann unbezahlte Einspeisung entstehen.

Erlösphasen werden kalendarisch über monatliche Ertragsanteile gerechnet, innerhalb des Monats gleichverteilt. Der frei gewählte unbezahlte Exportanteil ist eine Sensitivität, keine gesetzlich feststehende 10-%-Regel. Bei festen Zahlungen greift er ab dem Kalenderjahr nach dem angenommenen Technik-Einbau, im Direktmarkt ab Start. Keine Viertelstunden-Preisabrechnung, keine automatische Förderverlängerung nach § 51a, kein MiSpeL-Netzladen, keine Speicherarbitrage oder bidirektionales Laden. Strompreis-Szenarien verändern nur den Wert des Eigenverbrauchs; Erlösphasen und Nebenkosten bleiben identisch. PDF/JSON enthalten das gewählte Regelprofil und seine Annahmen. Keine Ertrags- oder Amortisationszusage.


## Aufbau

Ein pnpm-Workspace mit einer App, `apps/web` (Astro 7, Svelte 5, Cloudflare Worker).

```
apps/web/
  src/lib/solar/      Rechenmodell, reines TypeScript ohne Browser- oder Server-Abhängigkeit
    model.ts          Lastprofile, stündliche Energiebilanz, Zahlungsströme, Prüfung der Eingaben
    policy.ts         Vergütungsregeln nach Inbetriebnahmedatum (EEG, Entwurf 2027, eigene Annahme)
    presets.ts        Vorlagen, Kostenschätzung, Zusatzarbeiten, Speichergrößen für den Vergleich
    energy-display.ts, result-display.ts
                      Diagramm-Spezifikationen und Tabellenzeilen aus einem Ergebnis
    report.ts         PDF-Bericht
    settings.ts       Einstellungsformat für JSON-Datei und Teilen-Link
  src/components/     Svelte-Rechner (Eingaben, Ergebnis, Diagramme) und Astro-Seiten
  src/pages/          Rechner, Rechenweg, Projektseite (de/en), API-Endpunkt für PVGIS
  config/astro.ts     Astro-Grundeinstellungen (CSP, Post-Audit)
  scripts/            Asset-Sync für Chartlet/Open Grid/PDF, Vorschaubild aus einer echten Rechnung
  public/data/        GeoNames-Orte, mitgelieferte Berliner PVGIS-Profile
e2e/solar.spec.ts     Browsertests gegen den gebauten Worker
```

Ablauf einer Rechnung:

1. **Profil:** Ein PVGIS-Stundenprofil (Ertrag je kWp und Temperatur, 8.760 Stunden) für Ort, Neigung und Ausrichtung. Berlin liegt bei, alles andere holt `/api/solar` nach Bestätigung von PVGIS. Eine zweite Dachfläche wird stundenweise nach Modulleistung gewichtet (`combineSurfaces`).
2. **Bedarf:** `demands` verteilt Haushalt, Wärmepumpe und Autoladen synthetisch auf jede Stunde, mit Wochenend- und Jahreszeitverlauf.
3. **Energiebilanz:** `simulate` gleicht jede Stunde ab: Direktverbrauch (mit kurzen Lastspitzen), Speicher laden und entladen, Einspeisung bis zum Exportlimit, Abregelung, Netzbezug. Ein Vorlauf über dasselbe Jahr verhindert geschenkte Anfangsladung.
4. **Zahlungsströme:** `calculate` rechnet dieselbe Anlage ohne und mit Speicher über den Betrachtungszeitraum, mit Alterung, Preisänderung, Vergütungsphasen, Ersatzgeräten (Speicher nach Jahr oder Vollzyklen), Kredit, Kapitalwert und internem Zinsfuß.
5. **Darstellung:** Die Ergebnisse werden zu Chartlet-Spezifikationen und Open-Grid-Zeilen; Diagramme, Tabellen und PDF entstehen im Browser per WebAssembly.

Das Modell läuft vollständig im Browser und wird bei jeder Eingabe neu gerechnet. `pnpm test:solar` prüft Energieerhaltung, Ladeprofile, Finanzierung, Vergütungsgrenzen, das Einstellungsformat und den PDF-Bericht.

## Lokal arbeiten

```sh
pnpm install --frozen-lockfile
pnpm dev                 # http://localhost:5156
pnpm verify              # Biome, Typen, Unit- und Modelltests, Build
pnpm test:e2e            # Browsertests gegen den gebauten Worker (vorher pnpm build)
```

`pnpm deploy:solar` baut und veröffentlicht den Worker; dafür ist ein Cloudflare-Zugang nötig, das Konto kommt aus `CLOUDFLARE_ACCOUNT_ID` in `apps/web/.env`. Ohne `.env` rechnet der Build mit der Produktions-URL, siehe `.env.example`.

## Daten und Datenschutz

[JRC / PVGIS](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en) der Europäischen Kommission liefert Erzeugungs- und Temperaturdaten; Herkunft und Abrufdatum erscheinen im Rechner und in den Exporten. Der eigene Endpunkt erlaubt nur festgelegte PVGIS-Abfragen und hält einen begrenzten öffentlichen Profilcache.

[GeoNames Postal Codes](https://download.geonames.org/export/zip/readme.txt) unter [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); deutscher Snapshot vom 28.10.2026, dedupliziert und konvertiert. Attribution und Snapshotangaben stehen in `apps/web/public/data/geonames.txt`.

Haushalt, Kosten und Finanzierung werden nur im Browser berechnet und nicht übertragen; kein Konto, keine Analyse-Telemetrie im Anwendungscode. Ort, Neigung und Ausrichtung gehen nur bei einem bestätigten Ertragsabruf an den Server und an PVGIS. Die Cloudflare-Zone kann ein Skript zur Bot-Erkennung einfügen; es gehört nicht zum Anwendungscode.

## Preisorientierung

Die größenabhängige Modellkurve nutzt als Hintergrund die [Angebotsauswertung der Verbraucherzentrale NRW, Stand 28.08.2026](https://www.verbraucherzentrale.nrw/wissen/energie/erneuerbare-energien/was-kostet-eine-photovoltaikanlage-49155). Sie ist kein Live-Marktindex. Glättung, Aufteilung der Grundkosten, −20/+30-%-Preisniveaus und Einzelbudgets sind eigene Schätzannahmen, keine aus der Quelle belegten Quantile oder vollständigen Handwerkerangebote. [Volt Energie](https://volt-e.de/kosten-zaehlerschrank) liefert einen ergänzenden Anbieter-Vergleich für den Schrankumbau. Alle Kosten bleiben veränderbar; Angebote und vorhandene Ausstattung entscheiden über den tatsächlichen Bedarf. JSON-Exporte enthalten Ausgangsvorlage, Preisniveau, Basiskosten und gewählte Zusatzarbeiten zusätzlich zu den wirksamen Gesamtkosten.

## Lizenz

Code unter der [MIT-Lizenz](LICENSE). Die Daten behalten ihre eigenen Bedingungen: GeoNames unter CC BY 4.0, PVGIS-Daten nach den Nutzungsbedingungen der Europäischen Kommission (Quellenangabe erforderlich). Die Schrift Inter (über `@fontsource/inter`) und die im PDF eingebettete Source Sans 3 stehen unter der SIL Open Font License; der Lizenztext für Source Sans 3 liegt in `apps/web/public/licenses/`.
