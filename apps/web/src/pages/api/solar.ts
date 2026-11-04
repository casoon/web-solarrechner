import type { APIRoute } from 'astro';
import type { SolarProfile } from '@/lib/solar/model';
import { env } from 'cloudflare:workers';

export const prerender = false;
const endpoint = 'https://re.jrc.ec.europa.eu/api/v5_3/';
/** A day in the isolate, a month at the edge: PVGIS long-term means do not change in between. */
const cacheControl = 'public, max-age=86400, s-maxage=2592000';
const memory = new Map<string, { time: number; value: SolarProfile }>();
interface HourlyResponse {
  outputs: { hourly: { time: string; P: number; T2m: number }[] };
}
interface MonthlyResponse {
  outputs: { monthly: { fixed: { E_m: number }[] } };
}
interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}
/** Optional bindings from wrangler.toml; the dev server may run without them. */
interface Bindings {
  PVGIS_PER_CLIENT?: RateLimit;
  PVGIS_TOTAL?: RateLimit;
}
async function upstream<T>(tool: string, params: URLSearchParams): Promise<T> {
  const response = await fetch(`${endpoint}${tool}?${params}`, {
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`PVGIS antwortet mit ${response.status}`);
  return response.json() as Promise<T>;
}
async function fetchProfile(lat: number, lon: number, angle: number, aspect: number) {
  const common = new URLSearchParams({
    lat: lat.toFixed(2),
    lon: lon.toFixed(2),
    angle: String(angle),
    aspect: String(aspect),
    peakpower: '1',
    loss: '14',
    raddatabase: 'PVGIS-SARAH3',
    outputformat: 'json',
    pvtechchoice: 'crystSi',
    mountingplace: 'free',
  });
  const hourlyParams = new URLSearchParams(common);
  hourlyParams.set('pvcalculation', '1');
  hourlyParams.set('startyear', '2023');
  hourlyParams.set('endyear', '2023');
  const [hourly, monthly] = await Promise.all([
    upstream<HourlyResponse>('seriescalc', hourlyParams),
    upstream<MonthlyResponse>('PVcalc', common),
  ]);
  const rows = hourly.outputs.hourly;
  if (
    rows.length !== 8760 ||
    monthly.outputs.monthly.fixed.length !== 12 ||
    rows.some((r) => !Number.isFinite(r.P) || !Number.isFinite(r.T2m))
  )
    throw new Error('PVGIS-Daten sind unvollständig');
  const sums = Array.from({ length: 12 }, () => 0);
  for (const row of rows) sums[Number(row.time.slice(4, 6)) - 1] += row.P / 1000;
  const value: SolarProfile = {
    location: `${lat.toFixed(2)}° N, ${lon.toFixed(2)}° O`,
    lat,
    lon,
    angle,
    aspect,
    source: `${endpoint}seriescalc?${hourlyParams} | ${endpoint}PVcalc?${common}`,
    retrieved: new Date().toISOString().slice(0, 10),
    year: 2023,
    period: 'SARAH3 2005–2023; Stundenform 2023 auf langjährige Monatsmittel normiert',
    hours: rows.map((r) => {
      const m = Number(r.time.slice(4, 6)) - 1;
      return [r.time, ((r.P / 1000) * monthly.outputs.monthly.fixed[m].E_m) / sums[m], r.T2m];
    }),
  };
  return value;
}
const edgeCache = () => (globalThis.caches as CacheStorage & { default?: Cache }).default;
/**
 * PVGIS profile for one place and orientation. Coordinates are rounded to 0.01° (about one
 * kilometre) and tilt and azimuth to whole degrees, so the same place always hits the same cache
 * entry. Only a cache miss counts against the rate limits and reaches PVGIS.
 */
export const GET: APIRoute = async ({ url, request }) => {
  const values = ['lat', 'lon', 'angle', 'aspect'].map((key) => Number(url.searchParams.get(key)));
  if (
    ['lat', 'lon', 'angle', 'aspect'].some((key) => !url.searchParams.has(key)) ||
    values.some((v) => !Number.isFinite(v))
  ) {
    return Response.json(
      { error: 'Koordinaten, Neigung und Ausrichtung fehlen.' },
      { status: 400 }
    );
  }
  const [lat, lon, angle, aspect] = [
    Math.round(values[0] * 100) / 100,
    Math.round(values[1] * 100) / 100,
    Math.round(values[2]),
    Math.round(values[3]),
  ];
  if (
    lat < 47 ||
    lat > 55.2 ||
    lon < 5.5 ||
    lon > 15.5 ||
    angle < 0 ||
    angle > 90 ||
    aspect < -180 ||
    aspect > 180
  ) {
    return Response.json(
      { error: 'Bitte eine Lage in Deutschland und gültige Dachwinkel wählen.' },
      { status: 400 }
    );
  }
  const key = [lat.toFixed(2), lon.toFixed(2), angle, aspect].join(',');
  // The caller compares the profile with its own coordinates, so they go back unrounded.
  const respond = (value: SolarProfile) =>
    Response.json(
      { ...value, lat: values[0], lon: values[1] },
      { headers: { 'Cache-Control': cacheControl } }
    );
  const hit = memory.get(key);
  if (hit && Date.now() - hit.time < 86400000) return respond(hit.value);
  const cache = edgeCache();
  const cacheUrl = new URL('/api/solar/', url.origin);
  cacheUrl.searchParams.set('key', key);
  const cacheKey = new Request(cacheUrl);
  const cached = await cache?.match(cacheKey);
  if (cached) {
    const value = (await cached.json()) as SolarProfile;
    memory.set(key, { time: Date.now(), value });
    return respond(value);
  }
  const bindings = env as Partial<Bindings>;
  const client = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const allowed = await Promise.all([
    bindings?.PVGIS_PER_CLIENT?.limit({ key: client }) ?? { success: true },
    bindings?.PVGIS_TOTAL?.limit({ key: 'pvgis' }) ?? { success: true },
  ]);
  if (allowed.some((a) => !a.success)) {
    return Response.json(
      {
        error:
          'Zu viele Ertragsabrufe in kurzer Zeit. Die bisherige Rechnung bleibt erhalten. Bitte in einer Minute erneut versuchen.',
      },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }
  try {
    const value = await fetchProfile(lat, lon, angle, aspect);
    if (memory.size >= 32) memory.delete(memory.keys().next().value as string);
    memory.set(key, { time: Date.now(), value });
    if (cache)
      await cache.put(
        cacheKey,
        Response.json(value, { headers: { 'Cache-Control': cacheControl } })
      );
    return respond(value);
  } catch {
    return Response.json(
      {
        error:
          'PVGIS ist gerade nicht erreichbar oder liefert unvollständige Daten. Die bisherige Rechnung bleibt erhalten. Bitte später erneut versuchen.',
      },
      { status: 502 }
    );
  }
};
