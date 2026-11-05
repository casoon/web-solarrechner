# Changelog

Alle wesentlichen Änderungen an web-solarrechner werden hier dokumentiert.
Das Projekt folgt [Keep a Changelog 1.1](https://keepachangelog.com/de/1.1.0/)
und [Semantic Versioning](https://semver.org/lang/de/). Vor 1.0 kann sich der Funktionsumfang ändern.

## [Unreleased]

### Added

- **Rechner:** Für Haushalte mit E-Auto zeigt das Ergebnis die Heimladung nach Quelle, Monat für Monat: direkt aus Sonne, über den Speicher und aus dem Netz, dazu den Solaranteil. Das PDF hat dafür die Seite „Laden des Autos zu Hause“.
- **Rechner:** Der Schalter „Speicher darf das Auto laden“ ist standardmäßig aus, der Speicher versorgt dann nur das Haus; das Haus hat immer Vorrang vor dem Auto, das Auto vor dem Laden des Speichers.
- **Rechner:** Beim Laden tagsüber wählt die Wallbox-Art die kleinste Ladeleistung des Überschussladens: mit Phasenumschaltung ab 1,4 kW, dreiphasig ohne Umschaltung ab 4,1 kW, einphasig 1,4 bis 4,6 kW.
- **Rechner:** „Ab wann rechnet es sich?“ nennt den Strompreis heute und die jährliche Preissteigerung, ab denen der Kapitalwert null ist und der Saldo nach der Laufzeit positiv; die Strompreis-Szenarien zeigen zusätzlich den Kapitalwert. Auch im PDF.
- **Rechner:** „Was, wenn sich die Einspeisevergütung ändert?“ rechnet dieselbe Anlage unter Nullerlös, fortgeschriebenem EEG und dem 2027-Entwurf und zeigt Erlös, Vorteil, Kapitalwert und Amortisation; auch im PDF.
- **Rechner:** Die Tabelle zur monatlichen Belastung mit Kredit nennt den Eigenanteil zu Beginn und stellt die Monatsbeträge dem Kapitalwert und der Verzinsung der ganzen Investition gegenüber; auch im PDF.
- **Rechner:** Mit Kredit zeigt „Deine Finanzierung“ die monatliche Belastung Jahr für Jahr: Strom ohne Anlage, Strom und Betrieb mit Anlage, Kreditrate, Summe und Unterschied, mit der gewählten Strompreisänderung. Das PDF hat dafür eine eigene Seite.
- **Export:** Neue PDF-Seite „Stromkosten und Finanzierung“ mit der Stromrechnung mit und ohne Anlage und, bei Kredit, Rate, Kreditkosten und dem Vergleich mit und ohne Kredit; die Seite „Strompreis und Vergütung“ zeigt dazu die Strompreis-Szenarien.
- **Rechner:** Speicherqualität günstig, Standard oder hochwertig setzt Preis, Wirkungsgrad, Standby, Alterung und Lebensdauer gemeinsam; jeder Wert bleibt einzeln änderbar. Wahlweise läuft die Anlage nach dem Lebensende ohne Speicher weiter, statt ihn zu ersetzen.
- **Rechner:** Mit Kredit zeigt das Ergebnis, was heute aus eigener Tasche kommt und was der Kredit über die ganze Laufzeit an Zinsen und Gebühren kostet; die Investition bleibt der Kaufpreis. Das PDF nennt beides auf der Seite zur Wirtschaftlichkeit.
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

- **Oberfläche:** Auf schmalen Bildschirmen steht die Navigation in einer scrollbaren Zeile; auf Leseseiten markiert die Abschnittsnavigation den gelesenen Abschnitt, Sprünge scrollen weich.
- **Rechner:** Der Puffer im Autoakku ist mit 20 kWh vorbelegt statt mit 0, das beim Tagesladen nur einen Tagesbedarf je Heimtag aus der Sonne zuließ; der Vergleich „Auto oder Speicher als Puffer?“ rechnet beide Tageszeilen mit demselben Puffer.
- **Export:** Die Strompreis-Szenarien stehen auf einer eigenen Seite „Strompreis und Vergütung“, die Annahmen nennen Wallbox-Art und ob der Speicher ins Auto lädt.
- **Rechner:** Die Strompreisänderung ist mit +2 % pro Jahr vorbelegt, nominal etwa im Takt der Inflation, wie es die Seite Strompreis begründet; Anbieter-Modelle und Qualität nutzen denselben Wert. Die Szenarien zeigen weiterhin gleichbleibende, fallende und stärker steigende Preise.
- **Rechner:** Das Lastprofil „morgens und abends“ verteilt mehr Verbrauch auf den Tag, und die Lastspitzen-Annahmen „typisch“ und „vorsichtig“ nehmen einen kleineren Anteil des Haushaltsstroms; ohne Speicher liegt der Autarkiegrad damit näher an den Werten des HTW-Unabhängigkeitsrechners.
- **Rechner:** Fehlen die Sonnendaten für Ort oder Ausrichtung, steht der Hinweis mit Ladeknopf jetzt auch über dem Ergebnis, nicht nur im zugeklappten Schritt „Standort“.
- **Rechner:** Mit Kredit rechnen positiver Saldo und der Vergleich mit einer Geldanlage die Raten, Zinsen und Restschuld ein; der Wert ohne Kredit steht klein darunter. Die Verzinsung der Anlage wird mit dem Kreditzins verglichen, damit sichtbar ist, wann der Kredit den Ertrag auffrisst. Das PDF nennt dieselben Werte.
- **Rechner:** Der Speicher wird nach seiner Lebensdauer wiederholt ersetzt, nicht nur einmal; der zuletzt gekaufte Ersatzspeicher zählt am Ende mit seinem Restwert. Ergebnis und PDF nennen Ersatzjahre und Restwert.
- **Rechner:** Kennzahlen in Alltagssprache: „Mehr als Geld zu 3 % anlegen“ statt Kapitalwert und „Verzinsung deines Geldes“ statt interner Zinsfuß, mit kurzer Erklärung; Saldo mit Kredit und Kapitalwert tragen ein Vorzeichen. Das PDF übernimmt Namen und Vorzeichen.
- **Rechner:** Die Berechnungen laufen im Hintergrund, sodass Eingaben auch bei Speicher-, Größen- und Ladevergleich nicht mehr stocken; dauert es spürbar, zeigt ein kleiner Fortschrittsbalken den Stand. Die Vergleichstabellen lassen sich per Tastatur scrollen.
- **Export:** Das PDF erklärt sich selbst: neue Seite mit Größen- und Ladevergleich und kurzen Begriffserklärungen, ausgeschriebene Spalten in der Monatsbilanz, Autarkiegrad und Eigenverbrauchsquote nebeneinander, Ersatzgeräte je Jahr und Saldo mit Kredit statt „Eigenkapital“, Klartext zum Einspeiseerlös auf der Regelseite. Nicht gewählte Autos und Wärmepumpen erscheinen nicht mehr mit Werten.
- **Rechner:** Die Kennzahl heißt „Autarkiegrad (Eigenversorgung)“ und nennt zusätzlich die Eigenverbrauchsquote; mit Kredit zeigt das Ergebnis den Saldo nach Kreditraten.
- **Export:** Das PDF beginnt mit einer Zusammenfassung: Kennzahlen als Kacheln, Strom im Jahresverlauf, Jahresbilanz als Anteilsbalken, Projektsaldo über die Laufzeit und Speichervergleich als Diagramme in den Farben der Rechner-Diagramme; Tabellen und Seitenköpfe sind ruhiger gestaltet.
- **Export:** Fließtext im PDF hat mehr Zeilenabstand, die Begriffserklärungen stehen als eigene Absätze mit Luft dazwischen, Quellen und Hinweise sind lockerer gesetzt. Kennzahlen- und Tabellenseiten bleiben unverändert.
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
- **Rechner:** Bei automatischen Kosten folgt der Preis des Ersatzspeichers der Speichergröße; bisher blieb er beim Wert der Vorlage, sodass größere Speicher im Kapitalwert zu gut abschnitten.
- **Rechner:** Die vorbelegte Inbetriebnahme bleibt im Zeitraum der hinterlegten Regeln (bis Dezember 2030); das Prüfdatum der Regeln kommt aus einer Stelle.
- **Inhalte:** Die häufige Frage zum Solarspitzengesetz nennt die Bedingung Smart Meter und die Verlängerung des Vergütungszeitraums und sagt, was der Rechner davon abbildet; die Qualitäts-Seite beschreibt die Folgen einer verspäteten Registrierung im Marktstammdatenregister so, wie § 52 EEG sie regelt.
- **Stromsystem 2045:** Die schwierigste Woche zeigt keine überlappenden Zahlen mehr über den Balken; die Werte stehen im Tooltip.
- **Stromversorgung:** Die Dunkelflaute-Woche zeigt ihre Farben auch unter der Content Security Policy, markiert die Stunden mit Wind und Sonne unter 10 % der Last und die Preisspitze vom 6. November 2024.
- **SEO:** Titel und Beschreibungen der Hintergrund-Seiten passen in die Suchergebnisse; `security.txt` nennt eine Policy, die doppelte, nie ausgelieferte Sitemap-Route ist entfernt.
- **Seiten:** Erklärseiten wie Rechenweg und Anbieter-Modelle laufen nicht mehr über die volle Fensterbreite, sondern in einer lesbaren Spalte; die Navigation bricht auf schmalen Bildschirmen um, statt seitlich überzustehen.
- **Seiten:** Cloudflare fügt kein Skript zur Bot-Erkennung mehr in die Seiten ein, das die Content Security Policy blockierte und als Fehler in der Browser-Konsole stand. Der Worker liefert die HTML-Seiten dafür selbst komprimiert und als unveränderlich gekennzeichnet aus.

### Security

- **PVGIS-Abruf:** Der Endpunkt `/api/solar` begrenzt Abrufe je Client und insgesamt (Rate-Limit-Bindings), hält Profile im Cloudflare-Cache und rundet Koordinaten auf 0,01°, damit ein Skript PVGIS nicht über die Ausgangsadresse der Seite für alle sperren kann.
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
