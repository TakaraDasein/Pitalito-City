# 05 · Fauna (v0.8.0 — 2026-09-30)

**Fase 4 del [plan](../../docs/PLAN_JUEGO.md).** El campo deja de estar vacío: ganado en los potreros, gallinas,
perros de finca y un roedor nocturno en el monte. Reutiliza el árbol de comportamiento de la Fase 5.

## Lo que decide qué animal aparece es el dato, no una lista

La mezcla de ganado **sale del inventario pecuario real** del municipio (IGAC): 611.600 aves de engorde, 26.641
bovinos, 5.442 equinos, 4.219 porcinos, 108 ovinos. Está en `src/config/municipio.config.js` desde la primera
sesión; aquí por fin se usa para algo.

**Una corrección declarada:** con la mezcla cruda el campo salía poblado **sólo de gallinas** (comprobado: 10 de
10). El inventario cuenta cabezas, no lo que se ve desde el camino — las 611.600 aves de engorde están en
galpones, no sueltas en el potrero. Por eso cada especie lleva un factor `visibilidad`, que **es una decisión de
diseño, no un dato**, y está declarado como tal. Con él la mezcla queda: gallina 5,5 · vaca 4,0 · perro 1,2 ·
caballo 0,8 · cerdo 0,3 · oveja 0,02. Una oveja es casi imposible de ver, y así es: hay 108 en todo el municipio.

El hábitat también sale de los datos del tile: **árboles alrededor = bosque**, **densidad de casas = ciudad**,
lo demás = finca. No vale preguntar «¿hay algún edificio?»: en el campo de Pitalito hay casas de finca por todas
partes, así que lo que distingue la cabecera es cuántas (medido: a 2,4 km del centro hay una mediana de **61
edificios en 120 m**, que es ciudad; en los potreros del oriente, ninguno).

## Qué cambió

- **`src/systems/WildlifeSystem.js`** — reparte la fauna como el tráfico y las facciones: nada existe lejos del
  jugador. Elige especie por hábitat, hora y la mezcla real.
- **`src/entities/wildlife/Animal.js`** — usa **el mismo árbol de comportamiento** que las facciones, con otros
  nodos: pacífico (huye), territorial (avisa y carga), nocturno (sólo entre las 18:30 y las 5:30, y más esquivo).
- **`src/entities/wildlife/models.js`** — **seis especies modeladas a mano**, porque ningún paquete CC0 las trae:
  **gallina** (el 92 % del inventario del municipio son aves), **borugo** (lapa, *Cuniculus paca*, el roedor
  nocturno de estos bosques), **ñeque o guatín** (*Dasyprocta punctata*, su pariente diurno), **venado colorado**
  (*Mazama americana*, el venado pequeño de aquí, no un ciervo europeo), **serpiente** (cuerpo por segmentos que
  ondula) y **pájaro de monte** (azulejo: picotea en el suelo y levanta el vuelo). Formas estimadas, declaradas
  en DATOS.md.
- **Manadas y bandadas como una sola entidad lógica**: venados y pájaros aparecen en grupo, y el grupo comparte
  destino y alarma — si uno se asusta, huyen todos. No se decide por cada individuo.
- **Sólo se anima lo que está a la vista**: fuera de cámara el animal sigue moviéndose (es barato), pero no se
  gasta nada en mezclar animaciones ni en mover sus piezas.
- Del paquete CC0 entran **sólo las especies del inventario real** — vaca, caballo, cerdo, oveja y perro. La
  llama y la cebra que trae se quedan fuera: no son de aquí.
- El golpe del jugador también alcanza a la fauna (`CombatSystem`), pero un animal no es un combatiente: no gasta
  resistencia ni ataca con armas.
- `Rig` ahora admite modelos **con sus propias animaciones y su propio esqueleto**, que es como vienen los
  animales (39 huesos; clips `Idle`, `Walk`, `Run`, `Death`).
- La escala no se escribe a mano: se mide el modelo y se lleva a la **altura real** declarada por especie. Los
  modelos del paquete vienen grandes (la vaca mide 5,15 unidades).

## Dos fallos que costaron encontrar

1. **Los animales del paquete no se dibujaban.** Posición, escala, visibilidad y caja envolvente eran correctas
   —la proyección decía que la vaca estaba en el centro de la pantalla— y no había nada. La causa: la importación
   de FBX deja los materiales con **alfa 0 y `alphaMode: MASK`**, o sea completamente transparentes. Se fuerzan
   opacos en `scripts/lib/fbx-model.py` antes de exportar.
2. **El campo salía todo de gallinas**, por usar el inventario crudo (ver arriba).

## Medidas (zona rural)

| | Draw calls | Triángulos |
|---|---|---|
| Sin fauna | 173 | 537.435 |
| **Con 12 animales** | **242** | **558.395** |
| Presupuesto | ≤ 700 | ≤ 1 M ✅ |

Por animal: vaca 3 mallas / 796 triángulos · caballo 2 / 690 · gallina 5 / 854. Son baratísimos en geometría; lo
que cuesta son los draw calls (un material por color, sin texturas).

## Verificación

Con la simulación avanzada a mano (ver [VERIFICACION.md](../../docs/VERIFICACION.md)):

| Prueba | Resultado |
|---|---|
| Un pacífico huye | la vaca pasa de 4,2 m a **7,7 m** en 3 s ✅ |
| Un territorial carga | el perro llega **encima del jugador** en 2 s ✅ |
| El nocturno respeta la hora | falso a las 09:31, **verdadero a las 22:00** ✅ |
| La mezcla usa el dato real | gallina 92 / bovino 4 antes de corregir visibilidad ✅ |
| El hábitat distingue ciudad y campo | centro → calle; (1375, 625) → finca ✅ |
| La fauna recibe golpes | la gallina cae de un machetazo ✅ |

## Capturas

| Imagen | Qué muestra |
|---|---|
| [01-ganado-en-el-potrero.jpg](01-ganado-en-el-potrero.jpg) | Dos vacas, un caballo y una gallina en la finca |
| [02-gallina-en-el-parque.jpg](02-gallina-en-el-parque.jpg) | La gallina modelada a mano, en el Parque Principal |
| [03-valle-de-laboyos.jpg](03-valle-de-laboyos.jpg) | El campo donde aparece la fauna, con el valle al fondo |
| [04-fauna-del-bosque.jpg](04-fauna-del-bosque.jpg) | Venado colorado, ñeque y pájaros en el monte |

## Qué quedó pendiente

- **Los cuadrúpedos modelados a mano son toscos de cerca.** A distancia de juego se leen bien (ver la captura del
  bosque), pero el venado y el ñeque son volúmenes simples: valdría la pena refinarlos o encontrar un paquete CC0
  de fauna silvestre, que hoy no existe en el catálogo de Quaternius.
- Los animales no tienen colisión: se les atraviesa.
- La fauna no reacciona a los enemigos de las facciones, sólo al jugador.
- Dos fallos de proporción que costaron una pasada cada uno: la altura de la articulación de la pata estaba
  cableada a la del borugo (el venado quedaba hundido) y el tronco salía plano como una tabla.
