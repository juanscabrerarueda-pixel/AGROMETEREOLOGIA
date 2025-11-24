import { useEffect, useMemo, useState } from 'react';

export type DailyDatum = {
  date: string;
  label: string;
  value: number;
  icons: string[];
};

const DAILY_HEAT_COLORS = [
  { stop: 0, color: [37, 99, 235] },
  { stop: 0.4, color: [59, 130, 246] },
  { stop: 0.7, color: [250, 204, 21] },
  { stop: 1, color: [239, 68, 68] },
];

type DailyHeatmapProps = {
  daily: DailyDatum[];
  metric: 'accumulated' | 'intensity';
};

export function DailyHeatmap({ daily, metric }: DailyHeatmapProps) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = () => setCompact(mq.matches);
    handler();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, []);
  const { weeks, weekRanges, max } = useMemo(() => buildMatrix(daily), [daily]);

  if (!weeks.length) {
    return <div className="empty-state">Sin datos suficientes para generar el mapa de calor.</div>;
  }

  const unit = metric === 'intensity' ? 'mm/h' : 'mm';
  const renderWeeks = compact ? weeks.slice(-8) : weeks;
  const renderRanges = compact ? weekRanges.slice(-renderWeeks.length) : weekRanges;

  return (
    <div className="daily-heatmap">
      <div className="daily-heatmap-headline">
        <h3>Distribución diaria</h3>
        <p>
          Concentra los días más húmedos para planear riego, cosecha, disponibilidad de pasturas y
          generación solar. Pico observado: <strong>{max.toFixed(2)}</strong> {unit}.
        </p>
      </div>

      <WeeklyBars weeks={renderWeeks} ranges={renderRanges} unit={unit} />

      <div className="heatmap-scale">
        <span>Seco</span>
        <div className="heatmap-scale-bar" />
        <span>Max</span>
      </div>
    </div>
  );
}

type WeekRange = { id: string; label: string; range: string };

type WeeklyBarsProps = {
  weeks: HeatmapCell[][];
  ranges: WeekRange[];
  unit: string;
};

function WeeklyBars({ weeks, ranges, unit }: WeeklyBarsProps) {
  const totals = weeks.map((week) => week.reduce((sum, day) => sum + (day?.value ?? 0), 0));
  const maxTotal = Math.max(...totals, 1);

  return (
    <div className="daily-bars">
      {weeks.map((week, index) => {
        const total = totals[index];
        const columnHeight = (total / maxTotal) * 100;
        const meta = ranges[index];

        return (
          <div key={meta.id} className="daily-bars-week" title={meta.range}>
            <div className="daily-bars-column">
              <div className="daily-bars-stack" style={{ height: `${columnHeight}%` }}>
                {week.map((day, dayIndex) => {
                  const portion = total > 0 ? (day.value / total) * 100 : 0;
                  return (
                    <span
                      key={`${meta.id}-${dayIndex}`}
                      className="daily-bar-segment"
                      style={{
                        height: `${portion}%`,
                        backgroundColor:
                          day.value > 0
                            ? getDailyColor(day.normalized)
                            : 'rgba(148, 163, 184, 0.2)',
                      }}
                      title={`${day.label} -> ${day.value.toFixed(2)} ${unit}`}
                    />
                  );
                })}
              </div>
            </div>
            <span className="daily-bars-label">{meta.label}</span>
            <span className="daily-bars-range">{meta.range}</span>
            <span className="daily-bars-total">{total.toFixed(1)} mm</span>
          </div>
        );
      })}
    </div>
  );
}

function buildMatrix(daily: DailyDatum[]): {
  weeks: HeatmapCell[][];
  weekRanges: WeekRange[];
  max: number;
} {
  if (!daily.length) return { weeks: [], weekRanges: [], max: 0 };
  const map = new Map<string, DailyDatum>();
  daily.forEach((day) => map.set(day.date, day));
  const sorted = [...map.keys()].sort();
  const first = new Date(`${sorted[0]}T00:00:00Z`);
  const last = new Date(`${sorted[sorted.length - 1]}T00:00:00Z`);
  const start = startOfWeek(first);
  const end = endOfWeek(last);

  const cells: HeatmapCell[] = [];
  let cursor = new Date(start);
  let max = 0;
  while (cursor <= end) {
    const iso = toIsoDay(cursor);
    const base = map.get(iso);
    const value = base?.value ?? 0;
    if (value > max) max = value;
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

  const weeks: HeatmapCell[][] = [];
  for (let i = 0; i < normalized.length; i += 7) {
    weeks.push(normalized.slice(i, i + 7));
  }

  const weekRanges: WeekRange[] = weeks.map((week, index) => {
    const startLabel = week[0]?.label ?? '';
    const endLabel = week[week.length - 1]?.label ?? '';
    return {
      id: `week-${index}`,
      label: `Sem ${index + 1}`,
      range: startLabel && endLabel ? `${startLabel} - ${endLabel}` : startLabel || endLabel,
    };
  });

  return { weeks, weekRanges, max };
}

type HeatmapCell = DailyDatum & { normalized: number };

function getDailyColor(value: number): string {
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
