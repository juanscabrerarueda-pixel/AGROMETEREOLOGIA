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
    const spanDays = computeRangeSpanDays(series);
    const mode = inferTemporalMode(series);
    const isFuture = mode === 'future';
    if (daily.totalDays > 0) {
        const rainyShare = spanDays ? Math.min((daily.totalDays / spanDays) * 100, 100) : null;
        const dryDays = spanDays ? Math.max(spanDays - daily.totalDays, 0) : null;
        const avgRainyDay = daily.totalDays ? daily.totalRain / daily.totalDays : null;
        const avgWholeSpan = spanDays ? daily.totalRain / spanDays : null;
        const rainSentence = daily.totalRain > 0
            ? `Entre ${rangeText} ${isFuture ? 'se proyectan' : 'se acumularon'} ${formatNumber(daily.totalRain)} mm repartidos en ${daily.totalDays} dÃ­as con registro.`
            : `Entre ${rangeText} ${isFuture ? 'no se proyecta' : 'no se registrÃ³'} lluvia medible.`;
        const maxSentence = daily.maxRainDate && daily.maxRain > 0
            ? `El dÃ­a mÃ¡s lluvioso ${isFuture ? 'proyectado serÃ­a' : 'fue'} ${formatDate(daily.maxRainDate)} con ${formatNumber(daily.maxRain)} mm.`
            : '';
        const lastSentence = daily.lastRainDate && daily.lastRainValue != null
            ? `El Ãºltimo dÃ­a con lluvia ${isFuture ? 'proyectada serÃ­a' : 'fue'} ${formatDate(daily.lastRainDate)}, con ${formatNumber(daily.lastRainValue)} mm.`
            : '';
        const coverageSentence = rainyShare != null && spanDays
            ? `Hubo lluvia en ${daily.totalDays} de ${spanDays} dÃ­as (${rainyShare.toFixed(0)} % del periodo) y ${dryDays ?? 0} se mantuvieron secos.`
            : '';
        const averagesSentence = avgRainyDay
            ? `Cuando lloviÃ³, promediÃ³ ${formatNumber(avgRainyDay)} mm por dÃ­a${avgWholeSpan ? ` (${formatNumber(avgWholeSpan)} mm diarios sobre toda la ventana).` : '.'}`
            : '';
        const drySentence = daily.longestDry
            ? `La racha seca mÃ¡s larga ${isFuture ? 'proyectada serÃ­a' : 'durÃ³'} ${daily.longestDry.length} dÃ­as entre ${formatDate(daily.longestDry.from)} y ${formatDate(daily.longestDry.to)}.`
            : '';
        insights.push({
            id: 'daily-summary',
            kind: 'trend',
            text: `${rainSentence} ${maxSentence} ${lastSentence} ${coverageSentence} ${averagesSentence} ${drySentence}`.trim(),
            data: { daily },
        });
    }
    if (daily.longestDry?.length && daily.longestDry.length >= (thresholds?.drySpellDays ?? 5)) {
        const dry = daily.longestDry;
        insights.push({
            id: 'dry-spell',
            kind: 'advice',
            text: `${isFuture ? 'Se proyecta' : 'Se presentÃ³'} una sequÃ­a de ${dry.length} dÃ­as entre ${formatDate(dry.from)} y ${formatDate(dry.to)}. Considera riego suplementario o proteger los cultivos sensibles.`,
            data: dry,
        });
    }
    const peaks = peaksIntensity(hourly, thresholds?.intensityMmHr ?? 6);
    if (peaks.length) {
        const threshold = thresholds?.intensityMmHr ?? 6;
        const highest = peaks.reduce((max, peak) => (peak.value > max.value ? peak : max), peaks[0]);
        const uniquePeakDays = Array.from(new Set(peaks.map((peak) => peak.from?.slice(0, 10) ?? '')));
        const earliestPeak = peaks[0];
        const latestPeak = peaks[peaks.length - 1];
        const distributionSentence = uniquePeakDays.length > 1
            ? `Impactaron ${uniquePeakDays.length} dÃ­as distintos entre ${formatDate(earliestPeak.from)} y ${formatDate(latestPeak.from)}.`
            : `Se concentraron el ${formatDate(earliestPeak.from)}, seÃ±al de un evento puntual.`;
        insights.push({
            id: 'intensity-peaks',
            kind: 'event',
            text: `${isFuture ? 'Se proyectan' : 'Se detectaron'} ${peaks.length} episodios con intensidades superiores a ${threshold.toFixed(1)} mm/h. El mÃ¡s intenso ${isFuture ? 'alcanzarÃ­a' : 'alcanzÃ³'} ${formatNumber(highest.value)} mm/h el ${formatDate(highest.from)}. ${distributionSentence} Programa labores crÃ­ticas fuera de esas ventanas para evitar daÃ±os por escorrentÃ­a.`,
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
            text: `Para manana se proyecta un THI maximo de ${maxThi.toFixed(1)} (${band}). Ajusta ventilacion, sombra o hidratacion si observas estres termico.`,
            data: { maxThi, band, points: thiCandidates },
        });
    }
    const rootMoist = averageField(hourly, 'soilMoist9', 48);
    if (rootMoist != null) {
        if (rootMoist < 0.18) {
            insights.push({
                id: 'root-moisture-low',
                kind: 'advice',
                text: `El perfil 10-30 cm ${isFuture ? 'mostrarÃ­a' : 'mostrÃ³'} humedad baja (${(rootMoist * 100).toFixed(0)}%). Planea riego o rota el ganado para proteger las pasturas.`,
            });
        }
        else if (rootMoist > 0.45) {
            insights.push({
                id: 'root-moisture-high',
                kind: 'advice',
                text: `Suelo muy hÃºmedo (${(rootMoist * 100).toFixed(0)}%) ${isFuture ? 'podrÃ­a' : 'pudo'} compactar cultivos con maquinaria pesada.`,
            });
        }
    }
    const evapDemand = sumField(hourly, 'evap', 24);
    if (evapDemand != null && evapDemand > 5) {
        insights.push({
            id: 'et0-demand',
            kind: 'advice',
            text: `La ET0 ${isFuture ? 'alcanzarÃ­a' : 'alcanzÃ³'} ${evapDemand.toFixed(1)} mm en 24 h. Refuerza hidrataciÃ³n animal o riego.`,
        });
    }
    const solarAvg = averageField(hourly, 'rs', 24);
    if (solarAvg != null && solarAvg > 650) {
        insights.push({
            id: 'solar-window',
            kind: 'event',
            text: `${isFuture ? 'Se proyecta' : 'Hubo'} alta radiaciÃ³n solar: condiciones favorables para secado de forrajes y generaciÃ³n fotovoltaica.`,
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
function computeRangeSpanDays(series) {
    const from = series.range?.from;
    const to = series.range?.to;
    if (!from || !to)
        return null;
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
        return null;
    const diff = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
    return diff > 0 ? diff : null;
}
function inferTemporalMode(series) {
    const to = Date.parse(series.range?.to ?? '');
    if (Number.isFinite(to)) {
        const now = Date.now();
        if (to - now > 12 * 60 * 60 * 1000)
            return 'future';
    }
    return 'past';
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
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
function sliceRecent(hourly, hours) {
    if (!hourly.length)
        return [];
    const last = new Date(hourly[hourly.length - 1].t ?? 0).getTime();
    const threshold = last - hours * MS_PER_HOUR;
    return hourly.filter((point) => {
        const t = new Date(point.t ?? 0).getTime();
        return Number.isFinite(t) && t >= threshold;
    });
}
function averageField(hourly, key, hours) {
    const slice = sliceRecent(hourly, hours);
    const values = slice
        .map((point) => (typeof point[key] === 'number' ? point[key] : null))
        .filter((value) => value !== null);
    if (!values.length)
        return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function sumField(hourly, key, hours) {
    const slice = sliceRecent(hourly, hours);
    const values = slice
        .map((point) => (typeof point[key] === 'number' ? point[key] : null))
        .filter((value) => value !== null);
    if (!values.length)
        return null;
    return values.reduce((sum, value) => sum + value, 0);
}
//# sourceMappingURL=generate.js.map
