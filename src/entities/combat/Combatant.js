import { COMBAT, WEAPONS } from '../../config/combat.config.js';

// Un combatiente: vida, resistencia, temple y el estado de lo que está haciendo (atacar, rodar, recibir, morir).
//
// **Es el mismo objeto para el jugador, la fauna y las facciones.** Lo único que cambia entre uno y otro son las
// cifras y la tabla de ataques; la IA (Fases 4 y 5) llamará a `attack()` y `roll()` igual que lo hace el teclado.
// Por eso aquí no hay ni una referencia al jugador ni a la entrada.
//
// El combatiente no conoce a los demás: quién recibe el golpe lo decide `CombatSystem`.

export class Combatant {
  /**
   * @param character  personaje con física y animación (`Character`)
   * @param stats      cifras propias; por defecto las del jugador
   * @param weapon     id del arma inicial
   */
  constructor(character, { stats = COMBAT.player, weapon = 'manos', team = 'player', events = null, nombre = '' } = {}) {
    this.nombre = nombre;     // lo muestra la barra del blanco fijado
    this.events = events;
    this.character = character;
    this.stats = stats;
    this.team = team;
    this.health = stats.health;
    this.stamina = stats.stamina;
    this.weapon = WEAPONS[weapon] || WEAPONS.manos;

    this.state = 'idle';      // idle | attack | roll | hit | dead
    this.timer = 0;           // lo que le queda al estado actual
    this.phase = 'none';      // en un ataque: windup → active → recover
    this.hitOnce = false;     // un mismo golpe no cobra dos veces
    this.staminaHold = 0;     // espera antes de volver a recuperar resistencia
    this.invulnerable = 0;
    this.guarding = false;
    this.lockTarget = null;
    this.rollDir = null;
    this.regenFactor = 1;     // la fiebre de la infección (supervivencia) lo baja
    // Combo: qué golpe de la cadena va (WEAPONS[].combo) y cuánto hace que terminó el anterior. Un clic durante
    // la recuperación queda guardado y encadena al acabar (como en Dark Souls).
    this.comboPaso = -1;
    this.desdeGolpe = Infinity;
    this.pendiente = false;
    this.multGolpe = 1;
  }

  get alive() { return this.state !== 'dead'; }
  get busy() { return this.state === 'attack' || this.state === 'roll' || this.state === 'hit'; }
  get position() { return this.character; }   // tiene x, y, z

  // ───────────── Acciones ─────────────

  // Intenta atacar. Devuelve false si no puede (sin resistencia, ocupado, muerto).
  attack() {
    if (!this.alive) return false;
    // Durante el golpe (ya soltado o recuperándose) el clic se guarda y encadena el siguiente al terminar.
    if (this.state === 'attack' && this.phase !== 'windup') { this.pendiente = true; return false; }
    if (this.busy) return false;
    const w = this.weapon;
    if (this.stamina < w.stamina) return false;
    this.#spend(w.stamina);
    // Siguiente golpe del combo si el anterior acaba de terminar; si no, vuelve a empezar.
    const combo = w.combo || null;
    this.comboPaso = combo && this.desdeGolpe < COMBAT.combo.ventana ? (this.comboPaso + 1) % combo.length : 0;
    const remate = combo && this.comboPaso === combo.length - 1 && combo.length > 1;
    const lento = remate ? COMBAT.combo.remateTiempo : 1;
    this.multGolpe = remate ? COMBAT.combo.remateDano : 1;
    this.tiempos = { windup: w.windup * lento, active: w.active, recover: w.recover * lento };
    this.state = 'attack';
    this.phase = 'windup';
    this.timer = this.tiempos.windup;
    this.hitOnce = false;
    this.pendiente = false;
    // La animación dura exactamente lo que el golpe: preparación + activo + recuperación.
    const clip = combo ? combo[this.comboPaso] : w.clip;
    this.character.trigger('attack', { clip, lock: this.tiempos.windup + this.tiempos.active + this.tiempos.recover });
    this.events?.emit('combat:swing', { arma: w.id });
    return true;
  }

  // Rueda en una dirección del mundo (vector normalizado {x, z}).
  roll(dirX, dirZ) {
    if (!this.alive || this.busy) return false;
    const r = COMBAT.roll;
    if (this.stamina < r.stamina) return false;
    this.#spend(r.stamina);
    this.state = 'roll';
    this.timer = r.duration;
    this.elapsed = 0;
    this.rollDir = { x: dirX, z: dirZ };
    this.character.trigger('roll', { lock: r.duration });
    return true;
  }

  setGuard(on) { this.guarding = on && this.alive && !this.busy; }

  /**
   * Recibe un golpe. Devuelve lo que pasó, para que el sistema avise al HUD.
   * @returns {{ damage:number, blocked:boolean, staggered:boolean, dead:boolean } | null}
   */
  takeHit({ damage, poise = 0, zone = 'body' }) {
    if (!this.alive || this.invulnerable > 0) return null;
    let dmg = damage * (COMBAT.hitMultiplier[zone] ?? 1);
    let blocked = false;

    if (this.guarding) {
      blocked = true;
      const g = COMBAT.guard;
      dmg *= g.damageThrough;
      this.#spend(g.stamina);
      // Sin resistencia la guardia se rompe y el golpe entra entero.
      if (this.stamina <= 0) { blocked = false; dmg = damage * (COMBAT.hitMultiplier[zone] ?? 1); this.guarding = false; }
    }

    this.health = Math.max(0, this.health - dmg);
    this.invulnerable = this.stats.invulnerableAfterHit;

    if (this.health <= 0) {
      this.state = 'dead';
      this.timer = Infinity;
      this.character.trigger('death');
      return { damage: dmg, blocked, staggered: false, dead: true };
    }
    // Un golpe sólo interrumpe si rompe el temple.
    const staggered = !blocked && poise >= this.stats.poise;
    if (staggered) {
      this.state = 'hit';
      this.timer = 0.5;
      this.character.trigger('hit');
    }
    return { damage: dmg, blocked, staggered, dead: false };
  }

  /** Vuelve a la vida (modo supervivencia: reaparecer en un refugio). */
  revivir(vida = this.stats.health) {
    this.state = 'idle';
    this.timer = 0;
    this.phase = 'none';
    this.health = vida;
    this.stamina = this.stats.stamina;
    this.invulnerable = 2;
    this.character.body.graph?.cancelar();
  }

  // ───────────── Por frame ─────────────

  update(dt) {
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (this.state !== 'attack') this.desdeGolpe += dt;
    this.#stamina(dt);
    if (this.state === 'dead') return;

    if (this.state === 'roll') {
      this.elapsed += dt;
      const r = COMBAT.roll;
      // El tramo invulnerable no empieza al instante: hay que rodar *hacia* el golpe.
      const inWindow = this.elapsed >= r.iframeStart && this.elapsed <= r.iframeEnd;
      if (inWindow) this.invulnerable = Math.max(this.invulnerable, 0.02);
    }

    this.timer -= dt;
    if (this.timer > 0) return;

    if (this.state === 'attack') {
      const w = this.tiempos || this.weapon;
      if (this.phase === 'windup') { this.phase = 'active'; this.timer = w.active; }
      else if (this.phase === 'active') { this.phase = 'recover'; this.timer = w.recover; }
      else {
        this.state = 'idle'; this.phase = 'none'; this.desdeGolpe = 0;
        if (this.pendiente) { this.pendiente = false; this.character.body.graph?.cancelar(); this.attack(); }
      }
      return;
    }
    if (this.state === 'roll' || this.state === 'hit') { this.state = 'idle'; this.rollDir = null; }
  }

  // ¿Este frame el golpe hace daño?
  get striking() { return this.state === 'attack' && this.phase === 'active' && !this.hitOnce; }

  // Cuánto avanza el rodar este frame, en metros.
  rollStep(dt) {
    if (this.state !== 'roll' || !this.rollDir) return null;
    const r = COMBAT.roll;
    // Arranca rápido y frena: se siente como un impulso, no como caminar más rápido.
    const t = Math.min(1, this.elapsed / r.duration);
    const v = (r.distance / r.duration) * 2 * (1 - t);
    return { x: this.rollDir.x * v * dt, z: this.rollDir.z * v * dt };
  }

  setWeapon(id) {
    if (WEAPONS[id]) this.weapon = WEAPONS[id];
    return this.weapon;
  }

  heal() { this.health = this.stats.health; this.stamina = this.stats.stamina; this.state = 'idle'; }

  #spend(n) {
    this.stamina = Math.max(0, this.stamina - n);
    this.staminaHold = this.stats.staminaDelay;
  }

  #stamina(dt) {
    if (this.staminaHold > 0) { this.staminaHold -= dt; return; }
    const drain = this.guarding ? COMBAT.guard.drainPerSecond : 0;
    this.stamina = Math.max(0, Math.min(this.stats.stamina, this.stamina + (this.stats.staminaRegen * (this.regenFactor ?? 1) - drain) * dt));
  }
}
