import { energyColors, energyTokens } from './energy-display';
import { number, percent } from './format';
import { type calculate, type Energy, type Inputs, paybackYear, priceScenario } from './model';

type Result = ReturnType<typeof calculate>;
/** One side of the comparison: the same system with or without the storage. */
type Case = Result['with'];

export function monthlyRows(energy: Energy) {
  return energy.monthly.map((m) => ({
    Monat: m.month,
    PV_kWh: Math.round(m.pv),
    Bedarf_inkl_Standby_kWh: Math.round(m.direct + m.battery + m.grid),
    Solar_direkt_kWh: Math.round(m.direct),
    Speicherabgabe_kWh: Math.round(m.battery),
    Netz_kWh: Math.round(m.grid),
    Export_kWh: Math.round(m.export),
    Abregelung_kWh: Math.round(m.curtailed),
  }));
}

export function financeRows(cashflows: Case['cashflows']) {
  return cashflows.map((r) => ({
    Jahr: r.year,
    Cashflow_EUR: Math.round(r.cash),
    Projektsaldo_EUR: Math.round(r.balance),
    Eigenkapital_EUR: Math.round(r.equity),
    Restschuld_EUR: Math.round(r.debt),
    Erloes_EUR: Math.round(r.exportRevenue + r.bonusRevenue),
    Vermarktung_EUR: Math.round(r.marketingCost),
    Mess_Steuerbetrieb_EUR: Math.round(r.technologyCost),
    Technik_einmalig_EUR: Math.round(r.technologyInvestment),
    Phase: r.phase,
  }));
}

export function monthlySpec(energy: Energy) {
  const withStorage = energy.battery > 0;
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'bar',
    tokens: energyTokens(withStorage ? ['solar', 'storage', 'grid'] : ['solar', 'grid']),
    stack: 'normal',
    title: 'Woher dein Strom kommt, Monat für Monat',
    source: 'PVGIS · eigene synthetische Lastprofile · stündliche Bilanz',
    categoryAxis: { title: 'Monat' },
    valueAxis: { title: 'kWh' },
    categories: energy.monthly.map((m) => m.month),
    series: [
      { name: 'Solarstrom direkt', values: energy.monthly.map((m) => Math.round(m.direct)) },
      ...(withStorage
        ? [{ name: 'Aus dem Speicher', values: energy.monthly.map((m) => Math.round(m.battery)) }]
        : []),
      { name: 'Aus dem Netz', values: energy.monthly.map((m) => Math.round(m.grid)) },
    ],
  };
}

/**
 * The electricity bill in the first operating year: what the household would pay without the
 * system, every step that lowers or raises it, and what is left with the system.
 */
export function billBreakdown(current: Case, applied: Inputs, withBattery: boolean) {
  const e = current.energy;
  const first = current.firstYear;
  const running = applied.running + (withBattery ? applied.batteryRunning : 0);
  const steps = [
    { label: 'Selbst genutzt', value: -Math.round(e.direct * applied.price) },
    { label: 'Aus dem Speicher', value: -Math.round(e.battery * applied.price) },
    { label: 'Standby', value: Math.round(e.standby * applied.price) },
    { label: 'Einspeisung', value: -Math.round(first.exportRevenue + first.bonusRevenue) },
    { label: 'Laufende Kosten', value: Math.round(running) },
    { label: 'Messung, Steuerung', value: Math.round(first.technologyCost) },
    { label: 'Vermarktung', value: Math.round(first.marketingCost) },
    {
      label: 'Höherer Grundpreis',
      value: Math.round(applied.mode === 'roof' ? applied.prosumerFee : 0),
    },
  ].filter((step) => step.value !== 0);
  const without = Math.round(e.load * applied.price);
  return { steps, without, with: without + steps.reduce((sum, step) => sum + step.value, 0) };
}

/** Savings go down in green, extra costs up in red; totals stay neutral. */
export function billSpec(bill: ReturnType<typeof billBreakdown>, price: number) {
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'waterfall',
    tokens: { 'color-1': '#b4533c', 'color-2': energyColors.storage, 'color-3': '#4a5a66' },
    title: 'Stromkosten im ersten Betriebsjahr, in EUR',
    source: `Arbeitspreis ${number(price * 100, 1)} ct/kWh · ohne Grundpreis`,
    waterfall: {
      steps: [
        { label: 'Ohne Anlage', value: bill.without, kind: 'start' },
        ...bill.steps,
        { label: 'Mit Anlage', kind: 'total' },
      ],
    },
  };
}

export const dayMonths = [
  { index: 5, label: 'Juni' },
  { index: 2, label: 'März' },
  { index: 11, label: 'Dezember' },
] as const;

/** Average day of a month; kWh per hour equal the mean power in kW. */
export function daySpec(energy: Energy, month: number) {
  const hours = energy.hourly[month];
  const avg = (key: 'pv' | 'load' | 'grid' | 'battery') =>
    hours.map((h) => Math.round((h[key] / Math.max(1, h.days)) * 100) / 100);
  const withStorage = energy.battery > 0;
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'line',
    tokens: energyTokens(
      withStorage ? ['solar', 'neutral', 'storage', 'grid'] : ['solar', 'neutral', 'grid']
    ),
    title: `Ein durchschnittlicher Tag im ${dayMonths.find((m) => m.index === month)?.label}`,
    source:
      'Mittelwert aller Tage des Monats · kWh je Stunde entsprechen der mittleren Leistung in kW',
    categoryAxis: { title: 'Uhrzeit' },
    valueAxis: { title: 'kW' },
    categories: hours.map((_, h) => `${h}`),
    series: [
      { name: 'Solarpotenzial', values: avg('pv') },
      { name: 'Bedarf inkl. Standby', values: avg('load') },
      ...(withStorage ? [{ name: 'Aus dem Speicher', values: avg('battery') }] : []),
      { name: 'Aus dem Netz', values: avg('grid') },
    ],
  };
}

/** Share of demand covered by solar and storage, per month and three-hour block. */
export function coverSpec(energy: Energy) {
  const blocks = Array.from({ length: 8 }, (_, b) => b * 3);
  const label = (h: number) => `${h}–${h + 3}`;
  const months = energy.monthly.map((m) => m.month);
  const share = (month: number, start: number) => {
    const slots = energy.hourly[month].slice(start, start + 3);
    const load = slots.reduce((sum, h) => sum + h.load, 0);
    const own = slots.reduce((sum, h) => sum + h.direct + h.battery, 0);
    return load ? Math.round((own / load) * 100) : 0;
  };
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'heatmap',
    title: 'Wie viel deines Verbrauchs die Sonne deckt',
    source: 'Anteil aus Solarstrom und Speicher je Monat und Tageszeit',
    heatmap: {
      rows: months,
      columns: blocks.map(label),
      valueLabel: '% gedeckt',
      cells: months.flatMap((row, m) =>
        blocks.map((start) => ({ row, column: label(start), value: share(m, start) }))
      ),
    },
  };
}

export function balanceSpec(result: Result) {
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'line',
    title: 'Wann decken Einsparungen die Investition?',
    source: 'Eigene Szenariorechnung · ohne Finanzierung',
    categoryAxis: { title: 'Jahr' },
    valueAxis: { title: 'Kumulierter Saldo in EUR' },
    categories: result.without.cashflows.map((r) => String(r.year)),
    series: [
      { name: 'Ohne Speicher', values: result.without.cashflows.map((r) => Math.round(r.balance)) },
      { name: 'Mit Speicher', values: result.with.cashflows.map((r) => Math.round(r.balance)) },
    ],
  };
}

/** Fixed price paths plus the user's own assumption, each with its payback year. */
export function priceScenarios(cashflows: Case['cashflows'], applied: Inputs) {
  const changes = [...new Set([-2, 0, 2, 4, applied.priceChange])].sort((a, b) => a - b);
  return changes.map((change) => {
    const balances = priceScenario(cashflows, applied, change);
    return {
      change,
      label: change === 0 ? 'Preis bleibt gleich' : `Strompreis ${percent(change)} pro Jahr`,
      balances,
      payback: paybackYear(balances),
    };
  });
}

export function scenarioSpec(
  cashflows: Case['cashflows'],
  scenarios: ReturnType<typeof priceScenarios>
) {
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'line',
    title: 'Saldo bei unterschiedlicher Strompreisentwicklung',
    source: 'Eigene Szenariorechnung · gleiche Energiebilanz, nur der Strompreis ändert sich',
    categoryAxis: { title: 'Jahr' },
    valueAxis: { title: 'Kumulierter Saldo in EUR' },
    categories: cashflows.map((r) => String(r.year)),
    series: scenarios.map((s) => ({ name: s.label, values: s.balances.map(Math.round) })),
  };
}
