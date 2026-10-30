# Changelog

Alle wesentlichen Änderungen an web-solarrechner werden hier dokumentiert.
Das Projekt folgt [Keep a Changelog 1.1](https://keepachangelog.com/de/1.1.0/)
und [Semantic Versioning](https://semver.org/lang/de/). Vor 1.0 kann sich der Funktionsumfang ändern.

## [Unreleased]

### Added

- **Anbieter-Modelle:** Neue Seite vergleicht Kauf beim Fachbetrieb und beim Komplettanbieter, Miete, Dachpacht und Contracting mit Festpreis oder dynamischem Stromtarif, mit eigenen Eingaben und unabhängig von der Anlage im Rechner. Sie zeigt Kosten über die Jahre, den Zins, dem eine Miete entspricht, und ordnet die Konzepte mit Vor- und Nachteilen, Kritik und Quellen ein.
- **SEO:** Strukturierte Daten als ein verknüpfter `@graph` je Seite (Website und Seite) mit daraus erzeugten Open-Graph- und Twitter-Tags; die Projektseite verweist per hreflang auf ihre deutsche und englische Fassung, die 404-Seite ist `noindex`.
- **Site-Dateien:** `/.well-known/security.txt` und `humans.txt`; `llms.txt` nennt jetzt auch Rechenweg, englische Projektseite und Quellcode.
- **Build:** Die Prüfung nach dem Build (`astro-post-audit`) kontrolliert zusätzlich Go-live-Bedingungen (Herkunft von Canonical, Open Graph und Sitemap, kein `noindex`, keine lokalen Adressen), Sprachversionen, Crawl-Budget, Render-Blocking, Datenschutz und den JSON-LD-Graphen.

- **SEO:** Startseite, Projektseite, `llms.txt` und strukturierte Daten beschreiben den Rechner als kostenloses, anbieterneutrales Werkzeug ohne Anmeldung und Paywall mit offengelegtem Rechenweg; der Website-Knoten im JSON-LD-Graphen trägt dafür Beschreibung, freien Zugang und Lizenz, `llms.txt` verlinkt die Anbieter-Modelle.

### Fixed

- **Seiten:** Cloudflare fügt kein Skript zur Bot-Erkennung mehr in die Seiten ein, das die Content Security Policy blockierte und als Fehler in der Browser-Konsole stand. Der Worker liefert die HTML-Seiten dafür selbst komprimiert und als unveränderlich gekennzeichnet aus.

## [0.1.0] - 2026-10-29

### Added

- **Rechner:** Wirtschaftlichkeitsrechnung für Dachanlage und Balkonkraftwerk mit stündlicher Energiebilanz über ein ganzes Jahr, mit und ohne Speicher; jede Eingabe rechnet sofort neu, alles läuft im Browser.
- **Vorlagen:** Zwölf Ausgangssituationen von der Wohnung mit Steckersolar bis zum Haus mit zwei E-Autos und Wärmepumpe, jeweils mit Grafik und Eckdaten.
- **Anlage:** Ort über die GeoNames-Ortssuche, Sonnendaten von PVGIS für Ort, Neigung und Ausrichtung, optional eine zweite Dachfläche; Berliner Profile liegen bei. Kappung am Wechselrichter getrennt von der Abregelung am Exportlimit ausgewiesen.
- **Verbrauch:** Synthetische Lastprofile mit Lastspitzen, E-Auto mit Laden am Abend oder mit PV-Überschuss, Wärmepumpe mit Jahresarbeitszahl.
- **Speicher:** Speichertechnik in drei Stufen nach Labormessungen, Standby, Alterung, Ersatz nach Jahr oder Vollzyklen und ein Vergleich typischer Speichergrößen.
- **Vergütung:** Erlöse nach Inbetriebnahmedatum, für Anlagen ab 2027 wahlweise nach dem EEG-Entwurf mit Übergangsphase und Direktvermarktung, nach fortgeschriebenem EEG oder ohne Erlös; optional ein höherer Netz-Grundpreis.
- **Kosten:** Preisorientierung in drei Stufen mit einzeln wählbaren Zusatzarbeiten für Montage, Zählerschrank und Elektroinstallation, Finanzierung über ein Annuitätendarlehen.
- **Ergebnis:** Vorteil im ersten Betriebsjahr, Amortisation, Kapitalwert, interner Zinsfuß und Eigenversorgung; Diagramme für Energiefluss, Stromkosten, typische Tage, Stromherkunft, Deckung nach Uhrzeit, Amortisation und Strompreis-Szenarien; Monats- und Jahrestabellen.
- **Export:** PDF-Bericht, im Browser erzeugt; Einstellungen als JSON speichern, laden und als Link teilen.
- **Seiten:** Rechenweg Schritt für Schritt an einem Beispiel, Projektseite mit Datenquellen, Annahmen und Grenzen auf Deutsch und Englisch.
