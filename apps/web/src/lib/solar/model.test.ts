import assert from 'node:assert/strict';
import { test } from 'node:test';
import flat from '../../../public/data/pvgis/berlin-15.json';
import {
  annuity,
  calculate,
  combineSurfaces,
  compareStorage,
  defaults,
  demands,
  irr,
  priceScenario,
  replacementYear,
  simulate,
  tariffFor,
  validate,
} from './model';
import profile from './reference.json';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
test('hourly PV, demand and battery balances conserve energy', () => {
  const e = simulate(profile, defaults, 5);
  near(e.pv, e.direct + e.charge + e.export + e.curtailed);
  near(e.load + e.standby, e.direct + e.battery + e.grid);
  const eta = Math.sqrt(defaults.efficiency / 100);
  near(e.endSoc - e.startSoc, e.charge * eta - e.battery / eta);
  near(
    e.monthly.reduce((s, m) => s + m.pv, 0),
    e.pv
  );
  near(e.load, defaults.household);
  assert.ok(e.endSoc >= 0 && e.endSoc <= defaults.battery);
});
test('zero battery has no storage output, loss or standby', () => {
  const e = simulate(profile, defaults, 0);
  assert.equal(e.battery + e.charge + e.standby, 0);
  near(e.load, e.direct + e.grid);
});
test('same annual EV demand but day and evening charging give different self-consumption', () => {
  const day = { ...defaults, cars: 1, chargeTime: 'day' as const };
  const evening = { ...day, chargeTime: 'evening' as const };
  near(
    demands(profile, day).load.reduce((a, b) => a + b),
    demands(profile, evening).load.reduce((a, b) => a + b)
  );
  assert.ok(simulate(profile, day, 0).direct > simulate(profile, evening, 0).direct);
});
test('unmet home charging is reported rather than silently exceeding power', () => {
  const e = simulate(profile, { ...defaults, cars: 2, chargePower: 0.1 }, 0);
  assert.ok(e.unmetCar > 1000);
});
test('tariff is weighted, follows the 2027 rule and is not extended without end', () => {
  near(tariffFor(15, '2026-10-28')?.rate as number, (10 * 0.077 + 5 * 0.0666) / 15);
  near(tariffFor(8, '2027-03-01')?.rate as number, 0.052);
  near(tariffFor(8, '2027-01-15', 'current')?.rate as number, 0.077);
  near(tariffFor(8, '2027-03-01', 'current')?.rate as number, 0.0762);
  assert.equal(tariffFor(8, '2026-07-31'), null);
  assert.equal(tariffFor(8, '2031-01-01', 'current'), null);
});
test('load peaks lower direct self-consumption; smooth hourly load is the upper bound', () => {
  const smooth = simulate(profile, { ...defaults, peaks: 'smooth' }, 0);
  const typical = simulate(profile, { ...defaults, peaks: 'typical' }, 0);
  const cautious = simulate(profile, { ...defaults, peaks: 'cautious' }, 0);
  assert.ok(smooth.direct > typical.direct && typical.direct > cautious.direct);
  near(typical.load, smooth.load);
});
test('price scenarios keep energy and reproduce the calculated balance for the chosen change', () => {
  const input = { ...defaults, priceChange: 2, battery: 0 };
  const r = calculate(profile, input);
  const same = priceScenario(r.without.cashflows, input, 2);
  for (const [i, row] of r.without.cashflows.entries()) near(same[i], row.balance);
  const higher = priceScenario(r.without.cashflows, input, 4);
  assert.ok(higher[20] > same[20]);
  near(calculate(profile, { ...input, priceChange: 4 }).without.balance, higher[20]);
});
test('PV-surplus charging needs the same energy as evening charging', () => {
  const day = { ...defaults, cars: 1, chargeTime: 'day' as const };
  const e = simulate(profile, day, 0);
  assert.ok(e.unmetCar < 1);
});
test('zero-interest loans have the hand-calculated monthly payment', () =>
  near(annuity(12000, 0, 10), 100));
test('loan payment affects equity without duplicating the project investment', () => {
  const r = calculate(profile, {
    ...defaults,
    years: 2,
    battery: 0,
    loanPercent: 100,
    interest: 0,
    loanYears: 10,
  });
  near(r.without.cashflows[0].equity, 0);
  near(r.without.cashflows[0].cash, -r.without.investment);
  near(r.without.debt, r.without.investment * 0.8);
  near(
    r.without.cashflows[2].equity,
    r.without.cashflows.slice(1).reduce((s, c) => s + c.cash, 0) - r.without.investment * 0.2
  );
});
test('empty, out-of-range and impossible base-load inputs are rejected', () => {
  assert.ok(validate({ ...defaults, kwp: Number.NaN }));
  assert.ok(validate({ ...defaults, baseWatts: 1000 }));
  assert.ok(validate({ ...defaults, years: 200 }));
});

test('BKW combined PV and battery delivery cannot exceed 800 VA in a deficit hour', () => {
  const input = {
    ...defaults,
    mode: 'balcony' as const,
    kwp: 1,
    standby: 0,
    peaks: 'smooth' as const,
  };
  const tiny = {
    ...profile,
    hours: [
      ['20230601:1010', 0.8, 20],
      ['20230601:1110', 0.4, 20],
      ['20230601:1210', 0, 20],
    ],
  };
  const load = {
    load: [0, 1, 0],
    shaped: [0, 1, 0],
    unmetCar: 0,
    times: [
      { h: 10, month: 5, weekend: false },
      { h: 11, month: 5, weekend: false },
      { h: 12, month: 5, weekend: false },
    ],
  };
  const e = simulate(tiny, input, 2, 1, load);
  near(e.direct + e.battery, 0.8);
  near(e.grid, 0.2);
  near(e.load, e.direct + e.battery + e.grid);
});

test('all twelve starting templates are valid and produce meaningfully different scenarios', async () => {
  const { presets, presetSetup, resolveCosts } = await import('./presets');
  assert.equal(presets.length, 12);
  assert.equal(new Set(presets.map((p) => p.id)).size, 12);
  const observations = presets.map((preset) => {
    const setup = presetSetup(preset.id);
    const input = resolveCosts(setup.input, setup.work, 'orientation');
    assert.equal(validate(input), null, preset.title);
    input.tariff = tariffFor(input.kwp, '2026-10-28')?.rate ?? 0;
    const result = calculate(profile, input);
    assert.ok(Number.isFinite(result.with.benefit) && result.with.investment > 0, preset.title);
    assert.ok(
      result.with.energy.grid >= 0 && result.with.energy.load >= input.household - 1e-6,
      preset.title
    );
    return [
      Math.round(result.with.energy.load),
      Math.round(result.with.benefit),
      Math.round(result.with.investment),
    ].join('/');
  });
  assert.equal(new Set(observations).size, 12);
});
test('own mounting removes only labour; base electrics and materials remain', async () => {
  const { presetSetup, resolveCosts, workPrice } = await import('./presets');
  const { input, work } = presetSetup('family-house');
  const professional = resolveCosts(input, work, 'orientation');
  const own = resolveCosts(input, { ...work, roofMount: false }, 'orientation');
  near(professional.installation - own.installation, workPrice('roofMount', input, 'orientation'));
  near(own.electrics, professional.electrics);
  assert.ok(own.installation > 0 && own.equipment > 0);
  near(resolveCosts(input, work, 'orientation').installation, professional.installation);
});
test('new cabinet bundles protection, while separate circuit remains an extra', async () => {
  const { presetSetup, resolveCosts, cabinetPrice, workPrice } = await import('./presets');
  const { input, work } = presetSetup('family-house');
  const cabinet = { ...work, roofMount: false, cabinet: 'new' as const, surge: true, sls: true };
  const bundled = resolveCosts(input, cabinet, 'orientation');
  near(bundled.electrics, input.electrics + cabinetPrice('new', 'orientation'));
  const extra = resolveCosts(input, { ...cabinet, circuit: true }, 'orientation');
  near(extra.electrics - bundled.electrics, workPrice('circuit', input, 'orientation'));
  const custom = resolveCosts(input, { ...cabinet, overrides: { cabinet: 3500 } }, 'orientation');
  near(custom.electrics, input.electrics + 3500);
});
test('price levels change costs, not energy, and presets do not share mutable work state', async () => {
  const { presetSetup, resolveCosts } = await import('./presets');
  const cheap = presetSetup('family-heat-car', 'low');
  const costly = presetSetup('family-heat-car', 'high');
  const a = resolveCosts(cheap.input, cheap.work, 'low');
  const b = resolveCosts(costly.input, costly.work, 'high');
  assert.ok(
    a.equipment + a.installation + a.electrics < b.equipment + b.installation + b.electrics
  );
  near(simulate(profile, a, a.battery).pv, simulate(profile, b, b.battery).pv);
  near(simulate(profile, a, a.battery).load, simulate(profile, b, b.battery).load);
  cheap.work.overrides.cabinet = 9999;
  assert.deepEqual(presetSetup('family-heat-car').work.overrides, {});
});
test('weather years scale yield; prosumer fee lowers every year of a roof system only', () => {
  const base = calculate(profile, { ...defaults });
  const weak = calculate(profile, { ...defaults, weather: -6 });
  near(weak.with.energy.pv, base.with.energy.pv * 0.94);
  const fee = calculate(profile, { ...defaults, prosumerFee: 100 });
  near(base.with.benefit - fee.with.benefit, 100);
  near(base.with.balance - fee.with.balance, 100 * defaults.years);
  const balcony = { ...defaults, mode: 'balcony' as const, kwp: 0.8, ac: 0.8, battery: 0 };
  near(
    calculate(profile, { ...balcony, prosumerFee: 100 }).without.benefit,
    calculate(profile, balcony).without.benefit
  );
  assert.equal(validate({ ...defaults, weather: -6 }), null);
  assert.notEqual(validate({ ...defaults, weather: 20 }), null);
});
test('a second surface adds its yield per kWp; one surface leaves the profile unchanged', () => {
  const both = combineSurfaces([
    { kwp: 6, profile },
    { kwp: 2, profile: flat },
  ]);
  const input = { ...defaults, kwp: 8, ac: 30, exportLimit: 100 };
  near(
    simulate(both, input, 0).pv,
    simulate(profile, { ...input, kwp: 6 }, 0).pv + simulate(flat, { ...input, kwp: 2 }, 0).pv
  );
  near(
    simulate(combineSurfaces([{ kwp: 7, profile }]), defaults, 5).pv,
    simulate(profile, defaults, 5).pv
  );
});
test('storage comparison matches the regular calculation for the chosen size', () => {
  const regular = calculate(profile, defaults);
  const [small, chosen] = compareStorage(profile, defaults, undefined, [
    { battery: 3, batteryCost: 1700, batteryReplacement: 1300 },
    {
      battery: defaults.battery,
      batteryCost: defaults.batteryCost,
      batteryReplacement: defaults.batteryReplacement,
    },
  ]);
  near(chosen.extraNpv, regular.extraNpv);
  near(chosen.extraBenefit, regular.extraBenefit);
  assert.ok(small.result.energy.battery < chosen.result.energy.battery);
});
test('inverter clipping is the part of curtailment above the AC power', () => {
  const unlimited = simulate(profile, { ...defaults, ac: 30, exportLimit: 100 }, 0);
  const clipped = simulate(profile, { ...defaults, ac: 3, exportLimit: 100 }, 0);
  near(unlimited.clipped, 0);
  assert.ok(clipped.clipped > 0);
  near(clipped.clipped, clipped.curtailed);
  const limited = simulate(profile, { ...defaults, ac: 3, exportLimit: 30 }, 0);
  assert.ok(limited.curtailed > limited.clipped);
});
test('internal rate of return sets the net present value to zero', () => {
  const rate = irr([-1000, 600, 600]) ?? Number.NaN;
  near(-1000 + 600 / (1 + rate / 100) + 600 / (1 + rate / 100) ** 2, 0);
  assert.equal(irr([-1000, 100, 100]) !== null && (irr([-1000, 100, 100]) ?? 0) < 0, true);
  assert.equal(irr([-1000, -100]), null);
  const result = calculate(profile, defaults).with;
  const atIrr = result.cashflows.reduce(
    (sum, row) => sum + row.cash / (1 + (result.irr ?? 0) / 100) ** row.year,
    0
  );
  assert.ok(Math.abs(atIrr) < 0.01);
});
test('reaching the cycle life brings the storage replacement forward', () => {
  const e = simulate(profile, defaults, defaults.battery);
  const perYear = e.battery / defaults.battery;
  assert.equal(replacementYear(defaults, defaults.battery, e), defaults.batteryYear);
  const few = { ...defaults, batteryCycles: Math.round(perYear * 5.5) };
  assert.equal(replacementYear(few, defaults.battery, e), 6);
  const result = calculate(profile, few).with;
  assert.equal(result.batteryYear, 6);
  near(
    result.cashflows[6].cash,
    calculate(profile, { ...few, batteryYear: 6, batteryCycles: 20000 }).with.cashflows[6].cash
  );
});
