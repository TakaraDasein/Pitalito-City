import * as THREE from 'three';
import { Rig, loadCharacter } from '../skinning/Rig.js';
import { AnimationGraph } from './AnimationGraph.js';
import { CHARACTERS, APPEARANCE, DEFAULT_LOOK } from '../../config/characters.config.js';
import { sombreroAguadeno } from './accessories.js';
import { weaponModel } from '../weapons/models.js';

// Cuerpo con esqueleto: el cuerpo base, la ropa, el pelo y los accesorios, más la máquina de animación.
// Misma interfaz que BoxBody (`object`, `apply(estado)`, `trigger(nombre)`), para que el personaje no sepa cuál
// de los dos lleva puesto.
//
// La apariencia es un objeto plano (ver DEFAULT_LOOK): complexión, pelo, barba, ropa, sombrero y colores. Se
// resuelve aquí en la lista de archivos que hay que cargar, y se puede volver a aplicar sin recrear el personaje.

const pick = (lista, id) => lista.find((x) => x.id === id) || lista[0];

// Traduce una apariencia a los archivos que hacen falta.
export function filesForLook(look = DEFAULT_LOOK) {
  const cuerpo = pick(APPEARANCE.cuerpo, look.cuerpo);
  const ropa = pick(APPEARANCE.ropa, look.ropa);
  const parts = ropa.partes.map((p) => `models/characters/outfits/${p.replace('{S}', cuerpo.ropa)}.gltf`);
  for (const key of ['pelo', 'barba']) {
    const item = pick(APPEARANCE[key], look[key]);
    if (item.file) parts.push(item.file);
  }
  return { body: cuerpo.file, parts };
}

export class RigBody {
  static async create(assets, { look = DEFAULT_LOOK, ...options } = {}) {
    if (!CHARACTERS.useRig) return null;
    const source = await loadCharacter(assets, filesForLook(look));
    return source ? new RigBody(source, { look, ...options }) : null;
  }

  constructor(source, { look = DEFAULT_LOOK, castShadow = true, clips = null } = {}) {
    this.look = look;
    const tint = tinter(look);
    this.rig = new Rig(source, { castShadow, materialFor: tint });
    this.graph = new AnimationGraph(this.rig, clips);
    this.object = this.rig.object;
    this.#hat();
  }

  // El sombrero aguadeño no viene en el paquete: se modela aparte y se cuelga del hueso de la cabeza.
  #hat() {
    if (this.hat) { this.hat.removeFromParent(); this.hat = null; }
    if (this.look.sombrero !== 'aguadeno') return;
    this.hat = sombreroAguadeno({ scale: 0.62 });
    // Medido en la pantalla de creación: con la pose de reposo, la coronilla queda 0,10 m sobre el hueso de la
    // cabeza. El ala se pone un poco más abajo, que es como se lleva.
    this.rig.attach('head', this.hat, { lift: CHARACTERS.hatLift });
  }

  // Pone o quita el arma en la mano derecha. `null` deja las manos libres.
  setWeapon(id) {
    if (this.weapon) { this.weapon.removeFromParent(); this.weapon = null; }
    const m = weaponModel(id);
    if (!m) return false;
    this.weapon = m;
    return this.rig.attach('handR', m, { upright: false });
  }

  apply(s) { this.graph.update(s); }

  // Postura añadida sobre la animación (ver Rig.setRetoque). `null` la quita.
  setRetoque(retoque, peso) { this.rig.setRetoque(retoque, peso); }

  setAlcances(alcances) { this.rig.setAlcances(alcances); }

  set retoquePeso(p) { this.rig.retoquePeso = p; }

  trigger(name, opts) { return this.graph.trigger(name, opts); }

  attach(bone, object3d) { return this.rig.attach(bone, object3d); }

  dispose() { this.rig.dispose(); }
}

// Aplica los colores elegidos a los materiales del paquete.
//
// El cuerpo base del paquete viene con una textura de traje de superhéroe (manchas blancas y rojas): no sirve como
// piel. Se le quita el color base y se deja un tono plano, conservando el mapa de normales para que el relieve del
// cuerpo siga leyéndose. El pelo se tiñe sobre su textura, que es en escala de grises. La ropa no se toca.
function tinter(look) {
  const piel = new THREE.Color(pick(APPEARANCE.piel, look.piel).color);
  const pelo = new THREE.Color(pick(APPEARANCE.pelocolor, look.pelocolor).color);
  // `uniforme` tiñe la ropa: lo usan las facciones para que su atuendo se lea como un uniforme (ver
  // src/config/factions.config.js). El jugador no lo lleva.
  const uniforme = look.uniforme ? new THREE.Color(look.uniforme) : null;
  const cache = new Map();
  return (material) => {
    const name = material?.name || '';
    const key = `${name}|${look.piel}|${look.pelocolor}|${look.uniforme || ''}`;
    if (cache.has(key)) return cache.get(key);
    const m = material.clone();
    if (/hair|beard|eyebrow/i.test(name)) {
      m.color.copy(pelo);
    } else if (/superhero|body|skin|hueso/i.test(name)) {
      m.color.copy(piel);
      m.map = null;               // fuera la textura del traje
      m.roughnessMap = null;
    } else if (uniforme && /peasant|ranger|regular|cloth/i.test(name)) {
      m.color.copy(uniforme);     // sólo la ropa: no las cuencas del cráneo ni los ojos
    }
    m.roughness = Math.max(0.55, m.roughness ?? 0.8);
    m.metalness = 0;
    cache.set(key, m);
    return m;
  };
}
