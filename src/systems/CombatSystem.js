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
    if (c.lockTarget) { this.#fijar(c, null); return null; }
    return this.#fijar(c, this.#buscar(c, yaw));
  }

  /**
   * Cambia al siguiente blanco hacia un lado (como en Dark Souls al mover el stick): `lado` +1 = a la derecha de
   * la mirada, −1 = a la izquierda. Se elige el más cercano en ángulo en ese sentido.
   */
  switchLock(c, yaw, lado) {
    if (!c.lockTarget) return null;
    const ang = (o) => {
      let a = Math.atan2(-(o.position.x - c.position.x), -(o.position.z - c.position.z)) - yaw;
      return Math.atan2(Math.sin(a), Math.cos(a));       // + = a la izquierda
    };
    const actual = ang(c.lockTarget);
    let best = null, mejor = Infinity;
    for (const { c: o } of this.#enemiesOf(c, COMBAT.lockOn.range)) {
      if (o === c.lockTarget) continue;
      const delta = (actual - ang(o)) * lado;        // positivo si está hacia `lado`
      if (delta > 0 && delta < mejor) { mejor = delta; best = o; }
    }
    return best ? this.#fijar(c, best) : c.lockTarget;
  }

  // El enemigo más cercano dentro del cono de la mirada.
  #buscar(c, yaw) {
    const { range, angle } = COMBAT.lockOn;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    for (const { c: o, d } of this.#enemiesOf(c, range)) {
      const dx = (o.position.x - c.position.x) / (d || 1), dz = (o.position.z - c.position.z) / (d || 1);
      if (Math.acos(Math.max(-1, Math.min(1, dx * fx + dz * fz))) > angle) continue;
      return o; // ya vienen ordenados por distancia
    }
    return null;
  }

  // El HUD recibe el combatiente vivo (no una posición fija): la retícula y su barra de vida lo siguen.
  #fijar(c, o) {
    c.lockTarget = o;
    if (c === this.player) this.g.events.emit('combat:lock', o);
    return o;
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
        // El golpe empuja: más con armas pesadas, más si rompe el temple o lo tumba; casi nada si lo bloquea.
        const fuerza = res.blocked ? 0.8 : (2 + w.poise / 12) * (res.staggered ? 1.6 : 1) * (res.dead ? 1.8 : 1);
        o.character.empujar?.(dx * fuerza, dz * fuerza);
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

  // Los cuerpos no se atraviesan: dos combatientes a pie más cerca que dos radios se separan, mitad y mitad.
  // (En la captura del 21-10 la horda y el jugador se metían unos dentro de otros.) Los caídos no estorban.
  #separar() {
    const lista = [...this.combatants].filter((c) => c.alive && c.character && (c !== this.player || this.g.playerSys.walking));
    const min = 0.66;
    for (let i = 0; i < lista.length; i++) {
      const a = lista[i].character;
      for (let j = i + 1; j < lista.length; j++) {
        const b = lista[j].character;
        const dx = b.x - a.x, dz = b.z - a.z;
        if (Math.abs(dx) > min || Math.abs(dz) > min || Math.abs(a.y - b.y) > 1.2) continue;
        const d = Math.hypot(dx, dz);
        if (d >= min) continue;
        const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
        const k = (min - d) / 2;
        a.x -= nx * k; a.z -= nz * k;
        b.x += nx * k; b.z += nz * k;
      }
    }
  }

  update(dt) {
    if (!COMBAT.enabled) return;
    this.#separar();
    for (const c of this.combatants) {
      c.update(dt);
      if (c.striking) this.#strike(c);
      // Soltar el blanco si se aleja o se muere.
      if (c.lockTarget) {
        const t = c.lockTarget;
        const d = Math.hypot(t.position.x - c.position.x, t.position.z - c.position.z);
        // Si muere, salta al siguiente más cercano (como en Dark Souls); si se aleja, se suelta.
        if (!t.alive && c === this.player) this.#fijar(c, this.#buscar(c, Math.atan2(-(t.position.x - c.position.x), -(t.position.z - c.position.z))));
        else if (!t.alive || d > COMBAT.lockOn.breakRange) this.#fijar(c, null);
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
