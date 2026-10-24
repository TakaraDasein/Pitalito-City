// Cifras oficiales del municipio de Pitalito. No son decoración: alimentan densidad de peatones, mezcla de
// vehículos, contenido de las fincas y qué tan viva se ve cada zona.
//
// Fuente: IGAC, Diccionario de Entidades Territoriales, ficha del municipio 41551 (2025)
//   https://diccionario.igac.gov.co/entidades/ficha?mun=41551
// que a su vez cita a DANE (proyecciones de población 2018-2035, Marco Geoestadístico, Directorio de Empresas),
// IGAC (Base Predios, Colombia en Mapas), Registraduría (Censo Electoral) y ANT.
// Año de referencia: 2025. Ver docs/DATOS.md.

export const MUNICIPIO = {
  nombre: 'Pitalito',
  departamento: 'Huila',
  codigoDane: '41551',
  subregion: 'Sur',
  fuente: 'IGAC, Diccionario de Entidades Territoriales (2025)',
  anio: 2025,

  // Geografía
  areaKm2: 630.73,            // 3,48 % del área de Huila (18.137 km²)
  altitudCabeceraM: 1271,
  temperaturaMediaC: 20,
  distanciaNeivaKm: 193.1,
  coordenadas: { lat: 1.8483, lon: -76.0522 }, // 1° 50' 54" N, 76° 03' 08" O
  limitaCon: ['Saladoblanco', 'Elías', 'Timaná', 'Acevedo', 'Palestina', 'Santa Rosa (Cauca)', 'San Agustín', 'Isnos'],

  // Población
  poblacion: 143407,
  poblacionUrbana: 84418,     // 58,9 % en la cabecera
  poblacionRural: 58989,      // 41,1 %
  densidadHabKm2: 227.4,      // contra 67,0 del departamento
  personasPorHogar: 3.2,
  edad: { de0a14: 0.2581, de15a59: 0.6311, de60yMas: 0.1108 },
  nacimientosAnuales: 1874,
  poblacionEtnica: 2935,      // 2,14 %: 1.624 indígena, 1.293 afrodescendiente, 14 rom, 2 raizal, 2 palenquera
  resguardosIndigenas: 1,
  desplazados: 10569,         // 7,37 % de la población
  conDiscapacidad: 1571,      // 1,10 %

  // Vivienda y predios
  viviendas: 52366,
  viviendasCabecera: 30637,   // 58,5 %
  viviendasResto: 21729,      // 41,5 %
  hogares: 42889,
  predios: 45518,             // 64,1 % urbanos (29.165) · 35,9 % rurales (16.353)
  prediosPorKm2: 72,          // puesto 1 de 37 municipios del Huila

  // Economía
  empresas: 1608,             // 11,2 por cada mil habitantes
  hectareasCultivosPermanentes: 22064.4, // 34,98 % del área del municipio
  desempleoHuila: 0.084,
  regaliasMineriaPesosPorHab: 338,
  mineria: { materialesConstruccionM3: 225471.35, carbonYArcillasToneladas: 41254 },

  // Inventario pecuario (cabezas) — 58,1 por km², puesto 6 de 37
  pecuario: {
    avesEngorde: 611600,      // 92 % del inventario
    bovino: 26641,
    avesPostura: 15000,
    equino: 5442,
    porcino: 4219,
    avesTraspatio: 1420,
    bufalino: 129,
    caprino: 118,
    ovino: 108,
  },

  // Institucionalidad
  notarias: 2,
  puestosVotacion: 36,
  mesasVotacion: 333,
  votantes: 112482,           // 78,4 % de la población

  // Una cabecera y 9 centros poblados con nombre propio (DANE, Marco Geoestadístico Nacional)
  centrosPoblados: [
    'Bruselas', 'Charguayaco', 'Chillurco (Villas del Norte)', 'Criollo', 'Guacacayo',
    'La Laguna', 'Los Arrayanes', 'Palmarito', 'Regueros',
  ],
};

// Derivados que usa el juego. Se calculan aquí para que la lógica no repita fórmulas.
export const DERIVADOS = {
  // Peatones por km² a escala de juego: la densidad real dividida por un factor jugable.
  // El factor es una decisión de diseño (no un dato) y se ajusta desde aquí.
  peatonesPorKm2: MUNICIPIO.densidadHabKm2 / 20,
  fraccionUrbana: MUNICIPIO.poblacionUrbana / MUNICIPIO.poblacion,
  // Las fincas del entorno rural se pueblan según el inventario real: casi todo es avicultura.
  mezclaPecuaria: Object.fromEntries(
    Object.entries(MUNICIPIO.pecuario).map(([k, v]) => [
      k, v / Object.values(MUNICIPIO.pecuario).reduce((a, b) => a + b, 0),
    ]),
  ),
};
