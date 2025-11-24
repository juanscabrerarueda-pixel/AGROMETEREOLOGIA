import type { Series } from '@pkg/core';
type HourlyHeatmapProps = {
    series: Series | null | undefined;
    variable?: 'prcp' | 'prcpRate';
    maxRows?: number;
};
export declare function HourlyHeatmap({ series, variable, maxRows }: HourlyHeatmapProps): import("react/jsx-runtime").JSX.Element;
export {};
