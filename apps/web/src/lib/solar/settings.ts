import { type Inputs, peakProfiles, validate } from './model';
import { type PolicySettings, validatePolicy } from './policy';
import type { PriceLevel, WorkOptions } from './presets';

/**
 * Everything a user can set, as saved in a JSON file and in the share link. Results are not part
 * of it: loading recalculates them with the current model.
 *
 * Compatibility: `version` only rises when a field changes its meaning. New fields need no new
 * version, because missing fields take the current defaults and unknown fields are ignored.
 */
export const settingsVersion = 1;
export interface Settings {
  preset: string;
  priceLevel: PriceLevel;
  automaticCosts: boolean;
  input: Inputs;
  work: WorkOptions;
  place: { name: string; lat: number; lon: number };
  angle: number;
  aspect: number;
  second: { on: boolean; kwp: number; angle: number; aspect: number };
  commission: string;
  policy: PolicySettings;
  selectedBattery: boolean;
}
export interface SettingsFile {
  format: 'solarrechner';
  version: number;
  settings: Settings;
}
/** Text fields with a fixed set of values; other text fields accept any string. */
const choices: Record<string, readonly string[]> = {
  priceLevel: ['low', 'orientation', 'high'],
  mode: ['roof', 'balcony'],
  pattern: ['evening', 'day', 'flat'],
  peaks: Object.keys(peakProfiles),
  chargeTime: ['day', 'evening'],
  cabinet: ['ready', 'upgrade', 'new'],
  profile: ['draft', 'current', 'zero', 'manual'],
  directMode: ['after', 'immediate'],
};
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Takes each known field from `raw` when it has the fallback's type, otherwise the fallback. */
function merge<T>(fallback: T, raw: unknown, key = ''): T {
  if (isObject(fallback)) {
    if (!isObject(raw)) return fallback;
    const out: Record<string, unknown> = {};
    for (const [k, value] of Object.entries(fallback)) out[k] = merge(value, raw[k], k);
    return out as T;
  }
  if (typeof fallback === 'number')
    return (typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback) as T;
  if (typeof fallback === 'string')
    return (
      typeof raw === 'string' && (!choices[key] || choices[key].includes(raw)) ? raw : fallback
    ) as T;
  return (typeof raw === typeof fallback ? raw : fallback) as T;
}
/** Extra budgets are optional numbers per work item, so they are taken as they come. */
function overrides(raw: unknown): WorkOptions['overrides'] {
  if (!isObject(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter(([, v]) => typeof v === 'number' && Number.isFinite(v))
  );
}
/** Files saved before the settings format (model "solar-demo-3") carried the same values. */
function fromLegacy(raw: Record<string, unknown>): Record<string, unknown> {
  const profile = isObject(raw.profile) ? raw.profile : {};
  const second = isObject(raw.secondSurface) ? raw.secondSurface : null;
  return {
    preset: raw.preset,
    priceLevel: raw.priceLevel,
    automaticCosts: raw.automaticCosts,
    input: raw.baseInputs,
    work: raw.additionalWork,
    place: { name: profile.location, lat: profile.lat, lon: profile.lon },
    angle: profile.angle,
    aspect: profile.aspect,
    second: second ? { ...second, on: true } : { on: false },
    commission: raw.commission,
    policy: raw.policySettings,
  };
}
export function settingsFile(settings: Settings): SettingsFile {
  return { format: 'solarrechner', version: settingsVersion, settings };
}
/**
 * Reads a saved file or share link against the current settings as fallback. Returns the merged
 * settings or a message why they cannot be used.
 */
export function readSettings(raw: unknown, fallback: Settings): Settings | string {
  if (!isObject(raw)) return 'Die Datei enthält keine Einstellungen des Solarrechners.';
  let data: unknown;
  if (raw.format === 'solarrechner') {
    if (typeof raw.version !== 'number' || raw.version > settingsVersion)
      return 'Diese Einstellungen stammen aus einer neueren Version des Solarrechners.';
    data = raw.settings;
  } else if (raw.model === 'solar-demo-3') {
    data = fromLegacy(raw);
  } else {
    return 'Die Datei enthält keine Einstellungen des Solarrechners.';
  }
  if (!isObject(data)) return 'Die Datei enthält keine Einstellungen des Solarrechners.';
  const settings = merge(fallback, data);
  settings.work.overrides = overrides(isObject(data.work) ? data.work.overrides : undefined);
  const problem = validate(settings.input) ?? validatePolicy(settings.policy, settings.commission);
  return problem ? `Die Einstellungen passen nicht: ${problem}` : settings;
}

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}
/** URL fragment for the share link. The fragment never reaches a server. */
export const shareKey = 'einstellungen';
export async function encodeShare(settings: Settings): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(settingsFile(settings)));
  return `${shareKey}=${base64url(await pipe(json, new CompressionStream('deflate-raw')))}`;
}
export async function decodeShare(fragment: string): Promise<unknown> {
  const value = new URLSearchParams(fragment.replace(/^#/, '')).get(shareKey);
  if (!value) return null;
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const json = await pipe(bytes, new DecompressionStream('deflate-raw'));
  return JSON.parse(new TextDecoder().decode(json));
}
