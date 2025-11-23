export declare function thiC(T: number, RH: number): number;
export type ThiBand = 'comfort' | 'mild' | 'moderate' | 'severe';
export declare function thiBand(value: number, bands?: {
    comfort: number;
    mild: number;
    moderate: number;
    severe: number;
}): ThiBand;
