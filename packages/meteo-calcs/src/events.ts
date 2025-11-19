import { HourlyPoint } from '@pkg/core';

export type Event =
  | { type: 'drySpell'; from: string; to: string; value: number }
  | { type: 'intensityPeak'; from: string; value: number }
  | { type: 'rain3d'; from: string; value: number }
  | { type: 'wetSpell'; from: string; to: string; value: number };

export function drySpell(flags: number[], minLen: number): Event[] {
  const events: Event[] = [];
  let start = -1;
  let len = 0;
  for (let i = 0; i < flags.length; i++) {
    if (flags[i] === 0) {
      if (start === -1) start = i;
      len += 1;
    } else if (len > 0) {
      if (len >= minLen) {
        events.push({ type: 'drySpell', from: `${i - len}`, to: `${i - 1}`, value: len });
      }
      start = -1;
      len = 0;
    }
  }
  if (len >= minLen && start !== -1) {
    events.push({ type: 'drySpell', from: `${flags.length - len}`, to: `${flags.length - 1}`, value: len });
  }
  return events;
}

export function peaksIntensity(hourly: HourlyPoint[], threshold: number): Event[] {
  return hourly
    .filter((h) => (h.prcpRate ?? 0) >= threshold)
    .map((h) => ({ type: 'intensityPeak', from: h.t, value: h.prcpRate! }));
}
