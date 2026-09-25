import * as THREE from 'three';
import { rng } from '../geo/geometry.js';

// Texturas generadas en canvas, inspiradas en assets/references.
// Se generan en tiempo de carga para no depender de archivos binarios adicionales.

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function plasterNoise(ctx, w, h, rand, base = 238) {
  ctx.fillStyle = `rgb(${base},${base},${base})`;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < w * h * 0.02; i++) {
    const v = base - 12 + rand() * 20;
    ctx.fillStyle = `rgba(${v},${v},${v - 4},0.35)`;
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1 + rand() * 3);
  }
}

// Fachada de pisos superiores: atlas 4×4 bahías (cada bahía = 3.2 m × 3 m).
// Devuelve { map, emissiveMap } — el emissive tiene ventanas encendidas al azar para la noche.
export function facadeUpper() {
  const S = 1024, B = S / 4;
  const [c, ctx] = canvas(S, S);
  const [e, ectx] = canvas(S, S);
  const rand = rng(42);
  plasterNoise(ctx, S, S, rand);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, S, S);

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x0 = col * B, y0 = row * B;
      const style = Math.floor(rand() * 4);
      // Cornisa / franja de entrepiso
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(x0, y0 + B - 10, B, 10);
      const ww = style === 2 ? B * 0.62 : B * 0.44;
      const wh = style === 3 ? B * 0.62 : B * 0.46;
      const wx = x0 + (B - ww) / 2, wy = y0 + B * 0.2;
      // Marco
      ctx.fillStyle = style === 1 ? '#7b4b2a' : '#e8e4dc';
      ctx.fillRect(wx - 7, wy - 7, ww + 14, wh + 14);
      // Vidrio con reflejo del cielo
      const g = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
      g.addColorStop(0, '#5d7892'); g.addColorStop(0.5, '#2d3e52'); g.addColorStop(1, '#1b2633');
      ctx.fillStyle = g;
      ctx.fillRect(wx, wy, ww, wh);
      // Divisiones del marco
      ctx.fillStyle = style === 1 ? '#7b4b2a' : '#d9d4ca';
      ctx.fillRect(wx + ww / 2 - 3, wy, 6, wh);
      if (style !== 2) ctx.fillRect(wx, wy + wh * 0.35, ww, 5);
      // Rejas (muy comunes en Pitalito)
      if (style === 0 || style === 3) {
        ctx.fillStyle = 'rgba(30,30,30,0.85)';
        for (let i = 1; i < 6; i++) ctx.fillRect(wx + (ww * i) / 6 - 1.5, wy, 3, wh);
      }
      // Balcón con baranda
      if (style === 3) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(wx - 16, wy + wh + 6, ww + 32, 8);
        ctx.fillStyle = '#2b2b2b';
        for (let i = 0; i <= 10; i++) ctx.fillRect(wx - 14 + ((ww + 28) * i) / 10, wy + wh - 30, 3, 36);
        ctx.fillRect(wx - 16, wy + wh - 32, ww + 32, 4);
      }
      // Alféizar
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(wx - 10, wy + wh + 7, ww + 20, 5);
      // Ventana encendida (noche)
      if (rand() < 0.4) {
        const warm = rand() < 0.75;
        ectx.fillStyle = warm ? '#ffcf7a' : '#bfe3ff';
        ectx.globalAlpha = 0.55 + rand() * 0.45;
        ectx.fillRect(wx, wy, ww, wh);
        ectx.globalAlpha = 1;
      }
    }
  }
  return { map: toTexture(c), emissiveMap: toTexture(e) };
}

// Primer piso: 8 bahías de 3,2 m × 3,2 m — tiendas con aviso pintado, portones, puertas y ventanas con reja.
const SIGNS = [
  ['TIENDA', '#c1121f'], ['DROGUERÍA', '#1d6fb8'], ['FERRETERÍA', '#e07a1f'], ['PANADERÍA', '#8a4b1f'],
  ['MISCELÁNEA', '#6a2c91'], ['CAFÉ', '#3b2412'], ['CACHARRERÍA', '#0f7b5f'], ['ASADERO', '#b3261e'],
];
export function facadeGround() {
  const N = 8, W = 256 * N, H = 256, B = 256;
  const [c, ctx] = canvas(W, H);
  const [e, ectx] = canvas(W, H);
  const rand = rng(7);
  plasterNoise(ctx, W, H, rand);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, W, H);
  const kinds = ['shop', 'door', 'shop', 'gate', 'window', 'shop', 'door', 'shop'];
  kinds.forEach((kind, col) => {
    const x0 = col * B;
    if (kind === 'shop') {
      const [name, color] = SIGNS[(col * 3 + 1) % SIGNS.length];
      // aviso pintado sobre el vano
      ctx.fillStyle = color; ctx.fillRect(x0 + 10, 10, B - 20, 36);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 24px "Arial Narrow", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(name, x0 + B / 2, 29);
      ectx.fillStyle = color; ectx.globalAlpha = 0.5; ectx.fillRect(x0 + 10, 10, B - 20, 36); ectx.globalAlpha = 1;
      // persiana metálica a medio subir + vitrina con estanterías
      const sx = x0 + 18, sw = B - 36, sy = 54;
      ctx.fillStyle = '#9aa3aa'; ctx.fillRect(sx, sy, sw, 50);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = sy; y < sy + 50; y += 6) ctx.fillRect(sx, y, sw, 2);
      const vg = ctx.createLinearGradient(sx, sy + 50, sx + sw, H - 22);
      vg.addColorStop(0, '#4a565f'); vg.addColorStop(1, '#232a30');
      ctx.fillStyle = vg; ctx.fillRect(sx, sy + 50, sw, H - sy - 72);
      for (let y = sy + 80; y < H - 30; y += 30) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(sx + 6, y, sw - 12, 3);
        for (let x = sx + 10; x < sx + sw - 16; x += 10 + rand() * 8) { ctx.fillStyle = `hsla(${rand() * 360},40%,58%,0.4)`; ctx.fillRect(x, y - 12 - rand() * 6, 6, 12); }
      }
      ectx.fillStyle = '#ffe2a8'; ectx.globalAlpha = 0.9; ectx.fillRect(sx, sy + 50, sw, H - sy - 72); ectx.globalAlpha = 1;
    } else if (kind === 'gate') {
      // portón metálico de garaje
      ctx.fillStyle = '#e8e4dc'; ctx.fillRect(x0 + 14, 30, B - 28, H - 30);
      ctx.fillStyle = ['#2f4f6f', '#6d2020', '#3a3a3a'][Math.floor(rand() * 3)]; ctx.fillRect(x0 + 22, 38, B - 44, H - 38);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; for (let x = x0 + 30; x < x0 + B - 26; x += 16) ctx.fillRect(x, 42, 3, H - 48);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x0 + B / 2 - 1, 38, 2, H - 38);
    } else if (kind === 'door') {
      ctx.fillStyle = '#e8e4dc'; ctx.fillRect(x0 + B / 2 - 52, 44, 104, H - 44);
      ctx.fillStyle = ['#5b3a1e', '#1f4e79', '#2f5d3a', '#6d2020'][Math.floor(rand() * 4)]; ctx.fillRect(x0 + B / 2 - 44, 52, 88, H - 52);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x0 + B / 2 - 36, 64, 32, 70); ctx.fillRect(x0 + B / 2 + 4, 64, 32, 70);
      ctx.fillStyle = '#d4af37'; ctx.fillRect(x0 + B / 2 + 28, 150, 6, 6);
      // placa de nomenclatura (verde/azul, ver referencia oficial)
      ctx.fillStyle = '#005b8c'; ctx.fillRect(x0 + B / 2 + 60, 60, 10, 18); ctx.fillStyle = '#008351'; ctx.fillRect(x0 + B / 2 + 70, 60, 26, 18);
    } else {
      ctx.fillStyle = '#e8e4dc'; ctx.fillRect(x0 + 50, 56, B - 100, 110);
      ctx.fillStyle = '#2d3e52'; ctx.fillRect(x0 + 58, 64, B - 116, 94);
      ctx.fillStyle = '#222'; for (let i = 1; i < 7; i++) ctx.fillRect(x0 + 58 + ((B - 116) * i) / 7, 64, 3, 94);
      if (rand() < 0.5) { ectx.fillStyle = '#ffcf7a'; ectx.fillRect(x0 + 58, 64, B - 116, 94); }
    }
  });
  // Zócalo (franja inferior más oscura)
  ctx.fillStyle = 'rgba(80,60,40,0.35)'; ctx.fillRect(0, H - 22, W, 22);
  return { map: toTexture(c), emissiveMap: toTexture(e) };
}

// Lámina ondulada (zinc / fibrocemento): color casi blanco (lo tiñe el color real del techo) + mapa normal
export function corrugated() {
  const [c, ctx] = canvas(64, 64);
  const [n, nctx] = canvas(64, 64);
  const img = ctx.createImageData(64, 64), nimg = nctx.createImageData(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const ph = (x / 64) * Math.PI * 2 * 4;
    const v = 215 + Math.sin(ph) * 30 + (Math.random() - 0.5) * 12;
    img.data.set([v, v, v, 255], (y * 64 + x) * 4);
    const nx = Math.cos(ph) * 0.6;
    nimg.data.set([(nx * 0.5 + 0.5) * 255, 128, 255 * Math.sqrt(1 - nx * nx * 0.25), 255], (y * 64 + x) * 4);
  }
  ctx.putImageData(img, 0, 0); nctx.putImageData(nimg, 0, 0);
  return { map: toTexture(c), normalMap: toTexture(n, { srgb: false }) };
}

// Adoquín rojo en espina de pescado del Parque Principal (ver referencias del parque).
export function brickPaving() {
  const S = 512;
  const [c, ctx] = canvas(S, S);
  const rand = rng(3);
  ctx.fillStyle = '#7d3a28';
  ctx.fillRect(0, 0, S, S);
  const bw = 32, bh = 16;
  for (let y = -S; y < S * 2; y += bh) {
    for (let x = -S; x < S * 2; x += bw) {
      const off = (Math.floor(y / bh) % 2) * (bw / 2);
      const r = 165 + rand() * 40, g = 70 + rand() * 25, b = 50 + rand() * 20;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x + off + 1, y + 1, bw - 2, bh - 2);
    }
  }
  return toTexture(c);
}

// Textura de líneas viales: se usa sobre un plano delgado; alpha en el canal de color.
export function concreteNoise() {
  const S = 256;
  const [c, ctx] = canvas(S, S);
  plasterNoise(ctx, S, S, rng(11), 200);
  return toTexture(c);
}

// Carátula del reloj de la Torre San Antonio.
export function clockFace() {
  const S = 256;
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, S, S);
  ctx.translate(S / 2, S / 2);
  ctx.fillStyle = '#fbfbf7'; ctx.strokeStyle = '#222'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(0, 0, 110, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#111';
  for (let i = 0; i < 12; i++) {
    ctx.save(); ctx.rotate((i * Math.PI) / 6); ctx.fillRect(-4, -100, 8, i % 3 === 0 ? 22 : 12); ctx.restore();
  }
  ctx.lineCap = 'round'; ctx.strokeStyle = '#111';
  ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(40, -38); ctx.stroke();
  ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-6, -84); ctx.stroke();
  return toTexture(c, { repeat: false });
}

// Letrero "PITALITO Bicentenario" del parque.
export function bicentenarioSign() {
  const [c, ctx] = canvas(1024, 256);
  ctx.fillStyle = '#1b1b1b'; ctx.fillRect(0, 0, 1024, 256);
  const letters = 'PITALITO';
  const colors = ['#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#8ecae6', '#e76f51', '#9b5de5', '#f15bb5'];
  ctx.font = 'bold 120px "Trebuchet MS", sans-serif';
  ctx.textBaseline = 'middle';
  let x = 120;
  [...letters].forEach((ch, i) => { ctx.fillStyle = colors[i]; ctx.fillText(ch, x, 110); x += ctx.measureText(ch).width + 10; });
  ctx.fillStyle = '#ffffff';
  ctx.font = 'italic 56px Georgia, serif';
  ctx.fillText('Bicentenario', 330, 205);
  return toTexture(c, { repeat: false });
}

// Placa de vehículo (blanca = servicio público, amarilla = particular).
export function licensePlate(text, city = 'PITALITO', color = '#f7d117') {
  const [c, ctx] = canvas(256, 128);
  ctx.fillStyle = color; ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#111'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, 248, 120);
  ctx.fillStyle = '#111'; ctx.textAlign = 'center';
  ctx.font = 'bold 64px "Arial Narrow", Arial, sans-serif'; ctx.fillText(text, 128, 76);
  ctx.font = 'bold 22px Arial, sans-serif'; ctx.fillText(city, 128, 112);
  return toTexture(c, { repeat: false });
}

// Paneles decorativos pintados de la chiva (paisajes y motivos, ver referencias de chiva).
export function chivaPanels() {
  const [c, ctx] = canvas(1024, 256);
  const rand = rng(5);
  const bands = ['#d62828', '#f7b801', '#2a9d8f', '#1d3557', '#f77f00', '#6a994e'];
  for (let i = 0; i < 8; i++) {
    const x = i * 128;
    ctx.fillStyle = bands[i % bands.length]; ctx.fillRect(x, 0, 128, 256);
    ctx.fillStyle = '#7b4b2a'; ctx.fillRect(x + 12, 20, 104, 150);
    const g = ctx.createLinearGradient(0, 28, 0, 160);
    g.addColorStop(0, '#8ecae6'); g.addColorStop(1, '#ffe8a3');
    ctx.fillStyle = g; ctx.fillRect(x + 18, 26, 92, 138);
    ctx.fillStyle = '#3a7d44';
    ctx.beginPath(); ctx.moveTo(x + 18, 164); ctx.lineTo(x + 50, 90 + rand() * 30); ctx.lineTo(x + 80, 130); ctx.lineTo(x + 110, 100); ctx.lineTo(x + 110, 164); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(x + 40 + rand() * 30, 130, 20, 16);
    ctx.fillStyle = '#c1121f'; ctx.fillRect(x + 38 + rand() * 30, 124, 24, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(x + 20 + k * 18, 210, 6, 0, Math.PI * 2); ctx.fill(); }
  }
  return toTexture(c);
}

// Textura radial suave para halos de luz (faroles, farolas).
export function glowSprite() {
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.3, 'rgba(255,200,120,0.45)'); g.addColorStop(1, 'rgba(255,180,90,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return toTexture(c, { repeat: false });
}

// Ladrillo a la vista de la Iglesia San Antonio (fotos a nivel de calle, may 2025): ocre claro, juntas
// gruesas y manchas de humedad. 2 m × 2 m por repetición.
export function exposedBrick() {
  const S = 512;
  const [c, ctx] = canvas(S, S);
  const rand = rng(21);
  ctx.fillStyle = '#8a7258'; ctx.fillRect(0, 0, S, S); // mortero
  const bw = 64, bh = 20;
  for (let row = 0; row * bh < S; row++) {
    const off = (row % 2) * (bw / 2);
    for (let x = -bw; x < S + bw; x += bw) {
      const l = 44 + rand() * 14, sat = 30 + rand() * 14, hue = 24 + rand() * 10;
      ctx.fillStyle = `hsl(${hue},${sat}%,${l}%)`;
      ctx.fillRect(x + off + 2, row * bh + 2, bw - 4, bh - 4);
    }
  }
  // humedad y hollín (más oscuro abajo y bajo las cornisas)
  for (let i = 0; i < 26; i++) {
    const x = rand() * S, w = 20 + rand() * 80;
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, 'rgba(40,30,20,0)'); g.addColorStop(1, `rgba(40,30,20,${0.08 + rand() * 0.12})`);
    ctx.fillStyle = g; ctx.fillRect(x, 0, w, S);
  }
  return toTexture(c);
}

// Adoquín rojo del Parque Principal con franjas de concreto gris formando una retícula (fotos may 2025).
// Una repetición = 6 m: franja gris de 0,5 m en el borde y adoquín en trabazón adentro.
export function parkPaving() {
  const S = 1024;
  const [c, ctx] = canvas(S, S);
  const rand = rng(8);
  ctx.fillStyle = '#6e3322'; ctx.fillRect(0, 0, S, S);
  const bw = 34, bh = 17;
  for (let row = 0; row * bh < S; row++) {
    const off = (row % 2) * (bw / 2);
    for (let x = -bw; x < S + bw; x += bw) {
      const r = 150 + rand() * 45, g = 62 + rand() * 26, b = 44 + rand() * 18;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x + off + 1.5, row * bh + 1.5, bw - 3, bh - 3);
    }
  }
  // franja de concreto (0,5 m de 6 m ≈ 85 px) en dos bordes → retícula al repetir
  const band = 85;
  for (const [x, y, w, h] of [[0, 0, S, band / 2], [0, S - band / 2, S, band / 2], [0, 0, band / 2, S], [S - band / 2, 0, band / 2, S]]) {
    ctx.fillStyle = '#8f8b84'; ctx.fillRect(x, y, w, h);
  }
  for (let i = 0; i < 1500; i++) {
    ctx.fillStyle = `rgba(0,0,0,${rand() * 0.08})`;
    ctx.fillRect(rand() * S, rand() * S, 2 + rand() * 6, 2 + rand() * 6);
  }
  return toTexture(c);
}

// Letrero "YO ❤ PITALITO" (letras blancas, corazón rojo) sobre fondo transparente.
export function yoPitalito() {
  const [c, ctx] = canvas(2048, 384);
  ctx.clearRect(0, 0, 2048, 384);
  ctx.font = '900 300px "Arial Black", "Arial", sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f4f4f0';
  ctx.fillText('YO', 10, 320);
  const hx = 520, hy = 175;
  ctx.fillStyle = '#c1121f';
  ctx.beginPath();
  ctx.moveTo(hx, hy + 130);
  ctx.bezierCurveTo(hx - 170, hy + 10, hx - 110, hy - 120, hx, hy - 40);
  ctx.bezierCurveTo(hx + 110, hy - 120, hx + 170, hy + 10, hx, hy + 130);
  ctx.fill();
  ctx.fillStyle = '#f4f4f0';
  ctx.fillText('PITALITO', 700, 320);
  return toTexture(c, { repeat: false });
}

// Tablero verde "MACIZO COLOMBIANO"
export function macizoBoard() {
  const [c, ctx] = canvas(512, 160);
  ctx.fillStyle = '#1f6b4a'; ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = '#e8efe9'; ctx.lineWidth = 6; ctx.strokeRect(8, 8, 496, 144);
  ctx.fillStyle = '#f4f4f0'; ctx.textAlign = 'center'; ctx.font = 'bold 52px "Arial Narrow", Arial, sans-serif';
  ctx.fillText('MACIZO', 256, 70); ctx.fillText('COLOMBIANO', 256, 128);
  return toTexture(c, { repeat: false });
}
