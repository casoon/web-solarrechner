/**
 * Scenario game "Stromsystem 2045": one weather year of real hourly profiles (2024), scaled to
 * the capacities the player picks, balanced hour by hour on a copper plate (no grid limits
 * inside Germany). Pure functions; the page loads the profiles once and calls simulate().
 */

export type Profiles = {
  year: number;
  hours: number;
  load: number[];
  solar: number[];
  windOnshore: number[];
  windOffshore: number[];
  hydro: number[];
  biomass: number[];
};

/**
 * Capacity in the middle of 2024 that produced the profiles, in GW: mean of end 2023 and end
 * 2024 (Bundesnetzagentur). SMARD counts only solar fed into the grid, not self-consumption, so
 * solar per GW comes out conservative.
 */
export const profileCapacity = {
  solar: (83.1 + 99.3) / 2,
  windOnshore: (61 + 63.5) / 2,
  windOffshore: (8.5 + 9.2) / 2,
};

/** Monthly shares of space heating, a simplified assumption; flat within the month. */
export const heatingShares = [
  0.17, 0.14, 0.12, 0.08, 0.04, 0.01, 0.01, 0.01, 0.03, 0.08, 0.13, 0.18,
];

/**
 * Specific CO₂ emissions of power generation in t/MWh. Placeholder values, replaced from the
 * sourced figures in facts.ts.
 */
export type Factors = { gas: number; coal: number };

export type SystemInputs = {
  year: 2030 | 2037 | 2045;
  /** Today's demand without new consumers, TWh, shaped like the 2024 grid load. */
  baseDemand: number;
  /** Million heat pumps and their yearly consumption in kWh. */
  heatPumps: number;
  heatPumpKwh: number;
  /** Million electric cars and their yearly consumption in kWh. */
  cars: number;
  carKwh: number;
  /** Further flat demand (industry, data centres), TWh. */
  extraDemand: number;
  /** Electrolysers in GW; they only run on surplus electricity. */
  electrolysis: number;
  solar: number;
  windOnshore: number;
  windOffshore: number;
  /** Biomass relative to 2024, percent. */
  biomass: number;
  /** Short-term storage: power in GW and hours at full power. */
  battery: number;
  batteryHours: number;
  /** Gas power plants in GW; they burn hydrogen while the store has some, then natural gas. */
  gasPlants: number;
  /** Hydrogen store in TWh of hydrogen; starts half full. */
  hydrogenStore: number;
  /** Hydrogen bought abroad, TWh per year, arriving evenly into the store. */
  hydrogenImport: number;
  /** Remaining coal plants, GW. */
  coal: number;
  /** Import and export capacity available in tight hours, GW. */
  imports: number;
};

export const efficiencies = { batteryRoundTrip: 0.9, electrolysis: 0.65, hydrogenPlant: 0.55 };

export type SystemResult = {
  hours: number;
  demand: number;
  weather: number;
  steady: number;
  curtailed: number;
  exported: number;
  imported: number;
  battery: number;
  hydrogenPower: number;
  gasPower: number;
  coalPower: number;
  electrolysis: number;
  unserved: number;
  unservedHours: number;
  maxShortGw: number;
  co2: number;
  /** First hour of the week with the largest unserved energy, or of the largest fossil use. */
  hardestWeek: number;
  /** Per hour: demand, weather-driven and steady generation, storage, imports, fossil, gap. */
  hourly: {
    demand: Float64Array;
    renewable: Float64Array;
    storage: Float64Array;
    imported: Float64Array;
    hydrogen: Float64Array;
    fossil: Float64Array;
    unserved: Float64Array;
  };
};

const hoursPerMonth = (year: number) =>
  Array.from({ length: 12 }, (_, m) => new Date(Date.UTC(year, m + 1, 0)).getUTCDate() * 24);

/** Month of an hour index, counted from 1 January 00:00 local time. */
function monthIndex(year: number) {
  const per = hoursPerMonth(year);
  const index: number[] = [];
  per.forEach((n, m) => {
    for (let i = 0; i < n; i++) index.push(m);
  });
  return index;
}

/** GWh in each hour (GW mean power), demand by component. */
export function demandProfile(p: Profiles, input: SystemInputs) {
  const loadSum = p.load.reduce((s, v) => s + v, 0);
  const months = monthIndex(p.year);
  const per = hoursPerMonth(p.year);
  // Million devices times kWh each gives GWh per year.
  const heat = input.heatPumps * input.heatPumpKwh;
  const flat = (input.cars * input.carKwh + input.extraDemand * 1e3) / p.hours;
  return Float64Array.from({ length: p.hours }, (_, h) => {
    const base = ((p.load[h] ?? 0) / loadSum) * input.baseDemand * 1e3;
    const m = months[h] ?? 11;
    return base + (heat * heatingShares[m]) / per[m] + flat;
  });
}

export function simulate(p: Profiles, input: SystemInputs, factors: Factors): SystemResult {
  const demand = demandProfile(p, input);
  const scale = {
    solar: input.solar / profileCapacity.solar / 1e3,
    windOnshore: input.windOnshore / profileCapacity.windOnshore / 1e3,
    windOffshore: input.windOffshore / profileCapacity.windOffshore / 1e3,
  };
  const charge = Math.sqrt(efficiencies.batteryRoundTrip);
  const capacity = input.battery * input.batteryHours;
  const h2Max = input.hydrogenStore * 1e3;
  let soc = capacity / 2;
  let h2 = h2Max / 2;
  const totals = {
    weather: 0,
    steady: 0,
    curtailed: 0,
    exported: 0,
    imported: 0,
    battery: 0,
    hydrogenPower: 0,
    gasPower: 0,
    coalPower: 0,
    electrolysis: 0,
    unserved: 0,
    unservedHours: 0,
    maxShortGw: 0,
  };
  const hourly = {
    demand,
    renewable: new Float64Array(p.hours),
    storage: new Float64Array(p.hours),
    imported: new Float64Array(p.hours),
    hydrogen: new Float64Array(p.hours),
    fossil: new Float64Array(p.hours),
    unserved: new Float64Array(p.hours),
  };
  const h2Delivery = (input.hydrogenImport * 1e3) / p.hours;
  for (let h = 0; h < p.hours; h++) {
    h2 = Math.min(h2Max, h2 + h2Delivery);
    const weather =
      p.solar[h] * scale.solar +
      p.windOnshore[h] * scale.windOnshore +
      p.windOffshore[h] * scale.windOffshore;
    const steady = (p.hydro[h] + (p.biomass[h] * input.biomass) / 100) / 1e3;
    totals.weather += weather;
    totals.steady += steady;
    let net = weather + steady - demand[h];
    if (net >= 0) {
      hourly.renewable[h] = demand[h];
      const stored = Math.min(net, input.battery, (capacity - soc) / charge);
      soc += stored * charge;
      net -= stored;
      const split = Math.min(net, input.electrolysis, (h2Max - h2) / efficiencies.electrolysis);
      h2 += split * efficiencies.electrolysis;
      totals.electrolysis += split;
      net -= split;
      const out = Math.min(net, input.imports);
      totals.exported += out;
      totals.curtailed += net - out;
      continue;
    }
    hourly.renewable[h] = weather + steady;
    let gap = -net;
    const fromBattery = Math.min(gap, input.battery, soc * charge);
    soc -= fromBattery / charge;
    gap -= fromBattery;
    hourly.storage[h] = fromBattery;
    totals.battery += fromBattery;
    const fromH2 = Math.min(gap, input.gasPlants, h2 * efficiencies.hydrogenPlant);
    h2 -= fromH2 / efficiencies.hydrogenPlant;
    gap -= fromH2;
    hourly.hydrogen[h] = fromH2;
    totals.hydrogenPower += fromH2;
    const fromImport = Math.min(gap, input.imports);
    gap -= fromImport;
    hourly.imported[h] = fromImport;
    totals.imported += fromImport;
    const fromGas = Math.min(gap, input.gasPlants - fromH2);
    gap -= fromGas;
    const fromCoal = Math.min(gap, input.coal);
    gap -= fromCoal;
    hourly.fossil[h] = fromGas + fromCoal;
    totals.gasPower += fromGas;
    totals.coalPower += fromCoal;
    if (gap > 1e-9) {
      hourly.unserved[h] = gap;
      totals.unserved += gap;
      totals.unservedHours++;
      totals.maxShortGw = Math.max(totals.maxShortGw, gap);
    }
  }
  return {
    hours: p.hours,
    demand: demand.reduce((s, v) => s + v, 0),
    ...totals,
    // GWh × t/MWh = kt; divided by 1000 gives Mt.
    co2: (totals.gasPower * factors.gas + totals.coalPower * factors.coal) / 1e3,
    hardestWeek: hardestWeek(hourly),
    hourly,
  };
}

function hardestWeek(hourly: SystemResult['hourly']) {
  const week = 168;
  const pressure = (h: number) => hourly.unserved[h] * 1000 + hourly.fossil[h] + hourly.hydrogen[h];
  let best = 0;
  let bestValue = -1;
  for (let start = 0; start + week <= hourly.demand.length; start += 24) {
    let value = 0;
    for (let h = start; h < start + week; h++) value += pressure(h);
    if (value > bestValue) {
      bestValue = value;
      best = start;
    }
  }
  return best;
}

export function validateSystem(input: SystemInputs) {
  const values = Object.values(input);
  if (values.some((v) => typeof v === 'number' && !Number.isFinite(v)))
    return 'Bitte alle Felder mit Zahlen füllen.';
  if (values.some((v) => typeof v === 'number' && v < 0))
    return 'Negative Eingabewerte sind nicht möglich.';
  if (input.baseDemand <= 0) return 'Der Grundbedarf muss größer als null sein.';
  return '';
}
