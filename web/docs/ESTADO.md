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
| 2026-10-21 | Interfaz minimalista (`src/ui/guadua/minimal.css`): café espresso translúcido, filetes de guadua con nudos, verde solo como acento; Cormorant Garamond para títulos | La versión de culmos y esterilla se veía infantil. Quitar el `<link>` devuelve la anterior |
| 2026-10-21 | `powerLines: false` | Los postes estorbaban al caminar y su ubicación era estimada |
| 2026-10-23 | **Suelo:** los pisos levantados se pisan (`SolidWorld.addSurface`: rectángulo que sigue el relieve con alzado fijo). Adoquín del Parque Principal (+0,16 m), prados, andén de la catedral, gradas de la Concha Acústica y graderías de la Villa Olímpica y el Patinódromo (`solidFromBox` en frame.js). **Interacción por categorías** (`src/config/interaccion.config.js`: vehículo, hablar, recoger, puerta, asiento, info, edificio, bloque) con prioridad, preferencia por lo que está delante, giro hacia el objeto, gesto propio (empujar puertas, hablar en el trueque), sentarse y levantarse con sus clips sin deslizarse, glifo de categoría en el aviso; búsqueda a 10 Hz en vez de cada fotograma. Se quitó la ropa «arremangada» | Medido: los pies quedaban 16 cm bajo el adoquín. Las bandas de cuero de las mangas vienen en la pieza del torso y flotaban sobre el brazo desnudo |
| 2026-10-21 | Creador de personaje sin panel ni scroll: composición abierta alrededor del personaje (nombre e identidad arriba a la izquierda, columna de iconos, opciones a la derecha, acciones abajo como texto). Con iconos SVG (`src/ui/creatorIcons.js`, pintados con la piel y el pelo elegidos): un clic abre la categoría, otro la quita o la pone (pelo, barba, ropa, sombrero, capucha, hombrera; capucha y sombrero se excluyen). Más variedad sin modelos nuevos: 3 ropas combinadas, capucha y hombrera del paquete, 3 tonos de piel y 3 de pelo. Personajes guardados con nombre y modo (Settings → `personajes`); el oficio da el arma inicial y, en supervivencia, una mochila **estimada** que se entrega una vez | Pedido de la persona; de paso se arregló la ropa de camino del cuerpo A, que salía sin botas (`Male_Ranger_Feet` no existe: `PIEZAS_RENOMBRADAS`) |
| 2026-10-21 | Armas pulidas. Cuerpo a cuerpo: combos por arma con clips de la UAL2 (`ual2.glb`, antes `zombie.glb`: + Sword_Regular_A/B/C, Sword_Block, Melee_Hook, TreeChopping_Loop), remate ×1,45, clic guardado, bloqueo con `Sword_Block`; modelos rehechos (hoja de machete por perfil con bisel y filo, cachas con remaches, culmo de guadua con nudos y yemas, rejo trenzado). Fuego: pistola, escopeta, fusil y rifle pasan a Styloo «Guns Asset Pack» (CC0, textura + normales, texturas a 512 px JPG con Blender); mano izquierda al guardamanos por cinemática inversa; «listo bajo» en reposo; retroceso visible | No hay clips de fusil CC0 para el esqueleto; `Pistol_Aim_Down` apunta al suelo. Corregido además: el personaje nunca recibía `armed`, así que la guardia en reposo no se veía |
| 2026-10-21 | Corregido el siseo constante: el pulso de las chicharras (y el vaivén del viento) entraba directo al volumen y se sumaba al nivel, así que sonaban aunque el nivel fuera 0. Ahora el pulso va en su propia etapa | Medido con render offline: con nivel 0 sonaba a RMS 0,046 (≈ 29 veces el máximo previsto, 0,0016); ahora 0. El error venía de antes (iteración de las chicharras) |
| 2026-10-21 | Música cambiada a un tintineo de campanitas en bucle (arpegio de 16 pasos sobre 4 acordes, con silencios, notas que a veces se saltan); fuera el colchón de acordes y el bajo; viento al 25 % | «Un siseo constante»: los acordes sostenidos y el viento de ruido sonaban continuos |
| 2026-10-21 | Audio rehecho, sigue 100 % sintetizado: bus con paso bajo, compresor y reverberación generada; ondas redondas en vez de cuadradas o de sierra; el motor calla a pie; viento, pájaros de día y grillos; música generativa chill (`src/audio/Musica.js`: colchón de acordes, cuerda pulsada pentatónica con eco y grave) que cambia de día, de noche y en supervivencia; volumen de música aparte en Opciones | «Muy tosco»: el zumbido de sierra del motor sonaba siempre, incluso a pie, y los golpes eran ruido blanco sin cola |
| 2026-10-21 | Combate afinado: fijar con clic de rueda (la rueda cambia de blanco, al morir salta al siguiente, la cámara sigue libre y las armas de fuego apuntan solas al blanco), barra de vida del blanco, empuje al golpear (impulso aparte que se apaga en ≈ 0,4 s), cuerpos que no se atraviesan, sangre (partículas + manchas en el suelo). Armas de fuego en el arsenal con munición infinita **sólo para pruebas** (`PRUEBAS` en firearms.config.js) | Pedido tras ver la horda metida dentro del jugador; medido: escopetazo empuja 0,81 m, dos zombis superpuestos quedan a 0,66 m |
| 2026-10-21 | Armas de fuego con las animaciones de pistola del paquete para todas (no hay clips de fusil CC0 para este esqueleto); los NPC disparan con el mismo sistema y las paredes cortan el tiro. Bases de supervivientes ficticias en lugares reales abiertos (Plaza Minorista, Plaza Cívica, Terminal, Zona Industrial), evitando a propósito la cárcel y los cuarteles reales | Mismo código para todos los tiradores; medido: 5 saqueadores tumbaban al jugador quieto en 10 s, se bajó puntería, daño (×0,55) y se añadió 1,2 s de reacción |
| 2026-10-21 | Necesidades de supervivencia guardadas con la mochila y refugios en iglesias y CAI reales; al caer se reaparece en el último refugio con media mochila | Castigo que obliga a volver por lo perdido sin borrar la partida; los refugios dan sentido a construir |
| 2026-10-21 | Horda con impostores horneados en el navegador (atlas 8 ángulos × 8 instantes del mismo zombi), no con animación en textura de vértices | Un zombi completo son ≈ 28 000 triángulos: 140 serían 4 M. El impostor son 2 triángulos y 1 draw call por tipo, sin paso extra en el pipeline; de cerca se cambia por el completo |
| 2026-10-21 | Botín de supervivencia junto a los lugares reales de OSM (no dentro: los edificios no tienen interior), con contenido sembrado por id de contenedor y saqueo persistente; mochila por peso (I) | Determinista y guardado: un hospital vaciado sigue vacío, y el mismo lugar da lo mismo en cualquier máquina |
| 2026-10-21 | **Modo supervivencia** aparte del de historia (botón «Modo» del menú, `src/config/survival.config.js`): zombis caminante/corredor/hinchado con clips de la UAL2 (CC0), más cupo de noche y cerca de hospitales, CAI e iglesias reales de OSM; tráfico al 12 %; sin facciones | Pedido de convertirlo en survival de looteo; se deja como modo para no perder la historia. Pendiente: loot en lugares reales, inventario, hordas instanciadas, supervivencia, NPC supervivientes |
| 2026-10-21 | En la moto, el personaje propio va a horcajadas: `Driving_Loop` + retoque de columna + cinemática inversa de dos huesos (`src/entities/skinning/ik.js`) que clava manos al manubrio y pies a los pedales (`POSTURAS.moto` en vehicles.config.js). Subir/bajar por la izquierda pasando la pierna derecha | El paquete sólo trae la postura de carro; el vehículo del jugador ya nunca lleva el muñeco de cajas (el cambio rápido de vehículo lo dejaba puesto) |
| 2026-10-21 | **Iglesia San Antonio recorrible**: atrio elevado en damero, fachada de tres cuerpos con festón, portón de madera que se abre y cierra con E (cerrado bloquea a todos: sirve de base), nave de tres naves con bóveda, bancas y presbiterio, y Torre con escalera interior hasta el campanario (24 m). Nueva capa `SolidWorld` (cajas 3D) sumada a las consultas de `BlockWorld`; muros 2D con huecos en las puertas. Nave más alta (17,5 m) | Pedido del usuario con fotos reales; la colisión 2D sola no permitía pisos ni escaleras. Verificado con recorridos simulados: puerta cerrada no deja pasar, la escalera sube 1,2 m por tramo hasta 24 m y desde los vanos no se cae; 598 draw calls / 850 k triángulos mirando la ciudad desde la torre |
| 2026-10-23 | Iglesia, segunda pasada con Street View de la Calle 5: torre adelantada 3 m fuera de la línea de la nave y despegada 3,5 m de la fachada; portada lateral con puerta que se abre (tercera puerta); ventanas pareadas y contrafuertes; las puertas se accionan desde adentro (para encerrarse). Corregido: los arcos (`arch`) y el festón tenían la media luna hacia abajo, escondida. Ladrillo a la vista a la mitad de tamaño (afecta también Coliseo, Concha y recintos) | Fotos del usuario. Verificado con recorridos: las tres puertas bloquean cerradas y dejan pasar abiertas; la torre sigue subiendo a 24 m; 566 draw calls / 854 k triángulos |
| 2026-10-23 | Iglesia, pulido: zócalo de ladrillo ennegrecido (material `exposedBrickOld`) que ya no tapa las puertas; fondo con contrafuertes, puerta en arco y escalones hasta el relieve real; las hojas abiertas de las puertas son pared (no se atraviesan); hojas fundidas en una malla y un solo material para los cuatro relojes | Revisión con capturas desde siete ángulos. La iglesia pasó de 41 a 29 mallas (draw calls) con más detalle |
| 2026-10-23 | Alcaldía La Chapolera rehecha con Street View: la esquina Cra. 3 / Cl. 5 se ubica por el nombre real de las vías; podio caminable (escalinata, rampa y barandas como sólidos 3D), letrero con el texto real y escudo, materiales nuevos (piedra veteada, pizarra, muro cortina, baranda de vidrio, flor de guayacán) | Pedido del usuario. Verificado: se sube la escalinata a 3,6 m, la baranda impide caer y la rampa baja al andén |
| 2026-10-23 | **Atmósfera por horas** (`src/config/atmosphere.config.js`): fotogramas de cielo, niebla, color del sol, exposición y gradación interpolados por hora; neblina matinal densa de 5:30 a 10:00 que se levanta; tarde dorada y atardecer rojizo (17:00–18:30) con virado partido y halo de bloom; hora azul. Niebla de altura (se reescribe el trozo `fog` de three: integra la densidad a lo largo del rayo), horizonte del cielo velado con el color de la niebla, y dos familias nuevas de partículas: `bruma` (jirones a ras de suelo) y `motas` (polvo que toma el color del sol) | Pedido del usuario: un mundo más atmosférico. Todo es estético y declarado como estimado; cero draw calls extra salvo las dos familias de partículas (1 cada una) |
| 2026-10-23 | **El repo se divide en `web/` y `godot/`**; la web conserva el pipeline de datos y Godot sincroniza su salida | Versión Godot 4.7 con física, hilos, animación y LOD nativos (ver godot/docs/ARQUITECTURA.md); un solo pipeline evita datos divergentes |
| 2026-10-23 | Godot alcanza el mundo de la web; **lo que la web construye por código se hornea** (`tools/bake-godot.mjs`: texturas procedurales a PNG, vehículos e hitos a GLB) en vez de reescribirse. Las bisagras de las puertas de la Catedral llevan nombre para que Godot las anime | Una sola fuente para modelos y dibujos: un retoque en la web llega a Godot al sincronizar. Ver godot/docs/ARQUITECTURA.md |
| 2026-10-23 | Godot: **edificios cercanos armados con el Building Kit y el Furniture Kit de Kenney (CC0)** sobre las huellas reales, con estilos variados y casas recorribles (entrepisos, escalera, muebles). Entran por `scripts/fetch-characters.mjs` con su licencia; la web no los usa todavía | El usuario: "casas más variadas… que se puedan recorrer por dentro… con diferentes plantas", no la caja con el mismo atlas |
| 2026-10-23 | Catedral: el zócalo lateral cruzaba el vano de la puerta de la Calle 5 (no dejaba pasar) y había un hueco entre la fachada y el hastial. Alcaldía recorrible: salón de atención (ventanillas, bancas) y vestíbulo (recepción, escudo), con marcadores de luz y de acceso para Godot; el panel blanco suelto junto al letrero pasa a franja de esquina. Godot: reglas constructivas en los interiores (alturas, escalera de mampostería, altura libre, barandas) | Fotos del usuario: bloque en la puerta lateral, panel blanco, "el techo debería ser más alto… principios físicos y estructurales" |
| 2026-10-23 | **Coliseo Cubierto rehecho y recorrible** con las capturas de Street View del usuario (2014 y 2025): planta de puntas (hexágono OSM), cubierta asimétrica con claraboya, fachada de galerías al norte (pilares blancos, antepechos de ladrillo, mural), puntas de ladrillo con ventanitas y ranura de escalera, entrada oeste con gradería, graderías en herradura con pasillos amarillos, cancha demarcada, cerchas; plaza con monumento y marquesina. Alturas y orientación ESTIMADAS (ver cabecera del módulo) | El usuario pasó referencias: "vamos por estructuras" |
| 2026-10-23 | Godot: **ríos completos** (Guarapas 40 km, Cálamo…) desde map.json con shader de agua turbia y física de flotación propia sobre Jolt (jugador nada, cuerpos y carros flotan y derivan). FluidNinja descartado: es de Unreal, sin Linux ni Godot | Pedido del usuario: "el río debe ser toda la línea azul que atraviesa Pitalito… físicas libres" |
| 2026-10-23 | Godot: **puentes en los 14 cruces vía–río** (Libertador y Pastrana sobre el Guarapas) con baranda amarilla y negra, rampas y colisión; el tráfico pasa por encima. Pasarela peatonal estimada aguas arriba del Libertador | Foto del usuario desde la Carrera 3; con el agua 0,5 m sobre el cauce las calles quedaban bajo el agua |
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
| 2026-10-21 | Interfaz minimalista (`src/ui/guadua/minimal.css`): café espresso translúcido, filetes de guadua con nudos, verde solo como acento; Cormorant Garamond para títulos | La versión de culmos y esterilla se veía infantil. Quitar el `<link>` devuelve la anterior |
| 2026-10-21 | `powerLines: false` | Los postes estorbaban al caminar y su ubicación era estimada |
| 2026-10-23 | **Suelo:** los pisos levantados se pisan (`SolidWorld.addSurface`: rectángulo que sigue el relieve con alzado fijo). Adoquín del Parque Principal (+0,16 m), prados, andén de la catedral, gradas de la Concha Acústica y graderías de la Villa Olímpica y el Patinódromo (`solidFromBox` en frame.js). **Interacción por categorías** (`src/config/interaccion.config.js`: vehículo, hablar, recoger, puerta, asiento, info, edificio, bloque) con prioridad, preferencia por lo que está delante, giro hacia el objeto, gesto propio (empujar puertas, hablar en el trueque), sentarse y levantarse con sus clips sin deslizarse, glifo de categoría en el aviso; búsqueda a 10 Hz en vez de cada fotograma. Se quitó la ropa «arremangada» | Medido: los pies quedaban 16 cm bajo el adoquín. Las bandas de cuero de las mangas vienen en la pieza del torso y flotaban sobre el brazo desnudo |
| 2026-10-21 | Creador de personaje sin panel ni scroll: composición abierta alrededor del personaje (nombre e identidad arriba a la izquierda, columna de iconos, opciones a la derecha, acciones abajo como texto). Con iconos SVG (`src/ui/creatorIcons.js`, pintados con la piel y el pelo elegidos): un clic abre la categoría, otro la quita o la pone (pelo, barba, ropa, sombrero, capucha, hombrera; capucha y sombrero se excluyen). Más variedad sin modelos nuevos: 3 ropas combinadas, capucha y hombrera del paquete, 3 tonos de piel y 3 de pelo. Personajes guardados con nombre y modo (Settings → `personajes`); el oficio da el arma inicial y, en supervivencia, una mochila **estimada** que se entrega una vez | Pedido de la persona; de paso se arregló la ropa de camino del cuerpo A, que salía sin botas (`Male_Ranger_Feet` no existe: `PIEZAS_RENOMBRADAS`) |
| 2026-10-21 | Armas pulidas. Cuerpo a cuerpo: combos por arma con clips de la UAL2 (`ual2.glb`, antes `zombie.glb`: + Sword_Regular_A/B/C, Sword_Block, Melee_Hook, TreeChopping_Loop), remate ×1,45, clic guardado, bloqueo con `Sword_Block`; modelos rehechos (hoja de machete por perfil con bisel y filo, cachas con remaches, culmo de guadua con nudos y yemas, rejo trenzado). Fuego: pistola, escopeta, fusil y rifle pasan a Styloo «Guns Asset Pack» (CC0, textura + normales, texturas a 512 px JPG con Blender); mano izquierda al guardamanos por cinemática inversa; «listo bajo» en reposo; retroceso visible | No hay clips de fusil CC0 para el esqueleto; `Pistol_Aim_Down` apunta al suelo. Corregido además: el personaje nunca recibía `armed`, así que la guardia en reposo no se veía |
| 2026-10-21 | Corregido el siseo constante: el pulso de las chicharras (y el vaivén del viento) entraba directo al volumen y se sumaba al nivel, así que sonaban aunque el nivel fuera 0. Ahora el pulso va en su propia etapa | Medido con render offline: con nivel 0 sonaba a RMS 0,046 (≈ 29 veces el máximo previsto, 0,0016); ahora 0. El error venía de antes (iteración de las chicharras) |
| 2026-10-21 | Música cambiada a un tintineo de campanitas en bucle (arpegio de 16 pasos sobre 4 acordes, con silencios, notas que a veces se saltan); fuera el colchón de acordes y el bajo; viento al 25 % | «Un siseo constante»: los acordes sostenidos y el viento de ruido sonaban continuos |
| 2026-10-21 | Audio rehecho, sigue 100 % sintetizado: bus con paso bajo, compresor y reverberación generada; ondas redondas en vez de cuadradas o de sierra; el motor calla a pie; viento, pájaros de día y grillos; música generativa chill (`src/audio/Musica.js`: colchón de acordes, cuerda pulsada pentatónica con eco y grave) que cambia de día, de noche y en supervivencia; volumen de música aparte en Opciones | «Muy tosco»: el zumbido de sierra del motor sonaba siempre, incluso a pie, y los golpes eran ruido blanco sin cola |
| 2026-10-21 | Combate afinado: fijar con clic de rueda (la rueda cambia de blanco, al morir salta al siguiente, la cámara sigue libre y las armas de fuego apuntan solas al blanco), barra de vida del blanco, empuje al golpear (impulso aparte que se apaga en ≈ 0,4 s), cuerpos que no se atraviesan, sangre (partículas + manchas en el suelo). Armas de fuego en el arsenal con munición infinita **sólo para pruebas** (`PRUEBAS` en firearms.config.js) | Pedido tras ver la horda metida dentro del jugador; medido: escopetazo empuja 0,81 m, dos zombis superpuestos quedan a 0,66 m |
| 2026-10-21 | Armas de fuego con las animaciones de pistola del paquete para todas (no hay clips de fusil CC0 para este esqueleto); los NPC disparan con el mismo sistema y las paredes cortan el tiro. Bases de supervivientes ficticias en lugares reales abiertos (Plaza Minorista, Plaza Cívica, Terminal, Zona Industrial), evitando a propósito la cárcel y los cuarteles reales | Mismo código para todos los tiradores; medido: 5 saqueadores tumbaban al jugador quieto en 10 s, se bajó puntería, daño (×0,55) y se añadió 1,2 s de reacción |
| 2026-10-21 | Necesidades de supervivencia guardadas con la mochila y refugios en iglesias y CAI reales; al caer se reaparece en el último refugio con media mochila | Castigo que obliga a volver por lo perdido sin borrar la partida; los refugios dan sentido a construir |
| 2026-10-21 | Horda con impostores horneados en el navegador (atlas 8 ángulos × 8 instantes del mismo zombi), no con animación en textura de vértices | Un zombi completo son ≈ 28 000 triángulos: 140 serían 4 M. El impostor son 2 triángulos y 1 draw call por tipo, sin paso extra en el pipeline; de cerca se cambia por el completo |
| 2026-10-21 | Botín de supervivencia junto a los lugares reales de OSM (no dentro: los edificios no tienen interior), con contenido sembrado por id de contenedor y saqueo persistente; mochila por peso (I) | Determinista y guardado: un hospital vaciado sigue vacío, y el mismo lugar da lo mismo en cualquier máquina |
| 2026-10-21 | **Modo supervivencia** aparte del de historia (botón «Modo» del menú, `src/config/survival.config.js`): zombis caminante/corredor/hinchado con clips de la UAL2 (CC0), más cupo de noche y cerca de hospitales, CAI e iglesias reales de OSM; tráfico al 12 %; sin facciones | Pedido de convertirlo en survival de looteo; se deja como modo para no perder la historia. Pendiente: loot en lugares reales, inventario, hordas instanciadas, supervivencia, NPC supervivientes |
| 2026-10-21 | En la moto, el personaje propio va a horcajadas: `Driving_Loop` + retoque de columna + cinemática inversa de dos huesos (`src/entities/skinning/ik.js`) que clava manos al manubrio y pies a los pedales (`POSTURAS.moto` en vehicles.config.js). Subir/bajar por la izquierda pasando la pierna derecha | El paquete sólo trae la postura de carro; el vehículo del jugador ya nunca lleva el muñeco de cajas (el cambio rápido de vehículo lo dejaba puesto) |
| 2026-10-21 | **Iglesia San Antonio recorrible**: atrio elevado en damero, fachada de tres cuerpos con festón, portón de madera que se abre y cierra con E (cerrado bloquea a todos: sirve de base), nave de tres naves con bóveda, bancas y presbiterio, y Torre con escalera interior hasta el campanario (24 m). Nueva capa `SolidWorld` (cajas 3D) sumada a las consultas de `BlockWorld`; muros 2D con huecos en las puertas. Nave más alta (17,5 m) | Pedido del usuario con fotos reales; la colisión 2D sola no permitía pisos ni escaleras. Verificado con recorridos simulados: puerta cerrada no deja pasar, la escalera sube 1,2 m por tramo hasta 24 m y desde los vanos no se cae; 598 draw calls / 850 k triángulos mirando la ciudad desde la torre |
| 2026-10-23 | Iglesia, segunda pasada con Street View de la Calle 5: torre adelantada 3 m fuera de la línea de la nave y despegada 3,5 m de la fachada; portada lateral con puerta que se abre (tercera puerta); ventanas pareadas y contrafuertes; las puertas se accionan desde adentro (para encerrarse). Corregido: los arcos (`arch`) y el festón tenían la media luna hacia abajo, escondida. Ladrillo a la vista a la mitad de tamaño (afecta también Coliseo, Concha y recintos) | Fotos del usuario. Verificado con recorridos: las tres puertas bloquean cerradas y dejan pasar abiertas; la torre sigue subiendo a 24 m; 566 draw calls / 854 k triángulos |
| 2026-10-23 | Iglesia, pulido: zócalo de ladrillo ennegrecido (material `exposedBrickOld`) que ya no tapa las puertas; fondo con contrafuertes, puerta en arco y escalones hasta el relieve real; las hojas abiertas de las puertas son pared (no se atraviesan); hojas fundidas en una malla y un solo material para los cuatro relojes | Revisión con capturas desde siete ángulos. La iglesia pasó de 41 a 29 mallas (draw calls) con más detalle |
| 2026-10-23 | Alcaldía La Chapolera rehecha con Street View: la esquina Cra. 3 / Cl. 5 se ubica por el nombre real de las vías; podio caminable (escalinata, rampa y barandas como sólidos 3D), letrero con el texto real y escudo, materiales nuevos (piedra veteada, pizarra, muro cortina, baranda de vidrio, flor de guayacán) | Pedido del usuario. Verificado: se sube la escalinata a 3,6 m, la baranda impide caer y la rampa baja al andén |
| 2026-10-23 | **Atmósfera por horas** (`src/config/atmosphere.config.js`): fotogramas de cielo, niebla, color del sol, exposición y gradación interpolados por hora; neblina matinal densa de 5:30 a 10:00 que se levanta; tarde dorada y atardecer rojizo (17:00–18:30) con virado partido y halo de bloom; hora azul. Niebla de altura (se reescribe el trozo `fog` de three: integra la densidad a lo largo del rayo), horizonte del cielo velado con el color de la niebla, y dos familias nuevas de partículas: `bruma` (jirones a ras de suelo) y `motas` (polvo que toma el color del sol) | Pedido del usuario: un mundo más atmosférico. Todo es estético y declarado como estimado; cero draw calls extra salvo las dos familias de partículas (1 cada una) |
| 2026-10-23 | **Más variedad en el tráfico** con el Kenney Car Kit 3.1 (CC0, `pnpm models:fetch` → `public/models/vehicles/`): automóvil, campero, van, camioneta, furgón, recolector de basura y ambulancia (`src/entities/vehicles/models/kenney.js`). Cada eje se escala a medidas reales **estimadas** (el kit es de juguete); la pintura se cambia moviendo las UV de la carrocería a otra muestra del atlas de paleta (`PALETA_KENNEY`), sin texturas ni materiales extra. Sólo tráfico: no tienen interior. **Chiva detallada** con las fotos de referencia: techo abombado de lona, parrilla de tubo con parales, tubo de escape vertical, parabrisas partido bajo visera pintada, espejos de brazo, faros de techo, parachoques pintado, guardapolvos y rueda doble atrás | Pedido del usuario. Descartados del kit: karts, carros de carreras, patrulla (institución real), bomberos y tractor. No hay paquete CC0 de motos que sirva: las motos siguen siendo procedurales. Medido: carro Kenney 6 mallas / 2–3 k triángulos (el taxi son 13); chiva de tráfico 13 mallas, dentro del tope de 14 |

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
