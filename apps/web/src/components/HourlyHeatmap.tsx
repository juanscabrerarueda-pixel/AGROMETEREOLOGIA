import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Series } from '@pkg/core';

const HOURS = Array.from({ length: 24 }, (_, index) => index);

const HEAT_COLORS = [
  { stop: 0, color: [37, 99, 235] }, // azul
  { stop: 0.5, color: [250, 204, 21] }, // amarillo
  { stop: 1, color: [239, 68, 68] }, // rojo
];

function getHeatColor(value: number): string {
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

type HourlyHeatmapProps = {
  series: Series | null | undefined;
  variable?: 'prcp' | 'prcpRate';
  maxRows?: number;
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

export function HourlyHeatmap({ series, variable = 'prcp', maxRows = 35 }: HourlyHeatmapProps) {
  const { rows, max } = useMemo(() => buildMatrix(series, variable), [series, variable]);
  const [expanded, setExpanded] = useState(false);

  if (!rows.length) {
    return <div className="empty-state">Sin datos suficientes para generar el mapa de calor.</div>;
  }

  const visibleRows =
    expanded || !maxRows || rows.length <= maxRows
      ? rows
      : rows.slice(Math.max(rows.length - maxRows, 0));
  const canToggle = maxRows && rows.length > maxRows;

  const gridMinWidth = Math.max(visibleRows.length * 32 + 360, 520);

  return (
    <div className="heatmap">
      <div className="heatmap-headline">
        <h3>Mapa de calor horario</h3>
        <p>
          Intensidad relativa por hora. Pico maximo observado: <strong>{max.toFixed(2)}</strong>{' '}
          {variable === 'prcpRate' ? 'mm/h' : 'mm'}.
        </p>
      </div>

      <div className="heatmap-scroll">
        <div className="heatmap-grid" style={{ minWidth: `${gridMinWidth}px` }}>
          <div className="heatmap-hours">
            <span className="heatmap-hours-label">Hora</span>
            <div className="heatmap-hours-cells">
              {HOURS.map((hour) => (
                <span key={hour} className="heatmap-hour">
                  {hour.toString().padStart(2, '0')}
                </span>
              ))}
            </div>
          </div>

          {visibleRows.map((row) => (
            <div key={row.date} className="heatmap-row">
              <span className="heatmap-day">{row.display}</span>
              <div className="heatmap-cells">
                {row.values.map((item) => {
                  const background =
                    item.value === null
                      ? 'rgba(148, 163, 184, 0.12)'
                      : getHeatColor(item.normalized);
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
      </div>

      <div className="heatmap-meta">
        <span>
          Mostrando {visibleRows.length} de {rows.length} d&iacute;as
        </span>
        {canToggle && (
          <button className="heatmap-toggle" onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Mostrar menos' : 'Ver todos'}
          </button>
        )}
      </div>

      <div className="heatmap-scale">
        <span>Seco</span>
        <div className="heatmap-scale-bar" />
        <span>Max</span>
      </div>
    </div>
  );
}
