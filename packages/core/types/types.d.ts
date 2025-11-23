export type MuniKey = {
    depto: string;
    muni?: string;
};
export type TimeRange = {
    from: string;
    to: string;
};
export interface HourlyPoint {
    t: string;
    prcp?: number;
    prcpRate?: number;
    temp?: number;
    rh?: number;
    wind?: number;
    rs?: number;
    pressure?: number;
    [extra: string]: unknown;
}
export interface SeriesMeta {
    source: string;
    tz: string;
    lat?: number;
    lon?: number;
    alt?: number;
}
export interface Series {
    key: MuniKey;
    range: TimeRange;
    hourly: HourlyPoint[];
    meta: SeriesMeta;
}
export type Thresholds = {
    intensityMmHr: number;
    rain3d: number;
    drySpellDays: number;
    thiBands: {
        comfort: number;
        mild: number;
        moderate: number;
        severe: number;
    };
    waterBalanceBands: {
        deficit: number;
        neutralLow: number;
        neutralHigh: number;
        excess: number;
    };
    appWindows: {
        windMin: number;
        windMax: number;
        rhMin: number;
        rhMax: number;
        tMax: number;
        rainProbMax: number;
    };
};
