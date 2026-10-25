import { buildWillys } from './willys.js';
import { buildTaxi } from './taxi.js';
import { buildChiva } from './chiva.js';
import { buildMoto } from './moto.js';
import { buildMotocarro } from './motocarro.js';
import { buildPickup } from './pickup.js';
import { buildSedan, buildCampero, buildDobleCabina, buildBuseta, buildAmbulancia, buildFurgon, buildRecolector } from './urbanos.js';

// Registro de modelos. Interfaz común (un GLTF futuro puede registrarse igual):
// build({ materials, color, plateText, detail: 'high'|'low', driver }) →
//   { group, body, wheels: [{ pivot, spin, front, r, baseY }], headlightPos }
export const VEHICLE_MODELS = {
  willys: buildWillys, taxi: buildTaxi, chiva: buildChiva, moto: buildMoto, motocarro: buildMotocarro, pickup: buildPickup,
  // tráfico modelado en código (antes Kenney Car Kit): src/entities/vehicles/models/urbanos.js
  sedan: buildSedan, campero: buildCampero, doblecabina: buildDobleCabina, buseta: buildBuseta, ambulancia: buildAmbulancia,
  furgon: buildFurgon, recolector: buildRecolector,
};

