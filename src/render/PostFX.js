import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Gradación "Huila": calidez, saturación, contraste suave y viñeta. Va después del OutputPass (espacio sRGB).
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, warmth: { value: 0.5 }, saturation: { value: 1.08 },
    contrast: { value: 1.05 }, vignette: { value: 0.35 }, wet: { value: 0 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float warmth, saturation, contrast, vignette, wet;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, saturation - wet * 0.25);
      c *= mix(vec3(1.0), vec3(1.05, 1.0, 0.92), warmth);
      c = mix(c, c * vec3(0.92, 0.97, 1.04), wet);
      c = (c - 0.5) * contrast + 0.5;
      float d = distance(vUv, vec2(0.5));
      c *= 1.0 - vignette * smoothstep(0.42, 0.9, d);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

// Cadena de posprocesado configurable por preset de calidad. Con post = false se dibuja directo.
export class PostFX {
  constructor(renderer, scene, camera) {
    Object.assign(this, { renderer, scene, camera });
    this.composer = null;
    this.bloom = null;
  }

  configure(q) {
    this.composer?.dispose();
    this.composer = null; this.bloom = null; this.grade = null; this.ao = null;
    if (!q.post) return;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    // stencilBuffer: las calzadas usan stencil para no oscurecerse en los cruces
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType, samples: q.msaa, stencilBuffer: true, depthBuffer: true,
    });
    const c = (this.composer = new EffectComposer(this.renderer, target));
    c.addPass(new RenderPass(this.scene, this.camera));
    if (q.ao) {
      this.ao = new GTAOPass(this.scene, this.camera, size.x, size.y);
      this.ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1, scale: 1 });
      this.ao.blendIntensity = 0.8;
      c.addPass(this.ao);
    }
    if (q.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.3, 0.55, 4);
      c.addPass(this.bloom);
    }
    c.addPass(new OutputPass());
    if (q.grade) {
      this.grade = new ShaderPass(GradeShader);
      c.addPass(this.grade);
    }
  }

  // Noche: más brillo en luces; lluvia: tono más frío y apagado
  setAmbience(night, wet) {
    if (this.bloom) {
      this.bloom.threshold = THREE.MathUtils.lerp(6, 1.2, night);
      this.bloom.strength = THREE.MathUtils.lerp(0.18, 0.75, night);
    }
    if (this.grade) {
      this.grade.uniforms.warmth.value = 0.55 * (1 - night) * (1 - wet);
      this.grade.uniforms.wet.value = wet;
    }
  }

  setSize(w, h) { this.composer?.setSize(w, h); }

  render(dt) {
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }
}
