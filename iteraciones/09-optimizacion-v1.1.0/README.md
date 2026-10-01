# 09 · Cronistas con cuerpo y optimización (v1.1.0 — 2026-10-01)

Tres cosas: **medir los fps de verdad** (el hueco que llevaba desde el principio), **darle cuerpo a los
cronistas**, y **que el mundo no pese cuando no estás donde pasan las cosas**.

## 1. Fps en GPU real, por fin

`tools/bench.mjs` lanza Chromium **con la tarjeta**, no con SwiftShader, y mide fotogramas reales con
`requestAnimationFrame` en cinco escenas por preset. Escribe [docs/MEDICIONES.md](../../docs/MEDICIONES.md) con
la tabla y la máquina, porque las cifras dependen de ella.

El informe empieza diciendo qué renderizador tocó: si pone SwiftShader, la medida no vale. En esta máquina:
`ANGLE (NVIDIA, Vulkan 1.4.341, GeForce RTX 4060 Laptop)`.

**Lo que cambia esto:** el presupuesto de 700 draw calls / 1 M triángulos resultó **conservador para esta GPU**.
En combate el juego se pasa de ambos y sigue por encima de 100 fps. El presupuesto no se toca —existe para las
máquinas flojas, no para ésta— pero ya se sabe cuánto margen hay, y eso faltaba para decidir con criterio.

Un tropiezo propio: la primera pasada se cayó con «Execution context was destroyed» porque yo seguía
recompilando mientras medía y Vite recargaba la página. Anotado en VERIFICACION.md.

## 2. Los cronistas tienen cuerpo

Eran puntos invisibles: te acercabas a la nada y salía un aviso. Ahora son **personas**, con el mismo esqueleto,
la misma ropa modular y los mismos clips que todo el mundo. Se giran hacia ti cuando te acercas y mueven las
manos mientras cuentan (`Idle_Talking_Loop`, que estaba cargado sin usarse desde la Fase 1).

Cada uno viste según el oficio que dice tener; son ficción y ninguno lleva nombre de una persona real.

**Sólo existen cerca:** cuerpo a 70 m, se retiran a 110. Once personajes con esqueleto permanentes costarían más
que todo lo demás junto, y diez estarían siempre lejos de donde se juega. Lo normal es que haya cero o uno.

## 3. Que el mundo no pese donde no estás

Está todo explicado en [docs/OPTIMIZACION.md](../../docs/OPTIMIZACION.md). El resumen:

**Escalonado por distancia** (`UpdateScheduler`). Cada enemigo y cada animal corría su ciclo entero todos los
fotogramas, a dos metros o a doscientos. Ahora: cada fotograma por debajo de 30 m, 20 Hz hasta 80, 8 Hz hasta
150, 3 Hz más allá. Se acumula el dt, así que **la física sale igual**; lo que baja es cuántas veces se piensa.
Un enemigo que ya te vio queda exento: en combate manda la precisión.

**Perfil de tiles** (`TileProfile`). Decidir si un punto es bosque, finca o ciudad recorría *todos* los tiles
cargados y *todos* sus árboles y edificios, varias veces por segundo — decenas de miles de distancias para
responder algo que no cambia nunca. Ahora se cuenta una vez al cargar el tile, en una rejilla de 31,25 m, y
consultar es tiempo constante.

> Detalle que costó una pasada: la primera versión sumaba celdas enteras y **el Parque Principal salía
> clasificado como bosque**. Ahora la cuenta se escala por la proporción de área que el círculo ocupa.

**Colisiones.** Tres cambios en el bucle más caliente del juego: marca de visita en vez de crear un `Set` por
iteración (tres por llamada, pura basura para el recolector), borrado por intercambio en vez de `indexOf` +
`splice` al descargar tiles, y una clave de celda que no confunde coordenadas negativas. Más `ocupado()`, que
corta en el primer contacto para cuando sólo hace falta saber si cabe algo.

Medido con 37.000 obstáculos cargados: **2.000 resoluciones en 2,7 ms** (1,35 µs cada una).

## Qué quedó pendiente

- Las zonas de facción siguen sin pintarse en el mapa ni en el minimapa.
- Las misiones de «llevar» no tienen objeto que llevar.
- Faltan hitos reales por modelar: la **Alcaldía «La Chapolera»** la referencia una misión y no existe.
- El personaje sigue sin sentarse dentro del vehículo (`Driving_Loop` cargado y sin usar).
- Decisión abierta: **San Agustín y la Laguna de Guaitipán** como destinos narrados o como terreno.
