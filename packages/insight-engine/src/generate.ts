import { Series, Thresholds } from '@pkg/core';
import { peaksIntensity, thiBand, thiC } from '@pkg/meteo-calcs';
import { Insight } from './types.js';

function resolveTomorrowIso(series: Series): string {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const tzOffsetMinutes = parseTzOffset(series.meta?.tz);
  if (tzOffsetMinutes !== null) {
    const shifted = new Date(tomorrow.getTime() + tzOffsetMinutes * 60 * 1000);
    return shifted.toISOString().slice(0, 10);
  }
  return tomorrow.toISOString().slice(0, 10);
}

function parseTzOffset(tz?: string): number | null {
  if (!tz) return null;
  const match = tz.match(/([+-]\d{2}):?(\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? '0');
  return hours * 60 + Math.sign(hours) * minutes;
}

export function insightsFromSeries(series: Series, thresholds: Thresholds): Insight[] {
  if (!series || !Array.isArray(series.hourly)) return [];

  const insights: Insight[] = [];
  const hourly = series.hourly as Series['hourly'];
  const daily = summarizeDaily(series);
  const rangeText = buildRangeLabel(series);

  if (daily.totalDays > 0) {
    const rainSentence =
      daily.totalRain > 0
        ? `Entre ${rangeText} se acumularon ${formatNumber(daily.totalRain)} mm repartidos en ${daily.totalDays} dias con registro.`
        : `Entre ${rangeText} no se registro lluvia medible.`;
    const maxSentence =
      daily.maxRainDate && daily.maxRain > 0
        ? `El dia mas lluvioso fue ${formatDate(daily.maxRainDate)} con ${formatNumber(daily.maxRain)} mm.`
        : '';
    const lastSentence =
      daily.lastRainDate && daily.lastRainValue != null
        ? `El ultimo dia con lluvia fue ${formatDate(daily.lastRainDate)}, cuando cayeron ${formatNumber(daily.lastRainValue)} mm.`
        : '';

    insights.push({
      id: 'daily-summary',
      kind: 'trend',
      text: `${rainSentence} ${maxSentence} ${lastSentence}`.trim(),
      data: { daily },
    });
  }

  if (daily.longestDry?.length && daily.longestDry.length >= (thresholds?.drySpellDays ?? 5)) {
    const dry = daily.longestDry;
    insights.push({
      id: 'dry-spell',
      kind: 'advice',
      text: `Se presento una sequia de ${dry.length} dias entre ${formatDate(dry.from)} y ${formatDate(dry.to)}. Considera riego suplementario o proteger los cultivos sensibles.`,
      data: dry,
    });
  }

  const peaks = peaksIntensity(hourly, thresholds?.intensityMmHr ?? 6);
  if (peaks.length) {
    const highest = peaks.reduce((max, peak) => (peak.value > max.value ? peak : max), peaks[0]);
    insights.push({
      id: 'intensity-peaks',
      kind: 'event',
      text: `Detectamos ${peaks.length} episodios con intensidades superiores a ${(thresholds?.intensityMmHr ?? 6).toFixed(1)} mm/h. El mas intenso alcanzo ${formatNumber(highest.value)} mm/h el ${formatDate(highest.from)}.`,
      data: { peaks },
    });
  }

  const tomorrowIso = resolveTomorrowIso(series);
  const thiCandidates = hourly.filter(
    (h: Series['hourly'][number]) =>
      typeof h.temp === 'number' && typeof h.rh === 'number' && h.t.startsWith(tomorrowIso)
  );
  if (thiCandidates.length) {
    const thiValues = thiCandidates.map((h) => thiC(h.temp as number, h.rh as number));
    const maxThi = Math.max(...thiValues);
    const band = thiBand(maxThi, thresholds?.thiBands);
    insights.push({
      id: 'thi-tomorrow',
      kind: 'advice',
      text: `Para manana se proyecta un THI maximo de ${maxThi.toFixed(1)} (${band}). Ajusta ventilacion, sombra o hidratacion si observas estres termico.`,
      data: { maxThi, band, points: thiCandidates },
    });
  }

  const rootMoist = averageField(hourly, 'soilMoist9', 48);
  if (rootMoist != null) {
    if (rootMoist < 0.18) {
      insights.push({
        id: 'root-moisture-low',
        kind: 'advice',
        text: `El perfil 10-30 cm muestra humedad baja (${(rootMoist * 100).toFixed(
          0
        )}%). Planea riego o rota el ganado para proteger las pasturas.`,
      });
    } else if (rootMoist > 0.45) {
      insights.push({
        id: 'root-moisture-high',
        kind: 'advice',
        text: `Suelo muy humedo (${(rootMoist * 100).toFixed(
          0
        )}%). Evita labores pesadas para no compactar ni danar cultivos.`,
      });
    }
  }

  const evapDemand = sumField(hourly, 'evap', 24);
  if (evapDemand != null && evapDemand > 5) {
    insights.push({
      id: 'et0-demand',
      kind: 'advice',
      text: `La ET0 alcanzo ${evapDemand.toFixed(
        1
      )} mm en las ultimas 24 h. Refuerza hidratacion animal o riego.`,
    });
  }

  const solarAvg = averageField(hourly, 'rs', 24);
  if (solarAvg != null && solarAvg > 650) {
    insights.push({
      id: 'solar-window',
      kind: 'event',
      text: 'Alta radiacion solar: condiciones favorables para secado de forrajes y generacion fotovoltaica.',
    });
  }

  return insights;
}

type DailySummary = {
  totalRain: number;
  totalDays: number;
  maxRain: number;
  maxRainDate?: string;
  lastRainDate?: string;
  lastRainValue?: number;
  longestDry?: { from: string; to: string; length: number };
};

function summarizeDaily(series: Series): DailySummary {
  const buckets = new Map<string, { rain: number }>();
  for (const point of series.hourly ?? []) {
    const day = point.t?.slice(0, 10);
    if (!day) continue;
    const bucket = buckets.get(day) ?? { rain: 0 };
    if (typeof point.prcp === 'number') bucket.rain += point.prcp;
    buckets.set(day, bucket);
  }

  const dates = Array.from(buckets.keys()).sort();
  let totalRain = 0;
  let totalDays = 0;
  let maxRain = 0;
  let maxRainDate: string | undefined;
  let lastRainDate: string | undefined;
  let lastRainValue: number | undefined;
  let currentDryLength = 0;
  let currentDryStart: string | undefined;
  let longestDry: { from: string; to: string; length: number } | undefined;

  for (const date of dates) {
    const rain = buckets.get(date)?.rain ?? 0;
    if (rain >= 0.5) {
      totalRain += rain;
      totalDays += 1;
      lastRainDate = date;
      lastRainValue = rain;
      if (rain > maxRain) {
        maxRain = rain;
        maxRainDate = date;
      }
      if (currentDryLength > 0 && (!longestDry || currentDryLength > longestDry.length) && currentDryStart) {
        longestDry = {
          from: currentDryStart,
          to: addDaysToIso(currentDryStart, currentDryLength - 1),
          length: currentDryLength,
        };
      }
      currentDryLength = 0;
      currentDryStart = undefined;
    } else {
      currentDryLength += 1;
      if (!currentDryStart) currentDryStart = date;
    }
  }

  if (currentDryLength > 0 && (!longestDry || currentDryLength > longestDry.length) && currentDryStart) {
    longestDry = {
      from: currentDryStart,
      to: addDaysToIso(currentDryStart, currentDryLength - 1),
      length: currentDryLength,
    };
  }

  return { totalRain, totalDays, maxRain, maxRainDate, lastRainDate, lastRainValue, longestDry };
}

function buildRangeLabel(series: Series): string {
  const from = series.range?.from ?? '';
  const to = series.range?.to ?? '';
  return `${formatDate(from)} - ${formatDate(to)}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString('es-CO', { maximumFractionDigits: 1 });
}

function formatDate(iso?: string): string {
  if (!iso) return 'sin fecha';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

function addDaysToIso(startIso: string, days: number): string {
  const date = new Date(`${startIso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return startIso;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const MS_PER_HOUR = 60 * 60 * 1000;

function sliceRecent(hourly: Series['hourly'], hours: number): Series['hourly'] {
  if (!hourly.length) return [];
  const last = new Date(hourly[hourly.length - 1].t ?? 0).getTime();
  const threshold = last - hours * MS_PER_HOUR;
  return hourly.filter((point) => {
    const t = new Date(point.t ?? 0).getTime();
    return Number.isFinite(t) && t >= threshold;
  });
}

function averageField(hourly: Series['hourly'], key: keyof Series['hourly'][number], hours: number) {
  const slice = sliceRecent(hourly, hours);
  const values = slice
    .map((point) => (typeof point[key] === 'number' ? (point[key] as number) : null))
    .filter((value): value is number => value !== null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sumField(hourly: Series['hourly'], key: keyof Series['hourly'][number], hours: number) {
  const slice = sliceRecent(hourly, hours);
  const values = slice
    .map((point) => (typeof point[key] === 'number' ? (point[key] as number) : null))
    .filter((value): value is number => value !== null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0);
}


