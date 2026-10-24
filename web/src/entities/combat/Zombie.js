import { Character } from '../character/Character.js';
import { Combatant } from './Combatant.js';
import { ZOMBIS } from '../../config/survival.config.js';
import { secuencia, selector, si, hacer, listo, marcar, RUN } from '../../systems/ai/BehaviorTree.js';

// Un zombi (modo supervivencia, ficción declarada): cuerpo con esqueleto + combatiente + árbol de comportamiento.
//
// Igual que `Enemy`, **no trae combate propio**: usa `Combatant` y `CombatSystem` resuelve sus zarpazos. Lo que
// cambia es la cabeza: no esquiva ni se cubre, no suelta al jugador una vez lo huele, y cuando no tiene a quién
// seguir deambula arrastrando los pies. Camina con sus propios clips (`ZOMBIS[tipo].clips`), a su velocidad.

const ARBOL = selector(
  secuencia(si((z) => !z.self.alive), hacer(() => RUN)),
  secuencia(
    si((z) => !!z.objetivo),
    hacer((z) => z.encarar()),
    selector(
      secuencia(
        si((z) => z.distancia <= z.ai.distanciaAtaque),
        selector(
          secuencia(listo('golpe'), hacer((z) => z.golpear()), marcar('golpe', (z) => z.ai.pausaEntreGolpes)),
          hacer(() => RUN),
        ),
      ),
      hacer((z) => z.acercarse()),
    ),
  ),
  hacer((z) => z.deambular()),
);

export class Zombie {
  constructor(game, tipo, x, z, { levantarse = false } = {}) {
    this.g = game;
    this.tipo = ZOMBIS[tipo] ? tipo : 'caminante';
    this.spec = ZOMBIS[this.tipo];
    this.ai = this.spec.ai;

    const cuerpos = this.spec.cuerpos;
    const look = cuerpos ? { ...this.spec.look, cuerpo: cuerpos[Math.floor(Math.random() * cuerpos.length)] } : this.spec.look;
    this.character = new Character({ look, clips: this.spec.clips });
    this.character.place(x, z, Math.random() * Math.PI * 2, game.terrain.height(x, z));
    if (this.spec.escala) this.character.object.scale.set(...this.spec.escala);
    game.scene.add(this.character.object);
    // Algunos aparecen tirados en el suelo y se levantan al llegar el jugador.
    this.character.useRig(game.assets, look).then((ok) => {
      if (ok && levantarse) this.character.trigger('levantarse');
    });

    this.self = new Combatant(this.character, { stats: this.spec.stats, team: 'zombi', weapon: 'zarpazo', nombre: this.spec.nombre });
    this.timers = {};
    this.time = 0;
    this.objetivo = null;
    this.distancia = Infinity;
    this.rumbo = this.character.heading;     // hacia dónde deambula
    this.input = { forward: 0, strafe: 0, run: false, jump: false, yaw: 0, speed: this.ai.velocidad };
  }

  get position() { return this.character; }

  // Ve de frente y oye alrededor; corriendo se le oye el doble de lejos. Una vez lo tiene, no lo suelta hasta
  // que se aleja mucho: un zombi no se aburre.
  #percibir() {
    const p = this.g.playerSys;
    const jugador = p?.combat;
    if (!jugador?.alive) { this.objetivo = null; this.distancia = Infinity; return; }
    // Montado, el objetivo es el vehículo: lo sigue igual, aunque no pueda alcanzarlo.
    const f = p.focus;
    const d = Math.hypot(f.x - this.character.x, f.z - this.character.z);
    const dx = (f.x - this.character.x) / (d || 1), dz = (f.z - this.character.z) / (d || 1);
    const alFrente = dx * -Math.sin(this.character.heading) + dz * -Math.cos(this.character.heading) > 0.2;
    const ruido = !p.walking ? 2.5 : p.character.vx ** 2 + p.character.vz ** 2 > 30 ? 2 : 1;
    // Un disparo cercano (ZombieSystem.ruido) lo pone a buscar aunque no vea ni oiga al jugador.
    const percibido = d <= this.ai.oido * ruido || (alFrente && d <= this.ai.vista) || (this.alertaHasta > this.time && d < 120);
    this.objetivo = percibido || (this.objetivo && d <= this.ai.vista * 2) ? f : null;
    this.distancia = d;
  }

  // ───────────── Acciones del árbol ─────────────
  encarar() {
    const t = this.objetivo;
    const deseado = Math.atan2(-(t.x - this.character.x), -(t.z - this.character.z));
    let d = deseado - this.character.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.character.heading += d * Math.min(1, this.dt * 3.5);
  }

  acercarse() {
    this.input.forward = 1;
    this.input.yaw = this.character.heading;
    this.input.speed = this.ai.velocidad;
    return RUN;
  }

  // Sólo se puede morder al que va a pie.
  golpear() { if (this.g.playerSys.walking) this.self.attack(); }

  deambular() {
    // Cambia de rumbo de vez en cuando y a veces se queda quieto, balanceándose.
    if ((this.timers.rumbo || 0) <= this.time) {
      this.rumbo = this.character.heading + (Math.random() - 0.5) * 2.2;
      this.quieto = Math.random() < 0.35;
      this.timers.rumbo = this.time + 3 + Math.random() * 5;
    }
    let d = this.rumbo - this.character.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.character.heading += d * Math.min(1, this.dt * 1.2);
    this.input.forward = this.quieto ? 0 : 1;
    this.input.yaw = this.character.heading;
    this.input.speed = Math.min(this.ai.velocidad, 0.7);
    return RUN;
  }

  update(dt) {
    this.dt = dt;
    this.time += dt;
    this.input.forward = 0;
    if (this.self.alive) {
      this.#percibir();
      if (!this.self.busy) ARBOL(this);
    }
    const world = { collision: this.g.collision, terrain: this.g.terrain, blocks: this.g.blocks };
    const mover = this.self.alive && !this.self.busy && !this.character.body.graph?.busy;
    this.character.cameraDistance = this.g.camera.position.distanceTo(this.character.object.position);
    this.character.update(dt, mover ? this.input : { forward: 0, strafe: 0, run: false, jump: false, yaw: this.character.heading }, world);
  }

  dispose() {
    this.character.object.removeFromParent();
    this.character.body.dispose?.();
  }
}
