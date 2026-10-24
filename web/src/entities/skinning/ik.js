import * as THREE from 'three';

// Cinemática inversa de dos huesos (brazo o pierna), analítica: dados hombro, codo y mano, gira hombro y codo para
// que la mano llegue al objetivo, doblando el codo hacia el "polo". Sirve para que las manos agarren el manubrio
// y los pies se apoyen en los pedales aunque la animación del paquete sea la de ir sentado en un carro.
//
// Todo se calcula en espacio del mundo y se devuelve a espacio local de cada hueso. `peso` mezcla con la pose que
// traía la animación (0 = sin tocar, 1 = clavado al objetivo).

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _t = new THREE.Vector3(), _p = new THREE.Vector3(), _dir = new THREE.Vector3(), _n = new THREE.Vector3();
const _want = new THREE.Vector3(), _u = new THREE.Vector3(), _v = new THREE.Vector3();
const _q = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _orig = new THREE.Quaternion();

// Gira `bone` (en el mundo) lo justo para que la dirección `from` pase a ser `to`.
function aim(bone, from, to, peso) {
  _q.setFromUnitVectors(_u.copy(from).normalize(), _v.copy(to).normalize());
  bone.getWorldQuaternion(_wq);
  bone.parent.getWorldQuaternion(_pq);
  _orig.copy(bone.quaternion);
  bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq)));
  if (peso < 1) bone.quaternion.copy(_orig.slerp(bone.quaternion, peso));
  bone.updateMatrixWorld(true);
}

/**
 * @param {THREE.Bone[]} chain  [raíz, medio, punta] — p. ej. [upperarm_l, lowerarm_l, hand_l]
 * @param {THREE.Vector3} target  dónde debe quedar la punta, en el mundo
 * @param {THREE.Vector3} pole    punto del mundo hacia el que se dobla la articulación del medio
 */
export function solveTwoBone([root, mid, tip], target, pole, peso = 1) {
  if (peso <= 0) return;
  root.getWorldPosition(_a); mid.getWorldPosition(_b); tip.getWorldPosition(_c);
  const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
  _t.copy(target);
  _dir.subVectors(_t, _a);
  // Si el objetivo queda fuera de alcance, se estira casi del todo en vez de romperse.
  const d = THREE.MathUtils.clamp(_dir.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  _dir.normalize();
  // Dirección del doblez: la parte del polo perpendicular al eje hombro → objetivo.
  _n.subVectors(pole, _a);
  _n.addScaledVector(_dir, -_n.dot(_dir)).normalize();
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  _want.copy(_a).addScaledVector(_dir, l1 * cosA).addScaledVector(_n, l1 * sinA);
  aim(root, _p.subVectors(_b, _a), _u.subVectors(_want, _a).clone(), peso);
  mid.getWorldPosition(_b); tip.getWorldPosition(_c);
  aim(mid, _p.subVectors(_c, _b), _u.subVectors(_t, _b).clone(), peso);
}
