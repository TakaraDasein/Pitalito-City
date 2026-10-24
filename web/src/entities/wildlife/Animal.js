import * as THREE from 'three';
import { Rig, loadCharacter } from '../skinning/Rig.js';
import { AnimalBody } from './models.js';
import { ESPECIES, NICHOS, MANADA } from '../../config/wildlife.config.js';
import { selector, secuencia, si, hacer, RUN } from '../../systems/ai/BehaviorTree.js';

// Un animal: cuerpo (de archivo con su propio esqueleto, o modelado a mano) + árbol de comportamiento.
//
// Usa **el mismo árbol** que las facciones (src/systems/ai/BehaviorTree.js); lo que cambia es qué nodos se
// enganchan. No hay combate completo: un animal no ataca con armas ni gasta resistencia, así que lleva su propia
// vida y nada más. Si hiciera falta que peleara de verdad, se le pondría un `Combatant` como a los enemigos.
//
// Tres nichos (ver src/config/wildlife.config.js): pacífico (huye), territorial (avisa y carga), nocturno
// (sólo de noche y más esquivo).

const ARBOL = selector(
  secuencia(si((a) => a.muerto), hacer(() => RUN)),
  // Territorial: si te metes mucho, se te viene encima.
  secuencia(
    si((a) => a.nicho === 'territorial' && a.distancia < NICHOS.territorial.atacaA),
    hacer((a) => a.cargar()),
  ),
  // Pacífico y nocturno: huyen si te acercas.
  secuencia(
    si((a) => a.nicho !== 'territorial' && a.distancia < NICHOS[a.nicho].huyeA),
    hacer((a) => a.huir()),
  ),
  // Si ya se alejó bastante, vuelve a lo suyo.
  hacer((a) => a.deambular()),
);

// ¿El punto cae dentro de lo que ve la cámara? Se usa para no animar fauna que nadie está mirando.
const _frustum = new THREE.Frustum();
const _m = new THREE.Matrix4();
const _esfera = new THREE.Sphere();
function visibleEnCamara(camera, punto, radio) {
  _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_m);
  _esfera.set(punto, radio);
  return _frustum.intersectsSphere(_esfera);
}

// Alto del modelo tal como viene, para poder llevarlo a su tamaño real.
function alturaReal(scene) {
  const caja = new THREE.Box3();
  scene.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    o.geometry.computeBoundingBox();
    caja.union(o.geometry.boundingBox);
  });
  return caja.isEmpty() ? 0 : caja.max.y - caja.min.y;
}

export class Animal {
  constructor(game, especieId, x, z) {
    this.g = game;
    this.spec = ESPECIES[especieId];
    this.nicho = this.spec.nicho;
    this.id = especieId;

    this.object = new THREE.Group();
    game.scene.add(this.object);
    this.x = x; this.z = z;
    this.y = game.terrain.height(x, z);
    this.heading = Math.random() * Math.PI * 2;
    this.speed = 0;
    this.vida = this.spec.vida;
    this.muerto = false;
    this.distancia = Infinity;
    this.destino = null;
    this.descanso = Math.random() * 4;
    this.origen = { x, z };
    this.alarma = 0;
    this.volando = false;
    this.altura = 0;      // sobre el suelo, para los que vuelan
    this.grupo = null;    // manada o bandada a la que pertenece

    if (this.spec.procedural) {
      this.body = new AnimalBody(this.spec.procedural);
      this.object.add(this.body.object);
    } else {
      // Los animales de archivo traen su propio esqueleto y sus propios clips.
      loadCharacter(game.assets, { body: this.spec.model, ownClips: true }).then((src) => {
        if (!src || this.quitado) return;
        // Los modelos del paquete vienen a su propia escala (la vaca mide 5,15 unidades). En vez de un número
        // mágico por especie, se mide el modelo y se ajusta a la altura real declarada en la configuración.
        this.rig = new Rig(src, { scale: alturaReal(src.body) > 0 ? this.spec.altura / alturaReal(src.body) : 1, castShadow: true });
        this.object.add(this.rig.object);
        this.rig.play(this.spec.clips.idle, { fade: 0 });
      });
    }
  }

  get position() { return this; }

  // ───────────── Acciones del árbol ─────────────
  huir() {
    const p = this.g.playerSys.character;
    const n = NICHOS[this.nicho];
    this.heading = Math.atan2(-(this.x - p.x), -(this.z - p.z));   // de espaldas al jugador
    this.speed = n.velocidadHuida;
    this.destino = null;
    // Los pájaros no corren: levantan el vuelo y se van por encima de los árboles.
    if (this.spec.vuela) { this.volando = true; this.altura = Math.min(6, (this.altura || 0) + this.dt * 3.5); }
    // Una manada huye entera: basta con que uno se asuste.
    if (this.grupo) for (const o of this.grupo) if (o !== this && !o.muerto) o.alarma = 1.2;
    return RUN;
  }

  cargar() {
    const p = this.g.playerSys.character;
    this.heading = Math.atan2(-(p.x - this.x), -(p.z - this.z));
    this.speed = NICHOS.territorial.velocidadCarga;
    return RUN;
  }

  deambular() {
    // Un susto ajeno (otro de la manada) también hace correr.
    if (this.alarma > 0) { this.alarma -= this.dt; this.speed = NICHOS[this.nicho]?.velocidadHuida ?? 3; return RUN; }
    if (this.spec.vuela && this.volando) {
      // Vuelve a posarse cuando ya está lejos.
      this.altura = Math.max(0, this.altura - this.dt * 2);
      if (this.altura <= 0.01) this.volando = false;
    }
    if (this.descanso > 0) { this.speed = 0; return RUN; }
    if (!this.destino) {
      // En manada, el destino lo pone el grupo: así se mueven juntos sin negociar nada entre ellos.
      if (this.grupo && this.grupo.lider !== this) { this.#seguirAlGrupo(); return RUN; }
      // No se va lejos: los animales pastan alrededor de donde están.
      const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 14;
      this.destino = { x: this.origen.x + Math.cos(a) * r, z: this.origen.z + Math.sin(a) * r };
      if (this.grupo) for (const o of this.grupo) if (o !== this) o.destino = null;
    }
    const dx = this.destino.x - this.x, dz = this.destino.z - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.2) { this.destino = null; this.descanso = 2 + Math.random() * 6; this.speed = 0; return RUN; }
    const deseado = Math.atan2(-dx, -dz);
    let giro = deseado - this.heading;
    giro = Math.atan2(Math.sin(giro), Math.cos(giro));
    this.heading += giro * Math.min(1, this.dt * 2.5);
    this.speed = 1.1;
    return RUN;
  }

  // Seguir al que lleva la manada, sin pegarse a él.
  #seguirAlGrupo() {
    const l = this.grupo.lider;
    const dx = l.x - this.x, dz = l.z - this.z;
    const d = Math.hypot(dx, dz);
    if (d < MANADA.separacion) { this.speed = 0; return; }
    this.heading = Math.atan2(-dx, -dz);
    this.speed = Math.min(l.speed + 0.3, 2.2);
  }

  recibirGolpe(dano) {
    if (this.muerto) return;
    this.vida -= dano;
    if (this.vida <= 0) {
      this.muerto = true;
      this.speed = 0;
      if (this.rig && this.spec.clips.death) this.rig.play(this.spec.clips.death, { once: true });
    } else if (this.nicho !== 'territorial') {
      this.huir();
    }
  }

  // ───────────── Por frame ─────────────
  update(dt) {
    this.dt = dt;
    const p = this.g.playerSys.character;
    this.distancia = Math.hypot(p.x - this.x, p.z - this.z);
    this.descanso = Math.max(0, this.descanso - dt);

    if (!this.muerto) ARBOL(this);

    // Avance: nada de colisión fina, se apoya en el relieve real como todo lo demás.
    if (this.speed > 0.01) {
      this.x += -Math.sin(this.heading) * this.speed * dt;
      this.z += -Math.cos(this.heading) * this.speed * dt;
    }
    this.y = this.g.terrain.height(this.x, this.z) + (this.altura || 0);
    this.object.position.set(this.x, this.y, this.z);
    this.object.rotation.y = this.heading;

    // Sólo se anima lo que está a la vista: fuera de cámara el animal sigue moviéndose (es barato), pero no se
    // gasta nada en mezclar animaciones ni en mover sus piezas. Es lo que pedía el plan para la fauna.
    if (!visibleEnCamara(this.g.camera, this.object.position, 2)) { this.oculto = true; return; }
    this.oculto = false;

    const estado = { dt, speed: this.speed, muerto: this.muerto, volando: this.volando };
    if (this.body) this.body.apply(estado);
    else if (this.rig) {
      if (!this.muerto) {
        const c = this.spec.clips;
        this.rig.play(this.speed > 3 ? c.run : this.speed > 0.3 ? c.walk : c.idle, { fade: 0.2 });
      }
      this.rig.update(dt, this.g.camera.position.distanceTo(this.object.position));
    }
  }

  dispose() {
    this.quitado = true;
    this.rig?.dispose();
    this.body?.dispose();
    this.object.removeFromParent();
  }
}
