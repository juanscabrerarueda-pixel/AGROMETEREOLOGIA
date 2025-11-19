import { MuniKey } from '@pkg/core';

const DIACRITICS_RE = /[\u0300-\u036f]/g;
const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const MAX_GEOCODING_ATTEMPTS = 3;
const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';

const GEO_CACHE = new Map<string, { value: ResolvedCoords; exp: number }>();

const FALLBACK_COORDS: Record<string, { lat: number; lon: number; alt?: number }> = {
  default: { lat: 4.711, lon: -74.072 },
  amazonas: { lat: -4.2153, lon: -69.9406 },
  leticia: { lat: -4.2153, lon: -69.9406 },
  antioquia: { lat: 6.2442, lon: -75.5812 },
  medellin: { lat: 6.2442, lon: -75.5812 },
  arauca: { lat: 7.0847, lon: -70.7591 },
  atlantico: { lat: 10.9685, lon: -74.7813 },
  barranquilla: { lat: 10.9685, lon: -74.7813 },
  bolivar: { lat: 10.391, lon: -75.4794 },
  cartagena: { lat: 10.391, lon: -75.4794 },
  boyaca: { lat: 5.5333, lon: -73.3678 },
  tunja: { lat: 5.5333, lon: -73.3678 },
  casanare: { lat: 5.3378, lon: -72.3959 },
  yopal: { lat: 5.3378, lon: -72.3959 },
  cauca: { lat: 2.4448, lon: -76.6147 },
  popayan: { lat: 2.4448, lon: -76.6147 },
  cesar: { lat: 10.4631, lon: -73.2532 },
  valledupar: { lat: 10.4631, lon: -73.2532 },
  choco: { lat: 5.696, lon: -76.6423 },
  quibdo: { lat: 5.696, lon: -76.6423 },
  cordoba: { lat: 8.748, lon: -75.8814 },
  monteria: { lat: 8.748, lon: -75.8814 },
  cundinamarca: { lat: 4.711, lon: -74.0721 },
  bogota: { lat: 4.711, lon: -74.0721 },
  guainia: { lat: 3.8667, lon: -67.9167 },
  inirida: { lat: 3.8667, lon: -67.9167 },
  guaviare: { lat: 2.5729, lon: -72.6459 },
  huila: { lat: 2.9273, lon: -75.2819 },
  neiva: { lat: 2.9273, lon: -75.2819 },
  'la guajira': { lat: 11.544, lon: -72.907 },
  riohacha: { lat: 11.544, lon: -72.907 },
  magdalena: { lat: 11.2408, lon: -74.199 },
  'santa marta': { lat: 11.2408, lon: -74.199 },
  meta: { lat: 4.142, lon: -73.6266 },
  villavicencio: { lat: 4.142, lon: -73.6266 },
  narino: { lat: 1.2136, lon: -77.2811 },
  pasto: { lat: 1.2136, lon: -77.2811 },
  'norte de santander': { lat: 7.8833, lon: -72.5051 },
  cucuta: { lat: 7.8833, lon: -72.5051 },
  putumayo: { lat: 1.152, lon: -76.6532 },
  mocoa: { lat: 1.152, lon: -76.6532 },
  quindio: { lat: 4.5339, lon: -75.6811 },
  armenia: { lat: 4.5339, lon: -75.6811 },
  risaralda: { lat: 4.8133, lon: -75.6961 },
  pereira: { lat: 4.8133, lon: -75.6961 },
  'san andres y providencia': { lat: 12.5833, lon: -81.7006 },
  sucre: { lat: 9.3047, lon: -75.3977 },
  sincelejo: { lat: 9.3047, lon: -75.3977 },
  santander: { lat: 7.1193, lon: -73.1227 },
  bucaramanga: { lat: 7.1193, lon: -73.1227 },
  tolima: { lat: 4.4389, lon: -75.2322 },
  ibague: { lat: 4.4389, lon: -75.2322 },
  'valle del cauca': { lat: 3.4516, lon: -76.5319 },
  cali: { lat: 3.4516, lon: -76.5319 },
  vaupes: { lat: 1.2519, lon: -70.2347 },
  mitu: { lat: 1.2519, lon: -70.2347 },
  vichada: { lat: 6.1846, lon: -67.493 },
  'puerto carreno': { lat: 6.1846, lon: -67.493 },
};

export function normalizeKey(value?: string | null): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .trim();
}

export function fallbackCoords(key: MuniKey): { lat: number; lon: number; alt?: number } {
  const muniKey = normalizeKey(key.muni);
  if (muniKey && FALLBACK_COORDS[muniKey]) {
    return FALLBACK_COORDS[muniKey];
  }
  const deptKey = normalizeKey(key.depto);
  if (deptKey && FALLBACK_COORDS[deptKey]) {
    return FALLBACK_COORDS[deptKey];
  }
  return FALLBACK_COORDS.default;
}

export type ResolvedCoords = {
  lat: number;
  lon: number;
  alt?: number;
  tz?: string;
};

function cacheKey(value: string): string {
  return `geo:${normalizeKey(value)}`;
}

function readCachedCoords(query?: string | null): ResolvedCoords | undefined {
  if (!query) return undefined;
  const entry = GEO_CACHE.get(cacheKey(query));
  if (!entry) return undefined;
  if (entry.exp <= Date.now()) {
    GEO_CACHE.delete(cacheKey(query));
    return undefined;
  }
  return entry.value;
}

function writeCachedCoords(query: string, value: ResolvedCoords) {
  const key = cacheKey(query);
  GEO_CACHE.set(key, { value, exp: Date.now() + GEO_CACHE_TTL_MS });
}

async function wait(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resolveCoordinates(
  key: MuniKey,
  fetcher: typeof fetch
): Promise<ResolvedCoords> {
  const query = key.muni ?? key.depto;
  if (!query) {
    const fallback = fallbackCoords(key);
    return { ...fallback, tz: 'America/Bogota' };
  }

  const cached = readCachedCoords(query);
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    name: query,
    count: '1',
    language: 'es',
    format: 'json',
    country_code: 'CO',
  });
  const url = `${GEOCODING_ENDPOINT}?${params.toString()}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_GEOCODING_ATTEMPTS; attempt++) {
    try {
      const resp = await fetcher(url, { headers: { accept: 'application/json' } });
      if (!resp.ok) {
        throw new Error(`Geocoding request failed with status ${resp.status}`);
      }
      const json = (await resp.json()) as {
        results?: Array<{
          latitude: number;
          longitude: number;
          elevation?: number;
          timezone?: string;
        }>;
      };
      const hit = json.results?.[0];
      if (hit) {
        const resolved: ResolvedCoords = {
          lat: hit.latitude,
          lon: hit.longitude,
          alt: hit.elevation ?? undefined,
          tz: hit.timezone ?? 'America/Bogota',
        };
        writeCachedCoords(query, resolved);
        return resolved;
      }
      break;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_GEOCODING_ATTEMPTS - 1) {
        await wait(200 * Math.pow(2, attempt));
      }
    }
  }

  if (lastError) {
    console.warn('Geocoding failed, using fallback coordinates', lastError);
  }

  const fallback = fallbackCoords(key);
  const resolvedFallback = { ...fallback, tz: 'America/Bogota' };
  writeCachedCoords(query, resolvedFallback);
  return resolvedFallback;
}
