// Culmos de guadua dibujados en SVG (referencias: assets/references/ui/guadua/*):
// cilindro con sombreado, nudos oscuros con reborde claro, fibras, extremos cortados huecos y amarres.
const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

const DRY = ['#6b4f2a', '#e8d4a2', '#cdae70', '#9c7a44', '#5a4124'];
const GREEN = ['#2c4a17', '#9cc25a', '#5f8f2f', '#3e6a1f', '#22380f'];

function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.appendChild(n);
  return n;
}

function gradient(defs, colors, vertical) {
  const id = `gd${++uid}`;
  const g = el('linearGradient', { id, x1: 0, y1: 0, x2: vertical ? 1 : 0, y2: vertical ? 0 : 1 }, defs);
  [0, 0.2, 0.5, 0.82, 1].forEach((o, i) => el('stop', { offset: o, 'stop-color': colors[i] }, g));
  return id;
}

/** Culmo horizontal o vertical de `length` × `thick` px. `nodeEvery`: separación entre nudos (px). */
export function culm(length, thick, { vertical = false, green = false, nodeEvery = 140, seed = 1 } = {}) {
  const W = vertical ? thick : length, H = vertical ? length : thick;
  const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'culm', 'aria-hidden': 'true' });
  const defs = el('defs', {}, svg);
  const gid = gradient(defs, green ? GREEN : DRY, vertical);
  el('rect', { x: 0, y: 0, width: W, height: H, rx: thick * 0.45, fill: `url(#${gid})` }, svg);
  // fibras longitudinales
  for (let i = 1; i < 4; i++) {
    const t = (thick * i) / 4 + ((seed * i) % 3) - 1;
    el('line', vertical ? { x1: t, y1: 4, x2: t, y2: H - 4 } : { x1: 4, y1: t, x2: W - 4, y2: t },
      svg).setAttribute('style', `stroke:${green ? '#1f3510' : '#5a4124'};stroke-opacity:.14;stroke-width:1`);
  }
  // nudos con reborde claro (irregulares, como en la foto)
  let pos = nodeEvery * (0.45 + ((seed * 37) % 10) / 40);
  while (pos < length - thick * 0.8) {
    const band = { fill: green ? '#1f3510' : '#5a3f20', opacity: 0.85 };
    const hi = { fill: green ? '#c6e08a' : '#f3e4bb', opacity: 0.55 };
    if (vertical) {
      el('rect', { x: 0, y: pos - 2, width: W, height: 4, rx: 2, ...band }, svg);
      el('rect', { x: 1, y: pos + 2, width: W - 2, height: 1.6, ...hi }, svg);
    } else {
      el('rect', { x: pos - 2, y: 0, width: 4, height: H, ry: 2, ...band }, svg);
      el('rect', { x: pos + 2, y: 1, width: 1.6, height: H - 2, ...hi }, svg);
    }
    pos += nodeEvery * (0.85 + ((pos * 7 + seed) % 30) / 100);
  }
  return svg;
}

// Extremo cortado: se ve el hueco del culmo
export function cutEnd(d, { green = false } = {}) {
  const svg = el('svg', { width: d, height: d, viewBox: `0 0 ${d} ${d}`, class: 'culm-end', 'aria-hidden': 'true' });
  const r = d / 2;
  el('circle', { cx: r, cy: r, r: r - 1, fill: green ? '#8fb04a' : '#d9bf86', stroke: green ? '#2c4a17' : '#6b4f2a', 'stroke-width': 2 }, svg);
  el('circle', { cx: r, cy: r, r: r * 0.72, fill: 'none', stroke: green ? '#5f8f2f' : '#b8965a', 'stroke-width': 1.5 }, svg);
  el('circle', { cx: r, cy: r, r: r * 0.52, fill: '#2a1c0c' }, svg);
  el('circle', { cx: r * 0.9, cy: r * 0.88, r: r * 0.3, fill: '#1a1108' }, svg);
  return svg;
}

// Amarre de fibra natural en una unión
export function lashing(w, h) {
  const svg = el('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, class: 'lashing', 'aria-hidden': 'true' });
  for (let i = 0; i < 5; i++) el('rect', { x: (i * w) / 5, y: 0, width: w / 5 - 1, height: h, rx: 1.5, fill: i % 2 ? '#7a5a30' : '#5c4222' }, svg);
  return svg;
}

/**
 * Marco de guadua alrededor de un elemento: dos culmos horizontales que sobresalen en las esquinas, dos verticales,
 * extremos huecos arriba y amarres. Se redibuja cuando el elemento cambia de tamaño.
 */
export function guaduaFrame(target, { thick = 16, green = false } = {}) {
  const layer = document.createElement('div');
  layer.className = 'guadua-frame-layer';
  target.appendChild(layer);
  const draw = () => {
    const w = target.clientWidth, h = target.clientHeight;
    if (!w || !h) return;
    layer.replaceChildren();
    const over = thick * 1.1;
    const place = (node, x, y) => { node.style.left = `${x}px`; node.style.top = `${y}px`; layer.appendChild(node); };
    place(culm(h + over * 0.6, thick, { vertical: true, green, seed: 3 }), -thick / 2, -over * 0.6);
    place(culm(h + over * 0.6, thick, { vertical: true, green, seed: 5 }), w - thick / 2, -over * 0.6);
    place(culm(w + over * 2, thick, { green, seed: 7 }), -over, -thick / 2);
    place(culm(w + over * 2, thick, { green, seed: 11 }), -over, h - thick / 2);
    place(cutEnd(thick + 2, { green }), -thick / 2 - 1, -over * 0.6 - thick / 2);
    place(cutEnd(thick + 2, { green }), w - thick / 2 - 1, -over * 0.6 - thick / 2);
    for (const [x, y] of [[-thick / 2 - 3, thick / 2 + 2], [w - thick / 2 - 3, thick / 2 + 2], [-thick / 2 - 3, h - thick * 1.6], [w - thick / 2 - 3, h - thick * 1.6]]) place(lashing(thick + 6, 10), x, y);
  };
  new ResizeObserver(draw).observe(target);
  draw();
  return layer;
}

/**
 * Aro de guadua (culmo curvado en círculo) con nudos y amarres: marco del minimapa y del velocímetro.
 * `size` = diámetro exterior en px, `thick` = grosor del culmo.
 */
export function culmRing(size, thick, { nodes = 10, green = false } = {}) {
  const svg = el('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, class: 'culm-ring', 'aria-hidden': 'true' });
  const defs = el('defs', {}, svg);
  const id = `rg${++uid}`;
  const rg = el('radialGradient', { id, cx: '50%', cy: '50%', r: '50%' }, defs);
  const c = green ? GREEN : DRY;
  const r = size / 2 - thick / 2 - 1;
  const inner = (r - thick / 2) / (size / 2), outer = (r + thick / 2) / (size / 2);
  [[inner, c[4]], [inner + (outer - inner) * 0.25, c[1]], [inner + (outer - inner) * 0.55, c[2]], [inner + (outer - inner) * 0.85, c[3]], [outer, c[0]]]
    .forEach(([o, col]) => el('stop', { offset: o, 'stop-color': col }, rg));
  el('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: `url(#${id})`, 'stroke-width': thick }, svg);
  for (let i = 0; i < nodes; i++) {
    const a = (i / nodes) * Math.PI * 2 + 0.3;
    const x1 = size / 2 + Math.cos(a) * (r - thick / 2), y1 = size / 2 + Math.sin(a) * (r - thick / 2);
    const x2 = size / 2 + Math.cos(a) * (r + thick / 2), y2 = size / 2 + Math.sin(a) * (r + thick / 2);
    el('line', { x1, y1, x2, y2, stroke: green ? '#1f3510' : '#5a3f20', 'stroke-width': 3.5, 'stroke-linecap': 'round', opacity: 0.85 }, svg);
    const b = a + 0.035;
    el('line', {
      x1: size / 2 + Math.cos(b) * (r - thick / 2 + 1), y1: size / 2 + Math.sin(b) * (r - thick / 2 + 1),
      x2: size / 2 + Math.cos(b) * (r + thick / 2 - 1), y2: size / 2 + Math.sin(b) * (r + thick / 2 - 1),
      stroke: green ? '#c6e08a' : '#f3e4bb', 'stroke-width': 1.2, opacity: 0.6,
    }, svg);
  }
  return svg;
}

// Grano de café (adorno): elipse tostada con su surco central
export function coffeeBean(size, rotate = 0) {
  const svg = el('svg', { width: size, height: size, viewBox: '0 0 24 24', class: 'coffee-bean', 'aria-hidden': 'true' });
  const g = el('g', { transform: `rotate(${rotate} 12 12)` }, svg);
  el('ellipse', { cx: 12, cy: 12, rx: 7.5, ry: 10.5, fill: '#5b3417', stroke: '#2a160a', 'stroke-width': 1.2 }, g);
  el('ellipse', { cx: 10, cy: 9, rx: 2.5, ry: 4, fill: '#8a5a33', opacity: 0.55 }, g);
  el('path', { d: 'M12 2.5 C 8.5 8, 15.5 16, 12 21.5', fill: 'none', stroke: '#1e0f06', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, g);
  return svg;
}

// Íconos de la barra de controles (trazos simples, heredan currentColor)
const ICONS = {
  car: '<path d="M4 15v-3l2-5h12l2 5v3"/><path d="M3 15h18v3H3z"/><circle cx="7.5" cy="18.5" r="1.8"/><circle cx="16.5" cy="18.5" r="1.8"/><path d="M6.5 12h11"/>',
  auto: '<circle cx="12" cy="12" r="8"/><path d="M8 15l4-8 4 8M9.5 12.5h5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  rain: '<path d="M7 14a4 4 0 0 1 .5-8A5.5 5.5 0 0 1 18 7.5 3.5 3.5 0 0 1 17.5 14z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  camera: '<path d="M3 8h4l2-2.5h6L17 8h4v11H3z"/><circle cx="12" cy="13" r="3.5"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  pause: '<rect x="6.5" y="5" width="3.5" height="14" rx="1"/><rect x="14" y="5" width="3.5" height="14" rx="1"/>',
  garage: '<path d="M3 10l9-6 9 6v10H3z"/><path d="M7 20v-6h10v6M7 17h10"/>',
};
export function icon(name, size = 22) {
  const svg = el('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
  svg.innerHTML = ICONS[name];
  return svg;
}
