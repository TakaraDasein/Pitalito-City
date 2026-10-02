import * as THREE from 'three';
import { orientedFrame, frameGroup, worldUV } from './frame.js';

// Coliseo Cubierto de Pitalito.
//
// Referencias: assets/references/landmarks/coliseo/coliseo-cubierto-de-pitalito.jpg (Daalecura, CC BY-SA 4.0,
// interior) y landmarks/concha-acustica/concha-acustica-de-pitalito-huila-colombia.jpg (Jhysus, CC BY-SA 4.0),
// que lo muestra de lejos por fuera, porque los dos están a 140 m y salen en la misma foto. Lo que enseñan:
//  - volumen alargado de LADRILLO A LA VISTA con cubierta metálica a dos aguas de pendiente suave
//  - franja alta de ventanas corridas bajo el alero (el interior se ve iluminado desde arriba)
//  - galería de columnas en la fachada larga, con el forjado de un segundo nivel
//  - por dentro: GRADERÍAS DE CONCRETO EN HERRADURA alrededor de una cancha central de piso claro, con
//    barandales amarillos y tableros de baloncesto colgados de la estructura
//  - cerchas metálicas vistas bajo la cubierta
//
// Planta: polígono real de OSM (73 × 58 m). Altura estimada de las fotos (tres niveles de gradería + cubierta
// ≈ 14 m): el dato de GHSL daba 7 m, que es el promedio de su celda de 90 m.

export const ColiseoCubierto = {
  id: 'coliseo-cubierto',
  name: 'Coliseo Cubierto de Pitalito',
  available: (manifest) => !!manifest.landmarks.coliseo,
  exclusion: (manifest) => [manifest.landmarks.coliseo.p],

  build({ manifest, materials, collision, terrain }) {
    const lm = manifest.landmarks.coliseo;
    const f = orientedFrame(lm.p);
    const root = frameGroup(f);
    root.position.y = terrain.range(lm.p)[0] - 0.3;
    root.name = this.id;

    const ladrillo = materials.get('exposedBrick');
    const lamina = materials.get('roofSheet');
    const concreto = materials.get('concrete');
    const metal = materials.get('darkMetal');
    const vidrio = materials.get('glass');
    const amarillo = new THREE.MeshStandardMaterial({ color: '#e8b42a', roughness: 0.55 });
    const piso = new THREE.MeshStandardMaterial({ color: '#cbbfa6', roughness: 0.75 });

    const add = (parent, geo, mat, x, y, z, ry = 0) => {
      if (mat === ladrillo || mat === concreto) worldUV(geo);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.y = ry;
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    const U = f.halfU, V = f.halfV;          // media longitud y medio fondo reales
    const muro = 10.5;                        // alto del muro de ladrillo
    const cumbrera = 14.2;                    // alto de la cumbrera
    const t = 0.5;                            // espesor de muro

    // ── Muros de ladrillo: cuatro caras, dejando dentro la cancha ──────────────────────────────────────
    for (const [w, d, x, z] of [[U * 2, t, 0, -V], [U * 2, t, 0, V], [t, V * 2, -U, 0], [t, V * 2, U, 0]]) {
      add(root, new THREE.BoxGeometry(w, muro, d), ladrillo, x, muro / 2, z);
      // Franja alta de ventanas corridas, justo bajo el alero.
      add(root, new THREE.BoxGeometry(w * 0.96, 1.5, d * 0.5 || 0.25), vidrio, x, muro - 1.1, z);
    }

    // ── Cubierta a dos aguas, con alero ────────────────────────────────────────────────────────────────
    const vuelo = 1.6;
    for (const s of [-1, 1]) {
      const ancho = Math.hypot(V + vuelo, cumbrera - muro);
      const agua = add(root, new THREE.BoxGeometry(U * 2 + vuelo * 2, 0.3, ancho), lamina,
        0, (muro + cumbrera) / 2, s * (V + vuelo) / 2);
      agua.rotation.x = -s * Math.atan2(cumbrera - muro, V + vuelo);
    }
    add(root, new THREE.BoxGeometry(U * 2 + vuelo * 2, 0.5, 0.6), lamina, 0, cumbrera, 0);   // caballete
    // Cerchas metálicas vistas bajo la cubierta.
    for (let i = -3; i <= 3; i++) {
      add(root, new THREE.BoxGeometry(0.3, 0.3, V * 2), metal, (U * 2 / 7) * i, muro + 0.6, 0);
    }

    // ── Galería de columnas en la fachada larga ────────────────────────────────────────────────────────
    const galeria = -V - 3.2;
    for (let i = -5; i <= 5; i++) {
      add(root, new THREE.BoxGeometry(0.75, muro * 0.82, 0.75), concreto, (U * 2 / 11) * i, muro * 0.41, galeria);
    }
    add(root, new THREE.BoxGeometry(U * 2, 0.45, 3.4), concreto, 0, 4.4, galeria + 1.6);      // forjado del 2.º nivel
    add(root, new THREE.BoxGeometry(U * 2, 0.4, 3.4), concreto, 0, muro * 0.82, galeria + 1.6); // losa alta
    add(root, new THREE.BoxGeometry(U * 2, 0.9, 0.12), metal, 0, 5.1, galeria + 3.1);          // barandal

    // ── Interior: graderías en herradura y cancha ──────────────────────────────────────────────────────
    const piezas = 7;                         // escalones de la gradería
    const paso = 0.95, contrapaso = 0.55;
    for (const lado of [-1, 1]) {
      for (let i = 0; i < piezas; i++) {
        // Gradería larga (paralela a los muros de fondo)
        add(root, new THREE.BoxGeometry(U * 2 - t * 2, contrapaso, paso), concreto,
          0, contrapaso / 2 + i * contrapaso, lado * (V - t - paso / 2 - i * paso));
        // Gradería corta (en los extremos), más baja: así se lee la herradura
        if (i < 5) {
          add(root, new THREE.BoxGeometry(paso, contrapaso, V * 2 - t * 2 - piezas * paso * 2), concreto,
            lado * (U - t - paso / 2 - i * paso), contrapaso / 2 + i * contrapaso, 0);
        }
      }
      // Barandal amarillo al pie de la gradería, como en la foto.
      add(root, new THREE.BoxGeometry(U * 2 - t * 2, 0.1, 0.1), amarillo, 0, 1.0, lado * (V - t - piezas * paso));
    }
    const canchaU = U * 2 - t * 2 - piezas * paso * 2 - 1;
    const canchaV = V * 2 - t * 2 - piezas * paso * 2 - 1;
    add(root, new THREE.BoxGeometry(canchaU, 0.15, canchaV), piso, 0, 0.08, 0);
    // Tableros de baloncesto colgados de la estructura, en los dos extremos.
    for (const lado of [-1, 1]) {
      add(root, new THREE.BoxGeometry(1.8, 1.05, 0.1), materials.get('whitewash') || piso,
        lado * (canchaU / 2 - 1.2), 3.5, 0);
      add(root, new THREE.BoxGeometry(0.12, 2.4, 0.12), metal, lado * (canchaU / 2 - 1.2), 4.9, 0);
    }

    collision.addPolygon(this.id, lm.p);
    return root;
  },
};
