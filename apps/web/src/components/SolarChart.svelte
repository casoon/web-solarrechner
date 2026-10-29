<script lang="ts">
import type { ChartRenderer } from '@casoon/chartlet/wasm';
import { onMount } from 'svelte';

let {
  spec,
  id,
  scrollable = false,
}: { spec: Record<string, unknown>; id: string; scrollable?: boolean } = $props();
let renderer = $state<ChartRenderer>();
let error = $state('');
onMount(() => {
  let disposed = false;
  Promise.all([import('@casoon/chartlet/wasm'), import('@casoon/chartlet/chartlet.wasm?url')])
    .then(async ([api, asset]) => {
      const response = await fetch(asset.default);
      if (!response.ok) throw new Error('Chartlet-Datei nicht erreichbar');
      const module = await WebAssembly.compile(await response.arrayBuffer());
      if (!disposed) renderer = api.createRenderer(module);
    })
    .catch(() => {
      if (!disposed)
        error =
          'Das Diagramm konnte nicht geladen werden. Die Werte stehen weiterhin in den Tabellen.';
    });
  return () => {
    disposed = true;
  };
});
const chart = $derived.by(() => {
  if (!renderer) return '';
  try {
    // Dynamic SVG style blocks are blocked by CSP. Its allowed style attributes carry
    // the same Chartlet tokens without changing the site's security policy.
    const tokens = spec.tokens as Record<string, string> | undefined;
    const rendered = renderer.renderChart(
      { ...spec, tokens: undefined },
      { format: 'svg', styles: 'external', idPrefix: id }
    ).content;
    const palette = Object.entries(tokens ?? {})
      .map(([name, value]) => `--chartlet-${name}:${value}`)
      .join(';');
    return palette ? rendered.replace('<svg ', `<svg style="${palette}" `) : rendered;
  } catch {
    return '';
  }
});
</script>

{#if scrollable}<p class="scroll-hint">
    Diagramm seitlich verschieben: mit Wischen, Scrollen oder den Pfeiltasten.
  </p>{/if}
<div
  class="solar-chart"
  class:scrollable
  role={scrollable ? 'region' : undefined}
  aria-label={scrollable ? String(spec.title) : undefined}
  tabindex={scrollable ? 0 : undefined}
  aria-busy={!renderer && !error}
>
  {#if chart}{@html chart}{:else}<p class="chart-status">
      {error ||
        (renderer
          ? 'Diagrammdaten nicht darstellbar. Bitte die Tabelle verwenden.'
          : 'Diagramm wird geladen …')}
    </p>{/if}
</div>

<style>
  .scroll-hint {
    display: none;
  }
  @media (max-width: 800px) {
    .scroll-hint {
      display: block;
      font-size: 0.875rem;
      margin-block: 0 0.5rem;
    }
  }
  .scrollable {
    overflow-x: auto;
  }
  .scrollable :global(svg) {
    min-width: 780px;
  }
</style>
