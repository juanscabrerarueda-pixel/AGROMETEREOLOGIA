# Tendencia de Lluvias

Panel interactivo para monitorear series de lluvia y variables agroenergéticas en Colombia. El código está organizado como un monorepo de PNPM y todos los cambios nuevos deben centrarse en `apps/web` (frontend React/Vite).

## Mapa rápido del proyecto

```
apps/
  web/                # Frontend (única app activa)
packages/
  insight-engine/     # Motor de insights y generadores de narrativa
scripts/              # start-demo.cmd y utilitarios (codex-cli, etc.)
docs/                 # Build publicada en GitHub Pages
.github/workflows/    # Automatizaciones (deploy-pages, …)
old_App.tsx, clean_App.tsx
                      # Copias de referencia de App.tsx (ver sección de texto)
```

## Requisitos

- Node.js 20.x
- pnpm 9.x

## Comandos útiles

| Acción                        | Comando                                     |
| ---------------------------- | ------------------------------------------- |
| Instalar dependencias        | `pnpm install`                              |
| Ejecutar API (modo dev)      | `pnpm --filter api dev`                     |
| Preview web (Vite)           | `pnpm --filter web preview`                 |
| Build producción web         | `pnpm --filter web build`                   |
| Build completo de paquetes   | `pnpm build`                                |
| Demo en Windows              | `start-demo.cmd` (API + preview simultáneo) |

## Variables de entorno

Usa `.env.example` como plantilla; no versionar `.env`. La API necesita las mismas variables (puedes compartir el archivo).

## Deploy

1. `main` publica `docs/`. El workflow `.github/workflows/deploy-pages.yml` ejecuta `pnpm --filter web build` y copia `apps/web/dist` a `docs/`.
2. GitHub Pages debe apuntar a `Branch: main / Folder: docs`.
3. Para un deploy manual:
   ```bash
   pnpm --filter web build
   rm -rf docs/*
   cp -r apps/web/dist/* docs/
   git add docs
   ```

Si usas otro proveedor (Netlify, etc.), mantén `apps/web/dist` como carpeta pública.

## Notas para futuros cambios

### Estructura y responsabilidades

- `apps/web/src/App.tsx` contiene gran parte del contenido en español (textos, narrativas). Fue guardado históricamente en UTF‑16; evita editarlo parcialmente desde editores que mezclen codificaciones.
- `packages/insight-engine` genera insights y narrativas automáticas; es el lugar correcto para ajustar cálculos o texto de recomendaciones automáticas.
- `scripts/start-demo.cmd` (Windows) ejecuta API + preview; en Linux/Mac replica los mismos comandos descritos en la tabla.
- `docs/` guarda la build publicada. No edites nada allí salvo que estés reemplazando la build completa.

### Procedimiento seguro para editar App.tsx

1. **Trabaja desde la versión limpia:** si notas caracteres extraños (como `�`), restáuralo con `git checkout 4aac256 -- apps/web/src/App.tsx` o revisa el histórico limpio en `clean_App.tsx`.
2. **Convierte a UTF‑8 una sola vez** si necesitas añadir tildes reales:
   ```bash
   python - <<'PY'
   from pathlib import Path
   data = Path("apps/web/src/App.tsx").read_text("utf-16-le")
   Path("apps/web/src/App.tsx").write_text(data, encoding="utf-8")
   PY
   ```
3. **Aplica los reemplazos con script** (no mezcles conversiones manuales). Verifica con `rg -n "?" apps/web/src/App.tsx` que no queden mojibake.
4. **Prueba la app** (`pnpm --filter web build`) antes de commitear.
5. **Conserva copias de referencia**: `old_App.tsx` y `clean_App.tsx` quedan en la raíz para comparar texto en caso de duda.

### Buenas prácticas

- Mantén la app funcional sin tildes si no tienes tiempo de corregir el archivo completo; la prioridad es no romper `App.tsx`.
- Los cambios de contenido (textos) y los cambios de lógica deberían ir en commits separados.
- Revisa `scripts/` y `packages/` antes de añadir dependencias nuevas; PNPM usa workspaces, así que declara cada dependencia en su paquete.

## Licencias y uso

- Código: Business Source License 1.1 (cambia a Apache‑2.0 el 1-ene-2028). Detalles en `LICENSE` y `NOTICE`.
- Datos: CC BY-NC 4.0 (`DATA_LICENSE`).
- Documentación: CC BY 4.0 (`DOCS_LICENSE`).
- Marcas/logos: ver `TRADEMARKS.md`. Términos de uso y descargo: `TERMS.md`.

Con este README cualquier contribuidor (incluyendo futuros agentes Codex) puede entender la estructura del proyecto, los flujos de trabajo y las precauciones para editar archivos sensibles sin perder el progreso existente.
