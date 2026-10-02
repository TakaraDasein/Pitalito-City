import { Terrain } from '../Terrain.js';
import { buildingGeometry } from '../builders/BuildingBuilder.js';
import { transferables } from '../GeometryBatch.js';

// Hilo aparte que construye la geometría de los edificios de un tile.
//
// Por qué: la medición en GPU real (docs/MEDICIONES.md) daba un **pico de 26-29 ms** por fotograma frente a 7-10
// de media, y ese pico es construir un tile en el hilo principal. Se siente como un tirón al avanzar por la
// ciudad. Aquí esa cuenta se hace fuera, y el hilo principal sólo recibe los números y arma las mallas.
//
// Qué se puede mover y qué no: la geometría de fachadas es aritmética pura y se va; los **materiales** se quedan
// en el hilo principal (pertenecen al renderizador) y la **colisión** también, porque es barata y vive en una
// estructura compartida. Por eso el Worker devuelve lotes `{ mat, a }` y no mallas.
//
// three.js funciona en un Worker: lo único que necesita un canvas es el renderizador, y aquí no se usa.

let terrain = null;

self.onmessage = (e) => {
  const msg = e.data;

  if (msg.tipo === 'terreno') {
    // El relieve llega una sola vez, como copia del Int16Array. Lo necesitan todos los tiles.
    terrain = msg.meta ? new Terrain(msg.meta, msg.buffer) : Terrain.flat();
    self.postMessage({ tipo: 'listo' });
    return;
  }

  if (msg.tipo === 'tile') {
    try {
      const lotes = buildingGeometry(msg.data, terrain || Terrain.flat());
      self.postMessage({ tipo: 'tile', key: msg.key, lotes }, transferables(lotes));
    } catch (err) {
      // Si algo falla, se avisa y el hilo principal lo construye él mismo: nunca se queda un tile sin edificios.
      self.postMessage({ tipo: 'error', key: msg.key, mensaje: String(err?.message || err) });
    }
  }
};
