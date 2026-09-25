import * as THREE from 'three';
import { EventBus } from './EventBus.js';
import { AssetManager } from './AssetManager.js';
import { Settings } from './Settings.js';
import { PostFX } from '../render/PostFX.js';
import { GAME } from '../config/game.config.js';
import { PLAYER_ROSTER, VEHICLES } from '../config/vehicles.config.js';
import { projection } from '../geo/projection.js';
import { distToSegment } from '../geo/geometry.js';
import { MaterialLibrary, LAYER } from '../materials/MaterialLibrary.js';
import { Environment } from '../world/Environment.js';
import { Terrain } from '../world/Terrain.js';
import { ImageryGround, groundDetail } from '../world/ImageryGround.js';
import { CollisionWorld } from '../world/CollisionWorld.js';
import { WorldStreamer } from '../world/WorldStreamer.js';
import { RoadNetwork } from '../world/RoadNetwork.js';
import { buildCityLOD } from '../world/CityLOD.js';
import { GeometryBatch, ribbon } from '../world/GeometryBatch.js';
import { AreaBuilder, buildAreas } from '../world/builders/AreaBuilder.js';
import { RoadBuilder } from '../world/builders/RoadBuilder.js';
import { BuildingBuilder } from '../world/builders/BuildingBuilder.js';
import { VegetationBuilder, wind } from '../world/builders/VegetationBuilder.js';
import { PowerLineBuilder } from '../world/builders/PowerLineBuilder.js';
import { WeatherSystem } from '../systems/WeatherSystem.js';
import { WORLD } from '../config/world.config.js';
import { StreetLightBuilder } from '../world/builders/StreetLightBuilder.js';
import { LANDMARKS } from '../world/landmarks/index.js';
import { Vehicle } from '../entities/vehicles/Vehicle.js';
import { InputSystem } from '../systems/InputSystem.js';
import { CameraSystem, MODE_LABELS } from '../systems/CameraSystem.js';
import { TrafficSystem } from '../systems/TrafficSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { HUD } from '../ui/HUD.js';
import { MapRenderer } from '../ui/MapRenderer.js';
import { Minimap } from '../ui/Minimap.js';
import { MapScreen } from '../ui/MapScreen.js';
import { Menus } from '../ui/Menus.js';
import { Garage } from '../ui/Garage.js';

// Orquestador: crea los sistemas, los conecta por eventos y corre el bucle principal.
export class Game {
  constructor(root) {
    this.root = root;
    this.events = new EventBus();
    this.settings = new Settings(this.events);
    this.clock = new THREE.Clock();
    this.time = 0;
    this.route = null;
    this.waypoint = null;
    this.rosterIndex = 0;
    this.debug = false;
    this.fps = 60;
    this.state = 'loading'; // loading | menu | playing | paused | garage
  }

  setState(state) {
    this.prevState = this.state;
    this.state = state;
    this.root.dataset.state = state;
    const playing = state === 'playing';
    if (this.input) this.input.enabled = playing && !this.mapScreen?.open;
    if (this.cameraSys) this.cameraSys.enabled = playing;
    if (this.audio) this.audio.active = playing;
    if (this.garage) { if (state === 'garage') this.garage.show(); else this.garage.hide(); }
  }

  showMainMenu() {
    this.setState('menu');
    this.menus.show('main');
  }

  async init(progress = () => {}) {
    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    renderer.setPixelRatio(Math.min(devicePixelRatio, GAME.render.maxPixelRatio));
    renderer.setSize(innerWidth, innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.info.autoReset = false; // con posprocesado hay varios pases por frame: se suman todos
    this.root.querySelector('#viewport').appendChild(renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, GAME.render.far);
    this.postfx = new PostFX(renderer, this.scene, this.camera);
    addEventListener('resize', () => {
      renderer.setSize(innerWidth, innerHeight);
      this.postfx.setSize(innerWidth, innerHeight);
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
    });

    this.assets = new AssetManager(renderer);
    progress(0.05, 'Leyendo el mapa de Pitalito…');
    [this.manifest, this.map] = await Promise.all([this.assets.json('world/manifest.json'), this.assets.json('world/map.json')]);
    const global = await this.assets.json('world/global.json');

    progress(0.15, 'Cargando texturas…');
    this.materials = new MaterialLibrary(this.assets);
    await this.materials.load();

    progress(0.3, 'Levantando el relieve real del Valle de Laboyos…');
    const real = !!this.manifest.terrain;
    this.terrain = real
      ? new Terrain(this.manifest.terrain, await this.assets.buffer(`world/${this.manifest.terrain.file}`))
      : Terrain.flat();
    Terrain.current = this.terrain;
    this.env = new Environment(this.scene, renderer, this.materials, { realTerrain: real });
    this.collision = new CollisionWorld();
    this.network = new RoadNetwork(this.map);
    // Con relieve real, el suelo es la imagen satelital; sin él, se dibujan las áreas de OSM.
    if (real) this.ground = new ImageryGround(this.scene, this.terrain, renderer);
    else for (const m of buildAreas(global.areas, this.materials)) this.scene.add(m);

    this.streamer = new WorldStreamer({
      scene: this.scene, assets: this.assets, materials: this.materials, collision: this.collision,
      manifest: this.manifest, events: this.events, terrain: this.terrain,
      builders: real
        ? [RoadBuilder, BuildingBuilder, VegetationBuilder, ...(WORLD.powerLines ? [PowerLineBuilder] : [])]
        : [AreaBuilder, RoadBuilder, BuildingBuilder, VegetationBuilder, StreetLightBuilder],
    });

    progress(0.4, 'Construyendo el Parque Principal y la Torre San Antonio…');
    this.landmarks = LANDMARKS.filter((l) => l.available(this.manifest));
    for (const l of this.landmarks) {
      for (const p of l.exclusion(this.manifest)) this.streamer.addExclusion(p);
      this.scene.add(l.build({ manifest: this.manifest, materials: this.materials, collision: this.collision, network: this.network, terrain: this.terrain }));
    }

    progress(0.5, 'Dibujando la ciudad a lo lejos…');
    await new Promise((r) => setTimeout(r, 0));
    this.scene.add(buildCityLOD(this.map, this.materials.get('lod'), this.streamer.exclusions, this.terrain));

    const { spawn } = this.manifest;
    await this.streamer.preload(spawn.x, spawn.z, (p) => progress(0.55 + p * 0.35, 'Cargando calles del centro…'));
    this.ground?.update(0, spawn.x, spawn.z, true);

    const chosen = this.settings.get('vehicle');
    this.#spawnPlayer(PLAYER_ROSTER.includes(chosen.type) ? chosen.type : PLAYER_ROSTER[0], spawn.x, spawn.z, spawn.heading);
    this.input = new InputSystem(this.events);
    this.input.enabled = false;
    this.cameraSys = new CameraSystem(this.camera, renderer.domElement);
    this.cameraSys.ground = (x, z) => this.terrain.height(x, z);
    this.traffic = new TrafficSystem({ scene: this.scene, network: this.network, materials: this.materials, events: this.events });
    this.audio = new AudioSystem(this.events);
    this.weather = new WeatherSystem(this.scene, this.env, this.materials, this.audio);

    progress(0.95, 'Preparando el mapa interactivo…');
    this.mapRenderer = new MapRenderer(this.map, this.manifest);
    this.hud = new HUD(this.root.querySelector('#hud'), { map: this.map, manifest: this.manifest, events: this.events, settings: this.settings });
    this.minimap = new Minimap(this.root.querySelector('#hud-minimap'), this.mapRenderer);
    this.mapScreen = new MapScreen(this.root.querySelector('#map-screen'), this.mapRenderer, this.map, this.manifest, this.events);
    this.menus = new Menus(this.root.querySelector('#menus'), { settings: this.settings, events: this.events });
    this.garage = new Garage({ renderer, materials: this.materials, settings: this.settings, events: this.events, root: this.root });
    this.garage.mountUI(this.menus.screens.garage);
    this.#wireEvents();
    this.#applyPlayerSettings();
    this.applyQuality();
    progress(1, 'Listo');
  }

  #spawnPlayer(type, x, z, heading) {
    if (this.player) this.scene.remove(this.player.object);
    const saved = this.settings.get('vehicle');
    const same = saved.type === type;
    this.player = new Vehicle(type, {
      materials: this.materials, detail: 'high',
      plateText: (same && saved.plate) || 'PTL 200', ...(same && saved.color ? { color: saved.color } : {}),
    });
    this.player.place(x, z, heading);
    this.scene.add(this.player.object);
    // Farolas del vehículo del jugador (se encienden de noche)
    const lamp = new THREE.SpotLight('#fff2d0', 0, 60, 0.5, 0.5, 1.2);
    lamp.position.copy(this.player.headlightPos);
    lamp.target.position.set(0, 0, -20);
    this.player.object.add(lamp, lamp.target);
    this.headlamp = lamp;
  }

  #wireEvents() {
    const e = this.events;
    e.on('action', (a) => {
      if (this.state !== 'playing') {
        if (this.mapScreen.open && (a === 'map' || a === 'escape')) this.mapScreen.toggle(false);
        return;
      }
      if (a === 'map' || (a === 'escape' && this.mapScreen.open)) return this.mapScreen.toggle(a === 'escape' ? false : undefined);
      if (this.mapScreen.open) return;
      if (a === 'escape') { this.setState('paused'); this.menus.show('pause'); return; }
      if (a === 'camera') { this.cameraSys.next(); this.hud.toast(`Cámara: ${MODE_LABELS[this.cameraSys.modeName]}`); }
      if (a === 'vehicle') this.openGarage();
      if (a === 'time') { this.env.setHour(this.env.hour + 3); this.hud.toast(`Hora: ${this.env.clock}`); }
      if (a === 'horn') this.audio.horn();
      if (a === 'reset') this.teleport(this.player.x, this.player.z);
      if (a === 'home') { const s = this.manifest.spawn; this.player.place(s.x, s.z, s.heading); this.hud.toast('Parque Principal'); }
      if (a === 'clearRoute') this.setWaypoint(null);
      if (a === 'help') this.root.querySelector('#help').classList.toggle('open');
      if (a === 'debug') { this.debug = !this.debug; if (!this.debug) this.hud.setDebug(null); }
    });
    // Cambio rápido desde la barra en pantalla: conserva pintura y placa si ya era ese vehículo
    e.on('hud:vehicle', ({ type }) => {
      if (this.state !== 'playing' || type === this.player.type) return;
      const saved = this.settings.get('vehicle');
      this.settings.set('vehicle', { type, color: VEHICLES[type].colors[0] ?? null, plate: saved.plate });
      const { x, z, heading } = this.player;
      this.#spawnPlayer(type, x, z, heading);
      this.hud.toast(`Vehículo: ${this.player.spec.name}`);
    });
    e.on('settings:changed', ({ key, value }) => {
      if (key === 'weather' && this.state === 'playing') this.hud.toast({ auto: 'Clima automático', despejado: 'Cielo despejado', lluvia: 'Lluvia' }[value]);
    });
    e.on('waypoint:set', (p) => this.setWaypoint(p));
    e.on('teleport', (p) => this.teleport(p.x, p.z));
    e.on('map:toggle', (open) => {
      if (this.input) this.input.enabled = !open && this.state === 'playing';
      if (!open && this.state === 'paused') this.menus.show('pause');
    });

    // Menús
    e.on('menu:play', () => { this.menus.closeAll(); this.play(); });
    e.on('menu:resume', () => { this.menus.closeAll(); this.setState('playing'); });
    e.on('menu:garage', () => this.openGarage());
    e.on('menu:map', () => { this.menus.closeAll(); this.mapScreen.toggle(true); });
    e.on('menu:quit', () => { this.menus.closeAll(); this.showMainMenu(); });
    e.on('garage:confirm', () => this.garage.confirm());
    e.on('garage:close', () => {
      const back = this.garageReturn || 'menu';
      this.setState(back);
      this.menus.closeAll();
      if (back === 'menu') this.menus.show('main');
      else if (back === 'paused') this.menus.show('pause');
    });
    e.on('garage:drive', ({ type }) => {
      const { x, z, heading } = this.player;
      this.#spawnPlayer(type, x, z, heading);
      this.menus.closeAll();
      if (this.garageReturn === 'menu') this.play();
      else { this.setState('playing'); this.hud.toast(`Vehículo: ${this.player.spec.name}`); }
    });
    e.on('settings:changed', ({ key }) => {
      if (key === 'quality') this.applyQuality();
      else this.#applyPlayerSettings();
    });
  }

  openGarage() {
    this.garageReturn = this.state === 'garage' ? this.garageReturn : this.state === 'playing' ? 'playing' : this.state;
    this.menus.closeAll();
    this.menus.show('garage');
    this.setState('garage');
  }

  #applyPlayerSettings() {
    this.audio.setVolume(this.settings.get('volume'));
    this.cameraSys.sensitivity = this.settings.get('cameraSensitivity');
    this.cameraSys.invertY = this.settings.get('invertY');
    this.weather.setMode(this.settings.get('weather'));
  }

  // Aplica el preset de calidad elegido (menú de opciones) a render, sombras, streaming y posprocesado.
  applyQuality() {
    const q = this.settings.quality;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, q.pixelRatio));
    if (this.renderer.shadowMap.enabled !== q.shadows) {
      this.renderer.shadowMap.enabled = q.shadows;
      this.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
    }
    this.env.applyQuality(q);
    GAME.streaming.radius = q.streamRadius;
    groundDetail.enabled = q.groundDetail;
    this.scene.traverse((o) => { const sh = o.material?.userData?.shader; if (sh?.uniforms.detailOn) sh.uniforms.detailOn.value = q.groundDetail ? 1 : 0; });
    this.postfx.configure(q);
    this.postfx.setSize(innerWidth, innerHeight);
  }

  // Ubica al jugador en la vía vehicular más cercana, alineado con ella.
  teleport(x, z) {
    const n = this.network.nearest(x, z, { maxDist: 800, drivable: true });
    if (!n) return;
    const ax = this.network.vx(n.a), az = this.network.vz(n.a), bx = this.network.vx(n.b), bz = this.network.vz(n.b);
    const l = Math.hypot(bx - ax, bz - az) || 1;
    const dx = (bx - ax) / l, dz = (bz - az) / l;
    this.player.place(n.cx + -dz * 2, n.cz + dx * 2, Math.atan2(-dx, -dz));
    this.cameraSys.initialized = false;
  }

  setWaypoint(p) {
    this.waypoint = p;
    this.route = p ? this.network.route(this.player.x, this.player.z, p.x, p.z) : null;
    if (p) this.hud.toast(p.name ? `Destino: ${p.name}` : this.route ? 'Ruta GPS trazada' : 'Destino marcado (sin ruta vehicular)');
    this.#rebuildRouteLine();
  }

  #rebuildRouteLine() {
    if (this.routeLine) { this.scene.remove(this.routeLine); this.routeLine.geometry.dispose(); this.routeLine = null; }
    if (!this.route || this.route.length < 2) return;
    const b = new GeometryBatch();
    ribbon(b, this.route.flat(), 0.7, 0.2, { uScale: 4, ground: (x, z) => this.terrain.height(x, z) });
    this.routeLine = new THREE.Mesh(b.build(), this.materials.get('route'));
    this.routeLine.renderOrder = LAYER.OVERLAY;
    this.scene.add(this.routeLine);
  }

  #updateRoute() {
    if (!this.waypoint) return;
    const { x, z } = this.player;
    if (Math.hypot(this.waypoint.x - x, this.waypoint.z - z) < 25) {
      this.hud.toast('¡Llegaste a tu destino!');
      this.setWaypoint(null);
      return;
    }
    if (!this.route) return;
    // recortar el tramo recorrido y recalcular si el jugador se desvió
    let best = { d: Infinity, i: 0 };
    for (let i = 0; i < this.route.length - 1; i++) {
      const q = distToSegment(x, z, ...this.route[i], ...this.route[i + 1]);
      if (q.d < best.d) best = { d: q.d, i, cx: q.cx, cz: q.cz };
    }
    if (best.d > 35) this.route = this.network.route(x, z, this.waypoint.x, this.waypoint.z);
    else this.route = [[best.cx, best.cz], ...this.route.slice(best.i + 1)];
    this.#rebuildRouteLine();
  }

  // Depuración: qué objeto hay bajo un punto de la pantalla (desde la consola: game.pick(x, y))
  pick(sx, sy) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1), this.camera);
    const hit = ray.intersectObjects(this.scene.children, true).find((h) => h.object.name !== 'mountains');
    if (!hit) return null;
    let o = hit.object, path = [];
    while (o) { path.push(o.name || o.type); o = o.parent; }
    return { path: path.join(' < '), material: hit.object.material?.type, point: hit.point.toArray().map((v) => +v.toFixed(1)), dist: +hit.distance.toFixed(1) };
  }

  // Depuración: muestra un vehículo con cámara fija en un ángulo (consola: game.debugShowVehicle('taxi', 2.4))
  debugShowVehicle(type, angle = 2.4, dist = null) {
    if (this.player.type !== type) {
      const { x, z, heading } = this.player;
      this.#spawnPlayer(type, x, z, heading);
    }
    this.debugCam = { angle, dist: dist ?? 3 + this.player.spec.length * 0.9 };
    this.menus.closeAll();
    this.setState('playing');
  }

  play() {
    this.audio.start();
    this.cameraSys.initialized = false;
    this.setState('playing');
    this.hud.toast('Bienvenido a Pitalito — M: mapa · V: garaje · Esc: pausa', 4000);
  }

  start() {
    this.routeTimer = 0;
    this.renderer.setAnimationLoop(() => this.#frame());
  }

  #frame() {
    const raw = this.clock.getDelta();
    const dt = Math.min(0.05, raw);
    this.time += dt;
    this.fps += (1 / Math.max(raw, 1e-4) - this.fps) * 0.05;
    const p = this.player;
    if (this.state === 'garage') { this.garage.render(dt); return; }
    // en pausa (o con el mapa abierto desde la pausa) el mundo se congela; en el menú principal sigue vivo
    const sim = this.state === 'paused' ? 0 : dt;

    Object.assign(p.controls, this.input.update(dt));
    const wallImpact = this.state === 'playing' ? p.updatePhysics(sim, this.collision) : 0;
    this.traffic.update(sim, p);
    const carImpact = this.state === 'playing' ? this.traffic.collidePlayer(p) : 0;
    const impact = Math.max(wallImpact, carImpact);
    if (impact > 2) { this.cameraSys.impact(impact); this.events.emit('impact', impact); }

    this.streamer.update(dt, p.x, p.z);
    this.ground?.update(dt, p.x, p.z);
    wind.uniforms.uTime.value = this.time;
    wind.uniforms.uWind.value = 0.5 + this.env.wet * 0.9;
    this.weather.update(sim, this.camera);
    this.env.update(sim, this.state === 'menu' ? new THREE.Vector3(...(this.manifest.landmarks.parquePrincipal?.c ? [this.manifest.landmarks.parquePrincipal.c[0], p.y, this.manifest.landmarks.parquePrincipal.c[1]] : [p.x, p.y, p.z])) : p.object.position, this.camera);
    this.headlamp.intensity = this.env.night * 60;
    if (this.streamer.builders.includes(StreetLightBuilder)) StreetLightBuilder.setNight(this.env.night);
    for (const l of this.landmarks) l.update?.(dt, this.time, this.env);
    if (this.state === 'menu') {
      // cámara del menú: sobrevuelo lento alrededor del Parque Principal y la torre
      const c = this.manifest.landmarks.parquePrincipal?.c || [0, 0];
      const a = this.time * 0.05 + 2;
      const cy = this.terrain.height(c[0], c[1]);
      this.camera.position.set(c[0] + Math.sin(a) * 95, cy + 42, c[1] + Math.cos(a) * 95);
      this.camera.lookAt(c[0], cy + 8, c[1] + 25);
    } else if (this.debugCam) {
      const a = p.heading + this.debugCam.angle, d = this.debugCam.dist;
      this.camera.position.set(p.x + Math.sin(a) * d, p.y + 1.6, p.z + Math.cos(a) * d);
      this.camera.lookAt(p.x, p.y + 0.8, p.z);
    } else this.cameraSys.update(dt, p);
    this.audio.setEngine(p.spec, p.speedKmh, p.controls.throttle);

    this.routeTimer -= dt;
    if (this.routeTimer <= 0) { this.routeTimer = 1; this.#updateRoute(); }

    this.hud.update(dt, { vehicle: p, network: this.network, env: this.env, route: this.route, raining: this.weather.raining });
    const look = this.cameraSys.look, cp = this.camera.position;
    const camHeading = Math.atan2(-(look.x - cp.x), -(look.z - cp.z));
    this.minimap.draw({
      x: p.x, z: p.z, camHeading, vehicleHeading: p.heading, route: this.route, waypoint: this.waypoint,
      traffic: this.traffic.cars.map((c) => ({ x: c.v.x, z: c.v.z, type: c.v.type })), speedKmh: p.speedKmh,
    });
    this.mapScreen.draw({ x: p.x, z: p.z, heading: p.heading, route: this.route, waypoint: this.waypoint });

    this.renderer.info.reset();
    this.postfx.setAmbience(this.env.night, this.env.wet);
    this.postfx.render(dt);
    if (this.debug) {
      const info = this.renderer.info.render, geo = projection.toGeo(p.x, p.z), st = this.streamer.stats;
      this.hud.setDebug(
        `${this.fps.toFixed(0)} fps · ${info.calls} draw calls · ${(info.triangles / 1000).toFixed(0)}k tris\n` +
        `tiles ${st.built} (+${st.loading}) · tráfico ${this.traffic.cars.length}\n` +
        `x ${p.x.toFixed(1)} z ${p.z.toFixed(1)} · ${geo.lat.toFixed(6)}, ${geo.lon.toFixed(6)}`,
      );
    }
  }
}
