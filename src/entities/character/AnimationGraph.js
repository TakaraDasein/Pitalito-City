import { CHARACTERS } from '../../config/characters.config.js';

// Traduce el estado físico de un personaje a clips de animación.
//
// La física no sabe de animaciones y la animación no toca la física: este archivo es el único puente. Lo usan el
// jugador, los peatones y (Fase 3) los enemigos, porque todos comparten el mismo esqueleto.
//
// Estados continuos: quieto ↔ caminar ↔ trotar ↔ correr (mezclados por velocidad real), saltar, caer, sentado,
// conducir. Acciones puntuales (interactuar, golpear, rodar) se piden con `trigger()` y mandan mientras duran.

const { clips: C, locomotionSpeeds: SPEED, fade: FADE } = CHARACTERS;

// Acciones puntuales: qué clip usan, cuánto bloquean la locomoción y si se puede cancelar moviéndose.
const ACTIONS = {
  interact: { clip: C.interact, lock: 0.9, cancelable: true },
  pickUp: { clip: C.pickUp, lock: 1.1, cancelable: true },
  swing: { clip: C.punchJab, lock: 0.45, cancelable: false },
  attack: { clip: C.attack, lock: 0.8, cancelable: false },
  roll: { clip: C.roll, lock: 0.7, cancelable: false },
  hit: { clip: C.hitChest, lock: 0.5, cancelable: false },
  death: { clip: C.death, lock: Infinity, cancelable: false },
};

export class AnimationGraph {
  constructor(rig) {
    this.rig = rig;
    this.state = 'idle';
    this.action = null;      // { name, left }
    this.wasOnGround = true;
    this.landing = 0;        // segundos que queda del aterrizaje
  }

  /**
   * Pide una acción puntual. Devuelve false si otra acción sin cancelar está en curso.
   * `opts` permite que el combate imponga el clip y la duración del arma que se lleve: un azadón tarda más que
   * una peinilla, y la animación tiene que durar lo mismo que el golpe.
   */
  trigger(name, opts = {}) {
    const def = ACTIONS[name];
    if (!def) return false;
    const clip = opts.clip && this.rig.has(C[opts.clip] || opts.clip) ? (C[opts.clip] || opts.clip) : def.clip;
    if (!this.rig.has(clip)) return false;
    if (this.action && !ACTIONS[this.action.name].cancelable) return false;
    const lock = opts.lock ?? def.lock;
    this.action = { name, left: lock };
    // El clip se estira o encoge para caber en la duración del golpe, así la mano llega cuando toca.
    const clipDur = this.rig.clips.get(clip)?.duration || 1;
    const timeScale = lock !== Infinity && lock > 0 ? Math.min(2.5, Math.max(0.5, clipDur / lock)) : 1;
    this.rig.play(clip, { fade: FADE.quick, once: lock !== Infinity, timeScale });
    return true;
  }

  get busy() { return !!this.action; }

  // s: { speed, onGround, sitting, driving, dt, distance }
  update(s) {
    const dt = s.dt;

    // Una acción puntual manda mientras dura; se corta si el jugador se mueve y el clip lo permite.
    if (this.action) {
      const def = ACTIONS[this.action.name];
      this.action.left -= dt;
      if (this.action.left <= 0 || (def.cancelable && s.speed > 1.2)) this.action = null;
      else { this.rig.update(dt, s.distance); return; }
    }

    if (s.driving) this.#set('drive', C.drive);
    else if (s.sitting) this.#set('sit', C.sitIdle);
    else if (!s.onGround) this.#set('air', s.speed > 0.1 ? C.jumpLoop : C.fall);
    else if (this.landing > 0) { this.landing -= dt; this.#set('land', C.jumpLand, FADE.quick); }
    // Con el arma en la mano, quieto se queda en guardia, no en reposo.
    else if (s.armed && s.speed < 0.25) this.#set('guard', C.attackIdle);
    else this.#locomotion(s.speed);

    // Al tocar suelo tras caer, un aterrizaje corto; sin esto el cambio se ve seco.
    if (s.onGround && !this.wasOnGround) this.landing = 0.22;
    this.wasOnGround = s.onGround;

    this.rig.update(dt, s.distance);
  }

  // Mezcla los cuatro clips de locomoción por la velocidad real, para que los pies no patinen.
  #locomotion(speed) {
    const pairs = [['idle', 'walk'], ['walk', 'jog'], ['jog', 'run']];
    for (const [a, b] of pairs) {
      const lo = SPEED[a], hi = SPEED[b];
      if (speed <= hi || b === 'run') {
        const t = hi === lo ? 0 : Math.min(1, Math.max(0, (speed - lo) / (hi - lo)));
        // El clip se acelera o frena un poco para cuadrar con la velocidad real (evita el patinaje).
        const nominal = lo + (hi - lo) * t;
        const scale = nominal > 0.2 ? Math.min(1.4, Math.max(0.7, speed / nominal)) : 1;
        this.rig.blend(C[a], C[b], t, a === 'idle' && t < 0.01 ? 1 : scale);
        this.state = t > 0.5 ? b : a;
        return;
      }
    }
  }

  #set(state, clip, fade = FADE.default) {
    if (this.state === state) return;
    this.state = state;
    this.rig.play(clip, { fade });
  }
}
