import { defaults, type Energy, type Inputs, irr, type SolarProfile, simulate } from './model';

/**
 * Provider concepts compared on their own inputs: buying, renting, leasing out the roof and
 * buying solar power from a contractor, each with a fixed or dynamic electricity tariff. The
 * energy comes from the same hourly balance as the calculator, on the bundled Berlin profile;
 * the system configured in the calculator is never used here.
 */
export interface OfferInputs {
  household: number;
  cars: number;
  km: number;
  heat: boolean;
  kwp: number;
  battery: number;
  /** Fixed tariff, energy price in EUR/kWh. */
  price: number;
  priceChange: number;
  /** Feed-in payment for the owner or tenant of the system, EUR/kWh. */
  feedIn: number;
  /** Exported energy without payment, for example in hours with negative prices, percent. */
  unpaidExport: number;
  /** Local installer, complete system without storage, EUR per kWp. */
  localPrice: number;
  /** Storage, EUR per usable kWh. */
  storagePrice: number;
  /** Surcharge of a nationwide full-service provider over the local price, percent. */
  providerMarkup: number;
  /** Insurance, maintenance and meter for an owned system, EUR per year. */
  running: number;
  /** Inverter and storage replacement in the given operating year, EUR. */
  replacement: number;
  replacementYear: number;
  /** Rent for the complete package including service, EUR per month. */
  rent: number;
  rentYears: number;
  rentChange: number;
  /** Price to take over the system at the end of the rental term, EUR. */
  takeover: number;
  /** Roof lease paid to the owner, EUR per kWp and year. */
  lease: number;
  /** Price for solar power from a contractor's system on the own roof, EUR/kWh. */
  contractPrice: number;
  /** Whether the provider packages run with a dynamic tariff and energy manager. */
  bundleDynamic: boolean;
  /** Average dynamic price minus the fixed price for unshifted use, EUR/kWh. */
  dynamicDelta: number;
  /** Saving per shifted kWh against the average dynamic price, EUR/kWh. */
  spread: number;
  /** Share of car charging, heat pump and household use that can follow cheap hours, percent. */
  carFlex: number;
  heatFlex: number;
  householdFlex: number;
  /** Smart meter and dynamic tariff base fee above the fixed tariff, EUR per year. */
  meterCost: number;
  /** Energy manager or app subscription in a provider package, EUR per month. */
  subscription: number;
  years: number;
  discount: number;
}

export const offerDefaults: OfferInputs = {
  household: 4000,
  cars: 0,
  km: 12000,
  heat: false,
  kwp: 10,
  battery: 10,
  price: 0.35,
  priceChange: 0,
  feedIn: 0.077,
  unpaidExport: 10,
  localPrice: 1400,
  storagePrice: 500,
  providerMarkup: 25,
  running: 150,
  replacement: 4000,
  replacementYear: 13,
  rent: 235,
  rentYears: 20,
  rentChange: 0,
  takeover: 1,
  lease: 20,
  contractPrice: 0.27,
  bundleDynamic: true,
  dynamicDelta: 0,
  spread: 0.06,
  carFlex: 80,
  heatFlex: 30,
  householdFlex: 5,
  meterCost: 100,
  subscription: 15,
  years: 20,
  discount: 3,
};

export type OfferKey =
  | 'grid'
  | 'dynamic'
  | 'buyLocal'
  | 'buyProvider'
  | 'rent'
  | 'lease'
  | 'contract';

export const offerLabels: Record<OfferKey, string> = {
  grid: 'Netzstrom, Festpreis (z. B. Ökostrom)',
  dynamic: 'Nur Netzstrom, dynamisch',
  buyLocal: 'Kauf beim Fachbetrieb',
  buyProvider: 'Kauf beim Komplettanbieter',
  rent: 'Miete beim Komplettanbieter',
  lease: 'Dachfläche verpachten',
  contract: 'Solarstrom vom Dach kaufen',
};

/** Calculator inputs for the hourly balance: the offer's household and system, defaults elsewhere. */
export function offerEnergyInput(input: OfferInputs): Inputs {
  return {
    ...defaults,
    household: input.household,
    cars: input.cars,
    km: input.km,
    heat: input.heat,
    kwp: input.kwp,
    ac: input.kwp,
    battery: input.battery,
    batteryPower: Math.max(2.5, input.battery / 2),
  };
}

/** Yearly household, car and heat pump consumption, the same split the hourly model uses. */
export function consumers(input: OfferInputs) {
  const energy = offerEnergyInput(input);
  const car =
    (((energy.cars * energy.km * energy.carUse) / 100 / (1 - energy.chargeLoss / 100)) *
      energy.homeCharge) /
    100;
  const heat = energy.heat ? energy.heatDemand / energy.jaz : 0;
  return { household: input.household, car, heat };
}

/** Consumption that can follow cheap hours: per consumer a share of its yearly kWh. */
export function flexibleShare(input: OfferInputs) {
  const c = consumers(input);
  const total = c.household + c.car + c.heat;
  const flexible =
    (c.household * input.householdFlex + c.car * input.carFlex + c.heat * input.heatFlex) / 100;
  return total ? flexible / total : 0;
}

/**
 * Grid electricity cost for one year. A dynamic tariff charges the average price plus the delta,
 * and the flexible share of the grid draw saves the spread. Flexible loads are assumed to draw
 * from the grid in the same proportion as the rest; a battery is never charged from the grid.
 */
export function gridCost(input: OfferInputs, grid: number, year: number, dynamic: boolean) {
  const price = input.price * (1 + input.priceChange / 100) ** (year - 1);
  if (!dynamic) return grid * price;
  return (
    grid * (price + input.dynamicDelta) -
    grid * flexibleShare(input) * input.spread +
    input.meterCost
  );
}

export interface OfferYear {
  year: number;
  cost: number;
  cumulative: number;
}
export interface OfferResult {
  key: OfferKey;
  label: string;
  /** Payment before the first year, EUR. */
  upfront: number;
  firstYear: number;
  total: number;
  /** Present value of all payments at the discount rate. */
  presentCost: number;
  /** Total relative to grid electricity at the fixed price; negative is cheaper. */
  versusGrid: number;
  dynamic: boolean;
  owner: string;
  years: OfferYear[];
}

/** Energy flows for every operating year, shared by all models with a system on the roof. */
export function offerEnergy(profile: SolarProfile, input: OfferInputs): Energy[] {
  const energy = offerEnergyInput(input);
  return Array.from({ length: input.years }, (_, i) =>
    simulate(profile, energy, input.battery, i + 1)
  );
}

/** Investment of the same system at the local and at the provider price. */
export function investments(input: OfferInputs) {
  const local = input.kwp * input.localPrice + input.battery * input.storagePrice;
  return { local, provider: local * (1 + input.providerMarkup / 100) };
}

function exportRevenue(input: OfferInputs, e: Energy) {
  return e.export * input.feedIn * (1 - input.unpaidExport / 100);
}

function rentYear(input: OfferInputs, year: number) {
  return year <= input.rentYears ? input.rent * 12 * (1 + input.rentChange / 100) ** (year - 1) : 0;
}

/** Yearly payments of one model; year 0 is the payment before operation. */
function payments(
  key: OfferKey,
  input: OfferInputs,
  energy: Energy[],
  load: number
): { costs: number[]; dynamic: boolean; owner: string } {
  const { local, provider } = investments(input);
  const own = (e: Energy, year: number, dynamic: boolean) =>
    gridCost(input, e.grid, year, dynamic) -
    exportRevenue(input, e) +
    input.running +
    (year === input.replacementYear ? input.replacement : 0);
  const subscription = input.bundleDynamic ? input.subscription * 12 : 0;
  const years = energy.map((e, i) => ({ e, year: i + 1 }));
  switch (key) {
    case 'grid':
      return {
        costs: [0, ...years.map(({ year }) => gridCost(input, load, year, false))],
        dynamic: false,
        owner: '–',
      };
    case 'dynamic':
      return {
        costs: [0, ...years.map(({ year }) => gridCost(input, load, year, true))],
        dynamic: true,
        owner: '–',
      };
    case 'buyLocal':
      return {
        costs: [local, ...years.map(({ e, year }) => own(e, year, false))],
        dynamic: false,
        owner: 'Du, von Anfang an',
      };
    case 'buyProvider':
      return {
        costs: [
          provider,
          ...years.map(({ e, year }) => own(e, year, input.bundleDynamic) + subscription),
        ],
        dynamic: input.bundleDynamic,
        owner: 'Du, von Anfang an',
      };
    case 'rent':
      return {
        costs: [
          0,
          ...years.map(({ e, year }) =>
            year <= input.rentYears
              ? // Service, insurance and replacements are part of the rent during the term.
                gridCost(input, e.grid, year, input.bundleDynamic) -
                exportRevenue(input, e) +
                rentYear(input, year) +
                subscription +
                (year === input.rentYears ? input.takeover : 0)
              : own(e, year, input.bundleDynamic) + subscription
          ),
        ],
        dynamic: input.bundleDynamic,
        owner: `Anbieter, nach ${input.rentYears} Jahren du`,
      };
    case 'lease':
      return {
        costs: [
          0,
          ...years.map(({ year }) => gridCost(input, load, year, false) - input.lease * input.kwp),
        ],
        dynamic: false,
        owner: 'Investor',
      };
    case 'contract':
      return {
        costs: [
          0,
          ...years.map(
            ({ e, year }) =>
              gridCost(input, e.grid, year, false) + (e.load - e.grid) * input.contractPrice
          ),
        ],
        dynamic: false,
        owner: 'Contractor',
      };
  }
}

export const offerKeys = Object.keys(offerLabels) as OfferKey[];

/** All models over the same period, each against grid electricity at the fixed price. */
export function compareOffers(profile: SolarProfile, input: OfferInputs) {
  const energy = offerEnergy(profile, input);
  const load = energy[0].load;
  const results = offerKeys.map((key): Omit<OfferResult, 'versusGrid'> => {
    const { costs, dynamic, owner } = payments(key, input, energy, load);
    let cumulative = 0;
    const years = costs.map((cost, year) => {
      cumulative += cost;
      return { year, cost, cumulative };
    });
    return {
      key,
      label: offerLabels[key],
      upfront: costs[0],
      firstYear: costs[1],
      total: cumulative,
      presentCost: costs.reduce((sum, c, year) => sum + c / (1 + input.discount / 100) ** year, 0),
      dynamic,
      owner,
      years,
    };
  });
  const grid = results[0].total;
  return {
    energy: energy[0],
    offers: results.map((r): OfferResult => ({ ...r, versusGrid: r.total - grid })),
    rentRate: rentInterest(input),
    flexibleShare: flexibleShare(input),
  };
}

/**
 * The rent read as a loan: the provider price is paid out at the start, the rent minus the
 * running costs and replacements it covers is the repayment. The internal rate of these flows
 * is the interest the rent effectively charges. Energy and tariff are the same in both cases.
 */
export function rentInterest(input: OfferInputs): number | null {
  const term = input.rentYears;
  const flows = [investments(input).provider];
  for (let year = 1; year <= term; year++) {
    const covered = input.running + (year === input.replacementYear ? input.replacement : 0);
    flows.push(-(rentYear(input, year) - covered) - (year === term ? input.takeover : 0));
  }
  return irr(flows);
}

/** Signed inputs; every other number must not be negative. */
const signed: (keyof OfferInputs)[] = ['priceChange', 'rentChange', 'dynamicDelta'];
const shares: (keyof OfferInputs)[] = ['unpaidExport', 'carFlex', 'heatFlex', 'householdFlex'];

export function validateOffer(input: OfferInputs): string | null {
  const entries = Object.entries(input) as [keyof OfferInputs, unknown][];
  if (entries.some(([, v]) => typeof v === 'number' && !Number.isFinite(v)))
    return 'Bitte alle Zahleneingaben vervollständigen.';
  if (entries.some(([key, v]) => !signed.includes(key) && typeof v === 'number' && v < 0))
    return 'Negative Eingabewerte sind hier nur bei Preisänderungen vorgesehen.';
  if (shares.some((key) => Number(input[key]) > 100)) return 'Anteile bitte höchstens 100 %.';
  if (input.kwp < 1 || input.kwp > 30) return 'Die Anlagengröße bitte zwischen 1 und 30 kWp.';
  if (input.household < 500) return 'Den Haushaltsverbrauch bitte mit mindestens 500 kWh angeben.';
  if (input.years < 1 || input.years > 30 || !Number.isInteger(input.years))
    return 'Den Zeitraum bitte in ganzen Jahren zwischen 1 und 30 angeben.';
  if (input.rentYears < 1 || input.rentYears > input.years || !Number.isInteger(input.rentYears))
    return 'Die Mietlaufzeit bitte in ganzen Jahren, höchstens so lang wie der Zeitraum.';
  return null;
}
