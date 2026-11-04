import {
  continuedRate,
  type PolicyPlan,
  policyExportLimit,
  policyYear,
  transitionEligible,
  transitionRate,
} from './policy';

/** Approximate hourly AC-bus model. Own synthetic demand profiles, never measured household data. */
export interface SolarProfile {
  location: string;
  lat: number;
  lon: number;
  angle: number;
  aspect: number;
  source: string;
  retrieved: string;
  year: number;
  period: string;
  hours: (string | number)[][];
}
export interface Inputs {
  mode: 'roof' | 'balcony';
  kwp: number;
  ac: number;
  shade: number;
  /** Yearly irradiance relative to the long-term mean, in percent. */
  weather: number;
  household: number;
  pattern: 'evening' | 'day' | 'flat';
  peaks: PeakProfile;
  baseWatts: number;
  cars: number;
  km: number;
  carUse: number;
  homeCharge: number;
  chargeLoss: number;
  chargeTime: 'day' | 'evening';
  chargePower: number;
  /** Days per week a car is parked at home during the day, weekend days counted first. */
  carDaysHome: number;
  /** Energy the car may still lack at night, kWh: it waits for the next sunny day instead of the grid. */
  carBuffer: number;
  /** Whether the storage may discharge into the car. Off is the usual energy-manager setting: the storage serves the house. */
  storageChargesCar: boolean;
  /** Wallbox for surplus charging: with phase switching (from 1.4 kW), three-phase only (from 4.1 kW) or single-phase (1.4 to 4.6 kW). */
  wallbox: 'switching' | 'three' | 'single';
  heat: boolean;
  heatDemand: number;
  jaz: number;
  battery: number;
  batteryPower: number;
  efficiency: number;
  standby: number;
  equipment: number;
  installation: number;
  electrics: number;
  extras: number;
  batteryCost: number;
  running: number;
  batteryRunning: number;
  /** Extra yearly grid base charge for households with their own generation, if one is introduced. */
  prosumerFee: number;
  /** Yearly base charge of the electricity contract. Paid with and without the system alike. */
  basePrice: number;
  /** One-off extra for charging the car from solar surplus: wallbox with solar control or energy manager. */
  wallboxCost: number;
  /** Idea only: monthly lease of a second electric car that stays at home and charges instead of a storage. */
  leaseRate: number;
  /** Monthly insurance, maintenance and parking of that second car. */
  leaseExtra: number;
  inverterReplacement: number;
  inverterYear: number;
  batteryReplacement: number;
  /** Quality line of the storage; sets the price and, through `storageGrades`, its technical values. */
  batteryGrade: StorageGrade;
  /** Replace the storage at the end of its life; otherwise the system runs on without storage. */
  batteryReplace: boolean;
  /** Operating year of the first storage replacement; reaching the cycle life brings it forward. Repeats with the same life. */
  batteryYear: number;
  /** Full cycles until the storage is replaced. */
  batteryCycles: number;
  price: number;
  priceChange: number;
  tariff: number;
  negativeShare: number;
  exportLimit: number;
  years: number;
  degradation: number;
  batteryDegradation: number;
  discount: number;
  loanPercent: number;
  interest: number;
  loanYears: number;
  fees: number;
}
export const defaults: Inputs = {
  mode: 'roof',
  kwp: 7,
  ac: 7,
  shade: 0,
  weather: 0,
  household: 3500,
  pattern: 'evening',
  peaks: 'typical',
  baseWatts: 0,
  cars: 0,
  km: 12000,
  carUse: 18,
  homeCharge: 80,
  chargeLoss: 10,
  chargeTime: 'evening',
  chargePower: 7.4,
  carDaysHome: 7,
  /** Applies to day charging only; 0 would cap solar charging at one day's need per home day. */
  carBuffer: 20,
  storageChargesCar: false,
  wallbox: 'switching',
  heat: false,
  heatDemand: 15000,
  jaz: 3.5,
  battery: 5,
  batteryPower: 2.5,
  efficiency: 88,
  standby: 10,
  equipment: 5500,
  installation: 2500,
  electrics: 1500,
  extras: 0,
  batteryCost: 3000,
  running: 100,
  batteryRunning: 15,
  prosumerFee: 0,
  basePrice: 150,
  wallboxCost: 800,
  leaseRate: 200,
  leaseExtra: 50,
  inverterReplacement: 1200,
  inverterYear: 12,
  batteryReplacement: 2200,
  batteryGrade: 'standard',
  batteryReplace: true,
  batteryYear: 13,
  batteryCycles: 6000,
  price: 0.35,
  /** Nominal rise about in step with inflation; the same assumption as on the price page. */
  priceChange: 2,
  tariff: 0,
  negativeShare: 10,
  exportLimit: 60,
  years: 20,
  degradation: 0.5,
  batteryDegradation: 2,
  discount: 3,
  loanPercent: 0,
  interest: 5,
  loanYears: 10,
  fees: 0,
};
/**
 * Weather years: PVGIS gives a year-to-year standard deviation of about 6 % of the yearly yield
 * for German sites (Berlin, 35°: 60 of 1,057 kWh/kWp, SARAH3 2005–2023).
 */
export const weatherYears = [
  { change: -6, label: 'Schwaches Jahr' },
  { change: 0, label: 'Mittleres Jahr' },
  { change: 6, label: 'Starkes Jahr' },
] as const;
/**
 * Storage technology bands from the HTW Berlin Stromspeicher-Inspektion 2025 lab measurements:
 * stand-by with an empty battery between 2 W and 64 W, battery efficiency around 96 % on average,
 * plus conversion losses in charging and discharging.
 */
export const storageTechs = [
  { key: 'efficient', label: 'Effizient', efficiency: 92, standby: 3 },
  { key: 'typical', label: 'Typisch', efficiency: 88, standby: 10 },
  { key: 'lossy', label: 'Verlustreich', efficiency: 82, standby: 35 },
] as const;
export type StorageGrade = 'basic' | 'standard' | 'premium';
/**
 * Storage quality lines. Lifetime: calendar years until replacement and full cycles; typical
 * LFP home storage carries a 10-year warranty to 60-80 % capacity at 6,000-10,000 cycles, first
 * suppliers give 15 years; guides expect 10-15 (cautious) to 15-20 years. `price` scales the
 * storage cost estimate; efficiency and standby follow `storageTechs`.
 */
export const storageGrades: Record<
  StorageGrade,
  {
    label: string;
    price: number;
    efficiency: number;
    standby: number;
    degradation: number;
    year: number;
    cycles: number;
  }
> = {
  basic: { label: 'Günstig', price: 0.8, ...tech(2), degradation: 3, year: 11, cycles: 4000 },
  standard: { label: 'Standard', price: 1, ...tech(1), degradation: 2, year: 13, cycles: 6000 },
  premium: {
    label: 'Hochwertig',
    price: 1.25,
    ...tech(0),
    degradation: 1.5,
    year: 18,
    cycles: 10000,
  },
};
function tech(index: number) {
  return { efficiency: storageTechs[index].efficiency, standby: storageTechs[index].standby };
}
/** Years one storage runs before the next replacement is due in year `1 + life`. */
const storageLife = (batteryYear: number) => Math.max(1, batteryYear - 1);
/** Replacement purchases fall every storage life, starting in `batteryYear`. */
export const replacementDue = (year: number, batteryYear: number) =>
  year > 1 && (year - 1) % storageLife(batteryYear) === 0;
export type PeakProfile = 'smooth' | 'typical' | 'cautious';
/**
 * Short appliance peaks (cooker, kettle, washing machine) inside an hour. A share of the
 * household's shaped demand arrives at `power` kW, which PV and battery can only partly cover.
 * Smooth hourly profiles without peaks give an upper bound for self-consumption.
 */
export const peakProfiles: Record<PeakProfile, { share: number; power: number; label: string }> = {
  smooth: { share: 0, power: 0, label: 'Gleichmäßig (Obergrenze)' },
  typical: { share: 0.25, power: 3, label: 'Typische Lastspitzen' },
  cautious: { share: 0.4, power: 4, label: 'Viele Lastspitzen (vorsichtig)' },
};
export const months = [
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
];
export interface Month {
  month: string;
  pv: number;
  load: number;
  direct: number;
  battery: number;
  grid: number;
  export: number;
  curtailed: number;
}
/** Where the home charging of the car came from, kWh. */
export interface CarEnergy {
  pv: number;
  battery: number;
  grid: number;
}
export interface Energy {
  pv: number;
  load: number;
  grid: number;
  direct: number;
  battery: number;
  charge: number;
  export: number;
  curtailed: number;
  /** Part of `curtailed` cut by the inverter's AC power, before any export limit. */
  clipped: number;
  losses: number;
  standby: number;
  endSoc: number;
  startSoc: number;
  unmetCar: number;
  /** Home charging of the car by source; the three parts add up to the charging energy. */
  car: CarEnergy;
  carMonthly: CarEnergy[];
  monthly: Month[];
  /** Sums per month and local hour of day, for the typical-day views. */
  hourly: HourOfDay[][];
}
export interface HourOfDay {
  pv: number;
  load: number;
  direct: number;
  battery: number;
  grid: number;
  days: number;
}
export type TariffRule = 'draft' | 'current' | 'zero';
export interface TariffInfo {
  rate: number;
  basis: string;
}
/** Compatibility helper for the initial rate; the calendar policy handles later revenue phases. */
export function tariffFor(
  kwp: number,
  date: string,
  rule: TariffRule = 'draft'
): TariffInfo | null {
  if (date < '2026-08-01' || date > '2030-12-31') return null;
  if (rule === 'zero')
    return { rate: 0, basis: 'Bewusstes Nullerlös-Szenario, keine Rechtsprognose' };
  if (rule === 'draft' && date >= '2027-01-01')
    return {
      rate: transitionEligible(kwp, date) ? transitionRate(date).transition : 0,
      basis:
        'EEG-2027-Entwurf, nicht beschlossen; Übergangszahlung nur bei passender Leistungsgrenze',
    };
  return {
    rate: continuedRate(kwp, date),
    basis:
      date <= '2026-12-31'
        ? 'Veröffentlicht: Inbetriebnahme 01.08.–31.12.2026'
        : 'Bisheriges EEG fortgeschrieben, nicht als künftiges Recht bestätigt',
  };
}
export function annuity(principal: number, annual: number, years: number): number {
  const r = annual / 100 / 12;
  return r === 0 ? principal / (years * 12) : (principal * r) / (1 - (1 + r) ** (-years * 12));
}
const localParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  hour: 'numeric',
  hourCycle: 'h23',
  month: 'numeric',
  weekday: 'short',
});
export const wallboxLabels = {
  switching: 'Mit Phasenumschaltung, ab 1,4 kW',
  three: 'Dreiphasig ohne Umschaltung, ab 4,1 kW',
  single: 'Einphasig, 1,4 bis 4,6 kW',
};
/** Lowest and highest charging power a wallbox type can follow from the surplus, kW. */
export const wallboxLimits = {
  switching: { min: 1.4, max: Number.POSITIVE_INFINITY },
  three: { min: 4.1, max: Number.POSITIVE_INFINITY },
  single: { min: 1.4, max: 4.6 },
};
/**
 * Roof surfaces with their own orientation: the hourly yields per kWp, weighted by module power,
 * form one profile. The model then works with the total kWp, one inverter and one meter.
 */
export function combineSurfaces(surfaces: { kwp: number; profile: SolarProfile }[]): SolarProfile {
  const total = surfaces.reduce((sum, s) => sum + s.kwp, 0);
  const [first] = surfaces;
  const hours = first.profile.hours.map(([time, , ...rest], i) => [
    time,
    surfaces.reduce((sum, s) => sum + Number(s.profile.hours[i][1]) * s.kwp, 0) / total,
    ...rest,
  ]);
  return { ...first.profile, hours };
}
/** Weekday order in which a car counts as at home during the day: weekend first. */
const homeDayOrder = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
/**
 * Home charging in one hour, given the energy still pending. `buffer` is the part the car may
 * still lack overnight; evening charging only tops up what lies above it.
 */
function carCharge(
  input: Inputs,
  h: number,
  pending: number,
  surplus: number,
  home: boolean,
  buffer: number
) {
  const { min, max } = wallboxLimits[input.wallbox];
  const power = Math.min(input.chargePower, max);
  if (input.chargeTime === 'day' && h >= 9 && h < 17) {
    // PV-surplus charging: only when the wallbox's lowest charging power (6 A) is left over.
    return home && surplus >= min ? Math.min(pending, power, surplus) : 0;
  }
  if (h >= (input.chargeTime === 'day' ? 17 : 18) && h < 24) {
    // Evening charging, or the rest the sun did not cover so the car is ready next morning.
    return Math.min(Math.max(0, pending - buffer), power);
  }
  return 0;
}
export function demands(profile: SolarProfile, input: Inputs) {
  const times = profile.hours.map(([stamp]) => {
    const s = String(stamp);
    const date = new Date(
      `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:00:00Z`
    );
    const p = Object.fromEntries(localParts.formatToParts(date).map((x) => [x.type, x.value]));
    return {
      h: Number(p.hour) + 0.5,
      month: Number(p.month) - 1,
      weekend: p.weekday === 'Sat' || p.weekday === 'Sun',
      carHome: homeDayOrder.indexOf(p.weekday) < input.carDaysHome,
    };
  });
  const gaussian = (h: number, mean: number, sigma: number) =>
    Math.exp(-0.5 * ((h - mean) / sigma) ** 2);
  const shape = times.map(({ h, weekend, month }) => {
    const shift = weekend ? 1.5 : 0;
    const w =
      input.pattern === 'flat'
        ? 1
        : input.pattern === 'day'
          ? 0.45 + 0.6 * gaussian(h, 8 + shift, 1.8) + gaussian(h, 13, 3) + 1.2 * gaussian(h, 19, 2)
          : 0.65 + 0.8 * gaussian(h, 7.5 + shift, 1.6) + 1.4 * gaussian(h, 19, 2);
    return w * (1 + 0.2 * Math.cos((2 * Math.PI * month) / 12));
  });
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const base = input.baseWatts / 1000;
  const remaining = Math.max(0, input.household - base * times.length);
  const shapeSum = sum(shape);
  const heating = profile.hours.map((r) => Math.max(0, 15 - Number(r[2])));
  const heatSum = sum(heating);
  const wp = input.heat ? input.heatDemand / input.jaz : 0;
  const shaped = shape.map((w) => (remaining * w) / shapeSum);
  const home = shaped.map(
    (x, i) =>
      base +
      x +
      wp * (0.2 / times.length + 0.8 * (heatSum ? heating[i] / heatSum : 1 / times.length))
  );
  const limit = input.mode === 'balcony' ? 0.8 : input.ac;
  const pvScale = input.kwp * (1 - input.shade / 100);
  const carDaily =
    (((input.cars * input.km * input.carUse) / 100 / (1 - input.chargeLoss / 100)) *
      input.homeCharge) /
    100 /
    (times.length / 24);
  let pending = 0;
  let unmetCar = 0;
  const car: number[] = [];
  const last = times.length - 24;
  const load = times.map(({ h, carHome }, i) => {
    if (i % 24 === 0) pending += carDaily;
    // The buffer only applies to day charging and not on the last day, so the year stays complete.
    const buffer = input.chargeTime === 'day' && i < last ? input.carBuffer : 0;
    const surplus = Math.min(Number(profile.hours[i][1]) * pvScale, limit) - home[i];
    const charged = carCharge(input, h, pending, surplus, carHome, buffer);
    pending -= charged;
    // Each UTC day ends with at most the buffer pending; unmet home charging is reported separately.
    if (i % 24 === 23) {
      unmetCar += Math.max(0, pending - buffer);
      pending = Math.min(pending, buffer);
    }
    car.push(charged);
    return home[i] + charged;
  });
  return { times, load, shaped, unmetCar, car };
}
/** Limits that stay the same for every hour of a simulated year. */
interface HourSetup {
  /** Usable storage capacity after ageing, kWh. */
  cap: number;
  /** One-way efficiency, the square root of the round trip. */
  eta: number;
  power: number;
  limit: number;
  exportCap: number;
  peak: { share: number; power: number };
  balcony: boolean;
  /** The storage may discharge into the car. */
  batteryCar: boolean;
}
type HourFlows = ReturnType<typeof dispatchHour>;
/**
 * One hour of the energy balance. PV covers the smooth load first, then the share of a load
 * peak its remaining power can follow; the rest charges the storage, is exported or curtailed.
 */
function dispatchHour(
  s: HourSetup,
  soc: number,
  raw: number,
  load: number,
  spike: number,
  car: number
) {
  // AC-coupled battery: clipping occurs before charging; no claim to recover DC clipping.
  const pv = Math.min(raw, s.limit);
  const smooth = load - spike;
  const directSmooth = Math.min(pv, smooth);
  const pvLeft = pv - directSmooth;
  // During a peak only the PV power left over at that moment helps, not the hour's energy.
  const directSpike = spike ? spike * Math.min(1, pvLeft / s.peak.power) : 0;
  const direct = directSmooth + directSpike;
  const charge = s.cap ? Math.min(pv - direct, s.power, Math.max(0, s.cap - soc) / s.eta) : 0;
  let next = soc + charge * s.eta;
  // The house comes first: the car gets the PV left after the smooth house load.
  const houseSmooth = smooth - car;
  const carPv = Math.min(car, Math.max(0, pv - houseSmooth));
  const smoothDeficit = smooth - directSmooth;
  // With the storage kept out of the car, only the house part of the deficit may be discharged.
  const houseDeficit = smoothDeficit - (car - carPv);
  const batteryDeficit = s.batteryCar ? smoothDeficit : houseDeficit;
  const spikeDeficit = spike - directSpike;
  const spikePower = Math.max(0, s.peak.power - pvLeft);
  const spikeBattery =
    spikeDeficit && spikePower
      ? spikeDeficit * Math.min(1, Math.max(0, s.power - batteryDeficit) / spikePower)
      : 0;
  const discharge = s.cap
    ? Math.min(
        batteryDeficit + spikeBattery,
        s.power,
        next * s.eta,
        s.balcony ? Math.max(0, s.limit - direct) : Infinity
      )
    : 0;
  next -= discharge / s.eta;
  const exported = Math.min(pv - direct - charge, s.exportCap);
  // The storage serves the house first; only what it gives beyond that went into the car.
  const carBattery = s.batteryCar ? Math.max(0, discharge - houseDeficit - spikeBattery) : 0;
  return {
    carPv,
    carBattery,
    carGrid: Math.max(0, car - carPv - carBattery),
    soc: next,
    raw,
    direct,
    charge,
    discharge,
    exported,
    curtailed: raw - direct - charge - exported,
    clipped: raw - pv,
    grid: load - direct - discharge,
  };
}
/** Adds one hour to the yearly, monthly and hour-of-day sums. */
function record(
  out: Energy,
  demand: ReturnType<typeof demands>,
  i: number,
  standby: number,
  f: HourFlows
) {
  const home = demand.load[i];
  out.pv += f.raw;
  out.load += home;
  out.direct += f.direct;
  out.charge += f.charge;
  out.battery += f.discharge;
  out.grid += f.grid;
  out.export += f.exported;
  out.curtailed += f.curtailed;
  out.clipped += f.clipped;
  out.standby += standby;
  const { month, h } = demand.times[i];
  for (const part of [out.car, out.carMonthly[month]]) {
    part.pv += f.carPv;
    part.battery += f.carBattery;
    part.grid += f.carGrid;
  }
  const m = out.monthly[month];
  m.pv += f.raw;
  m.load += home;
  m.direct += f.direct;
  m.battery += f.discharge;
  m.grid += f.grid;
  m.export += f.exported;
  m.curtailed += f.curtailed;
  const slot = out.hourly[month][Math.floor(h)];
  slot.pv += f.raw;
  slot.load += home + standby;
  slot.direct += f.direct;
  slot.battery += f.discharge;
  slot.grid += f.grid;
  slot.days += 1;
}
export function simulate(
  profile: SolarProfile,
  input: Inputs,
  capacity: number,
  year = 1,
  demand = demands(profile, input)
): Energy {
  const eta = Math.sqrt(input.efficiency / 100);
  const batteryAge = (year - 1) % storageLife(input.batteryYear);
  const cap = capacity * (1 - input.batteryDegradation / 100) ** batteryAge;
  const scale =
    input.kwp *
    (1 + input.weather / 100) *
    (1 - input.shade / 100) *
    (1 - input.degradation / 100) ** (year - 1);
  const limit = input.mode === 'balcony' ? 0.8 : input.ac;
  const exportCap = input.mode === 'balcony' ? 0.8 : (input.kwp * input.exportLimit) / 100;
  const setup: HourSetup = {
    cap,
    eta,
    power: Math.min(input.batteryPower, limit),
    limit,
    exportCap,
    peak: peakProfiles[input.peaks],
    balcony: input.mode === 'balcony',
    batteryCar: input.storageChargesCar,
  };
  const standby = capacity > 0 ? input.standby / 1000 : 0;
  const monthly = months.map((month) => ({
    month,
    pv: 0,
    load: 0,
    direct: 0,
    battery: 0,
    grid: 0,
    export: 0,
    curtailed: 0,
  }));
  const carMonthly = months.map(() => ({ pv: 0, battery: 0, grid: 0 }));
  const hourly = months.map(() =>
    Array.from({ length: 24 }, () => ({ pv: 0, load: 0, direct: 0, battery: 0, grid: 0, days: 0 }))
  );
  let soc = 0;
  // Warm-up on the same reference year avoids free initial energy. Final-year boundary is disclosed.
  for (let pass = 0; pass < 2; pass++) {
    const startSoc = soc;
    const out: Energy = {
      pv: 0,
      load: 0,
      grid: 0,
      direct: 0,
      battery: 0,
      charge: 0,
      export: 0,
      curtailed: 0,
      clipped: 0,
      losses: 0,
      standby: 0,
      startSoc,
      endSoc: 0,
      unmetCar: demand.unmetCar,
      car: { pv: 0, battery: 0, grid: 0 },
      carMonthly,
      monthly,
      hourly,
    };
    for (let i = 0; i < profile.hours.length; i++) {
      const raw = Number(profile.hours[i][1]) * scale;
      const load = demand.load[i] + standby;
      const flows = dispatchHour(
        setup,
        soc,
        raw,
        load,
        demand.shaped[i] * setup.peak.share,
        demand.car[i]
      );
      soc = flows.soc;
      if (pass === 1) record(out, demand, i, standby, flows);
    }
    if (pass === 1) {
      out.endSoc = soc;
      out.losses = out.charge - out.battery - (soc - startSoc);
      return out;
    }
  }
  throw new Error('Simulation did not finish');
}
export function calculate(profile: SolarProfile, input: Inputs, policy?: PolicyPlan) {
  const demand = demands(profile, input);
  const cases = [0, input.battery].map((capacity) =>
    evaluate(profile, input, policy, demand, capacity)
  );
  return {
    policy,
    without: cases[0],
    with: cases[1],
    extraBenefit: cases[1].benefit - cases[0].benefit,
    extraNpv: cases[1].npv - cases[0].npv,
  };
}
export interface StorageOption {
  battery: number;
  batteryCost: number;
  batteryReplacement: number;
}
/** Several storage sizes, each against the same system without storage. */
export function compareStorage(
  profile: SolarProfile,
  input: Inputs,
  policy: PolicyPlan | undefined,
  options: StorageOption[]
) {
  const demand = demands(profile, input);
  const without = evaluate(profile, input, policy, demand, 0);
  return options.map((option) => {
    const result = evaluate(profile, { ...input, ...option }, policy, demand, option.battery);
    return {
      ...option,
      result,
      extraBenefit: result.benefit - without.benefit,
      extraNpv: result.npv - without.npv,
    };
  });
}
export interface Variant {
  input: Inputs;
  policy?: PolicyPlan;
  /** Usable storage capacity of this case, kWh; 0 for the system without storage. */
  capacity: number;
}
/** Whole cases with their own inputs, for example other system sizes or charging habits. */
export function compareVariants(profile: SolarProfile, variants: Variant[]) {
  return variants.map(({ input, policy, capacity }) =>
    evaluate(profile, input, policy, demands(profile, input), capacity)
  );
}
/** Buffer of both day-charging cases, so the table compares only how often the car is at home. */
export const comparisonBuffer = 30;
/**
 * Charging habits for the same cars: in the evening, and during the day with the car only at the
 * weekend or always at home (for example two cars taking turns); both may wait for sun with a buffer.
 */
export function chargingCases(input: Inputs): { label: string; input: Inputs }[] {
  return [
    { label: 'Abends laden', input: { ...input, chargeTime: 'evening' } },
    {
      label: 'Tagsüber laden, Auto nur am Wochenende da',
      input: { ...input, chargeTime: 'day', carDaysHome: 2, carBuffer: comparisonBuffer },
    },
    {
      label: `Immer ein Auto zu Hause, ${comparisonBuffer} kWh Puffer`,
      input: { ...input, chargeTime: 'day', carDaysHome: 7, carBuffer: comparisonBuffer },
    },
  ];
}
type Case = ReturnType<typeof evaluate>;
/**
 * Idea: lease a second electric car instead of buying the storage. Two cars take turns, so one is
 * always at home and charges from the sun; the kilometres stay the same. `own` is the chosen charging
 * with storage, `car` a car always at home without any storage, its cost and replacement.
 */
export function leasedCar(own: Case, car: Case, input: Inputs) {
  const npv = car.npv - own.npv;
  const monthly = annuity(npv, input.discount, input.years);
  const storageSaved = own.investment - car.investment;
  return {
    storageSaved,
    /** Lease months the saved storage money pays at the start. */
    months: input.leaseRate > 0 ? storageSaved / input.leaseRate : 0,
    /** Difference in the yearly advantage, per month, first year. */
    yearly: (car.benefit - own.benefit) / 12,
    npv,
    /** The whole difference over the period as an equal monthly amount at the discount rate. */
    monthly,
    cost: input.leaseRate + input.leaseExtra,
    remaining: input.leaseRate + input.leaseExtra - monthly,
  };
}
/** Surplus charging needs a wallbox that follows the solar power; only then is its extra cost counted. */
export function surplusCharging(input: Inputs): boolean {
  return input.mode === 'roof' && input.cars > 0 && input.chargeTime === 'day';
}
/** Export revenue at the user's own flat tariff, used when no policy plan applies. */
function ownTariffYear(input: Inputs, e: Energy, year: number) {
  return {
    exportRevenue:
      e.export *
      (input.mode === 'balcony' || year > 20 ? 0 : input.tariff) *
      (1 - input.negativeShare / 100),
    bonusRevenue: 0,
    marketingCost: 0,
    technologyCost: 0,
    technologyInvestment: 0,
    phase: 'Eigene Annahme',
    exportLimit: input.exportLimit,
  };
}
/** Saved electricity plus revenue, minus running costs, in one operating year. */
function yearIncome(
  input: Inputs,
  e: Energy,
  revenue: ReturnType<typeof ownTariffYear>,
  year: number,
  capacity: number
) {
  return (
    (e.load - e.grid) * input.price * (1 + input.priceChange / 100) ** (year - 1) +
    revenue.exportRevenue +
    revenue.bonusRevenue -
    revenue.marketingCost -
    revenue.technologyCost -
    input.running -
    (input.mode === 'roof' ? input.prosumerFee : 0) -
    (capacity ? input.batteryRunning : 0)
  );
}
/** Inverter and storage replacements due in this operating year. */
function replacementCost(input: Inputs, year: number, capacity: number) {
  return (
    (year === input.inverterYear ? input.inverterReplacement : 0) +
    (capacity && input.batteryReplace && replacementDue(year, input.batteryYear)
      ? input.batteryReplacement
      : 0)
  );
}
/**
 * Value left in the last replacement storage at the end of the period, linear over its life.
 * Only bought replacements count; the first storage is part of the system like the modules.
 */
function storageResidual(input: Inputs, capacity: number, batteryYear: number) {
  if (!capacity || !input.batteryReplace || batteryYear > input.years) return 0;
  const life = storageLife(batteryYear);
  const last = input.years - ((input.years - 1) % life);
  return input.batteryReplacement * Math.max(0, 1 - (input.years - last + 1) / life);
}
/** Twelve monthly annuity payments, fewer once the loan is repaid. */
function loanYear(remaining: number, rate: number, interestRate: number) {
  let payments = 0;
  let left = remaining;
  for (let month = 0; month < 12 && left > 1e-7; month++) {
    const interest = (left * interestRate) / 100 / 12;
    const payment = Math.min(rate, left + interest);
    left = Math.max(0, left + interest - payment);
    payments += payment;
  }
  return { payments, remaining: left };
}
/** Interest over the whole loan term plus one-off fees, also beyond the calculation period. */
function loanCost(principal: number, rate: number, input: Inputs) {
  if (!principal) return 0;
  let paid = 0;
  let left = principal;
  for (let year = 0; year < input.loanYears; year++) {
    const loan = loanYear(left, rate, input.interest);
    paid += loan.payments;
    left = loan.remaining;
  }
  return paid - principal + input.fees;
}
/** One case of the comparison: the same PV system with the given usable storage capacity. */
function evaluate(
  profile: SolarProfile,
  input: Inputs,
  policy: PolicyPlan | undefined,
  demand: ReturnType<typeof demands>,
  capacity: number
) {
  const pvCost =
    input.equipment +
    input.installation +
    input.electrics +
    input.extras +
    (surplusCharging(input) ? input.wallboxCost : 0) +
    (policy?.setupCost ?? 0);
  const investment = pvCost + (capacity ? input.batteryCost : 0);
  const principal = (investment * input.loanPercent) / 100;
  const rate = principal ? annuity(principal, input.interest, input.loanYears) : 0;
  let balance = -investment;
  let equityBalance = -investment + principal - (principal ? input.fees : 0);
  let remaining = principal;
  let npv = -investment;
  // The same comparison from your own pocket: loan in, payments out, open debt paid at the end.
  let equityNpv = equityBalance;
  const cashflows = [
    {
      year: 0,
      cash: -investment,
      balance,
      equity: equityBalance,
      debt: remaining,
      saved: 0,
      load: 0,
      payments: 0,
      replacement: 0,
      residual: 0,
      exportRevenue: 0,
      bonusRevenue: 0,
      marketingCost: 0,
      technologyCost: 0,
      technologyInvestment: 0,
      phase: 'Investition',
      exportLimit: policy ? policyExportLimit(policy, input, 1) : input.exportLimit,
    },
  ];
  let energy: Energy | undefined;
  let benefit = 0;
  let batteryYear = input.batteryYear;
  for (let year = 1; year <= input.years; year++) {
    const yearInput = {
      ...input,
      batteryYear,
      exportLimit: policy ? policyExportLimit(policy, input, year) : input.exportLimit,
    };
    // Without replacement the system runs on without storage once its life is over.
    const live = input.batteryReplace || year < batteryYear ? capacity : 0;
    const e = simulate(profile, yearInput, live, year, demand);
    const revenue = policy ? policyYear(policy, input, e, year) : ownTariffYear(input, e, year);
    const income = yearIncome(input, e, revenue, year, live);
    if (year === 1) {
      energy = e;
      benefit = income;
      batteryYear = replacementYear(input, capacity, e);
    }
    const replacement = replacementCost(yearInput, year, capacity);
    const residual = year === input.years ? storageResidual(input, capacity, batteryYear) : 0;
    const cash = income - replacement + residual - revenue.technologyInvestment;
    const loan = loanYear(remaining, rate, input.interest);
    const payments = loan.payments;
    remaining = loan.remaining;
    balance += cash;
    equityBalance += cash - payments;
    npv += cash / (1 + input.discount / 100) ** year;
    equityNpv += (cash - payments) / (1 + input.discount / 100) ** year;
    cashflows.push({
      year,
      cash,
      balance,
      equity: equityBalance,
      debt: remaining,
      saved: e.load - e.grid,
      /** Demand of the year in kWh, the bill without a system. */
      load: e.load,
      /** Loan payments of the year. */
      payments,
      replacement,
      residual,
      ...revenue,
    });
  }
  const payback = paybackYear(cashflows.map((r) => r.balance));
  equityNpv -= remaining / (1 + input.discount / 100) ** input.years;
  return {
    energy: energy as Energy,
    investment,
    benefit,
    npv,
    irr: irr(cashflows.map((r) => r.cash)),
    payback,
    batteryYear,
    rate,
    principal,
    /** Paid from own pocket at the start: the investment not financed, plus loan fees. */
    ownFunds: investment - principal + (principal ? input.fees : 0),
    loanCost: loanCost(principal, rate, input),
    /** Present value with the loan: against investing your own money at the discount rate. */
    equityNpv,
    /** First year from which the balance after payments and open debt stays positive. */
    equityPayback: paybackYear(cashflows.map((r) => r.equity - r.debt)),
    balance,
    equityBalance: equityBalance - remaining,
    debt: remaining,
    cashflows,
    firstYear: cashflows[1],
  };
}
/**
 * Storage replacement year: the set year, or earlier when the full cycles of the first year
 * reach the cycle life sooner. A full cycle is one usable capacity discharged.
 */
export function replacementYear(input: Inputs, capacity: number, first: Energy): number {
  const perYear = capacity ? first.battery / capacity : 0;
  if (perYear <= 0) return input.batteryYear;
  return Math.min(input.batteryYear, Math.max(2, Math.floor(input.batteryCycles / perYear) + 1));
}
/**
 * Internal rate of return: the yearly rate at which the cash flows (year 0 first) have a net
 * present value of zero. Null when the flows never turn positive or the rate is outside -99 % to
 * 100 %.
 */
export function irr(cash: number[]): number | null {
  const npvAt = (rate: number) => cash.reduce((sum, c, year) => sum + c / (1 + rate) ** year, 0);
  let low = -0.99;
  let high = 1;
  if (npvAt(low) * npvAt(high) > 0) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (npvAt(low) * npvAt(mid) <= 0) high = mid;
    else low = mid;
  }
  return ((low + high) / 2) * 100;
}
/** First year from which the cumulative balance stays non-negative. */
export function paybackYear(balances: number[]): number | null {
  const year = balances.findIndex((b, i) => b >= 0 && balances.slice(i).every((f) => f >= 0));
  return year < 0 ? null : year;
}
/**
 * Cumulative balances of a calculated case under another yearly electricity price change.
 * Energy flows stay the same; only the value of self-used electricity changes.
 */
export function priceScenario(
  cashflows: { balance: number; saved: number }[],
  input: Pick<Inputs, 'price' | 'priceChange'>,
  change: number
): number[] {
  let delta = 0;
  return cashflows.map((row, year) => {
    if (year > 0)
      delta +=
        row.saved *
        input.price *
        ((1 + change / 100) ** (year - 1) - (1 + input.priceChange / 100) ** (year - 1));
    return row.balance + delta;
  });
}
/** Search range of the break-even values: electricity price in EUR/kWh and yearly change in percent. */
export const breakEvenLimits = { price: 2, change: 10 };
/**
 * Sum of a calculated case's cash flows under another electricity price and yearly change, each
 * discounted at `rate` percent. Energy flows stay the same, as in `priceScenario`.
 */
function cashSum(
  cashflows: { cash: number; saved: number }[],
  input: Pick<Inputs, 'price' | 'priceChange'>,
  price: number,
  change: number,
  rate: number
) {
  return cashflows.reduce((sum, row, year) => {
    const delta =
      year > 0
        ? row.saved *
          (price * (1 + change / 100) ** (year - 1) -
            input.price * (1 + input.priceChange / 100) ** (year - 1))
        : 0;
    return sum + (row.cash + delta) / (1 + rate / 100) ** year;
  }, 0);
}
/** Net present value of a calculated case under another electricity price and yearly change. */
export function npvScenario(
  cashflows: { cash: number; saved: number }[],
  input: Pick<Inputs, 'price' | 'priceChange' | 'discount'>,
  change: number
) {
  return cashSum(cashflows, input, input.price, change, input.discount);
}
/**
 * The electricity price today (EUR/kWh, at the chosen yearly change) or the yearly change (percent,
 * at the chosen price) at which a calculated case just breaks even: net present value zero, or with
 * `discounted` false the plain balance after the period. Null when even the upper search limit does
 * not get there; the lower limit when it is positive already.
 */
export function breakEven(
  cashflows: { cash: number; saved: number }[],
  input: Pick<Inputs, 'price' | 'priceChange' | 'discount'>,
  vary: 'price' | 'change',
  discounted = true
): number | null {
  const rate = discounted ? input.discount : 0;
  const value = (x: number) =>
    vary === 'price'
      ? cashSum(cashflows, input, x, input.priceChange, rate)
      : cashSum(cashflows, input, input.price, x, rate);
  let low = vary === 'price' ? 0 : -breakEvenLimits.change;
  let high = vary === 'price' ? breakEvenLimits.price : breakEvenLimits.change;
  if (value(high) < 0) return null;
  if (value(low) >= 0) return low;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (value(mid) < 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}
const incomplete = (input: Inputs) =>
  Object.values(input).some(
    (value) =>
      (typeof value === 'number' && !Number.isFinite(value)) ||
      value === undefined ||
      value === null
  );
/** Input checks in order; the first rule that fails gives the message. */
const rules: [fails: (input: Inputs) => boolean, message: string][] = [
  [incomplete, 'Bitte alle Zahleneingaben vervollständigen.'],
  [
    (input) =>
      Object.entries(input).some(
        ([key, v]) => key !== 'priceChange' && key !== 'weather' && typeof v === 'number' && v < 0
      ),
    'Negative Eingabewerte sind hier nicht vorgesehen.',
  ],
  [
    (input) => Math.abs(input.weather) > 15,
    'Das Sonnenjahr bitte höchstens 15 % unter oder über dem Mittel wählen.',
  ],
  [
    (input) => Math.abs(input.priceChange) > 10,
    'Die Strompreisänderung bitte zwischen −10 % und +10 % pro Jahr wählen.',
  ],
  [
    (input) =>
      input.kwp <= 0 ||
      input.kwp > 30 ||
      input.household <= 0 ||
      input.household > 50000 ||
      input.ac <= 0,
    'Bitte Anlagenleistung (bis 30 kWp), AC-Leistung und Haushaltsverbrauch prüfen.',
  ],
  [
    (input) => input.mode === 'balcony' && input.kwp > 2,
    'Im Balkonkraftwerk-Modus sind höchstens 2 kWp Modulleistung vorgesehen.',
  ],
  [
    (input) => input.baseWatts * 8.784 > input.household,
    'Die konstante Grundlast überschreitet den angegebenen Jahresverbrauch.',
  ],
  [
    (input) =>
      input.efficiency < 50 ||
      input.efficiency > 100 ||
      input.chargeLoss >= 50 ||
      input.jaz < 1 ||
      input.jaz > 8,
    'Bitte Wirkungsgrad, Ladeverlust oder Jahresarbeitszahl prüfen.',
  ],
  [
    (input) =>
      [
        input.shade,
        input.homeCharge,
        input.negativeShare,
        input.exportLimit,
        input.loanPercent,
      ].some((v) => v > 100),
    'Prozentwerte müssen zwischen 0 und 100 liegen.',
  ],
  [
    (input) =>
      input.years < 1 ||
      input.years > 25 ||
      input.loanYears < 1 ||
      input.loanYears > 30 ||
      input.interest > 25 ||
      input.battery > 40 ||
      input.batteryDegradation > 10 ||
      input.degradation > 5,
    'Bitte Laufzeiten, Zins, Speichergröße oder Alterung innerhalb der Demo-Grenzen wählen.',
  ],
  [
    (input) =>
      ![input.years, input.loanYears, input.inverterYear, input.batteryYear].every(
        Number.isInteger
      ) ||
      input.batteryYear < 1 ||
      input.inverterYear < 1,
    'Laufzeiten und Ersatzjahre bitte als ganze positive Jahre eingeben.',
  ],
  [(input) => ![0, 1, 2].includes(input.cars), 'Es sind null, ein oder zwei Autos vorgesehen.'],
  [
    (input) =>
      input.basePrice > 1000 ||
      input.wallboxCost > 10000 ||
      input.leaseRate > 3000 ||
      input.leaseExtra > 1000,
    'Grundpreis bis 1.000 € im Jahr, Wallbox-Aufpreis bis 10.000 €, Leasingrate bis 3.000 € und Nebenkosten bis 1.000 € im Monat angeben.',
  ],
  [
    (input) =>
      !Number.isInteger(input.carDaysHome) || input.carDaysHome > 7 || input.carBuffer > 200,
    'Tage mit Auto zu Hause bitte als ganze Zahl von 0 bis 7, Puffer im Autoakku bis 200 kWh.',
  ],
  [
    (input) => !(input.batteryCycles >= 500 && input.batteryCycles <= 20000),
    'Vollzyklen des Speichers bitte zwischen 500 und 20.000 angeben.',
  ],
];
export function validate(input: Inputs): string | null {
  return rules.find(([fails]) => fails(input))?.[1] ?? null;
}
