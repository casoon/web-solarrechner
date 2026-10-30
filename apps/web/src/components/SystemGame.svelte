<script lang="ts">
import { onMount } from 'svelte';
import {
  advice,
  conditions,
  facts,
  fromParams,
  grossDemand,
  monthSpec,
  presets,
  type TargetYear,
  targetYears,
  toParams,
  weekSpec,
} from '@/lib/energy/game';
import { type Profiles, type SystemInputs, simulate, validateSystem } from '@/lib/energy/system';
import { number } from '@/lib/solar/format';
import NumberField from './NumberField.svelte';
import SolarChart from './SolarChart.svelte';

let profiles = $state<Profiles>();
let loadError = $state('');
let input = $state<SystemInputs>({ ...presets[2045] });
let applied = $state<SystemInputs>({ ...presets[2045] });
let copied = $state(false);

onMount(() => {
  const shared = fromParams(location.search);
  if (shared) {
    input = shared;
    applied = { ...shared };
  }
  fetch('/data/energy/stunden-2024.json')
    .then((r) => {
      if (!r.ok) throw new Error();
      return r.json();
    })
    .then((data: Profiles) => {
      profiles = data;
    })
    .catch(() => {
      loadError = 'Die Wetterdaten konnten nicht geladen werden. Bitte die Seite neu laden.';
    });
});

const validation = $derived(validateSystem(input));
$effect(() => {
  const current = $state.snapshot(input);
  if (!validation) applied = current;
});
const result = $derived(profiles ? simulate(profiles, applied, facts.factors) : undefined);
const checks = $derived(result ? conditions(applied, result) : []);
const failed = $derived(checks.filter((c) => c.hard && !c.ok));
const tips = $derived(result ? advice(applied, result, failed) : []);
const week = $derived(result ? weekSpec(result, 2024) : undefined);
const months = $derived(result ? monthSpec(result, 2024) : undefined);

function choose(year: TargetYear) {
  input = { ...presets[year] };
}
async function share() {
  const url = `${location.origin}${location.pathname}?${toParams(applied)}`;
  history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url);
    copied = true;
    setTimeout(() => (copied = false), 2500);
  } catch {
    copied = false;
  }
}
const twh = (n: number) => `${number(n / 1e3)} TWh`;
</script>

<div class="calculator-layout">
  <form class="controls" onsubmit={(e) => e.preventDefault()} aria-label="Stromsystem einstellen">
    <fieldset class="input-section">
      <legend><span class="step">1</span> Zieljahr</legend>
      <div class="year-switch" role="group" aria-label="Zieljahr wählen">
        {#each targetYears as y}
          <button type="button" aria-pressed={input.year === y} onclick={() => choose(y)}>{y}</button>
        {/each}
      </div>
      <p class="field-hint">
        Lädt die Ausbauziele für Sonne und Wind und passende Annahmen für alles andere. Danach ist
        jeder Regler frei.
      </p>
    </fieldset>
    <fieldset class="input-section">
      <legend><span class="step">2</span> Bedarf</legend>
      <NumberField label="Heutiger Verbrauch" bind:value={input.baseDemand} unit="TWh" max={1000} step={5} hint="Netzlast 2024 ohne neue Verbraucher, im Stundenverlauf von 2024." />
      <NumberField label="Wärmepumpen" bind:value={input.heatPumps} unit="Mio." max={25} step={0.5} slider />
      <NumberField label="Strom je Wärmepumpe" bind:value={input.heatPumpKwh} unit="kWh/Jahr" max={15000} step={100} />
      <NumberField label="Elektroautos" bind:value={input.cars} unit="Mio." max={50} step={1} slider />
      <NumberField label="Strom je Elektroauto" bind:value={input.carKwh} unit="kWh/Jahr" max={10000} step={100} />
      <NumberField label="Industrie, Rechenzentren und mehr" bind:value={input.extraDemand} unit="TWh" max={800} step={10} slider hint="Zusätzlicher Bedarf, gleichmäßig über alle Stunden." />
    </fieldset>
    <fieldset class="input-section">
      <legend><span class="step">3</span> Erzeugung</legend>
      <NumberField label="Photovoltaik" bind:value={input.solar} unit="GW" max={800} step={5} slider />
      <NumberField label="Wind an Land" bind:value={input.windOnshore} unit="GW" max={300} step={5} slider />
      <NumberField label="Wind auf See" bind:value={input.windOffshore} unit="GW" max={120} step={1} slider />
      <NumberField label="Biomasse gegenüber 2024" bind:value={input.biomass} unit="%" max={200} step={5} />
      <NumberField label="Kohlekraftwerke" bind:value={input.coal} unit="GW" max={45} step={1} slider />
    </fieldset>
    <fieldset class="input-section">
      <legend><span class="step">4</span> Puffer und Reserven</legend>
      <NumberField label="Batterie- und Pumpspeicher" bind:value={input.battery} unit="GW" max={300} step={5} slider hint="Heute knapp 16 GW Batterien und knapp 10 GW Pumpspeicher." />
      <NumberField label="Speicherdauer" bind:value={input.batteryHours} unit="h" min={0.5} max={12} step={0.5} />
      <NumberField label="Gaskraftwerke" bind:value={input.gasPlants} unit="GW" max={150} step={5} slider hint="Verbrennen Wasserstoff, solange der Speicher etwas hergibt, sonst Erdgas." />
      <NumberField label="Elektrolyse" bind:value={input.electrolysis} unit="GW" max={200} step={5} slider hint="Läuft nur mit Überschussstrom." />
      <NumberField label="Wasserstoffspeicher" bind:value={input.hydrogenStore} unit="TWh" max={300} step={5} slider />
      <NumberField label="Wasserstoffimport" bind:value={input.hydrogenImport} unit="TWh/Jahr" max={600} step={10} />
      <NumberField label="Stromaustausch mit Nachbarn" bind:value={input.imports} unit="GW" max={60} step={1} slider />
      <button type="button" class="text-button" onclick={() => choose(input.year)}>
        Zurück auf die Vorgabe für {input.year}
      </button>
    </fieldset>
  </form>

  <div class="results">
    {#if validation}<p class="error" role="alert">
        {validation} Angezeigt bleibt die letzte gültige Rechnung.
      </p>{/if}
    {#if loadError}<p class="error" role="alert">{loadError}</p>{/if}
    {#if !result && !loadError}<p aria-live="polite">Wetterdaten werden geladen …</p>{/if}
    {#if result}
      <section
        class="result-summary verdict"
        class:won={failed.length === 0}
        aria-labelledby="game-title"
        aria-live="polite"
      >
        <div class="summary-heading">
          <h2 id="game-title" data-testid="verdict">
            {failed.length === 0 ? `Geschafft: das Stromsystem ${applied.year} hält` : `Verloren: ${failed.map((c) => c.label).join(' und ')} verfehlt`}
          </h2>
          <span>Wetter des Jahres 2024, Stunde für Stunde</span>
        </div>
        <ul class="conditions">
          {#each checks as c}
            <li class:ok={c.ok} class:soft={!c.hard} data-testid={`condition-${c.id}`}>
              <strong
                >{c.ok ? '✓' : c.hard ? '✗' : '!'}
                {c.label}{#if !c.hard}<span class="soft-label">Hinweis</span>{/if}</strong
              >
              <span>{c.text}</span>
            </li>
          {/each}
        </ul>
        {#if tips.length}<div class="tips"><strong>Was hilft:</strong> {tips.join(' ')}</div>{/if}
        <button type="button" class="text-button" onclick={share}>
          {copied ? 'Link kopiert' : 'Szenario als Link teilen'}
        </button>
      </section>

      <section class="comparison" aria-labelledby="game-balance-title">
        <h2 id="game-balance-title">Jahresbilanz</h2>
        <dl class="energy-figures">
          <div><dt>Bedarf ohne Elektrolyse</dt><dd>{twh(result.demand)}</dd></div>
          <div><dt>Bruttobedarf mit Elektrolyse</dt><dd>{number(grossDemand(result))} TWh</dd></div>
          <div><dt>Wind und Sonne erzeugen</dt><dd>{twh(result.weather)}</dd></div>
          <div><dt>Abgeregelt</dt><dd>{twh(result.curtailed)}</dd></div>
          <div><dt>Strom aus Wasserstoff</dt><dd>{twh(result.hydrogenPower)}</dd></div>
          <div><dt>Strom aus Erdgas</dt><dd>{twh(result.gasPower)}</dd></div>
          <div><dt>Strom aus Kohle</dt><dd>{twh(result.coalPower)}</dd></div>
          <div><dt>Stromimport</dt><dd>{twh(result.imported)}</dd></div>
        </dl>
      </section>

      {#if week}<section class="chart-section" aria-labelledby="game-week-title">
          <h2 id="game-week-title">Die schwierigste Woche</h2>
          <SolarChart spec={week} id="game-week" scrollable />
        </section>{/if}
      {#if months}<section class="chart-section" aria-labelledby="game-month-title">
          <h2 id="game-month-title">Das Jahr Monat für Monat</h2>
          <SolarChart spec={months} id="game-months" />
        </section>{/if}
    {/if}
  </div>
</div>

<style>
  .year-switch {
    display: flex;
    gap: 8px;
  }
  .year-switch button {
    flex: 1;
    padding: 8px 0;
    border: 1px solid var(--line, #c9c9c9);
    border-radius: 6px;
    background: transparent;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .year-switch button[aria-pressed='true'] {
    background: var(--ink, #1f2a2a);
    color: var(--paper, #fff);
  }
  .verdict {
    background: #6b2a22;
  }
  .verdict.won {
    background: #183b32;
  }
  .verdict .text-button {
    color: inherit;
  }
  .tips {
    margin-bottom: 12px;
    font-size: 14px;
  }
  .conditions {
    list-style: none;
    padding: 0;
    margin: 12px 0;
    display: grid;
    gap: 8px;
  }
  .conditions li {
    display: grid;
    gap: 2px;
  }
  .conditions li strong {
    color: #ffc2b8;
  }
  .conditions li.soft strong {
    color: #f1d57b;
  }
  .conditions li.ok strong {
    color: #b9e6c4;
  }
  .soft-label {
    margin-left: 6px;
    font-size: 11px;
    font-weight: 600;
    opacity: 0.8;
  }
</style>
