import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment, useMemo } from 'react';
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
    if (Number.isNaN(date.getTime())) {
        return { label: day, tooltip: day };
    }
    const shortLabel = date
        .toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
        .replace('.', '');
    const longLabel = date.toLocaleDateString('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
    return { label: shortLabel, tooltip: longLabel };
}
function buildColumns(series, variable) {
    const hourly = series?.hourly ?? [];
    if (!hourly.length)
        return { columns: [], max: 0 };
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
    const columns = Array.from(buckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, values]) => {
        const { label, tooltip } = formatDayLabel(date);
        return {
            date,
            label,
            tooltip,
            values: HOURS.map((hour) => {
                const value = values[hour];
                return {
                    value,
                    hour,
                    normalized: max > 0 && typeof value === 'number' ? Math.min(value / max, 1) : 0,
                };
            }),
        };
    });
    return { columns, max };
}
export function HourlyHeatmap({ series, variable = 'prcp', maxColumns = 10 }) {
    const { columns, max } = useMemo(() => buildColumns(series, variable), [series, variable]);
    if (!columns.length) {
        return _jsx("div", { className: "empty-state", children: "Sin datos suficientes para generar el mapa de calor." });
    }
    const chunkSize = Math.max(1, maxColumns);
    const columnChunks = [];
    for (let index = 0; index < columns.length; index += chunkSize) {
        columnChunks.push(columns.slice(index, index + chunkSize));
    }
    return (_jsxs("div", { className: "heatmap", children: [_jsxs("div", { className: "heatmap-headline", children: [_jsx("h3", { children: "Mapa de calor horario" }), _jsxs("p", { children: ["Intensidad relativa por hora. Pico maximo observado: ", _jsx("strong", { children: max.toFixed(2) }), ' ', variable === 'prcpRate' ? 'mm/h' : 'mm', "."] })] }), _jsx("div", { className: "heatmap-scroll", children: _jsx("div", { className: "heatmap-stacks", children: columnChunks.map((chunk, chunkIndex) => {
                        const gridTemplateColumns = `80px repeat(${chunk.length}, minmax(36px, 1fr))`;
                        return (_jsxs("div", { className: "heatmap-matrix", style: { gridTemplateColumns }, children: [_jsx("span", { className: "heatmap-corner", children: "Hora" }), chunk.map((column) => (_jsx("span", { className: "heatmap-date", title: column.tooltip, children: column.label }, column.date))), HOURS.map((hour) => (_jsxs(Fragment, { children: [_jsxs("span", { className: "heatmap-hour-label", children: [hour.toString().padStart(2, '0'), "h"] }), chunk.map((column) => {
                                            const item = column.values[hour];
                                            const background = item.value === null
                                                ? 'rgba(148, 163, 184, 0.12)'
                                                : getHeatColor(item.normalized);
                                            return (_jsx("span", { className: "heatmap-cell", style: { backgroundColor: background }, title: `${column.tooltip} ${hour.toString().padStart(2, '0')}:00 -> ${item.value !== null
                                                    ? `${item.value.toFixed(2)} ${variable === 'prcpRate' ? 'mm/h' : 'mm'}`
                                                    : 'sin dato'}` }, `${column.date}-${hour}`));
                                        })] }, `${chunkIndex}-${hour}`)))] }, `chunk-${chunkIndex}`));
                    }) }) }), _jsxs("div", { className: "heatmap-meta", children: [_jsxs("span", { children: ["Mostrando bloques de ", Math.min(chunkSize, columns.length), " fechas (total ", columns.length, ")"] }), _jsx("span", { children: "Despl\u00E1zate para ver las dem\u00E1s." })] }), _jsxs("div", { className: "heatmap-scale", children: [_jsx("span", { children: "Seco" }), _jsx("div", { className: "heatmap-scale-bar" }), _jsx("span", { children: "Max" })] })] }));
}
//# sourceMappingURL=HourlyHeatmap.js.map