import type { StateResult } from './states';

/** One bar per state, cheapest first, with the average of all states as the last bar. */
export function statePriceSpec(sorted: StateResult[], national: number) {
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'bar',
    orientation: 'horizontal',
    tokens: { 'color-1': '#4f9a94' },
    title: 'Strompreis aus eigener Erzeugung je Bundesland, in ct/kWh',
    source:
      'Länderarbeitskreis Energiebilanzen · Fraunhofer ISE · eigene Rechnung, Gedankenexperiment',
    categoryAxis: { title: 'Bundesland' },
    valueAxis: { title: 'ct/kWh' },
    categories: [...sorted.map((s) => s.name), 'Mittel aller Länder'],
    series: [{ name: 'ct/kWh', values: [...sorted.map((s) => round(s.price)), round(national)] }],
  };
}
