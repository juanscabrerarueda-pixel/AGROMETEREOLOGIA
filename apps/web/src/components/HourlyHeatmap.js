import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
const HOURS = Array.from({ length: 24 }, (_, index) => index);
function formatDayLabel(day) {
    const date = new Date(`${day}T00:00:00Z`);
    if (Number.isNaN(date.getTime()))
        return day;
    return date.toLocaleDateString('es-CO', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
}
function buildMatrix(series, variable) {
    const hourly = series?.hourly ?? [];
    if (!hourly.length)
        return { rows: [], max: 0 };
    const buckets = new Map();
    let max = 0;
    for (const point of hourly) {
        const iso = point.t;
        if (!iso)
            continue;
        const dayKey = iso.slice(0, 10);
        const hour = Number(iso.slice(11, 13));
        if (Number.isNaN(hour))
            continue;
        if (!buckets.has(dayKey)) {
            buckets.set(dayKey, Array.from({ length: 24 }, () => null));
        }
        const bucket = buckets.get(dayKey);
        const raw = point[variable];
        if (typeof raw === 'number') {
            const safe = Number(raw.toFixed(3));
            bucket[hour] = safe;
            if (safe > max) {
                max = safe;
            }
        }
    }
    const rows = Array.from(buckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, values]) => ({
        date,
        display: formatDayLabel(date),
        values: values.map((value, hour) => ({
            value,
            hour,
            normalized: max > 0 && typeof value === 'number' ? Math.min(value / max, 1) : 0,
        })),
    }));
    return { rows, max };
}
export function HourlyHeatmap({ series, variable = 'prcp' }) {
    const { rows, max } = useMemo(() => buildMatrix(series, variable), [series, variable]);
    if (!rows.length) {
        return _jsx("div", { className: "empty-state", children: "Sin datos suficientes para generar el mapa de calor." });
    }
    return (_jsxs("div", { className: "heatmap", children: [_jsxs("div", { className: "heatmap-headline", children: [_jsx("h3", { children: "Mapa de calor horario" }), _jsxs("p", { children: ["Intensidad relativa por hora. Pico maximo observado: ", _jsx("strong", { children: max.toFixed(2) }), ' ', variable === 'prcpRate' ? 'mm/h' : 'mm', "."] })] }), _jsxs("div", { className: "heatmap-grid", children: [_jsxs("div", { className: "heatmap-hours", children: [_jsx("span", { className: "heatmap-hours-label", children: "Hora" }), HOURS.map((hour) => (_jsx("span", { className: "heatmap-hour", children: hour.toString().padStart(2, '0') }, hour)))] }), rows.map((row) => (_jsxs("div", { className: "heatmap-row", children: [_jsx("span", { className: "heatmap-day", children: row.display }), _jsx("div", { className: "heatmap-cells", children: row.values.map((item) => {
                                    const background = item.value === null
                                        ? 'rgba(148, 163, 184, 0.12)'
                                        : `rgba(56, 189, 248, ${(0.15 + item.normalized * 0.75).toFixed(3)})`;
                                    return (_jsx("span", { className: "heatmap-cell", style: { backgroundColor: background }, title: `${row.date} ${item.hour.toString().padStart(2, '0')}:00 -> ${item.value !== null
                                            ? `${item.value.toFixed(2)} ${variable === 'prcpRate' ? 'mm/h' : 'mm'}`
                                            : 'sin dato'}` }, item.hour));
                                }) })] }, row.date)))] }), _jsxs("div", { className: "heatmap-scale", children: [_jsx("span", { children: "Seco" }), _jsx("div", { className: "heatmap-scale-bar" }), _jsx("span", { children: "Max" })] })] }));
}
//# sourceMappingURL=HourlyHeatmap.js.map