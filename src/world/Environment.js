import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { GAME } from '../config/game.config.js';
import { LAYER } from '../materials/MaterialLibrary.js';
import { rng } from '../geo/geometry.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Cielo, sol/luna, niebla, suelo y montañas del Valle de Laboyos. Ciclo día/noche.
export class Environment {
  // realTerrain = true: el relieve y el suelo vienen de datos reales (Terrain + ImageryGround), así que
  // no se crean el suelo plano ni las montañas procedurales.
  constructor(scene, renderer, materials, { realTerrain = false } = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.materials = materials;
    this.hour = GAME.time.startHour;
    this.timeScale = 24 / (GAME.time.dayLengthMinutes * 60); // horas de juego por segundo real
    this.night = 0;

    this.sky = new Sky();
    this.sky.scale.setScalar(20000);
    this.sky.renderOrder = LAYER.SKY;
    this.sky.material.depthWrite = false;
    this.sky.material.uniforms.turbidity.value = 2.5;
    this.sky.material.uniforms.rayleigh.value = 1.6;
    this.sky.material.uniforms.mieCoefficient.value = 0.004;
    this.sky.material.uniforms.mieDirectionalG.value = 0.85;
    scene.add(this.sky);

    this.hemi = new THREE.HemisphereLight('#cfe6ff', '#6b6a4a', 1.2);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight('#fff2dc', 2.6);
    this.sun.castShadow = true;
    const S = GAME.render.shadowRadius;
    Object.assign(this.sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 1000 });
    this.sun.shadow.mapSize.set(GAME.render.shadowMapSize, GAME.render.shadowMapSize);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun, this.sun.target);

    scene.fog = new THREE.FogExp2('#c9dbe8', realTerrain ? GAME.render.fogDensityReal : GAME.render.fogDensity);
    this.baseFog = scene.fog.density;
    this.sunDir = new THREE.Vector3();
    this.wet = 0; // 0 = seco, 1 = lluvia (lo controla WeatherSystem)

    // Mapa de entorno: el mismo cielo, prefiltrado (PMREM) → reflejos en pintura, vidrio y cromo
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envSky = new Sky();
    this.envSky.material = this.sky.material; // comparte uniformes (posición del sol)
    this.envSky.scale.setScalar(900);
    this.envScene.add(this.envSky);
    this.envTarget = null;
    this.envHour = -99;
    this.envEnabled = true;
    if (realTerrain) return;

    // Suelo base (pasto) — capa plana más baja
    const ground = new THREE.Mesh(new THREE.CircleGeometry(14000, 64).rotateX(-Math.PI / 2), materials.get('ground'));
    const uv = ground.geometry.attributes.uv, pos = ground.geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 14, pos.getZ(i) / 14);
    ground.renderOrder = LAYER.GROUND;
    ground.receiveShadow = true;
    scene.add(ground);

    scene.add(this.#mountains());
  }

  // Anillo de montañas andinas alrededor del valle (ver referencias de panorámicas).
  #mountains() {
    const rand = rng(99);
    const phases = Array.from({ length: 6 }, () => [rand() * Math.PI * 2, 2 + Math.floor(rand() * 9)]);
    const segA = 256, segR = 24, r0 = 4200, r1 = 11500;
    const pos = [], col = [], idx = [];
    const low = new THREE.Color('#5d7f45'), high = new THREE.Color('#3d5a36'), far = new THREE.Color('#6f8aa0');
    for (let j = 0; j <= segR; j++) {
      const t = j / segR, r = r0 + (r1 - r0) * t;
      for (let i = 0; i <= segA; i++) {
        const a = (i / segA) * Math.PI * 2;
        let n = 0;
        for (const [ph, f] of phases) n += Math.sin(a * f + ph + t * 3) / f;
        const ridge = Math.sin(t * Math.PI) ** 0.8;
        const h = Math.max(0, ridge * (520 + n * 520) + t * 250 + (rand() - 0.5) * 40) * smooth(0, 0.25, t);
        pos.push(Math.cos(a) * r, h, Math.sin(a) * r);
        const c = low.clone().lerp(high, Math.min(1, h / 700)).lerp(far, t * 0.6);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let j = 0; j < segR; j++)
      for (let i = 0; i < segA; i++) {
        const a = j * (segA + 1) + i, b = a + segA + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.name = 'mountains';
    return m;
  }

  setHour(h) { this.hour = ((h % 24) + 24) % 24; this.envHour = -99; }

  applyQuality(q) {
    this.sun.castShadow = q.shadows;
    const S = q.shadowRadius;
    Object.assign(this.sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S });
    this.sun.shadow.camera.updateProjectionMatrix();
    if (this.sun.shadow.mapSize.x !== q.shadowMapSize) {
      this.sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.shadowRadius = S;
    this.envEnabled = q.envMap;
    if (!q.envMap) this.scene.environment = null;
    this.envHour = -99;
  }

  #updateEnvMap() {
    // se recalcula cada ~12 minutos de juego (≈ 12 s reales): suficiente para seguir al sol
    if (!this.envEnabled || Math.abs(this.hour - this.envHour) < 0.2) return;
    this.envHour = this.hour;
    const old = this.envTarget;
    this.envTarget = this.pmrem.fromScene(this.envScene, 0.02, 0.1, 2000);
    this.scene.environment = this.envTarget.texture;
    old?.dispose();
  }

  // Centra la sombra en el jugador pero la ajusta a la rejilla de texeles de la luz: sin parpadeo al moverse
  #stableShadow(focus, lightDir) {
    const S = this.shadowRadius || GAME.render.shadowRadius;
    const texel = (2 * S) / this.sun.shadow.mapSize.x;
    const rot = new THREE.Matrix4().lookAt(new THREE.Vector3(), lightDir.clone().negate(), new THREE.Vector3(0, 1, 0));
    const inv = rot.clone().invert();
    const p = focus.clone().applyMatrix4(inv);
    p.x = Math.round(p.x / texel) * texel; p.y = Math.round(p.y / texel) * texel;
    p.applyMatrix4(rot);
    this.sun.target.position.copy(p);
    this.sun.position.copy(p).addScaledVector(lightDir, 400);
  }

  update(dt, focus, camera) {
    this.hour = (this.hour + dt * this.timeScale) % 24;
    // Pitalito está a 1.85° N: el sol sale ~6:00 y se pone ~18:00, casi cenital al mediodía
    const theta = (Math.PI * (this.hour - 6)) / 12;
    this.sunDir.set(Math.cos(theta), Math.sin(theta), 0.12).normalize();
    const elev = this.sunDir.y;
    this.night = 1 - smooth(-0.08, 0.12, elev);
    const dusk = smooth(0, 0.35, elev) * (1 - smooth(0.35, 0.7, elev)); // tono dorado

    this.sky.position.copy(camera.position);
    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir);
    this.sky.material.uniforms.rayleigh.value = 2.2 + dusk * 1.2;

    // Luz del sol (o de la luna, en la noche)
    const lightDir = elev > -0.05 ? this.sunDir : new THREE.Vector3(-this.sunDir.x, -this.sunDir.y, 0.3).normalize();
    this.#stableShadow(focus, lightDir);
    this.sun.intensity = elev > -0.05 ? 0.4 + 4.2 * smooth(-0.05, 0.3, elev) : 0.6;
    this.sun.color.set(elev > -0.05 ? '#ffffff' : '#9fb4ff').lerp(new THREE.Color('#ffb46b'), dusk * 0.8);
    this.hemi.intensity = (1.1 + 0.3 * (1 - this.night)) * (1 - this.wet * 0.25);
    this.hemi.color.set('#cfe6ff').lerp(new THREE.Color('#3a4a78'), this.night);
    // de noche el suelo refleja el alumbrado de sodio (tono naranja)
    this.hemi.groundColor.set('#6b6a4a').lerp(new THREE.Color('#6a5040'), this.night);

    const fogDay = new THREE.Color('#c9dbe8').lerp(new THREE.Color('#f0b98a'), dusk * 0.6);
    this.scene.fog.color.copy(fogDay.lerp(new THREE.Color('#0b1020'), this.night)).lerp(new THREE.Color(this.night > 0.5 ? '#141820' : '#9aa4ad'), this.wet * 0.7);
    this.renderer.toneMappingExposure = 0.5 + 0.04 * (1 - this.night) + 0.2 * this.night;
    this.materials.setNight(this.night);
    this.scene.environmentIntensity = (0.15 + 0.55 * (1 - this.night)) * (1 - this.wet * 0.35);
    this.scene.fog.density = this.baseFog * (1 + this.wet * 2.2);
    this.sun.intensity *= 1 - this.wet * 0.7;
    this.#updateEnvMap();
  }

  get clock() {
    const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
