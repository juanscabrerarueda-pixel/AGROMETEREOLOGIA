import type { Series } from '@pkg/core';
type HourlyHeatmapProps = {
    series: Series | null | undefined;
    variable?: 'prcp' | 'prcpRate';
    maxColumns?: number;
};
export declare function HourlyHeatmap({ series, variable, maxColumns }: HourlyHeatmapProps): import("react/jsx-runtime").JSX.Element;
export {};
