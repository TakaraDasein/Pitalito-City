// Módulo que Vite sirve a la página de tools/bake-godot.mjs: así 'three' y los addons se resuelven igual que en
// el juego (una sola copia de three, la misma que usan los modelos).
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AssetManager } from '../src/core/AssetManager.js';
import { MaterialLibrary } from '../src/materials/MaterialLibrary.js';
import { VEHICLE_MODELS } from '../src/entities/vehicles/models/index.js';
import { VEHICLES } from '../src/config/vehicles.config.js';
import { LANDMARKS } from '../src/world/landmarks/index.js';
import { Terrain } from '../src/world/Terrain.js';
import { CollisionWorld } from '../src/world/CollisionWorld.js';
import { SolidWorld } from '../src/world/SolidWorld.js';
import { RoadNetwork } from '../src/world/RoadNetwork.js';
import { MapRenderer } from '../src/ui/MapRenderer.js';

// Godot no importa EXT_mesh_gpu_instancing: cada InstancedMesh se funde en una sola malla (mismas draw calls).
// Si las instancias tienen color propio, pasa a color de vértice.
export function flattenInstances(root) {
  const list = [];
  root.traverse((o) => { if (o.isInstancedMesh) list.push(o); });
  for (const im of list) {
    const parts = [], m = new THREE.Matrix4(), c = new THREE.Color();
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, m);
      let g = im.geometry.clone().applyMatrix4(m);
      if (g.index) g = g.toNonIndexed();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
      if (im.instanceColor) {
        im.getColorAt(i, c);
        const col = new Float32Array(g.attributes.position.count * 3);
        for (let k = 0; k < col.length; k += 3) col.set([c.r, c.g, c.b], k);
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      }
      parts.push(g);
    }
    if (!parts.length) { im.removeFromParent(); continue; }
    const mat = im.instanceColor ? im.material.clone() : im.material;
    if (im.instanceColor) mat.vertexColors = true;
    const mesh = new THREE.Mesh(mergeGeometries(parts), mat);
    mesh.name = im.name;
    mesh.position.copy(im.position); mesh.quaternion.copy(im.quaternion); mesh.scale.copy(im.scale);
    im.parent.add(mesh);
    im.removeFromParent();
  }
}

export { GLTFExporter, AssetManager, MaterialLibrary, VEHICLE_MODELS, VEHICLES, LANDMARKS, Terrain, CollisionWorld, SolidWorld, RoadNetwork, MapRenderer };
