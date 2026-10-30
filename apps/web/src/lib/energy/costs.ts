/**
 * Published cost figures per energy carrier, each with its source. All values in ct/kWh.
 * Nothing here is an own estimate; where a study has no value, the carrier is marked so the
 * models can treat it neutrally and the pages can say so.
 */

export type Carrier =
  | 'lignite'
  | 'hardCoal'
  | 'gas'
  | 'oil'
  | 'nuclear'
  | 'wind'
  | 'solar'
  | 'biomass'
  | 'hydro'
  | 'otherRenewable'
  | 'other'
  | 'unreported';

export const carrierLabels: Record<Carrier, string> = {
  lignite: 'Braunkohle',
  hardCoal: 'Steinkohle',
  gas: 'Erdgas',
  oil: 'Heizöl',
  nuclear: 'Kernenergie',
  wind: 'Wind',
  solar: 'Photovoltaik',
  biomass: 'Biomasse',
  hydro: 'Wasserkraft',
  otherRenewable: 'Sonstige Erneuerbare',
  other: 'Andere Energieträger',
  unreported: 'Nicht einzeln ausgewiesen',
};

export type Range = readonly [low: number, high: number];

/**
 * Levelised cost of electricity of new plants built in 2024, real 2024 prices.
 * Fraunhofer ISE, Stromgestehungskosten Erneuerbare Energien, Juli 2024. Gas is the combined
 * cycle plant, oil the open-cycle gas turbine as the closest peaking plant, biomass spans biogas
 * and solid biomass, solar all plant types. Hydro and the residual carriers are not in the study.
 */
export const lcoe: Partial<Record<Carrier, Range>> = {
  lignite: [15.1, 25.7],
  hardCoal: [17.3, 29.3],
  gas: [10.9, 18.1],
  oil: [15.4, 32.6],
  nuclear: [13.6, 49.0],
  wind: [4.3, 9.2],
  solar: [4.1, 14.4],
  biomass: [11.5, 32.5],
};

/**
 * Environmental costs of air pollutants and greenhouse gases including upstream chains, in
 * €-Cent 2025 per kWh at a 1 % pure rate of time preference. UBA, Methodenkonvention 4.0,
 * Tabelle 5. The UBA gives no rate for nuclear power; the residual carriers take the 2024 mix.
 */
export const environmentalCost: Record<Carrier, number | null> = {
  lignite: 39.82,
  hardCoal: 33.9,
  gas: 15.9,
  oil: 37.85,
  nuclear: null,
  wind: 0.93,
  solar: 2.72,
  biomass: 15.54,
  hydro: 0.21,
  otherRenewable: 13.79,
  other: 13.79,
  unreported: 13.79,
};

/**
 * Nuclear waste disposal and decommissioning, spread over all nuclear electricity ever generated
 * in Germany. Low: what the operators paid into the KENFO fund (24.1 bn €, 2017) plus their
 * decommissioning provisions (17.7 bn €, end of 2024). High: the estimated total cost of nuclear
 * disposal until 2099 (about 170 bn €). Both from the federal cost report of 22 December 2025.
 * About 5,560 TWh were generated from 1961 to 2021 (Kerntechnik Deutschland); 2022 and 2023 add
 * the SMARD values.
 */
export const disposal = {
  low: 41.8e9,
  high: 170e9,
  generatedTwhUntil2021: 5560,
};

export function disposalCent(case_: 'low' | 'high', laterTwh: number) {
  const kwh = (disposal.generatedTwhUntil2021 + laterTwh) * 1e9;
  return (disposal[case_] / kwh) * 100;
}

export type CostCase = 'low' | 'mid' | 'high';

export function pick(range: Range, case_: CostCase) {
  return case_ === 'low' ? range[0] : case_ === 'high' ? range[1] : (range[0] + range[1]) / 2;
}
