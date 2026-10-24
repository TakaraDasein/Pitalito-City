import * as THREE from 'three';
import { Character } from '../character/Character.js';
import { Combatant } from './Combatant.js';
import { LOOKS, TIRADOR } from '../../config/bases.config.js';
import { FIREARMS } from '../../config/firearms.config.js';

// Un superviviente de una base (modo supervivencia, ficción declarada). Tres papeles, el mismo cuerpo:
//
//   comerciante — se queda en su puesto hablando; con E se le abre el trueque (BaseSystem).
//   guardia     — vigila la base de comerciantes y dispara a los zombis que se acercan; al jugador no.
//   tirador     — saqueador: dispara al jugador en cuanto lo ve o lo oye. Ráfagas cortas, falla bastante,
//                 busca quedarse a media distancia y se aparta de lado entre ráfagas.
//
// Dispara con el mismo FirearmSystem que el jugador (el tiro choca con las paredes, así que tras un muro no le da).

const _o = new THREE.Vector3(), _d = new THREE.Vector3();

export class Superviviente {
  constructor(game, base, def, x, z) {
    this.g = game;
    this.base = base;
    this.rol = def.rol;
    this.nombre = def.nombre || null;
    this.oferta = def.oferta || null;
    this.arma = def.arma || null;
    const look = LOOKS[this.rol === 'comerciante' && Math.random() < 0.5 ? 'comerciante2' : this.rol] || LOOKS.guardia;

    this.character = new Character({ look });
    this.character.place(x, z, Math.random() * Math.PI * 2, game.terrain.height(x, z));
    game.scene.add(this.character.object);
    const team = this.rol === 'tirador' ? 'saqueador' : 'superviviente';
    this.self = new Combatant(this.character, { stats: TIRADOR.stats, team, weapon: this.arma || 'manos', nombre: this.nombre || (this.rol === 'tirador' ? 'Saqueador' : 'Guardia') });
    this.character.useRig(game.assets, look).then((ok) => {
      if (!ok) return;
      if (this.arma) { this.character.setWeapon(this.arma); this.character.reposoArma = FIREARMS[this.arma]?.larga ? 'Pistol_Aim_Neutral' : 'Pistol_Idle_Loop'; this.character.armed = true; }
      if (this.rol === 'comerciante') this.character.body.graph?.reposo('talk');
    });
    this.puesto = { x, z };
    this.balas = this.arma ? FIREARMS[this.arma].cargador : 0;
    this.t = 0;
    this.siguiente = 0;          // cuándo puede volver a disparar
    this.rafaga = 0;
    this.lado = 1;
    this.objetivo = null;
    this.input = { forward: 0, strafe: 0, run: false, jump: false, yaw: 0, speed: 2.2 };
  }

  get position() { return this.character; }

  // ¿A quién dispara? El tirador, al jugador (a pie o en su vehículo); el guardia, al zombi completo más cercano.
  #elegir() {
    const c = this.character;
    if (this.rol === 'tirador') {
      const p = this.g.playerSys;
      if (!p.combat.alive) return null;
      const f = p.walking ? p.character : this.g.player;
      const d = Math.hypot(f.x - c.x, f.z - c.z);
      const oyo = this.oidoHasta > this.t;
      return d < TIRADOR.vista && (d < TIRADOR.oido || oyo || this.objetivo || this.#ve(f, d)) ? { f, d, alto: p.walking ? 1.3 : 0.9 } : null;
    }
    if (this.rol === 'guardia') {
      let mejor = null;
      for (const z of this.g.zombies?.zombis || []) {
        if (!z.self.alive) continue;
        const d = Math.hypot(z.position.x - c.x, z.position.z - c.z);
        if (d < 30 && (!mejor || d < mejor.d)) mejor = { f: z.position, d, alto: 1.3 };
      }
      return mejor;
    }
    return null;
  }

  // Ve de frente, en un cono de 120°.
  #ve(f, d) {
    const c = this.character;
    const dx = (f.x - c.x) / (d || 1), dz = (f.z - c.z) / (d || 1);
    return dx * -Math.sin(c.heading) + dz * -Math.cos(c.heading) > -0.5;
  }

  /** Un disparo oído cerca: el tirador se pone en guardia aunque no vea a nadie. */
  oir() { this.oidoHasta = this.t + 15; }

  update(dt) {
    this.t += dt;
    const c = this.character;
    this.input.forward = 0; this.input.strafe = 0;
    const world = { collision: this.g.collision, terrain: this.g.terrain, blocks: this.g.blocks };
    if (!this.self.alive || this.rol === 'comerciante') {
      c.apuntando = false;
      c.update(dt, this.input, world);
      return;
    }
    const obj = this.#elegir();
    // Arma larga sin blanco: baja el arma («listo bajo»); con blanco, la levanta para disparar.
    if (FIREARMS[this.arma]?.larga) this.character.body.listoBajo?.(!obj);
    // Al ver a alguien tarda en reaccionar: da tiempo a ponerse a cubierto.
    if (obj && !this.objetivo) this.siguiente = Math.max(this.siguiente, this.t + TIRADOR.reaccion);
    this.objetivo = obj;
    c.apuntando = !!obj;
    if (obj) {
      c.heading = Math.atan2(-(obj.f.x - c.x), -(obj.f.z - c.z));
      this.input.yaw = c.heading;
      // Mantiene la distancia: se acerca si está lejos, retrocede si está encima; entre ráfagas, de lado.
      if (this.rol === 'tirador') {
        const pref = TIRADOR.distanciaPreferida;
        this.input.forward = obj.d > pref + 6 ? 1 : obj.d < pref - 8 ? -1 : 0;
        if (this.rafaga === 0) this.input.strafe = this.lado;
      }
      this.#disparar(obj, dt);
    } else {
      // Sin nadie a la vista, vuelve a su puesto.
      const d = Math.hypot(this.puesto.x - c.x, this.puesto.z - c.z);
      if (d > 2) { c.heading = Math.atan2(-(this.puesto.x - c.x), -(this.puesto.z - c.z)); this.input.yaw = c.heading; this.input.forward = 1; }
    }
    c.update(dt, this.input, world);
  }

  #disparar(obj, dt) {
    const f = FIREARMS[this.arma];
    if (!f || this.t < this.siguiente) return;
    if (this.balas <= 0) {
      this.balas = f.cargador;
      this.siguiente = this.t + f.recarga;
      this.character.trigger('recargar', { lock: f.recarga });
      return;
    }
    const c = this.character;
    _o.set(c.x, c.y + 1.45, c.z);
    _d.set(obj.f.x - c.x, (obj.f.y ?? c.y) + obj.alto - _o.y, obj.f.z - c.z).normalize();
    const boca = _o.clone().addScaledVector(_d, 0.6);
    this.g.firearms.disparar(this.self, _o.clone().addScaledVector(_d, 0.45), _d, this.arma, { precision: TIRADOR.precision, boca, dano: TIRADOR.dano });
    this.character.trigger('disparar');
    this.balas--;
    if (this.rafaga <= 0) {
      const [a, b] = TIRADOR.rafaga;
      this.rafaga = a + Math.floor(Math.random() * (b - a + 1));
    }
    this.rafaga--;
    if (this.rafaga <= 0) {
      const [a, b] = TIRADOR.pausaRafaga;
      this.siguiente = this.t + a + Math.random() * (b - a);
      this.lado = Math.random() < 0.5 ? -1 : 1;
    } else this.siguiente = this.t + Math.max(f.cadencia, 0.25);
  }

  dispose() {
    this.character.object.removeFromParent();
    this.character.body.dispose?.();
  }
}
