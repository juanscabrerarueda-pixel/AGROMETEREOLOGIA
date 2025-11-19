import { UseQueryOptions } from '@tanstack/react-query';
import { fetchInsights, InsightsQuery } from '../api/client';
import type { Thresholds } from '@pkg/core';
type InsightsData = Awaited<ReturnType<typeof fetchInsights>>;
type InsightsQueryKey = (string | Record<string, unknown>)[];
type UseInsightsOptions = {
    enabled?: boolean;
    queryOptions?: Omit<UseQueryOptions<InsightsData, Error, InsightsData, InsightsQueryKey>, 'queryFn' | 'queryKey'>;
};
export declare function useInsights(params: InsightsQuery | null, thresholds: Thresholds, options?: UseInsightsOptions): import("@tanstack/react-query").UseQueryResult<{
    seriesMeta: import("@pkg/core").Series["meta"];
    insights: import("@pkg/insight-engine").Insight[];
}, Error>;
export {};
