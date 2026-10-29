import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, defaults, priceScenario, simulate } from './model';
import {
  createPolicy,
  exportTerms,
  policyDefaults,
  policyExportLimit,
  policyYear,
  transitionEligible,
  transitionRate,
  validatePolicy,
} from './policy';
import profile from './reference.json';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const input = { ...defaults, negativeShare: 0 };
const budget = { ...policyDefaults, technologyCost: 0, meterAnnual: 0, controlAnnual: 0 };

test('published dates end in 2026; commissioning in 2026 keeps its calendar support period', () => {
  const p = createPolicy(input, '2026-10-29', budget);
  assert.equal(p.effective, 'current');
  assert.equal(p.published, true);
  near(p.rate, 0.077);
  assert.equal(p.supportEnd, '2047-01-01');
  near(exportTerms(p, input, '2027-01-01').rate, 0.077);
  assert.equal(exportTerms(p, input, '2047-01-01').rate, 0);
  const future = createPolicy(input, '2027-01-15', { ...budget, profile: 'current' });
  assert.equal(future.published, false);
  assert.ok(future.name.includes('Annahme'));
});
test('draft transition and bonus end at the calendar-month boundaries from the actual text', () => {
  const p = createPolicy(input, '2027-01-15', budget);
  near(p.rate, 0.052);
  assert.equal(p.transitionEnd, '2030-02-01');
  assert.equal(p.marketStart, '2030-02-01');
  assert.equal(p.bonusEnd, '2034-03-01');
  assert.equal(exportTerms(p, input, '2030-01-31').phase, 'Übergangszahlung');
  near(exportTerms(p, input, '2030-02-01').bonus, 0.015);
  near(exportTerms(p, input, '2034-02-01').bonus, 0.015);
  assert.equal(exportTerms(p, input, '2034-03-01').bonus, 0);
  assert.equal(
    createPolicy(input, '2027-01-15', { ...budget, directMode: 'immediate' }).marketStart,
    '2027-01-15'
  );
});
test('thresholds and degression distinguish cohorts and the 25 kW market-premium case', () => {
  assert.equal(transitionEligible(30, '2027-01-01'), true);
  assert.equal(transitionEligible(25, '2028-01-01'), false);
  assert.equal(transitionEligible(24.99, '2028-01-01'), true);
  assert.equal(transitionEligible(7, '2029-01-01'), false);
  assert.equal(transitionEligible(6.99, '2030-01-01'), true);
  near(transitionRate('2027-07-31').transition, 0.052);
  near(transitionRate('2027-08-01').transition, 0.0514);
  near(transitionRate('2028-02-01').transition, 0.0508);
  const p = createPolicy({ ...input, kwp: 25 }, '2028-01-01', budget);
  assert.equal(p.marketStart, '2028-01-01');
  assert.equal(p.bonusRate, 0);
  near(exportTerms(p, { ...input, kwp: 25 }, '2028-01-01').rate, 0.0614);
});
test('monthly revenues and fees split a mixed operating year without repeating the bonus', () => {
  const p = createPolicy(input, '2027-01-01', budget);
  const e = simulate(profile, input, 0);
  const uniform = { ...e, export: 1200, monthly: e.monthly.map((m) => ({ ...m, export: 100 })) };
  const first = policyYear(p, input, uniform, 1);
  near(first.exportRevenue, 62.4);
  near(first.bonusRevenue, 0);
  near(first.marketingCost, 0);
  const fourth = policyYear(p, input, uniform, 4);
  near(fourth.exportRevenue, 100 * 0.052 + 1100 * 0.04);
  near(fourth.bonusRevenue, 1100 * 0.015);
  near(fourth.marketingCost, 1100 * 0.005 + (120 * 11) / 12);
  const ninth = policyYear(p, input, uniform, 9);
  near(ninth.bonusRevenue, 0);
  near(ninth.exportRevenue, 48);
});
test('calendar energy allocation conserves annual export for late-month and leap-day commissioning', () => {
  const e = simulate(profile, input, 0);
  for (const commission of ['2027-01-31', '2027-07-17', '2028-02-29']) {
    const p = createPolicy(input, commission, { ...budget, profile: 'manual' });
    const own = { ...input, tariff: 0.1 };
    const manual = createPolicy(own, commission, { ...budget, profile: 'manual' });
    for (const year of [1, 2, 3])
      near(policyYear(manual, own, e, year).exportRevenue, e.export * 0.1);
    assert.ok(p.commission === commission);
  }
});
test('negative-price share starts after metering year for fixed rates and immediately on direct marketing', () => {
  const own = { ...input, negativeShare: 20 };
  const p = createPolicy(own, '2027-07-01', { ...budget, technologyYear: 3 });
  assert.equal(p.negativeFrom, '2030-01-01');
  near(exportTerms(p, own, '2029-12-01').rate, 0.052);
  near(exportTerms(p, own, '2030-01-01').rate, 0.052 * 0.8);
  const direct = createPolicy(own, '2027-07-01', {
    ...budget,
    directMode: 'immediate',
    technologyYear: 1,
  });
  near(exportTerms(direct, own, '2027-07-01').bonus, 0.015 * 0.8);
  const small = { ...own, kwp: 1.9 };
  near(exportTerms(createPolicy(small, '2027-01-01', budget), small, '2029-01-01').rate, 0.052);
});
test('technical limits, mandatory budgets and loan principal count each cost exactly once', () => {
  const own = { ...input, kwp: 8, loanPercent: 100, interest: 0, battery: 0 };
  const p = createPolicy(own, '2027-01-01', policyDefaults);
  assert.equal(policyExportLimit(p, own, 1), 50);
  assert.equal(policyExportLimit(p, own, 10), 50);
  const current = createPolicy(own, '2026-10-29', {
    ...policyDefaults,
    profile: 'current',
    technologyYear: 3,
  });
  assert.equal(policyExportLimit(current, own, 1), 60);
  assert.equal(policyExportLimit(current, own, 3), 100);
  const a = calculate(profile, own, p).without;
  near(a.principal, own.equipment + own.installation + own.electrics + own.extras + 250);
  near(a.firstYear.technologyCost, 100);
  near(a.firstYear.technologyInvestment, 0);
  const later = calculate(profile, own, { ...p, technologyYear: 3, setupCost: 0 }).without;
  near(later.investment, a.investment - 250);
  near(later.cashflows[3].technologyInvestment, 250);
  near(later.cashflows[2].technologyCost, 0);
  near(later.cashflows[3].technologyCost, 100);
});
test('zero-export-revenue and balcony cases have no market bonus or fees', () => {
  const e = simulate(profile, input, 0);
  const zero = policyYear(
    createPolicy(input, '2027-01-01', { ...budget, profile: 'zero' }),
    input,
    e,
    8
  );
  near(zero.exportRevenue + zero.bonusRevenue + zero.marketingCost, 0);
  const b = { ...input, mode: 'balcony' as const, kwp: 1.8 };
  const p = createPolicy(b, '2027-01-01', policyDefaults);
  assert.equal(p.setupCost, 0);
  assert.equal(p.technologyNeeded, false);
  const result = policyYear(p, b, e, 8);
  near(
    result.exportRevenue + result.bonusRevenue + result.marketingCost + result.technologyCost,
    0
  );
});
test('all electricity-price comparisons preserve the same policy cashflows', () => {
  const own = { ...input, priceChange: 2 };
  const p = createPolicy(own, '2027-01-01', policyDefaults);
  const a = calculate(profile, own, p).with;
  const b = calculate(profile, { ...own, priceChange: 4 }, p).with;
  const scenario = priceScenario(a.cashflows, own, 4);
  near(scenario[20], b.balance);
});
test('incomplete policy budgets and impossible dates are rejected', () => {
  assert.ok(validatePolicy({ ...policyDefaults, marketPrice: NaN }, '2027-01-01'));
  assert.ok(validatePolicy({ ...policyDefaults, technologyYear: 0 }, '2027-01-01'));
  assert.ok(validatePolicy(policyDefaults, '2027-02-31'));
  assert.ok(validatePolicy(policyDefaults, '2031-01-01'));
  assert.equal(validatePolicy(policyDefaults, '2027-01-01'), null);
});

test('direct marketing waits for operational technology; expired transition becomes unpaid', () => {
  const p = createPolicy(input, '2027-01-01', { ...budget, technologyYear: 5 });
  assert.equal(p.marketStart, '2031-01-01');
  const gap = exportTerms(p, input, '2030-02-01');
  assert.equal(gap.rate + gap.bonus, 0);
  assert.equal(gap.phase, 'Unentgeltlich bis Direktmarkt');
});

test('market premium uses a separate reference value, not a guaranteed sales-price floor', () => {
  const own = { ...input, kwp: 25 };
  const p = createPolicy(own, '2028-01-01', {
    ...budget,
    marketPrice: 0.03,
    solarMarketValue: 0.04,
  });
  near(exportTerms(p, own, '2028-01-01').rate, 0.03 + 0.0614 - 0.04);
});
