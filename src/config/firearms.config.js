// Armas de fuego (modo supervivencia). Modelos: «50+ LowPoly Guns» de Quaternius (CC0), convertidos de FBX a GLB
// con Blender (scripts/fetch-characters.mjs → public/models/weapons/). Las cifras son de juego, no balística: el
// largo (`largo`, metros) sí es el de un arma real de ese tipo, para que el modelo quede a escala en la mano.
//
// Animaciones: las de pistola del paquete del personaje (Pistol_Idle_Loop, Pistol_Aim_Neutral, Pistol_Shoot,
// Pistol_Reload). Las armas largas se sostienen con la misma pose: no hay clips de fusil CC0 para este esqueleto.
//
// `municion` es el objeto del inventario que gastan (ver loot.config.js). Un arma se puede usar si está en la
// mochila (el objeto se llama igual que el arma).

export const FIREARMS = {
  pistola: {
    nombre: 'Pistola 9 mm', archivo: 'Pistol_1.glb', largo: 0.2, municion: 'balas9', cargador: 15,
    dano: 22, alcance: 60, cadencia: 0.22, recarga: 1.4, dispersion: 0.012, perdigones: 1, ruido: 70, retroceso: 0.03,
  },
  revolver: {
    nombre: 'Revólver .38', archivo: 'Revolver_1.glb', largo: 0.24, municion: 'balas38', cargador: 6,
    dano: 34, alcance: 55, cadencia: 0.45, recarga: 2.2, dispersion: 0.01, perdigones: 1, ruido: 75, retroceso: 0.05,
  },
  escopeta: {
    nombre: 'Escopeta de bomba', archivo: 'Shotgun_1.glb', largo: 1.05, municion: 'cartuchos', cargador: 6, larga: true,
    dano: 11, alcance: 28, cadencia: 0.85, recarga: 2.8, dispersion: 0.07, perdigones: 9, ruido: 95, retroceso: 0.09,
  },
  recortada: {
    nombre: 'Escopeta recortada', archivo: 'Shotgun_SawedOff.glb', largo: 0.6, municion: 'cartuchos', cargador: 2,
    dano: 12, alcance: 16, cadencia: 0.35, recarga: 2.0, dispersion: 0.11, perdigones: 9, ruido: 95, retroceso: 0.1,
  },
  fusil: {
    nombre: 'Fusil', archivo: 'AssaultRifle_1.glb', largo: 0.95, municion: 'balas556', cargador: 30, larga: true, automatica: true,
    dano: 20, alcance: 110, cadencia: 0.1, recarga: 2.4, dispersion: 0.018, perdigones: 1, ruido: 110, retroceso: 0.025,
  },
  rifle: {
    nombre: 'Rifle de cacería', archivo: 'SniperRifle_1.glb', largo: 1.15, municion: 'balas308', cargador: 5, larga: true,
    dano: 70, alcance: 200, cadencia: 1.1, recarga: 3.0, dispersion: 0.004, perdigones: 1, ruido: 120, retroceso: 0.12,
  },
};

// Cómo se toma el arma: el GLB trae el cañón hacia +X con la empuñadura cerca del origen. Se ajusta al hueso de
// la mano derecha (tercera persona) y a la cámara (primera persona), medido mirando capturas.
export const AGARRE = {
  mano: { rotation: [1.385, -0.03, 0.042], position: [0, 0.07, 0] },
  primeraPersona: { position: [0.17, -0.17, -0.32], rotation: [0, 0, 0] },
  // Armas largas: más adelante y más abajo, para que la culata no tape la pantalla.
  primeraPersonaLarga: { position: [0.2, -0.26, -0.62], rotation: [0, 0, 0] },
};

// **Modo de pruebas** (temporal, pedido el 21-10): todas las armas de fuego van en el arsenal junto a las de mano,
// en cualquier modo de juego, y recargar no gasta munición. Para el juego normal: las dos en false.
export const PRUEBAS = { todasLasArmas: true, municionInfinita: true };
