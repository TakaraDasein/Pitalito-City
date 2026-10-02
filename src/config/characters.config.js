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
    { id: 'ninguna', nombre: 'Sin ropa', detalle: 'Sólo el cuerpo', partes: [] },
    // Sólo torso y pantalón: deja los brazos y los pies a la vista. Lo usan las facciones, para que se vea que
    // debajo del uniforme no hay nadie. No aparece en la creación de personaje.
    { id: 'uniforme', nombre: 'Uniforme', detalle: '', oculto: true, partes: ['{S}_Ranger_Body', '{S}_Ranger_Legs'] },
  ],

  sombrero: [
    { id: 'aguadeno', nombre: 'Sombrero aguadeño', detalle: 'El de la región' },
    { id: 'ninguno', nombre: 'Sin sombrero', detalle: '' },
  ],

  // Tonos de piel: se aplican como tinte sobre la textura del cuerpo.
  piel: [
    { id: 'hueso', nombre: 'Hueso', color: '#d8d2c0', oculto: true },
    { id: '1', nombre: 'Claro', color: '#e8c39e' },
    { id: '2', nombre: 'Medio', color: '#c68a5e' },
    { id: '3', nombre: 'Trigueño', color: '#a0714f' },
    { id: '4', nombre: 'Oscuro', color: '#6f4630' },
  ],

  pelocolor: [
    { id: 'negro', nombre: 'Negro', color: '#1b1410' },
    { id: 'castano', nombre: 'Castaño', color: '#4a2f1d' },
    { id: 'claro', nombre: 'Claro', color: '#a87a45' },
    { id: 'cano', nombre: 'Cano', color: '#b9b2a6' },
  ],
};

// Oficios de Pitalito como "clase de origen" (el starting class de Souls). Cada uno fija una apariencia inicial y
// -- en la Fase 3 -- el equipo con que se arranca. Los oficios salen de la economía real del municipio
// (ver src/config/municipio.config.js y docs/HISTORIA.md).
export const ORIGENES = [
  {
    id: 'caficultor', nombre: 'Caficultor',
    detalle: '22.064 hectáreas de cultivos permanentes. Empieza con machete y buena resistencia.',
    apariencia: { ropa: 'campo', sombrero: 'aguadeno' }, equipo: ['machete'],
  },
  {
    id: 'arriero', nombre: 'Arriero',
    detalle: 'Los caminos de herradura del sur. Aguanta más carga y camina más rápido.',
    apariencia: { ropa: 'camino', sombrero: 'aguadeno' }, equipo: ['rejo'],
  },
  {
    id: 'chivero', nombre: 'Chivero',
    detalle: 'Conduce la chiva por la vereda. Empieza conociendo todas las vías.',
    apariencia: { ropa: 'campo', sombrero: 'ninguno' }, equipo: ['garrote'],
  },
  {
    id: 'guaquero', nombre: 'Guaquero',
    detalle: 'Busca lo que el valle enterró. Ve las piezas de historia desde más lejos.',
    apariencia: { ropa: 'camino', sombrero: 'ninguno' }, equipo: ['azadon'],
  },
  {
    id: 'galeria', nombre: 'De la galería',
    detalle: 'La plaza de mercado, 1.608 empresas registradas. Negocia mejor y carga más.',
    apariencia: { ropa: 'campo', sombrero: 'ninguno' }, equipo: ['peinilla'],
  },
  {
    id: 'estudiante', nombre: 'Estudiante',
    detalle: 'El 63 % del municipio tiene entre 15 y 59 años. Aprende la historia más rápido.',
    apariencia: { ropa: 'camino', sombrero: 'ninguno' }, equipo: [],
  },
];

// Apariencia por defecto: la del caficultor, que es la imagen del municipio.
export const DEFAULT_LOOK = {
  origen: 'caficultor',
  cuerpo: 'a', pelo: 'partido', barba: 'ninguna', ropa: 'campo', sombrero: 'aguadeno',
  piel: '3', pelocolor: 'negro',
};
