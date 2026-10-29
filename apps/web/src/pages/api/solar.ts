import type { APIRoute } from 'astro';
import type { SolarProfile } from '@/lib/solar/model';

export const prerender = false;
const memory = new Map<string, { time: number; value: SolarProfile }>();
const endpoint = 'https://re.jrc.ec.europa.eu/api/v5_3/';
interface HourlyResponse {
  outputs: { hourly: { time: string; P: number; T2m: number }[] };
}
interface MonthlyResponse {
  outputs: { monthly: { fixed: { E_m: number }[] } };
}
async function upstream<T>(tool: string, params: URLSearchParams): Promise<T> {
  const response = await fetch(`${endpoint}${tool}?${params}`, {
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`PVGIS antwortet mit ${response.status}`);
  return response.json() as Promise<T>;
}
export const GET: APIRoute = async ({ url }) => {
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
  const [lat, lon, angle, aspect] = values;
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
  const key = [lat.toFixed(3), lon.toFixed(3), angle, aspect].join(',');
  const hit = memory.get(key);
  if (hit && Date.now() - hit.time < 86400000) return Response.json(hit.value);
  const common = new URLSearchParams({
    lat: lat.toFixed(3),
    lon: lon.toFixed(3),
    angle: String(angle),
    aspect: String(aspect),
    peakpower: '1',
    loss: '14',
    raddatabase: 'PVGIS-SARAH3',
    outputformat: 'json',
    pvtechchoice: 'crystSi',
    mountingplace: 'free',
  });
  try {
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
      location: `${lat.toFixed(3)}° N, ${lon.toFixed(3)}° O`,
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
    if (memory.size >= 32) memory.delete(memory.keys().next().value as string);
    memory.set(key, { time: Date.now(), value });
    return Response.json(value, {
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' },
    });
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
