// Relieve real (Copernicus GLO-30 corregido, ver scripts/build-world.mjs): rejilla regular en metros
// locales, alturas relativas al Parque Principal. Todo lo que se apoya en el suelo consulta height(x, z).
export class Terrain {
  static current = null;

  constructor(meta, buffer) {
    this.meta = meta;
    this.n = meta.size;
    this.cell = meta.cell;
    this.min = meta.min;
    this.data = new Int16Array(buffer);
    this.scale = meta.scale;
  }

  static flat() {
    const t = Object.create(Terrain.prototype);
    t.height = () => 0;
    t.meta = null;
    return t;
  }

  height(x, z) {
    const n = this.n;
    let fx = (x - this.min) / this.cell, fz = (z - this.min) / this.cell;
    fx = Math.max(0, Math.min(n - 1.001, fx)); fz = Math.max(0, Math.min(n - 1.001, fz));
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const d = this.data, k = j * n + i;
    const a = d[k] * (1 - tx) + d[k + 1] * tx, b = d[k + n] * (1 - tx) + d[k + n + 1] * tx;
    return (a * (1 - tz) + b * tz) * this.scale;
  }

  // Altura mínima/máxima bajo un polígono [x,z,...]
  range(p) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < p.length; i += 2) { const h = this.height(p[i], p[i + 1]); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    return [lo, hi];
  }
}
