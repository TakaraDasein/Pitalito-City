// Entrada unificada: teclado + gamepad → controles analógicos + acciones discretas.
const ACTIONS = {
  KeyM: 'map', KeyC: 'camera', KeyV: 'vehicle', KeyN: 'time', KeyH: 'horn', KeyR: 'reset',
  KeyT: 'home', Escape: 'escape', KeyG: 'clearRoute', F1: 'help', KeyB: 'debug',
};

export class InputSystem {
  constructor(events) {
    this.events = events;
    this.keys = new Set();
    this.enabled = true;
    this.controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    this.padPrev = [];
    addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (!this.keys.has(e.code) && ACTIONS[e.code]) this.events.emit('action', ACTIONS[e.code]);
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'F1'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  #key(...codes) { return codes.some((c) => this.keys.has(c)) ? 1 : 0; }

  update(dt) {
    const k = this;
    let throttle = k.#key('KeyW', 'ArrowUp');
    let brake = k.#key('KeyS', 'ArrowDown');
    const steerKey = k.#key('KeyD', 'ArrowRight') - k.#key('KeyA', 'ArrowLeft');
    let handbrake = !!k.#key('Space');
    // Suavizado de dirección con teclado (evita volantazos digitales)
    let steer = this.controls.steer + (steerKey - this.controls.steer) * Math.min(1, dt * (steerKey ? 6 : 10));

    // Solo mandos con mapeo estándar. Al detectarse uno se toma su estado inicial como referencia (algunos
    // dispositivos reportan botones "presionados" desde el inicio) y no se usa hasta que el jugador lo toque.
    const pad = navigator.getGamepads?.().find((p) => p && p.mapping === 'standard');
    if (pad && this.padId !== pad.id + pad.index) {
      this.padId = pad.id + pad.index;
      this.padActive = false;
      this.padPrev = pad.buttons.map((b) => b.pressed);
      this.padAxes0 = pad.axes.slice();
    }
    if (pad && !this.padActive) {
      this.padActive = pad.buttons.some((b, i) => b.pressed !== this.padPrev[i]) || pad.axes.some((a, i) => Math.abs(a - this.padAxes0[i]) > 0.3);
      if (this.padActive) this.padPrev = pad.buttons.map((b) => b.pressed);
    }
    if (pad && this.padActive) {
      const dead = (v) => (Math.abs(v) < 0.12 ? 0 : v);
      const stick = dead(pad.axes[0] || 0);
      if (stick) steer = stick;
      throttle = Math.max(throttle, pad.buttons[7]?.value || 0);
      brake = Math.max(brake, pad.buttons[6]?.value || 0);
      handbrake ||= !!pad.buttons[0]?.pressed;
      const map = { 9: 'map', 3: 'camera', 2: 'vehicle', 1: 'horn', 8: 'time' };
      for (const [i, act] of Object.entries(map)) {
        const pressed = !!pad.buttons[i]?.pressed;
        if (pressed && !this.padPrev[i]) this.events.emit('action', act);
        this.padPrev[i] = pressed;
      }
    }
    if (!this.enabled) { throttle = brake = 0; steer = 0; handbrake = true; }
    Object.assign(this.controls, { throttle, brake, steer, handbrake });
    return this.controls;
  }
}
