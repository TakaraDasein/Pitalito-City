import { Character } from '../character/Character.js';
import { CRONISTAS } from '../../config/misiones.config.js';

// El cuerpo de un cronista: un personaje con el mismo esqueleto y los mismos clips que todos los demás, parado
// donde le toca, que se gira hacia el jugador cuando se acerca y habla con las manos mientras cuenta.
//
// No tiene física de movimiento ni IA: no se mueve del sitio. Lo único que hace es girarse y cambiar de clip.
// Por eso no usa `Combatant` ni árbol de comportamiento — un cronista no pelea, y la historia no se cobra con
// combate (regla de docs/HISTORIA.md).

export class Cronista {
  constructor(game, mision) {
    this.g = game;
    this.mision = mision;
    this.character = new Character({ look: CRONISTAS[mision.cronista] });
    this.character.place(mision.x, mision.z, Math.random() * Math.PI * 2, game.terrain.height(mision.x, mision.z));
    game.scene.add(this.character.object);
    this.character.useRig(game.assets, CRONISTAS[mision.cronista]);
    this.hablando = false;
  }

  get x() { return this.character.x; }
  get z() { return this.character.z; }

  update(dt, jugador) {
    const c = this.character;
    const dx = jugador.x - c.x, dz = jugador.z - c.z;
    const d = Math.hypot(dx, dz);

    // De cerca se gira hacia el jugador; de lejos sigue a lo suyo.
    if (d < 14) {
      const deseado = Math.atan2(-dx, -dz);
      let giro = deseado - c.heading;
      giro = Math.atan2(Math.sin(giro), Math.cos(giro));
      c.heading += giro * Math.min(1, dt * 3);
    }

    c.cameraDistance = this.g.camera.position.distanceTo(c.object.position);
    c.update(dt, { forward: 0, strafe: 0, run: false, jump: false, yaw: c.heading },
      { collision: this.g.collision, terrain: this.g.terrain, blocks: this.g.blocks });

    // De cerca mueve las manos al hablar; si no, espera quieto.
    const quiereHablar = d < 14;
    if (quiereHablar !== this.hablando) {
      this.hablando = quiereHablar;
      c.body.graph?.reposo?.(quiereHablar ? 'talk' : 'idle');
    }
  }

  dispose() {
    this.character.object.removeFromParent();
    this.character.body.dispose?.();
  }
}
