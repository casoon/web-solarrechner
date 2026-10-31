<script lang="ts">
import { smard } from '@/lib/energy/overview';
import { type StateInputs, stateDefaults, statePrices, stateYears } from '@/lib/energy/states';
import { statePriceSpec } from '@/lib/energy/states-display';
import { number } from '@/lib/solar/format';
import NumberField from './NumberField.svelte';
import SolarChart from './SolarChart.svelte';

const nuclearLater = smard.years.filter((y) => y.year > 2021).reduce((s, y) => s + y.nuclear, 0);
let input = $state<StateInputs>({ ...stateDefaults });
const valid = $derived(Number.isFinite(input.losses) && input.losses >= 0 && input.losses < 50);
let applied = $state<StateInputs>({ ...stateDefaults });
$effect(() => {
  const current = $state.snapshot(input);
  if (valid) applied = current;
});
const result = $derived(statePrices(applied, nuclearLater));
const sorted = $derived([...result.states].sort((a, b) => a.price - b.price));
const cheapest = $derived(sorted[0]);
const dearest = $derived(sorted[sorted.length - 1]);
const substituted = $derived(
  result.states.filter(
    (s) => s.generationYear !== applied.year || s.consumptionYear !== applied.year
  )
);
const spec = $derived(statePriceSpec(sorted, result.national));
const ct = (n: number) => `${number(n, 1)} ct/kWh`;
</script>

<div class="calculator-layout">
  <form class="controls" onsubmit={(e) => e.preventDefault()} aria-label="Annahmen zum Landesstrompreis">
    <fieldset class="input-section">
      <legend><span class="step">1</span> Jahr und Kosten</legend>
      <label for="state-year">Jahr der Länderbilanzen</label>
      <select id="state-year" bind:value={input.year}>
        {#each stateYears as y}<option value={y}>{y}</option>{/each}
      </select>
      <label for="state-cost">Kosten je Kraftwerksart</label>
      <select id="state-cost" bind:value={input.costCase}>
        <option value="low">Untere Werte der Studie</option>
        <option value="mid">Mitte der Spanne</option>
        <option value="high">Obere Werte der Studie</option>
      </select>
      <p class="field-hint">
        Stromgestehungskosten neuer Anlagen nach Fraunhofer ISE (2024): was es kosten würde, den Mix
        des Landes heute neu zu bauen. Bestehende, abgeschriebene Kraftwerke sind billiger.
      </p>
      <NumberField
        label="Eigenverbrauch und Netzverluste"
        bind:value={input.losses}
        unit="%"
        max={49}
        hint="Anteil der Erzeugung, der nicht beim Verbraucher ankommt."
      />
    </fieldset>
    <fieldset class="input-section">
      <legend><span class="step">2</span> Folgekosten</legend>
      <label class="check">
        <input type="checkbox" bind:checked={input.environment} />
         Umweltkosten nach Umweltbundesamt einrechnen
      </label>
      <p class="field-hint">
        Schäden durch Treibhausgase und Luftschadstoffe je kWh (Methodenkonvention 4.0). Der CO₂-Preis
        steckt zum Teil schon in den Gestehungskosten; dieser Teil zählt dann doppelt.
      </p>
      <fieldset class="choice">
        <legend>Endlagerung und Rückbau der Kernkraftwerke</legend>
        <label class="check"><input type="radio" bind:group={input.disposal} value="none" /> Weglassen</label>
        <label class="check"><input type="radio" bind:group={input.disposal} value="state" /> Trägt das Land mit dem Kraftwerk</label>
        <label class="check"><input type="radio" bind:group={input.disposal} value="all" /> Trägt die Allgemeinheit</label>
      </fieldset>
      {#if input.disposal !== 'none'}
        <label for="state-disposal">Kostenschätzung</label>
        <select id="state-disposal" bind:value={input.disposalCase}>
          <option value="low">Fonds und Rückstellungen: 41,8 Mrd. €</option>
          <option value="high">Gesamtkosten bis 2099: rund 170 Mrd. €</option>
        </select>
        <p class="field-hint">
          Verteilt auf allen Atomstrom seit 1961: {ct(result.disposalPerKwh)}. Seit April 2023 erzeugt
          Deutschland keinen Atomstrom mehr; der Schalter wirkt nur für frühere Jahre.
        </p>
      {/if}
    </fieldset>
    <fieldset class="input-section">
      <legend><span class="step">3</span> Strom von anderen Ländern</legend>
      <fieldset class="choice">
        <legend>Preis für fehlenden Strom</legend>
        <label class="check"><input type="radio" bind:group={input.imports} value="exporters" /> Mittel der Überschussländer</label>
        <label class="check"><input type="radio" bind:group={input.imports} value="peaker" /> Teures Spitzenlastkraftwerk</label>
      </fieldset>
      <button type="button" class="text-button" onclick={() => (input = { ...stateDefaults })}>
        Annahmen zurücksetzen
      </button>
    </fieldset>
  </form>

  <div class="results">
    {#if !valid}<p class="error" role="alert">
        Eigenverbrauch und Netzverluste müssen zwischen 0 und 49 % liegen. Angezeigt bleibt die letzte
        gültige Rechnung.
      </p>{/if}
    <section class="result-summary" aria-labelledby="state-title">
      <div class="summary-heading">
        <h2 id="state-title">Strompreis aus eigener Erzeugung, {applied.year}</h2>
        <span>nur Erzeugung, ohne Netzentgelte und Steuern</span>
      </div>
      <dl class="key-results">
        <div>
          <dt>Am günstigsten</dt>
          <dd class="name" data-testid="cheapest-state">{cheapest.name}</dd>
        </div>
        <div>
          <dt>Am teuersten</dt>
          <dd class="name">{dearest.name}</dd>
        </div>
        <div>
          <dt>Spanne</dt>
          <dd data-testid="state-spread">{ct(dearest.price - cheapest.price)}</dd>
        </div>
        <div>
          <dt>Mittel aller Länder</dt>
          <dd>{ct(result.national)}</dd>
        </div>
      </dl>
      <p>
        {cheapest.name} deckt {number(cheapest.selfSupply)} % seines Verbrauchs selbst und zahlt
        {ct(cheapest.price)}; {dearest.name} kommt auf {ct(dearest.price)}. Länder mit Defizit kaufen den
        Rest für {ct(result.importPrice)} zu.
      </p>
    </section>

    <section class="chart-section" aria-labelledby="state-chart-title">
      <h2 id="state-chart-title">Die 16 Länder im Vergleich</h2>
      <SolarChart {spec} id="state-prices" />
    </section>

    <section class="comparison" aria-labelledby="state-table-title">
      <h2 id="state-table-title">Erzeugung, Verbrauch und Preis je Land</h2>
      <div class="table-scroll" role="region" aria-label="Erzeugung, Verbrauch und Preis je Land, Tabelle" tabindex="0">
        <table class="storage-table" aria-labelledby="state-table-title">
          <thead>
            <tr>
              <th scope="col">Land</th>
              <th scope="col">Erzeugung</th>
              <th scope="col">Verbrauch</th>
              <th scope="col">Selbst gedeckt</th>
              <th scope="col">Eigene Kosten</th>
              <th scope="col">Preis</th>
            </tr>
          </thead>
          <tbody>
            {#each sorted as s}
              <tr>
                <th scope="row">{s.name}{#if s.generationYear !== applied.year || s.consumptionYear !== applied.year}*{/if}</th>
                <td>{number(s.generation / 1000, 1)} TWh</td>
                <td>{number(s.consumption / 1000, 1)} TWh</td>
                <td>{number(s.selfSupply)} %</td>
                <td>{ct(s.ownCost)}</td>
                <td>{ct(s.price)}</td>
              </tr>{/each}
          </tbody>
        </table>
      </div>
      <p class="field-hint">
        Erzeugung brutto, Verbrauch als Endenergieverbrauch Strom. Wasserkraft und andere Träger, für
        die die Studie keine Kosten nennt, gehen mit dem erzeugungsgewichteten Mittel der übrigen ein
        ({ct(result.average)}).
        {#if substituted.length}
          * Für {applied.year} fehlen Werte; verwendet:
          {substituted
            .map((s) =>
              s.generationYear === s.consumptionYear
                ? `${s.name} ${s.generationYear}`
                : `${s.name} Erzeugung ${s.generationYear}, Verbrauch ${s.consumptionYear}`
            )
            .join(', ')}.
        {/if}
      </p>
    </section>
  </div>
</div>

<style>
  .choice {
    border: 0;
    padding: 0;
    margin: 12px 0 0;
  }
  .choice legend {
    float: none;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0;
    margin-bottom: 0;
  }
  .choice .check {
    margin-block: 10px;
  }
</style>
