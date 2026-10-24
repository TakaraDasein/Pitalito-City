import * as THREE from 'three';
import { INTERACCION } from '../config/interaccion.config.js';
import { Character } from '../entities/character/Character.js';
import { BLOCKS, REACH } from '../config/blocks.config.js';
import { VEHICLES } from '../config/vehicles.config.js';
import { COMBAT, ARSENAL, WEAPONS } from '../config/combat.config.js';
import { MONTAJE, POSTURAS } from '../config/vehicles.config.js';
import { FIREARMS, PRUEBAS } from '../config/firearms.config.js';
import { firearmModel } from '../entities/weapons/firearms.js';
import { Combatant } from '../entities/combat/Combatant.js';
import { pointInPolygon, polygonArea } from '../geo/geometry.js';

// Jugador a pie: bajar/subir de vehículos (F), caminar/correr/saltar, cámara con mouse (tercera o primera persona),
// mira para interactuar (E) y construir tipo Minecraft (clic izq. = quitar bloque, clic der. = poner bloque, 1–9 =
// elegir bloque, rueda = cambiar bloque).
//
// **Dos modos que no se pisan** (ver docs/PLAN_JUEGO.md): con el arma guardada se construye, con el arma en la
// mano se pelea. X saca o guarda el arma, Z cambia de arma. Con el arma fuera: clic izq. = golpe, clic der. =
// cubrirse, Ctrl = rodar, Q = fijar blanco.
//
// **Subir y bajar del vehículo** no es un corte: el personaje se acerca al asiento con `Sitting_Enter` y se
// queda conduciendo con `Driving_Loop`, colgado del cuerpo del vehículo. Es **el mismo personaje que creaste**,
// no el muñeco de cajas — ése sólo lo usan los vehículos del tráfico, donde sale mucho más barato.
// Interacciones: subir al carro propio o tomar uno del tráfico, sentarse en bancas, y consultar edificios y lugares
// reales (fuente del dato, altura, calle) — la información sale de los datos del mapa, no se inventa.
// Emite: player:mode ('drive' | 'walk'), player:target ({ label, key, detail } | null), player:slot (índice).
export class PlayerSystem {
  constructor(game) {
    this.g = game;
    this.mode = 'drive';
    this.view = 'third';
    this.slot = 0;
    this.yaw = 0; this.pitch = -0.15;
    this.character = new Character();
    this.character.object.visible = false;
    game.scene.add(this.character.object);
    // El modelo con esqueleto llega por red: mientras tanto el personaje usa el cuerpo de cajas (ver Character.js).
    this.character.useRig(game.assets, game.settings.get('look')).then((ok) => {
      if (!ok) return;
      // Si ya iba montado en la moto con el cuerpo de cajas, el esqueleto recién llegado toma la postura.
      if (!this.walking) this.#postura(this.g.player);
      game.events.emit('player:rig', true);
    });
    // El jugador es un combatiente más (ver src/entities/combat/Combatant.js): la IA de la Fase 5 usará lo mismo.
    this.combat = new Combatant(this.character, { stats: COMBAT.player, team: 'player', weapon: 'manos', events: game.events });
    this.armed = false;          // false = modo construcción; true = modo combate
    this.montaje = null;         // { fase: 'subiendo'|'bajando', t, desde, hasta, heading }
    this.weaponIndex = 0;
    // Armas de fuego: balas en el cargador de cada una, gatillo, mira y el arma de primera persona.
    this.cargador = {};
    this.gatillo = false;
    this.apuntando = false;
    this.cadencia = 0;
    this.recargando = 0;
    this.vista = null;           // modelo del arma pegado a la cámara (primera persona)
    this.interactables = []; // { x, z, r, label, key, run() }
    this.target = null;
    this.raycaster = new THREE.Raycaster();
    this.#ghost();
    this.#bindInput();
  }

  get walking() { return this.mode === 'walk'; }
  get focus() { return this.walking ? this.character : this.g.player; }

  register(item) { this.interactables.push(item); }

  // ───────────── Entrada ─────────────
  #bindInput() {
    const dom = this.g.renderer.domElement;
    const active = () => this.walking && this.g.state === 'playing' && !this.g.mapScreen.open;
    dom.addEventListener('click', () => { if (active() && document.pointerLockElement !== dom) dom.requestPointerLock?.(); });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!active()) return;
      const locked = document.pointerLockElement === dom;
      if (!locked && !(e.buttons & 1)) return;
      const k = 0.0024 * (this.g.settings.get('cameraSensitivity') || 1);
      this.yaw -= e.movementX * k;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * k * (this.g.settings.get('invertY') ? -1 : 1), -1.35, 1.2);
    });
    dom.addEventListener('mousedown', (e) => {
      if (!active() || document.pointerLockElement !== dom) return;
      // Clic de la rueda: fijar o soltar blanco (como en Dark Souls). Si no hay arma en la mano, la saca.
      if (e.button === 1) {
        e.preventDefault();
        if (!this.armed && COMBAT.enabled) this.toggleArmed(true);
        this.g.combatSys.toggleLock(this.combat, this.yaw);
        return;
      }
      if (this.armed && this.fuego) {
        if (e.button === 0) { this.gatillo = true; this.tiroPendiente = true; }
        if (e.button === 2) this.apuntando = true;
        return;
      }
      if (this.armed) {
        if (e.button === 0) this.combat.attack();
        if (e.button === 2) this.combat.setGuard(true);
        return;
      }
      if (e.button === 0) this.breakBlock();
      if (e.button === 2) this.placeBlock();
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 2) { this.combat.setGuard(false); this.apuntando = false; }
      if (e.button === 0) this.gatillo = false;
    });
    dom.addEventListener('wheel', (e) => {
      if (!active()) return;
      // Con blanco fijado, la rueda cambia de blanco hacia un lado; si no, de arma.
      if (this.combat.lockTarget) { this.g.combatSys.switchLock(this.combat, this.yaw, e.deltaY > 0 ? 1 : -1); return; }
      if (this.armed) this.cycleWeapon(e.deltaY > 0 ? 1 : -1);
      else this.selectSlot((this.slot + (e.deltaY > 0 ? 1 : -1) + BLOCKS.length) % BLOCKS.length);
    }, { passive: true });
    addEventListener('keydown', (e) => {
      if (this.g.state !== 'playing' || e.repeat || e.target instanceof HTMLInputElement) return;
      const d = /^Digit([1-9])$/.exec(e.code);
      if (d && this.walking && !this.armed) this.selectSlot(+d[1] - 1);
      if (!this.walking || !COMBAT.enabled) return;
      if (e.code === 'KeyX') this.toggleArmed();
      if (e.code === 'KeyZ' && this.armed) this.cycleWeapon();
      if (e.code === 'KeyQ' && this.armed) this.g.combatSys.toggleLock(this.combat, this.yaw);
      if (e.code === 'ControlLeft' && this.armed) this.#roll();
      if (e.code === 'KeyR' && this.fuego) this.recargar();
    });
    this.g.events.on('action', (a) => {
      if (this.g.state !== 'playing' || this.g.mapScreen.open) return;
      if (a === 'enterExit') this.walking ? this.tryEnter() : this.exitVehicle();
      if (a === 'interact' && this.walking) this.interact();
    });
  }

  selectSlot(i) {
    this.slot = i;
    this.g.events.emit('player:slot', i);
  }

  // ───────────── Combate ─────────────

  // Saca o guarda el arma. Guardada, el clic vuelve a construir; fuera, pelea.
  /** Armas disponibles: las de mano siempre; las de fuego, si están en la mochila (modo supervivencia). */
  get arsenal() {
    const fuego = PRUEBAS.todasLasArmas ? Object.keys(FIREARMS)
      : this.g.loot?.activo ? Object.keys(FIREARMS).filter((id) => this.g.inventory?.items.get(id)) : [];
    return [...ARSENAL, ...fuego];
  }

  /** Id del arma de fuego en la mano, o null. */
  get fuego() { return this.armed && FIREARMS[this.combat.weapon.id] ? this.combat.weapon.id : null; }

  toggleArmed(on = !this.armed) {
    this.armed = on;
    this.character.armed = on;   // sin esto la animación nunca pasaba a la guardia en reposo
    this.combat.setGuard(false);
    if (!on) {
      this.combat.lockTarget = null;
      this.g.events.emit('combat:lock', null);
      this.character.setWeapon(null);
    } else {
      const lista = this.arsenal;
      this.weaponIndex %= lista.length;
      this.character.setWeapon(WEAPONS[lista[this.weaponIndex]].model);
      this.combat.setWeapon(lista[this.weaponIndex]);
    }
    this.#cambioDeArma();
    this.g.events.emit('player:armed', on ? this.#rotuloArma() : null);
  }

  cycleWeapon(step = 1) {
    const lista = this.arsenal;
    this.weaponIndex = (this.weaponIndex + step + lista.length) % lista.length;
    const w = this.combat.setWeapon(lista[this.weaponIndex]);
    this.character.setWeapon(w.model);
    this.#cambioDeArma();
    this.g.events.emit('player:armed', this.#rotuloArma());
  }

  // ───────────── Armas de fuego ─────────────

  #rotuloArma() {
    const id = this.fuego;
    if (!id) return this.combat.weapon.nombre;
    const f = FIREARMS[id];
    const reserva = PRUEBAS.municionInfinita ? '∞' : this.g.inventory?.items.get(f.municion) || 0;
    return `${f.nombre} · ${this.cargador[id] ?? 0} / ${reserva}`;
  }

  #cambioDeArma() {
    const id = this.fuego;
    this.apuntando = false;
    this.gatillo = false;
    this.recargando = 0;
    // Armas largas: en reposo, bajas al frente y a dos manos (la pose de pistola las deja colgando).
    // Armas largas: en reposo, la pose de apuntar con el brazo bajado («listo bajo», RigBody.listoBajo).
    this.character.reposoArma = id ? (FIREARMS[id].larga ? 'Pistol_Aim_Neutral' : 'Pistol_Idle_Loop') : null;
    if (!id || !FIREARMS[id].larga) this.character.body.listoBajo?.(false);
    if (this.vista) { this.vista.removeFromParent(); this.vista = null; }
    if (id) {
      this.cargador[id] ??= 0;
      this.vista = firearmModel(id, 'primeraPersona');
      if (this.vista) { this.vista.visible = false; this.g.scene.add(this.vista); }
    }
  }

  /** Recarga con la munición de la mochila. */
  recargar() {
    const id = this.fuego;
    if (!id || this.recargando > 0) return;
    const f = FIREARMS[id], inv = this.g.inventory;
    const hay = PRUEBAS.municionInfinita ? Infinity : inv.items.get(f.municion) || 0;
    const falta = f.cargador - (this.cargador[id] || 0);
    if (falta <= 0) return;
    if (!hay) { this.g.hud.toast('No tienes munición para esta arma'); return; }
    const k = Math.min(hay, falta);
    if (!PRUEBAS.municionInfinita) inv.quitar(f.municion, k);
    this.recargando = f.recarga;
    this.recargaCuantas = k;
    this.character.trigger('recargar', { lock: f.recarga });
  }

  #fuegoUpdate(dt) {
    const id = this.fuego;
    this.character.apuntando = !!id && this.apuntando;
    if (!id) return;
    if (FIREARMS[id].larga) this.character.body.listoBajo?.(!this.apuntando && !this.gatillo && this.cadencia < -0.4);
    const f = FIREARMS[id];
    this.cadencia -= dt;
    if (this.recargando > 0) {
      this.recargando -= dt;
      if (this.recargando <= 0) {
        this.cargador[id] = (this.cargador[id] || 0) + this.recargaCuantas;
        this.g.events.emit('player:armed', this.#rotuloArma());
      }
      return;
    }
    const quiere = f.automatica ? this.gatillo : this.tiroPendiente;
    this.tiroPendiente = false;
    if (!quiere || this.cadencia > 0) return;
    if (!this.cargador[id]) { this.recargar(); return; }
    this.cadencia = f.cadencia;
    this.cargador[id]--;
    // El tiro sale de la cámara hacia el centro de la pantalla (la mira); el fogonazo, de la boca del arma.
    const cam = this.g.camera;
    const dir = cam.getWorldDirection(new THREE.Vector3());
    // Con blanco fijado, el tiro va a su pecho (la cámara sigue libre): es la ayuda de apuntado del fijado.
    const t = this.combat.lockTarget;
    if (t?.alive) dir.set(t.position.x - cam.position.x, t.position.y + 1.2 - cam.position.y, t.position.z - cam.position.z).normalize();
    // El personaje encara hacia donde dispara.
    this.character.heading = t?.alive ? Math.atan2(-(t.position.x - this.character.x), -(t.position.z - this.character.z)) : this.yaw;
    const boca = this.view === 'first' && this.vista
      ? this.vista.localToWorld(this.vista.userData.boca.clone())
      : new THREE.Vector3(this.character.x - Math.sin(this.yaw) * 0.6, this.character.y + 1.4, this.character.z - Math.cos(this.yaw) * 0.6);
    this.g.firearms.disparar(this.combat, cam.position.clone(), dir, id, { precision: this.apuntando ? 0.5 : 1.4, boca });
    this.retroceso = f.retroceso;
    this.patada = f.retroceso * 5;            // el cañón sube y vuelve (también en la mano, en tercera persona)
    this.pitch = Math.min(1.2, this.pitch + f.retroceso * 0.6);
    this.character.trigger('disparar');
    this.g.events.emit('player:armed', this.#rotuloArma());
  }

  // Retroceso del arma: la patada sube el cañón y lo echa atrás, y vuelve en ≈ 0,2 s.
  #patadaUpdate(dt) {
    this.patada = Math.max(0, (this.patada || 0) - dt * 2.4);
    for (const arma of [this.character.body.weapon, this.vista]) {
      const p = arma?.userData.patada;
      if (!p) continue;
      p.rotation.x = this.patada * 0.9;
      p.position.z = this.patada * 0.12;
    }
  }

  // Arma de primera persona: pegada a la cámara, con un poco de retroceso.
  #vistaUpdate(dt) {
    const v = this.vista;
    if (!v) return;
    v.visible = this.walking && this.view === 'first' && !!this.fuego;
    if (!v.visible) return;
    const cam = this.g.camera;
    this.retroceso = Math.max(0, (this.retroceso || 0) - dt * 0.5);
    v.position.copy(cam.position);
    v.quaternion.copy(cam.quaternion);
    // Apuntando, el arma se centra; si no, a la derecha y abajo.
    const k = this.apuntando ? 1 : 0;
    const larga = FIREARMS[this.fuego].larga;
    v.translateX((larga ? -0.2 : -0.17) * k);
    v.translateY((larga ? 0.1 : 0.06) * k);
    v.translateZ(this.retroceso * 1.5);
  }

  // Rueda hacia donde se está moviendo; quieto, hacia donde mira la cámara.
  #roll() {
    const keys = this.g.input.keys;
    const on = (...c) => (c.some((k) => keys.has(k)) ? 1 : 0);
    const f = on('KeyW', 'ArrowUp') - on('KeyS', 'ArrowDown');
    const s = on('KeyD', 'ArrowRight') - on('KeyA', 'ArrowLeft');
    let dx, dz;
    if (f || s) {
      const len = Math.hypot(f, s);
      dx = (-Math.sin(this.yaw) * (f / len) + Math.cos(this.yaw) * (s / len));
      dz = (-Math.cos(this.yaw) * (f / len) - Math.sin(this.yaw) * (s / len));
    } else {
      dx = -Math.sin(this.yaw); dz = -Math.cos(this.yaw);
    }
    if (this.combat.roll(dx, dz)) this.character.heading = Math.atan2(-dx, -dz);
  }

  // ───────────── Bajar / subir ─────────────
  exitVehicle() {
    const v = this.g.player;
    if (v.speedKmh > 12) { this.g.hud.toast('Frena antes de bajarte'); return; }
    const [fx, fz] = v.forward, lx = fz, lz = -fx; // izquierda del vehículo (lado del conductor)
    const w = (v.spec.width || 1.6) / 2 + 0.7;
    let x = v.x + lx * w, z = v.z + lz * w;
    const free = this.g.collision.resolveCircle(x, z, 0.4);
    if (free.hit && free.depth > 0.3) { x = v.x - lx * w; z = v.z - lz * w; }
    // En la moto se baja pasando la pierna por encima del sillín, todavía montado; al terminar se pone de pie.
    if (this.postura) {
      if (this.montaje) return;
      this.montaje = { fase: 'bajandoMoto', t: 0, x, z };
      return;
    }
    this.#bajarEn(x, z, true);
  }

  // Lo deja de pie en (x, z), junto al vehículo. `animar`: con la animación de levantarse del asiento.
  #bajarEn(x, z, animar) {
    const v = this.g.player;
    // Se desengancha del vehículo y aparece de pie al lado, con la animación de bajarse.
    const desde = this.character.object.getWorldPosition(new THREE.Vector3());
    this.#desmontar();
    this.character.place(x, z, v.heading, this.g.terrain.height(x, z));
    this.yaw = v.heading; this.pitch = -0.15;
    this.character.object.visible = true;
    this.mode = 'walk';
    if (animar) {
      this.montaje = { fase: 'bajando', t: 0, desde, hasta: new THREE.Vector3(x, this.character.y, z) };
      this.character.trigger('salirAsiento', { lock: MONTAJE.duracion });
    } else this.montaje = null;
    this.g.events.emit('player:mode', 'walk');
    this.g.hud.toast('A pie · E interactuar · clic der. poner bloque · clic izq. quitar · F subir');
  }

  tryEnter() {
    const c = this.character;
    const own = this.g.player;
    const dOwn = Math.hypot(own.x - c.x, own.z - c.z);
    if (dOwn < own.spec.length / 2 + 2.2) return this.#enter();
    // tomar un vehículo del tráfico cercano
    let best = null;
    for (const car of this.g.traffic.cars) {
      const d = Math.hypot(car.v.x - c.x, car.v.z - c.z);
      if (d < car.v.spec.length / 2 + 2.2 && (!best || d < best.d)) best = { car, d };
    }
    if (best) return this.takeTraffic(best.car);
    this.g.hud.toast('No hay un vehículo cerca');
  }

  takeTraffic(car) {
    const { type, x, z, heading } = { type: car.v.type, x: car.v.x, z: car.v.z, heading: car.v.heading };
    const color = car.v.modelOpts?.color ?? null;
    this.g.traffic.takeCar(car);
    this.g.replacePlayerVehicle(type, x, z, heading, color);
    this.#enter();
    this.g.hud.toast(`Tomaste un ${VEHICLES[type].name.toLowerCase()} del tráfico`);
  }

  #enter() {
    if (this.armed) this.toggleArmed(false);
    this.mode = 'drive';
    this.character.sitting = null;
    this.ghost.visible = false;
    document.exitPointerLock?.();
    // El vehículo del jugador nunca dibuja el muñeco de cajas: el conductor es su propio personaje.
    this.g.rebuildPlayerVehicle({ driver: false });
    this.#montar();
    this.g.cameraSys.initialized = false;
    this.g.events.emit('player:mode', 'drive');
    this.#setTarget(null);
  }

  /** Sienta al personaje en el vehículo actual sin animación de entrada. Para el arranque de la partida y para
   *  cuando se cambia de vehículo desde el garaje: ahí no se está "subiendo", ya se está dentro. */
  sentarEnVehiculo() {
    if (this.walking) return;
    this.g.rebuildPlayerVehicle({ driver: false });
    this.#montar({ animar: false });          // sin transición: ya está sentado
    const v = this.g.player;
    if (v.spec.seat) this.character.object.position.set(...v.spec.seat);
  }

  // ───────────── Ir montado en el vehículo ─────────────

  // Cuelga el personaje del cuerpo del vehículo, en el asiento del conductor.
  #montar({ animar = true } = {}) {
    const v = this.g.player;
    const asiento = v.spec.seat;
    if (!asiento || !v.body) { this.character.object.visible = false; return; }
    const desde = this.character.object.getWorldPosition(new THREE.Vector3());
    v.body.add(this.character.object);
    this.character.object.position.set(...asiento);
    this.character.object.rotation.set(0, 0, 0);
    this.character.object.visible = true;
    this.character.driving = true;
    this.#postura(v);
    if (!animar) { this.montaje = null; return; }
    if (this.postura) {
      // Giro con el que llega respecto a la moto, para enderezarlo mientras se acerca.
      const yaw0 = Math.atan2(Math.sin(this.character.heading - v.heading), Math.cos(this.character.heading - v.heading));
      this.montaje = { fase: 'subiendoMoto', t: 0, desde, yaw0 };
      this.#montajeUpdate(0);
      return;
    }
    this.montaje = { fase: 'subiendo', t: 0, desde };
    this.character.trigger('entrarAsiento', { lock: MONTAJE.duracion });
  }

  // Lo devuelve a la escena, donde se mueve por su cuenta.
  #desmontar() {
    const o = this.character.object;
    if (o.parent && o.parent !== this.g.scene) this.g.scene.add(o);
    o.rotation.set(0, 0, 0);
    this.character.driving = false;
    this.#postura(null);
  }

  // Postura a horcajadas (moto): puntos de agarre colgados del vehículo y cinemática inversa en brazos y piernas.
  // Sin postura (carros, o a pie) se quita. Sólo la toma el cuerpo con esqueleto.
  #postura(v) {
    const body = this.character.body;
    if (this.postura) for (const o of this.postura.puntos) o.removeFromParent();
    this.postura = null;
    body.setRetoque?.(null);
    body.setAlcances?.(null);
    const p = v && POSTURAS[v.spec.postura];
    if (!p || !body.setAlcances || !v.body) return;
    const puntos = [];
    const punto = (xyz) => { const o = new THREE.Object3D(); o.position.set(...xyz); v.body.add(o); puntos.push(o); return o; };
    const P = { p, puntos, mano: p.manos.map(punto), pie: p.pies.map(punto), codo: p.codos.map(punto), rodilla: p.rodillas.map(punto) };
    body.setRetoque(p.retoque, 1);
    body.setAlcances([0, 1].flatMap((i) => {
      const s = i ? 'r' : 'l';
      return [
        { huesos: [`upperarm_${s}`, `lowerarm_${s}`, `hand_${s}`], objetivo: P.mano[i], polo: P.codo[i] },
        { huesos: [`thigh_${s}`, `calf_${s}`, `foot_${s}`], objetivo: P.pie[i], polo: P.rodilla[i] },
      ];
    }));
    this.postura = P;
  }

  // Subirse a la moto, k de 0 (de pie junto al pedal izquierdo) a 1 (sentado). Bajarse es lo mismo al revés.
  // La pierna izquierda se queda en el suelo mientras la derecha pasa por encima de la parte trasera del sillín.
  #horcajadas(k) {
    const P = this.postura, p = P.p, o = this.character.object;
    const seat = this.g.player.spec.seat;
    const lado = p.pies[0][0] - 0.35;                        // de pie, a la izquierda de la moto
    const e = THREE.MathUtils.smoothstep(k, 0.15, 0.85);
    o.position.set(THREE.MathUtils.lerp(seat[0] + lado, seat[0], e), seat[1] + Math.sin(Math.PI * e) * 0.1, seat[2]);
    o.rotation.set(0, 0, Math.sin(Math.PI * e) * 0.12);     // se ladea hacia la moto al pasar la pierna
    // Pie izquierdo: en el suelo hasta que la derecha ya pasó; luego sube al pedal.
    const [pl, pr] = p.pies;
    const subeL = THREE.MathUtils.smoothstep(k, 0.75, 1);
    P.pie[0].position.set(THREE.MathUtils.lerp(lado + 0.12, pl[0], subeL), THREE.MathUtils.lerp(0.04, pl[1], subeL), pl[2]);
    // Pie derecho: curva por encima de la parte trasera del sillín.
    const r = THREE.MathUtils.smoothstep(k, 0.1, 0.8), q = 1 - r;
    const a = [lado + 0.3, 0.04, pl[2] + 0.1], b = [0.05, p.sillin + 0.45, 0.55];
    P.pie[1].position.set(...[0, 1, 2].map((i) => q * q * a[i] + 2 * q * r * b[i] + r * r * pr[i]));
    // La rodilla derecha apunta hacia arriba y atrás mientras la pierna pasa, y adelante al llegar al pedal.
    P.rodilla[1].position.set(0.3, THREE.MathUtils.lerp(1.4, p.rodillas[1][1], r), THREE.MathUtils.lerp(0.4, p.rodillas[1][2], r));
  }

  #horcajadasFin() {
    const P = this.postura, p = P.p;
    p.pies.forEach((xyz, i) => P.pie[i].position.set(...xyz));
    p.rodillas.forEach((xyz, i) => P.rodilla[i].position.set(...xyz));
    this.character.object.position.set(...this.g.player.spec.seat);
    this.character.object.rotation.set(0, 0, 0);
  }

  // Mueve la transición de subir o bajar. Mientras dura, el personaje va interpolando entre el sitio donde
  // estaba y el asiento (o al revés), que es lo que hace que no aparezca de golpe dentro del carro.
  #montajeUpdate(dt) {
    const m = this.montaje;
    if (!m) return;
    if (m.fase === 'subiendoMoto' || m.fase === 'bajandoMoto') return this.#montajeMoto(m, dt);
    m.t += dt / MONTAJE.duracion;
    if (m.t >= 1) {
      // Al terminar se encaja en el sitio exacto: si no, con fotogramas largos la interpolación se queda a
      // medias y el personaje acaba descuadrado del asiento.
      if (m.fase === 'subiendo' && this.g.player.spec.seat) {
        this.character.object.position.set(...this.g.player.spec.seat);
      }
      this.montaje = null;
      return;
    }
    const k = 1 - (1 - m.t) * (1 - m.t);   // frena al llegar
    const o = this.character.object;
    if (m.fase === 'subiendo') {
      // `desde` está en espacio del mundo y el personaje ya cuelga del vehículo: se convierte al espacio local.
      const local = o.parent.worldToLocal(m.desde.clone());
      const asiento = new THREE.Vector3(...this.g.player.spec.seat);
      o.position.lerpVectors(local, asiento, k);
    } else {
      o.position.lerpVectors(m.desde, m.hasta, k);
      o.position.y = Math.max(m.hasta.y, o.position.y);
    }
  }

  // Subir: primero camina hasta el costado izquierdo (con la animación de caminar), luego pasa la pierna.
  // Bajar: pasa la pierna de vuelta y queda de pie a la izquierda, ya libre.
  #montajeMoto(m, dt) {
    const M = MONTAJE.moto, o = this.character.object, body = this.character.body;
    if (!this.postura) { this.montaje = null; return; }
    if (m.fase === 'bajandoMoto') {
      m.t += dt / M.bajar;
      if (m.t >= 1) {
        // Ya está de pie al lado: se suelta de la moto donde quedó.
        const p = o.getWorldPosition(new THREE.Vector3());
        this.#bajarEn(p.x, p.z, false);
        return;
      }
      this.#horcajadas(1 - m.t);
      return;
    }
    m.t += dt / M.subir;
    if (m.t >= 1) { this.#horcajadasFin(); body.retoquePeso = 1; this.montaje = null; return; }
    if (m.t < M.acercarse) {
      // Camina desde donde estaba hasta el costado, enderezándose con la moto. Sin postura: va de pie.
      const k = m.t / M.acercarse;
      const seat = this.g.player.spec.seat;
      const lado = new THREE.Vector3(seat[0] + this.postura.p.pies[0][0] - 0.35, 0, seat[2]);
      const local = o.parent.worldToLocal(m.desde.clone());
      o.position.lerpVectors(local, lado, k);
      o.rotation.set(0, m.yaw0 * (1 - k), 0);
      m.aPie = true;
      body.retoquePeso = 0;
      return;
    }
    m.aPie = false;
    body.retoquePeso = 1;
    this.#horcajadas((m.t - M.acercarse) / (1 - M.acercarse));
  }

  // ───────────── Construcción ─────────────
  #ghost() {
    const g = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)), new THREE.LineBasicMaterial({ color: '#9cc25a', transparent: true, opacity: 0.9, depthTest: false }));
    g.renderOrder = 20;
    g.visible = false;
    this.g.scene.add(g);
    this.ghost = g;
  }

  #occupiedByPlayer(x, y, z) {
    const c = this.character;
    // círculo (cx, cz, r) contra la celda [x, x+1] × [z, z+1]
    const overlapXZ = (cx, cz, r) => Math.hypot(Math.max(x, Math.min(cx, x + 1)) - cx, Math.max(z, Math.min(cz, z + 1)) - cz) < r;
    if (overlapXZ(c.x, c.z, c.radius) && y < c.y + c.height && y + 1 > c.y) return true;
    const v = this.g.player;
    if (Math.hypot(x + 0.5 - v.x, z + 0.5 - v.z) < v.spec.length / 2 + 0.3 && y < v.y + 2) return true;
    return false;
  }

  placeBlock() {
    const t = this.aim;
    if (!t?.place) return;
    const [x, y, z] = t.place;
    if (this.g.blocks.get(x, y, z) !== undefined || this.#occupiedByPlayer(x, y, z)) return;
    if (this.g.blocks.set(x, y, z, this.slot)) { this.character.swing(); this.g.audio.click?.(); }
    else this.g.hud.toast('Llegaste al máximo de bloques');
  }

  breakBlock() {
    const t = this.aim;
    if (!t?.block) return;
    this.g.blocks.remove(...t.block);
    this.character.swing();
    this.g.audio.click?.(true);
  }

  // ───────────── Apuntar ─────────────
  #aimUpdate() {
    const cam = this.g.camera;
    const origin = cam.position.clone(), dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const c = this.character;
    const camDist = origin.distanceTo(new THREE.Vector3(c.x, c.y + 1.5, c.z));
    const far = REACH + camDist;
    const aim = { t: Infinity };

    // 1) bloques del jugador
    const b = this.g.blocks.raycast(origin, dir, far);
    if (b) Object.assign(aim, { t: b.t, block: b.cell, place: b.cell.map((v, i) => v + b.normal[i]), kind: 'block', type: b.type });

    // 2) mundo (edificios, suelo, hitos, vehículos)
    this.raycaster.set(origin, dir);
    this.raycaster.far = Math.min(far, aim.t);
    const hits = this.raycaster.intersectObjects(this.worldTargets(), true);
    const hit = hits.find((h) => h.object.visible && h.object !== this.ghost && !isDescendant(h.object, c.object));
    if (hit && hit.distance < aim.t) {
      const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
      const p = hit.point.clone().addScaledVector(n, 0.05);
      Object.assign(aim, { t: hit.distance, block: null, place: [Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)], kind: 'world', point: hit.point, object: hit.object });
    }
    // fuera de alcance desde el personaje
    if (aim.place) {
      const [px, py, pz] = aim.place;
      if (Math.hypot(px + 0.5 - c.x, py + 0.5 - (c.y + 1), pz + 0.5 - c.z) > REACH) aim.place = null;
    }
    if (aim.block) {
      const [px, py, pz] = aim.block;
      if (Math.hypot(px + 0.5 - c.x, py + 0.5 - (c.y + 1), pz + 0.5 - c.z) > REACH) aim.block = null;
    }
    this.aim = aim.t < Infinity ? aim : null;

    // contorno: bloque a quitar (rojo) o lugar donde se pondrá (verde)
    const g = this.ghost;
    const cell = this.aim?.block || this.aim?.place;
    g.visible = !!cell;
    if (cell) {
      g.position.set(cell[0] + 0.5, cell[1] + 0.5, cell[2] + 0.5);
      g.material.color.set(this.aim.block ? '#e2533b' : '#9cc25a');
    }
  }

  /** Lo que corta un rayo: edificios, hitos, suelo, vehículos (también lo usa FirearmSystem). */
  worldTargets() {
    const out = [];
    for (const t of this.g.streamer.tiles.values()) if (t.group) out.push(t.group);
    for (const l of this.g.landmarkRoots) out.push(l);
    out.push(this.g.player.object);
    for (const car of this.g.traffic.cars) out.push(car.v.object);
    if (this.g.ground) for (const lvl of this.g.ground.levels.slice(0, 1)) for (const m of lvl.tiles.values()) if (m) out.push(m);
    return out;
  }

  // ───────────── Interacción (E / F) ─────────────
  //
  // Todo lo que se puede usar a pie entra como candidato con su categoría (`tipo`, ver interaccion.config.js).
  // Gana la de más prioridad; a igual prioridad, la más cercana y la que queda delante.
  #findInteraction() {
    const c = this.character;
    const fx = -Math.sin(c.heading), fz = -Math.cos(c.heading);
    let best = null, bestScore = Infinity;
    const considerar = (it, r) => {
      if (!it) return;
      const tipo = INTERACCION.tipos[it.tipo] || INTERACCION.tipos.info;
      let score = -tipo.prioridad;
      if (it.x !== undefined) {
        const dx = it.x - c.x, dz = it.z - c.z, d = Math.hypot(dx, dz);
        if (r && d > r) return;
        const delante = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
        // Fracción en [0, 1): ordena dentro de la misma prioridad sin saltar a otra.
        score += Math.min(0.99, Math.max(0, d / (r || 3) + INTERACCION.alFrente * (1 - delante) / 2));
      }
      if (score < bestScore) { bestScore = score; best = it; }
    };

    // Vehículos: el propio y los del tráfico
    const own = this.g.player;
    considerar({ tipo: 'vehiculo', x: own.x, z: own.z, key: 'F', label: `Subir al ${own.spec.name}`, run: () => this.#enter() },
      own.spec.length / 2 + 2.2);
    for (const car of this.g.traffic.cars) {
      considerar({ tipo: 'vehiculo', x: car.v.x, z: car.v.z, key: 'F', label: `Tomar ${car.v.spec.name.toLowerCase()} del tráfico`,
        run: () => this.takeTraffic(car) }, car.v.spec.length / 2 + 2.2);
    }
    // Supervivencia: trueque y botín (cada sistema ya filtra por alcance)
    if (this.g.loot?.activo) {
      considerar(this.g.bases?.interaccion(c.x, c.z));
      considerar(this.g.loot.interaccion(c.x, c.z));
    }
    // Objetos registrados por los hitos: bancas, letreros, puertas
    for (const it of this.interactables) considerar(it, it.r);
    if (best) return best;

    // Sin nada al alcance: lo que apunta la mira (bloque propio o edificio real)
    const a = this.aim;
    if (a?.kind === 'block') return { tipo: 'bloque', key: 'Clic izq.', label: `${BLOCKS[a.type].name} (tu bloque) — ${BLOCKS[a.type].note}` };
    if (a?.kind === 'world' && a.point) {
      const info = this.#buildingInfo(a.point.x, a.point.z);
      if (info) return { tipo: 'edificio', x: a.point.x, z: a.point.z, key: 'E', label: info.title, detail: info.detail,
        run: () => this.g.hud.info(info.title, info.detail) };
    }
    return null;
  }

  // Datos reales del edificio bajo la mira: fuente, altura, área, calle y lugar (POI) si lo hay
  #buildingInfo(x, z) {
    const T = this.g.manifest.tileSize;
    const tile = this.g.streamer.tiles.get(`${Math.floor(x / T)}_${Math.floor(z / T)}`);
    const b = tile?.data?.buildings.find((bd) => pointInPolygon(x, z, bd.p) || nearPolygon(x, z, bd.p, 0.6));
    if (!b) return null;
    const SRC = { osm: 'OpenStreetMap (mapeado a mano)', google: 'Google Open Buildings (detectado por satélite)', ms: 'Microsoft Building Footprints (detectado por satélite)' };
    const street = this.g.network.streetName(x, z);
    let poi = null, pd = 45;
    for (const p of this.g.map.pois) { const d = Math.hypot(p.x - x, p.z - z); if (d < pd) { pd = d; poi = p; } }
    const title = b.n || poi?.n || (street?.name ? `Edificio sobre la ${street.name}` : 'Edificio');
    const detail = [
      `Huella: ${SRC[b.s] || 'datos abiertos'}`,
      `Área: ${Math.abs(polygonArea(b.p)).toFixed(0)} m² · Altura estimada: ${b.h.toFixed(1)} m (${b.f} piso${b.f > 1 ? 's' : ''}, GHSL)`,
      street?.name ? `Calle: ${street.name}` : null,
      poi ? `Cerca: ${poi.n}` : null,
    ].filter(Boolean);
    return { title, detail };
  }

  interact() {
    // Un cronista manda sobre cualquier otra cosa que haya cerca: es el contenido del juego.
    if (this.g.story?.hablar()) { this.character.trigger('hablar'); return; }
    const it = this.#findInteraction();
    if (!it?.run) return;
    this.usar(it);
  }

  /** Usa un objeto según su categoría: se gira hacia él, hace el gesto que le toca y lo ejecuta. */
  usar(it) {
    const tipo = INTERACCION.tipos[it.tipo] || INTERACCION.tipos.info;
    if (tipo.encarar && it.x !== undefined) this.character.encarar(it.x, it.z);
    if (tipo.accion) this.character.trigger(tipo.accion);
    it.run();
  }

  #setTarget(t) {
    const key = t ? `${t.tipo}|${t.key}|${t.label}` : '';
    if (key === this.targetKey) return;
    this.targetKey = key;
    this.g.events.emit('player:target', t);
  }

  // ───────────── Por frame ─────────────
  update(dt) {
    if (!this.walking) {
      this.ghost.visible = false;
      // Montado: no hay física que correr, sólo la animación de conducir y la transición de subida.
      this.#montajeUpdate(dt);
      this.character.cameraDistance = 0;
      const aPie = !!this.montaje?.aPie;   // acercándose a la moto: camina
      this.character.body.apply({ dt, speed: aPie ? 1.6 : 0, onGround: true, sitting: false, driving: !aPie, armed: false, distance: 0 });
      return;
    }
    this.#montajeUpdate(dt);
    const g = this.g, keys = g.input.keys;
    const on = (...codes) => (g.input.enabled && codes.some((c) => keys.has(c)) ? 1 : 0);
    const input = {
      forward: on('KeyW', 'ArrowUp') - on('KeyS', 'ArrowDown'),
      strafe: on('KeyD', 'ArrowRight') - on('KeyA', 'ArrowLeft'),
      run: !!on('ShiftLeft', 'ShiftRight'),
      jump: !!on('Space'),
      yaw: this.yaw,
    };
    // La distancia a la cámara decide la frecuencia de mezcla de animación (CHARACTERS.animationLod).
    this.character.cameraDistance = g.camera.position.distanceTo(this.character.object.position);

    const world = { collision: g.collision, terrain: g.terrain, blocks: g.blocks };
    const c = this.combat;
    if (c.state === 'roll') {
      // Rodando manda el impulso: no se acelera ni se frena con el teclado.
      const step = c.rollStep(dt);
      if (step) this.character.displace(step.x, step.z, world);
      this.character.update(dt, { ...input, forward: 0, strafe: 0, jump: false }, world);
    } else {
      // Atacando o aturdido no se camina, pero sí se sigue cayendo.
      const locked = c.state === 'attack' || c.state === 'hit' || c.state === 'dead';
      const slowed = c.guarding || (this.fuego && this.apuntando) ? 0.45 : 1;
      this.character.update(dt, locked
        ? { ...input, forward: 0, strafe: 0, run: false, jump: false }
        : { ...input, forward: input.forward * slowed, strafe: input.strafe * slowed, run: input.run && !c.guarding },
      world);
      // Con blanco fijado, el personaje encara al enemigo aunque camine de lado.
      if (c.lockTarget?.alive) {
        const t = c.lockTarget.position;
        this.character.heading = Math.atan2(-(t.x - this.character.x), -(t.z - this.character.z));
      }
    }

    this.#chocarConVehiculos();
    this.character.guardia = c.guarding;
    this.#fuegoUpdate(dt);
    if (this.fuego && (this.apuntando || this.gatillo) && !c.lockTarget?.alive) this.character.heading = this.yaw;
    this.#aimUpdate();
    // La búsqueda no hace falta en cada fotograma (ver INTERACCION.hz); la tecla E busca de nuevo al pulsar.
    this.buscarEn = (this.buscarEn ?? 0) - dt;
    if (this.buscarEn <= 0) {
      this.buscarEn = 1 / INTERACCION.hz;
      this.#setTarget(this.armed || this.character.sitting ? null : this.#findInteraction());
    }
  }

  // A pie, los vehículos (el propio estacionado y los del tráfico) son sólidos: el personaje se empuja fuera de
  // su caja (largo × ancho del vehículo, orientada con su rumbo) por el lado de menor penetración.
  #chocarConVehiculos() {
    const c = this.character;
    if (c.sitting) return;
    const vehiculos = [this.g.player, ...this.g.traffic.cars.map((car) => car.v)];
    for (const v of vehiculos) {
      const hx = (v.spec.width || 1.6) / 2 + c.radius, hz = v.spec.length / 2 + c.radius;
      const dx = c.x - v.x, dz = c.z - v.z;
      if (Math.abs(dx) > hz + 1 || Math.abs(dz) > hz + 1) continue;
      if (c.y > v.y + 1.6) continue;                    // encima del techo (saltando) no estorba
      // A espacio del vehículo: adelante = −Z local.
      const cos = Math.cos(v.heading), sin = Math.sin(v.heading);
      const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
      const px = hx - Math.abs(lx), pz = hz - Math.abs(lz);
      if (px <= 0 || pz <= 0) continue;
      let nx = lx, nz = lz;
      if (px < pz) nx = Math.sign(lx || 1) * hx; else nz = Math.sign(lz || 1) * hz;
      c.x = v.x + nx * cos + nz * sin;
      c.z = v.z - nx * sin + nz * cos;
      c.vx = c.vz = 0;
    }
    c.object.position.set(c.x, c.y, c.z);
  }

  updateCamera(dt) {
    const cam = this.g.camera, c = this.character;
    const eye = new THREE.Vector3(c.x, c.y + (c.sitting ? 1.15 : 1.62), c.z);
    const dir = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    if (this.view === 'first') {
      cam.position.copy(eye);
      c.object.visible = false;
    } else {
      c.object.visible = true;
      // por encima del hombro derecho; se acerca si hay pared o suelo detrás
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      // Apuntando con arma de fuego, la cámara se acerca al hombro.
      let dist = this.fuego && this.apuntando ? 1.7 : 3.6;
      const back = eye.clone().addScaledVector(right, 0.55);
      this.raycaster.set(back, dir.clone().negate());
      this.raycaster.far = dist;
      const hit = this.raycaster.intersectObjects(this.worldTargets().filter((o) => o !== this.g.player.object), true)[0];
      if (hit) dist = Math.max(0.6, hit.distance - 0.3);
      cam.position.copy(back).addScaledVector(dir, -dist);
      cam.position.y = Math.max(cam.position.y, this.g.terrain.height(cam.position.x, cam.position.z) + 0.4);
    }
    cam.lookAt(eye.clone().addScaledVector(dir, 20));
    const fov = this.fuego && this.apuntando ? (this.view === 'first' ? 45 : 50) : 62;
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    this.#patadaUpdate(dt);
    this.#vistaUpdate(dt);
  }

  toggleView() {
    this.view = this.view === 'third' ? 'first' : 'third';
    this.g.hud.toast(this.view === 'first' ? 'Primera persona' : 'Tercera persona');
  }

  placeCharacter(x, z) {
    this.character.place(x, z, this.character.heading, this.g.terrain.height(x, z));
  }
}

function isDescendant(o, root) { for (; o; o = o.parent) if (o === root) return true; return false; }
function nearPolygon(x, z, p, tol) {
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length, ax = p[i], az = p[i + 1], bx = p[j], bz = p[j + 1];
    const l2 = (bx - ax) ** 2 + (bz - az) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2));
    if (Math.hypot(x - ax - t * (bx - ax), z - az - t * (bz - az)) < tol) return true;
  }
  return false;
}
