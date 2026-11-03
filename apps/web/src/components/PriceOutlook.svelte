<script lang="ts">
import {
  agnesYear,
  capacityYear,
  end,
  flatPath,
  gridStudies,
  type OutlookInputs,
  outlook,
  outlookChange,
  outlookDefaults,
  presentValue,
  start,
  subsidyEffect,
  type ValueInputs,
  valueDefaults,
} from '@/lib/energy/prices';
import { outlookSpec, valueSpec } from '@/lib/energy/prices-display';
import { currency, number, percent } from '@/lib/solar/format';
import NumberField from './NumberField.svelte';
import SolarChart from './SolarChart.svelte';

const presets: { label: string; values: Partial<OutlookInputs> }[] = [
  { label: 'Nur was beschlossen ist', values: {} },
  {
    label: 'Günstig: Erneuerbare drücken die Börse, Stromsteuer sinkt',
    values: { procurement2035: 12, gridChange: -1.2, taxCut: true },
  },
  {
    label: 'Teuer: Netz privat finanziert, Zuschuss weg, Gaskraftwerks-Umlage, Gasschock 2030',
    values: { gridChange: 3, subsidyEnds: true, capacityLevy: 2, shock: true },
  },
];

let input = $state<OutlookInputs>({ ...outlookDefaults });
let value = $state<ValueInputs>({ ...valueDefaults });
const within = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max;
const valid = $derived(
  within(input.inflation, -2, 10) &&
    within(input.procurement2035, 0, 60) &&
    within(input.shockYear, start + 1, end - 1) &&
    within(input.shockHeight, 0, 40) &&
    within(input.gridChange, -9, 20) &&
    within(input.capacityLevy, 0, 5) &&
    within(input.fixedShare, 0, 100) &&
    within(value.kwh, 0, 50000) &&
    within(value.years, 1, end - start) &&
    Number.isInteger(value.years) &&
    within(value.discount, -2, 15)
);
let applied = $state({ input: { ...outlookDefaults }, value: { ...valueDefaults } });
$effect(() => {
  const current = { input: $state.snapshot(input), value: $state.snapshot(value) };
  if (valid) applied = current;
});

const years = $derived(outlook(applied.input));
const change = $derived(outlookChange(years));
const last = $derived(years[years.length - 1]);
const cases = $derived([
  {
    label: 'Eigenes Szenario',
    value: presentValue(
      years.map((y) => y.avoidable),
      applied.value
    ),
  },
  { label: 'Preis bleibt wie heute', value: presentValue(flatPath(0), applied.value) },
  {
    label: `Steigt mit der Inflation (${percent(applied.input.inflation)})`,
    value: presentValue(flatPath(applied.input.inflation), applied.value),
  },
  { label: 'Verkaufsargument +5 % im Jahr', value: presentValue(flatPath(5), applied.value) },
]);
const ct = (n: number) => `${number(n, 1)} ct/kWh`;
const apply = (values: Partial<OutlookInputs>) => {
  input = { ...outlookDefaults, ...values };
};
</script>

<div class="calculator-layout">
  <form class="controls" onsubmit={(e) => e.preventDefault()} aria-label="Annahmen zur Strompreisentwicklung">
    <fieldset class="input-section">
      <legend><span class="step">1</span> Ausgangslage</legend>
      <label for="price-preset">Szenario laden</label>
      <select
        id="price-preset"
        onchange={(e) => apply(presets[Number(e.currentTarget.value)].values)}
      >
        {#each presets as p, i}<option value={i}>{p.label}</option>{/each}
      </select>
      <NumberField
        label="Inflation"
        bind:value={input.inflation}
        unit="% im Jahr"
        min={-2}
        max={10}
        step={0.5}
        slider
        hint="Alle Bestandteile steigen mit, außer Stromsteuer und Konzessionsabgabe: Sie sind gesetzlich in Cent festgelegt."
      />
    </fieldset>
    <fieldset class="input-section">
      <legend><span class="step">2</span> Einkauf an der Börse</legend>
      <NumberField
        label="Beschaffung und Vertrieb 2035"
        bind:value={input.procurement2035}
        unit="ct/kWh"
        max={60}
        step={0.5}
        slider
        hint="Heute 15,4 ct, in Kaufkraft von heute. Mehr Wind und Sonne drücken den Börsenpreis; laut Agora/Aurora bis 2030 um bis zu 23 %."
      />
      <label class="check">
        <input type="checkbox" bind:checked={input.shock} />
        Preisschock wie 2022 einrechnen
      </label>
      {#if input.shock}
        <NumberField label="Jahr des Schocks" bind:value={input.shockYear} min={start + 1} max={end - 1} />
        <NumberField
          label="Aufschlag im Schockjahr"
          bind:value={input.shockHeight}
          unit="ct/kWh"
          max={40}
          slider
          hint="Im Jahr danach die Hälfte, dann vorbei. 2022/23 stieg die Beschaffung um gut 10 ct."
        />
      {/if}
    </fieldset>
    <fieldset class="input-section">
      <legend><span class="step">3</span> Netz, Umlagen, Steuern</legend>
      <label for="price-grid-study">Netzentgelt nach Studie</label>
      <select
        id="price-grid-study"
        onchange={(e) => (input.gridChange = Number(e.currentTarget.value))}
      >
        <option value="" disabled selected>Studie wählen …</option>
        {#each gridStudies as s}<option value={s.change}>{s.label}</option>{/each}
      </select>
      <NumberField
        label={`Netzentgelt ${end} gegenüber heute`}
        bind:value={input.gridChange}
        unit="ct/kWh"
        min={-9}
        max={20}
        step={0.1}
        slider
        hint="Heute 9,24 ct, Änderung in Kaufkraft von heute, gleichmäßig bis zum Ende."
      />
      <label class="check">
        <input type="checkbox" bind:checked={input.subsidyEnds} />
        Bundeszuschuss zum Übertragungsnetz endet nach 2027 (+{number(subsidyEffect, 1)} ct)
      </label>
      <NumberField
        label={`Umlage für neue Gaskraftwerke ab ${capacityYear}`}
        bind:value={input.capacityLevy}
        unit="ct/kWh"
        max={5}
        step={0.1}
        slider
        hint="Höhe offen; das Ministerium nannte früher rund 2 ct."
      />
      <label class="check">
        <input type="checkbox" bind:checked={input.taxCut} />
        Stromsteuer für Haushalte ab 2027 auf EU-Minimum
      </label>
    </fieldset>
    <fieldset class="input-section">
      <legend><span class="step">4</span> Eigene Solaranlage</legend>
      <NumberField
        label="Selbst verbrauchter Solarstrom"
        bind:value={value.kwh}
        unit="kWh im Jahr"
        max={50000}
        step={100}
        hint="Nur dieser Strom spart den Preis. Eingespeister Strom bekommt die Vergütung, unabhängig vom Strompreis."
      />
      <NumberField label="Laufzeit" bind:value={value.years} unit="Jahre" min={1} max={end - start} />
      <NumberField
        label="Kalkulationszins"
        bind:value={value.discount}
        unit="% im Jahr"
        min={-2}
        max={15}
        step={0.5}
        hint="Was das Geld anderswo bringen würde, etwa Tagesgeld oder Kreditzins."
      />
      <NumberField
        label={`Netzentgelt als Festbetrag ab ${agnesYear}`}
        bind:value={input.fixedShare}
        unit="%"
        step={5}
        slider
        hint="Die Netzentgeltreform der Bundesnetzagentur gilt ab 2029. Wandert ein Teil in einen Grundpreis, spart eigener Strom weniger, auch wenn die Rechnung steigt."
      />
      <button type="button" class="text-button" onclick={() => apply({})}>Annahmen zurücksetzen</button>
    </fieldset>
  </form>

  <div class="results">
    {#if !valid}<p class="error" role="alert">
        Bitte die Eingaben im erlaubten Bereich halten. Angezeigt bleibt die letzte gültige Rechnung.
      </p>{/if}
    <section class="result-summary" aria-labelledby="outlook-title">
      <div class="summary-heading">
        <h2 id="outlook-title">Strompreis {end} im eigenen Szenario</h2>
        <span>Szenario, keine Prognose</span>
      </div>
      <dl class="key-results">
        <div>
          <dt>Preis {end}, nominal</dt>
          <dd data-testid="outlook-total">{ct(last.total)}</dd>
        </div>
        <div>
          <dt>In Kaufkraft von heute</dt>
          <dd>{ct(last.real)}</dd>
        </div>
        <div>
          <dt>Pro Jahr, nominal</dt>
          <dd data-testid="outlook-rate">{percent(Math.round(change.nominal * 10) / 10)}</dd>
        </div>
        <div>
          <dt>Pro Jahr, real</dt>
          <dd>{percent(Math.round(change.real * 10) / 10)}</dd>
        </div>
      </dl>
      <p>
        Von {ct(years[0].total)} {start} auf {ct(last.total)} {end}. Im <a href="/">Rechner</a> lässt sich
        die nominale Rate unter „Genauer: Preisentwicklung“ eintragen.
      </p>
    </section>

    <section class="chart-section" aria-labelledby="outlook-chart-title">
      <h2 id="outlook-chart-title">Die Bestandteile Jahr für Jahr</h2>
      <SolarChart spec={outlookSpec(years)} id="price-outlook" scrollable />
    </section>

    <section class="chart-section" aria-labelledby="value-title">
      <h2 id="value-title">Wie viel darf die Anlage kosten?</h2>
      <p>
        Barwert der Stromkosten, die {number(applied.value.kwh)} kWh eigener Solarstrom im Jahr über
        {applied.value.years} Jahre ersparen. Liegt die Anlage samt Wartung darüber, trägt sie sich nur mit
        Einspeisevergütung oder einer steileren Preiskurve.
      </p>
      <dl class="energy-figures">
        {#each cases as c, i}
          <div>
            <dt>{c.label}</dt>
            <dd data-testid={i === 0 ? 'value-own' : undefined}>{currency(c.value)}</dd>
          </div>
        {/each}
      </dl>
      <SolarChart spec={valueSpec(cases)} id="price-value" />
      <p class="field-hint">
        Gleiche Strommenge jedes Jahr, ohne Alterung der Module, ohne Anlagen- und Wartungskosten. Die
        vollständige Wirtschaftlichkeit mit stündlicher Bilanz rechnet der <a href="/">Rechner</a>.
      </p>
    </section>
  </div>
</div>
