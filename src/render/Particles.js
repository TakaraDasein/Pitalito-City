import * as THREE from 'three';
import { PARTICLES, FAMILIAS, EMISIONES } from '../config/particles.config.js';

// Partículas simuladas en la GPU.
//
// La idea: **la CPU no mueve ninguna partícula**. Cada familia es un solo `InstancedMesh` con un buffer de
// atributos por instancia (posición de nacimiento, velocidad inicial, instante de nacimiento, semilla). El
// sombreador de vértices calcula dónde está cada partícula a partir del tiempo transcurrido:
//
//     p = origen + velocidad·t + ½·gravedad·t²     (con un frenado exponencial por el arrastre)
//
// Emitir cuesta escribir unos cuantos números en un buffer; dibujar cuesta **un draw call por familia**, pase lo
// que pase. Con esto 2.000 partículas no se notan ni en CPU ni en draw calls.
//
// Las partículas se orientan siempre a la cámara (billboard) en el propio vértice, así que tampoco hay que
// rotarlas desde JavaScript.

const VERT = /* glsl */`
  attribute vec3 aOrigen;
  attribute vec3 aVel;
  attribute vec2 aVida;        // x = instante de nacimiento, y = semilla
  uniform float uTiempo;
  uniform float uDuracion;
  uniform float uGravedad;
  uniform float uArrastre;
  uniform vec2  uTamano;       // [inicio, fin]
  uniform float uGiro;
  varying float vT;            // 0 → 1 a lo largo de la vida
  varying float vSemilla;
  varying vec2  vUv;

  void main() {
    float edad = uTiempo - aVida.x;
    vT = edad / uDuracion;
    vSemilla = aVida.y;
    vUv = uv;
    if (edad < 0.0 || vT > 1.0) {
      // Fuera de su vida: se manda detrás de la cámara en vez de dibujar nada.
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    // Integración analítica con frenado: no hace falta guardar estado entre fotogramas.
    float k = max(uArrastre, 0.0001);
    float f = (1.0 - exp(-k * edad)) / k;
    vec3 pos = aOrigen + aVel * f + vec3(0.0, 0.5 * uGravedad * edad * edad, 0.0);

    float tam = mix(uTamano.x, uTamano.y, vT);
    // Billboard: el quad se orienta a la cámara en el espacio de la vista.
    float ang = uGiro * edad + aVida.y * 6.2831;
    vec2 q = vec2(
      position.x * cos(ang) - position.y * sin(ang),
      position.x * sin(ang) + position.y * cos(ang)) * tam;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    mv.xy += q;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  precision mediump float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec2 uOpacidad;
  uniform float uParpadeo;
  varying float vT;
  varying float vSemilla;
  varying vec2  vUv;

  void main() {
    // Disco de bordes suaves, recortado del quad. Más barato que una textura y sin nada que descargar: sin esto
    // cada partícula se ve como un cuadrado blanco (pasó en la primera versión).
    float d = length(vUv - 0.5) * 2.0;
    float disco = smoothstep(1.0, 0.25, d);
    if (disco <= 0.0) discard;
    float alfa = mix(uOpacidad.x, uOpacidad.y, vT) * disco;
    if (uParpadeo > 0.5) {
      // Luciérnagas: encienden y apagan, y se desvanecen por los extremos de su vida.
      float ciclo = 0.5 + 0.5 * sin(vT * 28.0 + vSemilla * 12.0);
      alfa = ciclo * smoothstep(0.0, 0.15, vT) * (1.0 - smoothstep(0.75, 1.0, vT));
    }
    if (alfa <= 0.004) discard;
    gl_FragColor = vec4(mix(uColorA, uColorB, vT), alfa);
  }
`;

class Familia {
  constructor(nombre, def, escala) {
    this.def = def;
    this.max = Math.max(16, Math.round(def.max * escala));
    this.cursor = 0;

    // Un quad por partícula; el vértice lo convierte en billboard.
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index;
    geo.attributes.position = quad.attributes.position;
    geo.attributes.uv = quad.attributes.uv;
    geo.instanceCount = this.max;

    this.aOrigen = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3), 3);
    this.aVel = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3), 3);
    this.aVida = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 2), 2);
    // Nacidas "hace mucho": empiezan todas muertas.
    for (let i = 0; i < this.max; i++) this.aVida.array[i * 2] = -1e6;
    for (const [n, a] of [['aOrigen', this.aOrigen], ['aVel', this.aVel], ['aVida', this.aVida]]) {
      a.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(n, a);
    }

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: def.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uTiempo: { value: 0 },
        uDuracion: { value: def.vida },
        uGravedad: { value: def.gravedad },
        uArrastre: { value: def.arrastre },
        uTamano: { value: new THREE.Vector2(...def.tamano) },
        uGiro: { value: def.giro ?? 0 },
        uColorA: { value: new THREE.Color(def.color[0]) },
        uColorB: { value: new THREE.Color(def.color[1]) },
        uOpacidad: { value: new THREE.Vector2(...def.opacidad) },
        uParpadeo: { value: def.parpadeo ? 1 : 0 },
      },
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;   // las partículas se van lejos del origen del objeto
    this.mesh.renderOrder = 10;
    this.mesh.name = `particulas:${nombre}`;
  }

  // Escribe n partículas nuevas en el buffer circular. Esto es **todo** lo que hace la CPU.
  emitir(x, y, z, n, tiempo, { velocidad = 1, dispersion = 1, dirY = 1 } = {}) {
    for (let i = 0; i < n; i++) {
      const k = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * dispersion;
      this.aOrigen.array.set([x, y, z], k * 3);
      this.aVel.array.set([
        Math.cos(a) * r * velocidad,
        (0.4 + Math.random()) * velocidad * dirY,
        Math.sin(a) * r * velocidad,
      ], k * 3);
      this.aVida.array[k * 2] = tiempo;
      this.aVida.array[k * 2 + 1] = Math.random();
    }
    this.aOrigen.needsUpdate = this.aVel.needsUpdate = this.aVida.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.removeFromParent();
  }
}

export class ParticleSystem {
  constructor(scene, { calidad = 'alta' } = {}) {
    this.scene = scene;
    this.tiempo = 0;
    this.familias = new Map();
    this.applyQuality(calidad);
  }

  applyQuality(calidad) {
    const escala = PARTICLES.escalaPorCalidad[calidad] ?? 1;
    if (this.escala === escala) return;
    this.escala = escala;
    for (const f of this.familias.values()) f.dispose();
    this.familias.clear();
    if (!PARTICLES.enabled) return;
    for (const [nombre, def] of Object.entries(FAMILIAS)) {
      if (def.enabled === false) continue;
      const f = new Familia(nombre, def, escala);
      this.familias.set(nombre, f);
      this.scene.add(f.mesh);
    }
  }

  /** Emite una de las emisiones con nombre de `EMISIONES` (p. ej. 'golpeHueso'). */
  emitir(nombreEmision, x, y, z, factor = 1) {
    const e = EMISIONES[nombreEmision];
    if (!e) return;
    this.emitirEn(e.familia, x, y, z, Math.max(1, Math.round(e.n * factor)), e);
  }

  /** Emite directamente en una familia. */
  emitirEn(familia, x, y, z, n, opciones = {}) {
    const f = this.familias.get(familia);
    if (f) f.emitir(x, y, z, n, this.tiempo, opciones);
  }

  update(dt) {
    this.tiempo += dt;
    for (const f of this.familias.values()) f.material.uniforms.uTiempo.value = this.tiempo;
  }

  get drawCalls() { return this.familias.size; }
}
