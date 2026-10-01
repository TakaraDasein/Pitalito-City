# Rendimiento

> Qué cuesta cada cosa, qué límites hay y cómo se reparten. Medido, no estimado. Los presupuestos los fija
> [REGLAS.md § 5](REGLAS.md#5-rendimiento-presupuestos): **≤ 700 draw calls y ≤ 1 M de triángulos** en preset Alta.

## El problema que apareció al juntarlo todo

Cada sistema tiene su tope y **cada tope por separado cabe**. Juntos, no. Medido en el centro, a pie:

| Escena | Draw calls | Triángulos |
|---|---|---|
| Ciudad sola | 474–510 | 863.753–870.311 |
| + 6 esqueletos + 8 animales | **724–781** | **1,02–1,08 M** |
| Presupuesto | ≤ 700 | ≤ 1 M |

De los ~870.000 triángulos de base, **la inmensa mayoría es la ciudad**, no los personajes. Un personaje vestido
cuesta 28.825 triángulos y 11 draw calls; un esqueleto uniformado, 10.214 y 10; un animal, menos de 900.

## Qué cuesta cada cosa (medido)

| | Draw calls | Triángulos |
|---|---|---|
| Jugador vestido | 11 | 28.825 |
| Esqueleto con uniforme y arma | 10 | 10.214 |
| Vaca / caballo | 3 / 2 | 796 / 690 |
| Gallina (modelada a mano) | 5 | 854 |
| **Todas las partículas** | **7 fijos** | despreciable |

Las partículas merecen un apunte: **1.200 emitidas de golpe no movieron los draw calls** (500 antes y después),
porque toda la simulación va en la GPU y cada familia es un solo `InstancedMesh`.

## El director de presupuesto

`src/core/FrameBudget.js` mira dos veces por segundo lo que de verdad se está dibujando y recorta **lo que menos
se nota**, en orden:

1. **Fauna lejana** — un animal menos en el campo no se echa de menos.
2. **Enemigos que todavía no están peleando** — a los que ya te vieron no se les quita del mapa, que sería hacer
   trampa.
3. **Distancia a la que se anima** a los personajes.
4. **Radio de tiles de la ciudad** — último recurso, y el que más pesa.

La presión sube rápido y baja despacio, para que no parpadee entre recortar y soltar. Los topes nominales
(`SPAWN.maxActive`, `WILDLIFE.maxActive`) son el techo: el director sólo baja de ahí.

**Una trampa que costó una medición:** bajar el radio de tiles no descargaba ni uno. `unloadMargin: 1` volvía a
dejar dentro justo los que se acababan de quitar. El director ahora baja también el margen.

## Lo que el director no puede arreglar

Si hay muchos enemigos **peleando a la vez**, no retira a ninguno —por diseño— y el presupuesto se pasa. En
partida normal no ocurre: el poblador de zonas nunca crea más de los que caben. Sólo se llega ahí forzándolo
desde la consola.

## Una optimización que se intentó y se revirtió

Unir las prendas que comparten material para bajar los draw calls por personaje. Técnicamente hace falta
renumerar los índices de hueso a un orden común y recortar los atributos al mínimo que todas comparten; las dos
cosas funcionan, **pero la malla sale deformada** —las piezas de piel de la ropa acababan apelotonadas a la
altura del cuello— y un personaje vestido a medias es peor que un draw call de más. Revertido y anotado en
`Rig.js`. La vía buena es dejar las prendas ya fusionadas **en el pipeline** (`scripts/`), con el modelo delante,
en vez de hacerlo en el navegador a ciegas.

## Lo que sigue sin medirse

**Fps en GPU real.** Todo lo de aquí son draw calls y triángulos, que no dependen de la máquina. El entorno de
verificación (Chromium sin GPU) renderiza a ≈ 0,5 fotogramas por segundo desde que el personaje tiene esqueleto,
así que **no sirve para medir fps**: sólo para contar lo que se dibuja. Hace falta abrir el juego en dos o tres
GPUs reales y mirar la tecla **B**.
