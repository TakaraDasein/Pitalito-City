import { COMBAT } from '../config/combat.config.js';

// Resuelve la pelea entre combatientes: quién alcanza a quién, fijar blanco y avisar al HUD.
//
// Los combatientes no se conocen entre sí (ver Combatant.js): aquí está la única lista y la única prueba de
// alcance. Así el mismo código sirve para el jugador contra un enemigo, para dos enemigos entre ellos y, más
// adelante, para la fauna.
//
// La prueba de alcance es un **sector**: distancia menor que el alcance del arma y ángulo dentro de su arco. Es
// barato y se lee bien; no hacen falta cajas de daño por hueso para un juego a esta escala.
//
// Emite: combat:hit { blocked, damage, dead }, combat:lock { target | null }, combat:stats { health, stamina }.

export class CombatSystem {
  constructor(game) {
    this.g = game;
    this.combatants = new Set();
    this.player = null;
  }

  add(c, { isPlayer = false } = {}) {
    this.combatants.add(c);
    if (isPlayer) this.player = c;
    return c;
  }

  remove(c) {
    this.combatants.delete(c);
    if (this.player === c) this.player = null;
  }

  // Enemigos vivos del bando contrario, ordenados por distancia.
  #enemiesOf(c, maxDist) {
    const out = [];
    for (const o of this.combatants) {
      if (o === c || !o.alive || o.team === c.team) continue;
      const d = Math.hypot(o.position.x - c.position.x, o.position.z - c.position.z);
      if (d <= maxDist) out.push({ c: o, d });
    }
    return out.sort((a, b) => a.d - b.d);
  }

  /**
   * Fija o suelta el blanco del jugador. Busca el enemigo más cercano dentro del cono de la cámara.
   * @param yaw  hacia dónde mira el jugador
   */
  toggleLock(c, yaw) {
    if (c.lockTarget) { c.lockTarget = null; this.g.events.emit('combat:lock', null); return null; }
    const { range, angle } = COMBAT.lockOn;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    let best = null;
    for (const { c: o, d } of this.#enemiesOf(c, range)) {
      const dx = (o.position.x - c.position.x) / (d || 1), dz = (o.position.z - c.position.z) / (d || 1);
      if (Math.acos(Math.max(-1, Math.min(1, dx * fx + dz * fz))) > angle) continue;
      best = o;
      break; // ya vienen ordenados por distancia
    }
    c.lockTarget = best;
    this.g.events.emit('combat:lock', best ? { x: best.position.x, z: best.position.z } : null);
    return best;
  }

  // Resuelve el golpe del combatiente que está en la fase activa de su ataque.
  #strike(c) {
    const w = c.weapon;
    const fx = -Math.sin(c.position.heading), fz = -Math.cos(c.position.heading);
    let hitSomething = false;
    for (const { c: o, d } of this.#enemiesOf(c, w.reach)) {
      const dx = (o.position.x - c.position.x) / (d || 1), dz = (o.position.z - c.position.z) / (d || 1);
      if (Math.acos(Math.max(-1, Math.min(1, dx * fx + dz * fz))) > w.arc) continue;
      // La zona depende de la diferencia de altura: sirve para el sistema y evita cajas por hueso.
      const dy = o.position.y - c.position.y;
      const zone = dy > 1.2 ? 'head' : dy < 0.4 ? 'limb' : 'body';
      const res = o.takeHit({ damage: w.damage, poise: w.poise, zone });
      if (res) {
        hitSomething = true;
        if (c === this.player || o === this.player) this.g.events.emit('combat:hit', { ...res, attacker: c.team });
        // Dónde y contra qué: lo usa el ambiente para las partículas del impacto.
        this.g.events.emit('combat:impacto', {
          x: o.position.x, y: o.position.y + (zone === 'head' ? 1.6 : 1.0), z: o.position.z,
          tipo: o.team === 'faccion' ? 'hueso' : res.blocked ? 'metal' : 'carne',
          fuerza: Math.min(1.6, w.damage / 20),
        });
      }
    }
    // La fauna no es un combatiente (no tiene resistencia ni ataca con armas), pero sí recibe el golpe.
    for (const a of this.g.wildlife?.animals || []) {
      if (a.muerto) continue;
      const d = Math.hypot(a.x - c.position.x, a.z - c.position.z);
      if (d > w.reach) continue;
      const dx = (a.x - c.position.x) / (d || 1), dz = (a.z - c.position.z) / (d || 1);
      if (Math.acos(Math.max(-1, Math.min(1, dx * fx + dz * fz))) > w.arc) continue;
      a.recibirGolpe(w.damage);
      this.g.events.emit('combat:impacto', { x: a.x, y: a.y + 0.4, z: a.z, tipo: 'carne', fuerza: 0.7 });
      hitSomething = true;
    }

    c.hitOnce = true;   // un golpe cobra una vez, aunque la fase activa dure varios frames
    return hitSomething;
  }

  update(dt) {
    if (!COMBAT.enabled) return;
    for (const c of this.combatants) {
      c.update(dt);
      if (c.striking) this.#strike(c);
      // Soltar el blanco si se aleja o se muere.
      if (c.lockTarget) {
        const t = c.lockTarget;
        const d = Math.hypot(t.position.x - c.position.x, t.position.z - c.position.z);
        if (!t.alive || d > COMBAT.lockOn.breakRange) {
          c.lockTarget = null;
          if (c === this.player) this.g.events.emit('combat:lock', null);
        }
      }
    }
    if (this.player) {
      this.g.events.emit('combat:stats', {
        health: this.player.health, maxHealth: this.player.stats.health,
        stamina: this.player.stamina, maxStamina: this.player.stats.stamina,
        weapon: this.player.weapon.nombre,
      });
    }
  }
}
