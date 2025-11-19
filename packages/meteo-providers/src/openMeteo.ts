import nodeFetch from 'node-fetch';
import { Series, MuniKey, TimeRange } from '@pkg/core';
import { SeriesSchema } from '@pkg/core/dist/schemas.js';
import { WeatherProvider } from './provider.js';
import { resolveCoordinates, ResolvedCoords } from './utils.js';

type SupportedField = 'prcp' | 'prcpRate' | 'temp' | 'rh' | 'wind' | 'rs' | 'pressure';

type HourlyPoint = import('@pkg/core').HourlyPoint;

const DEFAULT_FIELDS: SupportedField[] = ['prcp', 'prcpRate', 'temp', 'rh', 'wind', 'rs', 'pressure'];

const FIELD_CONFIG: Record<
  SupportedField,
  {
    param: string;
    map(value: number): number;
  }
> = {
  prcp: {
    param: 'precipitation',
    map: (value) => round(Math.max(0, value), 2),
  },
  prcpRate: {
    param: 'precipitation',
    map: (value) => round(Math.max(0, value), 2),
  },
  temp: {
    param: 'temperature_2m',
    map: (value) => round(value, 2),
  },
  rh: {
    param: 'relative_humidity_2m',
    map: (value) => round(value, 1),
  },
  wind: {
    param: 'wind_speed_10m',
    map: (value) => round(adjustWindTo2m(value), 2),
  },
  rs: {
    param: 'shortwave_radiation',
    map: (value) => round(value, 2),
  },
  pressure: {
    param: 'surface_pressure',
    map: (value) => round(value * 0.1, 2), // hPa → kPa
  },
};

const fetchFn: typeof globalThis.fetch =
  typeof globalThis.fetch === 'function'
    ? globalThis.fetch.bind(globalThis)
    : (nodeFetch as unknown as typeof globalThis.fetch);

export class OpenMeteoProvider implements WeatherProvider {
  name = 'open-meteo';

  async hourlySeries(
    key: MuniKey,
    range: TimeRange,
    fields: (keyof HourlyPoint)[]
  ): Promise<Series> {
    const requested = (fields?.length ? fields : DEFAULT_FIELDS).filter((field): field is SupportedField =>
      Object.prototype.hasOwnProperty.call(FIELD_CONFIG, field)
    );

    if (!requested.length) {
      throw new Error('No supported hourly fields requested');
    }

    const coords = await resolveCoordinates(key, fetchFn);
    const hourlyParams = Array.from(new Set(requested.map((field) => FIELD_CONFIG[field].param)));

    const segments = buildSegments(range, coords, hourlyParams);
    if (!segments.length) {
      throw new Error('Invalid or empty date range supplied');
    }

    const responses: OpenMeteoResponse[] = [];
    for (const segment of segments) {
      const data = await fetchSegment(segment);
      responses.push(data);
    }

    const hourly = mergeHourly(responses, requested);
    const tzFromData = responses.find((resp) => !!resp.timezone)?.timezone;

    const series: Series = {
      key,
      range,
      hourly,
      meta: {
        source: this.name,
        tz: coords.tz ?? tzFromData ?? 'UTC',
        lat: coords.lat,
        lon: coords.lon,
        alt: coords.alt,
      },
    };

    return SeriesSchema.parse(series);
  }
}

type OpenMeteoResponse = {
  timezone?: string;
  hourly?: Record<string, number[] | string[]>;
};

type SegmentRequest = {
  url: string;
  params: URLSearchParams;
};

function buildSegments(
  range: TimeRange,
  coords: ResolvedCoords,
  hourlyParams: string[]
): SegmentRequest[] {
  const start = parseDate(range.from);
  const end = parseDate(range.to);
  if (start > end) {
    return [];
  }

  const today = startOfUtcDay(new Date());
  const yesterday = addDays(today, -1);

  const segments: SegmentRequest[] = [];

  const baseParams = () => {
    const params = new URLSearchParams({
      latitude: coords.lat.toFixed(4),
      longitude: coords.lon.toFixed(4),
      hourly: hourlyParams.join(','),
      timezone: 'UTC',
      temperature_unit: 'celsius',
      windspeed_unit: 'ms',
      precipitation_unit: 'mm',
    });
    return params;
  };

  if (start <= yesterday) {
    const archiveParams = baseParams();
    archiveParams.set('start_date', formatDate(start));
    archiveParams.set('end_date', formatDate(minDate(end, yesterday)));
    segments.push({
      url: 'https://archive-api.open-meteo.com/v1/archive',
      params: archiveParams,
    });
  }

  if (end >= today) {
    const forecastParams = baseParams();
    forecastParams.set('start_date', formatDate(maxDate(start, today)));
    forecastParams.set('end_date', formatDate(end));
    segments.push({
      url: 'https://api.open-meteo.com/v1/forecast',
      params: forecastParams,
    });
  }

  if (!segments.length) {
    const archiveParams = baseParams();
    archiveParams.set('start_date', formatDate(start));
    archiveParams.set('end_date', formatDate(end));
    segments.push({
      url: 'https://archive-api.open-meteo.com/v1/archive',
      params: archiveParams,
    });
  }

  return segments;
}

async function fetchSegment(segment: SegmentRequest): Promise<OpenMeteoResponse> {
  const url = `${segment.url}?${segment.params.toString()}`;
  const response = await fetchFn(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed (${response.status})`);
  }
  return (await response.json()) as OpenMeteoResponse;
}

function mergeHourly(responses: OpenMeteoResponse[], fields: SupportedField[]): HourlyPoint[] {
  const byTime = new Map<string, HourlyPoint>();

  for (const response of responses) {
    const hourly = response.hourly ?? {};
    const time = (hourly.time as string[]) ?? [];

    time.forEach((timestamp, index) => {
      const iso = toIsoUtc(timestamp);
      const point = byTime.get(iso) ?? { t: iso };

      for (const field of fields) {
        const config = FIELD_CONFIG[field];
        const series = hourly[config.param] as number[] | undefined;
        if (!series) continue;
        const value = series[index];
        if (value == null || Number.isNaN(value)) continue;
        const mapped = config.map(value);
        switch (field) {
          case 'prcp':
            point.prcp = mapped;
            break;
          case 'prcpRate':
            point.prcpRate = mapped;
            break;
          case 'temp':
            point.temp = mapped;
            break;
          case 'rh':
            point.rh = mapped;
            break;
          case 'wind':
            point.wind = mapped;
            break;
          case 'rs':
            point.rs = mapped;
            break;
          case 'pressure':
            point.pressure = mapped;
            break;
          default:
            break;
        }
      }

      byTime.set(iso, point);
    });
  }

  return Array.from(byTime.values()).sort((a, b) => a.t.localeCompare(b.t));
}

function adjustWindTo2m(speed10m: number): number {
  return speed10m * 0.75;
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function parseDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return date;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function minDate(a: Date, b: Date): Date {
  return a < b ? a : b;
}

function maxDate(a: Date, b: Date): Date {
  return a > b ? a : b;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toIsoUtc(value: string): string {
  const hasZone = /[zZ]|[+-]\d{2}:\d{2}$/.test(value);
  const date = new Date(hasZone ? value : `${value}Z`);
  return date.toISOString();
}
