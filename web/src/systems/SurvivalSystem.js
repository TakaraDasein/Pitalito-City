import { SURVIVAL } from '../config/survival.config.js';

// Necesidades del modo supervivencia: hambre, sed e infección, refugios y qué pasa al caer.
//
// Los valores viven en `InventorySystem.estado` (se guardan con la mochila) y aquí sólo se hacen correr:
//   - hambre y sed bajan con el tiempo, más rápido corriendo; a 0 quitan vida; altas, la recuperan despacio;
//   - un zarpazo de zombi que entra puede infectar; la infección sube sola hasta el antibiótico, con fiebre la
//     resistencia se recupera a la mitad y a 100 quita vida;
//   - los **refugios** son iglesias y estaciones de policía reales (OSM): ahí no aparecen zombis nuevos, las
//     necesidades bajan a la mitad, se cura y queda guardado como punto de reaparición;
//   - al caer, se reaparece en el último refugio y se pierde parte de la mochila.
//
// Pinta su propio panel (vida, hambre, sed, infección), sólo en el modo supervivencia.
// Emite: survival:refugio { nombre } | null.

export class SurvivalSystem {
  constructor(game, root) {
    this.g = game;
    const R = SURVIVAL.refugios;
    // Iglesias y CAI reales, más las bases de comerciantes (BaseSystem).
    this.refugios = [...(game.map?.pois || []).filter((p) => R.tipos.includes(p.k)), ...(game.bases?.refugios || [])];
    this.refugio = null;
    this.caido = 0;
    try { this.ultimoRefugio = JSON.parse(localStorage.getItem('pitalito:supervivencia:v1:refugio') || 'null'); } catch { this.ultimoRefugio = null; }

    this.el = document.createElement('div');
    this.el.id = 'hud-vitales';
    this.el.className = 'cafe-panel';
    this.el.hidden = true;
    this.el.setAttribute('aria-label', 'Necesidades');
    this.el.innerHTML = ['vida|Vida', 'hambre|Hambre', 'sed|Sed', 'infeccion|Infección'].map((s) => {
      const [k, n] = s.split('|');
      return `<div class="vital vit-${k}"><span class="vital-fill"></span><span class="vital-label">${n}</span></div>`;
    }).join('') + '<p class="vit-refugio" hidden></p>';
    root.appendChild(this.el);
    this.barras = Object.fromEntries(['vida', 'hambre', 'sed', 'infeccion'].map((k) => [k, this.el.querySelector(`.vit-${k} .vital-fill`)]));

    game.events.on('combat:hit', (h) => {
      if (!this.activo || h.attacker !== 'zombi' || h.blocked || h.dead) return;
      const I = SURVIVAL.infeccion;
      if (Math.random() < I.probabilidad) {
        const e = this.g.inventory.estado;
        const antes = e.infeccion;
        e.infeccion = Math.min(100, e.infeccion + I.porMordida);
        if (antes === 0) this.g.hud.toast('Te mordieron: estás infectado. Busca antibiótico.', 4200);
      }
    });
  }

  get activo() { return this.g.settings.get('modo') === 'supervivencia'; }

  /** ¿Hay un refugio a menos de `r` metros de (x, z)? Lo usa ZombieSystem para no hacer aparecer zombis ahí. */
  cercaDeRefugio(x, z, r = SURVIVAL.refugios.sinAparicion) {
    return this.refugios.some((p) => Math.hypot(p.x - x, p.z - z) < r);
  }

  update(dt) {
    const activo = this.activo;
    this.el.hidden = !activo || this.g.state !== 'playing';
    if (!activo) return;
    const p = this.g.playerSys, c = p.combat, e = this.g.inventory.estado;
    const V = SURVIVAL.vitales, I = SURVIVAL.infeccion, R = SURVIVAL.refugios;

    // ¿Está en un refugio? (a pie o en el vehículo)
    const f = p.focus;
    const ref = this.refugios.find((r) => Math.hypot(r.x - f.x, r.z - f.z) < R.radio) || null;
    if (ref?.n !== this.refugio?.n) {
      this.refugio = ref;
      this.g.events.emit('survival:refugio', ref ? { nombre: ref.n } : null);
      if (ref) {
        this.ultimoRefugio = { n: ref.n, x: ref.x, z: ref.z };
        try { localStorage.setItem('pitalito:supervivencia:v1:refugio', JSON.stringify(this.ultimoRefugio)); } catch { /* sin almacenamiento */ }
        this.g.hud.toast(`Refugio: ${ref.n}. Aquí reaparecerás.`, 3600);
      }
    }

    if (!c.alive) { this.#caer(dt); return; }

    // Hambre y sed
    const corriendo = p.walking && p.character.vx ** 2 + p.character.vz ** 2 > 30;
    const gasto = (corriendo ? V.esfuerzo : 1) * (ref ? R.gasto : 1) * dt / 60;
    e.hambre = Math.max(0, e.hambre - (100 / V.hambreMin) * gasto);
    e.sed = Math.max(0, e.sed - (100 / V.sedMin) * gasto);
    let vida = 0;
    if (e.hambre <= 0 || e.sed <= 0) vida -= V.danoVacio * dt;
    else if (e.hambre > V.regen.desde && e.sed > V.regen.desde) vida += V.regen.vida * dt;
    if (ref) vida += R.vida * dt;

    // Infección
    if (e.infeccion > 0) {
      e.infeccion = Math.min(100, e.infeccion + I.subePorMin * dt / 60);
      if (e.infeccion >= 100) vida -= I.danoTotal * dt;
    }
    c.regenFactor = e.infeccion >= I.fiebre ? 0.5 : 1;

    if (vida) {
      c.health = Math.max(0, Math.min(c.stats.health, c.health + vida));
      if (c.health <= 0) { c.health = 0.01; c.takeHit({ damage: 1 }); this.g.hud.toast('Has caído'); }
    }

    this.#pintar(c, e, ref);
    this.guardarEn = (this.guardarEn || 0) - dt;
    if (this.guardarEn <= 0) { this.guardarEn = 10; this.g.inventory.guardar(); }
  }

  #pintar(c, e, ref) {
    this.barras.vida.style.width = `${(c.health / c.stats.health) * 100}%`;
    this.barras.hambre.style.width = `${e.hambre}%`;
    this.barras.sed.style.width = `${e.sed}%`;
    this.barras.infeccion.style.width = `${e.infeccion}%`;
    this.el.classList.toggle('vit-fiebre', e.infeccion >= SURVIVAL.infeccion.fiebre);
    const r = this.el.querySelector('.vit-refugio');
    r.hidden = !ref;
    if (ref) r.textContent = `Refugio · ${ref.n}`;
  }

  // Caído: tras unos segundos reaparece en el último refugio con parte de la mochila.
  #caer(dt) {
    const M = SURVIVAL.muerte;
    this.caido += dt;
    if (this.caido < M.espera) return;
    this.caido = 0;
    const inv = this.g.inventory;
    let perdido = 0;
    for (const { id, n } of inv.lista) {
      const k = Math.ceil(n * M.pierde);
      if (k > 0) { inv.quitar(id, k); perdido += k; }
    }
    const destino = this.ultimoRefugio || this.g.manifest.spawn;
    const p = this.g.playerSys;
    // Se aparece al lado del punto (el punto suele caer dentro del edificio): la colisión lo empuja fuera.
    const r = this.g.collision.resolveCircle(destino.x + 3, destino.z + 3, 0.5);
    if (p.walking) p.placeCharacter(r.x, r.z); else this.g.player.place(r.x, r.z, this.g.player.heading);
    p.combat.revivir(M.vida);
    Object.assign(inv.estado, { hambre: Math.max(inv.estado.hambre, 40), sed: Math.max(inv.estado.sed, 40) });
    inv.guardar();
    this.g.hud.toast(`Despiertas en ${destino.n || 'el Parque Principal'}. Perdiste ${perdido} objeto${perdido === 1 ? '' : 's'} de la mochila.`, 5000);
  }
}
