import { MAP_STYLE, drawArrow, drawPin } from './MapRenderer.js';

// Minimapa circular que rota con la cámara (como en GTA).
export class Minimap {
  constructor(container, renderer) {
    this.r = renderer;
    this.size = 210;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap';
    const dpr = Math.min(2, devicePixelRatio);
    this.canvas.width = this.canvas.height = this.size * dpr;
    this.dpr = dpr;
    container.appendChild(this.canvas);
    this.metersRadius = 230;
  }

  draw({ x, z, camHeading, vehicleHeading, route, waypoint, traffic, speedKmh }) {
    const ctx = this.canvas.getContext('2d');
    const S = this.size, R = S / 2;
    // zoom out con la velocidad
    const target = 190 + Math.min(200, speedKmh * 2.2);
    this.metersRadius += (target - this.metersRadius) * 0.05;
    const k = R / this.metersRadius; // píxeles de pantalla por metro
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R - 3, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = MAP_STYLE.land; ctx.fillRect(0, 0, S, S);
    ctx.translate(R, R);
    ctx.rotate(camHeading);
    const [mx, my] = this.r.toMap(x, z);
    const f = k / this.r.scale;
    ctx.scale(f, f);
    ctx.drawImage(this.r.canvas, -mx, -my);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(R, R);
    ctx.rotate(camHeading);
    const w2s = (wx, wz) => [(wx - x) * k, (wz - z) * k];
    if (route?.length > 1) {
      ctx.strokeStyle = MAP_STYLE.route; ctx.lineWidth = 4; ctx.lineJoin = ctx.lineCap = 'round';
      ctx.beginPath();
      route.forEach(([wx, wz], i) => { const [sx, sy] = w2s(wx, wz); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
      ctx.stroke();
    }
    for (const t of traffic || []) {
      const [sx, sy] = w2s(t.x, t.z);
      ctx.fillStyle = t.type === 'taxi' ? '#f7c600' : t.type === 'chiva' ? '#3fae49' : '#c9d1d9';
      ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
    }
    ctx.restore();

    // waypoint (anclado al borde si está lejos)
    if (waypoint) {
      let [sx, sy] = w2s(waypoint.x, waypoint.z);
      const c = Math.cos(camHeading), s = Math.sin(camHeading);
      [sx, sy] = [sx * c - sy * s, sx * s + sy * c];
      const d = Math.hypot(sx, sy), max = R - 14;
      if (d > max) { sx *= max / d; sy *= max / d; }
      drawPin(ctx, R + sx, R + sy);
    }
    drawArrow(ctx, R, R, camHeading - vehicleHeading, 9);
    // Norte
    const na = camHeading;
    const nx = R + Math.sin(-na) * -(R - 12), ny = R + Math.cos(-na) * -(R - 12);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(nx, ny, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, ny + 0.5);
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(R, R, R - 3, 0, Math.PI * 2); ctx.stroke();
  }
}
