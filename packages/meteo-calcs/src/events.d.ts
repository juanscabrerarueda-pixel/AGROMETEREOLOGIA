import { HourlyPoint } from '@pkg/core';
export type Event = {
    type: 'drySpell';
    from: string;
    to: string;
    value: number;
} | {
    type: 'intensityPeak';
    from: string;
    value: number;
} | {
    type: 'rain3d';
    from: string;
    value: number;
} | {
    type: 'wetSpell';
    from: string;
    to: string;
    value: number;
};
export declare function drySpell(flags: number[], minLen: number): Event[];
export declare function peaksIntensity(hourly: HourlyPoint[], threshold: number): Event[];
