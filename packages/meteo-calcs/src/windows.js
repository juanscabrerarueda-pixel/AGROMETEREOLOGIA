export function findApplicationWindows(hourly, rules, hours = 3) {
    const ok = (h) => {
        const reasons = [];
        const rainProb = h.rainProb;
        if (rainProb != null && rainProb > rules.rainProbMax)
            reasons.push('rainProb');
        if (h.prcp && h.prcp > 0)
            reasons.push('rain');
        if (h.wind != null && (h.wind < rules.windMin || h.wind > rules.windMax))
            reasons.push('wind');
        if (h.rh != null && (h.rh < rules.rhMin || h.rh > rules.rhMax))
            reasons.push('rh');
        if (h.temp != null && h.temp > rules.tMax)
            reasons.push('temp');
        return { pass: reasons.length === 0, reasons };
    };
    const out = [];
    let i = 0;
    while (i <= hourly.length - hours) {
        let pass = true;
        const reasons = new Set();
        for (let j = 0; j < hours; j++) {
            const r = ok(hourly[i + j]);
            if (!r.pass) {
                pass = false;
                r.reasons.forEach((x) => reasons.add(x));
                break;
            }
        }
        if (pass) {
            out.push({ start: hourly[i].t, end: hourly[i + hours - 1].t });
            i += hours;
        }
        else {
            i += 1;
        }
    }
    return out;
}
//# sourceMappingURL=windows.js.map