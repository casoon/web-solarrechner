import { defaults, demands, type Inputs, type SolarProfile, simulate, storageTechs } from './model';

/**
 * Component quality and what it is worth: modules, inverter and storage in three grades,
 * compared as two variants over the same hourly balance on the bundled Berlin profile. The
 * PVGIS profile (crystalline silicon, 14 % system loss) stands for a new system of the middle
 * grade; the other grades change it hour by hour relative to that reference.
 */
export type Grade = 'high' | 'mid' | 'basic';
export const grades: { key: Grade; label: string }[] = [
  { key: 'high', label: 'Hochwertig' },
  { key: 'mid', label: 'Durchschnitt' },
  { key: 'basic', label: 'Einfach' },
];

/**
 * Module bands from current datasheets and degradation studies: back-contact and
 * heterojunction cells, TOPCon, and older PERC cells. Efficiency only sets the power per
 * square metre; the yield per kWp depends on temperature coefficient and degradation.
 */
export const moduleGrades: Record<
  Grade,
  { cell: string; efficiency: number; tempCoeff: number; firstYear: number; annual: number }
> = {
  high: {
    cell: 'Rückkontakt, Heterojunction',
    efficiency: 23.5,
    tempCoeff: -0.26,
    firstYear: 1,
    annual: 0.25,
  },
  mid: { cell: 'TOPCon (n-Typ)', efficiency: 22.5, tempCoeff: -0.3, firstYear: 1, annual: 0.4 },
  basic: { cell: 'PERC (p-Typ)', efficiency: 21, tempCoeff: -0.35, firstYear: 2, annual: 0.55 },
};

/**
 * Inverter part-load curve after Schmidt and Sauer: losses as a share of rated power are
 * constant (self-consumption), linear and quadratic in the load `p`. The parameters give
 * European efficiencies of about 98.0, 97.0 and 95.3 %.
 */
export const inverterGrades: Record<Grade, { loss: [number, number, number] }> = {
  high: { loss: [0.0015, 0.0105, 0.009] },
  mid: { loss: [0.0025, 0.017, 0.012] },
  basic: { loss: [0.004, 0.027, 0.018] },
};

/** Storage grades: the HTW bands of the calculator plus capacity loss per year. */
export const storageGrades: Record<Grade, { efficiency: number; standby: number; ageing: number }> =
  {
    high: { efficiency: storageTechs[0].efficiency, standby: storageTechs[0].standby, ageing: 1.5 },
    mid: { efficiency: storageTechs[1].efficiency, standby: storageTechs[1].standby, ageing: 2 },
    basic: { efficiency: storageTechs[2].efficiency, standby: storageTechs[2].standby, ageing: 3 },
  };

export function inverterEfficiency(grade: Grade, load: number) {
  const [constant, linear, quadratic] = inverterGrades[grade].loss;
  return load / (load + constant + linear * load + quadratic * load * load);
}
/** Weighted part-load efficiency as on European datasheets. */
const euroWeights = [
  [0.05, 0.03],
  [0.1, 0.06],
  [0.2, 0.13],
  [0.3, 0.1],
  [0.5, 0.48],
  [1, 0.2],
] as const;
export function euroEfficiency(grade: Grade) {
  return euroWeights.reduce(
    (sum, [load, weight]) => sum + weight * inverterEfficiency(grade, load),
    0
  );
}
/** Module power in an operating year relative to the label: initial loss, then linear per year. */
export function modulePower(grade: Grade, year: number) {
  const m = moduleGrades[grade];
  return (1 - m.firstYear / 100) * (1 - m.annual / 100) ** (year - 1);
}

/** Cell temperature above ambient at full sun on a roof, kelvin. */
export const cellHeating = 30;
/** PVGIS output per kWp at full sun after the 14 % system loss. */
const fullSun = 0.86;

export type Variant = { module: Grade; inverter: Grade; storage: Grade };
export interface QualityInputs {
  household: number;
  /** Module power of variant A, kWp; also the inverter's AC power for both variants. */
  kwp: number;
  /** With a limited roof, variant B gets as much power as its module efficiency allows. */
  roofLimited: boolean;
  battery: number;
  price: number;
  priceChange: number;
  feedIn: number;
  /** Feed-in payment runs for this many years, then exported energy earns nothing. */
  feedInYears: number;
  exportLimit: number;
  years: number;
  discount: number;
  /** Extra price of variant A over variant B, EUR. */
  premium: number;
  a: Variant;
  b: Variant;
}
export const qualityDefaults: QualityInputs = {
  household: 4000,
  kwp: 10,
  roofLimited: false,
  battery: 8,
  price: 0.35,
  priceChange: 0,
  feedIn: 0.077,
  feedInYears: 20,
  exportLimit: 60,
  years: 20,
  discount: 3,
  premium: 1500,
  a: { module: 'high', inverter: 'high', storage: 'high' },
  b: { module: 'basic', inverter: 'basic', storage: 'basic' },
};

/**
 * The reference profile with this variant's modules and inverter: temperature and part-load
 * losses relative to the middle grade, and the initial module loss. Yearly degradation follows
 * in the simulation.
 */
export function variantProfile(profile: SolarProfile, v: Variant): SolarProfile {
  const m = moduleGrades[v.module];
  const ref = moduleGrades.mid;
  const hours = profile.hours.map(([time, yieldKwh, temp, ...rest]) => {
    const y = Number(yieldKwh);
    if (y <= 0) return [time, y, temp, ...rest];
    const above = Number(temp) + (cellHeating * y) / fullSun - 25;
    const thermal = (1 + (m.tempCoeff * above) / 100) / (1 + (ref.tempCoeff * above) / 100);
    const load = y / fullSun;
    const inverter = inverterEfficiency(v.inverter, load) / inverterEfficiency('mid', load);
    return [time, y * thermal * inverter * (1 - m.firstYear / 100), temp, ...rest];
  });
  return { ...profile, hours };
}

export function variantKwp(input: QualityInputs, v: Variant) {
  if (!input.roofLimited) return input.kwp;
  return (input.kwp * moduleGrades[v.module].efficiency) / moduleGrades[input.a.module].efficiency;
}

export type QualityYear = {
  year: number;
  pv: number;
  selfUse: number;
  export: number;
  value: number;
};

/** Every operating year of one variant on the hourly balance; values in nominal EUR. */
export function runVariant(profile: SolarProfile, input: QualityInputs, v: Variant): QualityYear[] {
  const s = storageGrades[v.storage];
  const energy: Inputs = {
    ...defaults,
    household: input.household,
    kwp: variantKwp(input, v),
    ac: input.kwp,
    battery: input.battery,
    batteryPower: Math.max(2.5, input.battery / 2),
    efficiency: s.efficiency,
    standby: s.standby,
    batteryDegradation: s.ageing,
    // No storage replacement inside the period: ageing runs from year 1.
    batteryYear: input.years + 1,
    degradation: moduleGrades[v.module].annual,
    exportLimit: input.exportLimit,
  };
  const adjusted = variantProfile(profile, v);
  const demand = demands(adjusted, energy);
  return Array.from({ length: input.years }, (_, i) => {
    const year = i + 1;
    const e = simulate(adjusted, energy, input.battery, year, demand);
    const selfUse = e.load - e.grid;
    const price = input.price * (1 + input.priceChange / 100) ** i;
    const feedIn = year <= input.feedInYears ? input.feedIn : 0;
    return {
      year,
      pv: e.pv,
      selfUse,
      export: e.export,
      value: selfUse * price + e.export * feedIn,
    };
  });
}

const sum = (rows: QualityYear[], key: keyof QualityYear) => rows.reduce((s, r) => s + r[key], 0);
function presentValue(rows: QualityYear[], discount: number) {
  return rows.reduce((s, r) => s + r.value / (1 + discount / 100) ** r.year, 0);
}

/** Variant B with one component of variant A: what that component alone is worth. */
const components = [
  { key: 'module', label: 'Module' },
  { key: 'inverter', label: 'Wechselrichter' },
  { key: 'storage', label: 'Speicher' },
] as const;

export function compareQuality(profile: SolarProfile, input: QualityInputs) {
  const a = runVariant(profile, input, input.a);
  const b = runVariant(profile, input, input.b);
  const base = { value: sum(b, 'value'), pv: sum(b, 'pv'), npv: presentValue(b, input.discount) };
  let cumulative = 0;
  const yearly = a.map((r, i) => {
    cumulative += r.value - b[i].value;
    return { year: r.year, a: r, b: b[i], gain: r.value - b[i].value, cumulative };
  });
  const parts = components.map((c) => {
    const same = input.a[c.key] === input.b[c.key];
    const rows = same ? b : runVariant(profile, input, { ...input.b, [c.key]: input.a[c.key] });
    return {
      key: c.key,
      label: c.label,
      same,
      pv: sum(rows, 'pv') - base.pv,
      value: sum(rows, 'value') - base.value,
    };
  });
  const gainNpv = presentValue(a, input.discount) - base.npv;
  const breakEven = yearly.find((y) => y.cumulative >= input.premium)?.year;
  return {
    yearly,
    parts,
    pvA: sum(a, 'pv'),
    pvB: base.pv,
    gain: cumulative,
    gainNpv,
    netNpv: gainNpv - input.premium,
    breakEven,
    firstYearShare: a[0].pv / b[0].pv - 1,
  };
}
export type QualityResult = ReturnType<typeof compareQuality>;

export function validateQuality(input: QualityInputs) {
  const values = [
    input.household,
    input.kwp,
    input.battery,
    input.price,
    input.priceChange,
    input.feedIn,
    input.feedInYears,
    input.exportLimit,
    input.years,
    input.discount,
    input.premium,
  ];
  if (values.some((v) => !Number.isFinite(v))) return 'Bitte alle Felder mit Zahlen füllen.';
  // Only the price change may be negative.
  if (values.some((v) => v < 0 && v !== input.priceChange))
    return 'Negative Eingabewerte sind nicht möglich.';
  if (input.kwp <= 0 || input.kwp > 30)
    return 'Die Anlagenleistung muss zwischen 0 und 30 kWp liegen.';
  if (input.battery > 30) return 'Der Speicher darf höchstens 30 kWh groß sein.';
  if (input.years < 1 || input.years > 30 || !Number.isInteger(input.years))
    return 'Der Zeitraum muss zwischen 1 und 30 ganzen Jahren liegen.';
  if (input.exportLimit > 100) return 'Die Einspeisegrenze darf höchstens 100 % betragen.';
  if (input.priceChange < -20) return 'Die Strompreisänderung muss über −20 % pro Jahr liegen.';
  return '';
}

/** Year-by-year module power of the three grades, against a typical warranty line. */
export function moduleSpec() {
  const years = Array.from({ length: 30 }, (_, i) => i + 1);
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'line',
    tokens: {
      'color-1': '#3d5d53',
      'color-2': '#e6b734',
      'color-3': '#b4533c',
      'color-4': '#8a8a80',
    },
    title: 'Modulleistung über 30 Jahre in Prozent der Nennleistung',
    source: 'Typische Werte je Zelltechnik · Garantie: 25 Jahre auf 80 %, linear',
    categoryAxis: { title: 'Betriebsjahr' },
    valueAxis: { title: 'Leistung in %' },
    categories: years.map(String),
    series: [
      ...grades.map((g) => ({
        name: `${g.label} (${moduleGrades[g.key].cell})`,
        values: years.map((y) => Math.round(modulePower(g.key, y) * 1000) / 10),
      })),
      {
        name: 'Garantie 25 Jahre/80 %',
        values: years.map((y) =>
          y <= 25 ? Math.round((98 - ((y - 1) * 18) / 24) * 10) / 10 : null
        ),
      },
    ],
  };
}

/** Part-load efficiency curves of the three inverter grades. */
export function inverterSpec() {
  const loads = [5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'line',
    tokens: { 'color-1': '#3d5d53', 'color-2': '#e6b734', 'color-3': '#b4533c' },
    title: 'Wechselrichter-Wirkungsgrad nach Auslastung',
    source: 'Teillastmodell nach Schmidt/Sauer · typische Kennlinien, keine Herstellerdaten',
    categoryAxis: { title: 'Auslastung in % der Nennleistung' },
    valueAxis: { title: 'Wirkungsgrad in %' },
    categories: loads.map(String),
    series: grades.map((g) => ({
      name: `${g.label} (η EU ${(euroEfficiency(g.key) * 100).toFixed(1).replace('.', ',')} %)`,
      values: loads.map((l) => Math.round(inverterEfficiency(g.key, l / 100) * 1000) / 10),
    })),
  };
}

/** Cumulative extra value of variant A against its extra price. */
export function valueSpec(result: QualityResult, premium: number) {
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'line',
    tokens: { 'color-1': '#3d5d53', 'color-2': '#b4533c' },
    title: 'Mehrwert von Variante A gegenüber B, aufsummiert',
    source:
      'Eigene Modellrechnung · Berliner PVGIS-Profil · stündliche Bilanz · Annahmen veränderbar',
    categoryAxis: { title: 'Betriebsjahr' },
    valueAxis: { title: 'EUR' },
    categories: result.yearly.map((y) => String(y.year)),
    series: [
      { name: 'Mehrwert aufsummiert', values: result.yearly.map((y) => Math.round(y.cumulative)) },
      { name: 'Aufpreis von A', values: result.yearly.map(() => Math.round(premium)) },
    ],
  };
}

/** Yearly AC yield of both variants. */
export function yieldSpec(result: QualityResult) {
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'line',
    tokens: { 'color-1': '#3d5d53', 'color-2': '#b4533c' },
    title: 'Solarertrag je Betriebsjahr',
    source: 'Eigene Modellrechnung · Berliner PVGIS-Profil · stündliche Bilanz',
    categoryAxis: { title: 'Betriebsjahr' },
    valueAxis: { title: 'kWh' },
    categories: result.yearly.map((y) => String(y.year)),
    series: [
      { name: 'Variante A', values: result.yearly.map((y) => Math.round(y.a.pv)) },
      { name: 'Variante B', values: result.yearly.map((y) => Math.round(y.b.pv)) },
    ],
  };
}
