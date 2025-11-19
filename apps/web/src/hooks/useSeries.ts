import { useMemo } from 'react';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import type { Series } from '@pkg/core';
import { fetchSeries, SeriesQuery } from '../api/client';

type UseSeriesOptions = {
  enabled?: boolean;
  queryOptions?: Omit<
    UseQueryOptions<Series, Error, Series, (string | Record<string, unknown>)[]>,
    'queryFn' | 'queryKey'
  >;
};

export function useSeries(params: SeriesQuery | null, options: UseSeriesOptions = {}) {
  const queryKey = useMemo(
    () => ['series', params] as (string | Record<string, unknown>)[],
    [params]
  );

  return useQuery({
    queryKey,
    enabled: !!params && (options.enabled ?? true),
    retry: options.queryOptions?.retry ?? 2,
    retryDelay: (failureCount) => Math.min(1000 * failureCount, 4000),
    queryFn: () => {
      if (!params) throw new Error('Series params not provided');
      return fetchSeries(params);
    },
    ...(options.queryOptions ?? {}),
  });
}
