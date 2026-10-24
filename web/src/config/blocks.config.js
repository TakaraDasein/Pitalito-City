// Bloques de construcción del jugador (capa propia sobre el mundo real; los edificios de Pitalito no se alteran).
// Rejilla de 1 m. `top`: altura sólida del bloque (para pararse encima); `solid`: bloquea el paso.
// Cada bloque tiene un modelo propio en src/world/blocks/BlockModels.js.
export const BLOCKS = [
  { id: 'guadua',  name: 'Guadua',          top: 1,    solid: true, color: '#cdae70', note: 'Culmos de guadua con nudos (construcción tradicional del Huila)' },
  { id: 'ladrillo', name: 'Ladrillo',       top: 1,    solid: true, color: '#b87a4b', note: 'Ladrillo a la vista, como la Iglesia San Antonio' },
  { id: 'panete',  name: 'Pañete blanco',   top: 1,    solid: true, color: '#f4f1ea', note: 'Muro pañetado y pintado con zócalo, como las casas del centro' },
  { id: 'adoquin', name: 'Adoquín',         top: 0.25, solid: true, color: '#b5553c', note: 'Losa de adoquín rojo del Parque Principal' },
  { id: 'teja',    name: 'Teja de barro',   top: 0.55, solid: true, color: '#a4553b', note: 'Techo a un agua de teja de barro' },
  { id: 'madera',  name: 'Madera',          top: 1,    solid: true, color: '#8a5a33', note: 'Tablas de madera' },
  { id: 'vidrio',  name: 'Ventana',         top: 1,    solid: true, color: '#8fb4c9', note: 'Ventana con marco de madera y reja' },
  { id: 'cafe',    name: 'Costal de café',  top: 0.8,  solid: true, color: '#c8b28a', note: 'Costal de fique con café del Huila' },
  { id: 'matera',  name: 'Matera',          top: 0.7,  solid: true, color: '#c1121f', note: 'Matera de barro con flores rojas (como las del parque)' },
];
export const BLOCK_INDEX = Object.fromEntries(BLOCKS.map((b, i) => [b.id, i]));
export const MAX_BLOCKS = 6000;
export const REACH = 7; // metros de alcance para interactuar/construir
