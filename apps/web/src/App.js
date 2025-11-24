import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import './App.css';
import { FEATURE_AGROMETEO } from './config/flags';
import { useSeries } from './hooks/useSeries';
import { useInsights } from './hooks/useInsights';
import { useThresholds } from './state/thresholds';
import { PrecipitationChart, } from './components/PrecipitationChart';
import { HourlyHeatmap } from './components/HourlyHeatmap';
import { DailyHeatmap } from './components/DailyHeatmap';
import { RealtimePanel } from './components/RealtimePanel';
import { AgroPanels } from './components/AgroPanels';
import { DEPARTMENT_OPTIONS } from './data/locations';
const REFRESH_OPTIONS = [
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
const RANGE_OPTIONS = [
    {
        id: 'threeMonths',
        label: 'Ultimos 3 meses',
        days: 90,
        description: 'Observa la evolucion reciente (aprox. Ultimo trimestre).',
    },
    {
        id: 'oneYear',
        label: 'Ultimo ano',
        days: 365,
        description: 'Analiza como cerro el Ultimo ano hidrico completo.',
    },
    {
        id: 'fiveYears',
        label: 'Ultimos 5 anos',
        days: 365 * 5,
        description: 'Identifica tendencias multianuales y cambios estructurales.',
    },
    {
        id: 'future',
        label: 'Prox. 14 dias',
        days: 14,
        future: true,
        description: 'Pronostico inmediato (sin lAnea de tendencia).',
    },
];
const METRIC_OPTIONS = [
    { id: 'accumulated', label: 'Acumulado diario', helper: 'Suma mm por dia (precipitacion acumulada).' },
    { id: 'intensity', label: 'Intensidad (mm/h)', helper: 'Pico horario diario (mm/h) como proxy de intensidad.' },
];
const TREND_OPTIONS = [
    { id: 'MA', label: 'MA', helper: 'Media movil con ventana fija.' },
    { id: 'EMA', label: 'EMA', helper: 'Media movil exponencial (pondera lo reciente).' },
];
const DEFAULT_DEPARTMENT = DEPARTMENT_OPTIONS[0];
const DEFAULT_DEPARTMENT_VALUE = DEFAULT_DEPARTMENT?.value ?? '';
const DEFAULT_MUNICIPALITY_VALUE = DEFAULT_DEPARTMENT?.municipalities[0]?.value ?? '';
const WINDOW_BY_RANGE = {
    threeMonths: 7,
    oneYear: 30,
    fiveYears: 60,
    future: 7,
};
export default function App() {
    if (!FEATURE_AGROMETEO) {
        return (_jsx("main", { className: "wrap", children: _jsxs("section", { className: "card", children: [_jsx("h1", { children: "Panel agrometeorologico" }), _jsx("p", { children: "Activa la variable VITE_FEATURE_AGROMETEO para visualizar este tablero." })] }) }));
    }
    const { thresholds } = useThresholds();
    const [selectedDept, setSelectedDept] = useState(DEFAULT_DEPARTMENT_VALUE);
    const [selectedMuni, setSelectedMuni] = useState(DEFAULT_MUNICIPALITY_VALUE);
    const [metric, setMetric] = useState('accumulated');
    const [trendType, setTrendType] = useState('EMA');
    const [showTrend, setShowTrend] = useState(true);
    const [helpHidden, setHelpHidden] = useState(false);
    const [rangeSelection, setRangeSelection] = useState('threeMonths');
    const [range, setRange] = useState(() => buildRange(RANGE_OPTIONS[0]));
    const [refreshRate, setRefreshRate] = useState('1m');
    const currentDepartment = DEPARTMENT_OPTIONS.find((option) => option.value === selectedDept) ?? DEPARTMENT_OPTIONS[0];
    const municipalities = currentDepartment?.municipalities ?? [];
    const activeRangeOption = rangeSelection === 'custom'
        ? undefined
        : RANGE_OPTIONS.find((option) => option.id === rangeSelection);
    const isFutureRange = activeRangeOption?.future ?? false;
    const refreshConfig = REFRESH_OPTIONS.find((item) => item.id === refreshRate) ?? REFRESH_OPTIONS[0];
    const refetchInterval = refreshConfig.intervalMs;
    const seriesParams = useMemo(() => ({
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
    }), [range.from, range.to, selectedDept, selectedMuni]);
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
    const aggregated = useMemo(() => aggregateSeries(series.data, metric), [
        metric,
        series.data,
    ]);
    const dailyData = useMemo(() => buildDailyData(series.data), [series.data]);
    const metaSummary = useMemo(() => buildMetaSummary(series.data, metric, currentDepartment, selectedMuni), [series.data, metric, currentDepartment, selectedMuni]);
    const quickImpact = useMemo(() => buildImpactNarrative(aggregated, metric), [aggregated, metric]);
    const sectorNarratives = useMemo(() => buildSectorNarratives(aggregated, series.data, metric), [aggregated, series.data, metric]);
    const trendPoints = useMemo(() => {
        if (!showTrend || isFutureRange || !aggregated.points.length) {
            return null;
        }
        const window = rangeSelection === 'custom'
            ? inferWindowFromRange(range)
            : WINDOW_BY_RANGE[rangeSelection];
        return computeTrend(aggregated.points, window, trendType);
    }, [aggregated.points, isFutureRange, range, rangeSelection, showTrend, trendType]);
    const trendInfo = useMemo(() => summarizeTrend(trendPoints), [trendPoints]);
    const kpis = useMemo(() => buildKpis(aggregated, metric, trendPoints, range, rangeSelection, activeRangeOption, trendInfo), [activeRangeOption, aggregated, metric, range, rangeSelection, trendInfo, trendPoints]);
    const rangeSummary = formatRangeSummary(range);
    const chartNarrative = useMemo(() => buildChartNarrative(aggregated, metric, rangeSummary, series.data, trendInfo), [aggregated, metric, rangeSummary, series.data, trendInfo]);
    const handleRangePreset = (option) => {
        setRangeSelection(option.id);
        setRange(buildRange(option));
        if (option.future) {
            setShowTrend(false);
        }
    };
    const handleDeptChange = (value) => {
        const option = DEPARTMENT_OPTIONS.find((item) => item.value === value) ?? DEPARTMENT_OPTIONS[0];
        setSelectedDept(option.value);
        setSelectedMuni(option.municipalities[0]?.value ?? '');
    };
    const handleMuniChange = (value) => {
        setSelectedMuni(value);
    };
    const handleFromChange = (value) => {
        if (!isValidDate(value))
            return;
        setRangeSelection('custom');
        setRange((prev) => normalizeRange({ from: value, to: prev.to }));
    };
    const handleToChange = (value) => {
        if (!isValidDate(value))
            return;
        setRangeSelection('custom');
        setRange((prev) => normalizeRange({ from: prev.from, to: value }));
    };
    const metricHelper = METRIC_OPTIONS.find((option) => option.id === metric)?.helper ?? '';
    return (_jsxs("main", { className: "wrap", children: [_jsx("header", { className: "mb4 intro", children: _jsxs("div", { className: "hero-brand", children: [_jsxs("div", { className: "brand-icon", "aria-hidden": "true", children: [_jsx("span", { className: "brand-sun" }), _jsx("span", { className: "brand-cloud" }), _jsx("span", { className: "brand-leaf left" }), _jsx("span", { className: "brand-leaf right" }), _jsx("span", { className: "brand-grid" }), _jsx("span", { className: "brand-drops" })] }), _jsxs("div", { children: [_jsx("p", { className: "tagline", children: "Tendencias de lluvia en Colombia" }), _jsx("h1", { children: "Panel agrometeorologico" }), _jsx("p", { className: "muted", children: "Filtra por departamento y municipio, alterna entre acumulados o intensidad diaria y usa la linea de tendencia para resumir comportamientos. El mapa horario te ayuda a encontrar ventanas secas o picos concentrados." })] })] }) }), _jsxs("section", { className: "card help mb4", children: [_jsxs("div", { className: "help-header", children: [_jsx("strong", { children: "Como usar" }), _jsx("button", { type: "button", className: "btn small", onClick: () => setHelpHidden((prev) => !prev), children: helpHidden ? 'Mostrar guia' : 'Ocultar guia' })] }), !helpHidden && (_jsxs("ol", { className: "help-steps", children: [_jsx("li", { children: "Elige un departamento y opcionalmente un municipio para la serie local (por defecto usa la capital)." }), _jsx("li", { children: "Ajusta el rango rapido (3 meses, 1 ano, 5 anos o 14 dias de pronostico). Tambien puedes fijar fechas manualmente." }), _jsx("li", { children: "Alterna entre acumulado diario o intensidad mAxima, y activa MA/EMA para suavizar la serie historica." }), _jsx("li", { children: "Usa la distribucion horaria para detectar ventanas secas y revisa los insights automAticos para recomendaciones puntuales." })] }))] }), _jsxs("section", { className: "card controls mb4", children: [_jsxs("div", { className: "row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Departamento" }), _jsx("select", { value: selectedDept, onChange: (event) => handleDeptChange(event.target.value), children: DEPARTMENT_OPTIONS.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Municipio / ciudad" }), _jsx("select", { value: selectedMuni, onChange: (event) => handleMuniChange(event.target.value), children: municipalities.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Desde" }), _jsx("input", { type: "date", value: range.from, onChange: (event) => handleFromChange(event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Hasta" }), _jsx("input", { type: "date", value: range.to, onChange: (event) => handleToChange(event.target.value) })] })] }), _jsxs("div", { className: "seg mt2", children: [RANGE_OPTIONS.map((option) => (_jsx("button", { type: "button", className: `btn ${rangeSelection === option.id ? 'active' : ''}`, onClick: () => handleRangePreset(option), children: option.label }, option.id))), _jsx("button", { type: "button", className: `btn small ${rangeSelection === 'custom' ? 'active' : ''}`, onClick: () => setRangeSelection('custom'), title: "Edita las fechas para definir tu rango personalizado.", children: "Personalizado" })] }), _jsx("div", { className: "seg mt2", children: METRIC_OPTIONS.map((option) => (_jsx("button", { type: "button", className: `btn ${metric === option.id ? 'active' : ''}`, onClick: () => setMetric(option.id), children: option.label }, option.id))) }), _jsxs("div", { className: "row gap mt2", children: [_jsx("button", { type: "button", className: "btn small", onClick: () => setShowTrend((prev) => !prev), disabled: isFutureRange, title: isFutureRange ? 'La tendencia no aplica a pronosticos futuros' : '', children: showTrend ? 'Ocultar tendencia' : 'Ver tendencia' }), _jsx("div", { className: "seg compact", children: TREND_OPTIONS.map((option) => (_jsx("button", { type: "button", className: `btn small ${trendType === option.id ? 'active' : ''}`, disabled: isFutureRange, onClick: () => setTrendType(option.id), title: option.helper, children: option.label }, option.id))) })] }), _jsxs("p", { className: "muted tiny mt2", children: [metricHelper, " ", activeRangeOption ? `- ${activeRangeOption.description}` : ''] }), _jsxs("div", { className: "refresh-controls mt2", children: [_jsx("span", { className: "tiny", children: "Actualizacion automAtica" }), _jsx("div", { className: "seg compact", children: REFRESH_OPTIONS.map((option) => (_jsx("button", { type: "button", className: `btn small ${refreshRate === option.id ? 'active' : ''}`, onClick: () => setRefreshRate(option.id), children: option.label }, option.id))) }), _jsx("p", { className: "muted tiny", children: refreshConfig.description })] })] }), _jsx(RealtimePanel, { series: series.data, busy: series.isFetching }), _jsxs("section", { className: "card chart-card mb4", children: [_jsx("div", { className: `busy ${busy ? 'on' : ''}`, children: _jsxs("div", { className: "busy-pill", children: [_jsx("span", { className: "spin" }), _jsx("span", { children: "Actualizando datos..." })] }) }), _jsxs("div", { className: "section-header", children: [_jsxs("div", { children: [_jsx("h2", { children: "Serie diaria" }), _jsxs("p", { className: "muted tiny", children: [rangeSummary, " - ", metric === 'intensity' ? 'Intensidad maxima por dia' : 'Acumulado diario (mm)'] })] }), _jsxs("div", { className: "series-meta tiny", children: [series.data?.meta?.source && _jsxs("span", { children: ["Fuente: ", series.data.meta.source] }), series.data?.meta?.tz && _jsxs("span", { children: ["TZ: ", series.data.meta.tz] }), _jsxs("span", { children: ["Registros: ", aggregated.count.toLocaleString('es-CO')] })] })] }), series.error && (_jsxs("div", { className: "error-banner mb3", children: [_jsx("strong", { children: "No fue posible actualizar la serie." }), _jsx("p", { children: series.error.message || 'No pudimos contactar la API. Revisa tu conexion o intenta nuevamente.' })] })), metaSummary && (_jsxs("div", { className: "meta-panel", children: [_jsxs("div", { className: "meta-item", children: [_jsx("strong", { children: "Ultima actualizacion" }), _jsx("span", { children: metaSummary.updated })] }), _jsxs("div", { className: "meta-item", children: [_jsx("strong", { children: "Ubicacion" }), _jsx("span", { children: metaSummary.location })] }), _jsxs("div", { className: "meta-item", children: [_jsx("strong", { children: "Fuente" }), _jsx("span", { children: metaSummary.source })] }), _jsxs("div", { className: "meta-item", children: [_jsx("strong", { children: "Unidad" }), _jsx("span", { children: metaSummary.unit })] })] })), _jsx(PrecipitationChart, { points: aggregated.points, trend: trendPoints, metric: metric }), _jsxs("div", { className: "mt3", children: [_jsx(DailyHeatmap, { daily: dailyData, metric: metric }), _jsxs("details", { className: "glossary", children: [_jsx("summary", { children: "Como leer la intensidad" }), _jsxs("ul", { children: [_jsx("li", { children: "0-5 mm: Llovizna ligera, humedece sin generar escorrentia." }), _jsx("li", { children: "5-20 mm: Lluvia moderada, posible pausa corta en labores." }), _jsx("li", { children: "20-60 mm: Temporal, suelos saturados y riesgo de charcos." }), _jsxs("li", { children: ['> 60', " mm: Evento fuerte, probables anegamientos y retrasos."] })] })] })] }), _jsx("div", { className: "kpis mt3", children: kpis.map((item) => (_jsxs("div", { className: "kpi", children: [_jsx("span", { className: "kcap", children: item.label }), _jsxs("span", { className: "kval", children: [item.value, item.badge && (_jsx("span", { className: `badge ${item.badge.tone ?? ''}`.trim(), children: item.badge.label }))] }), item.note && _jsx("span", { className: "ksub", children: item.note })] }, item.id))) }), (chartNarrative || quickImpact) && (_jsxs("div", { className: "narrative-card", children: [quickImpact && (_jsxs("p", { children: [_jsx("strong", { children: "Lectura rapida:" }), " ", quickImpact] })), chartNarrative && _jsx("p", { className: "chart-narrative", children: chartNarrative })] }))] }), _jsxs("section", { className: "card mb4", children: [_jsx("div", { className: "section-header", children: _jsxs("div", { children: [_jsx("h2", { children: "Condiciones agroenergeticas" }), _jsx("p", { className: "muted tiny", children: "Temperatura y humedad del suelo, ET0, radiacion y viento para apoyar ganaderos, agricultores y generacion renovable." })] }) }), _jsx(AgroPanels, { series: series.data }), _jsxs("details", { className: "glossary mt2", children: [_jsx("summary", { children: "Como leer estas variables" }), _jsxs("ul", { children: [_jsx("li", { children: "Temp. ambiente 18-32 C: confortable. <15 C implica amaneceres frios y >32 C demanda sombra e hidratacion." }), _jsx("li", { children: "Sensacion termica >35 C: riesgo de estres para personal y ganado." }), _jsx("li", { children: "Humedad relativa <40 %: ambiente seco, incrementa demanda hidrica; >85 % favorece hongos." }), _jsx("li", { children: "Lluvia 24h: <5 mm se absorbe rapido; >30 mm provoca charcos y compactacion." }), _jsx("li", { children: "ET0 >4 mm indica alta demanda de riego. Radiacion >4 kWh/m2 favorece la generacion solar." })] })] })] }), _jsxs("section", { className: "card mb4", children: [_jsx("div", { className: "section-header", children: _jsxs("div", { children: [_jsx("h2", { children: "Distribucion horaria" }), _jsx("p", { className: "muted tiny", children: "Identifica horarios con lluvia o ventanas secas (intensidad en mm/h)." })] }) }), _jsx("div", { className: "hourlyWrap", children: _jsx(HourlyHeatmap, { series: series.data, variable: "prcpRate" }) }), _jsxs("details", { className: "glossary mt2", children: [_jsx("summary", { children: "Como leer la distribucion" }), _jsxs("ul", { children: [_jsx("li", { children: "Bandas intensas al amanecer indican suelos saturados: retrasa la entrada de maquinaria." }), _jsx("li", { children: "Bloques continuos >60 % senalan varios dias lluviosos. Busca ventanas palidas (<30 %) para labores criticas." }), _jsx("li", { children: "Celdas claras aisladas equivalen a horas de baja probabilidad, ideales para riego o mantenimiento." })] })] })] }), _jsxs("section", { className: "card insights", children: [_jsx("div", { className: "section-header", children: _jsxs("div", { children: [_jsx("h2", { children: "Insights automatizados" }), _jsx("p", { className: "muted tiny", children: "Basados en umbrales de impacto y cAlculos del paquete insight-engine." })] }) }), sectorNarratives && (_jsxs("div", { className: "sector-insights", children: [_jsxs("div", { children: [_jsx("strong", { children: "Agricultura" }), _jsx("p", { children: sectorNarratives.agriculture })] }), _jsxs("div", { children: [_jsx("strong", { children: "Ganaderia" }), _jsx("p", { children: sectorNarratives.livestock })] }), _jsxs("div", { children: [_jsx("strong", { children: "Energias renovables" }), _jsx("p", { children: sectorNarratives.energy })] })] })), insights.error ? (_jsxs("div", { className: "error-banner", children: [_jsx("strong", { children: "No fue posible generar insights." }), _jsx("p", { children: insights.error.message ||
                                    'No logramos conectar con la API de insights. Vuelve a intentarlo cuando tengas conexion estable.' })] })) : insights.data ? (insights.data.insights.length ? (_jsx("ul", { className: "insights-list", children: insights.data.insights.map((insight) => (_jsxs("li", { className: "insight-item", children: [_jsx("strong", { children: insight.kind }), _jsx("p", { children: insight.text })] }, insight.id))) })) : (_jsx("div", { className: "empty-state", children: "Sin hallazgos relevantes con los umbrales actuales. Ajustalos para mas sensibilidad." }))) : (_jsxs("div", { className: "skeleton", children: [_jsx("div", { className: "skeleton-bar" }), _jsx("div", { className: "skeleton-bar" }), _jsx("div", { className: "skeleton-bar" })] }))] })] }));
}
function buildRange(option) {
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
function normalizeRange(value) {
    if (!isValidDate(value.from) || !isValidDate(value.to)) {
        return value;
    }
    if (value.from <= value.to)
        return value;
    return { from: value.to, to: value.from };
}
function isValidDate(value) {
    if (!value)
        return false;
    const time = Date.parse(value);
    return Number.isFinite(time);
}
function startOfDay(date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
}
function addDays(date, amount) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + amount);
    return copy;
}
function formatISO(date) {
    return date.toISOString().slice(0, 10);
}
const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
function formatChartLabel(iso) {
    const date = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(date.getTime()))
        return iso;
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = MONTHS_SHORT[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    return `${day} ${month} ${year}`;
}
function formatDisplayDate(iso) {
    if (!iso)
        return 'Sin dato';
    return formatChartLabel(iso);
}
function formatRangeSummary(range) {
    return `${formatDisplayDate(range.from)} -> ${formatDisplayDate(range.to)}`;
}
function aggregateSeries(series, metric) {
    if (!series || !Array.isArray(series.hourly) || !series.hourly.length) {
        return {
            points: [],
            totalRain: 0,
            average: 0,
            maxValue: 0,
            count: 0,
        };
    }
    const buckets = new Map();
    const now = Date.now();
    for (const point of series.hourly) {
        const key = point.t?.slice(0, 10);
        if (!key)
            continue;
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
    const points = dates.map((date) => {
        const bucket = buckets.get(date);
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
function buildDailyData(series) {
    if (!series || !Array.isArray(series.hourly))
        return [];
    const buckets = new Map();
    for (const point of series.hourly) {
        const day = point.t?.slice(0, 10);
        if (!day)
            continue;
        const bucket = buckets.get(day) ??
            buckets.set(day, { rain: 0, solar: 0, wind: 0, windCount: 0, apparent: 0, apparentCount: 0 }).get(day);
        if (typeof point.prcp === 'number')
            bucket.rain += point.prcp;
        if (typeof point.rs === 'number')
            bucket.solar += point.rs;
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
        const icons = [];
        if (solarKwh >= 6)
            icons.push('a ');
        if (windMean != null && windMean >= 8)
            icons.push('Y ');
        if (apparentMean != null && apparentMean >= 32)
            icons.push('Y');
        return {
            date,
            label: formatDisplayDate(date),
            value: Number(bucket.rain.toFixed(2)),
            icons,
        };
    });
}
function computeTrend(points, window, trendType) {
    if (!points.length || window <= 1)
        return [];
    const values = points.map((p) => p.value);
    const raw = trendType === 'EMA'
        ? exponentialMovingAverage(values, window)
        : movingAverage(values, window);
    const result = [];
    raw.forEach((value, index) => {
        if (Number.isFinite(value)) {
            result.push({ index, value });
        }
    });
    return result;
}
function movingAverage(values, window) {
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
function exponentialMovingAverage(values, window) {
    const out = new Array(values.length).fill(Number.NaN);
    if (!values.length)
        return out;
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
function inferWindowFromRange(range) {
    const from = Date.parse(range.from);
    const to = Date.parse(range.to);
    if (!Number.isFinite(from) || !Number.isFinite(to))
        return 30;
    const diffDays = Math.max(1, Math.round((to - from) / MS_PER_DAY) + 1);
    if (diffDays <= 120)
        return 7;
    if (diffDays <= 550)
        return 30;
    return 60;
}
function buildKpis(summary, metric, trend, range, selection, activeRange, trendInfo) {
    const unit = metric === 'intensity' ? 'mm/h' : 'mm';
    const averageUnit = metric === 'intensity' ? 'mm/h' : 'mm';
    const rangeLabel = selection === 'custom' ? formatRangeSummary(range) : activeRange?.label ?? formatRangeSummary(range);
    return [
        {
            id: 'max',
            label: metric === 'intensity' ? 'MAximo registrado' : 'MAximo diario',
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
function buildMetaSummary(series, metric, department, selectedMuni) {
    if (!series)
        return null;
    const hourly = series.hourly ?? [];
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
function buildImpactNarrative(summary, metric) {
    if (!summary.count)
        return null;
    const badge = buildIntensityBadge(summary.maxValue, metric);
    if (!badge)
        return null;
    const unit = metric === 'intensity' ? 'mm/h' : 'mm';
    const impact = impactFromBadge(badge.label);
    return `Acumulado ${formatNumber(summary.totalRain)} mm en ${summary.count.toLocaleString('es-CO')} di12as. El pico diario alcanzi12 ${formatNumber(summary.maxValue)} ${unit} (${badge.label}). ${impact}`;
}
function buildIntensityBadge(value, metric) {
    if (!Number.isFinite(value) || value <= 0)
        return undefined;
    const mm = value;
    if (mm >= 60)
        return { label: 'Evento fuerte', tone: 'alert' };
    if (mm >= 20)
        return { label: 'Temporal', tone: 'warn' };
    if (mm >= 5)
        return { label: 'Lluvia moderada' };
    return { label: 'Llovizna ligera' };
}
function impactFromBadge(label) {
    switch (label) {
        case 'Evento fuerte':
            return 'Probables anegamientos y retrasos logi12sticos; prioriza ventanas secas antes de ingresar maquinaria.';
        case 'Temporal':
            return 'Suelos saturados y charcos puntuales: evita labores pesadas hasta que baje la intensidad.';
        case 'Lluvia moderada':
            return 'Mojado general que puede interrumpir labores breves; aprovecha ventanas menores a 5 mm.';
        default:
            return 'Condiciones suaves ideales para mantenimiento ligero y aplicaciones foliares.';
    }
}
function buildSectorNarratives(summary, series, metric) {
    if (!summary.count)
        return null;
    const badge = buildIntensityBadge(summary.maxValue, metric);
    const baselines = computeAgroBaselines(series);
    const agriculture = badge?.label === 'Evento fuerte'
        ? `Eventos intensos (${badge.label.toLowerCase()}) acumulan ${formatNumber(summary.totalRain)} mm. Retrasa siembra o aplicaciones hasta que drene el lote.`
        : summary.average < 5
            ? `Acumulados bajos (${formatNumber(summary.average)} mm/dia) exigen reforzar riego y aprovechar eventos >5 mm.`
            : `Condicion estable: monitorea drenajes despues de dias >20 mm y usa ventanas secas para cosecha.`;
    const livestock = badge && (badge.label === 'Temporal' || badge.label === 'Evento fuerte')
        ? 'Charcos y barro en potreros bajos; rota ganado a zonas altas y evita sobrepastoreo.'
        : summary.average < 4
            ? 'Ambiente mas seco; refuerza sombra y bebederos para evitar estres termico.'
            : 'Humedad moderada favorece rebrote, pero revisa accesos luego de jornadas superiores a 20 mm.';
    let energy = 'Sin suficiente informacion para energia.';
    if (baselines.solarKwh != null || baselines.wind != null) {
        const solarText = baselines.solarKwh != null
            ? baselines.solarKwh >= 4
                ? `Radiacion ${(baselines.solarKwh ?? 0).toFixed(1)} kWh/m2: ventana productiva para fotovoltaica.`
                : `Radiacion baja (${(baselines.solarKwh ?? 0).toFixed(1)} kWh/m2), espera menor generacion.`
            : null;
        const windText = baselines.wind != null
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
function computeAgroBaselines(series) {
    const hourly = series?.hourly ?? [];
    if (!hourly.length)
        return { solarKwh: null, wind: null };
    const avg = (key, hours = 24) => {
        const sample = sliceRecentHours(hourly, hours);
        const values = sample
            .map((point) => (typeof point[key] === 'number' ? point[key] : null))
            .filter((value) => value !== null);
        if (!values.length)
            return null;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    };
    const solarAvg = avg('rs', 24);
    return {
        solarKwh: solarAvg == null ? null : (solarAvg * 24) / 1000,
        wind: avg('wind', 24),
    };
}
function sliceRecentHours(points, hours) {
    if (!points.length)
        return [];
    const last = new Date(points[points.length - 1].t ?? 0).getTime();
    const threshold = last - hours * MS_PER_HOUR;
    return points.filter((point) => {
        const t = new Date(point.t ?? 0).getTime();
        return Number.isFinite(t) && t >= threshold;
    });
}
function summarizeTrend(trend) {
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
            note: 'Necesitamos mas puntos para calcular la tendencia.',
        };
    }
    const diff = last.value - first.value;
    const base = Math.abs(first.value) < 1e-6 ? 1 : Math.abs(first.value);
    const pct = (diff / base) * 100;
    let label = 'Estable';
    if (pct > 5)
        label = 'Al alza';
    else if (pct < -5)
        label = 'A la baja';
    return {
        value: label,
        note: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% respecto al inicio`,
    };
}
function formatNumber(value) {
    return Number.isFinite(value) ? value.toLocaleString('es-CO', { maximumFractionDigits: 2 }) : '0';
}
function buildChartNarrative(summary, metric, rangeLabel, series, trendInfo) {
    if (!summary.count) {
        return '';
    }
    const parts = [];
    if (metric === 'accumulated') {
        parts.push(`Entre ${rangeLabel} se acumularon ${formatNumber(summary.totalRain)} mm distribuidos en ${summary.count} dias con datos.`);
        if (summary.maxValueDate) {
            parts.push(`El dia mas lluvioso fue ${formatDisplayDate(summary.maxValueDate)}, cuando se registraron ${formatNumber(summary.maxValue)} mm en 24 horas.`);
        }
    }
    else {
        parts.push(`Analizamos ${summary.count} dias de intensidades entre ${rangeLabel}.`);
        if (summary.maxValueDate) {
            parts.push(`La rAfaga mAxima ocurrio el ${formatDisplayDate(summary.maxValueDate)} y alcanzo ${formatNumber(summary.maxValue)} mm/h.`);
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
//# sourceMappingURL=App.js.map