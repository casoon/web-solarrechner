import assert from 'node:assert/strict';
import test from 'node:test';
import { runJob, type Scenario } from './calc-jobs';
import { calculate, compareStorage } from './model';
import { createPolicy, policyDefaults } from './policy';
import { presetSetup, resolveCosts, storageOptions } from './presets';
import reference from './reference.json';

const setup = presetSetup('family-house');
const input = resolveCosts({ ...setup.input, cars: 1 }, setup.work, 'orientation');
const scenario: Scenario = {
  profile: reference,
  input,
  commission: '2027-02-01',
  settings: policyDefaults,
};
const policy = createPolicy(input, scenario.commission, policyDefaults);

test('worker jobs return the same numbers as the direct calculation', () => {
  assert.deepEqual(
    runJob({ kind: 'result', ...scenario }, () => {}),
    calculate(reference, input, policy)
  );
  assert.deepEqual(
    runJob({ kind: 'storage', ...scenario, automatic: true, level: 'orientation' }, () => {}),
    compareStorage(reference, input, policy, storageOptions(input, true, 'orientation'))
  );
});

test('the variants job reports every yearly run and skips balcony systems', () => {
  const steps: [number, number][] = [];
  const job = {
    kind: 'variants' as const,
    ...scenario,
    system: setup.input,
    work: setup.work,
    automatic: true,
    level: 'orientation' as const,
    capacity: input.battery,
  };
  const { sizes, charging, tariffs } = runJob(job, (done, total) => steps.push([done, total]));
  const total = sizes.length + 2 * charging.length + tariffs.length;
  assert.equal(charging.length, 3);
  // Three revenue rules, the chosen one marked, each a full run of the same system.
  assert.equal(tariffs.length, 3);
  assert.equal(tariffs.filter((t) => t.selected).length, 1);
  assert.equal(tariffs.find((t) => t.selected)?.name, policy.name);
  assert.ok(tariffs.some((t) => t.result.firstYear.exportRevenue === 0));
  assert.ok(new Set(tariffs.map((t) => Math.round(t.result.benefit))).size > 1);
  assert.deepEqual(steps.at(0), [0, total]);
  assert.deepEqual(steps.at(-1), [total, total]);
  assert.deepEqual(
    runJob({ ...job, input: { ...input, mode: 'balcony' } }, () => {}),
    {
      sizes: [],
      charging: [],
      tariffs: [],
    }
  );
});
