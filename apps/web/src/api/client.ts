import type { Series } from '@pkg/core';
import type { Insight } from '@pkg/insight-engine';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export interface SeriesQuery {
  depto: string;
  muni?: string;
  from: string;
  to: string;
  fields?: string[];
}

export interface InsightsQuery extends SeriesQuery {
  thresholds?: Record<string, unknown>;
}

export async function fetchSeries(params: SeriesQuery): Promise<Series> {
  const search = new URLSearchParams({
    depto: params.depto,
    from: params.from,
    to: params.to,
  });
  if (params.muni) search.set('muni', params.muni);
  if (params.fields?.length) search.set('fields', params.fields.join(','));

  return request<Series>(`/api/series?${search.toString()}`);
}

export async function fetchInsights(params: InsightsQuery): Promise<{
  seriesMeta: Series['meta'];
  insights: Insight[];
}> {
  const search = new URLSearchParams({
    depto: params.depto,
    from: params.from,
    to: params.to,
  });
  if (params.muni) search.set('muni', params.muni);
  if (params.fields?.length) search.set('fields', params.fields.join(','));
  if (params.thresholds) search.set('thresholds', JSON.stringify(params.thresholds));

  return request(`/api/insights?${search.toString()}`);
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed (${response.status}): ${text}`);
  }
  return (await response.json()) as T;
}
