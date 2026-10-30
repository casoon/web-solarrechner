import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compare, efficiencyDefaults, household } from './efficiency';
import { co2Limit, conditions, facts, fromParams, presets, targetYears, toParams } from './game';
import { stateDefaults, statePrices } from './states';
import { type Profiles, profileCapacity, type SystemInputs, simulate } from './system';

const close = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

test('a fossil plant burns fuel divided by its efficiency', () => {
  const [power, heat] = compare({
    ...efficiencyDefaults,
    power: 1000,
    plantEfficiency: 50,
    heat: 9000,
    heatPumpFactor: 3,
  });
  assert.equal(power.fossil, 2000);
  assert.equal(heat.electric, 3000);
  assert.ok(household(efficiencyDefaults).factor > 1);
});

test('every state pays at least its own cost when it covers its demand', () => {
  const r = statePrices({ ...stateDefaults, losses: 0 }, 0);
  assert.equal(r.states.length, 16);
  for (const s of r.states) if (s.selfSupply >= 100) close(s.price, s.ownCost);
  const prices = r.states.map((s) => s.price);
  assert.ok(r.national >= Math.min(...prices) && r.national <= Math.max(...prices));
});

test('disposal carried by everyone adds the same amount to every state', () => {
  const none = statePrices({ ...stateDefaults, year: 2021 }, 50);
  const all = statePrices({ ...stateDefaults, year: 2021, disposal: 'all' }, 50);
  const diffs = none.states.map((s, i) => all.states[i].price - s.price);
  assert.ok(diffs[0] > 0);
  for (const d of diffs) close(d, diffs[0]);
});

const hours = 48;
const flat = (mw: number) => Array.from({ length: hours }, () => mw);
const profiles = (solarMw: number): Profiles => ({
  year: 2024,
  hours,
  load: flat(1),
  solar: flat(solarMw),
  windOnshore: flat(0),
  windOffshore: flat(0),
  hydro: flat(0),
  biomass: flat(0),
});
// 0.48 TWh over 48 hours is 10 GW in every hour.
const empty: SystemInputs = {
  ...presets[2045],
  baseDemand: 0.48,
  heatPumps: 0,
  cars: 0,
  extraDemand: 0,
  electrolysis: 0,
  solar: profileCapacity.solar,
  windOnshore: 0,
  windOffshore: 0,
  biomass: 0,
  battery: 0,
  gasPlants: 0,
  hydrogenStore: 0,
  hydrogenImport: 0,
  coal: 0,
  imports: 0,
};

test('weather equal to demand needs no backup', () => {
  const r = simulate(profiles(10_000), empty, facts.factors);
  close(r.demand, 480);
  assert.equal(r.unservedHours, 0);
  assert.equal(r.co2, 0);
});

test('without weather, gas covers demand and emits by its factor', () => {
  const r = simulate(profiles(0), { ...empty, gasPlants: 12 }, facts.factors);
  close(r.gasPower, 480);
  close(r.co2, (480 * facts.factors.gas) / 1e3);
});

test('a gap larger than every backup is unserved in each hour', () => {
  const r = simulate(profiles(0), { ...empty, gasPlants: 4, coal: 2 }, facts.factors);
  assert.equal(r.unservedHours, hours);
  close(r.unserved, 4 * hours);
  close(r.maxShortGw, 4);
});

test('every hour balances and storage returns less than it took', () => {
  const p = profiles(0);
  p.solar = Array.from({ length: hours }, (_, h) => (h < 24 ? 20_000 : 0));
  const r = simulate(p, { ...empty, battery: 50, batteryHours: 10, gasPlants: 10 }, facts.factors);
  const h = r.hourly;
  for (let i = 0; i < hours; i++) {
    const covered =
      h.renewable[i] + h.storage[i] + h.imported[i] + h.hydrogen[i] + h.fossil[i] + h.unserved[i];
    close(covered, h.demand[i]);
  }
  // Starts half full (250 GWh) and charges 10 GWh surplus for 24 hours at most.
  assert.ok(r.battery <= (250 + 240 * Math.sqrt(0.9)) * Math.sqrt(0.9) + 1e-6);
});

test('the climate limit falls on a straight line to 2045', () => {
  const at2030 = facts.sectorLimit2030 * (facts.power2025 / facts.sector2025);
  close(co2Limit(2030), at2030);
  close(co2Limit(2037), (at2030 * 8) / 15);
});

test('a shared link restores the scenario', () => {
  const changed = { ...presets[2037], solar: 333, coal: 4 };
  assert.deepEqual(fromParams(toParams(changed)), changed);
  assert.equal(fromParams('j=2031'), null);
});

test('every preset passes both hard conditions with the 2024 weather', () => {
  const real = JSON.parse(
    readFileSync(new URL('../../../public/data/energy/stunden-2024.json', import.meta.url), 'utf8')
  ) as Profiles;
  for (const year of targetYears) {
    const result = simulate(real, presets[year], facts.factors);
    const failed = conditions(presets[year], result).filter((c) => c.hard && !c.ok);
    assert.deepEqual(failed, [], `Vorgabe ${year}`);
  }
});
