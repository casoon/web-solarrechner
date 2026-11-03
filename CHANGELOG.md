# Changelog

Alle wesentlichen Änderungen an web-solarrechner werden hier dokumentiert.
Das Projekt folgt [Keep a Changelog 1.1](https://keepachangelog.com/de/1.1.0/)
und [Semantic Versioning](https://semver.org/lang/de/). Vor 1.0 kann sich der Funktionsumfang ändern.

## [Unreleased]

### Added

- **Rechner:** Gedankenspiel „Geleastes Zweitauto statt Speicher“ rechnet den Speicher ganz heraus und stellt Leasingrate und Nebenkosten (vorbelegt 200 € und 50 € im Monat) dem gegenüber, was der Verzicht auf den Speicher und das immer zu Hause ladende Auto pro Monat einbringen; auch im PDF.
- **Rechner:** Ein Grundpreis (vorbelegt 150 € im Jahr) macht die Stromrechnung mit und ohne Anlage vollständig; Größen- und Ladevergleich zeigen die Stromkosten im ersten Jahr je Variante, mit kurzer Lesehilfe für die Spalten.
- **Rechner:** Beim Laden mit Solarüberschuss zählt ein einmaliger Aufpreis für Wallbox mit Solarsteuerung oder Energiemanager (vorbelegt 800 €) zur Investition, auch in den Ladevarianten des Vergleichs.
- **Rechner:** Neuer Abschnitt „Passt die Anlagengröße?“ vergleicht fünf Modulleistungen derselben Dachausrichtung mit Kosten, Regeln und Einspeiseerlösen je Größe; bei wenig Einspeisevergütung zeigt er, ob eine kleinere Anlage reicht.
- **Rechner:** Für Haushalte mit E-Auto vergleicht „Auto oder Speicher als Puffer?“ Abendladen, Tagesladen nur am Wochenende und ein immer zu Hause stehendes Auto, jeweils ohne und mit Speicher, und nennt den Monatsbetrag, den ein tagsüber ladendes Auto rechnerisch einbringt, etwa als Spielraum für eine Leasingrate.
- **Rechner:** Beim Laden tagsüber lassen sich die Tage pro Woche mit Auto zu Hause und ein Puffer im Autoakku einstellen, der fehlende Ladung auf den nächsten sonnigen Tag warten lässt.
- **Anbieter-Modelle:** Neue Seite vergleicht Kauf beim Fachbetrieb und beim Komplettanbieter, Miete, Dachpacht und Contracting mit Festpreis oder dynamischem Stromtarif, mit eigenen Eingaben und unabhängig von der Anlage im Rechner. Sie zeigt Kosten über die Jahre, den Zins, dem eine Miete entspricht, und ordnet die Konzepte mit Vor- und Nachteilen, Kritik und Quellen ein.
- **SEO:** Strukturierte Daten als ein verknüpfter `@graph` je Seite (Website und Seite) mit daraus erzeugten Open-Graph- und Twitter-Tags; die Projektseite verweist per hreflang auf ihre deutsche und englische Fassung, die 404-Seite ist `noindex`.
- **Site-Dateien:** `/.well-known/security.txt` und `humans.txt`; `llms.txt` nennt jetzt auch Rechenweg, englische Projektseite und Quellcode.
- **Build:** Die Prüfung nach dem Build (`astro-post-audit`) kontrolliert zusätzlich Go-live-Bedingungen (Herkunft von Canonical, Open Graph und Sitemap, kein `noindex`, keine lokalen Adressen), Sprachversionen, Crawl-Budget, Render-Blocking, Datenschutz und den JSON-LD-Graphen.
- **SEO:** Startseite, Projektseite, `llms.txt` und strukturierte Daten beschreiben den Rechner als kostenloses, anbieterneutrales Werkzeug ohne Anmeldung und Paywall mit offengelegtem Rechenweg; der Website-Knoten im JSON-LD-Graphen trägt dafür Beschreibung, freien Zugang und Lizenz, `llms.txt` verlinkt die Anbieter-Modelle.
- **Hintergrund:** Drei Seiten zur Energieversorgung; Stromversorgung und Stromsystem 2045 stehen in der Navigation, „Energie richtig zählen“ ist von der Stromversorgung und im Fußbereich verlinkt; die Erzeugungsdaten von SMARD und die Länderbilanzen werden mit `node apps/web/scripts/sync-energy-data.mjs` als Snapshot aktualisiert.
- **Stromversorgung:** Neue Seite zeigt den Strommix seit 2015 nach Jahren und Monaten, eine Dunkelflaute-Woche, Netzengpässe, den Stand der Ausbauziele und als Gedankenexperiment den Strompreis je Bundesland aus eigener Erzeugung, wahlweise mit Umweltkosten und mit Endlagerkosten der Kernkraft beim Land oder bei der Allgemeinheit.
- **Strompreis:** Neue Seite zeigt, woraus der Haushaltsstrompreis besteht, wie er sich seit 2007 nominal und inflationsbereinigt entwickelt hat, wie stark das Startjahr eine Steigerungsrate prägt und was für die kommenden Jahre beschlossen oder offen ist. Ein Szenario mit Reglern je Bestandteil rechnet den Preis bis 2046 und den Wert des selbst verbrauchten Solarstroms; die Eurostat-Reihe wird mit `node apps/web/scripts/sync-price-data.mjs` aktualisiert.
- **Energie richtig zählen:** Neue Seite rechnet mit eigenen Annahmen vor, warum Wärmepumpe und Elektroauto fossile Energie nicht 1:1 ersetzen müssen, und nennt die Einwände, bei denen Strom nicht gewinnt.
- **Stromsystem 2045:** Neues Szenario-Spiel rechnet Bedarf, Wind, Sonne, Speicher, Wasserstoff und Reserven für 2030, 2037 oder 2045 Stunde für Stunde mit dem Wetter von 2024 und prüft Versorgungsstandard und Klimaschutzgesetz; Szenarien lassen sich als Link teilen.
- **Qualität:** Neue Seite nennt ohne Herstellernamen die Bänder für Module, Wechselrichter und Speicher, zeigt Alterung und Teillastkurven, die Verlustkette und eine Checkliste zur Inbetriebnahme. Ein Vergleich zweier Ausstattungen rechnet stündlich auf dem Berliner Profil, was jede Komponente über die Jahre wert ist und wann sich ein Aufpreis einspielt.
- **Rechner:** Unter dem Rechner beantworten „Häufige Fragen“ typische Fragen zu Photovoltaik, Speicher, Balkonkraftwerk, Eigenverbrauch, Miete und Solarspitzengesetz; die Startseite beschreibt den Rechner zusätzlich als kostenlose Web-Anwendung und die Fragen als FAQ in den strukturierten Daten, `llms.txt` verlinkt sie.
- **Einordnung:** Rechenweg und Anbieter-Modelle erklären, wann sich eine eigene Anlage nicht rechnet und Ökostrom die bessere Wahl sein kann, und dass Geräteeigenheiten wie Speicherkühlung vernachlässigt werden; der Festpreis im Modellvergleich ist als möglicher Ökostromtarif gekennzeichnet.

### Changed

- **Export:** Das PDF erklärt sich selbst: neue Seite mit Größen- und Ladevergleich und kurzen Begriffserklärungen, ausgeschriebene Spalten in der Monatsbilanz, Autarkiegrad und Eigenverbrauchsquote nebeneinander, Ersatzgeräte je Jahr und Saldo mit Kredit statt „Eigenkapital“, Klartext zum Einspeiseerlös auf der Regelseite. Nicht gewählte Autos und Wärmepumpen erscheinen nicht mehr mit Werten.
- **Rechner:** Die Kennzahl heißt „Autarkiegrad (Eigenversorgung)“ und nennt zusätzlich die Eigenverbrauchsquote; mit Kredit zeigt das Ergebnis den Saldo nach Kreditraten.
- **Export:** Das PDF beginnt mit einer Zusammenfassung: Kennzahlen als Kacheln, Strom im Jahresverlauf, Jahresbilanz als Anteilsbalken, Projektsaldo über die Laufzeit und Speichervergleich als Diagramme in den Farben der Rechner-Diagramme; Tabellen und Seitenköpfe sind ruhiger gestaltet.
- **Navigation:** Rechner, Rechenweg, Stromversorgung, Stromsystem 2045, Strompreis, Anbieter und Über stehen ohne Untermenü in einer Reihe; die aktuelle Seite ist gelb unterstrichen.
- **Rechner:** Vorlagen als kompakte Leiste, mobil als wischbare Reihe; die sechs Schritte klappen auf und zu und zeigen geschlossen ihre wichtigsten Werte. Das Ergebnis nennt Ort, Anlagengröße und Zeitraum, zeigt die Kennzahlen im Raster 3 × 2 und jeden Abschnitt als eigene Karte.
- **Werkzeuge:** Anbieter-Modelle, Stromsystem 2045 und Energie richtig zählen stellen ihre Eingaben als Karte neben das Ergebnis; Vergleichstabelle und Kostenkurve der Anbieter-Modelle laufen über die volle Breite, vier Kennzahlen stehen als 2 × 2.
- **Rechner:** Die häufigen Fragen unter dem Rechner nutzen die volle Breite und stehen auf breiten Bildschirmen in zwei Spalten.
- **Seiten:** Rechenweg, Stromversorgung und die Projektseite zeigen links eine Leiste „Auf dieser Seite“ mit allen Abschnitten und lesen sich in einer schmalen Spalte; Kennzahlen und Diagramme nutzen die volle Breite. Rechenweg und Projektseite beginnen mit demselben Einstieg wie die übrigen Seiten, der Rechenweg hebt Beispielwerte hervor.
- **Seiten:** Rechner, Anbieter-Modelle, Stromversorgung, Stromsystem 2045 und Energie richtig zählen beginnen mit demselben Einstieg aus Titel, Einleitung, Eckdaten und einem Verweis in die Seite; mobil stehen die Eckdaten unter der Einleitung, statt zu fehlen. Die 404-Seite zeigt nur noch Hinweis und Rückweg, zentriert.
- **Logo:** Neues Symbol zeigt die Sonne als Anteilsring, dessen gelber Bogen für die Eigenversorgung steht; Kopfzeile, Favicon, App-Symbol und Vorschaubild verwenden es.
- **Site-Dateien:** `robots.txt` lässt KI-Such- und Antwortdienste die Seiten lesen und zitieren; Crawler, die nur Trainingsdaten sammeln, bleiben ausgeschlossen.
- **Anbieter-Modelle:** Die Einordnung ist kürzer und in Karten gegliedert; Vereinfachungen und Quellen stehen aufklappbar am Ende.
- **Anbieter-Modelle:** Die Seite beschreibt Konzepte ohne Firmen- oder Markennamen; Quellen, die einzelne Anbieter betreffen, sind entfernt.
- **Anbieter-Modelle:** Das Verbrauchsfeld heißt „Strombedarf im Haushalt“ und ist klar vom Ertrag der Anlage getrennt; ein Hinweis zur Anlagengröße erklärt, warum keine Anlage den ganzen Bedarf deckt.
- **Stromversorgung:** Der Netz-Abschnitt erklärt Redispatch, Entschädigungen, Bundeszuschuss und Preiszonen ausführlicher, die Kennzahlen stehen als 2 × 2. Das Gedankenexperiment ist durch Abstand, Linie und „Zum Ausprobieren“ vom Leseteil abgesetzt.
- **Stromsystem 2045:** Das Klimaziel zählt neben Kraftwerken auch Öl- und Gasheizungen und Verbrenner-Pkw gegen den Pfad des Klimaschutzgesetzes; neue Regler für Bevölkerung, Sanierung und Wärmenetze. Das Ergebnis zeigt beide Bedingungen als Kacheln mit „Warum?“ und ein Diagramm der Klimabilanz je Bereich.
- **Anbieter-Modelle:** Die sieben Eingabeschritte klappen wie im Rechner auf und zu und zeigen geschlossen ihre wichtigsten Werte; die Einordnung der Zahlen steht auf breiten Bildschirmen zweispaltig, sodass Eingaben und Ergebnis gleich lang sind.
- **Contributors:** Biome und fallow lassen die synchronisierten Dateien in `apps/web/public/vendor` aus.

### Fixed

- **Export:** Der Hinweis „Beide Autos verwenden dasselbe Fahr- und Ladeprofil“ erscheint nur noch bei zwei Autos.
- **Stromsystem 2045:** Die schwierigste Woche zeigt keine überlappenden Zahlen mehr über den Balken; die Werte stehen im Tooltip.
- **Stromversorgung:** Die Dunkelflaute-Woche zeigt ihre Farben auch unter der Content Security Policy, markiert die Stunden mit Wind und Sonne unter 10 % der Last und die Preisspitze vom 6. November 2024.
- **SEO:** Titel und Beschreibungen der Hintergrund-Seiten passen in die Suchergebnisse; `security.txt` nennt eine Policy, die doppelte, nie ausgelieferte Sitemap-Route ist entfernt.
- **Seiten:** Erklärseiten wie Rechenweg und Anbieter-Modelle laufen nicht mehr über die volle Fensterbreite, sondern in einer lesbaren Spalte; die Navigation bricht auf schmalen Bildschirmen um, statt seitlich überzustehen.
- **Seiten:** Cloudflare fügt kein Skript zur Bot-Erkennung mehr in die Seiten ein, das die Content Security Policy blockierte und als Fehler in der Browser-Konsole stand. Der Worker liefert die HTML-Seiten dafür selbst komprimiert und als unveränderlich gekennzeichnet aus.

### Security

- **Abhängigkeiten:** Neue Paketversionen werden erst einen Tag nach Veröffentlichung installiert (`minimumReleaseAge`); die Pakete mit Install-Skripten sind geprüft freigegeben. Die Meldung zu `deepmerge` ist begründet ausgenommen, weil es keine korrigierte Version gibt und das Paket nur die eigene Svelte-Konfiguration beim Build zusammenführt.
- **Contributors:** Die GitHub Actions der CI sind auf Commit-SHAs festgelegt.

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
