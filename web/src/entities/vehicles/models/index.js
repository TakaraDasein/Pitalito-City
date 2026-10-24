import { buildWillys } from './willys.js';
import { buildTaxi } from './taxi.js';
import { buildChiva } from './chiva.js';
import { buildMoto } from './moto.js';
import { buildMotocarro } from './motocarro.js';
import { buildPickup } from './pickup.js';
import { buildKenney } from './kenney.js';
import { VEHICLES } from '../../../config/vehicles.config.js';

// Registro de modelos. Interfaz común (un GLTF futuro puede registrarse igual):
// build({ materials, color, plateText, detail: 'high'|'low', driver }) →
//   { group, body, wheels: [{ pivot, spin, front, r, baseY }], headlightPos }
export const VEHICLE_MODELS = {
  willys: buildWillys, taxi: buildTaxi, chiva: buildChiva, moto: buildMoto, motocarro: buildMotocarro, pickup: buildPickup,
};

// Vehículos del Kenney Car Kit: uno por entrada de VEHICLES con `kenney` (precargados en Game.init)
for (const [tipo, v] of Object.entries(VEHICLES)) if (v.kenney) VEHICLE_MODELS[v.model] = buildKenney(tipo);
