<script lang="ts">
import { presets } from '@/lib/solar/presets';

interface Props {
  selected: string;
  onselect: (id: string) => void;
}
let { selected, onselect }: Props = $props();

const description = $derived(presets.find((p) => p.id === selected)?.description);
</script>

<section class="preset-picker" aria-labelledby="preset-heading">
  <div class="preset-heading">
    <h2 id="preset-heading">Mit einer Vorlage starten</h2>
    <p>{presets.length} Ausgangssituationen · Werte danach anpassbar</p>
  </div>
  <fieldset class="preset-choice">
    <legend class="visually-hidden">Deine Ausgangssituation</legend>
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
          <strong>{place}</strong>
          <span>{situation}</span>
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
