import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
const STATUS_CLASS = {
    ok: 'agro-card ok',
    warn: 'agro-card warn',
    alert: 'agro-card alert',
    muted: 'agro-card muted',
};
const MS_PER_HOUR = 60 * 60 * 1000;
export function AgroPanels({ series }) {
    const cards = useMemo(() => buildCards(series), [series]);
    if (!cards.length)
        return null;
    return (_jsx("div", { className: "agro-panels", children: cards.map((card) => (_jsxs("div", { className: STATUS_CLASS[card.status], children: [_jsx("span", { className: "agro-card__label", children: card.title }), _jsx("strong", { className: "agro-card__value", children: card.value }), card.note && _jsx("span", { className: "agro-card__note", children: card.note })] }, card.id))) }));
}
function buildCards(series) {
    const hourly = series?.hourly ?? [];
    if (!hourly.length)
        return [];
    const avg = (key, hours = 24) => {
        const sample = sliceRecent(hourly, hours);
        const values = sample
            .map((point) => {
            const value = point[key];
            return typeof value === 'number' ? value : null;
        })
            .filter((value) => value !== null);
        if (!values.length)
            return null;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    };
    const sum = (key, hours = 24) => {
        const sample = sliceRecent(hourly, hours);
        const values = sample
            .map((point) => {
            const value = point[key];
            return typeof value === 'number' ? value : null;
        })
            .filter((value) => value !== null);
        if (!values.length)
            return null;
        return values.reduce((total, val) => total + val, 0);
    };
    const surfaceMoist = average([avg('soilMoist1'), avg('soilMoist3')]);
    const rootMoist = average([avg('soilMoist9', 48), avg('soilMoist27', 48)]);
    const evap = sum('evap', 24);
    const solar = avg('rs', 24);
    const wind = avg('wind', 24);
    const surfaceTemp = avg('soilTemp0', 24);
    const rootTemp = avg('soilTemp18', 24);
    const cards = [];
    cards.push(buildMoistureCard('soil-shallow', 'Humedad 0-5 cm', surfaceMoist));
    cards.push(buildMoistureCard('soil-root', 'Humedad raiz 10-30 cm', rootMoist));
    cards.push(buildTemperatureCard('soil-temp', 'Temp. suelo (superficie)', surfaceTemp));
    cards.push(buildTemperatureCard('root-temp', 'Temp. suelo (raices)', rootTemp));
    cards.push(buildEvapCard(evap));
    cards.push(buildSolarCard(solar));
    cards.push(buildWindCard(wind));
    return cards.filter(Boolean);
}
function sliceRecent(points, hours) {
    if (!points.length)
        return [];
    const last = new Date(points[points.length - 1].t ?? 0).getTime();
    const threshold = last - hours * MS_PER_HOUR;
    return points.filter((point) => {
        const t = new Date(point.t ?? 0).getTime();
        return Number.isFinite(t) && t >= threshold;
    });
}
function average(values) {
    const numeric = values.filter((value) => typeof value === 'number');
    if (!numeric.length)
        return null;
    return numeric.reduce((sum, val) => sum + val, 0) / numeric.length;
}
function buildMoistureCard(id, title, value) {
    if (value == null) {
        return { id, title, value: 'Sin dato', status: 'muted', note: 'Esperando nuevas lecturas.' };
    }
    const pct = value * 100;
    let status = 'ok';
    let note = 'Dentro del rango ideal para pasturas.';
    if (value < 0.18) {
        status = 'alert';
        note = 'Suelo seco: programa riego o rota el ganado.';
    }
    else if (value < 0.25) {
        status = 'warn';
        note = 'Humedad moderada, monitorea la demanda hidrica.';
    }
    else if (value > 0.45) {
        status = 'warn';
        note = 'Suelo muy humedo, aumenta el riesgo de compactacion.';
    }
    return {
        id,
        title,
        value: `${pct.toFixed(0)}%`,
        status,
        note,
    };
}
function buildTemperatureCard(id, title, value) {
    if (value == null) {
        return { id, title, value: 'Sin dato', status: 'muted' };
    }
    let status = 'ok';
    let note = 'Buen ambiente para actividad microbiana.';
    if (value < 10) {
        status = 'warn';
        note = 'Suelo frio: germinacion lenta y posible estres radicular.';
    }
    else if (value > 30) {
        status = 'alert';
        note = 'Suelo caliente: protege raices poco profundas.';
    }
    return {
        id,
        title,
        value: `${value.toFixed(1)} C`,
        status,
        note,
    };
}
function buildEvapCard(value) {
    if (value == null) {
        return {
            id: 'evap',
            title: 'Evapotranspiracion ET0 (24h)',
            value: 'Sin dato',
            status: 'muted',
        };
    }
    let status = 'ok';
    let note = 'Demanda hidrica moderada.';
    if (value > 6) {
        status = 'alert';
        note = 'Alta demanda hidrica: refuerza riego o hidratacion animal.';
    }
    else if (value > 4) {
        status = 'warn';
        note = 'Demanda hidrica elevada para cultivos sensibles.';
    }
    return {
        id: 'evap',
        title: 'Evapotranspiracion ET0 (24h)',
        value: `${value.toFixed(1)} mm`,
        status,
        note,
    };
}
function buildSolarCard(value) {
    if (value == null) {
        return {
            id: 'solar',
            title: 'Radiacion solar media',
            value: 'Sin dato',
            status: 'muted',
        };
    }
    const kwh = (value * 24) / 1000;
    let status = 'ok';
    let note = 'Ventana favorable para energia solar.';
    if (kwh < 3) {
        status = 'warn';
        note = 'Baja radiacion: la generacion fotovoltaica sera limitada.';
    }
    return {
        id: 'solar',
        title: 'Radiacion solar media',
        value: `${kwh.toFixed(1)} kWh/m2`,
        status,
        note,
    };
}
function buildWindCard(value) {
    if (value == null) {
        return {
            id: 'wind',
            title: 'Viento medio (10 m)',
            value: 'Sin dato',
            status: 'muted',
        };
    }
    let status = 'ok';
    let note = 'Rachas suaves para ventilacion y secado natural.';
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
//# sourceMappingURL=AgroPanels.js.map