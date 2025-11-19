export function drySpell(flags, minLen) {
    const events = [];
    let start = -1;
    let len = 0;
    for (let i = 0; i < flags.length; i++) {
        if (flags[i] === 0) {
            if (start === -1)
                start = i;
            len += 1;
        }
        else if (len > 0) {
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
export function peaksIntensity(hourly, threshold) {
    return hourly
        .filter((h) => (h.prcpRate ?? 0) >= threshold)
        .map((h) => ({ type: 'intensityPeak', from: h.t, value: h.prcpRate }));
}
//# sourceMappingURL=events.js.map