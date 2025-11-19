import { describe, expect, it, vi } from 'vitest';
import { insightsFromSeries } from './generate.js';
import { defaultThresholds } from './defaults.js';
import type { Series } from '@pkg/core';

describe('insightsFromSeries', () => {
  it('produces intensity and THI insights when data is available', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));

    const series: Series = {
      key: { depto: 'Meta', muni: 'Villavicencio' },
      range: { from: '2024-12-30', to: '2025-01-05' },
      hourly: [
        { t: '2025-01-02T10:00:00Z', prcpRate: 7.2, temp: 29, rh: 70 },
        { t: '2025-01-02T11:00:00Z', prcpRate: 8.1, temp: 30, rh: 68 },
      ],
      meta: { source: 'open-meteo', tz: 'UTC' },
    };

    const insights = insightsFromSeries(series, defaultThresholds);
    expect(insights).toHaveLength(2);
    const peaks = insights.find((i) => i.id === 'intensity-peaks');
    expect(peaks).toBeDefined();
    expect(peaks?.data).toHaveProperty('peaks');

    const thi = insights.find((i) => i.id === 'thi-tomorrow');
    expect(thi).toBeDefined();
    expect(thi?.text).toMatch(/THI/);

    vi.useRealTimers();
  });

  it('returns empty array when hourly data is missing', () => {
    const emptySeries: Series = {
      key: { depto: 'Meta' },
      range: { from: '2025-01-01', to: '2025-01-02' },
      hourly: [],
      meta: { source: 'open-meteo', tz: 'UTC' },
    };
    expect(insightsFromSeries(emptySeries, defaultThresholds)).toEqual([]);
  });
});
