import * as THREE from 'three';
import { orientedFrame, frameGroup, worldUV } from './frame.js';

// Alcaldía Municipal — Centro Administrativo Municipal «La Chapolera».
//
// Referencias: assets/references/landmarks/alcaldia/centro-administrativo-municipal-la-chapolera.jpg
// (Darwin A. Rivera, CC BY-SA 4.0) y alcaldia-de-pitalito.jpg (Criango92, dominio público). Lo que muestran:
//  - un MURO CORTINA DE VIDRIO INCLINADO que domina toda la fachada principal, oscuro y reflectante, dividido en
//    una retícula de montantes horizontales y verticales, que sube en pendiente hacia un extremo
//  - un volumen de PIEDRA OSCURA (pizarra en placas) al otro lado, con el escudo del municipio y el letrero
//    «CENTRO ADMINISTRATIVO MUNICIPAL / LA CHAPOLERA» en relieve
//  - sobre ese volumen, un cuerpo claro retranqueado con antepecho y barandal
//  - tres astas con bandera (Colombia, Huila, Pitalito) sobre el volumen oscuro
//  - acceso bajo, con escalinata y barandales metálicos, y una terraza con mesas al pie del vidrio
//  - en la plaza, la ESTATUA DE BRONCE DE LA CHAPOLERA: mujer de pie con canasto de flores en un brazo y un
//    ramo en alto en el otro, sobre pedestal de piedra oscura
//
// Planta: polígono real de OSM (56 × 57 m). Alturas estimadas de las fotos (tres niveles ≈ 12 m): el dato de
// GHSL daba 7 m, que es el promedio de su celda de 90 m y no sirve para un edificio concreto.
// La estatua se modela a mano; su forma es estimada (declarado en DATOS.md).

export const AlcaldiaChapolera = {
  id: 'alcaldia-chapolera',
  name: 'Alcaldía Municipal La Chapolera',
  available: (manifest) => !!manifest.landmarks.alcaldia,
  exclusion: (manifest) => [manifest.landmarks.alcaldia.p],

  build({ manifest, materials, collision, terrain }) {
    const lm = manifest.landmarks.alcaldia;
    const f = orientedFrame(lm.p);
    const root = frameGroup(f);
    root.position.y = terrain.range(lm.p)[0] - 0.2;
    root.name = this.id;

    // Hacia dónde mira la fachada. El marco orientado no sabe cuál es el frente, así que se decide por el lado
    // que da al centro: la plaza del acceso está hacia el Parque Principal.
    const centro = manifest.landmarks.parquePrincipal?.c || [0, 0];
    const haciaCentro = (centro[0] - lm.c[0]) * f.vx + (centro[1] - lm.c[1]) * f.vz;
    const S = haciaCentro >= 0 ? 1 : -1;      // +1 si el frente es +v, −1 si es −v

    // Piedra oscura en placas: el `concreteDark` del juego es demasiado claro para esta fachada.
    const piedra = new THREE.MeshStandardMaterial({ color: '#3a332c', roughness: 0.68, metalness: 0.12 });
    const vidrio = materials.get('glass');
    const claro = materials.get('whitewash');
    const metal = materials.get('darkMetal');
    const concreto = materials.get('concrete');

    const add = (parent, geo, mat, x, y, z, ry = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.y = ry;
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    // El edificio no llena toda la manzana: deja la plaza del acceso por delante.
    const U = f.halfU, V = f.halfV;
    const largo = U * 1.5, fondo = V * 0.78, alto = 11.6;
    const frenteZ = S * V * 0.2;        // cara principal, hacia la plaza

    // ── Cuerpo principal, con el muro cortina inclinado en su cara frontal ──────────────────────────────
    const cuerpo = new THREE.Group();
    cuerpo.position.set(largo * 0.12, 0, 0);
    root.add(cuerpo);

    // Caja opaca del edificio, detrás: el muro cortina es la cara que se ve desde la plaza.
    add(cuerpo, new THREE.BoxGeometry(largo, alto, fondo), piedra, 0, alto / 2, frenteZ + S * (fondo / 2 + 1.2));

    // Muro cortina: un plano inclinado hacia atrás, en pendiente. El vidrio sube y se aleja de la plaza.
    const inclinacion = 0.3;                        // el vidrio se echa hacia atrás al subir
    const altoVidrio = alto + 2.6;
    const anchoVidrio = largo * 0.98;
    const muro = add(cuerpo, new THREE.BoxGeometry(anchoVidrio, altoVidrio, 0.3), vidrio, 0, altoVidrio / 2, frenteZ);
    muro.rotation.x = S * inclinacion;
    muro.position.z = frenteZ + S * Math.sin(inclinacion) * altoVidrio * 0.5;

    // Retícula de montantes: lo que hace que se lea como muro cortina y no como una lámina.
    const reticula = new THREE.Group();
    reticula.rotation.x = S * inclinacion;
    reticula.position.copy(muro.position);
    cuerpo.add(reticula);
    for (let i = 1; i < 8; i++) {
      add(reticula, new THREE.BoxGeometry(anchoVidrio, 0.15, 0.16), metal, 0, -altoVidrio / 2 + (altoVidrio / 8) * i, -S * 0.2);
    }
    for (let i = -6; i <= 6; i++) {
      add(reticula, new THREE.BoxGeometry(0.13, altoVidrio, 0.16), metal, (anchoVidrio / 13) * i, 0, -S * 0.2);
    }

    // ── Volumen de piedra con el letrero, al extremo opuesto ───────────────────────────────────────────
    const anchoLetrero = largo * 0.42;
    const bloque = new THREE.Group();
    bloque.position.set(-largo * 0.66, 0, frenteZ);
    root.add(bloque);
    add(bloque, new THREE.BoxGeometry(anchoLetrero, 8.4, fondo * 0.8), piedra, 0, 4.2, S * fondo * 0.4);
    // Cuerpo claro retranqueado encima, con antepecho
    add(bloque, new THREE.BoxGeometry(anchoLetrero * 0.9, 3.4, fondo * 0.66), claro, 0, 10.1, S * fondo * 0.46);
    add(bloque, new THREE.BoxGeometry(anchoLetrero * 0.92, 0.9, 0.18), metal, 0, 9.0, S * fondo * 0.14);
    // Placa del letrero y escudo (el texto no se modela: a escala de juego no se leería)
    add(bloque, new THREE.BoxGeometry(anchoLetrero * 0.6, 1.5, 0.12), metal, 0, 5.4, -S * 0.07);
    add(bloque, new THREE.BoxGeometry(2.1, 2.1, 0.1), metal, 0, 7.4, -S * 0.06);

    // Tres astas de bandera sobre el volumen oscuro.
    for (let i = -1; i <= 1; i++) {
      const asta = add(bloque, new THREE.CylinderGeometry(0.07, 0.07, 6, 8), metal, i * 1.9, 11.4, S * fondo * 0.12);
      const tela = add(bloque, new THREE.BoxGeometry(1.5, 0.95, 0.05), i === 0 ? claro : materials.get('trimRed') || claro,
        i * 1.9 + 0.78, 13.3, S * fondo * 0.12);
      tela.castShadow = false;
      asta.castShadow = false;
    }

    // ── Acceso: plataforma, escalinata y barandales ────────────────────────────────────────────────────
    const plataforma = add(root, new THREE.BoxGeometry(largo * 0.9, 0.9, 7), concreto, -largo * 0.1, 0.45, frenteZ - S * 4.6);
    worldUV(plataforma.geometry);
    for (let i = 0; i < 4; i++) {
      add(root, new THREE.BoxGeometry(largo * 0.34, 0.22, 0.5), concreto, -largo * 0.52, 0.11 + i * 0.22, frenteZ - S * (8.3 - i * 0.5));
    }
    for (const lado of [-1, 1]) {
      add(root, new THREE.BoxGeometry(0.1, 1.05, 7), metal, -largo * 0.1 + lado * largo * 0.44, 1.4, frenteZ - S * 4.6);
    }

    // ── La chapolera: estatua de bronce sobre pedestal, en la plaza ────────────────────────────────────
    const estatua = new THREE.Group();
    estatua.position.set(-largo * 0.05, 0, frenteZ - S * 13);
    estatua.rotation.y = S > 0 ? Math.PI : 0;
    root.add(estatua);
    const bronce = new THREE.MeshStandardMaterial({ color: '#6b4a2a', roughness: 0.45, metalness: 0.65 });
    add(estatua, new THREE.BoxGeometry(1.5, 1.5, 1.5), piedra, 0, 0.75, 0);
    // Cuerpo: falda larga y torso. Es una silueta reconocible, no un retrato.
    add(estatua, new THREE.CylinderGeometry(0.3, 0.55, 1.5, 12), bronce, 0, 2.25, 0);
    add(estatua, new THREE.CylinderGeometry(0.26, 0.3, 0.75, 12), bronce, 0, 3.35, 0);
    add(estatua, new THREE.SphereGeometry(0.21, 12, 10), bronce, 0, 3.9, 0);
    // Brazo en alto con el ramo, y el otro sosteniendo el canasto contra la cadera.
    const brazoAlto = add(estatua, new THREE.CylinderGeometry(0.075, 0.075, 1.1, 8), bronce, -0.36, 3.6, 0.04);
    brazoAlto.rotation.z = 0.5;
    add(estatua, new THREE.SphereGeometry(0.26, 10, 8), bronce, -0.68, 4.2, 0.04);        // ramo
    const brazoCanasto = add(estatua, new THREE.CylinderGeometry(0.075, 0.075, 0.9, 8), bronce, 0.33, 3.25, 0.06);
    brazoCanasto.rotation.z = -0.25;
    add(estatua, new THREE.CylinderGeometry(0.34, 0.26, 0.42, 12), bronce, 0.52, 2.75, 0.06);  // canasto

    // ── Colisión: el edificio, el pedestal y el barandal ───────────────────────────────────────────────
    collision.addPolygon(this.id, lm.p);
    const [ex, ez] = f.toWorld(-largo * 0.05, frenteZ - S * 13);
    collision.addCircle(this.id, ex, ez, 1.1);

    return root;
  },
};
