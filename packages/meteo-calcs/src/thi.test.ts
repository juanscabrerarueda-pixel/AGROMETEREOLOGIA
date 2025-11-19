import { describe, expect, it } from 'vitest';
import { thiC, thiBand } from './thi.js';

describe('thiC', () => {
  it('computes the temperature humidity index for typical conditions', () => {
    const thi = thiC(26, 65);
    expect(thi).toBeCloseTo(23.29, 2);
  });

  it('returns higher values when humidity increases', () => {
    const lowHumidity = thiC(28, 40);
    const highHumidity = thiC(28, 90);
    expect(highHumidity).toBeGreaterThan(lowHumidity);
  });
});

describe('thiBand', () => {
  it('classifies comfort band correctly', () => {
    expect(thiBand(65)).toBe('comfort');
  });

  it('classifies severe band when value exceeds threshold', () => {
    expect(thiBand(85)).toBe('severe');
  });
});
