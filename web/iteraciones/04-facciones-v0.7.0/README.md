# 04 · Facciones (v0.7.0 — 2026-09-30)

**Fase 5 del [plan](../../docs/PLAN_JUEGO.md).** Enemigos de verdad: esqueletos con uniforme que vigilan,
persiguen, pelean y caen. Se adelantó a la Fase 4 porque **reutiliza todo lo que ya había** —el mismo esqueleto,
los mismos 45 clips, el mismo sistema de combate— mientras que la fauna necesita modelos nuevos. Con la IA ya
construida, la Fase 4 sólo tiene que poner animales encima.

## El límite que no se cruza

Las facciones son **ficción declarada**: «los Restos», uniformes vacíos que siguen montando guardia donde ya no
hay nadie. **Sin nombre, sigla, bandera ni consigna de ningún grupo real**, y sin reconstruir ningún hecho.
Pitalito tiene 10.569 personas en registro de desplazamiento (dato del IGAC que alimenta este proyecto); poner
grupos reconocibles en su mapa real tocaría a vecinos vivos. Las zonas están lejos de la cabecera: **la ciudad
siempre es segura**. Todo se apaga con `FACTIONS.enabled = false`.

## Qué cambió

### El esqueleto: generado, no descargado
Los paquetes de monstruos traen su propio armature y sus propias animaciones: un esqueleto descargado no serviría
con los 45 clips ni con el sistema de combate. **`scripts/lib/make-skeleton.py` lo genera con Blender a partir
del armature que ya usamos**: un hueso de geometría por cada hueso del rig (con sus epífisis), costillar,
esternón, pelvis y cráneo con cuencas y mandíbula. Cada vértice va pegado al 100 % a su hueso.

Resultado: **4.184 triángulos, 2 materiales, los mismos 65 huesos**. Hereda todas las animaciones y se viste con
la misma ropa modular que cualquier personaje. Queda registrado en `assets/models/CREDITS.md` como derivado CC0,
y se regenera con `pnpm models:fetch`.

> Primera versión: 9.240 triángulos. Los cuarenta huesos de los dedos se llevaban la mayor parte; ahora van sin
> epífisis y con menos lados, que a tamaño de juego no se distingue. **−55 %.**

El uniforme deja **brazos y piernas al descubierto** a propósito: se ve que debajo no hay nadie.

### La IA
- **`src/systems/ai/BehaviorTree.js`** — árbol de comportamiento mínimo (secuencia, selector, condición, acción,
  temporizadores). Es la pieza que la Fase 4 reutilizará para la fauna.
- **`src/entities/combat/Enemy.js`** — percepción (ve de frente a 30 m, oye a 16 m aunque esté detrás, y no
  suelta el rastro hasta que te alejas bastante) + el árbol: vigilar → encarar → acercarse → golpear, con pausa
  entre golpes y alguna esquiva. **No trae combate propio:** usa el mismo `Combatant` que el jugador.
- **`src/systems/FactionSystem.js`** — tres zonas de control. Funciona como el tráfico: **nada existe lejos del
  jugador**; una zona sólo tiene enemigos si estás dentro, y se retiran al alejarte.
- Tres arquetipos que sólo cambian en cifras: centinela (peinilla), machetero (machete), cabo (azadón).

## Verificación

Con la simulación avanzada a mano (el render sin GPU va a ≈ 0,5 fps — ver [VERIFICACION.md](../../docs/VERIFICACION.md)):

| Prueba | Resultado |
|---|---|
| El enemigo percibe y persigue | de **11,18 m a 1,72 m en 2 s**, y se queda a distancia de golpe ✅ |
| El enemigo hace daño | jugador de **100 a 22** en 12 s de combate ✅ |
| El jugador lo abate | centinela cae en **3 machetazos** ✅ |
| Detección de zona | (−1900, −3400) → «El filo del norte»; (0,0) → ninguna ✅ |
| Poblado por zona | 5 enemigos a 45–130 m, con su rig cargado, al cupo de la zona ✅ |

## Medidas

| | Draw calls | Triángulos |
|---|---|---|
| Sin enemigos | 492 | 863.753 |
| **Con 5 enemigos** | **645** | **982.641** |
| Presupuesto | ≤ 700 | ≤ 1 M ✅ |

Cada enemigo: **10 mallas y 10.214 triángulos**. Con el esqueleto sin adelgazar eran 15.270 y el juego se salía
del presupuesto (1.013.451 triángulos). Por eso `SPAWN.maxActive` está en **6**: subirlo lo revienta otra vez
hasta que las prendas se fusionen por material (el pendiente que viene arrastrándose desde la Fase 2).

## Capturas

| Imagen | Qué muestra |
|---|---|
| [01-cuadrilla.jpg](01-cuadrilla.jpg) | Cinco esqueletos uniformados avanzando sobre el jugador |
| [02-esqueleto-de-cerca.jpg](02-esqueleto-de-cerca.jpg) | Un cabo con azadón: uniforme, brazos y manos de hueso |
| [03-modelo-generado.jpg](03-modelo-generado.jpg) | El modelo generado, sin ropa: costillar, pelvis, cráneo |
| [04-zona-de-control.jpg](04-zona-de-control.jpg) | «El filo del norte», en el campo lejos de la cabecera |

## Qué quedó pendiente

- **La siguiente es la Fase 4 (fauna)**, que ya tiene la IA hecha: sólo faltan los modelos de animales.
- Las zonas no se pintan todavía en el mapa ni en el minimapa.
- Falta la reputación por zona: hoy se cuenta lo abatido, pero no cambia nada.
- Los enemigos no esquivan de verdad hacia los lados ni se coordinan entre ellos.
- Fusionar prendas por material, para poder subir el tope de enemigos.
