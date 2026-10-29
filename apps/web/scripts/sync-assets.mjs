import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderChart, stylesheet } from '@casoon/chartlet';
import { architectureSpec } from './architecture.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(resolve(app, 'public/vendor/opengrid'), { recursive: true });
cpSync(resolve(app, 'node_modules/@casoon/opengrid/pkg'), resolve(app, 'public/vendor/opengrid'), {
  recursive: true,
});

writeFileSync(
  resolve(app, 'public/vendor/chartlet.css'),
  stylesheet({ types: ['line', 'bar', 'sankey', 'waterfall', 'heatmap'] })
);

mkdirSync(resolve(app, 'public/vendor/lightweight-pdf'), { recursive: true });
cpSync(
  resolve(app, 'node_modules/@casoon/lightweight-pdf/pkg'),
  resolve(app, 'public/vendor/lightweight-pdf'),
  { recursive: true }
);

for (const locale of ['de', 'en']) {
  const rendered = renderChart(architectureSpec(locale), {
    format: 'svg',
    variant: 'print',
    idPrefix: `solar-architecture-${locale}`,
  });
  for (const warning of rendered.warnings) console.warn(`[architecture] ${warning}`);
  writeFileSync(resolve(app, `public/vendor/architecture-${locale}.svg`), rendered.content);
}
