import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip as ChartTooltip } from 'chart.js';
import { MiniMap } from './MiniMap';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip);
const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE_TIPS = [
    {
        title: 'Último dato + Hace X min',
        body: 'Muestra la latencia real del sensor. Si supera los 30 minutos, valida la conectividad antes de tomar decisiones críticas.',
    },
    {
        title: 'Lluvia horaria vs. Intensidad',
        body: 'El primer valor refleja el acumulado de la última hora y el segundo el pico puntual (mm/h). Picos altos con poco acumulado implican ráfagas cortas.',
    },
    {
        title: 'Pronóstico 24 h',
        body: 'Resume el máximo esperado para la siguiente jornada. Si el pico proyectado supera tu umbral operativo, reprograma labores o incrementa el monitoreo.',
    },
    {
        title: 'Variables ambientales',
        body: 'Temperatura, humedad, viento y presión ayudan a anticipar estrés térmico, ventanas de asperjado o cambios de frente. Contrasta estos valores con los promedios históricos.',
    },
    {
        title: 'Viento y presión',
        body: 'Viento menor a 3 m/s es ideal para aspersiones; por encima de 9 m/s suele causar deriva. Presiones cercanas a 1000 hPa indican estabilidad, mientras caídas rápidas anticipan sistemas de lluvia.',
    },
];
const DEFAULT_THRESHOLDS = {
    intensity: 8,
    latency: 60,
};
function loadThresholds() {
    if (typeof window === 'undefined')
        return DEFAULT_THRESHOLDS;
    try {
        const raw = window.localStorage.getItem('realtime-thresholds');
        if (!raw)
            return DEFAULT_THRESHOLDS;
        const parsed = JSON.parse(raw);
        return {
            intensity: typeof parsed.intensity === 'number' && Number.isFinite(parsed.intensity)
                ? parsed.intensity
                : DEFAULT_THRESHOLDS.intensity,
            latency: typeof parsed.latency === 'number' && Number.isFinite(parsed.latency)
                ? parsed.latency
                : DEFAULT_THRESHOLDS.latency,
        };
    }
    catch {
        return DEFAULT_THRESHOLDS;
    }
}
export function RealtimePanel({ series, busy }) {
    const snapshot = useMemo(() => buildSnapshot(series), [series]);
    const sparkline = useMemo(() => buildSparkline(series), [series]);
    const [userThresholds, setUserThresholds] = useState(() => loadThresholds());
    const [guideOpen, setGuideOpen] = useState(true);
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('realtime-thresholds', JSON.stringify(userThresholds));
        }
    }, [userThresholds]);
    const handleThresholdChange = (key, rawValue) => {
        if (Number.isNaN(rawValue))
            return;
        setUserThresholds((prev) => {
            const next = { ...prev };
            next[key] =
                key === 'latency'
                    ? Math.max(10, Math.round(rawValue))
                    : Math.max(0, Number(rawValue.toFixed(1)));
            return next;
        });
    };
    const alerts = useMemo(() => buildRealtimeAlerts(snapshot?.latest, userThresholds), [snapshot, userThresholds]);
    const latencyStatus = snapshot ? getLatencyStatus(snapshot.latencyMinutes, userThresholds.latency) : 'calm';
    const latencyPercent = snapshot
        ? Math.min((snapshot.latencyMinutes ?? 0) / Math.max(userThresholds.latency, 1), 1) * 100
        : 0;
    const timeline = useMemo(() => buildTimelineEvents(series, sparkline, snapshot, userThresholds), [series, sparkline, snapshot, userThresholds]);
    const sparklineChart = useMemo(() => {
        if (!sparkline)
            return null;
        return {
            data: {
                labels: sparkline.labels,
                datasets: [
                    {
                        data: sparkline.values,
                        borderColor: '#60a5fa',
                        backgroundColor: 'rgba(96, 165, 250, 0.15)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.35,
                        fill: true,
                        yAxisID: 'y',
                    },
                    {
                        data: sparkline.accumulated,
                        borderColor: '#22d3ee',
                        borderDash: [6, 4],
                        borderWidth: 1.5,
                        pointRadius: 0,
                        fill: false,
                        yAxisID: 'y2',
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { intersect: false, mode: 'index' } },
                scales: {
                    x: { display: false },
                    y: {
                        display: false,
                        beginAtZero: true,
                        suggestedMax: Math.max(sparkline.peak * 1.2, 1),
                    },
                    y2: {
                        type: 'linear',
                        display: false,
                        beginAtZero: true,
                        position: 'right',
                    },
                },
                elements: { point: { radius: 0 } },
            },
        };
    }, [sparkline]);
    return (_jsxs("section", { className: "card realtime-card mb4", children: [_jsxs("div", { className: "section-header", children: [_jsxs("div", { children: [_jsx("h2", { children: "Monitoreo en vivo" }), _jsx("p", { className: "muted tiny", children: snapshot ? `Último dato: ${snapshot.lastDisplay}` : 'Sin observaciones en el rango actual.' })] }), snapshot && (_jsx("span", { className: `status-pill ${latencyStatus === 'alert' ? 'alert' : latencyStatus === 'warn' ? 'warn' : ''}`, children: snapshot.relativeLabel }))] }), _jsxs("div", { className: "threshold-controls", children: [_jsxs("label", { children: [_jsx("span", { children: "Intensidad cr\u00EDtica (mm/h)" }), _jsx("input", { type: "number", min: 0, step: 0.5, value: userThresholds.intensity, onChange: (event) => handleThresholdChange('intensity', Number(event.target.value)) })] }), _jsxs("label", { children: [_jsx("span", { children: "Latencia m\u00E1xima (min)" }), _jsx("input", { type: "number", min: 10, step: 5, value: userThresholds.latency, onChange: (event) => handleThresholdChange('latency', Number(event.target.value)) })] })] }), busy && !snapshot ? (_jsxs("div", { className: "skeleton", children: [_jsx("div", { className: "skeleton-bar" }), _jsx("div", { className: "skeleton-bar" }), _jsx("div", { className: "skeleton-bar" })] })) : snapshot ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "realtime-meta", children: [_jsxs("div", { children: [_jsx("span", { className: "tiny", children: "Ubicaci\u00F3n" }), _jsx("strong", { children: snapshot.locationLabel }), _jsx("p", { className: "muted tiny", children: snapshot.sourceLabel ?? 'Fuente no disponible' })] }), _jsxs("div", { children: [_jsx("span", { className: "tiny", children: "Zona horaria" }), _jsx("strong", { children: snapshot.timezone ?? 'Sin dato' }), _jsx("p", { className: "muted tiny", children: "Hora local mostrada en la serie" })] }), _jsxs("div", { children: [_jsx("span", { className: "tiny", children: "Pron\u00F3stico 24h" }), _jsxs("strong", { children: [formatNumber(snapshot.forecastTotal, 1), " mm"] }), _jsx("p", { className: "muted tiny", children: snapshot.hasForecast
                                            ? `Intensidad pico esperada: ${formatNumber(snapshot.forecastPeak, 1)} mm/h`
                                            : 'Sin proyección disponible' })] })] }), _jsx(MiniMap, { lat: series?.meta?.lat, lon: series?.meta?.lon, status: latencyStatus, label: snapshot.locationLabel }), _jsx("div", { className: "realtime-metrics", children: snapshot.metrics.map((metric) => (_jsxs("div", { className: "realtime-metric", children: [_jsx("span", { className: "metric-label", children: metric.label }), _jsx("span", { className: "metric-value", children: metric.value }), metric.note && _jsx("span", { className: "metric-note", children: metric.note })] }, metric.id))) }), alerts.length > 0 && (_jsx("div", { className: "status-chips", children: alerts.map((alert) => (_jsxs("div", { className: `status-chip ${alert.tone}`, children: [_jsx("span", { className: "chip-title", children: alert.label }), _jsx("p", { children: alert.message })] }, alert.id))) })), _jsxs("div", { className: `latency-bar ${latencyStatus}`, children: [_jsxs("span", { className: "tiny", children: ["Latencia relativa (", _jsx("strong", { children: snapshot.relativeLabel }), ")"] }), _jsx("div", { className: "latency-track", children: _jsx("div", { className: "latency-fill", style: { width: `${latencyPercent}%` } }) }), _jsxs("p", { className: "muted tiny", children: ["0 min = actualizado \u00B7 ", userThresholds.latency, " min = umbral cr\u00EDtico"] })] }), sparkline && sparklineChart && (_jsxs("div", { className: "realtime-sparkline", children: [_jsxs("div", { className: "sparkline-meta", children: [_jsx("span", { className: "tiny", children: "Intensidad \u00FAltimas 24 h" }), _jsx("strong", { children: formatNumber(sparkline.latest, 1, 'mm/h') }), _jsxs("p", { className: "muted tiny", children: ["Pico reciente: ", formatNumber(sparkline.peak, 1, 'mm/h'), " \u00B7 ", sparkline.latestLabel] })] }), _jsxs("div", { className: "sparkline-chart", children: [_jsx(Line, { data: sparklineChart.data, options: sparklineChart.options, height: 60 }), _jsx("p", { className: "muted tiny sparkline-legend", children: "S\u00F3lido: intensidad \u00B7 Punteado: acumulado." })] })] })), timeline.length > 0 && (_jsxs("div", { className: "realtime-timeline", children: [_jsx("h4", { children: "Eventos recientes" }), _jsx("ul", { children: timeline.map((event) => (_jsxs("li", { children: [_jsx("span", { className: "timeline-time", children: event.time }), _jsxs("div", { children: [_jsx("strong", { children: event.label }), _jsx("p", { children: event.detail })] })] }, event.id))) })] }))] })) : (_jsx("div", { className: "empty-state", children: "Ajusta el rango o la ubicaci\u00F3n para ver datos en vivo." })), snapshot && (_jsxs("div", { className: "realtime-guide mt3", children: [_jsxs("div", { className: "help-header", children: [_jsx("strong", { children: "C\u00F3mo leer el monitoreo en vivo" }), _jsx("button", { type: "button", className: "btn small", onClick: () => setGuideOpen((prev) => !prev), children: guideOpen ? 'Ocultar guía' : 'Mostrar guía' })] }), guideOpen && (_jsx("ul", { className: "help-steps", children: LIVE_TIPS.map((tip) => (_jsxs("li", { children: [_jsxs("strong", { children: [tip.title, ":"] }), " ", tip.body] }, tip.title))) }))] }))] }));
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
        latencyMinutes: relative.minutes,
        metrics: buildMetrics(latest),
        forecastTotal: forecast.total,
        forecastPeak: forecast.peak,
        hasForecast: forecast.count > 0,
        latest: {
            rain: typeof latest.prcp === 'number' ? latest.prcp : undefined,
            intensity: typeof latest.prcpRate === 'number' ? latest.prcpRate : undefined,
            temp: typeof latest.temp === 'number' ? latest.temp : typeof latest.apparentTemp === 'number' ? latest.apparentTemp : undefined,
            humidity: typeof latest.rh === 'number' ? latest.rh : undefined,
            wind: typeof latest.wind === 'number' ? latest.wind : undefined,
            pressure: typeof latest.pressure === 'number' ? latest.pressure : undefined,
        },
    };
}
function buildSparkline(series) {
    if (!series || !Array.isArray(series.hourly) || !series.hourly.length) {
        return null;
    }
    const now = Date.now();
    const start = now - DAY_MS;
    const candidates = series.hourly
        .filter((point) => typeof point?.t === 'string')
        .map((point) => ({
        iso: point.t,
        value: typeof point.prcpRate === 'number' ? Number(point.prcpRate.toFixed(2)) : 0,
        rain: typeof point.prcp === 'number' ? Number(point.prcp.toFixed(2)) : 0,
    }))
        .filter((point) => {
        const stamp = Date.parse(point.iso);
        return Number.isFinite(stamp) && stamp >= start && stamp <= now;
    })
        .sort((a, b) => a.iso.localeCompare(b.iso));
    if (!candidates.length)
        return null;
    const windowed = candidates.slice(-24);
    const values = windowed.map((point) => point.value);
    const accumulated = [];
    let running = 0;
    windowed.forEach((point) => {
        running += point.rain;
        accumulated.push(Number(running.toFixed(2)));
    });
    const peak = values.reduce((max, value) => (value > max ? value : max), 0);
    const latest = values[values.length - 1] ?? 0;
    return {
        labels: windowed.map((point) => formatSparklineLabel(point.iso)),
        values,
        peak,
        latest,
        latestLabel: formatSparklineLabel(windowed[windowed.length - 1]?.iso),
        accumulated,
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
        return { label: 'Fecha desconocida', isStale: true, minutes: 999 };
    }
    if (timestamp > now) {
        const minutesAhead = Math.round((timestamp - now) / 60000);
        return { label: `Próximo dato en ${minutesAhead} min`, isStale: false, minutes: 0 };
    }
    const minutesDiff = Math.max(0, Math.round((now - timestamp) / 60000));
    if (minutesDiff < 1)
        return { label: 'Actualizado hace instantes', isStale: false, minutes: minutesDiff };
    if (minutesDiff < 60)
        return { label: `Hace ${minutesDiff} min`, isStale: false, minutes: minutesDiff };
    const hours = minutesDiff / 60;
    return { label: `Hace ${hours.toFixed(1)} h`, isStale: minutesDiff > 180, minutes: minutesDiff };
}
function formatSparklineLabel(iso) {
    if (!iso)
        return 'sin fecha';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return iso.slice(0, 10);
    return date.toLocaleString('es-CO', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
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
function getLatencyStatus(minutes, threshold) {
    if (minutes == null)
        return 'calm';
    if (minutes >= threshold * 1.5)
        return 'alert';
    if (minutes >= threshold)
        return 'warn';
    return 'calm';
}
function buildRealtimeAlerts(latest, thresholds) {
    if (!latest)
        return [];
    const alerts = [];
    if (latest.rain != null && latest.rain >= 3) {
        alerts.push({
            id: 'rain',
            label: latest.rain >= 10 ? 'Lluvia fuerte' : 'Lluvia útil',
            tone: latest.rain >= 10 ? 'alert' : 'warn',
            message: latest.rain >= 10
                ? 'Considera pausar la entrada de maquinaria hasta que drene el lote.'
                : 'Humedece el suelo; verifica escorrentía en zonas bajas.',
        });
    }
    const intensityThreshold = thresholds?.intensity ?? DEFAULT_THRESHOLDS.intensity;
    if (latest.intensity != null && latest.intensity >= intensityThreshold) {
        alerts.push({
            id: 'intensity',
            label: 'Pico de intensidad',
            tone: 'alert',
            message: `Intensidad >${intensityThreshold.toFixed(1)} mm/h; evita labores de aspersión o riego superficial.`,
        });
    }
    if (latest.temp != null) {
        if (latest.temp >= 32) {
            alerts.push({
                id: 'heat',
                label: 'Calor elevado',
                tone: 'warn',
                message: 'Prioriza sombra e hidratación para personal y ganado.',
            });
        }
        else if (latest.temp <= 16) {
            alerts.push({
                id: 'cool',
                label: 'Mañana fría',
                tone: 'calm',
                message: 'Protege viveros y planifica riegos más tarde para evitar shock térmico.',
            });
        }
    }
    if (latest.humidity != null) {
        if (latest.humidity >= 85) {
            alerts.push({
                id: 'humidity-high',
                label: 'Humedad alta',
                tone: 'warn',
                message: 'Favorece hongos; ventila invernaderos y monitorea cultivos sensibles.',
            });
        }
        else if (latest.humidity <= 40) {
            alerts.push({
                id: 'humidity-low',
                label: 'Ambiente seco',
                tone: 'warn',
                message: 'Incrementa la demanda hídrica y la presencia de polvo.',
            });
        }
    }
    if (latest.wind != null && latest.wind >= 9) {
        alerts.push({
            id: 'wind',
            label: 'Viento fuerte',
            tone: 'alert',
            message: 'Revisa estructuras ligeras y posterga aspersiones para evitar deriva.',
        });
    }
    return alerts.slice(0, 3);
}
function buildTimelineEvents(series, sparkline, snapshot, thresholds) {
    const events = [];
    const now = Date.now();
    if (series?.hourly?.length) {
        const windowStart = now - DAY_MS;
        const ordered = series.hourly
            .filter((point) => point.t)
            .map((point) => ({ point, stamp: Date.parse(point.t ?? '') }))
            .filter(({ stamp }) => Number.isFinite(stamp) && stamp >= windowStart && stamp <= now)
            .sort((a, b) => (a.stamp ?? 0) - (b.stamp ?? 0));
        const intensityEvents = ordered.filter(({ point }) => typeof point.prcpRate === 'number' && point.prcpRate >= thresholds.intensity);
        intensityEvents.slice(-3).forEach(({ point }) => {
            events.push({
                id: `int-${point.t}`,
                time: formatTimelineTime(point.t),
                label: 'Pico de intensidad',
                detail: `${formatNumber(point.prcpRate)} mm/h`,
            });
        });
        let dryStart = null;
        let dryCount = 0;
        ordered.forEach(({ point }) => {
            const rate = typeof point.prcpRate === 'number' ? point.prcpRate : 0;
            if (rate < 0.2) {
                if (!dryCount)
                    dryStart = point.t ?? null;
                dryCount += 1;
            }
            else if (dryCount >= 3 && dryStart) {
                events.push({
                    id: `dry-${dryStart}`,
                    time: formatTimelineTime(dryStart),
                    label: 'Ventana seca detectada',
                    detail: `${dryCount} h por debajo de 0.2 mm/h`,
                });
                dryStart = null;
                dryCount = 0;
            }
            else {
                dryCount = 0;
                dryStart = null;
            }
        });
    }
    if (sparkline?.accumulated.length) {
        const total = sparkline.accumulated[sparkline.accumulated.length - 1] ?? 0;
        events.push({
            id: 'accum',
            time: sparkline.latestLabel,
            label: 'Acumulado 24 h',
            detail: `${formatNumber(total, 1, 'mm')} registrados en las últimas 24 h.`,
        });
    }
    if (snapshot?.hasForecast && snapshot.forecastPeak >= thresholds.intensity) {
        events.push({
            id: 'forecast',
            time: 'Próximas horas',
            label: 'Pico proyectado',
            detail: `Se esperan ${formatNumber(snapshot.forecastPeak, 1, 'mm/h')} en las próximas 24 h.`,
        });
    }
    return events.slice(-5).reverse();
}
function formatTimelineTime(iso) {
    if (!iso)
        return 'sin fecha';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return iso;
    return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}
//# sourceMappingURL=RealtimePanel.js.map