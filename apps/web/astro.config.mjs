import cloudflare from '@astrojs/cloudflare';
import svelte from '@astrojs/svelte';
import postAudit from '@casoon/astro-post-audit';
import siteFiles from '@casoon/astro-site-files';
import speedMeasure from '@casoon/astro-speed-measure';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { baseAstroConfig, configEnv, postAuditOptions } from './config/astro.ts';
import { validateEnv } from './src/env.ts';

const env = validateEnv(configEnv(new URL('.env', import.meta.url)));
export default defineConfig({
  ...baseAstroConfig,
  site: env.PUBLIC_SITE_URL,
  redirects: { '/de/': '/' },
  adapter: cloudflare(),
  server: { host: true, port: 5156 },
  security: {
    ...baseAstroConfig.security,
    csp: {
      ...baseAstroConfig.security.csp,
      scriptDirective: { resources: ["'self'", "'wasm-unsafe-eval'"] },
    },
  },
  integrations: [
    svelte(),
    siteFiles({
      sitemap: { audit: { warnOnEmpty: true, errorOnDuplicates: true } },
      robots: { preset: 'seoOnly', disallow: ['/api/'] },
      llms: {
        title: 'Solarrechner · CASOON',
        description:
          'Demonstration eines überschlägigen Solar-Wirtschaftlichkeitsrechners mit Chartlet, Open Grid, Astro und Svelte.',
        details:
          'Vereinfachte stündliche Szenarien mit PVGIS-Ertragsdaten und eigenen synthetischen Lastprofilen. Keine Ertrags- oder Amortisationszusage.',
        sections: [
          {
            title: 'Rechner und Methodik',
            links: [
              { title: 'Solarrechner', url: '/' },
              { title: 'Datenquellen und Grenzen', url: '/de/about/' },
            ],
          },
        ],
      },
    }),
    speedMeasure(),
    postAudit(postAuditOptions(['404.html'])),
  ],
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      optimizeDeps: {
        noDiscovery: true,
        include: ['@astrojs/svelte/server.js', 'astro/logger/console', '@casoon/opengrid'],
      },
    },
  },
});
