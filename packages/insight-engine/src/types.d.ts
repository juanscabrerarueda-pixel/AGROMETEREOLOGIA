import { Series, Thresholds } from '@pkg/core';
export type InsightKind = 'trend' | 'event' | 'advice';
export interface Insight {
    id: string;
    kind: InsightKind;
    text: string;
    data?: Record<string, unknown>;
}
export interface InsightContext {
    series: Series;
    thresholds: Thresholds;
}
export type InsightGenerator = (context: InsightContext) => Insight | Insight[] | undefined | null;
