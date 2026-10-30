<script lang="ts">
import {
  compare,
  type EfficiencyInputs,
  efficiencyDefaults,
  efficiencySpec,
  household,
  validateEfficiency,
} from '@/lib/energy/efficiency';
import { number } from '@/lib/solar/format';
import NumberField from './NumberField.svelte';
import SolarChart from './SolarChart.svelte';

let input = $state<EfficiencyInputs>({ ...efficiencyDefaults });
let applied = $state<EfficiencyInputs>({ ...efficiencyDefaults });
const validation = $derived(validateEfficiency(input));
$effect(() => {
  const current = $state.snapshot(input);
  if (!validation) applied = current;
});
const uses = $derived(compare(applied));
const house = $derived(household(applied));
const spec = $derived(efficiencySpec(uses));
const kwh = (n: number) => `${number(n)} kWh`;
</script>

<div class="calculator-layout">
  <form class="controls" onsubmit={(e) => e.preventDefault()} aria-label="Annahmen zum Energievergleich">
    <fieldset class="input-section">
      <legend><span class="step">1</span> Strom aus dem Kraftwerk</legend>
      <NumberField label="Ersetzter Kohlestrom" bind:value={input.power} unit="kWh" max={1000000} step={100} />
      <NumberField
        label="Wirkungsgrad des Kraftwerks"
        bind:value={input.plantEfficiency}
        unit="%"
        min={1}
        max={100}
        slider
        hint="Netto, also nach Eigenverbrauch des Kraftwerks. Der Rest des Brennstoffs wird zu Abwärme."
      />
      <NumberField
        label="Netzverluste"
        bind:value={input.gridLosses}
        unit="%"
        max={30}
        step={0.5}
        hint="Zwischen Kraftwerk und Steckdose; gilt für fossilen und erneuerbaren Strom gleich."
      />
    </fieldset>
    <fieldset class="input-section">
      <legend><span class="step">2</span> Heizen</legend>
      <NumberField label="Wärmebedarf" bind:value={input.heat} unit="kWh/Jahr" max={60000} step={500} slider />
      <NumberField label="Nutzungsgrad Gasbrennwertkessel" bind:value={input.boilerEfficiency} unit="%" min={1} max={110} />
      <NumberField
        label="Jahresarbeitszahl Wärmepumpe"
        bind:value={input.heatPumpFactor}
        min={1}
        max={6}
        step={0.1}
        slider
        hint="Wärme je kWh Strom über das ganze Jahr; Luft-Wärmepumpen im Bestand liegen niedriger als Erdwärme."
      />
    </fieldset>
    <fieldset class="input-section">
      <legend><span class="step">3</span> Fahren</legend>
      <NumberField label="Fahrleistung" bind:value={input.km} unit="km/Jahr" max={60000} step={500} slider />
      <NumberField label="Benziner" bind:value={input.petrol} unit="l/100 km" max={20} step={0.1} />
      <NumberField label="Elektroauto inkl. Ladeverluste" bind:value={input.electric} unit="kWh/100 km" max={40} step={0.5} />
      <button type="button" class="text-button" onclick={() => (input = { ...efficiencyDefaults })}>
        Annahmen zurücksetzen
      </button>
    </fieldset>
  </form>

  <div class="results">
    {#if validation}<p class="error" role="alert">
        {validation} Angezeigt bleibt die letzte gültige Rechnung.
      </p>{/if}
    <section class="result-summary" aria-labelledby="efficiency-title">
      <div class="summary-heading"><h2 id="efficiency-title">Derselbe Nutzen, weniger Energie</h2></div>
      <dl class="key-results">
        <div>
          <dt>Haus mit Heizung und Auto, fossil</dt>
          <dd>{kwh(house.fossil)}</dd>
        </div>
        <div>
          <dt>Dasselbe elektrisch</dt>
          <dd data-testid="electric-total">{kwh(house.electric)}</dd>
        </div>
        <div>
          <dt>Fossil braucht das</dt>
          <dd data-testid="factor">{number(house.factor, 1)}-Fache</dd>
        </div>
        <div>
          <dt>Kohlestrom: Brennstoff je kWh</dt>
          <dd>{number(100 / applied.plantEfficiency, 1)}&nbsp;kWh</dd>
        </div>
      </dl>
      <p>
        Der Strombedarf steigt, wenn Heizung und Auto elektrisch werden. Der Energiebedarf insgesamt
        sinkt dabei deutlich, weil Verbrennungsmotor und Kraftwerk den größten Teil ihres Brennstoffs
        als Abwärme verlieren und die Wärmepumpe Umweltwärme dazuholt.
      </p>
    </section>

    <section class="comparison" aria-labelledby="efficiency-table-title">
      <h2 id="efficiency-table-title">Rechnung im Einzelnen</h2>
      <div class="table-scroll" role="region" aria-label="Rechnung im Einzelnen, Tabelle" tabindex="0">
        <table class="storage-table" aria-labelledby="efficiency-table-title">
          <thead>
            <tr>
              <th scope="col">Nutzen</th>
              <th scope="col">Fossil: Brennstoff</th>
              <th scope="col">Elektrisch: Strom</th>
              <th scope="col">Primärenergie fossil</th>
              <th scope="col">Primärenergie Wind/PV</th>
            </tr>
          </thead>
          <tbody>
            {#each uses as u}
              <tr>
                <th scope="row">{u.benefit}</th>
                <td>{kwh(u.fossil)}</td>
                <td>{kwh(u.electric)}</td>
                <td>{kwh(u.fossilPrimary)}</td>
                <td>{kwh(u.electricPrimary)}</td>
              </tr>{/each}
          </tbody>
        </table>
      </div>
      <p class="field-hint">
        Primärenergie nach der Wirkungsgradmethode der Energiebilanz: Wind- und Solarstrom zählen mit
        ihrer Strommenge, ein fossiles Kraftwerk mit dem Brennstoff, den es verbrennt. Benzin und Gas
        stehen hier ohne Förderung, Raffinerie und Transport, also eher zu niedrig.
      </p>
    </section>

    <section class="chart-section" aria-labelledby="efficiency-chart-title">
      <h2 id="efficiency-chart-title">Fossil und elektrisch im Vergleich</h2>
      <SolarChart {spec} id="efficiency" />
    </section>
  </div>
</div>
