export function thiC(T: number, RH: number) {
  return T - (0.55 - 0.0055 * RH) * (T - 14.5);
}

export type ThiBand = 'comfort' | 'mild' | 'moderate' | 'severe';

export function thiBand(
  value: number,
  bands: { comfort: number; mild: number; moderate: number; severe: number } = {
    comfort: 68,
    mild: 72,
    moderate: 79,
    severe: 80,
  }
): ThiBand {
  if (value < bands.comfort) return 'comfort';
  if (value <= bands.mild) return 'mild';
  if (value <= bands.moderate) return 'moderate';
  return 'severe';
}
