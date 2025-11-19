import { useCallback, useEffect, useMemo, useState } from 'react';
import { defaultThresholds } from '@pkg/insight-engine';
import type { Thresholds } from '@pkg/core';

const STORAGE_KEY = 'tll.thresholds';

function readStoredThresholds(): Thresholds {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultThresholds;
    const parsed = JSON.parse(raw) as Partial<Thresholds>;
    return { ...defaultThresholds, ...parsed };
  } catch {
    return defaultThresholds;
  }
}

export function useThresholds() {
  const [thresholds, setThresholds] = useState<Thresholds>(() => {
    if (typeof window === 'undefined') return defaultThresholds;
    return readStoredThresholds();
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(thresholds));
  }, [thresholds]);

  const updateThreshold = useCallback(
    <K extends keyof Thresholds>(key: K, value: Thresholds[K]) => {
      setThresholds((prev: Thresholds) => ({ ...prev, [key]: value }));
    },
    []
  );

  const reset = useCallback(() => setThresholds(defaultThresholds), []);

  return useMemo(
    () => ({
      thresholds,
      setThresholds,
      updateThreshold,
      reset,
    }),
    [thresholds, updateThreshold, reset]
  );
}
