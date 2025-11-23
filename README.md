# Tendencia de Lluvias

La version principal de la app vive en `apps/web` y se ejecuta igual que el script `start-demo.cmd`
(inicia la API y levanta la build de Vite). La iteracion antigua basada en `preview_tendencias.cmd`
y los archivos `index.html`, `app.html` y `theme.html` del directorio raiz fueron removidos para
evitar confusiones: todo el desarrollo y despliegue debe hacerse desde `apps/web`.

## Como trabajar en local

1. Instala dependencias una vez: `pnpm install`.
2. Corre `start-demo.cmd` para lanzar la API (`pnpm --filter api dev`) y el preview de la web
   (`pnpm --filter web preview`). Al terminar se abre `http://localhost:4173/` con la interfaz nueva.

## Deploy en GitHub Pages

- Ejecuta `pnpm --filter web build` cuando quieras publicar la version actual.
- Copia la carpeta generada en `apps/web/dist` a `docs/` (el repo ya incluye la ultima copia publicada).
- En la configuracion de GitHub Pages usa `Branch: main` y `Folder: /docs` para que el sitio
  sirva la misma build que ves con `start-demo`.
- No hay workflows de GitHub Actions activos: el despliegue se hace **solo** subiendo los archivos
  actualizados a `docs/` y haciendo `git push`.

Para otros proveedores (Netlify, etc.) puedes usar el mismo comando de build (`pnpm --filter web build`)
con directorio de publicacion `apps/web/dist`.
