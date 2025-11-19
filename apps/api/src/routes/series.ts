import { Router } from 'express';
import { z } from 'zod';
import { getSeries } from '../services/fetchSeries.js';
import { cache, provider } from '../lib/context.js';

const router = Router();

const querySchema = z.object({
  depto: z.string().trim().min(1, 'depto requerido'),
  muni: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length ? value : undefined)),
  from: z.string().trim().min(1, 'from requerido'),
  to: z.string().trim().min(1, 'to requerido'),
  fields: z
    .string()
    .optional()
    .transform((value) =>
      value && value.length ? value.split(',').map((f) => f.trim()).filter(Boolean) : undefined
    ),
});

const DEFAULT_FIELDS: (keyof import('@pkg/core').HourlyPoint)[] = [
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
    const fields = (parsed.fields as (keyof import('@pkg/core').HourlyPoint)[] | undefined) ?? DEFAULT_FIELDS;
    const series = await getSeries(provider, cache, {
      key: { depto: parsed.depto, muni: parsed.muni },
      range: { from: parsed.from, to: parsed.to },
      fields,
    });
    res.json(series);
  } catch (error) {
    next(error);
  }
});

export default router;
