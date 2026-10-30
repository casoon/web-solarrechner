/**
 * Rules of the scenario game: presets per target year, the conditions a scenario has to meet and
 * the chart specs. The hourly balance itself lives in system.ts.
 */
import { type Factors, profileCapacity, type SystemInputs, type SystemResult } from './system';

export type TargetYear = SystemInputs['year'];
export const targetYears: TargetYear[] = [2030, 2037, 2045];

/** Sourced figures the rules rely on; each one is named on the page. */
export const facts = {
  /**
   * Direct CO₂ per MWh of electricity in 2025 (UBA Climate Change 16/2026): natural gas 0.394;
   * coal as the mix the coal exit leaves in 2030, 9 GW lignite at 1.119 and 8 GW hard coal at 0.86.
   */
  factors: { gas: 0.394, coal: (9 * 1.119 + 8 * 0.86) / 17 } satisfies Factors,
  /** Climate Protection Act: Energiewirtschaft 2030 in Mt CO₂e, and its emissions in 2025. */
  sectorLimit2030: 108,
  sector2025: 189.1,
  /** Electricity generation's part of the sector in 2025, Mt CO₂: SMARD generation times the factors above. */
  power2025: 67.17 * 1.119 + 28.16 * 0.86 + 60.55 * 0.394,
  /** Reliability standard: expected hours per year in which demand cannot be met. */
  lole: 2.77,
  /** Installed capacity at the end of 2025, GW, and the best year of additions so far. */
  installed: { solar: 117, windOnshore: 68.1, windOffshore: 9.5 },
  record: { solar: 16.4, windOnshore: 5.5, windOffshore: 2.3 },
  /** Grid development plan, gross electricity demand corridors in TWh. */
  demandCorridor: { 2037: [866, 1087], 2045: [989, 1294] } as Record<number, [number, number]>,
};

const shared = { baseDemand: 465, heatPumpKwh: 4000, carKwh: 2500, biomass: 100, batteryHours: 2 };

/**
 * Starting points per target year. Solar and wind follow the legal expansion targets (EEG 2023,
 * WindSeeG); everything else is an assumption to play with.
 */
export const presets: Record<TargetYear, SystemInputs> = {
  2030: {
    ...shared,
    year: 2030,
    heatPumps: 6,
    cars: 15,
    extraDemand: 40,
    electrolysis: 10,
    solar: 215,
    windOnshore: 115,
    windOffshore: 30,
    battery: 25,
    gasPlants: 40,
    hydrogenStore: 2,
    hydrogenImport: 0,
    coal: 17,
    imports: 15,
  },
  2037: {
    ...shared,
    year: 2037,
    heatPumps: 12,
    cars: 25,
    extraDemand: 230,
    electrolysis: 40,
    solar: 345,
    windOnshore: 158,
    windOffshore: 50,
    battery: 60,
    gasPlants: 85,
    hydrogenStore: 30,
    hydrogenImport: 60,
    coal: 0,
    imports: 20,
  },
  2045: {
    ...shared,
    year: 2045,
    heatPumps: 16,
    cars: 37,
    extraDemand: 280,
    electrolysis: 80,
    solar: 400,
    windOnshore: 160,
    windOffshore: 70,
    battery: 100,
    gasPlants: 90,
    hydrogenStore: 100,
    hydrogenImport: 250,
    coal: 0,
    imports: 25,
  },
};

/**
 * CO₂ the power sector may emit in the target year: the 2030 sector limit times the power share,
 * then a straight line to zero in 2045, the year of climate neutrality.
 */
export function co2Limit(year: TargetYear) {
  const at2030 = facts.sectorLimit2030 * (facts.power2025 / facts.sector2025);
  return year >= 2045 ? 1 : at2030 * ((2045 - year) / (2045 - 2030));
}

export type Condition = {
  id: 'supply' | 'climate' | 'build' | 'imports' | 'demand';
  label: string;
  ok: boolean;
  /** Hard conditions decide the game; soft ones only warn. */
  hard: boolean;
  text: string;
};

const fmt = (n: number, digits = 0) =>
  n.toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits });

/** Electricity demand including electrolysis, TWh, as the grid plan counts it. */
export const grossDemand = (r: SystemResult) => (r.demand + r.electrolysis) / 1e3;

export function conditions(input: SystemInputs, r: SystemResult): Condition[] {
  const limit = co2Limit(input.year);
  const years = input.year - 2025;
  const keys = ['solar', 'windOnshore', 'windOffshore'] as const;
  const names = {
    solar: 'Photovoltaik',
    windOnshore: 'Wind an Land',
    windOffshore: 'Wind auf See',
  };
  const pace = keys.map((k) => ({
    name: names[k],
    needed: (input[k] - facts.installed[k]) / years,
    record: facts.record[k],
  }));
  const tooFast = pace.filter((p) => p.needed > p.record);
  const importShare = r.imported / r.demand;
  const corridor = facts.demandCorridor[input.year];
  const gross = grossDemand(r);
  const result: Condition[] = [
    {
      id: 'supply',
      label: 'Versorgung',
      hard: true,
      ok: r.unservedHours <= facts.lole,
      text:
        r.unservedHours === 0
          ? 'In keiner Stunde des Jahres fehlt Strom.'
          : `In ${fmt(r.unservedHours)} Stunden fehlt Strom, zusammen ${fmt(r.unserved / 1e3, 1)} TWh, in der Spitze ${fmt(r.maxShortGw, 1)} GW. Erlaubt sind im Mittel ${fmt(facts.lole, 2)} Stunden im Jahr.`,
    },
    {
      id: 'climate',
      label: 'Klimaziel',
      hard: true,
      ok: r.co2 <= limit,
      text: `Kraftwerke stoßen ${fmt(r.co2, 1)} Mt CO₂ aus, der Pfad des Klimaschutzgesetzes erlaubt ${fmt(limit, 1)} Mt.`,
    },
    {
      id: 'build',
      label: 'Ausbautempo',
      hard: false,
      ok: tooFast.length === 0,
      text: tooFast.length
        ? tooFast
            .map(
              (p) =>
                `${p.name} braucht ${fmt(p.needed, 1)} GW im Jahr, das beste Jahr bisher brachte ${fmt(p.record, 1)} GW.`
            )
            .join(' ')
        : 'Der Ausbau liegt in jedem Jahr unter dem bisherigen Rekord.',
    },
    {
      id: 'imports',
      label: 'Importe',
      hard: false,
      ok: importShare <= 0.15,
      text: `${fmt(importShare * 100)} % des Bedarfs kommen aus dem Ausland, in den Stunden, in denen es hier knapp ist. Ob die Nachbarn dann liefern können, ist offen.`,
    },
  ];
  if (corridor)
    result.push({
      id: 'demand',
      label: 'Bedarf',
      hard: false,
      ok: gross >= corridor[0] && gross <= corridor[1],
      text: `Bruttobedarf ${fmt(gross)} TWh, der Netzentwicklungsplan rechnet mit ${fmt(corridor[0])} bis ${fmt(corridor[1])} TWh.`,
    });
  return result;
}

/** What helps, for the first failing hard condition. */
export function advice(input: SystemInputs, r: SystemResult, failed: Condition[]) {
  const tips: string[] = [];
  if (failed.some((c) => c.id === 'supply'))
    tips.push(
      r.maxShortGw > input.battery || r.unserved > input.battery * input.batteryHours
        ? 'Die Lücke ist zu groß oder dauert zu lange für Batterien: mehr Gaskraftwerke mit Wasserstoff oder mehr Austausch mit den Nachbarn.'
        : 'Mehr Speicherdauer oder ein größerer Wasserstoffspeicher schließt die Lücke.'
    );
  if (failed.some((c) => c.id === 'climate'))
    tips.push(
      input.coal > 0
        ? 'Kohle stößt je kWh mehr als doppelt so viel CO₂ aus wie Gas. Weniger Kohle, mehr Wind und Wasserstoff für die Flaute.'
        : 'Erdgas läuft zu oft. Mehr Wind, mehr Elektrolyse und ein größerer Wasserstoffspeicher ersetzen es in den dunklen Wochen.'
    );
  return tips;
}

/** Share URL parameters: every input as a short key. */
const shortKeys: Record<keyof SystemInputs, string> = {
  year: 'j',
  baseDemand: 'b',
  heatPumps: 'wp',
  heatPumpKwh: 'wpk',
  cars: 'ea',
  carKwh: 'eak',
  extraDemand: 'x',
  electrolysis: 'el',
  solar: 'pv',
  windOnshore: 'wl',
  windOffshore: 'ws',
  biomass: 'bio',
  battery: 'bat',
  batteryHours: 'bh',
  gasPlants: 'gas',
  hydrogenStore: 'h2',
  hydrogenImport: 'h2i',
  coal: 'k',
  imports: 'im',
};

export function toParams(input: SystemInputs) {
  const params = new URLSearchParams();
  for (const [key, short] of Object.entries(shortKeys))
    params.set(short, String(input[key as keyof SystemInputs]));
  return params.toString();
}

export function fromParams(search: string): SystemInputs | null {
  const params = new URLSearchParams(search);
  const year = Number(params.get(shortKeys.year));
  if (!targetYears.includes(year as TargetYear)) return null;
  const input = { ...presets[year as TargetYear] };
  for (const [key, short] of Object.entries(shortKeys)) {
    const value = params.get(short);
    if (value === null || key === 'year') continue;
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) (input as Record<string, number>)[key] = n;
  }
  return input;
}

const tokens = {
  'color-1': '#3f8f5f',
  'color-2': '#4f9ad4',
  'color-3': '#6b4a32',
  'color-4': '#c0392b',
};

/** Four series, as many as Chartlet has colours: storage, hydrogen and imports share one. */
function coverSeries(h: SystemResult['hourly'], value: (...series: Float64Array[]) => number[]) {
  return [
    { name: 'Erneuerbar direkt', values: value(h.renewable) },
    { name: 'Speicher, Wasserstoff, Import', values: value(h.storage, h.hydrogen, h.imported) },
    { name: 'Erdgas und Kohle', values: value(h.fossil) },
    { name: 'Fehlt', values: value(h.unserved) },
  ];
}

/** The hardest week in three-hour blocks: who covered demand. */
export function weekSpec(r: SystemResult, year: number) {
  const start = r.hardestWeek;
  const blocks = Array.from({ length: 56 }, (_, b) => start + b * 3);
  const mean = (series: Float64Array, at: number) =>
    (series[at] + series[at + 1] + series[at + 2]) / 3;
  const date = new Date(Date.UTC(year, 0, 1) + start * 3600e3);
  const label = (at: number) => {
    const d = new Date(Date.UTC(year, 0, 1) + at * 3600e3);
    const day = d.toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'numeric',
      timeZone: 'UTC',
    });
    return `${day} ${d.getUTCHours()} Uhr`;
  };
  const h = r.hourly;
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'bar',
    stack: 'normal',
    tokens,
    title: `Die schwierigste Woche ab ${date.toLocaleDateString('de-DE', { timeZone: 'UTC' })}`,
    source: 'Wetter 2024 (Bundesnetzagentur | SMARD.de, CC BY 4.0), skaliert · eigene Rechnung',
    categoryAxis: { title: 'Tag und Uhrzeit' },
    valueAxis: { title: 'GW' },
    categories: blocks.map(label),
    series: coverSeries(h, (...series) =>
      blocks.map((at) => Math.round(series.reduce((t, x) => t + mean(x, at), 0) * 10) / 10)
    ),
  };
}

/** Energy per month in TWh: what covered demand over the year. */
export function monthSpec(r: SystemResult, year: number) {
  const months = Array.from({ length: 12 }, (_, m) => m);
  const bounds = months.map((m) => [
    (Date.UTC(year, m, 1) - Date.UTC(year, 0, 1)) / 3600e3,
    (Date.UTC(year, m + 1, 1) - Date.UTC(year, 0, 1)) / 3600e3,
  ]);
  const sum = (series: Float64Array, m: number) => {
    let s = 0;
    for (let i = bounds[m][0]; i < bounds[m][1]; i++) s += series[i];
    return s / 1e3;
  };
  const h = r.hourly;
  const names = 'Jan Feb Mär Apr Mai Jun Jul Aug Sep Okt Nov Dez'.split(' ');
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'bar',
    stack: 'normal',
    tokens,
    title: 'Deckung des Bedarfs je Monat, in TWh',
    source: 'Wetter 2024 (Bundesnetzagentur | SMARD.de, CC BY 4.0), skaliert · eigene Rechnung',
    categoryAxis: { title: 'Monat' },
    valueAxis: { title: 'TWh' },
    categories: names,
    series: coverSeries(h, (...series) =>
      months.map((m) => Math.round(series.reduce((t, x) => t + sum(x, m), 0) * 10) / 10)
    ),
  };
}

/** Full-load hours the 2024 weather gives each technology, for the explanation on the page. */
export function fullLoadHours(p: {
  solar: number[];
  windOnshore: number[];
  windOffshore: number[];
}) {
  const hours = (series: number[], gw: number) => series.reduce((s, v) => s + v, 0) / 1e3 / gw;
  return {
    solar: hours(p.solar, profileCapacity.solar),
    windOnshore: hours(p.windOnshore, profileCapacity.windOnshore),
    windOffshore: hours(p.windOffshore, profileCapacity.windOffshore),
  };
}
