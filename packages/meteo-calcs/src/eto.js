export function etoDailyFAO56(input) {
    const T = input.Tmean;
    const P = 101.3 * Math.pow((293 - 0.0065 * input.alt) / 293, 5.26);
    const gamma = 0.000665 * P;
    const es = 0.6108 * Math.exp((17.27 * T) / (T + 237.3));
    const ea = es * (input.RHmean / 100);
    const delta = (4098 * es) / Math.pow(T + 237.3, 2);
    const G = input.G ?? 0;
    const dr = 1 + 0.033 * Math.cos((2 * Math.PI / 365) * input.doy);
    const solarDecl = 0.409 * Math.sin((2 * Math.PI / 365) * input.doy - 1.39);
    const ws = Math.acos(-Math.tan(input.lat) * Math.tan(solarDecl));
    const Ra = ((24 * 60) / Math.PI) *
        0.0820 *
        dr *
        (ws * Math.sin(input.lat) * Math.sin(solarDecl) + Math.cos(input.lat) * Math.cos(solarDecl) * Math.sin(ws));
    const Rso = (0.75 + 2e-5 * input.alt) * Ra;
    const Rns = 0.77 * input.Rs;
    const Rnl = 4.903e-9 *
        Math.pow(T + 273.16, 4) *
        (0.34 - 0.14 * Math.sqrt(ea)) *
        (1.35 * (input.Rs / Math.max(Rso, 1e-6)) - 0.35);
    const Rn = input.Rn ?? (Rns - Rnl);
    const num = 0.408 * delta * (Rn - G) + gamma * (900 / (T + 273)) * input.u2 * (es - ea);
    const den = delta + gamma * (1 + 0.34 * input.u2);
    return Math.max(0, num / den);
}
//# sourceMappingURL=eto.js.map