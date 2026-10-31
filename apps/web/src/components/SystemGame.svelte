<script lang="ts">
import { onMount } from 'svelte';
import {
  advice,
  carBalance,
  climateBalance,
  climateSpec,
  conditions,
  facts,
  fromParams,
  grossDemand,
  heatBalance,
  monthSpec,
  presets,
  switchEffect,
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
const climate = $derived(result ? climateBalance(applied, result) : undefined);
const climateChart = $derived(result ? climateSpec(applied, result) : undefined);
const hard = $derived(checks.filter((c) => c.hard));
const soft = $derived(checks.filter((c) => !c.hard));
const heat = $derived(heatBalance(applied));
const fleet = $derived(carBalance(applied));
const savings = $derived(switchEffect(applied));
const pct = (part: number, whole: number) => `${number(whole ? (part / whole) * 100 : 0)} %`;
const t = (n: number) => number(n, 1);
/** Short figure under each verdict tile. */
function headline(id: string) {
  if (id === 'supply' && result)
    return result.unservedHours === 0
      ? 'keine Stunde ohne Strom'
      : `${number(result.unservedHours)} Stunden ohne Strom`;
  if (id === 'climate' && climate)
    return `${number(climate.emitted, 1)} von ${number(climate.allowed, 1)} Mt CO₂`;
  return '';
}

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
      <NumberField label="Bevölkerung" bind:value={input.population} unit="Mio." min={50} max={100} step={0.1} slider hint="Ende 2024: 83,6 Mio. Die amtliche Vorausberechnung reicht für 2070 je nach Variante von 67,0 bis 83,2 Mio. Skaliert heutigen Verbrauch, Wärmebedarf und Pkw-Bestand." />
      <NumberField label="Heutiger Verbrauch" bind:value={input.baseDemand} unit="TWh" max={1000} step={5} hint="Netzlast 2024 ohne neue Verbraucher, im Stundenverlauf von 2024, für 83,6 Mio. Menschen." />
      <NumberField label="Industrie, Rechenzentren und mehr" bind:value={input.extraDemand} unit="TWh" max={800} step={10} slider hint="Zusätzlicher Bedarf, gleichmäßig über alle Stunden." />
    </fieldset>
    <fieldset class="input-section">
      <legend><span class="step">3</span> Heizen und Autofahren</legend>
      <NumberField label="Wärmepumpen" bind:value={input.heatPumps} unit="Mio." max={40} step={0.5} slider hint={`Decken ${pct(heat.pumped, heat.demand)} der Gebäudewärme. Den Rest heizen Wärmenetze und Öl- und Gaskessel.`} />
      <NumberField label="Strom je Wärmepumpe" bind:value={input.heatPumpKwh} unit="kWh/Jahr" max={15000} step={100} hint="Mit einer Jahresarbeitszahl von 3 wird daraus dreimal so viel Wärme." />
      <NumberField label="Sanierung" bind:value={input.retrofit} unit="% weniger Wärme" max={60} step={5} slider hint="Gedämmte Häuser brauchen weniger Wärme, gemessen am Bedarf 2025." />
      <NumberField label="Wärmenetze" bind:value={input.heatNetworks} unit="% der Wärme" max={60} step={5} slider hint="Angenommen klimaneutral, ohne eigenen Strombedarf." />
      <NumberField label="Elektroautos" bind:value={input.cars} unit="Mio." max={60} step={1} slider hint={`${pct(fleet.electric, fleet.fleet)} von ${number(fleet.fleet, 1)} Mio. Pkw. Die übrigen fahren mit Benzin oder Diesel.`} />
      <NumberField label="Strom je Elektroauto" bind:value={input.carKwh} unit="kWh/Jahr" max={10000} step={100} />
    </fieldset>
    <fieldset class="input-section">
      <legend><span class="step">4</span> Erzeugung</legend>
      <NumberField label="Photovoltaik" bind:value={input.solar} unit="GW" max={800} step={5} slider />
      <NumberField label="Wind an Land" bind:value={input.windOnshore} unit="GW" max={300} step={5} slider />
      <NumberField label="Wind auf See" bind:value={input.windOffshore} unit="GW" max={120} step={1} slider />
      <NumberField label="Biomasse gegenüber 2024" bind:value={input.biomass} unit="%" max={200} step={5} />
      <NumberField label="Kohlekraftwerke" bind:value={input.coal} unit="GW" max={45} step={1} slider />
    </fieldset>
    <fieldset class="input-section">
      <legend><span class="step">5</span> Puffer und Reserven</legend>
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
        <ul class="verdict-tiles">
          {#each hard as c}
            <li class:ok={c.ok} data-testid={`condition-${c.id}`}>
              <span class="mark" aria-hidden="true">{c.ok ? '✓' : '✗'}</span>
              <span class="tile-text"
                ><strong>{c.label} {c.ok ? 'erreicht' : 'verfehlt'}</strong><span>{headline(c.id)}</span></span
              >
              <details>
                <summary>Warum?</summary>
                <p>{c.text}</p>
                {#if c.id === 'supply'}<p>
                    Gerechnet wird jede Stunde mit dem Wetter von 2024. Fehlt Strom, helfen Speicher,
                    Gaskraftwerke mit Wasserstoff oder Austausch mit den Nachbarn, nicht mehr Sonne im Sommer.
                  </p>{/if}
                {#if c.id === 'climate' && climate}<p>
                    Strom {t(climate.parts[0].emitted)} Mt, Heizen {t(climate.parts[1].emitted)} Mt,
                    Autofahren {t(climate.parts[2].emitted)} Mt. Jede Wärmepumpe spart im Heizungskeller
                    rund {t(savings.heatPump)} t CO₂ im Jahr; ihr Strom aus einem Erdgaskraftwerk verursacht
                    {t(savings.heatPumpOnGas)} t. Ein Elektroauto spart {t(savings.car)} t, sein Strom aus Gas
                    kostet {t(savings.carOnGas)} t. Weniger Wärmepumpen entlasten also das Stromnetz, aber nicht
                    das Klima. Eine Infrarot- oder andere Direktstromheizung bräuchte für dieselbe Wärme
                    dreimal so viel Strom wie die Wärmepumpe.
                  </p>{/if}
              </details>
            </li>
          {/each}
        </ul>
        <ul class="conditions">
          {#each soft as c}
            <li class:ok={c.ok} class="soft" data-testid={`condition-${c.id}`}>
              <strong>{c.ok ? '✓' : '!'} {c.label}<span class="soft-label">Hinweis</span></strong>
              <span>{c.text}</span>
            </li>
          {/each}
        </ul>
        {#if tips.length}<div class="tips"><strong>Was hilft:</strong> {tips.join(' ')}</div>{/if}
        <button type="button" class="text-button" onclick={share}>
          {copied ? 'Link kopiert' : 'Szenario als Link teilen'}
        </button>
      </section>

      {#if climateChart}<section class="chart-section" aria-labelledby="game-climate-title">
          <h2 id="game-climate-title">Klimabilanz: Strom, Heizen, Autofahren</h2>
          <p class="field-hint">
            Was Kraftwerke, Öl- und Gasheizungen und Verbrenner {applied.year} ausstoßen, gegen den Pfad
            des Klimaschutzgesetzes. Ein Bereich darf über seinem Anteil liegen, wenn ein anderer darunter
            bleibt, denn es zählt die Summe.
          </p>
          <SolarChart spec={climateChart} id="game-climate" />
        </section>{/if}

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
  .verdict-tiles {
    list-style: none;
    padding: 0;
    margin: 16px 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
    align-items: start;
  }
  .verdict-tiles li {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 6px 14px;
    padding: 14px 16px;
    border-radius: 10px;
    background: rgb(255 255 255 / 0.08);
  }
  .verdict-tiles .mark {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #ffc2b8;
    color: #6b2a22;
    font-size: 24px;
    font-weight: 800;
  }
  .verdict-tiles li.ok .mark {
    background: #b9e6c4;
    color: #183b32;
  }
  .tile-text {
    display: grid;
    gap: 2px;
  }
  .tile-text strong {
    font-size: 17px;
  }
  .verdict-tiles details {
    grid-column: 1 / -1;
    font-size: 14px;
  }
  .verdict-tiles summary {
    cursor: pointer;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .verdict-tiles details p {
    margin: 8px 0 0;
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
