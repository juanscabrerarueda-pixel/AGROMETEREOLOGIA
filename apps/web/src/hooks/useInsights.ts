import { useMemo } from 'react';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { fetchInsights, InsightsQuery } from '../api/client';
import type { Thresholds } from '@pkg/core';

type InsightsData = Awaited<ReturnType<typeof fetchInsights>>;
type InsightsQueryKey = (string | Record<string, unknown>)[];

type UseInsightsOptions = {
  enabled?: boolean;
  queryOptions?: Omit<
    UseQueryOptions<InsightsData, Error, InsightsData, InsightsQueryKey>,
    'queryFn' | 'queryKey'
  >;
};

export function useInsights(
  params: InsightsQuery | null,
  thresholds: Thresholds,
  options: UseInsightsOptions = {}
) {
  const queryKey = useMemo(
    () => ['insights', params, thresholds] as InsightsQueryKey,
    [params, thresholds]
  );

  return useQuery<InsightsData, Error, InsightsData, InsightsQueryKey>({
    queryKey,
    enabled: !!params && (options.enabled ?? true),
    retry: options.queryOptions?.retry ?? 2,
    retryDelay: (failureCount) => Math.min(1000 * failureCount, 4000),
    queryFn: () => {
      if (!params) throw new Error('Insights params not provided');
      return fetchInsights({ ...params, thresholds });
    },
    ...(options.queryOptions ?? {}),
  });
}
