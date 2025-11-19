export function thiC(T, RH) {
    return T - (0.55 - 0.0055 * RH) * (T - 14.5);
}
export function thiBand(value, bands = {
    comfort: 68,
    mild: 72,
    moderate: 79,
    severe: 80,
}) {
    if (value < bands.comfort)
        return 'comfort';
    if (value <= bands.mild)
        return 'mild';
    if (value <= bands.moderate)
        return 'moderate';
    return 'severe';
}
//# sourceMappingURL=thi.js.map