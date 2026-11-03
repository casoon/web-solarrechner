/**
 * Fetches the household electricity price history for the page on electricity prices and writes
 * a minified snapshot. Run by hand twice a year, after Eurostat publishes a new half-year:
 * node scripts/sync-price-data.mjs
 *
 * - Eurostat nrg_pc_204: household prices, consumption band 2,500–5,000 kWh, Germany, in EUR/kWh
 *   at three tax levels. Eurostat data may be reused with source attribution (CC BY 4.0).
 * - Eurostat prc_hicp_minr: harmonised consumer price index Germany, all items, 2025 = 100.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const api = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';
const today = new Date().toISOString().slice(0, 10);
/** First half-year of the current consumption bands; earlier bands are not comparable. */
const first = '2007-S1';

async function dataset(name, query) {
  const response = await fetch(`${api}/${name}?${query}&format=JSON&lang=en`);
  if (!response.ok) throw new Error(`${response.status} ${name}`);
  const data = await response.json();
  const times = Object.keys(data.dimension.time.category.index);
  return { data, times };
}

const prices = await dataset(
  'nrg_pc_204',
  'geo=DE&nrg_cons=KWH2500-4999&unit=KWH&currency=EUR&sinceTimePeriod=2007'
);
const taxIndex = prices.data.dimension.tax.category.index;
const price = (tax, i) => prices.data.value[String(taxIndex[tax] * prices.times.length + i)];

const hicp = await dataset(
  'prc_hicp_minr',
  'geo=DE&coicop18=TOTAL&unit=I25&sinceTimePeriod=2007-01'
);
/** Mean index of the six months of a half-year; null while a month is missing. */
function halfYearIndex(period) {
  const [year, half] = period.split('-S');
  const months = Array.from({ length: 6 }, (_, m) =>
    String((half === '1' ? 1 : 7) + m).padStart(2, '0')
  );
  const values = months.map((m) => {
    const i = hicp.times.indexOf(`${year}-${m}`);
    return i < 0 ? undefined : hicp.data.value[String(i)];
  });
  if (values.some((v) => v === undefined)) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / 6) * 100) / 100;
}

const ct = (eur) => Math.round(eur * 10000) / 100;
const halfYears = prices.times
  .map((period, i) => ({ period, i }))
  .filter(({ period, i }) => period >= first && price('I_TAX', i) !== undefined)
  .map(({ period, i }) => ({
    period,
    // Energy, supply and grid; levies and electricity tax; VAT. In ct/kWh.
    beforeTax: ct(price('X_TAX', i)),
    levies: ct(price('X_VAT', i) - price('X_TAX', i)),
    vat: ct(price('I_TAX', i) - price('X_VAT', i)),
    total: ct(price('I_TAX', i)),
    index: halfYearIndex(period),
  }));
if (halfYears.some((h) => h.index === null)) throw new Error('Consumer price index incomplete');

const out = resolve(app, 'src/lib/energy/data/prices.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ fetched: today, halfYears }));
console.log(`${halfYears.length} half-years, last ${halfYears.at(-1).period}`);
