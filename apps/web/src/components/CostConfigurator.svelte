<script lang="ts">
import type { Inputs } from '@/lib/solar/model';
import {
  cabinetPrice,
  estimateCosts,
  type PriceLevel,
  resolveCosts,
  type WorkOptions,
  workItems,
  workPrice,
} from '@/lib/solar/presets';
import NumberField from './NumberField.svelte';

let {
  input = $bindable(),
  work = $bindable(),
  level = $bindable(),
  automatic = $bindable(),
}: { input: Inputs; work: WorkOptions; level: PriceLevel; automatic: boolean } = $props();
const euro = (value: number) =>
  value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const resolved = $derived(resolveCosts(input, work, level));
const extraCost = $derived(
  resolved.installation + resolved.electrics - input.installation - input.electrics
);
function setOrientation(next: PriceLevel) {
  level = next;
  automatic = true;
  const estimated = estimateCosts(input, next);
  input = {
    ...input,
    equipment: estimated.equipment,
    installation: estimated.installation,
    electrics: estimated.electrics,
    batteryCost: estimated.batteryCost,
  };
  work = { ...work, overrides: {} };
}
</script>

<div class="cost-guide">
  <h3>Kosten schnell einschätzen</h3>
  <p class="field-hint">
    Richtwerte passend zur Anlagen- und Speichergröße. Eigene Angebote kannst du unten eintragen.
  </p>
  <div class="segmented" role="group" aria-label="Preisorientierung">
    <button
      type="button"
      class:active={level === 'low'}
      aria-pressed={level === 'low'}
      onclick={() => setOrientation('low')}
    >
      Günstig
    </button>
    <button
      type="button"
      class:active={level === 'orientation'}
      aria-pressed={level === 'orientation'}
      onclick={() => setOrientation('orientation')}
    >
      Orientierung
    </button>
    <button
      type="button"
      class:active={level === 'high'}
      aria-pressed={level === 'high'}
      onclick={() => setOrientation('high')}
    >
      Aufwendig
    </button>
  </div>
  <p class="field-hint">
    Mit Eigenleistung lässt sich die Anlage noch etwas günstiger rechnen, etwa bei der Montage. Ziel
    dieses Rechners ist aber eine realistische Kalkulation mit Fachbetrieb. Anschluss, Zählerschrank
    und Inbetriebnahme gehören in die Hand einer Elektrofachkraft: Ein Fehler dort kostet später
    mehr, als die Eigenleistung spart.
  </p>
  <details class="cost-extras">
    <summary>Zusatzarbeiten & Eigenleistung · {euro(extraCost)}</summary>
    <p class="field-hint">
      Nur Kosten ergänzen, die im Basisangebot fehlen. Die Grundkosten für Material,
      Elektroanschluss und Prüfung bleiben auch ohne Montageservice bestehen.
    </p>
    <label for="cabinet">Zählerschrank im Bestand</label>
    <select
      id="cabinet"
      value={work.cabinet}
      onchange={(event) => {
        work = {
          ...work,
          cabinet: event.currentTarget.value as WorkOptions['cabinet'],
          overrides: { ...work.overrides, cabinet: undefined },
        };
      }}
    >
      <option value="ready">Passend vorhanden / bereits im Angebot</option>
      <option value="upgrade">Anpassung / zusätzlicher Zählerplatz nötig</option>
      <option value="new">Komplett neuer Zählerschrank nötig</option>
    </select>
    {#if work.cabinet !== 'ready'}
      <NumberField
        label="Zusatzbudget Zählerschrank"
        unit="€"
        max={15000}
        step={50}
        bind:value={
          () => work.overrides.cabinet ?? cabinetPrice(work.cabinet, level),
          (value) => (work.overrides = { ...work.overrides, cabinet: value ?? Number.NaN })
        }
      />
      <p class="field-hint">
        Modellspanne {euro(cabinetPrice(work.cabinet, 'low'))}–{euro(
          cabinetPrice(work.cabinet, 'high'),
        )}. {work.cabinet === 'new'
          ? 'Neuer Schrank einschließlich Standard-Hauptleitungs- und Überspannungsschutz: diese Posten werden unten nicht nochmals addiert.'
          : 'Nur die Schrankanpassung; weitere fehlende Schutzbauteile bei Bedarf unten ergänzen.'}
      </p>
    {/if}
    {#each workItems as item}
      {@const bundled = work.cabinet === 'new' && (item.key === 'surge' || item.key === 'sls')}
      <div class="work-option">
        <label class="check">
          <input
            type="checkbox"
            checked={bundled || work[item.key]}
            disabled={bundled}
            onchange={(event) => (work[item.key] = event.currentTarget.checked)}
          />
          <span>{item.label}</span>
        </label>
        {#if bundled}<p class="field-hint">Im Budget für den neuen Zählerschrank enthalten.</p>
        {:else if work[item.key]}
          <NumberField
            label={`Budget: ${item.label}`}
            unit="€"
            max={20000}
            step={50}
            bind:value={
              () => work.overrides[item.key] ?? workPrice(item.key, input, level),
              (value) => (work.overrides = { ...work.overrides, [item.key]: value ?? Number.NaN })
            }
          />
          <p class="field-hint">
            Modellspanne {euro(workPrice(item.key, input, 'low'))}–{euro(
              workPrice(item.key, input, 'high'),
            )}. {item.hint}
          </p>
        {:else}<p class="field-hint">Nicht zusätzlich berechnet. {item.hint}</p>{/if}
      </div>
    {/each}
    <p class="cost-subtotal">
      Gewählte Arbeiten zusätzlich zur Basis: <strong data-testid="extra-work-total">
        {euro(extraCost)}
      </strong>
    </p>
    <p class="field-hint">
      Eigenleistung ist hier ein Kostenvergleich, keine Freigabe für Elektroarbeiten. Ob Schrank,
      Schutz und Leitungen passen, klärt der Fachbetrieb.
    </p>
  </details>
  <details>
    <summary>Genauer: Richtwerte und Preisgrundlage</summary>
    <label class="check">
      <input type="checkbox" bind:checked={automatic} />
       Richtwerte an Anlagen- und Speichergröße anpassen
    </label>
    <p class="field-hint">
      Modellspanne: −20 % bis +30 % um eine größenabhängige Orientierung aus Angeboten 2025–August
      2026. Kein Live-Marktpreis. Aufteilung in Material und Arbeitslohn ist eine eigene Annahme.
      Alle Beträge lassen sich anpassen.
    </p>
    <button type="button" class="text-button" onclick={() => setOrientation(level)}>
      Richtwerte für aktuelle Größe neu berechnen
    </button>
    <p class="field-hint">
      <a
        href="https://www.verbraucherzentrale.nrw/wissen/energie/erneuerbare-energien/was-kostet-eine-photovoltaikanlage-49155"
      >
        Verbraucherzentrale NRW: Angebotsauswertung, Stand 28.08.2026
      </a>. Die Auswertung zeigt die Größenabhängigkeit und Streuung; sie garantiert keinen heutigen
      Angebotspreis. Unsere Kurve, die ±-Spanne und Einzelbudgets sind Modellannahmen. Für
      Schrank-/Schutzarbeiten dient außerdem
      <a href="https://volt-e.de/kosten-zaehlerschrank">
        eine Preisübersicht des Anbieters Volt Energie
      </a>
       als grober Vergleich, kein neutraler Marktindex. Abruf: 28.10.2026.
    </p>
  </details>
</div>
