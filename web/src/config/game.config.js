// Parámetros globales de juego y render. Ajustar aquí antes que en el código.
export const GAME = {
  render: {
    maxPixelRatio: 1.5,
    shadowMapSize: 2048,
    shadowRadius: 120,     // metros alrededor del jugador con sombras
    fogDensity: 0.00045,
    fogDensityReal: 0.00011, // con relieve real: se ven las montañas del valle
    far: 30000,
  },
  streaming: {
    radius: 2,             // tiles de detalle alrededor del jugador (250 m c/u)
    unloadMargin: 1,
    maxBuildsPerFrame: 1,
    maxConcurrentFetches: 4,
  },
  time: {
    startHour: 9.5,
    dayLengthMinutes: 24,  // minutos reales por día de juego
  },
  traffic: {
    maxCars: 36,
    spawnRadius: 260,
    despawnRadius: 380,
  },
};
