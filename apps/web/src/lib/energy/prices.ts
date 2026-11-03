/**
 * Household electricity prices: the history since 2007 and a scenario of their parts until 2046.
 * The scenario is no forecast. Every part follows the user's assumption; only decided changes
 * (levies 2027) and fixed amounts by law (electricity tax, concession fee) are set.
 */
import data from './data/prices.json';

export const history = data;
type HalfYear = (typeof data.halfYears)[number];
const latest = data.halfYears[data.halfYears.length - 1];

/** Price of a half-year in money of the latest half-year, deflated with the consumer price index. */
export const real = (h: HalfYear, value = h.total) => (value * latest.index) / h.index;

/** Average yearly change between two half-years, in percent. */
export function yearlyChange(from: HalfYear, to: HalfYear, adjust = false) {
  const years = (data.halfYears.indexOf(to) - data.halfYears.indexOf(from)) / 2;
  const start = adjust ? real(from) : from.total;
  const end = adjust ? real(to) : to.total;
  return ((end / start) ** (1 / years) - 1) * 100;
}

/** Average new-customer price 2026 for 3,500 kWh, BDEW-Strompreisanalyse, data as of 10/2026. */
export const today = {
  procurement: 15.41,
  gridFee: 9.24,
  concession: 1.666,
  levies: 2.946,
  electricityTax: 2.05,
  vatRate: 0.19,
};
export const start = 2026;
export const end = 2046;
/** Offshore grid levy, special grid use surcharge and CHP levy as published for 2027. */
export const levies2027 = 3.621;
/** Lowest electricity tax the EU allows for private use: 1 EUR/MWh. */
export const taxMinimum = 0.1;
/** Federal grant on transmission fees, lowering grid fees 2026 by about this much (BDEW). */
export const subsidyEffect = 1.7;
/** Start of the new grid fee system of the Bundesnetzagentur (AgNes). */
export const agnesYear = 2029;
export const capacityYear = 2031;

export type OutlookInputs = {
  /** Consumer price inflation, percent per year. */
  inflation: number;
  /** Procurement and supply in 2035, ct/kWh in money of 2026; linear from today, then constant. */
  procurement2035: number;
  /** A fuel price shock like 2022: full height in its year, half the year after. */
  shock: boolean;
  shockYear: number;
  shockHeight: number;
  /** Change of the grid fee by 2046, ct/kWh in money of 2026; linear from today. */
  gridChange: number;
  /** The federal grant on transmission fees ends after 2027. */
  subsidyEnds: boolean;
  /** Levy for new backup power plants from 2031, ct/kWh in money of 2026. */
  capacityLevy: number;
  /** Electricity tax for households lowered to the EU minimum from 2027. */
  taxCut: boolean;
  /** Share of the grid fee turned into a fixed charge from 2029, percent. */
  fixedShare: number;
};

export const outlookDefaults: OutlookInputs = {
  inflation: 2,
  procurement2035: today.procurement,
  shock: false,
  shockYear: 2030,
  shockHeight: 10,
  gridChange: 0,
  subsidyEnds: false,
  capacityLevy: 0,
  taxCut: false,
  fixedShare: 0,
};

/** Grid fee change by 2046 from studies, translated to ct/kWh on today's 9.24 ct. */
export const gridStudies = [
  { key: 'bdew', label: 'BDEW/Frontier: langfristig −10 bis −15 %', change: -1.2 },
  { key: 'none', label: 'Bleibt real wie heute', change: 0 },
  { key: 'imk-public', label: 'IMK: Netzausbau öffentlich finanziert', change: 1.7 },
  { key: 'imk-private', label: 'IMK: Netzausbau privat finanziert', change: 3 },
] as const;

export type OutlookYear = {
  year: number;
  procurement: number;
  grid: number;
  levies: number;
  vat: number;
  total: number;
  /** Total in money of 2026. */
  real: number;
  /** What a kWh from the own roof saves: the total without the grid fee's fixed share. */
  avoidable: number;
};

/** Surcharge of a price shock in a year, in money of 2026. */
function shockIn(input: OutlookInputs, year: number) {
  if (!input.shock) return 0;
  if (year === input.shockYear) return input.shockHeight;
  return year === input.shockYear + 1 ? input.shockHeight / 2 : 0;
}

/** Every year from 2026 to 2046 in nominal ct/kWh, VAT included. */
export function outlook(input: OutlookInputs): OutlookYear[] {
  return Array.from({ length: end - start + 1 }, (_, k) => {
    const year = start + k;
    const inflate = (1 + input.inflation / 100) ** k;
    const shock = shockIn(input, year);
    const procurement =
      (today.procurement +
        ((input.procurement2035 - today.procurement) * Math.min(k, 9)) / 9 +
        shock) *
      inflate;
    const gridFee =
      (today.gridFee +
        (input.gridChange * k) / (end - start) +
        (input.subsidyEnds && year >= 2028 ? subsidyEffect : 0)) *
      inflate;
    // The concession fee and the electricity tax are fixed amounts by law, not indexed.
    const grid = gridFee + today.concession;
    const levies =
      (year === start ? today.levies : levies2027) * inflate +
      (year >= capacityYear ? input.capacityLevy * inflate : 0) +
      (input.taxCut && year > start ? taxMinimum : today.electricityTax);
    const net = procurement + grid + levies;
    const vat = net * today.vatRate;
    const total = net + vat;
    const fixed = year >= agnesYear ? (gridFee * input.fixedShare * (1 + today.vatRate)) / 100 : 0;
    return {
      year,
      procurement,
      grid,
      levies,
      vat,
      total,
      real: total / inflate,
      avoidable: total - fixed,
    };
  });
}

/** Average yearly change of the total from 2026 to 2046, nominal and in money of 2026. */
export function outlookChange(years: OutlookYear[]) {
  const first = years[0];
  const last = years[years.length - 1];
  const n = years.length - 1;
  return {
    nominal: ((last.total / first.total) ** (1 / n) - 1) * 100,
    real: ((last.real / first.real) ** (1 / n) - 1) * 100,
  };
}

export type ValueInputs = {
  /** Self-consumed solar electricity per year, kWh. */
  kwh: number;
  years: number;
  /** Discount rate, percent per year, nominal. */
  discount: number;
};
export const valueDefaults: ValueInputs = { kwh: 2000, years: 20, discount: 3 };

/** Present value of the electricity bill a self-consumed kWh avoids, years 1 to `years`, in EUR. */
export function presentValue(prices: number[], v: ValueInputs) {
  let sum = 0;
  for (let t = 1; t <= v.years; t++) sum += (v.kwh * prices[t]) / 100 / (1 + v.discount / 100) ** t;
  return sum;
}

/** Today's price growing at a fixed rate, years 0 to 20. */
export const flatPath = (rate: number, base = outlook(outlookDefaults)[0].total) =>
  Array.from({ length: end - start + 1 }, (_, k) => base * (1 + rate / 100) ** k);
