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
import { TrafficSignalBuilder } from '../world/builders/TrafficSignalBuilder.js';
import { WeatherSystem } from '../systems/WeatherSystem.js';
import { WORLD } from '../config/world.config.js';
import { StreetLightBuilder } from '../world/builders/StreetLightBuilder.js';
import { LANDMARKS } from '../world/landmarks/index.js';
import { SolidWorld } from '../world/SolidWorld.js';
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
import { CharacterCreator } from '../ui/CharacterCreator.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { BaseSystem } from '../systems/BaseSystem.js';
import { TradePanel } from '../ui/TradePanel.js';
import { FirearmSystem } from '../systems/FirearmSystem.js';
import { precargarArmas } from '../entities/weapons/firearms.js';
import { SurvivalSystem } from '../systems/SurvivalSystem.js';
import { LootSystem } from '../systems/LootSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { InventoryPanel } from '../ui/InventoryPanel.js';
import { ZombieSystem } from '../systems/ZombieSystem.js';
import { SURVIVAL } from '../config/survival.config.js';
import { ORIGENES, PARTIDA } from '../config/characters.config.js';
import { FactionSystem } from '../systems/FactionSystem.js';
import { WildlifeSystem } from '../systems/WildlifeSystem.js';
import { ParticleSystem } from '../render/Particles.js';
import { AmbienceSystem } from '../systems/AmbienceSystem.js';
import { StorySystem } from '../systems/StorySystem.js';
import { FrameBudget } from './FrameBudget.js';
import { TileProfile } from '../world/TileProfile.js';
import { Character } from '../entities/character/Character.js';
import { Combatant } from '../entities/combat/Combatant.js';
import { COMBAT } from '../config/combat.config.js';
import { BlockWorld } from '../world/blocks/BlockWorld.js';
import { PlayerSystem } from '../systems/PlayerSystem.js';

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
    this.state = 'loading'; // loading | menu | playing | paused | garage | creator
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
    if (this.creator) { if (state === 'creator') this.creator.show(); else this.creator.hide(); }
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
      this.creator?.resize();
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

    this.tileProfile = new TileProfile();
    this.streamer = new WorldStreamer({
      scene: this.scene, assets: this.assets, materials: this.materials, collision: this.collision,
      manifest: this.manifest, events: this.events, terrain: this.terrain, profile: this.tileProfile,
      builders: real
        ? [RoadBuilder, BuildingBuilder, VegetationBuilder, TrafficSignalBuilder, ...(WORLD.powerLines ? [PowerLineBuilder] : [])]
        : [AreaBuilder, RoadBuilder, BuildingBuilder, VegetationBuilder, StreetLightBuilder],
    });

    progress(0.4, 'Construyendo el Parque Principal y la Torre San Antonio…');
    this.landmarks = LANDMARKS.filter((l) => l.available(this.manifest));
    this.landmarkRoots = [];
    this.solids = new SolidWorld();
    for (const l of this.landmarks) {
      for (const p of l.exclusion(this.manifest)) this.streamer.addExclusion(p);
      const root = l.build({ manifest: this.manifest, materials: this.materials, collision: this.collision, solids: this.solids, network: this.network, terrain: this.terrain });
      this.landmarkRoots.push(root);
      this.scene.add(root);
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
    this.creator = new CharacterCreator({ renderer, assets: this.assets, settings: this.settings, events: this.events, root: this.root });
    this.combatSys = new CombatSystem(this);
    // A pie y construcción
    this.blocks = new BlockWorld({ scene: this.scene, materials: this.materials, collision: this.collision, terrain: this.terrain, events: this.events, solids: this.solids });
    this.playerSys = new PlayerSystem(this);
    this.combatSys.add(this.playerSys.combat, { isPlayer: true });
    this.factions = new FactionSystem(this);
    this.wildlife = new WildlifeSystem(this);
    this.zombies = new ZombieSystem(this);
    this.loot = new LootSystem(this);
    this.inventory = new InventorySystem(this);
    this.inventoryPanel = new InventoryPanel(this.root.querySelector('#hud') || this.root, this);
    this.firearms = new FirearmSystem(this);
    this.bases = new BaseSystem(this);
    this.tradePanel = new TradePanel(this.root.querySelector('#hud') || this.root, this);
    precargarArmas(this.assets);
    this.survival = new SurvivalSystem(this, this.root.querySelector('#hud') || this.root);
    this.#aplicarModo();
    this.particles = new ParticleSystem(this.scene, { calidad: this.settings.get('quality') });
    this.ambience = new AmbienceSystem(this, this.particles);
    this.story = new StorySystem(this);
    this.budget = new FrameBudget(this);
    this.dummies = [];
    for (const l of this.landmarks) for (const it of l.interactables || []) this.playerSys.register(it(this));
    this.hud.setHotbar(this.blocks.icons(renderer));
    this.#wireEvents();
    this.#applyPlayerSettings();
    this.applyQuality();
    progress(1, 'Listo');
  }

  // El vehículo del jugador nunca lleva el muñeco de cajas: el conductor es su propio personaje (PlayerSystem).
  #spawnPlayer(type, x, z, heading, { driver = false, color = null } = {}) {
    if (this.player) this.scene.remove(this.player.object);
    const saved = this.settings.get('vehicle');
    const same = saved.type === type;
    const paint = color ?? (same && saved.color ? saved.color : null);
    this.player = new Vehicle(type, {
      materials: this.materials, detail: 'high', driver,
      plateText: (same && saved.plate) || 'PTL 200', ...(paint ? { color: paint } : {}),
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

  // Historia o supervivencia: tráfico, rótulo del menú. Los zombis y las facciones miran el ajuste cada fotograma.
  #aplicarModo() {
    const sup = this.settings.get('modo') === 'supervivencia';
    this.traffic.densidad = sup ? SURVIVAL.trafico : 1;
    this.menus?.setModo(this.settings.get('modo'));
  }

  // Rehace el vehículo del jugador en la misma posición (con o sin conductor visible, al bajarse/subirse)
  rebuildPlayerVehicle({ driver }) {
    const { type, x, z, heading, modelOpts } = this.player;
    this.#spawnPlayer(type, x, z, heading, { driver, color: modelOpts?.color ?? null });
  }

  // El jugador toma otro vehículo (p. ej. del tráfico)
  replacePlayerVehicle(type, x, z, heading, color) {
    this.#spawnPlayer(type, x, z, heading, { color });
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
      if (a === 'escape' && this.inventoryPanel.abierto) { this.inventoryPanel.toggle(false); return; }
      if (a === 'escape' && this.tradePanel.abierto) { this.tradePanel.cerrar(); return; }
      if (a === 'inventory') {
        if (this.loot.activo) this.inventoryPanel.toggle();
        return;
      }
      if (a === 'escape') { this.setState('paused'); this.menus.show('pause'); return; }
      if (a === 'camera' && this.playerSys.walking) { this.playerSys.toggleView(); return; }
      if (a === 'camera') { this.cameraSys.next(); this.hud.toast(`Cámara: ${MODE_LABELS[this.cameraSys.modeName]}`); }
      if (a === 'vehicle') this.openGarage();
      if (a === 'time') { this.env.setHour(this.env.hour + 3); this.hud.toast(`Hora: ${this.env.clock}`); }
      if (a === 'horn') this.audio.horn();
      // R recarga con un arma de fuego en la mano: no es «volver a la calle».
      if (a === 'reset' && this.playerSys.fuego) return;
      if (a === 'reset') this.teleport(this.playerSys.focus.x, this.playerSys.focus.z);
      if (a === 'home') {
        const s = this.manifest.spawn;
        if (this.playerSys.walking) this.playerSys.placeCharacter(s.x, s.z); else this.player.place(s.x, s.z, s.heading);
        this.hud.toast('Parque Principal');
      }
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
      // El personaje colgaba del vehículo que se acaba de retirar: se sienta en el nuevo.
      this.playerSys.sentarEnVehiculo();
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
    e.on('menu:modo', () => {
      this.settings.set('modo', this.settings.get('modo') === 'supervivencia' ? 'historia' : 'supervivencia');
      this.#aplicarModo();
    });
    e.on('menu:resume', () => { this.menus.closeAll(); this.setState('playing'); });
    e.on('menu:garage', () => this.openGarage());
    e.on('menu:map', () => { this.menus.closeAll(); this.mapScreen.toggle(true); });
    e.on('menu:quit', () => { this.menus.closeAll(); this.showMainMenu(); });
    e.on('menu:historia', () => {
      const s = this.story;
      this.menus.setHistoria({
        linea: s.lineaDeTiempo(),
        progreso: `${s.completados} de ${s.total}`,
        toponimo: s.fichaToponimo(),
        nombres: s.nombres.size,
      });
    });
    e.on('menu:creator', () => this.openCreator());
    e.on('creator:confirm', () => {
      const pj = this.creator.confirm();
      this.playerSys?.character.setLook(this.assets, pj.look);
      // El modo es del personaje: elegirlo aquí es elegirlo para la partida.
      if (this.settings.get('modo') !== pj.modo) { this.settings.set('modo', pj.modo); this.#aplicarModo(); }
      const desdeMenu = (this.creatorReturn || 'menu') === 'menu';
      this.events.emit('creator:close');
      if (desdeMenu) { this.menus.closeAll(); this.play(); } else this.#aplicarPartida();
    });
    e.on('creator:close', () => {
      const back = this.creatorReturn || 'menu';
      this.setState(back);
      this.menus.closeAll();
      if (back === 'menu') this.menus.show('main');
      else if (back === 'paused') this.menus.show('pause');
    });
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
      else { this.setState('playing'); this.playerSys.sentarEnVehiculo(); this.hud.toast(`Vehículo: ${this.player.spec.name}`); }
    });
    e.on('settings:changed', ({ key }) => {
      if (key === 'quality') this.applyQuality();
      else this.#applyPlayerSettings();
    });
  }

  openCreator() {
    this.creatorReturn = this.state === 'creator' ? this.creatorReturn : this.state === 'playing' ? 'playing' : this.state;
    this.menus.closeAll();
    this.menus.show('creator');
    this.setState('creator');
  }

  openGarage() {
    this.garageReturn = this.state === 'garage' ? this.garageReturn : this.state === 'playing' ? 'playing' : this.state;
    this.menus.closeAll();
    this.menus.show('garage');
    this.setState('garage');
  }

  #applyPlayerSettings() {
    this.audio.setVolume(this.settings.get('volume'));
    this.audio.setMusica(this.settings.get('musica'));
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
    this.particles?.applyQuality(this.settings.get('quality'));
    GAME.streaming.radius = q.streamRadius;
    if (this.budget) this.budget.nominal.radio = q.streamRadius;
    groundDetail.enabled = q.groundDetail;
    this.scene.traverse((o) => { const sh = o.material?.userData?.shader; if (sh?.uniforms.detailOn) sh.uniforms.detailOn.value = q.groundDetail ? 1 : 0; });
    this.postfx.configure(q);
    this.postfx.setSize(innerWidth, innerHeight);
  }

  // Ubica al jugador en la vía vehicular más cercana, alineado con ella.
  teleport(x, z) {
    if (this.playerSys?.walking) {
      const q = this.network.nearest(x, z, { maxDist: 800 });
      if (q) this.playerSys.placeCharacter(q.cx, q.cz);
      return;
    }
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
    const f = this.playerSys?.focus || this.player;
    this.route = p ? this.network.route(f.x, f.z, p.x, p.z) : null;
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
    const { x, z } = this.playerSys.focus;
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

  /**
   * Depuración: pone un muñeco de entrenamiento delante del jugador para probar el combate.
   * No es contenido del mundo (no se guarda ni aparece solo): sirve para verificar golpes, daño y muerte hasta
   * que lleguen los enemigos de la Fase 5. Consola: `game.debugSpawnDummy()`.
   */
  debugSpawnDummy(distance = 3) {
    const p = this.playerSys.character;
    const x = p.x - Math.sin(p.heading) * distance;
    const z = p.z - Math.cos(p.heading) * distance;
    const ch = new Character({ look: this.settings.get('look') });
    ch.place(x, z, p.heading + Math.PI, this.terrain.height(x, z));
    this.scene.add(ch.object);
    ch.useRig(this.assets, this.settings.get('look'));
    const c = new Combatant(ch, { stats: COMBAT.player, team: 'enemy', weapon: 'manos' });
    // El muñeco no se mueve ni pega: sólo recibe. Su animación se actualiza con el resto.
    const entry = {
      combat: c,
      update: (dt) => ch.update(dt, { forward: 0, strafe: 0, run: false, jump: false, yaw: 0 },
        { collision: this.collision, terrain: this.terrain, blocks: this.blocks }),
    };
    this.combatSys.add(c);
    this.dummies.push(entry);
    this.hud.toast('Muñeco de entrenamiento');
    return c;
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

  // Depuración: cámara fija en (x, z) a `h` m sobre el suelo mirando a (tx, tz) (reproducir encuadres de fotos).
  // El jugador se lleva al mismo punto para que se carguen los tiles. `null` vuelve a la cámara normal.
  debugLook(x, z, tx, tz, h = 1.7) {
    if (x === null) { this.debugCam = null; return; }
    this.player.place(x, z, this.player.heading);
    this.player.object.visible = false;
    this.debugCam = { abs: [x, z, tx, tz, h] };
    this.menus.closeAll();
    this.setState('playing');
  }

  // Entrega la partida del personaje activo según su oficio y el modo: el arma del oficio queda primera al sacar
  // el arma (X) y, en supervivencia, la mochila inicial entra una sola vez (ver ORIGENES en characters.config.js).
  #aplicarPartida() {
    const pj = (this.settings.get('personajes') || []).find((p) => p.id === this.settings.get('personajeActivo'));
    const origen = ORIGENES.find((o) => o.id === (pj?.look || this.settings.get('look') || {}).origen);
    if (!origen) return;
    const i = this.playerSys.arsenal.indexOf(origen.arma);
    if (i >= 0) this.playerSys.weaponIndex = i;
    if (!pj || pj.mochilaEntregada || !PARTIDA.entregar || this.settings.get('modo') !== 'supervivencia') return;
    for (const [id, n] of Object.entries(origen.mochila || {})) this.inventory.agregar(id, n);
    pj.mochilaEntregada = true;
    this.settings.set('personajes', this.settings.get('personajes'));
    this.hud.toast(`${pj.nombre} llega con lo que llevaba encima`);
  }

  play() {
    this.audio.start();
    this.cameraSys.initialized = false;
    this.setState('playing');
    // Al arrancar ya se está dentro del vehículo: se sienta al personaje, sin animación de subida.
    this.playerSys.sentarEnVehiculo();
    this.hud.toast('Bienvenido a Pitalito — M: mapa · V: garaje · Esc: pausa', 4000);
    this.#aplicarPartida();
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
    if (this.state === 'creator') { this.creator.render(dt); return; }
    // en pausa (o con el mapa abierto desde la pausa) el mundo se congela; en el menú principal sigue vivo
    const sim = this.state === 'paused' ? 0 : dt;

    const walking = this.playerSys.walking;
    Object.assign(p.controls, this.input.update(dt));
    if (walking) Object.assign(p.controls, { throttle: 0, brake: 0, steer: 0, handbrake: true }); // carro estacionado
    const f = this.playerSys.focus; // lo que sigue el mundo: el carro o el personaje
    const wallImpact = this.state === 'playing' ? p.updatePhysics(sim, this.collision) : 0;
    this.traffic.update(sim, walking ? { x: f.x, z: f.z } : p);
    if (this.state === 'playing') {
      this.playerSys.update(sim);
      // En supervivencia no hay facciones: los zombis ocupan su cupo de presupuesto.
      if (!this.zombies.activo) this.factions.update(sim);
      this.zombies.update(sim);
      this.loot.update();
      this.survival.update(sim);
      this.firearms.update(sim);
      this.bases.update(sim);
      this.wildlife.update(sim);
      this.ambience.update(sim);
      this.story.update(sim);
      this.story.updateCuerpos(sim);
      this.budget.update(dt);
      this.combatSys.update(sim);
      for (const d of this.dummies) d.update(sim);
    }
    this.particles?.update(sim);
    this.blocks.flush();
    const carImpact = this.state === 'playing' && !walking ? this.traffic.collidePlayer(p) : 0;
    const impact = Math.max(wallImpact, carImpact);
    if (impact > 2) { this.cameraSys.impact(impact); this.events.emit('impact', impact); }

    this.streamer.update(dt, f.x, f.z);
    this.ground?.update(dt, f.x, f.z);
    wind.uniforms.uTime.value = this.time;
    TrafficSignalBuilder.update(this.time);
    wind.uniforms.uWind.value = 0.5 + this.env.wet * 0.9;
    this.weather.update(sim, this.camera);
    this.env.update(sim, this.state === 'menu' ? new THREE.Vector3(...(this.manifest.landmarks.parquePrincipal?.c ? [this.manifest.landmarks.parquePrincipal.c[0], p.y, this.manifest.landmarks.parquePrincipal.c[1]] : [p.x, p.y, p.z])) : walking ? new THREE.Vector3(f.x, f.y, f.z) : p.object.position, this.camera);
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
    } else if (this.debugCam?.abs) {
      const [x, z, tx, tz, h] = this.debugCam.abs;
      this.camera.position.set(x, this.terrain.height(x, z) + h, z);
      this.camera.lookAt(tx, this.terrain.height(tx, tz) + h + 2, tz);
    } else if (this.debugCam) {
      const a = p.heading + this.debugCam.angle, d = this.debugCam.dist;
      this.camera.position.set(p.x + Math.sin(a) * d, p.y + 1.6, p.z + Math.cos(a) * d);
      this.camera.lookAt(p.x, p.y + 0.8, p.z);
    } else if (walking) this.playerSys.updateCamera(dt);
    // Ojo con el orden: este `else` cierra la cadena de cámaras de arriba. Meter aquí otra condición deja la
    // cámara del vehículo sin actualizarse (pasó: al volver a subirse al carro, la cámara no seguía).
    else this.cameraSys.update(dt, p);
    if (this.state === 'playing') this.hud.updateLock(this.camera);
    this.audio.setEngine(p.spec, walking ? 0 : p.speedKmh, walking ? 0 : p.controls.throttle, walking);
    this.audio.updateAmbiente(dt, { dia: 1 - (this.env.night ?? 0), supervivencia: this.zombies?.activo, lluvia: this.weather?.wet ?? 0 });

    this.routeTimer -= dt;
    if (this.routeTimer <= 0) { this.routeTimer = 1; this.#updateRoute(); }

    const hudSubject = walking
      ? { x: f.x, z: f.z, speedKmh: Math.hypot(f.vx, f.vz) * 3.6, spec: { name: 'A pie', maxSpeed: 32 } }
      : p;
    this.hud.update(dt, { vehicle: hudSubject, network: this.network, env: this.env, route: this.route, raining: this.weather.raining });
    const look = this.cameraSys.look, cp = this.camera.position;
    const camHeading = Math.atan2(-(look.x - cp.x), -(look.z - cp.z));
    this.minimap.draw({
      x: f.x, z: f.z, camHeading, vehicleHeading: f.heading, route: this.route, waypoint: this.waypoint,
      traffic: this.traffic.cars.map((c) => ({ x: c.v.x, z: c.v.z, type: c.v.type })), speedKmh: hudSubject.speedKmh,
    });
    this.mapScreen.draw({ x: f.x, z: f.z, heading: f.heading, route: this.route, waypoint: this.waypoint });

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
