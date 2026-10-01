# 07 · La historia de Pitalito (v1.0.0 — 2026-09-30)

**Fase 7 del [plan](../../docs/PLAN_JUEGO.md): el fin del juego.** No se gana llegando a un sitio: se gana
**completando la línea de tiempo del municipio**. Con esto el juego tiene principio y final.

## Cómo se aprende

No hay textos en un menú: **hay gente**. Once cronistas repartidos por el mundo, cada uno en el lugar donde pasó
lo que cuenta. Cada uno encarga algo que hacer allí; al cumplirlo, cuenta su hito, que entra al diario **con su
fuente** y se ilumina en la línea de tiempo.

| Hito | Cronista | Qué hay que hacer | Dónde |
|---|---|---|---|
| Los Andaquíes | La guaquera de Ingalí | Tres sitios altos con vista al valle | Cerros del occidente |
| La llegada de los conquistadores | La guaquera de Ingalí | Recorrer el camino viejo **de noche** | Camino del suroccidente |
| La encomienda de La Chapa (1632) | El cura de la capilla | Llegar al sitio del caserío | Vía a San Agustín |
| San Juan de Laboyos (1692) | El mayordomo | Reunir el ganado disperso | Potreros del oriente |
| La viceparroquia (1785) | El sacristán | Estar en la torre **entre las 17 y las 19** | Torre San Antonio |
| Bajar a la planicie | El pescador | Seguir el agua hasta donde se juntan los ríos | Guachicos y Guarapas |
| Pitalito, corregimiento (1818) | El escribano | Marcar las cuatro esquinas de la plaza | Parque Principal |
| Pitalito de San Antonio (1834) | La maestra | Buscar los nombres viejos en las placas | Centro histórico |
| Aldea (1870) | La vendedora de la galería | Repartir encargos por el centro | Galería |
| Municipio (1912) | El secretario | Llevar el acta a la Alcaldía | Alcaldía |
| Quina y caucho | El arriero | Llevar la carga por el camino de herradura | Monte del occidente |

**Ningún hito se cobra con combate.** Es una regla escrita en el código: la historia no se gana peleando.

**Los seis nombres anteriores** no son un hito, son una colección: están escritos en sitios del mundo (una lápida,
un dintel, la piedra de un portón, el libro de la parroquia, una placa, la nomenclatura de una carrera). Reunir
los seis abre la ficha del topónimo — qué es un topotopónimo, qué significa «pita» en quechua y por qué el
diminutivo es español.

## Separación entre dato y juego

- `src/config/historia.config.js` — **el contenido, transcrito de la fuente** (IGAC, 2019). No se toca para
  hacer el juego más jugable.
- `src/config/misiones.config.js` — **sólo lo jugable**: dónde está cada cronista y qué pide.
- `src/systems/StorySystem.js` — el estado: qué se consiguió, qué falta, y el final.

Lo conseguido se guarda en los ajustes, así que la línea de tiempo sobrevive a cerrar el navegador. Los cronistas
son ficción declarada y ninguno lleva nombre de una persona real.

## Verificación

Recorrido completo, automatizado desde la consola:

| Prueba | Resultado |
|---|---|
| Los seis nombres se recogen al pasar cerca | **6 de 6**, y se abre la ficha del topónimo ✅ |
| Las once misiones se pueden aceptar y cumplir | **11 de 11** ✅ |
| La línea de tiempo se llena por época | Conquista 2/2 · Colonia 4/4 · Independencia 1/1 · República 4/4 ✅ |
| El juego llega a su final | `terminado: true` y la ficha de cierre ✅ |

**Un fallo que encontró la prueba:** dos misiones comparten cronista (la guaquera cuenta dos hitos), y la segunda
**nunca se podía aceptar** — al acercarse, el sistema cogía siempre la primera, ya contada. Ahora prefiere el
encargo que falta y deja releer el contado.

## Capturas

| Imagen | Qué muestra |
|---|---|
| [01-hito-conseguido.jpg](01-hito-conseguido.jpg) | «Pitalito, corregimiento · 1818», con su fuente y el progreso |
| [02-linea-de-tiempo-vacia.jpg](02-linea-de-tiempo-vacia.jpg) | La línea de tiempo al empezar: todo por descubrir |
| [03-linea-de-tiempo-completa.jpg](03-linea-de-tiempo-completa.jpg) | Completa: los once hitos con su texto |
| [04-final.jpg](04-final.jpg) | El final del juego |

## Qué quedó pendiente

- Los cronistas **no tienen cuerpo todavía**: son puntos en el mundo con un aviso. Deberían ser personajes con
  el mismo rig que el resto, parados donde les toca.
- Las misiones de «llevar» (el acta, la carga) no tienen objeto que llevar: basta con ir y volver.
- La misión del ganado no comprueba que haya ganado de verdad, sólo que se pase por los tres puntos.
- Faltan los hitos de la Fase 7 que dependen de lugares aún no modelados (Alcaldía, Terminal, Villa Olímpica).
