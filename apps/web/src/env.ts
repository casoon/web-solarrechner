import { z } from 'astro/zod';

/** Build-time environment for astro.config.mjs. Every value has a default. */
const envSchema = z.object({
  PUBLIC_SITE_URL: z.url().default('https://solarrechner.casoon.de'),
});

export function validateEnv(env: Record<string, unknown>): z.infer<typeof envSchema> {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.issues);
    throw new Error('Invalid environment variables');
  }
  return parsed.data;
}
