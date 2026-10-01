# 08 · Rendimiento (v1.0.0 — 2026-10-01)

**Fase 8 del [plan](../../docs/PLAN_JUEGO.md).** Lo que quedaba: que todo lo construido en las siete fases
anteriores quepa junto. Detalle completo en [docs/RENDIMIENTO.md](../../docs/RENDIMIENTO.md).

## El problema

Cada sistema tenía su tope y **cada tope por separado cabía**. Juntos, no:

| Escena | Draw calls | Triángulos |
|---|---|---|
| Ciudad sola, a pie en el centro | 474–510 | 863.753–870.311 |
| + 6 esqueletos + 8 animales | **724–781** | **1,02–1,08 M** |
| Presupuesto (REGLAS.md) | ≤ 700 | ≤ 1 M |

De los ~870.000 triángulos de base, la inmensa mayoría **es la ciudad**, no los personajes.

## La solución: un director, no topes más bajos

`src/core/FrameBudget.js` mira dos veces por segundo lo que se está dibujando de verdad y recorta **lo que menos
se nota**, en orden: fauna lejana → enemigos que aún no pelean → distancia de animación → radio de tiles de la
ciudad. Los topes de `src/config/` pasan a ser el techo, no la verdad. La presión sube rápido y baja despacio,
para que no parpadee entre recortar y soltar.

Bajar los topes a ojo habría dejado el mundo vacío el 95 % del tiempo, que es cuando no pasa nada.

## Dos cosas que costaron una medición cada una

1. **Recortar el radio de tiles no descargaba ni uno.** `unloadMargin: 1` volvía a dejar dentro justo los que se
   acababan de quitar. El director ahora baja también el margen.
2. **Retirar entidades y no sólo frenar las nuevas.** La primera versión bajaba los topes y los draw calls no se
   movían: lo ya puesto seguía ahí.

## Lo que el director no puede arreglar, y se dice

Si hay muchos enemigos **peleando a la vez**, no retira a ninguno —por diseño, quitar del mapa a quien ya te vio
sería hacer trampa— y el presupuesto se pasa. En partida normal no ocurre: el poblador de zonas nunca crea más de
los que caben. Sólo se llega ahí forzándolo desde la consola, que es como se midió.

## Una optimización intentada y revertida

Unir las prendas que comparten material para bajar los draw calls por personaje. Hace falta renumerar los índices
de hueso a un orden común y recortar los atributos al mínimo común; las dos cosas funcionan, **pero la malla sale
deformada** —las piezas de piel de la ropa acababan apelotonadas a la altura del cuello— y un personaje vestido a
medias es peor que un draw call de más. Revertido, con el porqué escrito en `Rig.js`. La vía buena es dejar las
prendas ya fusionadas **en el pipeline**, con el modelo delante, no en el navegador a ciegas.

## Lo que sigue pendiente, y es lo más importante

**Los fps en GPU real siguen sin medirse**, y ya es el único hueco grande que queda. Todo lo de arriba son draw
calls y triángulos, que no dependen de la máquina. El entorno de verificación (Chromium sin GPU) renderiza a
**≈ 0,5 fotogramas por segundo** desde que el personaje tiene esqueleto: sirve para contar lo que se dibuja, no
para medir velocidad. Hace falta abrir el juego en dos o tres GPUs reales y mirar la tecla **B**.
