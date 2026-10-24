import * as THREE from 'three';
import { GeometryBatch, ribbon, dashes } from '../GeometryBatch.js';
import { roadClass } from '../../config/roads.config.js';
import { WORLD } from '../../config/world.config.js';
import { LAYER } from '../../materials/MaterialLibrary.js';

const MAJOR = new Set(['trunk', 'primary', 'secondary']);
const LIFT = 0.12; // metros sobre el terreno

// Calzadas sobre el relieve real. Por defecto solo la calzada semitransparente sobre la imagen satelital;
// andenes y demarcación se activan en WORLD.roads si se quieren (no provienen de datos reales).
export const RoadBuilder = {
  id: 'roads',
  build(tile, { materials, terrain }) {
    const ground = (x, z) => terrain.height(x, z);
    const cfg = WORLD.roads;
    const surfaces = { asphalt: new GeometryBatch(), brick: new GeometryBatch(), dirt: new GeometryBatch() };
    const sidewalk = new GeometryBatch();
    const white = new GeometryBatch();
    const yellow = new GeometryBatch();

    const roads = [...tile.roads].sort((a, b) => roadClass(a.c).rank - roadClass(b.c).rank);
    for (const r of roads) {
      const spec = roadClass(r.c);
      const hw = spec.width / 2;
      if (cfg.sidewalks && spec.sidewalk > 0) ribbon(sidewalk, r.p, hw + spec.sidewalk, LIFT - 0.02, { uScale: 3, vScale: 3, ground });
      const surface = r.s || spec.surface || 'asphalt'; // r.s: superficie real marcada en el pipeline (adoquín del parque)
      ribbon(surfaces[surface], r.p, hw, LIFT, { uScale: surface === 'brick' ? 4 : 12, vScale: surface === 'brick' ? 4 : 12, ground });
      if (!cfg.markings || surface !== 'asphalt') continue;
      if (MAJOR.has(r.c)) {
        dashes(yellow, r.p, 0.09, LIFT + 0.01, 1e6, 0, 0.18);
        dashes(yellow, r.p, 0.09, LIFT + 0.01, 1e6, 0, -0.18);
      } else if (spec.width >= 6.5) {
        dashes(white, r.p, 0.07, LIFT + 0.01, 3, 5);
      }
    }
    if (cfg.markings) for (const b of [white, yellow]) for (let i = 1; i < b.pos.length; i += 3) b.pos[i] += ground(b.pos[i - 1], b.pos[i + 1]);

    const out = [];
    const add = (batch, mat, order) => {
      const g = batch.build();
      if (!g) return;
      const m = new THREE.Mesh(g, mat);
      m.renderOrder = order;
      m.receiveShadow = true;
      out.push(m);
    };
    add(sidewalk, materials.get('sidewalk'), LAYER.SIDEWALK);
    add(surfaces.dirt, materials.get('dirt'), LAYER.ROAD);
    add(surfaces.brick, materials.get('brick'), LAYER.ROAD);
    add(surfaces.asphalt, materials.get('asphalt'), LAYER.ROAD);
    add(white, materials.get('marking'), LAYER.MARKING);
    add(yellow, materials.get('markingYellow'), LAYER.MARKING);
    return out;
  },
};
