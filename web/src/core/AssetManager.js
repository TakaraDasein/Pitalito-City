import * as THREE from 'three';

// Carga y cachea recursos. Todas las rutas son relativas a /public.
export class AssetManager {
  constructor(renderer) {
    this.base = import.meta.env.BASE_URL;
    this.textureLoader = new THREE.TextureLoader();
    this.maxAniso = renderer.capabilities.getMaxAnisotropy();
    this.cache = new Map();
    this.onProgress = () => {};
  }

  url(path) { return this.base + path.replace(/^\//, ''); }

  async json(path) {
    const res = await fetch(this.url(path));
    if (!res.ok) throw new Error(`No se pudo cargar ${path} (${res.status})`);
    return res.json();
  }

  async buffer(path) {
    const res = await fetch(this.url(path));
    if (!res.ok) throw new Error(`No se pudo cargar ${path} (${res.status})`);
    return res.arrayBuffer();
  }

  // Devuelve null si la textura no existe, para que los materiales usen su color de respaldo.
  texture(path, { srgb = true, repeat = true } = {}) {
    if (this.cache.has(path)) return this.cache.get(path);
    const promise = new Promise((resolve) => {
      this.textureLoader.load(this.url(path), (tex) => {
        if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
        if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = Math.min(8, this.maxAniso);
        resolve(tex);
      }, undefined, () => resolve(null));
    });
    this.cache.set(path, promise);
    return promise;
  }

  // Conjunto PBR: public/textures/<name>/{color,normal,roughness}.jpg
  async pbr(name) {
    const [map, normalMap, roughnessMap] = await Promise.all([
      this.texture(`textures/${name}/color.jpg`),
      this.texture(`textures/${name}/normal.jpg`, { srgb: false }),
      this.texture(`textures/${name}/roughness.jpg`, { srgb: false }),
    ]);
    return { map, normalMap, roughnessMap };
  }
}
