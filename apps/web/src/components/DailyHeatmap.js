import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Fragment, useMemo, useState } from 'react';
const DAY_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const DAILY_HEAT_COLORS = [
    { stop: 0, color: [37, 99, 235] },
    { stop: 0.4, color: [59, 130, 246] },
    { stop: 0.7, color: [250, 204, 21] },
    { stop: 1, color: [239, 68, 68] },
];
export function DailyHeatmap({ daily, metric }) {
    const [mode, setMode] = useState('heatmap');
    const { weeks, weekRanges, max } = useMemo(() => buildMatrix(daily), [daily]);
    if (!weeks.length) {
        return _jsx("div", { className: "empty-state", children: "Sin datos suficientes para generar el mapa de calor." });
    }
    const columns = weeks.length * 7;
    const unit = metric === 'intensity' ? 'mm/h' : 'mm';
    return (_jsxs("div", { className: "daily-heatmap", children: [_jsxs("div", { className: "daily-heatmap-headline", children: [_jsx("h3", { children: "Distribucion diaria" }), _jsxs("p", { children: ["Concentra los dias mas humedos para planear riego, cosecha, disponibilidad de pasturas y generacion solar. Pico observado: ", _jsx("strong", { children: max.toFixed(2) }), " ", unit, "."] })] }), _jsxs("div", { className: "daily-mode-toggle", children: [_jsx("button", { type: "button", className: `btn small ${mode === 'heatmap' ? 'active' : ''}`, onClick: () => setMode('heatmap'), children: "Heatmap" }), _jsx("button", { type: "button", className: `btn small ${mode === 'bars' ? 'active' : ''}`, onClick: () => setMode('bars'), children: "Barras" })] }), mode === 'heatmap' ? (_jsx(HeatmapView, { weeks: weeks, ranges: weekRanges, columns: columns, unit: unit })) : (_jsx(WeeklyBars, { weeks: weeks, ranges: weekRanges, unit: unit })), _jsxs("div", { className: "heatmap-scale", children: [_jsx("span", { children: "Seco" }), _jsx("div", { className: "heatmap-scale-bar" }), _jsx("span", { children: "Max" })] })] }));
}
function HeatmapView({ weeks, ranges, columns, unit, }) {
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "daily-week-row", style: { gridTemplateColumns: `56px repeat(${columns}, 18px)` }, children: [_jsx("span", { className: "daily-week-placeholder", children: "Semana" }), ranges.map((week) => (_jsx("span", { className: "daily-week-label", style: { gridColumn: 'span 7' }, title: week.range, children: week.label }, week.id)))] }), _jsx("div", { className: "daily-heatmap-gridWrapper", children: _jsx("div", { className: "daily-heatmap-grid", style: { gridTemplateColumns: `56px repeat(${columns}, 18px)` }, children: DAY_LABELS.map((label, dayIndex) => (_jsxs(Fragment, { children: [_jsx("span", { className: "daily-heatmap-day", children: label }), weeks.map((week, weekIndex) => {
                                const cell = week[dayIndex];
                                const background = cell && cell.value > 0
                                    ? getDailyColor(cell.normalized)
                                    : 'rgba(148, 163, 184, 0.14)';
                                return (_jsx("span", { className: "daily-heatmap-cell", style: { backgroundColor: background }, title: cell
                                        ? `${cell.label} -> ${cell.value.toFixed(2)} ${unit}`
                                        : 'Sin dato', children: cell && cell.icons.length ? (_jsx("span", { className: "daily-cell-icons", children: cell.icons.join(' ') })) : null }, `${ranges[weekIndex].id}-${dayIndex}`));
                            })] }, label))) }) })] }));
}
function WeeklyBars({ weeks, ranges, unit, }) {
    const totals = weeks.map((week) => week.reduce((sum, day) => sum + (day?.value ?? 0), 0));
    const maxTotal = Math.max(...totals, 1);
    return (_jsx("div", { className: "daily-bars", children: weeks.map((week, index) => {
            const total = totals[index];
            const columnHeight = (total / maxTotal) * 100;
            return (_jsxs("div", { className: "daily-bars-week", title: ranges[index].range, children: [_jsx("div", { className: "daily-bars-column", children: _jsx("div", { className: "daily-bars-stack", style: { height: `${columnHeight}%` }, children: week.map((day, dayIndex) => {
                                const portion = total > 0 ? (day.value / total) * 100 : 0;
                                return (_jsx("span", { className: "daily-bar-segment", style: {
                                        height: `${portion}%`,
                                        backgroundColor: day.value > 0
                                            ? getDailyColor(day.normalized)
                                            : 'rgba(148, 163, 184, 0.2)',
                                    }, title: `${day.label} -> ${day.value.toFixed(2)} ${unit}` }, `${ranges[index].id}-${dayIndex}`));
                            }) }) }), _jsx("span", { className: "daily-bars-label", children: ranges[index].label }), _jsxs("span", { className: "daily-bars-total", children: [total.toFixed(1), " mm"] })] }, ranges[index].id));
        }) }));
}
function buildMatrix(daily) {
    if (!daily.length)
        return { weeks: [], weekRanges: [], max: 0 };
    const map = new Map();
    daily.forEach((day) => map.set(day.date, day));
    const sorted = [...map.keys()].sort();
    const first = new Date(`${sorted[0]}T00:00:00Z`);
    const last = new Date(`${sorted[sorted.length - 1]}T00:00:00Z`);
    const start = startOfWeek(first);
    const end = endOfWeek(last);
    const cells = [];
    let cursor = new Date(start);
    let max = 0;
    while (cursor <= end) {
        const iso = toIsoDay(cursor);
        const base = map.get(iso);
        const value = base?.value ?? 0;
        if (value > max)
            max = value;
        cells.push({
            date: iso,
            label: base?.label ?? formatDisplayDate(iso),
            value,
            icons: base?.icons ?? [],
            normalized: 0,
        });
        cursor = addDays(cursor, 1);
    }
    const normalized = cells.map((cell) => ({
        ...cell,
        normalized: max > 0 ? Math.min(cell.value / max, 1) : 0,
    }));
    const weeks = [];
    for (let i = 0; i < normalized.length; i += 7) {
        weeks.push(normalized.slice(i, i + 7));
    }
    const weekRanges = weeks.map((week, index) => ({
        id: `week-${index}`,
        label: `Sem ${index + 1}`,
        range: `${week[0]?.label ?? ''} -> ${week[week.length - 1]?.label ?? ''}`,
    }));
    return { weeks, weekRanges, max };
}
function getDailyColor(value) {
    const clamped = Math.min(Math.max(value, 0), 1);
    const upperIndex = DAILY_HEAT_COLORS.findIndex((entry) => entry.stop >= clamped);
    if (upperIndex <= 0) {
        const [r, g, b] = DAILY_HEAT_COLORS[Math.max(upperIndex, 0)].color;
        return `rgba(${r}, ${g}, ${b}, ${0.95})`;
    }
    const lowerIndex = upperIndex - 1;
    const lower = DAILY_HEAT_COLORS[lowerIndex];
    const upper = DAILY_HEAT_COLORS[upperIndex];
    const range = upper.stop - lower.stop || 1;
    const t = (clamped - lower.stop) / range;
    const r = Math.round(lower.color[0] + (upper.color[0] - lower.color[0]) * t);
    const g = Math.round(lower.color[1] + (upper.color[1] - lower.color[1]) * t);
    const b = Math.round(lower.color[2] + (upper.color[2] - lower.color[2]) * t);
    return `rgba(${r}, ${g}, ${b}, ${0.95})`;
}
function startOfWeek(date) {
    const clone = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = clone.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    clone.setUTCDate(clone.getUTCDate() + diff);
    return clone;
}
function endOfWeek(date) {
    const start = startOfWeek(date);
    start.setUTCDate(start.getUTCDate() + 6);
    return start;
}
function addDays(date, amount) {
    const clone = new Date(date);
    clone.setUTCDate(clone.getUTCDate() + amount);
    return clone;
}
function toIsoDay(date) {
    return date.toISOString().slice(0, 10);
}
function formatDisplayDate(date) {
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()))
        return date;
    return parsed.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}
//# sourceMappingURL=DailyHeatmap.js.map