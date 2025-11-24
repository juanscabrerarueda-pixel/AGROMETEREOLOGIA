import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
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
const INSIGHT_KIND_META = {
    trend: { label: 'Trend', tone: 'trend', icon: '📈' },
    advice: { label: 'Consejo', tone: 'advice', icon: '💡' },
    event: { label: 'Evento', tone: 'event', icon: '⚠️' },
};
export default function App() {
    if (!FEATURE_AGROMETEO) {
        return (_jsx("main", { className: "wrap", children: _jsxs("section", { className: "card", children: [_jsx("h1", { children: "Panel agrometeorol\u00F3gico" }), _jsx("p", { children: "Activa la variable VITE_FEATURE_AGROMETEO para visualizar este tablero." })] }) }));
    }
    const { thresholds } = useThresholds();
    const desktopDefault = typeof window === 'undefined' ? true : window.innerWidth > 720;
    const [selectedDept, setSelectedDept] = useState(DEFAULT_DEPARTMENT_VALUE);
    const [selectedMuni, setSelectedMuni] = useState(DEFAULT_MUNICIPALITY_VALUE);
    const [metric, setMetric] = useState('accumulated');
    const [trendType, setTrendType] = useState('EMA');
    const [showTrend, setShowTrend] = useState(true);
    const [helpHidden, setHelpHidden] = useState(() => !desktopDefault);
    const [rangeSelection, setRangeSelection] = useState('threeMonths');
    const [range, setRange] = useState(() => buildRange(RANGE_OPTIONS[0]));
    const [refreshRate, setRefreshRate] = useState('1m');
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
        }
        else {
            setHelpHidden(false);
            setFiltersOpen(true);
            setChartOpen(true);
            setAgroOpen(true);
            setHourlyOpen(true);
            setInsightsOpen(true);
        }
    }, [isMobile]);
    const currentDepartment = DEPARTMENT_OPTIONS.find((option) => option.value === selectedDept) ?? DEPARTMENT_OPTIONS[0];
    const municipalities = currentDepartment?.municipalities ?? [];
    const activeRangeOption = rangeSelection === 'custom'
        ? undefined
        : RANGE_OPTIONS.find((option) => option.id === rangeSelection);
    const isFutureRange = activeRangeOption?.future ?? false;
    const tense = isFutureRange ? 'future' : 'past';
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
    const quickImpact = useMemo(() => buildImpactNarrative(aggregated, metric, tense), [aggregated, metric, tense]);
    const insightSummary = useMemo(() => aggregateSeries(series.data, 'accumulated'), [series.data]);
    const sectorNarratives = useMemo(() => buildSectorNarratives(aggregated, series.data, metric, tense), [aggregated, series.data, metric, tense]);
    const agroNarrative = useMemo(() => buildAgroNarrative(series.data, tense), [series.data, tense]);
    const hourlyNarrative = useMemo(() => buildHourlyNarrative(series.data, tense), [series.data, tense]);
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
    const chartNarrative = useMemo(() => buildChartNarrative(aggregated, metric, rangeSummary, series.data, trendInfo, tense), [aggregated, metric, rangeSummary, series.data, trendInfo, tense]);
    const overviewSummary = useMemo(() => ({
        location: metaSummary?.location ?? 'Selecciona una ubicación',
        updated: metaSummary?.updated ?? 'Sin dato',
        source: metaSummary?.source ?? 'Fuente no disponible',
    }), [metaSummary]);
    const summaryPills = useMemo(() => {
        if (!aggregated.count) {
            return [
                { id: 'empty', label: 'Sin datos en el rango', value: '--', note: 'Ajusta ubicación o fechas.' },
            ];
        }
        const unit = metric === 'intensity' ? 'mm/h' : 'mm';
        return [
            {
                id: 'total',
                label: tense === 'future' ? 'Total proyectado' : 'Acumulado analizado',
                value: `${formatNumber(aggregated.totalRain)} mm`,
                note: `${aggregated.count.toLocaleString('es-CO')} días con dato`,
            },
            {
                id: 'avg',
                label: 'Promedio diario',
                value: `${formatNumber(aggregated.average)} ${unit}`,
                note: 'Media del período seleccionado.',
            },
            {
                id: 'peak',
                label: metric === 'intensity' ? 'Pico horario' : 'Máximo diario',
                value: `${formatNumber(aggregated.maxValue)} ${unit}`,
                note: aggregated.maxValueDate ? formatDisplayDate(aggregated.maxValueDate) : undefined,
            },
        ];
    }, [aggregated, metric, tense]);
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
    return (_jsxs("main", { className: "wrap", children: [_jsx("header", { className: "mb4 intro", children: _jsxs("div", { className: "hero-brand", children: [_jsxs("div", { className: "brand-icon", "aria-hidden": "true", children: [_jsx("span", { className: "brand-sun" }), _jsx("span", { className: "brand-cloud" }), _jsx("span", { className: "brand-leaf left" }), _jsx("span", { className: "brand-leaf right" }), _jsx("span", { className: "brand-grid" }), _jsx("span", { className: "brand-drops" })] }), _jsxs("div", { children: [_jsx("p", { className: "tagline", children: "Tendencias de lluvia en Colombia" }), _jsx("h1", { children: "Panel agrometeorol\u00F3gico" }), _jsx("p", { className: "muted", children: "Filtra por departamento y municipio, alterna entre acumulados o intensidad diaria y usa la l\u00EDnea de tendencia para resumir comportamientos. El mapa horario te ayuda a encontrar ventanas secas o picos concentrados." })] })] }) }), _jsxs("section", { className: `card help mb4 mobile-fold ${helpHidden ? 'collapsed' : 'open'}`, children: [_jsxs("div", { className: "fold-toggle-row", children: [_jsx("strong", { children: "C?mo usar" }), _jsx("button", { type: "button", className: "btn small ghost", onClick: () => setHelpHidden((prev) => !prev), children: helpHidden ? 'Mostrar gu?a' : 'Ocultar gu?a' })] }), !helpHidden && (_jsx("div", { className: "fold-body", children: _jsxs("ol", { className: "help-steps", children: [_jsxs("li", { children: ["Comienza en ", _jsx("strong", { children: "Monitoreo en vivo" }), ": valida el sello ?Hace X min? y usa la actualizaci?n autom?tica (1, 5 o 15 min) para seguir tormentas en tiempo real."] }), _jsx("li", { children: "Elige un departamento y opcionalmente un municipio para la serie local (por defecto usa la capital) y confirma la fuente mostrada en la tarjeta en vivo." }), _jsx("li", { children: "Ajusta el rango r?pido (3 meses, 1 a?o, 5 a?os o 14 d?as de pron?stico). Tambi?n puedes fijar fechas manualmente cuando necesites comparar ventanas espec?ficas." }), _jsx("li", { children: "Alterna entre acumulado diario o intensidad m?xima, activa MA/EMA para suavizar la serie hist?rica y combina los insights autom?ticos para traducir la se?al en acciones." }), _jsx("li", { children: "Usa la distribuci?n diaria y horaria para detectar ventanas secas o picos concentrados antes de programar labores a campo." })] }) }))] }), _jsxs("section", { className: "card mobile-overview mb4", children: [_jsxs("div", { className: "overview-top", children: [_jsxs("div", { className: "overview-cell", children: [_jsx("span", { className: "tiny", children: "Ubicaci\u00F3n activa" }), _jsx("strong", { children: overviewSummary.location }), _jsx("p", { className: "muted tiny", children: rangeSummary })] }), _jsxs("div", { className: "overview-cell", children: [_jsx("span", { className: "tiny", children: "\u00DAltimo dato" }), _jsx("strong", { children: overviewSummary.updated }), _jsxs("p", { className: "muted tiny", children: ["Fuente: ", overviewSummary.source] })] })] }), _jsx("div", { className: "overview-pills", children: summaryPills.map((pill) => (_jsxs("div", { className: "overview-pill", children: [_jsx("span", { className: "tiny", children: pill.label }), _jsx("strong", { children: pill.value }), pill.note && _jsx("p", { className: "muted tiny", children: pill.note })] }, pill.id))) })] }), _jsxs("section", { className: `card controls mb4 ${filtersOpen ? 'open' : 'collapsed'}`, children: [_jsxs("div", { className: "controls-header", children: [_jsxs("div", { children: [_jsx("h2", { children: "Filtros r?pidos" }), _jsx("p", { className: "muted tiny", children: "Define ubicaci?n, rango y m?tricas para ajustar la lectura hist?rica y el pron?stico." })] }), _jsx("button", { type: "button", className: "btn small ghost", onClick: () => setFiltersOpen((prev) => !prev), children: filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros' })] }), _jsxs("div", { className: "controls-body", children: [_jsxs("div", { className: "row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Departamento" }), _jsx("select", { value: selectedDept, onChange: (event) => handleDeptChange(event.target.value), children: DEPARTMENT_OPTIONS.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Municipio / ciudad" }), _jsx("select", { value: selectedMuni, onChange: (event) => handleMuniChange(event.target.value), children: municipalities.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Desde" }), _jsx("input", { type: "date", value: range.from, onChange: (event) => handleFromChange(event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Hasta" }), _jsx("input", { type: "date", value: range.to, onChange: (event) => handleToChange(event.target.value) })] })] }), _jsxs("div", { className: "seg mt2", children: [RANGE_OPTIONS.map((option) => (_jsx("button", { type: "button", className: `btn ${rangeSelection === option.id ? 'active' : ''}`, onClick: () => handleRangePreset(option), children: option.label }, option.id))), _jsx("button", { type: "button", className: `btn small ${rangeSelection === 'custom' ? 'active' : ''}`, onClick: () => setRangeSelection('custom'), title: "Edita las fechas para definir tu rango personalizado.", children: "Personalizado" })] }), _jsx("div", { className: "seg mt2", children: METRIC_OPTIONS.map((option) => (_jsx("button", { type: "button", className: `btn ${metric === option.id ? 'active' : ''}`, onClick: () => setMetric(option.id), children: option.label }, option.id))) }), _jsxs("div", { className: "row gap mt2", children: [_jsx("button", { type: "button", className: "btn small", onClick: () => setShowTrend((prev) => !prev), disabled: isFutureRange, title: isFutureRange ? 'La tendencia no aplica a pron?sticos futuros' : '', children: showTrend ? 'Ocultar tendencia' : 'Ver tendencia' }), _jsx("div", { className: "seg compact", children: TREND_OPTIONS.map((option) => (_jsx("button", { type: "button", className: `btn small ${trendType === option.id ? 'active' : ''}`, disabled: isFutureRange, onClick: () => setTrendType(option.id), title: option.helper, children: option.label }, option.id))) })] }), _jsxs("p", { className: "muted tiny mt2", children: [metricHelper, " ", activeRangeOption ? `- ${activeRangeOption.description}` : ''] }), _jsxs("div", { className: "refresh-controls mt2", children: [_jsx("span", { className: "tiny", children: "Actualizaci?n autom?tica" }), _jsx("div", { className: "seg compact", children: REFRESH_OPTIONS.map((option) => (_jsx("button", { type: "button", className: `btn small ${refreshRate === option.id ? 'active' : ''}`, onClick: () => setRefreshRate(option.id), children: option.label }, option.id))) }), _jsx("p", { className: "muted tiny", children: refreshConfig.description })] })] })] }), _jsx(RealtimePanel, { series: series.data, busy: series.isFetching }), _jsxs("section", { className: `card chart-card mb4 mobile-fold ${chartOpen ? 'open' : 'collapsed'}`, children: [_jsxs("div", { className: "fold-toggle-row", children: [_jsxs("div", { children: [_jsx("h2", { children: "Serie diaria" }), _jsxs("p", { className: "muted tiny", children: [rangeSummary, " - ", metric === 'intensity' ? 'Intensidad m?xima por d?a' : 'Acumulado diario (mm)'] })] }), _jsx("button", { type: "button", className: "btn small ghost", onClick: () => setChartOpen((prev) => !prev), children: chartOpen ? 'Ocultar' : 'Mostrar' })] }), (chartOpen || !isMobile) && (_jsxs("div", { className: "fold-body", children: [_jsx("div", { className: `busy ${busy ? 'on' : ''}`, children: _jsxs("div", { className: "busy-pill", children: [_jsx("span", { className: "spin" }), _jsx("span", { children: "Actualizando datos..." })] }) }), _jsxs("div", { className: "series-meta tiny", children: [series.data?.meta?.source && _jsxs("span", { children: ["Fuente: ", series.data.meta.source] }), series.data?.meta?.tz && _jsxs("span", { children: ["TZ: ", series.data.meta.tz] }), _jsxs("span", { children: ["Registros: ", aggregated.count.toLocaleString('es-CO')] })] }), series.error && (_jsxs("div", { className: "error-banner mb3", children: [_jsx("strong", { children: "No fue posible actualizar la serie." }), _jsx("p", { children: series.error.message || 'No pudimos contactar la API. Revisa tu conexi?n o intenta nuevamente.' })] })), metaSummary && (_jsxs("div", { className: "meta-panel", children: [_jsxs("div", { className: "meta-item", children: [_jsx("strong", { children: "?ltima actualizaci?n" }), _jsx("span", { children: metaSummary.updated })] }), _jsxs("div", { className: "meta-item", children: [_jsx("strong", { children: "Ubicaci?n" }), _jsx("span", { children: metaSummary.location })] }), _jsxs("div", { className: "meta-item", children: [_jsx("strong", { children: "Fuente" }), _jsx("span", { children: metaSummary.source })] }), _jsxs("div", { className: "meta-item", children: [_jsx("strong", { children: "Unidad" }), _jsx("span", { children: metaSummary.unit })] })] })), _jsx(PrecipitationChart, { points: aggregated.points, trend: trendPoints, metric: metric }), _jsxs("div", { className: "mt3", children: [_jsx(DailyHeatmap, { daily: dailyData, metric: metric }), _jsxs("details", { className: "glossary", children: [_jsx("summary", { children: "C?mo leer la intensidad" }), _jsxs("ul", { children: [_jsx("li", { children: "0-5 mm: Llovizna ligera, humedece sin generar escorrentia." }), _jsx("li", { children: "5-20 mm: Lluvia moderada, posible pausa corta en labores." }), _jsx("li", { children: "20-60 mm: Temporal, suelos saturados y riesgo de charcos." }), _jsxs("li", { children: ['> 60', " mm: Evento fuerte, probables anegamientos y retrasos."] })] })] })] }), _jsx("div", { className: "kpis mt3", children: kpis.map((item) => (_jsxs("div", { className: "kpi", children: [_jsx("span", { className: "kcap", children: item.label }), _jsxs("span", { className: "kval", children: [item.value, item.badge && (_jsx("span", { className: `badge ${item.badge.tone ?? ''}`.trim(), children: item.badge.label }))] }), item.note && _jsx("span", { className: "ksub", children: item.note })] }, item.id))) }), (chartNarrative || quickImpact) && (_jsxs("div", { className: "narrative-card", children: [quickImpact && (_jsxs("p", { children: [_jsx("strong", { children: "Lectura r?pida:" }), " ", quickImpact] })), chartNarrative && _jsx("p", { className: "chart-narrative", children: chartNarrative })] }))] }))] }), _jsxs("section", { className: `card mb4 mobile-fold ${agroOpen ? 'open' : 'collapsed'}`, children: [_jsxs("div", { className: "fold-toggle-row", children: [_jsxs("div", { children: [_jsx("h2", { children: "Condiciones agroenerg?ticas" }), _jsx("p", { className: "muted tiny", children: "Temperatura y humedad del suelo, ET0, radiaci?n y viento para apoyar ganaderos, agricultores y generaci?n renovable." })] }), _jsx("button", { type: "button", className: "btn small ghost", onClick: () => setAgroOpen((prev) => !prev), children: agroOpen ? 'Ocultar' : 'Mostrar' })] }), (agroOpen || !isMobile) && (_jsxs("div", { className: "fold-body", children: [_jsx(AgroPanels, { series: series.data }), agroNarrative && (_jsx("div", { className: "narrative-card slim mt2", children: _jsx("p", { children: agroNarrative }) })), _jsxs("details", { className: "glossary mt2", children: [_jsx("summary", { children: "C?mo leer estas variables" }), _jsxs("ul", { children: [_jsx("li", { children: "Temp. ambiente 18-32 C: confortable. <15 C implica amaneceres fr?os y >32 C demanda sombra e hidrataci?n." }), _jsx("li", { children: "Sensaci?n t?rmica >35 C: riesgo de estr?s para personal y ganado." }), _jsx("li", { children: "Humedad relativa <40 %: ambiente seco, incrementa demanda h?drica; >85 % favorece hongos." }), _jsx("li", { children: "Lluvia 24h: <5 mm se absorbe rapido; >30 mm provoca charcos y compactacion." }), _jsx("li", { children: "ET0 >4 mm indica alta demanda de riego. Radiaci?n >4 kWh/m2 favorece la generaci?n solar." })] })] })] }))] }), _jsxs("section", { className: `card mb4 mobile-fold ${hourlyOpen ? 'open' : 'collapsed'}`, children: [_jsxs("div", { className: "fold-toggle-row", children: [_jsxs("div", { children: [_jsx("h2", { children: "Distribuci?n horaria" }), _jsx("p", { className: "muted tiny", children: "Identifica horarios con lluvia o ventanas secas (intensidad en mm/h)." })] }), _jsx("button", { type: "button", className: "btn small ghost", onClick: () => setHourlyOpen((prev) => !prev), children: hourlyOpen ? 'Ocultar' : 'Mostrar' })] }), (hourlyOpen || !isMobile) && (_jsxs("div", { className: "fold-body", children: [_jsx("div", { className: "hourlyWrap", children: _jsx(HourlyHeatmap, { series: series.data, variable: "prcpRate" }) }), hourlyNarrative && (_jsx("div", { className: "narrative-card slim mt2", children: _jsx("p", { children: hourlyNarrative }) })), _jsxs("details", { className: "glossary mt2", children: [_jsx("summary", { children: "C?mo leer la distribuci?n" }), _jsxs("ul", { children: [_jsx("li", { children: "Bandas intensas al amanecer indican suelos saturados: retrasa la entrada de maquinaria." }), _jsx("li", { children: "Bloques continuos >60 % se?alan varios d?as lluviosos. Busca ventanas p?lidas (<30 %) para labores cr?ticas." }), _jsx("li", { children: "Celdas claras aisladas equivalen a horas de baja probabilidad, ideales para riego o mantenimiento." })] })] })] }))] }), _jsxs("section", { className: `card insights mobile-fold ${insightsOpen ? 'open' : 'collapsed'}`, children: [_jsxs("div", { className: "fold-toggle-row", children: [_jsxs("div", { children: [_jsx("h2", { children: "Insights automatizados" }), _jsx("p", { className: "muted tiny", children: "Basados en umbrales de impacto y c?lculos del paquete insight-engine." })] }), _jsx("button", { type: "button", className: "btn small ghost", onClick: () => setInsightsOpen((prev) => !prev), children: insightsOpen ? 'Ocultar' : 'Mostrar' })] }), (insightsOpen || !isMobile) && (_jsxs("div", { className: "fold-body", children: [insightSummary.count > 0 && (_jsxs("div", { className: "insights-kpis tiny", children: [_jsxs("span", { className: "insights-chip", children: [_jsx("span", { className: "chip-label", children: "Lluvia analizada" }), _jsxs("strong", { children: [formatNumber(insightSummary.totalRain), " mm"] })] }), _jsxs("span", { className: "insights-chip", children: [_jsx("span", { className: "chip-label", children: "D?as con dato" }), _jsx("strong", { children: insightSummary.count.toLocaleString('es-CO') })] })] })), sectorNarratives && (_jsxs("div", { className: "sector-insights", children: [_jsxs("div", { children: [_jsx("strong", { children: "Agricultura" }), _jsx("p", { children: sectorNarratives.agriculture })] }), _jsxs("div", { children: [_jsx("strong", { children: "Ganader?a" }), _jsx("p", { children: sectorNarratives.livestock })] }), _jsxs("div", { children: [_jsx("strong", { children: "Energ?as renovables" }), _jsx("p", { children: sectorNarratives.energy })] })] })), insights.error ? (_jsxs("div", { className: "error-banner", children: [_jsx("strong", { children: "No fue posible generar insights." }), _jsx("p", { children: insights.error.message || 'No logramos conectar con la API de insights. Vuelve a intentarlo cuando tengas conexi?n estable.' })] })) : insights.data ? (insights.data.insights.length ? (_jsx("ul", { className: "insights-list", children: insights.data.insights.map((item) => (_jsxs("li", { className: "insight-item", children: [(() => {
                                            const meta = INSIGHT_KIND_META[item.kind] ?? { label: item.kind, tone: 'trend', icon: 'ℹ️' };
                                            return (_jsxs("span", { className: `insight-pill ${meta.tone}`, children: [_jsx("span", { className: "insight-pill-icon", "aria-hidden": "true", children: meta.icon }), meta.label] }));
                                        })(), _jsx("p", { children: item.text })] }, item.id))) })) : (_jsx("div", { className: "empty-state", children: "Sin hallazgos relevantes con los umbrales actuales. Aj?stalos para m?s sensibilidad." }))) : (_jsxs("div", { className: "skeleton", children: [_jsx("div", { className: "skeleton-bar" }), _jsx("div", { className: "skeleton-bar" }), _jsx("div", { className: "skeleton-bar" })] }))] }))] })] }));
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
function useIsMobile(breakpoint = 720) {
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window === 'undefined')
            return false;
        return window.innerWidth <= breakpoint;
    });
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        const media = window.matchMedia(`(max-width: ${breakpoint}px)`);
        const handler = () => setIsMobile(media.matches);
        handler();
        media.addEventListener('change', handler);
        return () => media.removeEventListener('change', handler);
    }, [breakpoint]);
    return isMobile;
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
    const history = computeHistoricalStats(summary);
    return [
        {
            id: 'max',
            label: metric === 'intensity' ? 'Máximo registrado' : 'Máximo diario',
            value: `${formatNumber(summary.maxValue)} ${unit}`,
            note: [formatDisplayDate(summary.maxValueDate), history?.max != null ? formatDeltaText(summary.maxValue, history.max, unit) : null]
                .filter(Boolean)
                .join(' · '),
        },
        {
            id: 'avg',
            label: 'Promedio diario',
            value: `${formatNumber(summary.average)} ${averageUnit}`,
            note: [
                `${summary.count.toLocaleString('es-CO')} días analizados`,
                history?.average != null ? formatDeltaText(summary.average, history.average, averageUnit) : null,
            ]
                .filter(Boolean)
                .join(' · '),
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
function computeHistoricalStats(summary, years = 5) {
    if (!summary.points.length || !summary.lastDate)
        return null;
    const lastStamp = Date.parse(`${summary.lastDate}T00:00:00Z`);
    if (!Number.isFinite(lastStamp))
        return null;
    const cutoff = new Date(lastStamp);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
    const cutoffMs = cutoff.getTime();
    const filtered = summary.points.filter((point) => {
        const stamp = Date.parse(`${point.date}T00:00:00Z`);
        return Number.isFinite(stamp) && stamp >= cutoffMs;
    });
    if (!filtered.length)
        return null;
    const values = filtered.map((point) => point.value);
    return {
        average: values.reduce((sum, value) => sum + value, 0) / values.length,
        max: Math.max(...values),
    };
}
function formatDeltaText(current, baseline, unit) {
    if (!Number.isFinite(current) || !Number.isFinite(baseline))
        return '';
    const delta = Number((current - baseline).toFixed(2));
    if (Math.abs(delta) < 0.01) {
        return `sin cambio vs. 5 años`;
    }
    const prefix = delta >= 0 ? '+' : '−';
    return `${prefix}${formatNumber(Math.abs(delta))} ${unit} vs. 5 años`;
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
function buildImpactNarrative(summary, metric, tense) {
    if (!summary.count)
        return null;
    const badge = buildIntensityBadge(summary.maxValue, metric);
    if (!badge)
        return null;
    const unit = metric === 'intensity' ? 'mm/h' : 'mm';
    const impact = impactFromBadge(badge.label, tense);
    const lead = tense === 'future' ? 'Se proyectan' : 'Se acumularon';
    const peakVerb = tense === 'future' ? 'podría alcanzar' : 'alcanzó';
    return `${lead} ${formatNumber(summary.totalRain)} mm en ${summary.count.toLocaleString('es-CO')} días. El pico diario ${peakVerb} ${formatNumber(summary.maxValue)} ${unit} (${badge.label}). ${impact}`;
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
function impactFromBadge(label, tense) {
    const caution = tense === 'future' ? 'podrían' : 'pudieron';
    switch (label) {
        case 'Evento fuerte':
            return `Anegamientos y retrasos logísticos ${caution} requerir ventanas secas antes de ingresar maquinaria.`;
        case 'Temporal':
            return `Suelos saturados y charcos puntuales ${caution} frenar labores pesadas.`;
        case 'Lluvia moderada':
            return `Mojado general ${caution} interrumpir labores breves; aprovecha ventanas menores a 5 mm.`;
        default:
            return 'Condiciones suaves, útiles para mantenimiento ligero y aplicaciones foliares.';
    }
}
function buildSectorNarratives(summary, series, metric, tense) {
    if (!summary.count)
        return null;
    const badge = buildIntensityBadge(summary.maxValue, metric);
    const baselines = computeAgroBaselines(series);
    const isFuture = tense === 'future';
    const agricultureParts = [];
    agricultureParts.push(`${isFuture ? 'Se proyectan' : 'Se analizaron'} ${summary.count.toLocaleString('es-CO')} días con ${formatNumber(summary.totalRain)} mm (${formatNumber(summary.average)} mm/día).`);
    if (badge?.label === 'Evento fuerte') {
        agricultureParts.push(`${isFuture ? 'La lluvia más intensa proyectada sugiere' : 'La lluvia más intensa sugirió'} atrasar siembra, fertilización foliar y entrada de maquinaria hasta que el lote drene.`);
    }
    else if (badge?.label === 'Temporal') {
        agricultureParts.push(`${isFuture ? 'Charcos probables; programa' : 'Hubo charcos probables; programar'} labores en franjas secas y verifica drenajes secundarios.`);
    }
    else if (summary.average < 5) {
        agricultureParts.push(`${isFuture ? 'Acumulado modesto proyectado' : 'Acumulado modesto observado'}, ideal para preparar riego y aprovechar cualquier evento >5 mm.`);
    }
    else {
        agricultureParts.push(`${isFuture ? 'Humedad regular proyectada' : 'Humedad regular observada'}: vigila malezas y usa las ventanas con menos de 10 mm para cosecha mecánica.`);
    }
    const livestockParts = [];
    if (badge && (badge.label === 'Temporal' || badge.label === 'Evento fuerte')) {
        livestockParts.push(`${isFuture ? 'Pasturas en zonas bajas podrían encharcarse' : 'Pasturas en zonas bajas se encharcaron'}; rota hatos a potreros altos y refuerza caminos.`);
    }
    else if (summary.average < 4) {
        livestockParts.push(`${isFuture ? 'Secuencia más seca proyectada' : 'Secuencia más seca observada'}; provee sombra, sales y agua fresca para evitar estrés térmico.`);
    }
    else {
        livestockParts.push(`${isFuture ? 'Humedad media favorecería el rebrote' : 'Humedad media favoreció el rebrote'}, pero revisa corrales en jornadas superiores a 20 mm.`);
    }
    if (baselines.wind != null) {
        livestockParts.push(baselines.wind >= 8
            ? `Viento medio ${(baselines.wind ?? 0).toFixed(1)} m/s ${isFuture ? 'ayudaría' : 'ayudó'} a ventilar establos.`
            : `Viento suave ${(baselines.wind ?? 0).toFixed(1)} m/s: monitorea insectos y calor acumulado.`);
    }
    const energyParts = [];
    if (baselines.solarKwh != null) {
        energyParts.push(baselines.solarKwh >= 4.5
            ? `Radiación ${(baselines.solarKwh ?? 0).toFixed(1)} kWh/m2: ${isFuture ? 'daría' : 'dio'} buen rendimiento fotovoltaico y para secado de forraje.`
            : `Radiación limitada (${(baselines.solarKwh ?? 0).toFixed(1)} kWh/m2); ${isFuture ? 'reduce' : 'redujo'} expectativas de generación solar.`);
    }
    if (baselines.wind != null) {
        energyParts.push(baselines.wind >= 9
            ? `Viento ${(baselines.wind ?? 0).toFixed(1)} m/s ${isFuture ? 'soportaria' : 'soporto'} turbinas menores y ventilación forzada.`
            : `Viento por debajo de ${(baselines.wind ?? 0).toFixed(1)} m/s: enfócate en capturar ventana solar.`);
    }
    if (!energyParts.length) {
        energyParts.push('Sin lecturas recientes de radiacion ni viento; mantente atento a la próxima actualización.');
    }
    return {
        agriculture: agricultureParts.join(' '),
        livestock: livestockParts.join(' '),
        energy: energyParts.join(' '),
    };
}
function buildAgroNarrative(series, tense) {
    const hourly = series?.hourly ?? [];
    if (!hourly.length)
        return null;
    const sample = sliceRecentHours(hourly, 24);
    if (!sample.length)
        return null;
    const isFuture = tense === 'future';
    const avg = (key) => {
        const values = sample
            .map((point) => (typeof point[key] === 'number' ? point[key] : null))
            .filter((value) => value !== null);
        if (!values.length)
            return null;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    };
    const sum = (key) => {
        const values = sample
            .map((point) => (typeof point[key] === 'number' ? point[key] : null))
            .filter((value) => value !== null);
        if (!values.length)
            return null;
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
    const notes = [];
    if (temp != null) {
        if (temp >= 32 || (feels ?? temp) >= 35) {
            notes.push(`${isFuture ? 'Se proyecta' : 'Se observo'} calor alto (${temp.toFixed(1)} C) con sensacion ${(feels ?? temp).toFixed(1)} C; prioriza sombra, hidratación y labores cortas.`);
        }
        else if (temp <= 16) {
            notes.push(`${isFuture ? 'Se proyectan' : 'Se observaron'} mañanas frescas (${temp.toFixed(1)} C): protege viveros y riegos tempranos.`);
        }
        else {
            notes.push(`${isFuture ? 'Se espera' : 'Hubo'} franja confortable (${temp.toFixed(1)} C) para trabajo continuo a campo.`);
        }
    }
    if (humidity != null) {
        if (humidity >= 85) {
            notes.push(`Humedad elevada (${humidity.toFixed(0)} %) ${isFuture ? 'favorecería' : 'favoreció'} hongos; ventila invernaderos.`);
        }
        else if (humidity <= 40) {
            notes.push(`Humedad baja (${humidity.toFixed(0)} %) ${isFuture ? 'elevaría' : 'elevó'} demanda hídrica y riesgo de polvo.`);
        }
        else {
            notes.push(`Humedad en equilibrio (${humidity.toFixed(0)} %).`);
        }
    }
    if (rain != null) {
        if (rain >= 40) {
            notes.push(`${isFuture ? 'Lluvia abundante proyectada' : 'Lluvia abundante observada'} (${rain.toFixed(1)} mm/24 h) ${isFuture ? 'saturaría' : 'saturó'} suelos; espera drenaje antes de entrar maquinaria.`);
        }
        else if (rain >= 12) {
            notes.push(`Lluvia útil (${rain.toFixed(1)} mm) ${isFuture ? 'recargaría' : 'recargó'} humedad superficial.`);
        }
        else if (rain < 5) {
            notes.push(`Solo ${rain.toFixed(1)} mm en 24 h: ten listo riego suplementario.`);
        }
    }
    else {
        notes.push(`${isFuture ? 'Sin acumulado esperado' : 'Sin acumulado observado'} en las últimas 24 h.`);
    }
    if (evap != null) {
        notes.push(evap >= 5
            ? `ET0 de ${evap.toFixed(1)} mm ${isFuture ? 'indicaría' : 'indicó'} demanda hídrica alta.`
            : `ET0 ${evap.toFixed(1)} mm ${isFuture ? 'mantendría' : 'mantuvo'} consumo moderado.`);
    }
    if (solarKwh != null) {
        notes.push(solarKwh >= 4.5
            ? `Radiación ${(solarKwh ?? 0).toFixed(1)} kWh/m2 ${isFuture ? 'habilitaría' : 'habilitó'} buena generación solar.`
            : `Radiación limitada ${(solarKwh ?? 0).toFixed(1)} kWh/m2; planifica secado con más tiempo.`);
    }
    if (wind != null) {
        notes.push(wind >= 9
            ? `Viento ${(wind ?? 0).toFixed(1)} m/s: ${isFuture ? 'aseguraría' : 'aseguró'} cubiertas y controla deriva de pulverizaciones.`
            : `Viento suave ${(wind ?? 0).toFixed(1)} m/s ${isFuture ? 'mantendría' : 'mantuvo'} condiciones estables para equipos expuestos.`);
    }
    return notes.join(' ');
}
function buildHourlyNarrative(series, tense) {
    const hourly = series?.hourly ?? [];
    if (!hourly.length)
        return null;
    const sample = sliceRecentHours(hourly, 72);
    if (!sample.length)
        return null;
    const isFuture = tense === 'future';
    const ratePoints = sample
        .map((point) => point.t && typeof point.prcpRate === 'number'
        ? { iso: point.t, value: Number(point.prcpRate.toFixed(2)) }
        : null)
        .filter((item) => !!item);
    if (!ratePoints.length)
        return null;
    const ordered = [...ratePoints].sort((a, b) => a.iso.localeCompare(b.iso));
    const peak = ordered.reduce((max, point) => (point.value > max.value ? point : max), ordered[0]);
    let bestDryStart = null;
    let bestDryLen = 0;
    let currentStart = null;
    let currentLen = 0;
    for (const point of ordered) {
        if (point.value < 0.2) {
            if (!currentLen)
                currentStart = point.iso;
            currentLen += 1;
        }
        else if (currentLen) {
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
    const notes = [];
    notes.push(`${isFuture ? 'Pico proyectado' : 'Pico registrado'}: ${peak.value.toFixed(1)} mm/h el ${formatHourLabel(peak.iso)}.`);
    if (bestDryStart && bestDryLen >= 3) {
        notes.push(`Ventana seca ${isFuture ? 'proyectada' : 'observada'} de ${bestDryLen} h entre ${formatHourRange(bestDryStart, bestDryLen)}.`);
    }
    else {
        notes.push(`Sin ventanas secas mayores a 3 h en las ${isFuture ? 'próximas' : 'últimas'} 72 h.`);
    }
    notes.push(wetShare >= 50
        ? `Más del 50% de las horas ${isFuture ? 'proyectadas' : 'recientes'} tuvieron lluvia significativa; agenda labores bajo techo.`
        : `Solo ${wetShare}% de las horas ${isFuture ? 'proyectadas' : 'observadas'} muestran lluvia >2 mm/h; aprovecha las franjas restantes para riego o mantenimiento.`);
    return notes.join(' ');
}
function formatHourLabel(iso) {
    if (!iso)
        return 'sin fecha';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return iso;
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const hour = date.getUTCHours().toString().padStart(2, '0');
    return `${day}/${month} ${hour}:00 UTC`;
}
function formatHourRange(startIso, hours) {
    const start = new Date(startIso);
    if (Number.isNaN(start.getTime()))
        return `${startIso} +${hours}h`;
    const end = new Date(start.getTime() + hours * MS_PER_HOUR);
    return `${formatHourLabel(startIso)} - ${formatHourLabel(end.toISOString())}`;
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
function buildChartNarrative(summary, metric, rangeLabel, series, trendInfo, tense) {
    if (!summary.count) {
        return '';
    }
    const isFuture = tense === 'future';
    const parts = [];
    if (metric === 'accumulated') {
        parts.push(`Entre ${rangeLabel} ${isFuture ? 'se proyectan' : 'se acumularon'} ${formatNumber(summary.totalRain)} mm${isFuture ? ' proyectados' : ''} distribuidos en ${summary.count} días con datos.`);
        if (summary.maxValueDate) {
            parts.push(`El día más lluvioso ${isFuture ? 'proyectado sería' : 'fue'} ${formatDisplayDate(summary.maxValueDate)}, con ${formatNumber(summary.maxValue)} mm en 24 horas.`);
        }
    }
    else {
        parts.push(`${isFuture ? 'Se proyectan' : 'Se analizaron'} ${summary.count} días de intensidades entre ${rangeLabel}.`);
        if (summary.maxValueDate) {
            parts.push(`La ráfaga máxima ${isFuture ? 'proyectada ocurriría' : 'ocurrió'} el ${formatDisplayDate(summary.maxValueDate)} y ${isFuture ? 'alcanzaría' : 'alcanzó'} ${formatNumber(summary.maxValue)} mm/h.`);
        }
    }
    if (trendInfo.value !== 'Sin datos') {
        parts.push(`La serie suavizada ${isFuture ? 'proyectada' : 'observada'} indica un comportamiento ${trendInfo.value.toLowerCase()} (${trendInfo.note}).`);
    }
    if (series?.meta?.source) {
        const tzNote = series.meta.tz ? `, zona ${series.meta.tz}` : '';
        parts.push(`Fuente: ${series.meta.source}${tzNote}.`);
    }
    return parts.join(' ');
}
//# sourceMappingURL=App.js.map