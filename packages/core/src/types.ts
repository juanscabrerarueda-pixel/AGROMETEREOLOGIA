export type MuniKey = {
  depto: string;
  muni?: string;
};

export type TimeRange = {
  from: string; // ISO yyyy-mm-dd o yyyy-mm-ddTHH:00:00Z
  to: string;
};

export interface HourlyPoint {
  t: string; // ISO timestamp
  prcp?: number; // precipitación (mm)
  prcpRate?: number; // intensidad (mm/h)
  temp?: number; // temperatura (°C)
  rh?: number; // humedad relativa (%)
  wind?: number; // velocidad viento m/s (ajustada a 2 m)
  rs?: number; // radiación solar MJ/m2/d o W/m2 (normalizada)
  pressure?: number; // presión atmosférica kPa
  [extra: string]: unknown;
}

export interface SeriesMeta {
  source: string;
  tz: string;
  lat?: number;
  lon?: number;
  alt?: number;
}

export interface Series {
  key: MuniKey;
  range: TimeRange;
  hourly: HourlyPoint[];
  meta: SeriesMeta;
}

export type Thresholds = {
  intensityMmHr: number;
  rain3d: number;
  drySpellDays: number;
  thiBands: {
    comfort: number;
    mild: number;
    moderate: number;
    severe: number;
  };
  waterBalanceBands: {
    deficit: number;
    neutralLow: number;
    neutralHigh: number;
    excess: number;
  };
  appWindows: {
    windMin: number;
    windMax: number;
    rhMin: number;
    rhMax: number;
    tMax: number;
    rainProbMax: number;
  };
};
