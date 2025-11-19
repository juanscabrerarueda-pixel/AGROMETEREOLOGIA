import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo } from 'react';
const DAY_MS = 24 * 60 * 60 * 1000;
export function RealtimePanel({ series, busy }) {
    const snapshot = useMemo(() => buildSnapshot(series), [series]);
    return (_jsxs("section", { className: "card realtime-card mb4", children: [_jsxs("div", { className: "section-header", children: [_jsxs("div", { children: [_jsx("h2", { children: "Monitoreo en vivo" }), _jsx("p", { className: "muted tiny", children: snapshot ? `Último dato: ${snapshot.lastDisplay}` : 'Sin observaciones en el rango actual.' })] }), snapshot && (_jsx("span", { className: `status-pill ${snapshot.isStale ? 'warn' : ''}`, children: snapshot.relativeLabel }))] }), busy && !snapshot ? (_jsxs("div", { className: "skeleton", children: [_jsx("div", { className: "skeleton-bar" }), _jsx("div", { className: "skeleton-bar" }), _jsx("div", { className: "skeleton-bar" })] })) : snapshot ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "realtime-meta", children: [_jsxs("div", { children: [_jsx("span", { className: "tiny", children: "Ubicaci\u00F3n" }), _jsx("strong", { children: snapshot.locationLabel }), _jsx("p", { className: "muted tiny", children: snapshot.sourceLabel ?? 'Fuente no disponible' })] }), _jsxs("div", { children: [_jsx("span", { className: "tiny", children: "Zona horaria" }), _jsx("strong", { children: snapshot.timezone ?? 'Sin dato' }), _jsx("p", { className: "muted tiny", children: "Hora local mostrada en la serie" })] }), _jsxs("div", { children: [_jsx("span", { className: "tiny", children: "Pron\u00F3stico 24h" }), _jsxs("strong", { children: [formatNumber(snapshot.forecastTotal, 1), " mm"] }), _jsx("p", { className: "muted tiny", children: snapshot.hasForecast
                                            ? `Intensidad pico esperada: ${formatNumber(snapshot.forecastPeak, 1)} mm/h`
                                            : 'Sin proyección disponible' })] })] }), _jsx("div", { className: "realtime-metrics", children: snapshot.metrics.map((metric) => (_jsxs("div", { className: "realtime-metric", children: [_jsx("span", { className: "metric-label", children: metric.label }), _jsx("span", { className: "metric-value", children: metric.value }), metric.note && _jsx("span", { className: "metric-note", children: metric.note })] }, metric.id))) })] })) : (_jsx("div", { className: "empty-state", children: "Ajusta el rango o la ubicaci\u00F3n para ver datos en vivo." }))] }));
}
function buildSnapshot(series) {
    if (!series || !Array.isArray(series.hourly) || !series.hourly.length) {
        return null;
    }
    const hourly = series.hourly.filter((point) => typeof point?.t === 'string');
    if (!hourly.length)
        return null;
    const sorted = [...hourly].sort((a, b) => (a.t ?? '').localeCompare(b.t ?? ''));
    const now = Date.now();
    const parseTime = (value) => {
        if (!value)
            return Number.NaN;
        const ms = Date.parse(value);
        return Number.isFinite(ms) ? ms : Number.NaN;
    };
    let latest = sorted[sorted.length - 1];
    for (let i = sorted.length - 1; i >= 0; i--) {
        const ts = parseTime(sorted[i].t);
        if (Number.isFinite(ts) && ts <= now) {
            latest = sorted[i];
            break;
        }
    }
    const lastStamp = parseTime(latest.t);
    const relative = formatRelativeLabel(lastStamp, now);
    const forecast = computeForecast(sorted, now);
    return {
        locationLabel: formatLocation(series),
        sourceLabel: series.meta?.source,
        timezone: series.meta?.tz,
        lastDisplay: formatDateTime(lastStamp, series.meta?.tz),
        relativeLabel: relative.label,
        isStale: relative.isStale,
        metrics: buildMetrics(latest),
        forecastTotal: forecast.total,
        forecastPeak: forecast.peak,
        hasForecast: forecast.count > 0,
    };
}
function formatLocation(series) {
    const parts = [series.key?.depto, series.key?.muni].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Ubicación no definida';
}
function buildMetrics(point) {
    const metrics = [];
    metrics.push({
        id: 'rain',
        label: 'Lluvia horaria',
        value: formatNumber(point.prcp, 2, 'mm'),
        note: 'Último acumulado registrado',
    });
    metrics.push({
        id: 'intensity',
        label: 'Intensidad',
        value: formatNumber(point.prcpRate, 2, 'mm/h'),
        note: 'Pico horario',
    });
    metrics.push({
        id: 'temp',
        label: 'Temperatura',
        value: formatNumber(point.temp, 1, 'C'),
    });
    metrics.push({
        id: 'humidity',
        label: 'Humedad',
        value: formatNumber(point.rh, 0, '%'),
    });
    metrics.push({
        id: 'wind',
        label: 'Viento',
        value: formatNumber(point.wind, 1, 'm/s'),
    });
    metrics.push({
        id: 'pressure',
        label: 'Presión',
        value: formatNumber(point.pressure, 1, 'kPa'),
    });
    return metrics;
}
function formatNumber(value, decimals = 1, unit) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return 'Sin dato';
    }
    const formatted = value.toLocaleString('es-CO', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
    return unit ? `${formatted} ${unit}` : formatted;
}
function formatDateTime(timestamp, tz) {
    if (!Number.isFinite(timestamp))
        return 'Sin fecha';
    try {
        return new Intl.DateTimeFormat('es-CO', {
            timeZone: tz ?? 'UTC',
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: 'short',
        }).format(new Date(timestamp));
    }
    catch {
        return new Date(timestamp).toISOString();
    }
}
function formatRelativeLabel(timestamp, now) {
    if (!Number.isFinite(timestamp)) {
        return { label: 'Fecha desconocida', isStale: true };
    }
    if (timestamp > now) {
        const minutesAhead = Math.round((timestamp - now) / 60000);
        return { label: `Proximo dato en ${minutesAhead} min`, isStale: false };
    }
    const minutesDiff = Math.max(0, Math.round((now - timestamp) / 60000));
    if (minutesDiff < 1)
        return { label: 'Actualizado hace instantes', isStale: false };
    if (minutesDiff < 60)
        return { label: `Hace ${minutesDiff} min`, isStale: false };
    const hours = minutesDiff / 60;
    return { label: `Hace ${hours.toFixed(1)} h`, isStale: minutesDiff > 180 };
}
function computeForecast(points, now) {
    const end = now + DAY_MS;
    let total = 0;
    let peak = 0;
    let count = 0;
    for (const point of points) {
        const stamp = point.t ? Date.parse(point.t) : Number.NaN;
        if (!Number.isFinite(stamp) || stamp <= now || stamp > end)
            continue;
        if (typeof point.prcp === 'number') {
            total += point.prcp;
        }
        if (typeof point.prcpRate === 'number' && point.prcpRate > peak) {
            peak = point.prcpRate;
        }
        count += 1;
    }
    return { total, peak, count };
}
//# sourceMappingURL=RealtimePanel.js.map