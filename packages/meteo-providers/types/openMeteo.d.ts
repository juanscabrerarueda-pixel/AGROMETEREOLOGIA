import { Series, MuniKey, TimeRange } from '@pkg/core';
import { WeatherProvider } from './provider.js';
type HourlyPoint = import('@pkg/core').HourlyPoint;
export declare class OpenMeteoProvider implements WeatherProvider {
    name: string;
    hourlySeries(key: MuniKey, range: TimeRange, fields: (keyof HourlyPoint)[]): Promise<Series>;
}
export {};
