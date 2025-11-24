import { useMemo } from 'react';
import type { Series } from '@pkg/core';

type Card = {
  id: string;
  title: string;
  value: string;
  note?: string;
  status: 'ok' | 'warn' | 'alert' | 'muted';
};

type AgroPanelsProps = {
  series: Series | null | undefined;
};

const STATUS_CLASS: Record<Card['status'], string> = {
  ok: 'agro-card ok',
  warn: 'agro-card warn',
  alert: 'agro-card alert',
  muted: 'agro-card muted',
};

const MS_PER_HOUR = 60 * 60 * 1000;

export function AgroPanels({ series }: AgroPanelsProps) {
  const cards = useMemo(() => buildCards(series), [series]);
  if (!cards.length) return null;

  return (
    <div className="agro-panels">
      {cards.map((card) => (
        <div key={card.id} className={STATUS_CLASS[card.status]}>
          <span className="agro-card__label">{card.title}</span>
          <strong className="agro-card__value">{card.value}</strong>
          {card.note && <span className="agro-card__note">{card.note}</span>}
        </div>
      ))}
    </div>
  );
}

function buildCards(series: Series | null | undefined): Card[] {
  const hourly = (series?.hourly as Series['hourly']) ?? [];
  if (!hourly.length) return [];

  const avg = (key: string, hours = 24) => {
    const sample = sliceRecent(hourly, hours);
    const values = sample
      .map((point) => {
        const value = point[key];
        return typeof value === 'number' ? value : null;
      })
      .filter((value): value is number => value !== null);
    if (!values.length) return null;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  };

  const sum = (key: string, hours = 24) => {
    const sample = sliceRecent(hourly, hours);
    const values = sample
      .map((point) => {
        const value = point[key];
        return typeof value === 'number' ? value : null;
      })
      .filter((value): value is number => value !== null);
    if (!values.length) return null;
    return values.reduce((total, val) => total + val, 0);
  };

  const airTemp = avg('temp', 24);
  const feelsLike = avg('apparentTemp', 24);
  const humidity = avg('rh', 24);
  const rain = sum('prcp', 24);
  const evap = sum('evap', 24);
  const solar = avg('rs', 24);
  const wind = avg('wind', 24);

  const cards: Card[] = [];

  cards.push(buildAirTempCard('air-temp', 'Temp. ambiente (24h)', airTemp));
  cards.push(buildFeelsLikeCard('feels-like', 'Sensación térmica', feelsLike));
  cards.push(buildHumidityCard('humidity', 'Humedad relativa', humidity));
  cards.push(buildRainCard('rain', 'Lluvia 24h', rain));
  cards.push(buildEvapCard(evap));
  cards.push(buildSolarCard(solar));
  cards.push(buildWindCard(wind));

  return cards.filter(Boolean) as Card[];
}

function sliceRecent(points: Series['hourly'], hours: number): Series['hourly'] {
  if (!points.length) return [];
  const last = new Date(points[points.length - 1].t ?? 0).getTime();
  const threshold = last - hours * MS_PER_HOUR;
  return points.filter((point) => {
    const t = new Date(point.t ?? 0).getTime();
    return Number.isFinite(t) && t >= threshold;
  });
}

function average(values: Array<number | null>): number | null {
  const numeric = values.filter((value): value is number => typeof value === 'number');
  if (!numeric.length) return null;
  return numeric.reduce((sum, val) => sum + val, 0) / numeric.length;
}

function buildAirTempCard(id: string, title: string, value: number | null): Card {
  if (value == null) {
    return { id, title, value: 'Sin dato', status: 'muted', note: 'Esperando nuevas lecturas.' };
  }
  let status: Card['status'] = 'ok';
  let note = 'Rango confortable para labores a campo.';
  if (value < 15) {
    status = 'warn';
    note = 'Mañanas frías: protege cultivos sensibles.';
  } else if (value > 32) {
    status = 'alert';
    note = 'Calor alto: planifica descanso de personal y ganado.';
  }
  return {
    id,
    title,
    value: `${value.toFixed(1)} C`,
    status,
    note,
  };
}

function buildFeelsLikeCard(id: string, title: string, value: number | null): Card {
  if (value == null) {
    return { id, title, value: 'Sin dato', status: 'muted' };
  }
  let status: Card['status'] = 'ok';
  let note = 'Sensible para trabajo agro y confort animal.';
  if (value > 35) {
    status = 'alert';
    note = 'Sensación extrema: refuerza hidratación y sombra.';
  } else if (value > 30) {
    status = 'warn';
    note = 'Calor intenso, evita labores pesadas al sol.';
  }
  return {
    id,
    title,
    value: `${value.toFixed(1)} C`,
    status,
    note,
  };
}

function buildHumidityCard(id: string, title: string, value: number | null): Card {
  if (value == null) {
    return { id, title, value: 'Sin dato', status: 'muted' };
  }
  let status: Card['status'] = 'ok';
  let note = 'Buen equilibrio para secado y confort animal.';
  if (value < 40) {
    status = 'warn';
    note = 'Ambiente seco: riesgo de estrés hídrico.';
  } else if (value > 85) {
    status = 'warn';
    note = 'Muy húmedo: favorece hongos y enfermedades.';
  }
  return {
    id,
    title,
    value: `${value.toFixed(0)}%`,
    status,
    note,
  };
}

function buildRainCard(id: string, title: string, value: number | null): Card {
  if (value == null) {
    return { id, title, value: 'Sin dato', status: 'muted' };
  }
  let status: Card['status'] = 'ok';
  let note = 'Precipitación útil para recarga de húmedad.';
  if (value > 60) {
    status = 'alert';
    note = 'Lluvia intensa: monitorea anegamientos y accesos.';
  } else if (value > 30) {
    status = 'warn';
    note = 'Evento significativo, planifica cosecha y logística.';
  } else if (value < 5) {
    status = 'warn';
    note = 'Acumulado bajo, prepara riego o suplementación.';
  }
  return {
    id,
    title,
    value: `${value.toFixed(1)} mm`,
    status,
    note,
  };
}

function buildEvapCard(value: number | null): Card {
  if (value == null) {
    return {
      id: 'evap',
      title: 'Evapotranspiración ET0 (24h)',
      value: 'Sin dato',
      status: 'muted',
    };
  }
  let status: Card['status'] = 'ok';
  let note = 'Demanda hídrica moderada.';
  if (value > 6) {
    status = 'alert';
    note = 'Alta demanda hídrica: refuerza riego o hidratación animal.';
  } else if (value > 4) {
    status = 'warn';
    note = 'Demanda hídrica elevada para cultivos sensibles.';
  }
  return {
    id: 'evap',
    title: 'Evapotranspiración ET0 (24h)',
    value: `${value.toFixed(1)} mm`,
    status,
    note,
  };
}

function buildSolarCard(value: number | null): Card {
  if (value == null) {
    return {
      id: 'solar',
      title: 'Radiación solar media',
      value: 'Sin dato',
      status: 'muted',
    };
  }
  const kwh = (value * 24) / 1000;
  let status: Card['status'] = 'ok';
  let note = 'Ventana favorable para energía solar.';
  if (kwh < 3) {
    status = 'warn';
    note = 'Baja radiación: la generación fotovoltaica será limitada.';
  }
  return {
    id: 'solar',
    title: 'Radiación solar media',
    value: `${kwh.toFixed(1)} kWh/m2`,
    status,
    note,
  };
}

function buildWindCard(value: number | null): Card {
  if (value == null) {
    return {
      id: 'wind',
      title: 'Viento medio (10 m)',
      value: 'Sin dato',
      status: 'muted',
    };
  }
  let status: Card['status'] = 'ok';
  let note = 'Rachas suaves para ventilación y secado natural.';
  if (value > 10) {
    status = 'warn';
    note = 'Rachas fuertes: asegura cobertizos y equipos.';
  }
  return {
    id: 'wind',
    title: 'Viento medio (10 m)',
    value: `${value.toFixed(1)} m/s`,
    status,
    note,
  };
}
