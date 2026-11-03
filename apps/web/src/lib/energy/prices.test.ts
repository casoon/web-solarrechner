import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agnesYear,
  flatPath,
  history,
  levies2027,
  outlook,
  outlookChange,
  outlookDefaults,
  presentValue,
  real,
  today,
  yearlyChange,
} from './prices';

const close = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);
const still = { ...outlookDefaults, inflation: 0 };

test('the first year adds up to the BDEW price of 2026', () => {
  const [first] = outlook(outlookDefaults);
  close(first.total, (15.41 + 9.24 + 1.666 + 2.946 + 2.05) * 1.19);
  close(first.vat, (first.total / 1.19) * 0.19);
  close(first.real, first.total);
});

test('without inflation only the decided levies of 2027 move the price', () => {
  const years = outlook(still);
  const later = years[0].total + (levies2027 - today.levies) * 1.19;
  for (const y of years.slice(1)) close(y.total, later);
  for (const y of years) close(y.real, y.total);
});

test('fixed amounts by law lose value with inflation, everything else keeps it', () => {
  const years = outlook(outlookDefaults);
  const last = years[years.length - 1];
  const fixed = (today.concession + today.electricityTax) * 1.19;
  const kept = outlook(still)[1].total - fixed;
  close(last.real, kept + fixed / 1.02 ** 20);
  assert.ok(outlookChange(years).real < 0);
  assert.ok(outlookChange(years).nominal < 2);
});

test('a shock lasts two years at full and half height', () => {
  const base = outlook(still);
  const shocked = outlook({ ...still, shock: true, shockYear: 2030, shockHeight: 10 });
  const at = (y: number) => shocked[y - 2026].total - base[y - 2026].total;
  close(at(2029), 0);
  close(at(2030), 11.9);
  close(at(2031), 5.95);
  close(at(2032), 0);
});

test('the grid fee change and the levies arrive in their years', () => {
  const base = outlook(still);
  const changed = outlook({
    ...still,
    gridChange: 2,
    capacityLevy: 1,
    subsidyEnds: true,
    taxCut: true,
  });
  const diff = (y: number) => changed[y - 2026].total - base[y - 2026].total;
  close(diff(2026), 0);
  close(diff(2027), (0.1 - 2.05 + 2 / 20) * 1.19);
  close(diff(2028), (0.1 - 2.05 + 0.2 + 1.7) * 1.19);
  close(diff(2046), (0.1 - 2.05 + 2 + 1.7 + 1) * 1.19);
});

test('a fixed grid charge lowers only what a solar kWh saves, from 2029', () => {
  const years = outlook({ ...still, fixedShare: 100 });
  for (const y of years) {
    const expected = y.year >= agnesYear ? y.total - today.gridFee * 1.19 : y.total;
    close(y.avoidable, expected);
  }
});

test('present value is plain sum without discount and an annuity with it', () => {
  const flat = flatPath(0, 30);
  close(presentValue(flat, { kwh: 1000, years: 20, discount: 0 }), 6000);
  const annuity = (1 - 1.03 ** -20) / 0.03;
  close(presentValue(flat, { kwh: 1000, years: 20, discount: 3 }), 300 * annuity);
  close(presentValue(flatPath(3, 30), { kwh: 1000, years: 20, discount: 3 }), 6000);
});

test('history: real prices end at the nominal price and changes agree with the endpoints', () => {
  const halves = history.halfYears;
  const first = halves[0];
  const last = halves[halves.length - 1];
  close(real(last), last.total);
  for (const h of halves) close(h.beforeTax + h.levies + h.vat, h.total, 0.02);
  const years = (halves.length - 1) / 2;
  close(first.total * (1 + yearlyChange(first, last) / 100) ** years, last.total);
  close(real(first) * (1 + yearlyChange(first, last, true) / 100) ** years, last.total);
});
