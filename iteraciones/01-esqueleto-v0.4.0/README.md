# 01 · Esqueleto y animaciones (v0.4.0 — 2026-09-30)

**Fase 1 del [plan](../../docs/PLAN_JUEGO.md).** El personaje de cajas se cambia por una malla con esqueleto real
y 46 clips de animación. Es la base de la creación de personaje (Fase 2) y del combate (Fase 3).

## Qué cambió

- **`src/entities/skinning/Rig.js`** — carga el GLB una sola vez y lo reparte: cada personaje recibe su propio
  esqueleto, pero **los clips son los mismos objetos** para todos. Mezcla por peso, transiciones, enganche a
  huesos y **LOD de animación** (de lejos, la mezcla baja de 60 a 20, 8 y 3 Hz).
- **`src/entities/character/AnimationGraph.js`** — único puente entre física y animación. Locomoción mezclada por
  velocidad real (quieto ↔ caminar ↔ trotar ↔ correr) con corrección de velocidad del clip para que los pies no
  patinen; salto, caída, aterrizaje, sentado, conducir, y acciones puntuales (interactuar, golpear, rodar).
- **`Character.js` queda sólo con física.** El aspecto lo pone un "cuerpo" intercambiable:
  `BoxBody` (cajas, sin descargas) o `RigBody` (esqueleto). Misma interfaz, así que el movimiento es idéntico.
- **El juego nunca se queda sin personaje:** arranca con las cajas y cambia al esqueleto cuando termina de cargar.
  Si el GLB no está, sigue con las cajas. Se apaga con `CHARACTERS.useRig = false`.
- **Sombrero aguadeño enganchado al hueso `DEF-head`** (no fundido a la malla): sigue la animación de la cabeza.
  Medido en el juego, no adivinado: DEF-head está a 1,48 m del suelo y la coronilla a 1,78 m.
- `vite.config.js`: `resolve.dedupe: ['three']` — sin esto Vite cargaba dos copias de three.js y el skinning
  se rompe (avisaba «Multiple instances of Three.js»).

## Medidas (Chromium con render por software, 1280×720)

| | Draw calls | Triángulos | Presupuesto |
|---|---|---|---|
| Centro, antes (v0.3.0) | 490 | 887.428 | ≤ 700 / ≤ 1 M |
| Centro, ahora | 458–495 | ~886.000 | ✅ |
| **Coste del personaje** | **4** (2 del maniquí + 2 del sombrero fusionado) | **13.744** | Draw calls ✅ · **Triángulos ✗ (presupuesto: 3.000)** |

**El maniquí se sale del presupuesto de triángulos y es a propósito.** El modelo que trae la biblioteca de
animaciones es un maniquí de previsualización, no una malla de juego. La malla definitiva llega en la Fase 2, con
*Universal Base Characters* (mallas game-ready del mismo paquete y el mismo esqueleto). Mientras tanto hay **un
solo** personaje en pantalla, así que no afecta: el presupuesto se verifica de verdad cuando haya 30.

## Capturas

| Imagen | Qué muestra |
|---|---|
| [01-quieto.jpg](01-quieto.jpg) | `Idle_Loop` con el sombrero puesto |
| [02-caminando.jpg](02-caminando.jpg) | Mezcla caminar/trotar por velocidad real |
| [03-corriendo.jpg](03-corriendo.jpg) | `Sprint_Loop` a 29 km/h |
| [04-salto.jpg](04-salto.jpg) | `Jump_Start` → `Jump_Loop` → `Jump_Land` |
| [05-sombrero-en-el-hueso.jpg](05-sombrero-en-el-hueso.jpg) | El accesorio enganchado a `DEF-head` tras fusionar por material |

Comparar con [00-base-v0.3.0/03-personaje-actual.jpg](../00-base-v0.3.0/03-personaje-actual.jpg).

## Qué quedó pendiente

- **El personaje se ve como un maniquí:** sin ropa ni piel, sólo dos colores planos. Se resuelve en la Fase 2 con
  las mallas base y la ropa modular; no tiene sentido vestir el maniquí que se va a reemplazar.
- `Driving_Loop` y `Sitting_*` están cargados pero no se ven: al subir al carro el personaje se oculta y las
  bancas no lo sientan todavía. Falta sentarlo dentro del vehículo.
- Falta medir con 30 personajes a la vez (el presupuesto real del LOD de animación).
- Fps en GPU real, todavía sin medir.
