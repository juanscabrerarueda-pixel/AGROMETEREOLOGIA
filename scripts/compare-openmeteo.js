#!/usr/bin/env node
/**
 * Utilidad CLI para comparar la lluvia diaria agregada desde Open-Meteo
 * (endpoint horario) contra la serie servida por nuestra API.
 *
 * Uso:
 *   node scripts/compare-openmeteo.js --depto Antioquia --muni tamesis \
 *     --lat 5.665 --lon -75.713 --from 2025-08-28 --to 2025-11-25
 *
 * Flags opcionales:
 *   --api https://...   (URL base alternativa para la API interna)
 *   --threshold 12      (mm de diferencia para marcar días sospechosos)
 *
 * Requiere Node 18+ (fetch nativo). Usa HTTPS y no guarda archivos.
 */
const https = require('https');

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = 'true';
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

const params = parseArgs();
const required = ['depto', 'lat', 'lon', 'from', 'to'];
const missing = required.filter((key) => !params[key]);
if (missing.length) {
  console.error(`Faltan argumentos: ${missing.join(', ')}`);
  process.exit(1);
}

const config = {
  depto: params.depto,
  muni: params.muni ?? '',
  lat: Number(params.lat),
  lon: Number(params.lon),
  from: params.from,
  to: params.to,
  apiBase: params.api ?? 'https://agrometereologia-1.onrender.com',
  threshold: Number(params.threshold ?? '12'),
};

if (Number.isNaN(config.lat) || Number.isNaN(config.lon)) {
  console.error('Latitud y longitud deben ser números.');
  process.exit(1);
}

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { accept: 'application/json' } }, (response) => {
      if (response.statusCode && response.statusCode >= 400) {
        reject(new Error(`Fallo la solicitud (${response.statusCode}) a ${url}`));
        return;
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('error', (error) => reject(error));
  });
}

function aggregateOpenMeteo(data) {
  const time = data?.hourly?.time ?? [];
  const precip = data?.hourly?.precipitation ?? [];
  const daily = new Map();
  time.forEach((timestamp, index) => {
    const value = Number(precip[index]) || 0;
    const day = timestamp.slice(0, 10);
    daily.set(day, (daily.get(day) ?? 0) + value);
  });
  return daily;
}

function aggregateApiSeries(data) {
  const daily = new Map();
  const hourly = Array.isArray(data?.hourly) ? data.hourly : [];
  hourly.forEach((point) => {
    if (typeof point?.prcp !== 'number') return;
    const day = (point.t ?? '').slice(0, 10);
    if (!day) return;
    daily.set(day, (daily.get(day) ?? 0) + point.prcp);
  });
  return daily;
}

function collectDiffs(openDaily, apiDaily) {
  const allDays = new Set([...openDaily.keys(), ...apiDaily.keys()]);
  const rows = [];
  for (const day of Array.from(allDays).sort()) {
    const openValue = openDaily.get(day) ?? 0;
    const apiValue = apiDaily.get(day) ?? 0;
    const delta = apiValue - openValue;
    const pct = openValue === 0 ? null : (delta / openValue) * 100;
    rows.push({ day, openValue, apiValue, delta, pct });
  }
  return rows;
}

function formatNumber(value) {
  return value.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

(async () => {
  const openUrl = new URL('https://archive-api.open-meteo.com/v1/archive');
  openUrl.searchParams.set('latitude', config.lat.toFixed(4));
  openUrl.searchParams.set('longitude', config.lon.toFixed(4));
  openUrl.searchParams.set('start_date', config.from);
  openUrl.searchParams.set('end_date', config.to);
  openUrl.searchParams.set('hourly', 'precipitation');
  openUrl.searchParams.set('timezone', 'UTC');
  openUrl.searchParams.set('precipitation_unit', 'mm');

  const apiUrl = new URL(`${config.apiBase.replace(/\/$/, '')}/api/series`);
  apiUrl.searchParams.set('depto', config.depto);
  apiUrl.searchParams.set('from', config.from);
  apiUrl.searchParams.set('to', config.to);
  if (config.muni) apiUrl.searchParams.set('muni', config.muni);

  console.log('Descargando Open-Meteo...');
  const openData = await fetchJson(openUrl.toString());
  console.log('Descargando serie interna...');
  const apiData = await fetchJson(apiUrl.toString());

  const openDaily = aggregateOpenMeteo(openData);
  const apiDaily = aggregateApiSeries(apiData);
  const diffs = collectDiffs(openDaily, apiDaily);

  const threshold = Number.isFinite(config.threshold) ? config.threshold : 12;
  const flagged = diffs.filter((row) => Math.abs(row.delta) >= threshold);

  console.log('');
  console.log(`Comparación ${config.depto}${config.muni ? ` · ${config.muni}` : ''}`);
  console.log(`${config.from} -> ${config.to}`);
  console.log(`Días analizados: ${diffs.length}`);
  console.log(`Días con diferencia >= ${threshold} mm: ${flagged.length}`);
  console.log('');

  console.log('Fecha       | Open-Meteo | API interna | Δ mm | Δ %');
  console.log('------------|-----------:|-----------:|-----:|-----:');
  flagged.forEach((row) => {
    const pct = row.pct == null ? '—' : `${row.pct >= 0 ? '+' : ''}${row.pct.toFixed(0)}%`;
    console.log(
      `${row.day} | ${formatNumber(row.openValue).padStart(10)} | ${formatNumber(row.apiValue).padStart(10)} | ${row.delta.toFixed(1).padStart(5)} | ${pct.padStart(5)}`
    );
  });

  if (flagged.length === 0) {
    console.log('No se detectaron diferencias significativas con el umbral dado.');
  }

  console.log('');
  console.log('Consejo: cruza estos días con IDEAM/CHIRPS o estaciones propias antes de descartar los datos.');
})().catch((error) => {
  console.error('No fue posible completar la comparación.');
  console.error(error.message || error);
  process.exit(1);
});
