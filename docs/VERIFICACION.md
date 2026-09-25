# Verificación

> Cómo comprobar que un cambio funciona antes de subirlo. No hay pruebas unitarias todavía: la verificación es
> visual y de consola, automatizada con `tools/screenshot.mjs`.

## Lista mínima antes de cada commit

1. `npm run build` termina sin errores.
2. `npm run dev` y abrir http://localhost:5173: carga hasta el menú principal sin errores en la consola del navegador.
3. Probar el área tocada (ver tabla abajo).
4. Tecla **B** en la partida: draw calls y triángulos dentro del presupuesto de [REGLAS.md](REGLAS.md#5-rendimiento-presupuestos).

## Capturas automáticas

Requiere Chromium (`CHROMIUM_PATH`, por defecto `/usr/bin/chromium`) y el servidor de desarrollo corriendo.

```bash
npm run shot -- inicio '[{"wait":6000},{"shot":"calle"}]'              # entra a jugar y captura
npm run shot -- menu '[{"wait":2000},{"shot":"principal"}]' --stay      # se queda en el menú
npm run shot:vehicle -- chiva                                           # un vehículo desde 3 ángulos
```

Las imágenes quedan en `screenshots/` (ignorada por git). Acciones disponibles:

| Acción | Ejemplo | Efecto |
|---|---|---|
| `wait` | `{"wait":3000}` | Espera en ms |
| `press` | `{"press":"KeyC"}` | Pulsa una tecla |
| `down` / `up` | `{"down":"KeyW"}` | Mantiene / suelta una tecla |
| `click` | `{"click":"#screen-main [data-act=garage]"}` | Clic en un selector |
| `eval` | `{"eval":"game.state"}` | Evalúa código en la página (imprime el resultado) |
| `shot` | `{"shot":"nombre"}` | Guarda una captura |

**Advertencia:** Chromium sin GPU renderiza por software (≈ 3 fps reales). Sirve para ver que todo se dibuja y no hay
errores, **no para medir rendimiento**. Las transiciones CSS también son lentas: esperar ≥ 1,5 s antes de capturar un
menú.

## Ayudas de depuración (consola del navegador)

| Comando | Uso |
|---|---|
| `game` | Instancia del juego (`window.game`) |
| `game.debugShowVehicle('taxi', 2.4)` | Muestra un vehículo con cámara fija en un ángulo |
| `game.pick(x, y)` | Qué objeto hay bajo un píxel de la pantalla |
| `game.teleport(x, z)` | Lleva al jugador a la vía más cercana a (x, z) |
| `game.weather.setMode('lluvia')` | Fuerza el clima |
| `game.env.setHour(19)` | Cambia la hora |
| `game.settings.set('quality', 'ultra')` | Cambia el preset |

## Qué revisar según el área

| Si cambiaste… | Revisar |
|---|---|
| Pipeline / `public/world/` | Superposición sobre el satélite (calles, huellas y árboles alineados), spawn en calle, `npm run data:build` sin avisos |
| Builders / materiales | Vista de calle y aérea (tecla C), día y noche (N), lluvia |
| Vehículos | `npm run shot:vehicle -- <tipo>`, garaje, manejo 10 s sin choques falsos, draw calls por vehículo |
| Física / colisiones | Acelerar 15 s por la Calle 5 desde el spawn sin impactos |
| Menús / HUD | Navegación solo con teclado (flechas, Enter, Esc), foco visible, pausa ⇄ continuar |
| Presets de calidad | Cambiar entre los 4 en Opciones sin errores ni pantalla negra |

## Prueba de física reproducible

Desde la consola, con el juego en marcha:

```js
const p = game.player, s = game.manifest.spawn;
game.input.update = () => p.controls;
p.place(s.x, s.z, s.heading);
Object.assign(p.controls, { throttle: 1, brake: 0, steer: 0, handbrake: false });
let impact = 0;
for (let i = 0; i < 900; i++) impact = Math.max(impact, p.updatePhysics(1 / 60, game.collision));
({ kmh: p.speedKmh.toFixed(0), impact });   // esperado: ~80 km/h, impact 0
```

(Recargar la página después: la prueba reemplaza `input.update`.)
