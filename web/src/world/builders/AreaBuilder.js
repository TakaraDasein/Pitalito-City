import * as THREE from 'three';
import { GeometryBatch, flatPolygon, ribbon } from '../GeometryBatch.js';
import { LAYER } from '../../materials/MaterialLibrary.js';

// Parques, plazas, parqueaderos, cuerpos de agua y ríos.
export function buildAreas(areas, materials) {
  const byKind = new Map();
  for (const a of areas) {
    if (!byKind.has(a.k)) byKind.set(a.k, new GeometryBatch());
    flatPolygon(byKind.get(a.k), a.p, 0.01, a.k === 'plaza-main' ? 4 : 8);
  }
  const out = [];
  for (const [kind, batch] of byKind) {
    const g = batch.build();
    if (!g) continue;
    const m = new THREE.Mesh(g, materials.area(kind));
    m.renderOrder = kind === 'water' ? LAYER.WATER : LAYER.AREA;
    m.receiveShadow = true;
    out.push(m);
  }
  return out;
}

export const AreaBuilder = {
  id: 'areas',
  build(tile, { materials }) {
    const out = buildAreas(tile.areas, materials);
    if (tile.water.length) {
      const batch = new GeometryBatch();
      for (const w of tile.water) ribbon(batch, w.p, w.w / 2, 0.015, { uScale: 10, vScale: 10 });
      const m = new THREE.Mesh(batch.build(), materials.get('water'));
      m.renderOrder = LAYER.WATER;
      out.push(m);
    }
    return out;
  },
};
