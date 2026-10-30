/**
 * Chart specifications and table rows for the page on Germany's electricity supply.
 * Source of all series: Bundesnetzagentur | SMARD.de (CC BY 4.0), net feed-in into the public grid.
 */
import data from './data/smard.json';

export const smard = data;
type Row = Omit<(typeof data.years)[number], 'year'>;

/** Stacking order from the bottom: steady sources first, weather-driven ones on top. */
export const groups = [
  { label: 'Kernenergie', keys: ['nuclear'], color: '#8c6d9e' },
  { label: 'Braunkohle', keys: ['lignite'], color: '#6b4a32' },
  { label: 'Steinkohle', keys: ['hardCoal'], color: '#3d3d3d' },
  { label: 'Erdgas', keys: ['gas'], color: '#b4533c' },
  { label: 'Sonstige Konventionelle', keys: ['otherFossil'], color: '#9a8f86' },
  { label: 'Pumpspeicher', keys: ['pumpedStorage'], color: '#5b8fa8' },
  { label: 'Biomasse', keys: ['biomass'], color: '#6f8a3c' },
  {
    label: 'Wasserkraft und sonstige Erneuerbare',
    keys: ['hydro', 'otherRenewable'],
    color: '#2f6f9f',
  },
  { label: 'Wind auf See', keys: ['windOffshore'], color: '#1f4e6b' },
  { label: 'Wind an Land', keys: ['windOnshore'], color: '#4f9a94' },
  { label: 'Photovoltaik', keys: ['solar'], color: '#d9a21b' },
] as const;

/** Chartlet has four series colours, so the charts merge the groups; the table keeps them apart. */
const chartGroups = [
  {
    label: 'Fossil, Kernenergie und Pumpspeicher',
    keys: ['nuclear', 'lignite', 'hardCoal', 'gas', 'otherFossil', 'pumpedStorage'],
    color: '#6b4a32',
  },
  {
    label: 'Biomasse und Wasserkraft',
    keys: ['biomass', 'hydro', 'otherRenewable'],
    color: '#6f8a3c',
  },
  { label: 'Wind', keys: ['windOffshore', 'windOnshore'], color: '#2f6f9f' },
  { label: 'Photovoltaik', keys: ['solar'], color: '#d9a21b' },
] as const;

const renewable = ['biomass', 'hydro', 'otherRenewable', 'windOffshore', 'windOnshore', 'solar'];
const generation = groups.flatMap((g) => g.keys as readonly string[]);
const sum = (row: Row, keys: readonly string[]) =>
  keys.reduce((s, k) => s + (row as Record<string, number>)[k], 0);
const tokens = Object.fromEntries(chartGroups.map((g, i) => [`color-${i + 1}`, g.color]));
const source = 'Bundesnetzagentur | SMARD.de, CC BY 4.0 · Netzeinspeisung';
const round1 = (n: number) => Math.round(n * 10) / 10;

export const renewableShare = (row: Row) => (sum(row, renewable) / sum(row, generation)) * 100;

const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export const monthLabel = (month: string) =>
  `${months[Number(month.slice(5)) - 1]} ${month.slice(2, 4)}`;
export const monthName = (month: string) =>
  new Date(`${month}-15`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

/** Key figures: last complete month, the running year and the last complete year. */
export function keyFigures() {
  const last = data.months[data.months.length - 1];
  const year = Number(last.month.slice(0, 4));
  const running = data.months.filter((m) => m.month.startsWith(String(year)));
  const total = Object.fromEntries(
    Object.keys(last)
      .filter((k) => k !== 'month')
      .map((k) => [k, running.reduce((s, m) => s + (m as unknown as Record<string, number>)[k], 0)])
  ) as Row;
  const previous = data.years[data.years.length - 1];
  const first = data.years[0];
  return {
    month: last.month,
    monthShare: renewableShare(last),
    year,
    yearShare: renewableShare(total),
    yearMonths: running.length,
    previous: previous.year,
    previousShare: renewableShare(previous),
    first: first.year,
    firstShare: renewableShare(first),
    coal: { first: first.lignite + first.hardCoal, last: previous.lignite + previous.hardCoal },
  };
}

function stacked(title: string, categories: string[], rows: Row[], axis: string) {
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'bar',
    stack: 'normal',
    tokens,
    title,
    source,
    categoryAxis: { title: axis },
    valueAxis: { title: 'TWh' },
    categories,
    series: chartGroups.map((g) => ({
      name: g.label,
      values: rows.map((r) => round1(sum(r, g.keys))),
    })),
  };
}

export const yearlySpec = () =>
  stacked(
    'Stromerzeugung in Deutschland nach Energieträgern',
    data.years.map((y) => String(y.year)),
    data.years,
    'Jahr'
  );

export const monthlySpec = () => {
  const recent = data.months.slice(-24);
  return stacked(
    'Stromerzeugung der letzten 24 Monate',
    recent.map((m) => monthLabel(m.month)),
    recent,
    'Monat'
  );
};

export function yearlyRows() {
  return data.years.map((y) => ({
    Jahr: y.year,
    Erneuerbare_Prozent: round1(renewableShare(y)),
    ...Object.fromEntries(groups.map((g) => [`${g.label} TWh`, round1(sum(y, g.keys))])),
    Netzlast_TWh: round1(y.load),
  }));
}

/** The windless week of November 2024 in three-hour blocks, mean power in GW. */
export function lullSpec() {
  const lull = data.lull;
  const block = 3;
  const start = new Date(lull.start);
  const blocks = Array.from({ length: Math.floor(lull.hours / block) }, (_, b) => b * block);
  const mean = (values: number[], at: number) =>
    round1(values.slice(at, at + block).reduce((s, v) => s + v, 0) / block / 1000);
  const label = (at: number) => {
    const t = new Date(start.getTime() + at * 3600e3);
    const day = t.toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'numeric',
      timeZone: 'Europe/Berlin',
    });
    const hour = t.toLocaleTimeString('de-DE', { hour: '2-digit', timeZone: 'Europe/Berlin' });
    return `${day} ${hour}`;
  };
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'bar',
    stack: 'normal',
    tokens,
    title: 'Eine windarme Novemberwoche 2024: wer den Strom geliefert hat',
    source: `${source} · Mittelwerte je drei Stunden · Import nicht enthalten`,
    categoryAxis: { title: 'Tag und Uhrzeit' },
    valueAxis: { title: 'GW' },
    categories: blocks.map(label),
    series: chartGroups.map((g) => ({
      name: g.label,
      values: blocks.map((at) =>
        round1(
          g.keys.reduce((s, k) => s + mean((lull as unknown as Record<string, number[]>)[k], at), 0)
        )
      ),
    })),
  };
}

/** Weekly figures of the windless week: demand, wind and solar, and the gap others filled. */
export function lullFigures() {
  const lull = data.lull as unknown as Record<string, number[]>;
  const at = (key: string, h: number) => lull[key][h] ?? 0;
  const hours = data.lull.hours;
  let minWeather = Number.POSITIVE_INFINITY;
  let maxGap = 0;
  let weatherSum = 0;
  let loadSum = 0;
  for (let h = 0; h < hours; h++) {
    const weather = at('windOnshore', h) + at('windOffshore', h) + at('solar', h);
    minWeather = Math.min(minWeather, weather);
    maxGap = Math.max(maxGap, at('load', h) - weather);
    weatherSum += weather;
    loadSum += at('load', h);
  }
  return {
    weatherShare: (weatherSum / loadSum) * 100,
    minWeatherGw: minWeather / 1000,
    maxGapGw: maxGap / 1000,
  };
}
