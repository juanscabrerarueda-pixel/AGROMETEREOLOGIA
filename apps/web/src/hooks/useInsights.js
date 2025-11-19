import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchInsights } from '../api/client';
export function useInsights(params, thresholds, options = {}) {
    const queryKey = useMemo(() => ['insights', params, thresholds], [params, thresholds]);
    return useQuery({
        queryKey,
        enabled: !!params && (options.enabled ?? true),
        retry: options.queryOptions?.retry ?? 2,
        retryDelay: (failureCount) => Math.min(1000 * failureCount, 4000),
        queryFn: () => {
            if (!params)
                throw new Error('Insights params not provided');
            return fetchInsights({ ...params, thresholds });
        },
        ...(options.queryOptions ?? {}),
    });
}
//# sourceMappingURL=useInsights.js.map