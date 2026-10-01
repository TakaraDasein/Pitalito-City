import * as THREE from 'three';
import { Character } from '../entities/character/Character.js';
import { BLOCKS, REACH } from '../config/blocks.config.js';
import { VEHICLES } from '../config/vehicles.config.js';
import { COMBAT, ARSENAL, WEAPONS } from '../config/combat.config.js';
import { Combatant } from '../entities/combat/Combatant.js';
import { pointInPolygon, polygonArea } from '../geo/geometry.js';

// Jugador a pie: bajar/subir de vehículos (F), caminar/correr/saltar, cámara con mouse (tercera o primera persona),
// mira para interactuar (E) y construir tipo Minecraft (clic izq. = quitar bloque, clic der. = poner bloque, 1–9 =
// elegir bloque, rueda = cambiar bloque).
//
// **Dos modos que no se pisan** (ver docs/PLAN_JUEGO.md): con el arma guardada se construye, con el arma en la
// mano se pelea. X saca o guarda el arma, Z cambia de arma. Con el arma fuera: clic izq. = golpe, clic der. =
// cubrirse, Ctrl = rodar, Q = fijar blanco.
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
    this.character.useRig(game.assets, game.settings.get('look')).then((ok) => { if (ok) game.events.emit('player:rig', true); });
    // El jugador es un combatiente más (ver src/entities/combat/Combatant.js): la IA de la Fase 5 usará lo mismo.
    this.combat = new Combatant(this.character, { stats: COMBAT.player, team: 'player', weapon: 'manos', events: game.events });
    this.armed = false;          // false = modo construcción; true = modo combate
    this.weaponIndex = 0;
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
      if (this.armed) {
        if (e.button === 0) this.combat.attack();
        if (e.button === 2) this.combat.setGuard(true);
        return;
      }
      if (e.button === 0) this.breakBlock();
      if (e.button === 2) this.placeBlock();
    });
    addEventListener('mouseup', (e) => { if (e.button === 2) this.combat.setGuard(false); });
    dom.addEventListener('wheel', (e) => {
      if (!active()) return;
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
  toggleArmed(on = !this.armed) {
    this.armed = on;
    this.combat.setGuard(false);
    if (!on) {
      this.combat.lockTarget = null;
      this.g.events.emit('combat:lock', null);
      this.character.setWeapon(null);
    } else {
      this.character.setWeapon(WEAPONS[ARSENAL[this.weaponIndex]].model);
      this.combat.setWeapon(ARSENAL[this.weaponIndex]);
    }
    this.g.events.emit('player:armed', on ? this.combat.weapon.nombre : null);
  }

  cycleWeapon(step = 1) {
    this.weaponIndex = (this.weaponIndex + step + ARSENAL.length) % ARSENAL.length;
    const w = this.combat.setWeapon(ARSENAL[this.weaponIndex]);
    this.character.setWeapon(w.model);
    this.g.events.emit('player:armed', w.nombre);
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
    this.character.place(x, z, v.heading, this.g.terrain.height(x, z));
    this.yaw = v.heading; this.pitch = -0.15;
    this.character.object.visible = true;
    this.mode = 'walk';
    this.g.rebuildPlayerVehicle({ driver: false });
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
    this.character.object.visible = false;
    this.character.sitting = null;
    this.ghost.visible = false;
    document.exitPointerLock?.();
    this.g.rebuildPlayerVehicle({ driver: true });
    this.g.cameraSys.initialized = false;
    this.g.events.emit('player:mode', 'drive');
    this.#setTarget(null);
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
    const hits = this.raycaster.intersectObjects(this.#worldTargets(), true);
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

  #worldTargets() {
    const out = [];
    for (const t of this.g.streamer.tiles.values()) if (t.group) out.push(t.group);
    for (const l of this.g.landmarkRoots) out.push(l);
    out.push(this.g.player.object);
    for (const car of this.g.traffic.cars) out.push(car.v.object);
    if (this.g.ground) for (const lvl of this.g.ground.levels.slice(0, 1)) for (const m of lvl.tiles.values()) if (m) out.push(m);
    return out;
  }

  // ───────────── Interacción (E) ─────────────
  #findInteraction() {
    const c = this.character;
    // vehículos cercanos
    const own = this.g.player;
    if (Math.hypot(own.x - c.x, own.z - c.z) < own.spec.length / 2 + 2.2) return { key: 'F', label: `Subir al ${own.spec.name}`, run: () => this.#enter() };
    for (const car of this.g.traffic.cars) {
      if (Math.hypot(car.v.x - c.x, car.v.z - c.z) < car.v.spec.length / 2 + 2.2) return { key: 'F', label: `Tomar ${car.v.spec.name.toLowerCase()} del tráfico`, run: () => this.takeTraffic(car) };
    }
    // objetos registrados (bancas, letreros, hitos)
    let best = null;
    for (const it of this.interactables) {
      const d = Math.hypot(it.x - c.x, it.z - c.z);
      if (d < it.r && (!best || d < best.d)) best = { ...it, d };
    }
    if (best) return best;
    // lo que apunta la mira: edificio real o bloque propio
    const a = this.aim;
    if (a?.kind === 'block') return { key: 'Clic izq.', label: `${BLOCKS[a.type].name} (tu bloque) — ${BLOCKS[a.type].note}` };
    if (a?.kind === 'world' && a.point) {
      const info = this.#buildingInfo(a.point.x, a.point.z);
      if (info) return { key: 'E', label: info.title, detail: info.detail, run: () => this.g.hud.info(info.title, info.detail) };
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
    if (this.g.story?.hablar()) { this.character.trigger('interact'); return; }
    const it = this.#findInteraction();
    if (!it?.run) return;
    this.character.trigger('interact');
    it.run();
  }

  #setTarget(t) {
    const key = t ? `${t.key}|${t.label}` : '';
    if (key === this.targetKey) return;
    this.targetKey = key;
    this.g.events.emit('player:target', t);
  }

  // ───────────── Por frame ─────────────
  update(dt) {
    if (!this.walking) { this.ghost.visible = false; return; }
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
      const slowed = c.guarding ? 0.45 : 1;
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

    this.#aimUpdate();
    this.#setTarget(this.armed ? null : this.#findInteraction());
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
      let dist = 3.6;
      const back = eye.clone().addScaledVector(right, 0.55);
      this.raycaster.set(back, dir.clone().negate());
      this.raycaster.far = dist;
      const hit = this.raycaster.intersectObjects(this.#worldTargets().filter((o) => o !== this.g.player.object), true)[0];
      if (hit) dist = Math.max(0.6, hit.distance - 0.3);
      cam.position.copy(back).addScaledVector(dir, -dist);
      cam.position.y = Math.max(cam.position.y, this.g.terrain.height(cam.position.x, cam.position.z) + 0.4);
    }
    cam.lookAt(eye.clone().addScaledVector(dir, 20));
    if (cam.fov !== 62) { cam.fov = 62; cam.updateProjectionMatrix(); }
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
