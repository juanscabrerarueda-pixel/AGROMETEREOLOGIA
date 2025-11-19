import express, { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import seriesRouter from './routes/series.js';
import insightsRouter from './routes/insights.js';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use('/api/series', seriesRouter);
  app.use('/api/insights', insightsRouter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      return res.status(400).json({
        error: 'invalid_request',
        details: err.errors,
      });
    }
    const status = typeof err.status === 'number' ? err.status : 500;
    const message = err.message || 'Unexpected error';
    console.error(err);
    res.status(status).json({ error: message });
  };

  app.use(errorHandler);

  return app;
}

export type AppInstance = ReturnType<typeof createApp>;
