// Atmósfera del Valle de Laboyos a lo largo del día: cielo, niebla, luz y gradación.
//
// ESTIMADO (estético, no medido): Pitalito está a ~1.300 m en un valle cerrado por cordilleras, con mañanas de
// neblina que se levanta del río Guarapas y el Guachicos y se disipa con el sol hacia media mañana. Las horas y
// colores de abajo son una interpretación visual de eso, no un dato meteorológico. Todo se apaga con
// `ATMOSPHERE.enabled = false` (vuelve el cielo fijo de antes) y la niebla de altura con `heightFog.enabled`.
//
// Cada fotograma clave se interpola con el siguiente (lineal en la hora, colores en espacio lineal).

export const ATMOSPHERE = {
  enabled: true,

  // Niebla que se pega al suelo: densa en el fondo del valle, rala en las laderas. Alturas relativas al
  // Parque Principal (Terrain.js). Se cuece en el sombreador, así que cambiarla exige recargar.
  heightFog: {
    enabled: true,
    base: 0,          // m: altura donde la niebla es más densa (el fondo del valle)
    falloff: 70,      // m: cada `falloff` metros por encima, la niebla baja a 1/e
    haze: 0.2,        // bruma mínima en altura, para que las montañas sigan azulándose
  },

  // Fotogramas por hora. density multiplica GAME.render.fogDensityReal (a ras de suelo; en altura pesa `haze`).
  keys: [
    { h: 0,    density: 2.2, fog: '#0b1020', sky: { turbidity: 2, rayleigh: 1, mie: 0.004, g: 0.8 }, sun: '#9fb4ff', warmth: 0,    exposure: 0.70 },
    { h: 4.8,  density: 3.5, fog: '#141a2a', sky: { turbidity: 3, rayleigh: 1, mie: 0.006, g: 0.8 }, sun: '#9fb4ff', warmth: 0,    exposure: 0.70 },
    // Alba: el valle amanece tapado. La niebla es fría y lechosa; el sol apenas la tiñe de rosa.
    { h: 5.8,  density: 30,  fog: '#8a8f9e', sky: { turbidity: 8, rayleigh: 3, mie: 0.012, g: 0.86 }, sun: '#ff9a6a', warmth: 0.3,  exposure: 0.56 },
    { h: 6.6,  density: 45,  fog: '#d9cfc4', sky: { turbidity: 9, rayleigh: 2.6, mie: 0.014, g: 0.9 }, sun: '#ffc79a', warmth: 0.45, exposure: 0.55 },
    { h: 8,    density: 32,  fog: '#dfe3e6', sky: { turbidity: 6, rayleigh: 2, mie: 0.01, g: 0.88 }, sun: '#fff0dc', warmth: 0.3,  exposure: 0.54 },
    // Se levanta: a las 10 el valle ya está despejado.
    { h: 9.2,  density: 12,  fog: '#d2dfe9', sky: { turbidity: 4, rayleigh: 1.8, mie: 0.006, g: 0.86 }, sun: '#fff6ea', warmth: 0.45, exposure: 0.54 },
    { h: 10,   density: 1.4, fog: '#c9dbe8', sky: { turbidity: 2.5, rayleigh: 1.6, mie: 0.004, g: 0.85 }, sun: '#ffffff', warmth: 0.5, exposure: 0.54 },
    { h: 15,   density: 1.3, fog: '#c6d8e6', sky: { turbidity: 3, rayleigh: 1.7, mie: 0.005, g: 0.85 }, sun: '#fff6e8', warmth: 0.55, exposure: 0.54 },
    // Tarde dorada: el aire se carga de polvo y la luz se vuelve miel.
    { h: 16.6, density: 1.4, fog: '#e6cfa6', sky: { turbidity: 6, rayleigh: 2.2, mie: 0.008, g: 0.9 }, sun: '#ffd08a', warmth: 0.85, exposure: 0.60 },
    // Atardecer: sol rojizo, horizonte naranja, cielo alto todavía azul.
    { h: 17.6, density: 1.9, fog: '#f0a066', sky: { turbidity: 10, rayleigh: 3.2, mie: 0.016, g: 0.93 }, sun: '#ff7a3a', warmth: 1,    exposure: 0.70 },
    { h: 18.2, density: 2.1, fog: '#b06a5a', sky: { turbidity: 12, rayleigh: 3.6, mie: 0.02, g: 0.95 }, sun: '#ff4a22', warmth: 0.9,  exposure: 0.78 },
    // Hora azul.
    { h: 18.8, density: 2.2, fog: '#3a3a58', sky: { turbidity: 6, rayleigh: 2, mie: 0.008, g: 0.85 }, sun: '#8a90ff', warmth: 0.2,  exposure: 0.68 },
    { h: 20,   density: 2.2, fog: '#0b1020', sky: { turbidity: 2, rayleigh: 1, mie: 0.004, g: 0.8 }, sun: '#9fb4ff', warmth: 0,    exposure: 0.70 },
    { h: 24,   density: 2.2, fog: '#0b1020', sky: { turbidity: 2, rayleigh: 1, mie: 0.004, g: 0.8 }, sun: '#9fb4ff', warmth: 0,    exposure: 0.70 },
  ],

  // Partículas de ambiente que dependen de la hora (las emite AmbienceSystem; familias en particles.config.js).
  particulas: {
    bruma: { desde: 5.5, hasta: 10, cada: 0.18, radio: [6, 45] },   // jirones de niebla a ras de suelo
    motas: { desde: 6, hasta: 18.4, cada: 0.12, radio: [3, 16] }, // polvo y polen que brilla a contraluz
  },
};
