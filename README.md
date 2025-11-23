# Tendencia de Lluvias

La versión principal de la app vive en `apps/web` y se ejecuta igual que el script `start-demo.cmd`
(inicia la API y levanta la build de Vite). La iteración antigua basada en `preview_tendencias.cmd`
y los archivos `index.html`, `app.html` y `theme.html` del directorio raíz fueron removidos para
evitar confusiones: todo el desarrollo y despliegue debe hacerse desde `apps/web`.

## Cómo trabajar en local

1. Instala dependencias una vez: `pnpm install`.
2. Corre `start-demo.cmd` para lanzar la API (`pnpm --filter api dev`) y el preview de la web
   (`pnpm --filter web preview`). Al terminar se abre `http://localhost:4173/` con la interfaz nueva.

## Deploy automático (GitHub Pages)

- Cada `push` a `main` ejecuta `.github/workflows/deploy-web.yml`.
- El workflow monta Node 20 + pnpm, corre `pnpm --filter web build` y publica `apps/web/dist`
  en la rama `gh-pages`.
- Habilita GitHub Pages apuntando a `gh-pages` (fuente: “Deploy from a branch”) para que el sitio
  sirva la misma build que ves con `start-demo`.

Para otros proveedores (Netlify, etc.) puedes usar el mismo comando de build (`pnpm --filter web build`)
con directorio de publicación `apps/web/dist`.
