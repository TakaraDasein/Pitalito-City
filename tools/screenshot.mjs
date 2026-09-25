// Verificación visual automática con Chromium sin pantalla (ver docs/VERIFICACION.md).
//
//   npm run dev                      # en otra terminal
//   npm run shot -- inicio '[{"wait":6000},{"shot":"calle"},{"press":"KeyC"},{"wait":3000},{"shot":"lejana"}]'
//   npm run shot -- menu '[{"wait":2000},{"shot":"principal"}]' --stay      # sin pulsar "Jugar"
//   npm run shot:vehicle -- taxi                                            # un vehículo desde 3 ángulos
//
// Acciones: {wait: ms} {press: 'KeyC'} {down/up: 'KeyW'} {click: 'selector'} {eval: 'código'} {shot: 'nombre'}
// Salida: screenshots/<nombre>-<shot>.png. Variables: CHROMIUM_PATH, BASE_URL (por defecto http://localhost:5173/).
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const args = process.argv.slice(2);
const stay = args.includes('--stay');
const vehicleMode = args[0] === '--vehicle';
const [name = 'shot', actionsJson = '[]'] = vehicleMode ? [args[1] || 'willys'] : args.filter((a) => !a.startsWith('--'));
const out = 'screenshots';
await mkdir(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(process.env.BASE_URL || 'http://localhost:5173/');
// #app no es "visible" para Playwright (sus hijos son position: fixed): esperar a que esté adjunto
await page.waitForSelector('#app[data-state="menu"]', { timeout: 180000, state: 'attached' });

if (vehicleMode) {
  for (const [i, angle] of [2.3, -0.7, 3.4].entries()) {
    await page.evaluate(([type, a]) => window.game.debugShowVehicle(type, a), [name, angle]);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/vehiculo-${name}-${i}.png` });
  }
} else {
  await page.waitForTimeout(1500);
  if (!stay) await page.keyboard.press('Enter');
  for (const a of JSON.parse(actionsJson)) {
    if (a.wait) await page.waitForTimeout(a.wait);
    if (a.down) await page.keyboard.down(a.down);
    if (a.up) await page.keyboard.up(a.up);
    if (a.press) await page.keyboard.press(a.press);
    if (a.click) await page.click(a.click);
    if (a.eval) logs.push('eval: ' + JSON.stringify(await page.evaluate(a.eval)));
    if (a.shot) await page.screenshot({ path: `${out}/${name}-${a.shot}.png` });
  }
}
console.log(logs.join('\n') || 'sin errores en consola');
await browser.close();
