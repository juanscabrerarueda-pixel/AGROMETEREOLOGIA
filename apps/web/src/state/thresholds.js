import { useCallback, useEffect, useMemo, useState } from 'react';
import { defaultThresholds } from '@pkg/insight-engine';
const STORAGE_KEY = 'tll.thresholds';
function readStoredThresholds() {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return defaultThresholds;
        const parsed = JSON.parse(raw);
        return { ...defaultThresholds, ...parsed };
    }
    catch {
        return defaultThresholds;
    }
}
export function useThresholds() {
    const [thresholds, setThresholds] = useState(() => {
        if (typeof window === 'undefined')
            return defaultThresholds;
        return readStoredThresholds();
    });
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(thresholds));
    }, [thresholds]);
    const updateThreshold = useCallback((key, value) => {
        setThresholds((prev) => ({ ...prev, [key]: value }));
    }, []);
    const reset = useCallback(() => setThresholds(defaultThresholds), []);
    return useMemo(() => ({
        thresholds,
        setThresholds,
        updateThreshold,
        reset,
    }), [thresholds, updateThreshold, reset]);
}
//# sourceMappingURL=thresholds.js.map