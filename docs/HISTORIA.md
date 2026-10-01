# La historia de Pitalito en el juego

> Qué se sabe del pasado del municipio, con fuente, y **cómo lo aprende el jugador**: cada pieza de historia la
> entrega un personaje en el lugar donde ocurrió. Es el contenido de la Fase 7 de [PLAN_JUEGO.md](PLAN_JUEGO.md).
> Los datos viven en [`src/config/historia.config.js`](../src/config/historia.config.js).

## Regla de este documento

Igual que con los edificios: **nada se inventa si existe un dato**. Aquí conviven tres cosas y siempre se
distinguen:

| Marca | Qué es | Ejemplo |
|---|---|---|
| **Dato** | Está en la fuente citada, se transcribe literal o casi | «En 1912 fue elevada a la categoría de municipio» |
| **Tradición** | La fuente lo presenta como tradición popular, no como hecho probado | El origen del nombre por los pobladores de Pital |
| **Ficción** | Lo que añade el juego para poder jugarlo (un personaje, un objeto, un recorrido) | El arriero que cuenta lo de la quina y el caucho |

En el juego se distingue igual: la ficha que queda en el diario muestra el texto con su fuente; lo que dijo un
personaje inventado va en otro tono y no se cita como documento.

## Fuente

Instituto Geográfico Agustín Codazzi, Subdirección de Geografía y Cartografía (2019). *Nombres geográficos de
Colombia. Región Tolima Grande: datos pertinentes del proceso de apropiación y socialización del territorio.
Municipios de los departamentos de Huila y Tolima.* Imprenta Nacional de Colombia.
Consultada en el [Diccionario de Entidades Territoriales, ficha 41551](https://diccionario.igac.gov.co/entidades/ficha?mun=41551).

La clasificación de tipos de nombre se adapta de Salazar Quijada (1978); la de épocas, de Henao y Arrubla,
*Historia de Colombia*. La normalización de nombres geográficos la rige la **Ley 1447 de 2011, artículo 11**.

## Qué dice la fuente

**Pitalito es un topotopónimo**: su nombre viene de otro nombre de lugar. Familia lingüística y lengua
**quechua** — 11 de los 36 municipios documentados del Huila tienen nombre de familia quechua. La época del
nombre es **La Independencia** (1810-1819) y su jerarquía de origen, **pueblo de indios**.

**El nombre.** «Pita», en quechua, es «cabuya, agave, pita»; también «retoño, heredero» y «bocanada de tabaco».
Cerca están «p'ita» (saltar, impulso para brincar; paso de algo sin ser interrumpido; puntada larga en un
tejido), «pitay» (salto, caída de agua que se lanza; atravesar de un lado a otro sin interrupción), «p'iti»
(dividir; hebra o cuerda dividida) y «pitu» (unión, pareja). El sufijo «-ito» es español y aporta el diminutivo.
*Tradición popular:* los primeros habitantes venían de Santa Rosa de Lima del Pital —hoy municipio de Pital— y
al encontrar un lugar más pequeño lo llamaron Pitalito en honor a su procedencia.

**Seis nombres antes del actual:** La Chapa (1632), Los Laboyos (siglo XVII), San Juan de Laboyos (1692),
San Antonio de Laboyos (siglo XVIII), Pitalito de San Antonio (1834), Pitalito (sin fecha registrada).

**El proceso que formó el territorio**, en once hitos: los Andaquíes en las estribaciones del Macizo Colombiano
→ la llegada de los conquistadores desde el suroccidente y el repliegue hacia el Caquetá → la encomienda de La
Chapa, cerca de San Agustín → el caserío junto a la hacienda de San Juan de Laboyos → la viceparroquia de 1785 →
la bajada a la planicie de los ríos Guachicos y Guarapas → corregimiento en 1818 → Pitalito de San Antonio en
1834 → aldea en 1870 → municipio en 1912 → la economía de quina y caucho del siglo XX.

## Cómo lo aprende el jugador

No hay textos que se leen en un menú: **hay gente**. Cada hito lo entrega un personaje (un *cronista*) que está
en el lugar donde ocurrió y encarga algo que hacer allí. Al cumplir, el hito entra al **diario** con su texto y
su fuente, y se ilumina en la línea de tiempo.

**El patrón de misión**, igual para las once: *un personaje te manda a un sitio real → haces algo del juego
(llegar, buscar, pelear, construir, llevar a alguien) → vuelves → te cuenta el hito y queda registrado.*

| # | Hito | Dónde (lugar real del mundo) | Quién lo encarga (ficción) | Qué se hace |
|---|---|---|---|---|
| 1 | Los Andaquíes | Estribaciones y cerros del sur (Macizo) | La guaquera de Ingalí | Encontrar tres sitios altos con vista al valle |
| 2 | La llegada de los conquistadores | Camino al occidente (hacia San Agustín e Isnos) | El mismo | Recorrer el camino viejo de noche |
| 3 | La encomienda de La Chapa | Vía occidental, cerca del límite con San Agustín | El cura de la capilla | Llegar al sitio del caserío |
| 4 | San Juan de Laboyos | Zona rural de haciendas | El mayordomo | Reunir el ganado disperso |
| 5 | La viceparroquia (1785) | Iglesia y Torre San Antonio, Parque Principal | El sacristán | Tocar la campana a la hora exacta |
| 6 | La planicie de los ríos | Confluencia de Guachicos y Guarapas | El pescador | Seguir el río hasta la planicie |
| 7 | Corregimiento (1818) | Parque Principal José Hilario López | El escribano | Marcar las cuatro esquinas de la plaza |
| 8 | Pitalito de San Antonio (1834) | Centro histórico | La maestra | Encontrar los nombres viejos en las placas de calle |
| 9 | Aldea (1870) | Galería / plaza de mercado | La vendedora de la galería | Repartir encargos por el centro |
| 10 | Municipio (1912) | Alcaldía «La Chapolera» | El secretario | Llevar el acta desde la notaría |
| 11 | Quina y caucho | Fincas y trilladoras del entorno rural | El arriero | Llevar una carga por el camino de herradura |

**Misión aparte — el nombre.** Los seis nombres anteriores no son un hito: son una colección. Cada uno aparece
escrito en un sitio del mundo (una placa, una lápida, un dintel, un libro de la parroquia). Reunirlos los seis
abre la ficha del topónimo: qué es un topotopónimo, qué significa «pita» en quechua y por qué el diminutivo es
español. Es la lección de toponimia completa, aprendida buscando.

**Por qué así.** El jugador no memoriza fechas: camina el camino viejo, baja a la planicie donde se juntan los
ríos, toca la campana de 1785. El dato queda porque el lugar queda.

## Reglas de escritura para este contenido

1. El texto del hito en el diario es **el de la fuente**, o muy cerca. Si se resume, no se cambia el sentido.
2. Los personajes son ficción y se declaran como tal (`ficcion: true`); ninguno lleva nombre de una persona real.
3. Ningún hito obliga a pelear para conocerse: la historia no se cobra con combate.
4. Todo lugar de misión debe existir en los datos del mundo. Si no está, el hito espera — no se inventa el sitio.
5. El contenido del siglo XX y del conflicto se trata según la regla de [PLAN_JUEGO.md § 2](PLAN_JUEGO.md).

## Por confirmar

- Ubicación exacta del caserío de La Chapa (la fuente dice «cercano a San Agustín», sin coordenada).
- Dónde estaba la hacienda de San Juan de Laboyos.
- Fecha del nombre «Pitalito» a secas (la fuente la registra sin fecha).
- Fundación y diseño original de la plaza: falta fuente propia.
