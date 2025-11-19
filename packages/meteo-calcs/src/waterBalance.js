export function dailyWaterBalance(P, ETo) {
    return (P ?? 0) - (ETo ?? 0);
}
export function rollingSum(values, window) {
    const out = [];
    let acc = 0;
    for (let i = 0; i < values.length; i++) {
        acc += values[i];
        if (i >= window)
            acc -= values[i - window];
        out.push(acc);
    }
    return out;
}
//# sourceMappingURL=waterBalance.js.map