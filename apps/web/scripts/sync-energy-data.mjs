/**
 * Fetches the public data behind the three background pages and writes minified snapshots.
 * Run by hand once a month (no scheduled CI job): node scripts/sync-energy-data.mjs
 *
 * - SMARD (Bundesnetzagentur | SMARD.de, CC BY 4.0): generation and grid load. Wholesale prices
 *   are left out on purpose: SMARD asks not to reuse them while their licence is under review.
 * - Länderarbeitskreis Energiebilanzen: gross generation and final electricity consumption per
 *   federal state; reuse with source attribution is allowed, values stay unchanged.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const smard = 'https://www.smard.de/app/chart_data';
const lak = 'https://www.lak-energiebilanzen.de/ergebnisse-des-datenabrufs/';
const today = new Date().toISOString().slice(0, 10);

/** SMARD filter ids, in stacking order from the bottom. */
const sources = {
  nuclear: 1224,
  lignite: 1223,
  hardCoal: 4069,
  gas: 4071,
  otherFossil: 1227,
  pumpedStorage: 4070,
  biomass: 4066,
  hydro: 1226,
  otherRenewable: 1228,
  windOffshore: 1225,
  windOnshore: 4067,
  solar: 4068,
};
const load = 410;
/** The hourly reference year of the scenario game and the cold, windless weeks of 2024. */
const hourlyYear = 2024;
const lullWeek = { start: Date.UTC(2024, 10, 1, 23), end: Date.UTC(2024, 10, 8, 23) };

async function json(url) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, { headers: { 'user-agent': 'solarrechner-sync' } });
    if (response.ok) return response.json();
    if (attempt === 3) throw new Error(`${response.status} ${url}`);
  }
}
async function text(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 solarrechner-sync' } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}
/** All [timestamp, MWh] pairs of one filter in one resolution, optionally limited to a range. */
async function series(filter, resolution, from = 0, to = Number.POSITIVE_INFINITY) {
  const { timestamps } = await json(`${smard}/${filter}/DE/index_${resolution}.json`);
  // A chunk starts at its timestamp and runs until the next one.
  const chunks = timestamps.filter((t, i) => t < to && (timestamps[i + 1] ?? t + 1) > from);
  const files = await Promise.all(
    chunks.map((t) => json(`${smard}/${filter}/DE/${filter}_DE_${resolution}_${t}.json`))
  );
  return files.flatMap((f) => f.series).filter(([t, v]) => t >= from && t < to && v !== null);
}
const berlinYear = (t) =>
  Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Berlin' }).format(t));
const berlinMonth = (t) =>
  new Intl.DateTimeFormat('sv', { year: 'numeric', month: '2-digit', timeZone: 'Europe/Berlin' })
    .format(t)
    .slice(0, 7);
const twh = (mwh) => Math.round(mwh / 1e4) / 100;

async function smardSnapshot() {
  const keys = [...Object.keys(sources), 'load'];
  const ids = [...Object.values(sources), load];
  const yearly = await Promise.all(ids.map((id) => series(id, 'year')));
  const monthly = await Promise.all(ids.map((id) => series(id, 'month')));
  // Grid load runs through every year; nuclear generation, for one, ends in April 2023.
  const reference = ids.length - 1;
  const currentYear = berlinYear(Date.now());
  const years = yearly[reference]
    .map(([t]) => berlinYear(t))
    .filter((year) => year < currentYear)
    .map((year) => ({
      year,
      ...Object.fromEntries(
        keys.map((key, i) => [key, twh(yearly[i].find(([t]) => berlinYear(t) === year)?.[1] ?? 0)])
      ),
    }));
  const currentMonth = berlinMonth(Date.now());
  const months = [...new Set(monthly[reference].map(([t]) => berlinMonth(t)))]
    .filter((month) => month < currentMonth)
    .slice(-36)
    .map((month) => ({
      month,
      ...Object.fromEntries(
        keys.map((key, i) => [
          key,
          twh(monthly[i].find(([t]) => berlinMonth(t) === month)?.[1] ?? 0),
        ])
      ),
    }));
  const week = await Promise.all(ids.map((id) => series(id, 'hour', lullWeek.start, lullWeek.end)));
  const stamps = week[reference].map(([t]) => t);
  const lull = {
    start: new Date(lullWeek.start).toISOString(),
    hours: stamps.length,
    ...Object.fromEntries(
      keys.map((key, i) => {
        const byStamp = new Map(week[i]);
        return [key, stamps.map((t) => Math.round(byStamp.get(t) ?? 0))];
      })
    ),
  };
  return { fetched: today, years, months, lull };
}

/** Hourly MW for the scenario game: demand plus every weather-driven and steady source. */
async function hourlySnapshot() {
  const from = Date.UTC(hourlyYear - 1, 11, 31, 23);
  const to = Date.UTC(hourlyYear, 11, 31, 23);
  const keys = {
    load,
    solar: 4068,
    windOnshore: 4067,
    windOffshore: 1225,
    hydro: 1226,
    biomass: 4066,
  };
  const values = await Promise.all(Object.values(keys).map((id) => series(id, 'hour', from, to)));
  const hours = Math.min(...values.map((v) => v.length));
  return {
    fetched: today,
    year: hourlyYear,
    hours,
    ...Object.fromEntries(
      Object.keys(keys).map((key, i) => [
        key,
        values[i].slice(0, hours).map(([, v]) => Math.round(v)),
      ])
    ),
  };
}

const states = [
  [8, 'BW', 'Baden-Württemberg'],
  [9, 'BY', 'Bayern'],
  [11, 'BE', 'Berlin'],
  [12, 'BB', 'Brandenburg'],
  [4, 'HB', 'Bremen'],
  [2, 'HH', 'Hamburg'],
  [6, 'HE', 'Hessen'],
  [13, 'MV', 'Mecklenburg-Vorpommern'],
  [3, 'NI', 'Niedersachsen'],
  [5, 'NW', 'Nordrhein-Westfalen'],
  [7, 'RP', 'Rheinland-Pfalz'],
  [10, 'SL', 'Saarland'],
  [14, 'SN', 'Sachsen'],
  [15, 'ST', 'Sachsen-Anhalt'],
  [1, 'SH', 'Schleswig-Holstein'],
  [16, 'TH', 'Thüringen'],
];
const lakYears = Array.from({ length: 15 }, (_, i) => 2010 + i);

/** Parses one LAK result table into rows of [state, year, ...values]; unknown cells become null. */
async function lakTable(table, variables) {
  const url = `${lak}?a=${table}&j=${lakYears.join(',')}&l=${states.map(([id]) => id).join(',')}&v=${['anm', ...variables, 'Stand'].join(',')}`;
  const html = await text(url);
  const umlauts = { auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß' };
  const cell = (c) =>
    c
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;|&shy;|\s/g, '')
      .replace(/&(\w+);/g, (entity, name) => umlauts[name] ?? entity);
  return [...html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)]
    .map(([, row]) => [...row.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)].map(([, c]) => cell(c)))
    .filter((cells) => /^\d{4}$/.test(cells[1] ?? ''))
    .map(([state, year, , ...rest]) => [
      state.normalize('NFC'),
      Number(year),
      ...rest
        .slice(0, variables.length)
        .map((v) => (/^-$/.test(v) ? 0 : /^\d+$/.test(v) ? Number(v) : null)),
    ]);
}

async function lakSnapshot() {
  const carriers = ['total', 'hardCoal', 'lignite', 'oil', 'gas', 'renewable', 'nuclear', 'other'];
  const renewables = ['renewable', 'hydro', 'wind', 'solar', 'biomass', 'otherRenewable'];
  const [generation, split, consumption] = await Promise.all([
    lakTable('e350', [
      'insgesamt',
      'agg_steinkohle',
      'agg_braunkohle',
      'minoel_heizoel',
      'gase_erdgas',
      'agg_strerz_brutto_ee',
      'andere_kernenergie',
      'andere_andere_sw',
    ]),
    lakTable('e360', [
      'agg_erneuer_insgesamt',
      'erneuer_wasser',
      'erneuer_wind',
      'erneuer_pv',
      'erneuer_biomasse',
      'erneuer_sonst_sw',
    ]),
    lakTable('e400', ['andere_strom']),
  ]);
  const find = (rows, name, year) => rows.find(([s, y]) => s === name && y === year);
  return {
    fetched: today,
    states: states.map(([, code, name]) => ({
      code,
      name,
      years: lakYears.map((year) => {
        const g = find(generation, name, year)?.slice(2) ?? [];
        const r = find(split, name, year)?.slice(2) ?? [];
        // Final electricity consumption arrives in TJ.
        const tj = find(consumption, name, year)?.[2] ?? null;
        return {
          year,
          ...Object.fromEntries(carriers.map((c, i) => [c, g[i] ?? null])),
          ...Object.fromEntries(renewables.slice(1).map((c, i) => [c, r[i + 1] ?? null])),
          consumption: tj === null ? null : Math.round(tj / 3.6),
        };
      }),
    })),
  };
}

const [overview, hourly, statesData] = await Promise.all([
  smardSnapshot(),
  hourlySnapshot(),
  lakSnapshot(),
]);
const dataDir = resolve(app, 'src/lib/energy/data');
mkdirSync(dataDir, { recursive: true });
mkdirSync(resolve(app, 'public/data/energy'), { recursive: true });
writeFileSync(resolve(dataDir, 'smard.json'), JSON.stringify(overview));
writeFileSync(resolve(dataDir, 'laender.json'), JSON.stringify(statesData));
writeFileSync(
  resolve(app, `public/data/energy/stunden-${hourlyYear}.json`),
  JSON.stringify(hourly)
);
console.log(
  `SMARD ${overview.years.length} Jahre, ${overview.months.length} Monate, Dunkelflaute ${overview.lull.hours} h; ` +
    `${hourly.hours} Stunden ${hourlyYear}; ${statesData.states.length} Länder`
);
