import { describe, expect, it } from 'vitest';
import { etoDailyFAO56 } from './eto.js';

describe('etoDailyFAO56', () => {
  it('matches FAO-56 reference magnitude for temperate day', () => {
    const eto = etoDailyFAO56({
      Tmean: 26,
      RHmean: 65,
      u2: 2,
      Rs: 15,
      alt: 0,
      lat: (35 * Math.PI) / 180,
      doy: 246,
    });
    expect(eto).toBeCloseTo(3.94, 2);
  });

  it('returns zero when the numerator is negative', () => {
    const eto = etoDailyFAO56({
      Tmean: 5,
      RHmean: 90,
      u2: 1,
      Rs: 0.5,
      alt: 2000,
      lat: 0,
      doy: 15,
    });
    expect(eto).toBe(0);
  });
});
