import { useQuery } from '@tanstack/react-query';
const ARCHIVE_ENDPOINT = 'https://archive-api.open-meteo.com/v1/archive';
function startOfUtcDay(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
function parseDate(value) {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Fecha inválida: ${value}`);
    }
    return parsed;
}
function clampHistoryRange(from, to) {
    const start = parseDate(from);
    const end = parseDate(to);
    const today = startOfUtcDay(new Date());
    const yesterday = new Date(today);
    yesterday.setUTCDate(today.getUTCDate() - 1);
    if (start > yesterday) {
        return { from: start, to: start, limited: true };
    }
    const effectiveEnd = end > yesterday ? yesterday : end;
    if (effectiveEnd < start) {
        return { from: start, to: start, limited: true };
    }
    return { from: start, to: effectiveEnd, limited: end > yesterday };
}
async function fetchReferenceDaily(params) {
    const { from, to, limited } = clampHistoryRange(params.from, params.to);
    const futureOnly = from.getTime() === to.getTime() && from > startOfUtcDay(new Date());
    if (futureOnly) {
        return {
            source: 'open-meteo',
            timezone: 'UTC',
            days: [],
            coverage: {},
            note: 'El rango seleccionado es completamente futuro; no hay datos históricos para comparar.',
        };
    }
    const url = new URL(ARCHIVE_ENDPOINT);
    url.searchParams.set('latitude', params.lat.toFixed(4));
    url.searchParams.set('longitude', params.lon.toFixed(4));
    url.searchParams.set('start_date', from.toISOString().slice(0, 10));
    url.searchParams.set('end_date', to.toISOString().slice(0, 10));
    url.searchParams.set('daily', 'precipitation_sum');
    url.searchParams.set('timezone', 'UTC');
    url.searchParams.set('precipitation_unit', 'mm');
    const response = await fetch(url.toString(), { headers: { accept: 'application/json' } });
    if (!response.ok) {
        throw new Error(`Open-Meteo respondió ${response.status}`);
    }
    const json = (await response.json());
    const days = [];
    const times = json.daily?.time ?? [];
    const values = json.daily?.precipitation_sum ?? [];
    times.forEach((iso, index) => {
        const value = Number(values[index]);
        if (!iso)
            return;
        days.push({ date: iso, value: Number.isFinite(value) ? value : 0 });
    });
    return {
        source: 'open-meteo',
        timezone: json.timezone ?? 'UTC',
        days,
        coverage: { from: days[0]?.date, to: days[days.length - 1]?.date },
        note: limited
            ? 'El rango incluye días futuros. Se comparan solo los tramos históricos disponibles.'
            : undefined,
    };
}
export function useReferenceDaily(params) {
    return useQuery({
        queryKey: params
            ? ['reference-daily', params.lat, params.lon, params.from, params.to]
            : ['reference-daily', 'disabled'],
        enabled: !!params,
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        queryFn: () => fetchReferenceDaily(params),
        retry: 1,
    });
}
//# sourceMappingURL=useReferenceDaily.js.map