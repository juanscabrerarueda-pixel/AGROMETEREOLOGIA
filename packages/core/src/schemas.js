import { z } from 'zod';
export const MuniKeySchema = z.object({
    depto: z.string(),
    muni: z.string().optional(),
});
export const TimeRangeSchema = z.object({
    from: z.string(),
    to: z.string(),
});
export const HourlyPointSchema = z.object({
    t: z.string(),
    prcp: z.number().optional(),
    prcpRate: z.number().optional(),
    temp: z.number().optional(),
    rh: z.number().optional(),
    wind: z.number().optional(),
    rs: z.number().optional(),
    pressure: z.number().optional(),
});
export const SeriesMetaSchema = z.object({
    source: z.string(),
    tz: z.string(),
    lat: z.number().optional(),
    lon: z.number().optional(),
    alt: z.number().optional(),
});
export const SeriesSchema = z.object({
    key: MuniKeySchema,
    range: TimeRangeSchema,
    hourly: z.array(HourlyPointSchema),
    meta: SeriesMetaSchema,
});
//# sourceMappingURL=schemas.js.map