import type { Series } from '@pkg/core';
import type { Insight } from '@pkg/insight-engine';
export interface SeriesQuery {
    depto: string;
    muni?: string;
    from: string;
    to: string;
    fields?: string[];
}
export interface InsightsQuery extends SeriesQuery {
    thresholds?: Record<string, unknown>;
}
export declare function fetchSeries(params: SeriesQuery): Promise<Series>;
export declare function fetchInsights(params: InsightsQuery): Promise<{
    seriesMeta: Series['meta'];
    insights: Insight[];
}>;
