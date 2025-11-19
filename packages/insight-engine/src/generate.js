import { peaksIntensity, thiBand, thiC } from '@pkg/meteo-calcs';
function resolveTomorrowIso(series) {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const tzOffsetMinutes = parseTzOffset(series.meta?.tz);
    if (tzOffsetMinutes !== null) {
        const shifted = new Date(tomorrow.getTime() + tzOffsetMinutes * 60 * 1000);
        return shifted.toISOString().slice(0, 10);
    }
    return tomorrow.toISOString().slice(0, 10);
}
function parseTzOffset(tz) {
    if (!tz)
        return null;
    const match = tz.match(/([+-]\d{2}):?(\d{2})?$/);
    if (!match)
        return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2] ?? '0');
    return hours * 60 + Math.sign(hours) * minutes;
}
export function insightsFromSeries(series, thresholds) {
    if (!series || !Array.isArray(series.hourly))
        return [];
    const insights = [];
    const hourly = series.hourly;
    const daily = summarizeDaily(series);
    const rangeText = buildRangeLabel(series);
    if (daily.totalDays > 0) {
        const rainSentence = daily.totalRain > 0
            ? `Entre ${rangeText} se acumularon ${formatNumber(daily.totalRain)} mm repartidos en ${daily.totalDays} días con registro.`
            : `Entre ${rangeText} no se registró lluvia medible.`;
        const maxSentence = daily.maxRainDate && daily.maxRain > 0
            ? `El día más lluvioso fue ${formatDate(daily.maxRainDate)} con ${formatNumber(daily.maxRain)} mm.`
            : '';
        const lastSentence = daily.lastRainDate && daily.lastRainValue != null
            ? `El último día con lluvia fue ${formatDate(daily.lastRainDate)}, cuando cayeron ${formatNumber(daily.lastRainValue)} mm.`
            : '';
        insights.push({
            id: 'daily-summary',
            kind: 'trend',
            text: `${rainSentence} ${maxSentence} ${lastSentence}`.trim(),
            data: { daily },
        });
    }
    if (daily.longestDry?.length && daily.longestDry.length >= (thresholds?.drySpellDays ?? 5)) {
        const dry = daily.longestDry;
        insights.push({
            id: 'dry-spell',
            kind: 'advice',
            text: `Se presentó una sequía de ${dry.length} días entre ${formatDate(dry.from)} y ${formatDate(dry.to)}. Considera riego suplementario o proteger los cultivos sensibles.`,
            data: dry,
        });
    }
    const peaks = peaksIntensity(hourly, thresholds?.intensityMmHr ?? 6);
    if (peaks.length) {
        const highest = peaks.reduce((max, peak) => (peak.value > max.value ? peak : max), peaks[0]);
        insights.push({
            id: 'intensity-peaks',
            kind: 'event',
            text: `Detectamos ${peaks.length} episodios con intensidades superiores a ${(thresholds?.intensityMmHr ?? 6).toFixed(1)} mm/h. El más intenso alcanzó ${formatNumber(highest.value)} mm/h el ${formatDate(highest.from)}.`,
            data: { peaks },
        });
    }
    const tomorrowIso = resolveTomorrowIso(series);
    const thiCandidates = hourly.filter((h) => typeof h.temp === 'number' && typeof h.rh === 'number' && h.t.startsWith(tomorrowIso));
    if (thiCandidates.length) {
        const thiValues = thiCandidates.map((h) => thiC(h.temp, h.rh));
        const maxThi = Math.max(...thiValues);
        const band = thiBand(maxThi, thresholds?.thiBands);
        insights.push({
            id: 'thi-tomorrow',
            kind: 'advice',
            text: `Para mañana se proyecta un THI máximo de ${maxThi.toFixed(1)} (${band}). Ajusta ventilación, sombra o hidratación si observas estrés térmico.`,
            data: { maxThi, band, points: thiCandidates },
        });
    }
    return insights;
}
function summarizeDaily(series) {
    const buckets = new Map();
    for (const point of series.hourly ?? []) {
        const day = point.t?.slice(0, 10);
        if (!day)
            continue;
        const bucket = buckets.get(day) ?? { rain: 0 };
        if (typeof point.prcp === 'number')
            bucket.rain += point.prcp;
        buckets.set(day, bucket);
    }
    const dates = Array.from(buckets.keys()).sort();
    let totalRain = 0;
    let totalDays = 0;
    let maxRain = 0;
    let maxRainDate;
    let lastRainDate;
    let lastRainValue;
    let currentDryLength = 0;
    let currentDryStart;
    let longestDry;
    for (const date of dates) {
        const rain = buckets.get(date)?.rain ?? 0;
        if (rain >= 0.5) {
            totalRain += rain;
            totalDays += 1;
            lastRainDate = date;
            lastRainValue = rain;
            if (rain > maxRain) {
                maxRain = rain;
                maxRainDate = date;
            }
            if (currentDryLength > 0 && (!longestDry || currentDryLength > longestDry.length) && currentDryStart) {
                longestDry = {
                    from: currentDryStart,
                    to: addDaysToIso(currentDryStart, currentDryLength - 1),
                    length: currentDryLength,
                };
            }
            currentDryLength = 0;
            currentDryStart = undefined;
        }
        else {
            currentDryLength += 1;
            if (!currentDryStart)
                currentDryStart = date;
        }
    }
    if (currentDryLength > 0 && (!longestDry || currentDryLength > longestDry.length) && currentDryStart) {
        longestDry = {
            from: currentDryStart,
            to: addDaysToIso(currentDryStart, currentDryLength - 1),
            length: currentDryLength,
        };
    }
    return { totalRain, totalDays, maxRain, maxRainDate, lastRainDate, lastRainValue, longestDry };
}
function buildRangeLabel(series) {
    const from = series.range?.from ?? '';
    const to = series.range?.to ?? '';
    return `${formatDate(from)} - ${formatDate(to)}`;
}
function formatNumber(value) {
    return value.toLocaleString('es-CO', { maximumFractionDigits: 1 });
}
function formatDate(iso) {
    if (!iso)
        return 'sin fecha';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return iso.slice(0, 10);
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}
function addDaysToIso(startIso, days) {
    const date = new Date(`${startIso}T00:00:00Z`);
    if (Number.isNaN(date.getTime()))
        return startIso;
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}
//# sourceMappingURL=generate.js.map