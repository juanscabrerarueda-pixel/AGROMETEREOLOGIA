import { MuniKey } from '@pkg/core';
export declare function normalizeKey(value?: string | null): string;
export declare function fallbackCoords(key: MuniKey): {
    lat: number;
    lon: number;
    alt?: number;
};
export type ResolvedCoords = {
    lat: number;
    lon: number;
    alt?: number;
    tz?: string;
};
export declare function resolveCoordinates(key: MuniKey, fetcher: typeof fetch): Promise<ResolvedCoords>;
