// Modo supervivencia: Pitalito tras un brote de zombis. **Ficción declarada.**
//
// Es un modo aparte del de historia: se elige en el menú principal (Settings → `modo`) y todo lo de aquí se
// apaga si no está activo. El mundo sigue siendo el real: dónde hay hospitales, CAI, iglesias o gasolineras sale
// de los puntos de interés de OpenStreetMap (public/world/map.json → pois); los zombis y el botín son inventados.
//
// Animaciones: Universal Animation Library 2 (Quaternius, CC0) — Zombie_Walk_Fwd_Loop, Zombie_Idle_Loop,
// Zombie_Scratch, Hit_Knockback, LayToIdle. Ver scripts/fetch-characters.mjs.

export const SURVIVAL = {
  // Tope de zombis completos (con esqueleto e IA) a la vez. Lo baja el director de presupuesto si va apretado
  // (FrameBudget.maxEnemigos): con ropa, cada uno cuesta lo que un enemigo de facción. Las hordas grandes
  // necesitan el cuerpo instanciado barato (pendiente, ver docs/PLAN_JUEGO.md).
  maxZombis: 6,
  aparicion: {
    minDistance: 22,      // nunca aparecen a la vista inmediata
    radio: 45,
    despawnRadius: 90,
    cadaSegundos: 2.5,    // ritmo de aparición mientras falten
    // Más de noche (hora del Environment): multiplica el cupo.
    noche: { desde: 19, hasta: 5, factor: 1.0 },
    dia: { factor: 0.5 },
    // Cerca de estos lugares reales hay más: es donde la gente fue a buscar ayuda.
    focos: { hospital: 1.6, clinic: 1.4, doctors: 1.2, police: 1.4, place_of_worship: 1.3, religious: 1.3, marketplace: 1.3 },
    radioFoco: 80,
  },
  // Horda lejana: zombis dibujados como impostores (src/render/ImpostorAtlas.js), 2 triángulos y una llamada
  // de dibujo por tipo. Se mueven como puntos sobre el relieve; al acercarse pasan a ser zombis completos.
  horda: {
    max: 140,             // de noche y junto a un foco; de día, la mitad (mismo factor que el cupo)
    radioMin: 35,         // aparecen fuera de la vista inmediata…
    radio: 120,           // …y hasta aquí
    despawn: 150,
    promover: 26,         // a menos de esto, pasan a ser completos (si cabe en maxZombis)
    degradar: 42,         // los completos que no persiguen a nadie vuelven a la horda pasada esta distancia
    oido: 45,             // la horda oye de más lejos que uno solo: el ruido se contagia
    cadaSegundos: 0.15,
  },
  // Necesidades del jugador (0–100). Bajan con el tiempo real de juego; correr las gasta más rápido.
  vitales: {
    hambreMin: 45,        // minutos de 100 a 0 sin comer
    sedMin: 28,           // minutos de 100 a 0 sin beber
    esfuerzo: 1.6,        // multiplicador corriendo
    danoVacio: 0.5,       // vida/s que se pierde con hambre o sed a 0
    regen: { desde: 60, vida: 0.35 },   // con hambre y sed por encima de `desde`, recupera vida/s
  },
  // Mordida: cada zarpazo que entra (no bloqueado) puede infectar. La infección sube sola hasta tratarla con
  // antibiótico; por encima de `fiebre` la resistencia se recupera a la mitad, a 100 quita vida.
  infeccion: { probabilidad: 0.35, porMordida: 14, subePorMin: 3, fiebre: 50, danoTotal: 1.0 },
  // Refugios: iglesias y estaciones de policía reales (map.json → pois). Dentro del radio no aparecen zombis
  // nuevos, las necesidades bajan a la mitad, se recupera vida y es donde se reaparece al caer.
  refugios: { tipos: ['place_of_worship', 'religious', 'monastery', 'police'], radio: 22, sinAparicion: 60, gasto: 0.5, vida: 0.6 },
  // Al caer: se reaparece en el último refugio visitado (o en el Parque Principal) y se pierde parte de la mochila.
  muerte: { espera: 4, vida: 60, pierde: 0.5 },
  // Tráfico: casi nadie conduce ya. Fracción de GAME.traffic.maxCars.
  trafico: 0.12,
};

// Tipos de zombi. Mismo cuerpo y esqueleto que todos los personajes; cambian cifras, clips y aspecto.
// `clips` reemplaza los clips de AnimationGraph sólo para ese tipo.
const CLIPS_ZOMBI = {
  idle: 'Zombie_Idle_Loop', walk: 'Zombie_Walk_Fwd_Loop', jog: 'Zombie_Walk_Fwd_Loop', run: 'Zombie_Walk_Fwd_Loop',
  hitChest: 'Hit_Knockback',
};

export const ZOMBIS = {
  caminante: {
    nombre: 'Caminante',
    cuerpos: ['a', 'b'],          // hombres y mujeres
    look: { cuerpo: 'a', pelo: 'partido', barba: 'ninguna', ropa: 'campo', sombrero: 'ninguno', piel: 'muerto', pelocolor: 'negro', uniforme: '#a49c80' },
    clips: CLIPS_ZOMBI,
    stats: { health: 60, stamina: 60, staminaRegen: 20, staminaDelay: 0.5, poise: 25, invulnerableAfterHit: 0.25 },
    ai: { vista: 18, oido: 9, velocidad: 0.9, distanciaAtaque: 1.2, pausaEntreGolpes: 1.4 },
  },
  corredor: {
    nombre: 'Corredor',
    look: { cuerpo: 'a', pelo: 'ninguno', barba: 'ninguna', ropa: 'camino', sombrero: 'ninguno', piel: 'muerto2', pelocolor: 'negro', uniforme: '#8d939c' },
    // Corre de verdad: usa el sprint del paquete, no el arrastre.
    clips: { ...CLIPS_ZOMBI, jog: 'Jog_Fwd_Loop', run: 'Sprint_Loop' },
    stats: { health: 35, stamina: 80, staminaRegen: 25, staminaDelay: 0.4, poise: 8, invulnerableAfterHit: 0.2 },
    ai: { vista: 26, oido: 14, velocidad: 5.2, distanciaAtaque: 1.2, pausaEntreGolpes: 1.0 },
  },
  gordo: {
    nombre: 'Hinchado',
    look: { cuerpo: 'a', pelo: 'ninguno', barba: 'ninguna', ropa: 'campo', sombrero: 'ninguno', piel: 'muerto', pelocolor: 'negro', uniforme: '#ab9a7c' },
    escala: [1.18, 1.04, 1.18],   // más ancho: lento, aguanta y empuja
    clips: CLIPS_ZOMBI,
    stats: { health: 160, stamina: 60, staminaRegen: 15, staminaDelay: 0.8, poise: 70, invulnerableAfterHit: 0.3 },
    ai: { vista: 14, oido: 8, velocidad: 0.65, distanciaAtaque: 1.4, pausaEntreGolpes: 2.0 },
  },
};

// Mezcla general y la de los focos (cerca de un CAI salen más duros, por ejemplo).
export const MEZCLA_ZOMBIS = [
  { tipo: 'caminante', peso: 7 },
  { tipo: 'corredor', peso: 2 },
  { tipo: 'gordo', peso: 1 },
];
