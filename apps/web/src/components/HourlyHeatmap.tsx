import { Fragment, useMemo, useState } from 'react';
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
  maxColumns?: number;
};

type HeatmapColumn = {
  date: string;
  label: string;
  tooltip: string;
  values: Array<{
    value: number | null;
    hour: number;
    normalized: number;
  }>;
};

function formatDayLabel(day: string): { label: string; tooltip: string } {
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

function buildColumns(series: Series | null | undefined, variable: 'prcp' | 'prcpRate') {
  const hourly = series?.hourly ?? [];
  if (!hourly.length) return { columns: [] as HeatmapColumn[], max: 0 };

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

  const columns: HeatmapColumn[] = Array.from(buckets.entries())
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

export function HourlyHeatmap({ series, variable = 'prcp', maxColumns = 14 }: HourlyHeatmapProps) {
  const { columns, max } = useMemo(() => buildColumns(series, variable), [series, variable]);
  const [expanded, setExpanded] = useState(false);

  if (!columns.length) {
    return <div className="empty-state">Sin datos suficientes para generar el mapa de calor.</div>;
  }

  const visibleColumns =
    expanded || !maxColumns || columns.length <= maxColumns
      ? columns
      : columns.slice(Math.max(columns.length - maxColumns, 0));
  const canToggle = maxColumns && columns.length > maxColumns;

  const gridTemplateColumns = `80px repeat(${visibleColumns.length}, minmax(32px, 1fr))`;
  const gridMinWidth = 80 + visibleColumns.length * 38;

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
        <div
          className="heatmap-matrix"
          style={{ gridTemplateColumns, minWidth: `${gridMinWidth}px` }}
        >
          <span className="heatmap-corner">Hora</span>
          {visibleColumns.map((column) => (
            <span key={column.date} className="heatmap-date" title={column.tooltip}>
              {column.label}
            </span>
          ))}
          {HOURS.map((hour) => (
            <Fragment key={hour}>
              <span className="heatmap-hour-label">{hour.toString().padStart(2, '0')}h</span>
              {visibleColumns.map((column) => {
                const item = column.values[hour];
                const background =
                  item.value === null
                    ? 'rgba(148, 163, 184, 0.12)'
                    : getHeatColor(item.normalized);
                return (
                  <span
                    key={`${column.date}-${hour}`}
                    className="heatmap-cell"
                    style={{ backgroundColor: background } as CSSProperties}
                    title={`${column.tooltip} ${hour.toString().padStart(2, '0')}:00 -> ${
                      item.value !== null
                        ? `${item.value.toFixed(2)} ${variable === 'prcpRate' ? 'mm/h' : 'mm'}`
                        : 'sin dato'
                    }`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="heatmap-meta">
        <span>
          Mostrando {visibleColumns.length} de {columns.length} d&iacute;as
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
