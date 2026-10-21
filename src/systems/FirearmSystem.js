import * as THREE from 'three';
import { FIREARMS } from '../config/firearms.config.js';

// Disparos: lo mismo para el jugador y para los NPC armados. El tiro es instantáneo (rayo), con dispersión y, en
// las escopetas, varios perdigones.
//
// Qué recibe el tiro, el primero en la línea:
//   - combatientes del otro bando (`CombatSystem.combatants`): un cilindro vertical de 0,35 m × 1,8 m;
//   - zombis de la horda lejana (impostores): mismo cilindro; un tiro los tumba y se retiran de la horda;
//   - el mundo (edificios, suelo, vehículos): corta el rayo, para no disparar a través de las paredes.
//
// Cada disparo hace ruido (`ruido` metros): los zombis que lo oyen vienen.
// Emite: combat:hit (si participa el jugador) · combat:impacto (partículas) · firearm:shot { x, y, z, arma, team }.

const R = 0.35, ALTO = 1.8;
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _ray = new THREE.Raycaster();

// Distancia a la que el rayo entra en el cilindro vertical (base en p, radio R, alto ALTO), o Infinity.
function rayoCilindro(o, d, px, py, pz) {
  const ox = o.x - px, oz = o.z - pz;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-8) return Infinity;
  const b = 2 * (ox * d.x + oz * d.z), c = ox * ox + oz * oz - R * R;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return Infinity;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < 0) return Infinity;
  const y = o.y + d.y * t;
  return y >= py && y <= py + ALTO ? t : Infinity;
}

export class FirearmSystem {
  constructor(game) {
    this.g = game;
    // Fogonazo: una sola luz que se enciende un instante donde se dispare (no se crean luces nuevas).
    this.luz = new THREE.PointLight('#ffcf7a', 0, 9, 2);
    game.scene.add(this.luz);
    this.luzT = 0;
  }

  /**
   * @param tirador  Combatant que dispara (team, position)
   * @param origen   Vector3 de donde sale el rayo (la cámara para el jugador, la boca del arma para un NPC)
   * @param dir      Vector3 normalizado
   * @param id       clave de FIREARMS
   * @param precision  multiplica la dispersión (1 = la del arma; los NPC fallan más)
   */
  disparar(tirador, origen, dir, id, { precision = 1, boca = null, dano = 1 } = {}) {
    const f = FIREARMS[id];
    // Los perdigones de un mismo tiro se suman y se cobran de una vez: si no, la invulnerabilidad que deja el
    // primero (invulnerableAfterHit) se tragaría los demás.
    const golpes = new Map();
    for (let p = 0; p < f.perdigones; p++) {
      _d.copy(dir);
      const s = f.dispersion * precision;
      _d.x += (Math.random() - 0.5) * 2 * s; _d.y += (Math.random() - 0.5) * 2 * s; _d.z += (Math.random() - 0.5) * 2 * s;
      _d.normalize();
      const g = this.#rayo(tirador, origen, _d, f);
      if (g) g.dano *= dano;
      if (g) {
        const prev = golpes.get(g.c);
        golpes.set(g.c, { dano: (prev?.dano || 0) + g.dano, zone: prev?.zone === 'head' ? 'head' : g.zone });
      }
    }
    for (const [c, g] of golpes) {
      const res = c.takeHit({ damage: g.dano, poise: 25, zone: g.zone });
      // El tiro empuja en la dirección del disparo, más cuanto más daño (la escopeta tumba).
      if (res && !res.blocked) {
        const k = Math.min(6, 1 + g.dano / 12) * (res.dead ? 1.6 : 1);
        c.character.empujar?.(dir.x * k, dir.z * k);
      }
      if (res && (c === this.g.combatSys.player || tirador === this.g.combatSys.player)) {
        this.g.events.emit('combat:hit', { ...res, attacker: tirador.team });
      }
    }
    const acerto = golpes.size > 0;
    const b = boca || origen;
    this.luz.position.copy(b);
    this.luz.intensity = 6;
    this.luzT = 0.05;
    this.g.zombies?.ruido(b.x, b.z, f.ruido);
    this.g.audio?.disparo?.(f.ruido / 100, Math.hypot(b.x - this.g.camera.position.x, b.z - this.g.camera.position.z));
    this.g.events.emit('firearm:shot', { x: b.x, y: b.y, z: b.z, arma: id, team: tirador.team });
    return acerto;
  }

  #rayo(tirador, origen, dir, f) {
    // 1) El mundo: hasta dónde llega antes de chocar.
    let tMundo = f.alcance;
    _ray.set(origen, dir);
    _ray.far = f.alcance;
    const hits = _ray.intersectObjects(this.g.playerSys.worldTargets(), true);
    const h = hits.find((x) => x.object.visible && x.object.name !== 'contact-shadow');
    if (h) tMundo = h.distance;
    const bloque = this.g.blocks.raycast(origen, dir, f.alcance);
    if (bloque) tMundo = Math.min(tMundo, bloque.t);

    // 2) El combatiente más cercano en la línea.
    let mejor = null, tMejor = tMundo;
    for (const c of this.g.combatSys.combatants) {
      if (c === tirador || !c.alive || c.team === tirador.team) continue;
      // Los comerciantes y sus guardias no son blanco del jugador (ni el jugador de ellos).
      if (c.team === 'superviviente' && tirador.team === 'player') continue;
      const p = c.position;
      // Montado en un vehículo, el jugador no está a pie: se le pega al vehículo, no al personaje.
      if (c === this.g.playerSys.combat && !this.g.playerSys.walking) continue;
      const t = rayoCilindro(origen, dir, p.x, p.y, p.z);
      if (t < tMejor) { tMejor = t; mejor = c; }
    }
    // 3) La horda lejana.
    let impostor = -1;
    const horda = tirador.team === 'zombi' ? [] : this.g.zombies?.horda || [];
    for (let i = 0; i < horda.length; i++) {
      const z = horda[i];
      const t = rayoCilindro(origen, dir, z.x, z.y, z.z);
      if (t < tMejor) { tMejor = t; mejor = null; impostor = i; }
    }

    _o.copy(origen).addScaledVector(dir, Math.min(tMejor, f.alcance));
    if (mejor) {
      const dy = _o.y - mejor.position.y;
      const zone = dy > 1.45 ? 'head' : dy < 0.8 ? 'limb' : 'body';
      // Cae con la distancia: a todo el alcance, la mitad.
      const dano = f.dano * (1 - 0.5 * Math.min(1, tMejor / f.alcance));
      this.g.events.emit('combat:impacto', { x: _o.x, y: _o.y, z: _o.z, tipo: 'carne', fuerza: 0.8 });
      return { c: mejor, dano, zone };
    }
    if (impostor >= 0) {
      this.g.zombies.abatirLejano(impostor);
      this.g.events.emit('combat:impacto', { x: _o.x, y: _o.y, z: _o.z, tipo: 'carne', fuerza: 0.8 });
      return null;
    }
    if (tMejor < f.alcance) this.g.events.emit('combat:impacto', { x: _o.x, y: _o.y, z: _o.z, tipo: 'metal', fuerza: 0.4 });
    return null;
  }

  update(dt) {
    if (this.luzT > 0) { this.luzT -= dt; if (this.luzT <= 0) this.luz.intensity = 0; }
  }
}
