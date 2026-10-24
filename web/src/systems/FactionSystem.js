import { FACTIONS, ZONAS, SPAWN, MEZCLA } from '../config/factions.config.js';
import { Enemy } from '../entities/combat/Enemy.js';
import { turno } from './ai/UpdateScheduler.js';

// Zonas de control de las facciones: pobla y retira enemigos según dónde esté el jugador, y lleva la cuenta de
// lo que pasa en cada zona.
//
// Funciona igual que el tráfico: **nada existe lejos del jugador**. Una zona sólo tiene enemigos vivos si el
// jugador está dentro de su radio de aparición, y se retiran al alejarse. Así el presupuesto de animación
// (CHARACTERS.budget.maxAnimated) no depende de cuántas zonas haya en el mapa.
//
// Las facciones son ficción declarada: ver la cabecera de src/config/factions.config.js.
//
// Emite: faction:zone { nombre, faccion } | null  ·  faction:cleared { zona }

const pesoTotal = MEZCLA.reduce((a, m) => a + m.peso, 0);
const sortearTipo = () => {
  let r = Math.random() * pesoTotal;
  for (const m of MEZCLA) if ((r -= m.peso) <= 0) return m.tipo;
  return MEZCLA[0].tipo;
};

export class FactionSystem {
  constructor(game) {
    this.g = game;
    this.enemies = [];
    this.zonaActual = null;
    // Por zona: cuántos enemigos lleva abatidos el jugador y cuándo vuelve a poblarse.
    this.estado = new Map(ZONAS.map((z) => [z.id, { abatidos: 0, repuebla: 0, despejada: false }]));
  }

  get activo() { return FACTIONS.enabled && this.g.playerSys.walking; }

  // Zona en la que está el jugador, si hay alguna.
  zonaEn(x, z) {
    for (const zona of ZONAS) {
      if (Math.hypot(x - zona.x, z - zona.z) <= zona.radio) return zona;
    }
    return null;
  }

  #spawn(zona, x, z) {
    const e = new Enemy(this.g, sortearTipo(), x, z, zona.id);
    this.enemies.push(e);
    this.g.combatSys.add(e.self);
    return e;
  }

  // Busca un sitio donde poner un enemigo: dentro de la zona, lejos del jugador y sobre terreno, no sobre agua.
  #sitio(zona, px, pz) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = SPAWN.minDistance + Math.random() * (SPAWN.spawnRadius - SPAWN.minDistance);
      const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
      if (Math.hypot(x - zona.x, z - zona.z) > zona.radio) continue;
      if (Math.hypot(x - px, z - pz) < SPAWN.minDistance) continue;
      return { x, z };
    }
    return null;
  }

  update(dt) {
    if (!FACTIONS.enabled) return;
    const p = this.g.playerSys.character;

    // Retirar lo que quedó lejos o muerto hace rato.
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const d = Math.hypot(e.position.x - p.x, e.position.z - p.z);
      const muerto = !e.self.alive;
      if (muerto && !e.contado) {
        e.contado = true;
        const st = this.estado.get(e.zona);
        if (st) {
          st.abatidos++;
          st.repuebla = this.g.time + SPAWN.respawnSeconds;
        }
      }
      if (d > SPAWN.despawnRadius || (muerto && e.self.timerMuerte > 12)) {
        this.g.combatSys.remove(e.self);
        e.dispose();
        this.enemies.splice(i, 1);
        continue;
      }
      // Lo lejos se piensa menos veces, salvo si está peleando: en combate manda la precisión.
      const cerca = e.objetivo || Math.hypot(e.position.x - p.x, e.position.z - p.z) < 30;
      const paso = cerca ? dt : turno(e.position, p.x, p.z, dt);
      if (paso > 0) e.update(paso);
      if (muerto) e.self.timerMuerte = (e.self.timerMuerte || 0) + dt;
    }

    // Si el director de presupuesto apretó, se retiran los enemigos más lejanos que **no estén peleando**: a los
    // que ya te vieron no se les quita del mapa, que sería hacer trampa.
    const tope = this.g.budget?.maxEnemigos ?? SPAWN.maxActive;
    while (this.enemies.length > tope) {
      let peor = -1, dPeor = -1;
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e.objetivo) continue;
        const d = Math.hypot(e.position.x - p.x, e.position.z - p.z);
        if (d > dPeor) { dPeor = d; peor = i; }
      }
      if (peor < 0) break;   // todos están peleando: no se toca nada
      this.g.combatSys.remove(this.enemies[peor].self);
      this.enemies[peor].dispose();
      this.enemies.splice(peor, 1);
    }

    if (!this.activo) return;

    // ¿Entró o salió de una zona?
    const zona = this.zonaEn(p.x, p.z);
    if (zona?.id !== this.zonaActual?.id) {
      this.zonaActual = zona;
      this.g.events.emit('faction:zone', zona
        ? { nombre: zona.nombre, faccion: FACTIONS[zona.faccion]?.nombre || '' }
        : null);
    }
    if (!zona) return;

    // Poblar hasta el cupo de la zona, sin pasarse del tope global.
    const st = this.estado.get(zona.id);
    const vivos = this.enemies.filter((e) => e.zona === zona.id && e.self.alive).length;
    // El tope efectivo lo pone el director de presupuesto, no la configuración: puede bajarlo si va apretado.
    if (vivos >= zona.enemigos || this.enemies.length >= tope) return;
    if (this.g.time < st.repuebla) return;

    const sitio = this.#sitio(zona, p.x, p.z);
    if (sitio) this.#spawn(zona, sitio.x, sitio.z);
  }

  // Depuración: pone un enemigo delante del jugador sin esperar a estar en una zona.
  debugSpawn(tipo = 'centinela', distancia = 6) {
    const p = this.g.playerSys.character;
    const x = p.x - Math.sin(p.heading) * distancia;
    const z = p.z - Math.cos(p.heading) * distancia;
    const e = new Enemy(this.g, tipo, x, z, null);
    this.enemies.push(e);
    this.g.combatSys.add(e.self);
    return e;
  }
}
