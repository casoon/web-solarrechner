import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaults } from './model';
import { policyDefaults } from './policy';
import { presetSetup } from './presets';
import {
  decodeShare,
  encodeShare,
  readSettings,
  type Settings,
  settingsFile,
  settingsVersion,
} from './settings';

const setup = presetSetup('family-house');
const base: Settings = {
  preset: 'family-house',
  priceLevel: 'orientation',
  automaticCosts: true,
  input: setup.input,
  work: setup.work,
  place: { name: 'Berlin · 10115', lat: 52.5323, lon: 13.3846 },
  angle: 35,
  aspect: 0,
  second: { on: false, kwp: 4, angle: 35, aspect: 90 },
  commission: '2027-02-01',
  policy: { ...policyDefaults },
  selectedBattery: true,
};
const changed: Settings = {
  ...base,
  preset: 'commuter',
  input: { ...base.input, household: 5200, peaks: 'cautious', batteryCycles: 8000 },
  work: { ...base.work, overrides: { scaffold: 900 } },
  place: { name: 'München · 80331', lat: 48.137, lon: 11.575 },
  second: { on: true, kwp: 3, angle: 30, aspect: -90 },
  policy: { ...base.policy, profile: 'current' },
};

test('saved settings read back unchanged', () => {
  assert.deepEqual(readSettings(settingsFile(changed), base), changed);
});
test('missing fields take the current values, unknown and mistyped fields are ignored', () => {
  const file = structuredClone(settingsFile(changed)) as unknown as {
    settings: Record<string, unknown>;
  };
  const { batteryCycles: _, ...withoutCycles } = changed.input;
  file.settings.input = { ...withoutCycles, household: '5200', future: 1, peaks: 'wild' };
  file.settings.extra = { anything: true };
  const read = readSettings(file, base) as Settings;
  assert.equal(read.input.batteryCycles, base.input.batteryCycles);
  assert.equal(read.input.household, base.input.household);
  assert.equal(read.input.peaks, base.input.peaks);
  assert.equal('future' in read.input, false);
  assert.equal('extra' in read, false);
});
test('newer versions, foreign files and invalid values are refused with a message', () => {
  const newer = { ...settingsFile(changed), version: settingsVersion + 1 };
  assert.match(String(readSettings(newer, base)), /neueren Version/);
  assert.match(String(readSettings({ hello: 1 }, base)), /keine Einstellungen/);
  const invalid = settingsFile({ ...changed, input: { ...changed.input, kwp: 80 } });
  assert.match(String(readSettings(invalid, base)), /passen nicht/);
});
test('files from before the settings format are still read', () => {
  const legacy = {
    model: 'solar-demo-3',
    preset: 'commuter',
    priceLevel: 'high',
    automaticCosts: false,
    baseInputs: { ...defaults, household: 4100 },
    additionalWork: setup.work,
    commission: '2027-03-01',
    policySettings: policyDefaults,
    profile: { location: 'Köln · 50667', lat: 50.94, lon: 6.96, angle: 30, aspect: 45 },
    secondSurface: { kwp: 2, angle: 20, aspect: -45, profile: null },
  };
  const read = readSettings(legacy, base) as Settings;
  assert.equal(read.input.household, 4100);
  assert.equal(read.priceLevel, 'high');
  assert.deepEqual(read.place, { name: 'Köln · 50667', lat: 50.94, lon: 6.96 });
  assert.deepEqual(read.second, { on: true, kwp: 2, angle: 20, aspect: -45 });
  assert.equal(read.angle, 30);
});
test('the share link carries the same settings, compressed', async () => {
  const fragment = await encodeShare(changed);
  assert.ok(fragment.length < 2000, `${fragment.length} characters`);
  assert.match(fragment, /^einstellungen=[\w-]+$/);
  assert.deepEqual(readSettings(await decodeShare(`#${fragment}`), base), changed);
  assert.equal(await decodeShare('#etwas=anderes'), null);
});
