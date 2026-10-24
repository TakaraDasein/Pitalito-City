// Historia y toponimia de Pitalito: el contenido que el jugador aprende jugando.
//
// Fuente única de este archivo:
//   IGAC, Subdirección de Geografía y Cartografía (2019). «Nombres geográficos de Colombia. Región Tolima Grande:
//   datos pertinentes del proceso de apropiación y socialización del territorio. Municipios de los departamentos
//   de Huila y Tolima». Imprenta Nacional de Colombia.
//   Consultado en el Diccionario de Entidades Territoriales, ficha 41551:
//   https://diccionario.igac.gov.co/entidades/ficha?mun=41551
//   La clasificación de tipos de nombre se adapta de Salazar Quijada (1978); la de épocas, de Henao y Arrubla,
//   «Historia de Colombia». La normalización de nombres la rige la Ley 1447 de 2011, artículo 11.
//
// Nada de este archivo es inventado. Lo que el juego añada por encima (un personaje que lo cuenta, un objeto que
// se recoge) va marcado como `ficcion: true` y se declara en docs/HISTORIA.md.

// Las épocas con que el IGAC fecha el surgimiento de un nombre.
export const EPOCAS = [
  { id: 'conquista', nombre: 'Descubrimiento y Conquista', desde: 1492, hasta: 1550 },
  { id: 'colonia', nombre: 'La Colonia', desde: 1550, hasta: 1810 },
  { id: 'independencia', nombre: 'La Independencia', desde: 1810, hasta: 1819 },
  { id: 'republica', nombre: 'La República', desde: 1819, hasta: null, subperiodos: [
    { nombre: 'La Gran Colombia', desde: 1819, hasta: 1831 },
    { nombre: 'La Nueva Granada', desde: 1832, hasta: 1858 },
    { nombre: 'La Confederación Granadina', desde: 1858, hasta: 1861 },
    { nombre: 'Los Estados Unidos de Colombia', desde: 1862, hasta: 1886 },
    { nombre: 'La República de Colombia', desde: 1886, hasta: null },
  ] },
];

// Las trece motivaciones para nombrar un lugar (cuadro 1 del estudio).
export const TIPOS_DE_NOMBRE = {
  fisiotoponimo: { nombre: 'Fisiotopónimo', que: 'Las características naturales o la forma del relieve.', ejemplos: 'Entrerríos, Sabaneta' },
  zootoponimo: { nombre: 'Zootopónimo', que: 'La fauna del lugar.', ejemplos: 'El Bagre, Abejorral' },
  fitotoponimo: { nombre: 'Fitotopónimo', que: 'Las plantas y la vegetación.', ejemplos: 'Heliconia, Cañasgordas' },
  minerotoponimo: { nombre: 'Minerotopónimo', que: 'Los minerales y materiales inorgánicos.', ejemplos: 'Marmato' },
  epotoponimo: { nombre: 'Epotopónimo', que: 'Un prócer o un hecho histórico.', ejemplos: 'Bello, Caldas' },
  hagiotoponimo: { nombre: 'Hagiotopónimo', que: 'Santos, costumbres y creencias religiosas.', ejemplos: 'San José, Santa Bárbara' },
  somatoponimo: { nombre: 'Somatopónimo', que: 'Partes del cuerpo aplicadas al terreno.', ejemplos: 'La Ceja, Dolores' },
  animotoponimo: { nombre: 'Animotopónimo', que: 'Los estados de ánimo.', ejemplos: 'Campoalegre' },
  cognomotoponimo: { nombre: 'Cognomotopónimo', que: 'Apellidos, apodos y comunidades que habitaron el territorio.', ejemplos: 'Cisneros, Gómez Plata' },
  pragmatoponimo: { nombre: 'Pragmatopónimo', que: 'Hechos cotidianos, oficios y obras civiles.', ejemplos: 'Campamento, Puerto Berrío' },
  topotoponimo: { nombre: 'Topotopónimo', que: 'Otro nombre de lugar, aquí o en el mundo.', ejemplos: 'Amalfi, Florencia' },
  mitotoponimo: { nombre: 'Mitotopónimo', que: 'Mitos, leyendas y cosmovisión.', ejemplos: 'Abriquí, Amazonas' },
  onomatoponimo: { nombre: 'Onomatopónimo', que: 'Nombres de personas, incluidos los caciques indígenas.', ejemplos: 'Buriticá, Guarne' },
};

// Ficha toponímica del municipio.
export const TOPONIMIA = {
  nombre: 'Pitalito',
  tipo: 'topotoponimo',
  familiaLinguistica: 'Quechua',
  lengua: 'Quechua',
  epoca: 'independencia',
  jerarquiaDeOrigen: 'Pueblo de indios',
  norma: 'En 1912 fue elevada a la categoría de municipio',
  zonaDepartamento: 'Sur',
  municipiosQuechuaEnHuila: 11,   // de 36 documentados
  tradicionPopular:
    'La tradición popular dice que los primeros habitantes de ese sitio habían llegado originarios de Santa Rosa ' +
    'de Lima del Pital, hoy municipio de Pital, y al encontrar un lugar de dimensiones más pequeñas, en honor a ' +
    'su lugar de procedencia decidieron llamarlo Pitalito.',
  significado:
    'Se plantea que «pitalito» contiene un elemento propio de la lengua quechua en el término «pita», que significa ' +
    '«cabuya, agave, pita». En quechua «pita» también representa «retoño, heredero» y «bocanada de tabaco»; ' +
    '«p\'ita», «saltar, impulso para brincar», «paso de algo sin ser interrumpido», «puntada larga en un tejido»; ' +
    '«pitay», «salto, caída de agua que se lanza», «atravesar de un lado a otro sin interrupción»; «p\'iti», ' +
    '«dividir», «hebra o cuerda dividida», «hilaza, cedazo, hilo dividido»; «pitu», «unión, pareja». También ' +
    '«pita», «hilo delgado», y «la», «lugar» (vocablo «pitala»). El sufijo «-ito/-ita», propio del español, aporta ' +
    'el valor semántico de diminutivo.',
};

// Los seis nombres que tuvo el lugar antes, con el año en que aparecen.
export const NOMBRES_ANTERIORES = [
  { nombre: 'La Chapa', anio: 1632, fecha: '1632' },
  { nombre: 'San Juan de Laboyos', anio: 1692, fecha: '1692' },
  { nombre: 'Los Laboyos', anio: 1650, fecha: 'Siglo XVII' },
  { nombre: 'San Antonio de Laboyos', anio: 1750, fecha: 'Siglo XVIII' },
  { nombre: 'Pitalito de San Antonio', anio: 1834, fecha: '1834' },
  { nombre: 'Pitalito', anio: null, fecha: 'sin fecha registrada' },
];

// Proceso que formó el territorio, partido en hitos fechados para que cada uno sea una misión.
export const HITOS_HISTORICOS = [
  {
    id: 'andaquies',
    epoca: 'conquista',
    anio: null,
    titulo: 'Los Andaquíes',
    texto:
      'El territorio estuvo habitado por indígenas Andaquíes, localizados en las estribaciones del Macizo ' +
      'Colombiano. El medio geográfico y la riqueza hídrica favorecieron la dieta y las actividades cotidianas ' +
      'relacionadas con la pesca y la caza; los pobladores tenían conocimiento en hilados de algodón y metalurgia.',
  },
  {
    id: 'conquista',
    epoca: 'conquista',
    anio: null,
    titulo: 'La llegada de los conquistadores',
    texto:
      'A la llegada de los conquistadores a la región, provenientes del suroccidente, se dio inicio a las luchas ' +
      'por el control territorial, y los Andaquíes fueron replegados hacia las selvas al otro lado de la ' +
      'cordillera Oriental (Caquetá).',
  },
  {
    id: 'la-chapa',
    epoca: 'colonia',
    anio: 1632,
    titulo: 'La encomienda de La Chapa',
    texto:
      'Durante La Colonia los españoles dispusieron una encomienda en el caserío denominado La Chapa, cercano a ' +
      'San Agustín. Es el primer nombre registrado del lugar: 1632.',
  },
  {
    id: 'san-juan-de-laboyos',
    epoca: 'colonia',
    anio: 1692,
    titulo: 'El caserío de San Juan de Laboyos',
    texto:
      'Con el crecimiento de la población en inmediaciones de la hacienda de San Juan de Laboyos surgió un ' +
      'caserío con el mismo nombre de la hacienda.',
  },
  {
    id: 'viceparroquia',
    epoca: 'colonia',
    anio: 1785,
    titulo: 'La viceparroquia',
    texto:
      'A mediados del siglo XVIII se solicitó el nombramiento de viceparroquia, aceptado en 1785. En los censos ' +
      'de población hechos en San Agustín se constató que el mayor número de pobladores lo tenía San Juan de Laboyos.',
  },
  {
    id: 'san-antonio-de-laboyos',
    epoca: 'colonia',
    anio: 1790,
    titulo: 'Bajar a la planicie de los ríos',
    texto:
      'Las condiciones climáticas y la riqueza de los suelos motivaron a los pobladores a ubicarse en la planicie ' +
      'que forman los ríos Guachicos y Guarapas, organizando un lugar con el nombre de San Antonio de Laboyos.',
    lugar: 'planicie de los ríos Guachicos y Guarapas',
  },
  {
    id: 'corregimiento',
    epoca: 'independencia',
    anio: 1818,
    titulo: 'Pitalito, corregimiento',
    texto:
      'Con la construcción de viviendas y la expansión del poblado, en 1818 fue denominado Pitalito como ' +
      'corregimiento. Es la época en que surge el nombre que lleva hoy.',
  },
  {
    id: 'pitalito-de-san-antonio',
    epoca: 'republica',
    anio: 1834,
    titulo: 'Pitalito de San Antonio',
    texto: 'Para 1834 se le conocía con el nombre de Pitalito de San Antonio.',
  },
  {
    id: 'aldea',
    epoca: 'republica',
    anio: 1870,
    titulo: 'Aldea',
    texto: 'En 1870 era una aldea.',
  },
  {
    id: 'municipio',
    epoca: 'republica',
    anio: 1912,
    titulo: 'Municipio',
    texto: 'En 1912 fue elevada a la categoría de municipio.',
  },
  {
    id: 'quina-y-caucho',
    epoca: 'republica',
    anio: 1900,
    titulo: 'Quina y caucho',
    texto:
      'En el siglo XX cambió el uso del suelo: las haciendas que durante el periodo colonial fueron ganaderas y ' +
      'agrícolas pasaron a hacer parte de una economía extractiva de quina y caucho, apoyada por el auge de las ' +
      'explotaciones en el Caquetá y el Putumayo.',
  },
];

export const FUENTE_HISTORIA = {
  cita:
    'Instituto Geográfico Agustín Codazzi, Subdirección de Geografía y Cartografía (2019). Nombres geográficos de ' +
    'Colombia. Región Tolima Grande. Imprenta Nacional de Colombia.',
  url: 'https://diccionario.igac.gov.co/entidades/ficha?mun=41551',
};
