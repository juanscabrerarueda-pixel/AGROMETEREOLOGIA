import { Fragment, useMemo } from 'react';
import type { AggregatedPoint } from './PrecipitationChart';

const DAY_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

type DailyHeatmapProps = {
  points: AggregatedPoint[];
  metric: 'accumulated' | 'intensity';
};

type HeatmapCell = {
  date: string;
  value: number;
  normalized: number;
};

function startOfWeek(date: Date): Date {
  const clone = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = clone.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  clone.setUTCDate(clone.getUTCDate() + diff);
  return clone;
}

function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  start.setUTCDate(start.getUTCDate() + 6);
  return start;
}

function addDays(date: Date, amount: number): Date {
  const clone = new Date(date);
  clone.setUTCDate(clone.getUTCDate() + amount);
  return clone;
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

const DAILY_HEAT_COLORS = [
  { stop: 0, color: [37, 99, 235] },
  { stop: 0.4, color: [59, 130, 246] },
  { stop: 0.7, color: [250, 204, 21] },
  { stop: 1, color: [239, 68, 68] },
];

function getDailyColor(normalized: number): string {
  const clamped = Math.min(Math.max(normalized, 0), 1);
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

function buildMatrix(points: AggregatedPoint[]): { weeks: HeatmapCell[][]; max: number } {
  if (!points.length) {
    return { weeks: [], max: 0 };
  }

  const map = new Map<string, AggregatedPoint>();
  points.forEach((point) => map.set(point.date, point));

  const sortedDates = [...map.keys()].sort();
  const first = new Date(`${sortedDates[0]}T00:00:00Z`);
  const last = new Date(`${sortedDates[sortedDates.length - 1]}T00:00:00Z`);

  const start = startOfWeek(first);
  const end = endOfWeek(last);

  let cursor = new Date(start);
  let max = 0;
  const cells: HeatmapCell[] = [];

  while (cursor <= end) {
    const iso = toIsoDay(cursor);
    const value = map.get(iso)?.value ?? 0;
    if (value > max) {
      max = value;
    }
    cells.push({
      date: iso,
      value,
      normalized: 0,
    });
    cursor = addDays(cursor, 1);
  }

  const normalized = cells.map((cell) => ({
    ...cell,
    normalized: max > 0 ? Math.min(cell.value / max, 1) : 0,
  }));

  const weeks: HeatmapCell[][] = [];
  for (let i = 0; i < normalized.length; i += 7) {
    weeks.push(normalized.slice(i, i + 7));
  }

  return { weeks, max };
}

export function DailyHeatmap({ points, metric }: DailyHeatmapProps) {
  const { weeks, max } = useMemo(() => buildMatrix(points), [points]);

  if (!weeks.length) {
    return <div className="empty-state">Sin datos suficientes para generar el mapa de calor.</div>;
  }

  const columns = weeks.length * 7;
  const unit = metric === 'intensity' ? 'mm/h' : 'mm';
  const weekLabels = weeks.map((week, index) => {
    const start = week[0]?.date;
    const end = week[week.length - 1]?.date;
    return {
      id: `week-${index}`,
      label: `Sem ${index + 1}`,
      title: start && end ? `${formatDisplayDate(start)} -> ${formatDisplayDate(end)}` : undefined,
    };
  });

  return (
    <div className="daily-heatmap">
      <div className="daily-heatmap-headline">
        <h3>Distribucion diaria</h3>
        <p>
          Concentra los dias mas humedos para planear riego, cosecha, disponibilidad de pasturas y
          generacion solar. Pico observado: <strong>{max.toFixed(2)}</strong> {unit}.
        </p>
      </div>

      <div className="daily-week-row" style={{ gridTemplateColumns: `56px repeat(${columns}, 18px)` }}>
        <span className="daily-week-placeholder">Semana</span>
        {weekLabels.map((week) => (
          <span
            key={week.id}
            className="daily-week-label"
            style={{ gridColumn: 'span 7' }}
            title={week.title}
          >
            {week.label}
          </span>
        ))}
      </div>

      <div className="daily-heatmap-gridWrapper">
        <div
          className="daily-heatmap-grid"
          style={{ gridTemplateColumns: `56px repeat(${columns}, 18px)` }}
        >
          {DAY_LABELS.map((label, dayIndex) => (
            <Fragment key={label}>
              <span className="daily-heatmap-day">{label}</span>
              {weeks.map((week, weekIndex) => {
                const cell = week[dayIndex];
                const value = cell?.value ?? 0;
                const normalized = cell?.normalized ?? 0;
                const background = value > 0 ? getDailyColor(normalized) : 'rgba(148, 163, 184, 0.14)';
                return (
                  <span
                    key={`${weekIndex}-${dayIndex}`}
                    className="daily-heatmap-cell"
                    style={{ backgroundColor: background }}
                    title={`${formatDisplayDate(cell?.date ?? '')} -> ${value.toFixed(2)} ${unit}`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="heatmap-scale">
        <span>Seco</span>
        <div className="heatmap-scale-bar" />
        <span>Max</span>
      </div>
    </div>
  );
}
