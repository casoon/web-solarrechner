import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateEnv } from './env.ts';

describe('validateEnv', () => {
  it('falls back to the production URL', () => {
    assert.equal(validateEnv({}).PUBLIC_SITE_URL, 'https://solarrechner.casoon.de');
  });

  it('prefers a provided URL', () => {
    const env = validateEnv({ PUBLIC_SITE_URL: 'http://localhost:5156' });
    assert.equal(env.PUBLIC_SITE_URL, 'http://localhost:5156');
  });

  it('rejects an invalid URL', (t) => {
    t.mock.method(console, 'error', () => {});
    assert.throws(() => validateEnv({ PUBLIC_SITE_URL: 'not a url' }), /Invalid environment/);
  });
});
