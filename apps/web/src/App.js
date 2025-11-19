import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import './App.css';
import { FEATURE_AGROMETEO } from './config/flags';
import { useSeries } from './hooks/useSeries';
import { useInsights } from './hooks/useInsights';
import { useThresholds } from './state/thresholds';
import { PrecipitationChart, } from './components/PrecipitationChart';
import { HourlyHeatmap } from './components/HourlyHeatmap';
import { RealtimePanel } from './components/RealtimePanel';
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
const METRIC_OPTIONS = [
    { id: 'accumulated', label: 'Acumulado diario', helper: 'Suma mm por día (precipitación acumulada).' },
    { id: 'intensity', label: 'Intensidad (mm/h)', helper: 'Pico horario diario (mm/h) como proxy de intensidad.' },
];
const TREND_OPTIONS = [
    { id: 'MA', label: 'MA', helper: 'Media móvil con ventana fija.' },
    { id: 'EMA', label: 'EMA', helper: 'Media móvil exponencial (pondera lo reciente).' },
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
        return (_jsx("main", { className: "wrap", children: _jsxs("section", { className: "card", children: [_jsx("h1", { children: "Panel agrometeorol\u00F3gico" }), _jsx("p", { children: "Activa la variable VITE_FEATURE_AGROMETEO para visualizar este tablero." })] }) }));
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
        fields: ['prcp', 'prcpRate', 'temp', 'rh', 'wind', 'rs', 'pressure'],
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
    return (_jsxs("main", { className: "wrap", children: [_jsxs("header", { className: "mb4 intro", children: [_jsx("p", { className: "tagline", children: "Tendencias de lluvia en Colombia" }), _jsx("h1", { children: "Panel agrometeorol\u00F3gico" }), _jsx("p", { className: "muted", children: "Filtra por departamento y municipio, alterna entre acumulados o intensidad diaria y usa la l\u00EDnea de tendencia para resumir comportamientos. El mapa horario te ayuda a encontrar ventanas secas o picos concentrados." })] }), _jsxs("section", { className: "card help mb4", children: [_jsxs("div", { className: "help-header", children: [_jsx("strong", { children: "C\u00F3mo usar" }), _jsx("button", { type: "button", className: "btn small", onClick: () => setHelpHidden((prev) => !prev), children: helpHidden ? 'Mostrar guía' : 'Ocultar guía' })] }), !helpHidden && (_jsxs("ol", { className: "help-steps", children: [_jsx("li", { children: "Elige un departamento y opcionalmente un municipio para la serie local (por defecto usa la capital)." }), _jsx("li", { children: "Ajusta el rango r\u00E1pido (3 meses, 1 a\u00F1o, 5 a\u00F1os o 14 d\u00EDas de pron\u00F3stico). Tambi\u00E9n puedes fijar fechas manualmente." }), _jsx("li", { children: "Alterna entre acumulado diario o intensidad m\u00E1xima, y activa MA/EMA para suavizar la serie hist\u00F3rica." }), _jsx("li", { children: "Usa la distribuci\u00F3n horaria para detectar ventanas secas y revisa los insights autom\u00E1ticos para recomendaciones puntuales." })] }))] }), _jsxs("section", { className: "card controls mb4", children: [_jsxs("div", { className: "row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Departamento" }), _jsx("select", { value: selectedDept, onChange: (event) => handleDeptChange(event.target.value), children: DEPARTMENT_OPTIONS.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Municipio / ciudad" }), _jsx("select", { value: selectedMuni, onChange: (event) => handleMuniChange(event.target.value), children: municipalities.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Desde" }), _jsx("input", { type: "date", value: range.from, onChange: (event) => handleFromChange(event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Hasta" }), _jsx("input", { type: "date", value: range.to, onChange: (event) => handleToChange(event.target.value) })] })] }), _jsxs("div", { className: "seg mt2", children: [RANGE_OPTIONS.map((option) => (_jsx("button", { type: "button", className: `btn ${rangeSelection === option.id ? 'active' : ''}`, onClick: () => handleRangePreset(option), children: option.label }, option.id))), _jsx("button", { type: "button", className: `btn small ${rangeSelection === 'custom' ? 'active' : ''}`, onClick: () => setRangeSelection('custom'), title: "Edita las fechas para definir tu rango personalizado.", children: "Personalizado" })] }), _jsx("div", { className: "seg mt2", children: METRIC_OPTIONS.map((option) => (_jsx("button", { type: "button", className: `btn ${metric === option.id ? 'active' : ''}`, onClick: () => setMetric(option.id), children: option.label }, option.id))) }), _jsxs("div", { className: "row gap mt2", children: [_jsx("button", { type: "button", className: "btn small", onClick: () => setShowTrend((prev) => !prev), disabled: isFutureRange, title: isFutureRange ? 'La tendencia no aplica a pronósticos futuros' : '', children: showTrend ? 'Ocultar tendencia' : 'Ver tendencia' }), _jsx("div", { className: "seg compact", children: TREND_OPTIONS.map((option) => (_jsx("button", { type: "button", className: `btn small ${trendType === option.id ? 'active' : ''}`, disabled: isFutureRange, onClick: () => setTrendType(option.id), title: option.helper, children: option.label }, option.id))) })] }), _jsxs("p", { className: "muted tiny mt2", children: [metricHelper, " ", activeRangeOption ? `- ${activeRangeOption.description}` : ''] }), _jsxs("div", { className: "refresh-controls mt2", children: [_jsx("span", { className: "tiny", children: "Actualizaci\u00F3n autom\u00E1tica" }), _jsx("div", { className: "seg compact", children: REFRESH_OPTIONS.map((option) => (_jsx("button", { type: "button", className: `btn small ${refreshRate === option.id ? 'active' : ''}`, onClick: () => setRefreshRate(option.id), children: option.label }, option.id))) }), _jsx("p", { className: "muted tiny", children: refreshConfig.description })] })] }), _jsx(RealtimePanel, { series: series.data, busy: series.isFetching }), _jsxs("section", { className: "card chart-card mb4", children: [_jsx("div", { className: `busy ${busy ? 'on' : ''}`, children: _jsxs("div", { className: "busy-pill", children: [_jsx("span", { className: "spin" }), _jsx("span", { children: "Actualizando datos..." })] }) }), _jsxs("div", { className: "section-header", children: [_jsxs("div", { children: [_jsx("h2", { children: "Serie diaria" }), _jsxs("p", { className: "muted tiny", children: [rangeSummary, " - ", metric === 'intensity' ? 'Intensidad maxima por dia' : 'Acumulado diario (mm)'] })] }), _jsxs("div", { className: "series-meta tiny", children: [series.data?.meta?.source && _jsxs("span", { children: ["Fuente: ", series.data.meta.source] }), series.data?.meta?.tz && _jsxs("span", { children: ["TZ: ", series.data.meta.tz] }), _jsxs("span", { children: ["Registros: ", aggregated.count.toLocaleString('es-CO')] })] })] }), series.error && (_jsxs("div", { className: "error-banner mb3", children: [_jsx("strong", { children: "No fue posible actualizar la serie." }), _jsx("p", { children: series.error.message || 'No pudimos contactar la API. Revisa tu conexión o intenta nuevamente.' })] })), _jsx(PrecipitationChart, { points: aggregated.points, trend: trendPoints, metric: metric }), _jsx("div", { className: "kpis mt3", children: kpis.map((item) => (_jsxs("div", { className: "kpi", children: [_jsx("span", { className: "kcap", children: item.label }), _jsx("span", { className: "kval", children: item.value }), item.note && _jsx("span", { className: "ksub", children: item.note })] }, item.id))) }), chartNarrative && _jsx("p", { className: "chart-narrative", children: chartNarrative })] }), _jsxs("section", { className: "card mb4", children: [_jsx("div", { className: "section-header", children: _jsxs("div", { children: [_jsx("h2", { children: "Distribuci\u00F3n horaria" }), _jsx("p", { className: "muted tiny", children: "Identifica horarios con lluvia o ventanas secas (intensidad en mm/h)." })] }) }), _jsx("div", { className: "hourlyWrap", children: _jsx(HourlyHeatmap, { series: series.data, variable: "prcpRate" }) })] }), _jsxs("section", { className: "card insights", children: [_jsx("div", { className: "section-header", children: _jsxs("div", { children: [_jsx("h2", { children: "Insights automatizados" }), _jsx("p", { className: "muted tiny", children: "Basados en umbrales de impacto y c\u00E1lculos del paquete insight-engine." })] }) }), insights.error ? (_jsxs("div", { className: "error-banner", children: [_jsx("strong", { children: "No fue posible generar insights." }), _jsx("p", { children: insights.error.message ||
                                    'No logramos conectar con la API de insights. Vuelve a intentarlo cuando tengas conexión estable.' })] })) : insights.data ? (insights.data.insights.length ? (_jsx("ul", { className: "insights-list", children: insights.data.insights.map((insight) => (_jsxs("li", { className: "insight-item", children: [_jsx("strong", { children: insight.kind }), _jsx("p", { children: insight.text })] }, insight.id))) })) : (_jsx("div", { className: "empty-state", children: "Sin hallazgos relevantes con los umbrales actuales. Aj\u00FAstalos para m\u00E1s sensibilidad." }))) : (_jsxs("div", { className: "skeleton", children: [_jsx("div", { className: "skeleton-bar" }), _jsx("div", { className: "skeleton-bar" }), _jsx("div", { className: "skeleton-bar" })] }))] })] }));
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
function summarizeTrend(trend) {
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
        parts.push(`Entre ${rangeLabel} se acumularon ${formatNumber(summary.totalRain)} mm distribuidos en ${summary.count} días con datos.`);
        if (summary.maxValueDate) {
            parts.push(`El día más lluvioso fue ${formatDisplayDate(summary.maxValueDate)}, cuando se registraron ${formatNumber(summary.maxValue)} mm en 24 horas.`);
        }
    }
    else {
        parts.push(`Analizamos ${summary.count} días de intensidades entre ${rangeLabel}.`);
        if (summary.maxValueDate) {
            parts.push(`La ráfaga máxima ocurrió el ${formatDisplayDate(summary.maxValueDate)} y alcanzó ${formatNumber(summary.maxValue)} mm/h.`);
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