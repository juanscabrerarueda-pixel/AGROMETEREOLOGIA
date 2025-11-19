const API_BASE = import.meta.env.VITE_API_BASE ?? '';
export async function fetchSeries(params) {
    const search = new URLSearchParams({
        depto: params.depto,
        from: params.from,
        to: params.to,
    });
    if (params.muni)
        search.set('muni', params.muni);
    if (params.fields?.length)
        search.set('fields', params.fields.join(','));
    return request(`/api/series?${search.toString()}`);
}
export async function fetchInsights(params) {
    const search = new URLSearchParams({
        depto: params.depto,
        from: params.from,
        to: params.to,
    });
    if (params.muni)
        search.set('muni', params.muni);
    if (params.fields?.length)
        search.set('fields', params.fields.join(','));
    if (params.thresholds)
        search.set('thresholds', JSON.stringify(params.thresholds));
    return request(`/api/insights?${search.toString()}`);
}
async function request(path) {
    const response = await fetch(`${API_BASE}${path}`, {
        headers: { accept: 'application/json' },
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API request failed (${response.status}): ${text}`);
    }
    return (await response.json());
}
//# sourceMappingURL=client.js.map