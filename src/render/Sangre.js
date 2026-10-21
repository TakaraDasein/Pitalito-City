import * as THREE from 'three';

// Manchas de sangre en el suelo donde cae un golpe que entra en carne. Un grupo fijo de discos (no se crean
// mallas nuevas en combate) que se reutilizan del más viejo al más nuevo y se desvanecen con el tiempo.
// Todas comparten geometría y el material `sangre` de MaterialLibrary; al final de su vida se encogen hasta
// desaparecer (no se toca la opacidad, que es del material compartido).
export class Sangre {
  constructor(scene, terrain, material, { max = 48, dura = 90 } = {}) {
    this.terrain = terrain;
    this.dura = dura;
    this.i = 0;
    const geo = new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2);
    this.manchas = Array.from({ length: max }, () => {
      const m = new THREE.Mesh(geo, material);
      m.visible = false;
      m.renderOrder = 6;
      m.userData.vida = 0;
      scene.add(m);
      return m;
    });
  }

  /** Una mancha en (x, z), de tamaño según la fuerza del golpe. */
  poner(x, z, fuerza = 1) {
    const m = this.manchas[this.i];
    this.i = (this.i + 1) % this.manchas.length;
    const r = (0.18 + Math.random() * 0.25) * Math.min(1.8, fuerza + 0.3);
    const px = x + (Math.random() - 0.5) * 0.6, pz = z + (Math.random() - 0.5) * 0.6;
    m.position.set(px, this.terrain.height(px, pz) + 0.03, pz);
    m.scale.set(r, 1, r * (0.6 + Math.random() * 0.6));
    m.userData.escala = m.scale.clone();
    m.rotation.y = Math.random() * Math.PI;
    m.userData.vida = this.dura;
    m.visible = true;
  }

  update(dt) {
    for (const m of this.manchas) {
      if (!m.visible) continue;
      m.userData.vida -= dt;
      if (m.userData.vida <= 0) { m.visible = false; continue; }
      const k = Math.min(1, m.userData.vida / 15);
      m.scale.set(m.userData.escala.x * k, 1, m.userData.escala.z * k);
    }
  }
}
