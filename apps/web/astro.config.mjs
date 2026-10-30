import cloudflare from '@astrojs/cloudflare';
import svelte from '@astrojs/svelte';
import postAudit from '@casoon/astro-post-audit';
import siteFiles from '@casoon/astro-site-files';
import speedMeasure from '@casoon/astro-speed-measure';
import structuredData from '@casoon/astro-structured-data';
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
    // JSON-LD from the schema components in SolarLayout, merged into one @graph per page.
    // generateMeta adds og:site_name and Twitter tags; tags the layout sets itself win.
    structuredData({
      useGraph: true,
      generateMeta: true,
      siteName: 'Solarrechner',
      defaultArticlePublisher: { name: 'CASOON', id: 'https://www.casoon.de/#organization' },
    }),
    siteFiles({
      sitemap: { audit: { warnOnEmpty: true, errorOnDuplicates: true } },
      robots: { preset: 'seoOnly', disallow: ['/api/'] },
      llms: {
        title: 'Solarrechner',
        description:
          'Kostenloser, anbieterneutraler Wirtschaftlichkeitsrechner für Photovoltaik, Balkonkraftwerk und Speicher in Deutschland, Stunde für Stunde mit PVGIS-Ertragsdaten gerechnet.',
        details:
          'Ein unabhängiges Werkzeug ohne Anmeldung, Paywall oder Vermittlung: Es verkauft nichts, sammelt keine Kontaktdaten und erhält keine Provision von Anbietern. Es rechnet vereinfachte stündliche Szenarien aus PVGIS-Ertragsdaten, synthetischen Lastprofilen und Annahmen, die Nutzer sehen und ändern können; der Rechenweg ist offen beschrieben, der Quellcode steht unter MIT-Lizenz. Die Rechnung läuft im Browser, Eingaben verlassen ihn nicht. Eine zweite Seite vergleicht Kauf, Miete, Dachpacht und Contracting mit Festpreis oder dynamischem Tarif. Ergebnisse sind Überschläge, keine Ertrags- oder Amortisationszusage und kein Angebot.',
        sections: [
          {
            title: 'Rechner und Methodik',
            links: [
              { title: 'Solarrechner', url: '/' },
              { title: 'Anbieter-Modelle: kaufen, mieten, Dach verpachten', url: '/de/anbieter/' },
              { title: 'So rechnet der Solarrechner', url: '/de/rechenweg/' },
              {
                title: 'Stromversorgung in Deutschland: Strommix, Dunkelflaute, Netz, Länder',
                url: '/de/stromversorgung/',
              },
              {
                title:
                  'Energie richtig zählen: warum Strom fossile Energie nicht 1:1 ersetzen muss',
                url: '/de/energie-zaehlen/',
              },
              {
                title: 'Stromsystem 2045: Szenario-Spiel zu Bedarf, Speicher und Klimaziel',
                url: '/de/stromsystem-2045/',
              },
              { title: 'Datenquellen und Grenzen', url: '/de/about/' },
              { title: 'About this project (English)', url: '/about/' },
            ],
          },
          {
            title: 'Quellcode',
            links: [
              {
                title: 'GitHub: casoon/web-solarrechner',
                url: 'https://github.com/casoon/web-solarrechner',
              },
            ],
          },
        ],
      },
      security: {
        contact: 'mailto:security@casoon.de',
        expires: '2027-10-29T00:00:00.000Z',
        preferredLanguages: ['de', 'en'],
        canonical: new URL('/.well-known/security.txt', env.PUBLIC_SITE_URL).href,
      },
      humans: {
        team: [{ name: 'Jörn Seidel', role: 'Entwicklung', location: 'Rostock, Deutschland' }],
        technology: ['Astro', 'Svelte', 'TypeScript', 'Rust/WebAssembly', 'Cloudflare Workers'],
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
