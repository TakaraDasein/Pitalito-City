import * as THREE from 'three';
import { projection } from '../geo/projection.js';
import { WORLD } from '../config/world.config.js';

// Suelo = imagen satelital real sobre el relieve real. Teselas Web Mercator en tres niveles:
//   z18 (~0,6 m/px) cerca del jugador, z16 (~2,4 m/px) alrededor, z14 (~9,5 m/px) todo el valle.
// Cada tesela es una malla que sigue el terreno; los niveles gruesos van un poco más abajo para que
// el nivel fino siempre quede encima.
const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const lat2y = (lat, z) => ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z;
const x2lon = (x, z) => (x / 2 ** z) * 360 - 180;
const y2lat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

// Textura de detalle (grano de asfalto/tierra, media 0,5) que se multiplica sobre la foto satelital
// cerca de la cámara: a ras de calle el suelo deja de verse como una foto borrosa.
let detailTexture = null;
function makeDetail() {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d'), img = ctx.createImageData(S, S);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const blot = new Float32Array(S * S);
  for (let k = 0; k < 40; k++) {
    const cx = rnd() * S, cy = rnd() * S, r = 10 + rnd() * 40, a = (rnd() - 0.5) * 0.25;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = Math.min(Math.abs(x - cx), S - Math.abs(x - cx)), dy = Math.min(Math.abs(y - cy), S - Math.abs(y - cy));
      const d = Math.hypot(dx, dy) / r;
      if (d < 1) blot[y * S + x] += a * (1 - d * d);
    }
  }
  for (let i = 0; i < S * S; i++) {
    const v = Math.max(0, Math.min(1, 0.5 + (rnd() - 0.5) * 0.22 + blot[i]));
    img.data.set([v * 255, v * 255, v * 255, 255], i * 4);
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export const groundDetail = { enabled: true };

function addDetail(mat) {
  detailTexture ||= makeDetail();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.detailMap = { value: detailTexture };
    sh.uniforms.detailOn = { value: groundDetail.enabled ? 1 : 0 };
    mat.userData.shader = sh;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform sampler2D detailMap;\nuniform float detailOn;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float dFade = detailOn * (1.0 - smoothstep(20.0, 110.0, distance(vWPos, cameraPosition)));
        float dA = texture2D(detailMap, vWPos.xz / 2.3).r;
        float dB = texture2D(detailMap, vWPos.xz / 13.0).r;
        diffuseColor.rgb *= mix(1.0, (dA * 2.0) * (0.75 + dB * 0.5), dFade * 0.8);`);
  };
  mat.customProgramCacheKey = () => 'ground-detail';
}

class ImageryLevel {
  constructor({ zoom, radius, segments, sink, scene, terrain, loader, maxAniso }) {
    Object.assign(this, { zoom, radius, segments, sink, scene, terrain, loader, maxAniso });
    this.tiles = new Map();
    this.material = null;
  }

  #mesh(tx, ty) {
    const S = this.segments, z = this.zoom;
    const pos = new Float32Array((S + 1) * (S + 1) * 3), uv = new Float32Array((S + 1) * (S + 1) * 2);
    for (let j = 0; j <= S; j++) {
      const lat = y2lat(ty + j / S, z);
      for (let i = 0; i <= S; i++) {
        const lon = x2lon(tx + i / S, z);
        const [x, wz] = projection.toWorld(lat, lon);
        const k = j * (S + 1) + i;
        pos.set([x, this.terrain.height(x, wz) - this.sink, wz], k * 3);
        uv.set([i / S, 1 - j / S], k * 2);
      }
    }
    const idx = [];
    for (let j = 0; j < S; j++)
      for (let i = 0; i < S; i++) {
        const a = j * (S + 1) + i, b = a + 1, c = a + S + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ color: '#8a9278' });
    if (this.zoom >= 18) addDetail(mat);
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = this.zoom >= 18;
    mesh.name = `imagery:${z}/${tx}/${ty}`;
    const url = WORLD.imagery.url.replace('{z}', z).replace('{y}', ty).replace('{x}', tx);
    this.loader.load(url, (tex) => {
      if (!this.tiles.has(`${tx}_${ty}`)) { tex.dispose(); return; }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = this.maxAniso;
      mat.map = tex; mat.color.set('#ffffff'); mat.needsUpdate = true;
    });
    return mesh;
  }

  update(x, z) {
    const g = projection.toGeo(x, z);
    const cx = lon2x(g.lon, this.zoom), cy = lat2y(g.lat, this.zoom);
    const tileMeters = (40075016 * Math.cos((g.lat * Math.PI) / 180)) / 2 ** this.zoom;
    const r = Math.ceil(this.radius / tileMeters);
    const needed = new Set();
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const tx = Math.floor(cx) + dx, ty = Math.floor(cy) + dy;
        const key = `${tx}_${ty}`;
        needed.add(key);
        if (!this.tiles.has(key)) {
          this.tiles.set(key, null);
          const mesh = this.#mesh(tx, ty);
          this.tiles.set(key, mesh);
          this.scene.add(mesh);
        }
      }
    for (const [key, mesh] of this.tiles) {
      if (needed.has(key)) continue;
      this.scene.remove(mesh);
      mesh.geometry.dispose(); mesh.material.map?.dispose(); mesh.material.dispose();
      this.tiles.delete(key);
    }
  }
}

export class ImageryGround {
  constructor(scene, terrain, renderer) {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const common = { scene, terrain, loader, maxAniso: Math.min(8, renderer.capabilities.getMaxAnisotropy()) };
    const { nearZoom, farZoom } = WORLD.imagery;
    this.levels = [
      new ImageryLevel({ ...common, zoom: nearZoom, radius: 420, segments: 16, sink: 0 }),
      new ImageryLevel({ ...common, zoom: nearZoom - 2, radius: 1800, segments: 24, sink: 0.6 }),
      new ImageryLevel({ ...common, zoom: farZoom, radius: WORLD.terrain.radius - 1500, segments: 40, sink: 2.5 }),
    ];
    this.timer = 0;
  }

  update(dt, x, z, force = false) {
    this.timer -= dt;
    if (this.timer > 0 && !force) return;
    this.timer = 0.5;
    for (const l of this.levels) l.update(x, z);
  }
}
