import { Fragment, useMemo } from 'react';
import type { AggregatedPoint } from './PrecipitationChart';

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

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
  const day = clone.getUTCDay(); // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day; // llevar a lunes
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

  const columns = weeks.length;
  const unit = metric === 'intensity' ? 'mm/h' : 'mm';

  return (
    <div className="daily-heatmap">
      <div className="daily-heatmap-headline">
        <h3>Distribuci&oacute;n diaria</h3>
        <p>
          Mapa de calor de lluvia diaria. Pico observado:{' '}
          <strong>{max.toFixed(2)}</strong> {unit}.
        </p>
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
                const background =
                  value > 0
                    ? `rgba(34, 211, 238, ${(0.18 + normalized * 0.7).toFixed(3)})`
                    : 'rgba(148, 163, 184, 0.14)';
                return (
                  <span
                    key={`${weekIndex}-${dayIndex}`}
                    className="daily-heatmap-cell"
                    style={{ backgroundColor: background }}
                    title={`${formatDisplayDate(cell?.date ?? '')} → ${value.toFixed(2)} ${unit}`}
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
