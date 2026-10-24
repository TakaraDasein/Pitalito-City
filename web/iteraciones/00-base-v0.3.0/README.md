# 00 · Línea base (v0.3.0 — 2026-09-30)

Punto de partida del salto a juego de acción. Es **el "antes"** contra el que se compara todo lo que sigue.

## Qué hay

- Pitalito reconstruido con datos reales: 21.508 edificios, 21.527 árboles, 1.849 vías, 99 semáforos, relieve
  de ±12 km y suelo satelital en tres niveles de detalle.
- 6 vehículos modelados sobre fotos, física arcade, tráfico IA, GPS con A*, mapa y minimapa.
- Modo a pie, interacción (E) y construcción por bloques tipo Minecraft.
- Interfaz de café y guadua.

## Qué **no** hay (lo que abre el plan)

- **Personaje sin esqueleto:** `src/entities/character/Character.js` son cajas redondeadas articuladas a mano.
  No hay skinning, ni clips de animación, ni ropa intercambiable, ni creación de personaje.
- Sin combate, sin enemigos, sin fauna, sin partículas, sin música ni narrativa.

## Medidas (Chromium con render por software, 1280×720)

| Escena | Draw calls | Triángulos | Presupuesto |
|---|---|---|---|
| Centro — Parque Principal | 490 | 887.428 | ≤ 700 / ≤ 1 M ✅ |
| Rural — vía sin nombre | 225 | 539.510 | ✅ |

> Fps no medibles aquí (SwiftShader ≈ 3 fps). Pendiente en GPU real.

## Capturas

| Imagen | Qué muestra |
|---|---|
| [01-menu.jpg](01-menu.jpg) | Menú principal en café y guadua |
| [02-parque-en-carro.jpg](02-parque-en-carro.jpg) | Arranque en el Parque Principal, en el Jeep Willys |
| [03-personaje-actual.jpg](03-personaje-actual.jpg) | **El personaje de cajas con sombrero aguadeño** — lo que se reemplaza |
| [04-primera-persona.jpg](04-primera-persona.jpg) | Vista en primera persona y mira de interacción |
| [05-periferia.jpg](05-periferia.jpg) | Borde urbano |
| [06-rural-bosque.jpg](06-rural-bosque.jpg) | Zona rural arbolada — hábitat previsto para la fauna |
