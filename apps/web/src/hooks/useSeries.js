import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSeries } from '../api/client';
export function useSeries(params, options = {}) {
    const queryKey = useMemo(() => ['series', params], [params]);
    return useQuery({
        queryKey,
        enabled: !!params && (options.enabled ?? true),
        retry: options.queryOptions?.retry ?? 2,
        retryDelay: (failureCount) => Math.min(1000 * failureCount, 4000),
        queryFn: () => {
            if (!params)
                throw new Error('Series params not provided');
            return fetchSeries(params);
        },
        ...(options.queryOptions ?? {}),
    });
}
//# sourceMappingURL=useSeries.js.map