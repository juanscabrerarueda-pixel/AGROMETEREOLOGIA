import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const HEAT_COLORS = [
    { stop: 0, color: [37, 99, 235] }, // azul
    { stop: 0.5, color: [250, 204, 21] }, // amarillo
    { stop: 1, color: [239, 68, 68] }, // rojo
];
function getHeatColor(value) {
    const clamped = Math.min(Math.max(value, 0), 1);
    const upperIndex = HEAT_COLORS.findIndex((entry) => entry.stop >= clamped);
    if (upperIndex <= 0) {
        const [r, g, b] = HEAT_COLORS[Math.max(upperIndex, 0)].color;
        return `rgba(${r}, ${g}, ${b}, ${0.85})`;
    }
    const lowerIndex = upperIndex - 1;
    const lower = HEAT_COLORS[lowerIndex];
    const upper = HEAT_COLORS[upperIndex];
    const range = upper.stop - lower.stop || 1;
    const t = (clamped - lower.stop) / range;
    const r = Math.round(lower.color[0] + (upper.color[0] - lower.color[0]) * t);
    const g = Math.round(lower.color[1] + (upper.color[1] - lower.color[1]) * t);
    const b = Math.round(lower.color[2] + (upper.color[2] - lower.color[2]) * t);
    return `rgba(${r}, ${g}, ${b}, ${0.92})`;
}
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
export function HourlyHeatmap({ series, variable = 'prcp', maxRows = 35 }) {
    const { rows, max } = useMemo(() => buildMatrix(series, variable), [series, variable]);
    const [expanded, setExpanded] = useState(false);
    if (!rows.length) {
        return _jsx("div", { className: "empty-state", children: "Sin datos suficientes para generar el mapa de calor." });
    }
    const visibleRows = expanded || !maxRows || rows.length <= maxRows
        ? rows
        : rows.slice(Math.max(rows.length - maxRows, 0));
    const canToggle = maxRows && rows.length > maxRows;
    const gridMinWidth = Math.max(visibleRows.length * 32 + 360, 520);
    return (_jsxs("div", { className: "heatmap", children: [_jsxs("div", { className: "heatmap-headline", children: [_jsx("h3", { children: "Mapa de calor horario" }), _jsxs("p", { children: ["Intensidad relativa por hora. Pico maximo observado: ", _jsx("strong", { children: max.toFixed(2) }), ' ', variable === 'prcpRate' ? 'mm/h' : 'mm', "."] })] }), _jsx("div", { className: "heatmap-scroll", children: _jsxs("div", { className: "heatmap-grid", style: { minWidth: `${gridMinWidth}px` }, children: [_jsxs("div", { className: "heatmap-hours", children: [_jsx("span", { className: "heatmap-hours-label", children: "Hora" }), _jsx("div", { className: "heatmap-hours-cells", children: HOURS.map((hour) => (_jsx("span", { className: "heatmap-hour", children: hour.toString().padStart(2, '0') }, hour))) })] }), visibleRows.map((row) => (_jsxs("div", { className: "heatmap-row", children: [_jsx("span", { className: "heatmap-day", children: row.display }), _jsx("div", { className: "heatmap-cells", children: row.values.map((item) => {
                                        const background = item.value === null
                                            ? 'rgba(148, 163, 184, 0.12)'
                                            : getHeatColor(item.normalized);
                                        return (_jsx("span", { className: "heatmap-cell", style: { backgroundColor: background }, title: `${row.date} ${item.hour.toString().padStart(2, '0')}:00 -> ${item.value !== null
                                                ? `${item.value.toFixed(2)} ${variable === 'prcpRate' ? 'mm/h' : 'mm'}`
                                                : 'sin dato'}` }, item.hour));
                                    }) })] }, row.date)))] }) }), _jsxs("div", { className: "heatmap-meta", children: [_jsxs("span", { children: ["Mostrando ", visibleRows.length, " de ", rows.length, " d\u00EDas"] }), canToggle && (_jsx("button", { className: "heatmap-toggle", onClick: () => setExpanded((value) => !value), children: expanded ? 'Mostrar menos' : 'Ver todos' }))] }), _jsxs("div", { className: "heatmap-scale", children: [_jsx("span", { children: "Seco" }), _jsx("div", { className: "heatmap-scale-bar" }), _jsx("span", { children: "Max" })] })] }));
}
//# sourceMappingURL=HourlyHeatmap.js.map