import * as THREE from 'three';
import { solveTwoBone } from './ik.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CHARACTERS } from '../../config/characters.config.js';
import { shrinkCoveredSkin } from './skinFit.js';

// Esqueleto, animaciones y composición de personajes (jugador, peatones, fauna, facciones).
//
// Cómo está armado, y por qué:
//   · `animations.glb` trae **sólo** los 45 clips y el esqueleto de 65 huesos — ninguna malla.
//   · `base/*.gltf` trae los cuerpos y los peinados; `outfits/*.gltf`, las piezas de ropa (torso, brazos,
//     piernas, pies). Todas vienen con el **mismo esqueleto y los mismos nombres de hueso**.
//   · Un personaje se compone: un cuerpo + N piezas. Cada pieza se **reengancha al esqueleto del cuerpo**
//     (`rebind`), así una sola animación mueve a la vez la piel y la ropa.
//
// Los clips y los glTF descargados se cachean: se piden por red una sola vez aunque haya cien personajes.
// Licencias (CC0) y verificación en docs/ASSETS_3D.md.
//
// Convención del proyecto: el personaje mira hacia −Z como los vehículos; el modelo mira a +Z y se gira al montarlo.

const cache = new Map();
let clipsPromise = null;

function loadGltf(assets, file) {
  if (!cache.has(file)) {
    cache.set(file, new Promise((resolve) => {
      new GLTFLoader().load(assets.url(file), (g) => resolve(g), undefined, () => resolve(null));
    }));
  }
  return cache.get(file);
}

// Los clips del paquete animan también los huesos de punta de los dedos, que las mallas no tienen: three avisaría
// por cada uno. Se descartan una sola vez, al cargar.
function cleanClips(animations) {
  // Se descartan también las pistas del objeto raíz del esqueleto ("Rig.position"…): el juego mueve al personaje
  // por física, no por la animación, y three avisaría por cada una.
  const drop = /_(end|leaf)_[lr]\.|^(Rig|Armature|Mannequin)\./;
  return animations.map((clip) => {
    const tracks = clip.tracks.filter((t) => !drop.test(t.name));
    return tracks.length === clip.tracks.length ? clip : new THREE.AnimationClip(clip.name, clip.duration, tracks);
  });
}

export async function loadClips(assets) {
  if (!clipsPromise) {
    // Biblioteca principal + las complementarias (p. ej. los clips de zombi de la UAL2, mismo esqueleto). Si una
    // complementaria falta, el juego sigue con la principal.
    const files = [CHARACTERS.animations, ...(CHARACTERS.extraAnimations || [])];
    clipsPromise = Promise.all(files.map((f) => loadGltf(assets, f))).then(([main, ...extra]) => (main
      ? cleanClips([main, ...extra.filter(Boolean)].flatMap((g) => g.animations))
      : null));
  }
  return clipsPromise;
}

/**
 * Carga un cuerpo y sus piezas. Devuelve null si falta el archivo principal: el juego sigue con el respaldo.
 *
 * `ownClips` es para los modelos que **traen sus propias animaciones** y su propio esqueleto, como los animales
 * (ver src/config/wildlife.config.js): ahí no se usa la biblioteca compartida, sino los clips del propio archivo.
 */
export async function loadCharacter(assets, { body, parts = [], ownClips = false }) {
  const [shared, bodyGltf, ...partGltfs] = await Promise.all([
    ownClips ? null : loadClips(assets),
    loadGltf(assets, body),
    ...parts.map((p) => loadGltf(assets, p)),
  ]);
  if (!bodyGltf) return null;
  const clips = ownClips ? cleanClips(bodyGltf.animations || []) : shared;
  if (!clips) return null;
  return { clips, body: bodyGltf.scene, parts: partGltfs.filter(Boolean).map((g) => g.scene) };
}

// Vuelve a enganchar una malla con piel al esqueleto del cuerpo, emparejando los huesos por nombre.
// Es lo que permite que una camisa de un archivo se mueva con el esqueleto de un cuerpo de otro archivo.
//
// **Por qué cada prenda sigue siendo una malla aparte.** Se intentó unir las que comparten material para bajar
// draw calls (iteración 08): hay que renumerar los índices de hueso a un orden común y recortar los atributos al
// mínimo que todas comparten. Las dos cosas funcionan, pero la malla resultante sale deformada —las piezas de
// piel de la ropa acababan apelotonadas a la altura del cuello— y vestido a medias es peor que un draw call de
// más. Queda revertido y anotado; la vía buena es preparar las prendas ya fusionadas **en el pipeline**
// (scripts/), con el modelo en la mano, en vez de hacerlo en el navegador a ciegas.
function rebind(mesh, boneByName) {
  const bones = mesh.skeleton.bones.map((b) => boneByName.get(b.name) || b);
  mesh.bind(new THREE.Skeleton(bones, mesh.skeleton.boneInverses), mesh.bindMatrix);
}

const _q = new THREE.Quaternion(), _t = new THREE.Vector3(), _p = new THREE.Vector3();

export class Rig {
  // source: lo que devuelve loadCharacter(). materialFor: (material original, malla) => material, opcional.
  constructor(source, { materialFor = null, castShadow = true, scale = null } = {}) {
    this.object = new THREE.Group();

    // El giro va en un grupo intermedio para no tocar el heading del personaje.
    const turn = new THREE.Group();
    turn.rotation.y = Math.PI; // el modelo mira a +Z; el juego, a −Z
    this.object.add(turn);

    this.root = cloneSkinned(source.body);
    turn.add(this.root);

    this.bones = new Map();
    this.skinned = [];
    this.root.traverse((o) => { if (o.isBone) this.bones.set(o.name, o); });

    this.#prepare(this.root, materialFor, castShadow);

    // Con ropa puesta, la piel que queda debajo se encoge para que no atraviese la tela (ver skinFit.js).
    if (source.parts.length) for (const m of this.skinned) shrinkCoveredSkin(m, CHARACTERS.skinShrink);

    // Las piezas (ropa, pelo) se cuelgan del mismo grupo y se reenganchan al esqueleto del cuerpo.
    this.parts = [];
    for (const part of source.parts) this.addPart(part, { materialFor, castShadow });

    this.clips = new Map(source.clips.map((c) => [c.name, c]));
    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = new Map();
    this.current = null;
    this.timeSinceUpdate = 0;

    // `scale` permite que un animal use su propio tamaño en vez de la altura del personaje.
    this.object.scale.setScalar(scale ?? CHARACTERS.playerHeight / CHARACTERS.modelHeight);
  }

  // Añade una pieza ya cargada (una prenda, un peinado). Devuelve el objeto para poder quitarlo después.
  addPart(partScene, { materialFor = null, castShadow = true } = {}) {
    const obj = cloneSkinned(partScene);
    // La pieza trae su propio esqueleto de adorno: sólo interesan sus mallas.
    const meshes = [];
    obj.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
    for (const m of meshes) {
      rebind(m, this.bones);
      this.root.add(m);           // cuelga del mismo raíz que el cuerpo
    }
    this.#prepare({ traverse: (f) => meshes.forEach((m) => f(m)) }, materialFor, castShadow);
    this.parts.push(meshes);
    return meshes;
  }

  removePart(meshes) {
    for (const m of meshes) m.removeFromParent();
    this.parts = this.parts.filter((p) => p !== meshes);
  }

  #prepare(rootLike, materialFor, castShadow) {
    rootLike.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      o.castShadow = castShadow;
      o.receiveShadow = false;   // el personaje no recibe su propia sombra: se ve sucio y cuesta
      o.frustumCulled = false;   // con skinning la caja envolvente no sigue al hueso
      if (materialFor) o.material = materialFor(o.material, o);
      if (o.isSkinnedMesh) this.skinned.push(o);
    });
  }

  has(clipName) { return this.clips.has(clipName); }

  bone(key) { return this.bones.get(CHARACTERS.attachBones[key] || key) || null; }

  /**
   * Engancha un objeto a un hueso (sombrero a la cabeza, machete a la mano derecha).
   *
   * Los ejes locales de un hueso no apuntan "hacia arriba": cada esqueleto los orienta a su manera, y colocar el
   * accesorio con un desplazamiento en el eje Y del hueso lo manda a cualquier parte. Por eso `lift` (metros por
   * encima del origen del hueso) y `upright` se resuelven **en el espacio del personaje** y se convierten al del
   * hueso: así el mismo número vale para cualquier esqueleto.
   */
  attach(key, object3d, { lift = 0, upright = true } = {}) {
    const b = this.bone(key);
    if (!b) return false;
    b.updateWorldMatrix(true, false);
    this.object.updateWorldMatrix(true, false);

    const boneQuat = new THREE.Quaternion();
    const boneScale = new THREE.Vector3();
    b.matrixWorld.decompose(new THREE.Vector3(), boneQuat, boneScale);
    const inv = boneQuat.clone().invert();

    if (upright) {
      // Que el accesorio quede derecho respecto al personaje, no respecto al hueso.
      const rootQuat = new THREE.Quaternion();
      this.object.matrixWorld.decompose(new THREE.Vector3(), rootQuat, new THREE.Vector3());
      object3d.quaternion.copy(inv).multiply(rootQuat);
    }
    if (lift) {
      // "Arriba" del mundo, expresado en el espacio del hueso y descontando la escala del personaje.
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(inv).multiplyScalar(lift / (boneScale.y || 1));
      object3d.position.copy(up);
    }
    b.add(object3d);
    return true;
  }

  #action(name) {
    let a = this.actions.get(name);
    if (!a) {
      const clip = this.clips.get(name);
      if (!clip) return null;
      a = this.mixer.clipAction(clip);
      this.actions.set(name, a);
    }
    return a;
  }

  // Reproduce un clip mezclando desde el anterior. once: se reproduce una vez y se queda en el último fotograma.
  play(name, { fade = CHARACTERS.fade.default, once = false, timeScale = 1 } = {}) {
    const next = this.#action(name);
    if (!next || this.current === next) {
      if (next) next.timeScale = timeScale;
      return next;
    }
    next.reset();
    next.timeScale = timeScale;
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once;
    next.enabled = true;
    next.setEffectiveWeight(1);
    if (this.current) next.crossFadeFrom(this.current, fade, false);
    next.play();
    this.current = next;
    return next;
  }

  // Mezcla dos clips de locomoción por peso (caminar ↔ trotar ↔ correr sin saltos bruscos).
  blend(a, b, t, timeScale = 1) {
    const A = this.#action(a), B = this.#action(b);
    if (!A || !B) return;
    for (const [action, w] of [[A, 1 - t], [B, t]]) {
      action.enabled = true;
      action.setEffectiveWeight(w);
      action.timeScale = timeScale;
      if (!action.isRunning()) action.play();
    }
    // Sincroniza la fase para que los pies no patinen entre los dos clips.
    B.time = A.time % (B.getClip().duration || 1);
    for (const [name, action] of this.actions) {
      if (name !== a && name !== b && action.isRunning()) action.setEffectiveWeight(0);
    }
    this.current = t > 0.5 ? B : A;
  }

  // dt en segundos. distance: distancia a la cámara, para bajar la frecuencia de mezcla de lejos.
  update(dt, distance = 0) {
    const lod = CHARACTERS.animationLod.find((l) => distance < l.distance) || CHARACTERS.animationLod.at(-1);
    if (lod.hz === 0) { this.#deshacer(); this.mixer.update(dt); this.#retocar(); return; }
    this.timeSinceUpdate += dt;
    const step = 1 / lod.hz;
    if (this.timeSinceUpdate >= step) {
      this.#deshacer();
      this.mixer.update(this.timeSinceUpdate);
      this.timeSinceUpdate = 0;
      this.#retocar();
    }
  }

  /**
   * Retoque de pose encima de la animación: `{ hueso: [x, y, z] }` en radianes (giro local añadido) y un peso
   * 0–1. Sirve para posturas que el paquete no trae, como ir a horcajadas en la moto. `null` lo quita.
   * Se aplica justo después de mezclar y se deshace justo antes: un hueso que el clip no anima (la columna en
   * `Driving_Loop`) no se reescribe, y sin deshacer el giro se acumularía fotograma a fotograma.
   */
  setRetoque(retoque, peso = 1) {
    this.#deshacer();
    this.retoque = retoque
      ? Object.entries(retoque).map(([name, e]) => [this.bones.get(name), new THREE.Quaternion().setFromEuler(new THREE.Euler(...e)), new THREE.Quaternion()]).filter(([b]) => b)
      : null;
    this.retoquePeso = peso;
  }

  /**
   * Manos y pies clavados a puntos de otro objeto (manubrio, pedales), con cinemática inversa de dos huesos.
   * `alcances`: [{ huesos: ['upperarm_l', 'lowerarm_l', 'hand_l'], objetivo: Object3D, polo: Object3D }].
   */
  setAlcances(alcances) {
    this.alcances = alcances?.map((a) => ({ ...a, cadena: a.huesos.map((n) => this.bones.get(n)) })).filter((a) => a.cadena.every(Boolean)) || null;
  }

  #deshacer() {
    if (this.retoque) for (const [bone, , puesto] of this.retoque) { bone.quaternion.multiply(_q.copy(puesto).invert()); puesto.identity(); }
  }

  #retocar() {
    const peso = this.retoquePeso ?? 0;
    if (peso <= 0) return;
    if (this.retoque) for (const [bone, q, puesto] of this.retoque) bone.quaternion.multiply(puesto.identity().slerp(q, peso));
    if (!this.alcances?.length) return;
    this.object.updateWorldMatrix(true, true);
    for (const a of this.alcances) {
      solveTwoBone(a.cadena, a.objetivo.getWorldPosition(_t), a.polo.getWorldPosition(_p), peso);
    }
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.object.removeFromParent();
  }
}
