import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { Series } from '@pkg/core';

const HOURS = Array.from({ length: 24 }, (_, index) => index);

type HourlyHeatmapProps = {
  series: Series | null | undefined;
  variable?: 'prcp' | 'prcpRate';
};

type HeatmapRow = {
  date: string;
  display: string;
  values: Array<{
    value: number | null;
    hour: number;
    normalized: number;
  }>;
};

function formatDayLabel(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString('es-CO', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function buildMatrix(series: Series | null | undefined, variable: 'prcp' | 'prcpRate') {
  const hourly = series?.hourly ?? [];
  if (!hourly.length) return { rows: [] as HeatmapRow[], max: 0 };

  const buckets = new Map<string, Array<number | null>>();
  let max = 0;

  for (const point of hourly) {
    const iso = point.t;
    if (!iso) continue;
    const dayKey = iso.slice(0, 10);
    const hour = Number(iso.slice(11, 13));
    if (Number.isNaN(hour)) continue;

    if (!buckets.has(dayKey)) {
      buckets.set(dayKey, Array.from({ length: 24 }, () => null));
    }

    const bucket = buckets.get(dayKey)!;
    const raw = (point as Record<string, unknown>)[variable];
    if (typeof raw === 'number') {
      const safe = Number(raw.toFixed(3));
      bucket[hour] = safe;
      if (safe > max) {
        max = safe;
      }
    }
  }

  const rows: HeatmapRow[] = Array.from(buckets.entries())
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

export function HourlyHeatmap({ series, variable = 'prcp' }: HourlyHeatmapProps) {
  const { rows, max } = useMemo(() => buildMatrix(series, variable), [series, variable]);

  if (!rows.length) {
    return <div className="empty-state">Sin datos suficientes para generar el mapa de calor.</div>;
  }

  return (
    <div className="heatmap">
      <div className="heatmap-headline">
        <h3>Mapa de calor horario</h3>
        <p>
          Intensidad relativa por hora. Pico maximo observado: <strong>{max.toFixed(2)}</strong>{' '}
          {variable === 'prcpRate' ? 'mm/h' : 'mm'}.
        </p>
      </div>

      <div className="heatmap-grid">
        <div className="heatmap-hours">
          <span className="heatmap-hours-label">Hora</span>
          {HOURS.map((hour) => (
            <span key={hour} className="heatmap-hour">
              {hour.toString().padStart(2, '0')}
            </span>
          ))}
        </div>

        {rows.map((row) => (
          <div key={row.date} className="heatmap-row">
            <span className="heatmap-day">{row.display}</span>
            <div className="heatmap-cells">
              {row.values.map((item) => {
                const background =
                  item.value === null
                    ? 'rgba(148, 163, 184, 0.12)'
                    : `rgba(56, 189, 248, ${(0.15 + item.normalized * 0.75).toFixed(3)})`;
                return (
                  <span
                    key={item.hour}
                    className="heatmap-cell"
                    style={{ backgroundColor: background } as CSSProperties}
                    title={`${row.date} ${item.hour.toString().padStart(2, '0')}:00 -> ${
                      item.value !== null
                        ? `${item.value.toFixed(2)} ${variable === 'prcpRate' ? 'mm/h' : 'mm'}`
                        : 'sin dato'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="heatmap-scale">
        <span>Seco</span>
        <div className="heatmap-scale-bar" />
        <span>Max</span>
      </div>
    </div>
  );
}
