import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export type AggregatedPoint = {
  date: string;
  label: string;
  value: number;
  isForecast?: boolean;
};

export type TrendPoint = {
  index: number;
  value: number;
};

type PrecipitationChartProps = {
  points: AggregatedPoint[];
  trend?: TrendPoint[] | null;
  metric: 'accumulated' | 'intensity';
};

const FALLBACK_HEIGHT = 320;

export function PrecipitationChart({ points, trend, metric }: PrecipitationChartProps) {
  const { labels, datasets } = useMemo(() => {
    if (!points.length) {
      return { labels: [] as string[], datasets: [] as any[] };
    }

    const dataPoints = points.map((point) => Number(point.value.toFixed(3)));
    const trendValues = new Array(points.length).fill(NaN);
    if (trend?.length) {
      trend.forEach((entry) => {
        if (entry.index >= 0 && entry.index < trendValues.length) {
          trendValues[entry.index] = Number(entry.value.toFixed(3));
        }
      });
    }

    const baseColor = metric === 'intensity' ? '#60a5fa' : '#22d3ee';
    const fillColor =
      metric === 'intensity' ? 'rgba(96, 165, 250, 0.2)' : 'rgba(34, 211, 238, 0.2)';

    const dataSet = {
      label: metric === 'intensity' ? 'Intensidad diaria (mm/h)' : 'Lluvia diaria (mm)',
      data: dataPoints,
      borderColor: baseColor,
      backgroundColor: fillColor,
      fill: true,
      tension: 0.28,
      borderWidth: 2,
      pointRadius: 0,
      spanGaps: false,
      segment: {
        borderDash: (ctx: any) => {
          const idx = ctx.p1DataIndex ?? ctx.p1?.dataIndex ?? ctx.p0DataIndex ?? ctx.p0?.dataIndex;
          return idx != null && points[idx]?.isForecast ? [6, 4] : undefined;
        },
        borderColor: (ctx: any) => {
          const idx = ctx.p1DataIndex ?? ctx.p1?.dataIndex ?? ctx.p0DataIndex ?? ctx.p0?.dataIndex;
          return idx != null && points[idx]?.isForecast ? 'rgba(147, 197, 253, 0.9)' : baseColor;
        },
        backgroundColor: (ctx: any) => {
          const idx = ctx.p1DataIndex ?? ctx.p1?.dataIndex ?? ctx.p0DataIndex ?? ctx.p0?.dataIndex;
          return idx != null && points[idx]?.isForecast ? 'rgba(147, 197, 253, 0.15)' : fillColor;
        },
      },
    };

    const trendSet =
      trend && trend.length
        ? {
            label: `Tendencia (${trend.length > 0 ? 'suavizado' : ''})`,
            data: trendValues,
            borderColor: '#8ab4ff',
            borderWidth: 2,
            tension: 0.22,
            pointRadius: 0,
            fill: false,
            spanGaps: true,
          }
        : null;

    return {
      labels: points.map((point) => point.label),
      datasets: trendSet ? [dataSet, trendSet] : [dataSet],
    };
  }, [metric, points, trend]);

  if (!labels.length) {
    return (
      <div className="empty-state" style={{ minHeight: FALLBACK_HEIGHT }}>
        No hay datos disponibles para los filtros seleccionados.
      </div>
    );
  }

  return (
    <Line
      data={{ labels, datasets }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: 'rgba(17, 18, 22, 0.92)',
            borderColor: 'rgba(96, 165, 250, 0.45)',
            borderWidth: 1,
            titleFont: { size: 12, family: 'Inter, system-ui, sans-serif' },
            bodyFont: { size: 12, family: 'Inter, system-ui, sans-serif' },
            callbacks: {
              label: (ctx) => {
                const value = typeof ctx.parsed.y === 'number' ? ctx.parsed.y.toFixed(2) : '-';
                return metric === 'intensity' ? `${value} mm/h` : `${value} mm`;
              },
              title: (ctx) => {
                const index = ctx[0]?.dataIndex;
                return index != null ? labels[index] : '';
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
            },
            ticks: {
              color: 'rgba(226, 232, 240, 0.75)',
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12,
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.06)',
            },
            ticks: {
              color: 'rgba(226, 232, 240, 0.75)',
              callback: (value) =>
                metric === 'intensity' ? `${value} mm/h` : `${value} mm`,
            },
          },
        },
      }}
      height={FALLBACK_HEIGHT}
    />
  );
}

