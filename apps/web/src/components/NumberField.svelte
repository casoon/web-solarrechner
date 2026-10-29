<script lang="ts">
let {
  label,
  value = $bindable(),
  unit = '',
  min = 0,
  max = 100000,
  step = 1,
  slider = false,
  hint = '',
  disabled = false,
}: {
  label: string;
  value: number;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  slider?: boolean;
  hint?: string;
  disabled?: boolean;
} = $props();
const id = $props.id();
</script>

<div class="number-field">
  <div class="field-line">
    <label for={id}>{label}</label>
    <div class="number-unit">
      <input
        {id}
        type="number"
        {disabled}
        {min}
        {max}
        {step}
        bind:value
        inputmode="decimal"
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      <span>{unit}</span>
    </div>
  </div>
  {#if slider}<input
      type="range"
      {min}
      {max}
      {step}
      bind:value
      aria-label={`${label} – Schieberegler`}
    />{/if}
  {#if hint}<p id={`${id}-hint`} class="field-hint">{hint}</p>{/if}
</div>
