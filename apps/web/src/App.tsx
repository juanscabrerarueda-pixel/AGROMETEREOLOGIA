import { useMemo, useState } from 'react';
import type { Series } from '@pkg/core';
import './App.css';
import { FEATURE_AGROMETEO } from './config/flags';
import { useSeries } from './hooks/useSeries';
import { useInsights } from './hooks/useInsights';
import { useThresholds } from './state/thresholds';
import {
  PrecipitationChart,
  type AggregatedPoint,
  type TrendPoint,
} from './components/PrecipitationChart';
import { HourlyHeatmap } from './components/HourlyHeatmap';
import { RealtimePanel } from './components/RealtimePanel';
import { DEPARTMENT_OPTIONS } from './data/locations';

type Metric = 'accumulated' | 'intensity';
type TrendType = 'MA' | 'EMA';
type RangeKey = 'threeMonths' | 'oneYear' | 'fiveYears' | 'future';
type RangeSelection = RangeKey | 'custom';
type RefreshKey = '1m' | '5m' | '15m';

type RangeOption = {
  id: RangeKey;
  label: string;
  days: number;
  future?: boolean;
  description: string;
};

type DateRange = { from: string; to: string };

type ChartSummary = {
  points: AggregatedPoint[];
  totalRain: number;
  average: number;
  maxValue: number;
  maxValueDate?: string;
  count: number;
  firstDate?: string;
  lastDate?: string;
};

type Kpi = { id: string; label: string; value: string; note?: string };

type RefreshOption = {
  id: RefreshKey;
  label: string;
  intervalMs: number;
  description: string;
};

const REFRESH_OPTIONS: RefreshOption[] = [
  {
    id: '1m',
    label: '1 min',
    intervalMs: 60 * 1000,
    description: 'Actualiza casi en tiempo real (ideal para vigilar tormentas).',
  },
  {
    id: '5m',
    label: '5 min',
    intervalMs: 5 * 60 * 1000,
    description: 'Balance entre latencia y consumo de API.',
  },
  {
    id: '15m',
    label: '15 min',
    intervalMs: 15 * 60 * 1000,
    description: 'Intervalo relajado para monitoreo de fondo.',
  },
];

const RANGE_OPTIONS: RangeOption[] = [
  {
    id: 'threeMonths',
    label: 'Últimos 3 meses',
    days: 90,
    description: 'Observa la evolución reciente (aprox. último trimestre).',
  },
  {
    id: 'oneYear',
    label: 'Último año',
    days: 365,
    description: 'Analiza cómo cerró el último año hídrico completo.',
  },
  {
    id: 'fiveYears',
    label: 'Últimos 5 años',
    days: 365 * 5,
    description: 'Identifica tendencias multianuales y cambios estructurales.',
  },
  {
    id: 'future',
    label: 'Próx. 14 días',
    days: 14,
    future: true,
    description: 'Pronóstico inmediato (sin línea de tendencia).',
  },
];

const METRIC_OPTIONS: Array<{ id: Metric; label: string; helper: string }> = [
  { id: 'accumulated', label: 'Acumulado diario', helper: 'Suma mm por día (precipitación acumulada).' },
  { id: 'intensity', label: 'Intensidad (mm/h)', helper: 'Pico horario diario (mm/h) como proxy de intensidad.' },
];

const TREND_OPTIONS: Array<{ id: TrendType; label: string; helper: string }> = [
  { id: 'MA', label: 'MA', helper: 'Media móvil con ventana fija.' },
  { id: 'EMA', label: 'EMA', helper: 'Media móvil exponencial (pondera lo reciente).' },
];

const DEFAULT_DEPARTMENT = DEPARTMENT_OPTIONS[0];
const DEFAULT_DEPARTMENT_VALUE = DEFAULT_DEPARTMENT?.value ?? '';
const DEFAULT_MUNICIPALITY_VALUE = DEFAULT_DEPARTMENT?.municipalities[0]?.value ?? '';
const WINDOW_BY_RANGE: Record<RangeKey, number> = {
  threeMonths: 7,
  oneYear: 30,
  fiveYears: 60,
  future: 7,
};

export default function App() {
  if (!FEATURE_AGROMETEO) {
    return (
      <main className="wrap">
        <section className="card">
          <h1>Panel agrometeorológico</h1>
          <p>Activa la variable VITE_FEATURE_AGROMETEO para visualizar este tablero.</p>
        </section>
      </main>
    );
  }

  const { thresholds } = useThresholds();

  const [selectedDept, setSelectedDept] = useState<string>(DEFAULT_DEPARTMENT_VALUE);
  const [selectedMuni, setSelectedMuni] = useState<string>(DEFAULT_MUNICIPALITY_VALUE);
  const [metric, setMetric] = useState<Metric>('accumulated');
  const [trendType, setTrendType] = useState<TrendType>('EMA');
  const [showTrend, setShowTrend] = useState(true);
  const [helpHidden, setHelpHidden] = useState(false);
  const [rangeSelection, setRangeSelection] = useState<RangeSelection>('threeMonths');
  const [range, setRange] = useState<DateRange>(() => buildRange(RANGE_OPTIONS[0]));
  const [refreshRate, setRefreshRate] = useState<RefreshKey>('1m');

  const currentDepartment =
    DEPARTMENT_OPTIONS.find((option) => option.value === selectedDept) ?? DEPARTMENT_OPTIONS[0];
  const municipalities = currentDepartment?.municipalities ?? [];

  const activeRangeOption =
    rangeSelection === 'custom'
      ? undefined
      : RANGE_OPTIONS.find((option) => option.id === rangeSelection);
  const isFutureRange = activeRangeOption?.future ?? false;
  const refreshConfig = REFRESH_OPTIONS.find((item) => item.id === refreshRate) ?? REFRESH_OPTIONS[0];
  const refetchInterval = refreshConfig.intervalMs;

  const seriesParams = useMemo(
    () => ({
      depto: selectedDept,
      muni: selectedMuni || undefined,
      from: range.from,
      to: range.to,
      fields: ['prcp', 'prcpRate', 'temp', 'rh', 'wind', 'rs', 'pressure'],
    }),
    [range.from, range.to, selectedDept, selectedMuni]
  );

  const series = useSeries(seriesParams, {
    queryOptions: {
      refetchInterval,
      refetchIntervalInBackground: true,
      staleTime: Math.max(30000, refetchInterval / 2),
    },
  });
  const insights = useInsights(seriesParams, thresholds, {
    enabled: series.isSuccess,
    queryOptions: {
      refetchInterval,
      refetchIntervalInBackground: true,
      staleTime: refetchInterval,
    },
  });
  const busy = series.isFetching || insights.isFetching;

  const aggregated = useMemo<ChartSummary>(() => aggregateSeries(series.data, metric), [
    metric,
    series.data,
  ]);

  const trendPoints = useMemo(() => {
    if (!showTrend || isFutureRange || !aggregated.points.length) {
      return null;
    }
    const window =
      rangeSelection === 'custom'
        ? inferWindowFromRange(range)
        : WINDOW_BY_RANGE[rangeSelection as RangeKey];
    return computeTrend(aggregated.points, window, trendType);
  }, [aggregated.points, isFutureRange, range, rangeSelection, showTrend, trendType]);

  const trendInfo = useMemo(() => summarizeTrend(trendPoints), [trendPoints]);
  const kpis = useMemo(
    () => buildKpis(aggregated, metric, trendPoints, range, rangeSelection, activeRangeOption, trendInfo),
    [activeRangeOption, aggregated, metric, range, rangeSelection, trendInfo, trendPoints]
  );

  const rangeSummary = formatRangeSummary(range);
  const chartNarrative = useMemo(
    () => buildChartNarrative(aggregated, metric, rangeSummary, series.data, trendInfo),
    [aggregated, metric, rangeSummary, series.data, trendInfo]
  );

  const handleRangePreset = (option: RangeOption) => {
    setRangeSelection(option.id);
    setRange(buildRange(option));
    if (option.future) {
      setShowTrend(false);
    }
  };

  const handleDeptChange = (value: string) => {
    const option =
      DEPARTMENT_OPTIONS.find((item) => item.value === value) ?? DEPARTMENT_OPTIONS[0];
    setSelectedDept(option.value);
    setSelectedMuni(option.municipalities[0]?.value ?? '');
  };

  const handleMuniChange = (value: string) => {
    setSelectedMuni(value);
  };

  const handleFromChange = (value: string) => {
    if (!isValidDate(value)) return;
    setRangeSelection('custom');
    setRange((prev) => normalizeRange({ from: value, to: prev.to }));
  };

  const handleToChange = (value: string) => {
    if (!isValidDate(value)) return;
    setRangeSelection('custom');
    setRange((prev) => normalizeRange({ from: prev.from, to: value }));
  };

  const metricHelper = METRIC_OPTIONS.find((option) => option.id === metric)?.helper ?? '';

  return (
    <main className="wrap">
      <header className="mb4 intro">
        <p className="tagline">Tendencias de lluvia en Colombia</p>
        <h1>Panel agrometeorológico</h1>
        <p className="muted">
          Filtra por departamento y municipio, alterna entre acumulados o intensidad diaria y usa la
          línea de tendencia para resumir comportamientos. El mapa horario te ayuda a encontrar
          ventanas secas o picos concentrados.
        </p>
      </header>

      <section className="card help mb4">
        <div className="help-header">
          <strong>Cómo usar</strong>
          <button
            type="button"
            className="btn small"
            onClick={() => setHelpHidden((prev) => !prev)}
          >
            {helpHidden ? 'Mostrar guía' : 'Ocultar guía'}
          </button>
        </div>
        {!helpHidden && (
          <ol className="help-steps">
            <li>
              Elige un departamento y opcionalmente un municipio para la serie local (por defecto usa
              la capital).
            </li>
            <li>
              Ajusta el rango rápido (3 meses, 1 año, 5 años o 14 días de pronóstico). También puedes
              fijar fechas manualmente.
            </li>
            <li>
              Alterna entre acumulado diario o intensidad máxima, y activa MA/EMA para suavizar la
              serie histórica.
            </li>
            <li>
              Usa la distribución horaria para detectar ventanas secas y revisa los insights
              automáticos para recomendaciones puntuales.
            </li>
          </ol>
        )}
      </section>

      <section className="card controls mb4">
        <div className="row">
          <label className="field">
            <span>Departamento</span>
            <select value={selectedDept} onChange={(event) => handleDeptChange(event.target.value)}>
              {DEPARTMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Municipio / ciudad</span>
            <select value={selectedMuni} onChange={(event) => handleMuniChange(event.target.value)}>
              {municipalities.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Desde</span>
            <input type="date" value={range.from} onChange={(event) => handleFromChange(event.target.value)} />
          </label>

          <label className="field">
            <span>Hasta</span>
            <input type="date" value={range.to} onChange={(event) => handleToChange(event.target.value)} />
          </label>
        </div>

        <div className="seg mt2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`btn ${rangeSelection === option.id ? 'active' : ''}`}
              onClick={() => handleRangePreset(option)}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            className={`btn small ${rangeSelection === 'custom' ? 'active' : ''}`}
            onClick={() => setRangeSelection('custom')}
            title="Edita las fechas para definir tu rango personalizado."
          >
            Personalizado
          </button>
        </div>

        <div className="seg mt2">
          {METRIC_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`btn ${metric === option.id ? 'active' : ''}`}
              onClick={() => setMetric(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="row gap mt2">
          <button
            type="button"
            className="btn small"
            onClick={() => setShowTrend((prev) => !prev)}
            disabled={isFutureRange}
            title={isFutureRange ? 'La tendencia no aplica a pronósticos futuros' : ''}
          >
            {showTrend ? 'Ocultar tendencia' : 'Ver tendencia'}
          </button>
          <div className="seg compact">
            {TREND_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`btn small ${trendType === option.id ? 'active' : ''}`}
                disabled={isFutureRange}
                onClick={() => setTrendType(option.id)}
                title={option.helper}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <p className="muted tiny mt2">
          {metricHelper} {activeRangeOption ? `- ${activeRangeOption.description}` : ''}
        </p>

        <div className="refresh-controls mt2">
          <span className="tiny">Actualización automática</span>
          <div className="seg compact">
            {REFRESH_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`btn small ${refreshRate === option.id ? 'active' : ''}`}
                onClick={() => setRefreshRate(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="muted tiny">{refreshConfig.description}</p>
        </div>
      </section>

      <RealtimePanel series={series.data} busy={series.isFetching} />

      <section className="card chart-card mb4">
        <div className={`busy ${busy ? 'on' : ''}`}>
          <div className="busy-pill">
            <span className="spin" />
            <span>Actualizando datos...</span>
          </div>
        </div>

        <div className="section-header">
          <div>
            <h2>Serie diaria</h2>
            <p className="muted tiny">
              {rangeSummary} - {metric === 'intensity' ? 'Intensidad maxima por dia' : 'Acumulado diario (mm)'}
            </p>
          </div>
          <div className="series-meta tiny">
            {series.data?.meta?.source && <span>Fuente: {series.data.meta.source}</span>}
            {series.data?.meta?.tz && <span>TZ: {series.data.meta.tz}</span>}
            <span>Registros: {aggregated.count.toLocaleString('es-CO')}</span>
          </div>
        </div>

        {series.error && (
          <div className="error-banner mb3">
            <strong>No fue posible actualizar la serie.</strong>
            <p>
              {series.error.message || 'No pudimos contactar la API. Revisa tu conexión o intenta nuevamente.'}
            </p>
          </div>
        )}

        <PrecipitationChart points={aggregated.points} trend={trendPoints} metric={metric} />

        <div className="kpis mt3">
          {kpis.map((item) => (
            <div key={item.id} className="kpi">
              <span className="kcap">{item.label}</span>
              <span className="kval">{item.value}</span>
              {item.note && <span className="ksub">{item.note}</span>}
            </div>
          ))}
        </div>
        {chartNarrative && <p className="chart-narrative">{chartNarrative}</p>}
      </section>

      <section className="card mb4">
        <div className="section-header">
          <div>
            <h2>Distribución horaria</h2>
            <p className="muted tiny">
              Identifica horarios con lluvia o ventanas secas (intensidad en mm/h).
            </p>
          </div>
        </div>
        <div className="hourlyWrap">
          <HourlyHeatmap series={series.data} variable="prcpRate" />
        </div>
      </section>

      <section className="card insights">
        <div className="section-header">
          <div>
            <h2>Insights automatizados</h2>
            <p className="muted tiny">
              Basados en umbrales de impacto y cálculos del paquete insight-engine.
            </p>
          </div>
        </div>
        {insights.error ? (
          <div className="error-banner">
            <strong>No fue posible generar insights.</strong>
            <p>
              {insights.error.message ||
                'No logramos conectar con la API de insights. Vuelve a intentarlo cuando tengas conexión estable.'}
            </p>
          </div>
        ) : insights.data ? (
          insights.data.insights.length ? (
            <ul className="insights-list">
              {insights.data.insights.map((insight) => (
                <li key={insight.id} className="insight-item">
                  <strong>{insight.kind}</strong>
                  <p>{insight.text}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              Sin hallazgos relevantes con los umbrales actuales. Ajústalos para más sensibilidad.
            </div>
          )
        ) : (
          <div className="skeleton">
            <div className="skeleton-bar" />
            <div className="skeleton-bar" />
            <div className="skeleton-bar" />
          </div>
        )}
      </section>
    </main>
  );
}

function buildRange(option: RangeOption): DateRange {
  const today = startOfDay(new Date());
  if (option.future) {
    return {
      from: formatISO(today),
      to: formatISO(addDays(today, option.days)),
    };
  }
  const to = formatISO(today);
  const from = formatISO(addDays(today, -(option.days - 1)));
  return { from, to };
}

function normalizeRange(value: DateRange): DateRange {
  if (!isValidDate(value.from) || !isValidDate(value.to)) {
    return value;
  }
  if (value.from <= value.to) return value;
  return { from: value.to, to: value.from };
}

function isValidDate(value: string): boolean {
  if (!value) return false;
  const time = Date.parse(value);
  return Number.isFinite(time);
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, amount: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function formatISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatChartLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.getUTCDate().toString().padStart(2, '0');
  const month = MONTHS_SHORT[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function formatDisplayDate(iso?: string): string {
  if (!iso) return 'Sin dato';
  return formatChartLabel(iso);
}

function formatRangeSummary(range: DateRange): string {
  return `${formatDisplayDate(range.from)} -> ${formatDisplayDate(range.to)}`;
}

function aggregateSeries(series: Series | undefined, metric: Metric): ChartSummary {
  if (!series || !Array.isArray(series.hourly) || !series.hourly.length) {
    return {
      points: [],
      totalRain: 0,
      average: 0,
      maxValue: 0,
      count: 0,
    };
  }

  const buckets = new Map<
    string,
    { rain: number; intensity: number; isForecast: boolean }
  >();
  const now = Date.now();

  for (const point of series.hourly) {
    const key = point.t?.slice(0, 10);
    if (!key) continue;
    const bucket = buckets.get(key) ?? { rain: 0, intensity: 0, isForecast: false };
    if (typeof point.prcp === 'number') {
      bucket.rain += point.prcp;
    }
    if (typeof point.prcpRate === 'number' && point.prcpRate > bucket.intensity) {
      bucket.intensity = point.prcpRate;
    }
    if (!bucket.isForecast && new Date(point.t).getTime() > now) {
      bucket.isForecast = true;
    }
    buckets.set(key, bucket);
  }

  const dates = Array.from(buckets.keys()).sort();
  const points: AggregatedPoint[] = dates.map((date) => {
    const bucket = buckets.get(date)!;
    const value = metric === 'intensity' ? bucket.intensity : bucket.rain;
    return {
      date,
      label: formatChartLabel(date),
      value,
      isForecast: bucket.isForecast,
    };
  });

  const totalRain = dates.reduce((sum, date) => sum + (buckets.get(date)?.rain ?? 0), 0);
  const values = points.map((p) => p.value);
  const maxValue = values.length ? Math.max(...values) : 0;
  const maxValueDate = maxValue > 0 ? points.find((p) => p.value === maxValue)?.date : undefined;
  const count = points.length;
  const average = count ? values.reduce((sum, v) => sum + v, 0) / count : 0;

  return {
    points,
    totalRain,
    average,
    maxValue,
    maxValueDate,
    count,
    firstDate: dates[0],
    lastDate: dates[count - 1],
  };
}

function computeTrend(points: AggregatedPoint[], window: number, trendType: TrendType): TrendPoint[] {
  if (!points.length || window <= 1) return [];
  const values = points.map((p) => p.value);
  const raw =
    trendType === 'EMA'
      ? exponentialMovingAverage(values, window)
      : movingAverage(values, window);
  const result: TrendPoint[] = [];
  raw.forEach((value, index) => {
    if (Number.isFinite(value)) {
      result.push({ index, value });
    }
  });
  return result;
}

function movingAverage(values: number[], window: number): number[] {
  const out = new Array(values.length).fill(Number.NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) {
      sum -= values[i - window];
    }
    if (i >= window - 1) {
      out[i] = sum / window;
    }
  }
  return out;
}

function exponentialMovingAverage(values: number[], window: number): number[] {
  const out = new Array(values.length).fill(Number.NaN);
  if (!values.length) return out;
  const alpha = 2 / (window + 1);
  let prev = values[0];
  out[0] = prev;
  for (let i = 1; i < values.length; i++) {
    prev = alpha * values[i] + (1 - alpha) * prev;
    out[i] = prev;
  }
  return out;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function inferWindowFromRange(range: DateRange): number {
  const from = Date.parse(range.from);
  const to = Date.parse(range.to);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 30;
  const diffDays = Math.max(1, Math.round((to - from) / MS_PER_DAY) + 1);
  if (diffDays <= 120) return 7;
  if (diffDays <= 550) return 30;
  return 60;
}

function buildKpis(
  summary: ChartSummary,
  metric: Metric,
  trend: TrendPoint[] | null,
  range: DateRange,
  selection: RangeSelection,
  activeRange: RangeOption | undefined,
  trendInfo: { value: string; note: string }
): Kpi[] {
  const unit = metric === 'intensity' ? 'mm/h' : 'mm';
  const averageUnit = metric === 'intensity' ? 'mm/h' : 'mm';
  const rangeLabel = selection === 'custom' ? formatRangeSummary(range) : activeRange?.label ?? formatRangeSummary(range);

  return [
    {
      id: 'max',
      label: metric === 'intensity' ? 'Máximo registrado' : 'Máximo diario',
      value: `${formatNumber(summary.maxValue)} ${unit}`,
      note: formatDisplayDate(summary.maxValueDate),
    },
    {
      id: 'avg',
      label: 'Promedio diario',
      value: `${formatNumber(summary.average)} ${averageUnit}`,
      note: `${summary.count.toLocaleString('es-CO')} días analizados`,
    },
    {
      id: 'trend',
      label: 'Tendencia',
      value: trendInfo.value,
      note: trendInfo.note,
    },
    {
      id: 'series',
      label: 'Serie usada',
      value: metric === 'intensity' ? 'Intensidad (mm/h)' : 'Acumulado (mm)',
      note: rangeLabel,
    },
  ];
}
function summarizeTrend(trend: TrendPoint[] | null): { value: string; note: string } {
  if (!trend || !trend.length) {
    return {
      value: 'Sin datos',
      note: 'Activa MA o EMA para calcular la tendencia histórica.',
    };
  }
  const first = trend.find((item) => Number.isFinite(item.value));
  const last = [...trend].reverse().find((item) => Number.isFinite(item.value));
  if (!first || !last) {
    return {
      value: 'Sin datos',
      note: 'Necesitamos más puntos para calcular la tendencia.',
    };
  }
  const diff = last.value - first.value;
  const base = Math.abs(first.value) < 1e-6 ? 1 : Math.abs(first.value);
  const pct = (diff / base) * 100;
  let label = 'Estable';
  if (pct > 5) label = 'Al alza';
  else if (pct < -5) label = 'A la baja';
  return {
    value: label,
    note: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% respecto al inicio`,
  };
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString('es-CO', { maximumFractionDigits: 2 }) : '0';
}

function buildChartNarrative(
  summary: ChartSummary,
  metric: Metric,
  rangeLabel: string,
  series: Series | undefined,
  trendInfo: { value: string; note: string }
): string {
  if (!summary.count) {
    return '';
  }

  const parts: string[] = [];
  if (metric === 'accumulated') {
    parts.push(
      `Entre ${rangeLabel} se acumularon ${formatNumber(summary.totalRain)} mm distribuidos en ${summary.count} días con datos.`
    );
    if (summary.maxValueDate) {
      parts.push(
        `El día más lluvioso fue ${formatDisplayDate(summary.maxValueDate)}, cuando se registraron ${formatNumber(summary.maxValue)} mm en 24 horas.`
      );
    }
  } else {
    parts.push(`Analizamos ${summary.count} días de intensidades entre ${rangeLabel}.`);
    if (summary.maxValueDate) {
      parts.push(
        `La ráfaga máxima ocurrió el ${formatDisplayDate(summary.maxValueDate)} y alcanzó ${formatNumber(summary.maxValue)} mm/h.`
      );
    }
  }

  if (trendInfo.value !== 'Sin datos') {
    parts.push(`La serie suavizada indica un comportamiento ${trendInfo.value.toLowerCase()} (${trendInfo.note}).`);
  }

  if (series?.meta?.source) {
    const tzNote = series.meta.tz ? `, zona ${series.meta.tz}` : '';
    parts.push(`Fuente: ${series.meta.source}${tzNote}.`);
  }

  return parts.join(' ');
}





