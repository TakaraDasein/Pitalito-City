# Estado del proyecto

> Qué hay hoy, por qué se decidió así, qué falla y qué sigue. Actualizar al cerrar cada etapa de trabajo.

**Versión:** 1.1.0 · **Última actualización:** 2026-10-01

## Hacia dónde va (nuevo)

El proyecto deja de ser una maqueta navegable y pasa a ser un **juego de acción con fin histórico**: recorrer el
Pitalito real, de a pie o en carro, construyendo y peleando, para **reconstruir la historia del Valle de
Laboyos**. El juego termina cuando la línea de tiempo del municipio está completa, no al llegar a un punto.

Tres motores, cada uno manda en su terreno: **GTA** (mundo abierto y vehículos, ya hecho), **Dark Souls**
(combate con peso, esquiva rodando, luz y atmósfera) y **Minecraft** (construcción por bloques, capa aparte).

El plan por fases, con presupuestos, equipos de agentes y decisiones abiertas, está en
[PLAN_JUEGO.md](PLAN_JUEGO.md). El registro visual de cada versión, en [`iteraciones/`](../iteraciones/).

## Qué funciona hoy

- Mundo de Pitalito reconstruido con datos reales: 21.508 edificios (sin invadir calzadas), 21.527 árboles, 1.849 vías con nombre, 99 semáforos, relieve
  de ±12 km (montañas del Valle de Laboyos) y suelo satelital en tres niveles de detalle.
- Arranque en el Parque Principal José Hilario López, frente a la Iglesia y la Torre San Antonio (modeladas a mano).
- 6 vehículos modelados sobre fotos (Jeep Willys, taxi, camioneta de platón, chiva, motocarro, moto), con física
  arcade, pendientes reales, suspensión visual y garaje 3D para elegir, pintar y cambiar la placa.
- Tráfico IA por el carril derecho, GPS con A*, minimapa, mapa interactivo con buscador y viaje rápido.
- Menús e HUD en estilo café y guadua (principal, pausa, opciones, créditos, barra de controles en pantalla),
  presets de calidad, ciclo día/noche, lluvia.
- Verificado en Chromium con render por software (sin GPU). **Fps reales en GPU: pendiente de medir.**

## Bitácora de decisiones

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-09-24 | three.js + Vite, JavaScript plano | Mundo generado por datos; publicación web simple (ver TECNOLOGIAS.md) |
| 2026-09-24 | Streaming por tiles de 250 m + LOD de toda la ciudad | 1.100+ tiles; solo se construye el entorno del jugador |
| 2026-09-24 | v0.1: calles OSM + edificios Overture + relleno procedural de manzanas | Primera versión rápida |
| 2026-09-24 | **v0.2: se abandona lo procedural; todo con datos reales** | El usuario reportó que "muchas zonas no coinciden con la vegetación, los lugares…" |
| 2026-09-24 | Datos abiertos en vez de Google Photorealistic 3D Tiles | Sin cuentas ni costos; elegido por el usuario |
| 2026-09-24 | Huellas: OSM > Google Open Buildings > Microsoft | Overture solo traía ~60 % de los techos visibles en el satélite |
| 2026-09-24 | Descartar huellas que invaden el eje de las vías | 1.262 huellas bloqueaban calles (aleros, errores de detección) |
| 2026-09-24 | Alturas GHSL × 1,6 | GHSL subestima; calibrado con fotos del parque (ver DATOS.md) |
| 2026-09-24 | Árboles por segmentación de copas | Los máximos locales simples partían un árbol grande en muchos pequeños |
| 2026-09-24 | Parque sin jardineras, monumento ni faroles inventados | Solo lo confirmado por fotos: bolardos y letrero "200" |
| 2026-09-24 | v0.3: presets de calidad, PostFX, PMREM, clima | Plan de mejora gráfica |
| 2026-09-24 | Sombras estabilizadas en vez de sombras en cascada (CSM) | CSM exige preparar cada material; se priorizó robustez |
| 2026-09-24 | Vehículos por perfil extruido (carkit) en vez de GLTF | Control total, sin binarios, citan su foto de referencia |
| 2026-09-24 | Tráfico con detalle bajo y materiales fusionados | De 14–31 a 6–13 draw calls por vehículo |
| 2026-09-24 | Menús de guadua generados en SVG | Nítidos a cualquier resolución, sin imágenes |
| 2026-09-24 | Afinar parque e iglesia con fotos a nivel de calle (may 2025) | El parque y la iglesia no se parecían: la nave es de ladrillo, la torre está en la esquina de la Calle 5, el piso tiene retícula |
| 2026-09-24 | Despeje de calzadas en el pipeline | 4.710 huellas invadían las vías; el usuario pidió "carreteras libres de casas o tiendas" |
| 2026-09-24 | Semáforos desde OSM | Dato real disponible y visibles en las fotos |
| 2026-09-24 | Fuente del parque pendiente | Existe, pero no hay foto de su diseño; no se inventa |
| 2026-09-29 | A pie + interacción + construcción por bloques | Pedido del usuario ("salir del carro e interactuar tipo Minecraft"); los bloques son capa del jugador, los edificios reales no se rompen |
| 2026-09-24 | HUD en café y guadua + barra de controles en pantalla | Pedido del usuario: cambiar vehículo y clima sin teclado, estética unificada |
| 2026-09-30 | **Fin del juego: reconstruir la historia de Pitalito** | Pedido del usuario; da sentido a la fidelidad de los datos y evita que el mundo real sea sólo escenario |
| 2026-09-30 | Personaje con esqueleto: ecosistema Quaternius (CC0) | Los cuatro paquetes comparten un rig de 53 huesos; 46 clips ya cubren `Roll`, `Sword_Attack`, `Driving_Loop` y `Sitting_*`. Mixamo se descartó: no permite redistribuir; Kenney, por rig incompatible. Ver ASSETS_3D.md |
| 2026-09-30 | Facciones armadas como ficción declarada (esqueletos con uniforme, sin nombre real) | Pitalito tiene 10.569 personas desplazadas registradas; se evita representar grupos reales en su mapa real sin renunciar al combate |
| 2026-09-30 | San Agustín y la Laguna de Guaitipán como destinos narrados, no como terreno | Quedan fuera del municipio y de los ±12 km del mundo; cargarlos costaría datos y presupuesto. Decisión revisable (PLAN_JUEGO.md § 4) |
| 2026-09-30 | Cifras del IGAC en `src/config/municipio.config.js` | Gradúan densidad de peatones, fincas y vida por zona desde un solo lugar, con fuente |
| 2026-09-30 | Registro visual por iteración en `iteraciones/` | Pedido del usuario: comparar cómo se veía el juego en cada etapa sin recompilar versiones viejas |
| 2026-09-30 | Historia y toponimia del IGAC como contenido jugable (misiones de NPC) | Pedido del usuario: que la información de Pitalito se aprenda jugando, no leyendo un menú. Ver HISTORIA.md |
| 2026-09-30 | **v0.4: física y aspecto del personaje separados** (`Character` + `BoxBody`/`RigBody`) | El esqueleto llega por red: el juego arranca con las cajas y cambia al cargar. Sin modelo, sigue jugable |
| 2026-09-30 | Accesorios enganchados a huesos, no fundidos a la malla | El sombrero debe seguir la animación de la cabeza y poder cambiarse en la creación de personaje |
| 2026-09-30 | `resolve.dedupe: ['three']` en Vite | `three/examples/jsm` importa 'three' por su cuenta; con dos copias el skinning se rompe |
| 2026-09-30 | **v0.5: animaciones desde la exportación de Unreal, convertida con Blender** | La exportación para Godot usa nombres de hueso Rigify y **no casa** con las mallas de personaje, que usan nombres de Unreal. La de Unreal casa hueso por hueso, pero es FBX |
| 2026-09-30 | Un personaje es un cuerpo + N piezas reenganchadas al mismo esqueleto | Permite ropa y peinados intercambiables con una sola animación, y es la base de peatones y facciones |
| 2026-09-30 | Los accesorios se colocan en espacio del personaje, no del hueso | Los ejes locales de un hueso no apuntan "arriba"; el sombrero se iba a cualquier parte |
| 2026-09-30 | Encoger la piel bajo la ropa (`skinFit.js`) | El paquete gratuito trae cuerpos *Superhero* y ropa cortada para *Regular*: el cuerpo atravesaba la tela |
| 2026-09-30 | Pipeline de modelos: itch.io + Blender + reducción de texturas | 423 MB de paquetes quedan en 12,4 MB servibles, y el proceso se repite desde cero con un comando |
| 2026-09-30 | Los seis oficios del municipio como clase de origen | Da identidad local al "starting class" de Souls y usa las cifras reales de la economía de Pitalito |
| 2026-09-30 | **v0.6: construir y pelear en modos separados (tecla X)** | El clic no puede significar dos cosas a la vez; así Minecraft manda en la construcción y Souls en la pelea, sin estorbarse |
| 2026-09-30 | Un solo `Combatant` para jugador, fauna y facciones | La IA de las Fases 4 y 5 usará las mismas llamadas que el teclado; evita una clase por enemigo |
| 2026-09-30 | Alcance del golpe por sector (distancia + arco), no por cajas de hueso | Barato, legible y suficiente a esta escala |
| 2026-09-30 | Armas = herramientas reales de la región, modeladas a mano | Ningún paquete CC0 las trae, y son parte de la identidad del lugar (machete, peinilla, garrote de guadua, azadón, rejo) |
| 2026-09-30 | Verificar la lógica temporal avanzando la simulación a mano | El render por software cayó a ≈ 0,5 fps: esperar ya no sirve para comprobar nada que dependa del tiempo |
| 2026-09-30 | **v0.7: se adelanta la Fase 5 (facciones) a la 4 (fauna)** | Los enemigos humanoides reutilizan el esqueleto, los clips y el combate que ya existen; la fauna necesita modelos nuevos. Con la IA hecha, la fauna sólo añade animales |
| 2026-09-30 | **El esqueleto se genera, no se descarga** (`scripts/lib/make-skeleton.py`) | Los paquetes de monstruos traen su propio armature: no servirían con los 45 clips ni con el sistema de combate. Generado sobre el rig propio, hereda todo |
| 2026-09-30 | Árbol de comportamiento compartido en vez de una clase por enemigo | Un enemigo es un árbol + unas cifras; la fauna de la Fase 4 reutiliza la misma pieza |
| 2026-09-30 | Enemigos que sólo existen cerca del jugador, como el tráfico | El presupuesto de animación no puede depender de cuántas zonas haya en el mapa |
| 2026-10-01 | **v1.1: fps medidos en GPU real** (`pnpm bench`) | Era el único hueco grande; resulta que el presupuesto va conservador para una RTX 4060 y ahora se sabe cuánto margen hay |
| 2026-10-01 | Los cronistas tienen cuerpo, y sólo cerca del jugador | Hablar con puntos invisibles era lo más flojo de la Fase 7; once personajes permanentes costarían más que todo lo demás |
| 2026-10-01 | Escalonado de actualización por distancia (`UpdateScheduler`) | Un animal a doscientos metros no necesita decidir sesenta veces por segundo; se acumula el dt y la física sale igual |
| 2026-10-01 | Perfil de tiles precalculado en vez de recorrer árboles y edificios | Era decenas de miles de distancias por segundo para responder algo que no cambia nunca |
| 2026-10-01 | Colisiones: marca de visita, borrado por intercambio, clave sin colisiones | Es el bucle más caliente del juego y creaba un `Set` por iteración |
| 2026-10-01 | **v1.0: la historia es el fin del juego** (once cronistas, once hitos con fuente) | Pedido del usuario desde el principio; el dato deja de ser decorado y pasa a ser el contenido |
| 2026-10-01 | Dato y juego separados en archivos distintos (`historia.config.js` / `misiones.config.js`) | El contenido histórico no se toca para hacer el juego más jugable |
| 2026-10-01 | **v0.9: partículas simuladas enteras en la GPU** | 1.200 partículas no mueven los draw calls; la CPU sólo emite |
| 2026-10-01 | La atmósfera se dirige por "tensión" (enemigos cerca + monte cerrado) | El contraste de Souls se consigue cerrando la imagen, no añadiendo luces |
| 2026-10-01 | Sonido de combate sintetizado, sin archivos | Evita megas de descarga y el problema de licencia de cualquier biblioteca de efectos |
| 2026-10-01 | **Director de presupuesto por fotograma** (`FrameBudget`) | Cada tope por separado cabía; juntos no. Recorta lo que menos se nota en vez de bajar todos los topes a ojo |
| 2026-10-01 | Se intentó fusionar prendas por material y **se revirtió** | La malla salía deformada; vestido a medias es peor que un draw call de más. La vía buena es hacerlo en el pipeline |
| 2026-09-30 | **v0.8: la fauna de finca se reparte con el inventario pecuario real** | El dato del IGAC ya estaba en el repositorio sin usarse; ahora decide qué animal aparece |
| 2026-09-30 | Factor `visibilidad` sobre el inventario, declarado como diseño | Con la mezcla cruda el campo salía 10 de 10 gallinas: el inventario cuenta cabezas, no lo que se ve (las aves están en galpones) |
| 2026-09-30 | El hábitat se deduce de los datos del tile, no de una lista | Árboles = bosque, densidad de casas = ciudad; medido: a 2,4 km del centro hay mediana de 61 edificios en 120 m |
| 2026-09-30 | Gallina y borugo modelados a mano | Ningún paquete CC0 trae gallinas, y son el 92 % del inventario real del municipio |
| 2026-09-30 | Forzar materiales opacos al convertir FBX | La importación los deja con alfa 0 y `alphaMode: MASK`: los animales existían pero no se dibujaban |
| 2026-09-30 | Tope de 6 enemigos a la vez | Medido: con 5 el juego va a 645 draw calls y 982.641 triángulos; más lo saca del presupuesto hasta fusionar prendas por material |

## Limitaciones conocidas

- Fps medidos en una RTX 4060 (ver MEDICIONES.md). **Falta medir en una máquina floja**, que es para la que
  existe el presupuesto: una integrada y un portátil viejo.
- El personaje completo cuesta **11 draw calls y 28.825 triángulos**: cabe para uno, no para treinta. Falta
  fusionar las prendas que comparten material (hay que renumerar los índices de hueso antes de unir las mallas).
- La versión gratuita del paquete sólo trae una complexión por sexo y dos atuendos; las demás son de pago.
- Faltan prendas de la región que ningún paquete trae (ruana, poncho, delantal, botas de caucho): se modelan a mano.
- Los clips `Driving_Loop` y `Sitting_*` están cargados pero no se ven: falta sentar al personaje en el vehículo
  y en las bancas.
- Las zonas de control no se pintan en el mapa ni en el minimapa, y la reputación por zona se cuenta pero no
  cambia nada todavía.
- Los enemigos no se coordinan entre ellos ni esquivan hacia los lados de verdad.
- Los cuadrúpedos de fauna modelados a mano (venado, ñeque) son toscos de cerca; a distancia de juego se leen
  bien. La fauna no tiene colisión y no reacciona a los enemigos, sólo al jugador.
- Falta el golpe fuerte, encadenar golpes y el contraataque al bloquear a tiempo.
- **El render sin GPU bajó a ≈ 0,5 fps** con el personaje con esqueleto: la verificación temporal se hace
  avanzando la simulación a mano (ver VERIFICACION.md).
- El suelo satelital se ve borroso a ras de calle (0,6 m/px); el detalle procedural lo mitiga, no lo resuelve.
- Alturas por celda de 90 m, no por edificio; fachadas y forma de techos estimadas.
- Algunas huellas de Microsoft son manzanas enteras.
- Vías: ancho estimado por tipo; sin andenes ni demarcación.
- Sin peatones. Los semáforos existen (99, de OSM) pero la IA aún no los respeta ni la prelación en cruces.
- **Fuente del Parque Principal sin modelar:** falta una foto de su diseño y ubicación.
- La imagen satelital depende del servicio de Esri en vivo; sin conexión el suelo queda gris verdoso.
- Sin controles táctiles; en celular solo se puede navegar menús.
- No hay pruebas automatizadas de lógica; la verificación es visual (VERIFICACION.md).

## Hoja de ruta

**Las ocho fases del salto a juego de acción están hechas** ([PLAN_JUEGO.md](PLAN_JUEGO.md)). El juego tiene
principio, mecánicas y final: se recorre el Pitalito real, se pelea, se construye y se reconstruye la historia
del municipio. Lo que queda es pulir y medir en GPU real.

1. ~~Esqueleto y animaciones~~ — **hecho** ([iteración 01](../iteraciones/01-esqueleto-v0.4.0/))
2. ~~Creación de personaje tipo Dark Souls~~ — **hecho** ([iteración 02](../iteraciones/02-creacion-personaje-v0.5.0/))
3. ~~Combate y arsenal~~ — **hecho** ([iteración 03](../iteraciones/03-combate-v0.6.0/))
4. ~~Fauna~~ — **hecho** ([iteración 05](../iteraciones/05-fauna-v0.8.0/))
5. ~~Facciones~~ — **hecho** ([iteración 04](../iteraciones/04-facciones-v0.7.0/))
6. ~~Partículas, luz y sonido~~ — **hecho** ([iteración 06](../iteraciones/06-particulas-luz-v0.9.0/))
7. ~~La historia de Pitalito~~ — **hecho** ([iteración 07](../iteraciones/07-historia-v1.0.0/))
8. ~~Rendimiento~~ — **hecho**: director de presupuesto ([RENDIMIENTO.md](RENDIMIENTO.md)), optimización de
   colisiones y aparición por zonas ([OPTIMIZACION.md](OPTIMIZACION.md)) y **fps medidos en GPU real**
   ([MEDICIONES.md](MEDICIONES.md))

**Siguiente (alto valor, bajo riesgo)**
- Medir fps en 2–3 GPUs y ajustar presets.
- Modelar la fuente del parque en cuanto haya una foto de referencia.
- Peatones en andenes y en el parque; que la IA respete semáforos y prelación en cruces.
- Hitos: Alcaldía "La Chapolera", Terminal de Transportes, Villa Olímpica, Gemelas Danzantes.

**Después**
- Misiones sobre el GPS existente (carreras de taxi, entregas de café, rutas de chiva).
- Controles táctiles.
- Mover la construcción de tiles a un Web Worker.
- Pruebas unitarias del pipeline (`src/geo/`, fusión de edificios, segmentación de copas).

**Investigación**
- Alturas por edificio con Google Open Buildings 2.5D (requiere Earth Engine).
- Fachadas reales desde fotos a nivel de calle (Mapillary, CC BY-SA).
- Fuente satelital con licencia que permita guardarla en el repositorio (para jugar sin conexión).
- Multijugador por WebSocket (el estado del vehículo ya es serializable).
