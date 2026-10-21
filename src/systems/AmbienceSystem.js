import { Sangre } from '../render/Sangre.js';
import { PARTICLES } from '../config/particles.config.js';
import { BOSQUE } from '../config/wildlife.config.js';

// Ambiente: lo que hace que el mundo parezca vivo sin que pase nada.
//
// Conecta las partículas con lo que ocurre de verdad en el juego — golpes, pasos, lluvia — y añade lo que sale
// del sitio y de la hora: **luciérnagas de noche bajo los árboles** y **hojas que arrastra el viento de día**.
// No hay listas de sitios: se mira dónde está el jugador, como hace la fauna.
//
// Todo pasa por `ParticleSystem`, así que esto no mueve ni una partícula: sólo dice cuándo y dónde emitir.

export class AmbienceSystem {
  constructor(game, particles) {
    this.g = game;
    this.p = particles;
    this.pasoAcumulado = 0;
    this.ambienteAcumulado = 0;
    this.lluviaAcumulada = 0;
    this.tension = 0;
    this.sangre = new Sangre(game.scene, game.terrain, game.materials.get('sangre'));
    this.#escuchar();
  }

  #escuchar() {
    const e = this.g.events;
    // Un golpe que entra suelta algo distinto según a quién: polvo de hueso en los esqueletos, chispas si choca
    // contra metal, polvo si es un animal o una persona.
    e.on('combat:impacto', ({ x, y, z, tipo, fuerza = 1 }) => {
      // La sangre en el suelo va aunque no haya partículas (calidad baja).
      if (tipo === 'carne') this.sangre?.poner(x, z, fuerza);
      if (!this.p) return;
      const emision = tipo === 'hueso' ? 'golpeHueso' : tipo === 'metal' ? 'golpeMetal' : 'golpeCarne';
      this.p.emitir(emision, x, y, z, fuerza);
      // Un golpe fuerte contra hueso también suelta chispas: el machete raspa.
      if (tipo === 'hueso' && fuerza > 0.9) this.p.emitir('golpeMetal', x, y, z, 0.4);
    });
  }

  // ¿Hay árboles encima? Lo responde el perfil de tiles (src/world/TileProfile.js). El umbral es más bajo que
  // el de la fauna: para unas luciérnagas basta un par de árboles; para un venado hace falta monte.
  #arbolesCerca(x, z) {
    return this.g.tileProfile.contar('arboles', x, z, BOSQUE.radio);
  }

  update(dt) {
    this.sangre?.update(dt);
    if (!PARTICLES.enabled || !this.p) return;
    const g = this.g;
    const caminando = g.playerSys.walking;
    const foco = caminando ? g.playerSys.character : g.player;

    // ── Pasos: polvo bajo los pies, sólo fuera del asfalto y cuando se mueve de verdad.
    if (caminando) {
      const v = Math.hypot(foco.vx ?? 0, foco.vz ?? 0);
      if (v > 1.2 && foco.onGround) {
        this.pasoAcumulado += dt * v;
        const paso = v > 5 ? 2.4 : 3.2;      // corriendo, más seguido
        if (this.pasoAcumulado > paso) {
          this.pasoAcumulado = 0;
          this.p.emitir(v > 5 ? 'pasoCorriendo' : 'pasoTierra', foco.x, foco.y + 0.06, foco.z);
        }
      }
    }

    // ── Lluvia: salpicaduras alrededor, para que el agua toque algo y no sólo caiga.
    if (g.weather?.raining) {
      this.lluviaAcumulada += dt;
      if (this.lluviaAcumulada > 0.05) {
        this.lluviaAcumulada = 0;
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 14;
          const x = foco.x + Math.cos(a) * r, z = foco.z + Math.sin(a) * r;
          this.p.emitirEn('salpicadura', x, g.terrain.height(x, z) + 0.02, z, 1, { velocidad: 1.1, dispersion: 0.5 });
        }
      }
    }

    // ── Ambiente del sitio y la hora: luciérnagas de noche, hojas de día, y sólo bajo los árboles.
    this.ambienteAcumulado += dt;
    if (this.ambienteAcumulado < 0.25) return;
    this.ambienteAcumulado = 0;

    // ── Chicharras: arrancan al caer la tarde y bajan de madrugada. Son el fondo sonoro del valle.
    const h = g.env?.hour ?? 12;
    const coro = h >= 16.5 && h <= 23 ? Math.min(1, (h - 16.5) / 1.5) : h <= 5 ? 0.35 : h >= 23 ? 0.5 : 0;
    g.audio?.setChicharras?.(coro * (g.weather?.raining ? 0.25 : 1));

    // ── Dirección de atmósfera: cuánto "aprieta" la imagen. Sube con los enemigos cerca y con el monte cerrado.
    const arboles = this.#arbolesCerca(foco.x, foco.z);
    const enemigoCerca = (g.factions?.enemies || []).reduce((m, e) => {
      if (!e.self.alive) return m;
      const d = Math.hypot(e.position.x - foco.x, e.position.z - foco.z);
      return Math.max(m, d < 30 ? 1 - d / 30 : 0);
    }, 0);
    const cerrado = Math.min(1, arboles / 14);
    const tension = Math.min(1, enemigoCerca * 0.8 + cerrado * 0.35);
    this.tension += (tension - this.tension) * Math.min(1, dt * 1.5);
    g.postfx?.setTension(this.tension);
    // Bajo el monte cerrado la niebla se espesa: es lo que separa el valle abierto del bosque.
    if (g.env?.scene?.fog) g.env.fogExtra = 1 + cerrado * 0.9;

    if (arboles < 2) return;

    const hora = g.env?.hour ?? 12;
    const deNoche = hora >= 18.5 || hora <= 5.5;
    const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 16;
    const x = foco.x + Math.cos(a) * r, z = foco.z + Math.sin(a) * r;
    const suelo = g.terrain.height(x, z);
    if (deNoche) {
      this.p.emitirEn('luciernagas', x, suelo + 0.5 + Math.random() * 1.8, z, 2, { velocidad: 0.25, dispersion: 1 });
    } else if (!g.weather?.raining) {
      this.p.emitirEn('hojas', x, suelo + 2.5 + Math.random() * 3, z, 1, { velocidad: 0.7, dispersion: 1.4, dirY: 0.15 });
    }
  }
}
