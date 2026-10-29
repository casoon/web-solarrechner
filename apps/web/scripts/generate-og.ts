/**
 * Generate the Open Graph image from a real calculation: the family template in Berlin,
 * with the same model, costs and rules the calculator starts with.
 * Run with: npx tsx scripts/generate-og.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { energyColors } from '../src/lib/solar/energy-display';
import { calculate, months } from '../src/lib/solar/model';
import { createPolicy, policyDefaults } from '../src/lib/solar/policy';
import { presetSetup, resolveCosts } from '../src/lib/solar/presets';
import reference from '../src/lib/solar/reference.json';
import { type OgNode, renderOgImage } from './og';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const font = (weight: number) =>
  readFileSync(require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`));

const ink = '#183b32';
const muted = '#52675f';
const paper = '#f7f7f0';
const line = '#d5dcd3';

const h = (
  type: string,
  style: Record<string, unknown>,
  ...children: (OgNode | string)[]
): OgNode => ({
  type,
  props: { style: { display: 'flex', boxSizing: 'border-box', ...style }, children },
});

/** Same default commission date as the calculator: first of the month in about three months. */
function commission() {
  const date = new Date();
  date.setMonth(date.getMonth() + 3, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

const setup = presetSetup('family-house');
const input = resolveCosts(setup.input, setup.work, 'orientation');
const result = calculate(reference, input, createPolicy(input, commission(), policyDefaults)).with;
const e = result.energy;
const format = (value: number) => Math.round(value).toLocaleString('de-DE');

const stats = [
  [`${format(((e.load - e.grid) / e.load) * 100)} %`, 'Eigenversorgung'],
  [`${format(e.pv)} kWh`, 'Solarertrag im Jahr'],
  [`${format(result.benefit)} €`, 'Vorteil im 1. Jahr'],
];

const top = Math.max(...e.monthly.map((m) => m.load));
const chartHeight = 250;
const segments = [
  ['direct', energyColors.solar, 'Solar direkt'],
  ['battery', energyColors.storage, 'Speicher'],
  ['grid', energyColors.grid, 'Netz'],
] as const;

const sun = {
  type: 'svg',
  props: {
    width: 40,
    height: 40,
    viewBox: '0 0 32 32',
    children: [
      { type: 'circle', props: { cx: 16, cy: 16, r: 6, fill: '#e6b734' } },
      {
        type: 'path',
        props: {
          d: 'M16 1v5m0 20v5M1 16h5m20 0h5M5.4 5.4 9 9m14 14 3.6 3.6M5.4 26.6 9 23m14-14 3.6-3.6',
          stroke: ink,
          strokeWidth: 2,
        },
      },
    ],
  },
};

const chart = h(
  'div',
  {
    flexDirection: 'column',
    width: 540,
    padding: '24px 28px',
    background: '#fff',
    border: `1px solid ${line}`,
    borderRadius: 12,
  },
  h('div', { fontSize: 20, fontWeight: 700 }, 'Woher der Strom kommt'),
  h(
    'div',
    { fontSize: 16, color: muted, marginTop: 4 },
    `Familie in Berlin · 8 kWp · 5 kWh Speicher · ${format(e.load)} kWh`
  ),
  h(
    'div',
    { alignItems: 'flex-end', gap: 12, height: chartHeight, marginTop: 22 },
    ...e.monthly.map((m) =>
      h(
        'div',
        { flexDirection: 'column-reverse', width: 28.67 },
        ...segments.map(([key, color]) =>
          h('div', { height: (m[key] / top) * chartHeight, background: color })
        )
      )
    )
  ),
  h(
    'div',
    { gap: 12, marginTop: 8, fontSize: 14, color: muted },
    ...months.map((m) => h('div', { width: 28.67, justifyContent: 'center' }, m.slice(0, 1)))
  ),
  h(
    'div',
    { gap: 20, marginTop: 16, fontSize: 15, color: muted },
    ...segments.map(([, color, label]) =>
      h(
        'div',
        { alignItems: 'center', gap: 8 },
        h('div', { width: 12, height: 12, borderRadius: 3, background: color }),
        label
      )
    )
  )
);

const tree = h(
  'div',
  {
    width: '100%',
    height: '100%',
    padding: '56px 64px',
    justifyContent: 'space-between',
    background: paper,
    color: ink,
    fontFamily: 'Inter',
    borderTop: '10px solid #e6b734',
  },
  h(
    'div',
    { flexDirection: 'column', justifyContent: 'space-between', width: 480 },
    h(
      'div',
      { alignItems: 'center', gap: 14, fontSize: 26, fontWeight: 700 },
      sun,
      'Solarrechner',
      h('span', { fontSize: 18, fontWeight: 400, color: muted }, 'von CASOON')
    ),
    h(
      'div',
      { flexDirection: 'column', gap: 18 },
      h(
        'div',
        { fontSize: 56, fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.03em' },
        'Lohnt sich Solar bei dir?'
      ),
      h(
        'div',
        { fontSize: 22, lineHeight: 1.4, color: muted },
        'Stundenwerte aus PVGIS, Speicher, E-Auto, Wärmepumpe und Amortisation – nachvollziehbar gerechnet.'
      )
    ),
    h(
      'div',
      { gap: 32 },
      ...stats.map(([value, label]) =>
        h(
          'div',
          { flexDirection: 'column', gap: 2 },
          h('div', { fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em' }, value),
          h('div', { fontSize: 15, color: muted }, label)
        )
      )
    )
  ),
  h(
    'div',
    { flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', gap: 14 },
    chart,
    h('div', { fontSize: 16, color: muted }, 'solarrechner.casoon.de')
  )
);

const png = await renderOgImage(tree, [
  { weight: 400, data: font(400) },
  { weight: 700, data: font(700) },
]);
const outDir = join(__dirname, '..', 'public', 'og');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'home.png'), png);
console.log('  ✓ home.png');
