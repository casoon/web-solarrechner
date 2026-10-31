<script lang="ts">
import { currency, number, rate } from '@/lib/solar/format';
import type { SolarProfile } from '@/lib/solar/model';
import {
  compareOffers,
  consumers,
  investments,
  type OfferInputs,
  offerDefaults,
  validateOffer,
} from '@/lib/solar/offers';
import reference from '@/lib/solar/reference.json';
import { offerCostSpec } from '@/lib/solar/result-display';
import NumberField from './NumberField.svelte';
import SolarChart from './SolarChart.svelte';

const profile = reference as SolarProfile;
let input = $state<OfferInputs>({ ...offerDefaults });
let result = $state(compareOffers(profile, offerDefaults));
let applied = $state<OfferInputs>({ ...offerDefaults });
let computing = $state(false);
const validation = $derived(validateOffer(input));
// Twenty yearly runs of the hourly balance: debounced like the calculator.
$effect(() => {
  const current = $state.snapshot(input);
  if (validation) return;
  computing = true;
  const timer = setTimeout(() => {
    result = compareOffers(profile, current);
    applied = current;
    computing = false;
  }, 150);
  return () => clearTimeout(timer);
});
const byKey = $derived(Object.fromEntries(result.offers.map((o) => [o.key, o])));
const cheapest = $derived(
  result.offers.reduce((best, o) => (o.total < best.total ? o : best), result.offers[0])
);
const prices = $derived(investments(applied));
const load = $derived(consumers(applied));
const selfUse = $derived(
  Math.max(0, ((result.energy.load - result.energy.grid) / result.energy.load) * 100)
);
const dynamicYear = $derived(byKey.dynamic.firstYear - byKey.grid.firstYear);
const rentExtra = $derived(byKey.rent.total - byKey.buyProvider.total);
const providerExtra = $derived(prices.provider - prices.local);
const spec = $derived(offerCostSpec(result.offers, applied.years));
</script>

<div class="calculator-layout">
  <form class="controls" onsubmit={(e) => e.preventDefault()} aria-label="Annahmen des Modellvergleichs">
    <fieldset class="input-section">
      <legend><span class="step">1</span> Dein Haushalt</legend>
      <NumberField
        label="Strombedarf im Haushalt"
        bind:value={input.household}
        unit="kWh/Jahr"
        min={500}
        max={20000}
        step={100}
        slider
        hint="Was du im Jahr verbrauchst, ohne E-Auto und Wärmepumpe; nicht, was die Anlage erzeugen soll. Verteilt über ein synthetisches Tagesprofil mit Spitzen morgens und abends."
      />
      <label for="offer-cars">Elektroautos</label>
      <select id="offer-cars" bind:value={input.cars}>
        <option value={0}>Kein Elektroauto</option>
        <option value={1}>Ein Elektroauto</option>
        <option value={2}>Zwei Elektroautos</option>
      </select>
      {#if input.cars > 0}
        <NumberField label="Fahrleistung je Auto" bind:value={input.km} unit="km/Jahr" max={50000} step={1000} />
      {/if}
      <label class="check">
        <input type="checkbox" bind:checked={input.heat} />
         Wärmepumpe einbeziehen
      </label>
      <NumberField
        label="Arbeitspreis heute"
        bind:value={input.price}
        unit="€/kWh"
        max={1}
        step={0.01}
        hint="Fester Tarif ohne Grundpreis, zum Beispiel ein Ökostromtarif. Er ist die Messlatte für alle Modelle."
      />
      <NumberField
        label="Preisänderung pro Jahr"
        bind:value={input.priceChange}
        unit="%"
        min={-5}
        max={10}
        step={0.5}
      />
    </fieldset>

    <fieldset class="input-section">
      <legend><span class="step">2</span> Dach und Paket</legend>
      <NumberField
        label="Anlagengröße"
        bind:value={input.kwp}
        unit="kWp"
        min={1}
        max={30}
        step={0.5}
        slider
        hint="Den ganzen Bedarf deckt keine Anlage: Im Winter fehlt Sonne, im Sommer bleibt Überschuss. Eine große Anlage gleicht den Winter teilweise aus und speist im Sommer viel ein, eine kleine deckt weniger, wird aber besser genutzt."
      />
      <NumberField label="Speicher" bind:value={input.battery} unit="kWh" max={30} step={0.5} slider />
      <NumberField
        label="Einspeisevergütung"
        bind:value={input.feedIn}
        unit="€/kWh"
        max={0.3}
        step={0.001}
        hint="Für Kauf und Miete; bei Pacht und Contracting erhält sie der Betreiber."
      />
      <NumberField
        label="Einspeisung ohne Vergütung"
        bind:value={input.unpaidExport}
        unit="%"
        max={100}
        hint="Etwa Stunden mit negativen Börsenpreisen, in denen neue Anlagen nichts erhalten."
      />
    </fieldset>

    <fieldset class="input-section">
      <legend><span class="step">3</span> Kaufen</legend>
      <NumberField label="Fachbetrieb, ohne Speicher" bind:value={input.localPrice} unit="€/kWp" max={4000} step={50} />
      <NumberField label="Speicher" bind:value={input.storagePrice} unit="€/kWh" max={2000} step={25} />
      <NumberField
        label="Aufschlag Komplettanbieter"
        bind:value={input.providerMarkup}
        unit="%"
        max={150}
        step={5}
        hint="Auf denselben Lieferumfang. Ein Energiemanager ist hier enthalten."
      />
      <NumberField label="Laufende Kosten" bind:value={input.running} unit="€/Jahr" max={1000} step={10} hint="Versicherung, Wartung, Zähler. In der Miete enthalten." />
      <NumberField label="Ersatz Wechselrichter und Speicher" bind:value={input.replacement} unit="€" max={20000} step={100} />
      <NumberField label="Ersatz im Betriebsjahr" bind:value={input.replacementYear} unit="Jahr" min={1} max={30} />
    </fieldset>

    <fieldset class="input-section">
      <legend><span class="step">4</span> Mieten</legend>
      <NumberField label="Monatliche Miete" bind:value={input.rent} unit="€/Monat" max={2000} step={5} slider />
      <NumberField label="Laufzeit" bind:value={input.rentYears} unit="Jahre" min={1} max={30} />
      <NumberField label="Mieterhöhung pro Jahr" bind:value={input.rentChange} unit="%" min={-5} max={10} step={0.5} />
      <NumberField label="Übernahme am Ende" bind:value={input.takeover} unit="€" max={20000} />
    </fieldset>

    <fieldset class="input-section">
      <legend><span class="step">5</span> Dach überlassen</legend>
      <NumberField
        label="Dachpacht"
        bind:value={input.lease}
        unit="€/kWp/Jahr"
        max={100}
        hint="Ein Investor baut und betreibt die Anlage; du beziehst weiter Netzstrom."
      />
      <NumberField
        label="Preis für Solarstrom vom Dach"
        bind:value={input.contractPrice}
        unit="€/kWh"
        max={1}
        step={0.01}
        hint="Contracting: Der Betreiber verkauft dir den Strom seiner Anlage, den Rest liefert das Netz."
      />
    </fieldset>

    <fieldset class="input-section">
      <legend><span class="step">6</span> Dynamischer Tarif</legend>
      <label class="check">
        <input type="checkbox" bind:checked={input.bundleDynamic} />
         Anbieterpakete mit dynamischem Tarif und Energiemanager
      </label>
      <NumberField
        label="Mittlerer Preis gegenüber Festpreis"
        bind:value={input.dynamicDelta}
        unit="€/kWh"
        min={-0.2}
        max={0.2}
        step={0.005}
        hint="Durchschnitt über das Jahr, wenn nichts verschoben wird. Negativ heißt günstiger."
      />
      <NumberField
        label="Ersparnis je verschobener kWh"
        bind:value={input.spread}
        unit="€/kWh"
        max={0.5}
        step={0.005}
        hint="Abstand der günstigen Stunden zum Tagesmittel, nach Netzentgelten und Steuern."
      />
      <NumberField label="Verschiebbar: Haushalt" bind:value={input.householdFlex} unit="%" max={100} />
      {#if input.cars > 0}<NumberField label="Verschiebbar: Autoladen" bind:value={input.carFlex} unit="%" max={100} />{/if}
      {#if input.heat}<NumberField label="Verschiebbar: Wärmepumpe" bind:value={input.heatFlex} unit="%" max={100} />{/if}
      <NumberField label="Smart Meter und Tarif-Grundgebühr" bind:value={input.meterCost} unit="€/Jahr" max={500} step={5} hint="Mehrkosten gegenüber dem Festpreistarif." />
      <NumberField label="Abo Energiemanager" bind:value={input.subscription} unit="€/Monat" max={100} hint="Nur in den Paketen von Komplettanbietern." />
    </fieldset>

    <fieldset class="input-section">
      <legend><span class="step">7</span> Zeitraum</legend>
      <NumberField label="Betrachtungszeitraum" bind:value={input.years} unit="Jahre" min={1} max={30} />
      <NumberField label="Diskontsatz" bind:value={input.discount} unit="%" max={15} step={0.5} hint="Für den Barwert: späteres Geld zählt weniger." />
      <button type="button" class="text-button" onclick={() => (input = { ...offerDefaults })}>
        Annahmen zurücksetzen
      </button>
    </fieldset>
  </form>

  <div class="results" id="ergebnis">
    {#if validation}<p class="error" role="alert">
        {validation} Angezeigt bleibt die letzte gültige Rechnung.
      </p>{/if}
    <section class="result-summary" aria-labelledby="offer-title">
      <div class="summary-heading">
        <h2 id="offer-title">Welches Modell passt zu dir?</h2>
        <span>
          {#if computing}<span class="calc-status" role="status">Rechnet …</span>{/if}
          Berlin, 35° Süd
        </span>
      </div>
      <dl class="key-results">
        <div>
          <dt>Günstigstes Modell über {applied.years} Jahre</dt>
          <dd data-testid="cheapest">{cheapest.label}</dd>
        </div>
        <div>
          <dt>Ersparnis gegenüber Netzstrom</dt>
          <dd>{currency(Math.max(0, -cheapest.versusGrid))}</dd>
        </div>
        <div>
          <dt>Miete, als Kredit gelesen</dt>
          <dd data-testid="rent-rate">{rate(result.rentRate)} Zins</dd>
        </div>
        <div>
          <dt>Dynamischer Tarif ohne Anlage, Jahr 1</dt>
          <dd>{dynamicYear <= 0 ? '−' : '+'}{currency(Math.abs(dynamicYear))}</dd>
        </div>
      </dl>
      <p>
        Alle Zahlungen aus Sicht deines Haushalts: Stromrechnung, Investition, Miete, Abo und
        Pacht, abzüglich Einspeisevergütung. Ohne Restwert der Anlage am Ende, ohne Steuern und
        Förderung. Die Erträge stammen aus dem Berliner PVGIS-Profil, nicht aus deiner Anlage im
        Rechner; Verbrauch und Lastverschiebung sind synthetische Annahmen.
      </p>
      <p>
        <strong>Kein Angebotsvergleich.</strong>
         Die Modelle zeigen, wie die Konzepte grundsätzlich rechnen. Konkrete Angebote,
        Vertragsklauseln und dein Dach entscheiden.
      </p>
    </section>

    <section class="comparison" aria-labelledby="offer-reading-title">
      <h2 id="offer-reading-title">Was die Zahlen hier sagen</h2>
      <p>
        <strong>Anlage:</strong>
         {number(applied.kwp, 1)} kWp und {number(applied.battery, 1)} kWh Speicher erzeugen im ersten
        Jahr {number(result.energy.pv)} kWh. Davon deckst du {number(selfUse)} % deines Bedarfs von
        {number(result.energy.load)} kWh ({number(load.household)} kWh Haushalt{load.car
          ? `, ${number(load.car)} kWh Auto`
          : ''}{load.heat ? `, ${number(load.heat)} kWh Wärmepumpe` : ''}).
      </p>
      <p>
        <strong>Komplettanbieter:</strong>
         Derselbe Lieferumfang kostet hier {currency(providerExtra)} mehr als beim Fachbetrieb
        ({currency(prices.provider)} statt {currency(prices.local)}). Diesen Aufpreis muss der
        Energiemanager über Lastverschiebung erst wieder einspielen.
      </p>
      <p>
        <strong>Miete:</strong>
         Über {applied.years} Jahre zahlst du {currency(Math.abs(rentExtra))}
        {rentExtra >= 0 ? 'mehr' : 'weniger'} als beim Kauf desselben Pakets. Als Kredit gelesen
        entspricht die Miete einem Zins von {rate(result.rentRate)} pro Jahr, Service und Ersatz
        bereits abgezogen. Vergleiche das mit einem Ratenkredit für den Kaufpreis.
      </p>
      <p>
        <strong>Dynamischer Tarif:</strong>
         Rund {number(result.flexibleShare * 100)} % deines Verbrauchs lassen sich nach den Annahmen in
        günstige Stunden schieben. Ohne Anlage ändert das deine Rechnung im ersten Jahr um
        {dynamicYear <= 0 ? '−' : '+'}{currency(Math.abs(dynamicYear))}, Smart Meter und Grundgebühr
        eingerechnet. Mit Anlage zählt nur noch der Netzbezug von {number(result.energy.grid)} kWh.
      </p>
      <p>
        <strong>Ökostrom ohne eigene Anlage:</strong>
         Zum Festpreis kostet dich Strom über {applied.years} Jahre {currency(byKey.grid.total)}, ohne
        Investition und ohne Risiko. Liegt kein Modell mit eigener Anlage deutlich darunter, erreichst
        du mit einem guten Ökostromtarif ökologisch viel, ohne Geld zu binden.
      </p>
      <p>
        <strong>Dach überlassen:</strong>
         Die Pacht bringt {currency(applied.lease * applied.kwp)} im Jahr, ohne Risiko und ohne
        eigene Stromersparnis. Beim Contracting zahlst du für Solarstrom {number(
          applied.contractPrice * 100,
          1,
        )} ct statt {number(applied.price * 100, 1)} ct je kWh; über {applied.years} Jahre sind das
        {currency(Math.abs(byKey.contract.versusGrid))}
        {byKey.contract.versusGrid <= 0 ? 'weniger' : 'mehr'} als reiner Netzstrom.
      </p>
    </section>
  </div>
  <div class="results results-wide">
    <section class="comparison" aria-labelledby="offer-table-title">
      <h2 id="offer-table-title">Die Modelle nebeneinander</h2>
      <div class="table-scroll">
        <table class="storage-table offer-table" aria-labelledby="offer-table-title">
          <thead>
            <tr>
              <th scope="col">Modell</th>
              <th scope="col">Vorab</th>
              <th scope="col">Jahr 1</th>
              <th scope="col">{applied.years} Jahre</th>
              <th scope="col">Barwert</th>
              <th scope="col">Gegenüber Netz&shy;strom</th>
            </tr>
          </thead>
          <tbody>
            {#each result.offers as o}
              <tr class:current={o.key === cheapest.key}>
                <th scope="row">{o.label}{#if o.dynamic}<span class="offer-tag">dynamisch</span>{/if}</th>
                <td>{currency(o.upfront)}</td>
                <td>{currency(o.firstYear)}</td>
                <td>{currency(o.total)}</td>
                <td>{currency(o.presentCost)}</td>
                <td>{o.key === 'grid' ? '–' : currency(o.versusGrid)}</td>
              </tr>{/each}
          </tbody>
        </table>
      </div>
      <p class="field-hint">
        Jahr 1 und Summe enthalten alle laufenden Zahlungen; negative Beträge heißen, dass Erlöse die
        Kosten übersteigen. Barwert mit {number(applied.discount, 1)} % Diskontsatz.
      </p>
    </section>

    <section class="chart-section" aria-labelledby="offer-chart-title">
      <h2 id="offer-chart-title">Kosten über den ganzen Zeitraum</h2>
      <SolarChart {spec} id="offer-costs" />
    </section>
  </div>
</div>

<style>
  .offer-table th[scope="row"] {
    white-space: normal;
  }
  .offer-tag {
    display: inline-block;
    margin-left: 6px;
    padding: 0 6px;
    border-radius: 4px;
    background: #eff2e9;
    font-size: 11px;
    font-weight: 600;
  }
</style>
