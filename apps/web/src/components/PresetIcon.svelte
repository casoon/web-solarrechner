<script lang="ts">
import { energyColors } from '@/lib/solar/energy-display';
import { defaults } from '@/lib/solar/model';
import type { Preset } from '@/lib/solar/presets';

interface Props {
  preset: Preset;
}
let { preset }: Props = $props();

const values = $derived({ ...defaults, ...preset.values });
/** Right edge of the building, where battery, heat pump and cars start. */
const start = $derived(
  { flat: 56, terraced: 54, house: 46, bungalow: 50, large: 50, old: 46 }[preset.home]
);
/** Battery, heat pump and cars stand side by side on the ground line. */
const extras = $derived.by(() => {
  const items: { kind: 'battery' | 'heat' | 'car'; x: number }[] = [];
  let x = start;
  const add = (kind: 'battery' | 'heat' | 'car', width: number) => {
    items.push({ kind, x });
    x += width + 3;
  };
  if (values.battery > 0) add('battery', 9);
  if (values.heat) add('heat', 13);
  if (values.cars > 0) add('car', 18);
  return items;
});
const solar = energyColors.solar;
const storage = energyColors.storage;
</script>

<svg
  viewBox="0 0 104 48"
  width="104"
  height="48"
  aria-hidden="true"
  class="preset-icon"
  fill="#fff"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linejoin="round"
  stroke-linecap="round"
>
  <path d="M2 44.5h100" stroke="#c3ccc1" />
  {#if preset.home === 'flat'}
    <rect x="8" y="6" width="30" height="38.5" />
    {#each [11, 20, 29] as y}{#each [12, 20, 28] as x}<rect
          {x}
          {y}
          width="5"
          height="5"
          stroke-width="1.2"
        />{/each}{/each}
    <rect x="20" y="37" width="6" height="7.5" stroke-width="1.2" />
    <path d="M38 33h13" />
    {#if preset.angle === 90}
      <path d="M38 26h13v7" fill="none" />
      <rect x="41" y="25" width="8" height="9" fill={solar} stroke={solar} />
    {:else if preset.angle === 60}
      <path d="M38 27h13v6" fill="none" />
      <path d="M43 32 49.5 23" stroke={solar} stroke-width="3.2" />
    {:else}
      <path d="M51 33v-6" fill="none" />
      <path d="M41 31.5 49 25.5" stroke={solar} stroke-width="3.2" />
      <path d="M47 27v6" fill="none" stroke-width="1.2" />
    {/if}
  {:else if preset.home === 'terraced'}
    <path d="M2 27 10 17h30l8 10Z" />
    <rect x="4" y="27" width="42" height="17.5" />
    <path d="M18 27v17.5M32 27v17.5" />
    <rect x="19" y="19.5" width="12" height="5" fill={solar} stroke={solar} />
    {#each [8, 22, 36] as x}<rect {x} y="34" width="5" height="10.5" stroke-width="1.2" />{/each}
  {:else if preset.home === 'bungalow'}
    <rect x="4" y="28" width="40" height="16.5" />
    <path d="M2 28h44" stroke-width="2.4" />
    <path d="M9 25.5l9-5M25 25.5l9-5" stroke={solar} stroke-width="3.2" />
    <path d="M17 21v4.5M33 21v4.5" fill="none" stroke-width="1" />
    <rect x="21" y="35" width="6" height="9.5" stroke-width="1.2" />
    <rect x="9" y="32" width="8" height="5" stroke-width="1.2" />
    <rect x="31" y="32" width="8" height="5" stroke-width="1.2" />
  {:else if preset.home === 'large'}
    <rect x="6" y="25" width="36" height="19.5" />
    <path d="M2 26.5 16 11h16l14 15.5Z" />
    <path d="M18 9h12M34.5 11 44.5 22" stroke={solar} stroke-width="3.2" />
    <rect x="21" y="34" width="6" height="10.5" stroke-width="1.2" />
    <rect x="10" y="30" width="7" height="5" stroke-width="1.2" />
    <rect x="31" y="30" width="7" height="5" stroke-width="1.2" />
  {:else}
    {#if preset.home === 'old'}<rect x="10" y="10" width="4" height="10" />{/if}
    <rect x="8" y="24" width="28" height="20.5" />
    <path d="M4 26 22 9l18 17Z" />
    <path d="M27.1 10.8 38.8 21.8" stroke={solar} stroke-width="3.2" />
    <rect x="19" y="34" width="6" height="10.5" stroke-width="1.2" />
    <rect x="11" y="29" width="6" height="5" stroke-width="1.2" />
    {#if preset.home === 'old'}<path d="M14 29v5M11 31.5h6" stroke-width="1" />{/if}
  {/if}
  {#each extras as item}
    {#if item.kind === 'battery'}
      <rect x={item.x} y="29.5" width="9" height="15" rx="1.5" fill="#e3efe8" stroke={storage} />
      <path d="M{item.x + 3} 28h3" stroke={storage} stroke-width="2" />
      <path d="M{item.x + 5} 32.5l-2 4h3l-2 4" fill="none" stroke={storage} stroke-width="1.2" />
    {:else if item.kind === 'heat'}
      <rect x={item.x} y="33" width="13" height="11.5" rx="1" />
      <circle cx={item.x + 6.5} cy="38.75" r="3.3" stroke-width="1.2" />
      <path d="M{item.x + 6.5} 36.4v4.7M{item.x + 4.2} 38.75h4.6" stroke-width="1" />
    {:else}
      {#each values.cars > 1 ? [5, 0] : [0] as offset}
        <g transform="translate({item.x + offset} {offset ? -3.5 : 0})">
          <path d="M0 43v-4.2l3-.8 3.4-4h7l3 4 1.6.6V43Z" />
          <circle cx="4.5" cy="43.5" r="1.9" />
          <circle cx="13.5" cy="43.5" r="1.9" />
        </g>
      {/each}
      {#if values.chargeTime === 'day'}
        <circle cx={item.x + 9} cy="26" r="2.4" fill={solar} stroke="none" />
        <path
          d="M{item.x + 9} 21.5v1.4M{item.x + 9} 29.1v1.4M{item.x + 4.5} 26h1.4M{item.x +
            12.1} 26h1.4"
          stroke={solar}
          stroke-width="1.2"
        />
      {/if}
    {/if}
  {/each}
</svg>
