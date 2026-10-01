// Facciones armadas: FICCIÓN DECLARADA.
//
// ⚠ Regla que no se cruza (docs/PLAN_JUEGO.md § 2, AGENTS.md § 7). Pitalito es un municipio real con **10.569
// personas en registro de desplazamiento** (7,37 % de su población, dato del IGAC). Por eso los enemigos de este
// juego **no representan a ningún grupo armado existente**: no llevan nombre, sigla, bandera ni consigna de
// ninguno, y no reconstruyen ningún hecho real.
//
// Lo que hay es un eco: «los Restos», cuadrillas de esqueletos con uniforme, lo que quedó cuando la gente se fue.
// Encajan con el tono de Dark Souls, permiten pelear sin señalar a nadie, y sostienen el final histórico del
// juego. Todo esto se apaga con `FACTIONS.enabled = false`.

export const FACTIONS = {
  enabled: true,

  // Una sola facción por ahora. El id nunca se muestra; el nombre en pantalla es el de abajo.
  restos: {
    id: 'restos',
    nombre: 'Los Restos',
    detalle: 'Uniformes vacíos que siguen montando guardia donde ya no hay nadie.',
    ficcion: true,
    // Aspecto: el cuerpo de huesos generado sobre **el mismo armature** que el jugador
    // (scripts/lib/make-skeleton.py), con la ropa de camino teñida de uniforme. Hereda los 45 clips y el combate.
    look: {
      cuerpo: 'esqueleto', pelo: 'ninguno', barba: 'ninguna', ropa: 'uniforme', sombrero: 'ninguno',
      piel: 'hueso', pelocolor: 'negro', uniforme: '#8a9163',
    },
  },
};

// Zonas de control. **Son ficción**: no corresponden a ningún sitio con presencia real de grupos armados.
// Se ponen lejos de la cabecera, en el borde del mundo, para que la ciudad quede siempre segura.
// Coordenadas del mundo (metros, +X este, −Z norte, origen en el Parque Principal).
export const ZONAS = [
  { id: 'filo-norte', nombre: 'El filo del norte', faccion: 'restos', x: -1900, z: -3400, radio: 520, enemigos: 5 },
  { id: 'quebrada-honda', nombre: 'La quebrada honda', faccion: 'restos', x: 2600, z: 2900, radio: 460, enemigos: 4 },
  { id: 'camino-viejo', nombre: 'El camino viejo', faccion: 'restos', x: -3200, z: 2100, radio: 480, enemigos: 4 },
];

// Cuándo aparecen y desaparecen los enemigos. Igual que el tráfico: sólo existen cerca del jugador.
export const SPAWN = {
  spawnRadius: 140,      // metros: dentro de esto, la zona puebla sus enemigos
  despawnRadius: 240,    // más allá, se retiran
  minDistance: 22,       // nunca aparecen encima del jugador
  // Tope de enemigos a la vez. Medido en la iteración 04: con 5 el juego va a 645 draw calls y 982.641
  // triángulos, dentro del presupuesto (≤ 700 / ≤ 1 M). Subir de aquí lo revienta hasta que las prendas se
  // fusionen por material (ver docs/ASSETS_3D.md).
  maxActive: 6,
  respawnSeconds: 45,
};

// Arquetipos. Todos usan el mismo `Combatant` y el mismo árbol de comportamiento: sólo cambian las cifras.
export const ENEMIGOS = {
  centinela: {
    id: 'centinela', nombre: 'Centinela',
    weapon: 'peinilla',
    stats: { health: 55, stamina: 70, staminaRegen: 16, staminaDelay: 0.7, poise: 20, invulnerableAfterHit: 0.3 },
    ai: { vista: 26, oido: 14, velocidad: 3.4, distanciaAtaque: 1.6, pausaEntreGolpes: 1.1, probabilidadEsquiva: 0.15 },
  },
  machetero: {
    id: 'machetero', nombre: 'Machetero',
    weapon: 'machete',
    stats: { health: 85, stamina: 90, staminaRegen: 14, staminaDelay: 0.8, poise: 32, invulnerableAfterHit: 0.3 },
    ai: { vista: 30, oido: 16, velocidad: 3.0, distanciaAtaque: 2.0, pausaEntreGolpes: 1.5, probabilidadEsquiva: 0.25 },
  },
  cabo: {
    id: 'cabo', nombre: 'Cabo',
    weapon: 'azadon',
    stats: { health: 130, stamina: 110, staminaRegen: 12, staminaDelay: 1, poise: 55, invulnerableAfterHit: 0.35 },
    ai: { vista: 32, oido: 18, velocidad: 2.6, distanciaAtaque: 1.9, pausaEntreGolpes: 2, probabilidadEsquiva: 0.1 },
  },
};

// Con qué frecuencia sale cada arquetipo en una zona.
export const MEZCLA = [
  { tipo: 'centinela', peso: 5 },
  { tipo: 'machetero', peso: 3 },
  { tipo: 'cabo', peso: 1 },
];
