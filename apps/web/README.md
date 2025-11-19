# Web App (Agrometeo Panel)

This Vite + React workspace consumes the new Express API and exposes reusable hooks (`useSeries`, `useInsights`) powered by React Query.

## Quick Start

```bash
pnpm install
pnpm --filter api dev      # start API on :3001
pnpm --filter web dev      # start web UI on :5173
```

The Vite server proxies `/api` to the local API, so the hooks work without extra configuration. Set `VITE_API_BASE` if the API runs elsewhere.

## Production build / deploy

1. Export the API base before building (or create a `.env` file):
   ```bash
   # PowerShell
   $env:VITE_API_BASE='https://api.tu-dominio.com'
   pnpm --filter web build
   # or use .env with VITE_API_BASE=...
   ```
2. Upload `apps/web/dist/` to your static host (Netlify, Vercel, S3+CloudFront, etc.).
3. Ensure your API (`pnpm --filter api build && pnpm --filter api start`) está accesible en la misma URL que configuraste en `VITE_API_BASE`.

Para una demo local sin depender de `dev`, puedes correr:
```
pnpm --filter api build && pnpm --filter api start
pnpm --filter web preview
```
Esto sirve la web en `http://localhost:4173/` leyendo los archivos de `dist/`.

## Feature Flags

Toggle `VITE_FEATURE_AGROMETEO=false` (or omit to enable) to hide the agrometeo panel. Thresholds persist in `localStorage` under `tll.thresholds`.

## Netlify

Se agregó `netlify.toml` en la raíz para automatizar el build:

- `pnpm install --frozen-lockfile && pnpm --filter web build`
- Publica `apps/web/dist`

En el panel de Netlify define las variables:

- `VITE_API_BASE=https://tu-api-produccion` (u otra URL donde despliegues `apps/api`)
- Opcional `VITE_FEATURE_AGROMETEO=true` para habilitar el dashboard

Para probarlo localmente:

```bash
pnpm --filter api dev          # levanta la API
netlify dev                    # usa el comando definido y sirve el build
```

`netlify dev` ejecuta `pnpm --filter web dev`, así conservas el proxy `/api` ya configurado en `vite.config.ts`.
