import { describe, expect, it } from 'vitest';
import { drySpell, peaksIntensity } from './events.js';

describe('drySpell', () => {
  it('detects dry spells with minimum length', () => {
    const flags = [0, 0, 1, 0, 0, 0, 1];
    const events = drySpell(flags, 2);
    expect(events).toEqual([
      { type: 'drySpell', from: '0', to: '1', value: 2 },
      { type: 'drySpell', from: '3', to: '5', value: 3 },
    ]);
  });

  it('ignores sequences shorter than the threshold', () => {
    const flags = [0, 1, 0, 0];
    const events = drySpell(flags, 3);
    expect(events).toEqual([]);
  });
});

describe('peaksIntensity', () => {
  it('returns hourly records surpassing the intensity threshold', () => {
    const hourly = [
      { t: '2025-01-01T00:00Z', prcpRate: 2 },
      { t: '2025-01-01T01:00Z', prcpRate: 6 },
      { t: '2025-01-01T02:00Z', prcpRate: 8 },
    ];
    const events = peaksIntensity(hourly as any, 5);
    expect(events).toEqual([
      { type: 'intensityPeak', from: '2025-01-01T01:00Z', value: 6 },
      { type: 'intensityPeak', from: '2025-01-01T02:00Z', value: 8 },
    ]);
  });
});
