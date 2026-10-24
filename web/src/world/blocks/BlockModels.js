import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as P from '../../materials/ProceduralTextures.js';

// Modelo específico de cada bloque: lista de partes { geo, mat } en un cubo de 1 m con base en y = 0 y centro
// en (0.5, 0, 0.5). Cada parte se dibuja como un InstancedMesh (un draw call por parte).

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

const planks = () => canvasTex(256, 256, (ctx) => {
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = ['#8a5a33', '#7b4f2c', '#94643a', '#835530'][i];
    ctx.fillRect(0, i * 64, 256, 64);
    ctx.fillStyle = 'rgba(40,20,5,.5)'; ctx.fillRect(0, i * 64, 256, 3);
    for (let k = 0; k < 14; k++) { ctx.fillStyle = 'rgba(40,20,5,.12)'; ctx.fillRect(0, i * 64 + 6 + Math.random() * 54, 256, 1.5); }
    ctx.fillStyle = '#2b1a0c'; for (const x of [18, 238]) { ctx.beginPath(); ctx.arc(x, i * 64 + 32, 4, 0, 7); ctx.fill(); }
  }
});

const burlap = () => canvasTex(256, 256, (ctx) => {
  ctx.fillStyle = '#c8b28a'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 4) { ctx.fillStyle = 'rgba(90,70,40,.18)'; ctx.fillRect(i, 0, 2, 256); ctx.fillRect(0, i, 256, 2); }
  ctx.fillStyle = '#3b2414'; ctx.textAlign = 'center';
  ctx.font = 'bold 34px Georgia, serif'; ctx.fillText('CAFÉ', 128, 110);
  ctx.font = 'bold 22px Georgia, serif'; ctx.fillText('DEL HUILA', 128, 142);
  ctx.font = '16px Georgia, serif'; ctx.fillText('PITALITO · 70 kg', 128, 172);
  ctx.strokeStyle = '#3b2414'; ctx.lineWidth = 3; ctx.strokeRect(40, 70, 176, 120);
}, false);

const plasterWall = () => canvasTex(256, 256, (ctx) => {
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(120,110,95,${Math.random() * 0.06})`; ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3); }
  ctx.fillStyle = '#7a5a3a'; ctx.fillRect(0, 216, 256, 40); // zócalo
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(0, 214, 256, 3);
}, false);

const culmTex = () => canvasTex(64, 256, (ctx) => {
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, '#8a6a3a'); g.addColorStop(0.35, '#eedcaa'); g.addColorStop(0.7, '#cdae70'); g.addColorStop(1, '#6b4f2a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 256);
  for (const y of [60, 190]) { ctx.fillStyle = '#5a3f20'; ctx.fillRect(0, y, 64, 8); ctx.fillStyle = '#f3e4bb'; ctx.fillRect(0, y + 8, 64, 3); }
});

const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
const T = (geo) => geo.translate(0.5, 0, 0.5);

export function buildBlockModels(materials) {
  const brickTex = P.exposedBrick();
  const paveTex = P.brickPaving();
  const m = {
    brick: std({ map: brickTex, roughness: 0.9 }),
    plaster: std({ map: plasterWall(), roughness: 0.9 }),
    pave: std({ map: paveTex }),
    wood: std({ map: planks(), roughness: 0.75 }),
    frame: std({ color: '#5b3a1e', roughness: 0.7 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#9ec3d6', roughness: 0.05, transparent: true, opacity: 0.35, clearcoat: 1 }),
    bars: std({ color: '#1e1e1e', roughness: 0.4, metalness: 0.6 }),
    culm: std({ map: culmTex(), roughness: 0.55 }),
    lash: std({ color: '#5c4222', roughness: 0.95 }),
    tile: materials.get('roofTile'),
    burlap: std({ map: burlap(), roughness: 0.95 }),
    clay: std({ color: '#a4553b', roughness: 0.8 }),
    soil: std({ color: '#3b2a1c', roughness: 1 }),
    leaf: std({ color: '#3f7a2e', roughness: 0.8, side: THREE.DoubleSide }),
    flower: std({ color: '#c1121f', roughness: 0.6, side: THREE.DoubleSide }),
  };

  const culms = mergeGeometries([[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75], [0.5, 0.5]].map(([x, z], i) =>
    new THREE.CylinderGeometry(0.12 - (i === 4) * 0.02, 0.13, 1, 12).translate(x, 0.5, z)));
  const lashings = mergeGeometries([0.22, 0.78].map((y) => new THREE.CylinderGeometry(0.52, 0.52, 0.06, 16, 1, true).translate(0.5, y, 0.5)));

  // Teja: cuña (prisma) con canales de teja
  const wedge = new THREE.BufferGeometry();
  {
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1, 0), new THREE.Vector2(1, 0.12), new THREE.Vector2(0, 0.55)]);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
    wedge.copy(g);
  }
  const tileWaves = mergeGeometries(Array.from({ length: 5 }, (_, i) =>
    new THREE.CylinderGeometry(0.1, 0.1, 1.08, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2)
      .rotateX(-Math.atan2(0.43, 1)).translate(0.1 + i * 0.2, 0.36, 0.5)));

  // Costal: caja redondeada "abombada"
  const sack = new THREE.BoxGeometry(0.9, 0.78, 0.7, 6, 6, 6);
  {
    const p = sack.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + 0.12 * (1 - (2 * y / 0.78) ** 2);
      p.setXYZ(i, x * k, y, z * (1 + 0.2 * (1 - (2 * x / 0.9) ** 2)));
    }
    sack.computeVertexNormals();
    sack.translate(0.5, 0.39, 0.5);
  }

  // Ventana: marco + vidrio + reja
  const frame = mergeGeometries([
    new THREE.BoxGeometry(1, 0.1, 0.16).translate(0.5, 0.05, 0.5), new THREE.BoxGeometry(1, 0.1, 0.16).translate(0.5, 0.95, 0.5),
    new THREE.BoxGeometry(0.1, 1, 0.16).translate(0.05, 0.5, 0.5), new THREE.BoxGeometry(0.1, 1, 0.16).translate(0.95, 0.5, 0.5),
    new THREE.BoxGeometry(0.06, 0.8, 0.1).translate(0.5, 0.5, 0.5),
  ]);
  const bars = mergeGeometries(Array.from({ length: 5 }, (_, i) => new THREE.CylinderGeometry(0.012, 0.012, 0.8, 5).translate(0.18 + i * 0.16, 0.5, 0.42)));

  // Matera con flores
  const pot = new THREE.CylinderGeometry(0.3, 0.22, 0.4, 14).translate(0.5, 0.2, 0.5);
  const soil = new THREE.CylinderGeometry(0.28, 0.28, 0.02, 14).translate(0.5, 0.39, 0.5);
  const leaves = mergeGeometries(Array.from({ length: 7 }, (_, i) => new THREE.PlaneGeometry(0.16, 0.4).rotateX(-0.5).translate(0, 0.25, -0.12).rotateY((i / 7) * Math.PI * 2).translate(0.5, 0.35, 0.5)));
  const flowers = mergeGeometries(Array.from({ length: 8 }, (_, i) => new THREE.IcosahedronGeometry(0.09, 0).translate(Math.cos(i * 0.8) * 0.16, 0.62 + (i % 3) * 0.05, Math.sin(i * 0.8) * 0.16).translate(0.5, 0, 0.5)));

  return {
    guadua: [{ geo: culms, mat: m.culm }, { geo: lashings, mat: m.lash }],
    ladrillo: [{ geo: T(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), mat: m.brick }],
    panete: [{ geo: T(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), mat: m.plaster }],
    adoquin: [{ geo: T(new THREE.BoxGeometry(1, 0.25, 1).translate(0, 0.125, 0)), mat: m.pave }],
    teja: [{ geo: wedge, mat: m.clay }, { geo: tileWaves, mat: m.tile }],
    madera: [{ geo: T(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), mat: m.wood }],
    vidrio: [{ geo: frame, mat: m.frame }, { geo: T(new THREE.PlaneGeometry(0.8, 0.8).translate(0, 0.5, 0)), mat: m.glass }, { geo: bars, mat: m.bars }],
    cafe: [{ geo: sack, mat: m.burlap }],
    matera: [{ geo: pot, mat: m.clay }, { geo: soil, mat: m.soil }, { geo: leaves, mat: m.leaf }, { geo: flowers, mat: m.flower }],
  };
}
