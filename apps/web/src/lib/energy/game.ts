/**
 * Rules of the scenario game: presets per target year, the conditions a scenario has to meet and
 * the chart specs. The hourly balance itself lives in system.ts.
 */
import {
  type Factors,
  population2024,
  profileCapacity,
  type SystemInputs,
  type SystemResult,
} from './system';

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
  /** Climate Protection Act, Anlage 2a: Gebäude and Verkehr 2030 in Mt CO₂e; UBA emissions 2025. */
  buildings2030: 67,
  buildings2025: 103.4,
  transport2030: 85,
  transport2025: 146.3,
  /**
   * Fossil heating in 2025 (Schornsteinfegerhandwerk): 14.8 million gas and 4.7 million oil units,
   * weighted with the UBA fuel factors of 0.201 and 0.266 t CO₂ per MWh.
   */
  heatingFuel: (14.8 * 0.201 + 4.7 * 0.266) / 19.5,
  /** Assumptions: boiler efficiency, heat pump seasonal performance in existing buildings. */
  boilerEfficiency: 0.9,
  heatPumpCop: 3,
  /** Heat pumps for space heating at the end of 2025, estimated from BWP sales, million. */
  heatPumps2025: 2.2,
  /** Cars on 1 January 2026 (KBA), million, of them battery-electric. */
  carStock: 49.5,
  electricCars2025: 2,
  /** Assumption: t CO₂ per combustion car and year, about 12,000 km at 145 g/km on the road. */
  carCo2: 1.74,
  /** Grid development plan, gross electricity demand corridors in TWh. */
  demandCorridor: { 2037: [866, 1087], 2045: [989, 1294] } as Record<number, [number, number]>,
};

const shared = {
  population: population2024,
  baseDemand: 465,
  heatPumpKwh: 4000,
  carKwh: 2500,
  biomass: 100,
  batteryHours: 2,
};

/**
 * Starting points per target year. Solar and wind follow the legal expansion targets (EEG 2023,
 * WindSeeG); everything else is an assumption to play with.
 */
export const presets: Record<TargetYear, SystemInputs> = {
  2030: {
    ...shared,
    year: 2030,
    retrofit: 5,
    heatNetworks: 10,
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
    retrofit: 12,
    heatNetworks: 20,
    heatPumps: 15,
    cars: 32,
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
    retrofit: 25,
    heatNetworks: 30,
    heatPumps: 20,
    cars: 50,
    extraDemand: 280,
    electrolysis: 80,
    solar: 400,
    windOnshore: 160,
    windOffshore: 70,
    battery: 120,
    gasPlants: 100,
    hydrogenStore: 120,
    hydrogenImport: 300,
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

/** Straight line from the 2030 value to zero in 2045. */
const path = (at2030: number, year: TargetYear) =>
  year >= 2045 ? 0 : at2030 * ((2045 - year) / (2045 - 2030));

const scale = (input: SystemInputs) => input.population / population2024;

/** Building heat in TWh: the fossil heat of 2025 plus the heat of 2025's heat pumps, per head. */
export function heatBalance(input: SystemInputs) {
  const fossil2025 = (facts.buildings2025 / facts.heatingFuel) * facts.boilerEfficiency;
  const pumped2025 = (facts.heatPumps2025 * shared.heatPumpKwh * facts.heatPumpCop) / 1e3;
  const demand = (fossil2025 + pumped2025) * scale(input) * (1 - input.retrofit / 100);
  const networks = (demand * input.heatNetworks) / 100;
  const pumped = Math.min(
    demand - networks,
    (input.heatPumps * input.heatPumpKwh * facts.heatPumpCop) / 1e3
  );
  return { demand, networks, pumped, fossil: demand - networks - pumped };
}

export function carBalance(input: SystemInputs) {
  const fleet = facts.carStock * scale(input);
  const electric = Math.min(fleet, input.cars);
  return { fleet, electric, combustion: fleet - electric };
}

/** The cars' part of the 2030 transport limit: their 2025 emissions, cut like the whole sector. */
const carsLimit2030 = () =>
  ((facts.carStock - facts.electricCars2025) * facts.carCo2 * facts.transport2030) /
  facts.transport2025;

/** CO₂ the climate law's path leaves power, heating and cars together in a target year, Mt. */
export const climateBudget = (year: TargetYear) =>
  co2Limit(year) + path(facts.buildings2030, year) + path(carsLimit2030(), year);

export type ClimatePart = {
  id: 'power' | 'heat' | 'cars';
  label: string;
  emitted: number;
  allowed: number;
};

/**
 * CO₂ of the three areas the game steers, Mt, against what the climate law's path leaves them:
 * the power share of the energy sector, the building sector, and the cars' part of transport.
 */
export function climateBalance(input: SystemInputs, r: SystemResult) {
  const heat = heatBalance(input);
  const cars = carBalance(input);
  const parts: ClimatePart[] = [
    { id: 'power', label: 'Strom', emitted: r.co2, allowed: co2Limit(input.year) },
    {
      id: 'heat',
      label: 'Heizen',
      emitted: (heat.fossil / facts.boilerEfficiency) * facts.heatingFuel,
      allowed: path(facts.buildings2030, input.year),
    },
    {
      id: 'cars',
      label: 'Autofahren',
      emitted: cars.combustion * facts.carCo2,
      allowed: path(carsLimit2030(), input.year),
    },
  ];
  return {
    parts,
    emitted: parts.reduce((s, p) => s + p.emitted, 0),
    allowed: parts.reduce((s, p) => s + p.allowed, 0),
  };
}

/** CO₂ a heat pump or an electric car saves, and what its electricity costs from a gas plant, t. */
export function switchEffect(input: SystemInputs) {
  const heatPump =
    (input.heatPumpKwh * facts.heatPumpCop * facts.heatingFuel) / facts.boilerEfficiency / 1e3;
  return {
    heatPump,
    heatPumpOnGas: (input.heatPumpKwh * facts.factors.gas) / 1e3,
    car: facts.carCo2,
    carOnGas: (input.carKwh * facts.factors.gas) / 1e3,
  };
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
  const climate = climateBalance(input, r);
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
      ok: climate.emitted <= climate.allowed,
      text: `Strom, Heizen und Autofahren stoßen zusammen ${fmt(climate.emitted, 1)} Mt CO₂ aus, der Pfad des Klimaschutzgesetzes erlaubt ${fmt(climate.allowed, 1)} Mt.`,
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
  if (failed.some((c) => c.id === 'climate')) {
    const worst = climateBalance(input, r).parts.reduce((a, b) =>
      b.emitted - b.allowed > a.emitted - a.allowed ? b : a
    );
    tips.push(
      worst.id === 'heat'
        ? 'Zu viele Öl- und Gasheizungen: mehr Wärmepumpen, Wärmenetze oder Sanierung. Jede Wärmepumpe spart mehr CO₂, als ihr Strom selbst aus einem Gaskraftwerk verursacht.'
        : worst.id === 'cars'
          ? 'Zu viele Verbrenner: mehr Elektroautos. Auch mit Strom aus Gas stößt ein Elektroauto weniger aus als ein Benziner.'
          : input.coal > 0
            ? 'Kohle stößt je kWh mehr als doppelt so viel CO₂ aus wie Gas. Weniger Kohle, mehr Wind und Wasserstoff für die Flaute.'
            : 'Erdgas läuft zu oft. Mehr Wind, mehr Elektrolyse und ein größerer Wasserstoffspeicher ersetzen es in den dunklen Wochen.'
    );
  }
  return tips;
}

/** Share URL parameters: every input as a short key. */
const shortKeys: Record<keyof SystemInputs, string> = {
  year: 'j',
  population: 'bev',
  baseDemand: 'b',
  heatPumps: 'wp',
  heatPumpKwh: 'wpk',
  retrofit: 'san',
  heatNetworks: 'wn',
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
    showValues: false,
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

/** CO₂ per area against the climate law's path, Mt. */
export function climateSpec(input: SystemInputs, r: SystemResult) {
  const { parts } = climateBalance(input, r);
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'bar',
    tokens: { 'color-1': '#c0392b', 'color-2': '#9fb8ad' },
    title: `CO₂ ${input.year} je Bereich gegen den Pfad des Klimaschutzgesetzes, in Mt`,
    source:
      'Umweltbundesamt, Klimaschutzgesetz Anlage 2a, KBA, Schornsteinfegerhandwerk · eigene Rechnung',
    categoryAxis: { title: 'Bereich' },
    valueAxis: { title: 'Mt CO₂' },
    categories: parts.map((p) => p.label),
    series: [
      { name: 'Ausstoß', values: parts.map((p) => round(p.emitted)) },
      { name: 'Erlaubt', values: parts.map((p) => round(p.allowed)) },
    ],
  };
}
