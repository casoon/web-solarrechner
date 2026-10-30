/**
 * How much energy a household needs for the same benefit, fossil or electric, and how the
 * primary energy statistics count it. Pure functions; every default is shown and editable.
 */

/** Energy content of petrol, about 32 MJ per litre. */
export const petrolKwhPerLitre = 8.9;

export type EfficiencyInputs = {
  /** Electricity from a fossil plant that wind or solar replace, kWh. */
  power: number;
  /** Net electrical efficiency of that plant, percent. */
  plantEfficiency: number;
  /** Grid losses between plant and socket, percent. */
  gridLosses: number;
  /** Useful heat a house needs in a year, kWh. */
  heat: number;
  /** Annual efficiency of a gas condensing boiler, percent. */
  boilerEfficiency: number;
  /** Seasonal performance factor of a heat pump. */
  heatPumpFactor: number;
  /** Distance driven in a year, km. */
  km: number;
  /** Petrol car, litres per 100 km. */
  petrol: number;
  /** Electric car including charging losses, kWh per 100 km. */
  electric: number;
};

export const efficiencyDefaults: EfficiencyInputs = {
  power: 1000,
  plantEfficiency: 38,
  gridLosses: 5,
  heat: 15000,
  boilerEfficiency: 92,
  heatPumpFactor: 3.3,
  km: 12000,
  petrol: 7.4,
  electric: 19,
};

export type Use = {
  key: 'power' | 'heat' | 'car';
  label: string;
  benefit: string;
  /** Fuel the fossil path burns, kWh. */
  fossil: number;
  /** Electricity the electric path draws, kWh. */
  electric: number;
  /** Primary energy as the energy balance counts it, kWh. */
  fossilPrimary: number;
  electricPrimary: number;
};

/**
 * Wind and solar enter the German energy balance at their electricity output (efficiency
 * method, 100 %); a fossil plant at the fuel it burns.
 */
export function compare(input: EfficiencyInputs): Use[] {
  const grid = 1 - input.gridLosses / 100;
  const plant = input.plantEfficiency / 100;
  const fuel = input.power / plant;
  const heatGas = input.heat / (input.boilerEfficiency / 100);
  const heatPower = input.heat / input.heatPumpFactor;
  const petrol = (input.km / 100) * input.petrol * petrolKwhPerLitre;
  const ev = (input.km / 100) * input.electric;
  return [
    {
      key: 'power',
      label: 'Strom',
      benefit: `${input.power.toLocaleString('de-DE')} kWh Strom aus dem Kraftwerk`,
      fossil: fuel,
      electric: input.power,
      fossilPrimary: fuel,
      electricPrimary: input.power,
    },
    {
      key: 'heat',
      label: 'Raumwärme',
      benefit: `${input.heat.toLocaleString('de-DE')} kWh Wärme im Jahr`,
      fossil: heatGas,
      electric: heatPower,
      fossilPrimary: heatGas,
      electricPrimary: heatPower / grid,
    },
    {
      key: 'car',
      label: 'Auto',
      benefit: `${input.km.toLocaleString('de-DE')} km im Jahr`,
      fossil: petrol,
      electric: ev,
      fossilPrimary: petrol,
      electricPrimary: ev / grid,
    },
  ];
}

/** A house with heating and one car: fossil fuel versus electricity, the headline example. */
export function household(input: EfficiencyInputs) {
  const [, heat, car] = compare(input);
  const fossil = heat.fossil + car.fossil;
  const electric = heat.electric + car.electric;
  return { fossil, electric, factor: fossil / electric };
}

export function validateEfficiency(input: EfficiencyInputs) {
  const values = Object.values(input);
  if (values.some((v) => !Number.isFinite(v))) return 'Bitte alle Felder mit Zahlen füllen.';
  if (values.some((v) => v < 0)) return 'Negative Eingabewerte sind nicht möglich.';
  if (input.plantEfficiency <= 0 || input.plantEfficiency > 100)
    return 'Der Kraftwerkswirkungsgrad muss zwischen 1 und 100 % liegen.';
  if (input.boilerEfficiency <= 0 || input.boilerEfficiency > 110)
    return 'Der Kesselnutzungsgrad muss zwischen 1 und 110 % liegen.';
  if (input.heatPumpFactor <= 0) return 'Die Jahresarbeitszahl muss größer als null sein.';
  if (input.gridLosses >= 100) return 'Die Netzverluste müssen unter 100 % liegen.';
  return '';
}

export function efficiencySpec(uses: Use[]) {
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'bar',
    orientation: 'horizontal',
    tokens: { 'color-1': '#b4533c', 'color-2': '#4f9a94' },
    title: 'Energie für denselben Nutzen, fossil und elektrisch, in kWh',
    source: 'Eigene Rechnung mit den Annahmen links · Werte veränderbar',
    categoryAxis: { title: 'Anwendung' },
    valueAxis: { title: 'kWh' },
    categories: uses.map((u) => u.label),
    series: [
      { name: 'Fossil: Brennstoff', values: uses.map((u) => Math.round(u.fossil)) },
      { name: 'Elektrisch: Strom', values: uses.map((u) => Math.round(u.electric)) },
    ],
  };
}
