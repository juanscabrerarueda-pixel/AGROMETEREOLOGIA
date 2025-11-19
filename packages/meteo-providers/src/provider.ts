import { Series, MuniKey, TimeRange, HourlyPoint } from '@pkg/core';

export interface WeatherProvider {
  name: string;
  hourlySeries(
    key: MuniKey,
    range: TimeRange,
    fields: (keyof HourlyPoint)[]
  ): Promise<Series>;
}
