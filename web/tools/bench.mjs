// Medición de fps con la **GPU de verdad** (no SwiftShader), que es lo que tools/screenshot.mjs no puede hacer.
//
//   pnpm bench                 # todos los presets, todas las escenas
//   pnpm bench -- alta         # un preset
//
// Por qué un script aparte: screenshot.mjs fuerza `--use-angle=swiftshader` para que las capturas salgan iguales
// en cualquier máquina. Eso renderiza por software (≈0,5 fps con el personaje con esqueleto) y **no sirve para
// medir velocidad**. Aquí se hace lo contrario: se deja que Chromium use la tarjeta.
//
// Las cifras dependen de la máquina: el informe anota cuál. Variables: CHROMIUM_PATH, BASE_URL.
import { chromium } from 'playwright-core';
import { writeFile, mkdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';

const PRESETS = ['baja', 'media', 'alta', 'ultra'];
const SEGUNDOS = 6;            // cuánto se mide cada escena, ya estabilizada
const CALENTAMIENTO = 4;       // segundos que se descartan antes de medir

// Cada escena deja el juego en un estado y dice cómo llegar. `prepara` corre en la página.
const ESCENAS = [
  {
    id: 'centro-carro', nombre: 'Centro, conduciendo',
    prepara: () => { window.game.teleport(0, 0); },
  },
  {
    id: 'centro-pie', nombre: 'Centro, a pie',
    prepara: () => { const g = window.game; g.teleport(0, 0); g.playerSys.exitVehicle(); },
  },
  {
    id: 'combate', nombre: 'Combate con seis enemigos',
    prepara: () => {
      const g = window.game;
      g.playerSys.exitVehicle();
      g.playerSys.toggleArmed(true);
      g.playerSys.cycleWeapon(1);
      for (let i = 0; i < 6; i++) g.factions.debugSpawn(i % 2 ? 'machetero' : 'centinela', 10 + i * 3);
    },
  },
  {
    id: 'campo', nombre: 'Campo con fauna',
    prepara: () => {
      const g = window.game;
      g.playerSys.exitVehicle();
      g.playerSys.placeCharacter(1375, 625);
      for (let i = 0; i < 10; i++) {
        const a = i * 0.63;
        g.wildlife.spawn(i % 3 ? 'gallina' : 'bovino', g.playerSys.character.x + Math.cos(a) * 22, g.playerSys.character.z + Math.sin(a) * 22);
      }
    },
  },
  {
    id: 'noche-lluvia', nombre: 'Noche con lluvia',
    prepara: () => { const g = window.game; g.teleport(0, 0); g.env.setHour(21); g.weather.setMode('lluvia'); },
  },
];

const soloPreset = process.argv.slice(2).find((a) => PRESETS.includes(a));
const presets = soloPreset ? [soloPreset] : PRESETS;

function maquina() {
  const linea = (cmd, re) => { try { return (execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().match(re) || [])[1]?.trim(); } catch { return null; } };
  return {
    gpu: linea('lspci', /VGA compatible controller: (.+)/) || 'desconocida',
    cpu: linea('lscpu', /Model name:\s*(.+)/) || 'desconocida',
    so: linea('uname -sr', /(.+)/) || '',
  };
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  // Lo contrario de screenshot.mjs: nada de swiftshader, y se insiste en que use la tarjeta.
  args: [
    '--enable-gpu-rasterization', '--enable-zero-copy', '--ignore-gpu-blocklist',
    '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan',
    '--use-angle=vulkan', '--disable-frame-rate-limit', '--disable-gpu-vsync',
  ],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(process.env.BASE_URL || 'http://localhost:5173/');
await page.waitForSelector('#app[data-state="menu"]', { timeout: 180000, state: 'attached' });

// Qué renderizador tocó de verdad: si dice SwiftShader, la medida no vale.
const renderer = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  const d = gl?.getExtension('WEBGL_debug_renderer_info');
  return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : (gl ? gl.getParameter(gl.RENDERER) : 'sin webgl');
});
const porSoftware = /swiftshader|llvmpipe|software/i.test(renderer);
console.log(`Renderizador: ${renderer}${porSoftware ? '  ⚠ POR SOFTWARE: la medida no vale' : ''}\n`);

await page.keyboard.press('Enter');
await page.waitForTimeout(12000);   // carga del mundo y del personaje

const filas = [];
for (const preset of presets) {
  await page.evaluate((p) => window.game.settings.set('quality', p), preset);
  await page.waitForTimeout(2500);
  for (const esc of ESCENAS) {
    await page.evaluate(esc.prepara);
    await page.waitForTimeout(CALENTAMIENTO * 1000);
    // Se cuentan fotogramas reales con requestAnimationFrame durante la ventana de medida.
    const m = await page.evaluate(async (seg) => {
      const t0 = performance.now();
      let n = 0, peor = 0, anterior = t0;
      await new Promise((resolve) => {
        const paso = (t) => {
          const dt = t - anterior; anterior = t;
          if (n > 0) peor = Math.max(peor, dt);
          n++;
          if (t - t0 >= seg * 1000) resolve(); else requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
      });
      const r = window.game.renderer.info.render;
      return { fps: n / ((performance.now() - t0) / 1000), peorFrame: peor, calls: r.calls, tris: r.triangles };
    }, SEGUNDOS);
    filas.push({ preset, escena: esc.nombre, ...m });
    console.log(`${preset.padEnd(6)} ${esc.nombre.padEnd(28)} ${m.fps.toFixed(0).padStart(4)} fps  peor ${m.peorFrame.toFixed(0).padStart(4)} ms  ${String(m.calls).padStart(4)} calls  ${(m.tris / 1000).toFixed(0).padStart(5)} k tris`);
  }
}

await mkdir('docs', { recursive: true });
const info = maquina();
const md = `# Medición de fps en GPU real

> Generado por \`pnpm bench\` el ${new Date().toISOString().slice(0, 10)}. **Las cifras dependen de la máquina.**

- **GPU:** ${renderer}
- **Tarjetas del equipo:** ${info.gpu}
- **CPU:** ${info.cpu}
- **Sistema:** ${info.so} · ventana 1920×1080

| Preset | Escena | fps | Peor fotograma | Draw calls | Triángulos |
|---|---|---|---|---|---|
${filas.map((f) => `| ${f.preset} | ${f.escena} | **${f.fps.toFixed(0)}** | ${f.peorFrame.toFixed(0)} ms | ${f.calls} | ${f.tris.toLocaleString('es')} |`).join('\n')}
`;
await writeFile('docs/MEDICIONES.md', md);
console.log('\n→ docs/MEDICIONES.md');
await browser.close();
