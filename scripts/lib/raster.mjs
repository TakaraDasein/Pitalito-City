// Lectura de rásters para el pipeline: GDAL convierte a binario crudo (ENVI) y aquí se muestrea.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';

const R = 6378137;
const toMerc = (lat, lon) => [R * (lon * Math.PI) / 180, R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
const fromMerc = (x, y) => [(Math.atan(Math.exp(y / R)) * 360) / Math.PI - 90, (x / R) * (180 / Math.PI)];

const TYPES = { Byte: Uint8Array, Float32: Float32Array, Int16: Int16Array, UInt16: Uint16Array };

export function loadRaster(tif) {
  const info = JSON.parse(execFileSync('gdalinfo', ['-json', tif], { maxBuffer: 1 << 26 }).toString());
  const [width, height] = info.size;
  const type = info.bands[0].type;
  const bin = tif.replace(/\.tif$/, '.bin');
  if (!existsSync(bin) || statSync(bin).mtimeMs < statSync(tif).mtimeMs) {
    execFileSync('gdal_translate', ['-q', '-of', 'ENVI', '-co', 'INTERLEAVE=BSQ', tif, bin]);
  }
  const buf = readFileSync(bin);
  const T = TYPES[type];
  const all = new T(buf.buffer, buf.byteOffset, buf.byteLength / T.BYTES_PER_ELEMENT);
  const n = width * height;
  const bands = info.bands.map((_, i) => all.subarray(i * n, (i + 1) * n));
  const gt = info.geoTransform;
  const mercator = /3857|Pseudo-Mercator/.test(info.coordinateSystem?.wkt || '');
  const nodata = info.bands[0].noDataValue;

  // lat/lon → píxel (fraccional)
  const toPixel = (lat, lon) => {
    const [x, y] = mercator ? toMerc(lat, lon) : [lon, lat];
    return [(x - gt[0]) / gt[1], (y - gt[3]) / gt[5]];
  };
  const toGeo = (px, py) => {
    const x = gt[0] + px * gt[1], y = gt[3] + py * gt[5];
    return mercator ? fromMerc(x, y) : [y, x];
  };
  const at = (band, px, py) => {
    const ix = Math.floor(px), iy = Math.floor(py);
    if (ix < 0 || iy < 0 || ix >= width || iy >= height) return NaN;
    const v = bands[band][iy * width + ix];
    return v === nodata ? NaN : v;
  };
  const bilinear = (band, px, py) => {
    px -= 0.5; py -= 0.5;
    const x0 = Math.max(0, Math.min(width - 2, Math.floor(px))), y0 = Math.max(0, Math.min(height - 2, Math.floor(py)));
    const fx = Math.min(1, Math.max(0, px - x0)), fy = Math.min(1, Math.max(0, py - y0));
    const b = bands[band], i = y0 * width + x0;
    return (b[i] * (1 - fx) + b[i + 1] * fx) * (1 - fy) + (b[i + width] * (1 - fx) + b[i + width + 1] * fx) * fy;
  };
  return { width, height, bands, pixelSize: Math.abs(gt[1]), mercator, toPixel, toGeo, at, bilinear };
}
