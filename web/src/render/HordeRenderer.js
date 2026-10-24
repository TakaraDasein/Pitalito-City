import * as THREE from 'three';

// Dibuja muchos personajes lejanos de un mismo tipo con el atlas de ImpostorAtlas: un InstancedMesh de planos que
// giran sobre su eje vertical para mirar a la cámara (como un cartel) y eligen en el atlas la celda del ángulo
// desde el que se les ve y del instante de su paso. **Una llamada de dibujo por tipo**, sea cual sea el número.
//
// Cada instancia lleva: posición del suelo + rumbo (aData) y fase del paso + velocidad del ciclo + escala (aAnim).
// Recibe la niebla de la escena para fundirse con lo demás; no proyecta sombra (de lejos no se distingue).

const VERT = /* glsl */`
  attribute vec4 aData;   // x, y, z del suelo · rumbo
  attribute vec3 aAnim;   // fase 0–1 · ciclos por segundo · escala
  uniform float uTime;
  uniform vec2 uGrid;     // instantes, ángulos
  uniform vec2 uSize;     // ancho, alto en metros
  varying vec2 vUv;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vec3 base = aData.xyz;
    float h = aData.w;
    vec3 v = cameraPosition - base;
    vec2 dir = normalize(v.xz + 1e-5);
    // Cartel cilíndrico: el plano queda de frente a la cámara pero siempre vertical.
    vec3 derecha = vec3(dir.y, 0.0, -dir.x);
    vec3 p = base + derecha * position.x * uSize.x * aAnim.z + vec3(0.0, 1.0, 0.0) * position.y * uSize.y * aAnim.z;
    // Ángulo de la cámara en el espacio del personaje → celda del atlas (ver la convención en ImpostorAtlas).
    float lx = v.x * cos(h) - v.z * sin(h);
    float lz = v.x * sin(h) + v.z * cos(h);
    float theta = atan(lx, lz);
    float paso = 6.28318530718 / uGrid.y;
    float d = mod(floor(-theta / paso + 0.5), uGrid.y);
    float f = floor(fract(uTime * aAnim.y + aAnim.x) * uGrid.x);
    // El plano va de x = −0,5…0,5 y de y = 0…1.
    vec2 uvCelda = vec2(position.x + 0.5, position.y);
    vUv = (vec2(f, d) + uvCelda) / uGrid;
    vec4 mvPosition = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAG = /* glsl */`
  uniform sampler2D uAtlas;
  uniform float uBrillo;
  varying vec2 vUv;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    vec4 c = texture2D(uAtlas, vUv);
    if (c.a < 0.5) discard;
    gl_FragColor = vec4(c.rgb * uBrillo, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export class HordeRenderer {
  constructor(atlas, max) {
    this.max = max;
    this.atlas = atlas;
    const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const inst = new THREE.InstancedBufferGeometry().copy(geo);
    inst.instanceCount = 0;
    this.data = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.anim = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    inst.setAttribute('aData', this.data);
    inst.setAttribute('aAnim', this.anim);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uTime: { value: 0 }, uGrid: { value: new THREE.Vector2(atlas.frames, atlas.dirs) },
        uSize: { value: new THREE.Vector2(atlas.ancho, atlas.alto) }, uAtlas: { value: null }, uBrillo: { value: 1 },
      }]),
    });
    this.material.uniforms.uAtlas.value = atlas.texture;
    this.mesh = new THREE.Mesh(inst, this.material);
    this.mesh.frustumCulled = false;     // las instancias están repartidas por el mapa: el recorte va por distancia
    this.mesh.name = 'horda';
    this.geometry = inst;
  }

  /** `lista`: [{ x, y, z, heading, fase, ritmo, escala }]. */
  set(lista, tiempo, brillo = 1) {
    const n = Math.min(lista.length, this.max);
    const d = this.data.array, a = this.anim.array;
    for (let i = 0; i < n; i++) {
      const z = lista[i];
      d[i * 4] = z.x; d[i * 4 + 1] = z.y; d[i * 4 + 2] = z.z; d[i * 4 + 3] = z.heading;
      a[i * 3] = z.fase; a[i * 3 + 1] = z.ritmo; a[i * 3 + 2] = z.escala;
    }
    this.geometry.instanceCount = n;
    this.data.needsUpdate = true;
    this.anim.needsUpdate = true;
    this.material.uniforms.uTime.value = tiempo;
    this.material.uniforms.uBrillo.value = brillo;
    this.mesh.visible = n > 0;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.atlas.target.dispose();
  }
}
