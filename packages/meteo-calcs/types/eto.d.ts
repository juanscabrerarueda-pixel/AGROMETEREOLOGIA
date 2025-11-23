export type EtoInput = {
    Tmean: number;
    RHmean: number;
    u2: number;
    Rs: number;
    alt: number;
    lat: number;
    doy: number;
    Rn?: number;
    G?: number;
};
export declare function etoDailyFAO56(input: EtoInput): number;
