import { Character } from '../character/Character.js';
import { Combatant } from './Combatant.js';
import { FACTIONS, ENEMIGOS } from '../../config/factions.config.js';
import { secuencia, selector, si, hacer, listo, marcar, azar, RUN } from '../../systems/ai/BehaviorTree.js';

// Un enemigo: cuerpo con esqueleto + combatiente + árbol de comportamiento.
//
// **No trae combate propio.** Usa el mismo `Combatant` que el jugador (vida, resistencia, rodar, guardia) y el
// mismo `CombatSystem` resuelve sus golpes. Lo único suyo es *decidir*: el árbol de abajo.
//
// Todos los arquetipos comparten este archivo; lo que cambia son las cifras de `ENEMIGOS`.
// Las facciones son ficción declarada: ver la cabecera de src/config/factions.config.js.

// El árbol, de arriba abajo: si está muerto no hace nada; si no ve a nadie, vigila; si ve al jugador, lo encara,
// se acerca, y a distancia de golpe ataca (con una pausa entre golpes y alguna esquiva).
const ARBOL = selector(
  secuencia(si((c) => !c.self.alive), hacer(() => RUN)),
  secuencia(
    si((c) => !!c.objetivo),
    hacer((c) => c.encarar()),
    selector(
      // A distancia de golpe: pegar, o apartarse de vez en cuando.
      secuencia(
        si((c) => c.distancia <= c.ai.distanciaAtaque),
        selector(
          secuencia(azar((0.02)), hacer((c) => c.esquivar())),
          secuencia(listo('golpe'), hacer((c) => c.golpear()), marcar('golpe', (c) => c.ai.pausaEntreGolpes)),
          hacer(() => RUN),
        ),
      ),
      // Lejos: acercarse.
      hacer((c) => c.acercarse()),
    ),
  ),
  // Sin objetivo: quedarse en su sitio, mirando alrededor.
  hacer((c) => c.vigilar()),
);

export class Enemy {
  /**
   * @param game
   * @param tipo   clave de ENEMIGOS
   * @param x,z    dónde aparece
   * @param zona   id de la zona que lo puso (para la reputación)
   */
  constructor(game, tipo, x, z, zona = null) {
    this.g = game;
    this.spec = ENEMIGOS[tipo] || ENEMIGOS.centinela;
    this.ai = this.spec.ai;
    this.zona = zona;
    this.tipo = tipo;

    this.character = new Character({ look: FACTIONS.restos.look });
    this.character.place(x, z, Math.random() * Math.PI * 2, game.terrain.height(x, z));
    this.character.armed = true;
    game.scene.add(this.character.object);
    this.character.useRig(game.assets, FACTIONS.restos.look).then(() => {
      this.character.setWeapon(this.self.weapon.model);
    });

    this.self = new Combatant(this.character, { stats: this.spec.stats, team: 'faccion', weapon: this.spec.weapon });
    this.origen = { x, z };
    this.timers = {};
    this.time = 0;
    this.objetivo = null;
    this.distancia = Infinity;
    this.input = { forward: 0, strafe: 0, run: false, jump: false, yaw: 0 };
  }

  get position() { return this.character; }

  // ───────────── Percepción ─────────────
  #percibir() {
    const p = this.g.playerSys;
    const jugador = p?.combat;
    if (!jugador?.alive || !p.walking) { this.objetivo = null; this.distancia = Infinity; return; }
    const d = Math.hypot(p.character.x - this.character.x, p.character.z - this.character.z);
    // Ve de lejos si está delante; de cerca, lo oye aunque esté detrás.
    const dx = (p.character.x - this.character.x) / (d || 1), dz = (p.character.z - this.character.z) / (d || 1);
    const fx = -Math.sin(this.character.heading), fz = -Math.cos(this.character.heading);
    const alFrente = dx * fx + dz * fz > 0.15;
    const percibido = d <= this.ai.oido || (alFrente && d <= this.ai.vista);
    // Una vez visto, no lo suelta hasta que se aleje bastante: si no, parpadea entre perseguir y vigilar.
    this.objetivo = percibido || (this.objetivo && d <= this.ai.vista * 1.4) ? jugador : null;
    this.distancia = d;
  }

  // ───────────── Acciones del árbol ─────────────
  encarar() {
    const t = this.objetivo.position;
    const deseado = Math.atan2(-(t.x - this.character.x), -(t.z - this.character.z));
    let d = deseado - this.character.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.character.heading += d * Math.min(1, this.dt * 6);
  }

  acercarse() {
    // El personaje se mueve con el mismo código que el jugador: se le da "adelante" en su propio eje.
    this.input.forward = 1;
    this.input.strafe = 0;
    this.input.run = this.distancia > 8;
    this.input.yaw = this.character.heading;
    return RUN;
  }

  golpear() { this.self.attack(); }

  esquivar() {
    const lado = Math.random() < 0.5 ? 1 : -1;
    const dx = Math.cos(this.character.heading) * lado;
    const dz = -Math.sin(this.character.heading) * lado;
    this.self.roll(dx, dz);
  }

  vigilar() {
    this.input.forward = 0;
    this.input.strafe = 0;
    // Gira despacio sobre su sitio: se ve vivo y amplía lo que alcanza a ver.
    this.character.heading += this.dt * 0.35;
    return RUN;
  }

  // ───────────── Por frame ─────────────
  update(dt) {
    this.dt = dt;
    this.time += dt;
    this.input.forward = 0;
    this.input.strafe = 0;

    if (this.self.alive) {
      this.#percibir();
      // Atacando, rodando o aturdido no decide: deja que termine lo que está haciendo.
      if (!this.self.busy) ARBOL(this);
    }

    const world = { collision: this.g.collision, terrain: this.g.terrain, blocks: this.g.blocks };
    if (this.self.state === 'roll') {
      const step = this.self.rollStep(dt);
      if (step) this.character.displace(step.x, step.z, world);
    }
    const mover = this.self.alive && !this.self.busy;
    this.character.cameraDistance = this.g.camera.position.distanceTo(this.character.object.position);
    this.character.update(dt, mover ? { ...this.input, yaw: this.character.heading } : { forward: 0, strafe: 0, run: false, jump: false, yaw: this.character.heading }, world);
  }

  dispose() {
    this.character.object.removeFromParent();
    this.character.body.dispose?.();
  }
}
