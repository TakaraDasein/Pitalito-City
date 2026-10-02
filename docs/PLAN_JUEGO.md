# Plan: de maqueta navegable a juego de acción

> **Qué es esto.** El salto de "Pitalito recorrible en carro" a un juego web de acción con personaje propio,
> combate y narrativa histórica. Ocho fases, cada una con entregable, medida y captura registrada en
> [`iteraciones/`](../iteraciones/). Rige sobre la hoja de ruta de [ESTADO.md](ESTADO.md).

---

## 1. Qué juego estamos haciendo

**Una sola frase:** *recorrer el Pitalito real, de a pie o en carro, construyendo y peleando, para reconstruir
la historia del Valle de Laboyos — de los guacas y los caminos de arriería al café de hoy.*

Tres motores que ya no se estorban, cada uno manda en su terreno:

| De dónde viene | Qué aporta | Dónde se nota |
|---|---|---|
| **GTA** (lo que ya hay) | Mundo abierto real, vehículos, tráfico, GPS | Conducción, ciudad, misiones de reparto |
| **Dark Souls** | Combate con peso, esquiva rodando, fijar blanco, resistencia; luz y atmósfera | Pelea, iluminación, enemigos, muerte y vuelta a la hoguera |
| **Minecraft** | Construir y romper por bloques, recursos, refugio | Lo que el jugador levanta (capa aparte, nunca toca el Pitalito real) |

**Fin del juego (nuevo):** no es "llegar a un punto", es **completar la historia de Pitalito**. El jugador
recupera piezas del pasado del municipio — sitios, oficios, testimonios, objetos — y cada pieza recuperada
ilumina una etapa del Valle de Laboyos. El juego termina cuando la línea de tiempo está completa y el municipio,
en el mapa, queda "conocido". Ver §7.

---

## 2. Lo que se respeta sin discusión

Estas reglas ya existen ([REGLAS.md](REGLAS.md)) y el salto **no** las rompe:

1. **Pitalito es el real.** Enemigos, criaturas y bloques son capas *encima*; no mueven un edificio ni un árbol
   de los datos. Lo inventado (una criatura, una facción) se declara como ficción en su módulo.
2. **Licencias.** Todo modelo entra por `scripts/fetch-*.mjs` con fuente y licencia. Sólo CC0 se versiona
   (ver [ASSETS_3D.md](ASSETS_3D.md)).
3. **Presupuesto.** ≤ 700 draw calls, ≤ 1 M triángulos en preset Alta. Cada fase mide antes y después.
4. **Español en comentarios e interfaz**, identificadores en inglés, estilo café y guadua en toda la interfaz.
5. **Apagable.** Todo lo nuevo se apaga desde `src/config/` sin romper el juego base.

### Una advertencia sobre las facciones armadas

Pediste facciones guerrilleras controlando zonas. Es jugable y se puede hacer bien, pero conviene decidirlo con
los ojos abiertos: Pitalito es un municipio real con **10.569 personas en registro de desplazamiento** (7,37 % de
su población, dato del IGAC que nos pasaste). Poner grupos armados reconocibles en su mapa real toca a vecinos
vivos.

**Cómo lo resuelve el plan, salvo que digas otra cosa:** las facciones son **ficción declarada y sin nombre real**
— *"los Restos"*, cuadrillas de **esqueletos con uniforme militar**, no personas. Son un eco del pasado, no un
bando político: encajan con el tono de Dark Souls, permiten combate sin representar a nadie, y sostienen el fin
histórico del juego (lo que quedó del conflicto es literalmente hueso y uniforme vacío). No se usan siglas,
banderas ni consignas de ningún grupo existente. Si prefieres otra dirección, se cambia en
`src/config/factions.config.js` sin tocar el resto.

---

## 3. Fases

Cada fase: **entregable → verificación → captura en `iteraciones/` → commit**. Una fase no empieza hasta que la
anterior está medida y registrada.

> **Estado al 1 de octubre de 2026: las ocho están hechas.** Cada una tiene su carpeta en
> [`iteraciones/`](../iteraciones/) con capturas y medidas. La 5 (facciones) se adelantó a la 4 (fauna) porque
> reutilizaba el esqueleto y el combate que ya existían; con la IA hecha, la fauna sólo tuvo que añadir animales.
> Lo que queda no son fases, es pulido — y **medir los fps en una GPU real**, que es el único hueco grande.

### Fase 1 — Esqueleto y animaciones *(base de todo lo demás)*
**Hecha** — [iteración](../iteraciones/01-esqueleto-v0.4.0/).
Reemplazar el personaje de cajas por un modelo con esqueleto real.

- `scripts/fetch-characters.mjs`: baja la Universal Animation Library (CC0) a `assets/models/`.
- `src/entities/character/Rig.js`: carga el GLB, expone los 46 clips, `AnimationMixer` con mezcla y transiciones.
- `src/entities/character/AnimationGraph.js`: máquina de estados (quieto → caminar → trotar → correr → saltar →
  caer → rodar → golpear → recibir → morir), con mezcla por velocidad y dirección.
- Enganchar lo que ya existe: `Driving_Loop` en los 6 vehículos, `Sitting_*` en las bancas, `Interact` en la tecla E.
- **Medida:** draw calls por personaje ≤ 4, triángulos ≤ 3.000, coste de `AnimationMixer` con 30 personajes.

### Fase 2 — Creación de personaje *(tipo Dark Souls)*
**Hecha** — [iteración](../iteraciones/02-creacion-personaje-v0.5.0/).
Pantalla previa a la partida, en café y guadua, navegable con teclado.

- Cuerpo base (complexión, tono de piel, rostro, peinado) sobre *Universal Base Characters*.
- Ropa modular sobre *Modular Character Outfits* + piezas propias de la región: **sombrero aguadeño**, ruana,
  poncho, delantal de caficultor, botas de caucho.
- **Clase de origen** (el "starting class" de Souls), cada una del Pitalito real y con su equipo inicial:
  *caficultor*, *arriero*, *chivero*, *guaquero*, *comerciante de la galería*, *estudiante*.
- Se guarda en `localStorage`; se puede volver a editar desde el menú de pausa.
- **Medida:** la pantalla carga en < 2 s y no sube el presupuesto de la partida.

### Fase 3 — Combate y arsenal
**Hecha** — [iteración](../iteraciones/03-combate-v0.6.0/).
Sistema de pelea con peso, no de botón repetido.

- **Verbos:** golpe ligero, golpe fuerte, **rodar** (invulnerabilidad breve), cubrirse, fijar blanco (lock-on),
  resistencia que se gasta y se recupera.
- **Arsenal**, todo reutilizando los mismos clips (`Sword_*`, `Punch_*`, `Pistol_*`) y con objetos del lugar:
  machete (el `Sword_*` sirve tal cual), garrote de guadua, peinilla, azadón, rejo, hondas, y armas de fuego
  viejas para las facciones.
- `src/systems/CombatSystem.js`: cajas de daño por fotograma de animación, `i-frames` del rodar, aturdimiento,
  postura, muerte. `src/config/combat.config.js` con todos los números.
- **Reutilización:** el mismo sistema sirve al jugador, a las criaturas y a las facciones. Un enemigo es un
  `Rig` + un árbol de comportamiento + una tabla de ataques; nada de código por enemigo.
- **Medida:** 12 enemigos peleando a la vez sin salirse del presupuesto.

### Fase 4 — Fauna de los bosques
**Hecha** — [iteración](../iteraciones/05-fauna-v0.8.0/).
Las zonas arboladas (ya existen: 21.527 árboles con datos reales) dejan de estar vacías.

- Tres nichos, con modelos CC0 y comportamiento distinto: **pacíficos** (borugo, ñeque, guatín, venado, aves),
  **territoriales** (perros de finca, serpientes), **nocturnos**. Fauna real del Huila; lo que no se pueda
  confirmar se declara como estimado en DATOS.md.
- `src/systems/WildlifeSystem.js`: aparición por densidad arbórea y hora del día, no por listas fijas.
- **Optimización:** bandada/manada como una sola entidad lógica; sólo se anima lo que está a la vista.

### Fase 5 — Facciones
**Hecha** — [iteración](../iteraciones/04-facciones-v0.7.0/).
Territorio, presión y consecuencia.

- Zonas de control en el mapa (rurales, lejos de la cabecera), pintadas en el mapa y el minimapa.
- Enemigos: **esqueletos con uniforme militar**, con el rig universal y los mismos clips de combate.
- Reputación por zona: entrar, pelear, huir, negociar. Afecta a qué caminos son seguros de noche.
- **Regla:** ficción declarada, sin nombres ni símbolos reales (§2).

### Fase 6 — Belleza: partículas, luz y sonido
**Hecha** — [iteración](../iteraciones/06-particulas-luz-v0.9.0/).
El salto visual, sobre lo que ya hay (PostFX, PMREM, clima).

- **Partículas en GPU** (`src/render/Particles.js`): un solo `InstancedMesh` por familia, simulación en el
  vértice, cero coste de CPU. Familias: polvo de la vía, chispas del machete, sangre y niebla de los esqueletos,
  lluvia salpicando, humo del fogón, luciérnagas, hojas al viento, vapor de la trilladora.
- **Luz tipo Souls:** niebla volumétrica barata por profundidad, dios-rayos en el cafetal al amanecer, luz de
  antorcha con oclusión, contraste fuerte entre el día abierto y el bosque cerrado.
- **Sonido con posición** sobre el `AudioSystem` que ya existe: bambuco y rajaleña de la región en momentos
  clave, cigarras, lluvia en techo de zinc.

### Fase 7 — La historia de Pitalito
**Hecha** — [iteración](../iteraciones/07-historia-v1.0.0/).
Ver §7. Es la fase que le da sentido a todas las anteriores.

### Fase 8 — Rendimiento y pulido
**Hecha** — [iteración](../iteraciones/08-rendimiento-v1.0.0/).
Se mide **en GPU real**, que es lo que hoy está pendiente. Ver §6.

---

## 4. Hitos reales que entran

Del municipio (dentro de los ±12 km del mundo), por orden de evidencia fotográfica disponible:

| Hito | Estado |
|---|---|
| Parque Principal José Hilario López + Iglesia + Torre San Antonio | **Hecho** (v0.3) |
| Alcaldía "La Chapolera" | Pendiente de fotos |
| Terminal de Transportes | Pendiente |
| Villa Olímpica | Pendiente |
| Gemelas Danzantes (Bruselas) | Pendiente |
| Cerro de Ingalí, alto de Las Cruces, serranía de La Ceja | En el relieve, sin señalizar |
| Los 9 centros poblados: Bruselas, Charguayaco, Chillurco, Criollo, Guacacayo, La Laguna, Los Arrayanes, Palmarito, Regueros | En los datos, sin identidad propia |

**Nota de alcance sobre lo que pediste.** El **Parque Arqueológico de San Agustín** y la **Laguna de Guaitipán**
quedan **fuera** del municipio de Pitalito (San Agustín e Isnos limitan al oeste; Guaitipán es de la zona de
Timaná). El mundo hoy cubre ±12 km alrededor del Parque Principal y no los alcanza. Dos caminos, y hay que
elegir uno en la Fase 7:

- **(a)** Ampliar el mundo hacia el occidente para incluir San Agustín — cuesta datos y presupuesto, pero es real.
- **(b)** Dejarlos como **destinos de viaje** narrados: aparecen en la historia y en el mapa regional, el jugador
  llega por carretera a una escena aparte, sin cargar todo el terreno intermedio.

Recomendación: **(b)** para la primera versión, **(a)** como investigación. Así entran las estatuas de San Agustín
y la laguna sin reventar el presupuesto ni inventar terreno.

---

## 5. Paradigmas de optimización que se van a usar

No es "optimizar al final": son decisiones de arquitectura que se toman ahora.

| Técnica | Para qué | Dónde |
|---|---|---|
| **Animación por instancias con textura de huesos** | Cientos de esqueletos/animales con 1 draw call por tipo: las poses se hornean en una textura y el vértice lee el fotograma. | `src/entities/skinning/InstancedSkinned.js` |
| **LOD de animación** | Lejos, menos fotogramas por segundo de `mixer` (30 → 10 → 5 → congelado). Ahorra CPU, no se nota. | `AnimationGraph` |
| **Particulas en GPU** | Simulación en el vértice; la CPU sólo emite. | `src/render/Particles.js` |
| **Culling jerárquico + oclusión por portales** | Ya hay streaming por tiles; falta no dibujar lo que tapa un edificio. | `WorldStreamer`, `CityLOD` |
| **Web Worker para construir tiles** | Ya está en la hoja de ruta; con combate es obligatorio (un tirón en medio de una pelea se siente). | `WorldStreamer` |
| **Atlas de texturas y fusión por material** | `bakeStatic` ya fusiona; extenderlo a personajes y ropa. | `MaterialLibrary` |
| **Presupuesto por fotograma en vez de por objeto** | Un director reparte el gasto: si hay pelea, baja el detalle de la ciudad, no los fps. | `src/core/FrameBudget.js` |
| **Espacial por rejilla (hash grid)** | Buscar "qué hay cerca" en combate e IA sin recorrer listas. | `CollisionWorld` |
| **Árboles de comportamiento compartidos** | Una IA para todo enemigo, parametrizada; no una clase por bicho. | `src/systems/ai/` |

---

## 6. Cómo se verifica cada iteración

Además de la lista de [VERIFICACION.md](VERIFICACION.md):

1. `pnpm build` sin errores.
2. Capturas con `pnpm shot` de las escenas fijas de comparación (parque, calle, rural, combate).
3. **Medidas anotadas:** draw calls, triángulos, peso de descarga, y — lo que falta hoy — **fps en GPU real**.
4. Carpeta nueva en `iteraciones/` con capturas comprimidas y su README.
5. Bitácora de ESTADO.md al día si cambió el rumbo.

---

## 7. La historia: Pitalito como el fin del juego

La narrativa no se inventa: **se recupera**. Cada pieza es un dato con fuente, igual que los edificios.

**Estructura:** cinco etapas del Valle de Laboyos, cada una con piezas repartidas por el mapa real. El jugador
las encuentra explorando, peleando o construyendo; al completar una etapa se ilumina en la línea de tiempo del
menú y cambia algo en el mundo (un lugar deja de estar en penumbra, una zona se vuelve segura).

| Etapa | De qué va | Dónde se busca |
|---|---|---|
| **Antes** | El valle antes del pueblo: los caminos, la gente que talló la piedra | Zonas rurales, cerros, quebradas |
| **Fundación** | El pueblo se hace municipio; el Parque, la iglesia | Centro histórico |
| **Arriería y camino** | Los caminos de herradura, las mulas, el comercio con el sur | Vías rurales, Bruselas, Regueros |
| **Café** | Lo que define a Pitalito hoy: 22.064 ha de cultivos permanentes, el café del Huila | Cafetales, trilladoras, La Laguna |
| **Lo que quedó** | El desplazamiento, la ciudad que creció a 143.407 habitantes, lo que se perdió y lo que no | Toda la ciudad; cierra el juego |

**Datos del municipio que alimentan el mundo** (IGAC, *Diccionario de entidades territoriales*, 2025 —
ver [DATOS.md](DATOS.md)): 143.407 habitantes (59 % en la cabecera), 630,73 km², 1.271 m s. n. m., 20 °C,
227,4 hab/km², 9 centros poblados, 8 municipios limítrofes, 45.518 predios (64 % urbanos), 1.608 empresas,
611.600 aves de engorde y 26.641 bovinos, 10.569 personas desplazadas.

Estos números no son decoración: fijan **densidad de peatones**, **mezcla de vehículos**, **qué hay en cada
finca** y **qué tan viva está cada zona**. Quedan en `src/config/municipio.config.js`.

---

## 8. Equipos de agentes

Seis equipos, definidos en [`.claude/agents/`](../.claude/agents/). Cada uno tiene su alcance, sus archivos y su
criterio de "terminado"; se invocan por nombre y trabajan sobre la fase en curso.

| Equipo | Alcance |
|---|---|
| `historia-pitalito` | Investiga y redacta la narrativa con fuentes; nada sin dato |
| `animacion-personajes` | Rig, clips, máquina de animación, creación de personaje |
| `combate-ia` | Arsenal, daño, árboles de comportamiento, fauna y facciones |
| `arte-render` | Partículas, luz, materiales, presupuesto visual |
| `infraestructura` | Pipeline de datos, scripts de descarga, build, Workers |
| `pruebas` | Capturas, medidas, registro de iteraciones, regresiones |

---

## 9. Orden de trabajo sugerido

```
Fase 1 (esqueleto)  →  Fase 2 (creación)  →  Fase 3 (combate)
                                              ├→ Fase 4 (fauna)
                                              └→ Fase 5 (facciones)
Fase 6 (belleza) en paralelo desde la Fase 3
Fase 7 (historia) arranca con investigación desde el día 1 (equipo historia-pitalito)
Fase 8 (rendimiento) al cerrar cada fase, no al final
```

La Fase 1 es el cuello de botella: **nada más empieza hasta que haya un personaje con esqueleto en pantalla.**
