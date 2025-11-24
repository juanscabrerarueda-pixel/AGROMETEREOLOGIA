import { useEffect, useMemo, useState } from 'react';
import type { Series } from '@pkg/core';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip as ChartTooltip } from 'chart.js';
import { MiniMap } from './MiniMap';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip);


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
  latencyMinutes: number;
  metrics: SnapshotMetric[];
  forecastTotal: number;
  forecastPeak: number;
  hasForecast: boolean;
  latest: SnapshotLatest;
};

type SnapshotLatest = {
  rain?: number;
  intensity?: number;
  temp?: number;
  humidity?: number;
  wind?: number;
  pressure?: number;
};
const DAY_MS = 24 * 60 * 60 * 1000;
type TimelineEvent = { id: string; time: string; label: string; detail: string };
const LIVE_TIPS = [
  {
    title: 'Último dato + Hace X min',
    body:
      'Muestra la latencia real del sensor. Si supera los 30 minutos, valida la conectividad antes de tomar decisiones críticas.',
  },
  {
    title: 'Lluvia horaria vs. Intensidad',
    body:
      'El primer valor refleja el acumulado de la última hora y el segundo el pico puntual (mm/h). Picos altos con poco acumulado implican ráfagas cortas.',
  },
  {
    title: 'Pronóstico 24 h',
    body:
      'Resume el máximo esperado para la siguiente jornada. Si el pico proyectado supera tu umbral operativo, reprograma labores o incrementa el monitoreo.',
  },
  {
    title: 'Variables ambientales',
    body:
      'Temperatura, humedad, viento y presión ayudan a anticipar estrés térmico, ventanas de asperjado o cambios de frente. Contrasta estos valores con los promedios históricos.',
  },
];

type Sparkline = {
  labels: string[];
  values: number[];
  peak: number;
  latest: number;
  latestLabel: string;
  accumulated: number[];
};

type UserThresholds = {
  intensity: number;
  latency: number;
};

const DEFAULT_THRESHOLDS: UserThresholds = {
  intensity: 8,
  latency: 60,
};

function loadThresholds(): UserThresholds {
  if (typeof window === 'undefined') return DEFAULT_THRESHOLDS;
  try {
    const raw = window.localStorage.getItem('realtime-thresholds');
    if (!raw) return DEFAULT_THRESHOLDS;
    const parsed = JSON.parse(raw);
    return {
      intensity:
        typeof parsed.intensity === 'number' && Number.isFinite(parsed.intensity)
          ? parsed.intensity
          : DEFAULT_THRESHOLDS.intensity,
      latency:
        typeof parsed.latency === 'number' && Number.isFinite(parsed.latency)
          ? parsed.latency
          : DEFAULT_THRESHOLDS.latency,
    };
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

export function RealtimePanel({ series, busy }: RealtimePanelProps) {
  const snapshot = useMemo(() => buildSnapshot(series), [series]);
  const sparkline = useMemo(() => buildSparkline(series), [series]);
  const [userThresholds, setUserThresholds] = useState<UserThresholds>(() => loadThresholds());
  const [guideOpen, setGuideOpen] = useState(true);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('realtime-thresholds', JSON.stringify(userThresholds));
    }
  }, [userThresholds]);
  const handleThresholdChange = (key: keyof UserThresholds, rawValue: number) => {
    if (Number.isNaN(rawValue)) return;
    setUserThresholds((prev) => {
      const next = { ...prev };
      next[key] =
        key === 'latency'
          ? Math.max(10, Math.round(rawValue))
          : Math.max(0, Number(rawValue.toFixed(1)));
      return next;
    });
  };
  const alerts = useMemo(() => buildRealtimeAlerts(snapshot?.latest, userThresholds), [snapshot, userThresholds]);
  const latencyStatus = snapshot ? getLatencyStatus(snapshot.latencyMinutes, userThresholds.latency) : 'calm';
  const latencyPercent = snapshot
    ? Math.min((snapshot.latencyMinutes ?? 0) / Math.max(userThresholds.latency, 1), 1) * 100
    : 0;
  const timeline = useMemo(
    () => buildTimelineEvents(series, sparkline, snapshot, userThresholds),
    [series, sparkline, snapshot, userThresholds]
  );
  const sparklineChart = useMemo(() => {
    if (!sparkline) return null;
    return {
      data: {
        labels: sparkline.labels,
        datasets: [
          {
            data: sparkline.values,
            borderColor: '#60a5fa',
            backgroundColor: 'rgba(96, 165, 250, 0.15)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.35,
            fill: true,
            yAxisID: 'y',
          },
          {
            data: sparkline.accumulated,
            borderColor: '#22d3ee',
            borderDash: [6, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            yAxisID: 'y2',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { intersect: false, mode: 'index' as const } },
        scales: {
          x: { display: false },
          y: {
            display: false,
            beginAtZero: true,
            suggestedMax: Math.max(sparkline.peak * 1.2, 1),
          },
          y2: {
            type: 'linear' as const,
            display: false,
            beginAtZero: true,
            position: 'right' as const,
          },
        },
        elements: { point: { radius: 0 } },
      },
    };
  }, [sparkline]);

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
          <span className={`status-pill ${latencyStatus === 'alert' ? 'alert' : latencyStatus === 'warn' ? 'warn' : ''}`}>
            {snapshot.relativeLabel}
          </span>
        )}
      </div>

      <div className="threshold-controls">
        <label>
          <span>Intensidad crítica (mm/h)</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={userThresholds.intensity}
            onChange={(event) => handleThresholdChange('intensity', Number(event.target.value))}
          />
        </label>
        <label>
          <span>Latencia máxima (min)</span>
          <input
            type="number"
            min={10}
            step={5}
            value={userThresholds.latency}
            onChange={(event) => handleThresholdChange('latency', Number(event.target.value))}
          />
        </label>
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
          <MiniMap lat={series?.meta?.lat} lon={series?.meta?.lon} status={latencyStatus} label={snapshot.locationLabel} />

          <div className="realtime-metrics">
            {snapshot.metrics.map((metric) => (
              <div key={metric.id} className="realtime-metric">
                <span className="metric-label">{metric.label}</span>
                <span className="metric-value">{metric.value}</span>
                {metric.note && <span className="metric-note">{metric.note}</span>}
              </div>
            ))}
          </div>
          {alerts.length > 0 && (
            <div className="status-chips">
              {alerts.map((alert) => (
                <div key={alert.id} className={`status-chip ${alert.tone}`}>
                  <span className="chip-title">{alert.label}</span>
                  <p>{alert.message}</p>
                </div>
              ))}
            </div>
          )}

          <div className={`latency-bar ${latencyStatus}`}>
            <span className="tiny">Latencia relativa (<strong>{snapshot.relativeLabel}</strong>)</span>
            <div className="latency-track">
              <div className="latency-fill" style={{ width: `${latencyPercent}%` }} />
            </div>
            <p className="muted tiny">0 min = actualizado · {userThresholds.latency} min = umbral crítico</p>
          </div>

          {sparkline && sparklineChart && (
            <div className="realtime-sparkline">
              <div className="sparkline-meta">
                <span className="tiny">Intensidad últimas 24 h</span>
                <strong>{formatNumber(sparkline.latest, 1, 'mm/h')}</strong>
                <p className="muted tiny">
                  Pico reciente: {formatNumber(sparkline.peak, 1, 'mm/h')} · {sparkline.latestLabel}
                </p>
              </div>
              <div className="sparkline-chart">
                <Line data={sparklineChart.data} options={sparklineChart.options} height={60} />
                <p className="muted tiny sparkline-legend">Sólido: intensidad · Punteado: acumulado.</p>
              </div>
            </div>
          )}

          {timeline.length > 0 && (
            <div className="realtime-timeline">
              <h4>Eventos recientes</h4>
              <ul>
                {timeline.map((event) => (
                  <li key={event.id}>
                    <span className="timeline-time">{event.time}</span>
                    <div>
                      <strong>{event.label}</strong>
                      <p>{event.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">Ajusta el rango o la ubicación para ver datos en vivo.</div>
      )}

      {snapshot && (
        <div className="realtime-guide mt3">
          <div className="help-header">
            <strong>Cómo leer el monitoreo en vivo</strong>
            <button type="button" className="btn small" onClick={() => setGuideOpen((prev) => !prev)}>
              {guideOpen ? 'Ocultar guía' : 'Mostrar guía'}
            </button>
          </div>
          {guideOpen && (
            <ul className="help-steps">
              {LIVE_TIPS.map((tip) => (
                <li key={tip.title}>
                  <strong>{tip.title}:</strong> {tip.body}
                </li>
              ))}
            </ul>
          )}
        </div>
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
    latencyMinutes: relative.minutes,
    metrics: buildMetrics(latest),
    forecastTotal: forecast.total,
    forecastPeak: forecast.peak,
    hasForecast: forecast.count > 0,
    latest: {
      rain: typeof latest.prcp === 'number' ? latest.prcp : undefined,
      intensity: typeof latest.prcpRate === 'number' ? latest.prcpRate : undefined,
      temp: typeof latest.temp === 'number' ? latest.temp : typeof latest.apparentTemp === 'number' ? latest.apparentTemp : undefined,
      humidity: typeof latest.rh === 'number' ? latest.rh : undefined,
      wind: typeof latest.wind === 'number' ? latest.wind : undefined,
      pressure: typeof latest.pressure === 'number' ? latest.pressure : undefined,
    },
  };
}

function buildSparkline(series?: Series | null): Sparkline | null {
  if (!series || !Array.isArray(series.hourly) || !series.hourly.length) {
    return null;
  }
  const now = Date.now();
  const start = now - DAY_MS;
  const candidates = (series.hourly as Series['hourly'])
    .filter((point) => typeof point?.t === 'string')
    .map((point) => ({
      iso: point.t as string,
      value: typeof point.prcpRate === 'number' ? Number(point.prcpRate.toFixed(2)) : 0,
      rain: typeof point.prcp === 'number' ? Number(point.prcp.toFixed(2)) : 0,
    }))
    .filter((point) => {
      const stamp = Date.parse(point.iso);
      return Number.isFinite(stamp) && stamp >= start && stamp <= now;
    })
    .sort((a, b) => a.iso.localeCompare(b.iso));
  if (!candidates.length) return null;
  const windowed = candidates.slice(-24);
  const values = windowed.map((point) => point.value);
  const accumulated: number[] = [];
  let running = 0;
  windowed.forEach((point) => {
    running += point.rain;
    accumulated.push(Number(running.toFixed(2)));
  });
  const peak = values.reduce((max, value) => (value > max ? value : max), 0);
  const latest = values[values.length - 1] ?? 0;
  return {
    labels: windowed.map((point) => formatSparklineLabel(point.iso)),
    values,
    peak,
    latest,
    latestLabel: formatSparklineLabel(windowed[windowed.length - 1]?.iso),
    accumulated,
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

function formatRelativeLabel(timestamp: number, now: number): { label: string; isStale: boolean; minutes: number } {
  if (!Number.isFinite(timestamp)) {
    return { label: 'Fecha desconocida', isStale: true, minutes: 999 };
  }
  if (timestamp > now) {
    const minutesAhead = Math.round((timestamp - now) / 60000);
    return { label: `Próximo dato en ${minutesAhead} min`, isStale: false, minutes: 0 };
  }
  const minutesDiff = Math.max(0, Math.round((now - timestamp) / 60000));
  if (minutesDiff < 1) return { label: 'Actualizado hace instantes', isStale: false, minutes: minutesDiff };
  if (minutesDiff < 60) return { label: `Hace ${minutesDiff} min`, isStale: false, minutes: minutesDiff };
  const hours = minutesDiff / 60;
  return { label: `Hace ${hours.toFixed(1)} h`, isStale: minutesDiff > 180, minutes: minutesDiff };
}

function formatSparklineLabel(iso?: string): string {
  if (!iso) return 'sin fecha';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return date.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
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

type Alert = { id: string; label: string; message: string; tone: 'calm' | 'warn' | 'alert' };

function getLatencyStatus(minutes: number | undefined, threshold: number): 'calm' | 'warn' | 'alert' {
  if (minutes == null) return 'calm';
  if (minutes >= threshold * 1.5) return 'alert';
  if (minutes >= threshold) return 'warn';
  return 'calm';
}

function buildRealtimeAlerts(latest: SnapshotLatest | undefined, thresholds: UserThresholds): Alert[] {
  if (!latest) return [];
  const alerts: Alert[] = [];
  if (latest.rain != null && latest.rain >= 3) {
    alerts.push({
      id: 'rain',
      label: latest.rain >= 10 ? 'Lluvia fuerte' : 'Lluvia útil',
      tone: latest.rain >= 10 ? 'alert' : 'warn',
      message:
        latest.rain >= 10
          ? 'Considera pausar la entrada de maquinaria hasta que drene el lote.'
          : 'Humedece el suelo; verifica escorrentía en zonas bajas.',
    });
  }
  const intensityThreshold = thresholds?.intensity ?? DEFAULT_THRESHOLDS.intensity;
  if (latest.intensity != null && latest.intensity >= intensityThreshold) {
    alerts.push({
      id: 'intensity',
      label: 'Pico de intensidad',
      tone: 'alert',
      message: `Ráfagas >${intensityThreshold.toFixed(1)} mm/h; evita labores de aspersión o riego superficial.`,
    });
  }
  if (latest.temp != null) {
    if (latest.temp >= 32) {
      alerts.push({
        id: 'heat',
        label: 'Calor elevado',
        tone: 'warn',
        message: 'Prioriza sombra e hidratación para personal y ganado.',
      });
    } else if (latest.temp <= 16) {
      alerts.push({
        id: 'cool',
        label: 'Mañana fría',
        tone: 'calm',
        message: 'Protege viveros y planifica riegos más tarde para evitar shock térmico.',
      });
    }
  }
  if (latest.humidity != null) {
    if (latest.humidity >= 85) {
      alerts.push({
        id: 'humidity-high',
        label: 'Humedad alta',
        tone: 'warn',
        message: 'Favorece hongos; ventila invernaderos y monitorea cultivos sensibles.',
      });
    } else if (latest.humidity <= 40) {
      alerts.push({
        id: 'humidity-low',
        label: 'Ambiente seco',
        tone: 'warn',
        message: 'Incrementa la demanda hídrica y la presencia de polvo.',
      });
    }
  }
  if (latest.wind != null && latest.wind >= 9) {
    alerts.push({
      id: 'wind',
      label: 'Viento fuerte',
      tone: 'alert',
      message: 'Revisa estructuras ligeras y posterga aspersiones para evitar deriva.',
    });
  }
  return alerts.slice(0, 3);
}

function buildTimelineEvents(
  series: Series | null | undefined,
  sparkline: Sparkline | null,
  snapshot: Snapshot | null,
  thresholds: UserThresholds
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const now = Date.now();
  if (series?.hourly?.length) {
    const windowStart = now - DAY_MS;
    const ordered = (series.hourly as Series['hourly'])
      .filter((point) => point.t)
      .map((point) => ({ point, stamp: Date.parse(point.t ?? '') }))
      .filter(({ stamp }) => Number.isFinite(stamp) && stamp >= windowStart && stamp <= now)
      .sort((a, b) => (a.stamp ?? 0) - (b.stamp ?? 0));
    const intensityEvents = ordered.filter(
      ({ point }) => typeof point.prcpRate === 'number' && (point.prcpRate as number) >= thresholds.intensity
    );
    intensityEvents.slice(-3).forEach(({ point }) => {
      events.push({
        id: `int-${point.t}`,
        time: formatTimelineTime(point.t),
        label: 'Pico de intensidad',
        detail: `${formatNumber(point.prcpRate as number)} mm/h`,
      });
    });
    let dryStart: string | null = null;
    let dryCount = 0;
    ordered.forEach(({ point }) => {
      const rate = typeof point.prcpRate === 'number' ? point.prcpRate : 0;
      if (rate < 0.2) {
        if (!dryCount) dryStart = point.t ?? null;
        dryCount += 1;
      } else if (dryCount >= 3 && dryStart) {
        events.push({
          id: `dry-${dryStart}`,
          time: formatTimelineTime(dryStart),
          label: 'Ventana seca detectada',
          detail: `${dryCount} h por debajo de 0.2 mm/h`,
        });
        dryStart = null;
        dryCount = 0;
      } else {
        dryCount = 0;
        dryStart = null;
      }
    });
  }
  if (sparkline?.accumulated.length) {
    const total = sparkline.accumulated[sparkline.accumulated.length - 1] ?? 0;
    events.push({
      id: 'accum',
      time: sparkline.latestLabel,
      label: 'Acumulado 24 h',
      detail: `${formatNumber(total, 1, 'mm')} registrados en las últimas 24 h.`,
    });
  }
  if (snapshot?.hasForecast && snapshot.forecastPeak >= thresholds.intensity) {
    events.push({
      id: 'forecast',
      time: 'Próximas horas',
      label: 'Pico proyectado',
      detail: `Se esperan ${formatNumber(snapshot.forecastPeak, 1, 'mm/h')} en las próximas 24 h.`,
    });
  }
  return events.slice(-5).reverse();
}

function formatTimelineTime(iso?: string): string {
  if (!iso) return 'sin fecha';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

