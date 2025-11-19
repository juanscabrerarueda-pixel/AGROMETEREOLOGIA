import { Router } from 'express';
import { z } from 'zod';
import { insightsFromSeries, defaultThresholds } from '@pkg/insight-engine';
import { getSeries } from '../services/fetchSeries.js';
import { cache, provider } from '../lib/context.js';

const router = Router();

const thresholdsSchema = z
  .object({
    intensityMmHr: z.number().positive(),
    rain3d: z.number().nonnegative(),
    drySpellDays: z.number().int().nonnegative(),
    thiBands: z
      .object({
        comfort: z.number(),
        mild: z.number(),
        moderate: z.number(),
        severe: z.number(),
      })
      .partial(),
    waterBalanceBands: z
      .object({
        deficit: z.number(),
        neutralLow: z.number(),
        neutralHigh: z.number(),
        excess: z.number(),
      })
      .partial(),
    appWindows: z
      .object({
        windMin: z.number(),
        windMax: z.number(),
        rhMin: z.number(),
        rhMax: z.number(),
        tMax: z.number(),
        rainProbMax: z.number(),
      })
      .partial(),
  })
  .partial();

const querySchema = z.object({
  depto: z.string().trim().min(1, 'depto requerido'),
  muni: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length ? value : undefined)),
  from: z.string().trim().min(1, 'from requerido'),
  to: z.string().trim().min(1, 'to requerido'),
  thresholds: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) return undefined;
      try {
        const raw = JSON.parse(value);
        return thresholdsSchema.parse(raw);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'thresholds debe ser JSON válido y coincidir con el esquema permitido',
        });
        return z.NEVER;
      }
    }),
});

const FIELDS: (keyof import('@pkg/core').HourlyPoint)[] = [
  'prcp',
  'prcpRate',
  'temp',
  'rh',
  'wind',
  'rs',
  'pressure',
];

router.get('/', async (req, res, next) => {
  try {
    const parsed = querySchema.parse(req.query);
    const thresholds = { ...defaultThresholds, ...(parsed.thresholds ?? {}) };
    const series = await getSeries(provider, cache, {
      key: { depto: parsed.depto, muni: parsed.muni },
      range: { from: parsed.from, to: parsed.to },
      fields: FIELDS,
    });
    const insights = insightsFromSeries(series, thresholds);
    res.json({ seriesMeta: series.meta, insights });
  } catch (error) {
    next(error);
  }
});

export default router;
