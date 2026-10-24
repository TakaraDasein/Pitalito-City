import * as THREE from 'three';

// Encoge la piel del cuerpo por debajo de la ropa.
//
// Por qué hace falta: el paquete gratuito trae cuerpos de complexión "Superhero" (musculosa) pero la ropa está
// cortada para la complexión "Regular", que sólo viene en la versión de pago. Resultado: el pecho, el abdomen y
// los muslos atraviesan la camisa y el pantalón. (Verificado en la iteración 02.)
//
// La solución estándar en personajes modulares es esconder la piel que la ropa tapa. Aquí se hace desplazando
// cada vértice hacia adentro por su normal, **pero sólo los que la ropa cubre**: se mira a qué hueso está pegado
// cada vértice y se dejan intactos la cabeza, el cuello y las manos, que son lo que sí se ve.
//
// Es una modificación de la malla en memoria; el archivo descargado no se toca.

// Huesos cuya piel queda a la vista y no se debe encoger nunca.
const VISIBLE = /^(head|neck_|hand_|index_|middle_|pinky_|ring_|thumb_)/i;

// Cuánto se mete cada zona, como fracción del ajuste base. El torso y los muslos son donde más sobra el cuerpo
// "Superhero" (pectorales y abdomen); los brazos y las pantorrillas van casi a ras, porque parte de esa piel se ve.
const ZONA = [
  [/^(pelvis|spine_)/i, 2.2],
  [/^thigh_/i, 1.8],
  [/^(upperarm_|clavicle_)/i, 1.0],
  [/^(lowerarm_|calf_|foot_|ball_)/i, 0.6],
];
const factor = (name) => (ZONA.find(([re]) => re.test(name)) || [null, 1])[1];

export function shrinkCoveredSkin(mesh, amount = 0.012) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const skinIndex = geo.attributes.skinIndex;
  const skinWeight = geo.attributes.skinWeight;
  if (!pos || !nor || !skinIndex || !skinWeight) return false;

  // La malla puede compartir su geometría con otras copias del mismo archivo: se trabaja sobre una propia.
  if (geo.userData.skinFitted) return true;
  const bones = mesh.skeleton.bones;

  const v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    // Hueso con más peso en este vértice: es el que decide si la zona va tapada o no.
    let best = 0, bestW = -1;
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(i, k);
      if (w > bestW) { bestW = w; best = skinIndex.getComponent(i, k); }
    }
    const name = bones[best]?.name || '';
    if (VISIBLE.test(name)) continue;
    v.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    v.addScaledVector(n, -amount * factor(name));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.userData.skinFitted = true;
  return true;
}
