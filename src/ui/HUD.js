import { pointInPolygon, bbox } from '../geo/geometry.js';

// HUD en DOM: velocímetro, placa de calle (estilo nomenclatura oficial de Pitalito),
// nombre de zona al estilo GTA, reloj, mensajes y panel de depuración.
export class HUD {
  constructor(root, { map, manifest }) {
    this.root = root;
    this.el = (id) => root.querySelector(id);
    this.speed = this.el('#hud-speed-value');
    this.speedBar = this.el('#hud-speed-bar');
    this.street = this.el('#hud-street-name');
    this.streetZone = this.el('#hud-street-zone');
    this.zoneBanner = this.el('#hud-zone');
    this.clock = this.el('#hud-clock');
    this.vehicle = this.el('#hud-vehicle');
    this.toastEl = this.el('#hud-toast');
    this.debug = this.el('#hud-debug');
    this.gps = this.el('#hud-gps');
    this.currentZone = null;
    this.zoneTimer = null;
    this.zones = map.zones.map((z) => ({ ...z, b: bbox(z.p) }));
    this.park = manifest.landmarks.parquePrincipal;
    this.lastStreetCheck = 0;
  }

  zoneAt(x, z) {
    if (this.park && pointInPolygon(x, z, this.park.p)) return 'Parque Principal';
    for (const zn of this.zones) {
      const b = zn.b;
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && pointInPolygon(x, z, zn.p)) return zn.n;
    }
    if (this.park && Math.hypot(x - this.park.c[0], z - this.park.c[1]) < 550) return 'Centro';
    return 'Pitalito';
  }

  update(dt, { vehicle, network, env, route }) {
    const kmh = Math.round(vehicle.speedKmh);
    this.speed.textContent = kmh;
    this.speedBar.style.setProperty('--p', Math.min(1, kmh / vehicle.spec.maxSpeed));
    this.clock.textContent = env.clock;
    this.vehicle.textContent = vehicle.spec.name;

    this.lastStreetCheck -= dt;
    if (this.lastStreetCheck <= 0) {
      this.lastStreetCheck = 0.25;
      const s = network.streetName(vehicle.x, vehicle.z);
      const zone = this.zoneAt(vehicle.x, vehicle.z);
      this.street.textContent = s?.name || s?.label || (s ? 'Vía sin nombre' : 'Fuera de vía');
      this.streetZone.textContent = zone;
      if (zone !== this.currentZone) {
        this.currentZone = zone;
        this.zoneBanner.textContent = zone;
        this.zoneBanner.classList.remove('show');
        void this.zoneBanner.offsetWidth; // reinicia la animación
        this.zoneBanner.classList.add('show');
      }
      if (route?.length) {
        let d = 0;
        for (let i = 1; i < route.length; i++) d += Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
        this.gps.hidden = false;
        this.gps.textContent = `GPS · ${d > 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'}`;
      } else this.gps.hidden = true;
    }
  }

  toast(text, ms = 2600) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  setDebug(text) {
    this.debug.hidden = text === null;
    if (text !== null) this.debug.textContent = text;
  }
}
