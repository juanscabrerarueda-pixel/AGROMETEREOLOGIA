import type { Thresholds } from '@pkg/core';
export declare function useThresholds(): {
    thresholds: Thresholds;
    setThresholds: import("react").Dispatch<import("react").SetStateAction<Thresholds>>;
    updateThreshold: <K extends keyof Thresholds>(key: K, value: Thresholds[K]) => void;
    reset: () => void;
};
