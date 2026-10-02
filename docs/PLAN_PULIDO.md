# Plan de pulido del mapa actual

> Las ocho fases del salto a juego de acción están hechas ([PLAN_JUEGO.md](PLAN_JUEGO.md)). Esto es lo que queda:
> **replicar los sitios que faltan y pagar la deuda técnica**, sobre el mapa que ya existe.
>
> La ampliación hacia **San Agustín, la Laguna de Guaitipán y el Salto de Bordones** queda decidida y para
> después: primero se pule lo que hay. Ver §5.

## 1. Lo que ya está en los datos (y no hay que inventar)

OSM ya trae la posición y la huella real de casi todo lo que falta. **No hay que estimar dónde está nada**: hay
que darle forma a lo que ya está ahí como un bloque extruido genérico.

| Sitio | Centro (mundo) | Huella | Altura hoy | Fuente |
|---|---|---|---|---|
| **Alcaldía Municipal La Chapolera** | (73, 190) | 56 × 57 m | 7 m (GHSL) | OSM |
| **Coliseo Cubierto de Pitalito** | (−770, 494) | 73 × 58 m, 6 vértices | 7 m (GHSL) | OSM |
| **Concha Acústica** | (−878, 561) | 26 × 26 m, **16 vértices (circular)** | 2,7 m | OSM |
| Biblioteca Municipal | (119, 51) | 69 × 57 m | 7 m | OSM |
| **Villa Olímpica** | (−658, −882) | 108 × 177 m | — (área) | OSM |
| Canchas Villa Olímpica | (−766, −841) | 86 × 128 m | — | OSM |
| **Patinódromo de Pitalito** | (−743, −957) | 47 × 100 m | — | OSM |
| **Terminal de Transportes** | (1529, −1426) | 197 × 208 m, 13 vértices | — (lote) | OSM |
| Club Centenario | (183, 1742) | 173 × 235 m | — | OSM |

Las alturas de 7 m son el promedio de celda de GHSL y **están mal** para estos edificios: el Coliseo tiene tres
niveles más cubierta (≈ 14 m) y la Alcaldía tres pisos (≈ 12 m). Cada hito modelado a mano fija su altura real a
partir de la foto y lo declara, como ya se hizo con la Torre San Antonio.

## 2. Una corrección: el skatepark

Las fotos de skatepark que llegaron **no son de Pitalito**: una lleva el lema *#POR_UN_SKATEPARK_EN_VILLAZON*
(Villazón, Bolivia). Lo que sí existe aquí, y OSM lo confirma con su polígono, es el **Patinódromo de Pitalito**
(47 × 100 m) — una pista de patinaje de velocidad, que es otra cosa: óvalo peraltado, no cuencos ni barandas.

Se modela el Patinódromo. Si hay un skatepark de verdad en el municipio, hace falta una foto suya o un dato de
OSM antes de ponerlo ([REGLAS.md § 1](REGLAS.md#1-fidelidad-a-pitalito)).

## 3. Referencias conseguidas

Cuatro fotos nuevas con licencia, ya en el pipeline (`npm run refs:fetch`) y acreditadas en
`assets/references/CREDITS.md`. Todas **CC BY-SA 4.0**:

| Archivo | Qué resuelve | Autor |
|---|---|---|
| `landmarks/coliseo/` | Interior del Coliseo: graderías de concreto en herradura, muro de ladrillo con franja alta de ventanas, cercha metálica vista | Daalecura |
| `landmarks/concha-acustica/` | **La Concha y, al fondo, el exterior del Coliseo en la misma foto**: tarima circular sobre zócalo de ladrillo, cubierta de celosía colgada de dos torres en A por tensores, anfiteatro de gradas en semicírculo | Jhysus |
| `landmarks/alcaldia/` (nueva) | La Chapolera: volumen oscuro de piedra y vidrio, bandera tricolor, escalinata | Darwin A. Rivera |
| `landmarks/gemelas-danzantes/` | Gemelas Danzantes (Bruselas) | Karokunst |

**No conseguidas en Commons** (hay que mirarlas en fotos con derechos, citándolas en la cabecera del módulo, sin
guardarlas en el repositorio — [REGLAS.md § 2.6](REGLAS.md#2-licencias-y-atribución)): Terminal de Transportes,
Patinódromo, Villa Olímpica, el **Monumento al Recolector**, el letrero **«200 Pitalito»** y la **fuente** del
Parque Principal.

## 4. Las fases del pulido

Mismo método de siempre: entregable → verificación → captura en `iteraciones/` → commit.

### P1 · Los cuatro hitos del centro *(lo que rompe una misión)*
La misión «Municipio (1912)» manda a la Alcaldía y **apunta a unas coordenadas inventadas** (−36, 24) en vez de
las reales (73, 190). Se corrige y se modelan:

- **Alcaldía La Chapolera**: tres pisos, fachada de piedra oscura y vidrio, escalinata, astas de bandera y la
  estatua de la chapolera en la terraza (la de la foto del usuario).
- **Monumento al Recolector**: el busto de bronce con sombrero y manos sosteniendo el canasto, en el Parque
  Principal. Forma estimada declarada, a partir de fotos con derechos.
- **Letrero «200 Pitalito»** y **fuente con espejo de agua** del Parque Principal: los dos existen y están en las
  fotos; la fuente llevaba pendiente desde la v0.2 por falta de referencia, y ya la hay.

### P2 · El polideportivo del occidente
Coliseo Cubierto y Concha Acústica están a 140 m uno del otro y salen juntos en la misma foto, así que se hacen
en el mismo pase:

- **Coliseo**: caja de ladrillo con cubierta metálica a dos aguas, galería de columnas en la fachada, y por
  dentro las graderías en herradura con la cancha al centro.
- **Concha Acústica**: tarima circular sobre zócalo de ladrillo, la cubierta de celosía colgada de dos torres en
  A, y el anfiteatro de gradas en semicírculo.

### P3 · Villa Olímpica, Patinódromo y Terminal
Son recintos grandes, más de trazado que de edificio: pistas, canchas, graderías, andenes y cubiertas. El
Terminal (197 × 208 m) necesita además las bahías de buses y el edificio de taquillas.

### P4 · Que la ciudad esté viva
- **Peatones** con el mismo rig que todo el mundo, en andenes y en el parque, con densidad sacada de las cifras
  reales (`DERIVADOS.peatonesPorKm2`).
- Que el tráfico **respete los 99 semáforos** que ya están en los datos, y la prelación en los cruces.
- **Zonas de facción pintadas** en el mapa y el minimapa.

## 5. La deuda técnica, en orden de lo que más se siente

| # | Qué | Por qué duele | Dónde |
|---|---|---|---|
| 1 | **Streaming de tiles a un Web Worker** | Es el pico de **29 ms** por fotograma que mide el bench: la construcción de tiles bloquea el hilo principal y se nota como un tirón al avanzar | `WorldStreamer` |
| 2 | **Fusionar prendas por material en el pipeline** | Se intentó en el navegador y la malla salía deformada; hecho offline, con el modelo delante, baja de 11 a ~5 draw calls por personaje y permite subir el tope de enemigos | `scripts/` |
| 3 | **Medir en una máquina floja** | El presupuesto existe para ellas y sólo se ha medido en una RTX 4060 | `npm run bench` |
| 4 | Alturas por edificio en vez de por celda de 90 m | Toda la ciudad tiene la altura promedio de su celda; se nota en los hitos y en las manzanas con mezcla de alturas | `build-world.mjs` |
| 5 | Refinar los cuadrúpedos de fauna | Venado y ñeque son toscos de cerca | `wildlife/models.js` |
| 6 | Colisión para la fauna | Se les atraviesa | `WildlifeSystem` |
| 7 | Objetos que llevar en las misiones de reparto | Hoy basta ir y volver | `StorySystem` |
| 8 | Sonido con posición en el espacio | Es monofónico | `AudioSystem` |

**Orden recomendado:** P1 → deuda 1 → P2 → deuda 2 → P3 → P4, metiendo las deudas 3–8 donde encajen. P1 va
primero porque hay una misión rota; la deuda 1 va pronto porque es lo único que se siente como un defecto al
jugar, no como algo que falta.

## 6. Después: la ampliación del mapa

Decidido que se hará, **después de pulir lo de aquí**: San Agustín, la Laguna de Guaitipán y el Salto de
Bordones. Son otro municipio (San Agustín e Isnos limitan al occidente) y hoy quedan fuera de los ±12 km del
mundo, así que es trabajo de pipeline además de arte: ampliar el bbox, volver a bajar OSM y los rásteres, y
decidir si el terreno intermedio se carga o se salta.

De paso, **ya hay cinco fotos del Salto de Bordones en Commons** (Yao Murillo y otros), así que esa referencia
está resuelta cuando llegue el momento.
