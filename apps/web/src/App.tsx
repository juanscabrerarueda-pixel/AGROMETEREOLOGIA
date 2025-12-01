import { useEffect, useMemo, useState } from 'react';
import type { Series } from '@pkg/core';
import './App.css';
import { FEATURE_AGROMETEO } from './config/flags';
import { useSeries } from './hooks/useSeries';
import { useInsights } from './hooks/useInsights';
import { useThresholds } from './state/thresholds';
import { useReferenceDaily, type ReferenceDay } from './hooks/useReferenceDaily';
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

type ReferenceDiff = {
  date: string;
  label: string;
  appValue: number;
  referenceValue: number;
  delta: number;
};

type SuspiciousPoint = Pick<AggregatedPoint, 'date' | 'label' | 'value'>;
type AnomalyReport = { reference: number; points: SuspiciousPoint[] };

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

const REFERENCE_DIFF_THRESHOLD_MM = 12;

const RANGE_OPTIONS: RangeOption[] = [
  {
    id: 'threeMonths',
    label: '\u00daltimos 3 meses',
    days: 90,
    description: 'Observa la evoluci\u00f3n reciente (aprox. \u00faltimo trimestre).',
  },
  {
    id: 'oneYear',
    label: '\u00daltimo a\u00f1o',
    days: 365,
    description: 'Analiza c\u00f3mo cerr\u00f3 el \u00faltimo a\u00f1o h\u00eddrico completo.',
  },
  {
    id: 'fiveYears',
    label: '\u00daltimos 5 a\u00f1os',
    days: 365 * 5,
    description: 'Identifica tendencias multianuales y cambios estructurales.',
  },
  {
    id: 'future',
    label: 'Pr\u00f3x. 14 d\u00edas',
    days: 14,
    future: true,
    description: 'Pron\u00f3stico inmediato (sin l\u00ednea de tendencia).',
  },
];

const METRIC_OPTIONS: Array<{ id: Metric; label: string; helper: string }> = [
  { id: 'accumulated', label: 'Acumulado diario', helper: 'Suma mm por d\u00eda (precipitaci\u00f3n acumulada).' },
  { id: 'intensity', label: 'Intensidad (mm/h)', helper: 'Pico horario diario (mm/h) como proxy de intensidad.' },
];

const TREND_OPTIONS: Array<{ id: TrendType; label: string; helper: string }> = [
  { id: 'MA', label: 'MA', helper: 'Media m\u00f3vil con ventana fija.' },
  { id: 'EMA', label: 'EMA', helper: 'Media m\u00f3vil exponencial (pondera lo reciente).' },
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

const INSIGHT_KIND_META: Record<
  string,
  { label: string; tone: 'trend' | 'advice' | 'event'; icon: string }
> = {
  trend: { label: 'Trend', tone: 'trend', icon: '\u{1f4c8}' },
  advice: { label: 'Consejo', tone: 'advice', icon: '\u{1f4a1}' },
  event: { label: 'Evento', tone: 'event', icon: '\u26a0\ufe0f' },
};

export default function App() {
  if (!FEATURE_AGROMETEO) {
    return (
      <main className="wrap">
        <section className="card">
          <h1>Panel agrometeorol\u00f3gico</h1>
          <p>Activa la variable VITE_FEATURE_AGROMETEO para visualizar este tablero.</p>
        </section>
      </main>
    );
  }

  const { thresholds } = useThresholds();

  const desktopDefault = typeof window === 'undefined' ? true : window.innerWidth > 720;
  const [selectedDept, setSelectedDept] = useState<string>(DEFAULT_DEPARTMENT_VALUE);
  const [selectedMuni, setSelectedMuni] = useState<string>(DEFAULT_MUNICIPALITY_VALUE);
  const [metric, setMetric] = useState<Metric>('accumulated');
  const [trendType, setTrendType] = useState<TrendType>('EMA');
  const [showTrend, setShowTrend] = useState(true);
  const [helpHidden, setHelpHidden] = useState(() => !desktopDefault);
  const [rangeSelection, setRangeSelection] = useState<RangeSelection>('threeMonths');
  const [range, setRange] = useState<DateRange>(() => buildRange(RANGE_OPTIONS[0]));
  const [refreshRate, setRefreshRate] = useState<RefreshKey>('1m');
  const [filtersOpen, setFiltersOpen] = useState(desktopDefault);
  const [chartOpen, setChartOpen] = useState(desktopDefault);
  const [agroOpen, setAgroOpen] = useState(desktopDefault);
  const [hourlyOpen, setHourlyOpen] = useState(desktopDefault);
  const [insightsOpen, setInsightsOpen] = useState(desktopDefault);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) {
      setHelpHidden(true);
      setFiltersOpen(false);
      setChartOpen(false);
      setAgroOpen(false);
      setHourlyOpen(false);
      setInsightsOpen(false);
    } else {
      setHelpHidden(false);
      setFiltersOpen(true);
      setChartOpen(true);
      setAgroOpen(true);
      setHourlyOpen(true);
      setInsightsOpen(true);
    }
  }, [isMobile]);

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
  const insightSummary = useMemo(() => aggregateSeries(series.data, 'accumulated'), [series.data]);
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
  const anomalyReport = useMemo(() => detectSuspiciousPoints(aggregated.points, metric), [aggregated.points, metric]);
  const hasAnomalies = anomalyReport.points.length > 0;

  const referenceParams = useMemo(() => {
    if (metric !== 'accumulated' || isFutureRange) return null;
    const lat = series.data?.meta?.lat;
    const lon = series.data?.meta?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon, from: range.from, to: range.to };
  }, [isFutureRange, metric, range.from, range.to, series.data]);
  const referenceDaily = useReferenceDaily(referenceParams);
  const referenceComparison = useMemo(
    () =>
      referenceParams && referenceDaily.data?.days?.length
        ? compareWithReference(aggregated.points, referenceDaily.data.days, REFERENCE_DIFF_THRESHOLD_MM)
        : null,
    [aggregated.points, referenceDaily.data, referenceParams]
  );

  const rangeSummary = formatRangeSummary(range);
  const chartNarrative = useMemo(
    () => buildChartNarrative(aggregated, metric, rangeSummary, series.data, trendInfo, tense),
    [aggregated, metric, rangeSummary, series.data, trendInfo, tense]
  );
  const overviewSummary = useMemo(
    () => ({
      location: metaSummary?.location ?? 'Selecciona una ubicaci\u00f3n',
      updated: metaSummary?.updated ?? 'Sin dato',
      source: metaSummary?.source ?? 'Fuente no disponible',
    }),
    [metaSummary]
  );
  const summaryPills = useMemo(() => {
    if (!aggregated.count) {
      return [
        { id: 'empty', label: 'Sin datos en el rango', value: '--', note: 'Ajusta ubicaci\u00f3n o fechas.' },
      ];
    }
    const unit = metric === 'intensity' ? 'mm/h' : 'mm';
    return [
      {
        id: 'total',
        label: tense === 'future' ? 'Total proyectado' : 'Acumulado analizado',
        value: `${formatNumber(aggregated.totalRain)} mm`,
        note: `${aggregated.count.toLocaleString('es-CO')} d\u00edas con dato`,
      },
      {
        id: 'avg',
        label: 'Promedio diario',
        value: `${formatNumber(aggregated.average)} ${unit}`,
        note: 'Media del per\u00edodo seleccionado.',
      },
      {
        id: 'peak',
        label: metric === 'intensity' ? 'Pico horario' : 'M\u00e1ximo diario',
        value: `${formatNumber(aggregated.maxValue)} ${unit}`,
        note: aggregated.maxValueDate ? formatDisplayDate(aggregated.maxValueDate) : undefined,
      },
    ];
  }, [aggregated, metric, tense]);

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
            <h1>Panel agrometeorol\u00f3gico</h1>
            <p className="muted">
              Filtra por departamento y municipio, alterna entre acumulados o intensidad diaria y usa la
              l\u00ednea de tendencia para resumir comportamientos. El mapa horario te ayuda a encontrar
              ventanas secas o picos concentrados.
            </p>
          </div>
        </div>
      </header>

      <section className={`card help mb4 mobile-fold ${helpHidden ? 'collapsed' : 'open'}`}>
        <div className="fold-toggle-row">
          <strong>C\u00f3mo usar</strong>
          <button type="button" className="btn small ghost" onClick={() => setHelpHidden((prev) => !prev)}>
            {helpHidden ? 'Mostrar gu\u00eda' : 'Ocultar gu\u00eda'}
          </button>
        </div>
        {!helpHidden && (
          <div className="fold-body">
            <ol className="help-steps">
              <li>
                Comienza en <strong>Monitoreo en vivo</strong>: valida el sello \u00bfHace X min? y usa la actualizaci\u00f3n autom\u00e1tica (1, 5 o 15 min) para seguir tormentas en tiempo real.
              </li>
              <li>
                Elige un departamento y opcionalmente un municipio para la serie local (por defecto usa la capital) y confirma la fuente mostrada en la tarjeta en vivo.
              </li>
              <li>
                Ajusta el rango r\u00e1pido (3 meses, 1 a\u00f1o, 5 a\u00f1os o 14 d\u00edas de pron\u00f3stico). Tambi\u00e9n puedes fijar fechas manualmente cuando necesites comparar ventanas espec\u00edficas.
              </li>
              <li>
                Alterna entre acumulado diario o intensidad m\u00e1xima, activa MA/EMA para suavizar la serie hist\u00f3rica y combina los insights autom\u00e1ticos para traducir la se\u00f1al en acciones.
              </li>
              <li>
                Usa la distribuci\u00f3n diaria y horaria para detectar ventanas secas o picos concentrados antes de programar labores a campo.
              </li>
            </ol>
          </div>
        )}
      </section>

      <section className="card mobile-overview mb4">
        <div className="overview-top">
          <div className="overview-cell">
            <span className="tiny">Ubicaci\u00f3n activa</span>
            <strong>{overviewSummary.location}</strong>
            <p className="muted tiny">{rangeSummary}</p>
          </div>
          <div className="overview-cell">
            <span className="tiny">\u00daltimo dato</span>
            <strong>{overviewSummary.updated}</strong>
            <p className="muted tiny">Fuente: {overviewSummary.source}</p>
          </div>
        </div>
        <div className="overview-pills">
          {summaryPills.map((pill) => (
            <div key={pill.id} className="overview-pill">
              <span className="tiny">{pill.label}</span>
              <strong>{pill.value}</strong>
              {pill.note && <p className="muted tiny">{pill.note}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className={`card controls mb4 ${filtersOpen ? 'open' : 'collapsed'}`}>
        <div className="controls-header">
          <div>
            <h2>Filtros r\u00e1pidos</h2>
            <p className="muted tiny">
              Define ubicaci\u00f3n, rango y m\u00e9tricas para ajustar la lectura hist\u00f3rica y el pron\u00f3stico.
            </p>
          </div>
          <button type="button" className="btn small ghost" onClick={() => setFiltersOpen((prev) => !prev)}>
            {filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
          </button>
        </div>
        <div className="controls-body">
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
              title={isFutureRange ? 'La tendencia no aplica a pron\u00f3sticos futuros' : ''}
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
            <span className="tiny">Actualizaci\u00f3n autom\u00e1tica</span>
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
        </div>
      </section>

      <RealtimePanel series={series.data} busy={series.isFetching} />

      <section className={`card chart-card mb4 mobile-fold ${chartOpen ? 'open' : 'collapsed'}`}>
        <div className="fold-toggle-row">
          <div>
            <h2>Serie diaria</h2>
            <p className="muted tiny">
              {rangeSummary} - {metric === 'intensity' ? 'Intensidad m\u00e1xima por d\u00eda' : 'Acumulado diario (mm)'}
            </p>
          </div>
          <button type="button" className="btn small ghost" onClick={() => setChartOpen((prev) => !prev)}>
            {chartOpen ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        {(chartOpen || !isMobile) && (
          <div className="fold-body">
            <div className={`busy ${busy ? 'on' : ''}`}>
              <div className="busy-pill">
                <span className="spin" />
                <span>Actualizando datos...</span>
              </div>
            </div>
            <div className="series-meta tiny">
              {series.data?.meta?.source && <span>Fuente: {series.data.meta.source}</span>}
              {series.data?.meta?.tz && <span>TZ: {series.data.meta.tz}</span>}
              <span>Registros: {aggregated.count.toLocaleString('es-CO')}</span>
            </div>
            {series.error && (
              <div className="error-banner mb3">
                <strong>No fue posible actualizar la serie.</strong>
                <p>{series.error.message || 'No pudimos contactar la API. Revisa tu conexi\u00f3n o intenta nuevamente.'}</p>
              </div>
            )}

            {metaSummary && (
              <div className="meta-panel">
                <div className="meta-item">
                  <strong>\u00daltima actualizaci\u00f3n</strong>
                  <span>{metaSummary.updated}</span>
                </div>
                <div className="meta-item">
                  <strong>Ubicaci\u00f3n</strong>
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

            {hasAnomalies && (
              <div className="alert-card">
                <strong>Datos por confirmar</strong>
                <p>
                  Detectamos {anomalyReport.points.length} valores diarios fuera del rango habitual (percentil 95 \u2248{' '}
                  {formatNumber(anomalyReport.reference)} {metric === 'intensity' ? 'mm/h' : 'mm'}). Verifica estos d\u00edas
                  con IDEAM, NASA POWER/CHIRPS o tus pluvi\u00f3metros locales antes de tomar decisiones.
                </p>
                <ul>
                  {anomalyReport.points.slice(0, 4).map((point) => (
                    <li key={point.date}>
                      {point.label}: {formatNumber(point.value)} {metric === 'intensity' ? 'mm/h' : 'mm'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {referenceParams && (
              <div className="reference-card">
                <div className="reference-head">
                  <strong>Cruce con Open-Meteo</strong>
                  {referenceDaily.data?.coverage.from && (
                    <span className="tiny muted">
                      {formatDisplayDate(referenceDaily.data.coverage.from)} \u2192{' '}
                      {formatDisplayDate(referenceDaily.data.coverage.to ?? referenceDaily.data.coverage.from)}
                    </span>
                  )}
                </div>
                {referenceDaily.isLoading && (
                  <p className="muted tiny">Descargando lluvia diaria de referencia\u2026</p>
                )}
                {referenceDaily.error && (
                  <p className="muted tiny">
                    No fue posible consultar la serie oficial. {referenceDaily.error.message}
                  </p>
                )}
                {!referenceDaily.isLoading && !referenceDaily.error && (
                  <>
                    {referenceDaily.data?.note && <p className="muted tiny">{referenceDaily.data.note}</p>}
                    {referenceDaily.data?.days?.length ? (
                      referenceComparison && referenceComparison.flagged.length > 0 ? (
                        <>
                          <p>
                            Detectamos {referenceComparison.flagged.length} d\u00edas con diferencia \u2265{' '}
                            {REFERENCE_DIFF_THRESHOLD_MM} mm entre la app y Open-Meteo.
                          </p>
                          <ul>
                            {referenceComparison.flagged.slice(0, 4).map((item) => (
                              <li key={item.date}>
                                {item.label}: {formatNumber(item.appValue)} vs {formatNumber(item.referenceValue)} mm (
                                {formatSigned(item.delta)} mm)
                              </li>
                            ))}
                          </ul>
                          <p className="muted tiny">
                            Valida estas fechas con IDEAM, CHIRPS o tus sensores locales antes de descartar la se\u00f1al.
                          </p>
                        </>
                      ) : (
                        <p className="muted tiny">
                          Sin diferencias mayores a {REFERENCE_DIFF_THRESHOLD_MM} mm frente a la referencia diaria disponible.
                        </p>
                      )
                    ) : (
                      <p className="muted tiny">
                        A\u00fan no hay datos hist\u00f3ricos para este rango; espera registros oficiales para comparar.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            <PrecipitationChart points={aggregated.points} trend={trendPoints} metric={metric} />

            <div className="mt3">
              <DailyHeatmap daily={dailyData} metric={metric} />
              <details className="glossary">
                <summary>C\u00f3mo leer la intensidad</summary>
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
                    <strong>Lectura r\u00e1pida:</strong> {quickImpact}
                  </p>
                )}
                {chartNarrative && <p className="chart-narrative">{chartNarrative}</p>}
              </div>
            )}
          </div>
        )}
      </section>


      <section className={`card mb4 mobile-fold ${agroOpen ? 'open' : 'collapsed'}`}>
        <div className="fold-toggle-row">
          <div>
            <h2>Condiciones agroenerg\u00e9ticas</h2>
            <p className="muted tiny">
              Temperatura y humedad del suelo, ET0, radiaci\u00f3n y viento para apoyar ganaderos,
              agricultores y generaci\u00f3n renovable.
            </p>
          </div>
          <button type="button" className="btn small ghost" onClick={() => setAgroOpen((prev) => !prev)}>
            {agroOpen ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        {(agroOpen || !isMobile) && (
          <div className="fold-body">
            <AgroPanels series={series.data} />
            {agroNarrative && (
              <div className="narrative-card slim mt2">
                <p>{agroNarrative}</p>
              </div>
            )}
            <details className="glossary mt2">
              <summary>C\u00f3mo leer estas variables</summary>
              <ul>
                <li>Temp. ambiente 18-32 C: confortable. &lt;15 C implica amaneceres fr\u00edos y &gt;32 C demanda sombra e hidrataci\u00f3n.</li>
                <li>Sensaci\u00f3n t\u00e9rmica &gt;35 C: riesgo de estr\u00e9s para personal y ganado.</li>
                <li>Humedad relativa &lt;40 %: ambiente seco, incrementa demanda h\u00eddrica; &gt;85 % favorece hongos.</li>
                <li>Lluvia 24h: &lt;5 mm se absorbe rapido; &gt;30 mm provoca charcos y compactacion.</li>
                <li>ET0 &gt;4 mm indica alta demanda de riego. Radiaci\u00f3n &gt;4 kWh/m2 favorece la generaci\u00f3n solar.</li>
              </ul>
            </details>
          </div>
        )}
      </section>


      <section className={`card mb4 mobile-fold ${hourlyOpen ? 'open' : 'collapsed'}`}>
        <div className="fold-toggle-row">
          <div>
            <h2>Distribuci\u00f3n horaria</h2>
            <p className="muted tiny">
              Identifica horarios con lluvia o ventanas secas (intensidad en mm/h).
            </p>
          </div>
          <button type="button" className="btn small ghost" onClick={() => setHourlyOpen((prev) => !prev)}>
            {hourlyOpen ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        {(hourlyOpen || !isMobile) && (
          <div className="fold-body">
            <div className="hourlyWrap">
              <HourlyHeatmap series={series.data} variable="prcpRate" />
            </div>
            {hourlyNarrative && (
              <div className="narrative-card slim mt2">
                <p>{hourlyNarrative}</p>
              </div>
            )}
            <details className="glossary mt2">
              <summary>C\u00f3mo leer la distribuci\u00f3n</summary>
              <ul>
                <li>Bandas intensas al amanecer indican suelos saturados: retrasa la entrada de maquinaria.</li>
                <li>Bloques continuos &gt;60 % se\u00f1alan varios d\u00edas lluviosos. Busca ventanas p\u00e1lidas (&lt;30 %) para labores cr\u00edticas.</li>
                <li>Celdas claras aisladas equivalen a horas de baja probabilidad, ideales para riego o mantenimiento.</li>
              </ul>
            </details>
          </div>
        )}
      </section>


      <section className={`card insights mobile-fold ${insightsOpen ? 'open' : 'collapsed'}`}>
        <div className="fold-toggle-row">
          <div>
            <h2>Insights automatizados</h2>
            <p className="muted tiny">
              Basados en umbrales de impacto y c\u00e1lculos del paquete insight-engine.
            </p>
          </div>
          <button type="button" className="btn small ghost" onClick={() => setInsightsOpen((prev) => !prev)}>
            {insightsOpen ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        {(insightsOpen || !isMobile) && (
          <div className="fold-body">
            {insightSummary.count > 0 && (
              <div className="insights-kpis tiny">
                <span className="insights-chip">
                  <span className="chip-label">Lluvia analizada</span>
                  <strong>{formatNumber(insightSummary.totalRain)} mm</strong>
                </span>
                <span className="insights-chip">
                  <span className="chip-label">D\u00edas con dato</span>
                  <strong>{insightSummary.count.toLocaleString('es-CO')}</strong>
                </span>
              </div>
            )}
            {sectorNarratives && (
              <div className="sector-insights">
                <div>
                  <strong>Agricultura</strong>
                  <p>{sectorNarratives.agriculture}</p>
                </div>
                <div>
                  <strong>Ganader\u00eda</strong>
                  <p>{sectorNarratives.livestock}</p>
                </div>
                <div>
                  <strong>Energ\u00edas renovables</strong>
                  <p>{sectorNarratives.energy}</p>
                </div>
              </div>
            )}
            {insights.error ? (
              <div className="error-banner">
                <strong>No fue posible generar insights.</strong>
                <p>{insights.error.message || 'No logramos conectar con la API de insights. Vuelve a intentarlo cuando tengas conexi\u00f3n estable.'}</p>
              </div>
            ) : insights.data ? (
              insights.data.insights.length ? (
                <ul className="insights-list">
                  {insights.data.insights.map((item) => (
                    <li key={item.id} className="insight-item">
                      {(() => {
                        const meta = INSIGHT_KIND_META[item.kind] ?? { label: item.kind, tone: 'trend', icon: '\u2139\ufe0f' };
                        return (
                          <span className={`insight-pill ${meta.tone}`}>
                            <span className="insight-pill-icon" aria-hidden="true">
                              {meta.icon}
                            </span>
                            {meta.label}
                          </span>
                        );
                      })()}
                      <p>{item.text}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">Sin hallazgos relevantes con los umbrales actuales. Aj\u00fastalos para m\u00e1s sensibilidad.</div>
              )
            ) : (
              <div className="skeleton">
                <div className="skeleton-bar" />
                <div className="skeleton-bar" />
                <div className="skeleton-bar" />
              </div>
            )}
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

function useIsMobile(breakpoint = 720) {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= breakpoint;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = () => setIsMobile(media.matches);
    handler();
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return formatChartLabel(iso);
  }
  const date = new Date(iso);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return formatChartLabel(iso);
}

function formatDateTime(iso?: string): string {
  if (!iso) return 'Sin dato';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return formatDisplayDate(iso);
  }
  return date.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const history = computeHistoricalStats(summary);

  return [
    {
      id: 'max',
      label: metric === 'intensity' ? 'M\u00e1ximo registrado' : 'M\u00e1ximo diario',
      value: `${formatNumber(summary.maxValue)} ${unit}`,
      note: [formatDisplayDate(summary.maxValueDate), history?.max != null ? formatDeltaText(summary.maxValue, history.max, unit) : null]
        .filter(Boolean)
        .join(' \u00b7 '),
    },
    {
      id: 'avg',
      label: 'Promedio diario',
      value: `${formatNumber(summary.average)} ${averageUnit}`,
      note: [
        `${summary.count.toLocaleString('es-CO')} d\u00edas analizados`,
        history?.average != null ? formatDeltaText(summary.average, history.average, averageUnit) : null,
      ]
        .filter(Boolean)
        .join(' \u00b7 '),
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

function computeHistoricalStats(summary: ChartSummary, years = 5): { average: number; max: number } | null {
  if (!summary.points.length || !summary.lastDate) return null;
  const lastStamp = Date.parse(`${summary.lastDate}T00:00:00Z`);
  if (!Number.isFinite(lastStamp)) return null;
  const cutoff = new Date(lastStamp);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  const cutoffMs = cutoff.getTime();
  const filtered = summary.points.filter((point) => {
    const stamp = Date.parse(`${point.date}T00:00:00Z`);
    return Number.isFinite(stamp) && stamp >= cutoffMs;
  });
  if (!filtered.length) return null;
  const values = filtered.map((point) => point.value);
  return {
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    max: Math.max(...values),
  };
}

function formatDeltaText(current: number, baseline: number, unit: string): string {
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) return '';
  const delta = Number((current - baseline).toFixed(2));
  if (Math.abs(delta) < 0.01) {
    return `sin cambio vs. 5 a\u00f1os`;
  }
  const prefix = delta >= 0 ? '+' : '\u2212';
  return `${prefix}${formatNumber(Math.abs(delta))} ${unit} vs. 5 a\u00f1os`;
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
  const updated = formatDateTime(lastTimestamp) || 'Sin dato';
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
  const peakVerb = tense === 'future' ? 'podr\u00eda alcanzar' : 'alcanz\u00f3';
  return `${lead} ${formatNumber(summary.totalRain)} mm en ${summary.count.toLocaleString(
    'es-CO'
  )} d\u00edas. El pico diario ${peakVerb} ${formatNumber(summary.maxValue)} ${unit} (${badge.label}). ${impact}`;
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
  const caution = tense === 'future' ? 'podr\u00edan' : 'pudieron';
  switch (label) {
    case 'Evento fuerte':
      return `Anegamientos y retrasos log\u00edsticos ${caution} requerir ventanas secas antes de ingresar maquinaria.`;
    case 'Temporal':
      return `Suelos saturados y charcos puntuales ${caution} frenar labores pesadas.`;
    case 'Lluvia moderada':
      return `Mojado general ${caution} interrumpir labores breves; aprovecha ventanas menores a 5 mm.`;
    default:
      return 'Condiciones suaves, \u00fatiles para mantenimiento ligero y aplicaciones foliares.';
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
    )} d\u00edas con ${formatNumber(summary.totalRain)} mm (${formatNumber(summary.average)} mm/d\u00eda).`
  );
  if (badge?.label === 'Evento fuerte') {
    agricultureParts.push(
      `${isFuture ? 'La lluvia m\u00e1s intensa proyectada sugiere' : 'La lluvia m\u00e1s intensa sugiri\u00f3'} atrasar siembra, fertilizaci\u00f3n foliar y entrada de maquinaria hasta que el lote drene.`
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
      `${isFuture ? 'Humedad regular proyectada' : 'Humedad regular observada'}: vigila malezas y usa las ventanas con menos de 10 mm para cosecha mec\u00e1nica.`
    );
  }

  const livestockParts: string[] = [];
  if (badge && (badge.label === 'Temporal' || badge.label === 'Evento fuerte')) {
    livestockParts.push(
      `${isFuture ? 'Pasturas en zonas bajas podr\u00edan encharcarse' : 'Pasturas en zonas bajas se encharcaron'}; rota hatos a potreros altos y refuerza caminos.`
    );
  } else if (summary.average < 4) {
    livestockParts.push(
      `${isFuture ? 'Secuencia m\u00e1s seca proyectada' : 'Secuencia m\u00e1s seca observada'}; provee sombra, sales y agua fresca para evitar estr\u00e9s t\u00e9rmico.`
    );
  } else {
    livestockParts.push(
      `${isFuture ? 'Humedad media favorecer\u00eda el rebrote' : 'Humedad media favoreci\u00f3 el rebrote'}, pero revisa corrales en jornadas superiores a 20 mm.`
    );
  }
  if (baselines.wind != null) {
    livestockParts.push(
      baselines.wind >= 8
        ? `Viento medio ${(baselines.wind ?? 0).toFixed(1)} m/s ${isFuture ? 'ayudar\u00eda' : 'ayud\u00f3'} a ventilar establos.`
        : `Viento suave ${(baselines.wind ?? 0).toFixed(1)} m/s: monitorea insectos y calor acumulado.`
    );
  }

  const energyParts: string[] = [];
  if (baselines.solarKwh != null) {
    energyParts.push(
      baselines.solarKwh >= 4.5
        ? `Radiaci\u00f3n ${(baselines.solarKwh ?? 0).toFixed(1)} kWh/m2: ${isFuture ? 'dar\u00eda' : 'dio'} buen rendimiento fotovoltaico y para secado de forraje.`
        : `Radiaci\u00f3n limitada (${(baselines.solarKwh ?? 0).toFixed(1)} kWh/m2); ${isFuture ? 'reduce' : 'redujo'} expectativas de generaci\u00f3n solar.`
    );
  }
  if (baselines.wind != null) {
    energyParts.push(
      baselines.wind >= 9
        ? `Viento ${(baselines.wind ?? 0).toFixed(1)} m/s ${isFuture ? 'soportaria' : 'soporto'} turbinas menores y ventilaci\u00f3n forzada.`
        : `Viento por debajo de ${(baselines.wind ?? 0).toFixed(1)} m/s: enf\u00f3cate en capturar ventana solar.`
    );
  }
  if (!energyParts.length) {
    energyParts.push('Sin lecturas recientes de radiacion ni viento; mantente atento a la pr\u00f3xima actualizaci\u00f3n.');
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
        )} C; prioriza sombra, hidrataci\u00f3n y labores cortas.`
      );
    } else if (temp <= 16) {
      notes.push(`${isFuture ? 'Se proyectan' : 'Se observaron'} ma\u00f1anas frescas (${temp.toFixed(1)} C): protege viveros y riegos tempranos.`);
    } else {
      notes.push(`${isFuture ? 'Se espera' : 'Hubo'} franja confortable (${temp.toFixed(1)} C) para trabajo continuo a campo.`);
    }
  }

  if (humidity != null) {
    if (humidity >= 85) {
      notes.push(`Humedad elevada (${humidity.toFixed(0)} %) ${isFuture ? 'favorecer\u00eda' : 'favoreci\u00f3'} hongos; ventila invernaderos.`);
    } else if (humidity <= 40) {
      notes.push(`Humedad baja (${humidity.toFixed(0)} %) ${isFuture ? 'elevar\u00eda' : 'elev\u00f3'} demanda h\u00eddrica y riesgo de polvo.`);
    } else {
      notes.push(`Humedad en equilibrio (${humidity.toFixed(0)} %).`);
    }
  }

  if (rain != null) {
    if (rain >= 40) {
      notes.push(
        `${isFuture ? 'Lluvia abundante proyectada' : 'Lluvia abundante observada'} (${rain.toFixed(
          1
        )} mm/24 h) ${isFuture ? 'saturar\u00eda' : 'satur\u00f3'} suelos; espera drenaje antes de entrar maquinaria.`
      );
    } else if (rain >= 12) {
      notes.push(`Lluvia \u00fatil (${rain.toFixed(1)} mm) ${isFuture ? 'recargar\u00eda' : 'recarg\u00f3'} humedad superficial.`);
    } else if (rain < 5) {
      notes.push(`Solo ${rain.toFixed(1)} mm en 24 h: ten listo riego suplementario.`);
    }
  } else {
    notes.push(`${isFuture ? 'Sin acumulado esperado' : 'Sin acumulado observado'} en las \u00faltimas 24 h.`);
  }

  if (evap != null) {
    notes.push(
      evap >= 5
        ? `ET0 de ${evap.toFixed(1)} mm ${isFuture ? 'indicar\u00eda' : 'indic\u00f3'} demanda h\u00eddrica alta.`
        : `ET0 ${evap.toFixed(1)} mm ${isFuture ? 'mantendr\u00eda' : 'mantuvo'} consumo moderado.`
    );
  }

  if (solarKwh != null) {
    notes.push(
      solarKwh >= 4.5
        ? `Radiaci\u00f3n ${(solarKwh ?? 0).toFixed(1)} kWh/m2 ${isFuture ? 'habilitar\u00eda' : 'habilit\u00f3'} buena generaci\u00f3n solar.`
        : `Radiaci\u00f3n limitada ${(solarKwh ?? 0).toFixed(1)} kWh/m2; planifica secado con m\u00e1s tiempo.`
    );
  }

  if (wind != null) {
    notes.push(
      wind >= 9
        ? `Viento ${(wind ?? 0).toFixed(1)} m/s: ${isFuture ? 'asegurar\u00eda' : 'asegur\u00f3'} cubiertas y controla deriva de pulverizaciones.`
        : `Viento suave ${(wind ?? 0).toFixed(1)} m/s ${isFuture ? 'mantendr\u00eda' : 'mantuvo'} condiciones estables para equipos expuestos.`
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
    notes.push(`Sin ventanas secas mayores a 3 h en las ${isFuture ? 'pr\u00f3ximas' : '\u00faltimas'} 72 h.`);
  }
  notes.push(
    wetShare >= 50
      ? `M\u00e1s del 50% de las horas ${isFuture ? 'proyectadas' : 'recientes'} tuvieron lluvia significativa; agenda labores bajo techo.`
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
      note: 'Necesitamos m\u00e1s puntos para calcular la tendencia.',
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

function compareWithReference(
  points: AggregatedPoint[],
  reference: ReferenceDay[],
  threshold: number
): { flagged: ReferenceDiff[] } {
  if (!Array.isArray(points) || !Array.isArray(reference) || !reference.length || threshold <= 0) {
    return { flagged: [] };
  }
  const referenceMap = new Map(reference.map((day) => [day.date, day.value]));
  const flagged: ReferenceDiff[] = [];

  points.forEach((point) => {
    if (point.isForecast) return;
    const refValue = referenceMap.get(point.date);
    if (typeof refValue !== 'number') return;
    const delta = point.value - refValue;
    if (Math.abs(delta) < threshold) return;
    flagged.push({
      date: point.date,
      label: point.label,
      appValue: point.value,
      referenceValue: refValue,
      delta,
    });
  });

  flagged.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return { flagged };
}

function detectSuspiciousPoints(points: AggregatedPoint[], metric: Metric): AnomalyReport {
  if (!Array.isArray(points) || !points.length) {
    return { reference: 0, points: [] };
  }

  const candidates: SuspiciousPoint[] = points
    .filter((point) => !point.isForecast && Number.isFinite(point.value) && (point.value ?? 0) > 0)
    .map((point) => ({
      date: point.date,
      label: point.label,
      value: point.value,
    }));

  if (candidates.length < 10) {
    return { reference: 0, points: [] };
  }

  const sortedValues = candidates.map((point) => point.value).sort((a, b) => a - b);
  const percentileIndex = Math.min(sortedValues.length - 1, Math.floor(sortedValues.length * 0.95));
  const reference = sortedValues[percentileIndex] ?? 0;
  const median = sortedValues[Math.floor(sortedValues.length / 2)] ?? reference;
  const ratioThreshold = metric === 'intensity' ? 1.8 : 1.5;
  const minAbsolute = metric === 'intensity' ? 2 : 15;

  const flagged = candidates
    .filter((point) => {
      if (point.value < minAbsolute) return false;
      const aboveReference = reference > 0 ? point.value >= reference : false;
      const aboveMedianRatio = median > 0 ? point.value >= median * ratioThreshold : false;
      return aboveReference || aboveMedianRatio;
    })
    .sort((a, b) => b.value - a.value);

  return {
    reference,
    points: flagged,
  };
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString('es-CO', { maximumFractionDigits: 2 }) : '0';
}

function formatSigned(value: number): string {
  const prefix = value >= 0 ? '+' : '-';
  return `${prefix}${formatNumber(Math.abs(value))}`;
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
      )} mm${isFuture ? ' proyectados' : ''} distribuidos en ${summary.count} d\u00edas con datos.`
    );
    if (summary.maxValueDate) {
      parts.push(
        `El d\u00eda m\u00e1s lluvioso ${isFuture ? 'proyectado ser\u00eda' : 'fue'} ${formatDisplayDate(
          summary.maxValueDate
        )}, con ${formatNumber(summary.maxValue)} mm en 24 horas.`
      );
    }
  } else {
    parts.push(
      `${isFuture ? 'Se proyectan' : 'Se analizaron'} ${summary.count} d\u00edas de intensidades entre ${rangeLabel}.`
    );
    if (summary.maxValueDate) {
      parts.push(
        `La r\u00e1faga m\u00e1xima ${isFuture ? 'proyectada ocurrir\u00eda' : 'ocurri\u00f3'} el ${formatDisplayDate(
          summary.maxValueDate
        )} y ${isFuture ? 'alcanzar\u00eda' : 'alcanz\u00f3'} ${formatNumber(summary.maxValue)} mm/h.`
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





