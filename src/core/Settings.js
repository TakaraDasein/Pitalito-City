// Ajustes del jugador (calidad, audio, cámara, vehículo elegido). Se guardan en localStorage si está
// disponible; si no (modo privado, previsualizaciones), el juego funciona igual con los valores por defecto.
export const QUALITY = {
  baja:  { label: 'Baja',  pixelRatio: 0.85, shadows: false, shadowMapSize: 1024, shadowRadius: 80,  post: false, msaa: 0, bloom: false, ao: false, grade: false, streamRadius: 1, groundDetail: false, envMap: true },
  media: { label: 'Media', pixelRatio: 1,    shadows: true,  shadowMapSize: 2048, shadowRadius: 100, post: true,  msaa: 4, bloom: true,  ao: false, grade: true,  streamRadius: 2, groundDetail: true,  envMap: true },
  alta:  { label: 'Alta',  pixelRatio: 1.5,  shadows: true,  shadowMapSize: 2048, shadowRadius: 120, post: true,  msaa: 4, bloom: true,  ao: false, grade: true,  streamRadius: 2, groundDetail: true,  envMap: true },
  ultra: { label: 'Ultra', pixelRatio: 2,    shadows: true,  shadowMapSize: 4096, shadowRadius: 160, post: true,  msaa: 4, bloom: true,  ao: true,  grade: true,  streamRadius: 3, groundDetail: true,  envMap: true },
};

const KEY = 'pitalito:settings:v1';
const DEFAULTS = {
  quality: 'alta',
  volume: 0.7,
  cameraSensitivity: 1,
  invertY: false,
  weather: 'auto',                // auto | despejado | lluvia
  vehicle: { type: 'willys', color: null, plate: 'PTL 200' },
};

export class Settings {
  constructor(events) {
    this.events = events;
    this.values = structuredClone(DEFAULTS);
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved) this.values = { ...this.values, ...saved, vehicle: { ...this.values.vehicle, ...saved.vehicle } };
    } catch { /* sin almacenamiento: valores por defecto */ }
    if (!QUALITY[this.values.quality]) this.values.quality = DEFAULTS.quality;
  }

  get(k) { return this.values[k]; }
  get quality() { return QUALITY[this.values.quality]; }

  set(k, v) {
    this.values[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(this.values)); } catch { /* ignorar */ }
    this.events?.emit('settings:changed', { key: k, value: v });
  }
}
