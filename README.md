# Tendencia de Lluvias

La versión principal de la app vive en `apps/web` y se ejecuta igual que el script `start-demo.cmd`
(inicia la API y levanta la build de Vite). La iteración antigua basada en `preview_tendencias.cmd`
y los archivos `index.html`, `app.html` y `theme.html` del directorio raíz fueron removidos para
evitar confusiones: todo el desarrollo y despliegue debe hacerse desde `apps/web`.

## Requisitos

- Node.js 20.x
- pnpm 9.x

## Scripts útiles

- `pnpm install`: instala dependencias del monorepo.
- `pnpm --filter api dev`: inicia la API local.
- `pnpm --filter web preview`: levanta el preview de la web (Vite) y abre `http://localhost:4173/`.
- `pnpm --filter web build`: genera la build de producción en `apps/web/dist`.
- `pnpm build`: ejecuta los builds declarados en los paquetes del workspace.

El script `start-demo.cmd` combina los comandos de API + preview para Windows; considera un script equivalente en *nix si lo necesitas.

## Variables de entorno

Usa `.env.example` como base. Mantiene el formato y los nombres esperados por la app.

## Deploy en GitHub Pages

- El branch `main` publica la carpeta `docs/`. Un workflow (`.github/workflows/deploy-pages.yml`) construye `apps/web/dist` y copia los artefactos a `docs/` en cada push a `main`.
- Si necesitas publicarlo manualmente: `pnpm --filter web build` y copia `apps/web/dist` a `docs/` antes de hacer push.

Para otros proveedores (Netlify, etc.) usa el mismo comando de build (`pnpm --filter web build`)
con directorio de publicación `apps/web/dist`.

## Licencias y uso

- Código: Business Source License 1.1 (cambia a Apache-2.0 el 2028-01-01). Producción/comercial requiere acuerdo comercial. Ver `LICENSE` y `NOTICE`.
- Datos: CC BY-NC 4.0 (`DATA_LICENSE`).
- Documentación: CC BY 4.0 (`DOCS_LICENSE`).
- Marcas: ver `TRADEMARKS.md`. Términos de uso y descargo de responsabilidad en `TERMS.md`.
