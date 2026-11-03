import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SolarProfile } from './model';
import {
  compareQuality,
  euroEfficiency,
  inverterEfficiency,
  modulePower,
  qualityDefaults,
  validateQuality,
  variantKwp,
  variantProfile,
} from './quality';
import reference from './reference.json';

const profile = reference as SolarProfile;
const short = { ...qualityDefaults, years: 3 };
const near = (a: number, b: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('identical variants are worth nothing extra', () => {
  const r = compareQuality(profile, { ...short, b: short.a });
  near(r.gain, 0);
  near(r.pvA, r.pvB);
  assert.ok(r.parts.every((p) => p.same && p.value === 0));
});
test('the middle grade leaves the reference profile unchanged apart from the initial loss', () => {
  const mid = variantProfile(profile, { module: 'mid', inverter: 'mid', storage: 'mid' });
  const i = profile.hours.findIndex((h) => Number(h[1]) > 0.3);
  near(Number(mid.hours[i][1]), Number(profile.hours[i][1]) * 0.99);
});
test('module power follows initial loss and linear ageing by hand', () => {
  near(modulePower('basic', 1), 0.98);
  near(modulePower('mid', 11), 0.99 * 0.996 ** 10);
});
test('inverter curves rise with load and keep the grade order', () => {
  for (const g of ['high', 'mid', 'basic'] as const)
    assert.ok(inverterEfficiency(g, 0.05) < inverterEfficiency(g, 0.5));
  assert.ok(euroEfficiency('high') > euroEfficiency('mid'));
  assert.ok(euroEfficiency('mid') > euroEfficiency('basic'));
  assert.ok(euroEfficiency('high') < 0.99 && euroEfficiency('basic') > 0.94);
});
test('better components yield more and are worth more', () => {
  const r = compareQuality(profile, short);
  assert.ok(r.pvA > r.pvB);
  assert.ok(r.gain > 0);
  assert.ok(r.parts.every((p) => p.value > 0));
  // Storage does not change the solar yield, only how much of it the house uses.
  near(r.parts.find((p) => p.key === 'storage')?.pv ?? 1, 0);
});
test('without storage the storage grade makes no difference', () => {
  const r = compareQuality(profile, { ...short, battery: 0 });
  near(r.parts.find((p) => p.key === 'storage')?.value ?? 1, 0, 1e-6);
});
test('a limited roof scales variant power with module efficiency', () => {
  const input = { ...short, roofLimited: true };
  near(variantKwp(input, input.b), (10 * 21) / 23.5);
  assert.equal(variantKwp(short, short.b), 10);
});
test('the extra price is recovered in the year the cumulative gain reaches it', () => {
  const r = compareQuality(profile, { ...short, years: 20, premium: 0 });
  assert.equal(r.breakEven, 1);
  const never = compareQuality(profile, { ...short, premium: 1e6 });
  assert.equal(never.breakEven, undefined);
});
test('validation rejects impossible inputs and allows falling prices', () => {
  assert.equal(validateQuality(qualityDefaults), '');
  assert.equal(validateQuality({ ...qualityDefaults, priceChange: -2 }), '');
  assert.notEqual(validateQuality({ ...qualityDefaults, kwp: 0 }), '');
  assert.notEqual(validateQuality({ ...qualityDefaults, premium: -1 }), '');
  assert.notEqual(validateQuality({ ...qualityDefaults, years: 2.5 }), '');
});
