// Bases de supervivientes (modo supervivencia). **Ficción declarada**: los grupos, sus nombres y lo que hacen son
// inventados, sin relación con ninguna organización real. Lo que es dato es **dónde** están: cada base se apoya en
// un lugar real de OpenStreetMap (map.json → pois, por nombre exacto), elegido por ser un sitio grande y abierto
// donde tendría sentido atrincherarse. Se evitan a propósito la cárcel y los cuarteles reales.
//
//   comerciantes — truecan (nada de dinero: objeto por objeto), no atacan, y su base es refugio.
//   saqueadores  — disparan a quien se acerque. Guardan armas largas y munición.

export const BASES = [
  {
    id: 'minorista', tipo: 'comerciantes', nombre: 'Trueque de la Minorista',
    lugar: 'Plaza de Mercado Minorista de Pitalito', radio: 26,
    npcs: [
      { rol: 'comerciante', nombre: 'Doña Aurelia', oferta: 'comida' },
      { rol: 'comerciante', nombre: 'El Mono', oferta: 'municion' },
      { rol: 'guardia', arma: 'escopeta' },
    ],
  },
  {
    id: 'civica', tipo: 'comerciantes', nombre: 'Puesto de la Plaza Cívica',
    lugar: 'Plaza Civica', radio: 20,
    npcs: [
      { rol: 'comerciante', nombre: 'Don Evelio', oferta: 'medicina' },
      { rol: 'guardia', arma: 'pistola' },
    ],
  },
  {
    id: 'terminal', tipo: 'saqueadores', nombre: 'Los de la Terminal',
    lugar: 'Terminal de Transportes de Pitalito', radio: 40,
    npcs: [
      { rol: 'tirador', arma: 'fusil' }, { rol: 'tirador', arma: 'escopeta' }, { rol: 'tirador', arma: 'pistola' },
      { rol: 'tirador', arma: 'rifle' }, { rol: 'tirador', arma: 'pistola' },
    ],
    cajas: 3,
  },
  {
    id: 'industrial', tipo: 'saqueadores', nombre: 'Los del Parque Industrial',
    lugar: 'Zona Industrial', radio: 40,
    npcs: [{ rol: 'tirador', arma: 'fusil' }, { rol: 'tirador', arma: 'recortada' }, { rol: 'tirador', arma: 'rifle' }, { rol: 'tirador', arma: 'pistola' }],
    cajas: 3,
  },
];

// Aspecto: ropa de diario teñida, sin uniformes, distintivos ni colores de ningún grupo real.
export const LOOKS = {
  comerciante: { cuerpo: 'a', pelo: 'partido', barba: 'ninguna', ropa: 'campo', sombrero: 'aguadeno', piel: '2', pelocolor: 'negro' },
  comerciante2: { cuerpo: 'b', pelo: 'partido', barba: 'ninguna', ropa: 'campo', sombrero: 'ninguno', piel: '3', pelocolor: 'negro' },
  guardia: { cuerpo: 'a', pelo: 'partido', barba: 'ninguna', ropa: 'camino', sombrero: 'ninguno', piel: '4', pelocolor: 'negro', uniforme: '#7d6a4f' },
  tirador: { cuerpo: 'a', pelo: 'ninguno', barba: 'ninguna', ropa: 'camino', sombrero: 'ninguno', piel: '3', pelocolor: 'negro', uniforme: '#4b4740' },
};

// Cifras de los NPC armados.
export const TIRADOR = {
  stats: { health: 70, stamina: 80, staminaRegen: 20, staminaDelay: 0.6, poise: 30, invulnerableAfterHit: 0.15 },
  vista: 55, oido: 22, precision: 5,        // multiplica la dispersión del arma: fallan más que el jugador
  dano: 0.55,                               // y pegan menos: si no, una base te tumba en segundos (medido: 10 s)
  distanciaPreferida: 16, rafaga: [2, 4], pausaRafaga: [2, 4], reaccion: 1.2,
  reaparece: 600,                             // segundos para que la base vuelva a llenarse
  botin: { pistola: ['pistola', 'balas9'], escopeta: ['escopeta', 'cartuchos'], recortada: ['recortada', 'cartuchos'], fusil: ['fusil', 'balas556'], rifle: ['rifle', 'balas308'] },
};

// Trueque: cada comerciante tiene tratos fijos «das esto → recibes aquello», con existencias que se acaban (y se
// guardan). Los valores se pensaron para que lo que abunda (agua, comida) compre lo escaso (munición, medicina).
export const TRATOS = {
  comida: [
    { das: { agua: 2 }, recibes: { enlatado: 1 }, existencias: 8 },
    { das: { vela: 4 }, recibes: { pan: 2 }, existencias: 6 },
    { das: { pilas: 3 }, recibes: { arroz: 2 }, existencias: 6 },
    { das: { cafe: 1 }, recibes: { panela: 2, fruta: 2 }, existencias: 5 },
    { das: { gasolina: 1 }, recibes: { enlatado: 3, agua: 2 }, existencias: 4 },
  ],
  municion: [
    { das: { enlatado: 3 }, recibes: { balas9: 12 }, existencias: 6 },
    { das: { enlatado: 2, agua: 2 }, recibes: { cartuchos: 6 }, existencias: 5 },
    { das: { botiquin: 1 }, recibes: { balas556: 20 }, existencias: 4 },
    { das: { radio: 1 }, recibes: { balas308: 8 }, existencias: 3 },
    { das: { chaleco: 1 }, recibes: { pistola: 1, balas9: 10 }, existencias: 2 },
    { das: { gasolina: 2, linterna: 1 }, recibes: { escopeta: 1, cartuchos: 6 }, existencias: 1 },
  ],
  medicina: [
    { das: { enlatado: 2 }, recibes: { venda: 3 }, existencias: 8 },
    { das: { agua: 3 }, recibes: { analgesico: 2 }, existencias: 6 },
    { das: { balas9: 10 }, recibes: { antibiotico: 1 }, existencias: 4 },
    { das: { cartuchos: 6 }, recibes: { botiquin: 1 }, existencias: 3 },
    { das: { cafe: 2 }, recibes: { suero: 2 }, existencias: 4 },
  ],
};

export const BASES_CFG = {
  radioActivacion: 160,   // a menos de esto aparecen los NPC de la base
  radioRetiro: 220,
  guardado: 'pitalito:supervivencia:v1:bases',
};
