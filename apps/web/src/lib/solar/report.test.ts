import assert from 'node:assert/strict';
import test from 'node:test';
import { getDefaultRenderer } from '@casoon/lightweight-pdf';
import { calculate, chargingCases, compareVariants } from './model';
import { presetSetup, presets, resolveCosts, sizeOptions } from './presets';
import reference from './reference.json';
import { reportDocument } from './report';

test('all presets render nine PDF pages without clipping, including 25-year and stale-profile cases', async () => {
  const renderer = await getDefaultRenderer();
  for (const preset of presets) {
    const { input: base, work } = presetSetup(preset.id);
    base.years = 25;
    const input = resolveCosts(base, work, 'orientation');
    const result = calculate(reference, input);
    const doc = reportDocument({
      input,
      base,
      work,
      result,
      profile: reference,
      priceLevel: 'orientation',
      preset: preset.title,
      selectedBattery: true,
      commission: '2026-10-28',
      autoTariff: true,
      tariffBasis: 'Kabinettsentwurf vom 29.07.2026, noch nicht beschlossen',
      stale: true,
      created: '29.10.2026, 12:00 (Europe/Berlin)',
    });
    const rendered = renderer.renderWithDiagnostics(
      JSON.stringify({ schema_version: 1, document: doc })
    );
    try {
      assert.deepEqual(rendered.warnings, [], preset.id);
      const pdf = new TextDecoder().decode(rendered.bytes);
      assert.equal((pdf.match(/\/Type \/Page\b/g) ?? []).length, 9, preset.id);
      assert.ok(pdf.startsWith('%PDF-'));
      assert.ok(JSON.stringify(doc).includes('noch nicht übernommen'));
      assert.ok(JSON.stringify(doc).includes(preset.title));
    } finally {
      rendered.free();
    }
  }
});

test('rule profiles, sizes, charging habits and credit render ten-page PDFs for all templates', async () => {
  const { createPolicy, policyDefaults } = await import('./policy');
  const renderer = await getDefaultRenderer();
  for (const preset of presets) {
    const { input: base, work } = presetSetup(preset.id);
    base.years = 25;
    base.loanPercent = 100;
    if (base.mode === 'roof') base.cars = Math.max(1, base.cars);
    const input = resolveCosts(base, work, 'orientation');
    const policy = createPolicy(input, '2027-01-15', policyDefaults);
    const result = calculate(reference, input, policy);
    const roof = input.mode === 'roof';
    const sizes = roof ? sizeOptions(base, work, true, 'orientation') : [];
    const sized = compareVariants(
      reference,
      sizes.map((o) => ({
        input: o,
        policy: createPolicy(o, policy.commission, policyDefaults),
        capacity: o.battery,
      }))
    );
    const cases = roof ? chargingCases(input) : [];
    const charged = compareVariants(
      reference,
      cases.flatMap((c) =>
        [0, c.input.battery].map((capacity) => ({ input: c.input, policy, capacity }))
      )
    );
    const doc = reportDocument({
      sizes: sizes.map((o, k) => ({ input: o, result: sized[k] })),
      charging: cases.map((c, k) => ({
        label: c.label,
        input: c.input,
        without: charged[2 * k],
        with: charged[2 * k + 1],
      })),
      input,
      base,
      work,
      result,
      profile: reference,
      priceLevel: 'orientation',
      preset: preset.title,
      selectedBattery: true,
      commission: policy.commission,
      autoTariff: true,
      tariffBasis: policy.name,
      stale: true,
      created: '29.10.2026',
    });
    const rendered = renderer.renderWithDiagnostics(
      JSON.stringify({ schema_version: 1, document: doc })
    );
    try {
      assert.deepEqual(rendered.warnings, [], preset.id);
      assert.equal(
        (new TextDecoder().decode(rendered.bytes).match(/\/Type \/Page\b/g) ?? []).length,
        10,
        preset.id
      );
      if (policy.market) assert.ok(JSON.stringify(doc).includes('2030-02-01'));
      assert.ok(JSON.stringify(doc).includes(policy.name));
    } finally {
      rendered.free();
    }
  }
});
