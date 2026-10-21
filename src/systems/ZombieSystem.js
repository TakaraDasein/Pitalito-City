import { SURVIVAL, MEZCLA_ZOMBIS, ZOMBIS } from '../config/survival.config.js';
import { Zombie } from '../entities/combat/Zombie.js';
import { RigBody } from '../entities/character/RigBody.js';
import { bakeImpostor } from '../render/ImpostorAtlas.js';
import { HordeRenderer } from '../render/HordeRenderer.js';
import { turno } from './ai/UpdateScheduler.js';

// Modo supervivencia: los zombis del entorno del jugador, en dos niveles.
//
//   - **Horda** (lejos, hasta SURVIVAL.horda.max): datos sueltos {x, z, rumbo, tipo} que deambulan o caminan hacia
//     el jugador si lo oyen, dibujados como impostores (2 triángulos, una llamada de dibujo por tipo).
//   - **Completos** (cerca, hasta SURVIVAL.maxZombis o lo que diga el director de presupuesto): `Zombie`, con
//     esqueleto, IA y combate. Un zombi de la horda que llega a `promover` metros pasa a ser completo; uno
//     completo que se queda atrás sin perseguir a nadie vuelve a la horda.
//
// Igual que el tráfico y las facciones, **nada existe lejos**: la horda aparece en un anillo alrededor del
// jugador y se retira al alejarse. El cupo crece de noche y cerca de los lugares reales donde la gente fue a
// buscar ayuda (hospitales, clínicas, CAI, iglesias, plazas de mercado): map.json → pois, de OpenStreetMap.
//
// Emite: survival:zombie { tipo } al pasar a completo · survival:kill { tipo } al abatirlo.

const pesoTotal = MEZCLA_ZOMBIS.reduce((a, m) => a + m.peso, 0);
const sortearTipo = () => {
  let r = Math.random() * pesoTotal;
  for (const m of MEZCLA_ZOMBIS) if ((r -= m.peso) <= 0) return m.tipo;
  return MEZCLA_ZOMBIS[0].tipo;
};

export class ZombieSystem {
  constructor(game) {
    this.g = game;
    this.zombis = [];        // completos
    this.horda = [];         // lejanos
    this.espera = 0;
    this.esperaHorda = 0;
    this.abatidos = 0;
    this.tiempo = 0;
    this.render = {};        // tipo → HordeRenderer (cuando termina de hornear su atlas)
    const A = SURVIVAL.aparicion;
    this.focos = (game.map?.pois || []).filter((p) => A.focos[p.k]).map((p) => ({ ...p, peso: A.focos[p.k] }));
  }

  get activo() { return this.g.settings.get('modo') === 'supervivencia'; }

  // ───────────── Impostores ─────────────

  // Hornea el atlas de cada tipo con su cuerpo, ropa y clip de caminar. Una vez por partida, al hacer falta.
  #hornear() {
    if (this.horneando) return;
    this.horneando = true;
    for (const [tipo, spec] of Object.entries(ZOMBIS)) {
      RigBody.create(this.g.assets, { look: spec.look, clips: spec.clips, castShadow: false }).then((body) => {
        if (!body) return;
        const atlas = bakeImpostor(this.g.renderer, body.rig, spec.clips.run || spec.clips.walk);
        body.dispose();
        const r = new HordeRenderer(atlas, SURVIVAL.horda.max);
        this.g.scene.add(r.mesh);
        this.render[tipo] = r;
      });
    }
  }

  #pintarHorda() {
    const brillo = 1 - (this.g.env?.night ?? 0) * 0.8;
    const porTipo = {};
    for (const h of this.horda) (porTipo[h.tipo] ??= []).push(h);
    for (const [tipo, r] of Object.entries(this.render)) r.set(this.activo ? porTipo[tipo] || [] : [], this.tiempo, brillo);
  }

  // ───────────── Cupo ─────────────

  // Multiplicador: noche/día y cercanía al foco real más cargado.
  #factor(x, z) {
    const A = SURVIVAL.aparicion;
    const h = this.g.env?.hour ?? 12;
    const noche = A.noche.desde > A.noche.hasta ? h >= A.noche.desde || h < A.noche.hasta : h >= A.noche.desde && h < A.noche.hasta;
    let foco = 1;
    for (const p of this.focos) if (Math.hypot(p.x - x, p.z - z) < A.radioFoco) foco = Math.max(foco, p.peso);
    return (noche ? A.noche.factor : A.dia.factor) * foco;
  }

  // Un sitio en un anillo alrededor del jugador, fuera de los edificios y no sobre el agua.
  #sitio(px, pz, rMin, rMax) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rMin + Math.random() * (rMax - rMin);
      const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
      if (this.g.collision.resolveCircle(x, z, 0.4).hit) continue;
      if (this.g.terrain.isWater?.(x, z)) continue;
      if (this.g.survival?.cercaDeRefugio(x, z)) continue;   // en las iglesias y los CAI no aparecen
      return { x, z };
    }
    return null;
  }

  // ───────────── Completos ─────────────

  spawn(tipo, x, z, opts) {
    const zb = new Zombie(this.g, tipo, x, z, opts);
    this.zombis.push(zb);
    this.g.combatSys.add(zb.self);
    this.g.events.emit('survival:zombie', { tipo });
    return zb;
  }

  #retirar(i) {
    const zb = this.zombis[i];
    this.g.combatSys.remove(zb.self);
    zb.dispose();
    this.zombis.splice(i, 1);
  }

  #actualizarCompletos(dt, f) {
    const H = SURVIVAL.horda;
    for (let i = this.zombis.length - 1; i >= 0; i--) {
      const zb = this.zombis[i];
      const d = Math.hypot(zb.position.x - f.x, zb.position.z - f.z);
      if (!zb.self.alive && !zb.contado) {
        zb.contado = true;
        this.abatidos++;
        this.g.events.emit('survival:kill', { tipo: zb.tipo });
      }
      if (!zb.self.alive) zb.muerto = (zb.muerto || 0) + dt;
      if (!this.activo || d > H.despawn || zb.muerto > 15) { this.#retirar(i); continue; }
      // Se quedó atrás sin perseguir a nadie: vuelve a la horda (y libera su cupo de presupuesto).
      if (zb.self.alive && !zb.objetivo && d > H.degradar) {
        const c = zb.character;
        this.horda.push(this.#lejano(zb.tipo, c.x, c.z, c.heading));
        this.#retirar(i);
        continue;
      }
      const paso = zb.objetivo || d < 30 ? dt : turno(zb.position, f.x, f.z, dt);
      if (paso > 0) zb.update(paso);
    }
  }

  // ───────────── Horda ─────────────

  #lejano(tipo, x, z, heading = Math.random() * Math.PI * 2) {
    const spec = ZOMBIS[tipo];
    return {
      tipo, x, z, y: this.g.terrain.height(x, z), heading, rumbo: heading,
      fase: Math.random(), ritmo: 1, escala: spec.escala?.[1] ?? 1,
      alerta: false, cambio: 0,
    };
  }

  #actualizarHorda(dt, f) {
    const H = SURVIVAL.horda;
    const ruido = !this.g.playerSys.walking ? 2 : 1;
    const tope = Math.min(SURVIVAL.maxZombis, this.g.budget?.maxEnemigos ?? SURVIVAL.maxZombis);
    for (let i = this.horda.length - 1; i >= 0; i--) {
      const h = this.horda[i];
      const dx = f.x - h.x, dz = f.z - h.z;
      const d = Math.hypot(dx, dz);
      if (d > H.despawn || !this.activo) { this.horda.splice(i, 1); continue; }
      // Cerca y con cupo: pasa a ser completo, en el mismo sitio y con el mismo rumbo.
      if (d < H.promover && this.zombis.length < tope) {
        const zb = this.spawn(h.tipo, h.x, h.z);
        zb.character.heading = h.heading;
        this.horda.splice(i, 1);
        continue;
      }
      const spec = ZOMBIS[h.tipo];
      h.alerta = h.alerta || d < H.oido * ruido;
      let vel;
      if (h.alerta) {
        h.rumbo = Math.atan2(-dx, -dz);
        vel = spec.ai.velocidad;
      } else {
        if (this.tiempo > h.cambio) { h.rumbo = h.heading + (Math.random() - 0.5) * 2.4; h.quieto = Math.random() < 0.4; h.cambio = this.tiempo + 3 + Math.random() * 6; }
        vel = h.quieto ? 0 : Math.min(spec.ai.velocidad, 0.6);
      }
      let giro = h.rumbo - h.heading;
      giro = Math.atan2(Math.sin(giro), Math.cos(giro));
      h.heading += giro * Math.min(1, dt * 2);
      if (vel > 0) {
        const r = this.g.collision.resolveCircle(h.x - Math.sin(h.heading) * vel * dt, h.z - Math.cos(h.heading) * vel * dt, 0.35);
        h.x = r.x; h.z = r.z;
        h.y = this.g.terrain.height(h.x, h.z);
      }
      // Quieto, el ciclo se para en la pose de reposo del paso; caminando, va al ritmo de la velocidad.
      h.ritmo = vel > 0 ? Math.max(0.4, vel / Math.max(0.5, spec.ai.velocidad)) * 0.9 : 0;
    }
  }

  // ───────────── Por fotograma ─────────────

  update(dt) {
    this.tiempo += dt;
    const f = this.g.playerSys.focus;
    this.#actualizarCompletos(dt, f);
    this.#actualizarHorda(dt, f);
    if (this.activo) {
      this.#hornear();
      const H = SURVIVAL.horda;
      const meta = Math.round(H.max * Math.min(1, this.#factor(f.x, f.z)));
      this.esperaHorda -= dt;
      if (this.horda.length < meta && this.esperaHorda <= 0) {
        this.esperaHorda = H.cadaSegundos;
        const s = this.#sitio(f.x, f.z, H.radioMin, H.radio);
        if (s) this.horda.push(this.#lejano(sortearTipo(), s.x, s.z));
      }
    }
    this.#pintarHorda();
  }

  /** Un ruido fuerte (un disparo) en (x, z): la horda que lo oye viene, y los completos lo buscan. */
  ruido(x, z, radio) {
    for (const h of this.horda) if (Math.hypot(h.x - x, h.z - z) < radio) h.alerta = true;
    for (const zb of this.zombis) if (Math.hypot(zb.position.x - x, zb.position.z - z) < radio) zb.alertaHasta = zb.time + 20;
  }

  /** Un zombi de la horda lejana abatido de un tiro: se retira y cuenta. */
  abatirLejano(i) {
    const h = this.horda[i];
    if (!h) return;
    this.horda.splice(i, 1);
    this.abatidos++;
    this.g.events.emit('survival:kill', { tipo: h.tipo });
  }

  // Depuración: un zombi completo delante del jugador.
  debugSpawn(tipo = 'caminante', distancia = 6) {
    const p = this.g.playerSys.character;
    return this.spawn(tipo, p.x - Math.sin(p.heading) * distancia, p.z - Math.cos(p.heading) * distancia);
  }
}
