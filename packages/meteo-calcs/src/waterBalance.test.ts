import { describe, expect, it } from 'vitest';
import { dailyWaterBalance, rollingSum } from './waterBalance.js';

describe('dailyWaterBalance', () => {
  it('computes precipitation minus evapotranspiration', () => {
    expect(dailyWaterBalance(12, 8)).toBe(4);
    expect(dailyWaterBalance(0, 5)).toBe(-5);
  });
});

describe('rollingSum', () => {
  it('computes k-day windowed sums', () => {
    const series = [1, 2, 3, 4, 5];
    expect(rollingSum(series, 3)).toEqual([1, 3, 6, 9, 12]);
  });

  it('handles window larger than array length', () => {
    const series = [2, 2];
    expect(rollingSum(series, 5)).toEqual([2, 4]);
  });
});
