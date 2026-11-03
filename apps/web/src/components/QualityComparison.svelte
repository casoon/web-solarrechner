<script lang="ts">
import { currency as euro, number } from '@/lib/solar/format';
import type { SolarProfile } from '@/lib/solar/model';
import {
  compareQuality,
  type Grade,
  grades,
  type QualityInputs,
  qualityDefaults,
  type Variant,
  validateQuality,
  valueSpec,
  yieldSpec,
} from '@/lib/solar/quality';
import reference from '@/lib/solar/reference.json';
import NumberField from './NumberField.svelte';
import SolarChart from './SolarChart.svelte';

const profile = reference as SolarProfile;
const clone = (v: QualityInputs): QualityInputs => ({ ...v, a: { ...v.a }, b: { ...v.b } });
let input = $state<QualityInputs>(clone(qualityDefaults));
let applied = $state<QualityInputs>(clone(qualityDefaults));
const validation = $derived(validateQuality(input));
$effect(() => {
  const current = $state.snapshot(input);
  if (!validation) applied = current;
});
const result = $derived(compareQuality(profile, applied));
const value = $derived(valueSpec(result, applied.premium));
const yields = $derived(yieldSpec(result));
const parts: { key: keyof Variant; label: string }[] = [
  { key: 'module', label: 'Module' },
  { key: 'inverter', label: 'Wechselrichter' },
  { key: 'storage', label: 'Speicher' },
];
const gradeLabel = (g: Grade) => grades.find((x) => x.key === g)?.label ?? g;
const kwh = (n: number) => `${number(n)} kWh`;
</script>

<div class="calculator-layout">
  <form class="controls" onsubmit={(e) => e.preventDefault()} aria-label="Annahmen zum Qualitätsvergleich">
    <fieldset class="input-section">
      <legend><span class="step">1</span> Zwei Varianten</legend>
      <div class="variant-grid">
        <span aria-hidden="true">Variante A</span><span aria-hidden="true">Variante B</span>
        {#each parts as p}
          <span class="variant-part" aria-hidden="true">{p.label}</span>
          <select aria-label={`${p.label} A`} bind:value={input.a[p.key]}>
            {#each grades as g}<option value={g.key}>{g.label}</option>{/each}
          </select>
          <select aria-label={`${p.label} B`} bind:value={input.b[p.key]}>
            {#each grades as g}<option value={g.key}>{g.label}</option>{/each}
          </select>
        {/each}
      </div>
      <NumberField
        label="Aufpreis von A gegenüber B"
        bind:value={input.premium}
        unit="€"
        max={20000}
        step={100}
        slider
        hint="Was die bessere Ausstattung im Angebot mehr kostet, einmalig bei der Anschaffung."
      />
    </fieldset>
    <fieldset class="input-section">
      <legend><span class="step">2</span> Anlage und Haushalt</legend>
      <NumberField label="Modulleistung Variante A" bind:value={input.kwp} unit="kWp" min={1} max={30} step={0.5} slider />
      <label class="check">
        <input type="checkbox" bind:checked={input.roofLimited} />
         Dachfläche ist der Engpass
      </label>
      <p class="field-hint">
        Dann passt mit Modulen geringeren Wirkungsgrads weniger Leistung aufs Dach. Ohne Haken haben beide
        Varianten dieselbe Leistung in kWp.
      </p>
      <NumberField label="Speicher (nutzbar)" bind:value={input.battery} unit="kWh" max={30} step={1} slider />
      <NumberField label="Haushaltsverbrauch" bind:value={input.household} unit="kWh/Jahr" min={500} max={20000} step={100} />
      <NumberField
        label="Einspeisegrenze"
        bind:value={input.exportLimit}
        unit="% der kWp"
        max={100}
        step={10}
        hint="60 % gelten für neue Anlagen ohne Steuerbox. Was darüber liegt, wird abgeregelt, wenn Haus und Speicher es nicht aufnehmen."
      />
    </fieldset>
    <fieldset class="input-section">
      <legend><span class="step">3</span> Preise und Zeitraum</legend>
      <NumberField label="Strompreis" bind:value={input.price} unit="€/kWh" max={1} step={0.01} />
      <NumberField label="Preisänderung pro Jahr" bind:value={input.priceChange} unit="%" min={-5} max={10} step={0.5} />
      <NumberField label="Einspeisevergütung" bind:value={input.feedIn} unit="€/kWh" max={0.3} step={0.001} />
      <NumberField label="Vergütung für" bind:value={input.feedInYears} unit="Jahre" max={30} step={1} hint="Danach bringt eingespeister Strom im Modell nichts mehr." />
      <NumberField label="Betrachtungszeitraum" bind:value={input.years} unit="Jahre" min={1} max={30} step={1} slider />
      <NumberField label="Kalkulationszins" bind:value={input.discount} unit="%" max={15} step={0.5} />
      <button type="button" class="text-button" onclick={() => (input = clone(qualityDefaults))}>
        Annahmen zurücksetzen
      </button>
    </fieldset>
  </form>

  <div class="results">
    {#if validation}<p class="error" role="alert">
        {validation} Angezeigt bleibt die letzte gültige Rechnung.
      </p>{/if}
    <section class="result-summary" aria-labelledby="quality-title">
      <div class="summary-heading"><h2 id="quality-title">Was die bessere Variante bringt</h2></div>
      <dl class="key-results">
        <div>
          <dt>Mehr Solarertrag im ersten Jahr</dt>
          <dd data-testid="quality-share">{number(result.firstYearShare * 100, 1)}&nbsp;%</dd>
        </div>
        <div>
          <dt>Mehrertrag in {applied.years} Jahren</dt>
          <dd>{kwh(result.pvA - result.pvB)}</dd>
        </div>
        <div>
          <dt>Mehrwert in {applied.years} Jahren</dt>
          <dd data-testid="quality-gain">{euro(result.gain)}</dd>
        </div>
        <div>
          <dt>Nach Abzug des Aufpreises, Barwert</dt>
          <dd>{euro(result.netNpv)}</dd>
        </div>
      </dl>
      <p>
        {#if applied.premium === 0}
          Ohne Aufpreis ist Variante A ab dem ersten Jahr im Vorteil.
        {:else if result.breakEven}
          Der Aufpreis von {euro(applied.premium)} ist in Jahr {result.breakEven} wieder eingespielt.
        {:else}
          Der Aufpreis von {euro(applied.premium)} wird in {applied.years} Jahren nicht eingespielt.
        {/if}
        Wert heißt: weniger Netzbezug zum Strompreis und mehr Einspeisung zur Vergütung. Mehrertrag fällt
        meist mittags im Sommer an, wenn das Haus schon versorgt ist; er wird dann eingespeist oder
        abgeregelt und ist deshalb weniger wert als gesparter Netzstrom.
      </p>
    </section>

    <section class="comparison" aria-labelledby="quality-parts-title">
      <h2 id="quality-parts-title">Was jede Komponente ausmacht</h2>
      <div class="table-scroll" role="region" aria-label="Beitrag der Komponenten, Tabelle" tabindex="0">
        <table class="storage-table" aria-labelledby="quality-parts-title">
          <thead>
            <tr>
              <th scope="col">Komponente</th>
              <th scope="col">A</th>
              <th scope="col">B</th>
              <th scope="col">Mehrertrag in {applied.years} J.</th>
              <th scope="col">Mehrwert in {applied.years} J.</th>
            </tr>
          </thead>
          <tbody>
            {#each result.parts as p}
              <tr>
                <th scope="row">{p.label}</th>
                <td>{gradeLabel(applied.a[p.key])}</td>
                <td>{gradeLabel(applied.b[p.key])}</td>
                <td>{p.same ? '–' : kwh(p.pv)}</td>
                <td>{p.same ? '–' : euro(p.value)}</td>
              </tr>{/each}
            <tr>
              <th scope="row">Alles zusammen</th>
              <td></td>
              <td></td>
              <td>{kwh(result.pvA - result.pvB)}</td>
              <td>{euro(result.gain)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="field-hint">
        Je Zeile wird Variante B gerechnet, in der nur diese Komponente die Güte von A hat. Die Zeilen
        ergeben zusammen nicht genau die Summe, weil sich Komponenten gegenseitig beeinflussen: Ein
        sparsamer Speicher nützt mehr, wenn mehr Solarstrom ankommt. Der Speicher ändert den Solarertrag
        nicht, nur wie viel davon im Haus ankommt.
      </p>
    </section>

    <section class="chart-section" aria-labelledby="quality-value-title">
      <h2 id="quality-value-title">Wann sich der Aufpreis einspielt</h2>
      <SolarChart spec={value} id="quality-value" />
    </section>
    <section class="chart-section" aria-labelledby="quality-yield-title">
      <h2 id="quality-yield-title">Solarertrag je Jahr</h2>
      <SolarChart spec={yields} id="quality-yield" />
      <p class="field-hint">
        Erzeugung hinter dem Wechselrichter vor Abregelung. Die Linien gehen auseinander, weil einfache
        Module schneller altern.
      </p>
    </section>
  </div>
</div>

<style>
  .variant-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.25rem 0.5rem;
    align-items: end;
    margin-block-end: 1rem;
    font-size: 0.9rem;
  }
  .variant-part {
    grid-column: 1 / -1;
    margin-block-start: 0.5rem;
    font-weight: 600;
  }
  .variant-grid select {
    min-width: 0;
  }
</style>
