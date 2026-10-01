import { WILDLIFE, ESPECIES, NICHOS, BOSQUE, CIUDAD, MANADA } from '../config/wildlife.config.js';
import { MUNICIPIO, DERIVADOS } from '../config/municipio.config.js';
import { Animal } from '../entities/wildlife/Animal.js';

// Reparte la fauna por el mundo: qué animal, dónde y a qué hora.
//
// Igual que el tráfico y las facciones: **nada existe lejos del jugador**. Lo que decide qué aparece no es una
// lista fija, sino **el sitio y la hora**:
//
//   · el hábitat sale de los datos del tile donde está el jugador — árboles alrededor = bosque, lejos del casco
//     urbano y sin edificios cerca = finca, dentro de la ciudad = calle;
//   · **la mezcla del ganado es la real** del municipio (IGAC): el 92 % del inventario son aves, así que lo que
//     más se ve en el campo son gallinas, y después vacas (`DERIVADOS.mezclaPecuaria`);
//   · los nocturnos sólo salen entre las 18:30 y las 5:30.
//
// Emite: wildlife:spawn { especie }

export class WildlifeSystem {
  constructor(game) {
    this.g = game;
    this.animals = [];
    this.acumulado = 0;
    // Peso de cada especie: el del inventario real corregido por lo que de verdad se ve desde el camino
    // (`visibilidad`, decisión de diseño declarada en wildlife.config.js). Las estimadas traen su propio peso.
    this.pesos = new Map();
    for (const e of Object.values(ESPECIES)) {
      const real = e.real ? DERIVADOS.mezclaPecuaria[e.real] : null;
      this.pesos.set(e.id, real != null ? real * 100 * (e.visibilidad ?? 1) : (e.peso ?? 1));
    }
  }

  get hora() { return this.g.env?.hour ?? 12; }

  esDeNoche() {
    const [desde, hasta] = NICHOS.nocturno.horas;
    return this.hora >= desde || this.hora <= hasta;
  }

  // Cuántos árboles hay cerca, mirando los tiles ya cargados.
  #arbolesCerca(x, z, radio = BOSQUE.radio) {
    let n = 0;
    const r2 = radio * radio;
    for (const entry of this.g.streamer.tiles.values()) {
      const t = entry.data;
      if (!t?.trees) continue;
      // Descarta el tile entero si está lejos (los tiles son de 250 m).
      if (Math.abs(t.x * 250 + 125 - x) > radio + 180 || Math.abs(t.z * 250 + 125 - z) > radio + 180) continue;
      for (let k = 0; k < t.trees.length; k += 4) {
        const dx = t.trees[k] - x, dz = t.trees[k + 1] - z;
        if (dx * dx + dz * dz < r2) n++;
      }
    }
    return n;
  }

  // Cuántos edificios hay alrededor. No vale preguntar "¿hay alguno?": en el campo de Pitalito hay casas de
  // finca por todas partes. Lo que distingue la ciudad del campo es la **densidad**.
  #edificiosCerca(x, z, radio = CIUDAD.radio) {
    let n = 0;
    const r2 = radio * radio;
    for (const entry of this.g.streamer.tiles.values()) {
      const t = entry.data;
      if (!t?.buildings?.length) continue;
      if (Math.abs(t.x * 250 + 125 - x) > radio + 180 || Math.abs(t.z * 250 + 125 - z) > radio + 180) continue;
      for (const b of t.buildings) {
        const dx = b.p[0] - x, dz = b.p[1] - z;
        if (dx * dx + dz * dz < r2) n++;
      }
    }
    return n;
  }

  /** Qué hábitat hay en un punto: 'bosque' | 'finca' | 'calle'. */
  habitat(x, z) {
    if (this.#arbolesCerca(x, z) >= BOSQUE.arbolesMinimos) return 'bosque';
    // Dentro del casco urbano no hay ganado suelto. El 58,9 % del municipio vive en la cabecera (IGAC), y lo que
    // la separa del campo es la densidad de casas, no que haya una.
    if (Math.hypot(x, z) < CIUDAD.radioCabecera || this.#edificiosCerca(x, z) >= CIUDAD.edificiosMinimos) return 'calle';
    return 'finca';
  }

  #elegir(habitat) {
    const noche = this.esDeNoche();
    const candidatas = Object.values(ESPECIES).filter((e) => {
      if (e.habitat !== habitat) return false;
      if (e.nicho === 'nocturno' && !noche) return false;
      return true;
    });
    if (!candidatas.length) return null;
    const total = candidatas.reduce((a, e) => a + this.pesos.get(e.id), 0);
    let r = Math.random() * total;
    for (const e of candidatas) if ((r -= this.pesos.get(e.id)) <= 0) return e;
    return candidatas[0];
  }

  #sitio(px, pz) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = WILDLIFE.minDistance + Math.random() * (WILDLIFE.spawnRadius - WILDLIFE.minDistance);
      const x = px + Math.cos(a) * dist, z = pz + Math.sin(a) * dist;
      // Nada de fauna dentro de una pared: si la colisión lo empuja, el sitio no sirve.
      const libre = this.g.collision.resolveCircle(x, z, 1);
      if (Math.hypot(libre.x - x, libre.z - z) > 0.01) continue;
      return { x, z };
    }
    return null;
  }

  spawn(especieId, x, z) {
    const spec = ESPECIES[especieId];
    const a = new Animal(this.g, especieId, x, z);
    this.animals.push(a);
    this.g.events.emit('wildlife:spawn', { especie: spec.nombre });

    // Las especies que andan en grupo (venados, pájaros) aparecen con los suyos. **El grupo es una sola entidad
    // lógica**: comparte destino y alarma, así que no hay que decidir por cada individuo.
    if (spec.manada) {
      const [min, max] = spec.manada;
      const n = min + Math.floor(Math.random() * (max - min + 1));
      const grupo = [a];
      grupo.lider = a;
      a.grupo = grupo;
      const tope = this.g.budget?.maxFauna ?? WILDLIFE.maxActive;
      for (let i = 1; i < n && this.animals.length < tope; i++) {
        const ang = Math.random() * Math.PI * 2, r = MANADA.separacion + Math.random() * MANADA.radioInicial;
        const o = new Animal(this.g, especieId, x + Math.cos(ang) * r, z + Math.sin(ang) * r);
        o.grupo = grupo;
        grupo.push(o);
        this.animals.push(o);
      }
    }
    return a;
  }

  update(dt) {
    if (!WILDLIFE.enabled) return;
    const p = this.g.playerSys.walking ? this.g.playerSys.character : this.g.player;

    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      if (Math.hypot(a.x - p.x, a.z - p.z) > WILDLIFE.despawnRadius) {
        if (a.grupo) {
          const k = a.grupo.indexOf(a);
          if (k >= 0) a.grupo.splice(k, 1);
          if (a.grupo.lider === a) a.grupo.lider = a.grupo[0] || null;
        }
        a.dispose();
        this.animals.splice(i, 1);
        continue;
      }
      a.update(dt);
    }

    // Tope efectivo del director de presupuesto (ver src/core/FrameBudget.js). Si ya hay de más —porque el
    // director acaba de apretar— se retiran los más lejanos: frenar lo nuevo no basta para bajar el gasto.
    const tope = this.g.budget?.maxFauna ?? WILDLIFE.maxActive;
    while (this.animals.length > tope) {
      let peor = 0, dPeor = -1;
      for (let i = 0; i < this.animals.length; i++) {
        const d = Math.hypot(this.animals[i].x - p.x, this.animals[i].z - p.z);
        if (d > dPeor) { dPeor = d; peor = i; }
      }
      this.animals[peor].dispose();
      this.animals.splice(peor, 1);
    }
    if (this.animals.length >= tope) return;
    this.acumulado += dt * WILDLIFE.intentosPorSegundo;
    if (this.acumulado < 1) return;
    this.acumulado = 0;

    const sitio = this.#sitio(p.x, p.z);
    if (!sitio) return;
    const especie = this.#elegir(this.habitat(sitio.x, sitio.z));
    if (especie) this.spawn(especie.id, sitio.x, sitio.z);
  }

  // Depuración: pone un animal delante del jugador (consola: game.wildlife.debugSpawn('borugo')).
  debugSpawn(especieId = 'gallina', distancia = 5) {
    const p = this.g.playerSys.walking ? this.g.playerSys.character : this.g.player;
    return this.spawn(especieId, p.x - Math.sin(p.heading) * distancia, p.z - Math.cos(p.heading) * distancia);
  }
}
