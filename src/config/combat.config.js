import { FIREARMS } from './firearms.config.js';
// Combate: números del sistema de pelea y arsenal. Nada de esto se escribe dentro de la lógica.
//
// Diseño (ver docs/PLAN_JUEGO.md § Fase 3): pelea con peso, no botón repetido. La resistencia se gasta al atacar,
// al rodar y al cubrirse, y se recupera al parar. Rodar da invulnerabilidad breve. Fijar blanco mantiene al
// enemigo encuadrado. Un golpe interrumpe si supera el temple (poise) de quien lo recibe.
//
// El mismo sistema sirve al jugador, a la fauna y a las facciones: un combatiente es un `Rig` + estas cifras +
// una tabla de ataques. No hay código por enemigo.

export const COMBAT = {
  // Se puede apagar entero: el juego vuelve a ser sólo mundo abierto y construcción.
  enabled: true,

  player: {
    health: 100,
    stamina: 100,
    staminaRegen: 22,        // por segundo, cuando no se gasta
    staminaDelay: 0.55,      // segundos de espera antes de empezar a recuperar
    poise: 35,               // aguante: por encima de esto un golpe no interrumpe
    invulnerableAfterHit: 0.45,
  },

  // Rodar: la esquiva del sistema. El tramo invulnerable empieza un poco después de arrancar, como en Souls:
  // hay que rodar *hacia* el golpe, no antes de tiempo.
  roll: {
    stamina: 26,
    distance: 4.2,           // metros que recorre
    duration: 0.62,
    iframeStart: 0.10,
    iframeEnd: 0.42,
    cooldown: 0.12,
  },

  guard: {
    stamina: 14,             // por golpe bloqueado
    damageThrough: 0.25,     // fracción del daño que pasa al cubrirse
    drainPerSecond: 4,       // mantener la guardia cansa
  },

  lockOn: {
    range: 22,               // metros
    angle: Math.PI * 0.55,   // medio ángulo de búsqueda desde la mirada
    breakRange: 30,          // más allá se suelta solo
  },

  // Daño según dónde entra el golpe.
  hitMultiplier: { head: 1.8, body: 1, limb: 0.75 },
};

// ───────────────────────────── Arsenal ─────────────────────────────
//
// Todo son herramientas y objetos de la región, no armas de fantasía. Cada una declara de dónde sale.
// `clip` es la animación que usa: se reutilizan las del paquete (ver characters.config.js), no se anima a mano.
//
//   damage   daño base
//   stamina  resistencia que gasta cada golpe
//   reach    alcance en metros desde el pecho
//   arc      ancho del golpe en radianes (medio ángulo)
//   windup   segundos hasta que el golpe hace daño
//   active   segundos que el golpe sigue haciendo daño
//   recover  segundos de recuperación antes de poder encadenar
//   poise    cuánto temple rompe

export const WEAPONS = {
  // Ataque de zombi (modo supervivencia): zarpazo con las manos, lento de cargar y con poco alcance. No está en
  // ARSENAL: el jugador no puede elegirlo.
  zarpazo: {
    id: 'zarpazo', nombre: 'Zarpazo', detalle: 'Arañazo de un muerto.',
    model: null, clip: 'Zombie_Scratch',
    damage: 9, stamina: 6, reach: 1.25, arc: 0.6, windup: 0.45, active: 0.2, recover: 0.5, poise: 12,
  },
  manos: {
    id: 'manos', nombre: 'Manos', detalle: 'Sin nada. Rápido y sin alcance.',
    model: null, clip: 'punchJab', alt: 'punchCross',
    damage: 7, stamina: 8, reach: 1.1, arc: 0.5, windup: 0.12, active: 0.1, recover: 0.2, poise: 8,
  },
  machete: {
    id: 'machete', nombre: 'Machete', detalle: 'La herramienta del cafetal. Corte largo y pesado.',
    model: 'machete', clip: 'attack', idle: 'attackIdle',
    damage: 26, stamina: 22, reach: 2.2, arc: 0.7, windup: 0.26, active: 0.16, recover: 0.34, poise: 30,
  },
  peinilla: {
    id: 'peinilla', nombre: 'Peinilla', detalle: 'Machete corto y recto. Más rápida, menos alcance.',
    model: 'peinilla', clip: 'attack', idle: 'attackIdle',
    damage: 18, stamina: 15, reach: 1.7, arc: 0.6, windup: 0.18, active: 0.13, recover: 0.24, poise: 20,
  },
  garrote: {
    id: 'garrote', nombre: 'Garrote de guadua', detalle: 'Un tramo de culmo. Golpea de plano y aturde.',
    model: 'garrote', clip: 'attack', idle: 'attackIdle',
    damage: 20, stamina: 18, reach: 2.4, arc: 0.55, windup: 0.3, active: 0.14, recover: 0.4, poise: 45,
  },
  azadon: {
    id: 'azadon', nombre: 'Azadón', detalle: 'Pesado y lento. Lo que alcanza, lo tumba.',
    model: 'azadon', clip: 'attack', idle: 'attackIdle',
    damage: 34, stamina: 30, reach: 2.1, arc: 0.45, windup: 0.42, active: 0.18, recover: 0.55, poise: 60,
  },
  rejo: {
    id: 'rejo', nombre: 'Rejo', detalle: 'La correa del arriero. Alcanza lejos pero hace poco daño.',
    model: 'rejo', clip: 'attack', idle: 'attackIdle',
    damage: 11, stamina: 12, reach: 3.1, arc: 0.35, windup: 0.22, active: 0.12, recover: 0.3, poise: 12,
  },
};

// Armas de fuego (supervivencia): entran en WEAPONS para que Combatant y el HUD las traten como cualquier arma; el
// tiro lo resuelve FirearmSystem, no el golpe cuerpo a cuerpo (por eso alcance y daño de golpe van a 0).
for (const [id, f] of Object.entries(FIREARMS)) {
  WEAPONS[id] = {
    id, nombre: f.nombre, detalle: 'Arma de fuego', model: id, clip: 'pistolShoot', idle: 'pistolIdle', fuego: true,
    damage: 0, stamina: 0, reach: 0, arc: 0, windup: 0.05, active: 0.01, recover: 0.05, poise: 0,
  };
}

// Orden en que se recorren con la tecla de cambiar arma.
export const ARSENAL = ['manos', 'machete', 'peinilla', 'garrote', 'azadon', 'rejo'];
