// Partículas: familias, cuántas caben y cómo se ven.
//
// **Todas se simulan en la GPU** (ver src/render/Particles.js): la CPU sólo dice "emite N aquí"; el movimiento,
// la gravedad, el giro y el desvanecido los calcula el vértice a partir del tiempo de nacimiento. Por eso una
// familia con 2.000 partículas cuesta **un draw call** y casi nada de CPU.
//
// Todo se apaga con `PARTICLES.enabled = false`, y cada familia por separado con su `enabled`.

export const PARTICLES = {
  enabled: true,
  // Tope global por familia según el preset de calidad (REGLAS.md § 5).
  escalaPorCalidad: { baja: 0.25, media: 0.6, alta: 1, ultra: 1.4 },
};

/**
 * Cada familia declara:
 *   max        cuántas partículas puede haber a la vez (tamaño del buffer)
 *   vida       segundos que dura cada una
 *   tamano     [inicio, fin] en metros
 *   color      [inicio, fin]
 *   opacidad   [inicio, fin]
 *   gravedad   m/s² (negativo = cae)
 *   arrastre   cuánto frena por segundo
 *   blending   'normal' | 'additive'
 */
export const FAMILIAS = {
  // Polvo que levanta el pie al correr por tierra o por la vía sin pavimentar.
  polvo: {
    max: 220, vida: 1.1, tamano: [0.12, 0.55], gravedad: -1.2, arrastre: 1.6,
    color: ['#b9a98c', '#cfc3ab'], opacidad: [0.38, 0], blending: 'normal',
  },
  // Chispas del machete contra el hueso o el metal.
  chispas: {
    max: 260, vida: 0.45, tamano: [0.055, 0.012], gravedad: -9, arrastre: 2.2,
    color: ['#fff3c4', '#ff7a1a'], opacidad: [1, 0], blending: 'additive',
  },
  // Lo que sueltan los esqueletos al recibir: polvo de hueso, no sangre.
  polvoHueso: {
    max: 240, vida: 0.9, tamano: [0.07, 0.3], gravedad: -2.5, arrastre: 2,
    color: ['#e8e2d0', '#b9b2a0'], opacidad: [0.75, 0], blending: 'normal',
  },
  // Sangre al golpear a una persona, un zombi o un animal: gotas oscuras que caen rápido.
  sangre: {
    max: 360, vida: 0.7, tamano: [0.05, 0.03], gravedad: -9.5, arrastre: 1.4,
    color: ['#7a0d0d', '#3d0505'], opacidad: [0.95, 0.6], blending: 'normal',
  },
  // Salpicadura de la lluvia al tocar el suelo.
  salpicadura: {
    max: 400, vida: 0.35, tamano: [0.03, 0.14], gravedad: -5, arrastre: 1.2,
    color: ['#cfe3ea', '#cfe3ea'], opacidad: [0.5, 0], blending: 'normal',
  },
  // Luciérnagas: de noche, en el monte. Suben despacio y parpadean.
  luciernagas: {
    max: 160, vida: 6, tamano: [0.045, 0.045], gravedad: 0.05, arrastre: 0.2,
    color: ['#d9ff7a', '#8fd43a'], opacidad: [0, 0], parpadeo: true, blending: 'additive',
  },
  // Hojas que arrastra el viento bajo los árboles.
  hojas: {
    max: 180, vida: 5.5, tamano: [0.1, 0.1], gravedad: -0.35, arrastre: 0.25,
    color: ['#7fae5b', '#9c8a4a'], opacidad: [0.9, 0], giro: 3, blending: 'normal',
  },
  // Humo del fogón de leña.
  humo: {
    max: 200, vida: 3.2, tamano: [0.25, 1.4], gravedad: 0.55, arrastre: 0.6,
    color: ['#9a9287', '#c9c3ba'], opacidad: [0.4, 0], blending: 'normal',
  },
};

// Cuántas partículas suelta cada cosa que pasa en el juego.
export const EMISIONES = {
  pasoTierra: { familia: 'polvo', n: 3, velocidad: 0.9, dispersion: 0.5 },
  pasoCorriendo: { familia: 'polvo', n: 6, velocidad: 1.6, dispersion: 0.7 },
  golpeHueso: { familia: 'polvoHueso', n: 14, velocidad: 2.4, dispersion: 1 },
  golpeMetal: { familia: 'chispas', n: 18, velocidad: 3.4, dispersion: 0.9 },
  golpeCarne: { familia: 'sangre', n: 16, velocidad: 2.6, dispersion: 1.1 },
  gotaSuelo: { familia: 'salpicadura', n: 1, velocidad: 1.1, dispersion: 0.4 },
};
