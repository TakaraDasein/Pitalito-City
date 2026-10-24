// Personajes con esqueleto: modelos, animaciones, apariencia y presupuesto.
//
// Todo el material es CC0 (Quaternius). Los cuerpos, la ropa, el pelo y los clips comparten un esqueleto de
// **65 huesos con nombres de Unreal** (`pelvis`, `spine_01`, `Head`, `hand_r`…), así que una animación mueve a la
// vez la piel y la ropa sin reorientar nada. Descarga y preparación: `pnpm models:fetch`
// (ver scripts/fetch-characters.mjs y docs/ASSETS_3D.md).

const BASE = 'models/characters/';

export const CHARACTERS = {
  // Poner en false vuelve al personaje de cajas articuladas (respaldo sin descargas). El juego funciona igual.
  useRig: true,

  animations: BASE + 'animations.glb',
  // Complementos con el mismo esqueleto: clips de la Universal Animation Library 2 (CC0, Quaternius) — zombis,
  // combos de espada, bloqueo, gancho, hachazo — recortados con scripts/lib/gltf-clips.py (fetch-characters.mjs).
  extraAnimations: [BASE + 'ual2.glb'],
  playerHeight: 1.75,   // altura del personaje en el juego, en metros
  modelHeight: 1.8,     // altura del modelo tal como viene

  // Cuánto se mete la piel hacia adentro bajo la ropa, en metros (ver src/entities/skinning/skinFit.js).
  // Hace falta porque los cuerpos del paquete gratuito son más corpulentos que la ropa que trae.
  skinShrink: 0.017,

  // Altura del ala del sombrero sobre el hueso de la cabeza, en metros. Medido, no estimado.
  hatLift: 0.14,

  // Presupuesto. El del jugador es amplio porque sólo hay uno y se ve de cerca; el de la multitud es el que manda
  // cuando haya peatones y enemigos (Fases 4 y 5).
  //
  // Medido en la iteración 02 con el atuendo completo: **28.825 triángulos y 11 draw calls** (cuerpo 3 + pelo 1 +
  // cuatro prendas 5 + sombrero 2). Cabe de sobra para uno solo, pero no para treinta. Lo que falta para bajarlo:
  // fusionar las prendas que comparten material (las cuatro del atuendo usan `MI_Peasant`), lo que exige
  // renumerar los índices de hueso a un orden común antes de unir las mallas.
  budget: { playerTriangles: 30000, playerDrawCalls: 12, crowdTriangles: 6000, crowdDrawCalls: 3, maxAnimated: 30 },

  // Nivel de detalle de animación: a qué distancia se baja la frecuencia de mezcla, en metros.
  animationLod: [
    { distance: 25, hz: 0 },     // 0 = cada fotograma
    { distance: 60, hz: 20 },
    { distance: 120, hz: 8 },
    { distance: Infinity, hz: 3 },
  ],

  clips: {
    idle: 'Idle_Loop',
    walk: 'Walk_Loop',
    jog: 'Jog_Fwd_Loop',
    run: 'Sprint_Loop',
    jumpStart: 'Jump_Start',
    jumpLoop: 'Jump_Loop',
    jumpLand: 'Jump_Land',
    fall: 'Jump_Loop',
    crouchIdle: 'Crouch_Idle_Loop',
    crouchWalk: 'Crouch_Fwd_Loop',
    swim: 'Swim_Fwd_Loop',
    swimIdle: 'Swim_Idle_Loop',
    // Interacciones que ya existen en el juego
    drive: 'Driving_Loop',
    sitEnter: 'Sitting_Enter',
    sitIdle: 'Sitting_Idle_Loop',
    sitExit: 'Sitting_Exit',
    sitTalk: 'Sitting_Talking_Loop',
    levantarse: 'LayToIdle',            // de ual2.glb
    bloqueo: 'Sword_Block',             // de ual2.glb
    pistolIdle: 'Pistol_Idle_Loop',
    pistolAim: 'Pistol_Aim_Neutral',
    pistolShoot: 'Pistol_Shoot',
    pistolReload: 'Pistol_Reload',
    interact: 'Interact',
    pickUp: 'PickUp_Table',
    push: 'Push_Loop',
    talk: 'Idle_Talking_Loop',
    dance: 'Dance_Loop',
    // Combate (Fase 3)
    roll: 'Roll',
    attack: 'Sword_Attack',
    attackIdle: 'Sword_Idle',
    punchJab: 'Punch_Jab',
    punchCross: 'Punch_Cross',
    hitChest: 'Hit_Chest',
    hitHead: 'Hit_Head',
    death: 'Death01',
  },

  // Velocidad a la que cada clip de locomoción se ve natural (m/s): con esto se mezcla por velocidad real.
  locomotionSpeeds: { idle: 0, walk: 1.6, jog: 4.2, run: 8.5 },

  // Duración de las transiciones entre estados, en segundos.
  fade: { default: 0.18, quick: 0.08, slow: 0.35 },

  // Huesos a los que se enganchan accesorios (nombres de Unreal, los del esqueleto compartido).
  attachBones: { head: 'Head', chest: 'spine_03', handR: 'hand_r', handL: 'hand_l', back: 'spine_02' },
};

// ───────────────────────── Catálogo de apariencia (creación de personaje) ─────────────────────────
//
// Sólo entra lo que el paquete gratuito trae. Los nombres en pantalla son los del oficio en Pitalito, no los del
// paquete: "Peasant" es la ropa de trabajo del campo, que aquí es la del caficultor.

export const APPEARANCE = {
  cuerpo: [
    { id: 'a', nombre: 'Complexión A', file: BASE + 'base/Superhero_Male_FullBody.gltf', ropa: 'Male' },
    { id: 'b', nombre: 'Complexión B', file: BASE + 'base/Superhero_Female_FullBody.gltf', ropa: 'Female' },
    // Generado sobre el mismo armature (ver scripts/lib/make-skeleton.py). No aparece en la creación de
    // personaje: es el cuerpo de los enemigos de las facciones.
    { id: 'esqueleto', nombre: 'Esqueleto', file: BASE + 'enemies/skeleton.glb', ropa: 'Male', oculto: true },
  ],

  pelo: [
    { id: 'ninguno', nombre: 'Sin pelo', file: null },
    { id: 'partido', nombre: 'Partido', file: BASE + 'base/Hair_SimpleParted.gltf' },
    { id: 'corto', nombre: 'Al rape', file: BASE + 'base/Hair_Buzzed.gltf' },
    { id: 'corto-b', nombre: 'Corto', file: BASE + 'base/Hair_BuzzedFemale.gltf' },
    { id: 'largo', nombre: 'Largo', file: BASE + 'base/Hair_Long.gltf' },
    { id: 'monos', nombre: 'Recogido', file: BASE + 'base/Hair_Buns.gltf' },
  ],

  barba: [
    { id: 'ninguna', nombre: 'Sin barba', file: null },
    { id: 'barba', nombre: 'Barba', file: BASE + 'base/Hair_Beard.gltf' },
  ],

  // La ropa se compone por piezas; `{S}` se cambia por Male/Female según la complexión.
  ropa: [
    {
      id: 'campo',
      nombre: 'Ropa de trabajo',
      detalle: 'La del cafetal: camisa de manga larga, pantalón y botas',
      partes: ['{S}_Peasant_Body', '{S}_Peasant_Arms', '{S}_Peasant_Legs', '{S}_Peasant_Feet'],
    },
    {
      id: 'camino',
      nombre: 'Ropa de camino',
      detalle: 'Más cerrada, para el monte y la noche',
      partes: ['{S}_Ranger_Body', '{S}_Ranger_Arms', '{S}_Ranger_Legs', '{S}_Ranger_Feet'],
    },
    {
      id: 'mixta',
      nombre: 'Camisa y botas de monte',
      detalle: 'Camisa del cafetal con el pantalón y las botas del camino',
      partes: ['{S}_Peasant_Body', '{S}_Peasant_Arms', '{S}_Ranger_Legs', '{S}_Ranger_Feet'],
    },
    // No hay "arremangada" (torso sin `Arms`): las bandas de cuero de las mangas vienen en la pieza del torso y,
    // sin el brazo de la camisa debajo, quedan flotando alrededor del brazo desnudo. Se probó y se quitó.
    {
      id: 'chaqueta',
      nombre: 'Chaqueta de camino',
      detalle: 'Chaqueta cerrada sobre el pantalón de trabajo',
      partes: ['{S}_Ranger_Body', '{S}_Ranger_Arms', '{S}_Peasant_Legs', '{S}_Peasant_Feet'],
    },
    { id: 'ninguna', nombre: 'Sin ropa', detalle: 'Sólo el cuerpo', partes: [] },
    // Sólo torso y pantalón: deja los brazos y los pies a la vista. Lo usan las facciones, para que se vea que
    // debajo del uniforme no hay nadie. No aparece en la creación de personaje.
    { id: 'uniforme', nombre: 'Uniforme', detalle: '', oculto: true, partes: ['{S}_Ranger_Body', '{S}_Ranger_Legs'] },
  ],

  // Accesorios del mismo paquete que se encienden y se apagan (un clic en el icono). La capucha tapa el pelo y no
  // va con el sombrero: el creador apaga el otro al encender uno.
  capucha: [
    { id: 'no', nombre: 'Sin capucha' },
    { id: 'si', nombre: 'Capucha', parte: '{S}_Ranger_Head_Hood' },
  ],
  hombreras: [
    { id: 'no', nombre: 'Sin hombrera' },
    { id: 'si', nombre: 'Hombrera de cuero', parte: '{S}_Ranger_Acc_Pauldrons' },
  ],

  sombrero: [
    { id: 'aguadeno', nombre: 'Sombrero aguadeño', detalle: 'El de la región' },
    { id: 'ninguno', nombre: 'Sin sombrero', detalle: '' },
  ],

  // Tonos de piel: se aplican como tinte sobre la textura del cuerpo.
  piel: [
    { id: 'hueso', nombre: 'Hueso', color: '#d8d2c0', oculto: true },
    { id: 'muerto', nombre: 'Muerto', color: '#8f9a7c', oculto: true },     // zombis (modo supervivencia)
    { id: 'muerto2', nombre: 'Muerto', color: '#a59a86', oculto: true },
    { id: '1', nombre: 'Claro', color: '#e8c39e' },
    { id: '2', nombre: 'Medio', color: '#c68a5e' },
    { id: '3', nombre: 'Trigueño', color: '#a0714f' },
    { id: '4', nombre: 'Oscuro', color: '#6f4630' },
    { id: '5', nombre: 'Canela', color: '#b47b52' },
    { id: '6', nombre: 'Moreno', color: '#87573a' },
    { id: '7', nombre: 'Muy oscuro', color: '#4e3022' },
  ],

  pelocolor: [
    { id: 'negro', nombre: 'Negro', color: '#1b1410' },
    { id: 'castano', nombre: 'Castaño', color: '#4a2f1d' },
    { id: 'claro', nombre: 'Claro', color: '#a87a45' },
    { id: 'cano', nombre: 'Cano', color: '#b9b2a6' },
    { id: 'rojizo', nombre: 'Rojizo', color: '#6e3420' },
    { id: 'rubio', nombre: 'Rubio', color: '#c49a5e' },
    { id: 'gris', nombre: 'Gris', color: '#6a645d' },
  ],
};

// El paquete no nombra igual todas las piezas de los dos cuerpos: el masculino trae `Feet_Boots` y una sola
// hombrera. Sin esto la ropa de camino del cuerpo A salía sin botas (el archivo `Male_Ranger_Feet` no existe).
export const PIEZAS_RENOMBRADAS = {
  Male_Ranger_Feet: 'Male_Ranger_Feet_Boots',
  Male_Ranger_Acc_Pauldrons: 'Male_Ranger_Acc_Pauldron',
};

// Oficios de Pitalito como "clase de origen" (el starting class de Souls). Cada uno fija una apariencia inicial y
// la partida con que se arranca, que cambia según el modo de juego:
//   · `arma`  — la que se tiene en la mano al sacar el arma (X). Las de mano están siempre; ésta va primero.
//   · `mochila` — sólo en modo supervivencia (el de historia no tiene inventario): lo que llevaba encima cuando
//     empezó el brote. Ids de src/config/loot.config.js → ITEMS. Se entrega una sola vez por personaje guardado.
// Las mochilas son **estimadas** (diseño de juego, no dato): se apagan con PARTIDA.entregar = false.
// Los oficios salen de la economía real del municipio (ver src/config/municipio.config.js y docs/HISTORIA.md).
export const ORIGENES = [
  {
    id: 'caficultor', nombre: 'Caficultor',
    detalle: '22.064 hectáreas de cultivos permanentes. Empieza con machete y buena resistencia.',
    apariencia: { ropa: 'campo', sombrero: 'aguadeno' }, arma: 'machete',
    mochila: { agua: 2, panela: 3, venda: 1 },
  },
  {
    id: 'arriero', nombre: 'Arriero',
    detalle: 'Los caminos de herradura del sur. Aguanta más carga y camina más rápido.',
    apariencia: { ropa: 'camino', sombrero: 'aguadeno' }, arma: 'rejo',
    mochila: { agua: 3, arroz: 2, cuerda: 1, linterna: 1 },
  },
  {
    id: 'chivero', nombre: 'Chivero',
    detalle: 'Conduce la chiva por la vereda. Empieza conociendo todas las vías.',
    apariencia: { ropa: 'campo', sombrero: 'ninguno' }, arma: 'garrote',
    mochila: { gasolina: 2, agua: 1, pan: 2, radio: 1 },
  },
  {
    id: 'guaquero', nombre: 'Guaquero',
    detalle: 'Busca lo que el valle enterró. Ve las piezas de historia desde más lejos.',
    apariencia: { ropa: 'camino', sombrero: 'ninguno' }, arma: 'azadon',
    mochila: { linterna: 1, pilas: 2, vela: 3, agua: 1 },
  },
  {
    id: 'galeria', nombre: 'De la galería',
    detalle: 'La plaza de mercado, 1.608 empresas registradas. Negocia mejor y carga más.',
    apariencia: { ropa: 'campo', sombrero: 'ninguno' }, arma: 'peinilla',
    mochila: { fruta: 4, enlatado: 2, gaseosa: 2, arroz: 1 },
  },
  {
    id: 'estudiante', nombre: 'Estudiante',
    detalle: 'El 63 % del municipio tiene entre 15 y 59 años. Aprende la historia más rápido.',
    apariencia: { ropa: 'camino', sombrero: 'ninguno' }, arma: 'manos',
    mochila: { analgesico: 2, agua: 1, pan: 1, radio: 1 },
  },
];

// Apariencia por defecto: la del caficultor, que es la imagen del municipio.
export const DEFAULT_LOOK = {
  origen: 'caficultor',
  cuerpo: 'a', pelo: 'partido', barba: 'ninguna', ropa: 'campo', sombrero: 'aguadeno',
  piel: '3', pelocolor: 'negro', capucha: 'no', hombreras: 'no',
};

// Personajes guardados (Settings → `personajes`): { id, nombre, look, modo, mochilaEntregada }.
export const PARTIDA = {
  entregar: true,       // false: nadie recibe mochila inicial (sólo el arma del oficio)
  maxPersonajes: 8,
  maxNombre: 24,
  nombrePorDefecto: 'Laboyano',
};
