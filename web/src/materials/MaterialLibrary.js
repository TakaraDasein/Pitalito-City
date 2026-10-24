import * as THREE from 'three';
import * as P from './ProceduralTextures.js';
import { AREA_COLORS } from '../config/palette.config.js';
import { WORLD } from '../config/world.config.js';

// Capas planas del suelo: se dibujan en orden (sin escribir profundidad) para evitar z-fighting
// entre calles superpuestas. Todo lo que tiene volumen se dibuja después con profundidad normal.
export const LAYER = { SKY: -10, GROUND: 0, AREA: 1, WATER: 2, SIDEWALK: 3, ROAD: 4, MARKING: 5, OVERLAY: 6 };

// Capas sobre el terreno: prueban profundidad contra el suelo pero no la escriben, con un sesgo
// de profundidad para no parpadear. El stencil evita que dos calzadas translúcidas se sumen en los cruces.
function flat(params) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, ...params });
  m.depthWrite = false;
  m.polygonOffset = true;
  m.polygonOffsetFactor = -2;
  m.polygonOffsetUnits = -4;
  return m;
}
function onceStencil(m) {
  m.stencilWrite = true;
  m.stencilRef = 1;
  m.stencilFunc = THREE.NotEqualStencilFunc;
  m.stencilZPass = THREE.ReplaceStencilOp;
  return m;
}

// Registro central de materiales: los builders piden materiales por nombre, nunca los crean.
export class MaterialLibrary {
  constructor(assets) {
    this.assets = assets;
    this.m = {};
    this.nightMaterials = [];
  }

  async load() {
    const [asphalt, sidewalk, grass, ground, plaster, roof] = await Promise.all(
      ['asphalt', 'sidewalk', 'grass', 'ground', 'plaster', 'roof'].map((n) => this.assets.pbr(n)),
    );
    const pbr = (set, extra = {}) => ({
      map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap, ...extra,
    });

    this.m.ground = flat({ ...pbr(grass), color: '#a9b98a' });
    const op = WORLD.roads.opacity;
    this.m.asphalt = onceStencil(flat({ ...pbr(asphalt), color: '#8c8c8c', normalScale: new THREE.Vector2(0.6, 0.6), transparent: op < 1, opacity: op }));
    this.m.sidewalk = flat({ ...pbr(sidewalk), color: '#d9d2c7' });
    this.m.dirt = onceStencil(flat({ ...pbr(ground), color: '#c9b48a', transparent: op < 1, opacity: op }));
    // Calles de adoquín alrededor del parque: casi opacas (el adoquín es real y la foto satelital lo ve borroso)
    this.m.brick = onceStencil(flat({ map: P.brickPaving(), color: '#ffffff', roughness: 0.85, transparent: true, opacity: 0.93 }));
    const paving = P.parkPaving();
    paving.repeat.set(1 / 6, 1 / 6);
    this.m.parkPaving = flat({ map: paving, color: '#ffffff', roughness: 0.8 });
    this.m.lawn = flat({ ...pbr(grass), color: '#8cc063' });
    this.m.marking = flat({ color: '#f2f2f2', roughness: 0.6 });
    this.m.markingYellow = flat({ color: '#f2c230', roughness: 0.6 });
    this.m.water = flat({ color: '#3f7fa6', roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.92 });
    this.m.route = flat({ color: '#b04dff', emissive: '#b04dff', emissiveIntensity: 0.9, transparent: true, opacity: 0.85 });

    // Manchas de sangre del combate (src/render/Sangre.js): por encima del suelo, sin escribir profundidad.
    this.m.sangre = new THREE.MeshStandardMaterial({
      color: '#4a0606', roughness: 0.35, transparent: true, opacity: 0.85, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
    this.m.area = {};
    for (const [kind, color] of Object.entries(AREA_COLORS)) {
      if (kind === 'plaza-main') this.m.area[kind] = this.m.brick;
      else if (kind === 'plaza') this.m.area[kind] = flat({ ...pbr(sidewalk), color: '#e8e0d4' });
      else if (kind === 'water') this.m.area[kind] = this.m.water;
      else if (kind === 'parking') this.m.area[kind] = flat({ ...pbr(asphalt), color: '#9a9a9a' });
      else if (kind === 'lot' || kind === 'farmland') this.m.area[kind] = flat({ ...pbr(ground), color });
      else this.m.area[kind] = flat({ ...pbr(grass), color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.35) });
    }

    // Fachadas: textura procedural blanca teñida por color de vértice (paleta de referencias)
    const upper = P.facadeUpper();
    const groundF = P.facadeGround();
    this.m.facadeUpper = new THREE.MeshStandardMaterial({
      map: upper.map, emissiveMap: upper.emissiveMap, emissive: '#ffffff', emissiveIntensity: 0,
      vertexColors: true, roughness: 0.88, normalMap: plaster.normalMap, normalScale: new THREE.Vector2(0.3, 0.3),
    });
    this.m.facadeGround = new THREE.MeshStandardMaterial({
      map: groundF.map, emissiveMap: groundF.emissiveMap, emissive: '#ffffff', emissiveIntensity: 0,
      vertexColors: true, roughness: 0.85,
    });
    this.m.wallPlain = new THREE.MeshStandardMaterial({ ...pbr(plaster), vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
    this.m.roofFlat = new THREE.MeshStandardMaterial({ map: P.concreteNoise(), vertexColors: true, roughness: 0.95 });
    this.m.roofTile = new THREE.MeshStandardMaterial({ ...pbr(roof), color: '#e0a080', roughness: 0.8 });
    const sheet = P.corrugated();
    this.m.roofSheet = new THREE.MeshStandardMaterial({ ...sheet, vertexColors: true, roughness: 0.5, metalness: 0.35, side: THREE.DoubleSide });
    this.wetMaterials = [this.m.asphalt, this.m.roofSheet, this.m.roofFlat, this.m.facadeGround];
    this.dryRoughness = new Map(this.wetMaterials.map((m) => [m, m.roughness]));
    this.m.lod = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.nightMaterials.push(this.m.facadeUpper, this.m.facadeGround);

    // Hitos y utilería
    this.m.whitewash = new THREE.MeshStandardMaterial({ ...pbr(plaster), color: '#fbfaf6', roughness: 0.85 });
    this.m.trimRed = new THREE.MeshStandardMaterial({ color: '#a8322b', roughness: 0.7 });
    this.m.concrete = new THREE.MeshStandardMaterial({ color: '#b9b4ab', roughness: 0.9 });
    this.m.concreteDark = new THREE.MeshStandardMaterial({ color: '#6b6862', roughness: 0.95 });
    const eb = P.exposedBrick();
    eb.repeat.set(1, 1);   // ≈ hiladas de 15 cm (antes 30 cm: se veía de bloques)
    this.m.exposedBrick = new THREE.MeshStandardMaterial({ map: eb, roughness: 0.92 });
    // Iglesia San Antonio (fotos del atrio, la fachada y la nave)
    this.m.trimSalmon = new THREE.MeshStandardMaterial({ color: '#d08a74', roughness: 0.8 });
    const at = P.atrioTiles();
    at.repeat.set(0.5, 0.5);
    this.m.atrioTiles = new THREE.MeshStandardMaterial({ map: at, roughness: 0.7 });
    // interior encalado: ambos lados (bóveda vista desde abajo) y un poco de luz propia para que la nave no
    // quede negra a la sombra del techo
    this.m.plasterInside = new THREE.MeshStandardMaterial({ ...pbr(plaster), color: '#f3f0e9', roughness: 0.9, side: THREE.DoubleSide, emissive: '#fff4e2', emissiveIntensity: 0.3 });
    // la bóveda mira hacia abajo y recibe el color "suelo" de la luz hemisférica: más luz propia
    this.m.plasterVault = this.m.plasterInside.clone();
    this.m.plasterVault.emissiveIntensity = 0.6;
    this.m.gilded = new THREE.MeshStandardMaterial({ color: '#c9a24a', roughness: 0.35, metalness: 0.75, emissive: '#3a2a08', emissiveIntensity: 0.4 });
    this.m.marbleFloor = new THREE.MeshStandardMaterial({ color: '#d8d0c2', roughness: 0.35, emissive: '#2a2620', emissiveIntensity: 0.3 });
    this.m.pewWood = new THREE.MeshStandardMaterial({ color: '#5e3519', roughness: 0.6 });
    this.m.bronze = new THREE.MeshStandardMaterial({ color: '#7a5a2c', roughness: 0.4, metalness: 0.85 });
    const sg = P.stainedGlass(), rose = P.roseWindow();
    this.m.stainedGlass = new THREE.MeshStandardMaterial({ map: sg, emissiveMap: sg, emissive: '#ffffff', emissiveIntensity: 0.75, roughness: 0.3, side: THREE.DoubleSide });
    this.m.roseWindow = new THREE.MeshStandardMaterial({ map: rose, emissiveMap: rose, emissive: '#ffffff', emissiveIntensity: 0.6, roughness: 0.3, side: THREE.DoubleSide });
    // base del muro ennegrecida por la humedad y el polvo de la calle (Street View, Calle 5)
    this.m.exposedBrickOld = new THREE.MeshStandardMaterial({ map: eb, color: '#7d6c5c', roughness: 0.95 });
    // Alcaldía La Chapolera (Street View may 2025): podio de piedra veteada, marco de pizarra oscura, muro cortina
    // de vidrio verdoso y baranda de vidrio
    const sv = P.stonePanels({ base: '#8a7468', veteado: true });
    sv.repeat.set(1 / 2.4, 1 / 2.4);
    this.m.stoneVeined = new THREE.MeshStandardMaterial({ map: sv, roughness: 0.45, metalness: 0.05 });
    const ss = P.stonePanels({ base: '#6b6058', veteado: false, seed: 7 });
    ss.repeat.set(1 / 2.4, 1 / 2.4);
    this.m.stoneSlate = new THREE.MeshStandardMaterial({ map: ss, roughness: 0.7 });
    this.m.curtainGlass = new THREE.MeshStandardMaterial({ color: '#b4c2b8', roughness: 0.15, metalness: 0.55 });
    this.m.glassRail = new THREE.MeshStandardMaterial({ color: '#cfe3e0', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.28, depthWrite: false });
    this.m.blossomYellow = new THREE.MeshStandardMaterial({ color: '#f2c318', roughness: 0.8 });
    // follaje de plantas en matera (interiores de los hitos); `lawn` es capa de suelo y no escribe profundidad
    this.m.foliage = new THREE.MeshStandardMaterial({ color: '#4f7d3a', roughness: 0.9 });
    this.m.darkMetal = new THREE.MeshStandardMaterial({ color: '#2a2d30', roughness: 0.5, metalness: 0.6 });
    this.m.wood = new THREE.MeshStandardMaterial({ color: '#7b4b2a', roughness: 0.8 });
    this.m.glass = new THREE.MeshStandardMaterial({ color: '#1d2a36', roughness: 0.1, metalness: 0.8 });
    this.m.lampGlow = new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#ffcf80', emissiveIntensity: 0.2 });
    this.m.headlight = new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff2c4', emissiveIntensity: 0.3 });
    this.m.taillight = new THREE.MeshStandardMaterial({ color: '#8b0000', emissive: '#ff2020', emissiveIntensity: 0.2 });
    this.nightMaterials.push(this.m.lampGlow);

    this.tex = { clock: P.clockFace(), bicentenario: P.bicentenarioSign(), chiva: P.chivaPanels(), glow: P.glowSprite(), yoPitalito: P.yoPitalito(), macizo: P.macizoBoard() };
    this.tex.chapoleraSign = P.chapoleraSign();
    this.tex.flagColombia = P.flagColombia();
    this.tex.flag = await this.assets.texture('textures/decals/flag-pitalito.png', { repeat: false });
    this.tex.escudo = await this.assets.texture('textures/decals/escudo-pitalito.png', { repeat: false });
  }

  get(name) { return this.m[name]; }

  // Color liso cacheado para piezas sencillas (contenedores del botín): uno por color, compartido.
  plain(color, roughness = 0.75) {
    const cache = (this.m.plain ??= {});
    return (cache[`${color}|${roughness}`] ??= new THREE.MeshStandardMaterial({ color, roughness }));
  }

  // Lluvia: superficies mojadas más oscuras y brillantes (reflejan el cielo del mapa de entorno)
  setWet(w) {
    for (const m of this.wetMaterials) {
      m.roughness = THREE.MathUtils.lerp(this.dryRoughness.get(m), 0.18, w);
      if (m.roughnessMap && w > 0.5 !== !!m.userData.wetNoMap) {
        m.userData.wetNoMap = w > 0.5;
        m.userData.savedRoughMap ??= m.roughnessMap;
        m.roughnessMap = w > 0.5 ? null : m.userData.savedRoughMap;
        m.needsUpdate = true;
      }
    }
    this.m.asphalt.color.set('#8c8c8c').multiplyScalar(1 - w * 0.45);
  }
  area(kind) { return this.m.area[kind] || this.m.area.grass; }

  // 0 = día, 1 = noche: enciende ventanas y faroles
  setNight(f) {
    this.m.facadeUpper.emissiveIntensity = f * 0.9;
    this.m.facadeGround.emissiveIntensity = f * 1.0;
    this.m.lampGlow.emissiveIntensity = 0.2 + f * 3;
    this.m.headlight.emissiveIntensity = 0.3 + f * 4;
    this.m.taillight.emissiveIntensity = 0.2 + f * 2.5;
  }
}
