type ReferenceParams = {
    lat: number;
    lon: number;
    from: string;
    to: string;
};
export type ReferenceDay = {
    date: string;
    value: number;
};
type ReferenceResult = {
    source: string;
    timezone: string;
    days: ReferenceDay[];
    coverage: {
        from?: string;
        to?: string;
    };
    note?: string;
};
export declare function useReferenceDaily(params: ReferenceParams | null): import("@tanstack/react-query").UseQueryResult<ReferenceResult, Error>;
export {};
