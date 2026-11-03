/** Chart specifications and table rows for the page on household electricity prices. */
import { history, type OutlookYear, real, today, yearlyChange } from './prices';

const round1 = (n: number) => Math.round(n * 10) / 10;
const halves = history.halfYears;
const latest = halves[halves.length - 1];
const eurostat = 'Eurostat nrg_pc_204, CC BY 4.0 · Haushalte 2.500–5.000 kWh';
export const halfLabel = (period: string) => `${period.slice(-1)}/${period.slice(2, 4)}`;
export const halfName = (period: string) => `${period.slice(-1)}. Halbjahr ${period.slice(0, 4)}`;

/** Price components 2026, largest first, net amounts plus VAT. */
export function todaySpec() {
  const vat =
    (today.procurement + today.gridFee + today.concession + today.levies + today.electricityTax) *
    today.vatRate;
  const parts = [
    ['Beschaffung und Vertrieb', today.procurement],
    ['Netzentgelt', today.gridFee],
    ['Mehrwertsteuer', vat],
    ['Umlagen (Offshore, § 19, KWKG)', today.levies],
    ['Stromsteuer', today.electricityTax],
    ['Konzessionsabgabe', today.concession],
  ] as const;
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'bar',
    orientation: 'horizontal',
    tokens: { 'color-1': '#466c9c' },
    title: 'Woraus der Haushaltsstrompreis 2026 besteht, in ct/kWh',
    source: 'BDEW-Strompreisanalyse, Datenstand 10/2026 · Neukunden, 3.500 kWh im Jahr',
    categoryAxis: { title: 'Bestandteil' },
    valueAxis: { title: 'ct/kWh' },
    categories: parts.map(([label]) => label),
    series: [{ name: 'ct/kWh', values: parts.map(([, v]) => Math.round(v * 100) / 100) }],
  };
}

export const historyTokens = { 'color-1': '#466c9c', 'color-2': '#a76b15', 'color-3': '#9a8f86' };

/** Half-years since 2007, stacked by what the price pays for. */
export function historySpec() {
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'bar',
    stack: 'normal',
    tokens: historyTokens,
    showValues: false,
    title: 'Haushaltsstrompreis je Halbjahr seit 2007, in ct/kWh',
    source: eurostat,
    categoryAxis: { title: 'Halbjahr' },
    valueAxis: { title: 'ct/kWh' },
    categories: halves.map((h) => halfLabel(h.period)),
    series: [
      { name: 'Energie, Vertrieb und Netz', values: halves.map((h) => h.beforeTax) },
      { name: 'Umlagen, Abgaben und Stromsteuer', values: halves.map((h) => h.levies) },
      { name: 'Mehrwertsteuer', values: halves.map((h) => h.vat) },
    ],
  };
}

/** Nominal price next to the price in money of the latest half-year. */
export function realSpec() {
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'line',
    tokens: { 'color-1': '#466c9c', 'color-2': '#34745a' },
    showValues: false,
    title: 'Haushaltsstrompreis nominal und inflationsbereinigt, in ct/kWh',
    source: `${eurostat} · Verbraucherpreisindex HVPI Deutschland`,
    categoryAxis: { title: 'Halbjahr' },
    valueAxis: { title: 'ct/kWh' },
    categories: halves.map((h) => halfLabel(h.period)),
    series: [
      { name: 'Nominal, wie auf der Rechnung', values: halves.map((h) => h.total) },
      {
        name: `In Kaufkraft von ${halfName(latest.period)}`,
        values: halves.map((h) => round1(real(h))),
      },
    ],
  };
}

/** Start years a sales pitch might pick, each with the average change until today. */
export function startYearRows() {
  const picks = [
    ['2007-S1', 'Beginn der Reihe'],
    ['2013-S1', 'EEG-Umlage steigt stark'],
    ['2015-S1', 'Basisjahr vieler Statistiken'],
    ['2021-S1', 'Vor der Energiekrise'],
    ['2023-S1', 'Höhepunkt der Energiekrise'],
  ] as const;
  return picks.map(([period, note]) => {
    const from = halves.find((h) => h.period === period) ?? halves[0];
    return {
      from: halfName(period),
      note,
      price: from.total,
      nominal: yearlyChange(from, latest),
      real: yearlyChange(from, latest, true),
    };
  });
}

export const outlookTokens = {
  'color-1': '#b4533c',
  'color-2': '#466c9c',
  'color-3': '#9a8f86',
  'color-4': '#c9a96a',
};

/** The scenario year by year, stacked by component, nominal. */
export function outlookSpec(years: OutlookYear[]) {
  const pick = (f: (y: OutlookYear) => number) => years.map((y) => round1(f(y)));
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'bar',
    stack: 'normal',
    tokens: outlookTokens,
    showValues: false,
    title: 'Strompreis im eigenen Szenario, nominal in ct/kWh',
    source: 'Eigene Szenariorechnung · Ausgangswerte BDEW 10/2026 · keine Prognose',
    categoryAxis: { title: 'Jahr' },
    valueAxis: { title: 'ct/kWh' },
    categories: years.map((y) => String(y.year)),
    series: [
      { name: 'Beschaffung und Vertrieb', values: pick((y) => y.procurement) },
      { name: 'Netzentgelt und Konzessionsabgabe', values: pick((y) => y.grid) },
      { name: 'Umlagen und Stromsteuer', values: pick((y) => y.levies) },
      { name: 'Mehrwertsteuer', values: pick((y) => y.vat) },
    ],
  };
}

/** Present value of the avoided electricity bill for each price path, in EUR. */
export function valueSpec(cases: { label: string; value: number }[]) {
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'bar',
    orientation: 'horizontal',
    tokens: { 'color-1': '#a76b15' },
    title: 'Was der selbst verbrauchte Solarstrom heute wert ist, in EUR',
    source: 'Eigene Rechnung · Barwert der vermiedenen Stromkosten · ohne Anlagenkosten',
    categoryAxis: { title: 'Preisentwicklung' },
    valueAxis: { title: 'EUR' },
    categories: cases.map((c) => c.label),
    series: [{ name: 'Barwert', values: cases.map((c) => Math.round(c.value)) }],
  };
}
