/**
 * Thought experiment "Landesstrompreis": every federal state pays the average generation cost of
 * its own power plants instead of one nationwide market price. Deficit states buy the missing
 * electricity from surplus states. Yearly balances only; the hours behind them are not modelled.
 */
import {
  type Carrier,
  type CostCase,
  carrierLabels,
  disposalCent,
  environmentalCost,
  lcoe,
  pick,
} from './costs';
import data from './data/laender.json';

type Year = (typeof data.states)[number]['years'][number];
export type StateCode = (typeof data.states)[number]['code'];

export const stateYears = data.states[0].years.map((y) => y.year);

export type StateInputs = {
  year: number;
  costCase: CostCase;
  /** UBA environmental costs on top of the generation costs. */
  environment: boolean;
  /** Nuclear disposal: left out, carried by the state with the plant, or by everyone alike. */
  disposal: 'none' | 'state' | 'all';
  disposalCase: 'low' | 'high';
  /** Price of electricity a deficit state buys: the exporters' average or a peaking plant. */
  imports: 'exporters' | 'peaker';
  /** Own use of power plants and grid losses, in percent of generation. */
  losses: number;
};

export const stateDefaults: StateInputs = {
  year: 2021,
  costCase: 'mid',
  environment: false,
  disposal: 'none',
  disposalCase: 'low',
  imports: 'exporters',
  losses: 10,
};

const reported: Carrier[] = [
  'lignite',
  'hardCoal',
  'gas',
  'oil',
  'nuclear',
  'wind',
  'solar',
  'biomass',
  'hydro',
  'otherRenewable',
  'other',
];

/** Gross generation per carrier in GWh; secret cells end up in "unreported". */
function mix(y: { total: number | null }): Partial<Record<Carrier, number>> | null {
  if (y.total === null) return null;
  const known = Object.fromEntries(
    reported.map((c) => [c, (y as unknown as Record<string, number | null>)[c] ?? 0])
  ) as Record<Carrier, number>;
  const sum = reported.reduce((s, c) => s + known[c], 0);
  return { ...known, unreported: Math.max(0, y.total - sum) };
}

/** The nearest year with a value, the chosen one first and then the later of two equally near. */
function nearest(years: Year[], year: number, has: (y: Year) => boolean) {
  return years
    .filter(has)
    .sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year) || b.year - a.year)[0];
}

/** Generation and consumption may each come from another year when the chosen one is missing. */
function resolveYear(years: Year[], year: number) {
  const generation = nearest(years, year, (y) => y.total !== null);
  const consumption = nearest(years, year, (y) => y.consumption !== null);
  return {
    row: { ...generation, consumption: consumption.consumption },
    generationYear: generation.year,
    consumptionYear: consumption.year,
  };
}

export type StateResult = {
  code: StateCode;
  name: string;
  /** Years the figures come from; they differ from the chosen year where it is incomplete. */
  generationYear: number;
  consumptionYear: number;
  generation: number;
  consumption: number;
  selfSupply: number;
  ownCost: number;
  price: number;
  shares: Partial<Record<Carrier, number>>;
  unreportedShare: number;
};

/** Cost per generated kWh of one carrier, before losses, in ct/kWh. */
function carrierCost(carrier: Carrier, input: StateInputs, average: number, nuclearAdd: number) {
  const range = lcoe[carrier];
  const base = range ? pick(range, input.costCase) : average;
  const env = input.environment ? (environmentalCost[carrier] ?? 0) : 0;
  return base + env + (carrier === 'nuclear' ? nuclearAdd : 0);
}

export function statePrices(input: StateInputs, nuclearAfter2021Twh: number) {
  const rows = data.states.map((s) => {
    const resolved = resolveYear(s.years, input.year);
    return { code: s.code, name: s.name, ...resolved, mix: mix(resolved.row) ?? {} };
  });
  const keep = 1 - input.losses / 100;
  const perKwh = disposalCent(input.disposalCase, nuclearAfter2021Twh);
  // Carriers without a published cost take the generation-weighted average of those with one.
  const priced = rows.flatMap((r) =>
    (Object.entries(r.mix) as [Carrier, number][]).filter(([c]) => lcoe[c])
  );
  const pricedSum = priced.reduce((s, [, g]) => s + g, 0);
  const average =
    priced.reduce((s, [c, g]) => s + g * pick(lcoe[c] as never, input.costCase), 0) / pricedSum;
  const stateAdd = input.disposal === 'state' ? perKwh : 0;

  const own = rows.map((r) => {
    const entries = Object.entries(r.mix) as [Carrier, number][];
    const generation = entries.reduce((s, [, g]) => s + g, 0);
    const cost = entries.reduce((s, [c, g]) => s + g * carrierCost(c, input, average, stateAdd), 0);
    const consumption = r.row.consumption as number;
    const usable = generation * keep;
    return {
      ...r,
      generation,
      consumption,
      usable,
      // Losses make every delivered kWh dearer than a generated one.
      ownCost: generation ? cost / generation / keep : 0,
      nuclear: r.mix.nuclear ?? 0,
    };
  });
  const surplus = own.filter((r) => r.usable > r.consumption);
  const exported = surplus.reduce((s, r) => s + r.usable - r.consumption, 0);
  const exporterPrice = exported
    ? surplus.reduce((s, r) => s + (r.usable - r.consumption) * r.ownCost, 0) / exported
    : average;
  const importPrice =
    input.imports === 'peaker' ? carrierCost('oil', input, average, 0) / keep : exporterPrice;
  const totalConsumption = own.reduce((s, r) => s + r.consumption, 0);
  const commonAdd =
    input.disposal === 'all'
      ? (own.reduce((s, r) => s + r.nuclear, 0) * perKwh) / totalConsumption
      : 0;

  const states: StateResult[] = own.map((r) => {
    const fromOwn = Math.min(r.usable, r.consumption);
    const bought = r.consumption - fromOwn;
    const price = (fromOwn * r.ownCost + bought * importPrice) / r.consumption + commonAdd;
    return {
      code: r.code,
      name: r.name,
      generationYear: r.generationYear,
      consumptionYear: r.consumptionYear,
      generation: r.generation,
      consumption: r.consumption,
      selfSupply: (r.usable / r.consumption) * 100,
      ownCost: r.ownCost,
      price,
      shares: Object.fromEntries(
        (Object.entries(r.mix) as [Carrier, number][]).map(([c, g]) => [
          c,
          r.generation ? (g / r.generation) * 100 : 0,
        ])
      ),
      unreportedShare: r.generation ? ((r.mix.unreported ?? 0) / r.generation) * 100 : 0,
    };
  });
  const national = states.reduce((s, r) => s + r.price * r.consumption, 0) / totalConsumption;
  return { states, national, importPrice, average, disposalPerKwh: perKwh };
}

export const shareLabel = (carrier: Carrier) => carrierLabels[carrier];
