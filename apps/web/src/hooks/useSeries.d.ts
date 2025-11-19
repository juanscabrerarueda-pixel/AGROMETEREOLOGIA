import { UseQueryOptions } from '@tanstack/react-query';
import type { Series } from '@pkg/core';
import { SeriesQuery } from '../api/client';
type UseSeriesOptions = {
    enabled?: boolean;
    queryOptions?: Omit<UseQueryOptions<Series, Error, Series, (string | Record<string, unknown>)[]>, 'queryFn' | 'queryKey'>;
};
export declare function useSeries(params: SeriesQuery | null, options?: UseSeriesOptions): import("@tanstack/react-query").UseQueryResult<Series, Error>;
export {};
