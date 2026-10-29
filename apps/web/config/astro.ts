/**
 * Plain option objects for astro.config.mjs. Integrations and the adapter are set up there.
 */

import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

/**
 * Environment for astro.config.mjs. Astro evaluates the config with Vite's default `VITE_`
 * env prefix, so `PUBLIC_*` values from `.env` never reach `import.meta.env` there and
 * `site`, canonical URLs and the sitemap would silently fall back to the defaults.
 * Reads the app's `.env` explicitly; variables set in the shell take precedence.
 */
export function configEnv(envFile: URL): Record<string, string | undefined> {
  const fileEnv = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf-8')) : {};
  return { ...fileEnv, ...process.env };
}

export const baseAstroConfig = {
  trailingSlash: 'always',
  devToolbar: { enabled: false },

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'de'],
    routing: {
      prefixDefaultLocale: false,
    },
  },

  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },

  security: {
    checkOrigin: true,
    // Content-Security-Policy, emitted as a <meta> tag on every page. It must live under
    // `security` — a top-level `csp` option is silently ignored by Astro (the config schema
    // is not strict), which is how earlier template versions shipped without any CSP.
    // Scripts and <style> elements are allowed by SHA-256 hash (Astro computes them) or from
    // the own origin; inline style *attributes* are allowed (style-src-attr). Everything else
    // is same-origin only. Projects that load external resources (fonts, analytics, embeds)
    // extend `directives` / `scriptDirective.resources` / `styleDirective.resources` in their
    // own astro.config.mjs. Head scripts must not be inline: Astro inserts the CSP <meta>
    // after them, so they would run unprotected — use a file in public/ instead.
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: { resources: ["'self'"] },
      styleDirective: { resources: ["'self'", { resource: "'unsafe-inline'", kind: 'attribute' }] },
    },
  },

  // No app uses Astro.session. Without this, @astrojs/cloudflare enables sessions and binds
  // a KV namespace (SESSION) on every deploy. Remove the line to opt in.
  session: false,

  // Cloudflare Workers does not support Sharp — use noop image service.
  image: {
    service: { entrypoint: 'astro/assets/services/noop' },
  },

  // Astro v7: compressHTML default changed to 'jsx' (strips whitespace with JSX rules).
  // Set explicitly to avoid surprise whitespace changes around inline elements.
  compressHTML: 'jsx',

  build: {
    inlineStylesheets: 'auto',
  },
} as const;

/**
 * Options for `@casoon/astro-post-audit`.
 * @param exclude built HTML files to skip (relative to dist)
 * @param knownRoutes on-demand routes (`prerender = false`) that have no file in dist
 */
export function postAuditOptions(exclude: string[], knownRoutes: string[] = []) {
  return {
    preset: 'standard',
    failOn: 'errors',
    progress: 'verbose',
    hints: { sourceFiles: true },
    contentStyle: true,
    rules: {
      filters: { exclude },
      canonical: { self_reference: true },
      opengraph: { require_og_image: true },
      a11y: { require_skip_link: true },
      structured_data: { check_json_ld: true },
      html_validation: { enabled: true },
      css_architecture: { enabled: true },
      severity: { 'html/assertion.roles.unnecessary-list': 'off' },
      content_quality: {
        detect_duplicate_titles: true,
        detect_duplicate_descriptions: true,
      },
      links: { check_fragments: true, known_routes: knownRoutes },
    },
  } as const;
}
