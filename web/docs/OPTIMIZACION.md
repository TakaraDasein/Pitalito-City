# Optimización: qué se hace para que el mundo no pese

> Las técnicas y por qué se eligieron. El coste medido está en [RENDIMIENTO.md](RENDIMIENTO.md); los fps reales,
> en [MEDICIONES.md](MEDICIONES.md).

El principio es uno solo y se repite en todas partes: **nada existe lejos del jugador, y lo que existe lejos
piensa menos**. Lo primero decide *qué hay*; lo segundo, *cuánto cuesta lo que hay*.

## 1. Lo que existe: aparición por zonas

Ningún sistema mantiene su contenido por el mapa entero.

| Sistema | Qué aparece | Cuándo | Cuándo se retira |
|---|---|---|---|
| Tráfico | Vehículos IA | 260 m | 380 m |
| Facciones | Esqueletos | 140 m, y sólo dentro de una zona de control | 240 m |
| Fauna | Animales | 120 m, según hábitat y hora | 190 m |
| Cronistas | Personajes de historia | 70 m | 110 m |

Los cronistas son el caso claro: son **once personajes con esqueleto** repartidos por todo el municipio. Tenerlos
siempre costaría más que todo lo demás junto, y diez de los once estarían siempre a kilómetros de donde se juega.
Con el cuerpo puesto sólo a 70 m, lo normal es que haya cero o uno.

Las zonas de facción van un paso más allá: **ni siquiera se consideran** si el jugador no está dentro de su
radio. Tres zonas o trescientas cuestan lo mismo cuando estás en el centro.

## 2. Lo que cuesta: escalonado por distancia

`src/systems/ai/UpdateScheduler.js`. Cada enemigo y cada animal corría su ciclo entero —percepción, árbol de
comportamiento, física, animación— **todos los fotogramas**, estuviera a dos metros o a doscientos.

| Distancia | Se actualiza |
|---|---|
| < 30 m | cada fotograma |
| 30–80 m | 20 veces por segundo |
| 80–150 m | 8 veces por segundo |
| > 150 m | 3 veces por segundo |

Cada entidad acumula el tiempo que le toca y se actualiza con el dt acumulado, así que **la física sale igual**
(recorre lo mismo); lo que baja es cuántas veces se piensa. Un enemigo que ya te vio queda exento: en combate
manda la precisión.

Lo mismo se aplica a la animación por otra vía (`CHARACTERS.animationLod`: de 60 a 20, 8 y 3 Hz de mezcla según
distancia) y a la fauna, que además **no se anima si está fuera de cámara**.

## 3. Lo que se pregunta: perfil de tiles

`src/world/TileProfile.js`. Para decidir si un punto es bosque, finca o ciudad, la fauna y el ambiente recorrían
**todos los tiles cargados y todos sus árboles y edificios**, en cada intento de aparición y varias veces por
segundo. Con 25 tiles de hasta 84 árboles y 129 edificios cada uno, eso son decenas de miles de distancias por
segundo para responder algo **que no cambia nunca**: los árboles de un tile no se mueven.

Ahora, al cargarse un tile se cuenta una vez cuántos árboles y edificios caen en cada celda de una rejilla de
8×8 (31,25 m) y se guarda. Consultar es mirar unas pocas celdas: tiempo constante.

La cuenta es **una estimación de densidad**, escalada por la proporción de área que el círculo ocupa de las
celdas sumadas. Sin ese escalado, un radio de 40 m sumaba celdas que llegan a 125 m y el Parque Principal salía
clasificado como bosque.

## 4. Lo que choca: colisiones

`src/world/CollisionWorld.js` ya tenía hash espacial de 16 m. Lo que se cambió, y conviene no deshacer:

- **Marca de visita en vez de `Set`.** Una celda aparece varias veces al barrer el rango, y antes se creaba un
  `Set` nuevo por iteración —tres por llamada— sólo para no repetir obstáculos. Eso es basura para el recolector
  en el bucle más caliente del juego. Ahora cada obstáculo lleva un número de visita: cero asignaciones.
- **Borrado por intercambio.** Al descargar un tile había que buscar cada obstáculo con `indexOf` y `splice`:
  cuadrático con tiles densos. Ahora cada obstáculo sabe en qué posición está de cada celda y se quita
  intercambiándolo con el último.
- **Clave de celda sin colisiones.** La anterior (`cx * 100003 + cz`) confunde celdas lejanas con coordenadas
  negativas.
- **`ocupado(x, z, r)`**, que corta en el primer contacto, para cuando sólo hace falta saber si cabe algo. La
  fauna lo usa al buscar sitio en vez de resolver la colisión entera.

Medido con 37.000 obstáculos cargados: **2.000 resoluciones en 2,7 ms** (1,35 µs cada una).

## 5. Lo que se dibuja: director de presupuesto

`src/core/FrameBudget.js`. Ver [RENDIMIENTO.md](RENDIMIENTO.md): mira lo que se está dibujando y recorta lo que
menos se nota, en orden — fauna lejana, enemigos que aún no pelean, distancia de animación y, de último, el radio
de tiles de la ciudad.

## Lo que se descartó, y por qué

- **Fusionar las prendas por material** para bajar draw calls: la malla sale deformada. Revertido, con el porqué
  en `Rig.js`. La vía buena es hacerlo en el pipeline, no en el navegador.
- **Oclusión por portales** entre edificios: a esta escala el coste de mantener el grafo supera lo que ahorra, y
  el streaming por tiles ya quita casi todo lo que no se ve.
- **Animación por instancias con textura de huesos**: sigue siendo la vía si algún día hacen falta cientos de
  personajes a la vez. Con el tope actual (seis enemigos, diez animales) no compensa la complejidad.
