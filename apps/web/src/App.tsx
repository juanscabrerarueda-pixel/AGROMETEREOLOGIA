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
type Tense = 'past' | 'future';

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
    label: '├Ültimos 3 meses',
    days: 90,
    description: 'Observa la evoluci├│n reciente (aprox. ├║ltimo trimestre).',
  },
  {
    id: 'oneYear',
    label: '├Ültimo a├▒o',
    days: 365,
    description: 'Analiza c├│mo cerr├│ el ├║ltimo a├▒o h├¡drico completo.',
  },
  {
    id: 'fiveYears',
    label: '├Ültimos 5 a├▒os',
    days: 365 * 5,
    description: 'Identifica tendencias multianuales y cambios estructurales.',
  },
  {
    id: 'future',
    label: 'Pr├│x. 14 d├¡as',
    days: 14,
    future: true,
    description: 'Pron├│stico inmediato (sin l├¡nea de tendencia).',
  },
];

const METRIC_OPTIONS: Array<{ id: Metric; label: string; helper: string }> = [
  { id: 'accumulated', label: 'Acumulado diario', helper: 'Suma mm por d├¡a (precipitaci├│n acumulada).' },
  { id: 'intensity', label: 'Intensidad (mm/h)', helper: 'Pico horario diario (mm/h) como proxy de intensidad.' },
];

const TREND_OPTIONS: Array<{ id: TrendType; label: string; helper: string }> = [
  { id: 'MA', label: 'MA', helper: 'Media m├│vil con ventana fija.' },
  { id: 'EMA', label: 'EMA', helper: 'Media m├│vil exponencial (pondera lo reciente).' },
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
          <h1>Panel agrometeorol├│gico</h1>
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
  const tense: Tense = isFutureRange ? 'future' : 'past';
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
  const quickImpact = useMemo(
    () => buildImpactNarrative(aggregated, metric, tense),
    [aggregated, metric, tense]
  );
  const sectorNarratives = useMemo(
    () => buildSectorNarratives(aggregated, series.data, metric, tense),
    [aggregated, series.data, metric, tense]
  );
  const agroNarrative = useMemo(() => buildAgroNarrative(series.data, tense), [series.data, tense]);
  const hourlyNarrative = useMemo(
    () => buildHourlyNarrative(series.data, tense),
    [series.data, tense]
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
    () => buildChartNarrative(aggregated, metric, rangeSummary, series.data, trendInfo, tense),
    [aggregated, metric, rangeSummary, series.data, trendInfo, tense]
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
        <div className="hero-brand">
          <div className="brand-icon" aria-hidden="true">
            <span className="brand-sun" />
            <span className="brand-cloud" />
            <span className="brand-leaf left" />
            <span className="brand-leaf right" />
            <span className="brand-grid" />
            <span className="brand-drops" />
          </div>
          <div>
            <p className="tagline">Tendencias de lluvia en Colombia</p>
            <h1>Panel agrometeorol├│gico</h1>
            <p className="muted">
              Filtra por departamento y municipio, alterna entre acumulados o intensidad diaria y usa la
              l├¡nea de tendencia para resumir comportamientos. El mapa horario te ayuda a encontrar
              ventanas secas o picos concentrados.
            </p>
          </div>
        </div>
      </header>

      <section className="card help mb4">
        <div className="help-header">
          <strong>C├│mo usar</strong>
          <button
            type="button"
            className="btn small"
            onClick={() => setHelpHidden((prev) => !prev)}
          >
            {helpHidden ? 'Mostrar guia' : 'Ocultar guia'}
          </button>
        </div>
        {!helpHidden && (
          <ol className="help-steps">
            <li>
              Elige un departamento y opcionalmente un municipio para la serie local (por defecto usa
              la capital).
            </li>
            <li>
              Ajusta el rango r├ípido (3 meses, 1 a├▒o, 5 a├▒os o 14 d├¡as de pron├│stico). Tambi├®n puedes
              fijar fechas manualmente.
            </li>
            <li>
              Alterna entre acumulado diario o intensidad m├íxima, y activa MA/EMA para suavizar la
              serie hist├│rica.
            </li>
            <li>
              Usa la distribucion horaria para detectar ventanas secas y revisa los insights
              automaticos para recomendaciones puntuales.
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
            title={isFutureRange ? 'La tendencia no aplica a pron├│sticos futuros' : ''}
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
          <span className="tiny">Actualizacion automatica</span>
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
              {rangeSummary} - {metric === 'intensity' ? 'Intensidad m├íxima por d├¡a' : 'Acumulado diario (mm)'}
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
              {series.error.message || 'No pudimos contactar la API. Revisa tu conexion o intenta nuevamente.'}
            </p>
          </div>
        )}

        {metaSummary && (
          <div className="meta-panel">
            <div className="meta-item">
              <strong>Ultima actualizaci?n</strong>
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
          <summary>C├│mo leer la intensidad</summary>
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
            <h2>Condiciones agroenerg├®ticas</h2>
            <p className="muted tiny">
              Temperatura y humedad del suelo, ET0, radiaci├│n y viento para apoyar ganaderos,
              agricultores y generaci├│n renovable.
            </p>
          </div>
        </div>
        <AgroPanels series={series.data} />
        {agroNarrative && (
          <div className="narrative-card slim mt2">
            <p>{agroNarrative}</p>
          </div>
        )}
        <details className="glossary mt2">
          <summary>C├│mo leer estas variables</summary>
          <ul>
            <li>Temp. ambiente 18-32 C: confortable. &lt;15 C implica amaneceres frios y &gt;32 C demanda sombra e hidratacion.</li>
            <li>Sensacion termica &gt;35 C: riesgo de estr?s para personal y ganado.</li>
            <li>Humedad relativa &lt;40 %: ambiente seco, incrementa demanda hidrica; &gt;85 % favorece hongos.</li>
            <li>Lluvia 24h: &lt;5 mm se absorbe rapido; &gt;30 mm provoca charcos y compactacion.</li>
            <li>ET0 &gt;4 mm indica alta demanda de riego. Radiaci├│n &gt;4 kWh/m2 favorece la generaci├│n solar.</li>
          </ul>
        </details>
      </section>

      <section className="card mb4">
        <div className="section-header">
          <div>
            <h2>Distribucion horaria</h2>
            <p className="muted tiny">
              Identifica horarios con lluvia o ventanas secas (intensidad en mm/h).
            </p>
          </div>
        </div>
        <div className="hourlyWrap">
          <HourlyHeatmap series={series.data} variable="prcpRate" />
        </div>
        {hourlyNarrative && (
          <div className="narrative-card slim mt2">
            <p>{hourlyNarrative}</p>
          </div>
        )}
        <details className="glossary mt2">
          <summary>C├│mo leer la distribuci├│n</summary>
          <ul>
            <li>Bandas intensas al amanecer indican suelos saturados: retrasa la entrada de maquinaria.</li>
            <li>Bloques continuos &gt;60 % se├▒alan varios d├¡as lluviosos. Busca ventanas p├ílidas (&lt;30 %) para labores cr├¡ticas.</li>
            <li>Celdas claras aisladas equivalen a horas de baja probabilidad, ideales para riego o mantenimiento.</li>
          </ul>
        </details>
      </section>

      <section className="card insights">
        <div className="section-header">
          <div>
            <h2>Insights automatizados</h2>
            <p className="muted tiny">
              Basados en umbrales de impacto y calculos del paquete insight-engine.
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
                'No logramos conectar con la API de insights. Vuelve a intentarlo cuando tengas conexi├│n estable.'}
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
              Sin hallazgos relevantes con los umbrales actuales. Aj├║stalos para m├ís sensibilidad.
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
      if (solarKwh >= 6) icons.push('a ');
      if (windMean != null && windMean >= 8) icons.push('Y ');
      if (apparentMean != null && apparentMean >= 32) icons.push('Y');
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
      label: metric === 'intensity' ? 'M?ximo registrado' : 'M?ximo diario',
      value: `${formatNumber(summary.maxValue)} ${unit}`,
      note: formatDisplayDate(summary.maxValueDate),
    },
    {
      id: 'avg',
      label: 'Promedio diario',
      value: `${formatNumber(summary.average)} ${averageUnit}`,
      note: `${summary.count.toLocaleString('es-CO')} dias analizados`,
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
  const updated = formatDisplayDate(lastTimestamp) || 'a';
  const muniLabel = department?.municipalities.find((item) => item.value === selectedMuni)?.label;
  const location = [muniLabel, department?.label].filter(Boolean).join(' A ') || department?.label || 'a';
  return {
    updated,
    location,
    source: series.meta?.source ?? 'Open-Meteo',
    unit: metric === 'intensity' ? 'mm/h' : 'mm',
  };
}

function buildImpactNarrative(summary: ChartSummary, metric: Metric, tense: Tense): string | null {
  if (!summary.count) return null;
  const badge = buildIntensityBadge(summary.maxValue, metric);
  if (!badge) return null;
  const unit = metric === 'intensity' ? 'mm/h' : 'mm';
  const impact = impactFromBadge(badge.label, tense);
  const lead = tense === 'future' ? 'Se proyectan' : 'Se acumularon';
  const peakVerb = tense === 'future' ? 'podria alcanzar' : 'alcanzo';
  return `${lead} ${formatNumber(summary.totalRain)} mm en ${summary.count.toLocaleString(
    'es-CO'
  )} dias. El pico diario ${peakVerb} ${formatNumber(summary.maxValue)} ${unit} (${badge.label}). ${impact}`;
}

function buildIntensityBadge(value: number, metric: Metric): KPIBadge | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  const mm = value;
  if (mm >= 60) return { label: 'Evento fuerte', tone: 'alert' };
  if (mm >= 20) return { label: 'Temporal', tone: 'warn' };
  if (mm >= 5) return { label: 'Lluvia moderada' };
  return { label: 'Llovizna ligera' };
}

function impactFromBadge(label: string, tense: Tense): string {
  const caution = tense === 'future' ? 'podrian' : 'pudieron';
  switch (label) {
    case 'Evento fuerte':
      return `Anegamientos y retrasos log├¡sticos ${caution} requerir ventanas secas antes de ingresar maquinaria.`;
    case 'Temporal':
      return `Suelos saturados y charcos puntuales ${caution} frenar labores pesadas.`;
    case 'Lluvia moderada':
      return `Mojado general ${caution} interrumpir labores breves; aprovecha ventanas menores a 5 mm.`;
    default:
      return 'Condiciones suaves, utiles para mantenimiento ligero y aplicaciones foliares.';
  }
}

function buildSectorNarratives(
  summary: ChartSummary,
  series: Series | undefined,
  metric: Metric,
  tense: Tense
): SectorNarratives | null {
  if (!summary.count) return null;
  const badge = buildIntensityBadge(summary.maxValue, metric);
  const baselines = computeAgroBaselines(series);
  const isFuture = tense === 'future';

  const agricultureParts: string[] = [];
  agricultureParts.push(
    `${isFuture ? 'Se proyectan' : 'Se analizaron'} ${summary.count.toLocaleString(
      'es-CO'
    )} dias con ${formatNumber(summary.totalRain)} mm (${formatNumber(summary.average)} mm/dia).`
  );
  if (badge?.label === 'Evento fuerte') {
    agricultureParts.push(
      `${isFuture ? 'La lluvia m├ís intensa proyectada sugiere' : 'La lluvia m├ís intensa sugiri├│'} atrasar siembra, fertilizaci├│n foliar y entrada de maquinaria hasta que el lote drene.`
  );
  } else if (badge?.label === 'Temporal') {
    agricultureParts.push(
      `${isFuture ? 'Charcos probables; programa' : 'Hubo charcos probables; programar'} labores en franjas secas y verifica drenajes secundarios.`
    );
  } else if (summary.average < 5) {
    agricultureParts.push(
      `${isFuture ? 'Acumulado modesto proyectado' : 'Acumulado modesto observado'}, ideal para preparar riego y aprovechar cualquier evento >5 mm.`
    );
  } else {
    agricultureParts.push(
      `${isFuture ? 'Humedad regular proyectada' : 'Humedad regular observada'}: vigila malezas y usa las ventanas con menos de 10 mm para cosecha mec?nica.`
    );
  }

  const livestockParts: string[] = [];
  if (badge && (badge.label === 'Temporal' || badge.label === 'Evento fuerte')) {
    livestockParts.push(
      `${isFuture ? 'Pasturas en zonas bajas podrian encharcarse' : 'Pasturas en zonas bajas se encharcaron'}; rota hatos a potreros altos y refuerza caminos.`
    );
  } else if (summary.average < 4) {
    livestockParts.push(
      `${isFuture ? 'Secuencia m├ís seca proyectada' : 'Secuencia m├ís seca observada'}; provee sombra, sales y agua fresca para evitar estr├®s t├®rmico.`
    );
  } else {
    livestockParts.push(
      `${isFuture ? 'Humedad media favoreceria el rebrote' : 'Humedad media favorecio el rebrote'}, pero revisa corrales en jornadas superiores a 20 mm.`
    );
  }
  if (baselines.wind != null) {
    livestockParts.push(
      baselines.wind >= 8
        ? `Viento medio ${(baselines.wind ?? 0).toFixed(1)} m/s ${isFuture ? 'ayudar?a' : 'ayudo'} a ventilar establos.`
        : `Viento suave ${(baselines.wind ?? 0).toFixed(1)} m/s: monitorea insectos y calor acumulado.`
    );
  }

  const energyParts: string[] = [];
  if (baselines.solarKwh != null) {
    energyParts.push(
      baselines.solarKwh >= 4.5
        ? `Radiaci?n ${(baselines.solarKwh ?? 0).toFixed(1)} kWh/m2: ${isFuture ? 'dar?a' : 'dio'} buen rendimiento fotovoltaico y para secado de forraje.`
        : `Radiaci?n limitada (${(baselines.solarKwh ?? 0).toFixed(1)} kWh/m2); ${isFuture ? 'reduce' : 'redujo'} expectativas de generaci?n solar.`
    );
  }
  if (baselines.wind != null) {
    energyParts.push(
      baselines.wind >= 9
        ? `Viento ${(baselines.wind ?? 0).toFixed(1)} m/s ${isFuture ? 'soportaria' : 'soporto'} turbinas menores y ventilacion forzada.`
        : `Viento por debajo de ${(baselines.wind ?? 0).toFixed(1)} m/s: enfocate en capturar ventana solar.`
    );
  }
  if (!energyParts.length) {
    energyParts.push('Sin lecturas recientes de radiacion ni viento; mantente atento a la pr?xima actualizaci?n.');
  }

  return {
    agriculture: agricultureParts.join(' '),
    livestock: livestockParts.join(' '),
    energy: energyParts.join(' '),
  };
}

function buildAgroNarrative(series: Series | undefined, tense: Tense): string | null {
  const hourly = (series?.hourly as Series['hourly']) ?? [];
  if (!hourly.length) return null;
  const sample = sliceRecentHours(hourly, 24);
  if (!sample.length) return null;
  const isFuture = tense === 'future';

  const avg = (key: keyof Series['hourly'][number]) => {
    const values = sample
      .map((point) => (typeof point[key] === 'number' ? (point[key] as number) : null))
      .filter((value): value is number => value !== null);
    if (!values.length) return null;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  };
  const sum = (key: keyof Series['hourly'][number]) => {
    const values = sample
      .map((point) => (typeof point[key] === 'number' ? (point[key] as number) : null))
      .filter((value): value is number => value !== null);
    if (!values.length) return null;
    return values.reduce((total, val) => total + val, 0);
  };

  const temp = avg('temp');
  const feels = avg('apparentTemp');
  const humidity = avg('rh');
  const rain = sum('prcp');
  const evap = sum('evap');
  const solarAvg = avg('rs');
  const solarKwh = solarAvg == null ? null : (solarAvg * 24) / 1000;
  const wind = avg('wind');

  const notes: string[] = [];
  if (temp != null) {
    if (temp >= 32 || (feels ?? temp) >= 35) {
      notes.push(
        `${isFuture ? 'Se proyecta' : 'Se observo'} calor alto (${temp.toFixed(1)} C) con sensacion ${(feels ?? temp).toFixed(
          1
        )} C; prioriza sombra, hidratacion y labores cortas.`
      );
    } else if (temp <= 16) {
      notes.push(`${isFuture ? 'Se proyectan' : 'Se observaron'} mananas frescas (${temp.toFixed(1)} C): protege viveros y riegos tempranos.`);
    } else {
      notes.push(`${isFuture ? 'Se espera' : 'Hubo'} franja confortable (${temp.toFixed(1)} C) para trabajo continuo a campo.`);
    }
  }

  if (humidity != null) {
    if (humidity >= 85) {
      notes.push(`Humedad elevada (${humidity.toFixed(0)} %) ${isFuture ? 'favoreceria' : 'favorecio'} hongos; ventila invernaderos.`);
    } else if (humidity <= 40) {
      notes.push(`Humedad baja (${humidity.toFixed(0)} %) ${isFuture ? 'elevaria' : 'elevo'} demanda hidrica y riesgo de polvo.`);
    } else {
      notes.push(`Humedad en equilibrio (${humidity.toFixed(0)} %).`);
    }
  }

  if (rain != null) {
    if (rain >= 40) {
      notes.push(
        `${isFuture ? 'Lluvia abundante proyectada' : 'Lluvia abundante observada'} (${rain.toFixed(
          1
        )} mm/24 h) ${isFuture ? 'saturaria' : 'saturo'} suelos; espera drenaje antes de entrar maquinaria.`
      );
    } else if (rain >= 12) {
      notes.push(`Lluvia util (${rain.toFixed(1)} mm) ${isFuture ? 'recargaria' : 'recargo'} humedad superficial.`);
    } else if (rain < 5) {
      notes.push(`Solo ${rain.toFixed(1)} mm en 24 h: ten listo riego suplementario.`);
    }
  } else {
    notes.push(`${isFuture ? 'Sin acumulado esperado' : 'Sin acumulado observado'} en las ├║ltim?s 24 h.`);
  }

  if (evap != null) {
    notes.push(
      evap >= 5
        ? `ET0 de ${evap.toFixed(1)} mm ${isFuture ? 'indicaria' : 'indico'} demanda hidrica alta.`
        : `ET0 ${evap.toFixed(1)} mm ${isFuture ? 'mantendria' : 'mantuvo'} consumo moderado.`
    );
  }

  if (solarKwh != null) {
    notes.push(
      solarKwh >= 4.5
        ? `Radiaci?n ${(solarKwh ?? 0).toFixed(1)} kWh/m2 ${isFuture ? 'habilitaria' : 'habilito'} buena generaci?n solar.`
        : `Radiaci├│n limitada ${(solarKwh ?? 0).toFixed(1)} kWh/m2; planifica secado con m├ís tiempo.`
    );
  }

  if (wind != null) {
    notes.push(
      wind >= 9
        ? `Viento ${(wind ?? 0).toFixed(1)} m/s: ${isFuture ? 'aseguraria' : 'aseguro'} cubiertas y controla deriva de pulverizaciones.`
        : `Viento suave ${(wind ?? 0).toFixed(1)} m/s ${isFuture ? 'mantendria' : 'mantuvo'} condiciones estables para equipos expuestos.`
    );
  }

  return notes.join(' ');
}

type HourlyPointSummary = { iso: string; value: number };

function buildHourlyNarrative(series: Series | undefined, tense: Tense): string | null {
  const hourly = (series?.hourly as Series['hourly']) ?? [];
  if (!hourly.length) return null;
  const sample = sliceRecentHours(hourly, 72);
  if (!sample.length) return null;
  const isFuture = tense === 'future';

  const ratePoints: HourlyPointSummary[] = sample
    .map((point) =>
      point.t && typeof point.prcpRate === 'number'
        ? { iso: point.t, value: Number(point.prcpRate.toFixed(2)) }
        : null
    )
    .filter((item): item is HourlyPointSummary => !!item);
  if (!ratePoints.length) return null;

  const ordered = [...ratePoints].sort((a, b) => a.iso.localeCompare(b.iso));
  const peak = ordered.reduce((max, point) => (point.value > max.value ? point : max), ordered[0]);

  let bestDryStart: string | null = null;
  let bestDryLen = 0;
  let currentStart: string | null = null;
  let currentLen = 0;

  for (const point of ordered) {
    if (point.value < 0.2) {
      if (!currentLen) currentStart = point.iso;
      currentLen += 1;
    } else if (currentLen) {
      if (currentLen > bestDryLen && currentStart) {
        bestDryLen = currentLen;
        bestDryStart = currentStart;
      }
      currentLen = 0;
      currentStart = null;
    }
  }
  if (currentLen && currentStart && currentLen > bestDryLen) {
    bestDryLen = currentLen;
    bestDryStart = currentStart;
  }

  const heavyHours = ordered.filter((point) => point.value >= 2).length;
  const wetShare = Math.round((heavyHours / ordered.length) * 100);

  const notes: string[] = [];
  notes.push(
    `${isFuture ? 'Pico proyectado' : 'Pico registrado'}: ${peak.value.toFixed(1)} mm/h el ${formatHourLabel(
      peak.iso
    )}.`
  );
  if (bestDryStart && bestDryLen >= 3) {
    notes.push(
      `Ventana seca ${isFuture ? 'proyectada' : 'observada'} de ${bestDryLen} h entre ${formatHourRange(
        bestDryStart,
        bestDryLen
      )}.`
    );
  } else {
    notes.push(`Sin ventanas secas mayores a 3 h en las ${isFuture ? 'pr?ximas' : 'ultimas'} 72 h.`);
  }
  notes.push(
    wetShare >= 50
      ? `M?s del 50% de las horas ${isFuture ? 'proyectadas' : 'recientes'} tuvieron lluvia significativa; agenda labores bajo techo.`
      : `Solo ${wetShare}% de las horas ${isFuture ? 'proyectadas' : 'observadas'} muestran lluvia >2 mm/h; aprovecha las franjas restantes para riego o mantenimiento.`
  );

  return notes.join(' ');
}

function formatHourLabel(iso?: string): string {
  if (!iso) return 'sin fecha';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.getUTCDate().toString().padStart(2, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const hour = date.getUTCHours().toString().padStart(2, '0');
  return `${day}/${month} ${hour}:00 UTC`;
}

function formatHourRange(startIso: string, hours: number): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return `${startIso} +${hours}h`;
  const end = new Date(start.getTime() + hours * MS_PER_HOUR);
  return `${formatHourLabel(startIso)} - ${formatHourLabel(end.toISOString())}`;
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
      note: 'Activa MA o EMA para calcular la tendencia historica.',
    };
  }
  const first = trend.find((item) => Number.isFinite(item.value));
  const last = [...trend].reverse().find((item) => Number.isFinite(item.value));
  if (!first || !last) {
    return {
      value: 'Sin datos',
      note: 'Necesitamos m├ís puntos para calcular la tendencia.',
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
  trendInfo: { value: string; note: string },
  tense: Tense
): string {
  if (!summary.count) {
    return '';
  }
  const isFuture = tense === 'future';

  const parts: string[] = [];
  if (metric === 'accumulated') {
    parts.push(
      `Entre ${rangeLabel} ${isFuture ? 'se proyectan' : 'se acumularon'} ${formatNumber(
        summary.totalRain
      )} mm${isFuture ? ' proyectados' : ''} distribuidos en ${summary.count} dias con datos.`
    );
    if (summary.maxValueDate) {
      parts.push(
        `El dia m?s lluvioso ${isFuture ? 'proyectado seria' : 'fue'} ${formatDisplayDate(
          summary.maxValueDate
        )}, con ${formatNumber(summary.maxValue)} mm en 24 horas.`
      );
    }
  } else {
    parts.push(
      `${isFuture ? 'Se proyectan' : 'Se analizaron'} ${summary.count} dias de intensidades entre ${rangeLabel}.`
    );
    if (summary.maxValueDate) {
      parts.push(
        `La rafaga m?xima ${isFuture ? 'proyectada ocurriria' : 'ocurrio'} el ${formatDisplayDate(
          summary.maxValueDate
        )} y ${isFuture ? 'alcanzaria' : 'alcanzo'} ${formatNumber(summary.maxValue)} mm/h.`
      );
    }
  }

  if (trendInfo.value !== 'Sin datos') {
    parts.push(
      `La serie suavizada ${isFuture ? 'proyectada' : 'observada'} indica un comportamiento ${trendInfo.value.toLowerCase()} (${trendInfo.note}).`
    );
  }

  if (series?.meta?.source) {
    const tzNote = series.meta.tz ? `, zona ${series.meta.tz}` : '';
    parts.push(`Fuente: ${series.meta.source}${tzNote}.`);
  }

  return parts.join(' ');
}





