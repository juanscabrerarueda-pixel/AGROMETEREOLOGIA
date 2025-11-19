import { HourlyPoint } from '@pkg/core';
export type Window = {
    start: string;
    end: string;
    reasonsExcluded?: string[];
};
export type AppRules = {
    windMin: number;
    windMax: number;
    rhMin: number;
    rhMax: number;
    tMax: number;
    rainProbMax: number;
};
export declare function findApplicationWindows(hourly: HourlyPoint[], rules: AppRules, hours?: number): Window[];
