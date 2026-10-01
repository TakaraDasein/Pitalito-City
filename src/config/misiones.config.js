// Las misiones de historia: dónde está cada cronista y qué encarga.
//
// El contenido histórico (épocas, nombres, hitos) está en `historia.config.js` y **sale todo de la fuente**
// (IGAC, 2019 — ver docs/HISTORIA.md). Aquí sólo se decide **lo jugable**: en qué punto del mundo está el
// personaje que lo cuenta y qué hay que hacer para que lo cuente.
//
// Regla propia (docs/HISTORIA.md): **ningún hito se cobra con combate**. La historia no se gana peleando.
//
// Los cronistas son ficción declarada; ninguno lleva nombre de una persona real.
//
// Coordenadas del mundo: metros, +X este, −Z norte, origen en el Parque Principal.

export const MISIONES_ACTIVAS = true;

/**
 * Cada misión:
 *   hito      id en HITOS_HISTORICOS (de ahí sale el texto con su fuente)
 *   cronista  quién lo encarga — ficción
 *   x, z      dónde está, en el mundo
 *   encargo   qué pide, en una línea
 *   objetivo  { tipo, ... } lo que hay que cumplir:
 *               'llegar'   acercarse a un punto
 *               'visitar'  tocar varios puntos, en cualquier orden
 *               'hora'     estar allí a cierta hora
 *               'buscar'   encontrar un objeto suelto cerca
 */
export const MISIONES = [
  {
    hito: 'corregimiento', cronista: 'El escribano', x: 0, z: 0,
    encargo: 'Marca las cuatro esquinas de la plaza, como se hizo cuando esto fue corregimiento.',
    objetivo: { tipo: 'visitar', puntos: [[-46, -46], [46, -46], [46, 46], [-46, 46]], radio: 12 },
  },
  {
    hito: 'viceparroquia', cronista: 'El sacristán', x: 18, z: -52,
    encargo: 'Toca la campana a la hora en punto de la tarde, como en la viceparroquia de 1785.',
    objetivo: { tipo: 'hora', x: 18, z: -58, radio: 10, desde: 17, hasta: 19 },
  },
  {
    hito: 'pitalito-de-san-antonio', cronista: 'La maestra', x: -60, z: 70,
    encargo: 'Busca en las placas de calle los nombres que tuvo el pueblo antes de llamarse así.',
    objetivo: { tipo: 'visitar', puntos: [[-150, 120], [120, 180], [-210, -90]], radio: 25 },
  },
  {
    hito: 'aldea', cronista: 'La vendedora de la galería', x: 150, z: 120,
    encargo: 'Reparte estos encargos por el centro, como cuando esto era una aldea de 1870.',
    objetivo: { tipo: 'visitar', puntos: [[230, 60], [60, 250], [-120, 190]], radio: 18 },
  },
  {
    hito: 'municipio', cronista: 'El secretario', x: -40, z: 30,
    encargo: 'Lleva el acta hasta la Alcaldía: en 1912 esto dejó de ser aldea.',
    objetivo: { tipo: 'llegar', x: -36, z: 24, radio: 10 },
  },
  {
    hito: 'san-antonio-de-laboyos', cronista: 'El pescador', x: 620, z: 540,
    encargo: 'Sigue el agua hasta la planicie donde se juntan el Guachicos y el Guarapas.',
    objetivo: { tipo: 'llegar', x: 980, z: 900, radio: 45 },
  },
  {
    hito: 'san-juan-de-laboyos', cronista: 'El mayordomo', x: 1375, z: 625,
    encargo: 'Reúne el ganado disperso del potrero, donde estuvo la hacienda.',
    objetivo: { tipo: 'visitar', puntos: [[1300, 700], [1450, 560], [1250, 520]], radio: 25 },
  },
  {
    hito: 'quina-y-caucho', cronista: 'El arriero', x: -875, z: -125,
    encargo: 'Lleva la carga por el camino de herradura, como cuando se sacaba quina y caucho.',
    objetivo: { tipo: 'visitar', puntos: [[-1100, -300], [-1400, -200], [-1250, 100]], radio: 35 },
  },
  {
    hito: 'la-chapa', cronista: 'El cura de la capilla', x: -1500, z: 400,
    encargo: 'Llega hasta donde estuvo el caserío de La Chapa, camino de San Agustín.',
    objetivo: { tipo: 'llegar', x: -2400, z: 700, radio: 60 },
  },
  {
    hito: 'andaquies', cronista: 'La guaquera de Ingalí', x: -1900, z: 900,
    encargo: 'Busca tres sitios altos con vista al valle: los Andaquíes vivían de mirarlo.',
    objetivo: { tipo: 'visitar', puntos: [[-2300, 1200], [-2600, 600], [-1700, 1500]], radio: 60 },
  },
  {
    hito: 'conquista', cronista: 'La guaquera de Ingalí', x: -1900, z: 900,
    encargo: 'Recorre de noche el camino viejo por el que llegaron desde el suroccidente.',
    objetivo: { tipo: 'hora', x: -2500, z: 1100, radio: 70, desde: 19, hasta: 5 },
  },
];

// Los seis nombres anteriores no son un hito: son una colección. Cada uno está escrito en un sitio del mundo.
// Reunirlos los seis abre la ficha del topónimo (qué es un topotopónimo, qué significa «pita» en quechua).
export const NOMBRES_EN_EL_MUNDO = [
  { nombre: 'La Chapa', donde: 'Lápida de la capilla vieja', x: -1520, z: 420, radio: 14 },
  { nombre: 'Los Laboyos', donde: 'Dintel de una casa de la Calle 5', x: 95, z: -40, radio: 12 },
  { nombre: 'San Juan de Laboyos', donde: 'Piedra del portón de la hacienda', x: 1390, z: 640, radio: 16 },
  { nombre: 'San Antonio de Laboyos', donde: 'Libro de la parroquia', x: 20, z: -56, radio: 10 },
  { nombre: 'Pitalito de San Antonio', donde: 'Placa del Parque Principal', x: -8, z: 12, radio: 10 },
  { nombre: 'Pitalito', donde: 'Nomenclatura de la Carrera 4', x: -130, z: 60, radio: 12 },
];

// Cuándo se considera cumplido, cómo se avisa, y cuándo existe el cuerpo del cronista.
//
// Los cronistas **sólo existen cerca del jugador**, igual que el tráfico, los enemigos y la fauna: once
// personajes con esqueleto permanentes costarían más que todo el resto junto, y diez de ellos estarían siempre
// a kilómetros de donde está el jugador.
export const MISION = {
  radioCronista: 7,        // a qué distancia se puede hablar
  radioAparicion: 70,      // dentro de esto, el cronista tiene cuerpo
  radioRetirada: 110,      // más allá, se retira
  avisoSegundos: 6,
};

// Cómo se ve cada cronista. Son ficción: ninguno lleva nombre de una persona real, y el aspecto va con el
// oficio que dice tener. Se arma con el mismo catálogo que la creación de personaje.
const look = (ropa, sombrero, piel, pelo, pelocolor = 'negro') => ({
  cuerpo: 'a', ropa, sombrero, piel, pelo, pelocolor, barba: 'ninguna',
});

export const CRONISTAS = {
  'El escribano': look('camino', 'ninguno', '2', 'partido', 'cano'),
  'El sacristán': look('camino', 'ninguno', '3', 'corto', 'cano'),
  'La maestra': look('campo', 'ninguno', '2', 'largo'),
  'La vendedora de la galería': look('campo', 'ninguno', '3', 'monos'),
  'El secretario': look('camino', 'ninguno', '1', 'partido'),
  'El pescador': look('campo', 'aguadeno', '4', 'corto'),
  'El mayordomo': look('campo', 'aguadeno', '3', 'corto-b'),
  'El arriero': look('campo', 'aguadeno', '3', 'partido', 'cano'),
  'El cura de la capilla': look('camino', 'ninguno', '2', 'corto', 'cano'),
  'La guaquera de Ingalí': look('campo', 'aguadeno', '4', 'largo'),
};
