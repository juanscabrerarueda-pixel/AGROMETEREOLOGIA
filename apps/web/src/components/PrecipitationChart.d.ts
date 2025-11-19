export type AggregatedPoint = {
    date: string;
    label: string;
    value: number;
    isForecast?: boolean;
};
export type TrendPoint = {
    index: number;
    value: number;
};
type PrecipitationChartProps = {
    points: AggregatedPoint[];
    trend?: TrendPoint[] | null;
    metric: 'accumulated' | 'intensity';
};
export declare function PrecipitationChart({ points, trend, metric }: PrecipitationChartProps): import("react/jsx-runtime").JSX.Element;
export {};
