export type DailyDatum = {
    date: string;
    label: string;
    value: number;
    icons: string[];
};
type DailyHeatmapProps = {
    daily: DailyDatum[];
    metric: 'accumulated' | 'intensity';
};
export declare function DailyHeatmap({ daily, metric }: DailyHeatmapProps): import("react/jsx-runtime").JSX.Element;
export {};
