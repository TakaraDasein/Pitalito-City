# Guía para asistentes de IA

El repositorio tiene dos versiones del mismo juego, cada una con su guía. Las reglas de contenido son comunes y
están en [web/docs/REGLAS.md](web/docs/REGLAS.md).

- [`web/`](web/) — three.js + Vite. Guía: [web/AGENTS.md](web/AGENTS.md). **Sus rutas (`src/`, `docs/`,
  `scripts/`…) son relativas a `web/`**, y los comandos `pnpm` se corren dentro de `web/`.
- [`godot/`](godot/) — Godot 4.7. Guía: [godot/AGENTS.md](godot/AGENTS.md). Rutas relativas a `godot/`.

Reglas que cruzan las dos:

1. **Un solo pipeline de datos**, el de `web/scripts/`. Godot no descarga nada: sincroniza con
   `godot/tools/sync_from_web.sh`. Un dato o modelo nuevo entra por la web, con fuente y licencia.
2. `web/src/config/` y `godot/src/config/` son espejo: si cambia un ancho de vía, una paleta o una medida de
   vehículo en uno, cambia en el otro.
3. Los agentes de `.claude/agents/` se escribieron para la web: al usarlos en Godot, indicarlo en la tarea.
4. Cada versión verifica a su manera antes de cerrar (web: `pnpm build` + `pnpm shot`; Godot: `smoke_test.tscn`).
