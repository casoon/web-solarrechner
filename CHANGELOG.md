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
- **Hintergrund:** Drei Seiten zur Energieversorgung; Stromversorgung und Stromsystem 2045 stehen in der Navigation, „Energie richtig zählen“ ist von der Stromversorgung und im Fußbereich verlinkt; die Erzeugungsdaten von SMARD und die Länderbilanzen werden mit `node apps/web/scripts/sync-energy-data.mjs` als Snapshot aktualisiert.
- **Stromversorgung:** Neue Seite zeigt den Strommix seit 2015 nach Jahren und Monaten, eine Dunkelflaute-Woche, Netzengpässe, den Stand der Ausbauziele und als Gedankenexperiment den Strompreis je Bundesland aus eigener Erzeugung, wahlweise mit Umweltkosten und mit Endlagerkosten der Kernkraft beim Land oder bei der Allgemeinheit.
- **Energie richtig zählen:** Neue Seite rechnet mit eigenen Annahmen vor, warum Wärmepumpe und Elektroauto fossile Energie nicht 1:1 ersetzen müssen, und nennt die Einwände, bei denen Strom nicht gewinnt.
- **Stromsystem 2045:** Neues Szenario-Spiel rechnet Bedarf, Wind, Sonne, Speicher, Wasserstoff und Reserven für 2030, 2037 oder 2045 Stunde für Stunde mit dem Wetter von 2024 und prüft Versorgungsstandard und Klimaschutzgesetz; Szenarien lassen sich als Link teilen.
- **Rechner:** Unter dem Rechner beantworten „Häufige Fragen“ typische Fragen zu Photovoltaik, Speicher, Balkonkraftwerk, Eigenverbrauch, Miete und Solarspitzengesetz; die Startseite beschreibt den Rechner zusätzlich als kostenlose Web-Anwendung und die Fragen als FAQ in den strukturierten Daten, `llms.txt` verlinkt sie.
- **Einordnung:** Rechenweg und Anbieter-Modelle erklären, wann sich eine eigene Anlage nicht rechnet und Ökostrom die bessere Wahl sein kann, und dass Geräteeigenheiten wie Speicherkühlung vernachlässigt werden; der Festpreis im Modellvergleich ist als möglicher Ökostromtarif gekennzeichnet.

### Changed

- **Navigation:** Rechner, Rechenweg, Stromversorgung, Stromsystem 2045, Anbieter und Über stehen ohne Untermenü in einer Reihe; die aktuelle Seite ist unterstrichen.
- **Rechner:** Vorlagen als kompakte Leiste, mobil als wischbare Reihe; die sechs Schritte klappen auf und zu und zeigen geschlossen ihre wichtigsten Werte. Das Ergebnis nennt Ort, Anlagengröße und Zeitraum, zeigt die Kennzahlen im Raster 3 × 2 und jeden Abschnitt als eigene Karte.
- **Werkzeuge:** Anbieter-Modelle, Stromsystem 2045 und Energie richtig zählen stellen ihre Eingaben als Karte neben das Ergebnis; Vergleichstabelle und Kostenkurve der Anbieter-Modelle laufen über die volle Breite, vier Kennzahlen stehen als 2 × 2.
- **Seiten:** Rechenweg, Stromversorgung und die Projektseite zeigen links eine Leiste „Auf dieser Seite“ mit allen Abschnitten und lesen sich in einer schmalen Spalte; Kennzahlen und Diagramme nutzen die volle Breite. Rechenweg und Projektseite beginnen mit demselben Einstieg wie die übrigen Seiten, der Rechenweg hebt Beispielwerte hervor.
- **Seiten:** Rechner, Anbieter-Modelle, Stromversorgung, Stromsystem 2045 und Energie richtig zählen beginnen mit demselben Einstieg aus Titel, Einleitung, Eckdaten und einem Verweis in die Seite; mobil stehen die Eckdaten unter der Einleitung, statt zu fehlen. Die 404-Seite zeigt nur noch Hinweis und Rückweg, zentriert.
- **Logo:** Neues Symbol zeigt die Sonne als Anteilsring, dessen gelber Bogen für die Eigenversorgung steht; Kopfzeile, Favicon, App-Symbol und Vorschaubild verwenden es.
- **Site-Dateien:** `robots.txt` lässt KI-Such- und Antwortdienste die Seiten lesen und zitieren; Crawler, die nur Trainingsdaten sammeln, bleiben ausgeschlossen.
- **Anbieter-Modelle:** Die Einordnung ist kürzer und in Karten gegliedert; Vereinfachungen und Quellen stehen aufklappbar am Ende.
- **Anbieter-Modelle:** Die Seite beschreibt Konzepte ohne Firmen- oder Markennamen; Quellen, die einzelne Anbieter betreffen, sind entfernt.
- **Anbieter-Modelle:** Das Verbrauchsfeld heißt „Strombedarf im Haushalt“ und ist klar vom Ertrag der Anlage getrennt; ein Hinweis zur Anlagengröße erklärt, warum keine Anlage den ganzen Bedarf deckt.

### Fixed

- **SEO:** Titel und Beschreibungen der Hintergrund-Seiten passen in die Suchergebnisse; `security.txt` nennt eine Policy, die doppelte, nie ausgelieferte Sitemap-Route ist entfernt.
- **Seiten:** Erklärseiten wie Rechenweg und Anbieter-Modelle laufen nicht mehr über die volle Fensterbreite, sondern in einer lesbaren Spalte; die Navigation bricht auf schmalen Bildschirmen um, statt seitlich überzustehen.
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
