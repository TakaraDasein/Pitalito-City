import * as THREE from 'three';

// Atlas de impostores: fotografía un personaje animado desde `dirs` ángulos en `frames` instantes de un clip y lo
// guarda en una sola textura. Con eso, un personaje lejano se dibuja como un plano que mira a la cámara y elige la
// celda del ángulo y del instante que tocan (ver HordeRenderer).
//
// Es lo que permite una horda: un zombi completo son ≈ 28 000 triángulos y una llamada de dibujo por prenda; un
// impostor son 2 triángulos y todos los de un tipo comparten **una** llamada. De lejos, con niebla, no se nota.
//
// Se hace una vez al cargar, en el navegador, con el mismo cuerpo, ropa y clip que el zombi de cerca: así el de
// lejos y el de cerca son el mismo, y no hace falta un paso más en el pipeline.
//
// Celdas: x = instante (0…frames−1), y = ángulo (0…dirs−1). Ángulo d = el personaje girado d·2π/dirs, visto desde
// +Z (de frente cuando d·2π/dirs = π: el personaje mira a −Z).

export function bakeImpostor(renderer, rig, clipName, { frames = 8, dirs = 8, cell = [96, 192], alto = 2.0, ancho = 1.0 } = {}) {
  const [cw, ch] = cell;
  const target = new THREE.WebGLRenderTarget(cw * frames, ch * dirs, { samples: 0 });
  target.texture.generateMipmaps = true;
  target.texture.minFilter = THREE.LinearMipmapLinearFilter;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#e8eef5', '#6a6052', 3.2));
  const sol = new THREE.DirectionalLight('#fff4e0', 3.4);
  sol.position.set(2, 4, 5);
  scene.add(sol);
  const objeto = rig.object;
  const padre = objeto.parent;
  scene.add(objeto);

  const cam = new THREE.OrthographicCamera(-ancho / 2, ancho / 2, alto, 0, 0.1, 20);
  cam.position.set(0, 0, 5);
  cam.lookAt(0, 0, 0);
  cam.position.y = 0;

  const clip = rig.clips.get(clipName);
  const accion = clip ? rig.mixer.clipAction(clip) : null;
  rig.mixer.stopAllAction();
  accion?.reset().play();

  const prev = {
    target: renderer.getRenderTarget(), clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(),
    autoClear: renderer.autoClear, sombras: renderer.shadowMap.enabled,
  };
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.autoClear = false;
  renderer.shadowMap.enabled = false;
  const giro0 = objeto.rotation.y;
  for (let f = 0; f < frames; f++) {
    if (accion) { accion.time = (f / frames) * clip.duration; rig.mixer.update(0); }
    for (let d = 0; d < dirs; d++) {
      objeto.rotation.y = (d / dirs) * Math.PI * 2;
      objeto.updateMatrixWorld(true);
      target.viewport.set(f * cw, d * ch, cw, ch);
      target.scissor.set(f * cw, d * ch, cw, ch);
      target.scissorTest = true;
      renderer.setRenderTarget(target);
      renderer.render(scene, cam);
    }
  }
  target.scissorTest = false;
  target.viewport.set(0, 0, cw * frames, ch * dirs);
  renderer.setRenderTarget(prev.target);
  renderer.setClearColor(prev.clear, prev.alpha);
  renderer.autoClear = prev.autoClear;
  renderer.shadowMap.enabled = prev.sombras;

  objeto.rotation.y = giro0;
  if (padre) padre.add(objeto); else scene.remove(objeto);
  accion?.stop();
  return { texture: target.texture, target, frames, dirs, alto, ancho, duracion: clip?.duration || 1 };
}
