<script lang="ts">
import { defaults } from '@/lib/solar/model';
import { type Preset, presets } from '@/lib/solar/presets';
import PresetIcon from './PresetIcon.svelte';

interface Props {
  selected: string;
  onselect: (id: string) => void;
}
let { selected, onselect }: Props = $props();

const description = $derived(presets.find((p) => p.id === selected)?.description);

/** Size, storage and demand of a template in one line. */
function facts(preset: Preset) {
  const values = { ...defaults, ...preset.values };
  const number = (value: number) => value.toLocaleString('de-DE');
  return [
    `${number(values.kwp)} kWp`,
    values.battery ? `${number(values.battery)} kWh Speicher` : 'ohne Speicher',
    `${number(values.household)} kWh/Jahr`,
  ].join(' · ');
}
</script>

<section class="preset-picker" aria-labelledby="preset-heading">
  <div>
    <h2 id="preset-heading">Mit einer Vorlage starten</h2>
    <p>
      Zwölf unterschiedliche Ausgangssituationen. Wähle, was zu deinem Alltag passt, und passe die
      Werte danach an.
    </p>
  </div>
  <fieldset class="preset-choice">
    <legend>Deine Ausgangssituation</legend>
    <div class="preset-list">
      {#each presets as preset}
        {@const [place, situation] = preset.title.split(' · ')}
        <label class="preset-option">
          <input
            type="radio"
            name="preset"
            value={preset.id}
            checked={selected === preset.id}
            onchange={() => onselect(preset.id)}
          />
          <PresetIcon {preset} />
          <span class="preset-text">
            <strong>{place}</strong>
            <span>{situation}</span>
            <span class="preset-facts">{facts(preset)}</span>
          </span>
        </label>
      {/each}
    </div>
    <p class="preset-description" data-testid="preset-description">
      <strong>Startwerte:</strong>
      {description}
    </p>
    <p class="field-hint">
      Beispielannahmen, keine statistischen Durchschnittshaushalte. Auswahl übernimmt Anlage,
      Verbrauch, Speicher, Kosten und Finanzierung. Die Neigung folgt der Montageart der Vorlage.
      Standort, Himmelsrichtung, Inbetriebnahme, Strompreis und Lastspitzen bleiben erhalten. Eigene
      Änderungen werden ersetzt.
    </p>
  </fieldset>
</section>
