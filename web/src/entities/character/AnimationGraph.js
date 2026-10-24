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
  // Interacción con el mundo (ver src/config/interaccion.config.js): cada categoría tiene su gesto.
  interact: { clip: 'interact', lock: 0.9, cancelable: true },
  empujar: { clip: 'push', lock: 0.7, cancelable: true },          // puertas y portones
  hablar: { clip: 'talk', lock: 1.4, cancelable: true },           // trueque, cronistas
  pickUp: { clip: 'pickUp', lock: 1.1, cancelable: true },
  swing: { clip: 'punchJab', lock: 0.45, cancelable: false },
  attack: { clip: 'attack', lock: 0.8, cancelable: false },
  roll: { clip: 'roll', lock: 0.7, cancelable: false },
  hit: { clip: 'hitChest', lock: 0.5, cancelable: false },
  death: { clip: 'death', lock: Infinity, cancelable: false },
  entrarAsiento: { clip: 'sitEnter', lock: 0.75, cancelable: false },
  salirAsiento: { clip: 'sitExit', lock: 0.75, cancelable: false },
  levantarse: { clip: 'levantarse', lock: 2.2, cancelable: false },
  disparar: { clip: 'pistolShoot', lock: 0.18, cancelable: true },
  recargar: { clip: 'pistolReload', lock: 1.4, cancelable: false },   // del suelo a de pie (zombis)
};

export class AnimationGraph {
  // `clips` cambia clips concretos para este personaje (p. ej. un zombi camina con `Zombie_Walk_Fwd_Loop`).
  constructor(rig, clips = null) {
    this.rig = rig;
    this.C = clips ? { ...C, ...clips } : C;
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
    const C = this.C;
    const clip = opts.clip && this.rig.has(C[opts.clip] || opts.clip) ? (C[opts.clip] || opts.clip) : C[def.clip];
    if (!this.rig.has(clip)) return false;
    if (this.action && !ACTIONS[this.action.name].cancelable) return false;
    const lock = opts.lock ?? def.lock;
    this.action = { name, left: lock };
    // El clip se estira o encoge para caber en la duración del golpe, así la mano llega cuando toca.
    const clipDur = this.rig.clips.get(clip)?.duration || 1;
    const timeScale = lock !== Infinity && lock > 0 ? Math.min(2.5, Math.max(0.5, clipDur / lock)) : 1;
    this.rig.play(clip, { fade: FADE.quick, once: lock !== Infinity, timeScale, restart: true });
    this.state = '';   // al terminar, el estado continuo vuelve a pedir su clip
    return true;
  }

  get busy() { return !!this.action; }

  /** Corta la acción en curso (incluida la muerte, que no termina sola). */
  cancelar() { this.action = null; this.state = ''; }

  /** Cambia el clip que se usa estando quieto: 'idle' (por defecto) o 'talk' (los cronistas al contar). */
  reposo(cual) {
    this.clipReposo = cual === 'talk' ? this.C.talk : null;
    this.state = '';   // fuerza la transición en el siguiente fotograma
  }

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

    const C = this.C;
    if (s.driving) this.#set('drive', C.drive);
    else if (s.sitting) this.#set('sit', C.sitIdle);
    else if (!s.onGround) this.#set('air', s.speed > 0.1 ? C.jumpLoop : C.fall);
    else if (this.landing > 0) { this.landing -= dt; this.#set('land', C.jumpLand, FADE.quick); }
    // Con el arma en la mano, quieto se queda en guardia, no en reposo.
    // Arma de fuego: apuntando manda sobre todo (se camina despacio con los brazos extendidos).
    else if (s.apuntando) this.#set('aim', C.pistolAim);
    // Cubriéndose: sube el arma y se queda así (el clip se para en su última pose).
    else if (s.guardia) this.#set('block', C.bloqueo, FADE.quick, true);
    else if (s.armed && s.speed < 0.25) this.#set(`guard:${s.reposoArma || ''}`, s.reposoArma || C.attackIdle);
    else if (this.clipReposo && s.speed < 0.25) this.#set('reposo', this.clipReposo);
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
        this.rig.blend(this.C[a], this.C[b], t, a === 'idle' && t < 0.01 ? 1 : scale);
        this.state = t > 0.5 ? b : a;
        return;
      }
    }
  }

  #set(state, clip, fade = FADE.default, once = false) {
    if (this.state === state) return;
    this.state = state;
    this.rig.play(clip, { fade, once });
  }
}
