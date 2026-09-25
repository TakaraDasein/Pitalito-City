import { Game } from './core/Game.js';

const root = document.getElementById('app');
const bar = document.getElementById('loading-bar');
const text = document.getElementById('loading-text');

const game = new Game(root);
window.game = game; // acceso desde la consola para depurar

try {
  await game.init((p, msg) => {
    bar.style.width = `${Math.round(p * 100)}%`;
    if (msg) text.textContent = msg;
  });
  game.start();
  document.getElementById('loading').classList.add('done');
  game.showMainMenu();
} catch (err) {
  console.error(err);
  text.textContent = `Error al cargar: ${err.message}. ¿Corriste "npm run setup"?`;
}
