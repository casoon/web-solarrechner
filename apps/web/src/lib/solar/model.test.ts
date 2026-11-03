import assert from 'node:assert/strict';
import { test } from 'node:test';
import flat from '../../../public/data/pvgis/berlin-15.json';
import {
  annuity,
  calculate,
  combineSurfaces,
  compareStorage,
  compareVariants,
  defaults,
  demands,
  irr,
  leasedCar,
  priceScenario,
  replacementDue,
  replacementYear,
  simulate,
  tariffFor,
  validate,
} from './model';
import { estimateCosts, presetSetup, resolveCosts, sizeOptions } from './presets';
import profile from './reference.json';
import { billBreakdown } from './result-display';

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
test('fewer home days lower PV car charging; a car buffer wins part of it back at equal energy', () => {
  const total = (input: typeof defaults) => demands(profile, input).load.reduce((a, b) => a + b);
  const day = { ...defaults, cars: 1, chargeTime: 'day' as const };
  const weekend = { ...day, carDaysHome: 2 };
  const buffered = { ...weekend, carBuffer: 30 };
  const evening = simulate(profile, { ...day, chargeTime: 'evening' }, 0).direct;
  const [all, two, withBuffer] = [day, weekend, buffered].map((i) => simulate(profile, i, 0));
  assert.ok(
    all.direct > withBuffer.direct && withBuffer.direct > two.direct && two.direct > evening
  );
  near(total(weekend), total(day));
  near(total(buffered), total(day));
  assert.ok(withBuffer.unmetCar < 1);
});
test('size options contain the chosen system unchanged; smaller systems cost less and produce less', () => {
  const { input, work } = presetSetup('family-house');
  const chosen = resolveCosts(input, work, 'orientation');
  const options = sizeOptions(input, work, true, 'orientation');
  const same = options.find((o) => o.kwp === input.kwp);
  assert.deepEqual(same, chosen);
  const results = compareVariants(
    profile,
    options.map((o) => ({ input: o, capacity: o.battery }))
  );
  near(results[options.indexOf(same as typeof chosen)].npv, calculate(profile, chosen).with.npv);
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i].investment > results[i - 1].investment);
    assert.ok(results[i].energy.pv > results[i - 1].energy.pv);
  }
});
test('base price completes the bill without changing the saving; wallbox only with surplus charging', () => {
  const evening = { ...defaults, cars: 1 };
  const day = { ...evening, chargeTime: 'day' as const };
  const r = calculate(profile, evening);
  const bill = billBreakdown(r.with, evening, true);
  const cheaper = billBreakdown(r.with, { ...evening, basePrice: 0 }, true);
  assert.equal(bill.without - cheaper.without, defaults.basePrice);
  assert.equal(bill.without - bill.with, cheaper.without - cheaper.with);
  assert.ok(Math.abs(bill.without - bill.with - r.with.benefit) < 5);
  near(calculate(profile, day).with.investment - r.with.investment, defaults.wallboxCost);
  near(
    calculate(profile, { ...day, cars: 0 }).with.investment,
    calculate(profile, { ...evening, cars: 0 }).with.investment
  );
});
test('a leased second car instead of storage: storage money, monthly share and what is left', () => {
  const own = calculate(profile, { ...defaults, cars: 1 }).with;
  const always = { ...defaults, cars: 1, chargeTime: 'day' as const, carBuffer: 30 };
  const car = calculate(profile, always).without;
  const lease = leasedCar(own, car, { ...defaults, discount: 0, years: 20 });
  near(lease.storageSaved, defaults.batteryCost - defaults.wallboxCost);
  near(lease.months, lease.storageSaved / defaults.leaseRate);
  near(lease.monthly, lease.npv / 240);
  near(lease.remaining, defaults.leaseRate + defaults.leaseExtra - lease.monthly);
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
test('storage is replaced every life and the last replacement keeps its residual value', () => {
  assert.deepEqual(
    Array.from({ length: 25 }, (_, i) => i + 1).filter((y) => replacementDue(y, 11)),
    [11, 21]
  );
  const input = { ...defaults, years: 20, batteryYear: 13, batteryCycles: 20000 };
  const r = calculate(profile, input).with;
  assert.equal(r.batteryYear, 13);
  near(r.cashflows[13].replacement, input.batteryReplacement);
  // Replaced at the start of year 13, used 8 of its 12 years by the end of year 20.
  near(r.cashflows[20].residual, (input.batteryReplacement * 4) / 12);
  near(calculate(profile, { ...input, years: 12 }).with.cashflows[12].residual, 0);
});
test('without replacement the system runs on without storage after its life', () => {
  const input = {
    ...defaults,
    years: 20,
    batteryYear: 11,
    batteryCycles: 20000,
    batteryReplace: false,
  };
  const r = calculate(profile, input);
  const year = (n: number) => r.with.cashflows[n];
  assert.equal(year(11).replacement, input.inverterYear === 11 ? input.inverterReplacement : 0);
  near(year(20).residual, 0);
  // From year 11 on both cases earn the same: same system, no storage, no storage running costs.
  near(year(15).cash, r.without.cashflows[15].cash);
});
test('storage quality changes the estimated price', () => {
  const base = { mode: 'roof' as const, kwp: 10, battery: 10 };
  const cost = (grade: 'basic' | 'standard' | 'premium') =>
    estimateCosts({ ...base, batteryGrade: grade }, 'orientation').batteryCost;
  assert.ok(cost('basic') < cost('standard') && cost('standard') < cost('premium'));
});
test('a fully financed system needs no own funds; the loan costs interest and fees', () => {
  const free = calculate(profile, { ...defaults, battery: 0, loanPercent: 100, interest: 0 });
  near(free.without.ownFunds, 0);
  near(free.without.loanCost, 0);
  const paid = calculate(profile, {
    ...defaults,
    battery: 0,
    loanPercent: 100,
    interest: 4,
    loanYears: 10,
    fees: 300,
  }).without;
  near(paid.ownFunds, 300);
  // Annuity over 120 months, minus the principal, plus fees.
  near(paid.loanCost, paid.rate * 120 - paid.principal + 300);
  near(calculate(profile, { ...defaults, battery: 0 }).without.ownFunds, paid.investment);
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
      { h: 10, month: 5, weekend: false, carHome: true },
      { h: 11, month: 5, weekend: false, carHome: true },
      { h: 12, month: 5, weekend: false, carHome: true },
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
