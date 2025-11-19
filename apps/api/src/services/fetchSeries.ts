import { Cache, cacheKey } from '@pkg/cache';
import { Series } from '@pkg/core';
import { WeatherProvider } from '@pkg/meteo-providers';

type SeriesArgs = {
  key: { depto: string; muni?: string };
  range: { from: string; to: string };
  fields: (keyof import('@pkg/core').HourlyPoint)[];
};

const FORECAST_TTL = 6 * 3600; // 6 hours
const ARCHIVE_TTL = 24 * 3600; // 24 hours

export async function getSeries(
  provider: WeatherProvider,
  cache: Cache,
  args: SeriesArgs
): Promise<Series> {
  const key = cacheKey({
    src: provider.name,
    key: JSON.stringify(args.key),
    range: JSON.stringify(args.range),
    fields: args.fields.map(String),
  });

  const cached = await cache.get(key);
  if (cached) return cached as Series;

  const series = await provider.hourlySeries(args.key, args.range, args.fields);
  const isForecast = new Date(args.range.to).getTime() > Date.now();
  await cache.set(key, series, isForecast ? FORECAST_TTL : ARCHIVE_TTL);
  return series;
}
