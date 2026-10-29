<script lang="ts">
import type { Provider } from '@casoon/opengrid';
import { OpengridTable } from '@casoon/opengrid/svelte';
import { onMount } from 'svelte';

let { rows, label }: { rows: Record<string, string | number>[]; label: string } = $props();
let ready = $state(false);
let error = $state(false);
const columns = $derived(Object.keys(rows[0] ?? {}));
const provider = $derived<Provider>({
  execute(json: string) {
    const query = JSON.parse(json);
    const selected: string[] = query.select?.length ? query.select : columns;
    let result = [...rows];
    if (query.sort?.length) {
      const sort = query.sort[0];
      const key = sort.column ?? sort.field;
      if (key)
        result.sort(
          (a, b) =>
            (typeof a[key] === 'number'
              ? Number(a[key]) - Number(b[key])
              : String(a[key]).localeCompare(String(b[key]), 'de')) *
            (String(sort.direction).toLowerCase() === 'desc' ? -1 : 1)
        );
    }
    return JSON.stringify({
      total_count: result.length,
      row_count: result.length,
      columns: selected.map((name) => ({
        name,
        type: typeof result[0]?.[name] === 'number' ? 'float64' : 'utf8',
        nullable: false,
        values: result.map((r) => r[name]),
      })),
    });
  },
});
onMount(() => {
  let disposed = false;
  import('@casoon/opengrid')
    .then((api) =>
      api.loadOpengrid({
        moduleUrl: `${window.location.origin}/vendor/opengrid/opengrid_web_components.js`,
      })
    )
    .then((result) => {
      if (!disposed) {
        ready = !result.fallback;
        error = result.fallback;
      }
    })
    .catch(() => {
      if (!disposed) error = true;
    });
  return () => {
    disposed = true;
  };
});
</script>

<div class="solar-table">
  {#if ready}
    <OpengridTable {label} datasource="solar" columns={columns.join(',')} {provider} theme="base" />
  {:else}
    {#if error}<p>
        Open Grid konnte nicht geladen werden. Die einfache Tabelle bleibt verfügbar.
      </p>{/if}
    <table>
      <caption>{label}</caption>
      <thead>
        <tr>
          {#each columns as c}<th scope="col">{c}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as row}<tr>
            {#each columns as c}<td>
                {typeof row[c] === 'number'
                  ? Number(row[c]).toLocaleString('de-DE', { maximumFractionDigits: 0 })
                  : row[c]}
              </td>{/each}
          </tr>{/each}
      </tbody>
    </table>
  {/if}
</div>
