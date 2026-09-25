import { Vehicle } from '../entities/vehicles/Vehicle.js';
import { TRAFFIC_MIX, VEHICLES } from '../config/vehicles.config.js';
import { GAME } from '../config/game.config.js';
import { roadClass } from '../config/roads.config.js';

const COLORS = ['#b3261e', '#1d4e89', '#2e7d32', '#f4f4f4', '#6d4c41', '#37474f', '#c77dff', '#ff8f00'];
const pickWeighted = (weights) => {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, w] of Object.entries(weights)) if ((r -= w) <= 0) return k;
  return Object.keys(weights)[0];
};

// Tráfico IA: vehículos cinemáticos que recorren el grafo vial por el carril derecho,
// frenan detrás de otros vehículos y del jugador, y aparecen/desaparecen alrededor del jugador.
export class TrafficSystem {
  constructor({ scene, network, materials, events }) {
    Object.assign(this, { scene, network, materials, events });
    this.cars = [];
    this.pool = new Map(); // tipo → vehículos libres (reutilizables)
    this.spawnTimer = 0;
  }

  #acquire(type) {
    const free = this.pool.get(type);
    if (free?.length) return free.pop();
    const opts = { materials: this.materials, detail: 'low' };
    const palette = VEHICLES[type].colors;
    if (palette.length) opts.color = palette[Math.floor(Math.random() * palette.length)];
    if (type === 'moto') opts.helmet = COLORS[Math.floor(Math.random() * COLORS.length)];
    if (type === 'taxi') opts.plateText = `T${String(Math.floor(Math.random() * 900 + 100))}`;
    return new Vehicle(type, opts);
  }

  #release(car) {
    this.scene.remove(car.v.object);
    if (!this.pool.has(car.v.type)) this.pool.set(car.v.type, []);
    this.pool.get(car.v.type).push(car.v);
  }

  #spawn(px, pz) {
    const { spawnRadius } = GAME.traffic;
    for (let tries = 0; tries < 30; tries++) {
      // muestreo local: un punto aleatorio del anillo y la vía más cercana
      const ang = Math.random() * Math.PI * 2, dist = 90 + Math.random() * (spawnRadius - 90);
      const near = this.network.nearest(px + Math.cos(ang) * dist, pz + Math.sin(ang) * dist, { maxDist: 40, drivable: true });
      if (!near) continue;
      const road = this.network.roads[near.road];
      if (road.c === 'service' || road.c === 'track') continue;
      const forward = Math.random() < 0.5 || road.o;
      const [a, b] = forward ? [near.a, near.b] : [near.b, near.a];
      if (!this.network.adj[a].some((e) => e.to === b)) continue;
      if (this.cars.some((c) => Math.hypot(c.v.x - near.cx, c.v.z - near.cz) < 14)) continue;
      const type = pickWeighted(TRAFFIC_MIX);
      const v = this.#acquire(type);
      const len = Math.hypot(this.network.vx(b) - this.network.vx(a), this.network.vz(b) - this.network.vz(a));
      const car = { v, a, b, s: forward ? near.t * len : (1 - near.t) * len, len, road: near.road, speed: 0, stopTimer: 0, lane: 0 };
      this.#setLane(car);
      this.scene.add(v.object);
      this.cars.push(car);
      return;
    }
  }

  #setLane(car) {
    const spec = roadClass(this.network.roads[car.road].c);
    car.lane = this.network.roads[car.road].o ? 0 : spec.width / 4;
    car.maxSpeed = (spec.speed / 3.6) * (car.v.type === 'moto' ? 1.15 : car.v.type === 'chiva' || car.v.type === 'motocarro' ? 0.8 : 1);
  }

  #nextEdge(car) {
    const options = this.network.adj[car.b].filter((e) => e.to !== car.a);
    const list = options.length ? options : this.network.adj[car.b];
    if (!list.length) return false;
    // preferir seguir derecho
    const dx = this.network.vx(car.b) - this.network.vx(car.a), dz = this.network.vz(car.b) - this.network.vz(car.a);
    const scored = list.map((e) => {
      const ex = this.network.vx(e.to) - this.network.vx(car.b), ez = this.network.vz(e.to) - this.network.vz(car.b);
      const cos = (dx * ex + dz * ez) / (Math.hypot(dx, dz) * Math.hypot(ex, ez) || 1);
      return { e, w: 0.3 + Math.max(0, cos) * 2 + Math.random() };
    }).sort((p, q) => q.w - p.w);
    const next = scored[0].e;
    car.a = car.b; car.b = next.to; car.len = next.len; car.road = next.road;
    this.#setLane(car);
    return true;
  }

  // player: { x, z, radius, vehicle }
  update(dt, player) {
    const { maxCars, despawnRadius } = GAME.traffic;
    this.spawnTimer -= dt;
    if (this.cars.length < maxCars && this.spawnTimer <= 0) { this.#spawn(player.x, player.z); this.spawnTimer = 0.12; }

    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i], v = car.v;
      if (Math.hypot(v.x - player.x, v.z - player.z) > despawnRadius) { this.#release(car); this.cars.splice(i, 1); continue; }

      // ¿hay algo adelante? (jugador u otro vehículo en un cono frontal)
      const [fx, fz] = v.forward;
      let block = Infinity;
      const check = (ox, oz) => {
        const dx = ox - v.x, dz = oz - v.z;
        const ahead = dx * fx + dz * fz, side = Math.abs(dx * -fz + dz * fx);
        if (ahead > 0 && ahead < 16 && side < 2.2) block = Math.min(block, ahead);
      };
      check(player.x, player.z);
      for (const o of this.cars) if (o !== car) check(o.v.x, o.v.z);
      car.stopTimer = Math.max(0, car.stopTimer - dt);
      const target = car.stopTimer > 0 || block < 5 ? 0 : block < 16 ? car.maxSpeed * ((block - 5) / 11) : car.maxSpeed;
      car.speed += (target - car.speed) * Math.min(1, dt * (target < car.speed ? 4 : 1.2));

      car.s += car.speed * dt;
      let guard = 0;
      while (car.s > car.len && guard++ < 5) {
        car.s -= car.len;
        if (!this.#nextEdge(car)) { car.s = car.len; car.speed = 0; break; }
      }
      const ax = this.network.vx(car.a), az = this.network.vz(car.a), bx = this.network.vx(car.b), bz = this.network.vz(car.b);
      const t = car.len > 0 ? car.s / car.len : 0;
      const dx = (bx - ax) / (car.len || 1), dz = (bz - az) / (car.len || 1);
      const targetHeading = Math.atan2(-dx, -dz);
      let dh = targetHeading - v.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      v.heading += dh * Math.min(1, dt * 6);
      // desplazamiento al carril derecho (derecha = (−dz, dx))
      v.x = ax + (bx - ax) * t + -dz * car.lane;
      v.z = az + (bz - az) * t + dx * car.lane;
      v.vF = car.speed;
      v.steer = Math.max(-0.5, Math.min(0.5, dh * 2));
      v.sync(dt);
    }
  }

  // Colisión jugador ↔ tráfico: empuja al jugador y detiene al vehículo IA.
  collidePlayer(pv) {
    let impact = 0;
    for (const car of this.cars) {
      const v = car.v;
      const dx = pv.x - v.x, dz = pv.z - v.z, d = Math.hypot(dx, dz);
      const min = pv.spec.radius + v.spec.radius * 1.2;
      if (d < min && d > 1e-3) {
        const nx = dx / d, nz = dz / d;
        pv.x += nx * (min - d); pv.z += nz * (min - d);
        const [fx, fz] = pv.forward;
        const into = (fx * pv.vF) * nx + (fz * pv.vF) * nz;
        if (into < 0) { impact = Math.max(impact, -into); pv.vF *= 0.4; }
        car.stopTimer = 2.5;
        car.speed = 0;
        if (impact > 3) this.events.emit('horn', { x: v.x, z: v.z });
      }
    }
    return impact;
  }

  clear() { for (const c of this.cars) this.#release(c); this.cars = []; }
}
