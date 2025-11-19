import { describe, expect, it } from 'vitest';
import { findApplicationWindows } from './windows.js';

const RULES = {
  windMin: 1,
  windMax: 4,
  rhMin: 40,
  rhMax: 85,
  tMax: 30,
  rainProbMax: 0.3,
};

describe('findApplicationWindows', () => {
  it('finds contiguous windows that satisfy agronomic rules', () => {
    const hourly = [
      { t: '2025-01-01T00:00Z', prcp: 0, wind: 2, rh: 60, temp: 24 },
      { t: '2025-01-01T01:00Z', prcp: 0, wind: 3, rh: 55, temp: 23 },
      { t: '2025-01-01T02:00Z', prcp: 0, wind: 2, rh: 50, temp: 22 },
      { t: '2025-01-01T03:00Z', prcp: 2, wind: 2, rh: 70, temp: 22 },
      { t: '2025-01-01T04:00Z', prcp: 0, wind: 5, rh: 65, temp: 23 },
      { t: '2025-01-01T05:00Z', prcp: 0, wind: 2, rh: 60, temp: 24 },
    ];

    const windows = findApplicationWindows(hourly, RULES, 3);
    expect(windows).toEqual([
      { start: '2025-01-01T00:00Z', end: '2025-01-01T02:00Z' },
    ]);
  });

  it('skips windows when any hour violates the rules', () => {
    const hourly = [
      { t: '2025-01-01T00:00Z', prcp: 0, wind: 2, rh: 60, temp: 24 },
      { t: '2025-01-01T01:00Z', prcp: 0, wind: 2, rh: 90, temp: 24 }, // high RH
      { t: '2025-01-01T02:00Z', prcp: 0, wind: 2, rh: 60, temp: 24 },
      { t: '2025-01-01T03:00Z', prcp: 0, wind: 2, rh: 60, temp: 24 },
    ];

    const windows = findApplicationWindows(hourly, RULES, 2);
    expect(windows).toHaveLength(1);
    expect(windows[0]).toEqual({
      start: '2025-01-01T02:00Z',
      end: '2025-01-01T03:00Z',
    });
  });
});
