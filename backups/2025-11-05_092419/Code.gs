const TZ = 'America/Bogota';

const CAPITALS = {
  Amazonas: 'Leticia',
  Antioquia: 'Medell\u00edn',
  Arauca: 'Arauca',
  Atl\u00e1ntico: 'Barranquilla',
  Bol\u00edvar: 'Cartagena de Indias',
  Boyac\u00e1: 'Tunja',
  Caldas: 'Manizales',
  Caquet\u00e1: 'Florencia',
  Casanare: 'Yopal',
  Cauca: 'Popay\u00e1n',
  Cesar: 'Valledupar',
  Choc\u00f3: 'Quibd\u00f3',
  C\u00f3rdoba: 'Monter\u00eda',
  Cundinamarca: 'Bogot\u00e1',
  Guain\u00eda: 'In\u00edrida',
  Guaviare: 'San Jos\u00e9 del Guaviare',
  Huila: 'Neiva',
  'La Guajira': 'Riohacha',
  Magdalena: 'Santa Marta',
  Meta: 'Villavicencio',
  Nari\u00f1o: 'Pasto',
  'Norte de Santander': 'C\u00facuta',
  Putumayo: 'Mocoa',
  Quind\u00edo: 'Armenia',
  Risaralda: 'Pereira',
  'San Andr\u00e9s y Providencia': 'San Andr\u00e9s',
  'Archipi\u00e9lago de San Andr\u00e9s, Providencia y Santa Catalina': 'San Andr\u00e9s',
  Santander: 'Bucaramanga',
  Sucre: 'Sincelejo',
  Tolima: 'Ibagu\u00e9',
  'Valle del Cauca': 'Santiago de Cali',
  Vaup\u00e9s: 'Mit\u00fa',
  Vichada: 'Puerto Carre\u00f1o',
  'Bogot\u00e1 D.C.': 'Bogot\u00e1',
  'Bogot\u00e1, D.C.': 'Bogot\u00e1',
};

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Tendencias de Lluvia - CO')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

// ---------- Fetch helpers ----------

function getJSON(url) {
  const res = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      'Accept-Encoding': 'gzip',
      'User-Agent': 'GAS-lluvia/1.0',
    },
  });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('HTTP ' + code + ' ' + url);
  }
  return JSON.parse(res.getContentText('UTF-8'));
}

const CACHE = CacheService.getScriptCache();

function cget(key) {
  try {
    const value = CACHE.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    return null;
  }
}

function cput(key, obj, ttl) {
  try {
    CACHE.put(key, JSON.stringify(obj), ttl);
  } catch (err) {
    // noop
  }
}

// ---------- API Colombia ----------

function getDepts() {
  const CK = 'depts_v1';
  const hit = cget(CK);
  if (hit) return hit;
  try {
    const departments = getJSON('https://api-colombia.com/api/v1/Department');
    departments.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const payload = {
      offline: false,
      items: departments.map((d) => ({ id: String(d.id), name: d.name })),
    };
    cput(CK, payload, 43200); // 12 h
    return payload;
  } catch (err) {
    const fallbackItems = Object.keys(CAPITALS).map((name, idx) => ({
      id: String(idx),
      name,
    }));
    const payload = { offline: true, items: fallbackItems };
    cput(CK, payload, 3600); // 1 h
    return payload;
  }
}

function getCities(deptId) {
  const CK = 'cities_' + deptId;
  const hit = cget(CK);
  if (hit) return hit;
  try {
    const cities = getJSON(
      'https://api-colombia.com/api/v1/Department/' + deptId + '/cities'
    );
    cities.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const payload = cities.map((city) => ({
      id: String(city.id),
      name: city.name,
    }));
    cput(CK, payload, 43200); // 12 h
    return payload;
  } catch (err) {
    return [];
  }
}

// ---------- Geocoding + Series ----------

function formatDate(date) {
  return Utilities.formatDate(date, TZ, 'yyyy-MM-dd');
}

function geocodeOM(name, admin1) {
  const CK = 'geo_' + name + '|' + (admin1 || '');
  const hit = cget(CK);
  if (hit) return hit;

  const url =
    'https://geocoding-api.open-meteo.com/v1/search?name=' +
    encodeURIComponent(name) +
    '&country=CO&count=10&language=es';
  const response = getJSON(url);
  const results = (response && response.results) || [];
  if (!results.length) throw new Error('Sin coordenadas: ' + name);
  const normalizedAdmin1 = admin1 ? String(admin1).toLowerCase() : '';
  const best =
    results.find(
      (item) =>
        normalizedAdmin1 &&
        item.admin1 &&
        item.admin1.toLowerCase() === normalizedAdmin1
    ) || results[0];
  const coordinates = { lat: best.latitude, lon: best.longitude };
  cput(CK, coordinates, 604800); // 7 dias
  return coordinates;
}

function buildSerie(lat, lon, mode, tipo) {
  const key =
    'serie_' + mode + '_' + (tipo || 'acum') + '_' + lat.toFixed(2) + ',' + lon.toFixed(2);
  const ttl = mode === 'prox' ? 1800 : mode === 'cinco' ? 43200 : 3600; // 30 min / 12 h / 1 h
  const hit = cget(key);
  if (hit) return hit;

  const today = new Date();
  let result;

  if (tipo === 'intensidad') {
    result = buildIntensitySerie(lat, lon, mode, today);
  } else if (mode === 'prox') {
    const base =
      'latitude=' +
      lat +
      '&longitude=' +
      lon +
      '&daily=precipitation_sum&timezone=' +
      encodeURIComponent(TZ);
    const forecast = getJSON(
      'https://api.open-meteo.com/v1/forecast?' + base + '&forecast_days=16'
    );
    const dates = (forecast.daily && forecast.daily.time) || [];
    const precip = (forecast.daily && forecast.daily.precipitation_sum) || [];
    const todayISO = formatDate(today);
    const daily = dates
      .map((date, idx) => ({ date, mm: precip[idx] }))
      .filter((row) => row.date > todayISO)
      .slice(0, 14);
    result = { daily };
  } else {
    const base =
      'latitude=' +
      lat +
      '&longitude=' +
      lon +
      '&daily=precipitation_sum&timezone=' +
      encodeURIComponent(TZ);
    const spanDays = mode === 'cinco' ? 365 * 5 : mode === 'tres' ? 92 : 365;
    const start = new Date(today.getTime() - spanDays * 24 * 3600 * 1000);
    const archiveCut = new Date(today.getTime() - 5 * 24 * 3600 * 1000);
    const archive = getJSON(
      'https://archive-api.open-meteo.com/v1/era5?' +
        base +
        '&start_date=' +
        formatDate(start) +
        '&end_date=' +
        formatDate(archiveCut)
    );
    const forecast = getJSON(
      'https://api.open-meteo.com/v1/forecast?' + base + '&past_days=5'
    );
    const map = {};
    const archiveDates = (archive.daily && archive.daily.time) || [];
    const archivePrecip =
      (archive.daily && archive.daily.precipitation_sum) || [];
    archiveDates.forEach((date, idx) => {
      map[date] = { date, mm: archivePrecip[idx] };
    });
    const forecastDates = (forecast.daily && forecast.daily.time) || [];
    const forecastPrecip =
      (forecast.daily && forecast.daily.precipitation_sum) || [];
    forecastDates.forEach((date, idx) => {
      map[date] = { date, mm: forecastPrecip[idx] };
    });
    const todayISO = formatDate(today);
    const startISO = formatDate(start);
    const daily = Object.keys(map)
      .sort()
      .map((keyDate) => map[keyDate])
      .filter((row) => row.date >= startISO && row.date <= todayISO);
    result = { daily };
  }

  cput(key, result, ttl);
  return result;
}

function getSerie(payload) {
  const deptName = payload.deptName;
  const muniName = payload.muniName || '';
  const mode = payload.modo || 'ultimo';
  const tipo = payload.tipo || 'acum';

  const candidates = [];
  if (muniName) candidates.push([muniName, deptName]);
  if (CAPITALS[deptName]) candidates.push([CAPITALS[deptName], deptName]);
  candidates.push([deptName, '']);

  let coords = null;
  for (let i = 0; i < candidates.length; i++) {
    try {
      coords = geocodeOM(candidates[i][0], candidates[i][1]);
      break;
    } catch (err) {
      // ignore and try next
    }
  }
  if (!coords) {
    throw new Error('No fue posible geocodificar');
  }
  return buildSerie(coords.lat, coords.lon, mode, tipo);
}

function buildIntensitySerie(lat, lon, mode, today) {
  const base =
    'latitude=' +
    lat +
    '&longitude=' +
    lon +
    '&hourly=precipitation&timezone=' +
    encodeURIComponent(TZ);
  const todayISO = formatDate(today);

  const map = {};

  if (mode === 'prox') {
    const forecast = getJSON(
      'https://api.open-meteo.com/v1/forecast?' + base + '&forecast_days=16'
    );
    const times = (forecast.hourly && forecast.hourly.time) || [];
    const precip = (forecast.hourly && forecast.hourly.precipitation) || [];
    addHourlyToMap(map, times, precip);
    const days = Object.keys(map)
      .sort()
      .filter((day) => day > todayISO)
      .slice(0, 14);
    return buildIntensityResult(map, days);
  }

  const spanDays =
    mode === 'cinco' ? 365 * 5 : mode === 'tres' ? 92 : 365;
  const start = new Date(today.getTime() - spanDays * 24 * 3600 * 1000);
  const startISO = formatDate(start);
  const archiveCut = new Date(today.getTime() - 5 * 24 * 3600 * 1000);

  const archive = getJSON(
    'https://archive-api.open-meteo.com/v1/era5?' +
      base +
      '&start_date=' +
      formatDate(start) +
      '&end_date=' +
      formatDate(archiveCut)
  );
  const forecast = getJSON(
    'https://api.open-meteo.com/v1/forecast?' + base + '&past_days=5'
  );

  addHourlyToMap(
    map,
    (archive.hourly && archive.hourly.time) || [],
    (archive.hourly && archive.hourly.precipitation) || []
  );
  addHourlyToMap(
    map,
    (forecast.hourly && forecast.hourly.time) || [],
    (forecast.hourly && forecast.hourly.precipitation) || []
  );

  const days = Object.keys(map)
    .sort()
    .filter((day) => day >= startISO && day <= todayISO);
  return buildIntensityResult(map, days);
}

function addHourlyToMap(map, times, values) {
  for (var i = 0; i < times.length; i++) {
    var timestamp = times[i];
    if (!timestamp) continue;
    var day = String(timestamp).slice(0, 10);
    var hourStr = String(timestamp).slice(11, 13);
    var hour = Number(hourStr);
    if (isNaN(hour) || hour < 0 || hour > 23) continue;
    var val = Number(values[i]) || 0;
    var entry = map[day];
    if (!entry) {
      entry = { date: day, mm: 0, hours: new Array(24).fill(0) };
      map[day] = entry;
    }
    if (val > entry.mm) entry.mm = val;
    entry.hours[hour] = (entry.hours[hour] || 0) + val;
  }
}

function buildIntensityResult(map, dayList) {
  const daily = [];
  const hourly = [];
  for (var i = 0; i < dayList.length; i++) {
    var day = dayList[i];
    var entry = map[day];
    if (!entry) continue;
    var dailyValue = Number((entry.mm || 0).toFixed(2));
    var hours = (entry.hours || new Array(24).fill(0)).map(function (val) {
      return Number((val || 0).toFixed(2));
    });
    daily.push({ date: day, mm: dailyValue });
    hourly.push({ date: day, hours: hours });
  }
  return { daily, hourly };
}
