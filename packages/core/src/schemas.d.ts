import { z } from 'zod';
export declare const MuniKeySchema: z.ZodObject<{
    depto: z.ZodString;
    muni: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    depto: string;
    muni?: string | undefined;
}, {
    depto: string;
    muni?: string | undefined;
}>;
export declare const TimeRangeSchema: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
}, {
    from: string;
    to: string;
}>;
export declare const HourlyPointSchema: z.ZodObject<{
    t: z.ZodString;
    prcp: z.ZodOptional<z.ZodNumber>;
    prcpRate: z.ZodOptional<z.ZodNumber>;
    temp: z.ZodOptional<z.ZodNumber>;
    rh: z.ZodOptional<z.ZodNumber>;
    wind: z.ZodOptional<z.ZodNumber>;
    rs: z.ZodOptional<z.ZodNumber>;
    pressure: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    t: string;
    prcp?: number | undefined;
    prcpRate?: number | undefined;
    temp?: number | undefined;
    rh?: number | undefined;
    wind?: number | undefined;
    rs?: number | undefined;
    pressure?: number | undefined;
}, {
    t: string;
    prcp?: number | undefined;
    prcpRate?: number | undefined;
    temp?: number | undefined;
    rh?: number | undefined;
    wind?: number | undefined;
    rs?: number | undefined;
    pressure?: number | undefined;
}>;
export declare const SeriesMetaSchema: z.ZodObject<{
    source: z.ZodString;
    tz: z.ZodString;
    lat: z.ZodOptional<z.ZodNumber>;
    lon: z.ZodOptional<z.ZodNumber>;
    alt: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    source: string;
    tz: string;
    lat?: number | undefined;
    lon?: number | undefined;
    alt?: number | undefined;
}, {
    source: string;
    tz: string;
    lat?: number | undefined;
    lon?: number | undefined;
    alt?: number | undefined;
}>;
export declare const SeriesSchema: z.ZodObject<{
    key: z.ZodObject<{
        depto: z.ZodString;
        muni: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        depto: string;
        muni?: string | undefined;
    }, {
        depto: string;
        muni?: string | undefined;
    }>;
    range: z.ZodObject<{
        from: z.ZodString;
        to: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        from: string;
        to: string;
    }, {
        from: string;
        to: string;
    }>;
    hourly: z.ZodArray<z.ZodObject<{
        t: z.ZodString;
        prcp: z.ZodOptional<z.ZodNumber>;
        prcpRate: z.ZodOptional<z.ZodNumber>;
        temp: z.ZodOptional<z.ZodNumber>;
        rh: z.ZodOptional<z.ZodNumber>;
        wind: z.ZodOptional<z.ZodNumber>;
        rs: z.ZodOptional<z.ZodNumber>;
        pressure: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        t: string;
        prcp?: number | undefined;
        prcpRate?: number | undefined;
        temp?: number | undefined;
        rh?: number | undefined;
        wind?: number | undefined;
        rs?: number | undefined;
        pressure?: number | undefined;
    }, {
        t: string;
        prcp?: number | undefined;
        prcpRate?: number | undefined;
        temp?: number | undefined;
        rh?: number | undefined;
        wind?: number | undefined;
        rs?: number | undefined;
        pressure?: number | undefined;
    }>, "many">;
    meta: z.ZodObject<{
        source: z.ZodString;
        tz: z.ZodString;
        lat: z.ZodOptional<z.ZodNumber>;
        lon: z.ZodOptional<z.ZodNumber>;
        alt: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        source: string;
        tz: string;
        lat?: number | undefined;
        lon?: number | undefined;
        alt?: number | undefined;
    }, {
        source: string;
        tz: string;
        lat?: number | undefined;
        lon?: number | undefined;
        alt?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    key: {
        depto: string;
        muni?: string | undefined;
    };
    range: {
        from: string;
        to: string;
    };
    hourly: {
        t: string;
        prcp?: number | undefined;
        prcpRate?: number | undefined;
        temp?: number | undefined;
        rh?: number | undefined;
        wind?: number | undefined;
        rs?: number | undefined;
        pressure?: number | undefined;
    }[];
    meta: {
        source: string;
        tz: string;
        lat?: number | undefined;
        lon?: number | undefined;
        alt?: number | undefined;
    };
}, {
    key: {
        depto: string;
        muni?: string | undefined;
    };
    range: {
        from: string;
        to: string;
    };
    hourly: {
        t: string;
        prcp?: number | undefined;
        prcpRate?: number | undefined;
        temp?: number | undefined;
        rh?: number | undefined;
        wind?: number | undefined;
        rs?: number | undefined;
        pressure?: number | undefined;
    }[];
    meta: {
        source: string;
        tz: string;
        lat?: number | undefined;
        lon?: number | undefined;
        alt?: number | undefined;
    };
}>;
export type SeriesInput = z.infer<typeof SeriesSchema>;
