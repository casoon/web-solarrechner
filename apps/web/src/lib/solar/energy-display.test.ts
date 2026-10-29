import assert from 'node:assert/strict';
import test from 'node:test';
import { renderChart } from '@casoon/chartlet';
import { energyFlow } from './energy-display';
import { calculate, defaults, type Energy, simulate } from './model';
import { presetSetup, presets, resolveCosts } from './presets';
import profile from './reference.json';

function assertFlow(energy: Energy) {
  const spec = energyFlow(energy);
  const nodes = new Map(spec.sankey.nodes.map((node) => [node.label, node]));
  for (const link of spec.sankey.links) {
    const from = nodes.get(link.from);
    const to = nodes.get(link.to);
    assert.ok(from && to);
    assert.equal(to.column - from.column, 1);
    assert.ok(Number.isInteger(link.value) && link.value > 0);
  }
  for (const node of spec.sankey.nodes) {
    if (!spec.sankey.links.some((link) => link.from === node.label)) assert.equal(node.column, 2);
    if (!spec.sankey.links.some((link) => link.to === node.label)) assert.equal(node.column, 0);
  }
  assert.deepEqual(renderChart(spec, { format: 'svg' }).warnings, []);
  const sink = spec.sankey.links
    .filter((link) => link.to === 'Bedarf inkl. Standby')
    .reduce((sum, link) => sum + link.value, 0);
  assert.ok(Math.abs(sink - energy.load - energy.standby) <= 1.5);
  const losses = spec.sankey.links.find((link) => link.to === 'Speicherverluste')?.value ?? 0;
  assert.equal(losses, Math.round(energy.losses));
}

test('every flow spans adjacent columns; all destinations stay on the right', () => {
  for (const preset of presets) {
    const setup = presetSetup(preset.id);
    const result = calculate(profile, resolveCosts(setup.input, setup.work, 'orientation'));
    assertFlow(result.with.energy);
    assertFlow(result.without.energy);
  }
});

test('zero generation with battery standby still shows grid demand, without phantom storage flows', () => {
  const energy = simulate(profile, { ...defaults, shade: 100 }, 5);
  const spec = energyFlow(energy);
  assert.equal(spec.sankey.links.length, 2);
  assert.equal(spec.sankey.links[1].value, Math.round(energy.load + energy.standby));
  assert.ok(!spec.sankey.nodes.some((node) => node.label.includes('geladen')));
});

test('annual storage changes are represented as flows instead of losses', () => {
  const energy = simulate(profile, defaults, 5);
  for (const delta of [-2, 2]) {
    const spec = energyFlow({ ...energy, startSoc: 3, endSoc: 3 + delta });
    const label = delta > 0 ? 'Mehrbestand am Jahresende' : 'Anfangsbestand entnommen';
    const link = spec.sankey.links.find((link) => link.to === label || link.from === label);
    assert.equal(link?.value, 2);
    assert.equal(
      spec.sankey.links.find((link) => link.to === 'Speicherverluste')?.value,
      Math.round(energy.losses)
    );
  }
});
