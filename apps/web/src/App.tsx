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
import { DailyHeatmap, type DailyDatum } from './components/DailyHeatmap';
import { RealtimePanel } from './components/RealtimePanel';
import { AgroPanels } from './components/AgroPanels';
import { DEPARTMENT_OPTIONS, type DepartmentOption } from './data/locations';

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

type Kpi = { id: string; label: string; value: string; note?: string; badge?: KPIBadge };
type KPIBadge = { label: string; tone?: 'warn' | 'alert' };
type SectorNarratives = { agriculture: string; livestock: string; energy: string };

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
    label: 'Ãšltimos 3 meses',
    days: 90,
    description: 'Observa la evoluciÃ³n reciente (aprox. Ãºltimo trimestre).',
  },
  {
    id: 'oneYear',
    label: 'Ãšltimo aÃ±o',
    days: 365,
    description: 'Analiza cÃ³mo cerrÃ³ el Ãºltimo aÃ±o hÃ­drico completo.',
  },
  {
    id: 'fiveYears',
    label: 'Ãšltimos 5 aÃ±os',
    days: 365 * 5,
    description: 'Identifica tendencias multianuales y cambios estructurales.',
  },
  {
    id: 'future',
    label: 'PrÃ³x. 14 dÃ­as',
    days: 14,
    future: true,
    description: 'PronÃ³stico inmediato (sin lÃ­nea de tendencia).',
  },
];

const METRIC_OPTIONS: Array<{ id: Metric; label: string; helper: string }> = [
  { id: 'accumulated', label: 'Acumulado diario', helper: 'Suma mm por dÃ­a (precipitaciÃ³n acumulada).' },
  { id: 'intensity', label: 'Intensidad (mm/h)', helper: 'Pico horario diario (mm/h) como proxy de intensidad.' },
];

const TREND_OPTIONS: Array<{ id: TrendType; label: string; helper: string }> = [
  { id: 'MA', label: 'MA', helper: 'Media mÃ³vil con ventana fija.' },
  { id: 'EMA', label: 'EMA', helper: 'Media mÃ³vil exponencial (pondera lo reciente).' },
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
          <h1>Panel agrometeorolÃ³gico</h1>
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
      fields: [
        'prcp',
        'prcpRate',
        'temp',
        'rh',
        'wind',
        'rs',
        'pressure',
        'soilTemp0',
        'soilTemp18',
        'soilTemp54',
        'soilMoist1',
        'soilMoist3',
        'soilMoist9',
        'soilMoist27',
        'evap',
        'apparentTemp',
      ],
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
  const dailyData = useMemo(() => buildDailyData(series.data), [series.data]);
  const metaSummary = useMemo(
    () => buildMetaSummary(series.data, metric, currentDepartment, selectedMuni),
    [series.data, metric, currentDepartment, selectedMuni]
  );
  const quickImpact = useMemo(() => buildImpactNarrative(aggregated, metric), [aggregated, metric]);
  const sectorNarratives = useMemo(
    () => buildSectorNarratives(aggregated, series.data, metric),
    [aggregated, series.data, metric]
  );

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
        <h1>Panel agrometeorolÃ³gico</h1>
        <p className="muted">
          Filtra por departamento y municipio, alterna entre acumulados o intensidad diaria y usa la
          lÃ­nea de tendencia para resumir comportamientos. El mapa horario te ayuda a encontrar
          ventanas secas o picos concentrados.
        </p>
      </header>

      <section className="card help mb4">
        <div className="help-header">
          <strong>CÃ³mo usar</strong>
          <button
            type="button"
            className="btn small"
            onClick={() => setHelpHidden((prev) => !prev)}
          >
            {helpHidden ? 'Mostrar guÃ­a' : 'Ocultar guÃ­a'}
          </button>
        </div>
        {!helpHidden && (
          <ol className="help-steps">
            <li>
              Elige un departamento y opcionalmente un municipio para la serie local (por defecto usa
              la capital).
            </li>
            <li>
              Ajusta el rango rÃ¡pido (3 meses, 1 aÃ±o, 5 aÃ±os o 14 dÃ­as de pronÃ³stico). TambiÃ©n puedes
              fijar fechas manualmente.
            </li>
            <li>
              Alterna entre acumulado diario o intensidad mÃ¡xima, y activa MA/EMA para suavizar la
              serie histÃ³rica.
            </li>
            <li>
              Usa la distribuciÃ³n horaria para detectar ventanas secas y revisa los insights
              automÃ¡ticos para recomendaciones puntuales.
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
            title={isFutureRange ? 'La tendencia no aplica a pronÃ³sticos futuros' : ''}
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
          <span className="tiny">ActualizaciÃ³n automÃ¡tica</span>
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
              {series.error.message || 'No pudimos contactar la API. Revisa tu conexiÃ³n o intenta nuevamente.'}
            </p>
          </div>
        )}

        {metaSummary && (
          <div className="meta-panel">
            <div className="meta-item">
              <strong>Ultima actualizacion</strong>
              <span>{metaSummary.updated}</span>
            </div>
            <div className="meta-item">
              <strong>Ubicacion</strong>
              <span>{metaSummary.location}</span>
            </div>
            <div className="meta-item">
              <strong>Fuente</strong>
              <span>{metaSummary.source}</span>
            </div>
            <div className="meta-item">
              <strong>Unidad</strong>
              <span>{metaSummary.unit}</span>
            </div>
          </div>
        )}

        <PrecipitationChart points={aggregated.points} trend={trendPoints} metric={metric} />

        <div className="mt3">
          <DailyHeatmap daily={dailyData} metric={metric} />
          <details className="glossary">
            <summary>Como leer la intensidad</summary>
            <ul>
              <li>0-5 mm: Llovizna ligera, humedece sin generar escorrentia.</li>
              <li>5-20 mm: Lluvia moderada, posible pausa corta en labores.</li>
              <li>20-60 mm: Temporal, suelos saturados y riesgo de charcos.</li>
              <li>{'> 60'} mm: Evento fuerte, probables anegamientos y retrasos.</li>
            </ul>
          </details>
        </div>

        <div className="kpis mt3">
          {kpis.map((item) => (
            <div key={item.id} className="kpi">
              <span className="kcap">{item.label}</span>
              <span className="kval">
                {item.value}
                {item.badge && (
                  <span className={`badge ${item.badge.tone ?? ''}`.trim()}>{item.badge.label}</span>
                )}
              </span>
              {item.note && <span className="ksub">{item.note}</span>}
            </div>
          ))}
        </div>
        {(chartNarrative || quickImpact) && (
          <div className="narrative-card">
            {quickImpact && (
              <p>
                <strong>Lectura rapida:</strong> {quickImpact}
              </p>
            )}
            {chartNarrative && <p className="chart-narrative">{chartNarrative}</p>}
          </div>
        )}
      </section>

      <section className="card mb4">
        <div className="section-header">
          <div>
            <h2>Condiciones agroenergeticas</h2>
            <p className="muted tiny">
              Temperatura y humedad del suelo, ET0, radiacion y viento para apoyar ganaderos,
              agricultores y generacion renovable.
            </p>
          </div>
        </div>
        <AgroPanels series={series.data} />
        <details className="glossary mt2">
          <summary>Como leer estas variables</summary>
          <ul>
            <li>Temp. ambiente 18-32 C: confortable. &lt;15 C implica amaneceres frios y &gt;32 C demanda sombra e hidratacion.</li>
            <li>Sensacion termica &gt;35 C: riesgo de estres para personal y ganado.</li>
            <li>Humedad relativa &lt;40 %: ambiente seco, incrementa demanda hidrica; &gt;85 % favorece hongos.</li>
            <li>Lluvia 24h: &lt;5 mm se absorbe rapido; &gt;30 mm provoca charcos y compactacion.</li>
            <li>ET0 &gt;4 mm indica alta demanda de riego. Radiacion &gt;4 kWh/m2 favorece la generacion solar.</li>
          </ul>
        </details>
      </section>

      <section className="card mb4">
        <div className="section-header">
          <div>
            <h2>DistribuciÃ³n horaria</h2>
            <p className="muted tiny">
              Identifica horarios con lluvia o ventanas secas (intensidad en mm/h).
            </p>
          </div>
        </div>
        <div className="hourlyWrap">
          <HourlyHeatmap series={series.data} variable="prcpRate" />
        </div>
        <details className="glossary mt2">
          <summary>Como leer la distribucion</summary>
          <ul>
            <li>Bandas intensas al amanecer indican suelos saturados: retrasa la entrada de maquinaria.</li>
            <li>Bloques continuos &gt;60 % señalan varios dias lluviosos. Busca ventanas palidas (&lt;30 %) para labores criticas.</li>
            <li>Celdas claras aisladas equivalen a horas de baja probabilidad, ideales para riego o mantenimiento.</li>
          </ul>
        </details>
      </section>

      <section className="card insights">
        <div className="section-header">
          <div>
            <h2>Insights automatizados</h2>
            <p className="muted tiny">
              Basados en umbrales de impacto y cÃ¡lculos del paquete insight-engine.
            </p>
          </div>
        </div>
        {sectorNarratives && (
          <div className="sector-insights">
            <div>
              <strong>Agricultura</strong>
              <p>{sectorNarratives.agriculture}</p>
            </div>
            <div>
              <strong>Ganaderia</strong>
              <p>{sectorNarratives.livestock}</p>
            </div>
            <div>
              <strong>Energias renovables</strong>
              <p>{sectorNarratives.energy}</p>
            </div>
          </div>
        )}
        {insights.error ? (
          <div className="error-banner">
            <strong>No fue posible generar insights.</strong>
            <p>
              {insights.error.message ||
                'No logramos conectar con la API de insights. Vuelve a intentarlo cuando tengas conexiÃ³n estable.'}
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
              Sin hallazgos relevantes con los umbrales actuales. AjÃºstalos para mÃ¡s sensibilidad.
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

function buildDailyData(series: Series | undefined): DailyDatum[] {
  if (!series || !Array.isArray(series.hourly)) return [];
  const buckets = new Map<
    string,
    {
      rain: number;
      solar: number;
      wind: number;
      windCount: number;
      apparent: number;
      apparentCount: number;
    }
  >();

  for (const point of series.hourly) {
    const day = point.t?.slice(0, 10);
    if (!day) continue;
    const bucket =
      buckets.get(day) ??
      buckets.set(day, { rain: 0, solar: 0, wind: 0, windCount: 0, apparent: 0, apparentCount: 0 }).get(day)!;
    if (typeof point.prcp === 'number') bucket.rain += point.prcp;
    if (typeof point.rs === 'number') bucket.solar += point.rs;
    if (typeof point.wind === 'number') {
      bucket.wind += point.wind;
      bucket.windCount += 1;
    }
    const apparent = typeof point.apparentTemp === 'number' ? point.apparentTemp : point.temp;
    if (typeof apparent === 'number') {
      bucket.apparent += apparent;
      bucket.apparentCount += 1;
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => {
      const solarKwh = bucket.solar / 1000;
      const windMean = bucket.windCount ? bucket.wind / bucket.windCount : null;
      const apparentMean = bucket.apparentCount ? bucket.apparent / bucket.apparentCount : null;
      const icons: string[] = [];
      if (solarKwh >= 6) icons.push('â˜€');
      if (windMean != null && windMean >= 8) icons.push('ðŸ’¨');
      if (apparentMean != null && apparentMean >= 32) icons.push('ðŸ”¥');
      return {
        date,
        label: formatDisplayDate(date),
        value: Number(bucket.rain.toFixed(2)),
        icons,
      };
    });
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
const MS_PER_HOUR = 60 * 60 * 1000;

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
      label: metric === 'intensity' ? 'MÃ¡ximo registrado' : 'MÃ¡ximo diario',
      value: `${formatNumber(summary.maxValue)} ${unit}`,
      note: formatDisplayDate(summary.maxValueDate),
    },
    {
      id: 'avg',
      label: 'Promedio diario',
      value: `${formatNumber(summary.average)} ${averageUnit}`,
      note: `${summary.count.toLocaleString('es-CO')} dÃ­as analizados`,
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

function buildMetaSummary(
  series: Series | undefined,
  metric: Metric,
  department: DepartmentOption | undefined,
  selectedMuni: string
): { updated: string; location: string; source: string; unit: string } | null {
  if (!series) return null;
  const hourly = (series.hourly as Series['hourly']) ?? [];
  const lastTimestamp = hourly.length ? hourly[hourly.length - 1]?.t : series.range?.to;
  const updated = formatDisplayDate(lastTimestamp) || 'â€”';
  const muniLabel = department?.municipalities.find((item) => item.value === selectedMuni)?.label;
  const location = [muniLabel, department?.label].filter(Boolean).join(' Â· ') || department?.label || 'â€”';
  return {
    updated,
    location,
    source: series.meta?.source ?? 'Open-Meteo',
    unit: metric === 'intensity' ? 'mm/h' : 'mm',
  };
}

function buildImpactNarrative(summary: ChartSummary, metric: Metric): string | null {
  if (!summary.count) return null;
  const badge = buildIntensityBadge(summary.maxValue, metric);
  if (!badge) return null;
  const unit = metric === 'intensity' ? 'mm/h' : 'mm';
  const impact = impactFromBadge(badge.label);
  return `Acumulado ${formatNumber(summary.totalRain)} mm en ${summary.count.toLocaleString(
    'es-CO'
  )} dï¿½as. El pico diario alcanzï¿½ ${formatNumber(summary.maxValue)} ${unit} (${badge.label}). ${impact}`;
}

function buildIntensityBadge(value: number, metric: Metric): KPIBadge | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  const mm = value;
  if (mm >= 60) return { label: 'Evento fuerte', tone: 'alert' };
  if (mm >= 20) return { label: 'Temporal', tone: 'warn' };
  if (mm >= 5) return { label: 'Lluvia moderada' };
  return { label: 'Llovizna ligera' };
}

function impactFromBadge(label: string): string {
  switch (label) {
    case 'Evento fuerte':
      return 'Probables anegamientos y retrasos logï¿½sticos; prioriza ventanas secas antes de ingresar maquinaria.';
    case 'Temporal':
      return 'Suelos saturados y charcos puntuales: evita labores pesadas hasta que baje la intensidad.';
    case 'Lluvia moderada':
      return 'Mojado general que puede interrumpir labores breves; aprovecha ventanas menores a 5 mm.';
    default:
      return 'Condiciones suaves ideales para mantenimiento ligero y aplicaciones foliares.';
  }
}

function buildSectorNarratives(
  summary: ChartSummary,
  series: Series | undefined,
  metric: Metric
): SectorNarratives | null {
  if (!summary.count) return null;
  const badge = buildIntensityBadge(summary.maxValue, metric);
  const baselines = computeAgroBaselines(series);

  const agriculture =
    badge?.label === 'Evento fuerte'
      ? `Eventos intensos (${badge.label.toLowerCase()}) acumulan ${formatNumber(
          summary.totalRain
        )} mm. Retrasa siembra o aplicaciones hasta que drene el lote.`
      : summary.average < 5
      ? `Acumulados bajos (${formatNumber(summary.average)} mm/dia) exigen reforzar riego y aprovechar eventos >5 mm.`
      : `Condicion estable: monitorea drenajes despues de dias >20 mm y usa ventanas secas para cosecha.`;

  const livestock =
    badge && (badge.label === 'Temporal' || badge.label === 'Evento fuerte')
      ? 'Charcos y barro en potreros bajos; rota ganado a zonas altas y evita sobrepastoreo.'
      : summary.average < 4
      ? 'Ambiente mas seco; refuerza sombra y bebederos para evitar estres termico.'
      : 'Humedad moderada favorece rebrote, pero revisa accesos luego de jornadas superiores a 20 mm.';

  let energy = 'Sin suficiente informacion para energia.';
  if (baselines.solarKwh != null || baselines.wind != null) {
    const solarText =
      baselines.solarKwh != null
        ? baselines.solarKwh >= 4
          ? `Radiacion ${(baselines.solarKwh ?? 0).toFixed(1)} kWh/m2: ventana productiva para fotovoltaica.`
          : `Radiacion baja (${(baselines.solarKwh ?? 0).toFixed(1)} kWh/m2), espera menor generacion.`
        : null;
    const windText =
      baselines.wind != null
        ? baselines.wind >= 8
          ? `Viento medio ${(baselines.wind ?? 0).toFixed(1)} m/s: util para ventilacion y turbinas menores.`
          : `Viento suave ${(baselines.wind ?? 0).toFixed(1)} m/s: condiciones estables para equipos expuestos.`
        : null;
    energy = [solarText, windText].filter(Boolean).join(' ') || energy;
  }

  return {
    agriculture,
    livestock,
    energy,
  };
}

function computeAgroBaselines(series: Series | undefined): {
  solarKwh: number | null;
  wind: number | null;
} {
  const hourly = (series?.hourly as Series['hourly']) ?? [];
  if (!hourly.length) return { solarKwh: null, wind: null };

  const avg = (key: keyof Series['hourly'][number], hours = 24) => {
    const sample = sliceRecentHours(hourly, hours);
    const values = sample
      .map((point) => (typeof point[key] === 'number' ? (point[key] as number) : null))
      .filter((value): value is number => value !== null);
    if (!values.length) return null;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  };

  const solarAvg = avg('rs', 24);
  return {
    solarKwh: solarAvg == null ? null : (solarAvg * 24) / 1000,
    wind: avg('wind', 24),
  };
}

function sliceRecentHours(points: Series['hourly'], hours: number): Series['hourly'] {
  if (!points.length) return [];
  const last = new Date(points[points.length - 1].t ?? 0).getTime();
  const threshold = last - hours * MS_PER_HOUR;
  return points.filter((point) => {
    const t = new Date(point.t ?? 0).getTime();
    return Number.isFinite(t) && t >= threshold;
  });
}

function summarizeTrend(trend: TrendPoint[] | null): { value: string; note: string } {
  if (!trend || !trend.length) {
    return {
      value: 'Sin datos',
      note: 'Activa MA o EMA para calcular la tendencia histÃ³rica.',
    };
  }
  const first = trend.find((item) => Number.isFinite(item.value));
  const last = [...trend].reverse().find((item) => Number.isFinite(item.value));
  if (!first || !last) {
    return {
      value: 'Sin datos',
      note: 'Necesitamos mÃ¡s puntos para calcular la tendencia.',
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
      `Entre ${rangeLabel} se acumularon ${formatNumber(summary.totalRain)} mm distribuidos en ${summary.count} dÃ­as con datos.`
    );
    if (summary.maxValueDate) {
      parts.push(
        `El dÃ­a mÃ¡s lluvioso fue ${formatDisplayDate(summary.maxValueDate)}, cuando se registraron ${formatNumber(summary.maxValue)} mm en 24 horas.`
      );
    }
  } else {
    parts.push(`Analizamos ${summary.count} dÃ­as de intensidades entre ${rangeLabel}.`);
    if (summary.maxValueDate) {
      parts.push(
        `La rÃ¡faga mÃ¡xima ocurriÃ³ el ${formatDisplayDate(summary.maxValueDate)} y alcanzÃ³ ${formatNumber(summary.maxValue)} mm/h.`
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





