import type { Series } from '@pkg/core';
type HourlyHeatmapProps = {
    series: Series | null | undefined;
    variable?: 'prcp' | 'prcpRate';
};
export declare function HourlyHeatmap({ series, variable }: HourlyHeatmapProps): import("react/jsx-runtime").JSX.Element;
export {};
