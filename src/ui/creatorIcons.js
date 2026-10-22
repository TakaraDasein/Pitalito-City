// Iconos SVG del creador de personaje. Son cadenas generadas al vuelo: toman el color de piel y de pelo que está
// elegido, así que el icono del pelo "largo" se ve con el pelo del personaje y no con uno genérico.
//
// Trazo en `currentColor` (lo pone el CSS según el estado del botón); rellenos con los colores del personaje.
// Todos en una caja de 48 × 48.

const svg = (body, extra = '') =>
  `<svg class="ci" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;

const CAMISA = '#d9ccaa';   // la del cafetal (Peasant)
const CHAQUETA = '#6b4a2c'; // la del camino (Ranger)
const PANTALON = '#4a3322';

// Cabeza de frente, de base para pelo, barba, sombrero y capucha.
const cabeza = (piel) => `
  <path d="M19 37v5h10v-5" fill="${piel}"/>
  <ellipse cx="24" cy="25" rx="9" ry="11" fill="${piel}"/>
  <path d="M20.5 26h.01M27.5 26h.01" stroke-width="2.6"/>`;

const PELO = {
  ninguno: () => '',
  partido: (c) => `<path d="M14.6 25c-1-9 4-13.5 9.4-13.5S34.4 16 33.4 25c-1.2-4-3-6.2-7-6.8l-2.4 3-1-3c-4.2.4-6.8 2.6-8.4 6.8z" fill="${c}"/>`,
  corto: (c) => `<path d="M15.2 22c.6-6.6 4.2-9.6 8.8-9.6s8.2 3 8.8 9.6c-3-2.4-5.8-3.2-8.8-3.2s-5.8.8-8.8 3.2z" fill="${c}" stroke-dasharray="1 2.2"/>`,
  'corto-b': (c) => `<path d="M14.8 24c0-8 4-12 9.2-12s9.2 4 9.2 12c-2.2-3.4-4-5-9.2-5s-7 1.6-9.2 5z" fill="${c}"/>`,
  largo: (c) => `<path d="M13 40c-1-6 0-11 1-17 1-7 5-11 10-11s9 4 10 11c1 6 2 11 1 17l-3-1-.6-15c-2-3-4.4-4.6-7.4-4.6s-5.4 1.6-7.4 4.6L16 39z" fill="${c}"/>`,
  monos: (c) => `<circle cx="14" cy="15" r="4.2" fill="${c}"/><circle cx="34" cy="15" r="4.2" fill="${c}"/>
    <path d="M14.8 24c0-8 4-12 9.2-12s9.2 4 9.2 12c-2.2-3.4-4-5-9.2-5s-7 1.6-9.2 5z" fill="${c}"/>`,
};

const barba = (c) => `<path d="M15.4 27c.4 7 4 10 8.6 10s8.2-3 8.6-10c-1.6 2-3.4 3-5 3.2-1.4-1-5.8-1-7.2 0-1.6-.2-3.4-1.2-5-3.2z" fill="${c}"/>`;

const sombrero = () => `
  <path d="M17 17.5c0-5 2.6-8 7-8s7 3 7 8" fill="#f1ebdc"/>
  <ellipse cx="24" cy="18" rx="17" ry="4" fill="#f1ebdc"/>
  <path d="M17.2 15.6h13.6" stroke="#1b1410" stroke-width="2.4"/>`;

const capucha = () => `<path d="M10 42c0-8 1-15 3.4-21C16 13 20 9.6 24 9.6S32 13 34.6 21C37 27 38 34 38 42H32l-1-12c-2-4-4.4-6-7-6s-5 2-7 6l-1 12z" fill="${CHAQUETA}"/>`;

// Torso con brazos: `mangas` false deja los brazos con el color de la piel.
const torso = (arriba, abajo, piel, mangas = true) => `
  <path d="M10 22l6-6h16l6 6-4 4-2-2v10H16V24l-2 2z" fill="${arriba}"/>
  ${mangas ? '' : `<path d="M10 22l4 4 2-2v-4l-2-2z" fill="${piel}"/><path d="M38 22l-4 4-2-2v-4l2-2z" fill="${piel}"/>`}
  <path d="M16 34h16l-1 10h-6l-1-6-1 6h-6z" fill="${abajo}"/>
  <path d="M21 16l3 4 3-4"/>`;

const ROPA = {
  campo: (p) => torso(CAMISA, PANTALON, p),
  camino: (p) => torso(CHAQUETA, '#3b2a1c', p),
  mixta: (p) => torso(CAMISA, '#3b2a1c', p),
  arremangada: (p) => torso(CAMISA, PANTALON, p, false),
  chaqueta: (p) => torso(CHAQUETA, PANTALON, p),
  ninguna: (p) => torso(p, p, p),
};

const hombrera = () => `
  <path d="M10 30c0-8 5-14 14-14s14 6 14 14" stroke-dasharray="2 3" opacity=".5"/>
  <path d="M7 24c2-6 7-9 12-8l2 7c-5 0-9 1.6-12 4z" fill="#7a5532"/>
  <path d="M10 22l3 3M14 19l2.5 3.5"/>`;

const CUERPO = {
  a: (p) => `<circle cx="24" cy="9" r="5" fill="${p}"/><path d="M12 18h24l-3 13h-4l-1 14h-8l-1-14h-4z" fill="${p}"/>`,
  b: (p) => `<circle cx="24" cy="9" r="5" fill="${p}"/><path d="M16 18h16l-3 8 4 7h-6l-1 12h-4l-1-12h-6l4-7z" fill="${p}"/>`,
};

// Oficios: el objeto que los identifica.
const OFICIO = {
  // Rama de café con cerezas
  caficultor: () => `<path d="M10 40C18 32 26 20 38 8"/><path d="M20 30c-5-1-8-5-8-9 5 0 8 4 8 9zM28 20c4-3 9-3 11 0-3 3-8 3-11 0z" fill="#4f6b2a"/>
    <circle cx="24" cy="31" r="3.4" fill="#b23a2c"/><circle cx="30" cy="27" r="3.4" fill="#b23a2c"/><circle cx="18" cy="38" r="3" fill="#7c2a20"/>`,
  // Herradura
  arriero: () => `<path d="M14 40V24a10 10 0 0 1 20 0v16h-6V24a4 4 0 0 0-8 0v16z" fill="#8b8173"/>
    <path d="M17 30h.01M17 36h.01M31 30h.01M31 36h.01" stroke="#1b1410" stroke-width="2.6"/>`,
  // Chiva: bus de escalera de colores
  chivero: () => `<path d="M6 34V18c0-3 2-5 5-5h26c3 0 5 2 5 5v16z" fill="#c9a23a"/>
    <path d="M6 23h36" stroke="#b23a2c" stroke-width="3"/><path d="M6 28h36" stroke="#2f6aa0" stroke-width="2"/>
    <path d="M12 13v10M20 13v10M28 13v10M36 13v10"/><circle cx="14" cy="36" r="4" fill="#1b1410"/><circle cx="34" cy="36" r="4" fill="#1b1410"/>`,
  // Vasija precolombina
  guaquero: () => `<path d="M18 8h12M19 8c0 4-1 6-4 8-5 4-6 10-4 16 2 7 8 10 13 10s11-3 13-10c2-6 1-12-4-16-3-2-4-4-4-8" fill="#a5603a"/>
    <path d="M13 26c6 2 16 2 22 0M14 32l4-3 4 3 4-3 4 3 4-3" stroke="#3b2414"/>`,
  // Canasto de la galería
  galeria: () => `<path d="M14 20a10 10 0 0 1 20 0" /><path d="M8 20h32l-4 20H12z" fill="#b8894a"/>
    <path d="M10 27h28M11 33h26M18 20l-1 20M24 20v20M30 20l1 20" stroke="#5c3d1e"/>
    <circle cx="20" cy="17" r="3.2" fill="#d9822b"/><circle cx="28" cy="16" r="3.2" fill="#8bb04a"/>`,
  // Libro abierto
  estudiante: () => `<path d="M24 14c-4-3-10-4-16-3v26c6-1 12 0 16 3 4-3 10-4 16-3V11c-6-1-12 0-16 3z" fill="#efe4cc"/>
    <path d="M24 14v26M12 18c3-.4 6 0 8 1M12 24c3-.4 6 0 8 1M28 19c2-1 5-1.4 8-1M28 25c2-1 5-1.4 8-1" stroke="#5c3d1e"/>`,
};

// Muestra de color: piel como una cara, pelo como un mechón.
const muestraPiel = (c) => `<circle cx="24" cy="24" r="15" fill="${c}"/><path d="M19 22h.01M29 22h.01" stroke-width="3"/><path d="M19 30c3 2 7 2 10 0"/>`;
const muestraPelo = (c) => `<path d="M16 42c-4-10 0-20 4-26 3-5 2-8 0-10 7 1 12 6 12 14 0 6-3 9-3 14 0 3 2 6 4 8z" fill="${c}"/>`;

// Tachado para lo apagado.
const tachado = '<path class="ci-off" d="M8 40L40 8" stroke-width="3"/>';

/**
 * Icono de una opción concreta.
 * @param key  categoría (origen, cuerpo, piel, pelo, pelocolor, barba, ropa, sombrero, capucha, hombreras)
 * @param id   id de la opción
 * @param colores { piel, pelo } del personaje, en hexadecimal: con eso se pintan cabezas y cuerpos
 * @param color   el de la opción misma, en las categorías de color (piel, pelocolor)
 */
export function iconoOpcion(key, id, { piel, pelo }, color = null) {
  switch (key) {
    case 'origen': return svg((OFICIO[id] || OFICIO.caficultor)());
    case 'cuerpo': return svg((CUERPO[id] || CUERPO.a)(piel));
    case 'piel': return svg(muestraPiel(color || piel));
    case 'pelocolor': return svg(muestraPelo(color || pelo));
    case 'pelo': return svg(cabeza(piel) + (PELO[id] || PELO.ninguno)(pelo) + (id === 'ninguno' ? tachado : ''));
    case 'barba': return svg(cabeza(piel) + (id === 'barba' ? barba(pelo) : tachado));
    case 'ropa': return svg((ROPA[id] || ROPA.campo)(piel) + (id === 'ninguna' ? tachado : ''));
    case 'sombrero': return svg(cabeza(piel) + (id === 'aguadeno' ? sombrero() : tachado));
    case 'capucha': return svg(cabeza(piel) + (id === 'si' ? capucha() : tachado));
    case 'hombreras': return svg(hombrera() + (id === 'si' ? '' : tachado));
    default: return svg('<circle cx="24" cy="24" r="12"/>');
  }
}

/** Icono de la pestaña de una categoría: la opción elegida, para que la barra sea un retrato de la apariencia. */
export function iconoCategoria(key, look, colores) {
  return iconoOpcion(key, look[key], colores);
}
