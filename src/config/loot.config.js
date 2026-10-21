// Botín del modo supervivencia. **Ficción declarada**: lo que hay dentro de cada contenedor es inventado; dónde
// están los lugares no — son los puntos de interés reales de OpenStreetMap (public/world/map.json → pois, campo `k`).
//
// Cada tipo de lugar pone unos contenedores alrededor de su punto (en el predio, fuera de los muros, porque los
// edificios no tienen interior) y cada contenedor se llena de una tabla. Lo que se saca queda saqueado en esta
// partida y en las siguientes (localStorage), así que un hospital vaciado sigue vacío.

// Objetos. `peso` en kg. `usar` lo resuelve InventorySystem: vida, hambre, sed (las dos últimas las usa la fase 4).
export const ITEMS = {
  venda:      { nombre: 'Venda', peso: 0.1, usar: { vida: 15 }, detalle: 'Para cortes y arañazos.' },
  botiquin:   { nombre: 'Botiquín', peso: 1.2, usar: { vida: 50 }, detalle: 'Gasas, yodo, esparadrapo.' },
  analgesico: { nombre: 'Analgésicos', peso: 0.05, usar: { vida: 8 }, detalle: 'Acetaminofén.' },
  antibiotico:{ nombre: 'Antibiótico', peso: 0.05, usar: { infeccion: -40 }, detalle: 'Contra la infección de una mordida.' },
  suero:      { nombre: 'Suero oral', peso: 0.5, usar: { sed: 35, vida: 5 }, detalle: 'Sales de rehidratación.' },
  agua:       { nombre: 'Botella de agua', peso: 0.6, usar: { sed: 40 }, detalle: '600 ml.' },
  gaseosa:    { nombre: 'Gaseosa', peso: 0.4, usar: { sed: 25, hambre: 5 } },
  enlatado:   { nombre: 'Enlatado', peso: 0.4, usar: { hambre: 30 }, detalle: 'Atún o fríjoles.' },
  arroz:      { nombre: 'Arroz (libra)', peso: 0.5, usar: { hambre: 20 } },
  panela:     { nombre: 'Panela', peso: 0.5, usar: { hambre: 20, sed: -5 }, detalle: 'Del trapiche.' },
  cafe:       { nombre: 'Café de Pitalito', peso: 0.5, usar: { hambre: 5 }, detalle: 'Origen: valle de Laboyos.' },
  fruta:      { nombre: 'Fruta', peso: 0.3, usar: { hambre: 12, sed: 8 }, detalle: 'Granadilla, lulo, mora.' },
  pan:        { nombre: 'Pan', peso: 0.2, usar: { hambre: 15 } },
  vela:       { nombre: 'Velas', peso: 0.2, detalle: 'Luz de noche (fase 6).' },
  linterna:   { nombre: 'Linterna', peso: 0.4, detalle: 'Luz de noche (fase 6).' },
  pilas:      { nombre: 'Pilas', peso: 0.1 },
  gasolina:   { nombre: 'Galón de gasolina', peso: 3.2, detalle: 'Para el vehículo.' },
  chaleco:    { nombre: 'Chaleco', peso: 3.5, detalle: 'Protección (fase 4).' },
  tablas:     { nombre: 'Tablas', peso: 2.5, detalle: 'Para tapiar (fase 4).' },
  cuerda:     { nombre: 'Cuerda', peso: 0.8 },
  radio:      { nombre: 'Radio portátil', peso: 0.7, detalle: 'Por si alguien sigue transmitiendo.' },
  // Armas de fuego (ver firearms.config.js): tenerlas en la mochila las pone en el arsenal (X y Z).
  pistola:    { nombre: 'Pistola 9 mm', peso: 0.8, arma: true, detalle: 'X: sacar · clic: disparar · clic der.: apuntar · R: recargar' },
  revolver:   { nombre: 'Revólver .38', peso: 0.9, arma: true },
  escopeta:   { nombre: 'Escopeta de bomba', peso: 3.4, arma: true },
  recortada:  { nombre: 'Escopeta recortada', peso: 2.2, arma: true },
  fusil:      { nombre: 'Fusil', peso: 3.6, arma: true },
  rifle:      { nombre: 'Rifle de cacería', peso: 4.0, arma: true },
  balas9:     { nombre: 'Balas 9 mm', peso: 0.012 },
  balas38:    { nombre: 'Balas .38', peso: 0.012 },
  cartuchos:  { nombre: 'Cartuchos de escopeta', peso: 0.04 },
  balas556:   { nombre: 'Balas 5,56', peso: 0.012 },
  balas308:   { nombre: 'Balas .308', peso: 0.025 },
};

// Tablas: [objeto, peso de sorteo, cantidad mín, máx]. Cada contenedor saca entre `tiradas[0]` y `tiradas[1]`.
export const TABLAS = {
  medica:   [['venda', 6, 1, 3], ['analgesico', 5, 1, 2], ['botiquin', 2, 1, 1], ['antibiotico', 3, 1, 1], ['suero', 3, 1, 2], ['agua', 2, 1, 1]],
  policia:  [['pistola', 1, 1, 1], ['revolver', 1, 1, 1], ['escopeta', 0.5, 1, 1], ['balas9', 4, 6, 15], ['balas38', 3, 4, 12], ['cartuchos', 3, 3, 8], ['chaleco', 2, 1, 1], ['linterna', 4, 1, 1], ['pilas', 4, 1, 3], ['radio', 2, 1, 1], ['venda', 3, 1, 2], ['agua', 3, 1, 1], ['enlatado', 2, 1, 1]],
  iglesia:  [['vela', 6, 1, 4], ['agua', 4, 1, 2], ['pan', 4, 1, 2], ['panela', 2, 1, 1], ['venda', 1, 1, 1]],
  tienda:   [['enlatado', 6, 1, 3], ['arroz', 4, 1, 2], ['agua', 5, 1, 3], ['gaseosa', 4, 1, 2], ['pilas', 2, 1, 2], ['panela', 2, 1, 1]],
  mercado:  [['fruta', 6, 1, 4], ['panela', 4, 1, 2], ['cafe', 4, 1, 1], ['arroz', 3, 1, 2], ['agua', 2, 1, 1]],
  gasolina: [['gasolina', 5, 1, 1], ['gaseosa', 4, 1, 2], ['agua', 3, 1, 1], ['linterna', 1, 1, 1], ['pilas', 2, 1, 2]],
  // Bases de los saqueadores (ficción): armas largas y munición.
  saqueadores: [['fusil', 1, 1, 1], ['rifle', 0.6, 1, 1], ['recortada', 1, 1, 1], ['balas556', 4, 10, 30], ['balas308', 2, 3, 10], ['cartuchos', 3, 4, 10], ['enlatado', 2, 1, 3], ['agua', 2, 1, 2]],
  bomberos: [['botiquin', 3, 1, 1], ['venda', 4, 1, 2], ['cuerda', 3, 1, 1], ['linterna', 3, 1, 1], ['tablas', 2, 1, 2], ['agua', 3, 1, 2]],
};

// Contenedores: aspecto (lo dibuja LootSystem con piezas simples) y qué tabla usan.
export const CONTENEDORES = {
  botiquinPared: { nombre: 'Botiquín de pared', tabla: 'medica', tiradas: [1, 2], forma: 'caja', tam: [0.5, 0.6, 0.2], color: '#e9e6df', alto: 1.1 },
  camilla:       { nombre: 'Camilla abandonada', tabla: 'medica', tiradas: [1, 3], forma: 'camilla', tam: [0.7, 0.85, 1.9], color: '#c9ced3' },
  casillero:     { nombre: 'Casillero', tabla: 'policia', tiradas: [1, 3], forma: 'caja', tam: [0.5, 1.8, 0.5], color: '#4f5a46' },
  patrulla:      { nombre: 'Caja de la patrulla', tabla: 'policia', tiradas: [2, 3], forma: 'caja', tam: [0.9, 0.5, 0.6], color: '#2f3a2a' },
  banca:         { nombre: 'Bajo la banca', tabla: 'iglesia', tiradas: [1, 2], forma: 'caja', tam: [1.8, 0.45, 0.45], color: '#7b4b2a' },
  ofrendas:      { nombre: 'Mesa de ofrendas', tabla: 'iglesia', tiradas: [1, 3], forma: 'caja', tam: [1.2, 0.9, 0.6], color: '#8a6a3c' },
  estante:       { nombre: 'Estante', tabla: 'tienda', tiradas: [2, 3], forma: 'caja', tam: [1.4, 1.6, 0.45], color: '#b9b4a6' },
  nevera:        { nombre: 'Nevera de bebidas', tabla: 'tienda', tiradas: [1, 2], forma: 'caja', tam: [0.7, 1.7, 0.6], color: '#c8202a' },
  puesto:        { nombre: 'Puesto de mercado', tabla: 'mercado', tiradas: [2, 3], forma: 'caja', tam: [1.6, 0.9, 0.9], color: '#5b7a3a' },
  surtidor:      { nombre: 'Tienda de la bomba', tabla: 'gasolina', tiradas: [1, 2], forma: 'caja', tam: [1.0, 1.2, 0.6], color: '#d8a227' },
  cajaArmas:     { nombre: 'Caja de los saqueadores', tabla: 'saqueadores', tiradas: [2, 4], forma: 'caja', tam: [1.0, 0.5, 0.6], color: '#3c4a2e' },
  gabinete:      { nombre: 'Gabinete de bomberos', tabla: 'bomberos', tiradas: [2, 3], forma: 'caja', tam: [0.8, 1.6, 0.4], color: '#b3261e' },
};

// Qué ponen los lugares reales, por su tipo en OSM (`k`): cuántos contenedores y de qué clase.
export const LUGARES = {
  hospital:         { cuantos: 6, contenedores: ['camilla', 'botiquinPared', 'camilla', 'botiquinPared'] },
  clinic:           { cuantos: 3, contenedores: ['camilla', 'botiquinPared'] },
  doctors:          { cuantos: 2, contenedores: ['botiquinPared'] },
  police:           { cuantos: 3, contenedores: ['casillero', 'patrulla'] },
  place_of_worship: { cuantos: 3, contenedores: ['banca', 'ofrendas'] },
  religious:        { cuantos: 2, contenedores: ['banca', 'ofrendas'] },
  monastery:        { cuantos: 3, contenedores: ['banca', 'ofrendas'] },
  supermarket:      { cuantos: 3, contenedores: ['estante', 'nevera'] },
  department_store: { cuantos: 2, contenedores: ['estante'] },
  variety_store:    { cuantos: 2, contenedores: ['estante', 'nevera'] },
  marketplace:      { cuantos: 5, contenedores: ['puesto'] },
  fuel:             { cuantos: 1, contenedores: ['surtidor'] },
  fire_station:     { cuantos: 2, contenedores: ['gabinete'] },
};

export const LOOT = {
  radioVisible: 120,     // se dibujan los contenedores a menos de esto del jugador
  alcance: 1.8,          // distancia para registrar con E
  cargaMax: 25,          // kg que aguanta la mochila
  guardado: 'pitalito:supervivencia:v1',
};
