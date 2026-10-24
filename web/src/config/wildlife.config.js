// Fauna: qué animales hay, dónde y cuándo.
//
// **Los animales de finca salen del dato real.** El IGAC publica el inventario pecuario del municipio
// (`src/config/municipio.config.js`): 611.600 aves de engorde, 26.641 bovinos, 5.442 equinos, 4.219 porcinos,
// 108 ovinos. La mezcla de lo que aparece en el campo es esa, no una inventada: `DERIVADOS.mezclaPecuaria`.
//
// **Lo demás es estimado y se declara** (ver docs/DATOS.md): el perro de finca y el borugo no están en ningún
// inventario, pero son parte del campo del sur del Huila. Todo se apaga con `WILDLIFE.enabled = false`.

const BASE = 'models/characters/animals/';

export const WILDLIFE = {
  enabled: true,
  spawnRadius: 120,       // metros alrededor del jugador donde puede aparecer fauna
  despawnRadius: 190,
  minDistance: 14,
  maxActive: 10,
  intentosPorSegundo: 1.5,
};

// Tres nichos, con comportamiento distinto:
//   pacifico     pasta o picotea; huye si te acercas demasiado
//   territorial  avisa, y si insistes se te viene encima
//   nocturno     sólo sale de noche, y es el más esquivo
export const NICHOS = {
  pacifico: { huyeA: 7, velocidadHuida: 5.5, vuelveA: 22 },
  territorial: { avisaA: 12, atacaA: 5, velocidadCarga: 6 },
  nocturno: { huyeA: 11, velocidadHuida: 6.5, vuelveA: 30, horas: [18.5, 5.5] },
};

/**
 * Especies. `habitat` decide dónde puede aparecer:
 *   finca   campo abierto fuera de la ciudad (donde está el ganado)
 *   bosque  cerca de árboles
 *   calle   dentro de la ciudad
 *
 * `peso` es la frecuencia relativa **dentro de su hábitat**; para el ganado sale del inventario real.
 *
 * `visibilidad` es **una decisión de diseño declarada**, no un dato: el inventario cuenta cabezas, no lo que se
 * ve desde el camino. Las 611.600 aves de engorde del municipio están en galpones, no sueltas en el potrero; lo
 * que se ve suelto es un puñado de gallinas y, sobre todo, el ganado. Sin este factor el campo salía poblado
 * únicamente de gallinas (comprobado). Se ajusta aquí, en un solo sitio.
 */
export const ESPECIES = {
  bovino: {
    id: 'bovino', nombre: 'Vaca', model: BASE + 'Cow.glb', altura: 1.4,
    nicho: 'pacifico', habitat: 'finca', real: 'bovino', visibilidad: 1, vida: 120,
    clips: { idle: 'Idle', walk: 'WalkSlow', run: 'Run', death: 'Death' },
  },
  equino: {
    id: 'equino', nombre: 'Caballo', model: BASE + 'Horse.glb', altura: 1.6,
    nicho: 'pacifico', habitat: 'finca', real: 'equino', visibilidad: 1, vida: 110,
    clips: { idle: 'Idle', walk: 'Walk', run: 'Run', death: 'Death' },
  },
  porcino: {
    id: 'porcino', nombre: 'Cerdo', model: BASE + 'Pig.glb', altura: 0.8,
    nicho: 'pacifico', habitat: 'finca', real: 'porcino', visibilidad: 0.45, vida: 70,
    clips: { idle: 'Idle', walk: 'Walk', run: 'Run', death: 'Death' },
  },
  ovino: {
    id: 'ovino', nombre: 'Oveja', model: BASE + 'Sheep.glb', altura: 0.9,
    nicho: 'pacifico', habitat: 'finca', real: 'ovino', visibilidad: 1, vida: 60,
    clips: { idle: 'Idle', walk: 'Walk', run: 'Run', death: 'Death' },
  },
  perro: {
    // Estimado: no está en el inventario pecuario, pero no hay finca sin perro.
    id: 'perro', nombre: 'Perro de finca', model: BASE + 'Pug.glb', altura: 0.5,
    nicho: 'territorial', habitat: 'finca', estimado: true, vida: 45, peso: 1.2,
    clips: { idle: 'Idle', walk: 'Walk', run: 'Run', death: 'Death' },
  },
  gallina: {
    // El 92 % del inventario pecuario son aves, y ningún paquete CC0 trae gallinas: se modela a mano
    // (src/entities/wildlife/models.js), como los vehículos y las herramientas.
    id: 'gallina', nombre: 'Gallina', model: null, procedural: 'gallina', altura: 0.35,
    nicho: 'pacifico', habitat: 'finca', real: 'avesEngorde', visibilidad: 0.06, vida: 12,
  },
  borugo: {
    // Borugo o lapa (Cuniculus paca): roedor nocturno de los bosques del sur del Huila. Forma estimada.
    id: 'borugo', nombre: 'Borugo', model: null, procedural: 'borugo', altura: 0.3,
    nicho: 'nocturno', habitat: 'bosque', estimado: true, vida: 20, peso: 3,
  },
  neque: {
    // Ñeque o guatín (Dasyprocta punctata): el pariente diurno del borugo. Forma estimada.
    id: 'neque', nombre: 'Ñeque', model: null, procedural: 'neque', altura: 0.32,
    nicho: 'pacifico', habitat: 'bosque', estimado: true, vida: 16, peso: 3.5,
  },
  venado: {
    // Venado colorado (Mazama americana): el venado de estos bosques, pequeño y de astas cortas. Forma estimada.
    id: 'venado', nombre: 'Venado colorado', model: null, procedural: 'venado', altura: 0.95,
    nicho: 'pacifico', habitat: 'bosque', estimado: true, vida: 55, peso: 1.6, manada: [2, 4],
  },
  ave: {
    // Pájaro de monte (azulejo, toche). Se va volando en vez de correr. Forma estimada.
    id: 'ave', nombre: 'Pájaro', model: null, procedural: 'ave', altura: 0.16,
    nicho: 'pacifico', habitat: 'bosque', estimado: true, vida: 6, peso: 5, vuela: true, manada: [3, 7],
  },
  serpiente: {
    // Serpiente de monte. No huye: avisa quedándose quieta y muerde si te acercas. Forma estimada.
    id: 'serpiente', nombre: 'Serpiente', model: null, procedural: 'serpiente', altura: 0.12,
    nicho: 'territorial', habitat: 'bosque', estimado: true, vida: 10, peso: 1.4,
  },
};

// Cuántos árboles cerca hacen que una zona cuente como bosque.
export const BOSQUE = { radio: 40, arbolesMinimos: 6 };

// Manadas y bandadas: `manada: [min, max]` en una especie hace que aparezca en grupo. El grupo es **una sola
// entidad lógica** — comparte un destino y una alarma, así que no hay que decidir por cada individuo.
export const MANADA = { separacion: 1.8, radioInicial: 6 };

// Qué cuenta como ciudad. En el campo de Pitalito hay casas de finca por todas partes, así que lo que distingue
// la cabecera no es que haya un edificio, sino cuántos.
export const CIUDAD = { radioCabecera: 1100, radio: 120, edificiosMinimos: 14 };
