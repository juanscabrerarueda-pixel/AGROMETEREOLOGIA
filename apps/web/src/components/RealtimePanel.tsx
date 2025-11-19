import { useMemo } from 'react';
import type { Series } from '@pkg/core';

type RealtimePanelProps = {
  series?: Series | null;
  busy?: boolean;
};

type SnapshotMetric = {
  id: string;
  label: string;
  value: string;
  note?: string;
};

type Snapshot = {
  locationLabel: string;
  sourceLabel?: string;
  timezone?: string;
  lastDisplay: string;
  relativeLabel: string;
  isStale: boolean;
  metrics: SnapshotMetric[];
  forecastTotal: number;
  forecastPeak: number;
  hasForecast: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function RealtimePanel({ series, busy }: RealtimePanelProps) {
  const snapshot = useMemo(() => buildSnapshot(series), [series]);

  return (
    <section className="card realtime-card mb4">
      <div className="section-header">
        <div>
          <h2>Monitoreo en vivo</h2>
          <p className="muted tiny">
            {snapshot ? `Último dato: ${snapshot.lastDisplay}` : 'Sin observaciones en el rango actual.'}
          </p>
        </div>
        {snapshot && (
          <span className={`status-pill ${snapshot.isStale ? 'warn' : ''}`}>{snapshot.relativeLabel}</span>
        )}
      </div>

      {busy && !snapshot ? (
        <div className="skeleton">
          <div className="skeleton-bar" />
          <div className="skeleton-bar" />
          <div className="skeleton-bar" />
        </div>
      ) : snapshot ? (
        <>
          <div className="realtime-meta">
            <div>
              <span className="tiny">Ubicación</span>
              <strong>{snapshot.locationLabel}</strong>
              <p className="muted tiny">{snapshot.sourceLabel ?? 'Fuente no disponible'}</p>
            </div>
            <div>
              <span className="tiny">Zona horaria</span>
              <strong>{snapshot.timezone ?? 'Sin dato'}</strong>
              <p className="muted tiny">Hora local mostrada en la serie</p>
            </div>
            <div>
              <span className="tiny">Pronóstico 24h</span>
              <strong>{formatNumber(snapshot.forecastTotal, 1)} mm</strong>
              <p className="muted tiny">
                {snapshot.hasForecast
                  ? `Intensidad pico esperada: ${formatNumber(snapshot.forecastPeak, 1)} mm/h`
                  : 'Sin proyección disponible'}
              </p>
            </div>
          </div>

          <div className="realtime-metrics">
            {snapshot.metrics.map((metric) => (
              <div key={metric.id} className="realtime-metric">
                <span className="metric-label">{metric.label}</span>
                <span className="metric-value">{metric.value}</span>
                {metric.note && <span className="metric-note">{metric.note}</span>}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">Ajusta el rango o la ubicación para ver datos en vivo.</div>
      )}
    </section>
  );
}

function buildSnapshot(series?: Series | null): Snapshot | null {
  if (!series || !Array.isArray(series.hourly) || !series.hourly.length) {
    return null;
  }

  const hourly = series.hourly.filter((point) => typeof point?.t === 'string');
  if (!hourly.length) return null;

  const sorted = [...hourly].sort((a, b) => (a.t ?? '').localeCompare(b.t ?? ''));
  const now = Date.now();
  const parseTime = (value?: string) => {
    if (!value) return Number.NaN;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : Number.NaN;
  };

  let latest = sorted[sorted.length - 1];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const ts = parseTime(sorted[i].t);
    if (Number.isFinite(ts) && ts <= now) {
      latest = sorted[i];
      break;
    }
  }

  const lastStamp = parseTime(latest.t);
  const relative = formatRelativeLabel(lastStamp, now);
  const forecast = computeForecast(sorted, now);

  return {
    locationLabel: formatLocation(series),
    sourceLabel: series.meta?.source,
    timezone: series.meta?.tz,
    lastDisplay: formatDateTime(lastStamp, series.meta?.tz),
    relativeLabel: relative.label,
    isStale: relative.isStale,
    metrics: buildMetrics(latest),
    forecastTotal: forecast.total,
    forecastPeak: forecast.peak,
    hasForecast: forecast.count > 0,
  };
}

function formatLocation(series: Series): string {
  const parts = [series.key?.depto, series.key?.muni].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Ubicación no definida';
}

function buildMetrics(point: Series['hourly'][number]): SnapshotMetric[] {
  const metrics: SnapshotMetric[] = [];
  metrics.push({
    id: 'rain',
    label: 'Lluvia horaria',
    value: formatNumber(point.prcp, 2, 'mm'),
    note: 'Último acumulado registrado',
  });
  metrics.push({
    id: 'intensity',
    label: 'Intensidad',
    value: formatNumber(point.prcpRate, 2, 'mm/h'),
    note: 'Pico horario',
  });
  metrics.push({
    id: 'temp',
    label: 'Temperatura',
    value: formatNumber(point.temp, 1, 'C'),
  });
  metrics.push({
    id: 'humidity',
    label: 'Humedad',
    value: formatNumber(point.rh, 0, '%'),
  });
  metrics.push({
    id: 'wind',
    label: 'Viento',
    value: formatNumber(point.wind, 1, 'm/s'),
  });
  metrics.push({
    id: 'pressure',
    label: 'Presión',
    value: formatNumber(point.pressure, 1, 'kPa'),
  });
  return metrics;
}

function formatNumber(value: unknown, decimals = 1, unit?: string): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'Sin dato';
  }
  const formatted = value.toLocaleString('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatDateTime(timestamp: number, tz?: string): string {
  if (!Number.isFinite(timestamp)) return 'Sin fecha';
  try {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: tz ?? 'UTC',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toISOString();
  }
}

function formatRelativeLabel(timestamp: number, now: number): { label: string; isStale: boolean } {
  if (!Number.isFinite(timestamp)) {
    return { label: 'Fecha desconocida', isStale: true };
  }
  if (timestamp > now) {
    const minutesAhead = Math.round((timestamp - now) / 60000);
    return { label: `Proximo dato en ${minutesAhead} min`, isStale: false };
  }
  const minutesDiff = Math.max(0, Math.round((now - timestamp) / 60000));
  if (minutesDiff < 1) return { label: 'Actualizado hace instantes', isStale: false };
  if (minutesDiff < 60) return { label: `Hace ${minutesDiff} min`, isStale: false };
  const hours = minutesDiff / 60;
  return { label: `Hace ${hours.toFixed(1)} h`, isStale: minutesDiff > 180 };
}

function computeForecast(points: Series['hourly'], now: number): { total: number; peak: number; count: number } {
  const end = now + DAY_MS;
  let total = 0;
  let peak = 0;
  let count = 0;
  for (const point of points) {
    const stamp = point.t ? Date.parse(point.t) : Number.NaN;
    if (!Number.isFinite(stamp) || stamp <= now || stamp > end) continue;
    if (typeof point.prcp === 'number') {
      total += point.prcp;
    }
    if (typeof point.prcpRate === 'number' && point.prcpRate > peak) {
      peak = point.prcpRate;
    }
    count += 1;
  }
  return { total, peak, count };
}


