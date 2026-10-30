import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compareOffers,
  consumers,
  flexibleShare,
  gridCost,
  investments,
  offerDefaults,
  rentInterest,
} from './offers';
import profile from './reference.json';

const near = (a: number, b: number, tolerance = 1e-6) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const short = { ...offerDefaults, years: 3 };
const offer = (r: ReturnType<typeof compareOffers>, key: string) => {
  const found = r.offers.find((o) => o.key === key);
  assert.ok(found);
  return found;
};

test('dynamic tariff without price difference, spread and meter equals the fixed tariff', () => {
  const input = { ...short, dynamicDelta: 0, spread: 0, meterCost: 0 };
  near(gridCost(input, 1000, 1, true), gridCost(input, 1000, 1, false));
  near(gridCost(input, 1000, 1, false), 1000 * input.price);
});
test('shifted consumption saves the spread on its share of the grid draw', () => {
  const input = { ...short, cars: 1, dynamicDelta: 0, meterCost: 0, spread: 0.1 };
  const c = consumers(input);
  const share =
    (c.household * input.householdFlex + c.car * input.carFlex) / 100 / (c.household + c.car);
  near(flexibleShare(input), share);
  near(gridCost(input, 2000, 1, true), 2000 * input.price - 2000 * share * 0.1);
});
test('solar power bought at the grid price costs the same as grid electricity alone', () => {
  const r = compareOffers(profile, { ...short, contractPrice: short.price });
  near(offer(r, 'contract').total, offer(r, 'grid').total, 1e-3);
});
test('roof lease lowers the grid bill by the lease and nothing else', () => {
  const r = compareOffers(profile, short);
  near(offer(r, 'lease').versusGrid, -short.lease * short.kwp * short.years, 1e-6);
});
test('purchases pay the investment up front, rent and lease nothing', () => {
  const r = compareOffers(profile, short);
  const { local, provider } = investments(short);
  near(local, short.kwp * short.localPrice + short.battery * short.storagePrice);
  near(offer(r, 'buyLocal').upfront, local);
  near(offer(r, 'buyProvider').upfront, provider);
  for (const key of ['grid', 'dynamic', 'rent', 'lease', 'contract'])
    assert.equal(offer(r, key).upfront, 0);
});
test('rent and provider purchase differ only by rent, running costs and replacements', () => {
  const input = { ...short, rentYears: 3, takeover: 0, replacementYear: 2 };
  const r = compareOffers(profile, input);
  const rent = offer(r, 'rent').total;
  const buy = offer(r, 'buyProvider').total;
  near(
    rent - buy,
    input.rent * 12 * 3 - investments(input).provider - input.running * 3 - input.replacement,
    1e-6
  );
});
test('rent read as a loan: repaying exactly the price means zero interest', () => {
  const input = { ...short, rentYears: 10, running: 0, replacement: 0, takeover: 0 };
  const rent = investments(input).provider / 120;
  near(rentInterest({ ...input, rent }) ?? Number.NaN, 0, 1e-4);
  assert.ok((rentInterest({ ...input, rent: rent * 1.2 }) ?? 0) > 3);
});
test('cumulative costs end at the total', () => {
  const r = compareOffers(profile, short);
  for (const o of r.offers) {
    assert.equal(o.years.length, short.years + 1);
    near(o.years.at(-1)?.cumulative ?? Number.NaN, o.total);
  }
});
