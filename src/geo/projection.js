// Proyección local equirectangular (suficientemente precisa para ~10 km).
// Ejes del mundo 3D: +X = este, −Z = norte, Y = altura (metros).
import { WORLD } from '../config/world.config.js';

const R_LAT = 110540; // metros por grado de latitud
const R_LON = 111320; // metros por grado de longitud en el ecuador

export function createProjection(origin = WORLD.origin) {
  const cosLat = Math.cos((origin.lat * Math.PI) / 180);
  return {
    origin,
    toWorld(lat, lon) {
      return [(lon - origin.lon) * cosLat * R_LON, -(lat - origin.lat) * R_LAT];
    },
    toGeo(x, z) {
      return { lat: origin.lat - z / R_LAT, lon: origin.lon + x / (cosLat * R_LON) };
    },
  };
}

export const projection = createProjection();
